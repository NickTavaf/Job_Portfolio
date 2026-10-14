// project.js: shared by every project page and the bio page
(function () {
  const rc = () => '01'[Math.random() * 2 | 0];
  const root = document.documentElement;

  // b&w toggle — shares the 'darkMode' setting with index.html
  try { root.dataset.theme = localStorage.getItem('darkMode') === 'true' ? 'dark' : 'light'; } catch (e) {}
  document.getElementById('toggleBtn').addEventListener('click', () => {
    const dark = root.dataset.theme === 'dark';
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('darkMode', String(!dark)); } catch (e) {}
  });

  // binary scramble on hover (nav + footer)
  document.querySelectorAll('[data-s]').forEach(el => {
    const word = el.textContent; let iv;
    el.addEventListener('mouseenter', () => { clearInterval(iv); iv = setInterval(() => { el.textContent = [...word].map(c => c === ' ' ? ' ' : rc()).join(''); }, 80); });
    el.addEventListener('mouseleave', () => { clearInterval(iv); el.textContent = word; });
  });

  // title: binary reveal on load, per-letter scramble on hover
  const title = document.getElementById('title'), word = title.textContent.trim();
  title.innerHTML = [...word].map(c => `<span>${c}</span>`).join('');
  const spans = [...title.children];
  spans.forEach((s, i) => {
    let iv;
    s.addEventListener('mouseenter', () => { clearInterval(iv); iv = setInterval(() => s.textContent = rc(), 80); });
    s.addEventListener('mouseleave', () => { clearInterval(iv); s.textContent = word[i]; });
  });
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let n = 0;
    const flick = setInterval(() => spans.forEach((s, i) => { if (i >= n) s.textContent = rc(); }), 60);
    const step = () => { spans[n].textContent = word[n]; n++; n < spans.length ? setTimeout(step, 140) : clearInterval(flick); };
    setTimeout(step, 250);
  }

  // click a photo to see it full size
  const lb = document.getElementById('lb'), lbImg = document.getElementById('lbImg');
  document.querySelectorAll('figure button').forEach(b => b.addEventListener('click', () => {
    const img = b.querySelector('img'); lbImg.src = img.src; lbImg.alt = img.alt; lb.hidden = false;
  }));
  lb.addEventListener('click', () => { lb.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.hidden = true; });
})();
