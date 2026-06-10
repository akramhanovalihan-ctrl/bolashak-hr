import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

function fallbackParseDate(text) {
  const t = text.trim().toLowerCase();
  const today = new Date();
  if (t === 'сегодня') return fmt(today);
  if (t === 'завтра') {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return fmt(d);
  }
  const m = t.match(/(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : today.getFullYear();
    return fmt(new Date(year, month, day));
  }
  return null;
}

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

export async function parseDateInput(text) {
  if (!text?.trim()) return null;
  const fb = fallbackParseDate(text);
  if (!apiKey) return fb;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Сегодня ${today}. Преобразуй дату из текста "${text}" в формат YYYY-MM-DD. Только дата, без пояснений. Если непонятно — ответь NULL.`;
    const result = await model.generateContent(prompt);
    const out = result.response.text().trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
    return fb;
  } catch {
    return fb;
  }
}

export async function parseDateRange(text) {
  const parts = text.split(/[—\-–]+| по | до /i).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    const d = await parseDateInput(parts[0]);
    return d ? { from: d, to: d } : null;
  }
  const from = await parseDateInput(parts[0]);
  const to = await parseDateInput(parts[1]);
  if (!from || !to) return null;
  return { from, to };
}
