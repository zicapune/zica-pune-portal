// ZICA Pune Portal · Admin panel
import { sb, rpc, $, $$, esc, toast, modal, confirmBox, errText, device, topBar, signInScreen, signOut,
         fmtDate, fmtTime, fmtRange, fmtDT, ago, mmss, initials } from './common.js';

const root = $('#admin');
let META = null, ME = null, timer = null;
const S = { tab: 'dash', course: '', scope: 'active', q: '', sel: new Set() };
const LV = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return signInScreen(root, 'Exam <span>Admin</span>', 'Academic Head and admin accounts only.');
  try {
    META = await rpc('exam_admin_meta');
    ME = META.is_admin ? await rpc('exam_admin_overview') : { me: META.me, counts: {} };
    if (!sessionStorage.getItem('za_in')) { rpc('exam_event', { p_attempt: null, p_kind: META.is_admin ? 'admin_login' : 'staff_login', p_detail: device() }).catch(() => {}); sessionStorage.setItem('za_in', '1'); }
  } catch (e) {
    root.innerHTML = topBar({ email: session.user.email, name: session.user.email }) +
      `<section class="hero"><div class="box"><div class="bigic b" style="margin:0 auto 14px">!</div><h2>${esc(errText(e))}</h2>
       <p class="muted">Signed in as ${esc(session.user.email)}.</p><button class="btn mt16" data-signout>Use another account</button></div></section>`;
    return bindTop();
  }
  window.addEventListener('hashchange', route);
  route();
}
function bindTop() { $$('[data-signout]').forEach((b) => (b.onclick = signOut)); }

const ADMIN_TABS = [['dash', 'Dashboard'], ['requests', 'Requests'], ['students', 'Students'], ['slots', 'Slots'], ['subs', 'Assignments'], ['banks', 'Question banks'], ['settings', 'Settings']];
const STAFF_TABS = [['subs', 'Assignment reviews']];
const tabs = () => (META?.is_admin ? ADMIN_TABS : STAFF_TABS);
function frame(inner) {
  const c = ME?.counts || {}, live = c.live || 0, req = (c.requests || 0) + (c.claims || 0), sub = c.submissions || 0;
  root.innerHTML = topBar({ email: ME.me, name: ME.me }, META.is_admin ? `<a class="btn sm ghost" href="./" target="_blank">Student view ↗</a>` : '<span class="pill">Faculty</span>') +
    `<nav class="anav"><div class="wrap">${tabs().map(([k, t]) => `<a href="#/${k}" class="${S.tab === k ? 'on' : ''}">${t}${
      k === 'dash' && live ? `<span class="pill bad">${live} live</span>` : k === 'requests' && req ? `<span class="pill warn">${req}</span>` : k === 'subs' && sub ? `<span class="pill info">${sub}</span>` : ''}</a>`).join('')}</div></nav>
    <main class="wrap" id="pg">${inner}</main><div class="foot">ZICA Pune Portal · ${META.is_admin ? 'Exam admin' : 'Faculty'}</div>`;
  bindTop();
}
async function counts() { if (META.is_admin) try { ME = await rpc('exam_admin_overview'); } catch {} }
function route() {
  clearInterval(timer);
  $$('.ov').forEach((o) => o.remove());
  const p = location.hash.replace(/^#\/?/, '').split('/');
  S.tab = tabs().some((t) => t[0] === p[0]) ? p[0] : tabs()[0][0];
  if (p[0] === 'students' && p[1] !== undefined) S.course = decodeURIComponent(p[1] || '');
  ({ dash, requests, students, slots, subs, banks, settings })[S.tab]();
}
const subjName = (id) => META.subjects.find((s) => s.id === id)?.name || id;
const subjShort = (id) => META.subjects.find((s) => s.id === id)?.short || id;

// ================================================================= dashboard
async function dash() {
  const draw = async () => {
    try { ME = await rpc('exam_admin_overview'); } catch (e) { return toast(errText(e), 'bad'); }
    const c = ME.counts;
    const off = Date.parse(ME.server_now) - Date.now();
    frame(`
      <div class="phead spread"><div><h1>Exam control room</h1><div class="small muted">Auto-refreshes every 15 seconds · ${fmtDT(ME.server_now)}</div></div>
        <div class="row"><a class="btn" href="#/slots">+ Schedule exam slot</a><a class="btn pri" href="#/students">Students & unlocks</a></div></div>
      <div class="grid kpi">
        <div><b>${c.students}</b><small>Students on portal</small></div>
        <div><b>${c.active}</b><small>Active (in progress / on hold)</small></div>
        <div><b>${c.logged_in}</b><small>Have logged in</small></div>
        <div class="${c.live ? 'hot' : ''}"><b>${c.live}</b><small>Live exams now${c.paused ? ` · ${c.paused} paused` : ''}</small></div>
        <div><b>${c.done_today}</b><small>Finished today</small></div>
        <div><b>${c.done ? Math.round((c.passed / c.done) * 100) : 0}%</b><small>Pass rate (${c.passed}/${c.done})</small></div>
        <a href="#/requests" class="${c.requests + c.claims ? 'hot' : ''}" style="text-decoration:none;color:inherit"><b>${c.requests + c.claims}</b><small>Requests waiting${c.claims ? ` · ${c.claims} account links` : ''}</small></a>
        <a href="#/subs" style="text-decoration:none;color:inherit"><b>${c.submissions}</b><small>Assignments to review</small></a>
        <div><b>${c.today}</b><small>Exam slots today</small></div>
      </div>
      ${ME.upcoming?.length ? `<div class="card mt24"><div class="spread"><h3>Next 48 hours</h3><a class="small" href="#/slots">All slots ›</a></div>
        <div class="tscroll mt16" style="max-height:320px"><table class="tbl"><tr><th>When</th><th>Subject</th><th>Students</th></tr>
        ${ME.upcoming.map((u) => `<tr><td style="white-space:nowrap">${fmtRange(u.starts_at, u.ends_at)}</td><td>${esc(u.subject || 'Any')}</td><td class="small">${esc((u.names || []).join(', '))}</td></tr>`).join('')}</table></div></div>` : ''}
      <div class="card mt24"><div class="spread"><h3>Live exams</h3><span class="small muted">Max 20 at a time</span></div>
        ${ME.live.length ? `<div class="tscroll mt16" style="max-height:none"><table class="tbl"><tr><th>Student</th><th>Subject</th><th>Level</th><th>Answered</th><th>Warnings</th><th>Time left</th><th>Status</th><th></th></tr>
        ${ME.live.map((l) => `<tr><td><a href="#" data-stu="${l.student_id}"><b>${esc(l.name)}</b></a><div class="tiny dim">${esc(l.email)}</div></td>
          <td>${esc(l.subject)}</td><td>${LV[l.level]}</td><td>${l.answered}/${l.total}</td>
          <td><span class="pill ${l.violations ? 'warn' : ''}">${l.violations}</span></td>
          <td style="font-variant-numeric:tabular-nums"><b data-dl="${l.deadline_at}">${mmss(Date.parse(l.deadline_at) - Date.now() - off)}</b></td>
          <td>${l.status === 'paused' ? '<span class="pill bad">Paused</span>' : '<span class="pill ok"><span class="dot pulse"></span>Writing</span>'}</td>
          <td><div class="row" style="gap:6px;justify-content:flex-end">${l.status === 'paused'
            ? `<button class="btn sm ok" data-act="resume" data-a="${l.attempt_id}">Resume</button>`
            : `<button class="btn sm" data-act="extend" data-a="${l.attempt_id}">+ time</button>`}
            <button class="btn sm bad" data-act="end" data-a="${l.attempt_id}">End</button></div></td></tr>`).join('')}</table></div>`
        : '<div class="empty mt16">Nobody is writing an exam right now.</div>'}</div>
      <div class="grid mt24" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
        <div><h3>Courses</h3><div class="grid courses">${ME.courses.map((co) => `
          <a class="ccard" data-fam="${co.family}" href="#/students/${encodeURIComponent(co.id)}" style="text-decoration:none;min-height:150px">
            <h3>${esc(co.name)}</h3><div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill">${co.students} students</span>
            <span class="pill info">${co.active} active</span><span class="pill ok">${co.done} exams done</span></div></a>`).join('')}</div></div>
        <div><h3>Activity</h3><div class="feed mt16">${ME.feed.map((f) => `<div><span class="pill ${feedCls(f.kind)}">${esc(f.kind.replace('_', ' '))}</span>
          <span style="flex:1;min-width:0"><b>${esc(f.name || '—')}</b> ${f.subject ? '· ' + esc(f.subject) : ''}${feedDetail(f)}</span><span class="tiny dim">${ago(f.at)}</span></div>`).join('') || '<div class="empty">No activity yet.</div>'}</div></div>
      </div>`);
    $$('[data-stu]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); studentDrawer(a.dataset.stu); }));
    $$('[data-act]').forEach((b) => (b.onclick = () => attemptAction(b.dataset.a, b.dataset.act, draw)));
  };
  await draw();
  timer = setInterval(() => { if (!$('.ov') && !$('.drawer') && S.tab === 'dash') draw(); }, 15000);
}
setInterval(() => $$('[data-dl]').forEach((b) => (b.textContent = mmss(Date.parse(b.dataset.dl) - Date.now()))), 1000);
const feedCls = (k) => ({ violation: 'warn', paused: 'bad', finished: 'ok', start: 'info', absence_request: 'warn', booking_request: 'warn', booking_approved: 'ok', assignment_submit: 'info', claim: 'warn', admin: 'mark' }[k] || '');
const feedDetail = (f) => {
  const d = f.detail || {};
  if (f.kind === 'violation') return ` · ${esc(d.kind)} #${d.n}`;
  if (f.kind === 'finished') return ` · <b>${esc(d.grade)}</b> ${d.score}/${d.max}`;
  if (f.kind === 'start') return ` · ${esc(d.level || '')}`;
  if (f.kind === 'login' && d.registered === false) return ' · <span style="color:#ffb3c0">not registered</span>';
  if (f.kind === 'admin') return ` · ${esc(d.action || '')}`;
  if (f.kind === 'booking_request') return ` · ${d.at ? fmtDT(d.at) : ''} ${d.kind && d.kind !== 'new' ? '(' + esc(d.kind) + ')' : ''}`;
  if (f.kind === 'booking_approved') return ` · ${d.at ? fmtDT(d.at) : ''}`;
  if (f.kind === 'assignment_submit') return ` · ${esc(d.code || '')}`;
  return '';
};

async function attemptAction(id, act, after) {
  if (act === 'end') {
    if (!(await confirmBox('End this exam now?', 'It will be scored on the answers given so far.', 'End exam', true))) return;
    return run(() => rpc('exam_admin_attempt', { p_attempt: id, p_action: 'end', p_minutes: 0 }), 'Exam ended', after);
  }
  const m = modal(`<h2>${act === 'resume' ? 'Resume paused exam' : 'Give extra time'}</h2>
    <p class="muted">${act === 'resume' ? 'The student can continue. Optionally add minutes to cover the paused time.' : 'Add minutes to this student\'s timer.'}</p>
    <label class="lb">Extra minutes</label><select class="inp" id="mins">${[0, 5, 10, 15, 20, 30].map((n) => `<option ${n === (act === 'resume' ? 0 : 10) ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <div class="row mt24" style="justify-content:flex-end"><button class="btn ghost" data-x>Cancel</button><button class="btn pri" data-ok>${act === 'resume' ? 'Resume exam' : 'Add time'}</button></div>`);
  m.el.querySelector('[data-x]').onclick = m.close;
  m.el.querySelector('[data-ok]').onclick = () => { const n = +$('#mins', m.el).value; m.close();
    run(() => rpc('exam_admin_attempt', { p_attempt: id, p_action: act, p_minutes: n }), act === 'resume' ? 'Exam resumed' : `+${n} minutes added`, after); };
}
async function run(fn, okMsg, after) {
  try { await fn(); if (okMsg) toast(okMsg, 'ok'); after && (await after()); } catch (e) { toast(errText(e), 'bad'); }
}

// ================================================================= students matrix
async function students() {
  frame(`<div class="phead"><h1>Students & exam unlocks</h1><div class="small muted">Tap a cell to unlock / lock, set a fixed level or give an extra attempt. Tap a name for the full record.</div></div>
    <div class="toolbar"><select class="inp" id="fc"><option value="">All courses</option>${META.courses.map((c) => `<option value="${c.id}" ${S.course === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <select class="inp" id="fs">${[['active', 'Active (in progress / on hold)'], ['completed', 'Completed / placed'], ['all', 'All statuses']].map(([v, t]) => `<option value="${v}" ${S.scope === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <input class="inp" id="fq" placeholder="Search name or email" value="${esc(S.q)}" style="flex:1">
      <button class="btn" id="addStu">+ Add student</button></div>
    <div id="mx"><div class="spin"></div></div>`);
  $('#fc').onchange = (e) => { S.course = e.target.value; S.sel.clear(); location.hash = '#/students/' + encodeURIComponent(S.course); };
  $('#fs').onchange = (e) => { S.scope = e.target.value; S.sel.clear(); load(); };
  $('#fq').oninput = (e) => { S.q = e.target.value; draw(); };
  $('#addStu').onclick = () => studentForm(null, load);
  let D = null;
  const load = async () => {
    $('#mx').innerHTML = '<div class="spin"></div>';
    try { D = await rpc('exam_admin_course', { p_course: S.course || null, p_scope: S.scope }); } catch (e) { return toast(errText(e), 'bad'); }
    draw();
  };
  const draw = () => {
    if (!D) return;
    const q = S.q.trim().toLowerCase();
    const rows = D.students.filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.includes(q));
    const subs = D.subjects;
    $('#mx').innerHTML = !rows.length ? '<div class="empty">No students match.</div>' : `
      <div class="small muted" style="margin-bottom:8px">${rows.length} students · ${subs.length} subjects ·
        <span class="cb open" style="display:inline-grid;place-items:center;height:20px;width:auto;padding:0 6px">open</span> unlocked ·
        <span class="cb lk" style="display:inline-grid;place-items:center;height:20px;width:30px"></span> locked ·
        <span class="cb ext" style="display:inline-grid;place-items:center;height:20px;width:auto;padding:0 6px">✓</span> done earlier ·
        <span class="cb req" style="display:inline-grid;place-items:center;height:20px;width:auto;padding:0 6px">REQ</span> date requested ·
        corner dot = override</div>
      <div class="tscroll"><table class="tbl matrix"><tr><th class="nm"><label class="row" style="gap:8px"><input type="checkbox" id="all"> Student</label></th><th>Status</th><th>ID</th><th>Logins</th>
        ${subs.map((s) => `<th class="sub" title="${esc(s.name)}">${esc(s.short || s.name)}</th>`).join('')}</tr>
      ${rows.map((s) => `<tr><td class="nm"><div class="row" style="gap:8px"><input type="checkbox" data-sel="${s.id}" ${S.sel.has(s.id) ? 'checked' : ''}>
          <div class="who2" data-stu="${s.id}"><b>${esc(s.name)}${s.test ? ' <span class="pill mark">test</span>' : ''}</b><span class="tiny dim">${esc(s.email)}</span></div></div></td>
        <td><span class="pill ${/progress/i.test(s.status) ? 'info' : /hold/i.test(s.status) ? 'warn' : ''}">${esc(shortStatus(s.status))}</span></td>
        <td class="tiny dim">${esc(s.code || '')}</td>
        <td class="small">${s.logins ? `${s.logins} · ${ago(s.last_login)}` : '<span class="dim">never</span>'}</td>
        ${subs.map((sj) => cellHtml(s, sj)).join('')}</tr>`).join('')}</table></div>
      <div class="bulk ${S.sel.size ? '' : 'hide'}" id="bulk"><b>${S.sel.size} selected</b>
        <select class="inp" id="bsub" style="width:auto">${subs.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}<option value="__all">All subjects shown</option></select>
        <button class="btn sm ok" data-b="unlock">Unlock</button><button class="btn sm" data-b="lock">Lock</button>
        <select class="inp" id="blv" style="width:auto"><option value="-">Level: keep</option><option value="">Student chooses</option><option value="easy">Fix Easy</option><option value="medium">Fix Medium</option><option value="hard">Fix Hard</option></select>
        <button class="btn sm" data-b="level">Apply level</button>
        <button class="btn sm" data-b="ext">Mark done earlier</button><button class="btn sm ghost" data-b="unext">Undo done</button>
        <select class="inp" id="bov" style="width:auto"><option value="auto">Eligibility: auto</option><option value="allow">Allow (skip order & assignments)</option><option value="block">Block</option></select>
        <button class="btn sm" data-b="ov">Apply</button>
        <button class="btn sm pri" data-b="slot">Schedule slot for them</button>
        <button class="btn sm ghost" data-b="clear">Clear</button></div>`;
    $$('[data-stu]').forEach((a) => (a.onclick = () => studentDrawer(a.dataset.stu, load)));
    $$('[data-cell]').forEach((b) => (b.onclick = () => cellModal(rows.find((r) => r.id === b.dataset.cell), b.dataset.sub, load)));
    $$('[data-sel]').forEach((c) => (c.onchange = () => { c.checked ? S.sel.add(c.dataset.sel) : S.sel.delete(c.dataset.sel); draw(); }));
    $('#all') && ($('#all').onchange = (e) => { rows.forEach((r) => (e.target.checked ? S.sel.add(r.id) : S.sel.delete(r.id))); draw(); });
    $$('[data-b]').forEach((b) => (b.onclick = () => bulk(b.dataset.b, subs, load)));
  };
  const bulk = async (act, subs, after) => {
    const ids = [...S.sel]; const sub = $('#bsub').value; const sjs = sub === '__all' ? subs.map((s) => s.id) : [sub];
    if (act === 'clear') { S.sel.clear(); return draw(); }
    if (act === 'slot') return slotForm({ members: ids, subject_id: sub === '__all' ? '' : sub }, () => { S.sel.clear(); load(); });
    let p;
    if (act === 'unlock') p = { unlocked: true }; else if (act === 'lock') p = { unlocked: false };
    else if (act === 'ext') p = { done_external: true, ext_note: 'Completed earlier' };
    else if (act === 'unext') p = { done_external: false };
    else if (act === 'ov') p = { override: $('#bov').value };
    else { const v = $('#blv').value; if (v === '-') return toast('Pick a level first'); p = { level_lock: v }; }
    await run(() => rpc('exam_admin_set_unlock', { p_students: ids, p_subjects: sjs, p }), `Updated ${ids.length} student(s)`, after);
  };
  load();
}
const shortStatus = (s) => String(s || '—').replace('Completed', 'Done').replace("Don't Need Job", 'No job').slice(0, 26);
function cellHtml(s, sj) {
  const c = s.cells[sj.id];
  if (!c) return `<td class="cell"><button class="cb" data-cell="${s.id}" data-sub="${sj.id}" title="Not unlocked">·</button></td>`;
  let cls = 'cb', txt = '';
  if (c.live) { cls += ' live'; txt = c.live === 'paused' ? 'PAUSE' : 'LIVE'; }
  else if (c.best) { cls += c.best.p ? ' pass' : ' fail'; txt = c.best.g; }
  else if (c.ext) { cls += ' ext'; txt = '✓'; }
  else if (c.bk) { cls += ' req'; txt = 'REQ'; }
  else if (c.u) { cls += ' open'; txt = c.ll ? c.ll[0].toUpperCase() : 'open'; }
  else cls += ' lk';
  if (c.ov === true) cls += ' ova'; else if (c.ov === false) cls += ' ovb';
  const tip = (c.best ? `${c.best.sc}/${c.best.mx} · ${c.best.lv} · ${c.n}/${c.ma} attempts` : `${c.u ? 'unlocked' : 'locked'} (${c.src || '—'}) · ${c.n}/${c.ma} attempts${c.ll ? ' · level ' + c.ll : ''}`)
    + (c.ext ? ' · done earlier' : '') + (c.ov === true ? ' · override: allow' : c.ov === false ? ' · override: block' : '')
    + (c.ar ? ` · assignments ${c.as} of ${c.ar}` : '') + (c.tk ? ' · ticked in Summary' : '') + (c.bk ? ' · date requested' : '');
  return `<td class="cell"><button class="${cls}" data-cell="${s.id}" data-sub="${sj.id}" title="${esc(tip)}">${esc(txt)}</button></td>`;
}
function cellModal(s, sid, after) {
  const c = s.cells[sid] || { u: false, ma: 2, n: 0 };
  const m = modal(`<div class="small muted">${esc(s.name)}</div><h2>${esc(subjName(sid))}</h2>
    <div class="row" style="gap:6px;flex-wrap:wrap">${c.best ? `<span class="pill ${c.best.p ? 'ok' : 'bad'}">Best ${esc(c.best.g)} · ${c.best.sc}/${c.best.mx} · ${c.best.lv}</span>` : ''}
      <span class="pill">${c.n} of ${c.ma} attempts used</span>${c.src ? `<span class="pill">source: ${esc(c.src)}</span>` : ''}</div>
    <label class="lb">Exam access</label>
    <div class="row"><button class="btn ${c.u ? 'ok' : ''}" data-u="1">Unlocked</button><button class="btn ${!c.u ? 'bad' : ''}" data-u="0">Locked</button></div>
    <div class="two"><div><label class="lb">Level</label><select class="inp" id="ll"><option value="">Student chooses</option>
      ${['easy', 'medium', 'hard'].map((l) => `<option value="${l}" ${c.ll === l ? 'selected' : ''}>Fixed: ${LV[l]}</option>`).join('')}</select></div>
      <div><label class="lb">Attempts allowed</label><input class="inp" type="number" min="1" max="9" id="ma" value="${c.ma || 2}"></div></div>
    <div class="two"><div><label class="lb">Eligibility</label><select class="inp" id="ov">
        <option value="auto" ${c.ov == null ? 'selected' : ''}>Auto — course order + assignments</option>
        <option value="allow" ${c.ov === true ? 'selected' : ''}>Allow — skip order & assignment checks</option>
        <option value="block" ${c.ov === false ? 'selected' : ''}>Block — on hold</option></select></div>
      <div><label class="lb">Completed earlier (no exam needed)</label><label class="row small" style="height:46px"><input type="checkbox" id="ex" ${c.ext ? 'checked' : ''}> Mark this software as done</label></div></div>
    ${c.ar ? `<div class="small muted mt8">Assignments approved ${esc(c.as)} of ${c.ar}</div>` : ''}
    <div class="row mt24" style="justify-content:space-between;flex-wrap:wrap">${c.best ? `<button class="btn ghost" data-rep="${c.best.id}">View report</button>` : '<span></span>'}
      <div class="row"><button class="btn ghost" data-x>Cancel</button><button class="btn pri" data-ok>Save</button></div></div>`);
  let u = !!c.u;
  $$('[data-u]', m.el).forEach((b) => (b.onclick = () => { u = b.dataset.u === '1'; $$('[data-u]', m.el).forEach((x) => (x.className = 'btn ' + (x.dataset.u === '1' ? (u ? 'ok' : '') : (!u ? 'bad' : '')))); }));
  m.el.querySelector('[data-x]').onclick = m.close;
  m.el.querySelector('[data-rep]')?.addEventListener('click', () => { m.close(); reportModal(c.best.id); });
  m.el.querySelector('[data-ok]').onclick = () => { m.close();
    run(() => rpc('exam_admin_set_unlock', { p_students: [s.id], p_subjects: [sid], p: { unlocked: u, level_lock: $('#ll', m.el).value, max_attempts: +$('#ma', m.el).value || 2,
      override: $('#ov', m.el).value, done_external: $('#ex', m.el).checked, ...($('#ex', m.el).checked && !c.ext ? { ext_note: 'Completed earlier' } : {}) } }), 'Saved', after); };
}

async function reportModal(attemptId) {
  let r; try { r = await rpc('exam_result', { p_attempt: attemptId }); } catch (e) { return toast(errText(e), 'bad'); }
  const m = modal(`<div class="spread"><div><div class="small muted">${esc(LV[r.level])} level · ${fmtDT(r.submitted_at)}</div><h2>${esc(r.subject)} — ${esc(r.grade)}</h2></div><button class="btn ghost" data-x>Close</button></div>
    <div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill ${r.passed ? 'ok' : 'bad'}">${r.score}/${r.max} · ${r.percent}%</span><span class="pill">${r.correct} correct · ${r.answered} answered of ${r.total}</span>
      <span class="pill warn">${r.violations} warnings</span><span class="pill">${esc(r.how)}</span></div>
    ${r.review.map((q) => `<div class="rv"><div class="spread"><b>Q${q.n}</b><span class="pill ${q.your == null ? '' : q.your === q.correct ? 'ok' : 'bad'}">${q.your == null ? 'skipped' : q.your === q.correct ? '+' + q.marks : '0'}</span></div>
      <div class="small mt8">${esc(q.q)}</div>${q.options.map((o, i) => `<div class="o ${i === q.correct ? 'c' : i === q.your ? 'w' : ''}"><b>${'ABCD'[i]}</b> ${esc(o)}</div>`).join('')}</div>`).join('')}`, 'wide');
  m.el.querySelector('[data-x]').onclick = m.close;
}

// ================================================================= student drawer
async function studentDrawer(id, after) {
  $('.drawer')?.remove();
  const d = document.createElement('div'); d.className = 'drawer'; d.innerHTML = '<div class="spin"></div>';
  document.body.appendChild(d);
  const close = () => { d.remove(); document.removeEventListener('keydown', esc1); after && after(); };
  const esc1 = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', esc1);
  let R; try { R = await rpc('exam_admin_student', { p_id: id }); } catch (e) { d.remove(); return toast(errText(e), 'bad'); }
  const s = R.student;
  d.innerHTML = `<div class="dh"><div class="avatar" style="width:44px;height:44px">${esc(initials(s.name))}</div>
      <div style="flex:1;min-width:0"><h3>${esc(s.name)}</h3><div class="small muted">${esc(s.email)}${s.alt_emails?.length ? ' · alt: ' + esc(s.alt_emails.join(', ')) : ''}</div></div>
      <button class="btn sm" data-edit>Edit</button><button class="btn sm ghost" data-close>✕</button></div>
    <div class="db">
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill info">${esc(s.status || '—')}</span>${s.blocked ? '<span class="pill bad">Blocked</span>' : ''}
        ${s.cert_given ? '<span class="pill ok">Certificate given</span>' : ''}<span class="pill">${s.login_count} logins · last ${ago(s.last_login)}</span>
        ${s.first_login ? `<span class="pill">first ${fmtDT(s.first_login)}</span>` : ''}</div>
      <div class="small muted mt8">${s.zica_code || s.student_code ? `ID <b style="color:var(--ink)">${esc(s.zica_code || s.student_code)}</b> · ` : ''}${R.courses.map((c) => esc(c.name)).join(' · ') || 'No course linked'}</div>
      ${s.notes ? `<div class="small mt8" style="color:#fcd34d">Note: ${esc(s.notes)}</div>` : ''}

      <div class="sec"><h4>Subjects</h4><div class="tscroll" style="max-height:none"><table class="tbl"><tr><th>Subject</th><th>State</th><th>Access</th><th>Level</th><th>Attempts</th><th>Eligibility</th></tr>
        ${R.subjects.map((x) => `<tr><td><b>${esc(x.name)}</b>${x.ticked ? ' <span class="tiny dim" title="Ticked in Summary">✓S</span>' : ''}
            ${x.assign?.req ? `<div class="tiny dim">assignments ${x.assign.approved}/${x.assign.req}</div>` : ''}</td>
          <td><span class="pill ${stCls(x.state)}" title="${esc(x.seq_block ? 'after ' + x.seq_block : '')}">${esc(ST_LBL[x.state] || x.state)}</span></td>
          <td><button class="btn sm ${x.unlocked ? 'ok' : ''}" data-tog="${x.id}" data-v="${x.unlocked ? 0 : 1}">${x.unlocked ? 'Unlocked' : '🔒 Locked'}</button></td>
          <td><select class="inp" style="padding:6px 8px" data-lvl="${x.id}"><option value="">Student chooses</option>${['easy', 'medium', 'hard'].map((l) => `<option value="${l}" ${x.level_lock === l ? 'selected' : ''}>${LV[l]}</option>`).join('')}</select></td>
          <td><input class="inp" style="padding:6px 8px;width:64px" type="number" min="1" max="9" value="${x.max_attempts}" data-ma="${x.id}"><span class="tiny dim"> used ${x.used}</span></td>
          <td><select class="inp" style="padding:6px 8px" data-ov="${x.id}">
            <option value="auto" ${x.override == null && !x.done_external ? 'selected' : ''}>Auto</option><option value="allow" ${x.override === true ? 'selected' : ''}>Allow</option>
            <option value="block" ${x.override === false ? 'selected' : ''}>Block</option><option value="ext" ${x.done_external ? 'selected' : ''}>Done earlier</option></select></td></tr>`).join('')}</table></div></div>

      ${R.bookings.length ? `<div class="sec"><h4>Exam date requests</h4>${R.bookings.map((b) => `<div class="rv" style="margin-top:8px"><div class="spread">
          <div><b>${esc(b.subject || '—')}</b> <span class="small muted">· ${b.want_at ? fmtDT(b.want_at) : 'no time'} · ${esc(b.kind)} · via ${esc(b.source)}</span></div>
          <span class="pill ${b.status === 'pending' ? 'warn' : b.status === 'approved' ? 'ok' : ''}">${esc(b.status)}</span></div>
          ${b.note ? `<div class="small mt8">${esc(b.note)}</div>` : ''}</div>`).join('')}</div>` : ''}

      ${R.submissions.length ? `<div class="sec"><h4>Assignment submissions</h4>${R.submissions.map((x) => `<div class="rv" style="margin-top:8px"><div class="spread">
          <div><b>${esc(subjShort(x.subject))} · ${esc(x.code)}</b> <span class="small muted">${esc(x.title)} · ${fmtDT(x.at)}</span></div>
          <div class="row" style="gap:6px"><a class="btn sm" href="${esc(x.link)}" target="_blank" rel="noopener">Open ↗</a><span class="pill ${x.status === 'approved' ? 'ok' : x.status === 'redo' ? 'bad' : 'info'}">${esc(x.status)}</span></div></div>
          ${x.feedback ? `<div class="small muted mt8">${esc(x.feedback)}</div>` : ''}</div>`).join('')}</div>` : ''}

      <div class="sec"><h4>Attempts</h4>${R.attempts.length ? R.attempts.map((a) => `<div class="rv" style="margin-top:8px"><div class="spread">
          <div><b>${esc(a.subject)}</b> <span class="small muted">· ${LV[a.level]} · ${fmtDT(a.started_at)}</span></div>
          ${a.status === 'done' ? `<span class="pill ${a.passed ? 'ok' : 'bad'}">${esc(a.grade)} · ${a.score}/${a.max}</span>` : `<span class="pill ${a.status === 'paused' ? 'bad' : 'info'}">${a.status}</span>`}</div>
          <div class="small muted mt8">Answered ${a.answered}/${a.total} · warnings ${a.violations} · ${esc(a.how || 'running')}${a.submitted_at ? ' · ended ' + fmtTime(a.submitted_at) : ' · deadline ' + fmtTime(a.deadline_at)}
            ${a.device?.ua ? `<br><span class="tiny dim">${esc(a.device.ua.slice(0, 110))}</span>` : ''}</div>
          <div class="row mt8" style="gap:6px">${a.status === 'done' ? `<button class="btn sm" data-rep="${a.id}">Question-wise report</button>`
            : `${a.status === 'paused' ? `<button class="btn sm ok" data-act="resume" data-a="${a.id}">Resume</button>` : `<button class="btn sm" data-act="extend" data-a="${a.id}">+ time</button>`}
               <button class="btn sm bad" data-act="end" data-a="${a.id}">End</button>`}</div></div>`).join('') : '<div class="empty">No attempts yet.</div>'}</div>

      <div class="sec"><h4>Camera snapshots (${R.snapshots.length})</h4>${R.snapshots.length ? `<div class="snaps">${R.snapshots.map((x) => `
        <div class="snap ${x.kind?.startsWith('violation') ? 'v' : ''}" data-snap="${x.id}"><div class="im">${x.has_image ? 'tap to load' : 'in Drive'}</div>
          <div class="t">${esc(x.kind)}<br>${fmtDT(x.at)}</div></div>`).join('')}</div>` : '<div class="empty">No snapshots.</div>'}</div>


      <div class="sec"><h4>Activity log</h4><div class="tl">${R.events.map((e) => `<div><time>${fmtDT(e.at)}</time><b>${esc(e.kind)}</b>
        <span class="muted" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${e.subject ? esc(subjShort(e.subject)) + ' · ' : ''}${esc(evDetail(e))}</span></div>`).join('') || '<div>No activity.</div>'}</div></div>
    </div>`;
  const reload = () => studentDrawer(id, after);
  d.querySelector('[data-close]').onclick = close;
  d.querySelector('[data-edit]').onclick = () => studentForm(R, reload);
  $$('[data-tog]', d).forEach((b) => (b.onclick = () => run(() => rpc('exam_admin_set_unlock', { p_students: [id], p_subjects: [b.dataset.tog], p: { unlocked: b.dataset.v === '1' } }), 'Saved', reload)));
  $$('[data-lvl]', d).forEach((b) => (b.onchange = () => run(() => rpc('exam_admin_set_unlock', { p_students: [id], p_subjects: [b.dataset.lvl], p: { level_lock: b.value } }), 'Level saved')));
  $$('[data-ma]', d).forEach((b) => (b.onchange = () => run(() => rpc('exam_admin_set_unlock', { p_students: [id], p_subjects: [b.dataset.ma], p: { max_attempts: +b.value } }), 'Attempts saved')));
  $$('[data-ov]', d).forEach((b) => (b.onchange = () => run(() => rpc('exam_admin_set_unlock', { p_students: [id], p_subjects: [b.dataset.ov],
    p: b.value === 'ext' ? { done_external: true, ext_note: 'Completed earlier', override: 'auto' } : { done_external: false, override: b.value } }), 'Saved', reload)));
  $$('[data-rep]', d).forEach((b) => (b.onclick = () => reportModal(b.dataset.rep)));
  $$('[data-act]', d).forEach((b) => (b.onclick = () => attemptAction(b.dataset.a, b.dataset.act, reload)));
  $$('[data-snap]', d).forEach((b) => (b.onclick = async () => {
    const im = b.querySelector('.im'); im.textContent = '…';
    try { const r = await rpc('exam_admin_snapshot', { p_id: +b.dataset.snap });
      if (r?.image) { im.innerHTML = `<img src="${r.image}">`; im.onclick = (e) => { e.stopPropagation(); modal(`<img src="${r.image}" style="width:100%;border-radius:12px"><div class="small muted mt8">${esc(r.kind)} · ${fmtDT(r.at)}</div><button class="btn mt16" onclick="this.closest('.ov').remove()">Close</button>`); }; }
      else im.textContent = r?.drive_name ? 'Saved in Drive' : 'not available'; } catch (e) { im.textContent = 'error'; }
  }));
}
const ST_LBL = { live: 'Writing now', exempt: 'Done earlier', locked: 'Locked', done: 'Attempts used', preparing: 'Bank not ready', blocked: 'Blocked', sequence: 'Waiting (order)',
  assignments: 'Needs assignments', ready: 'Open now', requested: 'Date requested', scheduled: 'Scheduled', missed: 'Missed', book: 'Can book' };
const stCls = (st) => ({ live: 'bad', exempt: 'ok', ready: 'ok', requested: 'warn', scheduled: 'info', missed: 'bad', blocked: 'bad', assignments: 'warn', book: 'info' }[st] || '');
const evDetail = (e) => { const d = e.detail || {}; return Object.entries(d).filter(([k]) => !['ua'].includes(k)).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ').slice(0, 160); };

function studentForm(R, after) {
  const s = R?.student || {};
  const cur = new Set((R?.courses || []).map((c) => c.id));
  const m = modal(`<h2>${s.id ? 'Edit student' : 'Add student'}</h2>
    <div class="two"><div><label class="lb">Name</label><input class="inp" id="n" value="${esc(s.name || '')}"></div>
      <div><label class="lb">Login email (Gmail)</label><input class="inp" id="e" value="${esc(s.email || '')}"></div></div>
    <div class="two"><div><label class="lb">Other emails that may sign in (comma separated)</label><input class="inp" id="alt" value="${esc((s.alt_emails || []).join(', '))}"></div>
      <div><label class="lb">ZICA student ID</label><input class="inp" id="zc" value="${esc(s.zica_code || '')}"></div></div>
    <div class="two"><div><label class="lb">Status</label><select class="inp" id="st">${['In Progress', 'On Hold', 'Registered', 'Completed'].map((x) => `<option ${s.status === x ? 'selected' : ''}>${x}</option>`).join('')}
      ${s.status && !['In Progress', 'On Hold', 'Registered', 'Completed'].includes(s.status) ? `<option selected>${esc(s.status)}</option>` : ''}</select></div>
      <div><label class="lb">Flags</label><div class="row"><label class="row small"><input type="checkbox" id="bl" ${s.blocked ? 'checked' : ''}> Blocked</label>
        <label class="row small"><input type="checkbox" id="ts" ${s.is_test ? 'checked' : ''}> Test account</label></div></div></div>
    <label class="lb">Courses</label><div class="picklist" style="max-height:200px">${META.courses.map((c) => `<label><input type="checkbox" value="${c.id}" ${cur.has(c.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div>
    <label class="lb">Note</label><input class="inp" id="nt" value="${esc(s.notes || '')}">
    <div class="row mt24" style="justify-content:flex-end"><button class="btn ghost" data-x>Cancel</button><button class="btn pri" data-ok>Save</button></div>`, 'wide');
  m.el.querySelector('[data-x]').onclick = m.close;
  m.el.querySelector('[data-ok]').onclick = async () => {
    const p = { id: s.id || '', name: $('#n', m.el).value.trim(), email: $('#e', m.el).value.trim(),
      alt_emails: $('#alt', m.el).value.split(',').map((x) => x.trim()).filter(Boolean), status: $('#st', m.el).value,
      blocked: $('#bl', m.el).checked, is_test: $('#ts', m.el).checked, notes: $('#nt', m.el).value, code: $('#zc', m.el).value.trim(),
      courses: $$('.picklist input:checked', m.el).map((x) => x.value) };
    try { await rpc('exam_admin_student_save', { p }); m.close(); toast('Saved', 'ok'); after && after(); } catch (e) { toast(errText(e), 'bad'); }
  };
}

// ================================================================= slots
async function slots() {
  frame(`<div class="phead spread"><div><h1>Exam slots</h1><div class="small muted">A slot is a time window. Students in it can start any unlocked exam (or one subject) anytime inside the window. Max 20 live at once.</div></div>
    <button class="btn pri" id="newSlot">+ New slot</button></div><div id="sl"><div class="spin"></div></div>`);
  $('#newSlot').onclick = () => slotForm({}, slots);
  let L; try { L = await rpc('exam_admin_slots'); } catch (e) { return toast(errText(e), 'bad'); }
  const now = Date.now();
  const card = (s) => `<div class="card" style="padding:18px;${s.cancelled ? 'opacity:.5' : ''}"><div class="spread"><div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${s.cancelled ? '<span class="pill bad">Cancelled</span>' : Date.parse(s.starts_at) <= now && Date.parse(s.ends_at) > now ? '<span class="pill ok"><span class="dot pulse"></span>Open now</span>' : Date.parse(s.ends_at) <= now ? '<span class="pill">Ended</span>' : '<span class="pill info">Upcoming</span>'}
        <span class="pill">${s.subject ? esc(s.subject) : 'Any unlocked subject'}</span><span class="pill">${s.members.length} students · cap ${s.capacity}</span>
        ${s.live ? `<span class="pill bad">${s.live} live</span>` : ''}<span class="pill">${s.started} started</span></div>
      <h3 class="mt8">${esc(s.title || 'Exam slot')}</h3><div class="small" style="color:var(--ink2)">${fmtRange(s.starts_at, s.ends_at)}</div></div>
      <div class="row">${!s.cancelled ? `<button class="btn sm" data-ed="${s.id}">Edit</button><button class="btn sm bad" data-cx="${s.id}">Cancel</button>` : ''}</div></div>
    <div class="small muted mt8">${s.members.map((m) => esc(m.name)).join(', ') || 'No students'}</div></div>`;
  const up = L.filter((s) => Date.parse(s.ends_at) > now), past = L.filter((s) => Date.parse(s.ends_at) <= now).reverse();
  $('#sl').innerHTML = `<div class="grid">${up.map(card).join('') || '<div class="empty">No upcoming slots. Create one to let students start.</div>'}</div>
    ${past.length ? `<h3 class="mt32">Past 14 days</h3><div class="grid mt16">${past.map(card).join('')}</div>` : ''}`;
  $$('[data-ed]').forEach((b) => (b.onclick = () => { const s = L.find((x) => x.id == b.dataset.ed); slotForm({ ...s, members: s.members.map((m) => m.id) }, slots); }));
  $$('[data-cx]').forEach((b) => (b.onclick = async () => { if (await confirmBox('Cancel this slot?', 'Students in it will no longer be able to start from this slot.', 'Cancel slot', true)) run(() => rpc('exam_admin_slot_cancel', { p_id: +b.dataset.cx }), 'Slot cancelled', slots); }));
}

const istLocal = (iso, part) => { // yyyy-mm-dd / HH:MM in IST
  const d = new Date(iso || Date.now());
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const g = (t) => f.find((x) => x.type === t).value;
  return part === 'date' ? `${g('year')}-${g('month')}-${g('day')}` : `${g('hour') === '24' ? '00' : g('hour')}:${g('minute')}`;
};
const toISO = (date, time) => new Date(`${date}T${time}:00+05:30`).toISOString();

async function slotForm(pre = {}, after) {
  const sel = new Set(pre.members || []);
  let pool = [];
  const m = modal(`<h2>${pre.id ? 'Edit slot' : 'New exam slot'}</h2>
    <label class="lb">Title</label><input class="inp" id="t" value="${esc(pre.title || 'Software exam')}">
    <div class="three"><div><label class="lb">Date</label><input class="inp" type="date" id="d" value="${istLocal(pre.starts_at, 'date')}"></div>
      <div><label class="lb">From</label><input class="inp" type="time" id="a" value="${pre.starts_at ? istLocal(pre.starts_at, 'time') : '10:00'}"></div>
      <div><label class="lb">To</label><input class="inp" type="time" id="b" value="${pre.ends_at ? istLocal(pre.ends_at, 'time') : '18:00'}"></div></div>
    <div class="two"><div><label class="lb">Subject</label><select class="inp" id="sj"><option value="">Any unlocked subject</option>${META.subjects.map((s) => `<option value="${s.id}" ${pre.subject_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div><label class="lb">Max live at once</label><input class="inp" type="number" id="cap" min="1" max="20" value="${pre.capacity || 20}"></div></div>
    <label class="lb">Students — <span id="cnt">${sel.size}</span> selected</label>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px"><select class="inp" id="pc" style="width:auto;flex:1"><option value="">Pick a course to list students…</option>${META.courses.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <select class="inp" id="ps" style="width:auto"><option value="all">All statuses</option><option value="active">Active</option><option value="completed">Completed</option></select>
      <input class="inp" id="pq" placeholder="or search by name" style="width:auto;flex:1"></div>
    <div class="picklist" id="pl"><div class="small muted" style="padding:12px">Choose a course or search.</div></div>
    <div class="row mt8" style="justify-content:space-between"><button class="btn sm ghost" id="pall">Select all listed</button>
      <label class="row small"><input type="checkbox" id="nt" checked> Email the students their slot</label></div>
    <label class="lb">Note to students (optional)</label><input class="inp" id="nts" value="${esc(pre.notes || '')}" placeholder="e.g. Sit in a quiet room, laptop with camera preferred">
    <div class="row mt24" style="justify-content:flex-end"><button class="btn ghost" data-x>Cancel</button><button class="btn pri" data-ok>Save slot</button></div>`, 'wide');
  const drawPool = () => {
    $('#pl', m.el).innerHTML = pool.length ? pool.map((s) => `<label><input type="checkbox" value="${s.id}" ${sel.has(s.id) ? 'checked' : ''}><span style="flex:1"><b>${esc(s.name)}</b> <span class="tiny dim">${esc(s.email)}</span></span><span class="pill">${esc(shortStatus(s.status))}</span></label>`).join('')
      : '<div class="small muted" style="padding:12px">No students.</div>';
    $$('#pl input', m.el).forEach((c) => (c.onchange = () => { c.checked ? sel.add(c.value) : sel.delete(c.value); $('#cnt', m.el).textContent = sel.size; }));
  };
  const loadCourse = async () => {
    const c = $('#pc', m.el).value; if (!c) return;
    const D = await rpc('exam_admin_course', { p_course: c, p_scope: $('#ps', m.el).value });
    pool = D.students.map((s) => ({ id: s.id, name: s.name, email: s.email, status: s.status })); drawPool();
  };
  $('#pc', m.el).onchange = loadCourse; $('#ps', m.el).onchange = loadCourse;
  let qt; $('#pq', m.el).oninput = (e) => { clearTimeout(qt); qt = setTimeout(async () => { pool = await rpc('exam_admin_search', { p_q: e.target.value.trim() }); drawPool(); }, 300); };
  if (pre.members?.length) {
    // show currently selected members
    const all = await rpc('exam_admin_course', { p_course: null, p_scope: 'all' }).catch(() => null);
    if (all) { pool = all.students.filter((s) => sel.has(s.id)).map((s) => ({ id: s.id, name: s.name, email: s.email, status: s.status })); drawPool(); }
  }
  $('#pall', m.el).onclick = () => { pool.forEach((s) => sel.add(s.id)); drawPool(); $('#cnt', m.el).textContent = sel.size; };
  m.el.querySelector('[data-x]').onclick = m.close;
  m.el.querySelector('[data-ok]').onclick = async () => {
    const d = $('#d', m.el).value;
    const p = { id: pre.id || '', title: $('#t', m.el).value, starts_at: toISO(d, $('#a', m.el).value), ends_at: toISO(d, $('#b', m.el).value),
      capacity: +$('#cap', m.el).value || 20, subject_id: $('#sj', m.el).value, notes: $('#nts', m.el).value, members: [...sel], notify: $('#nt', m.el).checked };
    if (!sel.size && !(await confirmBox('No students selected', 'Save an empty slot anyway?', 'Save'))) return;
    try { const r = await rpc('exam_admin_slot_save', { p }); m.close(); toast(`Slot saved for ${sel.size} student(s)`, 'ok'); after && after(r); } catch (e) { toast(errText(e), 'bad'); }
  };
}

// ================================================================= requests (exam dates + account links)
async function requests() {
  await counts();
  frame(`<div class="phead spread"><div><h1>Requests</h1><div class="small muted">Exam dates students asked for, reschedules, missed-exam reasons and Google accounts to link. Approving emails the student.</div></div>
    <button class="btn" id="rf">↻ Refresh</button></div><div id="rq"><div class="spin"></div></div>`);
  $('#rf').onclick = requests;
  let R; try { R = await rpc('exam_admin_requests'); } catch (e) { return toast(errText(e), 'bad'); }
  const pend = R.bookings.filter((b) => b.status === 'pending'), done = R.bookings.filter((b) => b.status !== 'pending');
  const cpend = R.claims.filter((c) => c.status === 'pending');
  const sel = new Set();
  const KIND = { new: ['info', 'New'], reschedule: ['warn', 'Reschedule'], missed: ['bad', 'Missed'], email: ['mark', 'By email'] };
  const bRow = (b) => `<div class="card rqc" style="padding:16px"><div class="spread" style="align-items:flex-start;gap:12px">
      <label class="row" style="gap:10px;align-items:flex-start"><input type="checkbox" data-bs="${b.id}" style="margin-top:4px">
        <div><div class="row" style="gap:6px;flex-wrap:wrap"><span class="pill ${KIND[b.kind]?.[0] || ''}">${KIND[b.kind]?.[1] || esc(b.kind)}</span>
          ${b.clash >= 15 ? `<span class="pill bad">${b.clash} others that hour</span>` : b.clash ? `<span class="pill">${b.clash} others that hour</span>` : ''}</div>
        <h3 class="mt8"><a href="#" data-stu="${b.student_id}">${esc(b.name)}</a> · ${esc(b.subject || 'subject?')}</h3>
        <div class="small muted">${esc(b.email)}${b.code ? ' · ' + esc(b.code) : ''} · asked ${ago(b.created_at)}</div></div></label>
      <div style="text-align:right"><div class="small muted">Wants</div><b style="font-size:16px">${b.want_at ? fmtDT(b.want_at) : '—'}</b></div></div>
    ${b.note ? `<div class="rv" style="margin-top:10px">${esc(b.note)}</div>` : ''}
    <div class="row mt16" style="gap:8px;flex-wrap:wrap">
      <input class="inp" type="date" data-dd="${b.id}" value="${b.want_at ? istLocal(b.want_at, 'date') : ''}" style="width:auto">
      <input class="inp" type="time" data-dt="${b.id}" value="${b.want_at ? istLocal(b.want_at, 'time') : '10:00'}" style="width:auto">
      ${!b.subject_id ? `<select class="inp" data-dsj="${b.id}" style="width:auto"><option value="">Subject…</option>${META.subjects.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>` : ''}
      <input class="inp" data-dn="${b.id}" placeholder="Note to student (optional)" style="flex:1;min-width:180px">
      <button class="btn ok" data-ap="${b.id}">Approve</button><button class="btn bad" data-rj="${b.id}">Decline</button></div></div>`;
  const cRow = (c) => `<div class="card" style="padding:16px"><div class="spread"><div><span class="pill warn">Link Google account</span>${c.source === 'email' ? ' <span class="pill mark">by email</span>' : ''}
      <h3 class="mt8">${esc(c.name || '—')}</h3><div class="small muted">Signed in as <b style="color:var(--ink)">${esc(c.google_email)}</b>${c.phone ? ' · ' + esc(c.phone) : ''}${c.course ? ' · ' + esc(c.course) : ''}${c.old_email ? ' · old email ' + esc(c.old_email) : ''} · ${ago(c.created_at)}</div></div></div>
    <div class="row mt16" style="gap:8px;flex-wrap:wrap"><select class="inp" data-cs="${c.id}" style="flex:1;min-width:220px"><option value="">Link to student…</option>
      ${c.suggest.map((s) => `<option value="${s.id}">${esc(s.name)} · ${esc(s.email)} · ${esc(shortStatus(s.status))}</option>`).join('')}<option value="__search">Search another student…</option></select>
      <input class="inp" data-cn="${c.id}" placeholder="Note (optional)" style="flex:1;min-width:160px">
      <button class="btn ok" data-cl="${c.id}">Link</button><button class="btn bad" data-cr="${c.id}">Decline</button></div></div>`;
  $('#rq').innerHTML = `
    <div class="spread mt8"><h3>Exam dates · ${pend.length} waiting</h3>${pend.length ? `<div class="row" style="gap:8px"><label class="row small"><input type="checkbox" id="ball"> Select all</label>
      <button class="btn sm ok" id="bapp">Approve selected at requested time</button></div>` : ''}</div>
    <div class="grid mt16">${pend.map(bRow).join('') || '<div class="empty">No exam-date requests waiting.</div>'}</div>
    ${cpend.length ? `<h3 class="mt32">Google accounts to link · ${cpend.length}</h3><div class="grid mt16">${cpend.map(cRow).join('')}</div>` : ''}
    ${done.length ? `<h3 class="mt32">Decided in the last 14 days</h3><div class="tscroll mt16" style="max-height:420px"><table class="tbl"><tr><th>Student</th><th>Subject</th><th>Time</th><th>Kind</th><th>Status</th><th>Decided</th></tr>
      ${done.map((b) => `<tr><td><a href="#" data-stu="${b.student_id}">${esc(b.name)}</a></td><td>${esc(b.subject || '—')}</td><td>${b.want_at ? fmtDT(b.want_at) : '—'}</td><td>${esc(b.kind)}</td>
        <td><span class="pill ${b.status === 'approved' ? 'ok' : b.status === 'rejected' ? 'bad' : ''}">${esc(b.status)}</span></td><td class="small">${b.decided_at ? ago(b.decided_at) : ''}</td></tr>`).join('')}</table></div>` : ''}`;
  $$('[data-stu]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); studentDrawer(a.dataset.stu); }));
  $$('[data-bs]').forEach((c) => (c.onchange = () => (c.checked ? sel.add(+c.dataset.bs) : sel.delete(+c.dataset.bs))));
  $('#ball') && ($('#ball').onchange = (e) => $$('[data-bs]').forEach((c) => { c.checked = e.target.checked; c.onchange(); }));
  $('#bapp') && ($('#bapp').onclick = async () => {
    if (!sel.size) return toast('Tick the requests to approve first.', 'bad');
    if (!(await confirmBox(`Approve ${sel.size} request(s)?`, 'Each student gets a 2-hour slot at the time they asked for, and an email.', 'Approve'))) return;
    run(() => rpc('exam_admin_booking_decide', { p_ids: [...sel], p_action: 'approve' }), `Approved ${sel.size}`, requests);
  });
  $$('[data-ap]').forEach((b) => (b.onclick = () => {
    const id = b.dataset.ap, d = $(`[data-dd="${id}"]`).value, t = $(`[data-dt="${id}"]`).value;
    if (!d || !t) return toast('Pick a date and time.', 'bad');
    run(() => rpc('exam_admin_booking_decide', { p_ids: [+id], p_action: 'approve', p_at: toISO(d, t), p_subject: $(`[data-dsj="${id}"]`)?.value || null,
      p_note: $(`[data-dn="${id}"]`).value.trim() || null }), 'Approved — student will be emailed', requests);
  }));
  $$('[data-rj]').forEach((b) => (b.onclick = async () => {
    const id = b.dataset.rj, note = $(`[data-dn="${id}"]`).value.trim();
    if (!note && !(await confirmBox('Decline without a note?', 'The student will be told to pick another time. Add a note to explain why.', 'Decline anyway', true))) return;
    run(() => rpc('exam_admin_booking_decide', { p_ids: [+id], p_action: 'reject', p_note: note || null }), 'Declined', requests);
  }));
  $$('[data-cs]').forEach((s) => (s.onchange = async () => {
    if (s.value !== '__search') return;
    const q = prompt('Search student by name, email or ID'); s.value = '';
    if (!q) return;
    const L = await rpc('exam_admin_search', { p_q: q.trim() }).catch(() => []);
    L.forEach((x) => { const o = document.createElement('option'); o.value = x.id; o.textContent = `${x.name} · ${x.email} · ${shortStatus(x.status)}`; s.insertBefore(o, s.lastElementChild); });
    if (L[0]) s.value = L[0].id; else toast('No match', 'bad');
  }));
  $$('[data-cl]').forEach((b) => (b.onclick = () => {
    const id = b.dataset.cl, st = $(`[data-cs="${id}"]`).value;
    if (!st || st === '__search') return toast('Pick the student to link.', 'bad');
    run(() => rpc('exam_admin_claim_decide', { p_id: +id, p_student: st, p_note: $(`[data-cn="${id}"]`).value.trim() || null }), 'Linked — they can sign in now', requests);
  }));
  $$('[data-cr]').forEach((b) => (b.onclick = () => run(() => rpc('exam_admin_claim_decide', { p_id: +b.dataset.cr, p_student: null, p_note: $(`[data-cn="${b.dataset.cr}"]`).value.trim() || null }), 'Declined', requests)));
}

// ================================================================= assignment reviews (admins + faculty)
async function subs() {
  await counts();
  const mine = META.my_subjects; // null = all
  const subjOpts = META.subjects.filter((x) => !mine || mine.includes(x.id));
  frame(`<div class="phead"><h1>${META.is_admin ? 'Assignment submissions' : 'Assignment reviews'}</h1>
      <div class="small muted">Open the Drive link, check the work, then approve or ask for a redo. ${META.is_admin ? '' : 'You see the subjects assigned to you.'}</div></div>
    <div class="toolbar"><select class="inp" id="fst">${[['submitted', 'Waiting for review'], ['redo', 'Redo requested'], ['approved', 'Approved'], ['all', 'All']].map(([v, t]) => `<option value="${v}" ${S.sst === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select class="inp" id="fsj"><option value="">All my subjects</option>${subjOpts.map((x) => `<option value="${x.id}" ${S.ssj === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <input class="inp" id="fsq" placeholder="Search student" style="flex:1" value="${esc(S.sq || '')}"></div>
    <div id="sb"><div class="spin"></div></div>`);
  S.sst = S.sst || 'submitted';
  $('#fst').onchange = (e) => { S.sst = e.target.value; subs(); };
  $('#fsj').onchange = (e) => { S.ssj = e.target.value; subs(); };
  let L; try { L = await rpc('exam_admin_submissions', { p_status: S.sst, p_subject: S.ssj || null }); } catch (e) { return toast(errText(e), 'bad'); }
  const sel = new Set();
  const draw = () => {
    const q = (S.sq || '').toLowerCase();
    const rows = L.filter((x) => !q || x.name.toLowerCase().includes(q) || x.email.includes(q) || (x.code || '').includes(q));
    $('#sb').innerHTML = !rows.length ? '<div class="empty">Nothing here.</div>' : `<div class="tscroll"><table class="tbl"><tr><th><input type="checkbox" id="sall"></th><th>Student</th><th>Assignment</th><th>Submitted</th><th>Work</th><th>Status</th><th>Review</th></tr>
      ${rows.map((x) => `<tr><td><input type="checkbox" data-ss="${x.id}" ${sel.has(x.id) ? 'checked' : ''}></td>
        <td><b>${esc(x.name)}</b><div class="tiny dim">${esc(x.email)}${x.code ? ' · ' + esc(x.code) : ''}</div></td>
        <td><b>${esc(subjShort(x.subject_id))} · ${esc(x.acode)}</b><div class="tiny dim">${esc(x.title)}</div>${x.note ? `<div class="tiny" style="color:#fcd34d">“${esc(x.note)}”</div>` : ''}</td>
        <td class="small" style="white-space:nowrap">${fmtDT(x.at)}</td>
        <td><a class="btn sm" href="${esc(x.link)}" target="_blank" rel="noopener">Open ↗</a></td>
        <td><span class="pill ${x.status === 'approved' ? 'ok' : x.status === 'redo' ? 'bad' : 'info'}">${esc(x.status)}</span>${x.reviewed_by ? `<div class="tiny dim">${esc(x.reviewed_by.split('@')[0])}</div>` : ''}</td>
        <td><div class="row" style="gap:6px"><button class="btn sm ok" data-ok1="${x.id}">Approve</button><button class="btn sm bad" data-rd="${x.id}">Redo</button></div></td></tr>`).join('')}</table></div>
      <div class="bulk ${sel.size ? '' : 'hide'}"><b>${sel.size} selected</b><button class="btn sm ok" id="sapp">Approve selected</button><button class="btn sm ghost" id="sclr">Clear</button></div>`;
    $$('[data-ss]').forEach((c) => (c.onchange = () => { c.checked ? sel.add(+c.dataset.ss) : sel.delete(+c.dataset.ss); draw(); }));
    $('#sall') && ($('#sall').onchange = (e) => { rows.forEach((r) => (e.target.checked ? sel.add(r.id) : sel.delete(r.id))); draw(); });
    $('#sapp') && ($('#sapp').onclick = () => run(() => rpc('exam_admin_review', { p_ids: [...sel], p_status: 'approved' }), `Approved ${sel.size}`, subs));
    $('#sclr') && ($('#sclr').onclick = () => { sel.clear(); draw(); });
    $$('[data-ok1]').forEach((b) => (b.onclick = () => reviewModal(L.find((x) => x.id === +b.dataset.ok1), 'approved')));
    $$('[data-rd]').forEach((b) => (b.onclick = () => reviewModal(L.find((x) => x.id === +b.dataset.rd), 'redo')));
  };
  $('#fsq').oninput = (e) => { S.sq = e.target.value; draw(); };
  draw();
}
function reviewModal(x, status) {
  const m = modal(`<div class="small muted">${esc(x.name)} · ${esc(x.subject)}</div><h2>${status === 'approved' ? 'Approve' : 'Ask for a redo'} · ${esc(x.acode)}</h2>
    <p class="muted small">${esc(x.title)} · <a href="${esc(x.link)}" target="_blank" rel="noopener">open work ↗</a></p>
    <div class="two"><div><label class="lb">Marks (optional, out of 10)</label><input class="inp" type="number" min="0" max="10" step="0.5" id="rm" value="${x.marks ?? ''}"></div><div></div></div>
    <label class="lb">Feedback ${status === 'redo' ? '(the student sees this — say what to fix)' : '(optional)'}</label><textarea class="inp" rows="4" id="rf2">${esc(x.feedback || '')}</textarea>
    <div class="row mt24" style="justify-content:flex-end"><button class="btn ghost" data-x>Cancel</button><button class="btn ${status === 'approved' ? 'ok' : 'bad'}" data-ok>${status === 'approved' ? 'Approve' : 'Send back for redo'}</button></div>`);
  m.el.querySelector('[data-x]').onclick = m.close;
  m.el.querySelector('[data-ok]').onclick = () => {
    const fb = $('#rf2', m.el).value.trim(); const mk = $('#rm', m.el).value;
    if (status === 'redo' && fb.length < 5) return toast('Write what needs to be fixed.', 'bad');
    m.close(); run(() => rpc('exam_admin_review', { p_ids: [x.id], p_status: status, p_feedback: fb || null, p_marks: mk === '' ? null : +mk }), status === 'approved' ? 'Approved' : 'Sent back for redo', subs);
  };
}

// ================================================================= banks & settings
async function banks() {
  META = await rpc('exam_admin_meta').catch(() => META);
  const L = META.settings.levels;
  const need = { E: Math.max(L.easy.E, L.medium.E, L.hard.E), M: Math.max(L.easy.M, L.medium.M, L.hard.M), H: Math.max(L.easy.H, L.medium.H, L.hard.H) };
  frame(`<div class="phead"><h1>Question banks</h1><div class="small muted">A paper is ready when it has at least ${need.E} easy, ${need.M} medium and ${need.H} hard questions. Double that lets retakes get fresh questions.</div></div>
    <div class="tscroll"><table class="tbl"><tr><th>Subject</th><th>Easy</th><th>Medium</th><th>Hard</th><th>Total</th><th>Status</th><th>Assignments</th></tr>
    ${META.subjects.map((s) => { const b = s.bank, t = b.E + b.M + b.H; const ready = b.E >= need.E && b.M >= need.M && b.H >= need.H;
      return `<tr><td><b>${esc(s.name)}</b></td><td>${b.E}</td><td>${b.M}</td><td>${b.H}</td><td><b>${t}</b></td>
      <td>${ready ? `<span class="pill ok">Ready${b.E >= need.E * 2 && b.M >= need.M * 2 && b.H >= need.H * 2 ? ' · retake-safe' : ''}</span>` : t ? '<span class="pill warn">Partial</span>' : '<span class="pill">Not started</span>'}</td>
      <td>${s.assignments || '<span class="dim">—</span>'}</td></tr>`; }).join('')}</table></div>`);
}

async function settings() {
  META = await rpc('exam_admin_meta').catch(() => META);
  const st = META.settings;
  const yn = (id, v, y, n) => `<select class="inp" id="${id}"><option value="true" ${v ? 'selected' : ''}>${y}</option><option value="false" ${!v ? 'selected' : ''}>${n}</option></select>`;
  frame(`<div class="phead"><h1>Settings</h1><div class="small muted">Changes apply immediately to new exams and bookings.</div></div>
    <div class="card"><h3>Exam</h3><div class="three mt8">
      <div><label class="lb">Exam duration (minutes)</label><input class="inp" type="number" id="dur" value="${st.duration_min}"></div>
      <div><label class="lb">Warnings before pause</label><input class="inp" type="number" id="vl" value="${st.violation_limit}"></div>
      <div><label class="lb">Max students live at once</label><input class="inp" type="number" id="ml" value="${st.max_live}"></div>
      <div><label class="lb">Default attempts per subject</label><input class="inp" type="number" id="da" value="${st.default_attempts}"></div>
      <div><label class="lb">Pass mark (%)</label><input class="inp" type="number" id="pp" value="${st.pass_pct}"></div>
      <div><label class="lb">Students need a slot to start</label>${yn('rs', st.require_slot, 'Yes — only inside an approved slot', 'No — anytime once eligible')}</div>
    </div></div>
    <div class="card mt16"><h3>Eligibility</h3><div class="three mt8">
      <div><label class="lb">Exams follow course order</label>${yn('es', st.enforce_sequence, 'Yes — one subject after another', 'No — any order')}</div>
      <div><label class="lb">Assignments needed (%)</label><input class="inp" type="number" min="0" max="100" id="ap" value="${st.assign_pct}"><div class="tiny dim mt8">0 = no assignment requirement</div></div>
      <div><label class="lb">Counts as done when</label><select class="inp" id="am"><option value="approved" ${st.assign_mode === 'approved' ? 'selected' : ''}>Approved by faculty</option><option value="submitted" ${st.assign_mode === 'submitted' ? 'selected' : ''}>Just submitted</option></select></div>
    </div></div>
    <div class="card mt16"><h3>Booking</h3><div class="three mt8">
      <div><label class="lb">Students can book up to (days ahead)</label><input class="inp" type="number" id="bd" value="${st.book_days}"></div>
      <div><label class="lb">Slot window after start (minutes)</label><input class="inp" type="number" id="bw" value="${st.book_window_min}"></div>
      <div><label class="lb">Bookable hours (IST)</label><div class="row"><input class="inp" type="number" id="bh0" min="0" max="23" value="${st.book_hours[0]}"><span>to</span><input class="inp" type="number" id="bh1" min="1" max="24" value="${st.book_hours[1]}"></div></div>
      <div><label class="lb">Approve new bookings automatically</label>${yn('ba', st.book_auto, 'Yes — auto-approve', 'No — I approve each one')}</div>
      <div><label class="lb">Email students on every approval of assignments</label>${yn('nr', st.notify_reviews, 'Yes', 'No — only for redo')}</div>
      <div><label class="lb">Admin alert emails go to</label><input class="inp" id="an" value="${esc((st.admin_notify || []).join(', '))}"></div>
    </div><button class="btn pri mt24" id="sv">Save settings</button></div>
    <div class="card mt16"><div class="spread"><h3>Faculty logins</h3><button class="btn sm" id="addF">+ Add faculty</button></div>
      <p class="small muted">Faculty sign in at the same admin link and only see assignment reviews for their subjects (no subjects = all). They don't see scheduling, students or settings.</p>
      <div class="tscroll mt8" style="max-height:none"><table class="tbl"><tr><th>Name</th><th>Email</th><th>Subjects</th><th>Active</th><th></th></tr>
      ${META.staff.map((f) => `<tr><td><b>${esc(f.name || '')}</b></td><td class="small">${esc(f.email)}</td><td class="small">${f.subjects.length ? f.subjects.map((x) => esc(subjShort(x))).join(', ') : '<span class="dim">all</span>'}</td>
        <td>${f.active ? '<span class="pill ok">yes</span>' : '<span class="pill">no</span>'}</td><td><button class="btn sm" data-ef="${esc(f.email)}">Edit</button></td></tr>`).join('')}</table></div></div>
    <div class="card mt16"><h3>Levels & grades</h3><p class="small muted">Easy ${st.levels.easy.E}/${st.levels.easy.M}/${st.levels.easy.H} (max ${st.levels.easy.cap}) · Medium ${st.levels.medium.E}/${st.levels.medium.M}/${st.levels.medium.H} (max ${st.levels.medium.cap}) · Hard ${st.levels.hard.E}/${st.levels.hard.M}/${st.levels.hard.H} (max ${st.levels.hard.cap}) · Marks ${st.marks.E}/${st.marks.M}/${st.marks.H}</p>
      <div class="bands">${st.bands.map((b) => `<span><b>${b[0]}</b>${b[1]}%+</span>`).join('')}</div></div>
    <div class="card mt16"><h3>Admins</h3><p class="small muted">${META.admins.map(esc).join(' · ')}</p></div>`);
  $('#sv').onclick = () => run(() => rpc('exam_admin_settings', { p: {
    duration_min: +$('#dur').value, violation_limit: +$('#vl').value, max_live: +$('#ml').value, default_attempts: +$('#da').value, pass_pct: +$('#pp').value,
    require_slot: $('#rs').value === 'true', enforce_sequence: $('#es').value === 'true', assign_pct: Math.max(0, Math.min(100, +$('#ap').value || 0)), assign_mode: $('#am').value,
    book_days: +$('#bd').value || 30, book_window_min: +$('#bw').value || 120, book_hours: [+$('#bh0').value, +$('#bh1').value], book_auto: $('#ba').value === 'true',
    notify_reviews: $('#nr').value === 'true', admin_notify: $('#an').value.split(',').map((x) => x.trim().toLowerCase()).filter((x) => x.includes('@')) } }), 'Settings saved', settings);
  $('#addF').onclick = () => staffForm({ subjects: [], active: true });
  $$('[data-ef]').forEach((b) => (b.onclick = () => staffForm(META.staff.find((f) => f.email === b.dataset.ef))));
}
function staffForm(f) {
  const cur = new Set(f.subjects || []);
  const m = modal(`<h2>${f.email ? 'Edit faculty' : 'Add faculty'}</h2>
    <div class="two"><div><label class="lb">Name</label><input class="inp" id="fn" value="${esc(f.name || '')}"></div>
      <div><label class="lb">Gmail</label><input class="inp" id="fe" value="${esc(f.email || '')}" ${f.email ? 'disabled' : ''}></div></div>
    <label class="lb">Subjects they review (none ticked = all)</label><div class="picklist" style="max-height:260px">${META.subjects.map((x) => `<label><input type="checkbox" value="${x.id}" ${cur.has(x.id) ? 'checked' : ''}> ${esc(x.name)}</label>`).join('')}</div>
    <label class="row small mt16"><input type="checkbox" id="fa" ${f.active ? 'checked' : ''}> Active (can sign in)</label>
    <div class="row mt24" style="justify-content:flex-end"><button class="btn ghost" data-x>Cancel</button><button class="btn pri" data-ok>Save</button></div>`, 'wide');
  m.el.querySelector('[data-x]').onclick = m.close;
  m.el.querySelector('[data-ok]').onclick = () => {
    const email = (f.email || $('#fe', m.el).value).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) return toast('Enter a valid Gmail.', 'bad');
    m.close(); run(() => rpc('exam_admin_staff_save', { p: { email, name: $('#fn', m.el).value.trim(), subjects: $$('.picklist input:checked', m.el).map((x) => x.value), active: $('#fa', m.el).checked } }), 'Faculty saved', settings);
  };
}

boot();
