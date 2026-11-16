// Local tests with mocks only. No network, no real model calls, no database.
//   deno test --node-modules-dir=none supabase/functions/ai-chat/
import { assert, assertEquals, assertMatch, assertNotMatch } from 'jsr:@std/assert@1';
import { handle, type Msg, type Store } from './handler.ts';
import { firstMention, route } from './router.ts';
import { BANNED, bannedHits, cleanReply, stripDashes } from './filter.ts';
import { DEFAULTS, makeProvider } from './providers.ts';
import { extractPrompt, sanitizePrompt } from './persona_lib.ts';
import { PERSONAS } from './personas.generated.ts';

// Any real network call fails the test run.
globalThis.fetch = (() => { throw new Error('real fetch is not allowed in tests'); }) as typeof fetch;

const NOW = new Date('2026-10-25T23:40:00Z');
const UID = '11111111-1111-4111-8111-111111111111';
const CREATOR = '22222222-2222-4222-8222-222222222222';
const MID = '33333333-3333-4333-8333-333333333333';

function mockStore(msg: Partial<Msg> = {}, counts: Partial<Record<string, number>> = {}) {
  const inserted: { tag: string; body: string; reply_to: string }[] = [];
  const m: Msg = { id: MID, room_id: 'neon-vigil', user_id: UID, user_name: 'Moth Rider', body: '@Hexa what is the GRID?',
    created_at: new Date(NOW.getTime() - 5000).toISOString(), is_ai: false, ...msg };
  const store: Store = {
    userFromToken: async (t) => (t === 'good' ? { id: UID } : t === 'creator' ? { id: CREATOR } : null),
    getMessage: async (id) => (id === MID ? m : null),
    hasReply: async () => (counts.hasReply ?? 0) > 0,
    recentMessages: async () => [m],
    countAiSince: async (_s, tag) => (tag ? counts.cooldown ?? 0 : counts.room ?? 0),
    countAiRepliesToUserSince: async () => counts.user ?? 0,
    insertAiReply: async (row) => { inserted.push(row); },
  };
  return { store, inserted };
}

function mockProvider(replies: string[]) {
  const calls: { system: string; user: string }[] = [];
  return { calls, make: () => ({ name: 'mock', model: 'mock', complete: async (i: { system: string; user: string }) => { calls.push(i); return replies.shift() ?? ''; } }) };
}

const ENV: Record<string, string> = { AI_REPLIES_ENABLED: 'true', CREATOR_USER_ID: CREATOR };
const env = (over: Record<string, string> = {}) => (k: string) => ({ ...ENV, ...over })[k];
const req = (token: string | null, body: unknown = { message_id: MID }) =>
  new Request('http://x/ai-chat', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) });

async function run(opts: { token?: string | null; msg?: Partial<Msg>; counts?: Record<string, number>; replies?: string[]; envOver?: Record<string, string> }) {
  const { store, inserted } = mockStore(opts.msg, opts.counts);
  const p = mockProvider(opts.replies ?? ['The GRID is calm and holding.']);
  const res = await handle(req(opts.token === undefined ? 'good' : opts.token), { env: env(opts.envOver), store, provider: p.make, personas: PERSONAS, now: () => NOW });
  return { res, body: await res.json(), inserted, calls: p.calls };
}

Deno.test('kill switch: off by default, nothing posted, no model call', async () => {
  const r = await run({ envOver: { AI_REPLIES_ENABLED: '' } });
  assertEquals(r.body.status, 'disabled'); assertEquals(r.inserted.length, 0); assertEquals(r.calls.length, 0);
});
Deno.test('sign-in required', async () => {
  assertEquals((await run({ token: null })).res.status, 401);
  assertEquals((await run({ token: 'forged' })).res.status, 401);
});
Deno.test('only your own, fresh, human message in neon-vigil', async () => {
  assertEquals((await run({ msg: { user_id: 'someone-else' } })).res.status, 404);
  assertEquals((await run({ msg: { is_ai: true } })).res.status, 404);
  assertEquals((await run({ msg: { room_id: 'other' } })).res.status, 404);
  assertEquals((await run({ msg: { created_at: '2026-10-25T23:00:00Z' } })).body.status, 'too_old');
});
Deno.test('no mention: nobody answers', async () => {
  const r = await run({ msg: { body: 'hexa is cool' } });
  assertEquals(r.body.status, 'no_mention'); assertEquals(r.inserted.length, 0);
});
Deno.test('router: first mention wins, one responder, look-alikes count', () => {
  assertEquals(firstMention('@Cyphr and @Hexa, hello'), 'cyphr');
  assertEquals(firstMention('@hexa then @cyphr'), 'hexa');
  assertEquals(firstMention('@Hexa Sigil hi'), 'hexa');
  assertEquals(firstMention('@Ｃｙｐｈｒ hi'), 'cyphr');
  assertEquals(firstMention('@Неха hi'), 'hexa');
  assertEquals(firstMention('email me at hexa@site'), null);
});
Deno.test('both mentioned: exactly one reply, from the first named', async () => {
  const r = await run({ msg: { body: '@Cyphr @Hexa what happened to the ship?' }, replies: ['No record.'] });
  assertEquals(r.inserted.length, 1); assertEquals(r.inserted[0].tag, 'cyphr'); assertEquals(r.inserted[0].reply_to, MID);
});
Deno.test('already replied: no second reply', async () => {
  const r = await run({ counts: { hasReply: 1 } });
  assertEquals(r.body.status, 'already_replied'); assertEquals(r.calls.length, 0);
});
Deno.test('rate limits and daily cap', async () => {
  assertEquals((await run({ counts: { user: 3 } })).body.limit, 'user_minute');
  assertEquals((await run({ counts: { room: 6 } })).body.limit, 'room_minute');
  assertEquals((await run({ counts: { cooldown: 1 } })).body.limit, 'cooldown');
  assertEquals((await run({ counts: { room: 5 }, envOver: { AI_DAILY_CAP: '5', ROOM_PER_MINUTE: '99' } })).body.limit, 'daily_cap');
  assertEquals((await run({ counts: { user: 3 } })).res.status, 429);
});
Deno.test('status questions go to the model', async () => {
  const s = await run({ msg: { body: '@Hexa status?' }, replies: ['The GRID is calm.'] });
  assertEquals(s.inserted[0].body, 'The GRID is calm.'); assertEquals(s.calls.length, 1);
  assertEquals(route('@Cyphr ship status').kind, 'model');
  assertEquals(route('@Hexa sitrep').kind, 'model');
  assertEquals(route("@Hexa what's the status of Xero?").kind, 'model');
});
Deno.test('Praxia-sync questions reach the model like any other; no fixed line (book decides, Jasmine 10-25)', async () => {
  const p = await run({ msg: { body: '@Hexa can I sync with Praxia?' }, replies: ['I can only watch her and say what I see.'] });
  assertEquals(p.calls.length, 1);
  assertEquals(p.inserted[0], { tag: 'hexa', body: 'I can only watch her and say what I see.', reply_to: MID });
  assertEquals(route('@cyphr how do I sync to praxia').kind, 'model');
  assertEquals(route('@cyphr how do I sync to praxia'), { kind: 'model', tag: 'cyphr' });
});
Deno.test('model never posts boot lines or the retired status line', async () => {
  const r = await run({ replies: ['Hexa Sigil Online. GRID OK | IKG VIEWPORT | DEEP TIME 5150 The GRID is calm. Locked.'] });
  assertEquals(r.inserted[0].body, 'The GRID is calm.');
});
Deno.test('retired status line (Jasmine 10-25): stripped from replies and from persona prompts', async () => {
  const r = await run({ replies: ['grid ok | iww viewport | deep time 5150 | QUEEN: PRAXIA Seals holding.'] });
  assertEquals(r.inserted[0].body, 'Seals holding.');
  const c = cleanReply('GRID OK IKG VIEWPORT DEEP TIME 5150', 'cyphr', false);
  assertEquals(c.ok, false);
  assertEquals(sanitizePrompt('A.\n- If you ever show a status line, write it exactly: GRID OK | IKG VIEWPORT | DEEP TIME 5150\nB.'), 'A.\nB.');
});
Deno.test('banned words: one retry, then silence', async () => {
  const retry = await run({ replies: ['The captain says hi.', 'Neon says hi.'] });
  assertEquals(retry.calls.length, 2); assertEquals(retry.inserted[0].body, 'Neon says hi.');
  assertMatch(retry.calls[1].system, /REMINDER/);
  const silent = await run({ replies: ['Ghost fauna drift.', 'A lattice of light.'] });
  assertEquals(silent.body.status, 'filtered'); assertEquals(silent.inserted.length, 0);
});
Deno.test('banned list covers every word, with spacing and hyphen variants', () => {
  for (const w of BANNED) assert(bannedHits(`x ${w} y`).length > 0, w);
  assertEquals(bannedHits('song bond, Low grav anime flow, SKY-CITIES, Queens').length, 4);
  assertEquals(bannedHits('Spirit fauna, no mouth, a hexagon').length, 0);
});
Deno.test('dashes stripped', () => {
  assertEquals(stripDashes('Calm \u2014 steady \u2013 holding - fine.'), 'Calm, steady, holding, fine.');
  assertEquals(stripDashes('VAL-18 stays.'), 'VAL-18 stays.');
});
Deno.test('not on record: exact canon decline per character', async () => {
  assertEquals((await run({ replies: ['not on record'] })).inserted[0].body, 'Not on record.');
  assertEquals((await run({ msg: { body: '@Cyphr who built the moon?' }, replies: ['No record'] })).inserted[0].body, 'No record.');
  assertEquals((await run({ replies: ['   '] })).inserted[0].body, 'Not on record.');
});
Deno.test('Hexa signs off "Further Directives, User?" only to the creator', async () => {
  const c = await run({ token: 'creator', msg: { user_id: CREATOR }, replies: ['The GRID is calm.'] });
  assertEquals(c.inserted[0].body, 'The GRID is calm. Further Directives, User?');
  const p = await run({ replies: ['The GRID is calm. Further Directives, User?'] });
  assertEquals(p.inserted[0].body, 'The GRID is calm.');
  const cy = cleanReply('Seals holding. Further Directives, User?', 'cyphr', true);
  assertEquals(cy.ok && cy.text, 'Seals holding.');
});
Deno.test('prompt: persona, grounding, untrusted chat wrapping', async () => {
  const r = await run({});
  assertMatch(r.calls[0].system, /You are Hexa Sigil/);
  assertMatch(r.calls[0].system, /reply exactly: Not on record\./);
  assertMatch(r.calls[0].user, /<message>\n@Hexa what is the GRID\?\n<\/message>/);
  assertMatch(r.calls[0].user, /the player "Moth Rider"/);
});
Deno.test('personas: Hexa canon, no held Queries or fixed lines in prompts', () => {
  const h = PERSONAS.hexa, c = PERSONAS.cyphr;
  for (const s of [h, c]) {
    assertNotMatch(s, /\[QUERY|\(PROPOSED|GRID OK|IKG VIEWPORT|DEEP TIME|ship status line/i);
    assertEquals(bannedHits(s).length, 0, `banned in persona: ${bannedHits(s)}`);
  }
  assertMatch(h, /he\/they/); assertMatch(h, /data glass/); assertMatch(h, /holographic silhouette/);
  assertMatch(h, /no mouth/); assertMatch(h, /Further Directives, User\?/);
  assertMatch(h, /Never say "Hexa Sigil Online\." and never answer "Locked\."/);
  assertMatch(c, /You are Cyphr/);
  for (const s of [h, c]) assertMatch(s, /Praxia's lines come from the book; don't quote fixed lines for her\./);
});
Deno.test('personas.generated.ts matches personas/*.md', async () => {
  for (const tag of ['hexa', 'cyphr'] as const) {
    const md = await Deno.readTextFile(new URL(`./personas/${tag}.md`, import.meta.url));
    assertEquals(PERSONAS[tag], extractPrompt(md), `${tag}: run build-personas.ts`);
  }
});
Deno.test('providers: xai default (grok-4.3), gemini switchable, keys only from env, request shape', async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    const body = url.includes('x.ai')
      ? { choices: [{ message: { content: 'xai says hi' } }] }
      : { candidates: [{ content: { parts: [{ text: 'gemini ' }, { text: 'says hi' }] } }] };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  const x = makeProvider((k) => ({ XAI_API_KEY: 'test-key-x' } as Record<string, string>)[k], fake);
  assertEquals([x.name, x.model], ['xai', 'grok-4.3']); assertEquals(DEFAULTS.provider, 'xai');
  assertEquals(await x.complete({ system: 's', user: 'u' }), 'xai says hi');
  assertEquals(seen[0].url, 'https://api.x.ai/v1/chat/completions');
  assertEquals(JSON.parse(String(seen[0].init.body)).model, 'grok-4.3');
  const g = makeProvider((k) => ({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key-g' } as Record<string, string>)[k], fake);
  assertEquals([g.name, g.model], ['gemini', 'gemini-3.8-flash']);
  assertEquals(await g.complete({ system: 's', user: 'u' }), 'gemini says hi');
  assertMatch(seen[1].url, /models\/gemini-3\.8-flash:generateContent$/);
  assertEquals((seen[1].init.headers as Record<string, string>)['x-goog-api-key'], 'test-key-g');
  let threw = false; try { makeProvider(() => undefined, fake); } catch { threw = true; } assert(threw, 'missing key must throw');
});
Deno.test('missing model key: clear error, nothing posted', async () => {
  const { store, inserted } = mockStore();
  const res = await handle(req('good'), { env: env(), store, provider: () => makeProvider(env()), personas: PERSONAS, now: () => NOW });
  assertEquals((await res.json()).status, 'model_not_configured'); assertEquals(inserted.length, 0);
});
