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
