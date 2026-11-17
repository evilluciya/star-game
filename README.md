# Star Game 3D (version 2)

Static web app (no build step): the seven boards in real 3D (Three.js) + an illustrated guide.
Opens in a browser and as a Telegram Mini App. The old web app in `../STAR_GAME/` is untouched.

## What is inside
- **Hero**: the spiral tower assembles itself, pieces drop in; layouts: spiral / stack / row.
- **Sections I–IX** (visual, interactive SVG): Tree of spheres, wheel of nine phases + move-reach chart,
  start position (fig. 2–3), goal (fig. 4) + "Mira clock" (3-move limit, note 9), capture from Naos,
  Jung 3×3, Tarot / alchemy, aeons timeline, the Advanced game board (geometry from the booklet figure).
- **Play** (full screen): rotate / zoom / pan, focus a board, spread the boards, top view;
  modes vs computer / two players on one device / solo; move highlighting on/off;
  settings: pattern (colour only / exact phases), 3-move Mira limit, capture on Mira,
  w(w)-on-Naos limit variation; undo; animated moves.

## Rules
`js/engine.js` — same rules as the v1 bot engine (`../STAR_GAME/telegram_bot/star_engine.py`),
checked against *The Sinister Tradition* pp. 239–245 (NAOS text) and the booklet figures:
- start phases per square as in fig. 2/3; Mira empty;
- goal fig. 4: white = top triangle of Mira, black = bottom triangle; first to complete wins;
- 3-move limit on Mira (arrival = 1st move; after a move across Mira two more moves);
- capture only by w(w) on Naos, opposite colour, any board except Naos; w(w) → a(a).
Not playable (described only): the Advanced Star Game (4 levels, null squares, 45 pieces, D10).

## Files
`index.html`, `css/style.css`, `js/engine.js` (rules + AI), `js/scene.js` (3D),
`js/viz.js` (section visualizations), `js/main.js` (page + game UI), `tests/check_page.py`
(headless Playwright check: console errors, screenshots, a game through `window.__sg`).

## Run / check
- Local: any static server, e.g. `python3 -m http.server` in this folder, open `index.html`.
- Check (on test VM .96): `bash tests/run_bg.sh`, then `cat tests/last.log`, screenshots in `tests/shots/`.
- Deep link straight into the game: `index.html#play` (Telegram: `startapp=play`).

## Android app (StarGame3D.apk)
- `android/`: WebView wrapper (`MainActivity.java`), the site is packed into assets with three.js and fonts
  vendored (`tools/make_www.py`) and served from https://appassets.androidplatform.net/ — works offline.
- Build on VM .96: `bash android/build_bg.sh` → `android/build.log` → `StarGame3D.apk` in this folder.
  No Gradle: aapt2 + javac + d8 + apksigner; JDK 17 + SDK 34 live in `~/android-tools` on the VM.
- Signing key: `android/release.jks` + `android/release.pass` (keep them: updates must use the same key;
  never published — `tools/publish.py` only uploads the site files).
- Package `com.stern.stargame3d` (separate from the old app). Back button closes the board, then the app.
- Offline check: `tests/offline_check.sh` (serves the APK bundle with all external requests blocked).

## Telegram Mini App
- Site: https://evilluciya.github.io/star-game/ (GitHub Pages, repo `evilluciya/star-game`).
  Update: on VM .96 `python3 tools/publish.py publish` (token = GITHUB_TOKEN in the bot `.env`).
- Mini App: https://t.me/STAR_GAME_GAD_BOT/stargame (straight to the board: `?startapp=play`).
- The bot shows a "3D" button in its menu and as the chat menu button (WEBAPP_URL in the bot `.env`).
