const map = L.map('map', { zoomControl: false }).setView([14.5995, 120.9842], 18);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OSM'
}).addTo(map);

// Vehicle Icon
const vehicleIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2983/2983737.png',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

let marker = L.marker([14.5995, 120.9842], {icon: vehicleIcon}).addTo(map);

let totalDistance = 0;
let lastCoords = null;
let currentLat = 14.5995;
let currentLng = 120.9842;
let routingControl = null;
let finalDestLatLng = null;
let spokenArrived = false;

// Screen Wake Lock
let wakeLock = null;
async function requestWakeLock() {
    try { wakeLock = await navigator.wakeLock.request('screen'); } 
    catch (err) { console.log('Wake Lock error:', err); }
}
requestWakeLock();

// Voice Over Function
window.speak = function(text) {
    if (!window.speechSynthesis) return;
    let msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'tl-PH'; // Tagalog accent kung supported ng phone
    window.speechSynthesis.speak(msg);
};

// Battery & Live Range Logic
window.updateRange = function() {
    let batInput = document.getElementById('battery-input');
    if(!batInput) return;
    let bat = parseFloat(batInput.value);
    if (bat > 100) bat = 100; if (bat < 0) bat = 0;
    
    // Computation: 100% = 30km (1% = 0.3km)
    let maxRange = bat * 0.3;
    let currentRange = maxRange - totalDistance; 
    if (currentRange < 0) currentRange = 0;
    
    document.getElementById('est-range').innerText = currentRange.toFixed(1);
    
    // Update Visual Bar
    let percentLeft = maxRange > 0 ? (currentRange / maxRange) * 100 : 0;
    let bar = document.getElementById('battery-bar-fill');
    bar.style.width = percentLeft + "%";
    
    if (percentLeft <= 20) bar.style.background = "#f44336"; // Red
    else if (percentLeft <= 50) bar.style.background = "#ff9800"; // Orange
    else bar.style.background = "#4caf50"; // Green
};

// Reset Trip Logic
window.resetTrip = function() {
    // Adjust Battery % so you don't lose the drained amount
    let currentRange = parseFloat(document.getElementById('est-range').innerText);
    let newBat = (currentRange / 0.3).toFixed(0);
    document.getElementById('battery-input').value = newBat;
    
    totalDistance = 0;
    document.getElementById('distance').innerText = "0.00";
    updateRange();
};

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
        
        // Update Marker & Zoom in Close
        const newLatLng = new L.LatLng(currentLat, currentLng);
        marker.setLatLng(newLatLng);
        map.panTo(newLatLng);

        // Update Live Speed & Mode Dynamically
        document.getElementById('speed').innerText = speedKmh.toFixed(1);
        const modeEl = document.getElementById('speed-mode');
        if (speedKmh == 0) { modeEl.innerText = "IDLE"; modeEl.style.color = "#aaa"; }
        else if (speedKmh <= 29) { modeEl.innerText = "LOW"; modeEl.style.color = "#4caf50"; }
        else if (speedKmh <= 39) { modeEl.innerText = "MEDIUM"; modeEl.style.color = "#ff9800"; }
        else { modeEl.innerText = "HIGH"; modeEl.style.color = "#f44336"; }

        // Update Trip & Live Battery Drop
        if (lastCoords) {
            let moved = calculateDistance(lastCoords.lat, lastCoords.lng, currentLat, currentLng);
            totalDistance += moved;
            document.getElementById('distance').innerText = totalDistance.toFixed(2);
            updateRange(); // Auto compute bar & range text
        }
        lastCoords = { lat: currentLat, lng: currentLng };

        // Check distance to destination live
        if (finalDestLatLng) {
            let distToDest = calculateDistance(currentLat, currentLng, finalDestLatLng.lat, finalDestLatLng.lng);
            document.getElementById('dest-dist').innerText = distToDest.toFixed(2);
            
            // Voice Alarm when < 50 meters
            if (distToDest <= 0.05 && !spokenArrived) {
                document.getElementById('nav-banner').innerText = "MALAPIT KA NA!";
                document.getElementById('nav-banner').style.background = "#4caf50";
                speak("Malapit ka na sa iyong destinasyon.");
                spokenArrived = true;
            }
        }

    }, error => console.error(error), { enableHighAccuracy: true, maximumAge: 0 });
}

// Draw Route Logic
function drawRoute(destLat, destLng) {
    if(routingControl != null) { map.removeControl(routingControl); }
    
    routingControl = L.Routing.control({
        waypoints: [ L.latLng(currentLat, currentLng), L.latLng(destLat, destLng) ],
        routeWhileDragging: false,
        addWaypoints: false,
        show: false, // Totally hide default routing box
        createMarker: function(i, wp) {
            if (i === 0) return null; // Keep our E-bike icon
            return L.marker(wp.latLng); // Destination pin
        }
    }).on('routesfound', function(e) {
        let coords = e.routes[0].coordinates;
        finalDestLatLng = coords[coords.length - 1]; // Exact finish line
        spokenArrived = false;
        
        let distKm = (e.routes[0].summary.totalDistance / 1000).toFixed(2);
        document.getElementById('nav-banner').innerText = "Ruta: " + distKm + " KM ang layo";
        document.getElementById('nav-banner').style.background = "#1565C0";
        
        // Voice Over
        speak("Nahanap na ang ruta. Ito ay " + distKm + " kilometro ang layo.");
        
        // Hide default leaflet boxes again to be safe
        document.querySelectorAll('.leaflet-routing-container').forEach(el => el.style.display = 'none');
        
        // Zoom in nicely
        map.setZoom(18);
    }).addTo(map);
}

// Map Click Destination
map.on('click', function(e) { drawRoute(e.latlng.lat, e.latlng.lng); });

// Text Search Destination
window.searchDestination = async function() {
    const query = document.getElementById('dest-input').value;
    if (!query) { alert("Mag-type ng pupuntahan."); return; }
    document.getElementById('nav-banner').innerText = "Naghahanap...";
    
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data && data.length > 0) {
            drawRoute(data[0].lat, data[0].lon);
            map.setView([data[0].lat, data[0].lon], 16);
        } else {
            alert("Hindi nahanap. Subukan ang mas malinaw na address.");
            document.getElementById('nav-banner').innerText = "Mag-search o mag-tap ng pupuntahan";
        }
    } catch (err) {
        alert("Kailangan ng internet pang-search ng address.");
    }
}
