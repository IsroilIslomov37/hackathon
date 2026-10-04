// Umumiy yordamchi funksiyalar

export const esc = (str) =>
  String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Qidiruv uchun matnni normallashtirish:
// katta-kichik harf, diakritika (ö → o), o'zbekcha tutuq belgilari (' ʻ ’ ‘ ` ʼ) va ortiqcha bo'shliqlar.
export function norm(str) {
  return String(str ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['ʻʼ’‘`´]/g, '')
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, ' ')
    .trim();
}

// Ikki so'z orasidagi tahrir masofasi (bitta harf xatosini kechirish uchun)
function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      rowMin = Math.min(rowMin, prev[j]);
    }
    if (rowMin > max) return max + 1;
  }
  return prev[b.length];
}

// So'rovdagi har bir so'z matndagi biror so'zga mos kelishi kerak:
// so'z boshi bo'yicha yoki (5+ harfli so'zlarda) bitta harf farqi bilan.
// Masalan: "Uzbekiston" → "O'zbekiston", "atakama" → "Atacama".
export function matches(query, haystack) {
  const q = norm(query);
  if (!q) return true;
  const words = norm(haystack).split(' ');
  return q.split(' ').every((qw) =>
    words.some((w) => w.startsWith(qw) || w.includes(qw) || (qw.length >= 4 && editDistance(qw, w.slice(0, qw.length)) <= 1) || (qw.length >= 5 && editDistance(qw, w) <= 1)),
  );
}

// localStorage xavfsiz o'rami (xususiy rejimda xato berishi mumkin)
export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* saqlash imkoni yo'q */
    }
  },
};

// Ikki nuqta orasidagi masofa (km), Yer sferasi bo'yicha
export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const d = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * d) / 2) ** 2 + Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin(((lng2 - lng1) * d) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Modal oynalar uchun fokus tuzog'i: Tab fokusni oyna ichida aylantiradi
export function trapFocus(container, onClose, initial = null) {
  const prevFocus = document.activeElement;
  const sel = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...container.querySelectorAll(sel)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  container.addEventListener('keydown', onKey);
  setTimeout(() => {
    const f = (initial && container.querySelector(initial)) || container.querySelector(sel);
    if (f) f.focus();
  }, 0);
  return () => {
    container.removeEventListener('keydown', onKey);
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  };
}
