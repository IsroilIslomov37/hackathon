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
  Target,
  Shuffle,
  Star,
  LocateFixed,
  Scale,
  Play,
  Pause,
  Square,
  MessageCircle,
  MoveHorizontal,
  EqualApproximately,
  ExternalLink,
  ArrowRight,
  MapPin,
  Share2,
  ImageOff,
  CircleHelp,
} from 'lucide';
import sitesData from './data/sites.json';
import places from './data/places.json';
import { createGlobe } from './globe.js';
import { createQuiz } from './quiz.js';
import { esc, matches, store, haversineKm, trapFocus } from './util.js';
import { t, tr, tBoth, lang, setLang } from './i18n.js';
import './style.css';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

const $ = (sel) => document.querySelector(sel);

// ---------- Doimiylar ----------
const COLOR = { mars: '#ff6b4a', moon: '#c9d1e0' };
const TYPES = ['desert', 'volcano', 'crater', 'cave', 'ice', 'water'];
const PARAM_KEYS = ['aridity', 'cold', 'radiation', 'regolith', 'geology', 'isolation'];
const METRIC_KEYS = ['temp', 'pressure', 'humidity', 'uv', 'soil'];
const ROUTE = { earth: 'yer', mars: 'mars', moon: 'oy' };
const ROUTE_BACK = { yer: 'earth', mars: 'mars', oy: 'moon', earth: 'earth', moon: 'moon' };

// Globus teksturalari: haqiqiy NASA suratlari (public/tex). fallback: tekstura yuklanmasa ko'rsatiladigan rang.
const BODY = {
  earth: { texture: '/tex/earth-2k.webp', fallback: 0x1d4f8a, glow: '#5aa9ff', badge: 'NASA Blue Marble', mapBadge: 'Esri World Imagery' },
  mars: { texture: '/tex/mars-2k.webp', fallback: 0x9a4a2c, glow: '#ff9a6a', color: '#ff6b4a', badge: 'NASA Viking MDIM 2.1 · NASA Trek', mapBadge: 'NASA Trek · Viking MDIM 2.1' },
  moon: { texture: '/tex/moon-2k.webp', fallback: 0x6d6f75, glow: null, color: '#c9d1e0', badge: 'NASA LRO WAC · NASA Trek', mapBadge: 'NASA Trek · LRO WAC' },
};

const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
// Mars va Oy uchun haqiqiy tile'lar (NASA Trek, teng burchakli proyeksiya)
const TREK = {
  mars: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
  moon: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
};

// ---------- Ma'lumotlar ----------
const sites = sitesData.map((s) => ({ ...s, hasPhoto: s.photo !== false }));
const siteById = Object.fromEntries(sites.map((s) => [s.id, s]));
const placeById = Object.fromEntries(places.map((p) => [p.id, p]));
const analogsOf = (place) => sites.filter((s) => s.place === place.id);
const creditOfPhoto = (photo) => siteById[photo.replace(/-space$/, '')]?.credits?.space ?? null;

const nameOf = (x) => tr(x, 'name');
const bodyLabel = (b) => t(`body.${b}`);
const analogLabel = (b) => t(`analog.${b}`);
const typeLabel = (k) => t(`type.${k}`);

// O'xshashlik indeksi = 6 ta mezon bahosining (0–10) o'rtachasi → foiz. Baholanmagan joy uchun null.
const similarity = (s) => {
  if (!s.params) return null;
  const v = Object.values(s.params);
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10);
};

// Lucide ikonkasi → SVG matn (innerHTML ichida ishlatish uchun)
const icon = (node, size = 16) => createElement(node, { width: size, height: size, 'aria-hidden': 'true' }).outerHTML;

const fmtCoords = ([lat, lng]) =>
  `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`;

// ---------- Rasmlar: WebP (katta va kichik variant), jpg zaxira, rasm bo'lmasa placeholder ----------
function picture(base, alt, { thumb = false, eager = false } = {}) {
  const webp = thumb ? `/img/thumb/${base}.webp` : `/img/${base}.webp`;
  return `<picture><source srcset="${webp}" type="image/webp" /><img src="/img/${base}.jpg" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" /></picture>`;
}
function thumbHtml(base, alt, kind, has = true) {
  return `<span class="thumb ph ph-${kind}" aria-hidden="${has ? 'false' : 'true'}">${icon(ImageOff, 16)}${has ? picture(base, alt, { thumb: true }) : ''}</span>`;
}
// Rasm yuklanmasa: avval WebP o'rniga JPG sinab ko'riladi (yangi joyga faqat .jpg qo'yish kifoya),
// u ham bo'lmasa rasm olib tashlanadi va orqasidagi placeholder ko'rinadi.
document.addEventListener(
  'error',
  (e) => {
    const el = e.target;
    if (!(el instanceof HTMLImageElement)) return;
    const pic = el.closest('picture');
    const webp = pic && pic.querySelector('source');
    if (webp) {
      webp.remove();
      el.setAttribute('src', el.getAttribute('src'));
      return;
    }
    if (el.closest('.ph, .q-img')) (pic || el).remove();
  },
  true,
);

// ---------- Holat ----------
const state = {
  mode: 'earth',
  view: 'globe',
  analog: 'all',
  type: 'all',
  query: '',
  selected: null,
  favOnly: false,
  bodyApplied: false,
};
const favs = new Set(store.get('favorites', []).filter((id) => siteById[id] || placeById[id]));
let compareIds = store.get('compare', []).filter((id) => siteById[id]).slice(0, 2);

// ---------- Kichik yordamchilar: toast, modal ----------
let toastTimer = 0;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3500);
}

const modals = new Map();
function openModal(el) {
  el.hidden = false;
  if (modals.has(el)) modals.get(el)();
  modals.set(el, trapFocus(el, () => closeModal(el)));
}
function closeModal(el) {
  el.hidden = true;
  const release = modals.get(el);
  modals.delete(el);
  if (release) release();
}
for (const el of [$('#info-modal'), $('#compare-modal')]) {
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-close]')) closeModal(el);
  });
}

// ---------- 3D globus ----------
const globeEl = $('#globe');
const flatEl = $('#flatmap');
const tipEl = document.createElement('div');
tipEl.className = 'globe-tip';
tipEl.hidden = true;
document.body.appendChild(tipEl);

const globe = createGlobe(globeEl, {
  onPointClick: (d) => {
    stopTour();
    openFlatMap([d.lat, d.lng], state.mode === 'earth' ? 8 : 5);
    if (d.kind === 'site') selectSite(d.id);
    else selectPlace(d.id);
  },
  // Globusning istalgan joyini bosganda o'sha joyning tekis xaritasi ochiladi
  onGlobeClick: ({ lat, lng }) => {
    stopTour();
    openFlatMap([lat, lng], state.mode === 'earth' ? 5 : 4);
  },
  tooltip: (d, x, y) => {
    if (!d) {
      tipEl.hidden = true;
      return;
    }
    tipEl.innerHTML = `<b>${esc(d.name)}</b><span>${esc(d.sub)}</span>`;
    tipEl.style.left = `${Math.min(x + 14, innerWidth - 260)}px`;
    tipEl.style.top = `${y + 14}px`;
    tipEl.hidden = false;
  },
  onLoading: (on) => {
    $('#globe-loading').hidden = !on;
  },
});

let preloaded = false;
async function applyBody(mode) {
  document.body.style.setProperty('--glow', BODY[mode].glow || 'transparent');
  const result = await globe.setTexture(BODY[mode].texture, BODY[mode].fallback);
  if (result === 'error') toast(t('globe.error'));
  if (!preloaded && result !== 'stale') {
    // Birinchi tekstura chiqqandan keyin qolganlarini fonda yuklab qo'yamiz
    preloaded = true;
    globe.preload(Object.values(BODY).map((b) => b.texture));
  }
  return result;
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
      .bindTooltip(d.name)
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
  $('#map-badge').textContent = BODY[state.mode].mapBadge;
  updateGlobePoints();
}

function closeFlatMap() {
  state.view = 'globe';
  document.body.dataset.view = 'globe';
  flatEl.hidden = true;
  globeEl.hidden = false;
  globe.render();
  $('#map-badge').textContent = BODY[state.mode].badge;
}
$('#back-globe').addEventListener('click', closeFlatMap);

// Telefonda pastki karta ochiq bo'lsa, tanlangan joy karta ustidagi ko'rinadigan qismga chiqishi uchun
// globus/xarita markazi ekran balandligining shu ulushiga yuqoriga suriladi.
const mobileMq = matchMedia('(max-width: 768px)');
const SHEET_OFFSET = 0.36;
const sheetOpen = () => mobileMq.matches && !$('#details').hidden;
function syncGlobeOffset() {
  globe.setCenterOffset(sheetOpen() ? SHEET_OFFSET : 0);
}
mobileMq.addEventListener('change', syncGlobeOffset);

function flyTo([lat, lng], dist = 2.7, ms = 1200) {
  if (state.view === 'map' && flat) {
    const zoom = Math.max(flat.getZoom(), state.mode === 'earth' ? 7 : 4);
    let target = L.latLng(lat, lng);
    if (sheetOpen()) {
      // Markazni pastga surib, nuqtani karta ustidagi qismga chiqaramiz
      const pt = flat.project(target, zoom).add([0, flatEl.clientHeight * SHEET_OFFSET]);
      target = flat.unproject(pt, zoom);
    }
    flat.flyTo(target, zoom, { duration: 1 });
    return Promise.resolve();
  }
  return globe.flyTo(lat, lng, dist, ms);
}

// ---------- Filtrlar va qidiruv ----------
function renderTypeChips() {
  $('#type-filter').innerHTML =
    `<button class="chip ${state.type === 'all' ? 'active' : ''}" data-value="all">${esc(t('type.all'))}</button>` +
    TYPES.map((k) => `<button class="chip ${state.type === k ? 'active' : ''}" data-value="${k}">${esc(typeLabel(k))}</button>`).join('');
}

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
bindChips($('#analog-filter'), 'analog');
bindChips($('#type-filter'), 'type');
$('#search').addEventListener('input', (e) => {
  state.query = e.target.value;
  render();
});

// Qidiruv har ikki tildagi nom, davlat va tur bo'yicha ishlaydi
const siteHaystack = (s) =>
  [s.name, s.en?.name, s.country, s.en?.country, s.spaceMatch, s.en?.spaceMatch, ...tBoth(`type.${s.type}`), ...tBoth(`analog.${s.analog}`)].join(' ');
const placeHaystack = (p) =>
  [p.name, p.en?.name, p.mission, ...analogsOf(p).flatMap((s) => [s.name, s.en?.name, s.country, s.en?.country])].join(' ');

const visibleSites = () =>
  sites.filter(
    (s) =>
      (state.analog === 'all' || s.analog === state.analog) &&
      (state.type === 'all' || s.type === state.type) &&
      (!state.favOnly || favs.has(s.id)) &&
      matches(state.query, siteHaystack(s)),
  );

const visiblePlaces = () =>
  places.filter((p) => p.body === state.mode && (!state.favOnly || favs.has(p.id)) && matches(state.query, placeHaystack(p)));

function clearFilters() {
  state.analog = 'all';
  state.type = 'all';
  state.query = '';
  state.favOnly = false;
  $('#search').value = '';
  $('#fav-filter').setAttribute('aria-pressed', 'false');
  $('#analog-filter').querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.value === 'all'));
  renderTypeChips();
  render();
}

// Filtrdan keyin globusni topilgan joylar markaziga burish
function fitVisible() {
  if (state.mode !== 'earth') return;
  const list = visibleSites();
  if (!list.length) return;
  const lat = list.reduce((a, s) => a + s.coords[0], 0) / list.length;
  const lng =
    Math.atan2(
      list.reduce((a, s) => a + Math.sin((s.coords[1] * Math.PI) / 180), 0),
      list.reduce((a, s) => a + Math.cos((s.coords[1] * Math.PI) / 180), 0),
    ) *
    (180 / Math.PI);
  flyTo([lat, lng], list.length > 1 ? 4 : 3);
}

// ---------- Globusdagi nuqtalar ----------
function globePoints() {
  return state.mode === 'earth'
    ? visibleSites().map((s) => ({
        kind: 'site',
        id: s.id,
        lat: s.coords[0],
        lng: s.coords[1],
        color: COLOR[s.analog],
        name: nameOf(s),
        sub: `${tr(s, 'country')} · ${analogLabel(s.analog)}${similarity(s) != null ? ` · ${similarity(s)}%` : ''}`,
      }))
    : visiblePlaces().map((p) => ({
        kind: 'place',
        id: p.id,
        lat: p.coords[0],
        lng: p.coords[1],
        color: BODY[p.body].color,
        name: nameOf(p),
        sub: `${t('detail.onEarth')}: ${analogsOf(p).map(nameOf).join(', ')}`,
      }));
}

function updateGlobePoints() {
  const pts = globePoints();
  globe.setPoints(pts, state.selected);
  if (state.view === 'map') updateFlatMarkers(pts);
}

// ---------- Ro'yxat ----------
function render() {
  updateGlobePoints();
  const listEl = $('#site-list');
  const countEl = $('#count');
  const earth = state.mode === 'earth';
  const items = earth
    ? visibleSites().sort((a, b) => (similarity(b) ?? -1) - (similarity(a) ?? -1))
    : visiblePlaces();

  countEl.textContent = earth ? t('list.found', { n: items.length }) : t('list.space', { body: bodyLabel(state.mode), n: items.length });

  if (!items.length) {
    listEl.innerHTML = `
      <li class="empty" role="presentation">
        <strong>${esc(t('list.empty'))}</strong>
        <span>${esc(t('list.emptyHint'))}</span>
        <button class="btn" id="clear-filters">${esc(t('list.clear'))}</button>
      </li>`;
    $('#clear-filters').addEventListener('click', clearFilters);
    return;
  }

  listEl.innerHTML = items
    .map((x) => {
      const active = state.selected === x.id;
      if (earth) {
        const sim = similarity(x);
        return `
        <li class="site ${active ? 'active' : ''}" data-id="${x.id}" role="option" tabindex="0" aria-selected="${active}">
          ${thumbHtml(`${x.id}-earth`, t('detail.thumbAlt', { name: nameOf(x) }), x.analog, x.hasPhoto)}
          <div>
            <strong>${esc(nameOf(x))}${favs.has(x.id) ? ' <span class="fav-mark" aria-hidden="true">★</span>' : ''}</strong>
            <small><span class="dot" style="background:${COLOR[x.analog]}"></span>${esc(tr(x, 'country'))} · ${esc(typeLabel(x.type))}${x.proposed ? ` · ${esc(t('list.proposed'))}` : ''}</small>
          </div>
          <span class="score">${sim != null ? `${sim}%` : '—'}</span>
        </li>`;
      }
      return `
        <li class="site ${active ? 'active' : ''}" data-place="${x.id}" role="option" tabindex="0" aria-selected="${active}">
          ${thumbHtml(x.photo, t('detail.thumbAlt', { name: nameOf(x) }), x.body, true)}
          <div>
            <strong>${esc(nameOf(x))}${favs.has(x.id) ? ' <span class="fav-mark" aria-hidden="true">★</span>' : ''}</strong>
            <small>${icon(ArrowRight, 12)} ${analogsOf(x).map((s) => esc(nameOf(s))).join(', ')}</small>
          </div>
        </li>`;
    })
    .join('');
}

function pickFromList(li) {
  if (!li) return;
  stopTour();
  if (li.dataset.place) selectPlace(li.dataset.place);
  else selectSite(li.dataset.id);
  if (matchMedia('(max-width: 768px)').matches) setSheet(false);
}
$('#site-list').addEventListener('click', (e) => pickFromList(e.target.closest('.site')));

// Klaviatura: o'qlar bilan ro'yxatda yurish, Enter bilan tanlash
$('#site-list').addEventListener('keydown', (e) => {
  const items = [...$('#site-list').querySelectorAll('.site')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const next = items[Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))] || items[0];
    if (next) next.focus();
  } else if ((e.key === 'Enter' || e.key === ' ') && i >= 0) {
    e.preventDefault();
    pickFromList(items[i]);
  }
});

// ---------- Yer / Mars / Oy almashtirgich ----------
const modesEl = $('#modes');
modesEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode]');
  if (b) {
    stopTour();
    setMode(b.dataset.mode);
  }
});

function updateSearchPlaceholder() {
  $('#search').placeholder = state.mode === 'earth' ? t('search.earth') : t('search.space', { body: bodyLabel(state.mode) });
}

async function setMode(mode, { keepSelection = false, fromRoute = false } = {}) {
  const prev = state.mode;
  state.mode = mode;
  document.body.dataset.mode = mode;
  modesEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  $('#map-badge').textContent = state.view === 'map' ? BODY[mode].mapBadge : BODY[mode].badge;
  updateSearchPlaceholder();

  let texture = Promise.resolve('ok');
  if (prev !== mode || !state.bodyApplied) {
    state.bodyApplied = true;
    // Boshqa dunyoga o'tilganda globus ko'rinishiga qaytamiz
    if (state.view === 'map') closeFlatMap();
    texture = applyBody(mode);
  }

  if (!keepSelection && prev !== mode) {
    // Yerdagi joy tanlangan bo'lsa, uning juftini yangi dunyoda ochamiz
    const cur = state.selected && siteById[state.selected];
    const pair = cur && cur.place && placeById[cur.place];
    if (pair && pair.body === mode) {
      render();
      selectPlace(pair.id, { fromRoute });
      return texture;
    }
    closeDetails({ silent: true });
  }
  render();
  if (!fromRoute && !state.selected) setRoute(`/${ROUTE[mode]}`);
  return texture;
}

// Juftlikka uchish: globus uzoqlashadi, yangi dunyo teksturasi yuklanadi, keyin juftga yaqinlashadi
async function flyToPair(targetMode, id, kind) {
  stopTour();
  if (state.view === 'map') closeFlatMap();
  await globe.zoomTo(7.5, 450);
  await setMode(targetMode, { keepSelection: true });
  if (kind === 'place') selectPlace(id, { flyMs: 1600 });
  else selectSite(id, { flyMs: 1600 });
}

// ---------- URL hash routing: #/yer, #/mars, #/oy, #/joy/<slug> ----------
function setRoute(path) {
  const h = `#${path}`;
  if (location.hash !== h) history.pushState(null, '', h);
}

async function applyRoute() {
  const [a, b] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  if (a === 'joy' && b) {
    const s = siteById[b];
    const p = placeById[b];
    if (s || p) {
      hideIntro();
      const mode = s ? 'earth' : p.body;
      if (state.mode !== mode || !state.bodyApplied) await setMode(mode, { keepSelection: true, fromRoute: true });
      if (s) selectSite(b, { fromRoute: true });
      else selectPlace(b, { fromRoute: true });
      return true;
    }
  }
  const mode = ROUTE_BACK[a];
  if (mode) {
    hideIntro();
    closeDetails({ silent: true });
    await setMode(mode, { fromRoute: true });
    render();
    return true;
  }
  return false;
}
// Orqaga/oldinga tugmalari va qo'lda o'zgartirilgan hash (pushState bu hodisani chaqirmaydi)
addEventListener('hashchange', applyRoute);

// ---------- Tafsilotlar paneli ----------
const details = $('#details');
const body = $('#details-body');
let chart = null;
let miniMap = null;

function compareSlider(earthBase, spaceBase, spaceLabel, color, earthAlt, spaceAlt) {
  return `
    <div class="compare" style="--pos:50%">
      ${picture(spaceBase, spaceAlt, { eager: true })}
      <div class="earth-layer">${picture(earthBase, earthAlt, { eager: true })}</div>
      <span class="tag left">${esc(t('detail.earthTag'))}</span>
      <span class="tag right" style="--c:${color}">${esc(spaceLabel)}</span>
      <div class="handle"><span>${icon(MoveHorizontal, 16)}</span></div>
      <input type="range" min="0" max="100" value="50" aria-label="${esc(t('detail.compareSlider', { body: spaceLabel }))}" />
    </div>`;
}

// Rasm manbai: nomi + muallif + litsenziya (o'qiladigan shaklda)
function creditItem(label, c) {
  if (!c) return '';
  const title = c.title ? `«${esc(c.title)}»` : esc(c.text);
  const lic = c.license
    ? c.licenseUrl
      ? `<a href="${c.licenseUrl}" target="_blank" rel="noopener">${esc(c.license)}</a>`
      : esc(c.license)
    : '';
  return `<li><b>${esc(label)}:</b> <a href="${c.url}" target="_blank" rel="noopener">${title}</a>${c.artist ? ` · ${esc(t('common.author'))}: ${esc(c.artist)}` : ''}${lic ? ` · ${esc(t('common.license'))}: ${lic}` : ''}${c.title ? ` <span class="muted">(${esc(c.text)})</span>` : ''}</li>`;
}

function metricText(m, { avgTag = true } = {}) {
  const text = m[lang()] || m.uz;
  return `${esc(text)}${m.planetAvg && avgTag ? ` <small class="avg">${esc(t('metric.planetAvg'))}</small>` : ''}${
    m.src ? ` <a class="src" href="${m.src.url}" target="_blank" rel="noopener" title="${esc(m.src.label)}">[${esc(t('common.source'))}]</a>` : ''
  }`;
}
const noData = () => `<span class="nodata">${esc(t('common.noData'))}</span>`;

// Yer joyi ↔ Mars/Oy juftligi ko'rsatkichlari jadvali
function metricsTable(site, place) {
  const m = place.metrics || {};
  const earth = site ? m.earth?.[site.id] || {} : null;
  const ref = m.earthReference || {};
  const rows = METRIC_KEYS.map((k) => {
    let earthCell = '';
    if (earth) {
      earthCell = earth[k]
        ? metricText(earth[k])
        : `${noData()}${ref[k] ? `<small class="ref">${esc(t('detail.earthAvg'))}: ${metricText(ref[k], { avgTag: false })}</small>` : ''}`;
    }
    const bodyCell = m.body?.[k] ? metricText(m.body[k]) : noData();
    return `<tr><th scope="row">${esc(t(`metric.${k}`))}</th>${earth ? `<td>${earthCell}</td>` : ''}<td>${bodyCell}</td></tr>`;
  }).join('');
  return `
    <div class="table-wrap">
      <table class="metrics">
        <thead><tr><th scope="col">${esc(t('detail.indicator'))}</th>${site ? `<th scope="col">${esc(t('body.earth'))}: ${esc(nameOf(site))}</th>` : ''}<th scope="col">${esc(bodyLabel(place.body))}: ${esc(nameOf(place))}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="muted small">${esc(t('detail.metricsNote'))}</p>`;
}

// Missiyalar vaqt chizig'i (yili noma'lumlari oxirida)
function timeline(entries) {
  if (!entries.length) return `<p class="muted">${esc(t('detail.noMissions'))}</p>`;
  const sorted = [...entries].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
  return `<ol class="timeline">${sorted
    .map(
      (e) => `<li><span class="yr">${e.year ?? '—'}</span><span>${esc(e.text)}${e.tag ? ` <em>${esc(e.tag)}</em>` : ''}${
        e.src ? ` <a class="src" href="${e.src.url}" target="_blank" rel="noopener" title="${esc(e.src.label)}">[${esc(t('common.source'))}]</a>` : ''
      }</span></li>`,
    )
    .join('')}</ol>`;
}
const missionEntries = (s) => (s.missions || []).map((m) => ({ year: m.year, text: m[lang()] || m.uz, src: m.src }));

function actionsRow(id, isSite) {
  const fav = favs.has(id);
  const inCompare = compareIds.includes(id);
  return `
    <div class="actions">
      <button class="act" data-act="fav" aria-pressed="${fav}">${icon(Star, 16)}<span>${esc(fav ? t('detail.unfavorite') : t('detail.favorite'))}</span></button>
      ${isSite ? `<button class="act" data-act="compare" aria-pressed="${inCompare}">${icon(Scale, 16)}<span>${esc(inCompare ? t('detail.compareIn') : t('detail.compareAdd'))}</span></button>` : ''}
      <button class="act" data-act="share">${icon(Share2, 16)}<span>${esc(t('common.share'))}</span></button>
    </div>`;
}

function openDetails(id, isSite) {
  details.hidden = false;
  details.scrollTop = 0;
  syncGlobeOffset();
  const compare = body.querySelector('.compare');
  if (compare) {
    compare.querySelector('input').addEventListener('input', (e) => compare.style.setProperty('--pos', `${e.target.value}%`));
  }
  body.querySelectorAll('[data-goto-place]').forEach((b) =>
    b.addEventListener('click', () => flyToPair(placeById[b.dataset.gotoPlace].body, b.dataset.gotoPlace, 'place')),
  );
  body.querySelectorAll('[data-goto-site]').forEach((b) => b.addEventListener('click', () => flyToPair('earth', b.dataset.gotoSite, 'site')));
  body.querySelector('[data-act="fav"]')?.addEventListener('click', () => toggleFav(id, isSite));
  body.querySelector('[data-act="compare"]')?.addEventListener('click', () => toggleCompare(id));
  body.querySelector('[data-act="share"]')?.addEventListener('click', () => share(nameOf(isSite ? siteById[id] : placeById[id])));
  body.querySelector('[data-act="how"]')?.addEventListener('click', () => openSimilarityInfo(siteById[id]));
}

function selectSite(id, { fromRoute = false, flyMs = 1200 } = {}) {
  const s = siteById[id];
  if (!s) return;
  state.selected = id;
  const a = { label: analogLabel(s.analog), short: t(`analog.short.${s.analog}`), color: COLOR[s.analog] };
  const score = similarity(s);
  const pair = s.place && placeById[s.place];
  const hasSpace = s.hasPhoto && s.credits?.space;

  body.innerHTML = `
    <div class="badges">
      <span class="badge" style="--c:${a.color}">${esc(a.label)}</span>
      <span class="badge">${esc(typeLabel(s.type))}</span>
      ${s.proposed ? `<span class="badge warn">${esc(t('list.proposed'))}</span>` : ''}
    </div>
    <h2>${esc(nameOf(s))}</h2>
    <p class="country">${esc(tr(s, 'country'))} · <span class="mono">${fmtCoords(s.coords)}</span></p>
    ${actionsRow(id, true)}

    <div class="meter">
      <div class="meter-head">
        <span>${esc(t('detail.similarityTo', { body: a.short }))}</span>
        <strong>${score != null ? `${score}%` : esc(t('list.noScore'))}</strong>
      </div>
      <div class="bar"><div style="width:${score ?? 0}%; background:${a.color}"></div></div>
      ${score != null ? `<button class="link-btn" data-act="how">${icon(CircleHelp, 14)} ${esc(t('detail.how'))}</button>` : ''}
    </div>

    ${
      hasSpace
        ? compareSlider(`${s.id}-earth`, `${s.id}-space`, a.short, a.color, t('detail.photoEarth', { name: nameOf(s) }), t('detail.photoSpace', { name: tr(s, 'spaceMatch'), body: a.short }))
        : `<div class="ph ph-${s.analog} ph-big" role="img" aria-label="${esc(t('detail.noPhoto'))}">${icon(ImageOff, 28)}<span>${esc(t('detail.noPhoto'))}</span></div>`
    }

    <div class="match">
      <span>${esc(t('detail.onEarth'))}</span><strong>${esc(nameOf(s))}</strong>
      <span class="arrow">${icon(EqualApproximately, 18)}</span>
      <span>${esc(t('detail.onBody', { body: a.short }))}</span><strong>${esc(pair ? nameOf(pair) : tr(s, 'spaceMatch'))}</strong>
    </div>

    ${
      pair
        ? `<button class="pair-card" data-goto-place="${pair.id}" style="--c:${a.color}">
            ${thumbHtml(pair.photo, t('detail.thumbAlt', { name: nameOf(pair) }), pair.body)}
            <span><small>${esc(t('detail.seeOn', { body: bodyLabel(pair.body) }))}</small><strong>${esc(nameOf(pair))}</strong><em>${esc(tr(pair, 'mission'))}</em></span>
            ${icon(MapPin, 18)}
          </button>`
        : `<p class="note">${esc(s.id === 'svalbard' ? t('detail.noPair', { body: a.short }) : t('detail.noPairGeneric', { body: a.short }))}</p>`
    }

    <h3>${esc(t('detail.why'))}</h3>
    <p>${esc(tr(s, 'why'))}</p>

    <h3>${esc(t('detail.usedBy'))}</h3>
    <p>${esc(tr(s, 'usedBy'))}</p>

    ${pair ? `<h3>${esc(t('detail.metrics'))}</h3>${metricsTable(s, pair)}` : ''}

    <h3>${esc(t('detail.missions'))}</h3>
    ${timeline([
      ...missionEntries(s),
      ...(pair ? [{ year: pair.missionYear, text: `${tr(pair, 'mission')} · ${nameOf(pair)}`, tag: bodyLabel(pair.body) }] : []),
    ])}

    <h3>${esc(t('detail.location'))}</h3>
    <div id="mini-map" role="img" aria-label="${esc(`${nameOf(s)} · ${fmtCoords(s.coords)}`)}"></div>

    ${s.params ? `<h3>${esc(t('detail.params'))}</h3><div class="chart-wrap"><canvas id="radar" aria-label="${esc(t('detail.params'))}" role="img"></canvas></div>` : ''}

    ${
      s.credits?.earth || s.credits?.space
        ? `<h3>${esc(t('detail.credits'))}</h3><ul class="credits">${creditItem(t('body.earth'), s.credits.earth)}${creditItem(a.short, s.credits.space)}</ul>`
        : ''
    }

    <a class="more" href="${s.wiki}" target="_blank" rel="noopener">${esc(t('detail.more'))} ${icon(ExternalLink, 14)}</a>
  `;
  openDetails(id, true);

  if (miniMap) miniMap.remove();
  miniMap = L.map('mini-map', { zoomControl: false, attributionControl: false }).setView(s.coords, 11);
  L.tileLayer(satelliteUrl, { maxZoom: 18 }).addTo(miniMap);

  if (chart) chart.destroy();
  chart = null;
  if (s.params) {
    chart = new Chart($('#radar'), {
      type: 'radar',
      data: {
        labels: PARAM_KEYS.map((k) => t(`param.${k}`)),
        datasets: [{ data: PARAM_KEYS.map((k) => s.params[k]), backgroundColor: `${a.color}33`, borderColor: a.color, pointBackgroundColor: a.color }],
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
  }

  flyTo(s.coords, 2.7, flyMs);
  render();
  if (!fromRoute) setRoute(`/joy/${id}`);
}

function selectPlace(id, { fromRoute = false, flyMs = 1200 } = {}) {
  const p = placeById[id];
  if (!p) return;
  state.selected = id;
  const b = { label: bodyLabel(p.body), color: BODY[p.body].color };
  const an = analogsOf(p);
  const first = an.find((s) => s.hasPhoto) || an[0];
  const credit = creditOfPhoto(p.photo);

  body.innerHTML = `
    <div class="badges">
      <span class="badge" style="--c:${b.color}">${esc(b.label)}</span>
      <span class="badge">${esc(tr(p, 'mission'))}</span>
      ${p.approx ? `<span class="badge warn">${esc(t('detail.approx'))}</span>` : ''}
    </div>
    <h2>${esc(nameOf(p))}</h2>
    <p class="country mono">${fmtCoords(p.coords)}</p>
    ${actionsRow(id, false)}

    ${compareSlider(`${first.id}-earth`, p.photo, b.label, b.color, t('detail.photoEarth', { name: nameOf(first) }), t('detail.photoSpace', { name: nameOf(p), body: b.label }))}

    <h3>${esc(t('detail.aboutPlace'))}</h3>
    <p>${esc(tr(p, 'about'))}</p>

    <h3>${esc(t('detail.analogs'))}</h3>
    <div class="pairs">
      ${an
        .map((s) => {
          const sim = similarity(s);
          return `
        <button class="pair-card" data-goto-site="${s.id}" style="--c:${COLOR[s.analog]}">
          ${thumbHtml(`${s.id}-earth`, t('detail.thumbAlt', { name: nameOf(s) }), s.analog, s.hasPhoto)}
          <span><small>${esc(tr(s, 'country'))}${sim != null ? ` · ${sim}%` : ''}</small><strong>${esc(nameOf(s))}</strong><em>${esc(tr(s, 'why'))}</em></span>
          ${icon(MapPin, 18)}
        </button>`;
        })
        .join('')}
    </div>

    <h3>${esc(t('detail.metrics'))}</h3>
    ${metricsTable(null, p)}

    <h3>${esc(t('detail.missions'))}</h3>
    ${timeline([
      { year: p.missionYear, text: tr(p, 'mission'), tag: b.label },
      ...an.flatMap((s) => missionEntries(s).map((e) => ({ ...e, tag: nameOf(s) }))),
    ])}

    <h3>${esc(t('detail.location'))}${p.approx ? ` (${esc(t('detail.approx'))})` : ''}</h3>
    <div id="mini-map" role="img" aria-label="${esc(`${nameOf(p)} · ${fmtCoords(p.coords)}`)}"></div>

    <h3>${esc(t('detail.credits'))}</h3>
    <ul class="credits">${creditItem(`${t('body.earth')} (${nameOf(first)})`, first.credits?.earth)}${creditItem(b.label, credit)}</ul>
  `;
  openDetails(id, false);

  // NASA Trek tile'laridan yaqin ko'rinish
  if (miniMap) miniMap.remove();
  if (chart) chart.destroy();
  chart = null;
  miniMap = L.map('mini-map', { crs: L.CRS.EPSG4326, zoomControl: false, attributionControl: false, maxZoom: 9 }).setView(p.coords, p.approx ? 3 : 5);
  L.tileLayer(TREK[p.body], { tileSize: 256, noWrap: true, maxNativeZoom: 7, maxZoom: 9 }).addTo(miniMap);
  L.circleMarker(p.coords, { radius: 6, color: '#fff', weight: 1.5, fillColor: b.color, fillOpacity: 0.9 }).addTo(miniMap);

  flyTo(p.coords, 2.7, flyMs);
  render();
  if (!fromRoute) setRoute(`/joy/${id}`);
}

function closeDetails({ silent = false } = {}) {
  details.hidden = true;
  state.selected = null;
  syncGlobeOffset();
  if (!silent) {
    render();
    setRoute(`/${ROUTE[state.mode]}`);
  }
}
$('#close-details').addEventListener('click', () => closeDetails());

// O'xshashlik foizi izohi (14)
function openSimilarityInfo(s) {
  const score = similarity(s);
  const w = (100 / PARAM_KEYS.length).toFixed(1);
  $('#info-card').innerHTML = `
    <div class="q-top"><span id="info-title">${esc(t('sim.title'))}</span><button class="icon-btn" data-close aria-label="${esc(t('common.close'))}">${icon(X, 16)}</button></div>
    <p>${esc(t('sim.body'))}</p>
    <table class="metrics">
      <thead><tr><th scope="col">${esc(t('compare.criteria'))}</th><th scope="col">0–10</th><th scope="col">${esc(t('sim.weight'))}</th></tr></thead>
      <tbody>${PARAM_KEYS.map((k) => `<tr><th scope="row">${esc(t(`param.${k}`))}</th><td>${s.params[k]}</td><td>${w}%</td></tr>`).join('')}</tbody>
    </table>
    <p class="formula"><code>${esc(t('sim.formula'))}</code> → <strong>${score}%</strong></p>`;
  openModal($('#info-modal'));
}

// ---------- Ulashish (21) ----------
async function share(title) {
  const url = location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: `${title} · Earth Analogs Explorer`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast(t('common.copied'));
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    toast(url);
  }
}

// ---------- Sevimlilar (25) ----------
function toggleFav(id, isSite) {
  if (favs.has(id)) favs.delete(id);
  else favs.add(id);
  store.set('favorites', [...favs]);
  if (isSite) selectSite(id, { fromRoute: true });
  else selectPlace(id, { fromRoute: true });
}
$('#fav-filter').addEventListener('click', (e) => {
  state.favOnly = !state.favOnly;
  e.currentTarget.setAttribute('aria-pressed', String(state.favOnly));
  render();
  if (state.favOnly && !favs.size) toast(t('fav.empty'));
});

// ---------- Eng yaqin analog (25) ----------
$('#near-btn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    toast(t('near.unsupported'));
    return;
  }
  toast(t('near.locating'));
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const me = [pos.coords.latitude, pos.coords.longitude];
      let best = null;
      for (const s of sites) {
        const km = haversineKm(me, s.coords);
        if (!best || km < best.km) best = { s, km };
      }
      if (state.mode !== 'earth') await setMode('earth', { keepSelection: true });
      selectSite(best.s.id);
      toast(t('near.result', { name: nameOf(best.s), km: Math.round(best.km).toLocaleString(lang() === 'en' ? 'en-US' : 'uz-UZ') }));
    },
    () => toast(t('near.denied')),
    { timeout: 10000, maximumAge: 600000 },
  );
});

// ---------- Taqqoslash rejimi (15) ----------
function updateCompareLabel() {
  $('#compare-label').textContent = t('compare.open', { n: compareIds.length });
}
function toggleCompare(id) {
  if (compareIds.includes(id)) compareIds = compareIds.filter((x) => x !== id);
  else compareIds = [...compareIds, id].slice(-2);
  store.set('compare', compareIds);
  updateCompareLabel();
  selectSite(id, { fromRoute: true });
  if (compareIds.length === 2) openCompare();
}
function openCompare() {
  const list = compareIds.map((id) => siteById[id]).filter(Boolean);
  const head = `<div class="q-top"><span id="compare-title">${esc(t('compare.title'))}</span><button class="icon-btn" data-close aria-label="${esc(t('common.close'))}">${icon(X, 16)}</button></div>`;
  if (list.length < 2) {
    $('#compare-card').innerHTML = `${head}<p>${esc(t('compare.empty'))}</p>`;
    openModal($('#compare-modal'));
    return;
  }
  const cell = (s, fn) => `<td>${fn(s)}</td>`;
  const row = (label, fn) => `<tr><th scope="row">${esc(label)}</th>${list.map((s) => cell(s, fn)).join('')}</tr>`;
  const soil = (s) => {
    const p = s.place && placeById[s.place];
    const v = p?.metrics?.earth?.[s.id]?.soil;
    return v ? metricText(v) : noData();
  };
  $('#compare-card').innerHTML = `
    ${head}
    <div class="cmp-grid">
      ${list
        .map(
          (s) => `
        <article class="cmp-col">
          <div class="cmp-photo">${thumbHtml(`${s.id}-earth`, t('detail.thumbAlt', { name: nameOf(s) }), s.analog, s.hasPhoto).replace('/img/thumb/', '/img/')}</div>
          <h3>${esc(nameOf(s))}</h3>
          <p class="muted">${esc(tr(s, 'country'))} · ${esc(analogLabel(s.analog))}</p>
          <button class="btn" data-remove="${s.id}">${esc(t('compare.remove'))}</button>
        </article>`,
        )
        .join('')}
    </div>
    <div class="table-wrap">
      <table class="metrics">
        <tbody>
          ${row(t('compare.similarity'), (s) => (similarity(s) != null ? `<strong>${similarity(s)}%</strong>` : esc(t('list.noScore'))))}
          ${row(t('compare.type'), (s) => esc(typeLabel(s.type)))}
          ${PARAM_KEYS.map((k) => row(t(`param.${k}`), (s) => (s.params ? `<span class="minibar" style="--v:${s.params[k] * 10}%"></span> ${s.params[k]}` : '—'))).join('')}
          ${row(t('metric.soil'), soil)}
          ${row(t('compare.missions'), (s) => esc(String((s.missions || []).length)))}
        </tbody>
      </table>
    </div>`;
  $('#compare-card').querySelectorAll('[data-remove]').forEach((b) =>
    b.addEventListener('click', () => {
      compareIds = compareIds.filter((x) => x !== b.dataset.remove);
      store.set('compare', compareIds);
      updateCompareLabel();
      openCompare();
    }),
  );
  openModal($('#compare-modal'));
}
$('#compare-open').addEventListener('click', openCompare);

// ---------- Avtomatik ekskursiya (18): 60 soniyada joylarni aylanib chiqadi ----------
const tour = { on: false, paused: false, i: 0, list: [], timer: 0, stepMs: 0, started: 0, remaining: 0 };
const tourBar = $('#tour-bar');

function renderTourBar() {
  const x = tour.list[tour.i];
  if (!x) return;
  const isSite = !!siteById[x.id] && state.mode === 'earth';
  const base = isSite ? `${x.id}-earth` : x.photo;
  tourBar.innerHTML = `
    ${thumbHtml(base, t('detail.thumbAlt', { name: nameOf(x) }), isSite ? x.analog : x.body, isSite ? x.hasPhoto : true)}
    <div class="tour-text">
      <small>${esc(t('tour.progress', { i: tour.i + 1, n: tour.list.length }))}</small>
      <strong>${esc(nameOf(x))}</strong>
      <span>${esc(isSite ? tr(x, 'why') : tr(x, 'about'))}</span>
      <div class="tour-progress"><div style="animation-duration:${tour.stepMs}ms; animation-play-state:${tour.paused ? 'paused' : 'running'}"></div></div>
    </div>
    <div class="tour-actions">
      <button class="icon-btn" data-tour="toggle" aria-label="${esc(tour.paused ? t('tour.resume') : t('tour.pause'))}">${icon(tour.paused ? Play : Pause, 16)}</button>
      <button class="icon-btn" data-tour="more" aria-label="${esc(t('tour.more'))}">${icon(Info, 16)}</button>
      <button class="icon-btn" data-tour="stop" aria-label="${esc(t('tour.stop'))}">${icon(Square, 16)}</button>
    </div>`;
}

function stepTour() {
  if (!tour.on) return;
  if (tour.i >= tour.list.length) {
    stopTour();
    return;
  }
  const x = tour.list[tour.i];
  state.selected = x.id;
  globe.flyTo(x.coords[0], x.coords[1], 3.2, 1200);
  updateGlobePoints();
  renderTourBar();
  tour.started = performance.now();
  tour.remaining = tour.stepMs;
  clearTimeout(tour.timer);
  tour.timer = setTimeout(() => {
    tour.i++;
    stepTour();
  }, tour.stepMs);
}

function startTour() {
  stopTour();
  closeDetails({ silent: true });
  if (state.view === 'map') closeFlatMap();
  tour.list = state.mode === 'earth' ? visibleSites() : visiblePlaces();
  if (!tour.list.length) return;
  tour.on = true;
  tour.paused = false;
  tour.i = 0;
  tour.stepMs = Math.max(3000, Math.floor(60000 / tour.list.length));
  tourBar.hidden = false;
  document.body.classList.add('touring');
  stepTour();
}

function pauseTour() {
  if (!tour.on || tour.paused) return;
  tour.paused = true;
  clearTimeout(tour.timer);
  tour.remaining -= performance.now() - tour.started;
  tourBar.querySelector('.tour-progress div').style.animationPlayState = 'paused';
  tourBar.querySelector('[data-tour="toggle"]').innerHTML = icon(Play, 16);
  tourBar.querySelector('[data-tour="toggle"]').setAttribute('aria-label', t('tour.resume'));
}

function resumeTour() {
  if (!tour.on || !tour.paused) return;
  tour.paused = false;
  tour.started = performance.now();
  tourBar.querySelector('.tour-progress div').style.animationPlayState = 'running';
  tourBar.querySelector('[data-tour="toggle"]').innerHTML = icon(Pause, 16);
  tourBar.querySelector('[data-tour="toggle"]').setAttribute('aria-label', t('tour.pause'));
  tour.timer = setTimeout(() => {
    tour.i++;
    stepTour();
  }, Math.max(0, tour.remaining));
}

function stopTour() {
  if (!tour.on) return;
  clearTimeout(tour.timer);
  tour.on = false;
  tourBar.hidden = true;
  document.body.classList.remove('touring');
  state.selected = null;
  render();
}

$('#tour-btn').addEventListener('click', startTour);
tourBar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tour]');
  if (!b) return;
  if (b.dataset.tour === 'toggle') (tour.paused ? resumeTour : pauseTour)();
  else if (b.dataset.tour === 'stop') stopTour();
  else if (b.dataset.tour === 'more') {
    const x = tour.list[tour.i];
    stopTour();
    if (siteById[x.id] && state.mode === 'earth') selectSite(x.id);
    else selectPlace(x.id);
  }
});

// ---------- Viktorina ----------
const quiz = createQuiz({
  el: $('#quiz'),
  card: $('#quiz-card'),
  get sites() {
    return sites.map((s) => ({ ...s, name: nameOf(s), country: tr(s, 'country') }));
  },
  get places() {
    return places.map((p) => ({ ...p, name: nameOf(p) }));
  },
  analogLabel: (b) => t(`analog.short.${b}`),
  bodyLabel,
});
$('#quiz-btn').addEventListener('click', () => quiz.open());

// ---------- Intro / "Loyiha haqida" (statistika ma'lumotdan hisoblanadi) ----------
const intro = $('#intro');
let releaseIntro = null;

function renderIntroStats() {
  const count = (a) => sites.filter((s) => s.analog === a).length;
  const pc = (b) => places.filter((p) => p.body === b).length;
  $('#intro-stats').innerHTML = [
    [sites.length, t('stats.sites')],
    [count('mars'), t('stats.mars')],
    [count('moon'), t('stats.moon')],
    [places.length, t('stats.places')],
  ]
    .map(([n, label]) => `<div><strong>${n}</strong><span>${esc(label)}</span></div>`)
    .join('');
  $('#intro-stats-note').textContent = t('stats.note', {
    mars: pc('mars'),
    moon: pc('moon'),
    linked: sites.filter((s) => s.place).length,
  });
}

function showIntro() {
  renderIntroStats();
  intro.hidden = false;
  if (releaseIntro) releaseIntro();
  releaseIntro = trapFocus(
    intro,
    () => {
      hideIntro();
      if (!state.bodyApplied) setMode('earth');
    },
    '.intro-actions .btn.primary',
  );
}
function hideIntro() {
  intro.hidden = true;
  if (releaseIntro) releaseIntro();
  releaseIntro = null;
}
intro.querySelector('.intro-actions').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-mode]');
  if (!btn) return;
  hideIntro();
  closeDetails({ silent: true });
  setMode(btn.dataset.mode).then(() => render());
});
$('#open-intro').addEventListener('click', showIntro);

// ---------- Mobil: pastdan chiqadigan ro'yxat (bottom sheet) ----------
function setSheet(open) {
  $('#sidebar').classList.toggle('expanded', open);
  $('#sheet-handle').setAttribute('aria-expanded', String(open));
}
$('#sheet-handle').addEventListener('click', () => setSheet(!$('#sidebar').classList.contains('expanded')));
$('#search').addEventListener('focus', () => {
  if (matchMedia('(max-width: 768px)').matches) setSheet(true);
});

// ---------- Tasodifiy joy ----------
$('#random-btn').addEventListener('click', () => {
  stopTour();
  const pool = (state.mode === 'earth' ? visibleSites() : visiblePlaces()).filter((x) => x.id !== state.selected);
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (state.mode === 'earth') selectSite(pick.id);
  else selectPlace(pick.id);
});

// ---------- Til almashtirgich UZ / EN (23) ----------
function applyStaticTexts() {
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPh)));
  $('#lang-btn').textContent = lang() === 'uz' ? 'EN' : 'UZ';
  updateSearchPlaceholder();
  updateCompareLabel();
  renderTypeChips();
  renderIntroStats();
}
$('#lang-btn').addEventListener('click', () => {
  setLang(lang() === 'uz' ? 'en' : 'uz');
  applyStaticTexts();
  render();
  if (state.selected) {
    if (siteById[state.selected] && state.mode === 'earth') selectSite(state.selected, { fromRoute: true });
    else if (placeById[state.selected]) selectPlace(state.selected, { fromRoute: true });
  }
  if (tour.on) renderTourBar();
  if (quiz.isOpen()) quiz.open();
});

// ---------- Klaviatura: Esc bilan kartani yopish ----------
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (!$('#chat').hidden) closeChat();
  else if (tour.on) stopTour();
  else if (state.selected) closeDetails();
});

// ---------- AI yordamchi (20): faqat /api/chat ishlasa ko'rinadi ----------
const chatLog = [];
function renderChat() {
  $('#chat-log').innerHTML = [
    `<p class="msg assistant">${esc(t('chat.hello'))}</p>`,
    ...chatLog.map((m) => `<p class="msg ${m.role}">${esc(m.content).replace(/\n/g, '<br />')}</p>`),
  ].join('');
  $('#chat-log').scrollTop = $('#chat-log').scrollHeight;
}
function openChat() {
  $('#chat').hidden = false;
  renderChat();
  $('#chat-input').focus();
}
function closeChat() {
  $('#chat').hidden = true;
  $('#chat-btn').focus();
}
$('#chat-btn').addEventListener('click', openChat);
$('#chat-close').addEventListener('click', closeChat);
$('#chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  chatLog.push({ role: 'user', content: text });
  renderChat();
  $('#chat-log').insertAdjacentHTML('beforeend', `<p class="msg assistant pending">${esc(t('chat.thinking'))}</p>`);
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatLog.slice(-8), lang: lang() }),
    });
    const data = await res.json();
    chatLog.push({ role: 'assistant', content: res.ok && data.reply ? data.reply : t('chat.error') });
  } catch {
    chatLog.push({ role: 'assistant', content: t('chat.error') });
  }
  renderChat();
});

async function initChat() {
  // Lokal dev serverda /api yo'q: faqat production'da tekshiramiz
  if (!import.meta.env.PROD) return;
  try {
    const res = await fetch('/api/chat');
    if (!res.ok) return;
    const data = await res.json();
    $('#chat-btn').hidden = !data.enabled;
  } catch {
    /* chat o'chiq qoladi */
  }
}

// ---------- PWA va Vercel Analytics (faqat production) ----------
if (import.meta.env.PROD) {
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
  // Vercel Web Analytics: loyiha sozlamalarida Analytics yoqilgan bo'lishi kerak
  window.va = window.va || ((...args) => (window.vaq = window.vaq || []).push(args));
  const s = document.createElement('script');
  s.defer = true;
  s.src = '/_vercel/insights/script.js';
  document.head.appendChild(s);
}

// ---------- Ishga tushirish ----------
createIcons({ icons: { GraduationCap, Bot, Microscope, Info, X, Globe, Orbit, Moon, Target, Shuffle, Star, LocateFixed, Scale, Play, MessageCircle } });
setLang(lang());
applyStaticTexts();

(async () => {
  const routed = await applyRoute();
  if (!routed) {
    await setMode('earth', { fromRoute: true });
    showIntro();
  }
  initChat();
})();
