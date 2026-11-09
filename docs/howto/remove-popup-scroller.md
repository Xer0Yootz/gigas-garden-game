# Remove the title-popup scrolling ticker

## 1. What changed and why

1. Jasmine asked to remove the scrolling text under the Gigas Garden boot popup (the card that says NEON VIGIL // GIGAS GARDEN and asks you to tap the Hexa Sigil).
2. That scroller was a second copy of the ONLINE | date | weather ticker, sitting inside the title popup. The main top-bar ticker (the one dialogue sits under) is unchanged and stays.
3. Dead CSS for that popup-only scroller (`.title-ticker`) was removed too. Shared ticker CSS and JS still power the top bar.

## 2. Files

1. `web/public/gigas-garden/index.html`: removed the `<div class="… title-ticker" data-ticker>` under the popup title, removed the `.title-ticker` CSS rule, and narrowed the ticker comment to "HUD top bar".
2. `docs/howto/remove-popup-scroller.md`: this guide.

## 3. How to check it

1. Wait until this pull request is merged. The live game is served from the `gh-pages` branch (GitHub Pages at `https://xer0yootz.github.io/neon-vigil-oauth/gigas-garden/`, also framed inside `https://neonvigil.app/gigas-garden/`). It only updates after a publish step with Jasmine's word — merge alone does not change the live page.
2. On desktop: open the game (direct GitHub Pages URL or neonvigil.app/gigas-garden/). The boot popup still shows the title, the short blurb, "Hexa Sigil Online.", and the sigil. There is no scrolling ONLINE line under the title. The top-bar ticker still scrolls ONLINE | date | weather.
3. On your phone: same check in Safari or Chrome. Tap the sigil; the popup closes and the top ticker keeps running.
4. Optional: on GitHub, open `web/public/gigas-garden/index.html` on main and search for `title-ticker`. Nothing should be found. Searching `data-ticker` should still find the top-bar ticker and the JS that fills it.

## 4. How to undo it

1. Open this pull request on GitHub.
2. Click the "Revert" button near the bottom of the page.
3. GitHub makes a new pull request that puts the popup scroller back. Merge that one, then publish to `gh-pages` the same way as usual (only with Jasmine's word). Never force-push.
