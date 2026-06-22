/* ============================================================
   MED RUNNER — game.js
   Vanilla JS DOM-based infinite runner
   Architecture: requestAnimationFrame game loop, DOM elements
   positioned with absolute CSS, collision via stored positions
   ============================================================ */

'use strict';

// ── CONFIGURATION ──────────────────────────────────────────────
const CONFIG = {
  // Physics
  GRAVITY:           0.55,
  JUMP_FORCE:        -17,
  MAX_FALL_SPEED:    12,

  // Ground & player
  GROUND_HEIGHT:     70,
  PLAYER_LEFT:       48,
  PLAYER_WIDTH:      90,
  PLAYER_HEIGHT:     110,
  PLAYER_DUCK_HEIGHT:60,

  // Dark mode transition (ms after game start)
  DARK_MODE_AFTER_MS:30000,

  // Speed scaling
  BASE_SPEED:        4.5,
  SPEED_INCREMENT:   0.0008,
  MAX_SPEED:         14,

  // Spawning
  SPAWN_MIN_INTERVAL:900,
  SPAWN_MAX_INTERVAL:2400,
  SKY_ZONE_TOP:      0.35,
  SKY_ZONE_BOTTOM:   0.60,

  // Lives
  MAX_LIVES:         3,

  // Coffee boost
  BOOST_DURATION_MS: 4000,
  BOOST_SPEED_MULT:  1.7,

  // Scoring
  SCORE_PER_FRAME:   0.04,

  // ── COMBO SYSTEM ──────────────────────────────────────────
  COMBO_WINDOW_MS:   2200,   // ms between collects to keep combo alive
  COMBO_MULTIPLIERS: [1, 1, 1.5, 2, 2.5, 3], // index = combo count (capped at 5)
};

// ── ELEMENT DEFINITIONS ────────────────────────────────────────
const ELEMENTS = [
  // Ground obstacles
  { id:'exam',      emoji:'📋', type:'obstacle',   zone:'ground', label:'Exam Paper'   },
  { id:'textbook',  emoji:'📚', type:'obstacle',   zone:'ground', label:'Textbooks'    },
  { id:'syringe',   emoji:'💉', type:'obstacle',   zone:'ground', label:'Giant Syringe'},

  // Sky obstacles
  { id:'card',      emoji:'🪪', type:'obstacle',   zone:'sky',    label:'ID Card'      },
  { id:'absent',    emoji:'❌', type:'obstacle',   zone:'sky',    label:'Absent Mark'  },

  // Ground collectibles
  { id:'bone',      emoji:'🦴', type:'collectible',zone:'ground', label:'Bone',        points:1 },
  { id:'coffee',    emoji:'☕', type:'collectible',zone:'ground', label:'Coffee',      points:1, special:'boost' },

  // Sky collectibles
  { id:'skull',     emoji:'💀', type:'collectible',zone:'sky',    label:'Skull',       points:1 },
  { id:'steth',     emoji:'🩺', type:'collectible',zone:'sky',    label:'Stethoscope', points:1 },
  { id:'oximeter',  emoji:'🫀', type:'collectible',zone:'sky',    label:'Oximeter',    points:1 },
  { id:'passed',    emoji:'✅', type:'collectible',zone:'sky',    label:'PASSED!',     points:2 },
];

// ── DAILY MISSIONS ────────────────────────────────────────────
// Three missions regenerate each calendar day.
// type: 'collect_id' | 'collect_any' | 'survive' | 'combo' | 'score'
const MISSION_TEMPLATES = [
  { id:'bones5',    desc:'Collect 5 bones 🦴',              type:'collect_id', target_id:'bone',  goal:5  },
  { id:'bones10',   desc:'Collect 10 bones 🦴',             type:'collect_id', target_id:'bone',  goal:10 },
  { id:'steth5',    desc:'Collect 5 stethoscopes 🩺',       type:'collect_id', target_id:'steth', goal:5  },
  { id:'coffee3',   desc:'Drink 3 coffees ☕',              type:'collect_id', target_id:'coffee',goal:3  },
  { id:'collect15', desc:'Collect 15 items in one run',     type:'collect_any',                    goal:15 },
  { id:'collect25', desc:'Collect 25 items in one run',     type:'collect_any',                    goal:25 },
  { id:'survive60', desc:'Survive 60 seconds',              type:'survive',                        goal:60 },
  { id:'survive90', desc:'Survive 90 seconds',              type:'survive',                        goal:90 },
  { id:'combo5',    desc:'Reach a ×3 combo streak',         type:'combo',                          goal:5  },
  { id:'score100',  desc:'Score 100 points',                type:'score',                          goal:100},
  { id:'score200',  desc:'Score 200 points',                type:'score',                          goal:200},
  { id:'skulls3',   desc:'Collect 3 skulls 💀',             type:'collect_id', target_id:'skull', goal:3  },
];

// Generate today's 3 missions (deterministic per calendar day)
function getDailyMissions() {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth()+1) * 100 + today.getDate();
  // simple seeded shuffle
  const order = MISSION_TEMPLATES.map((m, i) => ({ m, sort: (seed * (i+1) * 1664525 + 1013904223) & 0x7fffffff }))
    .sort((a, b) => a.sort - b.sort)
    .map(x => x.m);
  return order.slice(0, 3).map(m => ({ ...m, progress: 0, done: false }));
}

function loadMissionProgress() {
  const key = 'medrunner_missions';
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    const today = new Date().toDateString();
    if (saved && saved.date === today) return saved.missions;
  } catch(e) {}
  // New day — fresh missions
  const fresh = getDailyMissions();
  saveMissionProgress(fresh);
  return fresh;
}

function saveMissionProgress(missions) {
  const key = 'medrunner_missions';
  localStorage.setItem(key, JSON.stringify({ date: new Date().toDateString(), missions }));
}

// ── DOM REFERENCES ─────────────────────────────────────────────
const $startScreen      = document.getElementById('start-screen');
const $gameoverScreen   = document.getElementById('gameover-screen');
const $startBtn         = document.getElementById('start-btn');
const $restartBtn       = document.getElementById('restart-btn');
const $scene            = document.getElementById('game-scene');
const $player           = document.getElementById('player');
const $playerSprite     = document.getElementById('player-sprite');
const $elementsContainer= document.getElementById('elements-container');
const $popupsContainer  = document.getElementById('popups-container');
const $scoreDisplay     = document.getElementById('score-display');
const $highscoreDisplay = document.getElementById('highscore-display');
const $livesDisplay     = document.getElementById('lives-display');
const $finalScore       = document.getElementById('final-score');
const $finalHighscore   = document.getElementById('final-highscore');
const $boostIndicator   = document.getElementById('boost-indicator');
const $btnJump          = document.getElementById('btn-jump');
const $btnDuck          = document.getElementById('btn-duck');

// ── AUDIO ──────────────────────────────────────────────────────
// start.wav = looping MENU MUSIC: begins on the first user interaction
// while the start screen is open, stops the moment the game starts.
// All other sounds are one-shot SFX fired via playSound().

function loadAudio(src) {
  const a = new Audio(src);
  a.onerror = () => {};
  return a;
}

const SFX = {
  catch:    loadAudio('assets/catch.wav'),
  hit:      loadAudio('assets/hit.wav'),
  gameover: loadAudio('assets/gameover.wav'),
  combo:    loadAudio('assets/combo.wav'),
  mission:  loadAudio('assets/mission.wav'),
};

// Menu music plays once on the start screen, stops when game begins
const menuMusic = loadAudio('assets/start.wav');
menuMusic.volume = 0.55;
let _menuMusicStarted = false;

function startMenuMusic() {
  if (_menuMusicStarted) return;
  _menuMusicStarted = true;
  menuMusic.currentTime = 0;
  menuMusic.play().catch(() => {});
}

function stopMenuMusic() {
  menuMusic.pause();
  menuMusic.currentTime = 0;
  _menuMusicStarted = false;
}

// First user interaction → start menu music + warm up all SFX
function _onFirstInteraction() {
  startMenuMusic();
  Object.values(SFX).forEach(a => {
    if (!a) return;
    const p = a.play();
    if (p) p.then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
  });
}

['click', 'touchstart', 'keydown'].forEach(evt =>
  document.addEventListener(evt, _onFirstInteraction, { once: true, passive: true })
);

function playSound(name) {
  try {
    const s = SFX[name];
    if (s) { s.currentTime = 0; s.play().catch(() => {}); }
  } catch(e) {}
}

// ── GAME STATE ─────────────────────────────────────────────────
let state = {};
let missions = loadMissionProgress(); // persists across runs

function getInitialState() {
  return {
    running:        false,
    score:          0,
    highScore:      parseInt(localStorage.getItem('medrunner_hs') || '0', 10),
    lives:          CONFIG.MAX_LIVES,
    speed:          CONFIG.BASE_SPEED,
    frameCount:     0,
    lastTimestamp:  null,
    rafId:          null,

    // Player physics
    playerY:        0,
    playerVY:       0,
    isJumping:      false,
    isDucking:      false,

    // Coffee boost
    isBoosted:      false,
    boostTimer:     0,

    // Spawning
    nextSpawnAt:    0,

    // Active DOM elements on screen
    activeElements: [],

    // Dark mode
    isDarkMode:     false,
    darkModeTimer:  0,

    // ── COMBO ────────────────────────────────────────────────
    comboCount:     0,         // consecutive collects
    comboTimer:     0,         // ms until combo resets
    multiplier:     1,

    // ── MISSION TRACKING (per-run counters) ──────────────────
    runCollectById: {},        // { bone: N, steth: N, … }
    runCollectAny:  0,
    runSurviveMs:   0,
    runMaxCombo:    0,
  };
}

// ── COMPUTED SCENE DIMENSIONS ──────────────────────────────────
let sceneW = 700;
let sceneH = 520;
let groundLevel = 0;

function measureScene() {
  const rect = $scene.getBoundingClientRect();
  sceneW     = rect.width;
  sceneH     = rect.height;
  groundLevel = CONFIG.GROUND_HEIGHT;
}

// ── PLAYER POSITIONING ─────────────────────────────────────────
function applyPlayerPosition() {
  const h = state.isDucking ? CONFIG.PLAYER_DUCK_HEIGHT : CONFIG.PLAYER_HEIGHT;
  $player.style.height = h + 'px';
  $player.style.bottom = state.playerY + 'px';
  $player.style.width  = CONFIG.PLAYER_WIDTH + 'px';
  $player.style.left   = CONFIG.PLAYER_LEFT + 'px';
}

// ── JUMP & DUCK ────────────────────────────────────────────────
function doJump() {
  if (!state.running) return;
  if (!state.isJumping) {
    state.playerVY  = CONFIG.JUMP_FORCE;
    state.isJumping = true;
    $player.classList.add('jumping');
    $player.classList.remove('ducking');
  }
}

function startDuck() {
  if (!state.running || state.isJumping) return;
  state.isDucking = true;
  $player.classList.add('ducking');
}

function stopDuck() {
  state.isDucking = false;
  $player.classList.remove('ducking');
}

// ── KEYBOARD ──────────────────────────────────────────────────
const keysDown = {};

document.addEventListener('keydown', (e) => {
  if (!state.running) return;
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    doJump();
  }
  if (e.code === 'ArrowDown' && !keysDown['ArrowDown']) {
    e.preventDefault();
    startDuck();
  }
  keysDown[e.code] = true;
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown') stopDuck();
  delete keysDown[e.code];
});

// ── MOBILE BUTTONS ────────────────────────────────────────────
$btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); doJump(); });
$btnJump.addEventListener('mousedown',  () => doJump());
$btnDuck.addEventListener('touchstart', (e) => { e.preventDefault(); startDuck(); });
$btnDuck.addEventListener('touchend',   (e) => { e.preventDefault(); stopDuck(); });
$btnDuck.addEventListener('mousedown',  () => startDuck());
$btnDuck.addEventListener('mouseup',    () => stopDuck());

// ── SPAWNING ──────────────────────────────────────────────────
function scheduleNextSpawn(now) {
  const interval = CONFIG.SPAWN_MIN_INTERVAL +
    Math.random() * (CONFIG.SPAWN_MAX_INTERVAL - CONFIG.SPAWN_MIN_INTERVAL);
  state.nextSpawnAt = now + interval;
}

function spawnElement(now) {
  const def = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
  const el = document.createElement('div');
  el.classList.add('game-element');

  if (def.type === 'obstacle') {
    el.classList.add(def.zone === 'ground' ? 'obstacle-ground' : 'obstacle-sky');
  } else {
    el.classList.add('collectible');
    if (def.zone === 'sky') el.classList.add('collectible-sky');
  }

  el.textContent = def.emoji;
  el.title = def.label;

  const startX = sceneW + 10;
  let elTop;

  if (def.zone === 'ground') {
    el.style.bottom = CONFIG.GROUND_HEIGHT + 'px';
  } else {
    // Anchor the sky band to the player's actual jump arc, not an
    // arbitrary fraction of sceneH. A band placed only at the exact
    // apex is airborne for just a handful of frames, so it rarely
    // lines up with a passing obstacle — feels random/unfair.
    // Instead we cover the middle portion of the whole arc (low point
    // of the climb through the low point of the fall), so jumping
    // early, late, or right at the peak all have a real chance to connect.
    const peakRise    = (CONFIG.JUMP_FORCE * CONFIG.JUMP_FORCE) / (2 * CONFIG.GRAVITY);
    const peakPlayerY = CONFIG.GROUND_HEIGHT + peakRise;

    // playerY at ~25% and ~75% of the way up to peak (covers a wide
    // swath of the arc the player is airborne through, both up and down)
    const lowPlayerY  = CONFIG.GROUND_HEIGHT + peakRise * 0.25;
    const highPlayerY = CONFIG.GROUND_HEIGHT + peakRise * 0.95;

    // Convert to top-down screen coords (smaller y = higher on screen)
    const bandBottom = sceneH - lowPlayerY;                          // feet level, lower in arc
    const bandTop     = sceneH - highPlayerY - CONFIG.PLAYER_HEIGHT; // head level, higher in arc

    const skyMin = Math.max(10, Math.floor(bandTop));
    const skyMax = Math.floor(bandBottom);
    elTop = skyMin + Math.floor(Math.random() * Math.max(1, skyMax - skyMin));
    el.style.top = elTop + 'px';
  }

  el.style.left = startX + 'px';
  $elementsContainer.appendChild(el);

  state.activeElements.push({
    el, def,
    x: startX,
    zone: def.zone,
    groundBottom: def.zone === 'ground' ? CONFIG.GROUND_HEIGHT : null,
    skyTop:       def.zone === 'sky'    ? elTop : null,
  });

  scheduleNextSpawn(now);
}

// ── COLLISION DETECTION ───────────────────────────────────────
const HIT_MARGIN = 10;
const ELEM_SIZE  = 40;

function checkCollisions() {
  const pH      = state.isDucking ? CONFIG.PLAYER_DUCK_HEIGHT : CONFIG.PLAYER_HEIGHT;
  const pLeft   = CONFIG.PLAYER_LEFT + HIT_MARGIN;
  const pRight  = CONFIG.PLAYER_LEFT + CONFIG.PLAYER_WIDTH - HIT_MARGIN;
  const pBottom = sceneH - state.playerY - 2;
  const pTop    = sceneH - state.playerY - pH + HIT_MARGIN;

  // Two separate lists so handleCollision fires AFTER the array is
  // fully cleaned up. Previously, calling handleCollision mid-loop
  // while also splicing caused index corruption and missed collisions.
  const toRemove  = []; // indices to delete
  const toCollide = []; // item *references* to fire collision on

  for (let i = 0; i < state.activeElements.length; i++) {
    const item = state.activeElements[i];

    // Off-screen: prune only, no collision
    if (item.x < -(ELEM_SIZE + 10)) {
      toRemove.push(i);
      continue;
    }

    const eLeft  = item.x + HIT_MARGIN;
    const eRight = item.x + ELEM_SIZE - HIT_MARGIN;
    let eTop, eBottom;

    if (item.zone === 'ground') {
      const elBottomFromTop = sceneH - item.groundBottom;
      eBottom = elBottomFromTop - HIT_MARGIN;
      eTop    = elBottomFromTop - ELEM_SIZE + HIT_MARGIN;
    } else {
      eTop    = item.skyTop + HIT_MARGIN;
      eBottom = item.skyTop + ELEM_SIZE - HIT_MARGIN;
    }

    const overlaps = (
      pLeft  < eRight  &&
      pRight > eLeft   &&
      pTop   < eBottom &&
      pBottom > eTop
    );

    if (overlaps) {
      toRemove.push(i);
      toCollide.push(item); // save reference — safe after splices
    }
  }

  // Remove in reverse so earlier splices don't shift later indices
  for (let i = toRemove.length - 1; i >= 0; i--) {
    const item = state.activeElements[toRemove[i]];
    if (item && item.el.parentNode) item.el.parentNode.removeChild(item.el);
    state.activeElements.splice(toRemove[i], 1);
  }

  // Fire collisions now that array is fully clean
  for (const item of toCollide) {
    handleCollision(item);
  }
}

// ── HANDLE COLLISION ──────────────────────────────────────────
function handleCollision(item) {
  const { def } = item;
  if (def.type === 'obstacle') {
    if (state.isBoosted) return;
    breakCombo();
    loseLife();
  } else {
    collectItem(item);
  }
}

function loseLife() {
  state.lives = Math.max(0, state.lives - 1);
  updateHUD();

  $player.classList.add('hit');
  $scene.classList.add('shake');

  // Low-life vignette
  updateVignette();

  setTimeout(() => $player.classList.remove('hit'), 500);
  setTimeout(() => $scene.classList.remove('shake'), 450);

  showPopup('-1 💔', null, 'negative', CONFIG.PLAYER_LEFT + 60, sceneH * 0.4);
  playSound('hit');

  if (state.lives <= 0) triggerGameOver();
}

function collectItem(item) {
  const { def } = item;

  // ── COMBO ────────────────────────────────────────────────────
  state.comboCount = Math.min(state.comboCount + 1, 5);
  state.comboTimer = CONFIG.COMBO_WINDOW_MS;
  state.multiplier = CONFIG.COMBO_MULTIPLIERS[state.comboCount] || 3;
  state.runMaxCombo = Math.max(state.runMaxCombo, state.comboCount);

  const pts = Math.round((def.points || 1) * state.multiplier);
  state.score += pts;
  updateHUD();
  updateComboHUD();

  // Popup position: use stored logical position
  const popX = item.x;
  const popY = item.zone === 'ground'
    ? sceneH - item.groundBottom - ELEM_SIZE - 10
    : item.skyTop - 10;

  let label;
  if (def.special === 'boost') {
    label = '+1 ☕ BOOST!';
  } else if (state.comboCount >= 2) {
    label = `+${pts} ×${state.multiplier % 1 === 0 ? state.multiplier : state.multiplier.toFixed(1)}`;
  } else {
    label = `+${pts}`;
  }

  showPopup(label, null, def.special === 'boost' ? 'boost' : 'positive', popX, popY);

  // Combo milestone announcements
  if (state.comboCount === 3) showPopup('COMBO! 🔥', null, 'combo', sceneW / 2 - 50, sceneH * 0.3);
  if (state.comboCount === 5) showPopup('MAX COMBO! 🔥🔥', null, 'combo', sceneW / 2 - 70, sceneH * 0.25);

  // Particle burst
  spawnParticles(popX + ELEM_SIZE / 2, popY + ELEM_SIZE / 2, def.type === 'collectible' ? '#ffd166' : '#00c9a7');

  if (def.special === 'boost') activateBoost();

  playSound(state.comboCount >= 3 ? 'combo' : 'catch');

  // ── MISSION TRACKING ─────────────────────────────────────────
  state.runCollectAny++;
  state.runCollectById[def.id] = (state.runCollectById[def.id] || 0) + 1;
  checkMissionProgress();
}

// ── COMBO SYSTEM ──────────────────────────────────────────────
function breakCombo() {
  if (state.comboCount > 0) {
    state.comboCount = 0;
    state.multiplier = 1;
    state.comboTimer = 0;
    updateComboHUD();
  }
}

function tickCombo(dt) {
  if (state.comboCount > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) breakCombo();
    // Update timer bar width
    const bar = document.getElementById('combo-timer-bar');
    if (bar) {
      const pct = Math.max(0, state.comboTimer / CONFIG.COMBO_WINDOW_MS * 100);
      bar.style.width = pct + '%';
    }
  }
}

function updateComboHUD() {
  const wrap = document.getElementById('combo-wrap');
  if (!wrap) return;
  if (state.comboCount < 2) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  const label = document.getElementById('combo-label');
  if (label) label.textContent = `×${state.multiplier % 1 === 0 ? state.multiplier : state.multiplier.toFixed(1)} COMBO ${state.comboCount >= 5 ? '🔥🔥' : '🔥'}`;
}

// ── PARTICLE BURST ────────────────────────────────────────────
function spawnParticles(x, y, color) {
  const count = 7;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (i / count) * Math.PI * 2;
    const dist  = 28 + Math.random() * 22;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    p.style.cssText = `left:${x}px;top:${y}px;background:${color};` +
      `--tx:${tx}px;--ty:${ty}px`;
    $popupsContainer.appendChild(p);
    setTimeout(() => p.parentNode && p.parentNode.removeChild(p), 500);
  }
}

// ── VIGNETTE (low-life warning) ───────────────────────────────
function updateVignette() {
  const v = document.getElementById('vignette');
  if (!v) return;
  if (state.lives === 1) {
    v.classList.add('danger');
    v.classList.remove('warning');
  } else if (state.lives === 2) {
    v.classList.add('warning');
    v.classList.remove('danger');
  } else {
    v.classList.remove('danger', 'warning');
  }
}

// ── COFFEE BOOST ──────────────────────────────────────────────
function activateBoost() {
  state.isBoosted  = true;
  state.boostTimer = CONFIG.BOOST_DURATION_MS;
  $boostIndicator.classList.remove('hidden');
}

function deactivateBoost() {
  state.isBoosted = false;
  $boostIndicator.classList.add('hidden');
}

// ── FLOATING POPUPS ───────────────────────────────────────────
function showPopup(text, _unused, cssClass, x, y) {
  const popup = document.createElement('div');
  popup.classList.add('popup', cssClass);
  popup.textContent = text;
  popup.style.left  = (x || 80) + 'px';
  popup.style.top   = (y || 80) + 'px';
  $popupsContainer.appendChild(popup);
  setTimeout(() => popup.parentNode && popup.parentNode.removeChild(popup), 950);
}

// ── HUD ───────────────────────────────────────────────────────
function updateHUD() {
  $scoreDisplay.textContent     = Math.floor(state.score);
  $highscoreDisplay.textContent = Math.max(state.highScore, Math.floor(state.score));
  $livesDisplay.textContent     = '🩺'.repeat(Math.max(0, state.lives));
}

// ── MISSION UI ───────────────────────────────────────────────
function renderMissionPanel() {
  let panel = document.getElementById('mission-panel');
  if (!panel) return;
  panel.innerHTML = missions.map((m, i) => `
    <div class="mission-item ${m.done ? 'done' : ''}">
      <div class="mission-bar-wrap">
        <div class="mission-bar" style="width:${Math.min(100, m.progress / m.goal * 100)}%"></div>
      </div>
      <span class="mission-desc">${m.desc}</span>
      <span class="mission-prog">${m.done ? '✅' : `${Math.min(m.progress, m.goal)}/${m.goal}`}</span>
    </div>
  `).join('');
}

function checkMissionProgress() {
  let anyNewlyDone = false;
  missions.forEach(m => {
    if (m.done) return;
    let prev = m.progress;
    switch (m.type) {
      case 'collect_id':  m.progress = state.runCollectById[m.target_id] || 0; break;
      case 'collect_any': m.progress = state.runCollectAny; break;
      case 'survive':     m.progress = Math.floor(state.runSurviveMs / 1000); break;
      case 'combo':       m.progress = state.runMaxCombo; break;
      case 'score':       m.progress = Math.floor(state.score); break;
    }
    if (!m.done && m.progress >= m.goal) {
      m.done = true;
      anyNewlyDone = true;
      showPopup('✅ Mission done!', null, 'boost', sceneW / 2 - 70, sceneH * 0.2);
      playSound('mission');
    }
  });
  if (anyNewlyDone) {
    saveMissionProgress(missions);
    renderMissionPanel();
  }
  // Lightweight progress bar update every collect
  missions.forEach((m, i) => {
    const bar = document.querySelector(`#mission-panel .mission-item:nth-child(${i+1}) .mission-bar`);
    if (bar) bar.style.width = Math.min(100, m.progress / m.goal * 100) + '%';
    const prog = document.querySelector(`#mission-panel .mission-item:nth-child(${i+1}) .mission-prog`);
    if (prog && !m.done) prog.textContent = `${Math.min(m.progress, m.goal)}/${m.goal}`;
  });
}

// ── GAME LOOP ─────────────────────────────────────────────────
function gameLoop(timestamp) {
  if (!state.running) return;

  const dt = state.lastTimestamp ? Math.min(timestamp - state.lastTimestamp, 50) : 16;
  state.lastTimestamp = timestamp;
  state.frameCount++;

  // ── 1. SPEED ─────────────────────────────────────────────────
  const effectiveSpeed = (state.isBoosted ? CONFIG.BOOST_SPEED_MULT : 1) *
    Math.min(state.speed, CONFIG.MAX_SPEED);
  state.speed = CONFIG.BASE_SPEED + (state.frameCount * CONFIG.SPEED_INCREMENT);

  // ── 2. SCORE ─────────────────────────────────────────────────
  state.score += CONFIG.SCORE_PER_FRAME * (effectiveSpeed / CONFIG.BASE_SPEED);

  // ── 3. SURVIVE TIMER ─────────────────────────────────────────
  state.runSurviveMs += dt;

  // ── 4. PHYSICS ───────────────────────────────────────────────
  if (state.isJumping || state.playerY > groundLevel) {
    state.playerVY += CONFIG.GRAVITY;
    state.playerVY  = Math.min(state.playerVY, CONFIG.MAX_FALL_SPEED);
    state.playerY  -= state.playerVY;
    if (state.playerY <= groundLevel) {
      state.playerY   = groundLevel;
      state.playerVY  = 0;
      state.isJumping = false;
      $player.classList.remove('jumping');
    }
  }
  applyPlayerPosition();

  // ── 5. MOVE ELEMENTS ─────────────────────────────────────────
  for (let i = state.activeElements.length - 1; i >= 0; i--) {
    const item = state.activeElements[i];
    item.x -= effectiveSpeed;
    item.el.style.left = item.x + 'px';
    if (item.x < -60) {
      if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
      state.activeElements.splice(i, 1);
    }
  }

  // ── 6. SPAWN ─────────────────────────────────────────────────
  if (timestamp >= state.nextSpawnAt) spawnElement(timestamp);

  // ── 7. COLLISIONS ────────────────────────────────────────────
  checkCollisions();

  // ── 8. TIMERS ────────────────────────────────────────────────
  if (state.isBoosted) {
    state.boostTimer -= dt;
    if (state.boostTimer <= 0) deactivateBoost();
  }

  // ── 9. COMBO TICK ────────────────────────────────────────────
  tickCombo(dt);

  // ── 10. DARK MODE ────────────────────────────────────────────
  if (!state.isDarkMode) {
    state.darkModeTimer += dt;
    if (state.darkModeTimer >= CONFIG.DARK_MODE_AFTER_MS) {
      state.isDarkMode = true;
      document.body.classList.add('dark-mode');
      showPopup('🌙 Night shift!', null, 'boost', sceneW / 2 - 60, sceneH / 2 - 40);
    }
  }

  // ── 11. MISSION SURVIVE TICK (every second) ──────────────────
  if (Math.floor(state.runSurviveMs / 1000) > Math.floor((state.runSurviveMs - dt) / 1000)) {
    checkMissionProgress();
  }

  // ── 12. HUD ──────────────────────────────────────────────────
  updateHUD();

  state.rafId = requestAnimationFrame(gameLoop);
}

// ── GAME OVER ─────────────────────────────────────────────────
function triggerGameOver() {
  state.running = false;
  cancelAnimationFrame(state.rafId);

  const finalScore = Math.floor(state.score);
  if (finalScore > state.highScore) {
    state.highScore = finalScore;
    localStorage.setItem('medrunner_hs', String(finalScore));
  }

  saveMissionProgress(missions);
  playSound('gameover');

  setTimeout(() => {
    $finalScore.textContent     = finalScore;
    $finalHighscore.textContent = state.highScore;
    $gameoverScreen.classList.remove('hidden');
    renderMissionPanel();
  }, 400);
}

// ── START / RESTART ───────────────────────────────────────────
function startGame() {
  $startScreen.classList.add('hidden');
  $gameoverScreen.classList.add('hidden');
  $boostIndicator.classList.add('hidden');

  $elementsContainer.innerHTML = '';
  $popupsContainer.innerHTML   = '';

  document.body.classList.remove('dark-mode');
  measureScene();

  missions = loadMissionProgress();

  const savedHS = parseInt(localStorage.getItem('medrunner_hs') || '0', 10);
  state = getInitialState();
  state.highScore   = savedHS;
  state.playerY     = groundLevel;
  state.running     = true;
  state.nextSpawnAt = performance.now() + 1200;

  updateHUD();
  updateComboHUD();
  updateVignette();
  applyPlayerPosition();
  renderMissionPanel();

  stopMenuMusic(); // stop menu music when game begins
  state.rafId = requestAnimationFrame(gameLoop);
}

// ── BUTTON LISTENERS ──────────────────────────────────────────
$startBtn.addEventListener('click',   startGame);
$restartBtn.addEventListener('click', startGame);

document.addEventListener('keydown', (e) => {
  if (!state.running) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (!$startScreen.classList.contains('hidden') ||
          !$gameoverScreen.classList.contains('hidden')) {
        startGame();
      }
    }
  }
});

// ── RESIZE ────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  if (state.running) {
    measureScene();
    if (state.playerY < groundLevel) {
      state.playerY  = groundLevel;
      state.playerVY = 0;
      state.isJumping = false;
    }
    applyPlayerPosition();
  }
});

// ── VISIBILITY CHANGE ─────────────────────────────────────────
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.running) state.lastTimestamp = null;
});

// ── INJECT COMBO HUD ──────────────────────────────────────────
// Lives in the HUD bar (above the scene), not inside the play area
(function injectComboHUD() {
  const wrap = document.createElement('div');
  wrap.id = 'combo-wrap';
  wrap.className = 'hidden';
  wrap.innerHTML = `
    <div id="combo-label">×2 COMBO 🔥</div>
    <div id="combo-timer-track"><div id="combo-timer-bar"></div></div>
  `;
  const hudCenter = document.getElementById('hud-center');
  if (hudCenter) hudCenter.appendChild(wrap);
  else {
    const hud = document.getElementById('hud');
    if (hud) hud.insertAdjacentElement('afterend', wrap);
    else document.getElementById('game-wrapper').appendChild(wrap);
  }
})();

// ── INJECT VIGNETTE ───────────────────────────────────────────
// Stays in scene — purely a visual border glow, no text
(function injectVignette() {
  const v = document.createElement('div');
  v.id = 'vignette';
  $scene.appendChild(v);
})();

// ── INJECT MISSION PANEL ──────────────────────────────────────
// Placed OUTSIDE the scene, below #game-wrapper, so it never overlaps gameplay
(function injectMissionPanel() {
  const panel = document.createElement('div');
  panel.id = 'mission-panel';
  const wrapper = document.getElementById('game-wrapper');
  if (wrapper) wrapper.insertAdjacentElement('afterend', panel);
  else document.body.appendChild(panel);
  renderMissionPanel();
})();

// ── SPEED BAR ─────────────────────────────────────────────────
(function injectSpeedBar() {
  const wrap = document.createElement('div');
  wrap.id = 'speed-bar-wrap';
  wrap.innerHTML = `<span>SPD</span><div id="speed-bar"><div id="speed-fill"></div></div>`;
  $scene.appendChild(wrap);

  const $fill = document.getElementById('speed-fill');
  setInterval(() => {
    if (!state.running) return;
    const pct = Math.min(100, ((state.speed - CONFIG.BASE_SPEED) / (CONFIG.MAX_SPEED - CONFIG.BASE_SPEED)) * 100);
    $fill.style.width = Math.max(8, pct) + '%';
    if (pct < 40)      $fill.style.background = '#00c9a7';
    else if (pct < 75) $fill.style.background = '#ffd166';
    else               $fill.style.background = '#ff4d6d';
  }, 500);
})();

// ── INITIAL HIGH SCORE ────────────────────────────────────────
(function() {
  const hs = parseInt(localStorage.getItem('medrunner_hs') || '0', 10);
  if (hs > 0) $highscoreDisplay.textContent = hs;
})();

// ── SPRITE IMAGE LOADING ──────────────────────────────────────
const imgNormal = new Image();
const imgHit    = new Image();

imgNormal.onload = function() {
  $playerSprite.style.backgroundImage = "url('assets/friend_normal.png')";
  $playerSprite.classList.add('has-image');
};
imgNormal.onerror = function() {};
imgNormal.src = 'assets/friend_normal.png';
imgHit.src    = 'assets/friend_hit.png';

const _playerHitObserver = new MutationObserver(() => {
  if ($player.classList.contains('hit')) {
    if (imgHit.complete && imgHit.naturalWidth > 0)
      $playerSprite.style.backgroundImage = "url('assets/friend_hit.png')";
  } else {
    if (imgNormal.complete && imgNormal.naturalWidth > 0)
      $playerSprite.style.backgroundImage = "url('assets/friend_normal.png')";
  }
});
_playerHitObserver.observe($player, { attributes: true, attributeFilter: ['class'] });