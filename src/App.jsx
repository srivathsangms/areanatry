import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, AudioLines, Bell, Bluetooth, Camera, Check, ChevronDown, ChevronRight, CircleHelp, Compass, Crosshair, Eye, Footprints, Heart, Info, LocateFixed, Map, MapPin, Menu, Mic, MicOff, Navigation, Navigation2, Pause, Play, Radar, Route, Search, Settings2, ShieldCheck, Sparkles, Square, Volume2, Wifi, X } from 'lucide-react';
import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import mjsUrl from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import MapView from './components/MapView';
import useVoice from './hooks/useVoice';
import { decodeDetections, position } from './lib/detection';
import { distance, formatDistance, instruction } from './lib/navigation';

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl };

const IconBox = ({ icon: Icon, className = '' }) => <span className={`icon-box ${className}`}><Icon size={19} strokeWidth={1.8}/></span>;
function Brand() { return <div className="brand"><span className="brand-mark"><Eye size={23}/><i/></span><span>vish<span className="brand-dot">.</span></span></div>; }

export default function App() {
  const [page,setPage] = useState('overview');
  const [modal,setModal] = useState('');
  const [cameraUrl,setCameraUrl] = useState(localStorage.getItem('vish-camera-url') || 'http://192.168.4.1/capture');
  const [cameraState,setCameraState] = useState('disconnected');
  const [cameraError,setCameraError] = useState('');
  const [source,setSource] = useState('');
  const [modelState,setModelState] = useState('idle');
  const [detections,setDetections] = useState([]);
  const [lastFrame,setLastFrame] = useState(null);
  const [location,setLocation] = useState(null);
  const [locationError,setLocationError] = useState('');
  const [query,setQuery] = useState('');
  const [route,setRoute] = useState(null);
  const [destination,setDestination] = useState(null);
  const [navStatus,setNavStatus] = useState('idle');
  const [navError,setNavError] = useState('');
  const [stepIndex,setStepIndex] = useState(0);
  const [sound,setSound] = useState(true);
  const [events,setEvents] = useState([]);
  const [mobileMenu,setMobileMenu] = useState(false);
  const videoRef = useRef(null), canvasRef = useRef(null), sessionRef = useRef(null), streamRef = useRef(null), cameraRun = useRef(0), gpsWatch = useRef(null), alertRef = useRef({key:'',time:0}), routeRef = useRef(null), stepRef = useRef(0), soundRef = useRef(true), speechRef = useRef(null);
  soundRef.current = sound; routeRef.current = route; stepRef.current = stepIndex;
  const addEvent = useCallback((title, description, kind='neutral') => setEvents(old => [{id:Date.now()+Math.random(),title,description,kind,time:new Date()},...old].slice(0,5)), []);
  const stopNavigation = useCallback(() => { setRoute(null); setDestination(null); setStepIndex(0); setNavStatus('idle'); setNavError(''); addEvent('Navigation ended','Your route has been cleared.'); },[addEvent]);
  const routeTo = useCallback(async (place) => {
    const text = place?.trim(); if (!text) { setNavError('Enter a destination first.'); return; }
    setQuery(text); setPage('navigation'); setNavError(''); setNavStatus('loading');
    const getLocation = () => location ? Promise.resolve(location) : new Promise((resolve,reject) => {
      if (!navigator.geolocation) return reject(new Error('Location is not supported by this browser.'));
      navigator.geolocation.getCurrentPosition(p => { const point={lat:p.coords.latitude,lon:p.coords.longitude}; setLocation(point); resolve(point); }, () => reject(new Error('Allow location access to plan a route.')), {enableHighAccuracy:true,timeout:15000});
    });
    try {
      const origin = await getLocation();
      const params = new URLSearchParams({q:text,format:'jsonv2',limit:'1',lat:origin.lat,lon:origin.lon});
      const found = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!found.ok) throw new Error('Place search is unavailable. Check your internet connection.');
      const results = await found.json(); if (!results.length) throw new Error('No matching place found. Try a more specific name.');
      const target = {lat:Number(results[0].lat),lon:Number(results[0].lon),name:results[0].display_name.split(',').slice(0,2).join(',')};
      const response = await fetch(`https://router.project-osrm.org/route/v1/foot/${origin.lon},${origin.lat};${target.lon},${target.lat}?overview=full&geometries=geojson&steps=true`);
      if (!response.ok) throw new Error('Routing service unavailable. Check your internet connection.');
      const json=await response.json(); if (!json.routes?.length) throw new Error('No route found for this destination.');
      setDestination(target); setRoute(json.routes[0]); setStepIndex(0); setNavStatus('active');
      addEvent('Route ready',`Heading to ${target.name}.`,'green');
      if (soundRef.current) speechRef.current?.(`Route ready to ${target.name}. ${instruction(json.routes[0].legs[0].steps[0])}. Please verify the route before walking.`);
    } catch (error) { setNavStatus('error'); setNavError(error.message || 'Unable to plan route.'); }
  },[location,addEvent]);

  const startLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocationError('Location is not supported in this browser.'); return; }
    if (gpsWatch.current !== null) return;
    setLocationError('');
    gpsWatch.current = navigator.geolocation.watchPosition(p => { setLocation({lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy}); setLocationError(''); }, err => { setLocationError(err.message || 'Location unavailable.'); if (err.code === 1 && gpsWatch.current !== null) { navigator.geolocation.clearWatch(gpsWatch.current); gpsWatch.current=null; } }, {enableHighAccuracy:true,maximumAge:5000,timeout:20000});
  }, []);
  useEffect(() => () => { if (gpsWatch.current !== null) navigator.geolocation.clearWatch(gpsWatch.current); }, []);
  useEffect(() => {
    if (!route || !location) return;
    const steps=route.legs?.flatMap(leg=>leg.steps) || [];
    const next=steps[stepIndex+1]; if (!next?.maneuver?.location) return;
    const [lon,lat]=next.maneuver.location;
    if (distance(location,{lat,lon}) < 30) {
      setStepIndex(stepIndex+1);
      const text=instruction(next); addEvent('Next direction',text,'green'); if(soundRef.current) speechRef.current?.(text);
    }
  }, [location,route,stepIndex,addEvent]);

  const stopCamera = useCallback(() => {
    cameraRun.current++; streamRef.current?.getTracks().forEach(track=>track.stop()); streamRef.current=null;
    if(videoRef.current) videoRef.current.srcObject=null;
    setCameraState('disconnected'); setSource(''); setDetections([]); setLastFrame(null);
  }, []);
  useEffect(() => () => { cameraRun.current++; streamRef.current?.getTracks().forEach(track=>track.stop()); }, []);
  const startCamera = useCallback(async (type) => {
    stopCamera(); const run=++cameraRun.current; setCameraState('connecting'); setCameraError(''); setModelState('loading'); setModal('');
    try {
      if (type === 'phone') {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Phone camera requires a secure HTTPS connection.');
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
        if(run!==cameraRun.current) {stream.getTracks().forEach(t=>t.stop());return;}
        streamRef.current=stream; if(videoRef.current) { videoRef.current.srcObject=stream; await videoRef.current.play(); }
      } else {
        const url=new URL(cameraUrl); if (!['http:','https:'].includes(url.protocol)) throw new Error('Enter a valid HTTP or HTTPS snapshot URL.');
        localStorage.setItem('vish-camera-url',url.href);
      }
      if (!sessionRef.current) sessionRef.current=await ort.InferenceSession.create('/models/yolov8n.onnx',{executionProviders:['wasm']});
      if(run!==cameraRun.current) return;
      setModelState('ready'); setCameraState('connected'); setSource(type); addEvent('Camera connected',type === 'phone' ? 'Phone camera is ready.' : 'ESP32-CAM snapshots are ready.','green');
      const canvas=document.createElement('canvas'); canvas.width=640; canvas.height=640; const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const tick=async () => {
        if (run!==cameraRun.current) return;
        try {
          let bitmap;
          if (type==='esp') {
            const url=new URL(cameraUrl); url.searchParams.set('_',Date.now());
            const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});
            if (!response.ok) throw new Error(`Camera returned ${response.status}`);
            const blob=await response.blob(); bitmap=await createImageBitmap(blob); ctx.drawImage(bitmap,0,0,640,640); bitmap.close();
            setLastFrame(URL.createObjectURL(blob));
          } else {
            if (!videoRef.current || videoRef.current.readyState<2) { setTimeout(tick,500); return; }
            ctx.drawImage(videoRef.current,0,0,640,640);
          }
          const pixels=ctx.getImageData(0,0,640,640).data, data=new Float32Array(3*640*640);
          for(let i=0;i<640*640;i++) {data[i]=pixels[i*4]/255;data[640*640+i]=pixels[i*4+1]/255;data[2*640*640+i]=pixels[i*4+2]/255;}
          const result=await sessionRef.current.run({images:new ort.Tensor('float32',data,[1,3,640,640])});
          if (run!==cameraRun.current) return;
          const found=decodeDetections(result.output0); setDetections(found);
          const notable=found.find(d=>d.w*d.h>.035 && ['person','bicycle','car','motorcycle','bus','truck','dog','chair','bench'].includes(d.label));
          if (notable) {
            const key=`${notable.label}-${position(notable)}`, now=Date.now();
            if (alertRef.current.key!==key || now-alertRef.current.time>12000) {
              alertRef.current={key,time:now}; const text=`${notable.label} ${position(notable)}`;
              addEvent('Object detected',text.charAt(0).toUpperCase()+text.slice(1),'amber');
              if(soundRef.current) speechRef.current?.(`Caution, ${text}.`);
            }
          }
          setTimeout(tick,350);
        } catch(error) {
          if(run!==cameraRun.current) return;
          setCameraState('error'); setCameraError(type==='esp' ? 'Could not read the camera. Check the URL, Wi-Fi, CORS and HTTPS mixed-content restrictions.' : `Camera stopped: ${error.message}`); setDetections([]); streamRef.current?.getTracks().forEach(t=>t.stop());
        }
      };
      tick();
    } catch(error) { if(run!==cameraRun.current) return; streamRef.current?.getTracks().forEach(t=>t.stop()); setCameraState('error'); setModelState('error'); setCameraError(error.message || 'Could not start camera.'); }
  },[cameraUrl,stopCamera,addEvent]);
  const voiceCommand = useCallback((text) => {
    if (/\b(?:start|connect|turn on) (?:the )?camera\b/i.test(text)) { startCamera('esp'); speechRef.current?.('Connecting the camera.'); return true; }
    if (/\b(?:stop|disconnect|turn off) (?:the )?camera\b/i.test(text)) { stopCamera(); speechRef.current?.('Camera disconnected.'); return true; }
    if (/\b(?:mute|turn off) (?:the )?(?:voice )?alerts\b/i.test(text)) { setSound(false); speechRef.current?.('Voice alerts muted.'); return true; }
    if (/\b(?:unmute|turn on) (?:the )?(?:voice )?alerts\b/i.test(text)) { setSound(true); speechRef.current?.('Voice alerts enabled.'); return true; }
    return false;
  }, [startCamera, stopCamera]);
  const voice = useVoice(routeTo,stopNavigation,voiceCommand); speechRef.current = voice.speak;
  useEffect(() => () => { if(lastFrame) URL.revokeObjectURL(lastFrame); },[lastFrame]);

  const steps=route?.legs?.flatMap(leg=>leg.steps) || [], currentStep=steps[stepIndex];
  const navItems=[{id:'overview',label:'Overview',icon:Activity},{id:'navigation',label:'Navigation',icon:Navigation2},{id:'vision',label:'Vision assist',icon:Eye},{id:'assistant',label:'Voice assistant',icon:AudioLines}];
  const showCamera = page==='overview' || page==='vision';
  const showMap = page==='overview' || page==='navigation';
  const goPage = id => {setPage(id);setMobileMenu(false);};
  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu?'sidebar-open':''}`}>
      <div className="sidebar-top"><Brand/><button className="mobile-close icon-button" aria-label="Close menu" onClick={()=>setMobileMenu(false)}><X size={20}/></button></div>
      <div className="sidebar-caption">YOUR COMPANION</div>
      <nav className="side-nav" aria-label="Main navigation">{navItems.map(item=><button key={item.id} className={`nav-item ${page===item.id?'active':''}`} onClick={()=>goPage(item.id)}><item.icon size={19}/><span>{item.label}</span>{page===item.id&&<span className="nav-active-dot"/>}</button>)}</nav>
      <div className="sidebar-divider"/>
      <div className="sidebar-caption">PREFERENCES</div>
      <button className="nav-item" onClick={()=>{setModal('settings');setMobileMenu(false);}}><Settings2 size={19}/><span>Settings</span></button>
      <button className="nav-item" onClick={()=>{setModal('help');setMobileMenu(false);}}><CircleHelp size={19}/><span>Help &amp; setup</span></button>
      <div className="sidebar-bottom"><div className="side-help-icon"><Heart size={18}/></div><div><strong>Made for your journey</strong><p>A little more confidence,<br/>every step of the way.</p></div></div>
      <div className="side-footer"><span>VISH GUIDE</span><span>VERSION 1.0</span></div>
    </aside>
    {mobileMenu && <div className="sidebar-scrim" onClick={()=>setMobileMenu(false)}/>}
    <main className="main-content">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Open menu" onClick={()=>setMobileMenu(true)}><Menu size={22}/></button><span className="breadcrumb">YOUR SPACE</span><ChevronRight size={14}/><span>{navItems.find(x=>x.id===page)?.label}</span></div><div className="topbar-right"><span className="top-privacy"><ShieldCheck size={16}/> Made with care</span><button className="top-help" onClick={()=>setModal('help')}><CircleHelp size={18}/><span>Help</span></button><div className="avatar">V</div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR EVERYDAY COMPANION</div><h1>{page==='overview'?'A little more freedom,':page==='navigation'?'Find your way,':page==='vision'?'See what’s ahead,':'Just say the word,'}<br/><span>{page==='overview'?'every step of the way.':page==='navigation'?'one step at a time.':page==='vision'?'with a little help.':'Vish is listening.'}</span></h1><p className="intro">{page==='overview'?'Meet Vish, your companion for a more confident journey.':page==='navigation'?'Plan a route and get spoken directions along the way.':page==='vision'?'Connect a camera to get on-device object alerts.':'Use your voice to find a destination and start navigating.'}</p></div><div className="welcome-badge"><span className="badge-spark"><Sparkles size={17}/></span><span>HERE FOR YOU<br/><strong>Every step of the way</strong></span></div></div>
        <div className="safety-note"><Info size={16}/><span><strong>A little reminder:</strong> Vish is a prototype, not a safety device. Always use your usual mobility aids and verify your surroundings and route.</span></div>
        <div className="section-heading"><div><span className="section-kicker">YOUR DASHBOARD</span><h2>{page==='overview'?'Everything you need, in one place':page==='navigation'?'Where are we going?':page==='vision'?'Your vision assistant':'Your voice assistant'}</h2></div><span className="date-label">{new Intl.DateTimeFormat('en',{weekday:'long',month:'short',day:'numeric'}).format(new Date())}</span></div>
        <div className={`dashboard-grid ${page!=='overview'?'focused-grid':''}`}>
          <div className="primary-column">
            {<section hidden={!showCamera} className="card camera-card" aria-labelledby="vision-heading"><div className="card-header"><div className="card-title"><IconBox icon={Eye} className="mint"/><div><div className="card-heading-line"><h3 id="vision-heading">Vision assist</h3><span className="soft-tag">YOUR EYES AHEAD</span></div><p>Know what’s around you, in real time.</p></div></div><button className="text-link" onClick={()=>setModal('camera')}>{cameraState==='connected'?'Camera settings':'Connect camera'} <ArrowUpRight size={15}/></button></div>
              <div className="camera-view"><img className={`preview-image ${lastFrame?'live-frame':''}`} src={lastFrame || '/images/path-preview.webp'} alt={lastFrame?'Live ESP32 camera frame':'Illustrative walking path; camera is not connected'}/><video ref={videoRef} className={source==='phone'&&cameraState==='connected'?'phone-video visible':'phone-video'} muted playsInline/><div className="camera-shade"/><div className="camera-top"><span className={`camera-pill ${cameraState==='connected'?'live':''}`}><span/> {cameraState==='connected'?'LIVE CAMERA':cameraState==='connecting'?'CONNECTING':'PREVIEW IMAGE'}</span><span className="camera-corner"><Crosshair size={17}/></span></div>
                {cameraState==='connected'&&detections.map((d,i)=><div key={`${d.cls}-${i}`} className="detection-box" style={{left:`${Math.max(0,d.x)*100}%`,top:`${Math.max(0,d.y)*100}%`,width:`${Math.min(1-d.x,d.w)*100}%`,height:`${Math.min(1-d.y,d.h)*100}%`}}><span>{d.label} {Math.round(d.score*100)}%</span></div>)}
                <div className="camera-bottom"><div className="camera-status-icon"><Eye size={20}/></div><div><strong>{cameraState==='connected'?'Vision assist is active':cameraState==='connecting'?'Getting things ready…':'Your view starts here'}</strong><p>{cameraState==='connected'?`${detections.length} object${detections.length===1?'':'s'} detected · processed on this device`:'Connect a camera to see your surroundings.'}</p></div><button className="camera-action" onClick={()=>cameraState==='connected'?stopCamera():setModal('camera')}>{cameraState==='connected'?<><Square size={13} fill="currentColor"/> Stop</>:<>Connect <ArrowRight size={15}/></>}</button></div></div>
              {cameraError&&<p className="inline-error">{cameraError}</p>}
              <div className="camera-footer"><div><span className={`status-dot ${cameraState==='connected'?'green':''}`}/>{cameraState==='connected'?'Camera connected':'Camera not connected'}</div><div><ShieldCheck size={15}/> Detection on-device</div><button onClick={()=>setModal('help')}>How it works <ArrowRight size={14}/></button></div>
            </section>}
            {showMap && <section className="card navigation-card" aria-labelledby="navigation-heading"><div className="card-header"><div className="card-title"><IconBox icon={Navigation2} className="peach"/><div><div className="card-heading-line"><h3 id="navigation-heading">Navigation</h3><span className="soft-tag peach-tag">LET’S GO</span></div><p>A little guidance for wherever you’re headed.</p></div></div><button className="text-link" onClick={()=>{goPage('navigation');startLocation();}}>Open map <ArrowUpRight size={15}/></button></div>
              <div className="nav-layout"><div className="nav-controls"><label htmlFor="destination">WHERE WOULD YOU LIKE TO GO?</label><form className="search-form" onSubmit={e=>{e.preventDefault();startLocation();routeTo(query);}}><Search size={19}/><input id="destination" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search for a destination"/><button aria-label="Find route" type="submit" disabled={navStatus==='loading'}><ArrowRight size={19}/></button></form>
                {navError&&<p className="inline-error">{navError}</p>}{locationError&&<p className="inline-error">{locationError}</p>}
                {route && currentStep ? <div className="route-result"><div className="route-destination"><Navigation size={18}/><div><strong>{destination?.name}</strong><p>{formatDistance(route.distance)} · about {Math.max(1,Math.round(route.distance/80))} min walking estimate</p></div></div><div className="route-step"><span>NEXT DIRECTION</span><strong>{instruction(currentStep)}</strong><small>{formatDistance(currentStep.distance)} along this step</small></div><button className="outline-button" onClick={stopNavigation}><Square size={13}/> End navigation</button></div> : <div className="nav-hint"><span><MapPin size={18}/></span><div><strong>Your next adventure awaits</strong><p>Search for a place to get directions and start your journey.</p></div></div>}
                <button className="location-button" onClick={startLocation}><LocateFixed size={16}/> {location?'Location enabled':'Use my current location'}</button><p className="service-note">Maps, place search and routing require internet and share location with their providers. Routes may not be pedestrian-safe.</p></div>
                <div className="map-wrap"><MapView location={location} route={route} destination={destination}/>{!location&&!route&&<div className="map-label"><span><MapPin size={16}/></span><div><strong>Ready when you are</strong><small>Enable location to find your way</small></div></div>}</div></div>
            </section>}
            {page==='assistant'&&<section className="card assistant-page"><div className="assistant-hero-icon"><AudioLines size={32}/></div><span className="section-kicker">MEET YOUR ASSISTANT</span><h2>“Hey Vish, take me to…”</h2><p>Ask Vish for a destination, or say “Hey Vish” and tell it where you’d like to go. Voice recognition is only enabled when your browser supports on-device speech recognition.</p><button className="primary-button" onClick={()=>voice.status==='listening'?voice.stop():voice.start()}>{voice.status==='listening'?<MicOff size={18}/>:<Mic size={18}/>} {voice.status==='listening'?'Stop listening':'Enable voice assistant'}</button><p className="voice-status" role="status">{voice.message}</p><div className="example-commands"><strong>TRY SAYING</strong><span>“Hey Vish, take me to Marina Beach”</span><span>“Hey Vish, I need to go to the pharmacy”</span><span>“Hey Vish, stop navigation”</span><span>“Hey Vish, connect camera”</span></div></section>}
          </div>
          <div className="secondary-column">
            <section className="voice-card"><div className="voice-top"><div className="voice-symbol"><AudioLines size={23}/></div><span className="voice-label">VOICE ASSISTANT</span><Sparkles size={17}/></div><h3>Just say <em>“Hey Vish”</em></h3><p>Your hands-free companion is here to help you find your way.</p><button className="voice-button" onClick={()=>voice.status==='listening'?voice.stop():voice.start()} disabled={voice.status==='loading'}>{voice.status==='listening'?<MicOff size={17}/>:<Mic size={17}/>} {voice.status==='listening'?'Stop listening':voice.status==='loading'?'Setting up…':'Enable voice assistant'} <ArrowRight size={16}/></button><div className="voice-bottom"><span className={`status-dot ${voice.status==='listening'?'green':''}`}/><span>{voice.message}</span></div></section>
            <section className="card status-card"><div className="small-card-header"><div><span className="section-kicker">AT A GLANCE</span><h3>Device status</h3></div><button className="icon-button" aria-label="Device settings" onClick={()=>setModal('settings')}><Settings2 size={18}/></button></div><div className="status-list"><div className="status-row"><IconBox icon={Camera} className="pale"/><div><strong>ESP32 camera</strong><p>{cameraState==='connected'?(source==='phone'?'Phone camera connected':'Connected & ready'):cameraState==='connecting'?'Connecting…':'Not connected'}</p></div><span className={`status-chip ${cameraState==='connected'?'online':''}`}>{cameraState==='connected'?'Connected':'Offline'}</span></div><div className="status-row"><IconBox icon={MapPin} className="pale"/><div><strong>Location</strong><p>{location?'Location available':'Enable to navigate'}</p></div><span className={`status-chip ${location?'online':''}`}>{location?'Ready':'Off'}</span></div><div className="status-row"><IconBox icon={Volume2} className="pale"/><div><strong>Voice alerts</strong><p>{sound?'Ready to guide you':'Alerts muted'}</p></div><button className={`toggle ${sound?'on':''}`} role="switch" aria-checked={sound} aria-label="Voice alerts" onClick={()=>setSound(!sound)}><span/></button></div></div><button className="status-link" onClick={()=>setModal('settings')}>Manage settings <ArrowRight size={15}/></button></section>
            <section className="card activity-card"><div className="small-card-header"><div><span className="section-kicker">THE LATEST</span><h3>Recent activity</h3></div><span className="activity-icon"><Activity size={18}/></span></div>{events.length ? <div className="activity-list">{events.map(event=><div className="activity-row" key={event.id}><span className={`activity-dot ${event.kind}`}/><div><strong>{event.title}</strong><p>{event.description}</p></div><time>{event.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div>)}</div> : <div className="empty-activity"><div><Footprints size={21}/></div><strong>Your journey starts here</strong><p>Your recent alerts and activity will show up here.</p></div>}</section>
          </div>
        </div>
        <footer className="page-footer"><span>Made with <Heart size={13} fill="currentColor"/> for more independent journeys.</span><button onClick={()=>setModal('help')}>Need a hand? <strong>Visit help &amp; setup</strong> <ArrowRight size={14}/></button></footer>
      </div>
    </main>
    {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal('');}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><span className="section-kicker">VISH GUIDE</span><h2 id="modal-title">{modal==='camera'?'Connect your camera':modal==='settings'?'Your settings':'Help & setup'}</h2></div><button className="icon-button" aria-label="Close" onClick={()=>setModal('')}><X size={21}/></button></div>
      {modal==='camera'&&<><p className="modal-intro">Connect to your ESP32-CAM’s Wi-Fi on your phone, then enter its JPEG snapshot URL. Or try your phone’s camera.</p><label className="field-label" htmlFor="camera-url">ESP32-CAM SNAPSHOT URL</label><input className="modal-input" id="camera-url" value={cameraUrl} onChange={e=>setCameraUrl(e.target.value)} placeholder="http://192.168.4.1/capture"/><p className="field-hint">Use a JPEG endpoint such as /capture, not the MJPEG /stream URL. The camera must allow CORS.</p><button className="primary-button full" onClick={()=>startCamera('esp')}><Wifi size={18}/> Connect ESP32-CAM <ArrowRight size={17}/></button><div className="modal-or">OR</div><button className="outline-button full" onClick={()=>startCamera('phone')}><Camera size={18}/> Use phone camera</button><div className="modal-warning"><Info size={17}/><span>HTTPS pages can block an HTTP camera on a local IP. A secure camera endpoint or a compatible local deployment may be required. Camera Wi-Fi may not provide internet for maps.</span></div></>}
      {modal==='settings'&&<><div className="settings-row"><div><strong>Spoken alerts</strong><p>Hear object alerts and route directions.</p></div><button className={`toggle ${sound?'on':''}`} role="switch" aria-checked={sound} onClick={()=>setSound(!sound)} aria-label="Spoken alerts"><span/></button></div><div className="settings-row"><div><strong>Camera</strong><p>{cameraState==='connected'?'Connected':'Not connected'}</p></div><button className="outline-button" onClick={()=>setModal('camera')}>Configure</button></div><div className="settings-row"><div><strong>Location</strong><p>{location?'Enabled':'Not enabled'}</p></div><button className="outline-button" onClick={()=>{startLocation();setModal('');}}>Enable</button></div><div className="modal-warning"><ShieldCheck size={18}/><span>Object detection runs on your device. Online map services receive your search and location; spoken alerts require an English voice available locally on your device.</span></div></>}
      {modal==='help'&&<div className="help-content"><p>Vish is an experimental companion—not a substitute for a cane, guide dog, or safe navigation practices.</p><h4>1. Connect a camera</h4><p>Join the ESP32-CAM Wi-Fi network and enter its JPEG snapshot URL under Vision assist. The camera must send an <code>Access-Control-Allow-Origin</code> header. HTTPS browsers may block HTTP local camera requests. You can also use your phone camera.</p><h4>2. Plan your route</h4><p>Enable location and search for a destination. Place search, map tiles and routing need internet. The public routing service may return roads unsuitable for walking; always verify the route.</p><h4>3. Talk to Vish</h4><p>Enable voice assistant and allow microphone access. On supported browsers, say “Hey Vish, take me to Marina Beach.” On-device speech recognition and a downloaded language pack are required; otherwise use touch controls.</p><h4>4. Stay aware</h4><p>Object detection can miss obstacles, stairs, curbs and hazards. It does not measure distance. Voice and GPS may be delayed or inaccurate. Do not rely on this prototype for safety.</p></div>}
    </div></div>}
  </div>;
}
