let mapPointSelectedRouteId = null,
    mapPointSelectedRoute = null,
    mapPointMarkersArray = [],
    mapPointPopup = null,
    mapPointRouteSource = null,
    mapPointInitialized = !1,
    mapPointFunctionEnabled = !0,
    mapPointRouteLayer = null;
function autoInitMapPointFeature() {
    const e = document.getElementById('map-percentage'),
        t = document.getElementById('percentage-value');
    e && t && (t.textContent = e.value + '%');
    const o = () => {
        if (mapPointFunctionEnabled)
            if (window.trafficIds && Array.isArray(window.trafficIds) && 0 !== window.trafficIds.length)
                if (window.map && window.traffic_data)
                    try {
                        (window.initMapPointFeature(window.map, window.traffic_data),
                            window.showMapPointButton('add-map-point-button'));
                    } catch (e) {
                        // 已隱藏地圖標點按鈕
                        // setTimeout(() => {
                        //     const e = document.getElementById('add-map-point-button');
                        //     e && 'flex' !== e.style.display && (e.style.display = 'flex');
                        // }, 500);
                    }
                else setTimeout(o, 500);
            else setTimeout(o, 500);
    };
    setTimeout(o, 1500);
}
function initMapPointFeature(e, t) {
    if (!mapPointFunctionEnabled) return;
    if (mapPointInitialized) return;
    if (!e) return;
    if (!t || !Array.isArray(t)) return;
    const o = t.filter(
        (e) =>
            e &&
            e.routeCode &&
            void 0 !== e.direction &&
            e.coordinate &&
            Array.isArray(e.coordinate) &&
            e.coordinate.length > 1,
    );
    if (0 === o.length) return;
    (!window.trafficIds || !Array.isArray(window.trafficIds) || window.trafficIds.length,
        (mapPointPopup = new mapboxgl.Popup({ closeButton: !1, closeOnClick: !1 })));
    const n = document.getElementById('add-map-point-button'),
        r = document.getElementById('map-point-modal'),
        a = document.getElementById('map-point-close');
    if (!n || !r) return;
    (n.addEventListener('click', function () {
        if (((r.style.display = 'block'), loadRouteSelector(e, o), mapPointSelectedRouteId)) {
            const e = document.querySelector(`.route-card[data-id="${mapPointSelectedRouteId}"]`);
            e && e.classList.add('selected');
        }
    }),
        a &&
            a.addEventListener('click', function () {
                r.style.display = 'none';
            }),
        window.addEventListener('click', function (e) {
            e.target === r && (r.style.display = 'none');
        }));
    const i = document.getElementById('map-percentage'),
        c = document.getElementById('percentage-value');
    i &&
        c &&
        ((c.textContent = i.value + '%'),
        i.addEventListener('input', function () {
            c.textContent = this.value + '%';
        }));
    const d = document.getElementById('add-marker-btn');
    d &&
        d.addEventListener('click', function () {
            if (!mapPointSelectedRoute) return void alert('请先选择一条路线');
            const t = parseInt(i.value);
            addPercentageMarker(e, t);
        });
    const s = document.getElementById('clear-markers-btn');
    s &&
        s.addEventListener('click', function () {
            clearAllMarkers(e);
        });
    const l = document.getElementById('show-all-coords-btn');
    l &&
        l.addEventListener('click', function () {
            mapPointSelectedRoute ? showAllRoutePoints(e) : alert('請先選擇一條路線');
        });
    const u = document.getElementById('map-start-percentage'),
        p = document.getElementById('map-end-percentage'),
        m = document.getElementById('get-percentage-range-btn');
    u &&
        p &&
        m &&
        m.addEventListener('click', function () {
            if (!mapPointSelectedRoute) return void alert('請先選擇一條路線');
            const t = parseFloat(u.value),
                o = parseFloat(p.value);
            isNaN(t) || isNaN(o) || t < 0 || t > 100 || o < 0 || o > 100 || t >= o
                ? alert('請輸入有效的百分比範圍')
                : window.routeUtils.showPercentageRangePoints(e, t, o);
        });
    const y = document.getElementById('map-increment'),
        f = document.getElementById('get-increment-btn');
    (y &&
        f &&
        f.addEventListener('click', function () {
            if (!mapPointSelectedRoute) return void alert('請先選擇一條路線');
            const t = parseFloat(y.value);
            isNaN(t) || t <= 0 || t > 50
                ? alert('請輸入有效的百分比增量 (1-50)')
                : window.routeUtils.showIncrementPoints(e, t);
        }),
        e.loaded()
            ? initializeMapSources(e)
            : e.on('load', function () {
                  initializeMapSources(e);
              }),
        (mapPointInitialized = !0));
}
function initializeMapSources(e) {
    try {
        (e.getSource('route-points-source') ||
            e.addSource('route-points-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }),
            (mapPointRouteSource = e.getSource('route-points-source')),
            e.getSource('mappoint-route-source') ||
                e.addSource('mappoint-route-source', {
                    type: 'geojson',
                    data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
                }));
    } catch (e) {}
}
function loadRouteSelector(e, t) {
    const o = document.getElementById('route-selector');
    o &&
        ((o.innerHTML = ''),
        t && 0 !== t.length
            ? t.forEach((t) => {
                  try {
                      const n = document.createElement('div');
                      n.className = 'route-card';
                      const r = t.routeCode + t.direction;
                      ((n.dataset.id = r), mapPointSelectedRouteId === r && n.classList.add('selected'));
                      const a = t.routeCode.replace(/^0+/, ''),
                          i = 0 === t.direction ? '去程' : '回程';
                      ((n.innerHTML = `\n                <strong>${a}</strong>\n                <div>${i}</div>\n            `),
                          n.addEventListener('click', function () {
                              selectRoute(e, t, this.dataset.id);
                          }),
                          o.appendChild(n));
                  } catch (e) {}
              })
            : (o.innerHTML = '<div style="color: white; padding: 10px;">没有可用的路线数据</div>'));
}
function selectRoute(e, t, o) {
    t &&
        o &&
        (document.querySelectorAll('.route-card').forEach((e) => {
            (e.classList.remove('selected'), e.dataset.id === o && e.classList.add('selected'));
        }),
        (mapPointSelectedRouteId = o),
        (mapPointSelectedRoute = t),
        (window.mapPointSelectedRoute = t),
        clearAllMarkersIncludingEndpoints(e),
        clearRouteLayer(e),
        !t.coordinate || !Array.isArray(t.coordinate) || t.coordinate.length < 2
            ? alert('所選路線沒有有效的坐標數據，無法顯示路線。')
            : displayRouteOnMap(e));
}
function displayRouteOnMap(e) {
    if (mapPointSelectedRoute)
        try {
            const t = mapPointSelectedRoute.coordinate;
            if (!t || !t.length) return;
            clearAllMarkersIncludingEndpoints(e);
            const o = t.map((e) => window.routeUtils.parseCoordinate(e));
            if (!window.routeUtils.isValidCoordinate(o[0]) || !window.routeUtils.isValidCoordinate(o[o.length - 1]))
                return;
            addRouteLayerToMap(e, o, mapPointSelectedRoute.line_color || '#ffaa00');
            const n = o[0],
                r = o[o.length - 1],
                a = document.createElement('div');
            ((a.className = 'custom-marker start-marker'),
                (a.style.width = '15px'),
                (a.style.height = '15px'),
                (a.style.borderRadius = '50%'),
                (a.style.backgroundColor = '#00ff00'),
                (a.style.border = '2px solid white'));
            const i = new mapboxgl.Marker(a)
                    .setLngLat(n)
                    .setPopup(new mapboxgl.Popup().setHTML('<strong>起點 (0%)</strong>'))
                    .addTo(e),
                c = document.createElement('div');
            ((c.className = 'custom-marker end-marker'),
                (c.style.width = '15px'),
                (c.style.height = '15px'),
                (c.style.borderRadius = '50%'),
                (c.style.backgroundColor = '#ff0000'),
                (c.style.border = '2px solid white'));
            const d = new mapboxgl.Marker(c)
                .setLngLat(r)
                .setPopup(new mapboxgl.Popup().setHTML('<strong>終點 (100%)</strong>'))
                .addTo(e);
            (mapPointMarkersArray.push(i, d), (window.mapPointMarkersArray = mapPointMarkersArray));
            const s = new mapboxgl.LngLatBounds();
            (o.forEach((e) => {
                window.routeUtils.isValidCoordinate(e) && s.extend(e);
            }),
                e.fitBounds(s, { padding: 50 }));
            const l = document.getElementById('map-percentage');
            if (l) {
                addPercentageMarker(e, parseInt(l.value));
            }
        } catch (e) {}
}
function addRouteLayerToMap(e, t, o) {
    try {
        (mapPointRouteLayer && e.getLayer(mapPointRouteLayer) && e.removeLayer(mapPointRouteLayer),
            e.getSource('mappoint-route-source') ||
                e.addSource('mappoint-route-source', {
                    type: 'geojson',
                    data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
                }),
            e
                .getSource('mappoint-route-source')
                .setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: t } }));
        const n = 'mappoint-route-layer-' + Date.now();
        return (
            e.addLayer({
                id: n,
                type: 'line',
                source: 'mappoint-route-source',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': o, 'line-width': 8, 'line-opacity': 1 },
            }),
            (mapPointRouteLayer = n),
            n
        );
    } catch (e) {
        return null;
    }
}
function addPercentageMarker(e, t) {
    if (mapPointSelectedRoute)
        try {
            const o = mapPointSelectedRoute.coordinate;
            if (!o || !o.length) return;
            const n = window.routeUtils.getPointAtPercentage(o, t);
            if (!window.routeUtils.isValidCoordinate(n)) return;
            const r = document.createElement('div');
            ((r.className = 'custom-marker percentage-marker'),
                (r.style.width = '14px'),
                (r.style.height = '14px'),
                (r.style.borderRadius = '50%'),
                (r.style.backgroundColor = '#ff0022'),
                (r.style.border = '2px solid white'));
            const a = new mapboxgl.Marker(r)
                .setLngLat(n)
                .setPopup(
                    new mapboxgl.Popup().setHTML(
                        `\n                <strong>${t}% 位置</strong><br>\n                坐標: [${n[0].toFixed(6)}, ${n[1].toFixed(6)}]\n            `,
                    ),
                )
                .addTo(e);
            return (
                mapPointMarkersArray.push(a),
                (window.mapPointMarkersArray = mapPointMarkersArray),
                e.flyTo({ center: n, zoom: 16 }),
                setTimeout(() => {
                    a.togglePopup();
                }, 500),
                a
            );
        } catch (e) {
            return null;
        }
}
function clearAllMarkersIncludingEndpoints(e) {
    if (
        (mapPointMarkersArray.forEach((e) => {
            try {
                e.remove();
            } catch (e) {}
        }),
        (mapPointMarkersArray = []),
        (window.mapPointMarkersArray = mapPointMarkersArray),
        e && e.getLayer('route-points-layer'))
    )
        try {
            (e.off('click', 'route-points-layer'),
                e.off('mouseenter', 'route-points-layer'),
                e.off('mouseleave', 'route-points-layer'),
                e.removeLayer('route-points-layer'));
        } catch (e) {}
    if (e && mapPointRouteSource)
        try {
            mapPointRouteSource.setData({ type: 'FeatureCollection', features: [] });
        } catch (e) {}
}
function clearRouteLayer(e) {
    if (e && mapPointRouteLayer && e.getLayer(mapPointRouteLayer))
        try {
            (e.removeLayer(mapPointRouteLayer), (mapPointRouteLayer = null));
        } catch (e) {}
}
function showAllRoutePoints(e) {
    if (mapPointSelectedRoute && mapPointRouteSource)
        try {
            const t = mapPointSelectedRoute.coordinate;
            if (!t || !t.length) return;
            clearAllMarkers(e);
            const o = t.map((e) => window.routeUtils.parseCoordinate(e)),
                n = o
                    .map((e, o) =>
                        window.routeUtils.isValidCoordinate(e)
                            ? {
                                  type: 'Feature',
                                  properties: {
                                      index: o,
                                      description: `点 ${o + 1}`,
                                      position: `${((o / (t.length - 1)) * 100).toFixed(1)}%`,
                                  },
                                  geometry: { type: 'Point', coordinates: e },
                              }
                            : null,
                    )
                    .filter((e) => null !== e);
            (mapPointRouteSource.setData({ type: 'FeatureCollection', features: n }),
                e.getLayer('route-points-layer') && e.removeLayer('route-points-layer'),
                e.addLayer({
                    id: 'route-points-layer',
                    type: 'circle',
                    source: 'route-points-source',
                    paint: {
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 6],
                        'circle-color': '#ffa500',
                        'circle-stroke-width': 2,
                        'circle-stroke-color': '#ffffff',
                        'circle-opacity': 0.8,
                    },
                }),
                e.on('click', 'route-points-layer', function (t) {
                    if (t.features.length > 0) {
                        const o = t.features[0],
                            n = o.geometry.coordinates.slice(),
                            r = `\n                    <strong>坐标点 #${o.properties.index + 1}</strong><br>\n                    位置: ${o.properties.position}<br>\n                    坐标: [${n[0].toFixed(6)}, ${n[1].toFixed(6)}]\n                `;
                        new mapboxgl.Popup().setLngLat(n).setHTML(r).addTo(e);
                    }
                }),
                e.on('mouseenter', 'route-points-layer', function () {
                    e.getCanvas().style.cursor = 'pointer';
                }),
                e.on('mouseleave', 'route-points-layer', function () {
                    e.getCanvas().style.cursor = '';
                }));
            const r = new mapboxgl.LngLatBounds();
            (o.forEach((e) => {
                window.routeUtils.isValidCoordinate(e) && r.extend(e);
            }),
                e.fitBounds(r, { padding: 50 }),
                setTimeout(() => {
                    e.getLayer('route-points-layer') && e.setPaintProperty('route-points-layer', 'circle-opacity', 0.9);
                }, 300));
        } catch (e) {}
}
function clearAllMarkers(e) {
    if (
        ((mapPointMarkersArray = mapPointMarkersArray.filter((e) => {
            const t = e.getElement();
            if (!t.classList.contains('start-marker') && !t.classList.contains('end-marker'))
                try {
                    return (e.remove(), !1);
                } catch (e) {
                    return !0;
                }
            return !0;
        })),
        (window.mapPointMarkersArray = mapPointMarkersArray),
        e && e.getLayer('route-points-layer'))
    )
        try {
            (e.off('click', 'route-points-layer'),
                e.off('mouseenter', 'route-points-layer'),
                e.off('mouseleave', 'route-points-layer'),
                e.removeLayer('route-points-layer'));
        } catch (e) {}
    if (e && mapPointRouteSource)
        try {
            mapPointRouteSource.setData({ type: 'FeatureCollection', features: [] });
        } catch (e) {}
}
('undefined' != typeof window && window.routeUtils,
    'undefined' != typeof window && (window.mapPointMarkersArray = mapPointMarkersArray),
    (window.showMapPointButton = function (e) {
        // 已隱藏地圖標點按鈕
        // const t = document.getElementById(e);
        // t && (t.style.display = 'flex');
    }),
    (window.enableMapPointFeature = function (e) {
        mapPointFunctionEnabled = e;
    }),
    'undefined' != typeof window &&
        ((window.initMapPointFeature = initMapPointFeature),
        (window.showMapPointButton =
            window.showMapPointButton ||
            function (e) {
                // 已隱藏地圖標點按鈕
                // const t = document.getElementById(e);
                // t && (t.style.display = 'flex');
            }),
        (window.clearAllMarkers = clearAllMarkers),
        (window.clearAllMarkersIncludingEndpoints = clearAllMarkersIncludingEndpoints),
        'loading' === document.readyState
            ? document.addEventListener('DOMContentLoaded', function () {
                  const e = document.getElementById('map-percentage'),
                      t = document.getElementById('percentage-value');
                  (e && t && (t.textContent = e.value + '%'), autoInitMapPointFeature());
              })
            : setTimeout(function () {
                  const e = document.getElementById('map-percentage'),
                      t = document.getElementById('percentage-value');
                  (e && t && (t.textContent = e.value + '%'), autoInitMapPointFeature());
              }, 0),
        (window.checkAndEnableMapPointFeature = function () {
            const e = window.trafficIds && Array.isArray(window.trafficIds) && window.trafficIds.length > 0;
            return (window.enableMapPointFeature(e), e);
        }),
        setTimeout(() => {
            window.checkAndEnableMapPointFeature();
        }, 2e3)));
