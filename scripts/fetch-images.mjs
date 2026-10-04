// Bir martalik skript: suratlarni public/img ga yuklaydi. Ishga tushirish: node scripts/fetch-images.mjs (loyiha ildizidan)
import { writeFileSync, existsSync } from 'fs';
const UA = { 'User-Agent': 'earth-analogs-hackathon/0.1 (education)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const space = {
  atacama: 'PIA16204', haughton: 'PIA17932', 'rio-tinto': 'PIA03279', 'dry-valleys': 'PIA10792', mdrs: 'PIA16105',
  'hi-seas': 'PIA02982', iceland: 'PIA05805', svalbard: 'PIA00290', 'wadi-rum': 'PIA17944', dallol: 'PIA09491',
  pilbara: 'PIA25022', 'meteor-crater': 'as12-50-07431', 'cinder-lake': 'as11-40-5951', ries: 'as14-64-9099',
  sudbury: 'PIA13225', lanzarote: 'PIA12954', 'craters-of-the-moon': 'as15-89-12100', aralkum: 'PIA10247',
};
const wiki = {
  atacama: 'commons/9/9f/Valle_de_la_Luna%2C_San_Pedro_de_Atacama%2C_Chile%2C_2016-02-01%2C_DD_152.JPG',
  'rio-tinto': 'commons/b/b0/Rio_tinto_river_CarolStoker_NASA_Ames_Research_Center.jpg',
  mdrs: 'commons/4/49/Mars_Desert_Research_Station_2020.jpg',
  'hi-seas': 'commons/4/48/HI_SEAS_Analogue_suit_test.jpg',
  iceland: 'commons/2/24/B%C3%A1r%C3%B0arbunga_Volcano%2C_September_4_2014_-_15145875322.jpg',
  'wadi-rum': 'commons/5/56/Mountain_in_Wadi_Rum%2C_Jordan.jpg',
  dallol: 'commons/d/d4/ET_Afar_asv2018-01_img48_Dallol.jpg',
  'meteor-crater': 'commons/f/fd/Meteor_Crater_-_Arizona.jpg',
  lanzarote: 'commons/4/41/Timanfaya_National_Park_landscape.jpg',
  'craters-of-the-moon': 'commons/a/a3/CratersDrone1.jpg',
  ries: 'commons/9/99/N%C3%B6rdlinger_Ries_Relief_Map%2C_SRTM-1.jpg',
  sudbury: 'commons/3/37/Sudbury_Wanapitei_WorldWind.jpg',
};
// Sun'iy yo'ldosh kadri: markaz va kenglik (gradus)
const sat = {
  haughton: [75.38, -89.68, 0.5], 'dry-valleys': [-77.52, 161.85, 0.6], svalbard: [79.42, 13.33, 0.3],
  ries: [48.88, 10.56, 0.4], sudbury: [46.6, -81.18, 1.0], pilbara: [-21.18, 119.15, 0.2],
  'cinder-lake': [35.37, -111.47, 0.12], aralkum: [45.0, 59.5, 2.0],
  // Wikimedia ishlamasa zaxira
  dallol: [14.24, 40.30, 0.04], lanzarote: [29.01, -13.75, 0.08], 'craters-of-the-moon': [43.42, -113.55, 0.08],
};

async function save(url, file, headers = UA) {
  const r = await fetch(url, { headers });
  if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image')) throw new Error(`${r.status} ${url}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

for (const [id, nid] of Object.entries(space)) {
  const f = `public/img/${id}-space.jpg`;
  if (existsSync(f)) continue;
  for (const v of ['medium', 'large', 'orig']) {
    try { await save(`https://images-assets.nasa.gov/image/${nid}/${nid}~${v}.jpg`, f); console.log('ok', f, v); break; }
    catch (e) { if (v === 'orig') console.log('FAIL', f, e.message); }
  }
}
for (const [id, path] of Object.entries(wiki)) {
  const f = `public/img/${id}-earth.jpg`;
  if (existsSync(f)) continue;
  const name = path.split('/').pop();
  const thumb = `https://upload.wikimedia.org/wikipedia/${path.replace('commons/', 'commons/thumb/')}/1280px-${name}`;
  try { await save(thumb, f); console.log('ok', f); }
  catch { try { await save(`https://upload.wikimedia.org/wikipedia/${path}`, f); console.log('ok (orig)', f); } catch (e) { console.log('FAIL', f, e.message); } }
  await sleep(6000);
}
for (const [id, [lat, lon, span]] of Object.entries(sat)) {
  const f = `public/img/${id}-earth.jpg`;
  if (existsSync(f)) continue;
  const w = span / Math.cos((lat * Math.PI) / 180) * 1.6;
  const bbox = [lon - w / 2, lat - span / 2, lon + w / 2, lat + span / 2].join(',');
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=1000,625&format=jpg&f=image`;
  try { await save(url, f); console.log('ok sat', f); } catch (e) { console.log('FAIL', f, e.message); }
}
