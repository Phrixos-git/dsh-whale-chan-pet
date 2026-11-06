import { SPRITES } from './sprites.js';
import { SPEECH, pickLine } from './speech.js';

const DEFAULT_SETTINGS = Object.freeze({
  size: 210,
  wanderMinMs: 9000,
  wanderMaxMs: 22000,
  longThinkMs: 20000,
});
const SETTINGS_KEY = 'dsh.whale-chan-pet.settings';

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeSettings(input = {}, base = DEFAULT_SETTINGS) {
  let wanderMinMs = clampNumber(input.wanderMinMs, 2000, 60000, base.wanderMinMs);
  let wanderMaxMs = clampNumber(input.wanderMaxMs, 2000, 60000, base.wanderMaxMs);
  if (wanderMaxMs < wanderMinMs) [wanderMinMs, wanderMaxMs] = [wanderMaxMs, wanderMinMs];
  return {
    size: clampNumber(input.size, 140, 320, base.size),
    wanderMinMs,
    wanderMaxMs,
    longThinkMs: clampNumber(input.longThinkMs, 5000, 120000, base.longThinkMs),
  };
}

function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Create the DOM-only Whale-chan pet.
 *
 * The controller is intentionally independent of React and DSH so the same
 * code can run in the real Web GUI and in the standalone preview page.
 *
 * @param {HTMLElement} root - element that fills the frame (the overlay layer).
 * @param {object} [options] - preview/testing overrides.
 * @returns {{ setActivity: Function, poke: Function, forceMode: Function, destroy: Function, getState: Function }}
 */
export function createPetController(root, options = {}) {
  if (!root) throw new Error('createPetController: root is required');

  const storedSettings = loadSettings();
  const initialSettings = normalizeSettings({
    ...storedSettings,
    ...(options.size === undefined ? {} : { size: options.size }),
    ...(options.longThinkMs === undefined ? {} : { longThinkMs: options.longThinkMs }),
    ...(options.wanderMinMs === undefined ? {} : { wanderMinMs: options.wanderMinMs }),
    ...(options.wanderMaxMs === undefined ? {} : { wanderMaxMs: options.wanderMaxMs }),
    ...(options.settings ?? {}),
  }, storedSettings);
  let size = initialSettings.size;
  let longThinkMs = initialSettings.longThinkMs;
  let wanderMinMs = initialSettings.wanderMinMs;
  let wanderMaxMs = initialSettings.wanderMaxMs;
  const napAfterMs = options.napAfterMs ?? 75000;
  const napMinMs = options.napMinMs ?? 18000;
  const napMaxMs = options.napMaxMs ?? 40000;
  const walkSpeed = options.walkSpeed ?? 70;
  const initialPosition = options.initialPosition ?? null;
  const bottomClearance = options.bottomClearance ?? 110;
  const ignoreHidden = options.ignoreHidden ?? false;
  const reducedMotion = options.ignoreReducedMotion
    ? false
    : typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  root.classList.add('wc-layer');
  root.style.pointerEvents = 'none';
  root.style.setProperty('--wc-size', `${size}px`);

  const bubble = document.createElement('div');
  bubble.className = 'wc-bubble';

  const flip = document.createElement('div');
  flip.className = 'wc-flip';

  const sprite = document.createElement('div');
  sprite.className = 'wc-sprite';

  const spriteImage = document.createElement('img');
  spriteImage.className = 'wc-sprite-image';
  spriteImage.alt = '';
  spriteImage.draggable = false;
  spriteImage.src = SPRITES.idle;
  sprite.append(spriteImage);

  flip.append(sprite);

  const zzz = document.createElement('div');
  zzz.className = 'wc-zzz';
  zzz.textContent = 'Zzz';
  zzz.setAttribute('aria-hidden', 'true');

  const heart = document.createElement('div');
  heart.className = 'wc-heart';
  heart.textContent = '♥';
  heart.setAttribute('aria-hidden', 'true');

  const hideButton = document.createElement('button');
  hideButton.type = 'button';
  hideButton.className = 'wc-hide';
  hideButton.textContent = '×';
  hideButton.title = '隠す (Alt+Shift+W)';
  hideButton.setAttribute('aria-label', 'Whale-chanを隠す');
  hideButton.setAttribute('aria-keyshortcuts', 'Alt+Shift+W');
  hideButton.addEventListener('pointerdown', (event) => event.stopPropagation());
  hideButton.addEventListener('click', (event) => {
    event.stopPropagation();
    setHidden(true);
  });

  const settingsButton = document.createElement('button');
  settingsButton.type = 'button';
  settingsButton.className = 'wc-settings-toggle';
  settingsButton.textContent = '⚙';
  settingsButton.title = 'Whale-chanの設定';
  settingsButton.setAttribute('aria-label', 'Whale-chanの設定');
  settingsButton.setAttribute('aria-haspopup', 'dialog');
  settingsButton.setAttribute('aria-expanded', 'false');
  settingsButton.addEventListener('pointerdown', (event) => event.stopPropagation());
  settingsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openSettings();
  });

  const settingsPanel = document.createElement('div');
  settingsPanel.className = 'wc-settings-panel';
  settingsPanel.setAttribute('role', 'dialog');
  settingsPanel.setAttribute('aria-label', 'Whale-chanの設定');
  settingsPanel.innerHTML = `
    <div class="wc-settings-head">
      <strong>Whale-chan 設定</strong>
      <button type="button" class="wc-settings-close" aria-label="設定を閉じる">×</button>
    </div>
    <label class="wc-setting">
      <span>サイズ <b data-wc-value="size">210</b>px</span>
      <input type="range" min="140" max="320" step="5" data-wc-setting="size">
    </label>
    <label class="wc-setting">
      <span>歩行間隔（最小） <b data-wc-value="wanderMin">9.0</b>秒</span>
      <input type="range" min="2" max="60" step="1" data-wc-setting="wanderMin">
    </label>
    <label class="wc-setting">
      <span>歩行間隔（最大） <b data-wc-value="wanderMax">22.0</b>秒</span>
      <input type="range" min="2" max="60" step="1" data-wc-setting="wanderMax">
    </label>
    <label class="wc-setting">
      <span>長考で寝るまで <b data-wc-value="longThink">20</b>秒</span>
      <input type="range" min="5" max="120" step="5" data-wc-setting="longThink">
    </label>
    <div class="wc-settings-actions">
      <button type="button" data-wc-action="reset">リセット</button>
      <button type="button" data-wc-action="close">閉じる</button>
    </div>
    <p class="wc-settings-hint">設定はこのタブに保存されます。</p>
  `;
  settingsPanel.addEventListener('pointerdown', (event) => event.stopPropagation());
  settingsPanel.addEventListener('input', (event) => {
    const input = event.target.closest('input[data-wc-setting]');
    if (!input) return;
    const value = Number(input.value);
    if (input.dataset.wcSetting === 'size') applySettings({ size: value });
    else if (input.dataset.wcSetting === 'wanderMin') applySettings({ wanderMinMs: value * 1000 });
    else if (input.dataset.wcSetting === 'wanderMax') applySettings({ wanderMaxMs: value * 1000 });
    else if (input.dataset.wcSetting === 'longThink') applySettings({ longThinkMs: value * 1000 });
  });
  settingsPanel.querySelector('.wc-settings-close').addEventListener('click', () => closeSettings());
  settingsPanel.querySelector('[data-wc-action="reset"]').addEventListener('click', () => resetSettings());
  settingsPanel.querySelector('[data-wc-action="close"]').addEventListener('click', () => closeSettings());

  const summon = document.createElement('button');
  summon.type = 'button';
  summon.className = 'wc-summon';
  summon.textContent = '🐋';
  summon.title = 'Whale-chanを呼び出す (Alt+Shift+W)';
  summon.setAttribute('aria-label', 'Whale-chanを呼び出す');
  summon.setAttribute('aria-keyshortcuts', 'Alt+Shift+W');
  summon.tabIndex = -1;
  summon.addEventListener('click', () => setHidden(false));

  const pet = document.createElement('div');
  pet.className = 'wc-pet';
  pet.style.display = 'none';
  pet.append(bubble, flip, zzz, heart, settingsButton, hideButton);
  root.append(pet, summon, settingsPanel);

  const state = {
    activity: { running: false, thinking: false, visible: true, sessionId: undefined },
    mode: 'idle',
    spriteKey: 'idle',
    walkFrame: 0,
    blinking: false,
    nextBlinkAt: Date.now() + 4000,
    blinkUntil: 0,
    settings: initialSettings,
    x: 0,
    y: 0,
    facing: 1,
    initialized: false,
    ready: false,
    hidden: false,
    dragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragStartX: 0,
    dragStartY: 0,
    dragMoved: false,
    walkUntil: 0,
    nextWanderAt: 0,
    nextNapCheck: 0,
    idleSince: Date.now(),
    napUntil: 0,
    sleepReason: null,
    thinkingSince: 0,
    happyUntil: 0,
    bubbleTimer: 0,
    bubbleBelow: false,
    reducedMotion,
    destroyed: false,
  };

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  let initiallyHidden = false;
  try {
    initiallyHidden = sessionStorage.getItem('dsh.whale-chan-pet.hidden') === '1';
  } catch {
    initiallyHidden = false;
  }

  function petRect() {
    return pet.getBoundingClientRect();
  }

  function layerRect() {
    return root.getBoundingClientRect();
  }

  function applyTransform() {
    pet.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;
  }

  function applyFacing() {
    flip.style.transform = `scaleX(${state.facing})`;
  }

  function updateBubbleSide() {
    const below = state.y < 96;
    if (state.bubbleBelow === below) return;
    state.bubbleBelow = below;
    pet.classList.toggle('is-bubble-below', below);
  }

  function saveHidden() {
    try {
      sessionStorage.setItem('dsh.whale-chan-pet.hidden', state.hidden ? '1' : '0');
    } catch {
      /* session storage may be unavailable */
    }
  }

  function updateHiddenUi() {
    pet.style.display = state.hidden ? 'none' : '';
    pet.setAttribute('aria-hidden', state.hidden ? 'true' : 'false');
    summon.classList.toggle('is-visible', state.hidden);
    summon.tabIndex = state.hidden ? 0 : -1;
    summon.setAttribute('aria-hidden', state.hidden ? 'false' : 'true');
    if (state.hidden) {
      clearTimeout(state.bubbleTimer);
      bubble.classList.remove('is-visible');
    }
  }

  function setHidden(value, opts = {}) {
    if (state.destroyed) return;
    const next = Boolean(value);
    if (state.hidden === next) {
      updateHiddenUi();
      if (opts.persist !== false) saveHidden();
      return;
    }
    if (next) {
      closeSettings();
      clearTimeout(blinkTimeout);
      state.blinking = false;
      freezePosition();
      state.dragging = false;
      state.walkUntil = 0;
    }
    state.hidden = next;
    updateHiddenUi();
    if (!next) {
      layout();
      const now = Date.now();
      if (state.activity.thinking) {
        if (!(state.mode === 'sleep' && state.sleepReason === 'long-think')) {
          state.mode = 'think';
          state.walkUntil = 0;
          state.nextWanderAt = 0;
          renderClasses();
        }
      } else if (state.activity.running) {
        setMode('work', now);
      } else {
        setMode('idle', now);
      }
      maybeBubble('wake', 0.35);
    }
    if (opts.persist !== false) saveHidden();
  }

  function toggleHidden() {
    setHidden(!state.hidden);
  }

  function syncSettingsPanel() {
    const values = {
      size: Math.round(state.settings.size),
      wanderMin: (state.settings.wanderMinMs / 1000).toFixed(1),
      wanderMax: (state.settings.wanderMaxMs / 1000).toFixed(1),
      longThink: Math.round(state.settings.longThinkMs / 1000),
    };
    for (const [name, value] of Object.entries(values)) {
      const input = settingsPanel.querySelector(`input[data-wc-setting="${name}"]`);
      const label = settingsPanel.querySelector(`[data-wc-value="${name}"]`);
      if (input) input.value = String(value);
      if (label) label.textContent = String(value);
    }
  }

  function openSettings() {
    syncSettingsPanel();
    settingsPanel.classList.add('is-open');
    settingsButton.setAttribute('aria-expanded', 'true');
    settingsPanel.querySelector('input')?.focus({ preventScroll: true });
  }

  function closeSettings() {
    settingsPanel.classList.remove('is-open');
    settingsButton.setAttribute('aria-expanded', 'false');
  }

  function onDocumentPointerDown(event) {
    if (!settingsPanel.classList.contains('is-open')) return;
    if (settingsPanel.contains(event.target) || settingsButton.contains(event.target)) return;
    closeSettings();
  }

  function applySettings(patch) {
    const previous = state.settings;
    const next = normalizeSettings({ ...previous, ...patch }, previous);
    const sizeChanged = next.size !== size;
    state.settings = next;
    size = next.size;
    longThinkMs = next.longThinkMs;
    wanderMinMs = next.wanderMinMs;
    wanderMaxMs = next.wanderMaxMs;
    root.style.setProperty('--wc-size', `${size}px`);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* local storage may be unavailable */
    }
    if (sizeChanged && state.initialized) {
      freezePosition();
      clampPosition();
      applyTransform();
      updateBubbleSide();
    }
    scheduleWander(Date.now());
    syncSettingsPanel();
  }

  function resetSettings() {
    applySettings(DEFAULT_SETTINGS);
  }


  let blinkTimeout = 0;

  function startBlink(now) {
    if (state.destroyed || state.hidden || state.dragging) return;
    if (!['idle', 'work', 'happy'].includes(state.mode)) return;
    state.blinking = true;
    state.blinkUntil = now + 140;
    updateSprite();
    clearTimeout(blinkTimeout);
    blinkTimeout = setTimeout(() => {
      if (state.destroyed) return;
      state.blinking = false;
      state.nextBlinkAt = Date.now() + 3500 + Math.random() * 4500;
      updateSprite();
    }, 140);
  }

  function updateSprite() {
    if (state.mode !== 'walk' && state.facing !== 1) {
      state.facing = 1;
      applyFacing();
    }
    let key;
    let source;
    if (state.blinking && state.mode !== 'walk' && state.mode !== 'think' && state.mode !== 'sleep') {
      key = 'blink';
      source = SPRITES.blink || SPRITES.sleep;
    } else if (state.mode === 'walk' && Array.isArray(SPRITES.walk) && SPRITES.walk.length > 0) {
      const index = state.walkFrame % SPRITES.walk.length;
      key = `walk:${index}`;
      source = SPRITES.walk[index];
    } else {
      key = state.mode === 'think' ? 'think' : state.mode === 'sleep' ? 'sleep' : 'idle';
      source = SPRITES[key];
    }
    if (state.spriteKey === key) return;
    state.spriteKey = key;
    spriteImage.src = source;
  }

  function renderClasses() {
    const classes = ['wc-pet', `is-${state.mode}`];
    if (state.mode === 'sleep') classes.push('is-sleeping');
    if (state.mode === 'think') classes.push('is-thinking');
    if (state.mode === 'walk') classes.push('is-walking');
    if (state.mode === 'work') classes.push('is-working');
    if (state.mode === 'happy') classes.push('is-happy');
    if (state.dragging) classes.push('is-dragging');
    if (state.ready) classes.push('is-ready');
    if (state.reducedMotion) classes.push('is-reduced-motion');
    if (state.bubbleBelow) classes.push('is-bubble-below');
    pet.className = classes.join(' ');
    updateSprite();
  }

  function bubbleMessage(text, ms = 2600) {
    if (!text) return;
    bubble.textContent = text;
    bubble.classList.add('is-visible');
    clearTimeout(state.bubbleTimer);
    state.bubbleTimer = setTimeout(() => {
      bubble.classList.remove('is-visible');
    }, ms);
  }

  function maybeBubble(kind, probability = 1) {
    if (Math.random() > probability) return;
    bubbleMessage(pickLine(SPEECH[kind]));
  }

  function scheduleWander(now) {
    state.nextWanderAt = now + rand(wanderMinMs, wanderMaxMs);
  }

  function freezePosition() {
    if (!state.initialized) return;
    const layer = layerRect();
    const rect = petRect();
    state.x = rect.left - layer.left;
    state.y = rect.top - layer.top;
    state.walkUntil = 0;
    pet.style.transitionDuration = '0ms';
    applyTransform();
    updateBubbleSide();
  }

  function clampPosition() {
    const layer = layerRect();
    const width = pet.offsetWidth || size;
    const height = pet.offsetHeight || size;
    state.x = clamp(state.x, 0, Math.max(0, layer.width - width));
    state.y = clamp(state.y, 0, Math.max(0, layer.height - height));
  }

  function layout() {
    if (state.destroyed || state.hidden) return;
    const layer = layerRect();
    const width = pet.offsetWidth || size;
    const height = pet.offsetHeight || size;

    if (!state.initialized) {
      let restored;
      try {
        const raw = localStorage.getItem('dsh.whale-chan-pet.position');
        if (raw) restored = JSON.parse(raw);
      } catch {
        restored = undefined;
      }
      if (initialPosition && Number.isFinite(initialPosition.x) && Number.isFinite(initialPosition.y)) {
        state.x = initialPosition.x;
        state.y = initialPosition.y;
      } else if (restored && Number.isFinite(restored.x) && Number.isFinite(restored.y)) {
        state.x = restored.x;
        state.y = restored.y;
      } else {
        state.x = Math.max(0, layer.width - width - 28);
        state.y = Math.max(0, layer.height - height - bottomClearance);
      }
      state.initialized = true;
      state.ready = true;
      state.nextWanderAt = Date.now() + rand(4000, 8000);
      state.idleSince = Date.now();
      clampPosition();
      applyTransform();
      updateBubbleSide();
      renderClasses();
      return;
    }

    freezePosition();
    clampPosition();
    applyTransform();
    if (state.mode === 'walk') setMode('idle', Date.now());
  }

  function savePosition() {
    try {
      localStorage.setItem(
        'dsh.whale-chan-pet.position',
        JSON.stringify({ x: Math.round(state.x), y: Math.round(state.y) }),
      );
    } catch {
      /* storage may be unavailable in private mode */
    }
  }

  function isUserTyping() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable === true;
  }

  function pickTarget() {
    const layer = layerRect();
    const width = pet.offsetWidth || size;
    const height = pet.offsetHeight || size;
    const maxX = Math.max(0, layer.width - width);
    const maxY = Math.max(0, layer.height - height);
    const minDistance = Math.min(120, Math.max(40, maxX * 0.3));

    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      x = rand(0, maxX);
      const roll = Math.random();
      if (roll < 0.65) {
        y = Math.max(0, maxY - rand(0, Math.min(170, maxY * 0.4)));
      } else if (roll < 0.85) {
        y = rand(maxY * 0.35, Math.max(maxY * 0.35, maxY * 0.65));
      } else {
        y = rand(0, maxY);
      }
      if (Math.hypot(x - state.x, y - state.y) >= minDistance) break;
    }
    return { x, y };
  }

  function setMode(mode, now, opts = {}) {
    if (state.destroyed) return;
    if (mode !== 'drag') state.mode = mode;
    if (mode === 'idle') {
      state.idleSince = now;
      scheduleWander(now);
    } else if (mode === 'work') {
      state.idleSince = now;
      maybeBubble('work', 0.22);
    } else if (mode === 'sleep') {
      state.sleepReason = opts.reason ?? 'nap';
      if (opts.longThink) {
        state.napUntil = 0;
        maybeBubble('longThink', 1);
      } else {
        state.napUntil = now + rand(napMinMs, napMaxMs);
        maybeBubble('sleep', 0.8);
      }
    }
    renderClasses();
  }

  function wake(now, nextMode) {
    state.sleepReason = null;
    state.napUntil = 0;
    setMode(nextMode, now);
    maybeBubble('wake', 0.45);
  }

  function enterThink(now) {
    freezePosition();
    state.mode = 'think';
    state.sleepReason = null;
    state.napUntil = 0;
    state.thinkingSince = now;
    state.walkUntil = 0;
    state.nextWanderAt = 0;
    renderClasses();
    maybeBubble('think', 0.6);
  }

  function startWalk(now) {
    if (state.destroyed || state.hidden || state.dragging) return;
    if (state.reducedMotion) {
      scheduleWander(now);
      return;
    }
    const target = pickTarget();
    const dx = target.x - state.x;
    const dy = target.y - state.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 24) {
      scheduleWander(now);
      return;
    }
    const durationMs = Math.round(clamp((distance / walkSpeed) * 1000, 900, 4500));
    state.facing = dx >= 0 ? 1 : -1;
    applyFacing();
    state.x = target.x;
    state.y = target.y;
    state.mode = 'walk';
    state.walkFrame = 0;
    state.walkUntil = now + durationMs;
    updateBubbleSide();
    renderClasses();
    void pet.offsetWidth;
    pet.style.transitionDuration = `${durationMs}ms`;
    applyTransform();
  }

  function setActivity(next) {
    if (state.destroyed) return;
    const previous = state.activity;
    state.activity = { ...previous, ...next };
    const now = Date.now();

    if (state.activity.thinking && !previous.thinking) state.thinkingSince = now;
    if (!state.activity.thinking) state.thinkingSince = 0;
    if (state.hidden) return;

    if (state.activity.thinking && !previous.thinking) {
      enterThink(now);
    } else if (!state.activity.thinking && previous.thinking) {
      if (state.mode === 'think' || (state.mode === 'sleep' && state.sleepReason === 'long-think')) {
        wake(now, state.activity.running ? 'work' : 'idle');
      }
    }

    if (state.activity.running && !previous.running) {
      state.idleSince = now;
      if (state.mode === 'sleep' && state.sleepReason === 'nap') wake(now, 'work');
      else if (state.mode === 'idle') setMode('work', now);
    }

    if (!state.activity.running && previous.running) {
      state.idleSince = now;
      if (state.mode === 'work') setMode('idle', now);
    }

    if (!state.activity.visible && state.mode === 'walk') {
      freezePosition();
      setMode('idle', now);
    }
  }

  function petIt(now = Date.now()) {
    if (state.destroyed || state.hidden) return;
    if (state.mode === 'sleep') wake(now, state.activity.running ? 'work' : 'idle');
    pet.classList.remove('is-happy');
    void pet.offsetWidth;
    state.mode = 'happy';
    state.happyUntil = now + 1200;
    state.idleSince = now;
    renderClasses();
    bubbleMessage(pickLine(SPEECH.pet), 1800);
  }

  function tick() {
    if (state.destroyed || state.hidden || state.dragging) return;
    if (!ignoreHidden && typeof document !== 'undefined' && document.hidden) return;
    const now = Date.now();

    if (state.activity.thinking) {
      if (state.mode === 'sleep' && state.sleepReason === 'long-think') {
        return;
      }
      if (state.mode !== 'think' && state.mode !== 'happy') {
        enterThink(now);
        return;
      }
      if (state.mode === 'think' && now - state.thinkingSince > longThinkMs) {
        freezePosition();
        state.mode = 'sleep';
        state.sleepReason = 'long-think';
        state.napUntil = 0;
        renderClasses();
        maybeBubble('longThink', 1);
      }
      return;
    }

    if (state.mode === 'think') {
      setMode(state.activity.running ? 'work' : 'idle', now);
      return;
    }

    if (state.mode === 'sleep' && state.sleepReason === 'long-think') {
      wake(now, state.activity.running ? 'work' : 'idle');
      return;
    }

    if (state.mode === 'walk' && now >= state.walkUntil) {
      setMode('idle', now);
      return;
    }

    if (state.mode === 'work' && !state.activity.running) {
      setMode('idle', now);
      return;
    }

    if (state.mode === 'idle') {
      if (state.activity.running) {
        setMode('work', now);
        return;
      }
      if (state.activity.visible && !isUserTyping() && now >= state.nextWanderAt) {
        startWalk(now);
        return;
      }
      if (now - state.idleSince > napAfterMs && now >= state.nextNapCheck) {
        state.nextNapCheck = now + 30000;
        if (Math.random() < 0.35) {
          state.mode = 'sleep';
          state.sleepReason = 'nap';
          state.napUntil = now + rand(napMinMs, napMaxMs);
          renderClasses();
          maybeBubble('sleep', 0.9);
          return;
        }
      }
    }

    if (state.mode === 'sleep' && state.sleepReason === 'nap') {
      if (now >= state.napUntil || state.activity.running || state.activity.thinking) {
        wake(now, state.activity.thinking ? 'think' : state.activity.running ? 'work' : 'idle');
        if (state.activity.thinking) enterThink(now);
      }
    }

    if (state.mode === 'happy' && now >= state.happyUntil) {
      setMode(state.activity.running ? 'work' : 'idle', now);
    }
  }

  function onPointerDown(event) {
    if (state.destroyed || state.hidden || event.button !== 0) return;
    event.preventDefault();
    if (state.mode === 'sleep') wake(Date.now(), state.activity.running ? 'work' : 'idle');
    freezePosition();
    const rect = petRect();
    state.dragging = true;
    state.dragOffsetX = event.clientX - rect.left;
    state.dragOffsetY = event.clientY - rect.top;
    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;
    state.dragMoved = false;
    pet.style.transitionDuration = '0ms';
    renderClasses();
    try {
      sprite.setPointerCapture(event.pointerId);
    } catch {
      /* some WebViews do not support capture */
    }
  }

  function onPointerMove(event) {
    if (!state.dragging) return;
    const dx = event.clientX - state.dragStartX;
    const dy = event.clientY - state.dragStartY;
    if (Math.hypot(dx, dy) > 4) state.dragMoved = true;
    const layer = layerRect();
    const width = pet.offsetWidth || size;
    const height = pet.offsetHeight || size;
    state.x = clamp(event.clientX - layer.left - state.dragOffsetX, 0, Math.max(0, layer.width - width));
    state.y = clamp(event.clientY - layer.top - state.dragOffsetY, 0, Math.max(0, layer.height - height));
    applyTransform();
    updateBubbleSide();
  }

  function releaseDrag(event, clicked) {
    if (!state.dragging) return;
    state.dragging = false;
    try {
      if (event && sprite.hasPointerCapture?.(event.pointerId)) sprite.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    savePosition();
    if (clicked && !state.dragMoved) {
      petIt();
    } else {
      setMode(state.activity.running ? 'work' : 'idle', Date.now());
    }
    renderClasses();
  }

  function onPointerUp(event) {
    releaseDrag(event, true);
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && settingsPanel.classList.contains('is-open')) {
      event.preventDefault();
      closeSettings();
      return;
    }
    if (!event.altKey || !event.shiftKey || event.code !== 'KeyW') return;
    if (event.repeat || event.ctrlKey || event.metaKey) return;
    if (event.defaultPrevented || isUserTyping()) return;
    event.preventDefault();
    toggleHidden();
  }

  function onPointerCancel(event) {
    releaseDrag(event, false);
  }

  function onResize() {
    layout();
  }

  function onVisibility() {
    if (!document.hidden) {
      state.nextWanderAt = Date.now() + wanderMinMs;
    }
  }

  sprite.addEventListener('pointerdown', onPointerDown);
  sprite.addEventListener('pointermove', onPointerMove);
  sprite.addEventListener('pointerup', onPointerUp);
  sprite.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  window.addEventListener('keydown', onKeyDown);

  let observer;
  if (typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(() => layout());
    observer.observe(root);
  }

  const timer = setInterval(tick, 250);
  const walkTimer = setInterval(() => {
    if (state.destroyed || state.hidden || state.dragging) return;
    if (state.mode !== 'walk' || !Array.isArray(SPRITES.walk) || SPRITES.walk.length === 0) return;
    state.walkFrame = (state.walkFrame + 1) % SPRITES.walk.length;
    updateSprite();
  }, 140);
  const blinkTimer = setInterval(() => {
    if (state.destroyed || state.hidden || state.dragging || state.blinking) return;
    if (!['idle', 'work', 'happy'].includes(state.mode)) return;
    if (Date.now() < state.nextBlinkAt) return;
    startBlink(Date.now());
  }, 500);

  // Measure immediately so the pet is visible at its corner from the first
  // paint; the frame callback covers late layout in React/preview mounts.
  layout();
  state.hidden = initiallyHidden;
  updateHiddenUi();
  requestAnimationFrame(() => {
    if (!state.destroyed) layout();
  });

  return {
    setActivity,
    poke: () => petIt(),
    getSettings: () => ({ ...state.settings }),
    setSettings: (patch) => applySettings(patch),
    resetSettings,
    openSettings,
    closeSettings,
    setHidden,
    toggleHidden,
    previewBlink: () => {
      state.blinking = true;
      state.blinkUntil = Date.now() + 100000;
      renderClasses();
    },
    previewWalk: () => {
      state.mode = 'walk';
      state.walkFrame = 0;
      state.walkUntil = Date.now() + 100000;
      state.nextWanderAt = 0;
      renderClasses();
    },
    forceMode: (mode) => {
      const now = Date.now();
      if (mode === 'think') enterThink(now);
      else if (mode === 'sleep') setMode('sleep', now, { reason: 'nap' });
      else if (mode === 'work') setMode('work', now);
      else if (mode === 'walk') startWalk(now);
      else setMode('idle', now);
    },
    destroy() {
      state.destroyed = true;
      clearInterval(timer);
      clearTimeout(state.bubbleTimer);
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      clearInterval(walkTimer);
      clearInterval(blinkTimer);
      clearTimeout(blinkTimeout);
      sprite.removeEventListener('pointerdown', onPointerDown);
      sprite.removeEventListener('pointermove', onPointerMove);
      sprite.removeEventListener('pointerup', onPointerUp);
      sprite.removeEventListener('pointercancel', onPointerCancel);
      root.replaceChildren();
    },
    getState: () => ({
      ...state,
      activity: { ...state.activity },
      settings: { ...state.settings },
      element: pet,
    }),
  };
}
