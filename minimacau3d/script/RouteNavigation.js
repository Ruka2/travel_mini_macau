let navigationActive = !1,
    navigationLayer = null,
    currentRoute = null,
    destinationMarker = null,
    routeSourceId = 'navigation-route';
const navigationUtils = { estimatedTimeInfo: null };
let busRouteSourceId = 'bus-route',
    combinedRouteActive = !1,
    busRoute = null,
    transferStationMarker = null;
function initRouteNavigation(n) {
    ((window.userPosition = window.userPosition || null),
        createRouteNavigationButton(n),
        addNavigationStyles(),
        (window.startRouteNavigation = (t, e, o) => {
            (navigationActive && clearRouteNavigation(n),
                showRouteNavigationUI(),
                calculateAndDisplayRoute(n, t, e, o));
        }),
        (window.startCombinedRouteNavigation = function (t, e, o) {
            !(function (n, t, e, o) {
                try {
                    if (!window.station_data || 0 === window.station_data.length)
                        return void alert('巴士站數據尚未加載完成，請稍後再試。');
                    (navigationActive && clearRouteNavigation(n),
                        (navigationActive = !0),
                        (combinedRouteActive = !0),
                        document.getElementById('route-navigation-button')?.classList.add('active'),
                        showCombinedRouteNavigationUI(),
                        (async () => {
                            try {
                                ((document.getElementById('route-loading').style.display = 'block'),
                                    (document.getElementById('route-details').style.display = 'none'));
                                const i = await findNearestBusStation(t),
                                    a = o
                                        ? window.station_data.find((n) => n.stationCode === o)
                                        : await findNearestBusStation(e);
                                await processCombinedRoute(n, t, e, o, i, a);
                            } catch (n) {
                                handleRouteError(n);
                            }
                        })());
                } catch (n) {
                    alert('無法啟動聯合路線規劃: ' + n.message);
                }
            })(n, t, e, o);
        }));
    // 已禁用右鍵地圖彈窗功能
    /*
    n.on('contextmenu', (t) => {
        const e = [t.lngLat.lng, t.lngLat.lat],
            o = `\n            <div class="destination-popup">\n                <h3>地圖位置</h3>\n                <p style="font-size: 12px; color: #666;">經緯度: ${e[1].toFixed(5)}, ${e[0].toFixed(5)}</p>\n                <div class="navigation-options">\n                    <button id="contextmenu-walk-navigation" class="nav-option-btn">步行前往</button>\n                    <button id="contextmenu-combined-navigation" class="nav-option-btn">行人+巴士聯合路線</button>\n                </div>\n            </div>\n        `,
            i = new mapboxgl.Popup({ closeButton: !0, closeOnClick: !0, maxWidth: '300px' })
                .setLngLat(e)
                .setHTML(o)
                .addTo(n);
        setTimeout(() => {
            try {
                const t = document.getElementById('contextmenu-walk-navigation');
                t &&
                    t.addEventListener('click', () => {
                        let t;
                        i.remove();
                        try {
                            t = window.userPosition || n.getCenter().toArray();
                        } catch (e) {
                            t = n.getCenter().toArray();
                        }
                        try {
                            window.startRouteNavigation(t, e);
                        } catch (n) {
                            alert('啟動導航時出錯，請稍後再試。');
                        }
                    });
                const o = document.getElementById('contextmenu-combined-navigation');
                o &&
                    o.addEventListener('click', () => {
                        let t;
                        i.remove();
                        try {
                            t = window.userPosition || n.getCenter().toArray();
                        } catch (e) {
                            t = n.getCenter().toArray();
                        }
                        try {
                            window.startCombinedRouteNavigation(t, e);
                        } catch (n) {
                            alert('啟動導航時出錯，請稍後再試。');
                        }
                    });
            } catch (n) {}
        }, 100);
    });
    */
}
function createRouteNavigationButton(n) {
    const t = document.createElement('a');
    ((t.id = 'route-navigation-button'),
        (t.className = 'panel_button'),
        (t.innerHTML = '<i class="fa-solid fa-directions"></i>'),
        (t.title = '路線規劃'),
        document.getElementById('map_panel').appendChild(t),
        t.addEventListener('click', () => {
            navigationActive
                ? (clearRouteNavigation(n), t.classList.remove('active'))
                : (showNavigationSelectionUI(n), t.classList.add('active'));
        }));
}
function showNavigationSelectionUI(n) {
    if (document.getElementById('navigation-selection'))
        return void (document.getElementById('navigation-selection').style.display = 'flex');
    const t = document.createElement('div');
    ((t.id = 'navigation-selection'),
        (t.className = 'navigation-selection'),
        (t.innerHTML =
            '\n        <div class="navigation-header">\n            <h3>路線規劃</h3>\n            <button id="close-navigation-selection" class="close-btn"><i class="fa-solid fa-times"></i></button>\n        </div>\n        <div class="navigation-body">\n            <div class="location-inputs">\n                <div class="location-input">\n                    <label><i class="fa-solid fa-map-marker-alt"></i> 起點:</label>\n                    <select id="start-location">\n                        <option value="current-location" selected>您的當前位置</option>\n                        <option value="custom-location">自定義位置</option>\n                    </select>\n                    <div id="custom-start" style="display:none;">\n                        <input type="text" id="custom-start-input" placeholder="點擊地圖選擇起點...">\n                    </div>\n                </div>\n                <div class="location-input">\n                    <label><i class="fa-solid fa-flag-checkered"></i> 終點:</label>\n                    <select id="end-location">\n                        <option value="" selected disabled>請選擇目的地類型</option>\n                        <option value="bus-station">巴士站</option>\n                        <option value="custom-location">自定義位置</option>\n                    </select>\n                    <div id="station-selection" style="display:none;">\n                        <select id="station-select">\n                            <option value="" selected disabled>請選擇巴士站...</option>\n                        </select>\n                    </div>\n                    <div id="custom-end" style="display:none;">\n                        <input type="text" id="custom-end-input" placeholder="點擊地圖選擇終點...">\n                    </div>\n                </div>\n            </div>\n            <div class="navigation-actions">\n                <button id="calculate-route-btn" disabled>計算路線</button>\n            </div>\n        </div>\n    '),
        document.body.appendChild(t),
        document.getElementById('close-navigation-selection').addEventListener('click', () => {
            ((document.getElementById('navigation-selection').style.display = 'none'),
                document.getElementById('route-navigation-button').classList.remove('active'));
        }),
        document.getElementById('start-location').addEventListener('change', (t) => {
            const e = 'custom-location' === t.target.value;
            ((document.getElementById('custom-start').style.display = e ? 'block' : 'none'),
                e && enableMapSelectionMode(n, 'start'),
                updateCalculateButtonState());
        }),
        document.getElementById('end-location').addEventListener('change', (t) => {
            const e = t.target.value;
            ((document.getElementById('station-selection').style.display = 'bus-station' === e ? 'block' : 'none'),
                (document.getElementById('custom-end').style.display = 'custom-location' === e ? 'block' : 'none'),
                'bus-station' === e
                    ? populateStationOptions()
                    : 'custom-location' === e && enableMapSelectionMode(n, 'end'),
                updateCalculateButtonState());
        }),
        document.getElementById('station-select').addEventListener('change', updateCalculateButtonState),
        document.getElementById('calculate-route-btn').addEventListener('click', () => {
            const t = document.getElementById('start-location').value,
                e = document.getElementById('end-location').value;
            let o, i, a;
            if ('current-location' === t) {
                if (!window.userPosition) return void alert('無法獲取您的位置，請確保已啟用位置服務。');
                o = window.userPosition;
            } else {
                const n = window.customMarkers?.start;
                if (!n) return void alert('請先在地圖上選擇起點。');
                o = n.getLngLat().toArray();
            }
            if ('bus-station' === e) {
                const n = document.getElementById('station-select').value;
                if (!n) return void alert('請選擇一個巴士站。');
                const t = window.station_data.find((t) => t.stationCode === n);
                if (!t) return void alert('無法找到所選巴士站的坐標。');
                ((i = t.coordinate), (a = n));
            } else {
                const n = window.customMarkers?.end;
                if (!n) return void alert('請先在地圖上選擇終點。');
                i = n.getLngLat().toArray();
            }
            ((document.getElementById('navigation-selection').style.display = 'none'),
                calculateAndDisplayRoute(n, o, i, a));
        }));
}
function enableMapSelectionMode(n, t) {
    (window.customMarkers || (window.customMarkers = {}),
        n.once('click', (e) => {
            const o = [e.lngLat.lng, e.lngLat.lat];
            window.customMarkers[t] && window.customMarkers[t].remove();
            const i = new mapboxgl.Marker({ color: 'start' === t ? '#3498db' : '#e74c3c' }).setLngLat(o).addTo(n);
            ((window.customMarkers[t] = i),
                (document.getElementById(`custom-${t}-input`).value = `${o[1].toFixed(5)}, ${o[0].toFixed(5)}`),
                updateCalculateButtonState());
        }),
        (n.getCanvas().style.cursor = 'crosshair'));
    const e = document.createElement('div');
    ((e.id = 'map-selection-message'),
        (e.className = 'map-selection-message'),
        (e.innerHTML = `<p>請在地圖上點擊選擇${'start' === t ? '起點' : '終點'}</p>`),
        document.body.appendChild(e),
        setTimeout(() => {
            (document.getElementById('map-selection-message')?.remove(), (n.getCanvas().style.cursor = ''));
        }, 3e3));
}
function updateCalculateButtonState() {
    const n = document.getElementById('start-location').value,
        t = document.getElementById('end-location').value,
        e = document.getElementById('calculate-route-btn');
    let o = !0,
        i = !1;
    if (((o = 'current-location' === n ? !!window.userPosition : !!window.customMarkers?.start), 'bus-station' === t)) {
        i = !!document.getElementById('station-select').value;
    } else 'custom-location' === t && (i = !!window.customMarkers?.end);
    e.disabled = !(o && i);
}
function populateStationOptions() {
    const n = document.getElementById('station-select');
    ((n.innerHTML = '<option value="" selected disabled>請選擇巴士站...</option>'),
        window.station_data && 0 !== window.station_data.length
            ? window.station_data.forEach((t) => {
                  const e = document.createElement('option');
                  ((e.value = t.stationCode), (e.textContent = t.description), n.appendChild(e));
              })
            : (n.innerHTML += '<option value="" disabled>沒有可用的巴士站數據</option>'));
}
function showRouteNavigationUI() {
    const n = document.getElementById('route-info-panel');
    if (n) {
        if (!n.classList.contains('combined-route-panel')) return void (n.style.display = 'block');
        n.remove();
    }
    const t = document.createElement('div');
    ((t.id = 'route-info-panel'),
        (t.className = 'route-info-panel'),
        (t.innerHTML =
            '\n        <div class="route-info-header">\n            <h3>路線信息</h3>\n            <button id="close-route-info" class="close-btn"><i class="fa-solid fa-times"></i></button>\n        </div>\n        <div class="route-info-body">\n            <div id="route-loading">\n                <div class="loading-spinner"></div>\n                <p>正在計算路線...</p>\n            </div>\n            <div id="route-details" style="display:none;">\n                <div class="route-summary">\n                    <div class="route-stats">\n                        <div class="stat-item">\n                            <i class="fa-solid fa-road"></i>\n                            <span id="route-distance">-- 公里</span>\n                        </div>\n                        <div class="stat-item">\n                            <i class="fa-solid fa-clock"></i>\n                            <span id="route-duration">-- 分鐘</span>\n                        </div>\n                    </div>\n                </div>\n                <div id="estimated-arrival-time" class="estimated-time">\n                    <i class="fa-solid fa-hourglass-half"></i>\n                    <span>估計到達時間: <b id="arrival-time">--:--</b></span>\n                </div>\n                <div class="route-actions">\n                </div>\n            </div>\n        </div>\n    '),
        document.body.appendChild(t));
    const e = document.getElementById('close-route-info');
    const o = document.getElementById('clear-route-btn');
    const map = window.mapboxMap || window.map;
    
    // close-route-info 和 clear-route-btn 执行相同的功能
    const handleClearRoute = () => {
        if (map) clearRouteNavigation(map);
        else {
            ((navigationActive = !1), (combinedRouteActive = !1));
            const panel = document.getElementById('route-info-panel');
            panel && (panel.style.display = 'none');
        }
    };
    
    e && e.addEventListener('click', handleClearRoute);
    o && o.addEventListener('click', handleClearRoute);
    ['route-distance', 'route-duration', 'arrival-time'].forEach((n) => {
        document.getElementById(n);
    });
}
async function calculateAndDisplayRoute(n, t, e, o) {
    (combinedRouteActive && ((combinedRouteActive = !1), clearRouteNavigation(n)), (navigationActive = !0));
    const i = document.getElementById('route-navigation-button');
    (i && i.classList.add('active'), showRouteNavigationUI());
    const a = document.getElementById('route-loading'),
        s = document.getElementById('route-details');
    (a && (a.style.display = 'block'), s && (s.style.display = 'none'));
    try {
        const i = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/walking/${t[0]},${t[1]};${e[0]},${e[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`,
        ).then((n) => n.json());
        if (!i.routes || 0 === i.routes.length) throw new Error('無法找到從您的位置到目的地的路線。');
        const r = i.routes[0];
        ((currentRoute = r),
            calculateEstimatedArrivalTime(r.duration),
            addNavigationRouteToMap(n, r),
            addDestinationMarker(n, e, o));
        const d = new mapboxgl.LngLatBounds();
        (r.geometry.coordinates.forEach((n) => d.extend(n)),
            n.fitBounds(d, { padding: 100 }),
            updateRouteInfo(r),
            a && (a.style.display = 'none'),
            s && (s.style.display = 'block'));
    } catch (t) {
        const e = document.getElementById('route-details');
        if (e) {
            e.innerHTML = `\n                <div class="route-error">\n                    <i class="fa-solid fa-exclamation-triangle"></i>\n                    <p>${t.message || '計算路線時發生錯誤。'}</p>\n                </div>\n                <div class="route-actions">\n                    <button id="clear-route-btn">返回</button>\n                </div>\n            `;
            const o = document.getElementById('clear-route-btn');
            o &&
                o.addEventListener('click', () => {
                    clearRouteNavigation(n);
                });
        } else alert('計算路線時發生錯誤: ' + (t.message || '未知錯誤'));
        (a && (a.style.display = 'none'), s && (s.style.display = 'block'));
    }
}
function addNavigationRouteToMap(n, t) {
    (n.getSource(routeSourceId)
        ? n.getSource(routeSourceId).setData({ type: 'Feature', properties: {}, geometry: t.geometry })
        : (n.addSource(routeSourceId, {
              type: 'geojson',
              data: { type: 'Feature', properties: {}, geometry: t.geometry },
          }),
          n.addLayer({
              id: 'navigation-route-outline',
              type: 'line',
              source: routeSourceId,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#ffffff', 'line-width': 8 },
          }),
          n.addLayer({
              id: 'navigation-route-inner',
              type: 'line',
              source: routeSourceId,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#3498db', 'line-width': 5, 'line-dasharray': [0, 2] },
          })),
        (navigationLayer = { ids: ['navigation-route-outline', 'navigation-route-inner'], sources: [routeSourceId] }));
}
function addDestinationMarker(n, t, e) {
    destinationMarker && destinationMarker.remove();
    let o =
        '\n        <div class="destination-popup">\n            <h3>目的地</h3>\n            <div class="navigation-options">\n                <button id="walk-navigation" class="nav-option-btn">步行前往</button>\n                <button id="combined-navigation" class="nav-option-btn">行人+巴士聯合路線</button>\n            </div>\n        </div>\n    ';
    if (e) {
        const n = window.station_data.find((n) => n.stationCode === e);
        if (n) {
            const t = e.split('/'),
                i = t[0],
                a = t[1] || '1';
            o = `\n                <div class="destination-popup">\n                    <h3>${n.description}</h3>\n                    <div class="station-image">\n                        <img src="https://www.dsat.gov.mo/bres/BUS_STOP_IMG/${i}_${a}.JPG" \n                             alt="巴士站圖片" style="width:100%;">\n                    </div>\n                    <div class="bus-routes">\n                        <h4>經過路線:</h4>\n                        <p>${n.bus_lists.join(', ')}</p>\n                    </div>\n                    <div class="navigation-options">\n                        <button id="walk-navigation" class="nav-option-btn">步行前往</button>\n                        <button id="combined-navigation" class="nav-option-btn">行人+巴士聯合路線</button>\n                    </div>\n                </div>\n            `;
        }
    }
    const i = new mapboxgl.Popup({ closeButton: !0, closeOnClick: !0, maxWidth: '300px' }).setHTML(o);
    ((destinationMarker = new mapboxgl.Marker({ color: '#e74c3c' }).setLngLat(t).setPopup(i).addTo(n)),
        i.on('open', () => {
            const o = document.getElementById('walk-navigation');
            o &&
                o.addEventListener('click', () => {
                    (i.remove(), navigationActive && clearRouteNavigation(n));
                    const o = window.userPosition || n.getCenter().toArray(),
                        a = t;
                    window.startRouteNavigation(o, a, e);
                });
            const a = document.getElementById('combined-navigation');
            a &&
                a.addEventListener('click', () => {
                    (i.remove(), navigationActive && clearRouteNavigation(n));
                    const o = window.userPosition || n.getCenter().toArray(),
                        a = t;
                    window.startCombinedRouteNavigation(o, a, e);
                });
        }));
}
function updateRouteInfo(n) {
    const t = (n.distance / 1e3).toFixed(2),
        e = document.getElementById('route-distance');
    e && (e.textContent = `${t} 公里`);
    const o = Math.round(n.duration / 60),
        i = document.getElementById('route-duration');
    i && (i.textContent = `${o} 分鐘`);
}
function calculateEstimatedArrivalTime(n) {
    const t = new Date();
    let e = 1;
    const o = t.getHours();
    ((o >= 7 && o <= 9) || (o >= 17 && o <= 19)) && (e = 1.3);
    const i = n * e,
        a = new Date(t.getTime() + 1e3 * i),
        s = a.getHours().toString().padStart(2, '0'),
        r = a.getMinutes().toString().padStart(2, '0'),
        d = document.getElementById('arrival-time');
    (d && (d.textContent = `${s}:${r}`),
        (navigationUtils.estimatedTimeInfo = { startTime: t, duration: i, arrivalTime: a }),
        startArrivalTimeUpdates());
}
function startArrivalTimeUpdates() {
    const n = setInterval(() => {
        if (!navigationActive || !navigationUtils.estimatedTimeInfo) return void clearInterval(n);
        const t = new Date(),
            e = (t - navigationUtils.estimatedTimeInfo.startTime) / 1e3,
            o = Math.max(0, navigationUtils.estimatedTimeInfo.duration - e);
        if (o < 10) {
            const t = document.getElementById('arrival-time');
            return (t && (t.textContent = '已到達'), void clearInterval(n));
        }
        const i = new Date(t.getTime() + 1e3 * o),
            a = i.getHours().toString().padStart(2, '0'),
            s = i.getMinutes().toString().padStart(2, '0'),
            r = document.getElementById('arrival-time');
        r && (r.textContent = `${a}:${s}`);
    }, 6e4);
}
function showCombinedRouteNavigationUI() {
    const n = window.mapboxMap || window.map,
        t = document.getElementById('route-info-panel');
    if (t) {
        if (t.classList.contains('combined-route-panel')) {
            t.style.display = 'block';
            let n = !0;
            if (
                ([
                    'walk-distance',
                    'walk-duration',
                    'transfer-station-name',
                    'bus-route-number',
                    'bus-route-direction',
                    'bus-stops-count',
                    'bus-duration',
                    'arrival-time',
                ].forEach((t) => {
                    document.getElementById(t) || (n = !1);
                }),
                n)
            )
                return;
            t.remove();
        } else t.remove();
    }
    const e = document.createElement('div');
    ((e.id = 'route-info-panel'),
        (e.className = 'route-info-panel combined-route-panel'),
        (e.innerHTML =
            '\n        <div class="route-info-header">\n            <h3>行人+巴士聯合路線</h3>\n            <button id="close-route-info" class="close-btn"><i class="fa-solid fa-times"></i></button>\n        </div>\n        <div class="route-info-body">\n            <div id="route-loading">\n                <div class="loading-spinner"></div>\n                <p>正在計算聯合路線...</p>\n            </div>\n            <div id="route-details" style="display:none;">\n                <div class="route-segments">\n                    <div class="route-segment walk-segment">\n                        <div class="segment-icon"><i class="fa-solid fa-walking"></i></div>\n                        <div class="segment-info">\n                            <h4>步行到巴士站</h4>\n                            <div class="segment-stats">\n                                <div class="stat-item">\n                                    <i class="fa-solid fa-road"></i>\n                                    <span id="walk-distance">-- 公里</span>\n                                </div>\n                                <div class="stat-item">\n                                    <i class="fa-solid fa-clock"></i>\n                                    <span id="walk-duration">-- 分鐘</span>\n                                </div>\n                            </div>\n                            <div class="transfer-station">\n                                <i class="fa-solid fa-bus"></i>\n                                <span id="transfer-station-name">-- 巴士站</span>\n                            </div>\n                        </div>\n                    </div>\n                    <div class="route-segment bus-segment">\n                        <div class="segment-icon"><i class="fa-solid fa-bus"></i></div>\n                        <div class="segment-info">\n                            <h4>乘坐巴士</h4>\n                            <div class="bus-route-info">\n                                <div class="bus-number" id="bus-route-number">--</div>\n                                <div class="bus-direction" id="bus-route-direction">--</div>\n                            </div>\n                            <div class="bus-stations">\n                                <div class="bus-stops">約 <span id="bus-stops-count">--</span> 站</div>\n                                <div class="bus-duration">\n                                    <i class="fa-solid fa-clock"></i>\n                                    <span id="bus-duration">-- 分鐘</span>\n                                </div>\n                            </div>\n                        </div>\n                    </div>\n                </div>\n                <div id="estimated-arrival-time" class="estimated-time">\n                    <i class="fa-solid fa-hourglass-half"></i>\n                    <span>估計到達時間: <b id="arrival-time">--:--</b></span>\n                </div>\n                <div class="route-actions">\n                </div>\n            </div>\n        </div>\n    '),
        document.body.appendChild(e));
    const closeBtn = document.getElementById('close-route-info');
    const clearBtn = document.getElementById('clear-route-btn');
    
    // close-route-info 和 clear-route-btn 执行相同的功能
    const handleClearRoute = () => {
        if (n) clearRouteNavigation(n);
        else {
            ((navigationActive = !1), (combinedRouteActive = !1));
            const panel = document.getElementById('route-info-panel');
            panel && (panel.style.display = 'none');
        }
    };
    
    closeBtn && closeBtn.addEventListener('click', handleClearRoute);
    clearBtn && clearBtn.addEventListener('click', handleClearRoute);
    [
        'walk-distance',
        'walk-duration',
        'transfer-station-name',
        'bus-route-number',
        'bus-route-direction',
        'bus-stops-count',
        'bus-duration',
        'arrival-time',
    ].forEach((n) => {
        document.getElementById(n);
    });
}
async function findNearestBusStation(n) {
    if (!window.station_data || 0 === window.station_data.length) throw new Error('沒有可用的巴士站數據。');
    const t = window.station_data.map((t) => {
        const e = t.coordinate[0] - n[0],
            o = t.coordinate[1] - n[1],
            i = Math.sqrt(e * e + o * o);
        return { ...t, distance: i };
    });
    return (t.sort((n, t) => n.distance - t.distance), t[0]);
}
function findCommonBusRoutes(n, t) {
    const e = n.bus_lists,
        o = t.bus_lists,
        i = e.filter((n) => o.includes(n));
    return i.length > 0 ? i : [];
}
async function generateBusRoute(n, t) {
    try {
        const e = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${n[0]},${n[1]};${t[0]},${t[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`,
        ).then((n) => n.json());
        if (!e.routes || 0 === e.routes.length) throw new Error('無法生成巴士路線。');
        return e.routes[0].geometry.coordinates;
    } catch (n) {
        throw new Error('無法生成巴士路線，請稍後再試。');
    }
}
function addBusRouteToMap(n, t) {
    const e = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: t } };
    n.getSource(busRouteSourceId)
        ? n.getSource(busRouteSourceId).setData(e)
        : (n.addSource(busRouteSourceId, { type: 'geojson', data: e }),
          n.addLayer({
              id: 'bus-route-outline',
              type: 'line',
              source: busRouteSourceId,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#ffffff', 'line-width': 8 },
          }),
          n.addLayer({
              id: 'bus-route-inner',
              type: 'line',
              source: busRouteSourceId,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#e67e22', 'line-width': 5, 'line-dasharray': [1, 1] },
          }),
          navigationLayer
              ? (navigationLayer.ids.push('bus-route-outline', 'bus-route-inner'),
                navigationLayer.sources.push(busRouteSourceId))
              : (navigationLayer = { ids: ['bus-route-outline', 'bus-route-inner'], sources: [busRouteSourceId] }));
}
function addTransferStationMarker(n, t, e = !1) {
    transferStationMarker && !e && transferStationMarker.remove();
    const o = `\n        <div class="transfer-popup">\n            <h3>${e ? '目的地巴士站' : '轉乘站'}</h3>\n            <p>${t.description}</p>\n            <div class="bus-routes">\n                <h4>經過路線:</h4>\n                <p>${t.bus_lists.join(', ')}</p>\n            </div>\n        </div>\n    `,
        i = new mapboxgl.Popup({ closeButton: !0, closeOnClick: !0 }).setHTML(o),
        a = new mapboxgl.Marker({ color: e ? '#e74c3c' : '#3498db' }).setLngLat(t.coordinate).setPopup(i).addTo(n);
    e
        ? (window.tempMarkers || (window.tempMarkers = {}), (window.tempMarkers.destinationStation = a))
        : (transferStationMarker = a);
}
function updateCombinedRouteInfo(n, t, e, o, i) {
    const a = (n.distance / 1e3).toFixed(2),
        s = document.getElementById('walk-distance');
    s && (s.textContent = `${a} 公里`);
    const r = Math.round(n.duration / 60),
        d = document.getElementById('walk-duration');
    d && (d.textContent = `${r} 分鐘`);
    const c = document.getElementById('transfer-station-name');
    c && (c.textContent = e.description);
    const l = document.getElementById('bus-route-number');
    l && (l.textContent = t);
    const u = document.getElementById('bus-route-direction');
    u && (u.textContent = o.description);
    const m = Math.ceil(5 * Math.random()) + 2,
        p = document.getElementById('bus-stops-count');
    p && (p.textContent = m);
    const g = 2 * m + 5,
        v = document.getElementById('bus-duration');
    v && (v.textContent = `${g} 分鐘`);
    let f = 0;
    if (i) {
        let n = document.querySelector('.route-segment.walk-from-station-segment');
        if (!n) {
            ((n = document.createElement('div')),
                (n.className = 'route-segment walk-from-station-segment'),
                (n.innerHTML =
                    '\n                <div class="segment-icon"><i class="fa-solid fa-walking"></i></div>\n                <div class="segment-info">\n                    <h4>從巴士站步行到目的地</h4>\n                    <div class="segment-stats">\n                        <div class="stat-item">\n                            <i class="fa-solid fa-road"></i>\n                            <span id="walk-from-station-distance">-- 公里</span>\n                        </div>\n                        <div class="stat-item">\n                            <i class="fa-solid fa-clock"></i>\n                            <span id="walk-from-station-duration">-- 分鐘</span>\n                        </div>\n                    </div>\n                </div>\n            '));
            const t = document.querySelector('.route-segments');
            t && t.appendChild(n);
        }
        const t = (i.distance / 1e3).toFixed(2),
            e = document.getElementById('walk-from-station-distance');
        (e && (e.textContent = `${t} 公里`), (f = Math.round(i.duration / 60)));
        const o = document.getElementById('walk-from-station-duration');
        o && (o.textContent = `${f} 分鐘`);
    } else {
        const n = document.querySelector('.route-segment.walk-from-station-segment');
        n && n.remove();
    }
    calculateEstimatedArrivalTime(n.duration + 60 * g + (i ? i.duration : 0));
}
function addWalkFromStationRouteToMap(n, t) {
    const e = { type: 'Feature', properties: {}, geometry: t.geometry },
        o = 'walk-from-station-route';
    n.getSource(o)
        ? n.getSource(o).setData(e)
        : (n.addSource(o, { type: 'geojson', data: e }),
          n.addLayer({
              id: 'walk-from-station-route-outline',
              type: 'line',
              source: o,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#ffffff', 'line-width': 8 },
          }),
          n.addLayer({
              id: 'walk-from-station-route-inner',
              type: 'line',
              source: o,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#2ecc71', 'line-width': 5, 'line-dasharray': [0, 2] },
          }),
          navigationLayer
              ? (navigationLayer.ids.push('walk-from-station-route-outline', 'walk-from-station-route-inner'),
                navigationLayer.sources.push(o))
              : (navigationLayer = {
                    ids: ['walk-from-station-route-outline', 'walk-from-station-route-inner'],
                    sources: [o],
                }));
}
async function processCombinedRoute(n, t, e, o, i, a) {
    try {
        const s = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/walking/${t[0]},${t[1]};${i.coordinate[0]},${i.coordinate[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`,
        ).then((n) => n.json());
        if (!s.routes || 0 === s.routes.length) throw new Error('無法找到從您的位置到最近巴士站的路線。');
        const r = s.routes[0],
            d = findCommonBusRoutes(i, a);
        if (0 === d.length) throw new Error('找不到從最近巴士站到目的地的直達巴士路線。');
        const c = d[0],
            l = await generateBusRoute(i.coordinate, a.coordinate);
        (addNavigationRouteToMap(n, r), addBusRouteToMap(n, l), addTransferStationMarker(n, i));
        let u = null;
        if (!o)
            try {
                const t = await fetch(
                    `https://api.mapbox.com/directions/v5/mapbox/walking/${a.coordinate[0]},${a.coordinate[1]};${e[0]},${e[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`,
                ).then((n) => n.json());
                t.routes &&
                    t.routes.length > 0 &&
                    ((u = t.routes[0]), addWalkFromStationRouteToMap(n, u), addTransferStationMarker(n, a, !0));
            } catch (n) {}
        addDestinationMarker(n, e, o);
        const m = new mapboxgl.LngLatBounds();
        (r.geometry.coordinates.forEach((n) => m.extend(n)),
            l.forEach((n) => m.extend(n)),
            u && u.geometry.coordinates.forEach((n) => m.extend(n)),
            m.extend(e),
            n.fitBounds(m, { padding: 100 }));
        let p = !0;
        if (
            ([
                'walk-distance',
                'walk-duration',
                'transfer-station-name',
                'bus-route-number',
                'bus-route-direction',
                'bus-stops-count',
                'bus-duration',
                'arrival-time',
            ].forEach((n) => {
                document.getElementById(n) || (p = !1);
            }),
            !p)
        ) {
            const n = document.getElementById('route-info-panel');
            (n && n.remove(), showCombinedRouteNavigationUI());
        }
        updateCombinedRouteInfo(r, c, i, a, u);
        const g = document.getElementById('route-loading'),
            v = document.getElementById('route-details');
        (g && (g.style.display = 'none'), v && (v.style.display = 'block'));
    } catch (n) {
        handleRouteError(n);
    }
}
function handleRouteError(n) {
    const t = window.mapboxMap || window.map,
        e = document.getElementById('route-details');
    if (e) {
        e.innerHTML = `\n            <div class="route-error">\n                <i class="fa-solid fa-exclamation-triangle"></i>\n                <p>${n.message || '計算聯合路線時發生錯誤。'}</p>\n                ${'找不到從最近巴士站到目的地的直達巴士路線。' === n.message ? '<p style="font-size:12px;margin-top:5px;">提示: 您選擇的起點和終點之間可能沒有直達巴士路線，請嘗試選擇其他位置或使用步行導航。</p>' : ''}\n            </div>\n            <div class="route-actions">\n                <button id="clear-route-btn">返回</button>\n            </div>\n        `;
        const o = document.getElementById('clear-route-btn');
        o &&
            o.addEventListener('click', () => {
                if (t) clearRouteNavigation(t);
                else {
                    ((navigationActive = !1), (combinedRouteActive = !1));
                    const n = document.getElementById('route-info-panel');
                    n && (n.style.display = 'none');
                }
            });
    } else alert('計算路線時發生錯誤: ' + (n.message || '未知錯誤'));
    const o = document.getElementById('route-loading'),
        i = document.getElementById('route-details');
    (o && (o.style.display = 'none'), i && (i.style.display = 'block'));
}
function addNavigationStyles() {
    if (document.getElementById('navigation-styles')) return;
    const n = document.createElement('style');
    ((n.id = 'navigation-styles'),
        (n.textContent =
            '\n        .navigation-options {\n            margin-top: 10px;\n            display: flex;\n            flex-direction: column;\n            gap: 8px;\n        }\n        \n        .nav-option-btn {\n            padding: 8px 12px;\n            background-color: #3498db;\n            color: white;\n            border: none;\n            border-radius: 4px;\n            cursor: pointer;\n            font-weight: bold;\n            transition: background-color 0.3s;\n        }\n        \n        .nav-option-btn:hover {\n            background-color: #2980b9;\n        }\n        \n        #combined-navigation {\n            background-color: #e67e22;\n        }\n        \n        #combined-navigation:hover {\n            background-color: #d35400;\n        }\n        \n        .bus-route-warning {\n            margin-top: 8px;\n            padding: 5px 8px;\n            background-color: #fff3cd;\n            border: 1px solid #ffeeba;\n            border-radius: 4px;\n            color: #856404;\n            font-size: 12px;\n            display: flex;\n            align-items: center;\n            gap: 5px;\n        }\n        \n        .bus-route-warning i {\n            color: #e67e22;\n        }\n        \n        .bus-route-warning span {\n            color: black !important;\n        }\n        \n        /* 路線信息面板樣式 */\n        .route-info-panel {\n            position: absolute;\n            top: 20px;\n            left: 20px;\n            width: 280px;\n            background: rgba(30, 30, 30, 0.95);\n            border-radius: 12px;\n            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);backdrop-filter: blur(10px);\n            z-index: 1000;\n            color: rgb(255, 255, 255);\n            overflow: hidden;\n        }\n        \n        /* 聯合路線面板特定樣式 */\n        .combined-route-panel {\n            color: rgb(255, 255, 255);\n            animation: fadeInRight 0.3s ease-out;\n        }\n        \n        @keyframes fadeInRight {\n            from {\n                opacity: 0;\n                transform: translateX(20px);\n            }\n            to {\n                opacity: 1;\n                transform: translateX(0);\n            }\n        }\n        \n        .combined-route-panel h4,\n        .combined-route-panel span,\n        .combined-route-panel p {\n            color: rgb(255, 255, 255);\n        }\n        \n        .combined-route-panel .segment-info h4 {\n            color: #ffffff;\n            font-weight: 700;\n            font-size: 15px;\n            text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);\n        }\n        \n        .combined-route-panel .route-segment {\n            border-bottom-color: rgba(236, 240, 241, 0.2);\n            padding: 10px 5px;\n            border-radius: 6px;\n            transition: background-color 0.2s;\n        }\n        \n        .combined-route-panel .route-segment:hover {\n            background-color: rgba(255, 255, 255, 0.05);\n        }\n        \n        .combined-route-panel .route-info-header {\n            background-color: #2c3e50;\n            border-bottom: 2px solid #3498db;\n        }\n        \n        .combined-route-panel .bus-route-info {\n            margin-bottom: 12px;\n        }\n        \n        .route-info-header {\n            padding: 12px 15px;\n            background-color: #34495e;\n            display: flex;\n            justify-content: space-between;\n            align-items: center;\n            border-bottom: 1px solid #3d566e;\n        }\n        \n        .route-info-header h3 {\n            margin: 0;\n            color: white;\n            font-size: 16px;\n            font-weight: 600;\n        }\n        \n        .close-btn {\n            background: none;\n            border: none;\n            color: rgb(255, 255, 255);\n            cursor: pointer;\n            font-size: 16px;\n            padding: 0;\n        }\n        \n        .route-info-body {\n            padding: 15px;\n        }\n        \n        /* 載入中動畫 */\n        .loading-spinner {\n            width: 30px;\n            height: 30px;\n            border: 3px solid rgba(236, 240, 241, 0.3);\n            border-radius: 50%;\n            border-top-color: #3498db;\n            animation: spin 1s linear infinite;\n            margin: 0 auto 15px;\n        }\n        \n        @keyframes spin {\n            0% { transform: rotate(0deg); }\n            100% { transform: rotate(360deg); }\n        }\n        \n        #route-loading {\n            text-align: center;\n            color: rgb(255, 255, 255);\n        }\n        \n        /* 路線段樣式 */\n        .route-segments {\n            display: flex;\n            flex-direction: column;\n            gap: 15px;\n        }\n        \n        .route-segment {\n            display: flex;\n            gap: 10px;\n            padding-bottom: 15px;\n            border-bottom: 1px solid #3d566e;\n        }\n        \n        .route-segment:last-child {\n            border-bottom: none;\n        }\n        \n        .segment-icon {\n            width: 35px;\n            height: 35px;\n            background-color: #3498db;\n            border-radius: 50%;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            color: white;\n            flex-shrink: 0;\n        }\n        \n        .route-segment.walk-segment .segment-icon {\n            background-color: #2ecc71;\n        }\n        \n        .route-segment.bus-segment .segment-icon {\n            background-color: #e67e22;\n        }\n        \n        .route-segment.walk-from-station-segment .segment-icon {\n            background-color: #9b59b6;\n        }\n        \n        .segment-info {\n            flex-grow: 1;\n        }\n        \n        .segment-info h4 {\n            margin: 0 0 8px;\n            font-size: 14px;\n            font-weight: 600;\n            color: #ffffff;\n        }\n        \n        .segment-stats {\n            display: flex;\n            gap: 15px;\n            margin-bottom: 8px;\n        }\n        \n        .stat-item {\n            display: flex;\n            align-items: center;\n            gap: 5px;\n            color: #bdc3c7;\n            font-size: 13px;\n        }\n        \n        .transfer-station {\n            display: flex;\n            align-items: center;\n            gap: 5px;\n            color: #bdc3c7;\n            font-size: 13px;\n        }\n        \n        /* 巴士路線信息 */\n        .bus-route-info {\n            display: flex;\n            align-items: center;\n            gap: 10px;\n            margin-bottom: 8px;\n        }\n        \n        .bus-number {\n            background-color: #e67e22;\n            color: white;\n            padding: 3px 8px;\n            border-radius: 3px;\n            font-weight: 600;\n        }\n        \n        .bus-direction {\n            color: #bdc3c7;\n            font-size: 13px;\n        }\n        \n        .bus-stations {\n            display: flex;\n            justify-content: space-between;\n            color: #bdc3c7;\n            font-size: 13px;\n        }\n        \n        .bus-duration {\n            display: flex;\n            align-items: center;\n            gap: 5px;\n        }\n        \n        /* 估計到達時間 */\n        .estimated-time {\n            margin: 15px 0;\n            padding: 10px;\n            background-color: rgba(44, 62, 80, 0.5);\n            border-radius: 5px;\n            display: flex;\n            align-items: center;\n            gap: 8px;\n            color: rgb(255, 255, 255);\n            font-size: 14px;\n        }\n        \n        .estimated-time i {\n            color: #f1c40f;\n        }\n        \n        .estimated-time b {\n            font-weight: 600;\n            color: #ffffff;\n        }\n        \n        /* 行動按鈕 */\n        .route-actions {\n            display: flex;\n            justify-content: flex-end;\n            margin-top: 15px;\n        }\n        \n        .route-actions button {\n            padding: 8px 12px;\n            background-color: #e74c3c;\n            color: white;\n            border: none;\n            border-radius: 4px;\n            cursor: pointer;\n            font-size: 13px;\n            transition: background-color 0.3s;\n        }\n        \n        .route-actions button:hover {\n            background-color: #c0392b;\n        }\n        \n        /* 錯誤信息 */\n        .route-error {\n            padding: 15px;\n            background-color: rgba(231, 76, 60, 0.1);\n            border-radius: 5px;\n            border-left: 3px solid #e74c3c;\n            color: rgb(255, 255, 255);\n            margin-bottom: 15px;\n        }\n        \n        .route-error i {\n            color: #e74c3c;\n            margin-right: 8px;\n        }\n    '),
        document.head.appendChild(n));
}
function clearRouteNavigation(n) {
    ((navigationActive = !1), (combinedRouteActive = !1));
    const t = document.getElementById('route-navigation-button');
    t && t.classList.remove('active');
    const e = document.getElementById('route-info-panel');
    e && e.remove();
    const o = document.getElementById('navigation-selection');
    if (
        (o && (o.style.display = 'none'),
        destinationMarker && (destinationMarker.remove(), (destinationMarker = null)),
        transferStationMarker && (transferStationMarker.remove(), (transferStationMarker = null)),
        window.tempMarkers && (Object.values(window.tempMarkers).forEach((n) => n.remove()), (window.tempMarkers = {})),
        window.customMarkers &&
            (Object.values(window.customMarkers).forEach((n) => n.remove()), (window.customMarkers = {})),
        !navigationLayer)
    )
        return;
    (navigationLayer.ids.forEach((t) => {
        'bus_station' !== t && n.getLayer(t) && n.removeLayer(t);
    }),
        navigationLayer.sources.forEach((t) => {
            'bus_station' !== t && n.getSource(t) && n.removeSource(t);
        }));
    const i = 'walk-from-station-route';
    (n.getLayer('walk-from-station-route-outline') && n.removeLayer('walk-from-station-route-outline'),
        n.getLayer('walk-from-station-route-inner') && n.removeLayer('walk-from-station-route-inner'),
        n.getSource(i) && n.removeSource(i),
        (navigationLayer = null),
        (currentRoute = null),
        (busRoute = null),
        (navigationUtils.estimatedTimeInfo = null),
        (window.startRouteNavigation = (t, e, o) => {
            (navigationActive && clearRouteNavigation(n),
                showRouteNavigationUI(),
                calculateAndDisplayRoute(n, t, e, o));
        }),
        (window.startCombinedRouteNavigation = function (t, e, o) {
            !(function (n, t, e, o) {
                try {
                    if (!window.station_data || 0 === window.station_data.length)
                        return void alert('巴士站數據尚未加載完成，請稍後再試。');
                    (navigationActive && clearRouteNavigation(n), (navigationActive = !0), (combinedRouteActive = !0));
                    const i = document.getElementById('route-navigation-button');
                    (i && i.classList.add('active'),
                        showCombinedRouteNavigationUI(),
                        (async () => {
                            try {
                                const i = document.getElementById('route-loading'),
                                    a = document.getElementById('route-details');
                                (i && (i.style.display = 'block'), a && (a.style.display = 'none'));
                                const s = await findNearestBusStation(t),
                                    r = o
                                        ? window.station_data.find((n) => n.stationCode === o)
                                        : await findNearestBusStation(e);
                                await processCombinedRoute(n, t, e, o, s, r);
                            } catch (n) {
                                handleRouteError(n);
                            }
                        })());
                } catch (n) {
                    alert('無法啟動聯合路線規劃: ' + n.message);
                }
            })(n, t, e, o);
        }));
}
window.initRouteNavigation = initRouteNavigation;
