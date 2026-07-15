# Quorum Style Improvement + Auto-deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve quorum app styling to match landing page aesthetics and add auto-deploy to CF Pages via GitHub Actions.

**Architecture:** Update CSS with Space Grotesk/IBM Plex Mono fonts, add background animations, improve layout centering, and create a deploy workflow using wrangler-action.

**Tech Stack:** Vite, CSS custom properties, GitHub Actions, Cloudflare Pages, wrangler-action

## Global Constraints

- Maintain existing espresso/amber color palette (matches quorum landing surface)
- Keep all existing functionality intact
- Deploy workflow uses `cloudflare/wrangler-action@v3`
- Build command: `npm run build`, output: `dist/`

---

## File Structure

| File | Purpose |
|------|---------|
| `src/style.css` | Main stylesheet — tokens, layout, animations |
| `index.html` | Add font preloads for Space Grotesk and IBM Plex Mono |
| `.github/workflows/deploy.yml` | Auto-deploy to CF Pages on push to main |

---

## Tasks

### Task 1: Add Font Imports

**Covers:** Typography alignment with landing page

**Files:**
- Modify: `index.html:6-8`

**Interfaces:**
- Produces: Google Fonts loaded for Space Grotesk (display) and IBM Plex Mono (labels)

- [ ] **Step 1: Add font links to index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quorum</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <!-- Fonts: Space Grotesk (display) + IBM Plex Mono (labels/codes) -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap" media="print" onload="this.media='all'" />
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap" /></noscript>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "style: add Space Grotesk and IBM Plex Mono fonts"
```

---

### Task 2: Update CSS Tokens and Typography

**Covers:** Align typography with landing page design system

**Files:**
- Modify: `src/style.css:1-30` (tokens section)

**Interfaces:**
- Produces: Updated CSS custom properties with font families

- [ ] **Step 1: Update CSS tokens section**

Replace the tokens section (lines 1-27) with:

```css
/* ── Reset & tokens ─────────────────────────────────────────────────────── */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Espresso by default — the card table under a lamp, matching the landing:
   warm dark-brown ground, cream ink, amber cards. */
:root {
  --bg:          #241a12;
  --bg-surface:  #2f2318;
  --bg-raise:    #352a1f;
  --ink:         #f2e7d3;
  --ink-dim:     #b8a583;
  --ink-faint:   #8a7a5e;
  --line:        #40331f;
  --accent:      #e6b24a;
  --accent-dim:  rgba(230, 178, 74, 0.18);
  --danger:      #c0392b;
  --radius:      6px;

  /* Typography — matching landing page */
  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --font-body: -apple-system, 'Inter', 'Segoe UI', system-ui, sans-serif;

  font-family: var(--font-body);
  font-size: 16px;
  color: var(--ink);
  background: var(--bg);
}

body { min-height: 100dvh; display: flex; flex-direction: column; }
#app { flex: 1; display: flex; flex-direction: column; }
```

- [ ] **Step 2: Update typography classes**

Add after the tokens section:

```css
/* ── Typography ──────────────────────────────────────────────────────────── */

h1, h2, h3 { font-family: var(--font-display); }
.mono { font-family: var(--font-mono); letter-spacing: 0.06em; }
```

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "style: update CSS tokens with Space Grotesk and IBM Plex Mono"
```

---

### Task 3: Improve Home Page Layout

**Covers:** Center content, add spacing, improve visual hierarchy

**Files:**
- Modify: `src/pages/home.js`
- Modify: `src/style.css` (add home styles)

**Interfaces:**
- Consumes: CSS tokens from Task 2
- Produces: Centered home page with better spacing

- [ ] **Step 1: Update home.js to add better structure**

```javascript
import { navigate } from '../router.js';
import { generateRoomId } from '../room-id.js';

export function renderHome(root) {
  root.innerHTML = `
    <div class="page home">
      <div class="home-content">
        <div class="home-brand">
          <h1 class="home-title">Quorum</h1>
          <p class="home-subtitle">Planning poker — no accounts, no server.</p>
        </div>
        <div class="home-actions">
          <button id="btn-new" class="btn-primary">New room</button>
          <div class="join">
            <input id="join-code" class="join-input" placeholder="Room code (e.g. A3F2B1C4)" maxlength="8" />
            <button id="btn-join" class="btn-ghost">Join</button>
          </div>
        </div>
      </div>
    </div>
  `;

  root.querySelector('#btn-new').addEventListener('click', () => {
    navigate(`/room/${generateRoomId()}`);
  });

  root.querySelector('#btn-join').addEventListener('click', () => {
    const code = root.querySelector('#join-code').value.trim().toUpperCase();
    if (code.length === 8) navigate(`/room/${code}`);
  });
}
```

- [ ] **Step 2: Add home page styles to style.css**

Add before the Room shell section:

```css
/* ── Home page ───────────────────────────────────────────────────────────── */

.page.home {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.home-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3rem;
  max-width: 28rem;
  width: 100%;
}

.home-brand {
  text-align: center;
}

.home-title {
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 8vw, 4rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--ink);
  margin-bottom: 0.5rem;
}

.home-subtitle {
  font-size: 1.1rem;
  color: var(--ink-dim);
}

.home-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
}

.btn-primary {
  background: var(--accent);
  color: #18130a;
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius);
  transition: transform 0.15s, box-shadow 0.15s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(230, 178, 74, 0.3);
}

.join {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  max-width: 20rem;
}

.join-input {
  flex: 1;
  padding: 0.65rem 0.9rem;
  border: 1px solid var(--line);
  background: var(--bg-surface);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.95rem;
  border-radius: var(--radius);
}

.join-input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.join-input::placeholder {
  color: var(--ink-faint);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/home.js src/style.css
git commit -m "style: improve home page layout and centering"
```

---

### Task 4: Improve Room Header and Cards

**Covers:** Better card styling, shadows, hover effects

**Files:**
- Modify: `src/style.css` (room header and card sections)

**Interfaces:**
- Consumes: CSS tokens from Task 2
- Produces: Improved card styling with better shadows and transitions

- [ ] **Step 1: Update room header styles**

Replace the room header section (lines 100-136) with:

```css
/* ── Room shell ─────────────────────────────────────────────────────────── */

.room { display: flex; flex-direction: column; min-height: 100dvh; }

.room-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--line);
  background: var(--bg-surface);
  backdrop-filter: blur(8px);
}

.room-logo {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.02em;
}

.room-code {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid var(--line);
  color: var(--ink-dim);
  padding: 0.25rem 0.6rem;
  font-weight: 500;
  border-radius: var(--radius);
  transition: all 0.2s;
}
.room-code:hover { color: var(--accent); border-color: var(--accent); }

.conn-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--line);
  flex-shrink: 0;
  transition: background 0.3s;
}
.conn-dot.on    { background: #5dd39e; box-shadow: 0 0 8px rgba(93, 211, 158, 0.5); }
.conn-dot.alone { background: var(--accent); box-shadow: 0 0 8px rgba(230, 178, 74, 0.5); }

.conn-label { font-size: 0.8rem; color: var(--ink-dim); }

.room-main {
  flex: 1;
  padding: 2rem;
  max-width: 56rem;
  margin: 0 auto;
  width: 100%;
}
```

- [ ] **Step 2: Update card styles for better shadows and transitions**

Replace the card section (lines 317-334) with:

```css
.card {
  width: 3.4rem; height: 4.6rem;
  font-family: var(--font-mono);
  font-size: 1.05rem;
  font-weight: 600;
  background: var(--bg-surface);
  color: var(--ink);
  border: 1.5px solid var(--line);
  border-radius: var(--radius);
  padding: 0;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.card:hover {
  border-color: var(--accent);
  color: var(--ink);
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}
.card.selected {
  background: var(--accent);
  border-color: var(--accent);
  color: #18130a;
  transform: translateY(-6px);
  box-shadow: 0 12px 28px rgba(230, 178, 74, 0.35);
}
```

- [ ] **Step 3: Update participant card styles**

Replace the pcard section (lines 219-263) with:

```css
.pcard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.pcard-face {
  width: 3.2rem; height: 4.2rem;
  border: 1.5px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* Pattern for face-down card */
.pcard-face::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    45deg,
    var(--accent-dim) 0,
    var(--accent-dim) 1px,
    transparent 0,
    transparent 50%
  );
  background-size: 8px 8px;
  opacity: 0.5;
}

.pcard.voted .pcard-face {
  border-color: var(--accent);
  background: var(--accent-dim);
  box-shadow: 0 8px 20px rgba(230, 178, 74, 0.25);
}
.pcard.voted .pcard-face::before { display: none; }

.pcard-check {
  font-size: 1.2rem;
  color: var(--accent);
  position: relative;
  z-index: 1;
}
.pcard-name {
  font-size: 0.75rem;
  font-family: var(--font-mono);
  color: var(--ink-dim);
  max-width: 4.5rem;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pcard.offline { opacity: 0.4; }
```

- [ ] **Step 4: Commit**

```bash
git add src/style.css
git commit -m "style: improve room header and card styling with shadows"
```

---

### Task 5: Add Background Animation

**Covers:** Subtle animated background matching landing page aesthetic

**Files:**
- Create: `src/background.js`
- Modify: `src/main.js`
- Modify: `src/style.css`

**Interfaces:**
- Produces: Canvas-based drift particle animation

- [ ] **Step 1: Create background.js**

```javascript
// Subtle drift particle animation — warm amber dots floating slowly
const PARTICLE_COUNT = 40;
const COLOR = 'rgba(230, 178, 74, 0.15)';

let canvas, ctx, particles, animationId;

function init() {
  canvas = document.createElement('canvas');
  canvas.className = 'bg-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  ctx = canvas.getContext('2d');
  
  resize();
  window.addEventListener('resize', resize);
  
  particles = Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    r: Math.random() * 2 + 1,
  }));
  
  animate();
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    
    // Wrap around edges
    if (p.x < 0) p.x = canvas.width;
    if (p.x > canvas.width) p.x = 0;
    if (p.y < 0) p.y = canvas.height;
    if (p.y > canvas.height) p.y = 0;
    
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = COLOR;
    ctx.fill();
  }
  
  animationId = requestAnimationFrame(animate);
}

// Respect reduced motion preference
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init, { once: true });
}
```

- [ ] **Step 2: Import background in main.js**

Add import at the top of `src/main.js`:

```javascript
import { register, start } from './router.js';
import { renderHome } from './pages/home.js';
import { renderRoom } from './pages/room.js';
import './style.css';
import './background.js';
```

- [ ] **Step 3: Add canvas styles to style.css**

Add at the end of the file:

```css
/* ── Background animation ────────────────────────────────────────────────── */

.bg-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  pointer-events: none;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/background.js src/main.js src/style.css
git commit -m "style: add subtle drift particle background animation"
```

---

### Task 6: Create Deploy Workflow

**Covers:** Auto-deploy to CF Pages on push to main

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: GitHub Action that builds and deploys to CF Pages

- [ ] **Step 1: Create deploy.yml**

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - run: npm run build

      - name: Publish to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=quorum
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add auto-deploy to Cloudflare Pages"
```

---

### Task 7: Final Verification

**Covers:** Verify all changes work together

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All previous tasks

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds, `dist/` created

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: All 66 tests pass

- [ ] **Step 3: Preview locally**

```bash
npm run preview
```

Verify: Home page centered, fonts loaded, background animating, cards styled

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "style: final adjustments and fixes"
```

---

## Summary

After completing all tasks:
- Home page centered with Space Grotesk title
- Cards with shadows and smooth transitions
- Subtle particle background animation
- Auto-deploy to CF Pages on push to main
- All tests passing

Push branch and create PR to develop.
