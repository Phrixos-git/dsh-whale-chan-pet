import { createPetController } from './controller.js';
import { applyThinkingChange, findMainSession } from './activity.js';

/** Required client services: slot registry, Session objects, and the Session UI adapter. */
export const inject = ['slots', 'sessions', 'uiSession'];

const STYLE_ID = 'dsh-whale-chan-pet/styles';

function installStyles(ctx) {
  const install = () => {
    if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)) return () => {};
    const style = document.createElement('style');
    style.dataset.plugin = 'dsh-whale-chan-pet';
    style.dataset.pluginCss = STYLE_ID;
    style.textContent = ART_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  };
  if (typeof ctx.effect === 'function') return ctx.effect(install, 'whale-chan-pet: styles');
  return install();
}

/**
 * Follow the current main Session's live reasoning stream.
 *
 * The event window contains durable Session events and client-only live chunks.
 * A reasoning delta means "thinking"; the next text/tool/turn event means it
 * stopped. No message text is read or stored.
 */
function useThinking(ctx, sessionId, running) {
  const [thinking, setThinking] = React.useState(false);
  const valueRef = React.useRef(false);

  const publish = React.useCallback((next) => {
    if (valueRef.current === next) return;
    valueRef.current = next;
    setThinking(next);
  }, []);

  React.useEffect(() => {
    publish(false);
    if (!sessionId) return undefined;

    let binding;
    try {
      binding = ctx.sessions.binding(sessionId);
    } catch {
      binding = undefined;
    }
    if (!binding?.eventSource) return undefined;

    const source = binding.eventSource;
    const evaluate = () => {
      const window = source.getSnapshot();
      if (!window) {
        publish(false);
        return;
      }
      publish(applyThinkingChange(valueRef.current, window.change, window.entries));
    };

    evaluate();
    return source.subscribe(evaluate);
  }, [ctx, sessionId, publish]);

  React.useEffect(() => {
    if (running === false) publish(false);
  }, [running, publish]);

  return thinking;
}

function WhaleChanView({ activity }) {
  const rootRef = React.useRef(null);
  const controllerRef = React.useRef(null);

  React.useEffect(() => {
    const controller = createPetController(rootRef.current);
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    controllerRef.current?.setActivity(activity);
  }, [activity]);

  return React.createElement('div', {
    ref: rootRef,
    className: 'wc-layer',
    style: { pointerEvents: 'none' },
    'data-whale-chan-pet': 'true',
  });
}

function createOverlay(ctx) {
  function WhaleChanOverlay(props) {
    const { useSessions, useSessionStatus, usePanelInfo } = props;
    const sessionId = useSessions(findMainSession);
    const running = useSessionStatus((snapshot) =>
      sessionId === undefined ? undefined : snapshot.get(sessionId)?.running,
    );
    const panel = usePanelInfo((info) => info.activePanelId);
    const thinking = useThinking(ctx, sessionId, running);

    const activity = React.useMemo(
      () => ({
        sessionId,
        running: running === true,
        thinking,
        visible: panel === undefined || panel === null || panel === 'conversation',
      }),
      [sessionId, running, thinking, panel],
    );

    return React.createElement(WhaleChanView, { activity });
  }
  return WhaleChanOverlay;
}

/**
 * Register the frame-wide overlay entry. The pet lives in `shell.overlay`, so
 * it survives Session switches and stays above the three-column frame.
 */
export function apply(ctx) {
  installStyles(ctx);
  const Overlay = createOverlay(ctx);
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'whale-chan-pet',
      },
      Overlay,
    ),
  );
}
