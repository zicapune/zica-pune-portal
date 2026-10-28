// Offline demo data (?demo) — used for previews and UI testing only
const now = () => new Date().toISOString();
const inH = (h) => new Date(Date.now() + h * 3600e3).toISOString();
const settings = {
  levels: { easy: { E: 20, M: 25, H: 5, cap: 'B+' }, medium: { E: 10, M: 30, H: 10, cap: 'A' }, hard: { E: 5, M: 25, H: 20, cap: 'A+' } },
  marks: { E: 2, M: 3, H: 4 }, bands: [['A+', 90], ['A', 80], ['B+', 70], ['B', 60], ['C+', 50], ['C', 40], ['F', 0]],
  duration: 60, violation_limit: 2, pass_pct: 40, book_days: 30, book_hours: [9, 20], book_window: 120, assign_pct: 60, assign_mode: 'approved',
};
const AP = (req = 0, ap = 0, sub = 0) => ({ req, approved: ap, submitted: sub, redo: 0, need: Math.ceil(req * 0.6), pct: 60, mode: 'approved' });
const S = (id, name, short, state, extra = {}) => ({ id, name, short, family: 'motion', state, unlocked: state !== 'locked', level_lock: null,
  max_attempts: 2, used: extra.best ? 1 : 0, bank_ready: true, best: null, live: null, slot: null, missed_slot: null, booking: null, seq_block: null, assign: AP(), ...extra });
const ME = {
  email: 'student@gmail.com', is_admin: false, server_now: now(),
  student: { id: 'demo', name: 'Sanket Sawant', email: 'student@gmail.com', status: 'In Progress', code: '457692' },
  settings,
  courses: [
    { id: 'mg6', name: 'Program in Motion Graphics', family: 'motion', cert: { key: 'zica', by: 'ZICA', line: 'On completion you receive a ZICA certificate.', note: '' }, subjects: [
      S('photoshop', 'Adobe Photoshop', 'Ps', 'done', { used: 2, assign: AP(6, 6, 6), best: { attempt_id: 'r1', score: 118, max: 150, percent: 78.67, grade: 'B+', level: 'medium', passed: true, at: now() } }),
      S('illustrator', 'Adobe Illustrator', 'Ai', 'ready', { assign: AP(6, 4, 5), slot: { id: 1, starts_at: inH(-1), ends_at: inH(1), open: true } }),
      S('premiere', 'Adobe Premiere Pro', 'Pr', 'scheduled', { slot: { id: 2, starts_at: inH(20), ends_at: inH(22), open: false } }),
      S('audition', 'Adobe Audition', 'Au', 'requested', { booking: { id: 9, want_at: inH(30), kind: 'new' } }),
      S('after_effects', 'Adobe After Effects', 'Ae', 'assignments', { assign: AP(8, 2, 3) }),
      S('element3d', 'Element 3D', 'E3D', 'sequence', { seq_block: 'Adobe After Effects' }),
    ] },
    { id: 'gd6', name: 'Program in Graphic Design', family: 'design', cert: { key: 'partner', by: 'Demo Partner Institute', line: 'Your certificate for this course is issued by the partner institute (demo).', note: 'Demo text.' }, subjects: [
      S('fine_art', 'Fine Arts', 'FA', 'exempt', { ext_note: 'Completed in batch Jan 2026' }),
      S('coreldraw', 'CorelDRAW', 'Cdr', 'book'),
      S('indesign', 'Adobe InDesign', 'Id', 'missed', { missed_slot: { id: 3, starts_at: inH(-30), ends_at: inH(-28) } }),
    ] },
  ],
  history: [{ attempt_id: 'r1', subject: 'Adobe Photoshop', level: 'medium', score: 118, max: 150, grade: 'B+', passed: true, at: now() }],
};
const Q = (i) => ({
  n: i + 1, id: 1000 + i, marks: [2, 3, 3, 4][i % 4], img: null,
  q: [
    'Which Photoshop feature lets you edit a layer non-destructively so the original pixels are preserved?',
    'In After Effects, which keyboard shortcut reveals all keyframed properties of a selected layer?',
    'A client needs a logo that scales to a billboard without losing quality. Which file type should you deliver?',
    'Which blend mode removes white from a layer while keeping darker tones visible?',
  ][i % 4],
  options: [['Smart Objects', 'Rasterize Layer', 'Flatten Image', 'Merge Down'], ['U', 'P', 'T', 'S'],
    ['SVG / AI vector', 'JPG at 72 ppi', 'PNG-8', 'GIF'], ['Multiply', 'Screen', 'Overlay', 'Difference']][i % 4],
});
const attempt = () => ({
  attempt_id: 'demo-att', subject: { id: 'illustrator', name: 'Adobe Illustrator', family: 'motion' }, course_id: 'mg6', level: 'medium',
  status: 'in_progress', started_at: now(), deadline_at: inH(1), server_now: now(), violations: 0, violation_limit: 2,
  questions: Array.from({ length: 50 }, (_, i) => Q(i)), answers: { 1000: 0, 1001: 0, 1003: 1 }, marked: [1002],
});
const result = () => ({
  attempt_id: 'r1', subject: 'Adobe Photoshop', subject_id: 'photoshop', family: 'motion', level: 'medium', score: 128, max: 150,
  percent: 85.33, grade: 'A', raw_grade: 'A', passed: true, answered: 47, correct: 41, total: 50, how: 'submitted',
  started_at: inH(-1), submitted_at: inH(-0.2), violations: 1,
  review: Array.from({ length: 12 }, (_, i) => ({ ...Q(i), correct: 0, your: i % 5 === 3 ? null : i % 4 === 2 ? 1 : 0,
    explanation: 'Smart Objects keep the source data inside the layer, so transforms and filters can be changed later without damaging pixels.' })),
});
let viol = 0;
export async function mock(fn) {
  await new Promise((r) => setTimeout(r, 120));
  switch (fn) {
    case 'exam_me': case 'exam_login': return ME;
    case 'exam_start': return attempt();
    case 'exam_answer': return { ok: true };
    case 'exam_violation': viol++; return { violations: viol, limit: 2, status: viol > 2 ? 'paused' : 'in_progress' };
    case 'exam_status': return { status: 'in_progress', deadline_at: inH(1), server_now: now(), violations: viol };
    case 'exam_submit': case 'exam_result': return result();
    case 'exam_book_load': { const d = new Date(Date.now() + 86400e3); const k = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); return { [k + 'T11']: 20, [k + 'T15']: 13 }; }
    case 'exam_assignments': return {
      subject: { id: 'after_effects', name: 'Adobe After Effects', short: 'Ae', family: 'motion' }, progress: AP(4, 1, 2),
      items: [
        { id: 1, code: 'AE-01', module: 'Kinetic typography', title: 'Lyric-free kinetic type promo for a café launch', level: 'basic',
          brief: 'Client: Brew & Byte Café, Kothrud.\nThey are launching a weekend breakfast menu and want a 15-second vertical promo for Instagram Reels using only type and shapes.',
          deliver: '1080×1920 MP4 (H.264), 15 s, 25 fps\nAE project (collected files)', specs: 'Max 3 fonts · brand colours #2B1B17 and #F2B33D · safe margins 120 px',
          refs: ['After Effects kinetic typography tutorial', { t: 'Text animators explained', u: 'https://www.youtube.com/results?search_query=after+effects+text+animators' }],
          my: { status: 'approved', link: 'https://drive.google.com/x', at: now(), feedback: 'Clean timing. Nice easing on the price tag.', marks: 9 } },
        { id: 2, code: 'AE-02', module: 'Kinetic typography', title: 'Explainer title sequence', level: 'intermediate', brief: 'Client brief text…', refs: ['After Effects title sequence'],
          my: { status: 'redo', link: 'https://drive.google.com/y', at: now(), feedback: 'Audio is missing — please add the VO track.' } },
        { id: 3, code: 'AE-03', module: 'Compositing', title: 'Green-screen product shot', level: 'advanced', brief: 'Client brief text…', refs: [] },
      ] };
    case 'exam_assignment_submit': return { ok: true };
    default: return { ok: true };
  }
}
