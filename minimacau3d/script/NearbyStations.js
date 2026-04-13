let nearbyStationsVisible = !1,
    nearbyStationsLayer = null,
    userPosition = null,
    nearbyRadius = 500;
function addNearbyStationsFeature(t, e) {
    // 已隱藏附近巴士站按鈕，已禁用位置權限獲取
    // createNearbyStationsButton(t),
}
function createNearbyStationsButton(t) {
    const e = document.createElement('a');
    ((e.id = 'nearby-stations-button'),
        (e.className = 'panel_button'),
        (e.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>'),
        (e.title = '附近巴士站'),
        document.getElementById('map_panel').appendChild(e),
        e.addEventListener('click', () => {
            userPosition
                ? ((nearbyStationsVisible = !nearbyStationsVisible),
                  nearbyStationsVisible
                      ? (showRadiusSelector(t), showNearbyStations(t, window.station_data), e.classList.add('active'))
                      : (removeNearbyStations(t), hideRadiusSelector(), e.classList.remove('active')))
                : alert('無法獲取您的位置，請確保已啟用位置服務。');
        }));
}
function showRadiusSelector(t) {
    if (document.getElementById('radius-selector'))
        return void (document.getElementById('radius-selector').style.display = 'block');
    const e = document.createElement('div');
    ((e.id = 'radius-selector'),
        (e.className = 'radius-selector'),
        (e.innerHTML = `\n        <div class="radius-title">選擇搜索半徑</div>\n        <div class="radius-options">\n            <button data-radius="300" ${300 === nearbyRadius ? 'class="active"' : ''}>300米</button>\n            <button data-radius="500" ${500 === nearbyRadius ? 'class="active"' : ''}>500米</button>\n            <button data-radius="1000" ${1e3 === nearbyRadius ? 'class="active"' : ''}>1公里</button>\n        </div>\n    `),
        document.body.appendChild(e));
    const s = e.querySelectorAll('button');
    s.forEach((e) => {
        e.addEventListener('click', (e) => {
            (s.forEach((t) => t.classList.remove('active')),
                e.target.classList.add('active'),
                (nearbyRadius = parseInt(e.target.getAttribute('data-radius'))),
                showNearbyStations(t, window.station_data));
        });
    });
}
function hideRadiusSelector() {
    const t = document.getElementById('radius-selector');
    t && (t.style.display = 'none');
}
function showNearbyStations(t, e) {
    if ((removeNearbyStations(t), !userPosition || !e)) return;
    const s = findNearbyStations(e, userPosition, nearbyRadius);
    0 !== s.length
        ? (addUserRadiusCircle(t, userPosition, nearbyRadius), addNearbyStationsToMap(t, s))
        : showNoStationsMessage();
}
function findNearbyStations(t, e, s) {
    return t
        .filter((t) => {
            const a = turf.point(e),
                n = turf.point(t.coordinate),
                o = turf.distance(a, n, { units: 'meters' });
            return ((t.distance = Math.round(o)), o <= s);
        })
        .sort((t, e) => t.distance - e.distance);
}
function showNoStationsMessage() {
    const t = document.createElement('div');
    ((t.id = 'no-stations-message'),
        (t.className = 'no-stations-message'),
        (t.innerHTML = `\n        <div class="message-content">\n            <i class="fa-solid fa-info-circle"></i>\n            <p>附近 ${nearbyRadius} 米內沒有巴士站</p>\n        </div>\n    `),
        document.body.appendChild(t),
        setTimeout(() => {
            document.getElementById('no-stations-message') && document.getElementById('no-stations-message').remove();
        }, 3e3));
}
function addUserRadiusCircle(t, e, s) {
    const a = turf.circle(e, s / 1e3, { units: 'kilometers', steps: 64 });
    t.getSource('user-radius')
        ? t.getSource('user-radius').setData(a)
        : (t.addSource('user-radius', { type: 'geojson', data: a }),
          t.addLayer({
              id: 'user-radius-fill',
              type: 'fill',
              source: 'user-radius',
              paint: { 'fill-color': '#4264fb', 'fill-opacity': 0.1 },
          }),
          t.addLayer({
              id: 'user-radius-border',
              type: 'line',
              source: 'user-radius',
              paint: { 'line-color': '#4264fb', 'line-width': 2, 'line-dasharray': [2, 2] },
          }));
}
function addNearbyStationsToMap(t, e) {
    const s = e.map((t) => ({
        type: 'Feature',
        properties: {
            id: t.stationCode,
            name: t.description,
            distance: t.distance,
            bus_lists: t.bus_lists.join(', '),
            stationCode: t.stationCode,
        },
        geometry: { type: 'Point', coordinates: t.coordinate },
    }));
    (t.addSource('nearby-stations', { type: 'geojson', data: { type: 'FeatureCollection', features: s } }),
        t.addLayer({
            id: 'nearby-stations',
            type: 'circle',
            source: 'nearby-stations',
            paint: {
                'circle-radius': 8,
                'circle-color': '#2ecc71',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
            },
        }),
        t.addLayer({
            id: 'nearby-stations-labels',
            type: 'symbol',
            source: 'nearby-stations',
            layout: {
                'text-field': ['concat', ['to-string', ['get', 'distance']], '米'],
                'text-font': ['Open Sans Regular'],
                'text-size': 12,
                'text-offset': [0, 1.5],
                'text-anchor': 'top',
            },
            paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1 },
        }));
    const a = new mapboxgl.Popup({ closeButton: !0, closeOnClick: !0 });
    (t.on('mouseenter', 'nearby-stations', (s) => {
        t.getCanvas().style.cursor = 'pointer';
        const n = s.features[0],
            o = n.geometry.coordinates.slice(),
            i = e.find((t) => t.stationCode === n.properties.stationCode);
        let r = '';
        i &&
            i.bus_lists &&
            i.bus_lists.forEach((t) => {
                const e = window.route_info_data.find((e) => e.bus_name === t);
                if (e) {
                    const s = e.line_color || '#000000';
                    r += `\n                        <div style="margin:5px;border-left: 4px solid ${s};padding:5px;">\n                            <b>${t}號路線:</b> ${e.route_start} → ${e.route_end}\n                        </div>\n                    `;
                }
            });
        const d = n.properties.stationCode.split('/'),
            c = d[0],
            u = d[1] || '1',
            l = `\n            <div class="nearby-station-popup">\n                <h3>${n.properties.name}</h3>\n                <p><i class="fa-solid fa-walking"></i> 距離: ${n.properties.distance} 米</p>\n                <div class="station-image">\n                    <img src="https://www.dsat.gov.mo/bres/BUS_STOP_IMG/${c}_${u}.JPG" \n                         alt="巴士站圖片" style="width:100%;">\n                </div>\n                <div class="bus-routes">\n                    <h4>經過路線:</h4>\n                    ${r}\n                </div>\n                <div class="popup-actions">\n                    <button class="route-to-station-btn" data-station="${n.properties.id}" \n                            data-coords="${o}">規劃路線</button>\n                </div>\n            </div>\n        `;
        (a.setLngLat(o).setHTML(l).addTo(t),
            document.addEventListener(
                'click',
                function (t) {
                    if (t.target && t.target.classList.contains('route-to-station-btn')) {
                        const e = t.target.getAttribute('data-station'),
                            s = t.target.getAttribute('data-coords').split(',').map(Number);
                        window.startRouteNavigation(userPosition, s, e);
                    }
                },
                { once: !0 },
            ));
    }),
        t.on('mouseleave', 'nearby-stations', () => {
            ((t.getCanvas().style.cursor = ''),
                setTimeout(() => {
                    const t = document.getElementsByClassName('mapboxgl-popup')[0];
                    t && !t.matches(':hover') && a.remove();
                }, 100));
        }),
        (nearbyStationsLayer = {
            ids: ['nearby-stations', 'nearby-stations-labels', 'user-radius-fill', 'user-radius-border'],
            sources: ['nearby-stations', 'user-radius'],
        }));
}
function removeNearbyStations(t) {
    (document.getElementById('no-stations-message') && document.getElementById('no-stations-message').remove(),
        nearbyStationsLayer &&
            (nearbyStationsLayer.ids.forEach((e) => {
                'bus_station' !== e && t.getLayer(e) && t.removeLayer(e);
            }),
            nearbyStationsLayer.sources.forEach((e) => {
                'bus_station' !== e && t.getSource(e) && t.removeSource(e);
            }),
            (nearbyStationsLayer = null)));
}
window.addNearbyStationsFeature = addNearbyStationsFeature;
