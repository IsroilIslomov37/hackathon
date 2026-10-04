// Oddiy va yengil 3D globus (faqat Three.js).
// Faqat harakat bo'lganda chiziladi: globus tinch turganda protsessor/GPU ishlamaydi.
import * as THREE from 'three';

const DEG = Math.PI / 180;

// Teng burchakli tekstura bilan mos keladigan sfera koordinatasi
function latLngToVec(lat, lng, r = 1) {
  const phi = (90 - lat) * DEG;
  const th = (lng + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.fillStyle = '#fff';
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#ffffff';
  g.stroke();
  return new THREE.CanvasTexture(c);
}

// Oddiy yulduzli fon: bir marta 2D canvas'da chiziladi va CSS fon (--stars) sifatida qo'yiladi.
// WebGL kadrlariga qo'shilmaydi, shuning uchun globus tezligiga ta'sir qilmaydi.
function paintStars(el) {
  const TILE = 1024; // CSS'dagi background-size bilan bir xil
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(TILE * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  // Doimiy seed: har safar bir xil yulduzlar naqshi chiqadi
  let seed = 20261004;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tints = ['255,255,255', '255,255,255', '255,255,255', '200,220,255', '255,236,210'];
  for (let i = 0; i < 260; i++) {
    const bright = rnd() < 0.06;
    const r = bright ? 0.9 + rnd() * 0.6 : 0.35 + rnd() * 0.45;
    g.fillStyle = `rgba(${tints[Math.floor(rnd() * tints.length)]},${(bright ? 0.75 : 0.3) + rnd() * 0.35})`;
    g.beginPath();
    g.arc(rnd() * TILE, rnd() * TILE, r, 0, Math.PI * 2);
    g.fill();
  }
  c.toBlob((blob) => {
    if (blob) el.style.setProperty('--stars', `url(${URL.createObjectURL(blob)})`);
  });
}

export function createGlobe(el, { onPointClick, onGlobeClick, tooltip, onLoading = () => {} }) {
  paintStars(el);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  el.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-3, 2, 4);
  scene.add(sun);

  const group = new THREE.Group();
  scene.add(group);
  const material = new THREE.MeshLambertMaterial({ color: 0x223355 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), material);
  group.add(sphere);

  const dotTex = dotTexture();
  const makePoints = (size) =>
    new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ size, map: dotTex, vertexColors: true, sizeAttenuation: false, alphaTest: 0.5 }),
    );
  const dots = makePoints(11);
  const selDot = makePoints(18);
  group.add(dots, selDot);

  // Holat: aylanish (rotX, rotY) va kamera masofasi
  const view = { rotX: 0.3, rotY: 0, dist: 4.4 };
  let vel = { x: 0, y: 0 };
  let tween = null;
  let points = [];
  let raf = 0;
  let last = 0;

  function apply() {
    group.rotation.set(view.rotX, view.rotY, 0);
    camera.position.set(0, 0, view.dist);
    camera.lookAt(0, 0, 0);
  }

  function step(dt) {
    let active = false;
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.dur);
      const e = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
      for (const k in tween.to) view[k] = tween.from[k] + (tween.to[k] - tween.from[k]) * e;
      if (tween.t >= 1) tween = null;
      active = true;
    } else if (Math.abs(vel.x) + Math.abs(vel.y) > 0.0001 && !dragging) {
      view.rotY += vel.x;
      view.rotX = Math.max(-1.4, Math.min(1.4, view.rotX + vel.y));
      vel.x *= 0.92;
      vel.y *= 0.92;
      active = true;
    }
    return active;
  }

  function tick(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    const active = step(dt);
    apply();
    renderer.render(scene, camera);
    if (active) requestRender();
    else last = 0;
  }
  function requestRender() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  // Globus markazini ekranda yuqoriga surish (masalan, telefonda pastki karta ochiq bo'lsa).
  // Kamera kadri siljiydi, aylanish va nuqtani topish mantiqi o'zgarmaydi.
  let offsetFrac = 0;
  function applyOffset() {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    if (offsetFrac) camera.setViewOffset(w, h, 0, Math.round(h * offsetFrac), w, h);
    else camera.clearViewOffset();
  }

  function resize() {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    applyOffset();
    requestRender();
  }
  new ResizeObserver(resize).observe(el);

  // ---------- Sichqoncha / barmoq ----------
  const ptrs = new Map();
  let dragging = false;
  let moved = 0;
  let pinch = 0;
  const cvs = renderer.domElement;

  cvs.addEventListener('pointerdown', (e) => {
    cvs.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragging = true;
    moved = 0;
    tween = null;
    vel = { x: 0, y: 0 };
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  cvs.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) {
      hover(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoom(pinch / d);
      pinch = d;
      moved += 10;
      return;
    }
    moved += Math.abs(dx) + Math.abs(dy);
    const k = (0.005 * (view.dist - 1)) / 2.4;
    vel = { x: dx * k, y: dy * k };
    view.rotY += vel.x;
    view.rotX = Math.max(-1.4, Math.min(1.4, view.rotX + vel.y));
    tooltip(null);
    requestRender();
  });
  const end = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = 0;
    if (ptrs.size) return;
    dragging = false;
    if (moved < 6 && e.type === 'pointerup') click(e.clientX, e.clientY);
    requestRender();
  };
  cvs.addEventListener('pointerup', end);
  cvs.addEventListener('pointercancel', end);
  cvs.addEventListener('pointerleave', () => tooltip(null));
  cvs.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom(Math.exp(e.deltaY * 0.001));
    },
    { passive: false },
  );

  function zoom(f) {
    tween = null;
    view.dist = Math.max(1.35, Math.min(7, view.dist * f));
    requestRender();
  }

  // ---------- Nuqtani topish (ekran bo'yicha eng yaqini) ----------
  const tmp = new THREE.Vector3();
  function findPoint(cx, cy) {
    const rect = cvs.getBoundingClientRect();
    group.updateMatrixWorld();
    let best = null;
    let bestD = 16;
    for (const p of points) {
      tmp.copy(p._v).applyMatrix4(group.matrixWorld);
      // Orqa tomondagi nuqtalarni hisobga olmaymiz
      if (tmp.dot(camera.position.clone().sub(tmp)) <= 0) continue;
      tmp.project(camera);
      const sx = rect.left + ((tmp.x + 1) / 2) * rect.width;
      const sy = rect.top + ((1 - tmp.y) / 2) * rect.height;
      const d = Math.hypot(sx - cx, sy - cy);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  let hoverQueued = false;
  function hover(cx, cy) {
    if (hoverQueued) return;
    hoverQueued = true;
    requestAnimationFrame(() => {
      hoverQueued = false;
      const p = findPoint(cx, cy);
      cvs.style.cursor = p ? 'pointer' : 'grab';
      tooltip(p, cx, cy);
    });
  }

  const ray = new THREE.Raycaster();
  function click(cx, cy) {
    const p = findPoint(cx, cy);
    if (p) {
      onPointClick(p);
      return;
    }
    const rect = cvs.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1),
      camera,
    );
    const hit = ray.intersectObject(sphere)[0];
    if (!hit) return;
    const v = sphere.worldToLocal(hit.point.clone()).normalize();
    const lat = 90 - Math.acos(v.y) / DEG;
    const lng = ((Math.atan2(v.z, -v.x) / DEG - 180 + 540) % 360) - 180;
    onGlobeClick({ lat, lng });
  }

  // ---------- Teksturalar: kesh + faqat oxirgi so'ralgan tekstura qo'llanadi ----------
  const loader = new THREE.TextureLoader();
  const cache = new Map(); // url -> Promise<Texture>
  let wanted = null; // oxirgi so'ralgan url (race condition'dan himoya)

  function loadTexture(url) {
    if (!cache.has(url)) {
      const p = new Promise((resolve, reject) => {
        loader.load(
          url,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            resolve(tex);
          },
          undefined,
          reject,
        );
      });
      // Xato bo'lsa keshdan o'chiramiz, keyingi safar qayta urinish mumkin bo'lsin
      p.catch(() => cache.delete(url));
      cache.set(url, p);
    }
    return cache.get(url);
  }

  // ---------- Tashqi API ----------
  return {
    // Tekstura to'liq yuklangandan keyingina almashadi. Yuklanayotganda pinlar yashiriladi,
    // shunda eski sayyora ustida yangi sayyoraning pinlari ko'rinmaydi.
    async setTexture(url, fallbackColor = 0x223355) {
      wanted = url;
      dots.visible = selDot.visible = false;
      onLoading(true);
      requestRender();
      let result = 'ok';
      try {
        const tex = await loadTexture(url);
        if (wanted !== url) return 'stale'; // foydalanuvchi bu orada boshqa tabni tanlagan
        material.map = tex;
        material.color.set(0xffffff);
      } catch {
        if (wanted !== url) return 'stale';
        // Fallback: tekstura o'rniga sayyoraga mos oddiy rang
        material.map = null;
        material.color.set(fallbackColor);
        result = 'error';
      }
      material.needsUpdate = true;
      dots.visible = selDot.visible = true;
      onLoading(false);
      requestRender();
      return result;
    },
    // Boshqa teksturalarni oldindan yuklab qo'yish (tablar tez almashsin)
    preload(urls) {
      urls.forEach((u) => loadTexture(u).catch(() => {}));
    },
    setPoints(list, selectedId) {
      points = list.map((p) => ({ ...p, _v: latLngToVec(p.lat, p.lng, 1.004) }));
      const fill = (obj, arr) => {
        const pos = new Float32Array(arr.length * 3);
        const col = new Float32Array(arr.length * 3);
        const c = new THREE.Color();
        arr.forEach((p, i) => {
          pos.set([p._v.x, p._v.y, p._v.z], i * 3);
          c.set(p.id === selectedId ? '#ffffff' : p.color);
          col.set([c.r, c.g, c.b], i * 3);
        });
        obj.geometry.dispose();
        obj.geometry = new THREE.BufferGeometry();
        obj.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        obj.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
      };
      fill(dots, points.filter((p) => p.id !== selectedId));
      fill(selDot, points.filter((p) => p.id === selectedId));
      requestRender();
    },
    // Berilgan joyni kameraga qaratish
    flyTo(lat, lng, dist = view.dist, ms = 1200) {
      let toY = -lng * DEG - Math.PI / 2;
      toY = view.rotY + Math.atan2(Math.sin(toY - view.rotY), Math.cos(toY - view.rotY));
      tween = {
        t: 0,
        dur: ms / 1000,
        from: { rotX: view.rotX, rotY: view.rotY, dist: view.dist },
        to: { rotX: Math.max(-1.4, Math.min(1.4, lat * DEG)), rotY: toY, dist },
      };
      requestRender();
      return new Promise((r) => setTimeout(r, ms));
    },
    // frac: ekran balandligining qancha qismiga yuqoriga surish (0 = markazda)
    setCenterOffset(frac) {
      if (frac === offsetFrac) return;
      offsetFrac = frac;
      applyOffset();
      requestRender();
    },
    zoomTo(dist, ms = 500) {
      tween = { t: 0, dur: ms / 1000, from: { dist: view.dist }, to: { dist } };
      requestRender();
      return new Promise((r) => setTimeout(r, ms));
    },
    render: requestRender,
  };
}
