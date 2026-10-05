// Map Initialization (Default to Antipolo/Manila area)
const map = L.map('map').setView([14.5995, 120.9842], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

let marker = L.marker([14.5995, 120.9842]).addTo(map);
let totalDistance = 0;
let lastCoords = null;

// Screen Wake Lock (Para hindi mamatay ang screen habang nag-dadrive)
let wakeLock = null;
async function requestWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
        console.log('Wake Lock error:', err);
    }
}
requestWakeLock();

// Haversine formula para ma-compute ang distansya ng bawat galaw
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// GPS Tracking
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        // Speed is in m/s, convert to km/h
        const speedKmh = position.coords.speed ? (position.coords.speed * 3.6) : 0; 
        
        // Update Map
        const newLatLng = new L.LatLng(lat, lng);
        marker.setLatLng(newLatLng);
        map.panTo(newLatLng);

        // Update Speedometer
        document.getElementById('speed').innerText = speedKmh.toFixed(1);

        // Determine Mode
        const modeEl = document.getElementById('speed-mode');
        if (speedKmh == 0) { modeEl.innerText = "IDLE"; modeEl.style.color = "#aaa"; }
        else if (speedKmh <= 29) { modeEl.innerText = "LOW (≤29 km/h)"; modeEl.style.color = "#4caf50"; }
        else if (speedKmh <= 39) { modeEl.innerText = "MEDIUM (≤39 km/h)"; modeEl.style.color = "#ff9800"; }
        else { modeEl.innerText = "HIGH (≥40 km/h)"; modeEl.style.color = "#f44336"; }

        // Update Trip Meter
        if (lastCoords) {
            totalDistance += calculateDistance(lastCoords.lat, lastCoords.lng, lat, lng);
            document.getElementById('distance').innerText = totalDistance.toFixed(2);
        }
        lastCoords = { lat, lng };

    }, error => console.error(error), { enableHighAccuracy: true, maximumAge: 0 });
}

// Battery Status API
if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
        function updateBattery() {
            const level = (battery.level * 100).toFixed(0);
            document.getElementById('battery-bar').style.width = level + '%';
            document.getElementById('battery-text').innerText = level + '%';
            
            if (level <= 20) document.getElementById('battery-bar').style.background = '#f44336';
            else if (level <= 50) document.getElementById('battery-bar').style.background = '#ff9800';
            else document.getElementById('battery-bar').style.background = '#4caf50';
        }
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
    });
}

// Register Service Worker for Offline Mode
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}
