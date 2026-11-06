/**
 * Activity interpretation for the pet.
 *
 * These helpers are deliberately DOM-free so they can be unit-tested and
 * reused by the preview harness.
 */

/** The Session shown by the main conversation view, if one is retained. */
export function findMainSession(listState) {
  if (!listState || !Array.isArray(listState.ids)) return undefined;
  for (const id of listState.ids) {
    const row = listState.byId?.[id];
    if ((row?.retainedBy?.mainView ?? 0) > 0) return id;
  }
  return undefined;
}

/**
 * Decide whether one Session event says "the model is currently reasoning".
 * @returns true (reasoning), false (definitely not reasoning), or undefined
 *          (not decisive; keep looking at the previous event).
 */
export function thinkingVerdict(event) {
  if (!event || typeof event.type !== 'string') return undefined;
  switch (event.type) {
    case 'assistant/live-chunk': {
      const chunk = event.data?.chunk;
      if (!chunk) return undefined;
      switch (chunk.type) {
        case 'reasoning-delta':
          return typeof chunk.text === 'string' && chunk.text !== '' ? true : undefined;
        case 'text-delta':
          return typeof chunk.text === 'string' && chunk.text !== '' ? false : undefined;
        case 'tool-call-delta':
          return false;
        case 'block-start':
          if (chunk.blockType === 'reasoning') return true;
          if (chunk.blockType === 'text' || chunk.blockType === 'tool-call') return false;
          return undefined;
        case 'block-end':
          return undefined;
        case 'finish':
          return false;
        default:
          return undefined;
      }
    }
    case 'assistant/message':
    case 'assistant/attempt':
    case 'turn/end':
    case 'turn/start':
    case 'step/start':
    case 'tool/call':
    case 'user/message':
      return false;
    default:
      return undefined;
  }
}

/**
 * Read the newest decisive event in a Session window. Used after a full
 * replacement or an initial history load; live chunks are transient, so a
 * historical window normally yields false.
 */
export function scanForThinking(entries) {
  if (!Array.isArray(entries)) return false;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    const event = entry?.event ?? entry;
    const verdict = thinkingVerdict(event);
    if (verdict !== undefined) return verdict;
  }
  return false;
}

/**
 * Apply one Session event-window change to the current thinking value.
 *
 * A replacement (or older-history prepend) re-scans the complete loaded window;
 * an append only inspects the newly arrived entries. Settlement always means
 * the assistant attempt is no longer streaming reasoning.
 *
 * @param previous - current thinking value.
 * @param change - latest window change.
 * @param fullEntries - complete window entries, required for replace/prepend.
 * @returns the next thinking value.
 */
export function applyThinkingChange(previous, change, fullEntries) {
  if (!change) return previous;
  if (change.kind === 'settle-assistant') return false;
  if (change.kind === 'replace' || change.kind === 'prepend') {
    return scanForThinking(fullEntries ?? change.entries);
  }
  let next = previous;
  for (const entry of change.entries ?? []) {
    const event = entry?.event ?? entry;
    const verdict = thinkingVerdict(event);
    if (verdict !== undefined) next = verdict;
  }
  return next;
}
