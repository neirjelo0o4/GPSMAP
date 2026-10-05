const map = L.map('map').setView([14.5995, 120.9842], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OSM'
}).addTo(map);

// Custom E-Bike/Vehicle Icon
const vehicleIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2983/2983737.png', // Icon ng e-bike/scooter
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

let marker = L.marker([14.5995, 120.9842], {icon: vehicleIcon}).addTo(map);

let totalDistance = 0;
let lastCoords = null;
let currentLat = 14.5995;
let currentLng = 120.9842;
let routingControl = null;

// Screen Wake Lock
let wakeLock = null;
async function requestWakeLock() {
    try { wakeLock = await navigator.wakeLock.request('screen'); } 
    catch (err) { console.log('Wake Lock error:', err); }
}
requestWakeLock();

// Battery Range Logic (100% = 30km, therefore 1% = 0.3km)
window.updateRange = function() {
    let bat = document.getElementById('battery-input').value;
    if (bat > 100) bat = 100;
    if (bat < 0) bat = 0;
    let range = bat * 0.3; // 30km / 100
    document.getElementById('est-range').innerText = range.toFixed(1);
}

// Distance Calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// GPS Tracking (Moving the Map & Marker live)
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(position => {
        currentLat = position.coords.latitude;
        currentLng = position.coords.longitude;
        const speedKmh = position.coords.speed ? (position.coords.speed * 3.6) : 0; 
        
        // Update Map & Icon
        const newLatLng = new L.LatLng(currentLat, currentLng);
        marker.setLatLng(newLatLng);
        map.panTo(newLatLng);

        // Update Speedometer & Mode
        document.getElementById('speed').innerText = speedKmh.toFixed(1);
        const modeEl = document.getElementById('speed-mode');
        if (speedKmh == 0) { modeEl.innerText = "IDLE"; modeEl.style.color = "#aaa"; }
        else if (speedKmh <= 29) { modeEl.innerText = "LOW"; modeEl.style.color = "#4caf50"; }
        else if (speedKmh <= 39) { modeEl.innerText = "MEDIUM"; modeEl.style.color = "#ff9800"; }
        else { modeEl.innerText = "HIGH"; modeEl.style.color = "#f44336"; }

        // Update Trip
        if (lastCoords) {
            totalDistance += calculateDistance(lastCoords.lat, lastCoords.lng, currentLat, currentLng);
            document.getElementById('distance').innerText = totalDistance.toFixed(2);
            
            // Auto deduct distance from estimated battery range
            let currentRange = parseFloat(document.getElementById('est-range').innerText);
            let deductedRange = currentRange - calculateDistance(lastCoords.lat, lastCoords.lng, currentLat, currentLng);
            if (deductedRange < 0) deductedRange = 0;
            document.getElementById('est-range').innerText = deductedRange.toFixed(1);
        }
        lastCoords = { lat: currentLat, lng: currentLng };

        // Update Routing Start Point kung may naka-set na destination
        if(routingControl != null) {
            routingControl.spliceWaypoints(0, 1, L.latLng(currentLat, currentLng));
        }

    }, error => console.error(error), { enableHighAccuracy: true, maximumAge: 0 });
}

// Set Destination by Tapping on Map
map.on('click', function(e) {
    if(routingControl != null) {
        map.removeControl(routingControl); // Tanggalin ang lumang ruta
    }
    
    // Gumawa ng bagong ruta from Current Location to Tapped Location
    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(currentLat, currentLng), 
            L.latLng(e.latlng.lat, e.latlng.lng)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        createMarker: function(i, wp, nWps) {
            // Gusto natin walang default marker sa Start dahil may sasakyan icon na tayo
            if (i === 0) return null;
            // Lalagyan natin ng simpleng marker ang Destination
            return L.marker(wp.latLng);
        }
    }).addTo(map);
});
