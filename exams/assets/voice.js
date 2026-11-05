// ZICA Pune Portal · microphone during exams
// Listens for speech on the student's own device (nothing is sent while it is quiet).
// When someone talks for ~2 s — the student, another person, or a phone/AI voice assistant —
// it saves the last few seconds of sound plus a 15-second video+sound clip and shows a red REC badge.
// The student always sees the mic badge and the REC badge. Everything is wrapped: a failure here never affects the paper.

const pick = (list) => { try { return list.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || ''; } catch { return ''; } };

// level meter + speech detector. opts: onSpeech(info), onLevel(0..1), paused() → true while the Academic Head is talking
export function voiceWatch(stream, { onSpeech, onLevel, paused = () => false, cooldown = 25000 } = {}) {
  const tr = stream?.getAudioTracks?.()[0];
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!tr || !AC) return { stop() {}, resume() {}, ok: false };
  let ctx;
  try { ctx = new AC(); } catch { return { stop() {}, resume() {}, ok: false }; }
  const src = ctx.createMediaStreamSource(new MediaStream([tr]));
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
  const an = ctx.createAnalyser(); an.fftSize = 2048;
  src.connect(hp); hp.connect(lp); lp.connect(an);
  const buf = new Float32Array(an.fftSize);
  let floor = 0.003, hist = [], last = Date.now() - cooldown + 8000, quietTill = 0;
  const t = setInterval(() => {
    if (ctx.state !== 'running') return;
    an.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const rms = Math.sqrt(s / buf.length);
    onLevel && onLevel(Math.min(1, rms * 18));
    const loud = rms > Math.max(floor * 3.2, 0.012);
    floor = loud ? floor * 0.999 + rms * 0.001 : floor * 0.97 + rms * 0.03;   // follows fans / room hum
    if (paused()) { quietTill = Date.now() + 3000; hist = []; return; }
    if (Date.now() < quietTill) return;
    hist.push(loud ? 1 : 0); if (hist.length > 25) hist.shift();          // last 2.5 s
    const share = hist.reduce((a, b) => a + b, 0) / hist.length;
    if (hist.length >= 20 && share >= 0.5 && Date.now() - last > cooldown) {
      last = Date.now(); hist = [];
      try { onSpeech && onSpeech({ level: Math.round(rms * 1000) / 1000, share: Math.round(share * 100) / 100 }); } catch (e) { console.warn(e); }
    }
  }, 100);
  const resume = () => { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); };
  ['pointerdown', 'keydown', 'touchstart'].forEach((e) => document.addEventListener(e, resume, { passive: true }));
  resume();
  return {
    ok: true, resume,
    stop() { clearInterval(t); ['pointerdown', 'keydown', 'touchstart'].forEach((e) => document.removeEventListener(e, resume)); try { ctx.close(); } catch {} },
  };
}

// keeps the last ~8 s of sound in memory (pre-roll) and records a 15 s video+sound clip on demand
export function clipper(stream, { onClip, onRec, avSecs = 15 } = {}) {
  const AT = pick(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']);
  const VT = pick(['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']);
  const at = stream?.getAudioTracks?.()[0];
  if (!at || !window.MediaRecorder) return { fire() { return false; }, stop() {}, ok: false };
  const audio = new MediaStream([at]);
  let roll = null, prev = null, stopped = false, busy = false;

  const startRoll = () => {
    if (stopped || !AT) return;
    let rec; try { rec = new MediaRecorder(audio, { mimeType: AT, audioBitsPerSecond: 24000 }); } catch { return; }
    const seg = { rec, parts: [], t0: Date.now(), want: null };
    rec.ondataavailable = (e) => { if (e.data && e.data.size) seg.parts.push(e.data); };
    rec.onstop = () => { seg.blob = new Blob(seg.parts, { type: AT }); seg.t1 = Date.now(); if (seg.want) seg.want(seg); else prev = seg; };
    try { rec.start(); } catch { return; }
    roll = seg;
    seg.timer = setTimeout(() => { if (roll === seg && rec.state !== 'inactive') { rec.stop(); startRoll(); } }, 8000);
  };
  startRoll();

  const emit = (blob, kind, secs, meta) => { if (blob && blob.size > 1500) { try { onClip && onClip({ blob, kind, secs: Math.round(secs * 10) / 10, ...meta }); } catch (e) { console.warn(e); } } };

  // returns false when a clip is already being recorded
  const fire = (meta = {}) => {
    if (stopped || busy) return false;
    busy = true;
    // 1) sound from just before the trigger
    const seg = roll, before = prev;
    if (seg && seg.rec.state !== 'inactive') {
      clearTimeout(seg.timer);
      seg.want = (s) => {
        const len = (s.t1 - s.t0) / 1000;
        if (len < 4 && before?.blob) emit(before.blob, 'pre', (before.t1 - before.t0) / 1000, meta);
        emit(s.blob, 'pre', len, meta);
        prev = null;
      };
      try { seg.rec.stop(); } catch {}
      startRoll();
    }
    // 2) 15 s of video + sound from now
    let rec = null;
    try { if (VT) rec = new MediaRecorder(stream, { mimeType: VT, videoBitsPerSecond: 140000, audioBitsPerSecond: 24000 }); } catch { rec = null; }
    if (!rec) { busy = false; return true; }
    const parts = [], t0 = Date.now();
    rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
    rec.onstop = () => { onRec && onRec(false); busy = false; emit(new Blob(parts, { type: VT }), 'av', (Date.now() - t0) / 1000, meta); };
    try { rec.start(1000); onRec && onRec(true); } catch { busy = false; return true; }
    setTimeout(() => { try { if (rec.state !== 'inactive') rec.stop(); } catch {} }, avSecs * 1000);
    return true;
  };
  const stop = () => { stopped = true; try { if (roll && roll.rec.state !== 'inactive') { clearTimeout(roll.timer); roll.want = () => {}; roll.rec.stop(); } } catch {} };
  return { fire, stop, ok: true };
}

// upload one clip to the private bucket, then register it (3 tries)
export async function uploadClip(sb, api, attemptId, c) {
  const ext = /mp4/.test(c.blob.type) ? (c.kind === 'av' ? 'mp4' : 'm4a') : 'webm';
  const path = `${attemptId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${c.kind}-q${c.q || 0}.${ext}`;
  if (c.blob.size > 1500000) return false;
  for (let i = 0; i < 3; i++) {
    try {
      const { error } = await sb.storage.from('exam-clips').upload(path, c.blob, { contentType: c.blob.type.split(';')[0], upsert: false });
      if (error) throw error;
      await api('exam_voice', { p_attempt: attemptId, p_q: c.q || null, p_path: path, p_kind: c.kind, p_secs: c.secs, p_bytes: c.blob.size, p_level: null });
      return true;
    } catch (e) { await new Promise((r) => setTimeout(r, 3000 * (i + 1))); }
  }
  return false;
}
