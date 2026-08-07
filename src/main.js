const STORAGE_KEY = 'storyloom.currentProject.v1';
const RECENTS_KEY = 'storyloom.recentProjects.v1';
const root = document.getElementById('root');
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const emptyBeat = (title = 'New beat') => ({ id: uid(), title, notes: '', matter: '' });
const emptyScene = (title = 'New scene') => ({ id: uid(), title, notes: '', beats: [emptyBeat('Beat 1')] });
const emptyChapter = (title = 'New chapter') => ({ id: uid(), title, notes: '', scenes: [emptyScene('Scene 1')], reminders: [] });
const emptyPart = (title = 'Part 1') => ({ id: uid(), title, chapters: [emptyChapter('Chapter 1')] });
const starterProject = () => ({ title: 'Untitled Story', parts: [emptyPart()] });
let project = normalizeProject(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || starterProject());
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
const recentProjects = () => JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
const activePart = () => project.parts[selected.part];
const activeChapter = () => activePart().chapters[selected.chapter];
const flatChapter = () => activeChapter().scenes.flatMap((scene, sceneIndex) => scene.beats.map((beat, beatIndex) => ({ scene, beat, sceneIndex, beatIndex })));
const current = () => flatChapter().find((x) => x.sceneIndex === selected.scene && x.beatIndex === selected.beat) || flatChapter()[0];

function normalizeProject(value) {
  const next = value?.parts?.length ? value : starterProject();
  next.parts.forEach((part, partIndex) => {
    part.id ||= uid();
    part.title ||= `Part ${partIndex + 1}`;
    if (!part.chapters?.length) part.chapters = [emptyChapter('Chapter 1')];
    part.chapters.forEach((chapter, chapterIndex) => {
      chapter.id ||= uid();
      chapter.title ||= `Chapter ${chapterIndex + 1}`;
      chapter.reminders ||= [];
      if (!chapter.scenes?.length) chapter.scenes = [emptyScene('Scene 1')];
      chapter.scenes.forEach((scene, sceneIndex) => {
        scene.id ||= uid();
        scene.title ||= `Scene ${sceneIndex + 1}`;
        scene.notes ||= '';
        if (!scene.beats?.length) scene.beats = [emptyBeat('Beat 1')];
        scene.beats.forEach((beat, beatIndex) => {
          beat.id ||= uid();
          beat.title ||= `Beat ${beatIndex + 1}`;
          beat.notes ||= '';
          beat.matter ||= '';
        });
      });
    });
  });
  return next;
}

function rememberProject() {
  const snapshot = { id: project.id || uid(), title: project.title || 'Untitled Story', updatedAt: new Date().toISOString(), project };
  project.id = snapshot.id;
  const recents = [snapshot, ...recentProjects().filter((item) => item.id !== snapshot.id)].slice(0, 8);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
}
function saveLocal() {
  project.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  rememberProject();
}
const mutate = (fn) => { fn(project); clampSelection(); saveLocal(); render(); };
const updateOnly = (fn) => { fn(project); saveLocal(); };
function clampSelection() {
  selected.part = Math.max(0, Math.min(selected.part, project.parts.length - 1));
  selected.chapter = Math.max(0, Math.min(selected.chapter, activePart().chapters.length - 1));
  selected.scene = Math.max(0, Math.min(selected.scene, activeChapter().scenes.length - 1));
  selected.beat = Math.max(0, Math.min(selected.beat, activeChapter().scenes[selected.scene].beats.length - 1));
}

function removeAt(list, index, replacementFactory) {
  if (list.length === 1) list.splice(0, 1, replacementFactory());
  else list.splice(index, 1);
}
function deletePart(index = selected.part) { mutate((d) => { removeAt(d.parts, index, () => emptyPart()); selected.part = Math.max(0, Math.min(selected.part, d.parts.length - 1)); selected.chapter = selected.scene = selected.beat = 0; }); }
function deleteChapter() { mutate(() => { removeAt(activePart().chapters, selected.chapter, () => emptyChapter('Chapter 1')); selected.chapter = Math.max(0, selected.chapter - 1); selected.scene = selected.beat = 0; }); }
function deleteScene(index) { mutate(() => { removeAt(activeChapter().scenes, index, () => emptyScene('Scene 1')); selected.scene = Math.max(0, Math.min(selected.scene, activeChapter().scenes.length - 1)); selected.beat = 0; }); }
function deleteBeat(sceneIndex, beatIndex) { mutate(() => { removeAt(activeChapter().scenes[sceneIndex].beats, beatIndex, () => emptyBeat('Beat 1')); selected.scene = sceneIndex; selected.beat = Math.max(0, Math.min(beatIndex - 1, activeChapter().scenes[sceneIndex].beats.length - 1)); }); }
function deleteReminder(id) { mutate(() => { activeChapter().reminders = activeChapter().reminders.filter((reminder) => reminder.id !== id); }); }

function loadProjectData(data) {
  project = normalizeProject(data);
  selected = { part: 0, chapter: 0, scene: 0, beat: 0 };
  saveLocal();
  render();
}
async function loadProjectFile(event) {
  const [file] = event.target.files;
  if (!file) return;
  try { loadProjectData(JSON.parse(await file.text())); }
  catch { alert('That file is not a valid StoryLoom project JSON file.'); }
  event.target.value = '';
}

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

function renderRecentProjects() {
  const recents = recentProjects();
  return $('section', { class: 'recent-projects' }, $('h3', { text: 'Recent Projects' }), recents.length ? recents.map((item) => $('button', { onclick: () => loadProjectData(item.project) }, icon('↻'), `${item.title} · ${new Date(item.updatedAt).toLocaleDateString()}`)) : $('p', { text: 'Saved or loaded projects appear here.' }));
}
function renderSidebar() {
  const fileInput = $('input', { class: 'hidden-file', type: 'file', accept: '.json,.storyloom.json,application/json', onchange: loadProjectFile });
  return $('aside', { class: 'sidebar' },
    $('div', { class: 'brand' }, icon('✦'), $('input', { value: project.title, onchange: (e) => mutate((d) => d.title = e.target.value) })),
    $('button', { onclick: () => mutate((d) => { d.parts.push(emptyPart(`Part ${d.parts.length + 1}`)); selected.part = d.parts.length - 1; selected.chapter = selected.scene = selected.beat = 0; }) }, icon('＋'), 'New Part'),
    $('button', { onclick: () => mutate(() => { activePart().chapters.push(emptyChapter(`Chapter ${activePart().chapters.length + 1}`)); selected.chapter = activePart().chapters.length - 1; selected.scene = selected.beat = 0; }) }, icon('＋'), 'New Chapter'),
    $('button', { onclick: () => fileInput.click() }, icon('⇧'), 'Load Project'), fileInput,
    $('button', { onclick: chooseDirectory }, icon('▣'), 'Choose Save Directory'),
    $('button', { onclick: saveProject }, icon('✓'), 'Save Project'),
    $('button', { onclick: () => download(`${project.title || 'storyloom'}.pdf`, makePdfBlob(compileText(), project.title)) }, icon('⇩'), 'Compile PDF'),
    renderRecentProjects(),
    $('nav', { class: 'tree' }, project.parts.map((p, pi) => $('section', {}, $('div', { class: 'row-heading' }, $('input', { value: p.title, onchange: (e) => mutate(() => p.title = e.target.value) }), $('button', { class: 'danger compact', title: 'Delete part', onclick: () => deletePart(pi) }, '×')), p.chapters.map((c, ci) => $('button', { class: selected.part === pi && selected.chapter === ci ? 'active' : '', onclick: () => { selected = { part: pi, chapter: ci, scene: 0, beat: 0 }; render(); } }, icon('◈'), c.title))))));
}
function renderToolbar(ch) {
  return $('header', { class: 'toolbar' },
    $('input', { class: 'chapter-title', value: ch.title, onchange: (e) => mutate(() => ch.title = e.target.value) }),
    $('button', { class: mode === 'plan' ? 'primary' : '', onclick: () => { mode = 'plan'; render(); } }, icon('☷'), 'Plan'),
    $('button', { class: mode === 'write' ? 'primary' : '', onclick: () => { mode = 'write'; render(); } }, icon('✎'), 'Write'),
    $('button', { onclick: () => { notesVisible = !notesVisible; render(); } }, icon(notesVisible ? '◐' : '◑'), notesVisible ? 'Hide Notes' : 'Show Notes'),
    $('button', { onclick: () => mutate(() => ch.scenes.push(emptyScene(`Scene ${ch.scenes.length + 1}`))) }, icon('＋'), 'Scene'),
    $('button', { onclick: () => mutate(() => ch.scenes[selected.scene].beats.push(emptyBeat(`Beat ${ch.scenes[selected.scene].beats.length + 1}`))) }, icon('＋'), 'Beat'),
    $('button', { onclick: () => mutate(() => ch.reminders.push({ id: uid(), text: 'New reminder' })) }, icon('※'), 'Note'),
    $('button', { class: 'danger', onclick: deleteChapter }, icon('×'), 'Chapter'));
}
function renderSequence(ch) {
  return $('div', { class: 'sequence' }, ch.scenes.map((scene, si) => $('div', { class: 'scene-card' },
    $('div', { class: 'row-heading' }, $('input', { value: scene.title, onchange: (e) => mutate(() => scene.title = e.target.value) }), $('button', { class: 'danger compact', title: 'Delete scene', onclick: () => deleteScene(si) }, '×')),
    scene.beats.map((beat, bi) => $('div', { class: 'beat-row' }, $('button', { class: selected.scene === si && selected.beat === bi ? 'active' : '', onclick: () => { selected.scene = si; selected.beat = bi; render(); } }, beat.title || `Beat ${bi + 1}`), $('button', { class: 'danger compact', title: 'Delete beat', onclick: () => deleteBeat(si, bi) }, '×'))))));
}
function renderNotes(ch, cur) {
  if (!notesVisible) return '';
  return $('aside', { class: 'floating-notes' },
    $('h4', { text: cur.scene.title }),
    $('textarea', { placeholder: 'Scene notes', value: cur.scene.notes, oninput: (e) => updateOnly(() => cur.scene.notes = e.target.value) }),
    $('h4', { text: cur.beat.title }),
    $('textarea', { placeholder: 'Beat notes', value: cur.beat.notes, oninput: (e) => updateOnly(() => cur.beat.notes = e.target.value) }),
    ch.reminders.map((r) => $('div', { class: 'note-row' }, $('textarea', { value: r.text, oninput: (e) => updateOnly(() => r.text = e.target.value) }), $('button', { class: 'danger compact', title: 'Delete note', onclick: () => deleteReminder(r.id) }, '×'))));
}
function render() {
  clampSelection();
  const ch = activeChapter(), cur = current(), flat = flatChapter(), idx = flat.indexOf(cur);
  root.innerHTML = '';
  const editor = $('section', { class: 'editor' }, renderNotes(ch, cur), $('input', { class: 'beat-title', value: cur.beat.title, onchange: (e) => mutate(() => cur.beat.title = e.target.value) }), $('textarea', { class: 'writing-box', placeholder: mode === 'plan' ? 'Plan this beat. These notes are never compiled.' : 'Write the manuscript for this beat. Only this text is compiled.', value: mode === 'plan' ? cur.beat.notes : cur.beat.matter, oninput: (e) => updateOnly(() => cur.beat[mode === 'plan' ? 'notes' : 'matter'] = e.target.value) }), $('div', { class: 'stepper' }, $('button', { disabled: idx === 0, onclick: () => { const prev = flat[idx - 1]; selected.scene = prev.sceneIndex; selected.beat = prev.beatIndex; render(); } }, 'Previous'), $('span', { text: `${idx + 1} / ${flat.length}` }), $('button', { disabled: idx === flat.length - 1, onclick: () => { const next = flat[idx + 1]; selected.scene = next.sceneIndex; selected.beat = next.beatIndex; render(); } }, 'Next')));
  root.append($('main', { class: 'app' }, renderSidebar(), $('section', { class: 'workspace' }, renderToolbar(ch), $('div', { class: 'stage' }, renderSequence(ch), editor))));
}
saveLocal();
render();
