// Camera + face presence + snapshots
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

export class Cam {
  constructor() { this.stream = null; this.video = null; this.det = null; this.detTried = false; this.lost = false; this.handlers = {}; }
  on(ev, fn) { this.handlers[ev] = fn; return this; }
  emit(ev, x) { this.handlers[ev]?.(x); }

  static supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

  async start(video) {
    this.video = video;
    if (!this.stream || !this.stream.active) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
      });
      const tr = this.stream.getVideoTracks()[0];
      tr.addEventListener('ended', () => { this.lost = true; this.emit('lost', 'ended'); });
      tr.addEventListener('mute', () => { this.lost = true; this.emit('lost', 'muted'); });
      tr.addEventListener('unmute', () => { this.lost = false; this.emit('back'); });
    }
    video.srcObject = this.stream;
    video.muted = true; video.playsInline = true; video.setAttribute('playsinline', '');
    await video.play().catch(() => {});
    this.lost = false;
    return this.stream;
  }

  attach(video) { if (this.stream) { video.srcObject = this.stream; video.muted = true; video.setAttribute('playsinline', ''); video.play().catch(() => {}); } }

  alive() {
    const tr = this.stream?.getVideoTracks()[0];
    return !!(tr && tr.readyState === 'live' && tr.enabled && !tr.muted);
  }

  async loadDetector() {
    if (this.detTried) return !!this.det;
    this.detTried = true;
    try {
      const vision = await import(`${MP}/vision_bundle.mjs`);
      const fs = await vision.FilesetResolver.forVisionTasks(`${MP}/wasm`);
      this.det = await vision.FaceDetector.createFromOptions(fs, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' }, runningMode: 'VIDEO', minDetectionConfidence: 0.55,
      });
    } catch (e) { console.warn('face detector unavailable', e); this.det = null; }
    return !!this.det;
  }

  // returns number of faces, or -1 if detection unavailable
  faces() {
    if (!this.det || !this.video || this.video.readyState < 2) return -1;
    try {
      const r = this.det.detectForVideo(this.video, performance.now());
      return r.detections.filter((d) => (d.categories?.[0]?.score ?? 1) > 0.55).length;
    } catch { return -1; }
  }

  snapshot(w = 320, q = 0.6) {
    const v = this.video;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = Math.round((v.videoHeight / v.videoWidth) * w);
    const g = c.getContext('2d');
    g.drawImage(v, 0, 0, c.width, c.height);
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, c.height - 16, c.width, 16);
    g.fillStyle = '#fff'; g.font = '10px sans-serif';
    g.fillText(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), 4, c.height - 4);
    return c.toDataURL('image/jpeg', q);
  }

  stop() { this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null; }
}

// Face watcher: emits 'noface' after `noFaceMs`, 'multi' after `multiMs`
export function watchFaces(cam, { onState, onNoFace, onMulti, noFaceMs = 8000, multiMs = 4000, every = 1500 }) {
  // a still-missing face re-fires every 45 s; a returning face resets everything
  let noSince = 0, multiSince = 0;
  const t = setInterval(() => {
    if (document.hidden) return;
    const n = cam.faces();
    const now = Date.now();
    onState?.(n);
    if (n === -1) return;
    if (n === 0) {
      noSince ||= now;
      if (now - noSince > noFaceMs) { onNoFace?.(); noSince = now + 45000 - noFaceMs; }
    } else noSince = 0;
    if (n >= 2) {
      multiSince ||= now;
      if (now - multiSince > multiMs) { onMulti?.(n); multiSince = now + 45000 - multiMs; }
    } else multiSince = 0;
  }, every);
  return () => clearInterval(t);
}
