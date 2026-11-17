/* main.js — page wiring: hero tower and section visualizations. The game lives in play.js. */
import * as E from './engine.js?v=202611170128';
import { Tower } from './scene.js?v=202611170128';
import * as V from './viz.js?v=202611170128';
import { initPlay, openPlay } from './play.js?v=202611170128';
import { RULES_HTML, RULES_ADV_HTML } from './rules.js?v=202611170128';
import { THEORY_HTML } from './theory.js?v=202611170128';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const coarse = matchMedia('(pointer: coarse)').matches;
const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined ? window.Telegram.WebApp : null;

/* ================= Telegram Mini App ================= */
if (tg) {
  try {
    tg.ready(); tg.expand();
    tg.setHeaderColor && tg.setHeaderColor('#050505'); tg.setBackgroundColor && tg.setBackgroundColor('#050505');
    tg.disableVerticalSwipes && tg.disableVerticalSwipes(); // rotating the tower must not close the app
  } catch (e) { /* older clients */ }
  // desktop Telegram opens mini apps in a small window: ask for full screen there (Bot API 8.0+)
  try {
    if (['tdesktop', 'macos', 'web', 'weba', 'webk'].includes(tg.platform) && tg.requestFullscreen
        && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0')) tg.requestFullscreen();
  } catch (e) { /* not supported */ }
  // in full screen Telegram draws its own buttons over the top edge: keep our bars below them
  const inset = () => {
    const a = (tg.isFullscreen && tg.safeAreaInset) ? tg.safeAreaInset.top || 0 : 0;
    const b = (tg.isFullscreen && tg.contentSafeAreaInset) ? tg.contentSafeAreaInset.top || 0 : 0;
    document.documentElement.style.setProperty('--tg-top', (a + b) + 'px');
  };
  try { inset(); ['fullscreenChanged', 'safeAreaChanged', 'contentSafeAreaChanged'].forEach((ev) => tg.onEvent(ev, inset)); } catch (e) { /* older clients */ }
}

/* ================= hero ================= */
const hero = new Tower($('#heroCanvas'), { interactive: false, autoRotate: true, offsetX: 0.2 });
hero.sync(new E.Game(), { dropIn: true });
hero.intro();
if (coarse) { hero.controls.enabled = false; hero.renderer.domElement.style.touchAction = 'pan-y'; }
$$('#heroLayouts button').forEach((b) => b.addEventListener('click', () => {
  $$('#heroLayouts button').forEach((x) => x.classList.toggle('on', x === b));
  hero.applyLayout(b.dataset.layout); hero.resetView();
}));
let heroVisible = true, playOpen = false;
const heroLoop = () => hero.renderer.setAnimationLoop(heroVisible && !playOpen ? () => hero.frame() : null);
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; heroLoop(); }).observe($('#top'));

$$('[data-count]').forEach((el) => {
  const to = +el.dataset.count, t0 = performance.now() + 600;
  const step = (now) => { const k = Math.min(1, Math.max(0, (now - t0) / 1400)); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
});

/* ================= sections ================= */
$('#rulesBox').innerHTML = RULES_HTML;
$('#theoryBox').innerHTML = THEORY_HTML;
$('#rulesAdvBox').innerHTML = RULES_ADV_HTML;
V.tree($('#vizTree'), (b) => {
  scrollTo({ top: 0, behavior: 'smooth' });
  hero.controls.autoRotate = false; hero.focusBoard(b, 1200);
  clearTimeout(hero._resume); hero._resume = setTimeout(() => { hero.controls.autoRotate = true; hero.resetView(1500); }, 7000);
});
const reach = V.reachChart($('#vizReach'));
V.wheel($('#vizWheel'), (c) => reach.setCombo(c)).select(3);
V.setup($('#vizSetup'));
V.goal($('#vizGoal'));
V.miraClock($('#vizClock'));
V.capture($('#vizCapture'));
V.jung($('#vizJung'));
V.tarot($('#vizTarot'));
V.aeons($('#vizAeon'));
V.advanced($('#vizAdvanced'));

$$('.sec-head, .frame').forEach((el) => el.classList.add('reveal'));
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
$$('.reveal').forEach((el) => io.observe(el));

let lastY = 0;
addEventListener('scroll', () => {
  const y = scrollY; $('#topnav').classList.toggle('hide', y > lastY && y > 200); lastY = y;
  let cur = null; $$('.sec[id]').forEach((s) => { if (s.getBoundingClientRect().top < innerHeight * 0.4) cur = s.id; });
  $$('.navlinks a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + cur));
}, { passive: true });

/* ================= play ================= */
initPlay({
  tg,
  onOpen() { playOpen = true; heroLoop(); },
  onClose() { playOpen = false; heroLoop(); },
});
$$('[data-play]').forEach((b) => b.addEventListener('click', () => openPlay(b.dataset.play || null)));
window.__sg = Object.assign(window.__sg || {}, { hero });

// channel links: inside Telegram open them natively (no browser), elsewhere a normal new tab / external app
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a.tg-link');
  if (!a || !tg || !tg.openTelegramLink) return;
  e.preventDefault();
  tg.openTelegramLink(a.href);
});

// deep link: #play / #work / #model, or Telegram startapp=play|work|model
const start = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || location.hash.slice(1);
if (['play', 'work', 'model', 'adv'].includes(start)) openPlay(start === 'play' ? null : start);
