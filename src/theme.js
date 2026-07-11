// Theme: localStorage override → circadian fallback
const NIGHT_START = 18;
const NIGHT_END = 6;

function isNight() {
  const hour = new Date().getHours();
  return hour >= NIGHT_START || hour < NIGHT_END;
}

function applyTheme() {
  const saved = localStorage.getItem('quorum-theme');
  const theme = saved || (isNight() ? 'espresso' : 'arena');
  document.documentElement.setAttribute('data-theme', theme);
}

applyTheme();
setInterval(applyTheme, 60 * 1000);

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (!localStorage.getItem('quorum-theme')) applyTheme();
  });
}
