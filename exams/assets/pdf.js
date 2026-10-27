// ZICA Pune Portal · branded PDF documents (real .pdf download, no print dialog)
const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const BRAND = 'assets/brand/';
const C = {
  graphite: [18, 20, 25], orange: [236, 106, 34], ink: [24, 26, 32], body: [55, 58, 66], mute: [118, 120, 128],
  line: [226, 227, 232], soft: [246, 246, 244], link: [26, 86, 219], white: [255, 255, 255],
  basic: [22, 163, 74], intermediate: [217, 119, 6], advanced: [220, 38, 38],
};
const LEVEL = { basic: 'Basic', intermediate: 'Intermediate', advanced: 'Advanced', easy: 'Basic', medium: 'Intermediate', hard: 'Advanced' };
const lvl = (l) => ({ easy: 'basic', medium: 'intermediate', hard: 'advanced' }[l] || (['basic', 'intermediate', 'advanced'].includes(l) ? l : 'basic'));
const FOOTER = 'Academic Head · ZICA Pune · 2027';

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load the PDF tool. Check your internet and try again.')); document.head.appendChild(s); });
}
async function img(url) {
  const r = await fetch(url); const b = await r.blob();
  return new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); });
}
// standard PDF fonts only cover Latin-1: swap the few characters our briefs use that it lacks
const clean = (s) => String(s ?? '').replace(/→/g, '->').replace(/←/g, '<-').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/[✓✔]/g, '')
  .replace(/[–]/g, '-').replace(/[^\x00-\xFF—’‘“”•…]/g, '');

export async function briefPDF({ subject, items, student }) {
  if (!window.jspdf) await loadScript(JSPDF_URL);
  const { jsPDF } = window.jspdf;
  const [logo, mark, zee] = await Promise.all([img(BRAND + 'zica-horizontal-dark.png'), img(BRAND + 'zica-mark.png'), img(BRAND + 'zeelearn.png')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210, H = 297, M = 16, CW = W - 2 * M, BOTTOM = H - 20;
  const subj = clean(subject?.name || 'Assignments');
  doc.setProperties({ title: `${subj} · Assignment briefs · ZICA Pune`, author: 'ZICA Pune', creator: 'ZICA Pune Portal' });
  const col = (c) => doc.setTextColor(...c);
  const font = (size, style = 'normal') => { doc.setFont('helvetica', style); doc.setFontSize(size); };

  // ---------- cover band (page 1)
  doc.setFillColor(...C.graphite); doc.rect(0, 0, W, 62, 'F');
  doc.setFillColor(...C.orange); doc.rect(0, 62, W, 1.6, 'F');
  doc.addImage(logo, 'PNG', M, 11, 58, 58 / 4.85);
  doc.addImage(zee, 'PNG', W - M - 22, 11.5, 22, 22 / 2.16);
  font(10); col([200, 197, 190]); doc.text('Assignment briefs', M, 38);
  font(24, 'bold'); col(C.white); doc.text(subj, M, 49);
  const lv = { basic: 0, intermediate: 0, advanced: 0 };
  items.forEach((a) => { lv[lvl(a.level)]++; });
  font(9.5); col([200, 197, 190]);
  doc.text(`${items.length} assignment${items.length === 1 ? '' : 's'}  ·  ${lv.basic} basic  ·  ${lv.intermediate} intermediate  ·  ${lv.advanced} advanced`, M, 56);
  if (student?.name) {
    font(9.5, 'bold'); col(C.white); doc.text(clean(student.name), W - M, 49, { align: 'right' });
    font(9); col([200, 197, 190]);
    doc.text(`${student.code ? 'Student ID ' + clean(student.code) + '  ·  ' : ''}${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, W - M, 56, { align: 'right' });
  }

  // how to submit
  let y = 72;
  font(9.5); const howTxt = doc.splitTextToSize(clean(`Do the work, put all files for one assignment in a Google Drive folder, set sharing to "Anyone with the link can view", then submit the folder link on the ZICA Pune Portal (your course -> ${subj} -> Assignments). Your faculty reviews it and you see the result on the portal.`), CW - 14);
  font(9.5); const howH = 9 + howTxt.length * 4.4;
  doc.setFillColor(...C.soft); doc.setDrawColor(...C.line); doc.roundedRect(M, y, CW, howH, 2.5, 2.5, 'FD');
  doc.setFillColor(...C.orange); doc.rect(M, y, 1.4, howH, 'F');
  font(9.5, 'bold'); col(C.ink); doc.text('How to submit', M + 7, y + 6.5);
  font(9.5); col(C.body); doc.text(howTxt, M + 7, y + 11.5, { lineHeightFactor: 1.35 });
  y += howH + 8;

  // ---------- assignment cards
  const pageHeader = () => {
    doc.addImage(mark, 'PNG', M, 9, 11, 11 / 1.6);
    font(9, 'bold'); col(C.ink); doc.text(subj, M + 14, 14);
    font(9); col(C.mute); doc.text('Assignment briefs', M + 14 + doc.getTextWidth(subj) + 3, 14);
    doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, 19, W - M, 19);
    return 27;
  };
  const refs = (r) => (r || []).map((x) => (typeof x === 'string' ? { t: x, u: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(x) } : x));
  const split = (txt, w, size) => { font(size); return doc.splitTextToSize(clean(txt), w); };
  const bullets = (txt, sep) => clean(txt).split(sep).map((s) => s.trim()).filter(Boolean);

  // one card; draw=false only measures. Returns the card height.
  const card = (a, y0, draw) => {
    const inner = CW - 14, X = M + 8, LH = 4.45;
    const titleL = split(a.title, inner, 13);
    const briefL = split(a.brief, inner, 9.8);
    const del = bullets(a.deliver || '', /\n/).flatMap((d) => split('•  ' + d, inner - 2, 9.5));
    const spec = bullets(a.specs || '', /\s·\s|\n/).flatMap((d) => split('•  ' + d, inner - 2, 9.5));
    const rf = refs(a.refs);
    const accent = C[lvl(a.level)];
    let cy = y0 + 9;
    if (draw) {
      font(8.5, 'bold'); const cw = doc.getTextWidth(clean(a.code)) + 6;
      doc.setFillColor(...C.graphite); doc.roundedRect(X, cy - 4.2, cw, 6, 1.5, 1.5, 'F'); col(C.white); doc.text(clean(a.code), X + 3, cy);
      let cx = X + cw + 3;
      const t = LEVEL[a.level] || 'Basic'; font(8.5, 'bold'); const w = doc.getTextWidth(t) + 6;
      doc.setDrawColor(...accent); doc.setLineWidth(0.35); doc.roundedRect(cx, cy - 4.2, w, 6, 1.5, 1.5, 'S'); col(accent); doc.text(t, cx + 3, cy); cx += w + 4;
      if (a.module) { font(8.5); col(C.mute); doc.text(clean(a.module), cx, cy); }
      if (a.my?.status) { font(8.5, 'bold'); col(a.my.status === 'approved' ? C.basic : a.my.status === 'redo' ? C.advanced : C.link); doc.text(a.my.status === 'approved' ? 'Approved' : a.my.status === 'redo' ? 'Redo requested' : 'Submitted', W - M - 7, cy, { align: 'right' }); }
    }
    cy += 8;
    if (draw) { font(13, 'bold'); col(C.ink); doc.text(titleL, X, cy, { lineHeightFactor: 1.2 }); }
    cy += (titleL.length - 1) * 5.6 + 6.2;
    if (draw) { font(9.8); col(C.body); doc.text(briefL, X, cy, { lineHeightFactor: 1.3 }); }
    cy += (briefL.length - 1) * LH;
    const section = (label, lines) => {
      if (!lines.length) return;
      cy += 7; if (draw) { font(9, 'bold'); col(C.orange); doc.text(label, X, cy); }
      cy += 4.8; if (draw) { font(9.5); col(C.body); doc.text(lines, X + 1, cy, { lineHeightFactor: 1.3 }); }
      cy += (lines.length - 1) * 4.3;
    };
    section('Deliverables', del);
    section('Specs', spec);
    if (rf.length) {
      cy += 7; if (draw) { font(9, 'bold'); col(C.orange); doc.text('Watch & learn on YouTube', X, cy); }
      rf.forEach((r) => {
        cy += 4.9;
        if (draw) { font(9.5); col(C.link); const tx = '>  ' + clean(r.t); doc.textWithLink(tx, X + 1, cy, { url: r.u }); doc.setDrawColor(...C.link); doc.setLineWidth(0.15); doc.line(X + 5, cy + 0.8, X + 1 + doc.getTextWidth(tx), cy + 0.8); }
      });
    }
    const h = cy - y0 + 7;
    if (draw) {
      doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.roundedRect(M, y0, CW, h, 2.5, 2.5, 'S');
      doc.setFillColor(...accent); doc.rect(M, y0 + 0.4, 1.6, h - 0.8, 'F');
    }
    return h;
  };
  for (const a of items) {
    const h = card(a, y, false);
    if (y + h > BOTTOM) { doc.addPage(); y = pageHeader(); }
    card(a, y, true);
    y += h + 6;
  }

  // ---------- footer on every page
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, H - 13, W - M, H - 13);
    font(8); col(C.mute);
    doc.text('ZICA Pune · Kothrud', M, H - 8.5);
    font(8, 'bold'); col(C.ink); doc.text(FOOTER, W / 2, H - 8.5, { align: 'center' });
    font(8); col(C.mute); doc.text(`Page ${i} of ${n}`, W - M, H - 8.5, { align: 'right' });
  }
  const fname = `ZICA_Pune_${subj.replace(/[^A-Za-z0-9]+/g, '_')}_Assignment_Briefs${items.length === 1 ? '_' + clean(items[0].code) : ''}.pdf`;
  doc.save(fname);
  return fname;
}

// ======================================================================= practical question paper
const LV3 = { easy: 'Basic', medium: 'Standard', hard: 'Advanced' };
const CAP3 = { easy: 'B+', medium: 'A', hard: 'A+' };
const COURSE_CODE = (id) => String(id || '').toUpperCase();
export async function practicalPDF(d) {
  if (!window.jspdf) await loadScript(JSPDF_URL);
  const { jsPDF } = window.jspdf;
  const [logo, mark, zee] = await Promise.all([img(BRAND + 'zica-horizontal-dark.png'), img(BRAND + 'zica-mark.png'), img(BRAND + 'zeelearn.png')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210, H = 297, M = 16, CW = W - 2 * M, BOTTOM = H - 20;
  const P = d.paper, O = d.option, K = O.content || {}, S = d.student || {};
  const title = clean(P.title);
  doc.setProperties({ title: `${title} · Practical exam · ZICA Pune`, author: 'ZICA Pune', creator: 'ZICA Pune Portal' });
  const col = (c) => doc.setTextColor(...c);
  const font = (size, style = 'normal') => { doc.setFont('helvetica', style); doc.setFontSize(size); };
  const fmt = (t) => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const hrs = (m) => (m >= 1440 ? `${Math.round(m / 1440)} days` : `${Math.round((m / 60) * 10) / 10} hours`);

  // ---------- cover band
  doc.setFillColor(...C.graphite); doc.rect(0, 0, W, 70, 'F');
  doc.setFillColor(...C.orange); doc.rect(0, 70, W, 1.6, 'F');
  doc.addImage(logo, 'PNG', M, 11, 58, 58 / 4.85);
  doc.addImage(zee, 'PNG', W - M - 22, 11.5, 22, 22 / 2.16);
  font(10); col([200, 197, 190]); doc.text(clean(`Practical examination · ${P.course} · Module ${P.module}, Paper ${P.paper}`), M, 38);
  font(21, 'bold'); col(C.white); const tl = doc.splitTextToSize(title, CW - 40); doc.text(tl, M, 48, { lineHeightFactor: 1.15 });
  font(9.5); col([200, 197, 190]);
  doc.text(clean(`Option ${O.no}: ${O.title}`), M, 48 + tl.length * 8 + 1);
  font(9.5, 'bold'); col(C.white); doc.text(`${P.marks} marks`, W - M, 48, { align: 'right' });
  font(9); col([200, 197, 190]); doc.text(`${LV3[d.level]} level · max grade ${CAP3[d.level]}`, W - M, 54, { align: 'right' });

  // ---------- candidate + timing box
  let y = 80;
  const cells = [['Candidate', clean(S.name || '')], ['Student ID', clean(S.code || '—')], ['Started', fmt(d.started_at)], ['Submit by', fmt(d.deadline_at)]];
  doc.setFillColor(...C.soft); doc.setDrawColor(...C.line); doc.roundedRect(M, y, CW, 20, 2.5, 2.5, 'FD');
  cells.forEach(([k, v], i) => { const x = M + 6 + i * (CW / 4); font(8); col(C.mute); doc.text(k, x, y + 7.5); font(10, 'bold'); col(i === 3 ? C.orange : C.ink); doc.text(doc.splitTextToSize(v, CW / 4 - 8)[0], x, y + 14); });
  y += 27;
  font(9.2); col(C.body);
  const rules = doc.splitTextToSize(clean(`Work time: about ${hrs(P.work_min)}. You have ${hrs(P.window_min)} from the start to submit, including breaks, rendering and uploading. Upload a work-in-progress screenshot when the portal asks (2 h and 4 h). Use only the supplied assets and your own work; declare any AI tool you were allowed to use. Late submissions are flagged with the minutes late.`), CW);
  doc.text(rules, M, y, { lineHeightFactor: 1.35 }); y += rules.length * 4.4 + 4;

  const pageHeader = () => {
    doc.addImage(mark, 'PNG', M, 9, 11, 11 / 1.6);
    font(9, 'bold'); col(C.ink); doc.text(clean(`${COURSE_CODE(P.course_id)} · M${P.module} P${P.paper}`), M + 14, 14);
    font(9); col(C.mute); doc.text(clean(`${title} · Option ${O.no} · ${S.name || ''}`), M + 14 + doc.getTextWidth(clean(`${COURSE_CODE(P.course_id)} · M${P.module} P${P.paper}`)) + 3, 14);
    doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, 19, W - M, 19);
    return 27;
  };
  const need = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = pageHeader(); } };
  const h2 = (t) => { need(14); font(12.5, 'bold'); col(C.ink); doc.text(clean(t), M, y); doc.setFillColor(...C.orange); doc.rect(M, y + 2, 12, 0.9, 'F'); y += 8; };
  const para = (t, size = 9.8, c = C.body) => { if (!t) return; font(size); col(c); const L = doc.splitTextToSize(clean(t), CW); L.forEach((ln) => { need(5); doc.text(ln, M, y); y += size * 0.45; }); y += 2; };
  const list = (arr, indent = 0, size = 9.6) => { (arr || []).forEach((t) => { font(size); col(C.body); const L = doc.splitTextToSize(clean(t), CW - 6 - indent); need(L.length * 4.4 + 1); doc.text('•', M + indent + 1, y); doc.text(L, M + indent + 5, y, { lineHeightFactor: 1.3 }); y += L.length * 4.3 + 1.2; }); y += 1.5; };

  // ---------- brief
  if (K.client || K.brief) { h2('The brief'); if (K.client) para(K.client, 9.8, C.ink); para(K.brief); }
  // ---------- questions
  (K.questions || []).forEach((q, i) => {
    need(20);
    font(11, 'bold'); col(C.ink);
    const head = clean(`Question ${q.no || i + 1}${q.title ? ': ' + q.title : ''}`);
    doc.text(head, M, y);
    if (q.marks) { font(9.5, 'bold'); col(C.orange); doc.text(`${q.marks} marks`, W - M, y, { align: 'right' }); }
    y += 6; para(q.task);
    if (q.guidelines?.length) { font(9, 'bold'); col(C.orange); need(6); doc.text('Guidelines', M, y); y += 4.6; list(q.guidelines); }
  });
  // ---------- level deliverables
  if (K.levels) {
    h2('What to deliver at your level');
    ['easy', 'medium', 'hard'].forEach((k) => {
      const items = K.levels[k] || []; if (!items.length) return;
      const mine = k === d.level;
      font(9.8, 'bold'); col(mine ? C.orange : C.mute); need(8);
      doc.text(`${LV3[k]}${mine ? '  — your level' : ''}  (max grade ${CAP3[k]})`, M, y); y += 5;
      if (mine) list(items); else { font(9); col(C.mute); const L = doc.splitTextToSize(clean(items.join(' · ')), CW - 4); L.forEach((ln) => { need(5); doc.text(ln, M + 2, y); y += 4.1; }); y += 2.5; }
    });
  }
  // ---------- rubric
  if (K.rubric?.length) {
    h2(`How you will be marked (${P.marks} marks)`);
    need(K.rubric.length * 7 + 10);
    const x2 = W - M - 22;
    K.rubric.forEach(([k, mx], i) => {
      if (i % 2 === 0) { doc.setFillColor(...C.soft); doc.rect(M, y - 4.6, CW, 6.8, 'F'); }
      font(9.6); col(C.body); doc.text(clean(k), M + 3, y); font(9.6, 'bold'); col(C.ink); doc.text(`${mx}`, x2 + 19, y, { align: 'right' }); y += 6.8;
    });
    font(9.6, 'bold'); col(C.orange); doc.text('Total', M + 3, y + 1); doc.text(`${K.rubric.reduce((a, r) => a + Number(r[1]), 0)}`, x2 + 19, y + 1, { align: 'right' }); y += 9;
  }
  // ---------- submission
  if (K.submission) {
    h2('Submission');
    list(K.submission.files || []);
    const nm = clean((K.submission.naming || 'ZICA_{COURSE}_M{M}P{P}_{ID}_{NAME}').replace('{COURSE}', COURSE_CODE(P.course_id)).replace('{M}', P.module).replace('{P}', P.paper)
      .replace('{ID}', S.code || 'StudentID').replace('{NAME}', String(S.name || 'Name').replace(/\s+/g, '')));
    need(14); doc.setFillColor(...C.soft); doc.roundedRect(M, y - 4, CW, 10, 2, 2, 'F'); font(9); col(C.mute); doc.text('Name your Drive folder and every file:', M + 4, y + 2); font(9.6, 'bold'); col(C.ink); doc.text(nm, M + 62, y + 2); y += 12;
    para('Share the folder as "Anyone with the link can view" and submit the link on the portal. Include a 60-second screen recording walking through your file (layers, outliner, node graph or timeline).', 9.2);
  }
  // ---------- assets
  if (K.assets?.length || O.asset_url) {
    h2('Asset pack');
    list(K.assets || []);
    if (O.asset_url) { font(9.6); col(C.link); need(6); doc.textWithLink('Open the asset pack (Google Drive)', M, y, { url: O.asset_url }); y += 7; }
  }
  // ---------- reference images: each on the page, scaled to fit
  for (const m of d.media || []) {
    try {
      const props = doc.getImageProperties(m.data);
      const maxW = CW, maxH = BOTTOM - 40;
      let w = maxW, h = (props.height / props.width) * w; if (h > maxH) { h = maxH; w = (props.width / props.height) * h; }
      if (y + h + 12 > BOTTOM) { doc.addPage(); y = pageHeader(); }
      font(9.5, 'bold'); col(C.ink); doc.text(clean(m.caption || m.name), M, y); y += 3;
      doc.addImage(m.data, props.fileType || 'JPEG', M + (CW - w) / 2, y, w, h); doc.setDrawColor(...C.line); doc.rect(M + (CW - w) / 2, y, w, h, 'S');
      y += h + 8;
    } catch (e) { console.warn('image', m.name, e); }
  }
  // ---------- footer
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, H - 13, W - M, H - 13);
    font(8); col(C.mute); doc.text(clean(`${S.code || ''} ${S.name || ''}`).trim() || 'ZICA Pune · Kothrud', M, H - 8.5);
    font(8, 'bold'); col(C.ink); doc.text(FOOTER, W / 2, H - 8.5, { align: 'center' });
    font(8); col(C.mute); doc.text(`Page ${i} of ${n}`, W - M, H - 8.5, { align: 'right' });
  }
  const fname = clean(`ZICA_${COURSE_CODE(P.course_id)}_M${P.module}P${P.paper}_Option${O.no}_${String(S.name || '').replace(/\s+/g, '_')}.pdf`);
  doc.save(fname);
  return fname;
}
