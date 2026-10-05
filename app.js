// Google Maps Server
const map = L.map('map', { zoomControl: false }).setView([14.5842, 121.1763], 17);
L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    attribution: '© Google Maps'
}).addTo(map);

// ADVANCED: Auto-resize map properly when phone rotates from Portrait to Landscape
const resizeObserver = new ResizeObserver(() => {
    map.invalidateSize();
});
resizeObserver.observe(document.getElementById('map'));

// PERMANENT CAR ICON (Pure SVG)
const carSVG = `
<svg width="45" height="45" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="25" y="15" width="50" height="70" rx="15" fill="#007aff" stroke="#ffffff" stroke-width="3"/>
  <rect x="32" y="30" width="36" height="18" rx="4" fill="#1c1c1e"/>
  <rect x="32" y="68" width="36" height="10" rx="3" fill="#1c1c1e"/>
  <ellipse cx="34" cy="18" rx="4" ry="2" fill="#fff500"/>
  <ellipse cx="66" cy="18" rx="4" ry="2" fill="#fff500"/>
  <ellipse cx="34" cy="83" rx="4" ry="2" fill="#ff3b30"/>
  <ellipse cx="66" cy="83" rx="4" ry="2" fill="#ff3b30"/>
</svg>`;

const vehicleIcon = L.divIcon({
    html: `<div id="car-icon" style="transition: transform 0.3s linear;">${carSVG}</div>`,
    className: '',
    iconSize: [45, 45],
    iconAnchor: [22, 22]
});

let marker = L.marker([14.5842, 121.1763], {icon: vehicleIcon}).addTo(map);

let totalDistance = 0;
let lastCoords = null;
let currentLat = 14.5842;
let currentLng = 121.1763;
let currentHeading = 0; 
let routingControl = null;
let finalDestLatLng = null;
let spokenArrived = false;
let isNavigating = false; 

// Navigation 3D Toggle
window.toggleNavigation = function() {
    const btn = document.getElementById('start-btn');
    const mapDiv = document.getElementById('map');
    const searchBar = document.getElementById('search-bar');

    if (!isNavigating) {
        isNavigating = true;
        btn.innerText = "EXIT NAVIGATION";
        btn.classList.add('active');
        
        // Hide Search bar smoothly
        searchBar.style.opacity = '0'; 
        setTimeout(() => searchBar.style.display = 'none', 400);
        
        // 3D Tilt Map
        mapDiv.classList.add('tilt-mode');
        map.setZoom(19, {animate: true});
        speak("Starting navigation.");
    } else {
        isNavigating = false;
        btn.innerText = "START";
        btn.classList.remove('active');
        
        // Show Search bar again
        searchBar.style.display = 'flex';
        setTimeout(() => searchBar.style.opacity = '1', 50);
        
        // Back to 2D Top View
        mapDiv.classList.remove('tilt-mode');
        map.setZoom(17, {animate: true});
        speak("Navigation ended.");
    }
}

// Strict English Voice
window.speak = function(text) {
    if (!window.speechSynthesis) return;
    let msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'en-US'; 
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
        
        // Pan dynamically
        map.panTo(newLatLng, {animate: true, duration: 0.5});

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
                
                // Auto Exit Navigation when arrived
                if(isNavigating) toggleNavigation();
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
        lineOptions: { styles: [{color: '#007aff', opacity: 0.8, weight: 7}] },
        createMarker: function(i, wp) {
            if (i === 0) return null; 
            return L.marker(wp.latLng); 
        }
    }).on('routesfound', function(e) {
        let coords = e.routes[0].coordinates;
        finalDestLatLng = coords[coords.length - 1]; 
        spokenArrived = false;
        
        let distKm = (e.routes[0].summary.totalDistance / 1000).toFixed(2);
        showBanner("Route found. " + distKm + " KM away");
        speak("Route found. The destination is " + distKm + " kilometers away.");
        
        document.querySelectorAll('.leaflet-routing-container').forEach(el => el.style.display = 'none');
        
        // SHOW START BUTTON NOW THAT ROUTE IS READY
        document.getElementById('start-btn').style.display = 'block';
        
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
