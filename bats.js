// bats.js: five little pixel bats hang from the nav and sway. Click one and a silent wave spreads out
// from it: each bat drops off and flies away in its own random direction the moment the wave reaches it,
// and the nav words give a tiny hop as it passes. About 30 seconds later they build themselves back,
// pixel by pixel, on new random nav words. They only ever hang from a word, never from the empty gaps.
(function () {
  const COUNT = 5;
  const PX    = 2.5;    // size of one sprite pixel
  const PX_PHONE = 2;   // ...on phones, where the bats are a little smaller
  const PHONE = 500;    // screens this wide or narrower count as phones (same breakpoint as style.css)
  const WAVE  = 380;    // how fast the wave spreads, px per second
  const HOP   = 2;      // how far the nav words hop as the wave passes, px
  const SWAY  = 5;      // degrees each bat swings while hanging

  // comeback: 'fade' | 'fly' | 'onebyone' | 'pixels' | 'static'. A page can override these with window.BATS_CONFIG.
  const DEFAULTS = { returnAfter: 30, comeback: 'pixels' };
  const cfg = () => Object.assign({}, DEFAULTS, window.BATS_CONFIG);

  // '#' is a pixel. The hanging frame is drawn right side up and flipped, so it hangs from the nav.
  const HANG = [
    '#...#',
    '#...#',
    '##.##',
    '#####',
    '.###.',
    '#####',
    '#####',
    '#####',
    '#####',
    '#####',
    '.###.',
    '.###.'];
  const UP = [
    '#.................#',
    '##...............##',
    '###.....#.#.....###',
    '####....###....####',
    '#####..#####..#####',
    '###################',
    '###################',
    '.#####.#####.#####.',
    '..###...###...###..',
    '........###........',
    '.........#.........'];
  const DOWN = [
    '...................',
    '........#.#........',
    '........###........',
    '......#######......',
    '...#############...',
    '.#################.',
    '###################',
    '###################',
    '##.####.###.####.##',
    '#...##...#...##...#'];
  const HANG_CELLS = [];                 // every pixel of the hanging bat, for the pixel-by-pixel comeback
  HANG.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') HANG_CELLS.push([r, c]); }));

  const DPR = Math.min(3, window.devicePixelRatio || 1);
  // one sprite pixel in screen pixels (CELL) and in CSS pixels (UNIT), snapped so the pixels stay crisp
  let CELL, UNIT, BAT_W, phone;
  function setScale() {
    phone = innerWidth <= PHONE;
    CELL = Math.max(1, Math.round((phone ? PX_PHONE : PX) * DPR - 0.01));
    UNIT = CELL / DPR;
    BAT_W = HANG[0].length * UNIT;
    for (const b of bats) {
      b.cv._key = null;                      // redraw at the new size
      b.el.style.padding = phone ? '12px' : '6px';
      b.el.style.margin = phone ? '-12px' : '-6px';
    }
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let nav, layer, words = [], bats = [], fg = '#000';
  let state = 'hang', t0 = 0, cx = 0, cy = 0, running = false;

  // Normally the bats use the whole window. A [data-bats-stage] box (the lab preview) keeps them inside it.
  let stage = null;
  const origin = () => stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };
  const bounds = () => stage ? { w: stage.clientWidth, h: stage.clientHeight } : { w: innerWidth, h: innerHeight };

  // Tells the lab preview what the bats are doing.
  function setState(s, extra) {
    state = s;
    window.dispatchEvent(new CustomEvent('bats', { detail: Object.assign({ state: s }, extra) }));
  }

  // ── drawing ──
  function size(cv, rows) {
    const w = rows[0].length * UNIT, h = rows.length * UNIT;
    if (cv._w !== w || cv._h !== h) {
      cv.width = rows[0].length * CELL; cv.height = rows.length * CELL;
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      cv._w = w; cv._h = h;
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(CELL, 0, 0, CELL, 0, 0);
    ctx.clearRect(0, 0, rows[0].length, rows.length);
    ctx.fillStyle = fg;
    return ctx;
  }

  // A whole frame, only redrawn when something changed.
  function draw(cv, rows, flip) {
    const key = (rows === HANG ? 'h' : rows === UP ? 'u' : 'd') + fg;
    if (cv._key === key) return;
    cv._key = key;
    const ctx = size(cv, rows);
    rows.forEach((_, r) => {
      const row = rows[flip ? rows.length - 1 - r : r];
      for (let c = 0; c < row.length; c++) if (row[c] === '#') ctx.fillRect(c, r, 1, 1);
    });
  }

  // The hanging bat with only some of its pixels, or with static around it, for the comebacks.
  function drawPartial(cv, cells, noise) {
    cv._key = null;
    const ctx = size(cv, HANG), h = HANG.length;
    for (const [r, c] of cells) ctx.fillRect(c, h - 1 - r, 1, 1);
    if (noise) for (let r = 0; r < h; r++) for (let c = 0; c < HANG[0].length; c++)
      if (Math.random() < noise) ctx.fillRect(c, r, 1, 1);
  }

  // ── where the bats hang ──
  // Each bat grips one nav word (or the b&w button): its spot is which word, and how far along it.
  function home(spot) {
    const q = words[spot.w].el.getBoundingClientRect(), o = origin();
    const room = Math.max(0, q.width / 2 - BAT_W / 2);         // keep the whole bat under the word
    return { x: q.left - o.left + q.width / 2 + spot.f * room, y: q.bottom - o.top - 1 };
  }

  // Random words, a random point along each, and never two bats touching.
  function newSpots() {
    let spots;
    for (let tries = 0; tries < 400; tries++) {
      const pick = words.map((_, i) => i).sort(() => Math.random() - 0.5);
      spots = Array.from({ length: COUNT }, (_, i) => ({ w: pick[i % pick.length], f: rand(-0.85, 0.85) }));
      const xs = spots.map(sp => home(sp).x).sort((a, b) => a - b);
      if (xs.every((x, i) => i === 0 || x - xs[i - 1] > BAT_W + 4)) break;
    }
    return spots;
  }

  function hangAt(b, t) {
    const h = home(b.spot);
    b.x = h.x;
    b.y = h.y;
    const rot = calm ? 0 : Math.sin(t * 1.6 + b.ph) * SWAY;
    b.el.style.transformOrigin = `50% ${phone ? 12 : 6}px`;
    b.el.style.transform = `translate(${b.x - BAT_W / 2}px, ${b.y}px) rotate(${rot}deg)`;
  }

  // ── flying away ──
  // Each bat gets its own random heading across the whole downward half-circle (one per slice so no two
  // go the same way), dealt out at random, so a bat on the left is just as likely to cut across to the right.
  function launch(clicked) {
    if (state !== 'hang') return;
    setState('fly');
    t0 = performance.now() / 1000;
    cx = clicked.x; cy = clicked.y + clicked.cv._h / 2;

    const n = bats.length;
    const heads = Array.from({ length: n }, (_, k) => 12 + (k + rand(0.1, 0.9)) / n * 156).sort(() => Math.random() - 0.5);
    bats.forEach((b, k) => { b.head = heads[k] * Math.PI / 180; });

    for (const b of bats) {
      b.delay = Math.hypot(b.x - cx, b.y - cy) / WAVE;
      b.flying = false;
      b.done = false;
    }
    const o = origin();
    words.forEach(w => {
      const q = w.el.getBoundingClientRect();
      w.delay = Math.abs(q.left - o.left + q.width / 2 - cx) / WAVE;
    });
    run();
  }

  function flyStep(b, dt) {
    if (!b.flying) {
      b.flying = true;
      b.lt = 0;
      b.y += b.cv._h / 2;
      b.v = rand(190, 340);
      b.turn = rand(-0.3, 0.3);                // a slight curve, small enough that paths never bend into each other
      b.el.style.pointerEvents = 'none';
    }
    b.lt += dt;
    b.v *= 1 + dt * 0.6;
    b.head += b.turn * dt;
    const x0 = b.x;
    b.x += (Math.cos(b.head) * b.v + Math.cos(b.lt * 12 + b.ph) * 25) * dt;
    b.y += (Math.sin(b.head) * b.v + Math.sin(b.lt * 15 + b.ph) * 20) * dt;
    flapAt(b, b.x, b.y, (b.x - x0) / Math.max(dt, 0.001), b.lt);

    const m = 60, { w, h } = bounds();
    if (b.x < -m || b.x > w + m || b.y < -m || b.y > h + m) {
      b.done = true;
      b.el.style.visibility = 'hidden';
    }
  }

  function flapAt(b, x, y, vx, lt) {
    draw(b.cv, Math.floor((lt + b.ph) * 30) % 2 ? DOWN : UP, false);
    const tilt = Math.max(-25, Math.min(25, vx * 0.06));
    b.el.style.transformOrigin = '50% 50%';
    b.el.style.transform = `translate(${x - b.cv._w / 2}px, ${y - b.cv._h / 2}px) rotate(${tilt}deg)`;
  }

  // ── coming back ──
  function comeBack() {
    const mode = calm ? 'fade' : cfg().comeback;
    const spots = newSpots();
    const { w, h } = bounds();
    const order = bats.map((_, i) => i).sort(() => Math.random() - 0.5);
    bats.forEach((b, i) => {
      b.spot = spots[i];
      b.mode = mode;
      b.back = false;
      b.el.style.visibility = 'visible';
      b.el.style.opacity = 0;
      b.el.style.pointerEvents = 'none';
      if (mode === 'fly' || mode === 'onebyone') {
        // fly in from a random edge on a curved path and land on the nav
        const edge = Math.floor(rand(0, 3));
        b.p0 = edge === 0 ? [-40, rand(0.3, 0.95) * h] : edge === 1 ? [w + 40, rand(0.3, 0.95) * h] : [rand(0, w), h + 40];
        b.bend = [rand(-160, 160), rand(-120, 60)];
        b.rdelay = mode === 'onebyone' ? order[i] * 0.6 : rand(0, 0.5);
        b.rdur = mode === 'onebyone' ? 1.3 : rand(1.3, 1.9);
      } else {
        b.rdelay = rand(0, 0.5);
        b.rdur = mode === 'fade' ? 0.9 : 1;
        b.cells = HANG_CELLS.slice().sort(() => Math.random() - 0.5);
      }
    });
    t0 = performance.now() / 1000;
    setState('return');
    run();
  }

  function returnStep(b, t, lt) {
    const rt = lt - b.rdelay;
    if (rt < 0) return true;
    const k = clamp01(rt / b.rdur);

    if (b.mode === 'fly' || b.mode === 'onebyone') {
      if (k < 1) {
        const h = home(b.spot), hx = h.x, hy = h.y + HANG.length * UNIT / 2;
        const e = 1 - Math.pow(1 - k, 3);                   // slow down to land
        const mx = (b.p0[0] + hx) / 2 + b.bend[0], my = (b.p0[1] + hy) / 2 + b.bend[1];
        const at = s => [(1 - s) * (1 - s) * b.p0[0] + 2 * (1 - s) * s * mx + s * s * hx,
                         (1 - s) * (1 - s) * b.p0[1] + 2 * (1 - s) * s * my + s * s * hy];
        const [x, y] = at(e), [x2] = at(Math.min(1, e + 0.02));
        b.el.style.opacity = 1;
        flapAt(b, x, y, (x2 - x) * 30, rt);
        return true;
      }
      draw(b.cv, HANG, true);
    } else if (b.mode === 'fade') {
      draw(b.cv, HANG, true);
      b.el.style.opacity = k;
    } else if (b.mode === 'pixels') {
      b.el.style.opacity = 1;
      if (k < 1) drawPartial(b.cv, b.cells.slice(0, Math.ceil(k * b.cells.length)), 0);
      else draw(b.cv, HANG, true);
    } else if (b.mode === 'static') {
      b.el.style.opacity = 1;
      if (k < 1) drawPartial(b.cv, b.cells.filter(() => Math.random() < 0.25 + k * 0.75), (1 - k) * 0.35);
      else draw(b.cv, HANG, true);
    }
    hangAt(b, t);
    if (k < 1) return true;
    b.el.style.opacity = 1;
    b.back = true;
    return false;
  }

  // ── the loop ──
  function run() {
    if (running) return;
    running = true;
    loop.last = performance.now();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    const t = now / 1000, dt = Math.min(0.05, (now - loop.last) / 1000);
    loop.last = now;
    fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#000';
    const lt = t - t0;
    let busy = state === 'hang';

    for (const b of bats) {
      if (state === 'hang' || (state === 'fly' && lt < b.delay)) {
        draw(b.cv, HANG, true);
        hangAt(b, t);
        if (state === 'fly') busy = true;
      } else if (state === 'fly' && !b.done) {
        flyStep(b, dt);
        if (!b.done) busy = true;
      } else if (state === 'return' && !b.back) {
        if (returnStep(b, t, lt)) busy = true;
      } else if (state === 'return') {
        hangAt(b, t);
      }
    }

    // the tiny hop in the nav words as the wave passes under them
    if (state === 'fly') {
      for (const w of words) {
        const k = (lt - w.delay) / 0.32;
        w.el.style.transform = k > 0 && k < 1 ? `translateY(${-Math.sin(k * Math.PI) * HOP}px)` : '';
        if (k < 1) busy = true;
      }
    }

    if (state === 'return' && !busy) {
      bats.forEach(b => { b.el.style.pointerEvents = 'auto'; });
      setState('hang');
      busy = true;
    }
    if (state === 'fly' && !busy) {
      // all gone: come back in a bit
      const after = cfg().returnAfter;
      setState('away', { backAt: Date.now() + after * 1000 });
      setTimeout(comeBack, after * 1000);
    }

    if (busy) requestAnimationFrame(loop);
    else running = false;
  }

  function start() {
    stage = document.querySelector('[data-bats-stage]');
    nav = (stage || document).querySelector('nav');
    if (!nav) return;
    words = [...nav.querySelectorAll('a, button')].map(el => ({ el, delay: 0 }));

    layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    Object.assign(layer.style, { position: stage ? 'absolute' : 'fixed', inset: '0', pointerEvents: 'none', zIndex: 6, overflow: 'hidden' });
    (stage || document.body).appendChild(layer);

    setScale();
    const spots = newSpots();
    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement('div');
      Object.assign(el.style, {
        position: 'absolute', left: 0, top: 0,
        cursor: 'pointer', pointerEvents: 'auto', willChange: 'transform'
      });
      const cv = document.createElement('canvas');
      cv.style.display = 'block';
      el.appendChild(cv);
      layer.appendChild(el);
      const b = { el, cv, spot: spots[i], ph: rand(0, 6.28) };
      el.addEventListener('click', e => { e.preventDefault(); launch(b); });
      bats.push(b);
    }
    setScale();                          // padding: a bigger tap target without moving the sprite, bigger on phones
    addEventListener('resize', setScale);
    run();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
