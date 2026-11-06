import { createPetController } from '../src/client/controller.js';

const stage = document.getElementById('stage');
const status = document.getElementById('status');
const debug = document.getElementById('debug');
const params = new URLSearchParams(location.search);
const showDebug = params.get('debug') === '1';
if (showDebug) debug.style.display = 'block';
window.__whalePreviewLoaded = true;

const controller = createPetController(stage, {
  size: 210,
  longThinkMs: params.get('longthink') === '0' ? 0 : 20000,
  napAfterMs: 30000,
  wanderMinMs: 9000,
  wanderMaxMs: 22000,
  walkSpeed: 20,
  ignoreReducedMotion: true,
  ignoreHidden: true,
});

function setActivity(activity) {
  controller.setActivity({ visible: true, ...activity });
}

const initial = params.get('state');
if (params.get('panel') === '1') controller.openSettings();
if (initial === 'think') {
  setActivity({ running: true, thinking: true });
} else if (initial === 'work') {
  setActivity({ running: true, thinking: false });
} else if (initial === 'sleep') {
  setActivity({ running: false, thinking: false });
  controller.forceMode('sleep');
} else if (initial === 'idle') {
  setActivity({ running: false, thinking: false });
} else if (initial === 'walk') {
  setActivity({ running: false, thinking: false });
  setTimeout(() => controller.previewWalk(), 250);
} else if (initial === 'blink') {
  setActivity({ running: false, thinking: false });
  setTimeout(() => controller.previewBlink(), 250);
} else if (initial === 'nap') {
  setActivity({ running: false, thinking: false });
  controller.forceMode('nap');
}
const previewSize = Number(params.get('size'));
if (Number.isFinite(previewSize) && previewSize > 0) controller.setSettings({ size: previewSize });
if (params.get('hidden') === '1') controller.setHidden(true);
if (params.get('showhide') === '1') document.querySelector('.wc-pet')?.classList.add('force-hide');

for (const button of document.querySelectorAll('button[data-mode]')) {
  button.addEventListener('click', () => {
    switch (button.dataset.mode) {
      case 'idle':
        setActivity({ running: false, thinking: false });
        controller.forceMode('idle');
        break;
      case 'work':
        setActivity({ running: true, thinking: false });
        controller.forceMode('work');
        break;
      case 'think':
        setActivity({ running: true, thinking: true });
        break;
      case 'long':
        setActivity({ running: true, thinking: true });
        break;
      case 'sleep':
        setActivity({ running: false, thinking: false });
        controller.forceMode('sleep');
        break;
      case 'pet':
        controller.poke();
        break;
      case 'walk':
        setTimeout(() => controller.previewWalk(), 250);
        break;
      case 'hide':
        controller.setHidden(true);
        break;
      default:
        break;
    }
  });
}

setInterval(() => {
  const state = controller.getState();
  const flags = state.hidden ? 'hidden' : state.activity.thinking ? 'thinking' : state.activity.running ? 'working' : 'idle';
  status.textContent = `${state.mode} · ${flags}`;
  if (showDebug) {
    const rect = stage.getBoundingClientRect();
    debug.textContent = `x=${Math.round(state.x)} y=${Math.round(state.y)} layer=${Math.round(rect.width)}x${Math.round(rect.height)}`;
  }
}, 250);
