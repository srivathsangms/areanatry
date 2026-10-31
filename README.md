# Vish — walking companion prototype

A mobile-first, installable web app exploring camera-based object alerts, route guidance, and a “Hey Vish” assistant. This is a **prototype, not a safety device**. Object recognition does not measure distance and can miss stairs, curbs, obstacles and other hazards. GPS and directions may be inaccurate or delayed. Continue using appropriate mobility aids and independently verify all routes and surroundings.

## Run locally

```sh
npm install
npm run dev
```

For production: `npm run build` and `npm run preview`. Open the app on a phone using an HTTPS deployment (or localhost for development). Camera, microphone, location, and service workers require a secure context. Install the app using the browser's Add to Home Screen option. The app shell is cached; the YOLO model and WASM runtime are cached after first use. The first load needs network access.

## Camera and object detection

- Connect the phone to the ESP32-CAM access point and enter its **JPEG snapshot** URL (for example `http://192.168.4.1/capture`) in Vision assist. This app repeatedly fetches JPEG snapshots; an MJPEG `/stream` endpoint is not supported. A phone camera is also available for testing.
- `firmware/VishCamera/VishCamera.ino` is an example for the AI Thinker ESP32-CAM with Arduino ESP32 core 3.x. Set a unique AP password, select the correct board and upload it. It serves `/capture` with CORS headers. Other ESP32 camera servers must allow cross-origin requests as well.
- **Important browser limitation:** an HTTPS page may block HTTP requests to a private camera address (mixed content / local network access). CORS headers alone cannot override browser security. A compatible HTTPS camera endpoint or deployment arrangement is needed; this cannot be guaranteed by a web app. Do not disable browser security for real use. ESP32 Wi-Fi may not provide internet, and some phones will not retain mobile data while connected to it.
- Frames are processed in the browser using ONNX Runtime Web and the included YOLOv8n model. No video is uploaded by the app. Alerts are heuristic object labels and relative image positions, not collision or distance estimates. Model performance and battery usage vary by phone.

## Navigation and voice

- Location permission and internet are needed for online OpenStreetMap tiles, Nominatim search, and the public OSRM demo router. The search query and location are sent to these providers. **The public demo router is not a verified pedestrian routing service** and may return roads unsuitable for walking. Approximate walking time is estimated from route distance, not from a pedestrian routing engine. The app gives basic GPS-triggered step announcements; it does not reroute automatically or guarantee accessible routes.
- Explicitly enable the voice assistant. It requests **on-device-only** browser speech recognition and can install the browser's English language pack. On browsers without that API, voice recognition is unavailable and touch controls remain available. “Hey Vish, take me to Marina Beach”, “Hey Vish, stop navigation”, “Hey Vish, connect camera” and “Hey Vish, mute alerts” are supported. Recognition may stop when the browser is backgrounded. Spoken output uses only a local English voice, when available.
- The browser may pause the app in the background, revoke permissions, or limit network access. Always keep the app foregrounded and do not depend on it for safety.

## Development

`npm test` runs the navigation helper tests. `npm run build` verifies the production bundle. The included `public/models/yolov8n.onnx` comes from [yoobright/yolo-onnx](https://github.com/yoobright/yolo-onnx) (YOLOv8 model; check Ultralytics model licensing and upstream terms before redistribution or commercial use). OpenStreetMap data © OpenStreetMap contributors. Public service usage is subject to each provider's policy; use appropriately provisioned services in a production deployment.
