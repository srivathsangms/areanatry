import { useCallback, useEffect, useRef, useState } from 'react';
import { extractDestination } from '../lib/navigation';

export default function useVoice(onDestination, onStop, onCommand) {
  const [status, setStatus] = useState('off');
  const [message, setMessage] = useState('Tap the microphone to enable voice');
  const recognition = useRef(null), active = useRef(false), awaiting = useRef(false), callbacks = useRef({onDestination,onStop,onCommand});
  callbacks.current = {onDestination,onStop,onCommand};
  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const localVoices = window.speechSynthesis.getVoices().filter(voice => voice.localService);
    const localVoice = localVoices.find(voice => /^en[-_]IN/i.test(voice.lang)) || localVoices.find(voice => /^en/i.test(voice.lang));
    if (!localVoice) { setMessage('No local English speech voice is available on this device.'); return; }
    const utterance = new SpeechSynthesisUtterance(text); utterance.voice = localVoice; utterance.rate = .95; utterance.lang = localVoice.lang;
    window.speechSynthesis.speak(utterance);
  }, []);
  const stop = useCallback(() => { active.current = false; recognition.current?.abort(); recognition.current = null; setStatus('off'); setMessage('Voice assistant is off'); }, []);
  const start = useCallback(async () => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech || !('processLocally' in Speech.prototype) || !Speech.available) {
      setStatus('error'); setMessage('On-device speech recognition is not available in this browser. Use touch controls instead.'); return;
    }
    try {
      setStatus('loading'); setMessage('Checking on-device speech recognition…');
      const options = { langs: ['en-US'], processLocally: true };
      const available = await Speech.available(options);
      if (available === 'unavailable') throw new Error('On-device English speech recognition is unavailable on this device.');
      if (available !== 'available') {
        if (!Speech.install || !(await Speech.install(options))) throw new Error('Could not install the on-device language pack.');
      }
      const r = new Speech(); recognition.current = r; r.lang = 'en-US'; r.continuous = true; r.interimResults = false; r.processLocally = true;
      r.onresult = event => {
        for (let i=event.resultIndex;i<event.results.length;i++) {
          if (!event.results[i].isFinal) continue;
          const text = event.results[i][0].transcript.trim();
          const wake = /\b(?:hey|hi)\s+(?:vish|wish|vishh)\b/i.test(text);
          if (wake || awaiting.current) {
            const destination = extractDestination(text) || (awaiting.current ? text.replace(/^(?:to|go to)\s+/i,'') : '');
            if (/stop navigation|end navigation/i.test(text)) { callbacks.current.onStop(); awaiting.current=false; speak('Navigation stopped.'); }
            else if (callbacks.current.onCommand?.(text)) { awaiting.current=false; }
            else if (destination) { awaiting.current=false; setMessage(`Looking for ${destination}`); callbacks.current.onDestination(destination); }
            else { awaiting.current=true; setMessage('Listening. Where would you like to go?'); speak('Where would you like to go?'); }
          }
        }
      };
      r.onerror = event => { if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'language-not-supported') { active.current=false; setStatus('error'); setMessage(`Voice unavailable: ${event.error}. Use touch controls.`); } };
      r.onend = () => { if (active.current) { try { r.start(); } catch { active.current=false; setStatus('error'); setMessage('Voice listening stopped. Tap to try again.'); } } };
      active.current=true; r.start(); setStatus('listening'); setMessage('Listening for “Hey Vish”');
    } catch (error) { active.current=false; setStatus('error'); setMessage(error.message || 'Unable to start voice recognition.'); }
  }, [speak]);
  useEffect(() => () => { active.current=false; recognition.current?.abort(); window.speechSynthesis?.cancel(); }, []);
  return {status,message,start,stop,speak};
}
