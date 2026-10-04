// Vercel serverless funksiyasi: /api/chat
// AI yordamchi faqat sayt ma'lumotlari (sites.json + places.json) asosida javob beradi.
// API kalit brauzerga hech qachon chiqmaydi: u faqat serverdagi ANTHROPIC_API_KEY o'zgaruvchisida turadi.
import { createRequire } from 'node:module';
import Anthropic from '@anthropic-ai/sdk';

const require = createRequire(import.meta.url);
const sites = require('../src/data/sites.json');
const places = require('../src/data/places.json');

const MODEL = 'claude-opus-5-5';
const MAX_MESSAGES = 8; // suhbat tarixidan oxirgi nechtasi yuboriladi
const MAX_CHARS = 500; // bitta xabarning eng katta uzunligi
const RATE_LIMIT = 20; // bitta IP uchun 10 daqiqada so'rovlar soni (bitta server nusxasi doirasida)

// Kontekst: AI uchun keraksiz maydonlarsiz ixcham ma'lumot
const CONTEXT = JSON.stringify({
  earthSites: sites.map((s) => ({
    id: s.id,
    name: s.name,
    nameEn: s.en?.name,
    country: s.country,
    coords: s.coords,
    analogOf: s.analog,
    type: s.type,
    proposed: !!s.proposed,
    pairedPlaceId: s.place,
    similarityCriteria0to10: s.params,
    why: s.why,
    whyEn: s.en?.why,
    usedBy: s.usedBy,
    missions: (s.missions || []).map((m) => ({ year: m.year, text: m.uz, textEn: m.en, source: m.src?.label })),
  })),
  marsAndMoonPlaces: places.map((p) => ({
    id: p.id,
    body: p.body,
    name: p.name,
    nameEn: p.en?.name,
    coords: p.coords,
    approximateLocation: !!p.approx,
    mission: p.mission,
    missionYear: p.missionYear,
    about: p.about,
    aboutEn: p.en?.about,
    metrics: p.metrics,
  })),
});

const SYSTEM = `You are the assistant of "Earth Analogs Explorer", a project built for the MARS Online Hackathon about places on Earth that resemble the Moon or Mars. The hackathon is an independent event: neither it nor this project is affiliated with or endorsed by NASA. NASA, USGS and other organisations are only sources of open data.

Answer ONLY from the JSON data below. If the data does not contain the answer, say clearly that the site has no information about it and suggest a related place from the data. Never invent numbers, dates, missions or sources. When you use a metric value, mention its source label from the data. The similarity percentage is the average of six team-estimated criteria (0–10) multiplied by 10; it is not a scientific measurement.

Reply in the user's language (Uzbek in Latin script or English), in at most 120 words, as plain text without Markdown. Latency-sensitive; begin your visible answer immediately.

<data>
${CONTEXT}
</data>`;

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// Juda oddiy, eng yaxshi harakat asosidagi cheklov (har bir server nusxasi o'z xotirasida saqlaydi)
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((ts) => now - ts < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .slice(-MAX_MESSAGES);
  // Suhbat foydalanuvchi xabari bilan boshlanishi va tugashi kerak
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return null;
  return msgs;
}

export default async function handler(req, res) {
  // Frontend shu orqali chat tugmasini ko'rsatish-ko'rsatmaslikni biladi
  if (req.method === 'GET') {
    res.status(200).json({ enabled: Boolean(client) });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!client) {
    res.status(503).json({ error: 'Chat is disabled' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const messages = cleanMessages(body.messages);
  if (!messages) {
    res.status(400).json({ error: 'Invalid messages' });
    return;
  }
  const en = body.lang === 'en';

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      // Oddiy savol-javob: past effort tezroq va arzonroq
      output_config: { effort: 'low' },
      // Xavfsizlik klassifikatori rad etsa, so'rov server tomonda tavsiya etilgan modelda qayta bajariladi
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Katta va o'zgarmas system prompt keshlanadi
      cache_control: { type: 'ephemeral' },
      system: SYSTEM,
      messages,
    });

    if (response.stop_reason === 'refusal') {
      res.status(200).json({
        reply: en
          ? 'I can’t help with that request. Ask me about the analog sites on this map.'
          : "Bu so'rovga javob bera olmayman. Xaritadagi analog joylar haqida so'rang.",
      });
      return;
    }

    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    res.status(200).json({ reply: reply || (en ? 'No answer.' : "Javob yo'q.") });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: 'Rate limited' });
    } else if (error instanceof Anthropic.AuthenticationError) {
      console.error('Anthropic API key is invalid');
      res.status(500).json({ error: 'Server configuration error' });
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}: ${error.message}`);
      res.status(502).json({ error: 'Upstream error' });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Internal error' });
    }
  }
}
