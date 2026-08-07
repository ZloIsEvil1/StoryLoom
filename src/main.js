const STORAGE_KEY = 'storyloom.currentProject.v2';
const LEGACY_STORAGE_KEY = 'storyloom.currentProject.v1';
const RECENTS_KEY = 'storyloom.recentProjects.v2';
const root = document.getElementById('root');

const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const beatLabel = (part, chapter, scene, beat) => `${part + 1}.${chapter + 1}.${scene + 1}.${beat + 1}`;
const sceneLabel = (part, chapter, scene) => `${part + 1}.${chapter + 1}.${scene + 1}`;
const chapterLabel = (part, chapter) => `${part + 1}.${chapter + 1}`;
const makeBeat = (title = 'New beat') => ({ id: uid(), title, notes: '', matter: '' });
const makeScene = (title = 'New scene') => ({ id: uid(), title, notes: '', beats: [makeBeat('Beat 1')] });
const makeChapter = (title = 'New chapter') => ({ id: uid(), title, notes: '', reminders: [], scenes: [makeScene('Scene 1')] });
const makePart = (title = 'Part 1') => ({ id: uid(), title, chapters: [makeChapter('Chapter 1')] });
const makeProject = () => ({ id: uid(), title: 'Untitled Story', parts: [makePart()] });

let project = normalizeProject(readJson(STORAGE_KEY) || readJson(LEGACY_STORAGE_KEY) || makeProject());
let selected = { part: 0, chapter: 0, scene: 0, beat: 0 };
let mode = 'write';
let notesVisible = true;
let dirHandle = null;
let conveyor = null;

function readJson(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
  catch { return fallback; }
}
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== false && value != null) node[key] = value;
  });
  children.flat().forEach((child) => node.append(child?.nodeType ? child : document.createTextNode(child ?? '')));
  return node;
}
function button(label, options = {}) {
  return el('button', { class: options.class || '', title: options.title || '', disabled: options.disabled, onclick: options.onclick }, options.icon ? el('span', { class: 'icon', text: options.icon }) : '', label);
}
function normalizeProject(input) {
  const next = input?.parts?.length ? input : makeProject();
  next.id ||= uid();
  next.title ||= 'Untitled Story';
  next.parts.forEach((part, partIndex) => {
    part.id ||= uid();
    part.title ||= `Part ${partIndex + 1}`;
    if (!part.chapters?.length) part.chapters = [makeChapter('Chapter 1')];
    part.chapters.forEach((chapter, chapterIndex) => {
      chapter.id ||= uid();
      chapter.title ||= `Chapter ${chapterIndex + 1}`;
      chapter.notes ||= '';
      chapter.reminders ||= [];
      if (!chapter.scenes?.length) chapter.scenes = [makeScene('Scene 1')];
      chapter.scenes.forEach((scene, sceneIndex) => {
        scene.id ||= uid();
        scene.title ||= `Scene ${sceneIndex + 1}`;
        scene.notes ||= '';
        if (!scene.beats?.length) scene.beats = [makeBeat('Beat 1')];
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
function part() { return project.parts[selected.part]; }
function chapter() { return part().chapters[selected.chapter]; }
function scene() { return chapter().scenes[selected.scene]; }
function beat() { return scene().beats[selected.beat]; }
function clampSelection() {
  selected.part = Math.max(0, Math.min(selected.part, project.parts.length - 1));
  selected.chapter = Math.max(0, Math.min(selected.chapter, part().chapters.length - 1));
  selected.scene = Math.max(0, Math.min(selected.scene, chapter().scenes.length - 1));
  selected.beat = Math.max(0, Math.min(selected.beat, scene().beats.length - 1));
}
function rememberProject() {
  const recents = readJson(RECENTS_KEY, []);
  const snapshot = structuredClone(project);
  snapshot.updatedAt = new Date().toISOString();
  localStorage.setItem(RECENTS_KEY, JSON.stringify([{ id: snapshot.id, title: snapshot.title, updatedAt: snapshot.updatedAt, project: snapshot }, ...recents.filter((item) => item.id !== snapshot.id)].slice(0, 8)));
}
function saveLocal() {
  project.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  rememberProject();
}
function rerender(mutator) {
  mutator?.();
  clampSelection();
  saveLocal();
  render();
}
function updateOnly(mutator) {
  mutator();
  saveLocal();
}
function removeRequired(list, index, replacement) {
  if (list.length <= 1) list.splice(0, 1, replacement());
  else list.splice(index, 1);
}

function addPart() { rerender(() => { project.parts.push(makePart(`Part ${project.parts.length + 1}`)); selected = { part: project.parts.length - 1, chapter: 0, scene: 0, beat: 0 }; }); }
function addChapter(startConveyor = false) { rerender(() => { part().chapters.push(makeChapter(`Chapter ${part().chapters.length + 1}`)); selected.chapter = part().chapters.length - 1; selected.scene = 0; selected.beat = 0; if (startConveyor) conveyor = { phase: 'chapter' }; }); }
function addScene() { rerender(() => { chapter().scenes.push(makeScene(`Scene ${chapter().scenes.length + 1}`)); selected.scene = chapter().scenes.length - 1; selected.beat = 0; }); }
function addBeat() { rerender(() => { scene().beats.push(makeBeat(`Beat ${scene().beats.length + 1}`)); selected.beat = scene().beats.length - 1; }); }
function addReminder() { rerender(() => chapter().reminders.push({ id: uid(), text: 'New note' })); }
function deletePart(index) { rerender(() => { removeRequired(project.parts, index, () => makePart()); selected.part = Math.min(index, project.parts.length - 1); selected.chapter = selected.scene = selected.beat = 0; conveyor = null; }); }
function deleteChapter(index) { rerender(() => { removeRequired(part().chapters, index, () => makeChapter('Chapter 1')); selected.chapter = Math.min(index, part().chapters.length - 1); selected.scene = selected.beat = 0; conveyor = null; }); }
function deleteScene(index) { rerender(() => { removeRequired(chapter().scenes, index, () => makeScene('Scene 1')); selected.scene = Math.min(index, chapter().scenes.length - 1); selected.beat = 0; conveyor = null; }); }
function deleteBeat(index) { rerender(() => { removeRequired(scene().beats, index, () => makeBeat('Beat 1')); selected.beat = Math.min(index, scene().beats.length - 1); conveyor = null; }); }
function deleteReminder(id) { rerender(() => { chapter().reminders = chapter().reminders.filter((note) => note.id !== id); }); }

function startConveyorForCurrent() { conveyor = { phase: 'chapter' }; mode = 'plan'; render(); }
function conveyorNext() {
  if (!conveyor) return;
  if (conveyor.phase === 'chapter') conveyor.phase = 'scene';
  else if (conveyor.phase === 'scene') conveyor.phase = 'beat';
  else if (conveyor.phase === 'beat') addBeat();
  saveLocal();
  render();
}
function conveyorNextScene() {
  addScene();
  conveyor = { phase: 'scene' };
  mode = 'plan';
  render();
}
function conveyorDoneScene() { conveyor = { phase: 'scene' }; render(); }
function conveyorDoneChapter() { conveyor = null; mode = 'write'; render(); }

function compileText() {
  return project.parts.flatMap((p) => [p.title, ...p.chapters.flatMap((c) => ['', c.title, ...c.scenes.flatMap((s) => s.beats.map((b) => b.matter.trim()).filter(Boolean))])]).join('\n\n').trim();
}
const escPdf = (text) => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
function makePdfBlob(text, title) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = words.reduce((acc, word) => { const last = acc.at(-1) || ''; (last + ' ' + word).trim().length > 82 ? acc.push(word) : acc[acc.length - 1] = (last + ' ' + word).trim(); return acc; }, ['']);
  const pages = []; for (let i = 0; i < lines.length; i += 42) pages.push(lines.slice(i, i + 42)); if (!pages.length) pages.push(['']);
  const objects = ['', '<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>'];
  const kids = [];
  pages.forEach((page) => { const content = ['BT', '/F1 12 Tf', '72 760 Td', `(${escPdf(title)}) Tj`, '0 -28 Td', ...page.flatMap((line) => [`(${escPdf(line)}) Tj`, '0 -16 Td']), 'ET'].join('\n'); const contentId = objects.length; objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`); const pageId = objects.length; objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`); kids.push(`${pageId} 0 R`); });
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  let pdf = '%PDF-1.4\n'; const offsets = [0]; objects.slice(1).forEach((obj, i) => { offsets[i + 1] = pdf.length; pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = pdf.length; pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n` + offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}
function download(name, blob) { const link = el('a', { href: URL.createObjectURL(blob), download: name }); link.click(); URL.revokeObjectURL(link.href); }
async function chooseDirectory() { if (!window.showDirectoryPicker) return alert('Directory saving is available in Chromium-based browsers. Export downloads still work everywhere.'); dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' }); }
async function saveProject() { const data = JSON.stringify(project, null, 2); if (dirHandle) { const file = await dirHandle.getFileHandle(`${project.title || 'storyloom'}.storyloom.json`, { create: true }); const writable = await file.createWritable(); await writable.write(data); await writable.close(); } else download(`${project.title || 'storyloom'}.storyloom.json`, new Blob([data], { type: 'application/json' })); }
async function loadProjectFile(event) {
  const [file] = event.target.files;
  if (!file) return;
  try { project = normalizeProject(JSON.parse(await file.text())); selected = { part: 0, chapter: 0, scene: 0, beat: 0 }; conveyor = null; saveLocal(); render(); }
  catch { alert('That file is not a valid StoryLoom project JSON file.'); }
  event.target.value = '';
}

function renderSidebar() {
  const fileInput = el('input', { class: 'hidden-file', type: 'file', accept: '.json,.storyloom.json,application/json', onchange: loadProjectFile });
  return el('aside', { class: 'sidebar' },
    el('div', { class: 'brand' }, el('span', { class: 'logo', text: 'SL' }), el('input', { value: project.title, onchange: (event) => rerender(() => project.title = event.target.value) })),
    el('div', { class: 'action-grid' }, button('New Part', { icon: '+', onclick: addPart }), button('New Chapter', { icon: '+', onclick: () => addChapter(true) }), button('Load', { icon: '↑', onclick: () => fileInput.click() }), button('Save', { icon: '✓', onclick: saveProject }), button('Save Folder', { icon: '▣', onclick: chooseDirectory }), button('Compile PDF', { icon: '↓', onclick: () => download(`${project.title || 'storyloom'}.pdf`, makePdfBlob(compileText(), project.title)) }), fileInput),
    renderRecents(),
    el('nav', { class: 'tree' }, project.parts.map((p, partIndex) => el('section', { class: 'tree-part' },
      el('div', { class: 'tree-heading' }, el('button', { class: selected.part === partIndex ? 'tree-title active' : 'tree-title', onclick: () => { selected = { part: partIndex, chapter: 0, scene: 0, beat: 0 }; conveyor = null; render(); } }, `${partIndex + 1}. ${p.title}`), button('×', { class: 'icon-button danger', title: 'Delete part', onclick: () => deletePart(partIndex) })),
      p.chapters.map((c, chapterIndex) => el('div', { class: 'tree-row' }, el('button', { class: selected.part === partIndex && selected.chapter === chapterIndex ? 'tree-item active' : 'tree-item', onclick: () => { selected = { part: partIndex, chapter: chapterIndex, scene: 0, beat: 0 }; conveyor = null; render(); } }, `${chapterLabel(partIndex, chapterIndex)} ${c.title}`), button('×', { class: 'icon-button danger', title: 'Delete chapter', onclick: () => { selected.part = partIndex; deleteChapter(chapterIndex); } })))))));
}
function renderRecents() {
  const recents = readJson(RECENTS_KEY, []);
  return el('section', { class: 'recents' }, el('h2', { text: 'Recent Projects' }), recents.length ? recents.map((item) => button(`${item.title} · ${new Date(item.updatedAt).toLocaleDateString()}`, { icon: '↻', onclick: () => { project = normalizeProject(structuredClone(item.project)); selected = { part: 0, chapter: 0, scene: 0, beat: 0 }; conveyor = null; saveLocal(); render(); } })) : el('p', { text: 'Saved and loaded projects appear here.' }));
}
function renderTopbar() {
  return el('header', { class: 'topbar' },
    el('div', {}, el('span', { class: 'eyebrow', text: `Chapter ${chapterLabel(selected.part, selected.chapter)}` }), el('input', { class: 'chapter-title', value: chapter().title, onchange: (event) => rerender(() => chapter().title = event.target.value) })),
    el('div', { class: 'toolbar' }, button('Plan', { class: mode === 'plan' ? 'primary' : '', onclick: () => { mode = 'plan'; conveyor = null; render(); } }), button('Write', { class: mode === 'write' ? 'primary' : '', onclick: () => { mode = 'write'; conveyor = null; render(); } }), button('Conveyor', { class: conveyor ? 'primary' : '', onclick: startConveyorForCurrent }), button(notesVisible ? 'Hide Notes' : 'Show Notes', { onclick: () => { notesVisible = !notesVisible; render(); } }), button('Scene', { icon: '+', onclick: addScene }), button('Beat', { icon: '+', onclick: addBeat }), button('Note', { icon: '+', onclick: addReminder }), button('Delete Chapter', { class: 'danger', onclick: () => deleteChapter(selected.chapter) })));
}
function renderOutline() {
  return el('section', { class: 'outline' }, el('h2', { text: 'Chapter Map' }), chapter().scenes.map((s, sceneIndex) => el('article', { class: selected.scene === sceneIndex ? 'outline-scene active' : 'outline-scene' },
    el('div', { class: 'outline-heading' }, el('button', { class: 'outline-title', onclick: () => { selected.scene = sceneIndex; selected.beat = 0; conveyor = null; render(); } }, `${sceneLabel(selected.part, selected.chapter, sceneIndex)} ${s.title}`), button('×', { class: 'icon-button danger', title: 'Delete scene', onclick: () => deleteScene(sceneIndex) })),
    s.beats.map((b, beatIndex) => el('div', { class: 'beat-row' }, el('button', { class: selected.scene === sceneIndex && selected.beat === beatIndex ? 'beat-pill active' : 'beat-pill', onclick: () => { selected.scene = sceneIndex; selected.beat = beatIndex; conveyor = null; render(); } }, `${beatLabel(selected.part, selected.chapter, sceneIndex, beatIndex)} ${b.title}`), button('×', { class: 'icon-button danger', title: 'Delete beat', onclick: () => { selected.scene = sceneIndex; deleteBeat(beatIndex); } }))))));
}
function renderNotesPanel() {
  if (!notesVisible) return '';
  return el('aside', { class: 'floating-notes' }, el('h3', { text: 'Notes in view' }), el('label', { text: `Chapter ${chapterLabel(selected.part, selected.chapter)}` }), el('textarea', { value: chapter().notes, placeholder: 'Chapter notes', oninput: (event) => updateOnly(() => chapter().notes = event.target.value) }), el('label', { text: `Scene ${sceneLabel(selected.part, selected.chapter, selected.scene)}` }), el('textarea', { value: scene().notes, placeholder: 'Scene notes', oninput: (event) => updateOnly(() => scene().notes = event.target.value) }), el('label', { text: `Beat ${beatLabel(selected.part, selected.chapter, selected.scene, selected.beat)}` }), el('textarea', { value: beat().notes, placeholder: 'Beat notes', oninput: (event) => updateOnly(() => beat().notes = event.target.value) }), el('div', { class: 'note-list' }, chapter().reminders.map((note) => el('div', { class: 'note-row' }, el('textarea', { value: note.text, oninput: (event) => updateOnly(() => note.text = event.target.value) }), button('×', { class: 'icon-button danger', title: 'Delete note', onclick: () => deleteReminder(note.id) })))));
}
function renderEditor() {
  return el('section', { class: 'editor' }, renderNotesPanel(), el('span', { class: 'eyebrow', text: `Beat ${beatLabel(selected.part, selected.chapter, selected.scene, selected.beat)}` }), el('input', { class: 'beat-title', value: beat().title, onchange: (event) => rerender(() => beat().title = event.target.value) }), el('textarea', { class: 'writing-box', value: mode === 'plan' ? beat().notes : beat().matter, placeholder: mode === 'plan' ? 'Plan this beat. Notes are excluded from compilation.' : 'Write manuscript text for this beat. Only this field compiles.', oninput: (event) => updateOnly(() => beat()[mode === 'plan' ? 'notes' : 'matter'] = event.target.value) }), renderStepper());
}
function renderStepper() {
  const beats = chapter().scenes.flatMap((s, sceneIndex) => s.beats.map((b, beatIndex) => ({ sceneIndex, beatIndex })));
  const index = beats.findIndex((item) => item.sceneIndex === selected.scene && item.beatIndex === selected.beat);
  return el('div', { class: 'stepper' }, button('Previous Beat', { disabled: index <= 0, onclick: () => { Object.assign(selected, beats[index - 1]); render(); } }), el('span', { text: `${index + 1} / ${beats.length}` }), button('Next Beat', { disabled: index >= beats.length - 1, onclick: () => { Object.assign(selected, beats[index + 1]); render(); } }));
}
function renderConveyor() {
  const label = conveyor.phase === 'chapter' ? chapterLabel(selected.part, selected.chapter) : conveyor.phase === 'scene' ? sceneLabel(selected.part, selected.chapter, selected.scene) : beatLabel(selected.part, selected.chapter, selected.scene, selected.beat);
  const title = conveyor.phase === 'chapter' ? 'Chapter Planning' : conveyor.phase === 'scene' ? 'Scene Planning' : 'Beat Planning';
  const target = conveyor.phase === 'chapter' ? chapter() : conveyor.phase === 'scene' ? scene() : beat();
  return el('section', { class: 'conveyor' }, el('div', { class: 'conveyor-card' }, el('span', { class: 'eyebrow', text: label }), el('h1', { text: title }), el('input', { class: 'conveyor-title', value: target.title, onchange: (event) => rerender(() => target.title = event.target.value) }), el('textarea', { class: 'conveyor-notes', value: target.notes, placeholder: `Notes for ${title.toLowerCase()}`, oninput: (event) => updateOnly(() => target.notes = event.target.value) }), renderConveyorActions()));
}
function renderConveyorActions() {
  if (conveyor.phase === 'chapter') return el('div', { class: 'conveyor-actions' }, button('Next: Plan Scene 1', { class: 'primary', onclick: conveyorNext }), button('Done', { onclick: conveyorDoneChapter }));
  if (conveyor.phase === 'scene') return el('div', { class: 'conveyor-actions' }, button('Plan Beats for This Scene', { class: 'primary', onclick: conveyorNext }), button('Add Another Scene', { onclick: conveyorNextScene }), button('Done Chapter', { onclick: conveyorDoneChapter }));
  return el('div', { class: 'conveyor-actions' }, button('Next Beat', { class: 'primary', onclick: conveyorNext }), button('Done With Scene', { onclick: conveyorDoneScene }), button('New Scene', { onclick: conveyorNextScene }), button('Done Chapter', { onclick: conveyorDoneChapter }));
}
function render() {
  clampSelection();
  root.innerHTML = '';
  root.append(el('main', { class: 'app' }, renderSidebar(), el('section', { class: 'workspace' }, renderTopbar(), conveyor ? renderConveyor() : el('div', { class: 'work-grid' }, renderOutline(), renderEditor()))));
}

saveLocal();
render();
