// ZICA Pune Portal · Student exam app
import { sb, rpc, DEMO, $, $$, esc, toast, modal, confirmBox, errText, device, topBar, signInScreen, signOut,
         fmtDate, fmtTime, fmtRange, fmtDT, mmss, initials, CFG, swTile, SW } from './common.js?v=13';
import { Cam, watchFaces } from './proctor.js';
import { mock } from './demo.js';

const app = $('#app');
const cam = new Cam();
let ME = null;
let PR = {};            // practical papers + specialisations per course
let RUN = null;           // running exam controller
const api = (fn, args = {}) => (DEMO ? mock(fn, args) : rpc(fn, args));

const LEVEL_TXT = {
  easy: { t: 'Easy', d: 'Mostly fundamentals. Safest paper, lower ceiling.' },
  medium: { t: 'Medium', d: 'Balanced paper — the recommended standard level.' },
  hard: { t: 'Hard', d: 'Advanced, production-level questions. Highest ceiling.' },
};
// exam rules — the same list is shown when booking, before the paper opens and inside the exam
function examRules() {
  const S = ME?.settings || {}, vl = S.violation_limit ?? 2, fl = S.face_limit ?? 3, dur = S.duration || 60;
  return [
    ['alone', 'I am alone in a quiet room', 'No one will sit with me, talk to me or help me during the exam.'],
    ['camera', 'My camera stays on and my face stays in the frame', `If my face leaves the camera, more than one face appears or the camera goes off, I get a warning. After ${fl} face warnings the exam is submitted automatically with the answers I have given. Photos are taken at random and on every warning.`],
    ['tabs', 'I will not switch tabs, apps or windows, or leave full screen', `Warnings 1${vl > 1 ? '–' + vl : ''} are shown on screen. Warning ${vl + 1} pauses and locks my exam until the Academic Head reviews it — the timer keeps running. Copy, paste and printing are blocked.`],
    ['help', 'No phones, notes, books, ChatGPT or any AI tool', 'Only this exam screen is allowed. Any outside help means the exam can be cancelled.'],
    ['time', `I will finish within ${dur} minutes`, 'The timer starts only when I press Start, after reading these rules. Opening the paper counts as an attempt. If I get disconnected I can resume until the time ends; unanswered questions score zero.'],
    ['record', 'I agree my activity is recorded', 'Logins, answers, tab switches, camera photos and timings are saved to my student record.'],
  ];
}
const rulesList = () => `<ul class="rlist">${examRules().map((r) => `<li><b>${esc(r[1])}</b><span>${r[2]}</span></li>`).join('')}</ul>`;
// which practical papers this theory exam leads to, and what is still missing for each
function pracInfo(cid, sid) {
  const papers = (PR[cid]?.papers || []).filter((p) => (p.reqs || []).some((r) => r.id === sid));
  if (!papers.length) return '';
  const row = (p) => {
    const others = (p.reqs || []).filter((r) => r.id !== sid && (p.missing || []).some((m) => m.id === r.id || m.name === r.name));
    const st = p.state === 'theory' ? (others.length ? `then also pass <b>${others.map((r) => esc(r.name)).join(', ')}</b>` : 'unlocks as soon as you pass this exam')
      : ['ready', 'in_progress', 'submitted', 'marked'].includes(p.state) ? 'already unlocked' : p.state === 'spec' ? 'choose your specialisation first' : 'paper being prepared';
    return `<li><b>${esc(pLabel(p))} · ${esc(p.title)}</b><span>${st}</span></li>`;
  };
  return `<div class="card mt16 prinfo"><h3>🧩 Your practical papers</h3>
    <p class="small muted" style="margin:6px 0 8px">Passing this theory exam counts towards these practicals (150 marks each). Each one unlocks on the portal once all the theory exams it needs are passed.</p>
    <ul class="rlist">${papers.map(row).join('')}</ul></div>`;
}
const certLine = (c, big) => (c?.cert?.line ? `<div class="certline ${c.cert.key || ''} ${big ? 'big' : ''}"><span class="ci">🎓</span><div><b>${esc(c.cert.line)}</b>${c.cert.note ? `<span>${esc(c.cert.note)}</span>` : ''}</div></div>` : '');
const VIOL_TXT = {
  tab_switch: ['You left the exam screen', 'Switching tabs or apps during the exam is not allowed.'],
  window_blur: ['The exam window lost focus', 'Another window or app was opened over the exam.'],
  no_face: ["We can't see your face", 'Keep your face clearly visible in the camera at all times.'],
  multiple_faces: ['More than one person detected', 'You must be alone while taking the exam.'],
  camera_off: ['Your camera turned off', 'The camera must stay on for the entire exam.'],
};

// ---------------------------------------------------------------- boot
async function boot() {
  if (DEMO) { ME = await api('exam_me'); bindTop(); window.addEventListener('hashchange', route); return route(); }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return signInScreen(app);
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.reload(); });
  try {
    const first = !sessionStorage.getItem('zp_in');
    ME = await api(first ? 'exam_login' : 'exam_me', first ? { p_device: device() } : {});
    sessionStorage.setItem('zp_in', '1');
    if (ME.student) PR = (await api('exam_prac_me').catch(() => ({}))) || {};
  } catch (e) { return fatal(errText(e)); }
  if (!ME.student) return notRegistered();
  if (ME.student.blocked) return fatal('Your account is on hold. Please contact the Academic Head.');
  window.addEventListener('hashchange', route);
  route();
}

function bindTop() { $$('[data-signout]').forEach((b) => (b.onclick = () => (DEMO ? toast('Demo mode') : signOut()))); }
const modeBtn = () => (ME?.is_admin || ME?.is_staff ? `<a class="btn sm modesw" href="admin.html" title="Switch to the ${ME.is_admin ? 'admin' : 'faculty'} panel">⇄ ${ME.is_admin ? 'Admin' : 'Faculty'} mode</a>` : '');
function shell(inner, fam = '') {
  if (RUN) return;
  app.innerHTML = topBar(ME?.student || { email: ME?.email }, modeBtn()) + `<main class="wrap" ${fam ? `data-fam="${fam}"` : ''}>${inner}</main>
    <div class="foot">ZICA Pune · Kothrud · Exams are monitored — camera, timer and screen focus.</div>`;
  bindTop();
  window.scrollTo(0, 0);
}
function fatal(msg) {
  app.innerHTML = topBar(ME?.student || (ME ? { email: ME.email } : null)) + `<section class="hero"><div class="box">
    <div class="bigic b" style="margin:0 auto 14px">!</div><h2>${esc(msg)}</h2>
    <button class="btn mt24" onclick="location.reload()">Try again</button></div></section>`;
  bindTop();
}
function notRegistered() {
  const cl = ME.claim;
  const staffBtn = ME.is_admin || ME.is_staff ? `<a class="btn pri mt16" href="admin.html">Open ${ME.is_admin ? 'admin' : 'faculty'} panel</a>` : '';
  const pending = cl && cl.status === 'pending';
  const linkedNote = cl && cl.status === 'rejected' ? `<p class="small" style="color:#ffb3c0">Your last request was declined${cl.admin_note ? ': ' + esc(cl.admin_note) : ''}. Please meet the Academic Head.</p>` : '';
  app.innerHTML = topBar({ email: ME.email, name: ME.email }) + `<section class="hero"><div class="box" style="max-width:600px">
    <div class="bigic w" style="margin:0 auto 14px">${pending ? '✓' : '?'}</div>
    <h2>${pending ? 'Request sent — please wait for approval' : 'You are signed in, but this Gmail is not on ZICA records'}</h2>
    <p class="muted mt8">Signed in as <b style="color:var(--ink)">${esc(ME.email)}</b></p>
    ${pending ? `<p class="muted mt8">The Academic Head will link this Gmail to your student record. You will get an email as soon as it is approved — then just open this page again.</p>
      <div class="small dim mt16">Request sent ${fmtDT(cl.created_at)}</div>` : `
    <div class="card mt24" style="text-align:left"><h3 style="margin-bottom:6px">What to do now</h3>
      <ol class="small" style="margin:0;padding-left:18px;line-height:1.7">
        <li><b>Did you give a different Gmail at admission?</b> Tap <b>Use a different Google account</b> below and sign in with that Gmail.</li>
        <li><b>Want to use this Gmail instead?</b> Fill the form below. The Academic Head will approve it and you will get an email.</li>
        <li><b>Faculty?</b> Your account is added by the Academic Head only. Please contact the Academic Head (academics.zicapune@gmail.com) to get access — do not fill the student form.</li>
      </ol></div>
    ${linkedNote}${staffBtn}
    <div class="card mt16" style="text-align:left"><h3>Student form — link <span style="color:var(--a1)">${esc(ME.email)}</span> to my record</h3>
      <p class="tiny dim" style="margin:4px 0 6px">This Gmail will become your login for exams, results and certificates.</p>
      <label class="lb">Your full name (as at admission) *</label><input class="inp" id="clN" maxlength="120" placeholder="e.g. Priya Sharma">
      <label class="lb">Mobile number *</label><input class="inp" id="clP" maxlength="20" inputmode="tel" placeholder="10-digit mobile">
      <label class="lb">Your course</label><input class="inp" id="clC" maxlength="200" placeholder="e.g. Program in Graphic Design / Modular Photoshop">
      <label class="lb">Email you gave at admission (if you remember)</label><input class="inp" id="clE" maxlength="120" placeholder="optional — helps us find you faster">
      <button class="btn pri block mt16" id="clGo">Send for approval</button></div>`}
    <button class="btn ghost mt16" data-signout>Use a different Google account</button></div></section>`;
  bindTop();
  const go = $('#clGo'); if (!go) return;
  go.onclick = async () => {
    const v = (id) => $(id).value.trim();
    if (v('#clN').length < 3) return toast('Please enter your full name.', 'bad');
    if (!/^\+?[0-9 ]{10,15}$/.test(v('#clP'))) return toast('Please enter a valid mobile number.', 'bad');
    go.disabled = true; go.textContent = 'Sending…';
    try {
      await api('exam_claim', { p_name: v('#clN'), p_phone: v('#clP'), p_course: v('#clC'), p_old_email: v('#clE') });
      ME = await api('exam_me'); notRegistered(); toast('Request sent to the Academic Head.', 'ok');
    } catch (e) { toast(errText(e), 'bad'); go.disabled = false; go.textContent = 'Send for approval'; }
  };
}

async function refresh() {
  if (DEMO) return;
  const [me, pr] = await Promise.all([api('exam_me'), api('exam_prac_me').catch(() => ({}))]);
  ME = me; PR = pr || {};
}

function route() {
  if (RUN) return;
  $$('.ov').forEach((o) => o.remove());
  const p = location.hash.replace(/^#\/?/, '').split('/');
  if (p[0] === 'c' && p[1]) return courseView(decodeURIComponent(p[1]));
  if (p[0] === 's' && p[2]) return setupView(decodeURIComponent(p[1]), decodeURIComponent(p[2]));
  if (p[0] === 'a' && p[2]) return assignView(decodeURIComponent(p[1]), decodeURIComponent(p[2]));
  if (p[0] === 'p' && p[1]) return pracView(p[1]);
  if (p[0] === 'r' && p[1]) return resultView(p[1]);
  if (p[0] === 'review' && p[1]) return reviewView(p[1]);
  return homeView();
}

const findCourse = (cid) => ME.courses.find((c) => c.id === cid);
const allSubjects = () => ME.courses.flatMap((c) => c.subjects.map((s) => ({ ...s, course: c })));

// ---------------------------------------------------------------- home
async function homeView() {
  shell('<div class="spin"></div>');
  try { await refresh(); } catch (e) { return fatal(errText(e)); }
  const first = (ME.student.name || '').split(' ')[0];
  const live = allSubjects().find((s) => s.state === 'live');
  const cards = ME.courses.map((c) => {
    const done = c.subjects.filter((s) => s.best || s.state === 'exempt').length;
    const ready = c.subjects.filter((s) => s.state === 'ready').length;
    const book = c.subjects.filter((s) => s.state === 'book' || s.state === 'missed').length;
    const pct = c.subjects.length ? Math.round((done / c.subjects.length) * 100) : 0;
    return `<a class="ccard" data-fam="${c.family}" href="#/c/${encodeURIComponent(c.id)}" style="text-decoration:none">
      <div class="spread"><div class="ic">${esc(courseIcon(c))}</div>
        ${ready ? `<span class="pill ok"><span class="dot pulse"></span>${ready} open now</span>` : book ? `<span class="pill info">${book} to book</span>` : ''}</div>
      <h3>${esc(c.name)}</h3>
      <div class="small muted">${c.subjects.length} subject${c.subjects.length === 1 ? '' : 's'} · ${done} completed</div>
      ${c.cert?.by ? `<div class="tiny dim" style="margin-top:4px">🎓 Certificate: ${esc(c.cert.by)}</div>` : ''}
      <div class="prog"><i style="width:${pct}%"></i></div></a>`;
  }).join('');

  shell(`
    <div class="phead"><div class="small muted">ZICA Pune · Software Exams${ME.student.code ? ` · Student ID <b style="color:var(--ink)">${esc(ME.student.code)}</b>` : ''}</div>
      <h1>Hi ${esc(first)} 👋</h1>
      <p class="muted" style="margin:6px 0 0">Open your course, pick the next subject and book a date and time that suits you (within ${ME.settings.book_days || 30} days). The Academic Head confirms it and you get an email.</p></div>
    ${live ? `<div class="card mt16" data-fam="${live.course.family}" style="border-color:var(--a1)">
        <div class="spread"><div><span class="pill bad"><span class="dot pulse"></span>Exam in progress</span>
        <h3 class="mt8">${esc(live.name)}</h3><div class="small muted">Your timer is running. Resume now to keep answering.</div></div>
        <a class="btn pri" href="#/s/${encodeURIComponent(live.course.id)}/${live.id}">Resume exam</a></div></div>` : ''}
    ${canNowBlock()}
    ${ME.courses.length ? `<h3 class="mt32">Your courses</h3><div class="grid courses mt16">${cards}</div>`
      : `<div class="empty mt24">No courses are linked to your account yet. Please contact the Academic Head.</div>`}
    ${historyBlock()}
    ${howItWorks()}
  `);
  $$('[data-hbook]').forEach((b) => (b.onclick = () => { const c = findCourse(b.dataset.hc); bookModal(c, c?.subjects.find((x) => x.id === b.dataset.hbook)); }));
}
const NOW_ORDER = ['ready', 'scheduled', 'book', 'missed', 'requested', 'assignments', 'held', 'spec'];
function canNowBlock() {
  const seen = new Set();
  const items = allSubjects().filter((x) => NOW_ORDER.includes(x.state) && !seen.has(x.id) && seen.add(x.id))
    .sort((a, b) => NOW_ORDER.indexOf(a.state) - NOW_ORDER.indexOf(b.state));
  if (!items.length) return '';
  const row = (x) => {
    const c = x.course, A = x.assign || {};
    const go = `#/c/${encodeURIComponent(c.id)}`;
    const t = {
      ready: ['ok', '● Open now', `<a class="btn pri sm" href="#/s/${encodeURIComponent(c.id)}/${x.id}">Start exam</a>`],
      scheduled: ['info', x.slot ? fmtRange(x.slot.starts_at, x.slot.ends_at) : 'Confirmed', `<a class="btn sm" href="${go}">Details</a>`],
      book: ['ok', x.best ? 'Retake available' : 'Ready to book', `<button class="btn pri sm" data-hbook="${x.id}" data-hc="${c.id}">Book exam date</button>`],
      missed: ['bad', 'Missed — pick a new date', `<button class="btn pri sm" data-hbook="${x.id}" data-hc="${c.id}">Pick a new date</button>`],
      requested: ['warn', 'Awaiting approval', `<a class="btn sm ghost" href="${go}">View</a>`],
      assignments: ['warn', `Assignments ${A.mode === 'submitted' ? A.submitted : A.approved}/${A.need} needed first`, `<a class="btn sm" href="#/a/${encodeURIComponent(c.id)}/${x.id}">Assignments</a>`],
      held: ['warn', `Result on hold · ${A.submitted || 0}/${A.req} assignments`, `<a class="btn sm" href="#/a/${encodeURIComponent(c.id)}/${x.id}">Submit assignments</a>`],
      spec: ['warn', 'Choose your specialisation first', `<a class="btn sm" href="${go}">Choose</a>`],
    }[x.state];
    return `<div class="it ${['ready', 'book', 'missed'].includes(x.state) ? 'go' : ''}">${swTile(x.id, x.short || x.name.slice(0, 2))}
      <div class="meta"><h4>${esc(x.name)}</h4><div class="row" style="gap:6px;margin-top:5px;flex-wrap:wrap"><span class="pill ${t[0]}">${esc(t[1])}</span></div></div>${t[2]}</div>`;
  };
  return `<div class="mt24"><div class="spread"><h3>Your exams</h3><span class="small muted">Easy · Medium · Hard — you choose · 2 attempts each</span></div>
    <div class="cannow">${items.map(row).join('')}</div></div>`;
}
function courseIcon(c) {
  const m = c.name.match(/\b(PCDP|PDP|PP|UI|VFX|3D|2D|Gen AI)\b/i);
  return { design: 'GD', uiux: 'UX', motion: 'MG', vfx: 'FX', anim: m && /2D/i.test(c.name) ? '2D' : '3D', game: 'GA', genai: 'AI' }[c.family] || 'Z';
}
function historyBlock() {
  if (!ME.history?.length) return '';
  return `<h3 class="mt32">Your results</h3><div class="grid mt16" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
    ${ME.history.map((h) => h.held ? `<a class="scard" href="#/r/${h.attempt_id}" style="text-decoration:none">
      <span class="gradechip held">⏳</span>
      <div class="body"><h4>${esc(h.subject)}</h4><div class="small muted">Result on hold · submit your assignments · ${fmtDate(h.at)}</div></div></a>`
      : `<a class="scard" href="#/r/${h.attempt_id}" style="text-decoration:none">
      <span class="gradechip ${h.passed ? '' : 'f'}">${esc(h.grade)}</span>
      <div class="body"><h4>${esc(h.subject)}</h4><div class="small muted">${h.score}/${h.max} · ${cap(h.level)} · ${fmtDate(h.at)}</div></div></a>`).join('')}
  </div>`;
}
function howItWorks() {
  const L = ME.settings.levels, M = ME.settings.marks;
  return `<div class="card mt32"><h3>How grading works</h3>
    <p class="muted small" style="margin:6px 0 0">Every exam has 50 questions and 60 minutes. You choose the level before the paper opens; your level decides the highest grade you can earn. Each question shows its marks.</p>
    <div class="grid mt16" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      ${['easy', 'medium', 'hard'].map((k) => `<div class="pill" style="justify-content:space-between;padding:10px 14px;border-radius:12px">
        <span>${LEVEL_TXT[k].t} · ${paperTotal(L[k], M)} marks</span><b>max ${L[k].cap}</b></div>`).join('')}
    </div>
    <div class="bands">${ME.settings.bands.map((b) => `<span><b>${b[0]}</b>${b[1] ? b[1] + '%+' : '<40%'}</span>`).join('')}</div>
    <p class="small dim" style="margin:10px 0 0">Pass mark: ${ME.settings.pass_pct}% of your paper.</p></div>`;
}
const paperTotal = (lv, M) => lv.E * M.E + lv.M * M.M + lv.H * M.H;
const cap = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());

// ---------------------------------------------------------------- course
async function courseView(cid) {
  if (!ME.courses) await refresh();
  let c = findCourse(cid);
  if (!c) { await refresh(); c = findCourse(cid); }
  if (!c) return (location.hash = '');
  const list = c.subjects.map((s, i) => subjectCard(c, s, i)).join('');
  const pr = PR[c.id] || { specs: [], papers: [] };
  shell(`
    <div class="phead"><div class="crumb"><a href="#/">Home</a> › <span>${esc(c.name)}</span></div>
      <h1>${esc(c.name)}</h1>
      <p class="muted" style="margin:6px 0 0">Theory exams run in course order — 50 questions · ${ME.settings.duration || 60} minutes · camera on. Practical papers open once you pass the theory exams they need.</p></div>
    ${certLine(c, true)}
    ${String(c.id).startsWith('app3d_') ? `<div class="card mt16" style="border-color:color-mix(in srgb,var(--a1) 45%,var(--line))"><h3 style="margin-bottom:6px">🎓 Your Advanced Professional Program — a separate certificate</h3>
      <p class="small muted" style="margin:0">These papers are <b style="color:var(--ink)">separate</b> from your ZICA course exams and lead to a <b style="color:var(--ink)">second certificate</b>. Please complete <b style="color:var(--ink)">both</b> — your ZICA course exams and every paper below. Each paper is set at the Medium level, with 2 attempts. Same rules apply: camera on, no tab switching.</p></div>` : ''}
    ${specBlock(c, pr)}
    <h2 class="sech">Theory exams</h2>
    ${c.subjects.length ? `<div class="grid subjects">${list}</div>` : `<div class="empty mt24">No subjects are unlocked here yet. Contact the Academic Head.</div>`}
    ${pracBlock(c, pr)}
  `, c.family);
  bindSpec(c, pr); bindPrac(c, pr);
  $$('[data-book]').forEach((b) => (b.onclick = () => bookModal(c, c.subjects.find((x) => x.id === b.dataset.book))));
  $$('[data-cancel]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox('Cancel this request?', 'Your requested date will be withdrawn. You can book again any time.', 'Cancel request', true))) return;
    try { await api('exam_book_cancel', { p_id: +b.dataset.cancel }); toast('Request cancelled.', 'ok'); await refresh(); courseView(cid); }
    catch (e) { toast(errText(e), 'bad'); }
  }));
  // refresh in background to pick up unlocks/slots
  const snap = JSON.stringify([c, PR[cid]]);
  if (!DEMO) refresh().then(() => {
    const c2 = findCourse(cid);
    if (c2 && JSON.stringify([c2, PR[cid]]) !== snap && location.hash.startsWith('#/c/')) courseView(cid);
  }).catch(() => {});
}

function subjectCard(c, s, i) {
  const href = `#/s/${encodeURIComponent(c.id)}/${s.id}`;
  const ahref = `#/a/${encodeURIComponent(c.id)}/${s.id}`;
  const left = s.max_attempts - s.used;
  const A = s.assign || {};
  const got = A.mode === 'submitted' ? A.submitted : A.approved;
  let status = '', action = '';
  const best = s.best?.held ? `<span class="gradechip held" title="Result on hold until your assignments are in">⏳</span>` : s.best ? `<span class="gradechip ${s.best.passed ? '' : 'f'}" title="${s.best.score}/${s.best.max}">${esc(s.best.grade)}</span>` : '';
  const bookBtn = (label = 'Book exam date') => `<button class="btn pri sm" data-book="${s.id}">${label}</button>`;
  switch (s.state) {
    case 'live':
      status = `<span class="pill bad"><span class="dot pulse"></span>In progress</span>`;
      action = `<a class="btn pri sm" href="${href}">Resume exam</a>`; break;
    case 'ready':
      status = s.best ? `<span class="pill">Best ${s.best.score}/${s.best.max} · ${cap(s.best.level)}</span>` : `<span class="pill ok"><span class="dot pulse"></span>Open now</span>`;
      action = `<a class="btn pri sm" href="${href}">${s.best ? `Retake · ${left} left` : 'Start exam'}</a>`;
      if (s.slot) status += ` <span class="pill info">Till ${fmtTime(s.slot.ends_at)}</span>`; break;
    case 'book':
      status = s.best ? `<span class="pill">Best ${s.best.score}/${s.best.max} · ${left} attempt${left === 1 ? '' : 's'} left</span>` : `<span class="pill ok">Eligible</span>`;
      action = `<div class="small muted" style="margin-bottom:8px">Pick a date and time within ${ME.settings.book_days || 30} days.</div>${bookBtn(s.best ? 'Book a retake' : 'Book exam date')}`; break;
    case 'requested':
      status = `<span class="pill warn">Awaiting approval</span>`;
      action = `<div class="small" style="color:var(--ink)">Requested: ${s.booking?.want_at ? fmtDT(s.booking.want_at) : 'by email'}</div>
        <div class="small muted">You'll get an email once the Academic Head confirms.</div>
        <button class="btn sm ghost mt8" data-cancel="${s.booking?.id}">Cancel request</button>`; break;
    case 'scheduled':
      status = `<span class="pill info">Confirmed</span>`;
      action = `<div class="small" style="color:var(--ink)">${fmtRange(s.slot.starts_at, s.slot.ends_at)}</div>
        <div class="small muted">Sign in here at that time — the Start button appears automatically.</div>
        <button class="btn sm ghost mt8" data-book="${s.id}">Request another time</button>`; break;
    case 'missed':
      status = `<span class="pill bad">Missed exam</span>`;
      action = `<div class="small muted" style="margin-bottom:8px">You didn't attend on ${fmtDT(s.missed_slot.starts_at)}. Tell us why and pick a new date.</div>${bookBtn('Pick a new date')}`; break;
    case 'sequence':
      status = `<span class="pill">Next in line</span>`;
      action = `<div class="small muted">Exams follow your course order. Finish <b style="color:var(--ink)">${esc(s.seq_block)}</b> first.</div>`; break;
    case 'assignments':
      status = `<span class="pill warn">Assignments ${got}/${A.need} needed</span>`;
      action = `<div class="small muted" style="margin-bottom:8px">${A.mode === 'submitted' ? 'Submit' : 'Get approved'} at least ${A.need} of ${A.req} assignments (${A.pct}%) to unlock this exam.</div><a class="btn sm" href="${ahref}">Open assignments</a>`; break;
    case 'held':
      status = `<span class="pill warn">⏳ Result on hold</span>`;
      action = `<div class="small muted" style="margin-bottom:8px">Exam written. Your result and certificate unlock once you submit all ${A.req} assignments — ${A.submitted || 0} of ${A.req} submitted so far.</div><a class="btn pri sm" href="${ahref}">Submit assignments</a>`; break;
    case 'exempt':
      status = `<span class="pill ok">✓ Completed earlier</span>`;
      action = `<div class="small muted">${esc(s.ext_note || 'Marked complete by the Academic Head.')}</div>`; break;
    case 'spec':
      status = `<span class="pill warn">Choose specialisation</span>`;
      action = `<div class="small muted">Pick your specialisation at the top of this page to unlock booking.</div>`; break;
    case 'blocked':
      status = `<span class="pill bad">On hold</span>`;
      action = `<div class="small muted">This exam is on hold. Please meet the Academic Head.</div>`; break;
    case 'locked':
      status = `<span class="pill">🔒 Locked</span>`;
      action = `<div class="small muted">Not open for your batch yet.</div>`; break;
    case 'preparing':
      status = `<span class="pill warn">Paper being prepared</span>`;
      action = `<div class="small muted">This paper isn't ready yet. You'll be informed.</div>`; break;
    case 'done':
      status = s.best ? `<span class="pill ${s.best.passed ? 'ok' : 'bad'}">${s.best.passed ? 'Passed' : 'Not passed'} · ${s.best.score}/${s.best.max}</span>` : '<span class="pill">Attempts used</span>';
      action = s.best ? `<a class="btn sm" href="#/r/${s.best.attempt_id}">View report</a>` : `<div class="small muted">Contact the Academic Head.</div>`; break;
  }
  const assignLine = A.req > 0 && !['assignments', 'exempt', 'held'].includes(s.state)
    ? `<a class="small" href="${ahref}" style="display:block;margin-top:10px;color:var(--ink2)">📁 Assignments ${A.submitted || 0}/${A.req} submitted${A.redo ? ` · ${A.redo} to redo` : ''} · <span style="color:var(--a1)">all ${A.req} needed for your result & certificate</span> ›</a>` : '';
  const on = ['ready', 'live', 'book', 'missed'].includes(s.state);
  return `<div class="scard ${on ? 'ready' : ''} ${['locked', 'sequence', 'preparing'].includes(s.state) ? 'locked' : ''}">
    ${swTile(s.id, s.short || s.name.slice(0, 2))}
    <div class="body"><div class="seq">STEP ${i + 1}</div><div class="spread"><h4>${esc(s.name)}</h4>${best}</div>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin:6px 0 12px">${status}</div>${action}${assignLine}</div></div>`;
}

// ---------------------------------------------------------------- booking
const istParts = (d) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  .formatToParts(d).filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]));
async function bookModal(c, s) {
  if (!s) return;
  const kind = s.state === 'missed' ? 'missed' : s.state === 'scheduled' ? 'reschedule' : 'new';
  const S = ME.settings, days = S.book_days || 30, [h0, h1] = S.book_hours || [9, 20];
  let load = {}; try { load = await api('exam_book_load'); } catch {}
  const now = Date.now(), minAt = now + 60 * 60000;
  const dayList = [];
  for (let d = 0; d <= days; d++) {
    const t = new Date(now + d * 86400000); const p = istParts(t);
    dayList.push({ key: `${p.year}-${p.month}-${p.day}`, d: t });
  }
  let day = null, time = null;
  const title = { new: `Book your ${s.name} exam`, reschedule: `Reschedule ${s.name}`, missed: `New date for ${s.name}` }[kind];
  const m = modal(`<h2>${esc(title)}</h2>
    <p class="muted small">${kind === 'new' ? 'Choose a day and start time. The exam takes 60 minutes; your slot stays open for ' + (S.book_window || 120) + ' minutes from the start time.' : 'Tell the Academic Head why, then pick a new day and time.'}</p>
    ${s.slot && kind === 'reschedule' ? `<div class="pill info">Current: ${fmtRange(s.slot.starts_at, s.slot.ends_at)}</div>` : ''}
    <label class="lb">Day</label><div class="chips" id="bkD">${dayList.map((x, i) => `<button class="chip" data-d="${i}"><small>${x.d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' })}</small><b>${x.d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}</b></button>`).join('')}</div>
    <label class="lb">Start time (IST)</label><div class="chips times" id="bkT"><div class="small dim">Pick a day first.</div></div>
    <label class="lb">${kind === 'new' ? 'Note for the Academic Head (optional)' : 'Reason (required)'}</label>
    <textarea class="inp" rows="3" id="bkN" maxlength="1500" placeholder="${kind === 'missed' ? 'e.g. I was unwell on that day.' : kind === 'reschedule' ? 'e.g. I have a college exam that day.' : 'e.g. I prefer the lab PC.'}"></textarea>
    <details class="bkrules mt16" open><summary><b>Exam-day rules</b> — read before you book</summary>${rulesList()}
      <div class="tiny dim mt8">You need a phone or laptop with a working front camera, Chrome, a stable internet connection and charged battery.${c.cert?.line ? ' ' + esc(c.cert.line) : ''}</div></details>
    <label class="rule mt8" id="bkAck"><input type="checkbox"><div class="box"></div><div><b>I have read the exam rules and will follow them</b><span>Camera on, face visible, no tab switching, no outside help.</span></div></label>
    <div class="row mt24" style="justify-content:flex-end"><button class="btn ghost" data-x>Close</button><button class="btn pri" data-ok disabled>Send request</button></div>`);
  const ok = m.el.querySelector('[data-ok]');
  const ack = () => $('#bkAck', m.el).classList.contains('on');
  $('#bkAck', m.el).onclick = (e) => { e.preventDefault(); $('#bkAck', m.el).classList.toggle('on'); ok.disabled = !(time && ack()); };
  const drawTimes = () => {
    const x = dayList[day]; const out = [];
    for (let h = h0; h < h1; h++) for (const mm of ['00', '30']) {
      const iso = `${x.key}T${String(h).padStart(2, '0')}:${mm}:00+05:30`; const at = Date.parse(iso);
      const busy = load[`${x.key}T${String(h).padStart(2, '0')}`] || 0;
      const dis = at < minAt || busy >= 20;
      out.push(`<button class="chip t ${time === iso ? 'on' : ''}" data-t="${iso}" ${dis ? 'disabled' : ''} title="${busy ? busy + ' booked' : ''}">${fmtTime(iso)}${busy >= 12 && !dis ? '<i>busy</i>' : ''}</button>`);
    }
    $('#bkT', m.el).innerHTML = out.join('') || '<div class="small dim">No times left on this day.</div>';
    $$('[data-t]', m.el).forEach((b) => (b.onclick = () => { time = b.dataset.t; drawTimes(); ok.disabled = !ack(); }));
  };
  $$('[data-d]', m.el).forEach((b) => (b.onclick = () => { day = +b.dataset.d; time = null; ok.disabled = true; $$('[data-d]', m.el).forEach((z) => z.classList.toggle('on', z === b)); drawTimes(); }));
  m.el.querySelector('[data-x]').onclick = m.close;
  ok.onclick = async () => {
    const note = $('#bkN', m.el).value.trim();
    if (kind !== 'new' && note.length < 10) return toast('Please write the reason (at least 10 characters).', 'bad');
    if (!ack()) return toast('Please read the exam rules and tick the box.', 'bad');
    ok.disabled = true; ok.textContent = 'Sending…';
    try {
      await api('exam_book', { p_subject: s.id, p_course: c.id === '_more' ? null : c.id, p_at: new Date(time).toISOString(), p_note: note || null });
      m.close(); toast('Request sent. You’ll get an email once it’s confirmed.', 'ok'); await refresh();
      { const t = '#/c/' + encodeURIComponent(c.id); if (location.hash !== t) location.hash = t; else courseView(c.id); }
    } catch (e) { toast(errText(e), 'bad'); ok.disabled = false; ok.textContent = 'Send request'; }
  };
}

// ---------------------------------------------------------------- assignments
const LVL_PILL = { basic: 'Basic', intermediate: 'Intermediate', advanced: 'Advanced', easy: 'Basic', medium: 'Intermediate', hard: 'Advanced' };
const ST_PILL = { submitted: ['info', 'Submitted · awaiting review'], approved: ['ok', '✓ Approved'], redo: ['bad', 'Redo requested'] };
async function assignView(cid, sid) {
  shell('<div class="spin"></div>');
  let d; try { d = await api('exam_assignments', { p_subject: sid }); } catch (e) { return fatal(errText(e)); }
  const c = findCourse(cid); const P = d.progress || { req: 0 };
  const got = P.mode === 'submitted' ? P.submitted : P.approved;
  const pct = P.req ? Math.round((got / P.req) * 100) : 0;
  const mods = [...new Set(d.items.map((a) => a.module || 'Assignments'))];
  shell(`
    <div class="phead"><div class="crumb"><a href="#/">Home</a> › ${c ? `<a href="#/c/${encodeURIComponent(cid)}">${esc(c.name)}</a> › ` : ''}<span>${esc(d.subject?.name)} assignments</span></div>
      <div class="spread"><div class="row">${swTile(d.subject?.id, d.subject?.short || '')}<div><h1>${esc(d.subject?.name)} · Assignments</h1>
        <div class="muted small">Client-style briefs. Do the work, upload to Google Drive (link: “Anyone with the link can view”) and submit the link here.</div></div></div>
        ${d.items.length ? `<button class="btn" id="dlAll">⬇ Download assignment PDF</button>` : ''}</div></div>
    ${P.req ? `<div class="card"><div class="spread"><h3>${got} of ${P.req} ${P.mode === 'submitted' ? 'submitted' : 'approved'}</h3>
        <span class="pill ${got >= P.need ? 'ok' : 'warn'}">${got >= P.need ? '✓ Exam requirement met' : `${P.need} needed for the exam (${P.pct}%)`}</span></div>
        <div class="prog mt8"><i style="width:${pct}%"></i></div>
        <div class="small muted mt8">${P.submitted} submitted · ${P.approved} approved${P.redo ? ` · ${P.redo} to redo` : ''}</div></div>` : ''}
    ${d.items.length ? mods.map((mo) => `<h3 class="mt24">${esc(mo)}</h3><div class="grid mt8" style="grid-template-columns:1fr">
      ${d.items.filter((a) => (a.module || 'Assignments') === mo).map((a) => assignCard(a)).join('')}</div>`).join('')
      : '<div class="empty mt24">Assignments for this subject will appear here soon.</div>'}
  `, d.subject?.family || c?.family);
  $$('[data-sub]').forEach((b) => (b.onclick = () => submitModal(d.items.find((x) => x.id === +b.dataset.sub), () => assignView(cid, sid))));
  $$('[data-dl]').forEach((b) => (b.onclick = () => printBriefs(d.subject, d.items.filter((x) => x.id === +b.dataset.dl))));
  $$('[data-more]').forEach((b) => (b.onclick = () => { const el = b.closest('.asg'); el.classList.toggle('open'); b.textContent = el.classList.contains('open') ? 'Hide brief' : 'Read brief'; }));
  $('#dlAll') && ($('#dlAll').onclick = () => printBriefs(d.subject, d.items));
}
function refLinks(refs) {
  return (refs || []).map((r) => typeof r === 'string' ? { t: r, u: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(r) } : r)
    .map((r) => `<a href="${esc(r.u)}" target="_blank" rel="noopener" class="ref">▶ ${esc(r.t)}</a>`).join('');
}
function assignCard(a) {
  const my = a.my; const sp = my ? ST_PILL[my.status] : null;
  return `<div class="card asg">
    <div class="spread"><div class="row" style="gap:8px;flex-wrap:wrap"><span class="pill">${esc(a.code)}</span>${a.level ? `<span class="pill">${esc(LVL_PILL[a.level] || a.level)}</span>` : ''}
      ${sp ? `<span class="pill ${sp[0]}">${sp[1]}</span>` : ''}</div>
      <div class="row" style="gap:6px"><button class="btn sm ghost" data-dl="${a.id}" title="Download this brief">⬇ PDF</button>
        ${my?.status === 'approved' ? '' : `<button class="btn sm ${my ? '' : 'pri'}" data-sub="${a.id}">${my ? 'Update link' : 'Submit link'}</button>`}</div></div>
    <h3 class="mt8">${esc(a.title)}</h3>
    <div class="asgb"><div class="brief">${esc(a.brief || '')}</div>
      ${a.deliver ? `<div class="mt16"><b class="small">Deliverables</b><div class="small muted pre">${esc(a.deliver)}</div></div>` : ''}
      ${a.specs ? `<div class="mt16"><b class="small">Specs</b><div class="small muted pre">${esc(a.specs)}</div></div>` : ''}
      ${a.refs?.length ? `<div class="mt16"><b class="small">Watch & learn</b><div class="refs">${refLinks(a.refs)}</div></div>` : ''}</div>
    <button class="btn sm ghost mt8" data-more>Read brief</button>
    ${my ? `<div class="small mt8"><a href="${esc(my.link)}" target="_blank" rel="noopener">Your submission ↗</a> · ${fmtDT(my.at)}${my.marks != null ? ` · Marks ${my.marks}` : ''}</div>
      ${my.feedback ? `<div class="ex mt8">💬 ${esc(my.feedback)}</div>` : ''}` : ''}
  </div>`;
}
function submitModal(a, done) {
  const m = modal(`<h2>Submit · ${esc(a.code)}</h2><p class="muted small">${esc(a.title)}</p>
    <label class="lb">Google Drive link</label><input class="inp" id="sbL" placeholder="https://drive.google.com/…" value="${esc(a.my?.link || '')}">
    <div class="tiny dim mt8">In Drive: Share → General access → “Anyone with the link” → Viewer. Put all files for this assignment in one folder and share the folder.</div>
    <label class="lb">Note (optional)</label><textarea class="inp" rows="3" id="sbN" maxlength="1000">${esc(a.my?.note || '')}</textarea>
    <div class="row mt24" style="justify-content:flex-end"><button class="btn ghost" data-x>Cancel</button><button class="btn pri" data-ok>Submit</button></div>`);
  m.el.querySelector('[data-x]').onclick = m.close;
  m.el.querySelector('[data-ok]').onclick = async (e) => {
    const link = $('#sbL', m.el).value.trim();
    if (!/^https:\/\/\S+\.\S+/.test(link)) return toast('Paste the full Drive link (starting with https://).', 'bad');
    e.target.disabled = true;
    try { await api('exam_assignment_submit', { p_assignment: a.id, p_link: link, p_note: $('#sbN', m.el).value.trim() || null }); m.close(); toast('Submitted. Your faculty will review it.', 'ok'); done(); }
    catch (er) { toast(errText(er), 'bad'); e.target.disabled = false; }
  };
}
async function printBriefs(sj, items) {
  const t = toast('Preparing your PDF…');
  try { const { briefPDF } = await import('./pdf.js?v=13'); const f = await briefPDF({ subject: sj, items, student: ME.student }); toast('Downloaded ' + f, 'ok'); }
  catch (e) { toast(errText(e), 'bad'); }
}

// ---------------------------------------------------------------- setup (level + rules + camera)
async function setupView(cid, sid) {
  await refresh().catch(() => {});
  const c = findCourse(cid); const s = c?.subjects.find((x) => x.id === sid);
  if (!c || !s) return (location.hash = '');
  const resume = s.state === 'live';
  if (!resume && s.state !== 'ready') return courseView(cid);
  const L = ME.settings.levels, M = ME.settings.marks;
  let level = s.level_lock || 'medium';

  const levelHtml = resume ? '' : `
    <div class="card mt24"><div class="spread"><h3>1 · Choose how hard your paper is</h3>${s.level_lock ? '<span class="pill warn">Level set by the Academic Head</span>' : '<span class="pill">Medium is recommended</span>'}</div>
      <p class="small muted" style="margin:6px 0 0">Pick <b style="color:var(--ink)">Easy, Medium or Hard</b>. Harder papers can earn a higher grade. The level locks the moment the paper opens and is printed on your report.</p>
      <div class="attnote"><b>${s.max_attempts || 2} attempts.</b> This is attempt ${s.used + 1} of ${s.max_attempts || 2}${s.used + 1 < (s.max_attempts || 2) ? ' — if you don’t pass, you can book one retake' : ' — your last attempt'}.</div>
      <div class="grid levels">${['easy', 'medium', 'hard'].map((k) => `
        <button class="lvl ${k === level ? 'on' : ''}" data-lvl="${k}" ${s.level_lock && s.level_lock !== k ? 'disabled' : ''}>
          <h3>${LEVEL_TXT[k].t}</h3><div class="small muted">${LEVEL_TXT[k].d}</div>
          <div class="cap">${L[k].cap}</div><div class="tiny muted">highest grade possible</div>
          <ul><li><b>${L[k].E}</b> easy × ${M.E} marks</li><li><b>${L[k].M}</b> medium × ${M.M} marks</li><li><b>${L[k].H}</b> hard × ${M.H} marks</li>
          <li>Total <b>${paperTotal(L[k], M)}</b> marks · pass <b>${Math.ceil(paperTotal(L[k], M) * ME.settings.pass_pct / 100)}</b></li></ul></button>`).join('')}
      </div>
      <div class="bands">${ME.settings.bands.map((b) => `<span><b>${b[0]}</b>${b[1] ? b[1] + '%+' : 'below 40%'}</span>`).join('')}</div>
    </div>`;

  const rules = examRules();
  shell(`
    <div class="phead"><div class="crumb"><a href="#/">Home</a> › <a href="#/c/${encodeURIComponent(cid)}">${esc(c.name)}</a> › <span>${esc(s.name)}</span></div>
      <div class="row">${swTile(s.id, s.short)}<div><h1>${esc(s.name)}</h1>
      <div class="muted small">${resume ? 'Resume your exam — your timer has been running.' : `50 questions · ${ME.settings.duration || 60} minutes · attempt ${s.used + 1} of ${s.max_attempts}`}</div></div></div>
      ${resume ? '' : `<div class="notice mt16"><b>Read everything on this page first.</b> Your timer starts only when you press <b>Start exam</b> at the bottom — not before.</div>`}</div>
    ${certLine(c)}
    ${levelHtml}
    <div class="card mt16"><h3>${resume ? '1' : '2'} · Exam rules — read and tick each one</h3><p class="small muted" style="margin:6px 0 0">Ticking means you have read and accept the rule. You can reopen these rules any time during the exam from the <b>Rules</b> button.</p>
      <div class="rules">${rules.map((r) => `<label class="rule" data-rule="${r[0]}"><input type="checkbox"><div class="box"></div><div><b>${r[1]}</b><span>${r[2]}</span></div></label>`).join('')}</div></div>
    <div class="card mt16"><h3>${resume ? '2' : '3'} · Camera check</h3>
      <div class="camcheck mt16"><div class="camview" id="cv"><video id="cvid" playsinline muted></video>
        <div class="camstat"><span class="pill" id="fstat">Camera off</span></div></div>
        <div><p class="muted small" style="margin-top:0">Sit facing the light with your full face inside the frame. Use a laptop or phone camera; the exam needs the camera on until you submit.</p>
          <button class="btn" id="camOn">Turn on camera</button>
          <div class="small mt16" id="camMsg"></div></div></div></div>
    ${resume ? '' : pracInfo(cid, sid)}
    <div class="card mt16" style="text-align:center">
      <button class="btn pri lg" id="go" disabled>${resume ? 'Resume exam' : 'Start exam'} — full screen</button>
      <div class="small muted mt8" id="goMsg">Tick all rules and turn on your camera to continue.</div></div>
  `, c.family);

  $$('.lvl').forEach((b) => (b.onclick = () => { level = b.dataset.lvl; $$('.lvl').forEach((x) => x.classList.toggle('on', x === b)); }));
  $$('.rule').forEach((r) => (r.onclick = (e) => { e.preventDefault(); r.classList.toggle('on'); check(); }));
  let faceOK = false, camOK = false, stopWatch = null;
  const check = () => {
    const all = $$('.rule').every((r) => r.classList.contains('on'));
    $('#go').disabled = !(all && camOK && faceOK);
    $('#goMsg').textContent = !all ? 'Tick all rules to continue.' : !camOK ? 'Turn on your camera to continue.' : !faceOK ? 'Make sure your face is clearly visible.' : 'All set. The exam opens in full screen.';
  };
  $('#camOn').onclick = async () => {
    if (!Cam.supported()) { $('#camMsg').innerHTML = `<span style="color:var(--bad)">This browser can't use the camera. Open the portal in Chrome.</span>`; return; }
    $('#camMsg').textContent = 'Starting camera…';
    try {
      await cam.start($('#cvid'));
      camOK = true; $('#camOn').textContent = 'Camera on'; $('#camOn').disabled = true;
      $('#camMsg').textContent = 'Loading face check…';
      const has = await cam.loadDetector();
      if (!has) { faceOK = true; $('#fstat').textContent = 'Camera on'; $('#fstat').className = 'pill ok'; $('#camMsg').textContent = 'Camera is on.'; api('exam_event', { p_attempt: null, p_kind: 'face_detect_unavailable', p_detail: device() }).catch(() => {}); check(); return; }
      $('#camMsg').textContent = '';
      stopWatch?.();
      stopWatch = watchFaces(cam, { every: 700, onState: (n) => {
        faceOK = n === 1;
        $('#fstat').textContent = n === 1 ? '✓ Face detected' : n === 0 ? 'No face found' : n > 1 ? 'More than one face' : 'Checking…';
        $('#fstat').className = 'pill ' + (n === 1 ? 'ok' : 'bad');
        $('#cv').className = 'camview ' + (n === 1 ? 'good' : 'badc');
        check();
      } });
    } catch (e) {
      $('#camMsg').innerHTML = `<span style="color:var(--bad)">Camera blocked. Tap the 🔒 / camera icon in the address bar → Allow camera, then try again.</span>`;
      api('exam_event', { p_attempt: null, p_kind: 'camera_denied', p_detail: { msg: String(e?.name || e) } }).catch(() => {});
    }
  };
  $('#go').onclick = async () => {
    $('#go').disabled = true; $('#go').textContent = 'Opening paper…';
    goFull();
    try {
      const p = await api('exam_start', { p_subject: s.id, p_course: c.id === '_more' ? null : c.id, p_level: level, p_device: device() });
      stopWatch?.();
      startExam(p, c);
    } catch (e) {
      exitFull(); toast(errText(e), 'bad'); $('#go').disabled = false; $('#go').textContent = (resume ? 'Resume exam' : 'Start exam') + ' — full screen';
    }
  };
}

function goFull() { const d = document.documentElement; try { (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d, { navigationUI: 'hide' })?.catch?.(() => {}); } catch {} }
function exitFull() { try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch {} }

// ---------------------------------------------------------------- EXAM
function startExam(p, course) {
  const X = {
    p, course, idx: 0,
    ans: Object.fromEntries(Object.entries(p.answers || {}).map(([k, v]) => [String(k), v])),
    marked: new Set((p.marked || []).map(String)), visited: new Set(),
    offset: Date.parse(p.server_now) - Date.now(), deadline: Date.parse(p.deadline_at),
    viol: p.violations, limit: p.violation_limit, status: p.status,
    queue: JSON.parse(localStorage.getItem('zpq_' + p.attempt_id) || '[]'), flushing: false,
    ended: false, lastViol: 0, warnedLow: false, cleanup: [], snapsDone: 0,
  };
  RUN = X;
  document.body.classList.add('examining');
  const qs = p.questions;
  // first unanswered question
  X.idx = Math.max(0, qs.findIndex((q) => X.ans[String(q.id)] == null));
  qs.forEach((q, i) => { if (X.ans[String(q.id)] != null || i < X.idx) X.visited.add(String(q.id)); });

  app.innerHTML = `<div class="xwrap" data-fam="${course.family}">
    <div class="xbar"><div class="wrap">
      <div class="xsub">${swTile(p.subject.id, course.subjects.find((s) => s.id === p.subject.id)?.short || 'Q')}
        <div style="min-width:0"><b>${esc(p.subject.name)}</b><div class="small muted">${cap(p.level)} level · ${esc(ME.student.name)}</div></div></div>
      <div style="flex:1"></div>
      <button class="btn sm ghost rulesbtn" id="rulesB" title="Exam rules (the timer keeps running)">Rules</button>
      <div class="timer" id="tmr">--:--</div>
      <div class="pip" id="pip"><video id="pvid" playsinline muted></video></div>
      <button class="btn zica sm" id="sub">Submit</button>
    </div></div>
    <main class="xmain"><section class="qcard" id="qc"></section><aside class="palette" id="pal"></aside></main>
    <div class="mobbar"><button class="btn" id="mPrev">‹ Prev</button><button class="btn" id="mPal">Palette</button><button class="btn pri" id="mNext">Save & Next ›</button></div>
  </div>`;
  cam.attach($('#pvid'));
  $('#rulesB').onclick = () => {
    const m = modal(`<div class="spread"><h2 style="margin:0">Exam rules</h2><button class="btn sm pri" data-ok>Back to exam</button></div>
      <p class="small muted">Your timer keeps running while this is open.</p>${rulesList()}${pracInfo(course.id, p.subject.id)}
      <button class="btn pri block mt16" data-ok>Back to my exam</button>`);
    m.el.querySelectorAll('[data-ok]').forEach((x) => (x.onclick = () => { m.close(); goFull(); }));
  };

  const renderQ = () => {
    const q = qs[X.idx]; const id = String(q.id); X.visited.add(id);
    const sel = X.ans[id];
    $('#qc').innerHTML = `
      <div class="qhead"><span class="qnum">Question ${X.idx + 1} <span class="muted">of ${qs.length}</span></span>
        <div class="row" style="gap:6px"><span class="pill">${q.marks} marks</span>${X.marked.has(id) ? '<span class="pill mark">Marked for review</span>' : ''}</div></div>
      <div class="qtext">${esc(q.q)}</div>${q.img ? `<img class="qimg" src="${esc(q.img)}" alt="">` : ''}
      <div class="opts">${q.options.map((o, i) => `<button class="opt ${sel === i ? 'sel' : ''}" data-o="${i}"><span class="k">${'ABCDEFGH'[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      <div class="qtools"><div class="l"><button class="btn sm ghost" id="clr" ${sel == null ? 'disabled' : ''}>Clear response</button>
        <button class="btn sm ${X.marked.has(id) ? 'markon' : ''}" id="mrk">${X.marked.has(id) ? '★ Marked' : '☆ Mark for review'}</button></div>
        <div class="r"><button class="btn sm" id="prv" ${X.idx === 0 ? 'disabled' : ''}>‹ Previous</button>
        <button class="btn sm pri" id="nxt">${X.idx === qs.length - 1 ? 'Review & submit' : 'Save & Next ›'}</button></div></div>`;
    $$('.opt', $('#qc')).forEach((b) => (b.onclick = () => choose(q, +b.dataset.o)));
    $('#clr').onclick = () => choose(q, null);
    $('#mrk').onclick = () => toggleMark(q);
    $('#prv').onclick = () => go(X.idx - 1);
    $('#nxt').onclick = () => (X.idx === qs.length - 1 ? submitAsk() : go(X.idx + 1));
    renderPal();
  };
  const go = (i) => { if (i < 0 || i >= qs.length) return; X.idx = i; renderQ(); $('#pal').classList.remove('open'); window.scrollTo(0, 0); $('#qc .opts')?.scrollTo?.(0, 0); };
  const counts = () => {
    let a = 0, m = 0, am = 0, v = 0;
    qs.forEach((q) => { const id = String(q.id); const has = X.ans[id] != null; const mk = X.marked.has(id);
      if (has && mk) am++; else if (has) a++; else if (mk) m++; else if (X.visited.has(id)) v++; });
    return { a, m, am, v, nv: qs.length - a - m - am - v, answered: a + am };
  };
  const renderPal = () => {
    const k = counts();
    $('#pal').innerHTML = `<div class="spread"><h4>Question palette</h4><div class="row" style="gap:6px"><span class="pill">${k.answered}/${qs.length}</span>
      <button class="btn sm mclose" id="palX">Close ✕</button></div></div>
      <div class="pgrid">${qs.map((q, i) => { const id = String(q.id); const has = X.ans[id] != null; const mk = X.marked.has(id);
        const cls = mk && has ? 'm am' : mk ? 'm' : has ? 'a' : X.visited.has(id) ? 'v' : '';
        return `<button class="pq ${cls} ${i === X.idx ? 'cur' : ''}" data-i="${i}">${i + 1}</button>`; }).join('')}</div>
      <div class="legend"><span><i class="a"></i>Answered ${k.a}</span><span><i class="v"></i>Not answered ${k.v}</span>
        <span><i></i>Not visited ${k.nv}</span><span><i class="m"></i>Marked ${k.m}</span><span style="grid-column:span 2"><i class="am"></i>Answered & marked ${k.am} (counted)</span></div>
      <div class="stats"><div><b>${k.answered}</b><small>Attempted</small></div><div><b>${qs.length - k.answered}</b><small>Unattempted</small></div></div>
      <button class="btn zica block mt16" id="sub2">Submit exam</button>
      <div class="tiny dim mt8" style="text-align:center">Warnings: ${X.viol}/${X.limit}</div>`;
    $$('.pq', $('#pal')).forEach((b) => (b.onclick = () => go(+b.dataset.i)));
    $('#palX').onclick = () => $('#pal').classList.remove('open');
    $('#sub2').onclick = () => { $('#pal').classList.remove('open'); submitAsk(); };
    $('#mPal').textContent = `Palette · ${k.answered}/${qs.length}`;
  };
  const choose = (q, i) => {
    if (X.status !== 'in_progress' || X.ended) return;
    const id = String(q.id);
    const next = i === null || X.ans[id] === i ? null : i;   // click again = deselect
    if (next == null) delete X.ans[id]; else X.ans[id] = next;
    X.queue = X.queue.filter((t) => t.qid !== q.id); X.queue.push({ qid: q.id, choice: next });
    persistQ(); flush(); renderQ();
  };
  const toggleMark = (q) => {
    const id = String(q.id); const on = !X.marked.has(id);
    on ? X.marked.add(id) : X.marked.delete(id);
    api('exam_mark', { p_attempt: p.attempt_id, p_qid: q.id, p_on: on }).catch(() => {});
    renderQ();
  };
  const persistQ = () => { try { localStorage.setItem('zpq_' + p.attempt_id, JSON.stringify(X.queue)); } catch {} };
  const flush = async () => {
    if (X.flushing) return; X.flushing = true;
    while (X.queue.length && !X.ended) {
      const t = X.queue[0];
      try {
        const r = await api('exam_answer', { p_attempt: p.attempt_id, p_qid: t.qid, p_choice: t.choice });
        X.queue.shift(); persistQ(); netbar(false);
        if (r && r.ok === false) {
          if (r.error === 'paused') { X.queue = []; persistQ(); showPaused(); break; }
          if (r.error === 'time_up' || r.error === 'finished') { finish('time_up'); break; }
        }
      } catch (e) {
        if (/not_found|bad_question/.test(e.message)) { X.queue.shift(); persistQ(); continue; }
        netbar(true); await sleep(2500);
      }
    }
    X.flushing = false;
  };
  const netbar = (on) => {
    let b = $('.netbar');
    if (on && !b) { b = document.createElement('div'); b.className = 'netbar'; b.textContent = 'Connection lost — your answers are saved on this device and will sync automatically.'; document.body.appendChild(b); }
    if (!on && b) b.remove();
  };

  // timer
  const tick = async () => {
    const left = X.deadline - (Date.now() + X.offset);
    const el = $('#tmr'); if (el) { el.textContent = mmss(left); el.classList.toggle('low', left < 5 * 60000); }
    if (left < 5 * 60000 && !X.warnedLow && left > 0) { X.warnedLow = true; toast('5 minutes left. Review your marked questions.', 'bad'); }
    if (left <= 0 && !X.ended && !X.checkingTime) {
      X.checkingTime = true;
      try {
        const st = await api('exam_status', { p_attempt: p.attempt_id });
        X.offset = Date.parse(st.server_now) - Date.now(); X.deadline = Date.parse(st.deadline_at);
        if (st.status === 'done' || X.deadline - (Date.now() + X.offset) <= 0) finish('time_up');
      } catch { finish('time_up'); }
      X.checkingTime = false;
    }
  };
  const tmr = setInterval(tick, 500); tick();
  X.cleanup.push(() => clearInterval(tmr));

  // ---------- proctoring
  const violation = async (kind) => {
    if (X.ended || X.status !== 'in_progress') return;
    const now = Date.now(); if (now - X.lastViol < 4000) return; X.lastViol = now;
    const img = cam.snapshot();
    try {
      const r = await api('exam_violation', { p_attempt: p.attempt_id, p_kind: kind, p_image: img });
      X.viol = r.violations; renderPal();
      if (r.ended === 'face_limit') return finish('face_limit');
      if (r.status === 'paused') return showPaused();
      if (r.status === 'done') return finish('time_up');
      if (r.kind === 'face') return showFaceWarning(kind, r.face, r.face_limit);
      showWarning(kind, r.violations, r.limit);
    } catch { X.viol++; showWarning(kind, X.viol, X.limit); }
  };
  const showWarning = (kind, n, lim) => {
    $('.ov.viol')?.remove();
    const [t, d] = VIOL_TXT[kind] || ['Exam rule broken', ''];
    const m = modal(`<div class="bigic w">⚠</div><div class="pill warn">Warning ${n} of ${lim}</div>
      <h2 class="mt16">${esc(t)}</h2><p class="muted">${esc(d)} To maintain the decorum of the exam, stay on this screen, keep your face clearly visible and do not take any help.</p>
      <p style="color:#fcd34d" class="small">${n >= lim ? 'This was your last warning. The next violation pauses and locks your exam until the Academic Head reviews it.' : `After ${lim} warnings, the next violation pauses and locks your exam.`} Your timer keeps running.</p>
      <button class="btn pri block mt16" data-ok>I understand — return to exam</button>`, 'warnm');
    m.el.classList.add('viol');
    m.el.querySelector('[data-ok]').onclick = () => { m.close(); goFull(); };
  };
  const showFaceWarning = (kind, n, lim) => {
    $('.ov.viol')?.remove();
    const [t] = VIOL_TXT[kind] || ['Stay in front of the camera'];
    const last = n >= lim;
    const m = modal(`<div class="bigic w">📷</div><div class="pill warn">Face warning ${n} of ${lim}</div>
      <h2 class="mt16">${esc(t)}</h2><p class="muted">Stay in your place with your full face inside the camera until you submit.</p>
      <p style="color:${last ? '#ffb3c0' : '#fcd34d'}" class="small">${last ? 'This was your last warning. If your face leaves the camera again, your exam is submitted automatically with the answers you have given.' : `After ${lim} warnings, your exam is submitted automatically with the answers you have given.`}</p>
      <button class="btn pri block mt16" data-ok>I'm back — continue the exam</button>`, 'warnm');
    m.el.classList.add('viol');
    m.el.querySelector('[data-ok]').onclick = () => { m.close(); goFull(); };
  };
  const showPaused = () => {
    X.status = 'paused';
    if ($('.ov.paused')) return;
    $('.ov.viol')?.remove();
    const m = modal(`<div class="bigic b">⏸</div><h2>Exam paused</h2>
      <p class="muted">You crossed the warning limit, so your exam is locked until the Academic Head reviews it.</p>
      <p style="color:#ffb3c0">Your timer is still running. Contact the Academic Head now.</p>
      <div class="small dim mt16">This screen unlocks automatically once your exam is resumed.</div>`, 'badm');
    m.el.classList.add('paused');
    const poll = setInterval(async () => {
      try {
        const st = await api('exam_status', { p_attempt: p.attempt_id });
        X.offset = Date.parse(st.server_now) - Date.now(); X.deadline = Date.parse(st.deadline_at);
        if (st.status === 'in_progress') { clearInterval(poll); m.close(); X.status = 'in_progress'; X.viol = st.violations; toast('Your exam has been resumed. Stay on this screen.', 'ok'); goFull(); renderQ(); }
        if (st.status === 'done') { clearInterval(poll); m.close(); finish('time_up'); }
      } catch {}
    }, 6000);
    X.cleanup.push(() => clearInterval(poll));
  };
  if (X.status === 'paused') showPaused();

  const onVis = () => { if (document.hidden) { violation('tab_switch'); evt('hidden'); } else evt('visible'); };
  let blurT;
  const onBlur = () => { clearTimeout(blurT); blurT = setTimeout(() => { if (!document.hasFocus() && !document.hidden) violation('window_blur'); }, 1500); };
  const onFs = () => {
    if (X.ended || document.fullscreenElement || !document.fullscreenEnabled) return;
    evt('fullscreen_exit');
    if ($('.ov.fs') || $('.ov.viol') || $('.ov.paused')) return;
    const m = modal(`<div class="bigic w">⛶</div><h2>Return to full screen</h2><p class="muted">The exam must stay in full screen. Leaving it is recorded.</p>
      <button class="btn pri block mt16" data-ok>Back to full screen</button>`, 'warnm');
    m.el.classList.add('fs'); m.el.querySelector('[data-ok]').onclick = () => { m.close(); goFull(); };
  };
  const block = (e) => { e.preventDefault(); };
  const onKey = (e) => {
    const k = e.key?.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'p', 's', 'u', 'f', 'a'].includes(k) || k === 'f12' || k === 'printscreen') {
      e.preventDefault(); evt('key_blocked', { key: (e.ctrlKey || e.metaKey ? 'ctrl+' : '') + k });
    }
  };
  const onUnload = (e) => {
    if (X.ended) return;
    try {
      const tok = JSON.parse(localStorage.getItem('zp-exams-auth') || '{}').access_token;
      fetch(`${CFG.url}/rest/v1/rpc/exam_event`, { method: 'POST', keepalive: true,
        headers: { apikey: CFG.key, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_attempt: p.attempt_id, p_kind: 'page_leave', p_detail: {} }) });
    } catch {}
    e.preventDefault(); e.returnValue = '';
  };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('blur', onBlur);
  document.addEventListener('fullscreenchange', onFs);
  ['copy', 'cut', 'paste', 'contextmenu', 'selectstart', 'dragstart'].forEach((t) => document.addEventListener(t, block));
  document.addEventListener('keydown', onKey);
  window.addEventListener('beforeunload', onUnload);
  X.cleanup.push(() => {
    document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur);
    document.removeEventListener('fullscreenchange', onFs);
    ['copy', 'cut', 'paste', 'contextmenu', 'selectstart', 'dragstart'].forEach((t) => document.removeEventListener(t, block));
    document.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onUnload);
  });
  const evt = (kind, detail = {}) => api('exam_event', { p_attempt: p.attempt_id, p_kind: kind, p_detail: detail }).catch(() => {});

  // camera + faces
  const pipState = (ok) => $('#pip')?.classList.toggle('badc', !ok);
  cam.on('lost', () => {
    if (X.ended) return;
    pipState(false); violation('camera_off');
    if ($('.ov.cam')) return;
    const m = modal(`<div class="bigic b">📷</div><h2>Camera is off</h2><p class="muted">Turn your camera back on to continue. Your timer is running.</p>
      <button class="btn pri block mt16" data-ok>Turn camera back on</button>`, 'badm');
    m.el.classList.add('cam');
    m.el.querySelector('[data-ok]').onclick = async () => {
      try { cam.stream = null; await cam.start($('#pvid')); m.close(); pipState(true); evt('camera_back'); }
      catch { toast('Camera still blocked. Allow camera access in the address bar.', 'bad'); }
    };
  }).on('back', () => pipState(true));
  if (!cam.alive()) cam.start($('#pvid')).catch(() => cam.emit('lost'));
  const stopFaces = watchFaces(cam, {
    onState: (n) => pipState(n === 1 || n === -1),
    onNoFace: () => violation('no_face'),
    onMulti: () => violation('multiple_faces'),
  });
  X.cleanup.push(stopFaces);

  // snapshots: start + 3 random + end
  const snap = (kind) => { const img = cam.snapshot(); if (img) api('exam_snapshot', { p_attempt: p.attempt_id, p_kind: kind, p_image: img }).catch(() => {}); };
  const st0 = setTimeout(() => snap('start'), 4000);
  const left0 = X.deadline - (Date.now() + X.offset);
  const rnd = [0, 1, 2].map(() => setTimeout(() => snap('random'), 60000 + Math.random() * Math.max(60000, left0 - 120000)));
  X.cleanup.push(() => { clearTimeout(st0); rnd.forEach(clearTimeout); });

  // second tab guard
  try {
    const bc = new BroadcastChannel('zp-exam');
    bc.onmessage = (m) => { if (m.data === 'ping') bc.postMessage('here'); if (m.data === 'here') { evt('second_tab'); toast('The exam is open in another tab. Close the other tab.', 'bad'); } };
    bc.postMessage('ping');
    X.cleanup.push(() => bc.close());
  } catch {}

  // submit
  const submitAsk = () => {
    const k = counts();
    const m = modal(`<h2>Submit your exam?</h2><p class="muted">You can't change answers after submitting.</p>
      <div class="sumgrid"><div><b style="color:var(--ok)">${k.answered}</b><small>Answered</small></div><div><b style="color:var(--bad)">${k.v}</b><small>Not answered</small></div>
      <div><b style="color:var(--mark)">${k.m + k.am}</b><small>Marked</small></div><div><b>${k.nv}</b><small>Not visited</small></div></div>
      ${k.m ? `<p class="small" style="color:#d8b4fe">${k.m} marked question${k.m > 1 ? 's are' : ' is'} still unanswered.</p>` : ''}
      <div class="row mt16" style="justify-content:flex-end"><button class="btn ghost" data-x>Keep working</button><button class="btn zica" data-ok>Submit final answers</button></div>`);
    m.el.querySelector('[data-x]').onclick = m.close;
    m.el.querySelector('[data-ok]').onclick = () => { m.close(); finish('submitted'); };
  };
  $('#sub').onclick = submitAsk;
  $('#mPrev').onclick = () => go(X.idx - 1);
  $('#mNext').onclick = () => (X.idx === qs.length - 1 ? submitAsk() : go(X.idx + 1));
  $('#mPal').onclick = () => $('#pal').classList.toggle('open');

  async function finish(how) {
    if (X.ended) return; X.ended = true;
    $$('.ov').forEach((o) => o.remove());
    const wait = modal(`<div class="spin" style="margin:10px auto 18px"></div><h2 style="text-align:center">${how === 'time_up' ? "Time's up — submitting" : how === 'face_limit' ? 'Face warnings used up — submitting your answers' : 'Submitting your answers'}</h2>
      <p class="muted" style="text-align:center">Please don't close this page.</p>`);
    // final flush (answers queued while offline)
    const until = Date.now() + 12000;
    while (X.queue.length && Date.now() < until) {
      const t = X.queue[0];
      try { await api('exam_answer', { p_attempt: p.attempt_id, p_qid: t.qid, p_choice: t.choice }); X.queue.shift(); } catch { await sleep(1500); }
    }
    persistQ();
    snap('end');
    let r = null;
    for (let i = 0; i < 6 && !r; i++) { try { r = await api('exam_submit', { p_attempt: p.attempt_id }); } catch { await sleep(2000); } }
    X.cleanup.forEach((f) => { try { f(); } catch {} });
    cam.stop(); exitFull(); document.body.classList.remove('examining'); netbar(false);
    wait.close(); RUN = null;
    if (!r) { toast('Could not reach the server. Your answers are saved — reopen the portal to see your result.', 'bad'); location.hash = ''; return route(); }
    localStorage.removeItem('zpq_' + p.attempt_id);
    sessionStorage.setItem('zp_res_' + r.attempt_id, JSON.stringify(r));
    location.hash = '#/r/' + r.attempt_id;
    resultView(r.attempt_id, r);
  }

  renderQ(); flush();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- result on hold
function heldView(r) {
  const A = r.assign || {};
  const cid = ME.courses?.find((c) => c.subjects.some((x) => x.id === r.subject_id))?.id;
  const howTxt = { submitted: 'Submitted by you', time_up: 'Auto-submitted when time ran out', admin_ended: 'Ended by the Academic Head', face_limit: 'Auto-submitted: face left the camera too often' }[r.how] || '';
  shell(`
    <div class="phead"><div class="crumb"><a href="#/">Home</a> › <span>Result</span></div></div>
    <div class="card" style="text-align:center;padding:36px 22px">
      <div class="bigic w" style="margin:0 auto 14px">⏳</div>
      <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap"><span class="pill warn">Result on hold</span><span class="pill">${cap(r.level)} level</span>${howTxt ? `<span class="pill">${esc(howTxt)}</span>` : ''}</div>
      <h1 class="mt16">${esc(r.subject)}</h1>
      <p class="muted" style="max-width:560px;margin:10px auto 0">Your exam is recorded — ${r.answered ?? 0} of ${r.total} questions answered. Your <b style="color:var(--ink)">result and certificate</b> are released only after you submit
        <b style="color:var(--ink)">all ${A.req} assignments</b> for this software. You have submitted <b style="color:var(--a1)">${A.submitted || 0} of ${A.req}</b>.</p>
      <p class="small dim mt8">The moment the last one is submitted, your result appears here and is emailed to you.</p>
      ${cid ? `<a class="btn pri mt24" href="#/a/${encodeURIComponent(cid)}/${r.subject_id}">Submit my assignments</a>` : ''}
    </div>`, ME.courses?.find((c) => c.id === cid)?.family);
}

// ---------------------------------------------------------------- result + review
async function getResult(id) {
  const c = sessionStorage.getItem('zp_res_' + id);
  if (c) return JSON.parse(c);
  const r = await api('exam_result', { p_attempt: id });
  sessionStorage.setItem('zp_res_' + id, JSON.stringify(r));
  return r;
}
async function resultView(id, pre) {
  shell('<div class="spin"></div>');
  let r; try { r = pre || await getResult(id); } catch (e) { return fatal(errText(e)); }
  if (r.held) { sessionStorage.removeItem('zp_res_' + id); return heldView(r); }
  const fam = ME.courses?.flatMap((c) => c.subjects.map((s) => [s.id, c.family])).find((x) => x[0] === r.subject_id)?.[1] || r.family || 'design';
  const pct = Number(r.percent || 0); const C = 2 * Math.PI * 78;
  const howTxt = { submitted: 'Submitted by you', time_up: 'Auto-submitted when time ran out', admin_ended: 'Ended by the Academic Head', face_limit: 'Auto-submitted: face left the camera too often' }[r.how] || '';
  const used = r.submitted_at && r.started_at ? Math.round((Date.parse(r.submitted_at) - Date.parse(r.started_at)) / 60000) : null;
  shell(`
    <div class="phead"><div class="crumb"><a href="#/">Home</a> › <span>Result</span></div></div>
    <div class="card"><div class="resulthero">
      <div class="ring"><svg width="180" height="180"><circle cx="90" cy="90" r="78" stroke="rgba(255,255,255,.08)" stroke-width="14" fill="none"/>
        <circle cx="90" cy="90" r="78" stroke="url(#gr)" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"/>
        <defs><linearGradient id="gr"><stop offset="0" stop-color="var(--a1)"/><stop offset="1" stop-color="var(--a2)"/></linearGradient></defs></svg>
        <div class="in"><div><div class="g">${esc(r.grade)}</div><div class="small muted">${pct}%</div></div></div></div>
      <div><div class="row" style="flex-wrap:wrap;gap:8px"><span class="pill ${r.passed ? 'ok' : 'bad'}">${r.passed ? 'Passed' : 'Not passed'}</span>
          <span class="pill">${cap(r.level)} level</span><span class="pill">${esc(howTxt)}</span></div>
        <h1 class="mt16">${esc(r.subject)}</h1>
        <p class="muted" style="margin:6px 0 0">${r.raw_grade && r.raw_grade !== r.grade ? `Your score reached <b style="color:var(--ink)">${esc(r.raw_grade)}</b>; the ${cap(r.level)} level caps the grade at <b style="color:var(--ink)">${esc(r.grade)}</b>.` : 'Grade based on the marks you scored on your chosen level.'}</p>
        <div class="kpis"><div><b>${r.score}<span class="muted" style="font-size:15px">/${r.max}</span></b><small>Marks</small></div>
          <div><b>${r.correct}</b><small>Correct of ${r.total}</small></div><div><b>${r.answered}</b><small>Answered</small></div>
          <div><b>${used ?? '—'}<span class="muted" style="font-size:15px"> min</span></b><small>Time used</small></div></div></div></div>
    </div>
    <div class="grid mt16" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <div class="card"><h3>📩 Report emailed</h3><p class="muted small" style="margin:6px 0 0">A copy of this result is on its way to ${esc(ME.student?.email || 'your inbox')}.</p></div>
      <div class="card"><h3>🛠 Practical paper next</h3><p class="muted small" style="margin:6px 0 0">After the theory exam, the Academic Head shares your practical paper by email. Keep an eye on your inbox.</p></div>
    </div>
    <div class="card mt16" style="text-align:center"><h3>Want to learn from this paper?</h3>
      <p class="muted small">See every question with the right answer and a short explanation — or finish now.</p>
      <div class="row mt16" style="justify-content:center;flex-wrap:wrap"><a class="btn pri lg" href="#/review/${r.attempt_id}">Review & learn</a><a class="btn lg" href="#/">Finish & exit</a></div></div>
  `, fam);
}

async function reviewView(id) {
  shell('<div class="spin"></div>');
  let r; try { r = await getResult(id); } catch (e) { return fatal(errText(e)); }
  let f = 'all';
  const draw = () => {
    const items = r.review.filter((q) => f === 'all' || (f === 'wrong' && q.your != null && q.your !== q.correct) || (f === 'skip' && q.your == null) || (f === 'right' && q.your === q.correct));
    $('#rvl').innerHTML = items.map((q) => `<div class="rv"><div class="spread"><b>Q${q.n}</b><div class="row" style="gap:6px"><span class="pill">${q.marks} marks</span>
        ${q.your == null ? '<span class="pill">Not answered</span>' : q.your === q.correct ? '<span class="pill ok">Correct</span>' : '<span class="pill bad">Wrong</span>'}</div></div>
      <div class="mt8" style="font-size:16px;white-space:pre-wrap">${esc(q.q)}</div>${q.img ? `<img class="qimg mt8" src="${esc(q.img)}">` : ''}
      ${q.options.map((o, i) => `<div class="o ${i === q.correct ? 'c' : i === q.your ? 'w' : ''}"><b>${'ABCDEFGH'[i]}</b><span style="flex:1">${esc(o)}</span>${i === q.correct ? '✓' : i === q.your ? 'your answer' : ''}</div>`).join('')}
      ${q.explanation ? `<div class="ex">💡 ${esc(q.explanation)}</div>` : ''}</div>`).join('') || '<div class="empty mt16">Nothing here.</div>';
    $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.f === f));
  };
  const wrong = r.review.filter((q) => q.your != null && q.your !== q.correct).length, skip = r.review.filter((q) => q.your == null).length;
  shell(`<div class="phead"><div class="crumb"><a href="#/">Home</a> › <a href="#/r/${id}">Result</a> › <span>Review</span></div>
      <div class="spread"><h1>${esc(r.subject)} · review</h1><a class="btn" href="#/">Finish & exit</a></div></div>
    <div class="tabs"><button class="tab" data-f="all">All ${r.review.length}</button><button class="tab" data-f="wrong">Wrong ${wrong}</button>
      <button class="tab" data-f="skip">Not answered ${skip}</button><button class="tab" data-f="right">Correct ${r.correct}</button></div>
    <div id="rvl"></div>`, r.family);
  $$('.tab').forEach((t) => (t.onclick = () => { f = t.dataset.f; draw(); }));
  draw();
}

boot();

// ---------------------------------------------------------------- specialisation + practical papers
const LVL3 = { easy: ['Basic', 'B+'], medium: ['Standard', 'A'], hard: ['Advanced', 'A+'] };
const hrs = (m) => (m >= 1440 ? `${Math.round(m / 1440)} days` : `${Math.round((m / 60) * 10) / 10} h`);
function specBlock(c, pr) {
  if (!pr.specs?.length) return '';
  if (pr.spec) return `<div class="card spec-chosen mt16"><div class="spread"><div><div class="small muted">Your specialisation</div><h3>${esc(pr.spec.name)}</h3></div>
    <span class="pill ok">Locked in</span></div><div class="small muted mt8">Your specialisation papers follow this choice. To change it, meet the Academic Head.</div></div>`;
  return `<div class="card spec-pick mt16"><h3>Choose your specialisation</h3>
    <p class="small muted" style="margin:6px 0 0">This decides your specialisation paper and portfolio focus. Choose carefully — you can't change it yourself later.</p>
    <div class="grid specs mt16">${pr.specs.map((s) => `<button class="spec" data-spec="${s.id}"><b>${esc(s.name)}</b><span>${esc(s.blurb || '')}</span></button>`).join('')}</div></div>`;
}
function bindSpec(c, pr) {
  $$('[data-spec]').forEach((b) => (b.onclick = async () => {
    const sp = pr.specs.find((x) => x.id === b.dataset.spec);
    if (!(await confirmBox(`Choose ${sp.name}?`, `Your specialisation for ${esc(c.name)} will be <b>${esc(sp.name)}</b>. Only the Academic Head can change it after this.`, 'Confirm specialisation'))) return;
    try { await api('exam_spec_choose', { p_course: c.id, p_spec: sp.id }); toast('Specialisation saved.', 'ok'); await refresh(); courseView(c.id); }
    catch (e) { toast(errText(e), 'bad'); }
  }));
}
const isSW = (p) => String(p.id || '').startsWith('msw_');
const swOf = (p) => (p.reqs || [])[0] || (Object.values(PR).flatMap((c) => c.papers || []).find((x) => x.id === p.id)?.reqs || [])[0] || { id: String(p.id).slice(4), short: String(p.title || p.id).replace(/^Adobe\s+/, '').slice(0, 2) };
const pLabel = (p) => (isSW(p) ? 'Software practical' : `Module ${p.module} · Paper ${p.paper}`);
const pIcon = (p) => (isSW(p) ? swTile(swOf(p).id, swOf(p).short || swOf(p).name || '') : `<div class="sicon prac"><small>M${p.module}</small>P${p.paper}</div>`);
function pracBlock(c, pr) {
  if (!pr.papers?.length) return '';
  const key = (p) => (isSW(p) ? 'sw' : p.module);
  const mods = [...new Set(pr.papers.map(key))];
  const allSW = pr.papers.every(isSW);
  return `<h2 class="sech">Practical papers</h2>
    <p class="small muted" style="margin:-4px 0 12px">150 marks each. ${allSW ? 'One practical per software — it unlocks once you pass that software\'s theory exam. The timer starts the moment you open a paper.' : 'The timer starts the moment you open a paper — you get the question paper and the asset pack together.'}</p>
    ${mods.map((m) => `<div class="modrow"><div class="modlab">${m === 'sw' ? 'Software' : 'Module ' + m}</div><div class="grid subjects">${pr.papers.filter((p) => key(p) === m).map((p) => pracCard(p)).join('')}</div></div>`).join('')}`;
}
function pracCard(p) {
  const a = p.attempt; let status = '', action = '';
  switch (p.state) {
    case 'ready': status = `<span class="pill ok"><span class="dot pulse"></span>Ready to start</span>`;
      action = `<button class="btn pri sm" data-pstart="${p.id}">Start practical</button>`; break;
    case 'theory': status = `<span class="pill">Pass theory first</span>`;
      action = `<div class="small muted">Needs: ${p.missing.map((m) => `<b style="color:var(--ink)">${esc(m.name)}</b>`).join(', ')}</div>`; break;
    case 'spec': status = `<span class="pill warn">Choose specialisation</span>`; action = `<div class="small muted">Pick your specialisation above.</div>`; break;
    case 'preparing': status = `<span class="pill warn">Paper being prepared</span>`; action = `<div class="small muted">You'll be informed when it's ready.</div>`; break;
    case 'in_progress': status = `<span class="pill bad"><span class="dot pulse"></span>In progress</span>`;
      action = `<div class="small" style="color:var(--ink)">Submit by ${fmtDT(a.deadline_at)}</div><a class="btn pri sm mt8" href="#/p/${a.id}">Open paper</a>`; break;
    case 'submitted': status = `<span class="pill info">Submitted · awaiting marks</span>`;
      action = `<a class="btn sm" href="#/p/${a.id}">View submission</a>`; break;
    case 'marked': status = `<span class="pill ${a.passed ? 'ok' : 'bad'}">${a.passed ? 'Passed' : 'Not passed'} · ${a.total}/${p.marks}</span>`;
      action = `<a class="btn sm" href="#/p/${a.id}">View marks</a>`; break;
  }
  const best = a?.grade ? `<span class="gradechip ${a.passed ? '' : 'f'}">${esc(a.grade)}</span>` : '';
  return `<div class="scard ${p.state === 'ready' || p.state === 'in_progress' ? 'ready' : ''} ${['theory', 'preparing', 'spec'].includes(p.state) ? 'locked' : ''}">
    ${pIcon(p)}
    <div class="body"><div class="seq">${pLabel(p).toUpperCase()}</div><div class="spread"><h4>${esc(p.title)}</h4>${best}</div>
      ${(p.reqs || []).length && !isSW(p) ? `<div class="swmix">${p.reqs.map((x) => { const c = SW[x.id] || ['#8a8f99', '#3b3f47']; return `<i style="--c1:${c[0]};--c2:${c[1]}" title="${esc(x.name)}${x.any ? ' (any one)' : ''}">${esc(x.short || x.id)}</i>`; }).join('')}</div>` : ''}
      <div class="tiny dim">${p.marks} marks · ${hrs(p.work_min)} of work · ${hrs(p.window_min)} to submit</div>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin:8px 0 12px">${status}</div>${action}</div></div>`;
}
function bindPrac(c, pr) {
  $$('[data-pstart]').forEach((b) => (b.onclick = () => pracStartModal(c, pr.papers.find((p) => p.id === b.dataset.pstart))));
}
function pracStartModal(c, p) {
  let level = 'medium';
  const ends = new Date(Date.now() + p.window_min * 60000);
  const m = modal(`<div class="small muted">${pLabel(p)} · ${p.marks} marks</div><h2>${esc(p.title)}</h2>
    <p class="muted small">You'll get one of several paper options at random${isSW(p) ? ' — no asset pack: you use your own photos, footage or recordings, as the paper explains' : ', with its asset pack'}. Choose your level — it changes how much you must deliver and the highest grade you can earn.</p>
    <div class="grid levels">${['easy', 'medium', 'hard'].map((k) => `<button class="lvl ${k === level ? 'on' : ''}" data-lvl="${k}"><h3>${LVL3[k][0]}</h3>
      <div class="cap">${LVL3[k][1]}</div><div class="tiny muted">highest grade</div></button>`).join('')}</div>
    <div class="rules mt16">${[
      ['clock', 'The timer starts as soon as I click Start', `Work time is about ${hrs(p.work_min)}. I must submit by <b>${ends.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: 'numeric', minute: '2-digit' })}</b> (${hrs(p.window_min)} including breaks, renders and upload).`],
      ['wip', 'I will upload work-in-progress screenshots when asked', 'At the 2-hour and 4-hour marks. Missing check-ins are flagged to the examiner.'],
      ['own', 'The work is entirely my own', 'Only the assets in the pack and my own work. AI tools only where the paper allows it — always declared.'],
      ['files', 'I will submit source files, outputs and a 60-second walkthrough', 'One Google Drive folder shared as "Anyone with the link can view", plus a short screen recording walking through my file.'],
    ].map((r) => `<label class="rule"><input type="checkbox"><div class="box"></div><div><b>${r[1]}</b><span>${r[2]}</span></div></label>`).join('')}</div>
    <div class="row mt24" style="justify-content:flex-end"><button class="btn ghost" data-x>Not now</button><button class="btn pri" data-ok disabled>Start — timer begins</button></div>`, 'wide');
  const ok = m.el.querySelector('[data-ok]');
  $$('.lvl', m.el).forEach((b) => (b.onclick = () => { level = b.dataset.lvl; $$('.lvl', m.el).forEach((x) => x.classList.toggle('on', x === b)); }));
  $$('.rule', m.el).forEach((r) => (r.onclick = (e) => { e.preventDefault(); r.classList.toggle('on'); ok.disabled = !$$('.rule', m.el).every((x) => x.classList.contains('on')); }));
  m.el.querySelector('[data-x]').onclick = m.close;
  ok.onclick = async () => {
    ok.disabled = true; ok.textContent = 'Opening paper…';
    try { const r = await api('exam_prac_start', { p_paper: p.id, p_level: level, p_device: device() }); m.close(); sessionStorage.setItem('zp_prac_' + r.attempt_id, JSON.stringify(r)); location.hash = '#/p/' + r.attempt_id; }
    catch (e) { toast(errText(e), 'bad'); ok.disabled = false; ok.textContent = 'Start — timer begins'; }
  };
}

let pracTimer = null;
async function pracView(id) {
  clearInterval(pracTimer);
  shell('<div class="spin"></div>');
  let d; try { d = await api('exam_prac_get', { p_attempt: id }); } catch (e) { return fatal(errText(e)); }
  const P = d.paper, O = d.option, C = O.content || {};
  const off = Date.parse(d.server_now) - Date.now(), dl = Date.parse(d.deadline_at), st = Date.parse(d.started_at);
  const open = d.status === 'in_progress' || d.status === 'submitted';
  const cps = (d.checkpoint_min || [120, 240]).map((min, i) => ({ min, at: st + min * 60000, done: (d.checkpoints || [])[i] }));
  const scoreRows = d.scores ? (C.rubric || []).map(([k, mx]) => `<tr><td>${esc(k)}</td><td style="text-align:right"><b>${d.scores[k] ?? 0}</b> / ${mx}</td></tr>`).join('') : '';
  shell(`
    <div class="phead"><div class="crumb"><a href="#/">Home</a> › <a href="#/c/${encodeURIComponent(P.course_id)}">${esc(P.course)}</a> › <span>Practical</span></div>
      <div class="spread"><div class="row">${pIcon({ ...P, reqs: [] })}<div><h1>${esc(P.title)}</h1>
        <div class="muted small">${pLabel(P)} · Option ${O.no} · ${LVL3[d.level][0]} level · ${P.marks} marks</div></div></div>
        ${d.status === 'in_progress' ? `<div class="ptimer"><small>Time left to submit</small><b id="ptl">--:--</b><small>by ${fmtDT(d.deadline_at)}</small></div>` : ''}</div></div>
    ${d.status === 'marked' ? `<div class="card"><div class="spread"><div><div class="small muted">Result</div><h2>${d.total} / ${P.marks} · ${esc(d.grade)}</h2></div>
        <span class="pill ${d.passed ? 'ok' : 'bad'}">${d.passed ? 'Passed' : 'Not passed'}</span></div>
        <table class="tbl mt16">${scoreRows}</table>${d.feedback ? `<div class="ex mt16">💬 ${esc(d.feedback)}</div>` : ''}<div class="tiny dim mt8">Practical marks are reviewed and finalised by the Academic Head.</div></div>` : ''}
    <div class="grid two mt16">
      <div class="card"><h3>1 · Your question paper</h3><p class="small muted">Option ${O.no}: ${esc(O.title)}</p>
        <button class="btn pri" id="pdl">⬇ Download question paper (PDF)</button>
        ${O.asset_url ? `<a class="btn mt8" style="display:flex" href="${esc(O.asset_url)}" target="_blank" rel="noopener">📦 Open asset pack</a>` : `<div class="small muted mt8">${C.no_assets ? 'No asset pack — use your own material. The PDF lists what you need under “What you need”.' : 'No asset pack for this paper — everything you need is in the PDF.'}</div>`}</div>
      <div class="card"><h3>2 · Work-in-progress check-ins</h3><p class="small muted">Upload a screenshot of your screen (or a photo of your sheet) to Drive and paste the link when each check-in opens.</p>
        ${cps.map((c, i) => `<div class="cp ${c.done ? 'done' : ''}"><div><b>Check-in ${i + 1}</b><div class="tiny muted">${c.done ? 'Sent ' + fmtTime(c.done.at) : 'Opens ' + fmtTime(c.at)}</div></div>
          ${c.done ? '<span class="pill ok">✓ Sent</span>' : d.status === 'in_progress' ? `<button class="btn sm" data-cp="${i}" ${Date.now() + off < c.at - 10 * 60000 ? 'disabled' : ''}>Add link</button>` : '<span class="pill">Missed</span>'}</div>`).join('')}</div>
    </div>
    <div class="card mt16"><h3>3 · Final submission</h3>
      ${d.submitted_at ? `<p class="small">Submitted ${fmtDT(d.submitted_at)}${d.late_min ? ` · <b style="color:#ffb3c0">${d.late_min} min late</b>` : ''} · <a href="${esc(d.submit_link)}" target="_blank" rel="noopener">your folder ↗</a>${d.walkthrough_link ? ` · <a href="${esc(d.walkthrough_link)}" target="_blank" rel="noopener">walkthrough ↗</a>` : ''}</p>` : ''}
      ${open && d.status !== 'marked' ? `<p class="small muted">Put everything in one Google Drive folder: source files, outputs and your 60-second walkthrough video. Share it as "Anyone with the link can view".</p>
        <label class="lb">Drive folder link</label><input class="inp" id="psl" placeholder="https://drive.google.com/drive/folders/…" value="${esc(d.submit_link || '')}">
        <label class="lb">Walkthrough video link (if not inside the folder)</label><input class="inp" id="pwl" placeholder="optional" value="${esc(d.walkthrough_link || '')}">
        <label class="lb">Note to the examiner (optional)</label><textarea class="inp" id="pnt" rows="2" maxlength="1000">${esc(d.submit_note || '')}</textarea>
        <button class="btn pri mt16" id="psub">${d.submitted_at ? 'Update submission' : 'Submit practical'}</button>` : ''}</div>
  `, P.family);
  $('#pdl').onclick = async () => { toast('Preparing your PDF…'); try { const { practicalPDF } = await import('./pdf.js?v=13'); toast('Downloaded ' + (await practicalPDF(d)), 'ok'); } catch (e) { toast(errText(e), 'bad'); } };
  $$('[data-cp]').forEach((b) => (b.onclick = () => {
    const mm = modal(`<h2>Check-in ${+b.dataset.cp + 1}</h2><p class="muted small">Upload a screenshot to Drive (Anyone with the link can view) and paste the link.</p>
      <input class="inp" id="cpl" placeholder="https://drive.google.com/…"><div class="row mt24" style="justify-content:flex-end"><button class="btn ghost" data-x>Cancel</button><button class="btn pri" data-ok>Send</button></div>`);
    mm.el.querySelector('[data-x]').onclick = mm.close;
    mm.el.querySelector('[data-ok]').onclick = async () => {
      try { await api('exam_prac_checkpoint', { p_attempt: id, p_link: $('#cpl', mm.el).value.trim() }); mm.close(); toast('Check-in sent.', 'ok'); pracView(id); } catch (e) { toast(errText(e), 'bad'); }
    };
  }));
  $('#psub') && ($('#psub').onclick = async () => {
    const link = $('#psl').value.trim();
    if (!/^https:\/\/\S+\.\S+/.test(link)) return toast('Paste your Drive folder link (starting with https://).', 'bad');
    if (!d.submitted_at && !(await confirmBox('Submit your practical?', 'You can still update the link until your marks are given, but the submission time is recorded now.', 'Submit'))) return;
    try { await api('exam_prac_submit', { p_attempt: id, p_link: link, p_walkthrough: $('#pwl').value.trim(), p_note: $('#pnt').value.trim() || null }); toast('Submitted. Your examiner will mark it.', 'ok'); await refresh(); pracView(id); }
    catch (e) { toast(errText(e), 'bad'); }
  });
  if (d.status === 'in_progress') {
    const tick = () => { const el = $('#ptl'); if (!el) return clearInterval(pracTimer); const left = dl - (Date.now() + off); el.textContent = mmss(left); el.classList.toggle('low', left < 30 * 60000); };
    tick(); pracTimer = setInterval(tick, 1000);
  }
}

