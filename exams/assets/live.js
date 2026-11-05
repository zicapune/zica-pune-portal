// ZICA Pune Portal · live camera wall
// Video + sound go from the student's device to the admin screen (peer-to-peer). When a network blocks that,
// a free relay carries it; if even that fails, the tile shows a camera photo every 10 seconds instead.
// The exam itself never depends on this file: every call is wrapped so a failure here cannot affect the paper.
import { sb } from './common.js?v=17';

const uid = () => Math.random().toString(36).slice(2, 10);

// free relay (Open Relay Project, shared-secret login). Short-lived password made in the browser.
const RELAY = { host: 'staticauth.openrelay.metered.ca', secret: 'openrelayprojectsecret' };
let ICE_P = null;
function ice() {
  if (ICE_P) return ICE_P;
  ICE_P = (async () => {
    const base = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
    try {
      const username = `${Math.floor(Date.now() / 1000) + 6 * 3600}:zica`;
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(RELAY.secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(username));
      const credential = btoa(String.fromCharCode(...new Uint8Array(sig)));
      const h = RELAY.host;
      base.push({ urls: [`turn:${h}:80`, `turn:${h}:80?transport=tcp`, `turn:${h}:443`, `turns:${h}:443?transport=tcp`], username, credential });
    } catch (e) { console.warn('relay unavailable', e); }
    return { iceServers: base };
  })();
  return ICE_P;
}

// one private channel per running exam; the key is known only to that student and the admins
function channel(key, onMsg) {
  const topic = 'zl-' + key;
  if (window.__sigSend) {                                    // test harness relay
    (window.__sigSubs = window.__sigSubs || {})[topic] = onMsg;
    return { send: (m) => window.__sigSend(topic, m), close: () => delete window.__sigSubs[topic], ready: Promise.resolve() };
  }
  const ch = sb.channel(topic, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'm' }, ({ payload }) => { try { onMsg(payload); } catch (e) { console.warn(e); } });
  const ready = new Promise((res) => ch.subscribe((st) => { if (st === 'SUBSCRIBED') res(); }));
  return { send: (m) => ch.send({ type: 'broadcast', event: 'm', payload: m }).catch(() => {}), close: () => sb.removeChannel(ch), ready };
}

// ---------------------------------------------------------------- student side
// getStream(): camera+mic stream · getSnap(): small jpeg data-url · onTalk(on) · onWatch(n viewers)
export function studentLive(key, getStream, onTalk, opt = {}) {
  if (!key) return () => {};
  const me = uid(), peers = {};
  let ch, snapAsk = 0, snapT = null;
  const watchers = () => opt.onWatch && opt.onWatch(Object.values(peers).filter((p) => p.connectionState === 'connected').length + (Date.now() - snapAsk < 35000 ? 1 : 0));
  const sendSnap = () => {
    if (Date.now() - snapAsk > 35000) { clearInterval(snapT); snapT = null; watchers(); return; }
    try { const img = opt.getSnap && opt.getSnap(); if (img) ch.send({ t: 'snap', from: me, img }); } catch {}
  };
  const onMsg = async (m) => {
    if (!m || m.to && m.to !== me) return;
    if (m.t === 'who') return ch.send({ t: 'here', from: me });
    if (m.t === 'talk') return onTalk && onTalk(!!m.on);
    if (m.t === 'snapreq') { const first = Date.now() - snapAsk > 35000; snapAsk = Date.now(); if (!snapT) { snapT = setInterval(sendSnap, 10000); } if (first) { sendSnap(); watchers(); } return; }
    if (m.t === 'offer' && window.RTCPeerConnection) {
      peers[m.from]?.close();
      if (Object.keys(peers).length >= 3) return;             // at most 3 admin screens watching
      const pc = new RTCPeerConnection(await ice()); peers[m.from] = pc;
      pc.onicecandidate = (e) => e.candidate && ch.send({ t: 'ice', to: m.from, from: me, c: e.candidate });
      pc.ontrack = (e) => { if (e.track.kind !== 'audio') return; let a = document.getElementById('zlAudio');
        if (!a) { a = document.createElement('audio'); a.id = 'zlAudio'; a.autoplay = true; document.body.appendChild(a); }
        a.srcObject = new MediaStream([e.track]); a.play().catch(() => {}); };
      pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) { pc.close(); delete peers[m.from]; } watchers(); };
      await pc.setRemoteDescription(m.sdp);
      const st = getStream();
      const vt = st && st.getVideoTracks()[0], at = st && st.getAudioTracks()[0];
      if (vt) {
        const snd = pc.addTrack(vt, st);
        try { const p = snd.getParameters(); p.encodings = [{ maxBitrate: 160000, scaleResolutionDownBy: 2, maxFramerate: 12 }]; await snd.setParameters(p); } catch {}
      }
      if (at) { try { const snd = pc.addTrack(at, st); const p = snd.getParameters(); p.encodings = [{ maxBitrate: 24000 }]; await snd.setParameters(p).catch(() => {}); } catch {} }
      await pc.setLocalDescription(await pc.createAnswer());
      return ch.send({ t: 'answer', to: m.from, from: me, sdp: pc.localDescription });
    }
    if (m.t === 'ice' && peers[m.from]) { try { await peers[m.from].addIceCandidate(m.c); } catch {} }
    if (m.t === 'bye' && peers[m.from]) { peers[m.from].close(); delete peers[m.from]; watchers(); }
  };
  try { ch = channel(key, onMsg); ch.ready.then(() => ch.send({ t: 'here', from: me })); } catch { return () => {}; }
  return () => { clearInterval(snapT); Object.values(peers).forEach((p) => p.close()); try { ch.close(); } catch {} };
}

// ---------------------------------------------------------------- admin side
// onTile(key, {state | stream | audio | photo})
export function adminLive(onTile) {
  const me = uid(), conns = {};
  let mic = null;
  const ensureMic = async () => {
    if (mic) return mic;
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    mic.getAudioTracks().forEach((t) => (t.enabled = false));
    Object.values(conns).forEach((c) => c.addMic && c.addMic());
    return mic;
  };
  // photo mode: ask the student for a picture every 10 s while video is not coming through
  const photoMode = (c, on) => {
    if (on && !c.photoT) {
      const ask = () => c.ch.send({ t: 'snapreq', from: me });
      ask(); c.photoT = setInterval(ask, 15000);
      onTile(c.item.key, { state: 'photo' });
    }
    if (!on && c.photoT) { clearInterval(c.photoT); c.photoT = null; }
  };
  const watch = (item) => {
    if (conns[item.key]) return;
    const c = conns[item.key] = { item, pc: null, peer: null, talking: false, clone: null, tries: 0, photoT: null, live: false };
    const offer = async (peer) => {
      if (!window.RTCPeerConnection) return photoMode(c, true);
      c.pc?.close(); c.peer = peer; c.live = false;
      const pc = c.pc = new RTCPeerConnection(await ice());
      pc.addTransceiver('video', { direction: 'recvonly' });
      const at = pc.addTransceiver('audio', { direction: 'sendrecv' });
      c.addMic = () => { if (!mic) return; c.clone = mic.getAudioTracks()[0].clone(); c.clone.enabled = c.talking; at.sender.replaceTrack(c.clone).catch(() => {}); };
      c.addMic();
      pc.ontrack = (e) => {
        if (e.track.kind === 'video') onTile(item.key, { stream: new MediaStream([e.track]), state: 'live' });
        if (e.track.kind === 'audio') onTile(item.key, { audio: new MediaStream([e.track]) });
      };
      pc.onicecandidate = (e) => e.candidate && c.ch.send({ t: 'ice', to: peer, from: me, c: e.candidate });
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === 'connected') { c.live = true; c.tries = 0; photoMode(c, false); }
        if (s === 'failed') { c.live = false; if (c.tries++ < 1) { setTimeout(() => c.ch.send({ t: 'who', from: me }), 1500); onTile(item.key, { state: 'connecting' }); return; } photoMode(c, true); return; }
        if (!c.photoT) onTile(item.key, { state: s });
      };
      await pc.setLocalDescription(await pc.createOffer());
      c.ch.send({ t: 'offer', to: peer, from: me, sdp: pc.localDescription });
    };
    c.ch = channel(item.key, async (m) => {
      if (!m || m.to && m.to !== me) return;
      if (m.t === 'here') return offer(m.from);
      if (m.t === 'snap' && m.img && !c.live) return onTile(item.key, { photo: m.img, state: 'photo' });
      if (m.t === 'answer' && c.pc && m.from === c.peer) { try { await c.pc.setRemoteDescription(m.sdp); } catch {} }
      if (m.t === 'ice' && c.pc && m.from === c.peer) { try { await c.pc.addIceCandidate(m.c); } catch {} }
    });
    c.ch.ready.then(() => c.ch.send({ t: 'who', from: me }));
    // nothing after 20 s (student on an old page, or setup blocked) → photos instead
    c.guard = setTimeout(() => { if (!c.live) photoMode(c, true); }, 20000);
    onTile(item.key, { state: 'connecting' });
  };
  const talk = async (key, on) => {
    try { await ensureMic(); } catch { return false; }
    const list = key ? [conns[key]].filter(Boolean) : Object.values(conns);
    list.forEach((c) => { c.talking = on; if (c.clone) c.clone.enabled = on; c.ch.send({ t: 'talk', on }); });
    return true;
  };
  const drop = (key) => { const c = conns[key]; if (!c) return; try { clearTimeout(c.guard); photoMode(c, false); c.ch.send({ t: 'bye', from: me }); c.pc?.close(); c.ch.close(); } catch {} delete conns[key]; };
  const stop = () => { Object.keys(conns).forEach(drop); mic?.getTracks().forEach((t) => t.stop()); mic = null; };
  const retry = (key) => { const c = conns[key]; if (!c) return; c.tries = 0; c.ch.send({ t: 'who', from: me }); c.ch.send({ t: 'snapreq', from: me }); };
  return { watch, talk, drop, stop, retry, keys: () => Object.keys(conns) };
}
