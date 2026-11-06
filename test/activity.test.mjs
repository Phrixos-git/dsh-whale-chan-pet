import test from 'node:test';
import assert from 'node:assert/strict';
import { applyThinkingChange, findMainSession, scanForThinking, thinkingVerdict } from '../src/client/activity.js';

test('findMainSession picks the Session retained by the main view', () => {
  const list = {
    ids: ['a', 'b', 'c'],
    byId: {
      a: { retainedBy: { workspace: 1 } },
      b: { retainedBy: { mainView: 1 } },
      c: { retainedBy: {} },
    },
  };
  assert.equal(findMainSession(list), 'b');
  assert.equal(findMainSession({ ids: [], byId: {} }), undefined);
  assert.equal(findMainSession(undefined), undefined);
});

test('reasoning deltas start thinking and text/tool deltas stop it', () => {
  assert.equal(
    thinkingVerdict({ type: 'assistant/live-chunk', data: { chunk: { type: 'reasoning-delta', text: 'む' } } }),
    true,
  );
  assert.equal(
    thinkingVerdict({ type: 'assistant/live-chunk', data: { chunk: { type: 'text-delta', text: 'こんにちは' } } }),
    false,
  );
  assert.equal(
    thinkingVerdict({ type: 'assistant/live-chunk', data: { chunk: { type: 'tool-call-delta', argumentsDelta: '{' } } }),
    false,
  );
  assert.equal(
    thinkingVerdict({ type: 'assistant/live-chunk', data: { chunk: { type: 'block-start', blockType: 'reasoning' } } }),
    true,
  );
  assert.equal(
    thinkingVerdict({ type: 'assistant/live-chunk', data: { chunk: { type: 'block-start', blockType: 'text' } } }),
    false,
  );
});

test('durable boundaries settle thinking', () => {
  for (const type of ['assistant/message', 'assistant/attempt', 'turn/end', 'tool/call', 'user/message']) {
    assert.equal(thinkingVerdict({ type }), false, type);
  }
  assert.equal(thinkingVerdict({ type: 'request/header' }), undefined);
});

test('empty reasoning delta is not decisive', () => {
  assert.equal(
    thinkingVerdict({ type: 'assistant/live-chunk', data: { chunk: { type: 'reasoning-delta', text: '' } } }),
    undefined,
  );
});

test('scanForThinking uses the newest decisive event', () => {
  const entries = [
    { type: 'event', event: { type: 'assistant/live-chunk', data: { chunk: { type: 'reasoning-delta', text: 'a' } } } },
    { type: 'event', event: { type: 'assistant/live-chunk', data: { chunk: { type: 'text-delta', text: 'b' } } } },
  ];
  assert.equal(scanForThinking(entries), false);

  const reversed = [
    { type: 'event', event: { type: 'assistant/message' } },
    { type: 'transient', event: { type: 'assistant/live-chunk', data: { chunk: { type: 'reasoning-delta', text: 'a' } } } },
  ];
  assert.equal(scanForThinking(reversed), true);

  assert.equal(scanForThinking([]), false);
  assert.equal(scanForThinking(undefined), false);
});

test('applyThinkingChange handles append, replace, prepend, and settlement', () => {
  const reasoning = {
    type: 'event',
    event: { type: 'assistant/live-chunk', data: { chunk: { type: 'reasoning-delta', text: 'a' } } },
  };
  const text = {
    type: 'event',
    event: { type: 'assistant/live-chunk', data: { chunk: { type: 'text-delta', text: 'b' } } },
  };

  assert.equal(applyThinkingChange(false, { kind: 'append', entries: [reasoning] }), true);
  assert.equal(applyThinkingChange(true, { kind: 'append', entries: [text] }), false);
  assert.equal(applyThinkingChange(true, { kind: 'settle-assistant' }), false);
  assert.equal(applyThinkingChange(false, { kind: 'replace', entries: [text, reasoning] }, [text, reasoning]), true);
  assert.equal(
    applyThinkingChange(true, { kind: 'prepend', entries: [reasoning] }, [reasoning, text]),
    false,
  );
});
