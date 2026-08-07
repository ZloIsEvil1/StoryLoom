const STORAGE_KEY = 'storyloom.currentProject.v1';
const root = document.getElementById('root');
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const emptyBeat = (title = 'New beat') => ({ id: uid(), title, notes: '', matter: '' });
const emptyScene = (title = 'New scene') => ({ id: uid(), title, notes: '', beats: [emptyBeat('Beat 1')] });
const emptyChapter = (title = 'New chapter') => ({ id: uid(), title, notes: '', scenes: [emptyScene('Scene 1')], reminders: [] });
const starterProject = () => ({ title: 'Untitled Story', parts: [{ id: uid(), title: 'Part 1', chapters: [emptyChapter('Chapter 1')] }] });
let project = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || starterProject();
let selected = { part: 0, chapter: 0, scene: 0, beat: 0 };
let mode = 'write';
let notesVisible = true;
let dirHandle = null;

const $ = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== false && value != null) el[key] = value;
  });
  children.flat().forEach((child) => el.append(child?.nodeType ? child : document.createTextNode(child ?? '')));
  return el;
};
const icon = (name) => $('span', { class: 'icon', text: name });
const saveLocal = () => localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...project, updatedAt: new Date().toISOString() }));
const mutate = (fn) => { fn(project); saveLocal(); render(); };
const updateOnly = (fn) => { fn(project); saveLocal(); };
const chapter = () => project.parts[selected.part].chapters[selected.chapter];
const flatChapter = () => chapter().scenes.flatMap((scene, sceneIndex) => scene.beats.map((beat, beatIndex) => ({ scene, beat, sceneIndex, beatIndex })));
const current = () => flatChapter().find((x) => x.sceneIndex === selected.scene && x.beatIndex === selected.beat) || flatChapter()[0];

function compileText() {
  return project.parts.flatMap((part) => [part.title, ...part.chapters.flatMap((ch) => ['', ch.title, ...ch.scenes.flatMap((sc) => sc.beats.map((b) => b.matter.trim()).filter(Boolean))])]).join('\n\n').trim();
}
const escPdf = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
function makePdfBlob(text, title) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = words.reduce((acc, word) => { const last = acc.at(-1) || ''; (last + ' ' + word).trim().length > 82 ? acc.push(word) : acc[acc.length - 1] = (last + ' ' + word).trim(); return acc; }, ['']);
  const pages = []; for (let i = 0; i < lines.length; i += 42) pages.push(lines.slice(i, i + 42)); if (!pages.length) pages.push(['']);
  const objects = ['', '<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>'];
  const kids = [];
  pages.forEach((page) => { const content = ['BT', '/F1 12 Tf', '72 760 Td', `(${escPdf(title)}) Tj`, '0 -28 Td', ...page.flatMap((line) => [`(${escPdf(line)}) Tj`, '0 -16 Td']), 'ET'].join('\n'); const contentId = objects.length; objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`); const pageId = objects.length; objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`); kids.push(`${pageId} 0 R`); });
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  let pdf = '%PDF-1.4\n'; const offsets = [0]; objects.slice(1).forEach((obj, i) => { offsets[i + 1] = pdf.length; pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = pdf.length; pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n` + offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}
function download(name, blob) { const a = $('a', { href: URL.createObjectURL(blob), download: name }); a.click(); URL.revokeObjectURL(a.href); }
async function chooseDirectory() { if (!window.showDirectoryPicker) return alert('Directory saving is available in Chromium-based browsers. Export downloads still work everywhere.'); dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' }); }
async function saveProject() { const data = JSON.stringify(project, null, 2); if (dirHandle) { const f = await dirHandle.getFileHandle(`${project.title || 'storyloom'}.storyloom.json`, { create: true }); const w = await f.createWritable(); await w.write(data); await w.close(); } else download(`${project.title || 'storyloom'}.storyloom.json`, new Blob([data], { type: 'application/json' })); }
function render() {
  const ch = chapter(), cur = current(), flat = flatChapter(); root.innerHTML = '';
  const sidebar = $('aside', { class: 'sidebar' }, $('div', { class: 'brand' }, icon('✦'), $('input', { value: project.title, onchange: (e) => mutate((d) => d.title = e.target.value) })),
    $('button', { onclick: () => mutate((d) => { d.parts[selected.part].chapters.push(emptyChapter(`Chapter ${d.parts[selected.part].chapters.length + 1}`)); selected.chapter = d.parts[selected.part].chapters.length - 1; selected.scene = selected.beat = 0; }) }, icon('＋'), 'New Chapter'),
    $('button', { onclick: chooseDirectory }, icon('▣'), 'Choose Save Directory'), $('button', { onclick: saveProject }, icon('✓'), 'Save Project'),
    $('button', { onclick: () => download(`${project.title || 'storyloom'}.pdf`, makePdfBlob(compileText(), project.title)) }, icon('⇩'), 'Compile PDF'),
    $('nav', { class: 'tree' }, project.parts.map((p, pi) => $('section', {}, $('h3', { text: p.title }), p.chapters.map((c, ci) => $('button', { class: selected.chapter === ci ? 'active' : '', onclick: () => { selected = { part: pi, chapter: ci, scene: 0, beat: 0 }; render(); } }, icon('◈'), c.title))))));
  const toolbar = $('header', { class: 'toolbar' }, $('input', { class: 'chapter-title', value: ch.title, onchange: (e) => mutate(() => ch.title = e.target.value) }), $('button', { class: mode === 'plan' ? 'primary' : '', onclick: () => { mode = 'plan'; render(); } }, icon('☷'), 'Plan'), $('button', { class: mode === 'write' ? 'primary' : '', onclick: () => { mode = 'write'; render(); } }, icon('✎'), 'Write'), $('button', { onclick: () => { notesVisible = !notesVisible; render(); } }, icon(notesVisible ? '◐' : '◑'), notesVisible ? 'Hide Notes' : 'Show Notes'), $('button', { onclick: () => mutate(() => ch.scenes.push(emptyScene(`Scene ${ch.scenes.length + 1}`))) }, icon('＋'), 'Scene'), $('button', { onclick: () => mutate(() => ch.scenes[selected.scene].beats.push(emptyBeat(`Beat ${ch.scenes[selected.scene].beats.length + 1}`))) }, icon('＋'), 'Beat'), $('button', { onclick: () => mutate(() => ch.reminders.push({ id: uid(), text: 'New reminder' })) }, icon('※'), 'Note'));
  const sequence = $('div', { class: 'sequence' }, ch.scenes.map((scene, si) => $('div', { class: 'scene-card' }, $('input', { value: scene.title, onchange: (e) => mutate(() => scene.title = e.target.value) }), scene.beats.map((beat, bi) => $('button', { class: selected.scene === si && selected.beat === bi ? 'active' : '', onclick: () => { selected.scene = si; selected.beat = bi; render(); } }, beat.title || `Beat ${bi + 1}`)))));
  const notes = notesVisible ? $('aside', { class: 'floating-notes' }, $('h4', { text: cur.scene.title }), $('textarea', { placeholder: 'Scene notes', value: cur.scene.notes, oninput: (e) => updateOnly(() => cur.scene.notes = e.target.value) }), $('h4', { text: cur.beat.title }), $('textarea', { placeholder: 'Beat notes', value: cur.beat.notes, oninput: (e) => updateOnly(() => cur.beat.notes = e.target.value) }), ch.reminders.map((r) => $('textarea', { value: r.text, oninput: (e) => updateOnly(() => r.text = e.target.value) }))) : '';
  const idx = flat.indexOf(cur);
  const editor = $('section', { class: 'editor' }, notes, $('input', { class: 'beat-title', value: cur.beat.title, onchange: (e) => mutate(() => cur.beat.title = e.target.value) }), $('textarea', { class: 'writing-box', placeholder: mode === 'plan' ? 'Plan this beat. These notes are never compiled.' : 'Write the manuscript for this beat. Only this text is compiled.', value: mode === 'plan' ? cur.beat.notes : cur.beat.matter, oninput: (e) => updateOnly(() => cur.beat[mode === 'plan' ? 'notes' : 'matter'] = e.target.value) }), $('div', { class: 'stepper' }, $('button', { disabled: idx === 0, onclick: () => { const prev = flat[idx - 1]; selected.scene = prev.sceneIndex; selected.beat = prev.beatIndex; render(); } }, 'Previous'), $('span', { text: `${idx + 1} / ${flat.length}` }), $('button', { disabled: idx === flat.length - 1, onclick: () => { const next = flat[idx + 1]; selected.scene = next.sceneIndex; selected.beat = next.beatIndex; render(); } }, 'Next')));
  root.append($('main', { class: 'app' }, sidebar, $('section', { class: 'workspace' }, toolbar, $('div', { class: 'stage' }, sequence, editor))));
}
render();
