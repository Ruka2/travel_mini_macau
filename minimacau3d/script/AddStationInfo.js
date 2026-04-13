async function AddStationInfo(t, e, s, o = []) {
    window.showMapButton('toggle-station-button');
    const n = await fetch(e).then((t) => t.json());
    if (0 != o.length) {
        let t = o;
        filteredStationData = s
            .filter((e) => t.some((t) => e.bus_lists.includes(t)))
            .map((e) => ({ ...e, bus_lists: e.bus_lists.filter((e) => t.includes(e)) }));
    } else filteredStationData = s;
    let i = [];
    for (let t = 0; t < filteredStationData.length; t++) {
        const e = filteredStationData[t];
        let s = '';
        for (let t = 0; t < e.bus_lists.length; t++) {
            let o = e.bus_lists[t];
            bus_station_code = e.stationCode;
            let i = route_info_data.filter((t) => t.bus_name == o)[0].line_color;
            const a = getBusStationInfo(n, bus_station_code, o);
            let r = '';
            ('success' === a.status &&
                a.buses &&
                a.buses.length > 0 &&
                ((r = `<div class="real-time-info"><b>實時巴士信息-剩餘站數:</b><ul style="padding-left: 20px; margin: 5px; border-left: 3px solid ${i};">`),
                a.buses.forEach((t) => {
                    r += `<li>車牌: ${t.bus_plate}<br>距離站點: ${t.stations_remaining}站</li>`;
                }),
                (r += '</ul></div>')),
                (s += `<div style="font-size:14px;margin:5px;border-left: 4px solid ${i};padding:5px;"><b>${route_info_data.filter((t) => t.bus_name == o)[0].bus_name}號路線 :</b> ${route_info_data.filter((t) => t.bus_name == o)[0].route_start} -> ${route_info_data.filter((t) => t.bus_name == o)[0].route_end}${r}</div>`));
        }
        ((station_image_code = e.stationCode.split('/')),
            null == station_image_code[1] && (station_image_code[1] = 1),
            i.push({
                type: 'Feature',
                properties: {
                    description: `<strong style="font-size:14px" >\n                        ${e.description}\n                        <div style="overflow:hidden; border-radius: 5px;">\n                            <img src="https://www.dsat.gov.mo/bres/BUS_STOP_IMG/${station_image_code[0]}_${station_image_code[1]}.JPG" style="width:100%;height:100%;" alt="${station_image_code[0]}_${station_image_code[1]}.JPG">\n                        </div>\n                    </strong>\n                    <div class="mobile_station_scroll">\n                    ${s}\n                    </div>\n                    `,
                    stationCode: e.stationCode,
                },
                geometry: { type: 'Point', coordinates: e.coordinate },
            }));
    }
    (t.addSource('bus_station', { type: 'geojson', data: { type: 'FeatureCollection', features: i } }),
        t.addLayer({
            id: 'bus_station',
            type: 'circle',
            source: 'bus_station',
            paint: {
                'circle-color': 'black',
                'circle-radius': 5,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#4264fb',
                'circle-opacity': 0.4,
            },
        }));
    const a = new mapboxgl.Popup({ closeButton: !0, closeOnClick: !0 });
    (t.on('click', 'bus_station', (e) => {
        t.flyTo({ center: e.features[0].geometry.coordinates });
    }),
        t.on('mouseenter', 'bus_station', (e) => {
            t.getCanvas().style.cursor = 'pointer';
            const s = e.features[0].geometry.coordinates.slice(),
                o = e.features[0].properties.description;
            for (; Math.abs(e.lngLat.lng - s[0]) > 180; ) s[0] += e.lngLat.lng > s[0] ? 360 : -360;
            a.setLngLat(s).setHTML(o).addTo(t);
        }),
        t.on('mouseleave', 'bus_station', () => {
            ((t.getCanvas().style.cursor = ''),
                setTimeout(() => {
                    const t = document.getElementsByClassName('mapboxgl-popup')[0];
                    t && !t.matches(':hover') && a.remove();
                }, 100));
        }),
        t.on('click', function (t) {
            const e = document.querySelector('.mapboxgl-popup');
            if (e) {
                const s = t.originalEvent.target;
                e.contains(s) || s.closest('.mapboxgl-popup') || a.remove();
            }
        }));
}
function getBusStationInfo(t, e, s) {
    if (!t[e]) return { status: 'error', message: `未找到站点 ${e} 的信息` };
    const o = t[e].bus_routes;
    if (!s) return { status: 'success', station_code: e, all_routes: o };
    if (!o[s]) return { status: 'error', message: `站点 ${e} 没有 ${s} 路线的信息` };
    const n = o[s],
        i = [];
    return (
        n.buses &&
            n.buses.length > 0 &&
            n.buses.forEach((t) => {
                Object.keys(t).forEach((e) => {
                    t[e].forEach((t) => {
                        i.push({
                            bus_plate: t.busPlate,
                            current_station_index: t.current_station_index,
                            stations_remaining: t.stations_remaining,
                        });
                    });
                });
            }),
        {
            status: 'success',
            station_code: e,
            route: s,
            buses: i.sort((t, e) => t.stations_remaining - e.stations_remaining),
            station_indices: n.station_indices,
        }
    );
}
