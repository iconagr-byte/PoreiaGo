/**
 * Turn a jammed Greek excursion description into intro + day/time slots.
 * Office copy often stores "1η Ημέρα: … Απόγευμα: … 2η Ημέρα: Πρωί: …" as one line.
 */

const DAY_CORE = String.raw`\d+\s*[ηήh]\s*[ΗηHh]μέρ[αa]\s*:?`;
const DAY_CAPTURE = String.raw`(\d+)\s*[ηήh]\s*[ΗηHh]μέρ[αa]\s*:?`;
const SLOT_NAMES = ['Πρωί', 'Μεσημέρι', 'Απόγευμα', 'Βράδυ', 'Νύχτα'];
const SLOT_ALT = SLOT_NAMES.join('|');
/** Non-capturing — JS String.split injects capturing-group matches into the array. */
const SLOT_CORE = `(?:${SLOT_ALT})\\s*:`;
const SLOT_CAPTURE = `(${SLOT_ALT})\\s*:`;

const DAY_SPLIT = new RegExp(`(?=${DAY_CORE})`, 'gi');
const DAY_HEAD = new RegExp(`^${DAY_CAPTURE}\\s*`, 'i');
const SLOT_SPLIT = new RegExp(`(?=${SLOT_CORE})`, 'gi');
const SLOT_HEAD = new RegExp(`^${SLOT_CAPTURE}\\s*`, 'i');
const HAS_DAY = new RegExp(DAY_CORE, 'i');

const SLOT_ICON = {
  Πρωί: 'wb_sunny',
  Μεσημέρι: 'lunch_dining',
  Απόγευμα: 'wb_twilight',
  Βράδυ: 'dark_mode',
  Νύχτα: 'bedtime',
  body: 'route',
};

export function itinerarySlotIcon(kind) {
  return SLOT_ICON[kind] || SLOT_ICON.body;
}

function collapseWs(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripLeadingTitle(text, title) {
  const t = String(title || '').trim();
  if (!t || !text) return text;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`^${esc}\\s*[:\\-–—]?\\s*`, 'i'), '').trim();
}

function parseSlots(chunk) {
  const parts = chunk.split(SLOT_SPLIT).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1 && !SLOT_HEAD.test(chunk)) {
    const body = chunk.trim();
    return body ? [{ kind: 'body', label: '', text: body }] : [];
  }
  const slots = [];
  for (const part of parts) {
    const m = part.match(SLOT_HEAD);
    if (m) {
      const kind = m[1];
      const text = part.slice(m[0].length).trim();
      if (text) slots.push({ kind, label: kind, text });
    } else if (part.trim()) {
      slots.push({ kind: 'body', label: '', text: part.trim() });
    }
  }
  return slots;
}

/**
 * @param {string} raw
 * @param {{ title?: string }} [opts]
 * @returns {{
 *   structured: boolean,
 *   intro: string,
 *   days: Array<{ day: number, label: string, slots: Array<{ kind: string, label: string, text: string }> }>,
 *   paragraphs: string[],
 * }}
 */
export function parseTripItinerary(raw, opts = {}) {
  const collapsed = collapseWs(raw);
  const text = stripLeadingTitle(collapsed, opts.title);
  if (!text) {
    return { structured: false, intro: '', days: [], paragraphs: [] };
  }

  const hasDays = HAS_DAY.test(text);
  if (!hasDays) {
    const paragraphs = text
      .split(/\n\n+|(?<=[.!?…])\s+(?=[A-ZΑ-ΩΆ-Ώ«"])/u)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    return {
      structured: false,
      intro: text,
      days: [],
      paragraphs: paragraphs.length ? paragraphs : [text],
    };
  }

  const chunks = text.split(DAY_SPLIT).map((c) => c.trim()).filter(Boolean);
  let intro = '';
  const days = [];

  for (const chunk of chunks) {
    const head = chunk.match(DAY_HEAD);
    if (!head) {
      if (!intro) intro = chunk;
      else intro = `${intro} ${chunk}`.trim();
      continue;
    }
    const dayNum = Number(head[1]);
    const rest = chunk.slice(head[0].length).trim();
    days.push({
      day: dayNum,
      label: `${dayNum}η Ημέρα`,
      slots: parseSlots(rest),
    });
  }

  intro = stripLeadingTitle(intro, opts.title);
  return {
    structured: days.length > 0,
    intro,
    days,
    paragraphs: intro ? [intro] : [],
  };
}
