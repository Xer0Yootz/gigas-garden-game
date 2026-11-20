# Gigas Garden — Neon Vigil

Gigas Garden — Neon Vigil's web game. Three.js: Infinity 6 interior and Gigas Garden levels, live on GitHub Pages. The web app (sign-in, hub, chat) builds from `web/`; sign-in and chat run on Supabase.

The old 5150 Character Auth Express backend was removed on Nov 20, 2026. It is preserved in the hex-os-oauth repo under `legacy-5150/`.

## Web app and GitHub Pages

Flow: sign in, then the hub, which offers **Play Gigas Garden** and **Chat**. `/gigas-garden/` is gated. With no session it redirects to sign-in with `?next=` and returns to the game after sign-in. The game page also gets small icon links back to the hub and to chat (`web/public/auth-gate.js`). The game file loads the gate from a tag near the top of its `<head>`, so a hand copy to gh-pages keeps it.

`VITE_AUTH_MODE` picks how sign-in works:

- `google` (the live build): for static hosting (GitHub Pages). Google Identity Services runs in the browser and needs only the public `VITE_GOOGLE_CLIENT_ID`; no secret is involved. This is a front-door gate for a public site, not access control.
- `mock`: dev only. A fake local session, clearly bannered. Never deploy it.

GitHub Pages: https://xer0yootz.github.io/gigas-garden-game/ is served from the `gh-pages` branch, built by `deploy/build-pages.sh` (base `/neon-vigil-oauth/`, `VITE_AUTH_MODE=google`). `deploy/github-pages-workflow.yml` is the ready Actions version. Move it to `.github/workflows/` with a token that has the `workflow` scope, then switch the Pages source to GitHub Actions.

- Set `GOOGLE_CLIENT_ID` when building (repo variable for the Actions version) (a Google Cloud OAuth client of type "Web application").
- Authorized JavaScript origins: `https://xer0yootz.github.io` and `http://localhost:5173`.
- GIS popup sign-in needs no redirect URI.
- Chat uses the Supabase project "Neon Vigil" (schema in `supabase/migrations`).
- Never put API keys (xAI, Gemini, ElevenLabs) in `web/`; everything there ships to the browser.
