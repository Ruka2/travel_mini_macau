function updateTimeWithAnimation(e, t, n) {
    const o = document.getElementById("current-time");
    // 直接更新时间，不添加闪烁动画
    o.innerHTML = `${e}:${t}:${n}`;
}
((window.usingApiTime = !1),
    (window.startClock = function () {
        if (window.usingApiTime) return void setTimeout(startClock, 1000);
        const e = new Date();
        (updateTimeWithAnimation(
            padWithZeroes(e.getHours(), 2),
            padWithZeroes(e.getMinutes(), 2),
            padWithZeroes(e.getSeconds(), 2),
        ),
            setTimeout(startClock, 1000));
    }),
    (window.updateBusDateTime = function (e) {
        // 切换到系统时间模式
        window.usingApiTime = !0;
        
        // 定义实时更新函数
        const updateSystemTime = () => {
            const now = new Date();
            document.getElementById("current-date").innerText = getCurrentDate(now);
            updateTimeWithAnimation(
                padWithZeroes(now.getHours(), 2),
                padWithZeroes(now.getMinutes(), 2),
                padWithZeroes(now.getSeconds(), 2),
            );
        };
        
        // 立即执行一次
        updateSystemTime();
        
        // 启动定时器，每500毫秒更新一次（与 startClock 相同频率）
        const systemTimeInterval = setInterval(updateSystemTime, 1000);
        
        // 保存 interval ID，以便需要时可以清除
        window.systemTimeInterval = systemTimeInterval;
    }));
const padWithZeroes = (e, t) => {
    let n = e;
    return ("string" != typeof e && (n = e.toString()), n.padStart(t, "0"));
};
function getCurrentDate(e) {
    if (0 != e) e = new Date(e);
    else e = new Date();
    var t = e.getFullYear(),
        n = e.getMonth() + 1,
        o = e.getDate(),
        i = e.getDay();
    switch (i) {
        case 1:
            i = "週一";
            break;
        case 2:
            i = "週二";
            break;
        case 3:
            i = "週三";
            break;
        case 4:
            i = "週四";
            break;
        case 5:
            i = "週五";
            break;
        case 6:
            i = "週六";
            break;
        case 0:
            i = "週日";
    }
    return t + "年" + n + "月" + o + "日 " + i;
}
function simulateTimeFlow(e, t, n) {
    document.getElementById("current-date").innerText = getCurrentDate(e);
    let o = new Date(e),
        i = new Date(t),
        c = (i - o) / ((1e3 * n) / 50);
    !(function e() {
        ((o = new Date(o.getTime() + c)),
            updateTimeWithAnimation(
                padWithZeroes(o.getHours(), 2),
                padWithZeroes(o.getMinutes(), 2),
                padWithZeroes(o.getSeconds(), 2),
            ),
            o < i ? setTimeout(e, 50) : (document.getElementById("current-date").innerText = getCurrentDate(0)));
    })();
}
((document.getElementById("current-date").innerText = getCurrentDate(0)),
    document.addEventListener("DOMContentLoaded", function () {
        Object.keys({ "toggle-station-button": !1, "toggle-route-button": !1, "demo-data-button": !1 }).forEach((e) => {
            const t = document.getElementById(e);
            t && (t.style.display = "none");
        });
        const e = document.querySelector(".mapboxgl-ctrl-geocoder.mapboxgl-ctrl");
        e &&
            e.addEventListener("click", function (t) {
                e.classList.add("mapboxgl-ctrl-geocoder-search-box");
            });
        const t = document.getElementById("search-modal"),
            n = document.getElementById("search-route-button"),
            o = document.getElementById("search-confirm"),
            i = document.getElementById("search-cancel"),
            c = document.getElementById("route-select"),
            l = document.getElementById("direction-select");
        (n.addEventListener("click", function () {
            ((t.style.display = "block"),
                c.children.length <= 1 &&
                    [...new Set(traffic_data.map((e) => e.routeCode))].sort().forEach((e) => {
                        const t = document.createElement("option");
                        ((t.value = e), (t.textContent = e.replace(/^0+/, "")), c.appendChild(t));
                    }));
        }),
            c.addEventListener("change", function () {
                if (((l.innerHTML = '<option value="">請選擇方向...</option>'), this.value)) {
                    const e = this.value;
                    (traffic_data
                        .filter((t) => t.routeCode === e)
                        .map((e) => e.direction)
                        .filter((e, t, n) => n.indexOf(e) === t)
                        .forEach((e) => {
                            const t = document.createElement("option");
                            ((t.value = e), (t.textContent = e), l.appendChild(t));
                        }),
                        (l.disabled = !1));
                } else l.disabled = !0;
            }),
            o.addEventListener("click", function () {
                const e = c.value,
                    n = l.value;
                if (e && n) {
                    window.trafficIds.forEach((e) => {
                        window.map.setPaintProperty(e, "line-opacity", 0);
                    });
                    window.trafficIds
                        .filter((t) => t.includes(e) && t.includes(n))
                        .forEach((e) => {
                            window.map.setPaintProperty(e, "line-opacity", 1);
                        });
                }
                t.style.display = "none";
            }),
            i.addEventListener("click", function () {
                ((t.style.display = "none"),
                    window.trafficIds.forEach((e) => {
                        window.map.setPaintProperty(e, "line-opacity", 0.4);
                    }));
            }),
            t.addEventListener("click", function (e) {
                e.target === t &&
                    ((t.style.display = "none"),
                    window.trafficIds.forEach((e) => {
                        window.map.setPaintProperty(e, "line-opacity", 0.4);
                    }));
            }));
    }),
    (window.showMapButton = function (e) {
        const t = document.getElementById(e);
        t && (t.style.display = "flex");
    }),
    (window.hideMapButton = function (e) {
        const t = document.getElementById(e);
        t && (t.style.display = "none");
    }));
var stationVisibility = !0,
    toggle_station_button = document.getElementById("toggle-station-button");
toggle_station_button.addEventListener("click", function () {
    window.map &&
        window.map.getLayer("bus_station") &&
        ((stationVisibility = !stationVisibility),
        window.map.setLayoutProperty("bus_station", "visibility", stationVisibility ? "visible" : "none"),
        (toggle_station_button.style.backgroundColor = stationVisibility ? "" : "gray"));
});
var routeVisibility = !0,
    toggle_route_button = document.getElementById("toggle-route-button");
toggle_route_button.addEventListener("click", function () {
    window.map &&
        window.trafficIds &&
        ((routeVisibility = !routeVisibility),
        window.trafficIds.forEach((e) => {
            window.map.setLayoutProperty(e, "visibility", routeVisibility ? "visible" : "none");
        }),
        (toggle_route_button.style.backgroundColor = routeVisibility ? "" : "gray"));
});
var fullscreenButton = document.getElementById("fullscreen-button"),
    isFullScreen = !1;
function updateFullscreenButtonIcon() {
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
        ? (fullscreenButton.querySelector("i").classList.remove("fa-expand"),
          fullscreenButton.querySelector("i").classList.add("fa-compress"),
          (isFullScreen = !0))
        : (fullscreenButton.querySelector("i").classList.remove("fa-compress"),
          fullscreenButton.querySelector("i").classList.add("fa-expand"),
          (isFullScreen = !1));
}
(fullscreenButton.addEventListener("click", function () {
    (isFullScreen
        ? (document.exitFullscreen
              ? document.exitFullscreen()
              : document.mozCancelFullScreen
                ? document.mozCancelFullScreen()
                : document.webkitExitFullscreen
                  ? document.webkitExitFullscreen()
                  : document.msExitFullscreen && document.msExitFullscreen(),
          fullscreenButton.querySelector("i").classList.remove("fa-compress"),
          fullscreenButton.querySelector("i").classList.add("fa-expand"))
        : (document.documentElement.requestFullscreen
              ? document.documentElement.requestFullscreen()
              : document.documentElement.mozRequestFullScreen
                ? document.documentElement.mozRequestFullScreen()
                : document.documentElement.webkitRequestFullscreen
                  ? document.documentElement.webkitRequestFullscreen()
                  : document.documentElement.msRequestFullscreen && document.documentElement.msRequestFullscreen(),
          fullscreenButton.querySelector("i").classList.remove("fa-expand"),
          fullscreenButton.querySelector("i").classList.add("fa-compress")),
        (isFullScreen = !isFullScreen));
}),
    document.addEventListener("fullscreenchange", updateFullscreenButtonIcon),
    document.addEventListener("webkitfullscreenchange", updateFullscreenButtonIcon),
    document.addEventListener("mozfullscreenchange", updateFullscreenButtonIcon),
    document.addEventListener("MSFullscreenChange", updateFullscreenButtonIcon));
