import { register, start } from './router.js';
import { renderHome } from './pages/home.js';
import { renderRoom } from './pages/room.js';
import './style.css';
import './background.js';
import './theme.js';

const root = document.getElementById('app');

register('/', () => renderHome(root));
register('/room/:id', (id) => renderRoom(root, id));

// Persistent footer — lives outside #app so it survives page transitions
const footer = document.createElement('footer');
footer.className = 'site-footer';
footer.innerHTML = `
  <div class="footer-inner">
    <div class="footer-left">
      <a class="footer-mark" href="https://univerlab.org" target="_blank" rel="noopener noreferrer" aria-label="UniverLab">
        <svg width="28" height="28" viewBox="0 0 500 500" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M 251.99,1 C 233.61,1.02 215.23,4.78 201.15,12.27 L 62.45,86.11 C 34.29,101.1 34.31,125.19 62.51,140.12 l 138.63,73.44 c 9.29,4.92 20.45,8.22 32.25,9.89 l 0,-100.44 c 0,-9.63 8.33,-17.39 18.69,-17.39 10.35,0 18.69,7.76 18.69,17.39 v 100.44 c 0,0.51 -0.02,1.01 -0.07,1.5 11.79,-1.69 22.94,-5.01 32.22,-9.95 l 138.71,-73.84 c 28.16,-14.99 28.13,-39.08 -0.06,-54.01 L 302.87,12.17 C 288.77,4.71 270.38,0.98 251.99,1 Z"/>
          <path d="m 486.79,382.53 c 9.07,-14.88 14.65,-31.6 14.61,-46.7 L 501.02,187.12 c -0.08,-30.19 -22.59,-42.08 -50.48,-26.66 l -137.14,75.82 c -9.19,5.08 -17.79,12.48 -25.18,21.19 l 93.81,49.66 c 9,4.76 12.12,15.34 7,23.71 -5.12,8.37 -16.48,11.28 -25.48,6.52 l -93.81,-49.66 c -0.47,-0.25 -0.93,-0.52 -1.37,-0.8 -4.25,10.37 -6.67,21.03 -6.64,30.99 l 0.38,148.71 c 0.08,30.19 22.59,42.07 50.48,26.66 l 137.14,-75.82 c 13.94,-7.71 26.51,-20.75 35.59,-35.62 z"/>
          <path d="M 15.47,382.53 C 6.39,367.65 0.81,350.92 0.85,335.83 L 1.23,187.12 c 0.08,-30.19 22.59,-42.08 50.47,-26.66 l 137.14,75.82 c 9.19,5.08 17.79,12.48 25.18,21.19 l -93.81,49.66 c -9,4.76 -12.12,15.34 -7,23.71 5.12,8.37 16.48,11.28 25.48,6.52 l 93.81,-49.66 c 0.47,-0.25 0.93,-0.52 1.37,-0.8 4.25,10.37 6.67,21.03 6.64,30.99 l -0.38,148.71 c -0.08,30.19 -22.59,42.07 -50.48,26.66 L 51.05,418.15 C 37.11,410.44 24.54,397.4 15.47,382.53 Z"/>
        </svg>
      </a>
    </div>
    <nav class="footer-nav">
      <a href="https://univerlab.org" target="_blank" rel="noopener noreferrer">UniverLab</a>
      <a href="https://github.com/UniverLab/quorum" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="https://univerlab.org/experiments" target="_blank" rel="noopener noreferrer">More experiments</a>
    </nav>
  </div>
  <div class="footer-base">
    <span class="footer-word">UNIVERLAB</span>
  </div>
`;
document.body.appendChild(footer);

start();
