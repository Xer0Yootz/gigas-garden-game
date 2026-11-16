// Output filter for every model reply, before anything is posted.
import { DECLINE, SIGN_OFF, type Tag } from './router.ts';

// Jasmine's banned list (2026-10-25). Matching ignores case and treats spaces and hyphens alike.
export const BANNED = [
  'lattice', 'BPM', 'bestiary', 'Song-Bond', 'soul bond', 'captain', 'queen', 'sovereign', 'Sentinel',
  'gothic', 'Barbie', 'MAGA', 'Team Rocket', 'clean light source', 'ghost fauna', 'mouthless',
  'Mother of Dysorder', 'low-grav anime flow', 'sky cities',
];

const bannedRes = BANNED.map((w) => {
  const parts = w.toLowerCase().split(/[\s-]+/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // "queen" also catches "queens"; "captain" catches "captains".
  return new RegExp(`\\b${parts.join('[\\s-]*')}s?\\b`, 'i');
});

export function bannedHits(text: string): string[] {
  return BANNED.filter((_, i) => bannedRes[i].test(text));
}

// Lines the model must never produce on its own. If they show up, they are cut.
const FORBIDDEN = [
  /hexa\s*sigil\s*online\.?/gi,
  /^\s*locked\.?\s*$/gim,
  /\blocked\.(?=\s|$)/gi,
  // The old status line was removed from the game and chat (Jasmine 10-25). If the model ever writes it, it is cut.
  /grid\s*ok\s*\|?\s*ikg\s*viewport\s*\|?\s*deep\s*time\s*5150(\s*\|?\s*queen\s*:?\s*praxia)?/gi,
];

export function stripDashes(text: string): string {
  return text
    .replace(/\s*[\u2014\u2013\u2015\u2012\u2E3A\u2E3B]\s*/g, ', ')
    .replace(/\s+-{1,3}\s+/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*([.!?])/g, '$1');
}

export function capWords(text: string, max: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max) return text.trim();
  const cut = words.slice(0, max).join(' ');
  const lastStop = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('?'), cut.lastIndexOf('!'));
  return (lastStop > 20 ? cut.slice(0, lastStop + 1) : cut + '.').trim();
}

export type Cleaned = { ok: true; text: string } | { ok: false; reason: 'banned' | 'empty'; hits?: string[] };

export function cleanReply(raw: string, tag: Tag, toCreator: boolean, maxWords = 60): Cleaned {
  let t = String(raw ?? '').replace(/\r/g, '');
  // No labels or stage directions: "Hexa:" prefixes, [brackets], *actions*.
  t = t.replace(/^\s*(hexa(\s*sigil)?|cyphr)\s*:\s*/i, '').replace(/\[[^\]]*\]/g, '').replace(/\*[^*]+\*/g, '');
  for (const re of FORBIDDEN) t = t.replace(re, ' ');
  t = stripDashes(t);
  // Sign-off: Hexa's "Further Directives, User?" goes only to the creator, who is the only "User".
  t = t.replace(/further\s+directives,?\s*user\??/gi, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  t = capWords(t, maxWords);
  if (!t || /^[\s.,!?]*$/.test(t)) return { ok: false, reason: 'empty' };
  const hits = bannedHits(t);
  if (hits.length) return { ok: false, reason: 'banned', hits };
  if (tag === 'hexa' && toCreator) t = `${t} ${SIGN_OFF}`;
  return { ok: true, text: t };
}

// True when the model said it has nothing on record; we post the exact canon decline.
export function normalizeDecline(text: string, tag: Tag): string {
  return /^(not on record|no record)\.?$/i.test(text.replace(/\s*further directives, user\?$/i, '').trim())
    ? DECLINE[tag] + (tag === 'hexa' && /further directives, user\?$/i.test(text) ? ` ${SIGN_OFF}` : '')
    : text;
}

