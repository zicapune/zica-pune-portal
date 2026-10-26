// ZICA Pune Portal · shared helpers
export const CFG = {
  url: 'https://nyqqfzdxzelweyztqoad.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55cXFmemR4emVsd2V5enRxb2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NTU5MDMsImV4cCI6MjEwODUzMTkwM30.1o1oSCLwLcVigSszc-LmFhotoifcVcjjScff7kjn5a4',
  name: 'ZICA Pune Portal',
  contact: 'the Academic Head',
  tz: 'Asia/Kolkata',
};

export const DEMO = new URLSearchParams(location.search).has('demo');

export const sb = window.supabase
  ? window.supabase.createClient(CFG.url, CFG.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'zp-exams-auth' },
    })
  : null;

const ERR = {
  not_signed_in: 'Please sign in again.',
  not_registered: "This email isn't in ZICA records.",
  blocked: 'Your account is on hold. Please contact the Academic Head.',
  locked: 'This exam is locked. Contact the Academic Head to unlock it.',
  no_attempts_left: 'You have used all attempts for this exam.',
  no_open_slot: "Your exam slot isn't open right now. Check your scheduled time.",
  slot_full: 'Your slot is full right now (20 students live). Please try again in a few minutes.',
  portal_full: 'The portal is at full capacity right now. Please try again in a few minutes.',
  bank_not_ready: 'This paper is still being prepared.',
  bad_level: 'Please choose a level.',
  not_admin: 'This account is not an admin.',
  reason_too_short: 'Please write a little more about the reason (at least 10 characters).',
  email_in_use: 'That email already belongs to another student.',
  pick_a_slot: 'Pick a slot to move the student to.',
  bad_times: 'End time must be after start time.',
  already_requested: 'You already have a request waiting for approval.',
  bad_date: 'Pick a time at least 1 hour from now and within the booking window.',
  bad_hour: 'Pick a start time between 9 AM and 8 PM.',
  time_full: 'That hour is fully booked. Please pick another time.',
  bad_link: 'Paste the full link, starting with https://',
  already_approved: 'This assignment is already approved.',
  name_required: 'Please enter your full name.',
  pick_a_time: 'Pick a date and time.',
  pick_a_subject: 'Pick a subject.',
  bad_action: 'That action is not allowed.',
  not_found: 'Not found — refresh the page.',
};
const STATE_TXT = {
  book: 'Book your exam date first.', requested: 'Your date is waiting for approval.', scheduled: "Your exam time hasn't started yet.",
  sequence: 'Finish the earlier subject in your course first.', assignments: 'Complete the required assignments first.',
  locked: 'This exam is locked.', done: 'You have used all attempts.', missed: 'You missed your slot — pick a new date.',
  blocked: 'This exam is on hold. Please meet the Academic Head.', exempt: 'This subject is already marked complete.', preparing: 'This paper is still being prepared.',
};
export function errText(e) {
  const m = String(e?.message || e || '');
  const st = m.match(/(?:not_ready|not_eligible):(\w+)/);
  if (st) return STATE_TXT[st[1]] || 'This exam is not open right now.';
  for (const k of Object.keys(ERR)) if (m.includes(k)) return ERR[k];
  if (m.includes('other_exam_live')) return 'You already have another exam in progress. Finish that one first.';
  if (/fetch|network|Failed to fetch/i.test(m)) return 'Network problem — check your internet and try again.';
  return m || 'Something went wrong.';
}

export async function rpc(fn, args = {}) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) { const e = new Error(error.message); e.raw = error; throw e; }
  return data;
}

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const dOpt = { timeZone: CFG.tz };
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { ...dOpt, weekday: 'short', day: 'numeric', month: 'short' });
export const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { ...dOpt, hour: 'numeric', minute: '2-digit' });
export const fmtDT = (d) => d ? `${fmtDate(d)}, ${fmtTime(d)}` : '—';
export const fmtRange = (a, b) => {
  const same = fmtDate(a) === fmtDate(b);
  return same ? `${fmtDate(a)} · ${fmtTime(a)} – ${fmtTime(b)}` : `${fmtDT(a)} → ${fmtDT(b)}`;
};
export const ago = (d) => {
  if (!d) return 'never';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDate(d);
};
export const mmss = (ms) => {
  ms = Math.max(0, ms); const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0');
};

let toastT;
export function toast(msg, kind = '') {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 4200);
}

export function modal(html, cls = '') {
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = `<div class="modal ${cls}">${html}</div>`;
  document.body.appendChild(ov);
  return { el: ov, close: () => ov.remove() };
}

export function confirmBox(title, text, okLabel = 'Confirm', danger = false) {
  return new Promise((res) => {
    const m = modal(`<h2>${esc(title)}</h2><p class="muted">${text}</p>
      <div class="row mt24" style="justify-content:flex-end"><button class="btn ghost" data-x>Cancel</button>
      <button class="btn ${danger ? 'bad' : 'pri'}" data-ok>${esc(okLabel)}</button></div>`);
    m.el.querySelector('[data-x]').onclick = () => { m.close(); res(false); };
    m.el.querySelector('[data-ok]').onclick = () => { m.close(); res(true); };
  });
}

export async function signIn() {
  const redirectTo = location.origin + location.pathname;
  await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { prompt: 'select_account' } } });
}
export async function signOut() {
  sessionStorage.clear();
  await sb.auth.signOut();
  location.hash = '';
  location.reload();
}
export function device() {
  return {
    ua: navigator.userAgent.slice(0, 220), sw: screen.width, sh: screen.height,
    touch: 'ontouchstart' in window, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, lang: navigator.language,
  };
}

export const GOOGLE_SVG = `<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

export function topBar(user, extra = '') {
  return `<header class="top"><div class="wrap">
    <a class="brand" href="./" style="text-decoration:none"><div class="logo">ZICA</div><div>ZICA Pune Portal<small>Software Exams</small></div></a>
    <div class="sp"></div>${extra}
    ${user ? `<div class="who"><span class="nm">${esc(user.name || user.email)}</span><div class="avatar">${esc(initials(user.name || user.email))}</div>
      <button class="btn sm ghost" data-signout title="Sign out">Sign out</button></div>` : ''}
  </div></header>`;
}

export function signInScreen(target, title = 'Software <span>Exams</span>', sub = 'Sign in with the Gmail ID registered with ZICA to see your courses and exams.') {
  target.innerHTML = topBar(null) + `
  <section class="hero"><div class="box">
    <div class="logo" style="width:64px;height:64px;border-radius:18px;margin:0 auto;font-size:18px">ZICA</div>
    <h1>${title}</h1><p>${sub}</p>
    <button class="gbtn" id="gsign">${GOOGLE_SVG} Continue with Google</button>
    <div class="features"><div><b>60</b>minutes</div><div><b>50</b>questions</div><div><b>3</b>levels</div></div>
    <p class="small dim mt24">Camera, timer and tab-switch monitoring are part of every exam.</p>
  </div></section>`;
  target.querySelector('#gsign').onclick = () => signIn().catch((e) => toast(errText(e), 'bad'));
}

export const FAM_ICON = { design: 'GD', uiux: 'UX', motion: 'MG', vfx: 'FX', anim: '3D', game: 'GA', genai: 'AI' };
