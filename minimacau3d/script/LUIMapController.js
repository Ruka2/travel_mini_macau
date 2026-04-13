/**
 * LUI Map Controller - 语言用户界面地图控制器
 * 处理与父窗口的通信，执行地图高亮、标记、路线规划等UI操作
 */

class LUIMapController {
    constructor(map) {
        this.map = map;
        this.highlightedSpots = [];
        this.currentPopup = null;
        this.markers = [];
        this.spotsLayerId = 'lui-spots-layer';
        this.spotsSourceId = 'lui-spots-source';
        this.pulseLayerId = 'lui-spots-pulse';
        this.routeLayerId = 'lui-route-layer';
        this.routeSourceId = 'lui-route-source';
        this.selectedSpot = null;
        this.animationFrame = null;
        
        // 用于管理连续的 highlight 请求
        this.pendingSpots = null;
        this.isWaitingForMap = false;
        this.highlightTimeoutId = null;
        
        this.init();
    }

    init() {
        console.log('[LUI] Initializing...');
        window.addEventListener('message', (e) => {
            console.log('[LUI] Received message:', e.data);
            this.handleParentMessage(e.data);
        });
        this.notifyParent('ready', {});
        console.log('[LUI] Map controller initialized, ready notification sent');
    }

    handleParentMessage(data) {
        console.log('[LUI] handleParentMessage called with:', data);
        
        if (!data) {
            console.log('[LUI] Received null/undefined data');
            return;
        }
        
        if (data.type !== 'command') {
            console.log('[LUI] Ignoring non-command message, type:', data.type);
            return;
        }
        
        console.log('[LUI] Received command:', data.command, 'params:', data.params);
        
        switch (data.command) {
            case 'highlightSpots':
                console.log('[LUI] Executing highlightSpots with', data.params?.spots?.length || 0, 'spots');
                this.highlightSpots(data.params?.spots || []);
                break;
            case 'clearSpots':
                console.log('[LUI] Executing clearSpots');
                this.clearHighlights();
                break;
            case 'navigateTo':
                console.log('[LUI] Executing navigateTo');
                this.navigateTo(data.params?.lng, data.params?.lat, data.params?.zoom);
                break;
            case 'selectSpot':
                console.log('[LUI] Executing selectSpot');
                this.selectSpot(data.params?.name);
                break;
            case 'showRoute':
                console.log('[LUI] Executing showRoute');
                this.showRoute(data.params?.from, data.params?.to, data.params?.mode);
                break;
            case 'clearRoute':
                console.log('[LUI] Executing clearRoute');
                this.clearRoute();
                break;
            case 'focusSpot':
                console.log('[LUI] Executing focusSpot');
                this.focusOnSpot(data.params?.lng, data.params?.lat, data.params?.name);
                break;
            default:
                console.warn('[LUI] Unknown command:', data.command);
        }
    }

    notifyParent(type, data) {
        console.log('[LUI] Notifying parent:', type, data);
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'map_event', 
                eventType: type, 
                data: data
            }, '*');
            console.log('[LUI] Message sent to parent');
        } else {
            console.log('[LUI] No parent window found or parent is self');
        }
    }

    /**
     * 比较两个景点数组是否相同
     * @param {Array} spots1 - 景点数组1
     * @param {Array} spots2 - 景点数组2
     * @returns {boolean} - 是否相同
     */
    areSpotsEqual(spots1, spots2) {
        if (!spots1 || !spots2) return false;
        if (spots1.length !== spots2.length) return false;
        if (spots1.length === 0) return true;
        
        // 比较每个景点的名称（主要标识）
        const names1 = spots1.map(s => s.name).sort();
        const names2 = spots2.map(s => s.name).sort();
        
        for (let i = 0; i < names1.length; i++) {
            if (names1[i] !== names2[i]) return false;
        }
        
        return true;
    }

    /**
     * 高亮显示景点
     * @param {Array} spots - 景点数组 [{name, lng, lat, description, color?}]
     */
    highlightSpots(spots) {
        console.log('[LUI] highlightSpots called with:', spots);
        
        if (!this.map) {
            console.error('[LUI] Map not available');
            return;
        }
        
        // 保存最新的 spots 数据
        this.pendingSpots = spots;
        
        // 如果正在等待地图加载，取消之前的等待
        if (this.isWaitingForMap) {
            console.log('[LUI] Canceling previous wait, new request received');
            if (this.highlightTimeoutId) {
                clearTimeout(this.highlightTimeoutId);
            }
        }
        
        // 确保地图已加载
        if (!this.map.loaded() || !this.map.isStyleLoaded()) {
            console.log('[LUI] Map not fully loaded yet, waiting...');
            this.isWaitingForMap = true;
            
            const tryHighlight = () => {
                // 检查是否已被取消（新的请求会更新 pendingSpots）
                if (spots !== this.pendingSpots) {
                    console.log('[LUI] This request was superseded by a newer one');
                    return;
                }
                
                if (this.map.loaded() && this.map.isStyleLoaded()) {
                    console.log('[LUI] Map now ready, proceeding with highlight');
                    this.isWaitingForMap = false;
                    this.highlightSpots(this.pendingSpots);
                } else {
                    this.highlightTimeoutId = setTimeout(tryHighlight, 100);
                }
            };
            this.highlightTimeoutId = setTimeout(tryHighlight, 100);
            return;
        }
        
        // 使用最新的数据
        spots = this.pendingSpots;
        this.pendingSpots = null;
        
        if (!spots || spots.length === 0) {
            console.log('[LUI] No spots to highlight');
            return;
        }
        
        // 检查新推荐的景点是否与当前高亮的景点相同
        if (this.areSpotsEqual(this.highlightedSpots, spots)) {
            console.log('[LUI] Spots are the same as current highlights, skipping update');
            // 可以在这里添加一个轻微的动画反馈，表示"已聚焦"
            this.pulseCurrentHighlights();
            return;
        }
        
        console.log('[LUI] Spots changed, updating highlights...');
        
        // 【关键修复】先准备好新数据，再清除旧数据，确保切换流畅
        // 1. 先保存新的景点数据
        const newSpots = spots.map((spot, index) => ({
            ...spot,
            index: index + 1,
            color: spot.color || this.getSpotColor(index)
        }));
        
        // 2. 清除旧的地图图层和事件（不清除面板，后面我们会更新面板）
        this.stopAnimation();
        this._clearMapLayersOnly();
        
        // 3. 保存新的景点数据
        this.highlightedSpots = newSpots;
        
        // 4. 更新面板（显示新数据）
        this.updateSpotsPanel(true);
        
        console.log('[LUI] Highlighting', spots.length, 'spots:', spots);
        
        // 创建GeoJSON数据
        const features = spots.map((spot, index) => ({
            type: 'Feature',
            properties: {
                name: spot.name || '未知地点',
                description: spot.description || '',
                index: index + 1,
                color: spot.color || this.getSpotColor(index)
            },
            geometry: {
                type: 'Point',
                coordinates: [spot.lng, spot.lat]
            }
        }));

        // 添加数据源
        if (!this.map.getSource(this.spotsSourceId)) {
            this.map.addSource(this.spotsSourceId, {
                type: 'geojson',
                data: {type: 'FeatureCollection', features: features}
            });
        } else {
            this.map.getSource(this.spotsSourceId).setData({type: 'FeatureCollection', features: features});
        }

        // 添加脉冲动画圆圈（外圈）
        if (!this.map.getLayer(this.pulseLayerId)) {
            this.map.addLayer({
                id: this.pulseLayerId,
                type: 'circle',
                source: this.spotsSourceId,
                paint: {
                    'circle-radius': 25,
                    'circle-color': '#FF6B35',
                    'circle-opacity': 0.3,
                    'circle-stroke-width': 0
                }
            });
        }

        // 添加主圆圈 - 使用数据中的 color 属性
        if (!this.map.getLayer(this.spotsLayerId + '-circle')) {
            this.map.addLayer({
                id: this.spotsLayerId + '-circle',
                type: 'circle',
                source: this.spotsSourceId,
                paint: {
                    'circle-radius': 18,
                    'circle-color': ['get', 'color'],  // 从数据中获取颜色
                    'circle-opacity': 0.9,
                    'circle-stroke-width': 3,
                    'circle-stroke-color': '#FFFFFF'
                }
            });
        } else {
            // 更新已有图层的颜色
            this.map.setPaintProperty(this.spotsLayerId + '-circle', 'circle-color', ['get', 'color']);
        }

        // 添加序号
        if (!this.map.getLayer(this.spotsLayerId + '-number')) {
            this.map.addLayer({
                id: this.spotsLayerId + '-number',
                type: 'symbol',
                source: this.spotsSourceId,
                layout: {
                    'text-field': ['get', 'index'],
                    'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                    'text-size': 14,
                    'text-allow-overlap': true
                },
                paint: {'text-color': '#FFFFFF'}
            });
        }

        // 添加名称标签（带背景）- 文字描边颜色与标记颜色一致
        if (!this.map.getLayer(this.spotsLayerId + '-label')) {
            this.map.addLayer({
                id: this.spotsLayerId + '-label',
                type: 'symbol',
                source: this.spotsSourceId,
                layout: {
                    'text-field': ['get', 'name'],
                    'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
                    'text-size': 13,
                    'text-offset': [0, -2.5],
                    'text-anchor': 'bottom',
                    'text-optional': false
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': ['get', 'color'],  // 从数据中获取颜色，与标记一致
                    'text-halo-width': 3,
                    'text-opacity': 1
                }
            });
        } else {
            // 更新已有图层的文字描边颜色
            this.map.setPaintProperty(this.spotsLayerId + '-label', 'text-halo-color', ['get', 'color']);
        }

        // 先移除旧的事件监听器（如果存在）
        this.map.off('click', this.spotsLayerId + '-circle', this._handleSpotClick);
        this.map.off('mouseenter', this.spotsLayerId + '-circle', this._handleMouseEnter);
        this.map.off('mouseleave', this.spotsLayerId + '-circle', this._handleMouseLeave);
        
        // 绑定新的事件处理函数（保存引用以便后续移除）
        this._handleSpotClick = (e) => {
            const feature = e.features[0];
            this.onSpotClick(feature.properties, e.lngLat);
        };
        this._handleMouseEnter = () => {
            this.map.getCanvas().style.cursor = 'pointer';
        };
        this._handleMouseLeave = () => {
            this.map.getCanvas().style.cursor = '';
        };
        
        this.map.on('click', this.spotsLayerId + '-circle', this._handleSpotClick);
        this.map.on('mouseenter', this.spotsLayerId + '-circle', this._handleMouseEnter);
        this.map.on('mouseleave', this.spotsLayerId + '-circle', this._handleMouseLeave);

        // 调整地图视角
        this.fitBounds(spots);
        
        // 启动脉冲动画
        this.startPulseAnimation();
        
        // 更新景点列表面板
        this.updateSpotsPanel();
        
        // 通知父窗口
        this.notifyParent('spots_highlighted', {
            count: spots.length,
            spots: this.highlightedSpots
        });
    }

    /**
     * 景点点击处理
     */
    onSpotClick(properties, lngLat) {
        const clickedName = properties.name;
        this.selectedSpot = clickedName;
        
        // 从 highlightedSpots 获取正确的颜色
        const spot = this.highlightedSpots.find(s => s.name === clickedName);
        const spotColor = spot ? (spot.color || this.getSpotColor(spot.index - 1)) : '#FF6B35';
        
        // 保持所有标记为原始颜色，不变成绿色
        this.map.setPaintProperty(this.spotsLayerId + '-circle', 'circle-color', ['get', 'color']);
        
        // 文字描边也保持原始颜色
        this.map.setPaintProperty(this.spotsLayerId + '-label', 'text-halo-color', ['get', 'color']);

        // 显示弹窗，传入正确的颜色
        this.showSpotPopup({
            name: clickedName,
            description: properties.description,
            index: properties.index,
            color: spotColor
        }, lngLat);
        
        // 通知父窗口景点被选中
        this.notifyParent('spot_selected', {
            name: clickedName,
            index: properties.index,
            description: properties.description
        });
    }
    
    /**
     * 重置所有标记为原始颜色
     */
    resetAllSpotColors() {
        // 强制刷新数据源中的颜色
        const source = this.map.getSource(this.spotsSourceId);
        if (source && source._data) {
            const features = source._data.features;
            features.forEach((feature, index) => {
                const spot = this.highlightedSpots.find(s => s.name === feature.properties.name);
                if (spot) {
                    feature.properties.color = spot.color || this.getSpotColor(index);
                }
            });
            source.setData(source._data);
        }
    }

    /**
     * 选择指定名称的景点（从外部调用）
     */
    selectSpot(name) {
        const spot = this.highlightedSpots.find(s => s.name === name);
        if (!spot) return;

        this.selectedSpot = name;
        
        // 保持所有标记为原始颜色，不变成绿色
        this.map.setPaintProperty(this.spotsLayerId + '-circle', 'circle-color', ['get', 'color']);
        
        // 文字描边也保持原始颜色
        this.map.setPaintProperty(this.spotsLayerId + '-label', 'text-halo-color', ['get', 'color']);

        // 飞到该位置
        this.map.flyTo({
            center: [spot.lng, spot.lat],
            zoom: 16,
            duration: 800
        });

        // 显示弹窗，传入颜色
        const properties = {
            name: spot.name,
            description: spot.description,
            index: spot.index,
            color: spot.color || this.getSpotColor(this.highlightedSpots.indexOf(spot))
        };
        this.showSpotPopup(properties, [spot.lng, spot.lat]);
    }

    /**
     * 聚焦到指定位置
     */
    focusOnSpot(lng, lat, name) {
        this.map.flyTo({
            center: [lng, lat],
            zoom: 16,
            duration: 1000,
            essential: true
        });

        // 如果有匹配的高亮点，选中它
        if (name) {
            const spot = this.highlightedSpots.find(s => s.name === name);
            if (spot) {
                this.selectSpot(name);
            }
        }
    }

    /**
     * 显示路线 - 支持调用现有的导航功能
     * @param {Object} from - 起点 {name, lat, lng}
     * @param {Object} to - 终点 {name, lat, lng}
     * @param {String} mode - 交通方式 walking|driving|transit|combined
     */
    showRoute(from, to, mode = 'walking') {
        console.log('[LUI] showRoute called:', from, to, mode);
        
        // 先清除之前的路线
        this.clearRoute();
        
        if (!from || !to) {
            console.warn('[LUI] Invalid route parameters');
            return;
        }
        
        // 确保坐标是数字
        const fromLat = parseFloat(from.lat);
        const fromLng = parseFloat(from.lng);
        const toLat = parseFloat(to.lat);
        const toLng = parseFloat(to.lng);
        
        if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
            console.warn('[LUI] Invalid coordinates');
            return;
        }
        
        // 使用现有的导航功能（如果可用）
        if (mode === 'combined' && typeof window.startCombinedRouteNavigation === 'function') {
            // 联合路线导航（步行+公交）
            console.log('[LUI] Using combined route navigation');
            window.startCombinedRouteNavigation([fromLng, fromLat], [toLng, toLat], null);
        } else if (typeof window.startRouteNavigation === 'function') {
            // 普通路线导航
            console.log('[LUI] Using standard route navigation');
            window.startRouteNavigation([fromLng, fromLat], [toLng, toLat], mode);
        } else {
            // 如果没有现有导航功能，使用简化的路线显示
            console.log('[LUI] Using simplified route display');
            this.showSimplifiedRoute({lat: fromLat, lng: fromLng, name: from.name}, 
                                      {lat: toLat, lng: toLng, name: to.name});
        }
        
        this.notifyParent('route_shown', { 
            from: from.name || '起点', 
            to: to.name || '终点',
            mode: mode
        });
    }

    /**
     * 显示简化路线（当没有现有导航功能时使用）
     */
    showSimplifiedRoute(from, to) {
        // 添加路线数据源
        const coordinates = [[from.lng, from.lat], [to.lng, to.lat]];
        
        if (!this.map.getSource(this.routeSourceId)) {
            this.map.addSource(this.routeSourceId, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: coordinates
                    }
                }
            });
        }

        // 添加路线图层
        if (!this.map.getLayer(this.routeLayerId)) {
            this.map.addLayer({
                id: this.routeLayerId,
                type: 'line',
                source: this.routeSourceId,
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#2196F3',
                    'line-width': 6,
                    'line-opacity': 0.8,
                    'line-dasharray': [2, 1]
                }
            });
        }

        // 添加起点和终点标记
        this.addRouteMarkers(from, to);

        // 调整视角以包含整个路线
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord));
        this.map.fitBounds(bounds, {
            padding: { top: 100, bottom: 100, left: 100, right: 100 },
            duration: 1000
        });
    }

    /**
     * 添加路线起终点标记
     */
    addRouteMarkers(from, to) {
        // 起点标记
        const startEl = document.createElement('div');
        startEl.className = 'lui-route-marker start';
        startEl.innerHTML = '<div class="marker-pin" style="background:#4CAF50;">起</div>';
        startEl.style.cssText = `
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const startMarker = new mapboxgl.Marker(startEl)
            .setLngLat([from.lng, from.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(from.name || '起点'))
            .addTo(this.map);
        this.markers.push(startMarker);

        // 终点标记
        const endEl = document.createElement('div');
        endEl.className = 'lui-route-marker end';
        endEl.innerHTML = '<div class="marker-pin" style="background:#F44336;">终</div>';
        endEl.style.cssText = `
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const endMarker = new mapboxgl.Marker(endEl)
            .setLngLat([to.lng, to.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(to.name || '终点'))
            .addTo(this.map);
        this.markers.push(endMarker);
    }

    /**
     * 清除路线
     */
    clearRoute() {
        // 清除LUI添加的路线
        if (this.map.getLayer(this.routeLayerId)) {
            this.map.removeLayer(this.routeLayerId);
        }
        if (this.map.getSource(this.routeSourceId)) {
            this.map.removeSource(this.routeSourceId);
        }
        
        // 清除路线相关的markers
        this.markers.forEach(marker => marker.remove());
        this.markers = [];
        
        // 尝试清除现有的导航路线（如果存在）
        if (typeof window.clearRouteNavigation === 'function') {
            window.clearRouteNavigation(this.map);
        }
        
        this.notifyParent('route_cleared', {});
    }

    /**
     * 启动脉冲动画
     */
    startPulseAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        let radius = 25;
        let growing = true;
        
        const animate = () => {
            if (!this.map.getLayer(this.pulseLayerId)) return;
            
            if (growing) {
                radius += 0.3;
                if (radius >= 35) growing = false;
            } else {
                radius -= 0.3;
                if (radius <= 25) growing = true;
            }
            
            const opacity = 0.3 - (radius - 25) * 0.02;
            
            this.map.setPaintProperty(this.pulseLayerId, 'circle-radius', radius);
            this.map.setPaintProperty(this.pulseLayerId, 'circle-opacity', Math.max(0, opacity));
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        
        animate();
    }

    /**
     * 停止动画
     */
    stopAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    /**
     * 当前高亮景点脉冲反馈（景点相同时给用户视觉提示）
     */
    pulseCurrentHighlights() {
        if (!this.highlightedSpots || this.highlightedSpots.length === 0) return;
        
        // 短暂增强脉冲效果
        if (this.map.getLayer(this.pulseLayerId)) {
            // 临时增大脉冲半径
            this.map.setPaintProperty(this.pulseLayerId, 'circle-radius', 40);
            this.map.setPaintProperty(this.pulseLayerId, 'circle-opacity', 0.5);
            
            // 300ms后恢复正常动画
            setTimeout(() => {
                if (this.map.getLayer(this.pulseLayerId)) {
                    this.startPulseAnimation();
                }
            }, 300);
        }
        console.log('[LUI] Pulsed current highlights as feedback');
    }

    getSpotColor(index) {
        const colors = ['#FF6B35', '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#E91E63', '#00BCD4'];
        return colors[index % colors.length];
    }

    /**
     * 显示景点弹窗
     */
    showSpotPopup(properties, lngLat) {
        if (this.currentPopup) this.currentPopup.remove();
        
        // 获取颜色，如果没有则使用默认橙色
        const color = properties.color || '#FF6B35';
        
        // 根据颜色生成渐变色（简化处理，使用相同颜色）
        const gradientColor = color;
        
        const popupHTML = `
            <div style="
                background: linear-gradient(135deg, ${gradientColor} 0%, ${gradientColor} 100%);
                color: white;
                padding: 12px 16px;
                border-radius: 10px;
                min-width: 180px;
                max-width: 250px;
                box-shadow: 0 4px 20px ${color}66;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    font-weight: bold; 
                    font-size: 16px; 
                    margin-bottom: 6px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                ">
                    <span style="
                        background: white;
                        color: ${color};
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                    ">${properties.index}</span>
                    ${properties.name}
                </div>
                ${properties.description ? 
                    `<div style="font-size: 13px; opacity: 0.95; line-height: 1.4;">${properties.description}</div>` : 
                    ''}
            </div>
        `;
        
        this.currentPopup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: true,
            offset: 15,
            className: 'lui-popup'
        })
            .setLngLat(lngLat)
            .setHTML(popupHTML)
            .addTo(this.map);
        
        // 设置箭头颜色与地点颜色匹配
        this.setPopupArrowColor(color);
    }

    /**
     * 设置弹出框箭头颜色
     */
    setPopupArrowColor(color) {
        // 使用 setTimeout 确保 DOM 已渲染
        setTimeout(() => {
            const popupElement = document.querySelector('.mapboxgl-popup.lui-popup');
            if (popupElement) {
                const tip = popupElement.querySelector('.mapboxgl-popup-tip');
                if (tip) {
                    tip.style.borderTopColor = color;
                }
            }
        }, 10);
    }

    /**
     * 清除所有高亮（公共方法）
     * @param {boolean} immediate - 是否立即清除面板（不等待动画）
     */
    clearHighlights(immediate = false) {
        this._doClearHighlights(immediate);
    }
    
    /**
     * 仅清除地图图层和数据源，不清除面板和数据（用于景点切换时）
     */
    _clearMapLayersOnly() {
        this.stopAnimation();
        
        // 清除所有事件监听 - 使用 try-catch 防止图层不存在时出错
        try {
            if (this.map.getLayer(this.spotsLayerId + '-circle')) {
                if (this._handleSpotClick) {
                    this.map.off('click', this.spotsLayerId + '-circle', this._handleSpotClick);
                }
                if (this._handleMouseEnter) {
                    this.map.off('mouseenter', this.spotsLayerId + '-circle', this._handleMouseEnter);
                }
                if (this._handleMouseLeave) {
                    this.map.off('mouseleave', this.spotsLayerId + '-circle', this._handleMouseLeave);
                }
            }
        } catch (e) {
            console.log('[LUI] Error removing event listeners:', e);
        }

        // 移除图层 - 使用 try-catch 防止出错
        [this.pulseLayerId, this.spotsLayerId + '-circle', this.spotsLayerId + '-number', this.spotsLayerId + '-label'].forEach(layerId => {
            try {
                if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
            } catch (e) {
                console.log('[LUI] Error removing layer:', layerId, e);
            }
        });

        // 移除数据源
        try {
            if (this.map.getSource(this.spotsSourceId)) this.map.removeSource(this.spotsSourceId);
        } catch (e) {
            console.log('[LUI] Error removing source:', e);
        }

        // 清除弹窗
        if (this.currentPopup) {
            try {
                this.currentPopup.remove();
            } catch (e) {
                console.log('[LUI] Error removing popup:', e);
            }
            this.currentPopup = null;
        }

        // 清除markers
        this.markers.forEach(marker => {
            try {
                marker.remove();
            } catch (e) {
                console.log('[LUI] Error removing marker:', e);
            }
        });
        this.markers = [];
        
        console.log('[LUI] Map layers cleared (panel and data preserved)');
    }
    
    /**
     * 实际执行清除操作（内部方法）
     * @param {boolean} immediate - 是否立即清除面板（不等待动画）
     */
    _doClearHighlights(immediate = false) {
        this.stopAnimation();
        
        // 清除所有事件监听 - 使用 try-catch 防止图层不存在时出错
        try {
            if (this.map.getLayer(this.spotsLayerId + '-circle')) {
                // 使用保存的引用移除监听器
                if (this._handleSpotClick) {
                    this.map.off('click', this.spotsLayerId + '-circle', this._handleSpotClick);
                }
                if (this._handleMouseEnter) {
                    this.map.off('mouseenter', this.spotsLayerId + '-circle', this._handleMouseEnter);
                }
                if (this._handleMouseLeave) {
                    this.map.off('mouseleave', this.spotsLayerId + '-circle', this._handleMouseLeave);
                }
            }
        } catch (e) {
            console.log('[LUI] Error removing event listeners:', e);
        }

        // 移除图层 - 使用 try-catch 防止出错
        [this.pulseLayerId, this.spotsLayerId + '-circle', this.spotsLayerId + '-number', this.spotsLayerId + '-label'].forEach(layerId => {
            try {
                if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
            } catch (e) {
                console.log('[LUI] Error removing layer:', layerId, e);
            }
        });

        // 移除数据源
        try {
            if (this.map.getSource(this.spotsSourceId)) this.map.removeSource(this.spotsSourceId);
        } catch (e) {
            console.log('[LUI] Error removing source:', e);
        }

        // 清除弹窗
        if (this.currentPopup) {
            try {
                this.currentPopup.remove();
            } catch (e) {
                console.log('[LUI] Error removing popup:', e);
            }
            this.currentPopup = null;
        }

        // 清除markers
        this.markers.forEach(marker => {
            try {
                marker.remove();
            } catch (e) {
                console.log('[LUI] Error removing marker:', e);
            }
        });
        this.markers = [];

        this.highlightedSpots = [];
        this.selectedSpot = null;
        
        // 更新景点列表面板（会移除面板）
        this.updateSpotsPanel(immediate);
        
        this.notifyParent('spots_cleared', {});
        console.log('[LUI] Highlights cleared');
    }

    /**
     * 调整地图视角以适应所有景点
     */
    fitBounds(spots) {
        if (!spots || spots.length === 0) return;
        
        if (spots.length === 1) {
            this.map.flyTo({
                center: [spots[0].lng, spots[0].lat],
                zoom: 15.5,
                duration: 1200,
                essential: true
            });
        } else {
            const bounds = new mapboxgl.LngLatBounds();
            spots.forEach(spot => bounds.extend([spot.lng, spot.lat]));
            
            this.map.fitBounds(bounds, {
                padding: { top: 120, bottom: 120, left: 120, right: 120 },
                duration: 1200,
                maxZoom: 16,
                essential: true
            });
        }
    }

    /**
     * 导航到指定位置
     */
    navigateTo(lng, lat, zoom = 15) {
        this.map.flyTo({
            center: [lng, lat],
            zoom: zoom,
            duration: 1000,
            essential: true
        });
    }

    /**
     * 获取当前高亮的景点列表
     */
    getHighlightedSpots() {
        return this.highlightedSpots;
    }

    /**
     * 获取当前选中的景点
     */
    getSelectedSpot() {
        return this.selectedSpot;
    }

    /**
     * 创建景点列表面板
     */
    createSpotsPanel() {
        let panel = document.getElementById('lui-spots-panel');
        if (panel) {
            panel.remove();
        }

        panel = document.createElement('div');
        panel.id = 'lui-spots-panel';
        panel.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            background: rgba(30, 30, 30, 0.95);
            border-radius: 12px;
            padding: 16px;
            min-width: 220px;
            max-width: 280px;
            max-height: 400px;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            border: 0px solid rgba(255,107,53,0.3);
            z-index: 1000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            backdrop-filter: blur(10px);
            transition: transform 0.3s ease, opacity 0.3s ease;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        `;

        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 14px;
            font-weight: 600;
            color: #FF6B35;
            display: flex;
            align-items: center;
            gap: 6px;
        `;
        title.innerHTML = `<span>📍</span> 推薦景點`;

        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = '✕';
        clearBtn.style.cssText = `
            background: rgba(255,255,255,0.1);
            border: none;
            color: #aaa;
            width: 24px;
            height: 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        `;
        clearBtn.onmouseenter = () => {
            clearBtn.style.background = 'rgba(244,67,54,0.3)';
            clearBtn.style.color = '#fff';
        };
        clearBtn.onmouseleave = () => {
            clearBtn.style.background = 'rgba(255,255,255,0.1)';
            clearBtn.style.color = '#aaa';
        };
        clearBtn.onclick = () => this.clearHighlights();

        header.appendChild(title);
        header.appendChild(clearBtn);
        panel.appendChild(header);

        const listContainer = document.createElement('div');
        listContainer.id = 'lui-spots-list';
        listContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        panel.appendChild(listContainer);

        document.body.appendChild(panel);
        return panel;
    }

    /**
     * 更新景点列表面板
     * @param {boolean} immediate - 是否立即移除面板（不等待动画）
     */
    updateSpotsPanel(immediate = false) {
        let panel = document.getElementById('lui-spots-panel');
        
        if (this.highlightedSpots.length === 0) {
            if (panel) {
                if (immediate) {
                    // 立即移除，不等待动画（用于新一轮推荐时）
                    panel.remove();
                } else {
                    // 正常淡出动画（用于用户点击清除按钮）
                    panel.style.opacity = '0';
                    panel.style.transform = 'translateX(-20px)';
                    setTimeout(() => {
                        if (panel && panel.parentNode) {
                            panel.remove();
                        }
                    }, 300);
                }
            }
            return;
        }

        // 如果有新数据，先确保完全清除旧面板
        if (panel) {
            panel.remove();
        }
        
        // 创建新面板
        panel = this.createSpotsPanel();

        const listContainer = panel.querySelector('#lui-spots-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        this.highlightedSpots.forEach((spot, index) => {
            const item = document.createElement('div');
            const isSelected = this.selectedSpot === spot.name;
            
            item.style.cssText = `
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                background: ${isSelected ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.05)'};
                border: 1px solid ${isSelected ? 'rgba(76,175,80,0.5)' : 'transparent'};
            `;

            item.onmouseenter = () => {
                if (!isSelected) {
                    item.style.background = 'rgba(255,255,255,0.1)';
                }
            };
            item.onmouseleave = () => {
                if (!isSelected) {
                    item.style.background = 'rgba(255,255,255,0.05)';
                }
            };
            item.onclick = () => this.selectSpot(spot.name);

            const number = document.createElement('div');
            number.style.cssText = `
                width: 26px;
                height: 26px;
                border-radius: 50%;
                background: ${spot.color || this.getSpotColor(index)};
                color: white;
                font-size: 12px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            `;
            number.textContent = index + 1;

            const info = document.createElement('div');
            info.style.cssText = `
                flex: 1;
                min-width: 0;
            `;

            const name = document.createElement('div');
            name.style.cssText = `
                font-size: 13px;
                font-weight: 500;
                color: #fff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            `;
            name.textContent = spot.name;

            const desc = document.createElement('div');
            desc.style.cssText = `
                font-size: 11px;
                color: #888;
                margin-top: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            `;
            desc.textContent = spot.description || '';

            info.appendChild(name);
            if (spot.description) {
                info.appendChild(desc);
            }

            item.appendChild(number);
            item.appendChild(info);
            listContainer.appendChild(item);
        });

        const tip = document.createElement('div');
        tip.style.cssText = `
            font-size: 11px;
            color: #666;
            text-align: center;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid rgba(255,255,255,0.1);
        `;
        tip.textContent = `共 ${this.highlightedSpots.length} 個景點 · 點擊定位`;
        listContainer.appendChild(tip);
    }
}

// 导出到全局
window.LUIMapController = LUIMapController;

// 自动初始化函数
window.initLUIMapController = function(map) {
    if (!window.luiMapController && map) {
        window.luiMapController = new LUIMapController(map);
        console.log('[LUI] Controller initialized');
    }
    return window.luiMapController;
};

// 等待地图初始化后自动初始化LUI控制器
window.waitForMapAndInitLUI = function() {
    console.log('[LUI] waitForMapAndInitLUI called');
    // 防止重复初始化
    if (window.luiMapController) {
        console.log('[LUI] Controller already exists, skipping');
        return;
    }
    
    const checkMap = () => {
        if (window.map && typeof window.map.loaded === 'function') {
            if (window.map.loaded()) {
                window.initLUIMapController(window.map);
            } else {
                window.map.once('load', () => {
                    window.initLUIMapController(window.map);
                });
            }
        } else {
            console.log('[LUI] Map not ready yet, retrying...');
            setTimeout(checkMap, 500);
        }
    };
    checkMap();
};

// 启动检查
function startLUIInit() {
    console.log('[LUI] Starting LUI initialization, readyState:', document.readyState);
    
    // 如果文档还在加载中，等待 DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startLUIInit);
        return;
    }
    
    // 直接调用 waitForMapAndInitLUI（它现在定义在上面）
    window.waitForMapAndInitLUI();
}

// 启动
startLUIInit();
