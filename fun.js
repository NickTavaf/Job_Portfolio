// fun.js: click "Fun." to scramble every piece of text on the page into 0s and 1s,
// then reveal it again top to bottom, like the opening animation.
(function () {
  const bit = () => (Math.random() < 0.5 ? '0' : '1');
  const SWEEP = 900;   // ms for the reveal to travel from the top of the page to the bottom
  const EACH  = 600;   // ms for each piece of text to resolve, left to right
  const HOLD  = 250;   // ms of full scramble before anything resolves
  let running = false;

  function textNodes() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: n =>
        n.parentElement && !n.parentElement.closest('script, style') && n.nodeValue.trim()
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const list = [];
    while (walker.nextNode()) list.push(walker.currentNode);
    return list;
  }

  // The real words, even if a hover or the opening animation is mid-scramble.
  // Letter spans keep theirs in data-char, words in data-final.
  function realText(node) {
    const el = node.parentElement;
    if (el.dataset.char !== undefined) return el.dataset.char;
    if (el.dataset.final !== undefined && el.children.length === 0) return el.dataset.final;
    return node.nodeValue;
  }

  function scramble(e) {
    if (e) e.preventDefault();
    if (running) return;
    running = true;

    const nodes = textNodes();
    const items = nodes.map((node, i) => ({
      node,
      original: realText(node),
      delay: HOLD + (i / Math.max(1, nodes.length - 1)) * SWEEP
    }));
    const end = HOLD + SWEEP + EACH;
    pixelateMedia(end);
    const start = performance.now();

    const timer = setInterval(() => {
      const t = performance.now() - start;
      if (t >= end) {
        clearInterval(timer);
        items.forEach(x => { x.node.nodeValue = x.original; });
        running = false;
        return;
      }
      items.forEach(x => {
        const k = Math.min(1, Math.max(0, (t - x.delay) / EACH));
        const cut = Math.floor(k * x.original.length);
        x.node.nodeValue = x.original.slice(0, cut) + x.original.slice(cut).replace(/\S/g, bit);
      });
    }, 60);
  }

  // ---- Pixelate every photo and video on screen, sharpening back in steps ----
  const PIXEL_START = 0.1;   // starting block size = 10% of the photo's width (full strength)
  const PIXEL_STEP  = 90;    // ms between sharpening steps

  // where the picture actually sits inside its box (handles object-fit: cover / contain)
  function sourceRect(el, natW, natH, boxW, boxH) {
    const cs = getComputedStyle(el), fit = cs.objectFit;
    if (fit !== 'cover' && fit !== 'contain') return { sx: 0, sy: 0, sw: natW, sh: natH, dx: 0, dy: 0, dw: boxW, dh: boxH };
    const [px, py] = cs.objectPosition.split(' ').map(v => parseFloat(v) / 100);
    const scale = fit === 'cover' ? Math.max(boxW / natW, boxH / natH) : Math.min(boxW / natW, boxH / natH);
    const vw = natW * scale, vh = natH * scale;
    if (fit === 'cover') {
      const sw = boxW / scale, sh = boxH / scale;
      return { sx: (natW - sw) * (isNaN(px) ? .5 : px), sy: (natH - sh) * (isNaN(py) ? .5 : py), sw, sh, dx: 0, dy: 0, dw: boxW, dh: boxH };
    }
    return { sx: 0, sy: 0, sw: natW, sh: natH, dx: (boxW - vw) * (isNaN(px) ? .5 : px), dy: (boxH - vh) * (isNaN(py) ? .5 : py), dw: vw, dh: vh };
  }

  function pixelateMedia(total) {
    const layers = [];
    document.querySelectorAll('img, video').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > innerHeight) return;   // only what's on screen
      let src = el, natW, natH;
      if (el.tagName === 'IMG') {
        if (!el.complete || !el.naturalWidth) return;
        natW = el.naturalWidth; natH = el.naturalHeight;
      } else if (el.readyState >= 2 && el.videoWidth) {
        natW = el.videoWidth; natH = el.videoHeight;
      } else if (el.poster) {
        src = new Image(); src.src = el.poster; natW = natH = 0;      // video not loaded yet: use its still
      } else return;

      const c = document.createElement('canvas');
      c.width = Math.round(r.width); c.height = Math.round(r.height);
      c.setAttribute('aria-hidden', 'true');
      Object.assign(c.style, {
        position: 'absolute', left: (r.left + scrollX) + 'px', top: (r.top + scrollY) + 'px',
        width: r.width + 'px', height: r.height + 'px', pointerEvents: 'none', zIndex: 5
      });
      document.body.appendChild(c);
      layers.push({ el, src, c, natW, natH });
    });
    if (!layers.length) return;

    const small = document.createElement('canvas'), sctx = small.getContext('2d');
    const t0 = performance.now();
    const draw = () => {
      const t = performance.now() - t0;
      if (t >= total) { layers.forEach(l => l.c.remove()); return; }
      const k = 1 - t / total;                                        // 1 → 0
      layers.forEach(l => {
        const W = l.c.width, H = l.c.height, ctx = l.c.getContext('2d');
        if (!l.natW) { if (!l.src.naturalWidth) return; l.natW = l.src.naturalWidth; l.natH = l.src.naturalHeight; }
        const block = Math.max(1, Math.round(W * PIXEL_START * k));
        const g = sourceRect(l.el, l.natW, l.natH, W, H);
        small.width = Math.max(1, Math.ceil(g.dw / block)); small.height = Math.max(1, Math.ceil(g.dh / block));
        sctx.drawImage(l.src, g.sx, g.sy, g.sw, g.sh, 0, 0, small.width, small.height);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
        if (g.dw < W || g.dh < H) ctx.fillRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, 0, 0, small.width, small.height, g.dx, g.dy, g.dw, g.dh);
      });
      setTimeout(draw, PIXEL_STEP);
    };
    draw();
  }

  document.querySelectorAll('[data-fun]').forEach(el => el.addEventListener('click', scramble));
})();