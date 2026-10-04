// "Qaysi sayyora?" viktorinasi: matnli va rasmli savollar, qiyinlik darajalari, eng yaxshi natija.
import { esc, store, trapFocus } from './util.js';
import { t, lang } from './i18n.js';

// Matnli savollar. Faktlar NASA NSSDC fakt varaqalari va missiya ma'lumotlariga asoslangan.
// d: 1 = oson, 2 = o'rta, 3 = qiyin
const TEXT_QUESTIONS = [
  { d: 1, a: 'earth', uz: ["Yuzasining taxminan 71% ini suyuq suv qoplagan.", "Hozir yuzasida barqaror okeanlar bor yagona ma'lum dunyo bu Yer."], en: ['About 71% of its surface is covered by liquid water.', 'Earth is the only known world with stable surface oceans today.'] },
  { d: 1, a: 'mars', uz: ["Uning atrofida Fobos va Deymos degan ikkita kichik yo'ldosh aylanadi.", "Fobos va Deymos Marsning ikki yo'ldoshi."], en: ['Two small moons, Phobos and Deimos, orbit it.', 'Phobos and Deimos are the two moons of Mars.'] },
  { d: 1, a: 'moon', uz: ["1969-yilda qoldirilgan astronavt izlari hali ham turibdi, chunki ularni o'chiradigan shamol ham, yomg'ir ham yo'q.", "Oyda deyarli atmosfera yo'q, shuning uchun izlarni hech narsa yemirmaydi."], en: ['Astronaut footprints from 1969 are still there because no wind or rain erases them.', 'The Moon has almost no atmosphere, so nothing weathers the footprints.'] },
  { d: 1, a: 'moon', uz: ["Bu yerda og'irlik kuchi Yernikidan taxminan 6 marta kam, astronavtlar sakrab harakatlangan.", "Oydagi tortishish Yernikining taxminan 16,5% ini tashkil qiladi."], en: ['Gravity here is about one sixth of Earth’s, so astronauts hopped around.', 'Lunar gravity is about 16.5% of Earth’s.'] },
  { d: 1, a: 'mars', uz: ['Quyosh tizimidagi eng baland vulqon shu yerda: balandligi taxminan 22 km.', "Marsdagi Olympus Mons Everestdan qariyb 2,5 marta baland."], en: ['The tallest volcano in the Solar System is here, about 22 km high.', 'Olympus Mons on Mars is roughly 2.5 times taller than Everest.'] },
  { d: 1, a: 'moon', uz: ["Apollo 11 ekipaji 1969-yilda Tinchlik dengiziga qo'ngan.", "Mare Tranquillitatis Oydagi bazalt tekislik."], en: ['The Apollo 11 crew landed in the Sea of Tranquility in 1969.', 'Mare Tranquillitatis is a basalt plain on the Moon.'] },
  { d: 2, a: 'earth', uz: ["Atmosferasining taxminan 78% i azotdan iborat.", "Yer atmosferasi asosan azot (≈78%) va kisloroddan (≈21%) iborat."], en: ['About 78% of its atmosphere is nitrogen.', 'Earth’s air is mostly nitrogen (≈78%) and oxygen (≈21%).'] },
  { d: 2, a: 'mars', uz: ["Havo bosimi Yernikidan 1% ga ham yetmaydi, chang esa osmonni sarg'ish-jigarrang qiladi.", "Marsning o'rtacha sirt bosimi taxminan 6 mbar, ya'ni Yernikining 0,6% i."], en: ['Surface pressure is under 1% of Earth’s, and dust tints the sky butterscotch.', 'Mean surface pressure on Mars is about 6 mbar, roughly 0.6% of Earth’s.'] },
  { d: 2, a: 'moon', uz: ["Yalang'och ko'z bilan ko'rinadigan qora tekisliklar (\"dengizlar\") qadimgi lava oqimlaridir.", "Oy dengizlari ulkan zarba havzalarini to'ldirgan bazalt tekisliklardir."], en: ['The dark plains visible to the naked eye (“seas”) are ancient lava flows.', 'Lunar maria are basalt plains that filled giant impact basins.'] },
  { d: 2, a: 'earth', uz: ["Harakatlanuvchi litosfera plitalari qobiqni yangilab, tog' tizmalarini hosil qiladi.", "Faol plitalar tektonikasi faqat Yerda ma'lum."], en: ['Moving tectonic plates recycle the crust and build mountain ranges.', 'Active plate tectonics is known only on Earth.'] },
  { d: 2, a: 'mars', uz: ["Har qishda qutb qalpoqlarida karbonat angidrid qirovi to'planadi.", "Mars qutblarida har qishda CO₂ muzi qatlami hosil bo'ladi."], en: ['Every winter, carbon dioxide frost builds up on its polar caps.', 'A layer of CO₂ ice forms on the Martian polar caps each winter.'] },
  { d: 2, a: 'mars', uz: ["Bu yerdagi Valles Marineris kanyon tizimi 4000 km dan uzun.", "Valles Marineris Marsdagi ulkan kanyon tizimi."], en: ['Its Valles Marineris canyon system is more than 4,000 km long.', 'Valles Marineris is a giant canyon system on Mars.'] },
  { d: 2, a: 'mars', uz: ["Bir quyosh sutkasi (sol) taxminan 24 soat 40 daqiqa davom etadi.", "Marsdagi quyosh sutkasi 24 soat 39 daqiqa 35 soniya."], en: ['One solar day (a “sol”) lasts about 24 hours 40 minutes.', 'A Martian solar day is 24 h 39 min 35 s.'] },
  { d: 2, a: 'earth', uz: ["Bu yerdagi eng chuqur okean botig'i qariyb 11 km chuqurlikka yetadi.", "Mariana botig'i Yerdagi eng chuqur joy."], en: ['Its deepest ocean trench reaches almost 11 km down.', 'The Mariana Trench is the deepest place on Earth.'] },
  { d: 3, a: 'moon', uz: ["Bir quyosh chiqishidan keyingisigacha taxminan 29,5 Yer kuni o'tadi.", "Oy Yerga doim bir tomoni bilan qaragani uchun uning sutkasi Yer atrofidagi aylanishiga teng."], en: ['From one sunrise to the next takes about 29.5 Earth days.', 'The Moon is tidally locked, so its day matches its orbit around Earth.'] },
  { d: 3, a: 'earth', uz: ["Bugun ham yuzasida kislotali, temirga boy qizil daryo oqmoqda.", "Bu Ispaniyadagi Rio Tinto daryosi, qadimgi Marsdagi kislotali suvning analogi."], en: ['A red river with acidic, iron-rich water flows on its surface today.', 'That is Río Tinto in Spain, an analog for ancient acidic water on Mars.'] },
  { d: 3, a: 'mars', uz: ["2008-yilda qo'nuvchi apparat tuprog'ida perxlorat tuzlarini topgan.", "NASA'ning Phoenix apparati shimoliy qutb yaqinida perxloratlarni aniqlagan (Hecht va boshq., 2009)."], en: ['In 2008 a lander found perchlorate salts in its soil.', 'NASA’s Phoenix lander detected perchlorates near the north pole (Hecht et al., 2009).'] },
  { d: 3, a: 'moon', uz: ["Ekvatordagi sirt harorati kecha va kunduz orasida taxminan 95 K dan 390 K gacha o'zgaradi.", "NASA NSSDC: Oy ekvatorida kunlik harorat oralig'i 95–390 K."], en: ['Equatorial surface temperature swings from about 95 K to 390 K between night and day.', 'NASA NSSDC: the Moon’s equatorial diurnal range is 95–390 K.'] },
  { d: 3, a: 'mars', uz: ["Bu yerdagi Hellas havzasi Quyosh tizimidagi eng katta ko'rinadigan zarba havzalaridan biri.", "Hellas Planitia Marsning janubiy yarim sharida."], en: ['Its Hellas basin is one of the largest visible impact basins in the Solar System.', 'Hellas Planitia lies in the southern hemisphere of Mars.'] },
  { d: 3, a: 'moon', uz: ["Tycho kraterining yorug' nurlari yuzlab kilometrga cho'zilgan.", "Tycho Oydagi yosh krater, uning nurlari to'lin oyda yaxshi ko'rinadi."], en: ['Bright rays from Tycho crater stretch for hundreds of kilometres.', 'Tycho is a young lunar crater whose rays stand out at full Moon.'] },
];

const ROUND = 10;

// opts.sites / opts.places getter: har safar joriy tildagi nomlar olinadi
export function createQuiz(opts) {
  const { el, card, analogLabel, bodyLabel } = opts;
  const q = { list: [], i: 0, score: 0, level: 'mix', release: null };

  // Rasmli savollar ma'lumotlardan avtomatik yasaladi
  function imageQuestions() {
    const out = [];
    for (const s of opts.sites) {
      if (!s.analog || !s.hasPhoto) continue;
      out.push({
        d: 2,
        img: `/img/${s.id}-earth`,
        alt: s.name,
        prompt: t('quiz.imgEarth'),
        opts: ['mars', 'moon'],
        a: s.analog,
        why: `${s.name} (${s.country}): ${t('quiz.analogOf', { body: analogLabel(s.analog) })}`,
      });
    }
    for (const p of opts.places) {
      out.push({
        d: 3,
        img: `/img/${p.photo}`,
        alt: p.name,
        prompt: t('quiz.imgWhere'),
        opts: ['earth', 'mars', 'moon'],
        a: p.body,
        why: `${p.name} · ${bodyLabel(p.body)}`,
      });
    }
    return out;
  }

  function textQuestions() {
    return TEXT_QUESTIONS.map((x) => {
      const [clue, why] = x[lang()] || x.uz;
      return { d: x.d, prompt: clue, why, a: x.a, opts: ['earth', 'mars', 'moon'] };
    });
  }

  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  function open() {
    el.hidden = false;
    if (q.release) q.release();
    q.release = trapFocus(el, close);
    renderStart();
  }

  function close() {
    el.hidden = true;
    if (q.release) q.release();
    q.release = null;
  }

  const levels = [
    ['1', 'quiz.easy'],
    ['2', 'quiz.medium'],
    ['3', 'quiz.hard'],
    ['mix', 'quiz.mixed'],
  ];
  const bestKey = (lvl) => `quiz-best-${lvl}`;

  function header(title) {
    return `
      <div class="q-top">
        <span id="quiz-title">${esc(title)}</span>
        <button class="icon-btn" data-close aria-label="${esc(t('common.close'))}">✕</button>
      </div>`;
  }

  function renderStart() {
    card.innerHTML = `
      ${header(t('quiz.title'))}
      <p class="q-clue">${esc(t('quiz.intro', { n: ROUND }))}</p>
      <div class="q-levels">
        ${levels
          .map(([v, key]) => {
            const best = store.get(bestKey(v), null);
            return `<button class="q-level" data-level="${v}"><strong>${esc(t(key))}</strong><small>${best ? esc(t('quiz.best', { n: best.score, total: best.total })) : esc(t('quiz.noBest'))}</small></button>`;
          })
          .join('')}
      </div>`;
    card.querySelectorAll('[data-level]').forEach((b) => b.addEventListener('click', () => start(b.dataset.level)));
    card.querySelector('[data-level]').focus();
  }

  function start(level) {
    q.level = level;
    const pool = [...textQuestions(), ...imageQuestions()].filter((x) => level === 'mix' || String(x.d) === level);
    q.list = shuffle(pool).slice(0, ROUND);
    q.i = 0;
    q.score = 0;
    renderQuestion();
  }

  function renderQuestion() {
    const item = q.list[q.i];
    card.innerHTML = `
      ${header(`${t('quiz.title')} · ${q.i + 1} / ${q.list.length}`)}
      ${
        item.img
          ? `<div class="q-img ph-wrap"><picture><source srcset="${item.img}.webp" type="image/webp" /><img src="${item.img}.jpg" alt="${esc(t('quiz.photoAlt'))}" decoding="async" /></picture></div>`
          : ''
      }
      <p class="q-clue">${esc(item.prompt)}</p>
      <div class="q-opts" style="--n:${item.opts.length}">
        ${item.opts.map((k) => `<button class="q-opt" data-a="${k}"><span class="orb ${k}"></span>${esc(bodyLabel(k))}</button>`).join('')}
      </div>
      <div id="q-after" aria-live="polite"></div>`;
    card.querySelectorAll('.q-opt').forEach((b) => b.addEventListener('click', () => answer(b.dataset.a)));
    card.querySelector('.q-opt').focus();
  }

  function answer(a) {
    const item = q.list[q.i];
    if (item.answered) return;
    item.answered = true;
    const ok = a === item.a;
    if (ok) q.score++;
    card.querySelectorAll('.q-opt').forEach((b) => {
      b.disabled = true;
      if (b.dataset.a === item.a) b.classList.add('right');
      else if (b.dataset.a === a) b.classList.add('wrong');
    });
    const last = q.i === q.list.length - 1;
    card.querySelector('#q-after').innerHTML = `
      <p class="q-explain"><b class="${ok ? '' : 'no'}">${esc(ok ? t('quiz.right') : t('quiz.wrong'))}</b> ${esc(item.why)}</p>
      <div class="q-next"><button class="btn primary" id="q-next">${esc(last ? t('quiz.result') : t('quiz.next'))}</button></div>`;
    const next = card.querySelector('#q-next');
    next.addEventListener('click', () => {
      if (last) renderScore();
      else {
        q.i++;
        renderQuestion();
      }
    });
    next.focus();
  }

  function renderScore() {
    const total = q.list.length;
    const s = q.score;
    const ratio = total ? s / total : 0;
    const [rank, text] =
      ratio === 1 ? [t('quiz.rank1'), t('quiz.rank1text')] : ratio >= 0.6 ? [t('quiz.rank2'), t('quiz.rank2text')] : [t('quiz.rank3'), t('quiz.rank3text')];
    const prev = store.get(bestKey(q.level), null);
    const isBest = !prev || s > prev.score;
    if (isBest) store.set(bestKey(q.level), { score: s, total });
    card.innerHTML = `
      ${header(t('quiz.resultTitle'))}
      <div class="score">
        <div class="big">${s}/${total}</div>
        <div class="rank">${esc(rank)}</div>
        <p>${esc(text)}</p>
        <p class="best">${esc(isBest ? t('quiz.newBest') : t('quiz.best', { n: prev.score, total: prev.total }))}</p>
        <div class="q-next">
          <button class="btn primary" id="q-again">${esc(t('quiz.again'))}</button>
          <button class="btn" id="q-share">${esc(t('common.share'))}</button>
          <button class="btn" data-close>${esc(t('quiz.back'))}</button>
        </div>
        <p class="share-note" id="q-share-note" aria-live="polite"></p>
      </div>`;
    card.querySelector('#q-again').addEventListener('click', renderStart);
    card.querySelector('#q-share').addEventListener('click', async () => {
      const textMsg = t('quiz.shareText', { n: s, total });
      const url = location.origin + location.pathname;
      try {
        if (navigator.share) await navigator.share({ title: 'Earth Analogs Explorer', text: textMsg, url });
        else {
          await navigator.clipboard.writeText(`${textMsg} ${url}`);
          card.querySelector('#q-share-note').textContent = t('common.copied');
        }
      } catch {
        /* foydalanuvchi bekor qildi */
      }
    });
    card.querySelector('#q-again').focus();
  }

  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-close]')) close();
  });

  return { open, close, isOpen: () => !el.hidden };
}
