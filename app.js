// --- Idagdag ito sa pinaka-ibaba ng app.js mo ---

// Search Destination by Typing
async function searchDestination() {
    const query = document.getElementById('dest-input').value;
    if (!query) {
        alert("Mag-type muna ng pupuntahan.");
        return;
    }

    try {
        // Libreng Search API ng OpenStreetMap
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            const destLat = data[0].lat;
            const destLng = data[0].lon;
            
            if(routingControl != null) {
                map.removeControl(routingControl);
            }
            
            routingControl = L.Routing.control({
                waypoints: [
                    L.latLng(currentLat, currentLng), 
                    L.latLng(destLat, destLng)
                ],
                routeWhileDragging: false,
                addWaypoints: false,
                createMarker: function(i, wp, nWps) {
                    if (i === 0) return null; // Wag palitan ang E-Bike icon natin
                    return L.marker(wp.latLng); // Simpleng pin para sa pupuntahan
                }
            }).addTo(map);

            // I-zoom ang mapa para makita ang parehong Start at End point
            map.fitBounds([
                [currentLat, currentLng],
                [destLat, destLng]
            ]);

        } else {
            alert("Hindi nahanap ang lokasyon. Subukan ang mas kumpletong address.");
        }
    } catch (error) {
        console.error("Geocoding error:", error);
        alert("Kailangan ng internet para mag-search ng bagong lokasyon.");
    }
}
