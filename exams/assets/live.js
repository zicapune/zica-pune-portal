// ZICA Pune Portal · live camera wall (peer-to-peer WebRTC; Supabase Realtime only carries the small setup messages)
// The exam itself never depends on this file: every call is wrapped so a failure here cannot affect the paper.
import { sb } from './common.js?v=15';

const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };
const uid = () => Math.random().toString(36).slice(2, 10);

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
export function studentLive(key, getStream, onTalk) {
  if (!key || !window.RTCPeerConnection) return () => {};
  const me = uid(), peers = {};
  let ch;
  const onMsg = async (m) => {
    if (!m || m.to && m.to !== me) return;
    if (m.t === 'who') return ch.send({ t: 'here', from: me });
    if (m.t === 'talk') return onTalk && onTalk(!!m.on);
    if (m.t === 'offer') {
      peers[m.from]?.close();
      if (Object.keys(peers).length >= 3) return;             // at most 3 admin screens watching
      const pc = new RTCPeerConnection(ICE); peers[m.from] = pc;
      pc.onicecandidate = (e) => e.candidate && ch.send({ t: 'ice', to: m.from, from: me, c: e.candidate });
      pc.ontrack = (e) => { if (e.track.kind !== 'audio') return; let a = document.getElementById('zlAudio');
        if (!a) { a = document.createElement('audio'); a.id = 'zlAudio'; a.autoplay = true; document.body.appendChild(a); }
        a.srcObject = new MediaStream([e.track]); a.play().catch(() => {}); };
      pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) { pc.close(); delete peers[m.from]; } };
      await pc.setRemoteDescription(m.sdp);
      const st = getStream(); const vt = st && st.getVideoTracks()[0];
      if (vt) {
        const snd = pc.addTrack(vt, st);
        try { const p = snd.getParameters(); p.encodings = [{ maxBitrate: 160000, scaleResolutionDownBy: 2, maxFramerate: 12 }]; await snd.setParameters(p); } catch {}
      }
      await pc.setLocalDescription(await pc.createAnswer());
      return ch.send({ t: 'answer', to: m.from, from: me, sdp: pc.localDescription });
    }
    if (m.t === 'ice' && peers[m.from]) { try { await peers[m.from].addIceCandidate(m.c); } catch {} }
    if (m.t === 'bye' && peers[m.from]) { peers[m.from].close(); delete peers[m.from]; }
  };
  try { ch = channel(key, onMsg); ch.ready.then(() => ch.send({ t: 'here', from: me })); } catch { return () => {}; }
  return () => { Object.values(peers).forEach((p) => p.close()); try { ch.close(); } catch {} };
}

// ---------------------------------------------------------------- admin side
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
  const watch = (item) => {
    if (conns[item.key]) return;
    const c = conns[item.key] = { item, pc: null, peer: null, talking: false, clone: null };
    const offer = async (peer) => {
      c.pc?.close(); c.peer = peer;
      const pc = c.pc = new RTCPeerConnection(ICE);
      pc.addTransceiver('video', { direction: 'recvonly' });
      const at = pc.addTransceiver('audio', { direction: 'sendrecv' });
      c.addMic = () => { if (!mic) return; c.clone = mic.getAudioTracks()[0].clone(); c.clone.enabled = c.talking; at.sender.replaceTrack(c.clone).catch(() => {}); };
      c.addMic();
      pc.ontrack = (e) => { if (e.track.kind === 'video') onTile(item.key, { stream: new MediaStream([e.track]), state: 'live' }); };
      pc.onicecandidate = (e) => e.candidate && c.ch.send({ t: 'ice', to: peer, from: me, c: e.candidate });
      pc.onconnectionstatechange = () => onTile(item.key, { state: pc.connectionState });
      await pc.setLocalDescription(await pc.createOffer());
      c.ch.send({ t: 'offer', to: peer, from: me, sdp: pc.localDescription });
    };
    c.ch = channel(item.key, async (m) => {
      if (!m || m.to && m.to !== me) return;
      if (m.t === 'here') return offer(m.from);
      if (m.t === 'answer' && c.pc && m.from === c.peer) { try { await c.pc.setRemoteDescription(m.sdp); } catch {} }
      if (m.t === 'ice' && c.pc && m.from === c.peer) { try { await c.pc.addIceCandidate(m.c); } catch {} }
    });
    c.ch.ready.then(() => c.ch.send({ t: 'who', from: me }));
    onTile(item.key, { state: 'connecting' });
  };
  const talk = async (key, on) => {
    try { await ensureMic(); } catch { return false; }
    const list = key ? [conns[key]].filter(Boolean) : Object.values(conns);
    list.forEach((c) => { c.talking = on; if (c.clone) c.clone.enabled = on; c.ch.send({ t: 'talk', on }); });
    return true;
  };
  const drop = (key) => { const c = conns[key]; if (!c) return; try { c.ch.send({ t: 'bye', from: me }); c.pc?.close(); c.ch.close(); } catch {} delete conns[key]; };
  const stop = () => { Object.keys(conns).forEach(drop); mic?.getTracks().forEach((t) => t.stop()); mic = null; };
  const retry = (key) => { const c = conns[key]; if (c) c.ch.send({ t: 'who', from: me }); };
  return { watch, talk, drop, stop, retry, keys: () => Object.keys(conns) };
}
