import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createGlobe } from './globe.js';
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
  Target,
  Shuffle,
  MoveHorizontal,
  EqualApproximately,
  ExternalLink,
  ArrowRight,
  MapPin,
} from 'lucide';
import sites from './data/sites.json';
import places from './data/places.json';
import './style.css';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

const ANALOG = {
  mars: { label: 'Mars', color: '#ff6b4a' },
  moon: { label: 'Oy', color: '#c9d1e0' },
};

// Globus teksturalari: haqiqiy NASA suratlari (public/tex)
const BODY = {
  earth: {
    label: 'Yer',
    badge: 'NASA Blue Marble · haqiqiy sun\'iy yo\'ldosh mozaikasi',
    mapBadge: "Esri World Imagery · haqiqiy sun'iy yo'ldosh suratlari",
    texture: '/tex/earth-2k.jpg',
    atmosphere: { color: '#5aa9ff', altitude: 0.1 },
  },
  mars: {
    label: 'Mars',
    badge: 'NASA Viking MDIM 2.1 rangli mozaikasi (NASA Trek)',
    mapBadge: 'NASA Trek · Viking MDIM 2.1 rangli mozaika',
    color: '#ff6b4a',
    texture: '/tex/mars-2k.jpg',
    atmosphere: { color: '#ff9a6a', altitude: 0.05 },
  },
  moon: {
    label: 'Oy',
    badge: 'NASA LRO WAC global mozaikasi (NASA Trek)',
    mapBadge: 'NASA Trek · LRO WAC global mozaika',
    color: '#c9d1e0',
    texture: '/tex/moon-2k.jpg',
    atmosphere: null,
  },
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

// "Qaysi sayyora?" viktorinasi: har safar 5 ta savol tasodifiy tanlanadi
const QUIZ = [
  { clue: "Havo bosimi Yernikidan 1% ga ham yetmaydi, chang esa osmonni sarg'ish-jigarrang qiladi.", a: 'mars', why: "Marsda juda siyrak karbonat angidrid atmosferasi bor, havodagi chang osmonni bo'yaydi." },
  { clue: "1969-yilda qoldirilgan astronavt izlari hali ham turibdi, chunki ularni o'chiradigan shamol ham, yomg'ir ham yo'q.", a: 'moon', why: "Oyda deyarli atmosfera yo'q, shuning uchun izlarni hech narsa yemirmaydi." },
  { clue: "Bu yerda og'irlik kuchi Yernikidan taxminan 6 marta kam, astronavtlar yurish o'rniga sakrab harakatlangan.", a: 'moon', why: "Oydagi tortishish Yernikining taxminan 16,5% ini tashkil qiladi." },
  { clue: 'Quyosh tizimidagi eng baland vulqon shu yerda: balandligi taxminan 22 km.', a: 'mars', why: "Marsdagi Olympus Mons Everestdan qariyb 2,5 marta baland." },
  { clue: "Yalang'och ko'z bilan ko'rinadigan qora tekisliklar (\"dengizlar\") qadimgi lava oqimlaridir.", a: 'moon', why: "Oy dengizlari ulkan zarba havzalarini to'ldirgan bazalt tekisliklardir." },
  { clue: "Yuzasining taxminan 71% ini suyuq suv qoplagan.", a: 'earth', why: "Hozir yuzasida barqaror okeanlar bor yagona ma'lum dunyo bu Yer." },
  { clue: "Bir quyosh chiqishidan keyingisigacha taxminan 29,5 Yer kuni o'tadi.", a: 'moon', why: "Oy Yerga doim bir tomoni bilan qaragani uchun uning sutkasi Yer atrofidagi aylanishiga teng." },
  { clue: "Uning atrofida Fobos va Deymos degan ikkita kichik yo'ldosh aylanadi.", a: 'mars', why: "Fobos va Deymos Marsning ikki yo'ldoshi." },
  { clue: "Harakatlanuvchi litosfera plitalari qobiqni yangilab, tog' tizmalarini hosil qiladi.", a: 'earth', why: "Faol plitalar tektonikasi faqat Yerda ma'lum." },
  { clue: "Har qishda qutb qalpoqlarida karbonat angidrid qirovi to'planadi.", a: 'mars', why: "Mars qutblarida har qishda CO₂ muzi qatlami hosil bo'ladi." },
  { clue: "Bugun ham yuzasida kislotali, temirga boy qizil daryo oqmoqda.", a: 'earth', why: "Bu Ispaniyadagi Rio Tinto daryosi, qadimgi Marsdagi kislotali suvning analogi." },
  { clue: "2008-yilda qo'nuvchi apparat tuprog'ida perxlorat tuzlarini topgan.", a: 'mars', why: "NASA'ning Phoenix apparati Mars shimoliy qutbi yaqinida perxloratlarni aniqlagan." },
];

// O'xshashlik indeksi = parametrlar o'rtachasi (0–10) → foiz
const similarity = (s) => {
  const v = Object.values(s.params);
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10);
};

// Lucide ikonkasi → SVG matn (innerHTML ichida ishlatish uchun)
const icon = (node, size = 16) => createElement(node, { width: size, height: size, 'aria-hidden': 'true' }).outerHTML;

createIcons({ icons: { GraduationCap, Bot, Microscope, Info, X, Globe, Orbit, Moon, Target, Shuffle } });

const esc = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const placeById = Object.fromEntries(places.map((p) => [p.id, p]));
const siteById = Object.fromEntries(sites.map((s) => [s.id, s]));
const analogsOf = (place) => sites.filter((s) => s.place === place.id);
const creditOfPhoto = (photo) => siteById[photo.replace(/-space$/, '')].credits.space;

// ---------- 3D globus (Yer, Mars, Oy) ----------
const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
// Panel ichidagi kichik xarita uchun haqiqiy tile'lar (Mars va Oy: NASA Trek, teng burchakli proyeksiya)
const TREK = {
  mars: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
  moon: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
};

const globeEl = document.getElementById('globe');
const flatEl = document.getElementById('flatmap');
// Oddiy, yengil globus (src/globe.js): faqat harakat bo'lganda chiziladi
const tipEl = document.createElement('div');
tipEl.className = 'globe-tip';
tipEl.hidden = true;
document.body.appendChild(tipEl);

const globe = createGlobe(globeEl, {
  onPointClick: (d) => {
    openFlatMap([d.lat, d.lng], state.mode === 'earth' ? 8 : 5);
    if (d.kind === 'site') selectSite(d.id);
    else selectPlace(d.id);
  },
  // Globusning istalgan joyini bosganda o'sha joyning tekis xaritasi ochiladi
  onGlobeClick: ({ lat, lng }) => openFlatMap([lat, lng], state.mode === 'earth' ? 5 : 4),
  tooltip: (d, x, y) => {
    if (!d) {
      tipEl.hidden = true;
      return;
    }
    tipEl.innerHTML = `<b>${esc(d.name)}</b><span>${esc(d.sub)}</span>`;
    tipEl.style.left = `${x + 14}px`;
    tipEl.style.top = `${y + 14}px`;
    tipEl.hidden = false;
  },
});

function applyBody(mode) {
  globe.setTexture(BODY[mode].texture);
  document.body.style.setProperty('--glow', BODY[mode].atmosphere ? BODY[mode].atmosphere.color : 'transparent');
}

// ---------- Tekis xarita (globus bosilganda ochiladi, dunyo takrorlanmaydi) ----------
let flat = null;
let flatBody = null;
let flatMarkers = [];

function buildFlatMap(body) {
  if (flat && flatBody === body) return;
  if (flat) flat.remove();
  const earth = body === 'earth';
  const bounds = earth ? L.latLngBounds([-85, -180], [85, 180]) : L.latLngBounds([-90, -180], [90, 180]);
  flat = L.map(flatEl, {
    crs: earth ? L.CRS.EPSG3857 : L.CRS.EPSG4326,
    zoomControl: false,
    worldCopyJump: false,
    minZoom: earth ? 2 : 1,
    maxZoom: earth ? 18 : 9,
    maxBounds: bounds,
    maxBoundsViscosity: 1,
  });
  L.control.zoom({ position: 'bottomright' }).addTo(flat);
  L.tileLayer(
    earth ? satelliteUrl : TREK[body],
    earth
      ? { noWrap: true, bounds, maxZoom: 18, attribution: 'Tiles &copy; Esri' }
      : { tileSize: 256, noWrap: true, bounds, maxNativeZoom: 7, maxZoom: 9, attribution: 'NASA/JPL-Caltech · NASA Trek' },
  ).addTo(flat);
  flatBody = body;
}

function updateFlatMarkers(pts) {
  if (!flat) return;
  flatMarkers.forEach((m) => m.remove());
  flatMarkers = pts.map((d) =>
    L.circleMarker([d.lat, d.lng], {
      radius: d.id === state.selected ? 11 : 8,
      color: '#fff',
      weight: d.id === state.selected ? 3 : 1.5,
      fillColor: d.color,
      fillOpacity: 0.9,
    })
      .bindTooltip(`${d.name}`)
      .on('click', () => (d.kind === 'site' ? selectSite(d.id) : selectPlace(d.id)))
      .addTo(flat),
  );
}

function openFlatMap(coords, zoom) {
  state.view = 'map';
  document.body.dataset.view = 'map';
  flatEl.hidden = false;
  globeEl.hidden = true;
  buildFlatMap(state.mode);
  flat.invalidateSize();
  flat.setView(coords, zoom, { animate: false });
  document.getElementById('map-badge').textContent = BODY[state.mode].mapBadge;
  updateGlobePoints();
}

function closeFlatMap() {
  state.view = 'globe';
  document.body.dataset.view = 'globe';
  flatEl.hidden = true;
  globeEl.hidden = false;
  globe.render();
  document.getElementById('map-badge').textContent = BODY[state.mode].badge;
}
document.getElementById('back-globe').addEventListener('click', closeFlatMap);

function flyTo([lat, lng], altitude = 1.1) {
  if (state.view === 'map' && flat) {
    flat.flyTo([lat, lng], Math.max(flat.getZoom(), state.mode === 'earth' ? 7 : 4), { duration: 1 });
    return;
  }
  globe.flyTo(lat, lng, altitude + 1.8);
}

// ---------- Holat ----------
const state = { mode: 'earth', view: 'globe', analog: 'all', type: 'all', query: '', selected: null };

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
bindChips(document.getElementById('analog-filter'), 'analog');
bindChips(typeFilter, 'type');
document.getElementById('search').addEventListener('input', (e) => {
  state.query = e.target.value.trim().toLowerCase();
  render();
});

const visibleSites = () =>
  sites.filter(
    (s) =>
      (state.analog === 'all' || s.analog === state.analog) &&
      (state.type === 'all' || s.type === state.type) &&
      (!state.query || `${s.name} ${s.country}`.toLowerCase().includes(state.query)),
  );

const visiblePlaces = () =>
  places.filter(
    (p) =>
      p.body === state.mode &&
      (!state.query ||
        `${p.name} ${p.mission} ${analogsOf(p).map((s) => `${s.name} ${s.country}`).join(' ')}`
          .toLowerCase()
          .includes(state.query)),
  );

// Filtrdan keyin globusni topilgan joylar markaziga burish
function fitVisible() {
  if (state.mode !== 'earth') return;
  const list = visibleSites();
  if (!list.length) return;
  const lat = list.reduce((a, s) => a + s.coords[0], 0) / list.length;
  const lng = Math.atan2(
    list.reduce((a, s) => a + Math.sin((s.coords[1] * Math.PI) / 180), 0),
    list.reduce((a, s) => a + Math.cos((s.coords[1] * Math.PI) / 180), 0),
  ) * (180 / Math.PI);
  flyTo([lat, lng], list.length > 1 ? 2.2 : 1.2);
}

// Globusdagi nuqtalar: Yer rejimida joylar, Mars/Oy rejimida ularning juftlari
function updateGlobePoints() {
  const pts =
    state.mode === 'earth'
      ? visibleSites().map((s) => ({
          kind: 'site',
          id: s.id,
          lat: s.coords[0],
          lng: s.coords[1],
          color: ANALOG[s.analog].color,
          name: s.name,
          sub: `${s.country} · ${ANALOG[s.analog].label} analogi · ${similarity(s)}%`,
        }))
      : visiblePlaces().map((p) => ({
          kind: 'place',
          id: p.id,
          lat: p.coords[0],
          lng: p.coords[1],
          color: BODY[p.body].color,
          name: p.name,
          sub: `Yerda: ${analogsOf(p).map((s) => s.name).join(', ')}`,
        }));
  globe.setPoints(pts, state.selected);
  if (state.view === 'map') updateFlatMarkers(pts);
}

function render() {
  const list = document.getElementById('site-list');
  const count = document.getElementById('count');

  updateGlobePoints();

  if (state.mode === 'earth') {
    const vis = visibleSites();
    count.textContent = `${vis.length} ta joy topildi`;
    list.innerHTML = vis
      .sort((a, b) => similarity(b) - similarity(a))
      .map(
        (s) => `
        <li class="site ${state.selected === s.id ? 'active' : ''}" data-id="${s.id}">
          <img class="thumb" src="/img/${s.id}-earth.jpg" alt="" loading="lazy" />
          <div>
            <strong>${esc(s.name)}</strong>
            <small><span class="dot" style="background:${ANALOG[s.analog].color}"></span>${esc(s.country)} · ${TYPES[s.type]}${s.proposed ? ' · taklif' : ''}</small>
          </div>
          <span class="score">${similarity(s)}%</span>
        </li>`,
      )
      .join('');
    return;
  }

  const vis = visiblePlaces();
  count.textContent = `${BODY[state.mode].label}da ${vis.length} ta joy · har biri Yerdagi analogi bilan`;
  list.innerHTML = vis
    .map((p) => {
      const an = analogsOf(p);
      return `
        <li class="site ${state.selected === p.id ? 'active' : ''}" data-place="${p.id}">
          <img class="thumb" src="/img/${p.photo}.jpg" alt="" loading="lazy" />
          <div>
            <strong>${esc(p.name)}</strong>
            <small>${icon(ArrowRight, 12)} ${an.map((s) => esc(s.name)).join(', ')}</small>
          </div>
        </li>`;
    })
    .join('');
}

document.getElementById('site-list').addEventListener('click', (e) => {
  const li = e.target.closest('.site');
  if (!li) return;
  if (li.dataset.place) selectPlace(li.dataset.place);
  else selectSite(li.dataset.id);
});

// ---------- Yer / Mars / Oy almashtirgich ----------
const modesEl = document.getElementById('modes');
modesEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode]');
  if (b) setMode(b.dataset.mode);
});

function setMode(mode, { keepSelection = false } = {}) {
  const prev = state.mode;
  state.mode = mode;
  document.body.dataset.mode = mode;
  modesEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === mode));
  document.getElementById('map-badge').textContent = BODY[mode].badge;
  document.getElementById('search').placeholder =
    mode === 'earth' ? 'Joy yoki davlat qidirish…' : `${BODY[mode].label}dagi joy yoki Yer analogi…`;

  if (prev !== mode || !state.bodyApplied) {
    state.bodyApplied = true;
    // Boshqa dunyoga o'tilganda globus ko'rinishiga qaytamiz
    if (state.view === 'map') closeFlatMap();
    applyBody(mode);
    globe.zoomTo(4.4);
  }

  if (!keepSelection && prev !== mode) {
    // Yerdagi joy tanlangan bo'lsa, uning juftini yangi xaritada ochamiz
    const cur = state.selected && siteById[state.selected];
    const pair = cur && cur.place && placeById[cur.place];
    if (pair && pair.body === mode) {
      render();
      selectPlace(pair.id);
      return;
    }
    closeDetails();
  }
  render();
}

// ---------- Tafsilotlar paneli ----------
const details = document.getElementById('details');
const body = document.getElementById('details-body');
let chart = null;
let miniMap = null;

function compareBlock(earthImg, spaceImg, spaceLabel, color, earthAlt, spaceAlt) {
  return `
    <div class="compare" style="--pos:50%">
      <img src="/img/${spaceImg}.jpg" alt="${esc(spaceAlt)}" />
      <img class="earth" src="/img/${earthImg}.jpg" alt="${esc(earthAlt)}" />
      <span class="tag left">Yer</span>
      <span class="tag right" style="--c:${color}">${spaceLabel}</span>
      <div class="handle"><span>${icon(MoveHorizontal, 16)}</span></div>
      <input type="range" min="0" max="100" value="50" aria-label="Yer va ${spaceLabel} suratlarini solishtirish" />
    </div>`;
}

function openDetails() {
  details.classList.remove('hidden');
  details.scrollTop = 0;
  const compare = body.querySelector('.compare');
  if (compare) {
    compare.querySelector('input').addEventListener('input', (e) => {
      compare.style.setProperty('--pos', `${e.target.value}%`);
    });
  }
  body.querySelectorAll('[data-goto-place]').forEach((b) =>
    b.addEventListener('click', () => {
      const p = placeById[b.dataset.gotoPlace];
      setMode(p.body, { keepSelection: true });
      selectPlace(p.id);
    }),
  );
  body.querySelectorAll('[data-goto-site]').forEach((b) =>
    b.addEventListener('click', () => {
      setMode('earth', { keepSelection: true });
      selectSite(b.dataset.gotoSite);
    }),
  );
}

function selectSite(id) {
  const s = siteById[id];
  state.selected = id;
  const a = ANALOG[s.analog];
  const score = similarity(s);
  const pair = s.place && placeById[s.place];

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

    ${compareBlock(`${s.id}-earth`, `${s.id}-space`, a.label, a.color, s.name, s.spaceMatch)}
    <p class="credits">
      Yer: <a href="${s.credits.earth.url}" target="_blank" rel="noopener">${esc(s.credits.earth.text)}</a> ·
      ${a.label}: <a href="${s.credits.space.url}" target="_blank" rel="noopener">${esc(s.credits.space.text)}</a>
    </p>

    <div class="match">
      <span>Yerda</span><strong>${esc(s.name)}</strong>
      <span class="arrow">${icon(EqualApproximately, 18)}</span>
      <span>${a.label}da</span><strong>${esc(pair ? pair.name : s.spaceMatch)}</strong>
    </div>

    ${
      pair
        ? `<button class="pair-card" data-goto-place="${pair.id}" style="--c:${a.color}">
            <img src="/img/${pair.photo}.jpg" alt="" />
            <span><small>${a.label} xaritasida ko'rish</small><strong>${esc(pair.name)}</strong><em>${esc(pair.mission)}</em></span>
            ${icon(MapPin, 18)}
          </button>`
        : `<p class="note">${a.label}dagi aniq joyi noma'lum: surat Marsdan kelgan ALH84001 meteoritiga tegishli.</p>`
    }

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
  openDetails();

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

  flyTo(s.coords, 0.9);
  render();
}

function selectPlace(id) {
  const p = placeById[id];
  state.selected = id;
  const b = BODY[p.body];
  const an = analogsOf(p);
  const credit = creditOfPhoto(p.photo);

  body.innerHTML = `
    <div class="badges">
      <span class="badge" style="--c:${b.color}">${b.label}</span>
      <span class="badge">${esc(p.mission)}</span>
      ${p.approx ? '<span class="badge warn">Taxminiy hudud</span>' : ''}
    </div>
    <h2>${esc(p.name)}</h2>
    <p class="country">${Math.abs(p.coords[0]).toFixed(2)}° ${p.coords[0] >= 0 ? 'N' : 'S'} · ${Math.abs(p.coords[1]).toFixed(2)}° ${p.coords[1] >= 0 ? 'E' : 'W'}</p>

    ${compareBlock(`${an[0].id}-earth`, p.photo, b.label, b.color, an[0].name, p.name)}
    <p class="credits">
      Yer (${esc(an[0].name)}): <a href="${an[0].credits.earth.url}" target="_blank" rel="noopener">${esc(an[0].credits.earth.text)}</a> ·
      ${b.label}: <a href="${credit.url}" target="_blank" rel="noopener">${esc(credit.text)}</a>
    </p>

    <h3>Bu joy haqida</h3>
    <p>${esc(p.about)}</p>

    <h3>Yerdagi analog${an.length > 1 ? 'lari' : 'i'}</h3>
    <div class="pairs">
      ${an
        .map(
          (s) => `
        <button class="pair-card" data-goto-site="${s.id}" style="--c:${ANALOG[s.analog].color}">
          <img src="/img/${s.id}-earth.jpg" alt="" />
          <span><small>${esc(s.country)} · ${similarity(s)}% o'xshash</small><strong>${esc(s.name)}</strong><em>${esc(s.why)}</em></span>
          ${icon(MapPin, 18)}
        </button>`,
        )
        .join('')}
    </div>

    <h3>Joylashuv${p.approx ? ' (taxminiy)' : ''}</h3>
    <div id="mini-map"></div>
  `;
  openDetails();

  // NASA Trek tile'laridan yaqin ko'rinish
  if (miniMap) miniMap.remove();
  miniMap = L.map('mini-map', { crs: L.CRS.EPSG4326, zoomControl: false, attributionControl: false, maxZoom: 9 }).setView(
    p.coords,
    p.approx ? 3 : 5,
  );
  L.tileLayer(TREK[p.body], { tileSize: 256, noWrap: true, maxNativeZoom: 7, maxZoom: 9 }).addTo(miniMap);
  L.circleMarker(p.coords, { radius: 6, color: '#fff', weight: 1.5, fillColor: b.color, fillOpacity: 0.9 }).addTo(miniMap);

  flyTo(p.coords, 1.0);
  render();
}

function closeDetails() {
  details.classList.add('hidden');
  state.selected = null;
}

document.getElementById('close-details').addEventListener('click', () => {
  closeDetails();
  render();
});

document.getElementById('random-btn').addEventListener('click', () => {
  const pool = (state.mode === 'earth' ? visibleSites() : visiblePlaces()).filter((x) => x.id !== state.selected);
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (state.mode === 'earth') selectSite(pick.id);
  else selectPlace(pick.id);
});

// ---------- Viktorina ----------
const quizEl = document.getElementById('quiz');
const quizCard = document.getElementById('quiz-card');
const quiz = { qs: [], i: 0, score: 0 };
const OPTIONS = [
  ['earth', 'Yer'],
  ['mars', 'Mars'],
  ['moon', 'Oy'],
];

function openQuiz() {
  const pool = QUIZ.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  Object.assign(quiz, { qs: pool.slice(0, 5), i: 0, score: 0 });
  quizEl.hidden = false;
  renderQuestion();
}

function renderQuestion() {
  const q = quiz.qs[quiz.i];
  quizCard.innerHTML = `
    <div class="q-top">
      <span id="quiz-title">Qaysi sayyora? · ${quiz.i + 1} / ${quiz.qs.length}</span>
      <button class="icon-btn" data-close aria-label="Yopish">${icon(X, 16)}</button>
    </div>
    <p class="q-clue">${esc(q.clue)}</p>
    <div class="q-opts">${OPTIONS.map(([k, l]) => `<button class="q-opt" data-a="${k}"><span class="orb ${k}"></span>${l}</button>`).join('')}</div>
    <div id="q-after"></div>`;
  quizCard.querySelectorAll('.q-opt').forEach((b) => b.addEventListener('click', () => answer(b.dataset.a)));
}

function answer(a) {
  const q = quiz.qs[quiz.i];
  const ok = a === q.a;
  if (ok) quiz.score++;
  quizCard.querySelectorAll('.q-opt').forEach((b) => {
    b.disabled = true;
    if (b.dataset.a === q.a) b.classList.add('right');
    else if (b.dataset.a === a) b.classList.add('wrong');
  });
  const last = quiz.i === quiz.qs.length - 1;
  document.getElementById('q-after').innerHTML = `
    <p class="q-explain"><b class="${ok ? '' : 'no'}">${ok ? "To'g'ri!" : "Noto'g'ri."}</b> ${esc(q.why)}</p>
    <div class="q-next"><button class="btn primary" id="q-next">${last ? "Natijani ko'rish" : 'Keyingi savol'}</button></div>`;
  document.getElementById('q-next').addEventListener('click', () => {
    if (last) renderScore();
    else {
      quiz.i++;
      renderQuestion();
    }
  });
}

function renderScore() {
  const s = quiz.score;
  const [rank, text] =
    s === 5
      ? ['Missiya mutaxassisi', "A'lo! Uch dunyoni bitta belgi bo'yicha ajrata olasiz."]
      : s >= 3
        ? ['Dala geologi', "Yaxshi natija. Yana bir nechta analog joyni ko'rib chiqing."]
        : ['Kursant', "Hamma astronavt shundan boshlagan. Xaritani ko'rib chiqib, qayta urinib ko'ring."];
  quizCard.innerHTML = `
    <div class="score">
      <div class="big">${s}/5</div>
      <div class="rank">${rank}</div>
      <p>${text}</p>
      <div class="q-next"><button class="btn primary" id="q-again">Qayta o'ynash</button><button class="btn" data-close>Xaritaga qaytish</button></div>
    </div>`;
  document.getElementById('q-again').addEventListener('click', openQuiz);
}

document.getElementById('quiz-btn').addEventListener('click', openQuiz);
quizEl.addEventListener('click', (e) => {
  if (e.target === quizEl || e.target.closest('[data-close]')) quizEl.hidden = true;
});
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!quizEl.hidden) quizEl.hidden = true;
  else if (state.selected) {
    closeDetails();
    render();
  }
});

// ---------- Intro ekrani ----------
const intro = document.getElementById('intro');
const count = (a) => sites.filter((s) => s.analog === a).length;
document.getElementById('intro-stats').innerHTML = [
  [sites.length, 'Yerdagi joy'],
  [count('mars'), 'Mars analogi'],
  [count('moon'), 'Oy analogi'],
  [places.length, 'Mars va Oydagi juft'],
]
  .map(([n, label]) => `<div><strong>${n}</strong><span>${label}</span></div>`)
  .join('');

intro.querySelector('.intro-actions').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-mode]');
  if (!btn) return;
  intro.classList.add('hidden');
  setMode(btn.dataset.mode);
});
document.getElementById('open-intro').addEventListener('click', () => intro.classList.remove('hidden'));

setMode('earth');
