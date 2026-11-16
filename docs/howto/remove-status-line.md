# Remove the GRID OK status line

## 1. What changed and why

1. Jasmine asked on 10-25 to take out "GRID OK | IKG VIEWPORT | DEEP TIME 5150" completely.
2. The IKG desktop page (`IKGDesktop.jsx`) had "GRID OK | IKG VIEWPORT | DEEP TIME 5150 | QUEEN: PRAXIA" in its grey bottom taskbar, next to the Start button. That text is gone. The Start button and the player name on the right stay where they were. Note: this page is not linked into the site right now (no route opens it), so players never saw it. It was removed so it can't come back if the page is turned on later.
3. The game file had "(DEEP TIME 5150)" in a code comment at the top. Players never saw it, but it is gone too.
4. Nothing else changed. The game's ONLINE | date | weather bar at the top is untouched, and other "5150" uses (Earth 5150, the 5150 app name, the score) are untouched.
5. The chat AI side (Hexa and Cyphr no longer posting or mentioning this line) is in PR #7, on its own branch.

## 2. Files

1. `web/src/pages/IKGDesktop.jsx`: removed the status text from the bottom taskbar.
2. `web/public/gigas-garden/index.html`: removed "(DEEP TIME 5150)" from the header comment.
3. `docs/howto/remove-status-line.md`: this guide.

## 3. How to check it

1. Wait until this pull request is merged and the site is published.
2. On desktop: open the site and sign in. The hub, chat and game pages look exactly as before, because the removed text sat on a page that isn't linked in yet.
3. On desktop, optional: on GitHub, open `web/src/pages/IKGDesktop.jsx` on main and press Ctrl+F (Cmd+F on a Mac) for "GRID OK". Nothing should be found. Do the same in `web/public/gigas-garden/index.html` for "DEEP TIME".
4. On your phone: open the site in Safari and open Gigas Garden. The ONLINE bar at the top should look the same as before, with no GRID OK text anywhere.

## 4. How to undo it

1. Open this pull request on GitHub.
2. Click the "Revert" button near the bottom of the page.
3. GitHub makes a new pull request that puts the line back. Merge that one, then publish as usual.
