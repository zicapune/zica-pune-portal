// ZICA Pune Portal · A4 documents for notice boards & groups (bright theme, real .pdf download)
const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const AUTOTABLE = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const BRAND = 'assets/brand/';
const C = { ink: [24, 26, 32], body: [60, 63, 72], mute: [120, 123, 132], line: [228, 229, 234], soft: [248, 247, 244],
  orange: [236, 106, 34], orange2: [255, 160, 90], white: [255, 255, 255], ok: [22, 163, 74], bad: [220, 38, 38], warn: [217, 119, 6] };
const PORTAL = 'zicapune.github.io/zica-pune-portal/exams';

const loaded = {};
function loadScript(src) {
  if (loaded[src]) return loaded[src];
  return (loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = () => { delete loaded[src]; rej(new Error('Could not load the document tool. Check your internet and try again.')); }; document.head.appendChild(s); }));
}
async function img(url) {
  const r = await fetch(url); const b = await r.blob();
  return new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); });
}
export const idc = (c) => String(c ?? '').replace(/\.0$/, '');
const clean = (s) => String(s ?? '').replace(/→/g, '->').replace(/[–]/g, '-').replace(/[^\x00-\xFF—’‘“”•…]/g, '');
const TZ = { timeZone: 'Asia/Kolkata' };
const ampm = (s) => s.replace(/\s*(am|pm)\b/i, (x) => ' ' + x.trim().toUpperCase());
export const dDay = (d) => new Date(d).toLocaleDateString('en-IN', { ...TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const dShort = (d) => new Date(d).toLocaleDateString('en-IN', { ...TZ, weekday: 'short', day: 'numeric', month: 'short' });
export const tm = (d) => ampm(new Date(d).toLocaleTimeString('en-IN', { ...TZ, hour: 'numeric', minute: '2-digit', hour12: true }));
const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', TZ);

async function base(title, sub) {
  if (!window.jspdf) await loadScript(JSPDF);
  if (!window.jspdf.jsPDF.API.autoTable) await loadScript(AUTOTABLE);
  const { jsPDF } = window.jspdf;
  const [logo, zee] = await Promise.all([img(BRAND + 'zica-print.png'), img(BRAND + 'zeelearn.png')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210, H = 297, M = 15;
  doc.setProperties({ title: clean(title) + ' · ZICA Pune', author: 'ZICA Pune', creator: 'ZICA Pune Portal' });
  const font = (size, style = 'normal') => { doc.setFont('helvetica', style); doc.setFontSize(size); };
  const col = (c) => doc.setTextColor(...c);
  // header: warm band, logo, title
  const head = (first) => {
    if (first) {
      doc.setFillColor(255, 246, 238); doc.rect(0, 0, W, 46, 'F');
      doc.setFillColor(...C.orange); doc.rect(0, 46, W, 1.4, 'F');
      doc.setFillColor(...C.orange2); doc.rect(0, 47.4, W * 0.42, 0.7, 'F');
      doc.addImage(logo, 'PNG', M, 9, 58, 58 / 2.79);
      doc.addImage(zee, 'PNG', W - M - 20, 10, 20, 20 / 2.16);
      font(19, 'bold'); col(C.ink); doc.text(clean(title), W - M, 30, { align: 'right' });
      if (sub) { font(9.5); col(C.body); doc.text(clean(sub), W - M, 37, { align: 'right' }); }
      return 56;
    }
    doc.addImage(logo, 'PNG', M, 7, 30, 30 / 2.79);
    font(9.5, 'bold'); col(C.ink); doc.text(clean(title), W - M, 13, { align: 'right' });
    doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, 21, W - M, 21);
    return 28;
  };
  const foot = () => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setDrawColor(...C.line); doc.setLineWidth(0.3); doc.line(M, H - 14, W - M, H - 14);
      font(8); col(C.mute);
      doc.text(`ZICA Pune · Kothrud  ·  ${PORTAL}`, M, H - 9);
      doc.text(`Generated ${new Date().toLocaleString('en-IN', { ...TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/am|pm/i, (x) => x.toUpperCase())}  ·  Page ${i} of ${n}`, W - M, H - 9, { align: 'right' });
    }
  };
  return { doc, W, H, M, font, col, head, foot };
}

const TABLE = (M) => ({
  margin: { left: M, right: M, top: 28, bottom: 20 },
  styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 3 }, textColor: C.body, lineColor: C.line, lineWidth: 0.2, valign: 'middle' },
  headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: 'bold', fontSize: 9 },
  alternateRowStyles: { fillColor: [252, 251, 249] },
});

// ------------------------------------------------------------------ exam schedule
// items: [{ subject, starts_at, ends_at, notes, students:[{name, code, courses}] }]
export async function schedulePDF(items, { title = 'Exam schedule', note = '' } = {}) {
  const days = [...new Set(items.map((x) => dayKey(x.starts_at)))];
  const range = days.length > 1 ? `${dShort(items[0].starts_at)} – ${dShort(items[items.length - 1].starts_at)}` : dDay(items[0].starts_at);
  const total = items.reduce((a, x) => a + x.students.filter((s) => !s.test).length, 0);
  const B = await base(title, `${range}  ·  ${items.length} session${items.length === 1 ? '' : 's'}  ·  ${total} student${total === 1 ? '' : 's'}`);
  const { doc, W, M, font, col, head } = B;
  let y = head(true);
  // instructions
  const tips = ['Log in with your registered Gmail on ' + PORTAL + ' 10 minutes early.', 'Camera and microphone stay on · sit alone in a quiet, well-lit room.',
    'Laptop or phone with a stable internet connection. Charge your device.', 'Cannot make it? Request a new date on the portal before the session.'];
  doc.setFillColor(...C.soft); doc.setDrawColor(...C.line); doc.roundedRect(M, y, W - 2 * M, 27, 2.5, 2.5, 'FD');
  doc.setFillColor(...C.orange); doc.rect(M, y, 1.4, 27, 'F');
  font(9.5, 'bold'); col(C.ink); doc.text('Before your exam', M + 6, y + 6.5);
  font(8.8); col(C.body); tips.forEach((t, i) => doc.text('•  ' + clean(t), M + 6, y + 12 + i * 4.1));
  y += 34;
  if (note) { font(9.5, 'italic'); col(C.body); const l = doc.splitTextToSize(clean(note), W - 2 * M); doc.text(l, M, y); y += l.length * 4.6 + 3; }
  for (const d of days) {
    const list = items.filter((x) => dayKey(x.starts_at) === d);
    if (y > 250) { doc.addPage(); y = head(false); }
    font(12.5, 'bold'); col(C.orange); doc.text(clean(dDay(list[0].starts_at)), M, y + 2); y += 6;
    for (const s of list) {
      const studs = s.students.filter((x) => !x.test);
      doc.autoTable({ ...TABLE(M), startY: y + 1,
        head: [[{ content: `${clean(s.subject)}     ${tm(s.starts_at)} – ${tm(s.ends_at)}`, colSpan: 4, styles: { fillColor: C.ink, fontSize: 10.5, cellPadding: 3.2 } }],
               ['#', 'Student', 'Student ID', 'Course']],
        body: studs.length ? studs.map((x, i) => [i + 1, clean(x.name), clean(idc(x.code) || '—'), clean(x.courses || '')]) : [[{ content: 'No students yet', colSpan: 4, styles: { textColor: C.mute } }]],
        columnStyles: { 0: { cellWidth: 9, halign: 'center', textColor: C.mute }, 1: { fontStyle: 'bold', textColor: C.ink, cellWidth: 62 }, 2: { cellWidth: 28 }, 3: { textColor: C.mute, fontSize: 8.5 } },
        didParseCell: (h) => { if (h.section === 'head' && h.row.index === 1) { h.cell.styles.fillColor = [255, 237, 222]; h.cell.styles.textColor = C.ink; h.cell.styles.fontSize = 8.5; } },
        didDrawPage: (h) => { if (h.pageNumber > 1) head(false); },
      });
      y = doc.lastAutoTable.finalY + (s.notes ? 1 : 7);
      if (s.notes) { font(8.5, 'italic'); col(C.mute); doc.text(clean('Note: ' + s.notes), M, y + 4); y += 10; }
    }
  }
  B.foot();
  doc.save(`ZICA-Pune_Exam-schedule_${days[0]}${days.length > 1 ? '_to_' + days[days.length - 1] : ''}.pdf`);
}

// ------------------------------------------------------------------ results for the notice board
// rows: [{ name, code, subject, level, score, max, percent, grade, passed }]
export async function resultsPDF(rows, { title = 'Exam results', sub = '', showScore = true, sign = 'Academic Head' } = {}) {
  const subjects = [...new Set(rows.map((r) => r.subject))].sort();
  const passN = rows.filter((r) => r.passed).length;
  const B = await base(title, sub || `${subjects.length === 1 ? subjects[0] : subjects.length + ' software'}  ·  ${rows.length} student${rows.length === 1 ? '' : 's'}  ·  ${passN} passed`);
  const { doc, W, H, M, font, col, head } = B;
  let y = head(true) + 2;
  const LV = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const gcol = (g, p) => (!p ? C.bad : /^A/.test(g) ? C.ok : /^B/.test(g) ? [37, 99, 235] : C.warn);
  for (const sj of subjects) {
    const list = rows.filter((r) => r.subject === sj).sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0) || a.name.localeCompare(b.name));
    if (y > 245) { doc.addPage(); y = head(false); }
    const hd = ['#', 'Student', 'Student ID', 'Level', ...(showScore ? ['Score'] : []), 'Grade', 'Result'];
    doc.autoTable({ ...TABLE(M), startY: y,
      head: [[{ content: clean(sj), colSpan: hd.length, styles: { fillColor: C.orange, textColor: C.white, fontSize: 11, cellPadding: 3.4 } }], hd],
      body: list.map((r, i) => [i + 1, clean(r.name), clean(idc(r.code) || '—'), LV[r.level] || r.level || '',
        ...(showScore ? [`${r.score ?? 0} / ${r.max ?? 0}  (${Math.round(r.percent ?? 0)}%)`] : []), r.grade || '', r.passed ? 'Passed' : 'Not passed']),
      columnStyles: { 0: { cellWidth: 9, halign: 'center', textColor: C.mute }, 1: { fontStyle: 'bold', textColor: C.ink } },
      didParseCell: (h) => {
        if (h.section === 'head' && h.row.index === 1) { h.cell.styles.fillColor = [255, 237, 222]; h.cell.styles.textColor = C.ink; h.cell.styles.fontSize = 8.5; }
        if (h.section === 'body') { const r = list[h.row.index]; const k = h.column.index, gi = hd.indexOf('Grade'), ri = hd.indexOf('Result');
          if (k === gi) { h.cell.styles.fontStyle = 'bold'; h.cell.styles.fontSize = 11; h.cell.styles.textColor = gcol(r.grade, r.passed); h.cell.styles.halign = 'center'; }
          if (k === ri) { h.cell.styles.textColor = r.passed ? C.ok : C.bad; h.cell.styles.fontStyle = 'bold'; } }
      },
      didDrawPage: (h) => { if (h.pageNumber > 1) head(false); },
    });
    y = doc.lastAutoTable.finalY + 9;
  }
  // grade key + signature
  if (y > H - 60) { doc.addPage(); y = head(false); }
  font(8.5); col(C.mute);
  doc.text(doc.splitTextToSize('Grades: A+ 90%+  ·  A 80%+  ·  B+ 70%+  ·  B 60%+  ·  C+ 50%+  ·  C 40%+  ·  pass mark 40%. Results are released after all assignments are submitted.', W - 2 * M), M, y + 2);
  doc.setDrawColor(...C.ink); doc.setLineWidth(0.3); doc.line(W - M - 60, y + 24, W - M, y + 24);
  font(9.5, 'bold'); col(C.ink); doc.text(clean(sign), W - M, y + 29, { align: 'right' });
  font(8.5); col(C.mute); doc.text('ZICA Pune · Kothrud', W - M, y + 33.5, { align: 'right' });
  B.foot();
  doc.save(`ZICA-Pune_Results_${subjects.length === 1 ? subjects[0].replace(/[^\w]+/g, '-') : 'multiple'}_${dayKey(Date.now())}.pdf`);
}

// ------------------------------------------------------------------ Excel downloads
// sheets: [{ name, rows:[{col: value}] }]
export async function xlsx(file, sheets) {
  if (!window.XLSX) await loadScript(XLSX_URL);
  const wb = window.XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = window.XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ Note: 'No data' }]);
    const keys = Object.keys(s.rows[0] || { Note: 1 });
    ws['!cols'] = keys.map((k) => ({ wch: Math.min(60, Math.max(k.length + 2, ...s.rows.slice(0, 300).map((r) => String(r[k] ?? '').length + 1))) }));
    ws['!autofilter'] = { ref: ws['!ref'] };
    window.XLSX.utils.book_append_sheet(wb, ws, s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  });
  window.XLSX.writeFile(wb, file);
}
