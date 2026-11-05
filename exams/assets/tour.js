// ZICA Pune Portal · quick guided tour (spotlight + card). Skips steps whose element isn't on screen.
// startTour(key, steps, { force }) — runs once per account automatically; force=true replays it.
const seenKey = (k) => 'ztour_' + k;
export const tourSeen = (k) => { try { return !!localStorage.getItem(seenKey(k)); } catch { return true; } };

export function startTour(key, steps, { force = false, onEnd } = {}) {
  if (!force && tourSeen(key)) return;
  const list = steps.filter((s) => !s.sel || document.querySelector(s.sel));
  if (!list.length) return;
  document.querySelector('.tour')?.remove();
  const ov = document.createElement('div'); ov.className = 'tour';
  ov.innerHTML = `<div class="tspot"></div><div class="tcard" role="dialog" aria-live="polite"><div class="tstep"></div><h3></h3><p></p>
    <div class="tbtns"><button class="btn sm ghost" data-t="skip">Skip tour</button><span style="flex:1"></span><button class="btn sm" data-t="back">Back</button><button class="btn sm pri" data-t="next">Next</button></div></div>`;
  document.body.appendChild(ov);
  const spot = ov.querySelector('.tspot'), card = ov.querySelector('.tcard');
  let i = 0;
  const done = () => { try { localStorage.setItem(seenKey(key), '1'); } catch {} ov.remove(); window.removeEventListener('resize', place); window.removeEventListener('keydown', keys); onEnd && onEnd(); };
  const place = () => {
    const s = list[i], el = s.sel && document.querySelector(s.sel);
    card.querySelector('.tstep').textContent = `${i + 1} of ${list.length}`;
    card.querySelector('h3').textContent = s.title; card.querySelector('p').innerHTML = s.text;
    ov.querySelector('[data-t=back]').style.visibility = i ? 'visible' : 'hidden';
    ov.querySelector('[data-t=next]').textContent = i === list.length - 1 ? 'Got it 👍' : 'Next';
    if (!el) { spot.style.cssText = 'left:50%;top:40%;width:0;height:0'; card.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%)'; return; }
    el.scrollIntoView({ block: 'center', behavior: 'instant' in window ? 'instant' : 'auto' });
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect(), pad = 8, vw = window.innerWidth, vh = window.innerHeight;
      spot.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${Math.min(r.height + pad * 2, vh - 20)}px`;
      const cw = Math.min(340, vw - 24), below = r.bottom + 14 + 190 < vh;
      let left = Math.max(12, Math.min(r.left, vw - cw - 12)), top = below ? r.bottom + 14 : Math.max(12, r.top - 14 - card.offsetHeight);
      if (!below && top < 12) top = Math.min(vh - card.offsetHeight - 12, r.bottom + 14);
      card.style.cssText = `left:${left}px;top:${top}px;width:${cw}px`;
    });
  };
  const keys = (e) => { if (e.key === 'Escape') done(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
  const go = (d) => { i += d; if (i >= list.length) return done(); if (i < 0) i = 0; place(); };
  ov.querySelector('[data-t=next]').onclick = () => go(1);
  ov.querySelector('[data-t=back]').onclick = () => go(-1);
  ov.querySelector('[data-t=skip]').onclick = done;
  window.addEventListener('resize', place); window.addEventListener('keydown', keys);
  place();
}

export const STUDENT_TOUR = [
  { sel: null, title: 'Welcome to your exam portal 👋', text: 'A 30-second tour of where everything is. You can skip it now and replay it any time from the <b>Tour</b> button at the top.' },
  { sel: '[data-tour=exams]', title: 'Your exams', text: 'Everything you can do right now, grouped by course and module. Press <b>Book exam date</b>, pick a day and a time that suits you — the academic team confirms it and you get an email.' },
  { sel: '.asgbtn', title: 'Assignments', text: 'Each software has assignments. Tap here to <b>download the assignment briefs (PDF)</b> and submit your Drive link. Your result and certificate unlock once all are submitted.' },
  { sel: '[data-tour=courses]', title: 'Your courses & assignments', text: 'Open a course to see every theory exam in order, its assignments, and the <b>practical papers</b> with their timing.' },
  { sel: '.grading', title: 'How grading works', text: 'Easy, Medium or Hard — you choose before the paper opens. Harder papers allow higher grades. Pass mark is 40%.' },
  { sel: '[data-tour=tourbtn]', title: 'Need this again?', text: 'Tap <b>Tour</b> any time to see this again. Stuck? WhatsApp the academic team (a message, not a call).' },
];
export const ADMIN_TOUR = [
  { sel: null, title: 'Exam control room', text: 'A quick tour of the admin side. Skip any time; replay from <b>Tour</b> at the top.' },
  { sel: '.kpi', title: 'Today at a glance', text: 'Live exams, finished today, pass rate (test student excluded) and what is waiting for you. Tiles are clickable.' },
  { sel: '#grpX', title: 'Group exam', text: 'Pick a software, tick students, choose a window — everyone gets an email, and a <b>WhatsApp message + A4 schedule</b> are ready for your group.' },
  { sel: '.anav a[href="#/requests"]', title: 'Requests', text: 'Date requests, retake requests and extra-time requests. Approve with a date — students are emailed automatically.' },
  { sel: '.anav a[href="#/wall"]', title: 'Live cameras', text: 'Watch and listen to running exams. If a network blocks video you get a photo every 10 s.' },
  { sel: '.anav a[href="#/approve"]', title: 'Approvals', text: 'Voice clips to review, practical papers to release, retakes and exams on hold.' },
  { sel: '.anav a[href="#/students"]', title: 'Students', text: 'Course grid — tap any <b>open</b> cell to schedule that exam straight away, or a name for the full record.' },
  { sel: '.anav a[href="#/reports"]', title: 'Reports & downloads', text: 'Exam schedule PDF + WhatsApp, notice-board results (only students whose assignments are in), and Excel downloads of marks, submissions and question banks.' },
  { sel: '[data-tour=tourbtn]', title: 'That’s it', text: 'Replay this tour from here whenever you like.' },
];
export const STAFF_TOUR = [
  { sel: null, title: 'Faculty desk 👋', text: 'You see only the subjects assigned to you.' },
  { sel: '.anav a[href="#/prac"]', title: 'Practical marking', text: 'Submitted practical papers wait here. Open the Drive link, mark against the rubric and save.' },
  { sel: '.anav a[href="#/subs"]', title: 'Assignment reviews', text: 'Approve assignments or ask for a redo with a short note — the student is emailed.' },
  { sel: '[data-tour=tourbtn]', title: 'Need this again?', text: 'Tap <b>Tour</b> any time.' },
];
