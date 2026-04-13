let popup = null,
    selectedRouteId = null;
function addRouteToMap(e, t, o = []) {
    (window.showMapButton('toggle-route-button'),
        popup || (popup = new mapboxgl.Popup({ closeButton: !1, closeOnClick: !1 })),
        0 != o.length ? (filteredTrafficData = t.filter((e) => o.includes(e.routeCode))) : (filteredTrafficData = t));
    var n = [];
    for (let t = 0; t < filteredTrafficData.length; t++) {
        const o = filteredTrafficData[t];
        let r = o.routeCode + o.direction;
        (n.push(r),
            e.addSource(r, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: { routeCode: o.routeCode, direction: o.direction },
                    geometry: { type: 'LineString', coordinates: o.coordinate },
                },
            }),
            e.addLayer({
                id: r,
                type: 'line',
                source: r,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': o.line_color, 'line-width': 8, 'line-opacity': 0.3 },
            }),
            e.on('click', r, (t) => {
                (t.preventDefault(),
                    selectedRouteId === r
                        ? (n.forEach((t) => {
                              e.setPaintProperty(t, 'line-opacity', 0.4);
                          }),
                          (selectedRouteId = null))
                        : (n.forEach((t) => {
                              e.setPaintProperty(t, 'line-opacity', 0);
                          }),
                          e.setPaintProperty(r, 'line-opacity', 1),
                          (selectedRouteId = r)),
                    e.on('click', (t) => {
                        e.queryRenderedFeatures(t.point).some((e) => n.includes(e.layer.id)) ||
                            (n.forEach((t) => {
                                e.setPaintProperty(t, 'line-opacity', 0.4);
                            }),
                            (selectedRouteId = null));
                    }));
            }),
            e.on('mouseenter', r, (t) => {
                e.getCanvas().style.cursor = 'pointer';
                const n = t.lngLat,
                    r = o.routeCode,
                    i = 0 == o.direction ? '去程' : '回程';
                popup
                    .setLngLat(n)
                    .setHTML(`<h3>巴士號: ${r.replace(/^0+/, '')}</h3><p>方向: ${i}</p>`)
                    .addTo(e);
            }),
            e.on('mouseleave', r, () => {
                ((e.getCanvas().style.cursor = ''), popup.remove());
            }));
    }
    return n;
}
window.showMapButton = function (e) {
    // 已隱藏巴士站點按鈕
    if ('toggle-station-button' === e) return;
    const t = document.getElementById(e);
    t && (t.style.display = 'flex');
};
