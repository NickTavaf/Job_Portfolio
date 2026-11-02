// lab.js: dark mode for the lab pages, shared with the main site through localStorage.
if (localStorage.getItem('darkMode') === 'true') document.documentElement.classList.add('dark');

function toggleMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark);
}

// Read a CSS color token (for canvas drawing that should follow b&w mode).
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
