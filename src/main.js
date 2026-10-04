import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js';
import {
  createIcons,
  createElement,
  GraduationCap,
  Bot,
  Microscope,
  Info,
  X,
  Globe,
  Orbit,
  Moon,
  MoveHorizontal,
  EqualApproximately,
  ExternalLink,
} from 'lucide';
import sites from './data/sites.json';
import './style.css';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

const ANALOG = {
  mars: { label: 'Mars', color: '#ff6b4a' },
  moon: { label: 'Oy', color: '#c9d1e0' },
};

const TYPES = {
  desert: "Cho'l",
  volcano: 'Vulqon',
  crater: 'Krater',
  cave: "G'or",
  ice: 'Muzlik',
  water: 'Ekstremal suv',
};

const PARAMS = {
  aridity: 'Quruqlik',
  cold: 'Sovuqlik',
  radiation: 'Radiatsiya / UV',
  regolith: 'Tuproq',
  geology: 'Geologiya',
  isolation: 'Ajralganlik',
};

// O'xshashlik indeksi = parametrlar o'rtachasi (0–10) → foiz
const similarity = (s) => {
  const v = Object.values(s.params);
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10);
};

// Lucide ikonkasi → SVG matn (innerHTML ichida ishlatish uchun)
const icon = (node, size = 16) => createElement(node, { width: size, height: size, 'aria-hidden': 'true' }).outerHTML;

createIcons({ icons: { GraduationCap, Bot, Microscope, Info, X, Globe, Orbit, Moon } });

const esc = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Xarita ----------
const dark = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  { attribution: 'Tiles &copy; Esri', maxZoom: 16 },
);
const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const satellite = L.tileLayer(satelliteUrl, { attribution: 'Tiles &copy; Esri', maxZoom: 18 });

const map = L.map('map', { worldCopyJump: true, layers: [satellite], zoomControl: false }).setView([25, 0], 2);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.control.layers({ "Sun'iy yo'ldosh": satellite, "Qorong'i": dark }, null, { position: 'topright' }).addTo(map);

const markers = new Map();
for (const s of sites) {
  const m = L.circleMarker(s.coords, {
    radius: 9,
    color: '#fff',
    weight: 1.5,
    fillColor: ANALOG[s.analog].color,
    fillOpacity: 0.9,
    dashArray: s.proposed ? '3 3' : null,
  })
    .bindTooltip(`${s.name} · ${ANALOG[s.analog].label}`)
    .on('click', () => select(s.id))
    .addTo(map);
  markers.set(s.id, m);
}

// ---------- Filtrlar ----------
const state = { analog: 'all', type: 'all', query: '', selected: null };

const typeFilter = document.getElementById('type-filter');
typeFilter.innerHTML =
  `<button class="chip active" data-value="all">Barcha turlar</button>` +
  Object.entries(TYPES).map(([k, v]) => `<button class="chip" data-value="${k}">${v}</button>`).join('');

function bindChips(el, key) {
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    el.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === btn));
    state[key] = btn.dataset.value;
    render();
    fitVisible();
  });
}

// Filtrdan keyin xaritani topilgan joylarga moslash
function fitVisible() {
  const list = visible();
  if (!list.length) return;
  map.flyToBounds(L.latLngBounds(list.map((s) => s.coords)), { padding: [60, 60], maxZoom: 5, duration: 1 });
}
bindChips(document.getElementById('analog-filter'), 'analog');
bindChips(typeFilter, 'type');
document.getElementById('search').addEventListener('input', (e) => {
  state.query = e.target.value.trim().toLowerCase();
  render();
});

const visible = () =>
  sites.filter(
    (s) =>
      (state.analog === 'all' || s.analog === state.analog) &&
      (state.type === 'all' || s.type === state.type) &&
      (!state.query || `${s.name} ${s.country}`.toLowerCase().includes(state.query)),
  );

function render() {
  const list = visible();
  const ids = new Set(list.map((s) => s.id));
  for (const [id, m] of markers) {
    if (ids.has(id)) m.addTo(map);
    else m.remove();
  }

  document.getElementById('count').textContent = `${list.length} ta joy topildi`;
  document.getElementById('site-list').innerHTML = list
    .sort((a, b) => similarity(b) - similarity(a))
    .map(
      (s) => `
      <li class="site ${state.selected === s.id ? 'active' : ''}" data-id="${s.id}">
        <span class="dot" style="background:${ANALOG[s.analog].color}"></span>
        <div>
          <strong>${esc(s.name)}</strong>
          <small>${esc(s.country)} · ${TYPES[s.type]}${s.proposed ? ' · taklif' : ''}</small>
        </div>
        <span class="score">${similarity(s)}%</span>
      </li>`,
    )
    .join('');
}

document.getElementById('site-list').addEventListener('click', (e) => {
  const li = e.target.closest('.site');
  if (li) select(li.dataset.id);
});

// ---------- Tafsilotlar paneli ----------
const details = document.getElementById('details');
const body = document.getElementById('details-body');
let chart = null;
let miniMap = null;

function select(id) {
  const s = sites.find((x) => x.id === id);
  state.selected = id;
  const a = ANALOG[s.analog];
  const score = similarity(s);

  body.innerHTML = `
    <div class="badges">
      <span class="badge" style="--c:${a.color}">${a.label} analogi</span>
      <span class="badge">${TYPES[s.type]}</span>
      ${s.proposed ? '<span class="badge warn">Taklif</span>' : ''}
    </div>
    <h2>${esc(s.name)}</h2>
    <p class="country">${esc(s.country)}</p>

    <div class="meter">
      <div class="meter-head"><span>${a.label}ga o'xshashlik</span><strong>${score}%</strong></div>
      <div class="bar"><div style="width:${score}%; background:${a.color}"></div></div>
    </div>

    <div class="compare" style="--pos:50%">
      <img src="/img/${s.id}-space.jpg" alt="${esc(s.spaceMatch)}" />
      <img class="earth" src="/img/${s.id}-earth.jpg" alt="${esc(s.name)}" />
      <span class="tag left">Yer</span>
      <span class="tag right" style="--c:${a.color}">${a.label}</span>
      <div class="handle"><span>${icon(MoveHorizontal, 16)}</span></div>
      <input type="range" min="0" max="100" value="50" aria-label="Yer va ${a.label} suratlarini solishtirish" />
    </div>
    <p class="credits">
      Yer: <a href="${s.credits.earth.url}" target="_blank" rel="noopener">${esc(s.credits.earth.text)}</a> ·
      ${a.label}: <a href="${s.credits.space.url}" target="_blank" rel="noopener">${esc(s.credits.space.text)}</a>
    </p>

    <div class="match">
      <span>Yerda</span><strong>${esc(s.name)}</strong>
      <span class="arrow">${icon(EqualApproximately, 18)}</span>
      <span>${a.label}da</span><strong>${esc(s.spaceMatch)}</strong>
    </div>

    <h3>Nimasi bilan o'xshash?</h3>
    <p>${esc(s.why)}</p>

    <h3>Kim foydalangan?</h3>
    <p>${esc(s.usedBy)}</p>

    <h3>Joylashuv</h3>
    <div id="mini-map"></div>

    <h3>Parametrlar</h3>
    <div class="chart-wrap"><canvas id="radar"></canvas></div>

    <a class="more" href="${s.wiki}" target="_blank" rel="noopener">Batafsil (Wikipedia) ${icon(ExternalLink, 14)}</a>
  `;
  details.classList.remove('hidden');
  details.scrollTop = 0;

  const compare = body.querySelector('.compare');
  compare.querySelector('input').addEventListener('input', (e) => {
    compare.style.setProperty('--pos', `${e.target.value}%`);
  });

  if (miniMap) miniMap.remove();
  miniMap = L.map('mini-map', { zoomControl: false, attributionControl: false }).setView(s.coords, 11);
  L.tileLayer(satelliteUrl, { maxZoom: 18 }).addTo(miniMap);

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById('radar'), {
    type: 'radar',
    data: {
      labels: Object.keys(PARAMS).map((k) => PARAMS[k]),
      datasets: [
        {
          data: Object.keys(PARAMS).map((k) => s.params[k]),
          backgroundColor: a.color + '33',
          borderColor: a.color,
          pointBackgroundColor: a.color,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0,
          max: 10,
          ticks: { display: false, stepSize: 2 },
          grid: { color: '#ffffff1f' },
          angleLines: { color: '#ffffff1f' },
          pointLabels: { color: '#c8cfe0', font: { size: 11 } },
        },
      },
    },
  });

  map.flyTo(s.coords, Math.max(map.getZoom(), 5), { duration: 1.2 });
  render();
}

document.getElementById('close-details').addEventListener('click', () => {
  details.classList.add('hidden');
  state.selected = null;
  render();
});

// ---------- Intro ekrani ----------
const intro = document.getElementById('intro');
const count = (a) => sites.filter((s) => s.analog === a).length;
const countries = new Set(sites.map((s) => s.country)).size;
document.getElementById('intro-stats').innerHTML = [
  [sites.length, 'ta joy'],
  [count('mars'), 'Mars analogi'],
  [count('moon'), 'Oy analogi'],
  [countries, 'mamlakat / hudud'],
]
  .map(([n, label]) => `<div><strong>${n}</strong><span>${label}</span></div>`)
  .join('');

intro.querySelector('.intro-actions').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-analog]');
  if (!btn) return;
  document.querySelector(`#analog-filter .chip[data-value="${btn.dataset.analog}"]`).click();
  intro.classList.add('hidden');
});
document.getElementById('open-intro').addEventListener('click', () => intro.classList.remove('hidden'));

render();
