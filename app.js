// Clean Modern Map (Grab / Google Maps style)
const map = L.map('map', { zoomControl: false }).setView([14.6204, 121.1714], 18);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution: '© OpenStreetMap'
}).addTo(map);

// Modern Top-View Car Icon
const vehicleIcon = L.divIcon({
    html: '<img src="https://cdn-icons-png.flaticon.com/512/3350/3350383.png" class="vehicle-icon" id="car-icon">',
    className: '',
    iconSize: [45, 45],
    iconAnchor: [22, 22]
});

let marker = L.marker([14.6204, 121.1714], {icon: vehicleIcon}).addTo(map);

let totalDistance = 0;
let lastCoords = null;
let currentLat = 14.6204;
let currentLng = 121.1714;
let currentHeading = 0; 
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

// -- STRICT ENGLISH VOICE --
window.speak = function(text) {
    if (!window.speechSynthesis) return;
    let msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'en-US'; // Strict English
    msg.rate = 1.0;
    window.speechSynthesis.speak(msg);
};

// Battery Logic
window.updateRange = function() {
    let batInput = document.getElementById('battery-input');
    if(!batInput) return;
    let bat = parseFloat(batInput.value);
    if (bat > 100) bat = 100; if (bat < 0) bat = 0;
    
    let maxRange = bat * 0.3;
    let currentRange = maxRange - totalDistance; 
    if (currentRange < 0) currentRange = 0;
    
    document.getElementById('est-range').innerText = currentRange.toFixed(1);
    
    let percentLeft = maxRange > 0 ? (currentRange / maxRange) * 100 : 0;
    let bar = document.getElementById('battery-bar-fill');
    bar.style.width = percentLeft + "%";
    
    if (percentLeft <= 20) { bar.style.background = "#ff3b30"; } 
    else if (percentLeft <= 50) { bar.style.background = "#ff9500"; } 
    else { bar.style.background = "#34c759"; }
};

window.resetTrip = function() {
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
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function getBearing(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => deg * Math.PI / 180;
    const toDeg = (rad) => rad * 180 / Math.PI;
    const dLon = toRad(lng2 - lng1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function showBanner(text) {
    const banner = document.getElementById('nav-banner');
    banner.innerText = text;
    banner.style.display = 'block';
}

// GPS Tracking Live Updates
if (navigator.geolocation) {
    navigator.geolocation.watchPosition(position => {
        currentLat = position.coords.latitude;
        currentLng = position.coords.longitude;
        const speedKmh = position.coords.speed ? (position.coords.speed * 3.6) : 0; 
        
        const newLatLng = new L.LatLng(currentLat, currentLng);
        marker.setLatLng(newLatLng);
        
        // Offset the map slightly so the car is at the lower part of the screen (like Grab)
        map.panTo(newLatLng, {animate: true});

        // Rotation Logic (Rotates car when moving)
        if (lastCoords && speedKmh > 1) { 
            if (position.coords.heading !== null && !isNaN(position.coords.heading)) {
                currentHeading = position.coords.heading;
            } else {
                currentHeading = getBearing(lastCoords.lat, lastCoords.lng, currentLat, currentLng);
            }
            const carEl = document.getElementById('car-icon');
            if(carEl) carEl.style.transform = `rotate(${currentHeading}deg)`;
        }

        document.getElementById('speed').innerText = speedKmh.toFixed(1);
        const modeEl = document.getElementById('speed-mode');
        
        // Reset mode classes
        modeEl.className = "value";
        if (speedKmh == 0) { modeEl.innerText = "IDLE"; modeEl.classList.add("mode-idle"); }
        else if (speedKmh <= 29) { modeEl.innerText = "LOW"; modeEl.classList.add("mode-low"); }
        else if (speedKmh <= 39) { modeEl.innerText = "MEDIUM"; modeEl.classList.add("mode-med"); }
        else { modeEl.innerText = "HIGH"; modeEl.classList.add("mode-high"); }

        if (lastCoords) {
            let moved = calculateDistance(lastCoords.lat, lastCoords.lng, currentLat, currentLng);
            totalDistance += moved;
            document.getElementById('distance').innerText = totalDistance.toFixed(2);
            updateRange(); 
        }
        lastCoords = { lat: currentLat, lng: currentLng };

        if (finalDestLatLng) {
            let distToDest = calculateDistance(currentLat, currentLng, finalDestLatLng.lat, finalDestLatLng.lng);
            document.getElementById('dest-dist').innerText = distToDest.toFixed(2);
            
            if (distToDest <= 0.05 && !spokenArrived) {
                showBanner("You have arrived!");
                speak("You have arrived at your destination.");
                spokenArrived = true;
            }
        }
    }, error => console.error(error), { enableHighAccuracy: true, maximumAge: 0 });
}

function drawRoute(destLat, destLng) {
    if(routingControl != null) { map.removeControl(routingControl); }
    showBanner("Calculating route...");
    
    routingControl = L.Routing.control({
        waypoints: [ L.latLng(currentLat, currentLng), L.latLng(destLat, destLng) ],
        routeWhileDragging: false,
        addWaypoints: false,
        show: false,
        // Thick Google Maps style Blue Line
        lineOptions: {
            styles: [{color: '#007aff', opacity: 0.8, weight: 7}]
        },
        createMarker: function(i, wp) {
            if (i === 0) return null; // Keep car icon
            return L.marker(wp.latLng); // Dest Pin
        }
    }).on('routesfound', function(e) {
        let coords = e.routes[0].coordinates;
        finalDestLatLng = coords[coords.length - 1]; 
        spokenArrived = false;
        
        let distKm = (e.routes[0].summary.totalDistance / 1000).toFixed(2);
        showBanner("Route found. " + distKm + " KM away");
        speak("Route found. The destination is " + distKm + " kilometers away.");
        
        document.querySelectorAll('.leaflet-routing-container').forEach(el => el.style.display = 'none');
        map.setZoom(17);
    }).addTo(map);
}

map.on('click', function(e) { drawRoute(e.latlng.lat, e.latlng.lng); });

window.searchDestination = async function() {
    const query = document.getElementById('dest-input').value;
    if (!query) { alert("Please type a destination."); return; }
    showBanner("Searching...");
    
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data && data.length > 0) {
            drawRoute(data[0].lat, data[0].lon);
            map.setView([data[0].lat, data[0].lon], 16);
        } else {
            alert("Location not found.");
            document.getElementById('nav-banner').style.display = 'none';
        }
    } catch (err) {
        alert("Internet connection required.");
    }
}
