const CHARS = '01';
function randChar() { return CHARS[Math.floor(Math.random() * 2)]; }

function toggleMode() {
  const root = document.documentElement;
  const btn = document.getElementById('toggleBtn');
  const isDark = root.classList.toggle('dark');
  btn.classList.toggle('active', isDark);
  localStorage.setItem('darkMode', isDark);
}


function attachLetterHover(el) {
  const final = el.dataset.final;

  el.innerHTML = Array.from(final).map(ch =>
    `<span data-char="${ch}">${ch}</span>`
  ).join('');

  el.querySelectorAll('span').forEach(span => {
    const original = span.dataset.char;
    let interval = null;

    span.addEventListener('mouseenter', () => {
      clearInterval(interval);
      interval = setInterval(() => {
        span.textContent = randChar();
      }, 80);
    });

    span.addEventListener('mouseleave', () => {
      clearInterval(interval);
      span.textContent = original;
    });
  });
}

// Whole word scramble (for nav and footer)
function attachWordHover(el) {
  const final = el.dataset.final;
  let interval = null;

  el.addEventListener('mouseenter', () => {
    clearInterval(interval);
    interval = setInterval(() => {
      el.textContent = Array.from(final).map(() => randChar()).join('');
    }, 80);
  });

  el.addEventListener('mouseleave', () => {
    clearInterval(interval);
    el.textContent = final;
  });
}

window.addEventListener('DOMContentLoaded', () => {

  // Add data-final to nav items
  document.querySelectorAll('nav .nav-left span, nav .nav-left a, nav .nav-right span, nav .nav-right a').forEach(el => {
    el.dataset.final = el.textContent.trim();
  });
  document.getElementById('toggleBtn').dataset.final = 'b&w';

  // Add data-final to project titles
  document.querySelectorAll('.proj-title').forEach(el => {
    el.dataset.final = el.textContent.trim();
  });

  // Add data-final to footer spans
  document.querySelectorAll('footer span').forEach(el => {
    el.dataset.final = el.textContent.trim();
  });

  const navItems = document.querySelectorAll('nav .nav-left span, nav .nav-left a, nav .nav-right span, nav .nav-right a, #toggleBtn');
  const projTitles = document.querySelectorAll('.proj-title');
  const footerItems = document.querySelectorAll('footer span');

  // Attach hover immediately — works during and after intro
  projTitles.forEach(el => attachLetterHover(el));
  navItems.forEach(el => attachWordHover(el));
  footerItems.forEach(el => attachWordHover(el));

  // Hide proj titles until revealed
  projTitles.forEach(el => el.style.opacity = 0);

  const allTargets = [...navItems, ...projTitles, ...footerItems];
  const allLetters = [];

  allTargets.forEach((el) => {
    const word = el.dataset.final;
    el.style.opacity = 1;
    // For proj titles (which now have spans), set each span's text
    const spans = el.querySelectorAll('span');
    if (spans.length) {
      spans.forEach(s => s.textContent = '');
    } else {
      el.textContent = '';
    }
    Array.from(word).forEach((ch, li) => {
      allLetters.push({ el, li, ch, word });
    });
  });

  // Track revealed state per target
  const states = new Map();
  allTargets.forEach(el => {
    states.set(el, Array.from(el.dataset.final).map(() => null));
  });

  // Flicker unrevealed chars
  const flicker = setInterval(() => {
    allTargets.forEach(el => {
      const word = el.dataset.final;
      const s = states.get(el);
      const chars = Array.from(word).map((_, li) =>
        s[li] !== null ? s[li] : randChar()
      );
      const spans = el.querySelectorAll('span');
      if (spans.length) {
        spans.forEach((span, i) => span.textContent = chars[i]);
      } else {
        el.textContent = chars.join('');
      }
    });
  }, 70);

  // Reveal letter by letter
  const navLetterCount = Array.from(navItems).reduce((acc, el) => acc + el.dataset.final.length, 0);
  let idx = 0;

  function next() {
    if (idx >= allLetters.length) {
      clearInterval(flicker);
      allTargets.forEach(el => {
        const spans = el.querySelectorAll('span');
        if (spans.length) {
          spans.forEach((span, i) => span.textContent = el.dataset.final[i]);
        } else {
          el.textContent = el.dataset.final;
        }
      });
      return;
    }
    const { el, li, ch } = allLetters[idx];
    states.get(el)[li] = ch;
    idx++;
    const delay = idx <= navLetterCount ? 25 : 17;
    setTimeout(next, delay);
  }

  setTimeout(next, 200);
});