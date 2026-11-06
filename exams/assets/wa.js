// ZICA Pune Portal · WhatsApp drafts (side panel: edit → open WhatsApp with the text filled in, or copy)
// WhatsApp does not let a website open a particular group directly — it opens the chat chooser with the text ready;
// you tap the group and press send.
import { esc, toast } from './common.js?v=20';
import { dShort, dDay, tm, idc } from './docs.js?v=20';

export const PORTAL_URL = 'https://zicapune.github.io/zica-pune-portal/exams/';
const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ---------------------------------------------------------------- message builders
export function scheduleText(items, { note = '' } = {}) {
  const byDay = {};
  items.forEach((x) => { const k = dDay(x.starts_at); (byDay[k] = byDay[k] || []).push(x); });
  const parts = ['*ZICA Pune · Exam schedule* 📅'];
  Object.entries(byDay).forEach(([d, list]) => {
    parts.push(`\n*${d}*`);
    list.forEach((s) => {
      const st = s.students.filter((x) => !x.test);
      parts.push(`\n🖥️ *${s.subject}*\n⏰ ${tm(s.starts_at)} – ${tm(s.ends_at)}`);
      st.forEach((x, i) => parts.push(`${i + 1}. ${x.name}${x.code ? ' (' + idc(x.code) + ')' : ''}`));
      if (s.notes) parts.push(`📝 ${s.notes}`);
    });
  });
  if (note) parts.push('\n' + note);
  parts.push(`\n✅ Log in 10 minutes early: ${PORTAL_URL}\n📷 Camera + mic on, sit alone in a quiet room\n🔁 Can't make it? Request a new date on the portal\n\n— Academic Team, ZICA Pune`);
  return parts.join('\n');
}
export function resultsText(rows, { showScore = false } = {}) {
  const subs = [...new Set(rows.map((r) => r.subject))].sort();
  const parts = ['*ZICA Pune · Exam results* 🏆'];
  subs.forEach((sj) => {
    const list = rows.filter((r) => r.subject === sj).sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
    parts.push(`\n*${sj}*`);
    list.forEach((r, i) => parts.push(`${i + 1}. ${r.name} — *${r.grade}*${showScore ? ` (${Math.round(r.percent ?? 0)}%)` : ''}${r.passed ? '' : ' · retake open'}`));
  });
  parts.push(`\nWell done everyone! 👏 Full question-wise report and certificate status on the portal: ${PORTAL_URL}\n\n— Academic Team, ZICA Pune`);
  return parts.join('\n');
}
export function oneExamText(name, subject, at, end) {
  return `Hi ${name.split(' ')[0]} 👋\n\nYour *${subject}* exam is set for *${dShort(at)}, ${tm(at)}*${end ? ` (open till ${tm(end)})` : ''}.\n\n✅ Log in 10 minutes early: ${PORTAL_URL}\n📷 Camera + mic on, quiet room\n\nAll the best!\n— Academic Team, ZICA Pune`;
}

// ---------------------------------------------------------------- side panel
export function waPanel(text, { title = 'WhatsApp message', hint = 'For your class group' } = {}) {
  document.querySelector('.wapanel')?.remove();
  const el = document.createElement('aside');
  el.className = 'wapanel';
  el.innerHTML = `<div class="wahead"><div class="waic"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg></div>
      <div><b>${esc(title)}</b><div class="tiny dim">${esc(hint)}</div></div><button class="btn sm ghost" data-wx title="Close">✕</button></div>
    <div class="wabody"><div class="wabubble"><textarea id="waT" spellcheck="true"></textarea><span class="watime">now ✓✓</span></div></div>
    <div class="wafoot">
      <button class="btn pri block" data-wa="app">Open in WhatsApp</button>
      <div class="row" style="gap:8px"><button class="btn block" data-wa="web">WhatsApp Web</button><button class="btn block" data-wa="copy">Copy text</button></div>
      <div class="tiny dim">WhatsApp opens with this text filled in — pick your group and press send. (Websites can't open a group by themselves.)</div></div>`;
  document.body.appendChild(el);
  const ta = el.querySelector('#waT'); ta.value = text;
  const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 4, window.innerHeight * 0.58) + 'px'; };
  ta.oninput = fit; setTimeout(fit, 0);
  requestAnimationFrame(() => el.classList.add('on'));
  const close = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 250); };
  el.querySelector('[data-wx]').onclick = close;
  const copy = async () => { try { await navigator.clipboard.writeText(ta.value); } catch { ta.select(); document.execCommand('copy'); } toast('Copied — paste it in your WhatsApp group', 'ok'); };
  el.querySelectorAll('[data-wa]').forEach((b) => (b.onclick = async () => {
    const t = encodeURIComponent(ta.value);
    if (b.dataset.wa === 'copy') return copy();
    try { await navigator.clipboard.writeText(ta.value); } catch {}           // also on the clipboard, just in case
    if (b.dataset.wa === 'web') return window.open('https://web.whatsapp.com/send?text=' + t, 'zwa');
    if (isPhone()) location.href = 'whatsapp://send?text=' + t;
    else window.open('https://api.whatsapp.com/send?text=' + t, 'zwa');
  }));
  return { close, el };
}
