export function distance(a,b) {
  const rad = Math.PI / 180, dLat = (b.lat-a.lat)*rad, dLon = (b.lon-a.lon)*rad;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function formatDistance(m) { return m >= 1000 ? `${(m/1000).toFixed(1)} km` : `${Math.round(m/10)*10 || 10} m`; }
export function instruction(step) {
  const m = step.maneuver || {};
  if (m.type === 'arrive') return 'You have arrived at your destination';
  if (m.type === 'depart') return `Head ${m.modifier || 'forward'}${step.name ? ` on ${step.name}` : ''}`;
  const action = m.type === 'roundabout' || m.type === 'rotary' ? 'Enter the roundabout' : m.modifier ? `${m.modifier.includes('left') ? 'Turn left' : m.modifier.includes('right') ? 'Turn right' : 'Continue straight'}` : 'Continue straight';
  return `${action}${step.name ? ` onto ${step.name}` : ''}`;
}
export function extractDestination(text) {
  const clean = text.trim().replace(/[.!?]+$/, '');
  const match = clean.match(/(?:take me to|navigate to|directions to|go to|going to|get to|i need to go to|i want to go to)\s+(.+)/i);
  return match ? match[1].trim() : '';
}
