import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
function FitMap({ location, route }) {
  const map = useMap();
  useEffect(() => {
    if (route?.geometry?.coordinates?.length) map.fitBounds(route.geometry.coordinates.map(([lon,lat]) => [lat,lon]), {padding:[35,35], maxZoom:16});
    else if (location) map.setView([location.lat,location.lon], 15);
  }, [location?.lat,location?.lon,route,map]);
  return null;
}
export default function MapView({location, route, destination}) {
  return <MapContainer center={location ? [location.lat,location.lon] : [13.0827,80.2707]} zoom={13} zoomControl={false} scrollWheelZoom={false} className="map">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {route?.geometry?.coordinates && <Polyline positions={route.geometry.coordinates.map(([lon,lat])=>[lat,lon])} pathOptions={{color:'#247a5c',weight:6,opacity:.85}} />}
    {location && <CircleMarker center={[location.lat,location.lon]} radius={8} pathOptions={{color:'#fff',weight:3,fillColor:'#1b7658',fillOpacity:1}}><Popup>Your location</Popup></CircleMarker>}
    {destination && <CircleMarker center={[destination.lat,destination.lon]} radius={8} pathOptions={{color:'#fff',weight:3,fillColor:'#df8454',fillOpacity:1}}><Popup>{destination.name}</Popup></CircleMarker>}
    <FitMap location={location} route={route} />
  </MapContainer>;
}
