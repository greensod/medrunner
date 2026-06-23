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
  JUMP_FORCE:        -19,
  MAX_FALL_SPEED:    14,

  // Ground & player — LARGER for visibility
  GROUND_HEIGHT:     80,
  PLAYER_LEFT:       60,
  PLAYER_WIDTH:      120,
  PLAYER_HEIGHT:     140,
  PLAYER_DUCK_HEIGHT:72,

  // Dark mode transition (ms after game start)
  DARK_MODE_AFTER_MS:30000,

  // Speed scaling
  BASE_SPEED:        4.5,
  SPEED_INCREMENT:   0.0008,
  MAX_SPEED:         14,

  // Spawning — slightly more frequent for action
  SPAWN_MIN_INTERVAL:750,
  SPAWN_MAX_INTERVAL:2000,
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

  // ── DOUBLE JUMP ───────────────────────────────────────────
  DOUBLE_JUMP_ENABLED: true,

  // ── SHIELD (from stethoscope collectible) ─────────────────
  SHIELD_DURATION_MS: 5000,

  // ── SPEED MILESTONE SCORING ───────────────────────────────
  SPEED_MILESTONES: [6, 8, 10, 12, 14], // speeds that give bonus pts popup

  // ── BOSS / EXAM WAVE ──────────────────────────────────────
  BOSS_WAVE_INTERVAL_MS: 35000,   // gap between waves after the first
  BOSS_WAVE_FIRST_MS:    60000,   // first wave only after 60s of normal gameplay
  BOSS_WAVE_DURATION_MS: 5000,    // wave lasts 5s
  BOSS_WAVE_SPAWN_MS:    700,     // spawn every 700ms during wave

  // ── WEATHER EVENTS ────────────────────────────────────────
  WEATHER_INTERVAL_MS:   20000,   // weather shifts every 20s
  WEATHER_DURATION_MS:   8000,    // each weather phase lasts 8s
};

// ── ELEMENT DEFINITIONS ────────────────────────────────────────
const ELEMENTS = [
  // Ground obstacles
  { id:'exam',      emoji:'📋', type:'obstacle',   zone:'ground', label:'Exam Paper'   },
  { id:'textbook',  emoji:'📚', type:'obstacle',   zone:'ground', label:'Textbooks'    },
  { id:'syringe',   emoji:'💉', type:'obstacle',   zone:'ground', label:'Giant Syringe'},
  { id:'bed',       emoji:'🛏️',  type:'obstacle',   zone:'ground', label:'On-Call Bed'  },

  // Sky obstacles
  { id:'card',      emoji:'🪪', type:'obstacle',   zone:'sky',    label:'ID Card'      },
  { id:'absent',    emoji:'❌', type:'obstacle',   zone:'sky',    label:'Absent Mark'  },
  { id:'alarm',     emoji:'⏰', type:'obstacle',   zone:'sky',    label:'Alarm Clock'  },

  // Ground collectibles
  { id:'bone',      emoji:'🦴', type:'collectible',zone:'ground', label:'Bone',        points:1 },
  { id:'coffee',    emoji:'☕', type:'collectible',zone:'ground', label:'Coffee',      points:1, special:'boost' },
  { id:'pill',      emoji:'💊', type:'collectible',zone:'ground', label:'Med Dose',    points:2 },
  { id:'heart',     emoji:'🩺',  type:'collectible',zone:'ground', label:'Extra Life',  points:0, special:'life' },

  // Sky collectibles
  { id:'skull',     emoji:'💀', type:'collectible',zone:'sky',    label:'Skull',       points:1 },
  { id:'steth',     emoji:'❤️', type:'collectible',zone:'sky',    label:'Shield!',     points:1, special:'shield' },
  { id:'oximeter',  emoji:'🫀', type:'collectible',zone:'sky',    label:'Oximeter',    points:1 },
  { id:'passed',    emoji:'✅', type:'collectible',zone:'sky',    label:'PASSED!',     points:3 },
  { id:'diploma',   emoji:'📜', type:'collectible',zone:'sky',    label:'Diploma!',    points:5 },
];

// ── BOSS WAVE OBSTACLE POOL ────────────────────────────────────
// These spawn rapidly during an Exam Wave (boss event).
const BOSS_OBSTACLES = [
  { id:'bexam',   emoji:'📋', type:'obstacle', zone:'ground', label:'Final Exam!'  },
  { id:'bbook',   emoji:'📚', type:'obstacle', zone:'sky',    label:'Flying Book'  },
  { id:'bsyrn',   emoji:'💉', type:'obstacle', zone:'ground', label:'Syringe!'     },
  { id:'balarm',  emoji:'⏰', type:'obstacle', zone:'sky',    label:"TIME'S UP!"   },
  { id:'babsent', emoji:'❌', type:'obstacle', zone:'sky',    label:'ABSENT!'      },
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

// ── ACHIEVEMENTS ─────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id:'first_blood',  icon:'🩸', title:'First Steps',      desc:'Complete your first run',          check: s => s.runSurviveMs > 0 },
  { id:'speed_demon',  icon:'⚡', title:'Speed Demon',       desc:'Reach max speed',                  check: s => s.speed >= CONFIG.MAX_SPEED },
  { id:'boss_slayer',  icon:'💀', title:'Survived the Prof', desc:'Survive an Exam Wave',             check: s => s.bossWavesSurvived >= 1 },
  { id:'combo_king',   icon:'🔥', title:'Combo King',        desc:'Reach a ×3 combo',                check: s => s.runMaxCombo >= 3 },
  { id:'night_owl',    icon:'🌙', title:'Night Shift',       desc:'Survive into Night Mode',          check: s => s.isDarkMode },
  { id:'pharmacist',   icon:'💊', title:'Pharmacist',        desc:'Collect 5 Med Doses in one run',  check: s => (s.runCollectById['pill']||0) >= 5 },
  { id:'caffeine',     icon:'☕', title:'Caffeine Addict',  desc:'Use Coffee Boost 3 times',         check: s => (s.runCollectById['coffee']||0) >= 3 },
  { id:'marathon',     icon:'🏃', title:'Marathon Intern',   desc:'Survive 120 seconds',              check: s => s.runSurviveMs >= 120000 },
  { id:'bone_doc',     icon:'🦴', title:'Bone Doctor',       desc:'Collect 20 bones in one run',     check: s => (s.runCollectById['bone']||0) >= 20 },
  { id:'graduated',    icon:'📜', title:'Graduated!',        desc:'Collect a Diploma',                check: s => (s.runCollectById['diploma']||0) >= 1 },
];

function loadAchievements() {
  try { return JSON.parse(localStorage.getItem('medrunner_ach') || '{}'); } catch(e) { return {}; }
}
function saveAchievements(ach) {
  localStorage.setItem('medrunner_ach', JSON.stringify(ach));
}

let unlockedAch = loadAchievements();

function checkAchievements() {
  let newUnlock = false;
  ACHIEVEMENTS.forEach(a => {
    if (unlockedAch[a.id]) return;
    if (a.check(state)) {
      unlockedAch[a.id] = Date.now();
      newUnlock = true;
      saveAchievements(unlockedAch);
      showAchievementBanner(a);
    }
  });
}

function showAchievementBanner(a) {
  const el = document.createElement('div');
  el.className = 'achievement-banner';
  el.innerHTML = `<span class="ach-icon">${a.icon}</span><div class="ach-text"><div class="ach-title">Achievement Unlocked!</div><div class="ach-name">${a.title}</div></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('ach-show'), 50);
  setTimeout(() => { el.classList.remove('ach-show'); setTimeout(() => el.remove(), 500); }, 3500);
}

// ── Generate today's 3 missions (deterministic per calendar day)
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

    // Shield (stethoscope power-up)
    isShielded:     false,
    shieldTimer:    0,

    // Double-jump
    jumpsUsed:      0,

    // Speed milestone tracking
    lastMilestoneIdx: -1,

    // ── BOSS WAVE ────────────────────────────────────────────
    bossWaveActive:   false,
    bossWaveTimer:    0,
    bossWaveNext:     CONFIG.BOSS_WAVE_FIRST_MS, // long delay before first wave
    bossWaveSpawnAt:  0,

    // ── WEATHER ──────────────────────────────────────────────
    weatherPhase:     'clear', // 'clear' | 'rain' | 'fog' | 'storm'
    weatherTimer:     0,       // ms remaining in current phase
    weatherNext:      CONFIG.WEATHER_INTERVAL_MS,

    // ── RUN STATS (for game-over screen) ─────────────────────
    totalCollected:   0,
    bossWavesSurvived:0,

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
    // First jump
    state.playerVY  = CONFIG.JUMP_FORCE;
    state.isJumping = true;
    state.jumpsUsed = 1;
    $player.classList.add('jumping');
    $player.classList.remove('ducking');
  } else if (CONFIG.DOUBLE_JUMP_ENABLED && state.jumpsUsed < 2 && state.playerVY > -4) {
    // Double jump — only when already descending or near peak
    state.playerVY  = CONFIG.JUMP_FORCE * 0.78;
    state.jumpsUsed = 2;
    $player.classList.add('double-jump');
    showPopup('💨 Double Jump!', null, 'boost', CONFIG.PLAYER_LEFT + 60, sceneH * 0.5);
    setTimeout(() => $player.classList.remove('double-jump'), 350);
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

// ── FULL-SCREEN TOUCH GESTURES (tap = jump, swipe down = duck) ──
// Tap anywhere on the scene → jump (tap again mid-air → double jump,
// handled automatically inside doJump()). A downward swipe → duck for
// as long as the finger stays down; lifting the finger stands back up.
(function setupSceneTouchGestures() {
  const SWIPE_DOWN_THRESHOLD = 28; // px of downward movement to count as a swipe
  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;
  let gestureResolved = false; // true once we've decided tap vs swipe for this touch
  let isDuckGesture = false;

  $scene.addEventListener('touchstart', (e) => {
    if (!state.running) return;
    // Ignore touches that started on the mobile buttons (they handle themselves)
    if (e.target.closest('#mobile-controls')) return;

    const t = e.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchActive = true;
    gestureResolved = false;
    isDuckGesture = false;
  }, { passive: true });

  $scene.addEventListener('touchmove', (e) => {
    if (!touchActive || gestureResolved) return;
    const t = e.changedTouches[0];
    const dy = t.clientY - touchStartY;
    const dx = t.clientX - touchStartX;

    // Once the finger has moved down clearly more than sideways, lock in "duck"
    if (dy > SWIPE_DOWN_THRESHOLD && dy > Math.abs(dx)) {
      gestureResolved = true;
      isDuckGesture = true;
      startDuck();
    }
  }, { passive: true });

  $scene.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    touchActive = false;

    if (isDuckGesture) {
      stopDuck();
    } else {
      // No swipe was detected → treat it as a tap → jump
      doJump();
    }
    gestureResolved = false;
    isDuckGesture = false;
  });

  $scene.addEventListener('touchcancel', () => {
    if (isDuckGesture) stopDuck();
    touchActive = false;
    gestureResolved = false;
    isDuckGesture = false;
  });
})();

// ── SPAWNING ──────────────────────────────────────────────────
function scheduleNextSpawn(now) {
  const interval = CONFIG.SPAWN_MIN_INTERVAL +
    Math.random() * (CONFIG.SPAWN_MAX_INTERVAL - CONFIG.SPAWN_MIN_INTERVAL);
  state.nextSpawnAt = now + interval;
}

// ── BOSS WAVE SPAWNER ─────────────────────────────────────────
function spawnBossElement(now) {
  const def = BOSS_OBSTACLES[Math.floor(Math.random() * BOSS_OBSTACLES.length)];
  const el = document.createElement('div');
  el.classList.add('game-element', 'boss-element',
    def.zone === 'ground' ? 'obstacle-ground' : 'obstacle-sky');
  el.innerHTML = `<span class="el-emoji">${def.emoji}</span><span class="el-label">${def.label}</span>`;

  const startX = sceneW + 10;
  let elTop;

  if (def.zone === 'ground') {
    el.style.bottom = CONFIG.GROUND_HEIGHT + 'px';
  } else {
    const peakRise   = (CONFIG.JUMP_FORCE * CONFIG.JUMP_FORCE) / (2 * CONFIG.GRAVITY);
    const lowPlayerY  = CONFIG.GROUND_HEIGHT + peakRise * 0.25;
    const highPlayerY = CONFIG.GROUND_HEIGHT + peakRise * 0.95;
    const bandBottom  = sceneH - lowPlayerY;
    const bandTop     = sceneH - highPlayerY - CONFIG.PLAYER_HEIGHT;
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
  state.bossWaveSpawnAt = now + (state._bossSpawnMs || CONFIG.BOSS_WAVE_SPAWN_MS);
}

function startBossWave(now) {
  state.bossWaveActive  = true;
  // Waves get slightly harder each time: spawn interval shrinks, duration grows
  const waveNum = state.bossWavesSurvived;
  const spawnMs   = Math.max(350, CONFIG.BOSS_WAVE_SPAWN_MS   - waveNum * 40);
  const durationMs = Math.min(10000, CONFIG.BOSS_WAVE_DURATION_MS + waveNum * 500);
  state.bossWaveTimer   = durationMs;
  state._bossSpawnMs    = spawnMs;
  state.bossWaveSpawnAt = now + 500; // brief pause before first obstacle
  $scene.classList.add('boss-wave');
  const waveLabel = waveNum === 0 ? '🚨 EXAM WAVE!' : `🚨 WAVE ${waveNum + 1} — HARDER!`;
  showPopup(waveLabel, null, 'boss', sceneW / 2 - 90, sceneH * 0.2);
  playSound('hit');
}

function endBossWave() {
  state.bossWaveActive = false;
  state.bossWavesSurvived++;
  state.bossWaveNext   = CONFIG.BOSS_WAVE_INTERVAL_MS; // 35s until next wave
  $scene.classList.remove('boss-wave');
  state.score += 20;
  showPopup('✅ Wave Survived! +20', null, 'combo', sceneW / 2 - 90, sceneH * 0.25);
  checkAchievements();
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

  // Emoji + small label beneath it
  el.innerHTML = `<span class="el-emoji">${def.emoji}</span><span class="el-label">${def.label}</span>`;
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
const HIT_MARGIN = 12;
const ELEM_SIZE  = 50; // slightly smaller than 60 — still very visible

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
    if (state.isBoosted || state.isShielded) {
      // Shield absorbs one hit
      if (state.isShielded) deactivateShield();
      return;
    }
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
  } else if (def.special === 'shield') {
    label = '🛡️ SHIELD ON!';
  } else if (def.special === 'life') {
    label = '+1 ❤️ LIFE!';
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

  if (def.special === 'boost')   activateBoost();
  if (def.special === 'shield')  activateShield();
  if (def.special === 'life')    gainLife();

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

function activateShield() {
  state.isShielded  = true;
  state.shieldTimer = CONFIG.SHIELD_DURATION_MS;
  $player.classList.add('shielded');
  const $si = document.getElementById('shield-indicator');
  if ($si) $si.classList.remove('hidden');
}

function deactivateShield() {
  state.isShielded = false;
  $player.classList.remove('shielded');
  const $si = document.getElementById('shield-indicator');
  if ($si) $si.classList.add('hidden');
  showPopup('🛡️ Shield gone!', null, 'negative', CONFIG.PLAYER_LEFT + 60, sceneH * 0.4);
}

function gainLife() {
  if (state.lives < CONFIG.MAX_LIVES) {
    state.lives++;
    updateHUD();
    updateVignette();
    showPopup('+1 ❤️ LIFE!', null, 'boost', CONFIG.PLAYER_LEFT + 60, sceneH * 0.35);
  }
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

function renderAchievementPanel() {
  const panel = document.getElementById('achievement-panel');
  if (!panel) return;
  panel.innerHTML = ACHIEVEMENTS.map(a => {
    const done = !!unlockedAch[a.id];
    return `<div class="ach-item ${done ? 'ach-done' : 'ach-locked'}">
      <span class="ach-item-icon">${done ? a.icon : '🔒'}</span>
      <span class="ach-item-name">${a.title}</span>
    </div>`;
  }).join('');
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

// ── WEATHER SYSTEM ────────────────────────────────────────────
const WEATHER_PHASES = ['rain', 'fog', 'storm', 'clear'];
let weatherPhaseIdx = 0;

function triggerWeather() {
  const phase = WEATHER_PHASES[weatherPhaseIdx % WEATHER_PHASES.length];
  weatherPhaseIdx++;
  state.weatherPhase = phase;
  state.weatherTimer = CONFIG.WEATHER_DURATION_MS;

  // Remove old weather classes
  $scene.classList.remove('weather-rain', 'weather-fog', 'weather-storm');

  if (phase !== 'clear') {
    $scene.classList.add('weather-' + phase);
    const labels = { rain: '🌧️ Heavy Rain!', fog: '🌫️ Fog Warning!', storm: '⛈️ Storm Alert!' };
    showPopup(labels[phase], null, 'boost', sceneW / 2 - 80, sceneH * 0.18);
    spawnRainDrops(phase);
  } else {
    showPopup('☀️ Clear Skies!', null, 'positive', sceneW / 2 - 60, sceneH * 0.18);
  }
}

function clearWeather() {
  state.weatherPhase = 'clear';
  $scene.classList.remove('weather-rain', 'weather-fog', 'weather-storm');
}

// Rain / storm drop particles
const _rainPool = [];
function spawnRainDrops(phase) {
  const count = phase === 'storm' ? 20 : 10;
  for (let i = 0; i < count; i++) {
    const drop = document.createElement('div');
    drop.className = 'rain-drop' + (phase === 'storm' ? ' storm-drop' : '');
    drop.style.left   = Math.random() * 100 + '%';
    drop.style.animationDelay = (Math.random() * 0.8) + 's';
    drop.style.animationDuration = (0.4 + Math.random() * 0.4) + 's';
    $scene.appendChild(drop);
    _rainPool.push(drop);
  }
  // Limit pool
  while (_rainPool.length > 80) {
    const old = _rainPool.shift();
    if (old.parentNode) old.parentNode.removeChild(old);
  }
}

function clearRainDrops() {
  _rainPool.forEach(d => d.parentNode && d.parentNode.removeChild(d));
  _rainPool.length = 0;
}

// ── PLAYER TRAIL ──────────────────────────────────────────────
let _lastTrailAt = 0;
function spawnTrail() {
  const now = performance.now();
  if (now - _lastTrailAt < 60) return;
  _lastTrailAt = now;

  const trail = document.createElement('div');
  trail.className = 'player-trail';
  const playerBottom = state.playerY;
  const playerLeft   = CONFIG.PLAYER_LEFT;
  trail.style.left   = (playerLeft + CONFIG.PLAYER_WIDTH * 0.3) + 'px';
  trail.style.bottom = (playerBottom + 10) + 'px';
  trail.style.width  = CONFIG.PLAYER_WIDTH * 0.5 + 'px';
  trail.style.height = (state.isDucking ? CONFIG.PLAYER_DUCK_HEIGHT : CONFIG.PLAYER_HEIGHT) * 0.6 + 'px';
  $scene.appendChild(trail);
  setTimeout(() => trail.parentNode && trail.parentNode.removeChild(trail), 300);
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
      state.jumpsUsed = 0;
      $player.classList.remove('jumping');
    }
  }
  applyPlayerPosition();

  // ── 5. MOVE ELEMENTS ─────────────────────────────────────────
  for (let i = state.activeElements.length - 1; i >= 0; i--) {
    const item = state.activeElements[i];
    item.x -= effectiveSpeed;
    item.el.style.left = item.x + 'px';
    if (item.x < -80) {
      if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
      state.activeElements.splice(i, 1);
    }
  }

  // ── 6. SPAWN (normal + boss wave) ────────────────────────────
  if (!state.bossWaveActive && timestamp >= state.nextSpawnAt) spawnElement(timestamp);
  if (state.bossWaveActive && timestamp >= state.bossWaveSpawnAt) spawnBossElement(timestamp);

  // ── 7. COLLISIONS ────────────────────────────────────────────
  checkCollisions();

  // ── 8. TIMERS ────────────────────────────────────────────────
  if (state.isBoosted) {
    state.boostTimer -= dt;
    if (state.boostTimer <= 0) deactivateBoost();
  }
  if (state.isShielded) {
    state.shieldTimer -= dt;
    if (state.shieldTimer <= 0) deactivateShield();
  }

  // ── 8b. SPEED MILESTONES ─────────────────────────────────────
  CONFIG.SPEED_MILESTONES.forEach((ms, idx) => {
    if (idx > state.lastMilestoneIdx && state.speed >= ms) {
      state.lastMilestoneIdx = idx;
      state.score += 10;
      showPopup(`⚡ Speed Level ${idx + 1}! +10`, null, 'combo', sceneW / 2 - 80, sceneH * 0.3);
    }
  });

  // ── 8c. BOSS WAVE TICK ───────────────────────────────────────
  if (state.bossWaveActive) {
    state.bossWaveTimer -= dt;
    if (state.bossWaveTimer <= 0) endBossWave();
  } else {
    state.bossWaveNext -= dt;
    if (state.bossWaveNext <= 0) startBossWave(timestamp);
  }

  // ── 8d. WEATHER TICK ─────────────────────────────────────────
  state.weatherNext -= dt;
  if (state.weatherNext <= 0) {
    triggerWeather();
    state.weatherNext = CONFIG.WEATHER_INTERVAL_MS + CONFIG.WEATHER_DURATION_MS;
  }
  if (state.weatherTimer > 0) {
    state.weatherTimer -= dt;
    if (state.weatherTimer <= 0) clearWeather();
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

  // ── 11. MISSION & ACHIEVEMENT TICK (every second) ────────────
  if (Math.floor(state.runSurviveMs / 1000) > Math.floor((state.runSurviveMs - dt) / 1000)) {
    checkMissionProgress();
    checkAchievements();
  }

  // ── 11b. PLAYER TRAIL (when boosted or jumping) ──────────────
  if (state.isBoosted || state.isJumping) spawnTrail();

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
  checkAchievements(); // final check on game-over
  playSound('gameover');

  setTimeout(() => {
    $finalScore.textContent     = finalScore;
    $finalHighscore.textContent = state.highScore;
    // Inject mini run-stats into gameover screen
    const statsEl = document.getElementById('run-stats');
    if (statsEl) {
      statsEl.innerHTML =
        `<span>⏱ ${Math.floor(state.runSurviveMs / 1000)}s</span>` +
        `<span>📦 ${state.runCollectAny} collected</span>` +
        `<span>🚨 ${state.bossWavesSurvived} waves</span>`;
    }
    $gameoverScreen.classList.remove('hidden');
    renderMissionPanel();
    renderAchievementPanel();
  }, 400);
}

// ── START / RESTART ───────────────────────────────────────────
function startGame() {
  $startScreen.classList.add('hidden');
  $gameoverScreen.classList.add('hidden');
  $boostIndicator.classList.add('hidden');

  $elementsContainer.innerHTML = '';
  $popupsContainer.innerHTML   = '';

  document.body.classList.remove('dark-mode', 'shielded');
  $player.classList.remove('shielded', 'double-jump');
  $scene.classList.remove('boss-wave', 'weather-rain', 'weather-fog', 'weather-storm');
  clearRainDrops();
  weatherPhaseIdx = 0;
  const $si = document.getElementById('shield-indicator');
  if ($si) $si.classList.add('hidden');
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

// ── INJECT SHIELD INDICATOR ───────────────────────────────────
(function injectShieldIndicator() {
  const si = document.createElement('div');
  si.id = 'shield-indicator';
  si.className = 'hidden';
  si.textContent = '🛡️ SHIELD ACTIVE';
  document.getElementById('game-wrapper').insertAdjacentElement('afterbegin', si);
})();

// ── INJECT MISSION PANEL ──────────────────────────────────────
(function injectMissionPanel() {
  const panel = document.createElement('div');
  panel.id = 'mission-panel';
  const wrapper = document.getElementById('game-wrapper');
  if (wrapper) wrapper.insertAdjacentElement('afterend', panel);
  else document.body.appendChild(panel);
  renderMissionPanel();
})();

// ── INJECT ACHIEVEMENT PANEL ──────────────────────────────────
(function injectAchievementPanel() {
  const panel = document.createElement('div');
  panel.id = 'achievement-panel';
  const missionPanel = document.getElementById('mission-panel');
  if (missionPanel) missionPanel.insertAdjacentElement('afterend', panel);
  else document.body.appendChild(panel);
  renderAchievementPanel();
})();

// ── INJECT RUN-STATS into game-over screen ────────────────────
(function injectRunStats() {
  const goScreen = document.getElementById('gameover-screen');
  if (!goScreen) return;
  const content = goScreen.querySelector('.overlay-content');
  if (!content) return;
  const stats = document.createElement('div');
  stats.id = 'run-stats';
  stats.className = 'run-stats';
  // Insert before restart button
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.insertAdjacentElement('beforebegin', stats);
  else content.appendChild(stats);
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