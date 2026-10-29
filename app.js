const $ = id => document.getElementById(id);
const ACTIVE_KEY = 'planilla-tma-active-v2';
const TYPE_LABELS = {'8x3': '8 × 3', '3x1-EAL': '3 × 1'};

let data;
let selectedType = '8x3';
let draft = null;
let active = readActive();
let blocks = [];

function readActive() {
  try { return JSON.parse(localStorage.getItem(ACTIVE_KEY)); }
  catch { return null; }
}

function saveActive() {
  try {
    if (active) localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* La planilla sigue funcionando sin almacenamiento local. */ }
}

function nextShiftBase(now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 870) return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 30).getTime();
  if (minutes < 1350) return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0).getTime();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 7, 30).getTime();
}

function toMinutes(hhmm) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

function fmt(time) {
  return new Intl.DateTimeFormat('es-ES', {hour: '2-digit', minute: '2-digit'}).format(new Date(time));
}

function role(code) {
  if (code === 'Libre') return 'Libre';
  return code[0] === 'E' ? 'Ejecutivo' : 'Ayudante';
}

function slot(code) { return code === 'Libre' ? null : code.slice(-1); }

function templateSlots(type, number) {
  return [...new Set(data.templates[type][number].map(item => slot(item.code)).filter(Boolean))].sort();
}

function makeBlocks(plan) {
  return data.templates[plan.type][plan.number].map(item => ({
    start: plan.baseMs + (toMinutes(item.start) - 900) * 60000,
    end: plan.baseMs + (toMinutes(item.end) - 900) * 60000,
    role: role(item.code),
    sector: slot(item.code) ? plan.sectors[slot(item.code)] : ''
  }));
}

function showScreen(name) {
  for (const id of ['homeScreen', 'sectorsScreen', 'planScreen']) {
    $(id).classList.toggle('hidden', id !== name);
  }
  $('backButton').classList.toggle('hidden', name === 'homeScreen');
}

function renderHome() {
  showScreen('homeScreen');
  $('templateTabs').replaceChildren();
  for (const type of Object.keys(TYPE_LABELS)) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.role = 'tab';
    tab.className = `template-tab ${type === selectedType ? 'active' : ''}`;
    tab.setAttribute('aria-selected', String(type === selectedType));
    tab.textContent = TYPE_LABELS[type];
    tab.addEventListener('click', () => { selectedType = type; renderHome(); });
    $('templateTabs').append(tab);
  }
  $('templateTitle').textContent = TYPE_LABELS[selectedType];
  $('templateHint').textContent = 'Elige el número de la hoja de firmas';
  $('numberButtons').replaceChildren();
  for (const number of Object.keys(data.templates[selectedType])) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = number;
    button.setAttribute('aria-label', `Planilla número ${number}`);
    button.addEventListener('click', () => beginSelection(selectedType, number));
    $('numberButtons').append(button);
  }
}

function beginSelection(type, number) {
  draft = {type, number, baseMs: nextShiftBase(), slots: templateSlots(type, number), chosen: []};
  renderSectors();
}

function renderSectors() {
  showScreen('sectorsScreen');
  const remaining = draft.slots.length - draft.chosen.length;
  $('sectorTitle').textContent = draft.slots.length === 1 ? 'Escoge tu sector' :
    `Escoge ${remaining === draft.slots.length ? 'tu primer sector' : remaining === 1 ? 'el último sector' : 'el siguiente sector'}`;
  $('sectorHint').textContent = `Planilla ${draft.number} · ${TYPE_LABELS[draft.type]} · ${draft.chosen.length + 1} de ${draft.slots.length}`;
  $('chosenSectors').replaceChildren();
  draft.slots.forEach((item, index) => {
    const chip = document.createElement('span');
    chip.textContent = draft.chosen[index] || `S${item}`;
    if (!draft.chosen[index]) chip.className = 'pending';
    $('chosenSectors').append(chip);
  });
  $('sectorButtons').replaceChildren();
  for (const sector of data.sectors) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = sector;
    button.disabled = draft.chosen.includes(sector);
    button.addEventListener('click', () => chooseSector(sector));
    $('sectorButtons').append(button);
  }
}

function chooseSector(sector) {
  draft.chosen.push(sector);
  if (draft.chosen.length < draft.slots.length) return renderSectors();
  const sectors = {};
  draft.slots.forEach((item, index) => { sectors[item] = draft.chosen[index]; });
  active = {type: draft.type, number: draft.number, baseMs: draft.baseMs, sectors};
  draft = null;
  saveActive();
  renderPlan();
}

function renderPlan() {
  blocks = makeBlocks(active);
  showScreen('planScreen');
  $('planType').textContent = TYPE_LABELS[active.type];
  $('planNumber').textContent = `N.º ${active.number}`;
  const chart = $('scheduleChart');
  chart.querySelectorAll('.chart-rows, .chart-end').forEach(element => element.remove());
  const rows = document.createElement('div');
  rows.className = 'chart-rows';
  rows.style.height = 'calc(100% - 28px)';
  const total = blocks.at(-1).end - blocks[0].start;
  for (const block of blocks) {
    const row = document.createElement('div');
    row.className = 'chart-row';
    row.style.height = `${(block.end - block.start) / total * 100}%`;
    const time = document.createElement('span');
    time.className = 'chart-time';
    time.textContent = fmt(block.start);
    const roleBox = document.createElement('span');
    roleBox.className = `chart-block ${block.role === 'Ejecutivo' ? 'executive' : block.role === 'Ayudante' ? 'assistant' : 'free'}`;
    roleBox.textContent = block.role === 'Libre' ? 'Libre' : `${block.role} ${block.sector}`;
    row.append(time, roleBox);
    rows.append(row);
  }
  const end = document.createElement('div');
  end.className = 'chart-end';
  end.textContent = fmt(blocks.at(-1).end);
  chart.append(rows, end);
  $('planImage').src = `./images/${active.type}.png`;
  updateTimeLine();
}

function updateTimeLine() {
  if (!active || !blocks.length) return;
  const now = Date.now();
  const start = blocks[0].start;
  const end = blocks.at(-1).end;
  const fraction = (now - start) / (end - start);
  const visible = fraction >= 0 && fraction <= 1;
  $('nowLine').classList.toggle('hidden', !visible);
  $('imageNowLine').classList.toggle('hidden', !visible);
  if (visible) {
    $('nowLine').style.top = `calc((100% - 28px) * ${fraction})`;
    $('imageNowLine').style.left = `${(1 - fraction) * 100}%`;
  }
  const upcoming = blocks.find(block => block.start > now);
  const current = blocks.find(block => block.start <= now && block.end > now);
  $('planStatus').textContent = current ?
    `Ahora: ${current.role}${current.sector ? ' ' + current.sector : ''} · Hasta las ${fmt(current.end)}` :
    upcoming ? `Próximo tramo a las ${fmt(upcoming.start)}` : 'Turno terminado';
}

function cancelPlan() {
  active = null;
  draft = null;
  blocks = [];
  saveActive();
  renderHome();
}

function back() {
  if ($('imageDialog').open) return $('imageDialog').close();
  if (!$('sectorsScreen').classList.contains('hidden')) { draft = null; renderHome(); }
  else if (!$('planScreen').classList.contains('hidden')) cancelPlan();
}

function refreshPlan() {
  if (!active) return;
  if (Date.now() >= blocks.at(-1).end) cancelPlan();
  else updateTimeLine();
}

function init() {
  data = window.PLANILLA_DATA;
  if (!data) throw Error('No se pudieron cargar las planillas');
  try { localStorage.removeItem('planilla-tma-prefs-v2'); } catch {}
  $('backButton').addEventListener('click', back);
  $('cancelButton').addEventListener('click', cancelPlan);
  $('scheduleChart').addEventListener('click', () => $('imageDialog').showModal());
  $('scheduleChart').addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      $('imageDialog').showModal();
    }
  });
  $('closeImage').addEventListener('click', () => $('imageDialog').close());
  $('imageDialog').querySelector('.image-frame').addEventListener('click', () => $('imageDialog').close());
  document.addEventListener('keydown', event => { if (event.key === 'Escape') back(); });
  const validActive = active && data.templates[active.type]?.[active.number] &&
    templateSlots(active.type, active.number).every(item => data.sectors.includes(active.sectors?.[item])) &&
    makeBlocks(active).at(-1).end > Date.now();
  if (validActive) {
    active = {type: active.type, number: active.number, baseMs: active.baseMs, sectors: active.sectors};
    saveActive();
    renderPlan();
  } else {
    active = null;
    saveActive();
    renderHome();
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  setInterval(refreshPlan, 15000);
}

try { init(); }
catch (error) {
  console.error(error);
  $('homeScreen').textContent = 'No se pudieron cargar las planillas. Recarga la página.';
}
