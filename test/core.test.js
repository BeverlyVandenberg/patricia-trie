import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PatriciaTrie } from '../src/index.js';

test('insert and has on a simple key', () => {
  const t = new PatriciaTrie();
  t.insert('hello', 1);
  assert.equal(t.has('hello'), true);
  assert.equal(t.has('hell'), false);
  assert.equal(t.has('hello!'), false);
  assert.equal(t.size, 1);
});

test('get returns the stored value', () => {
  const t = new PatriciaTrie();
  t.insert('apple', 'fruit');
  assert.equal(t.get('apple'), 'fruit');
  assert.equal(t.get('appl'), undefined);
  assert.equal(t.get('applez'), undefined);
});

test('inserting a key that is a strict prefix of an existing key marks the prefix as present', () => {
  // This is the classic "awkward" case for a trie: 'app' and 'apple' share a
  // path but both must be independently queryable. Our split-with-terminal
  // path handles it.
  const t = new PatriciaTrie();
  t.insert('apple', 1);
  t.insert('app', 2);
  assert.equal(t.has('app'), true);
  assert.equal(t.has('apple'), true);
  assert.equal(t.get('app'), 2);
  assert.equal(t.get('apple'), 1);
  assert.equal(t.size, 2);
});

test('inserting a key that extends an existing key splits the edge', () => {
  const t = new PatriciaTrie();
  t.insert('app', 1);
  t.insert('apple', 2);
  assert.equal(t.has('app'), true);
  assert.equal(t.has('apple'), true);
  assert.equal(t.get('app'), 1);
  assert.equal(t.get('apple'), 2);
});

test('inserting a key that diverges mid-edge creates a branch', () => {
  const t = new PatriciaTrie();
  t.insert('romane', 1);
  t.insert('romanus', 2);
  t.insert('romulus', 3);
  assert.equal(t.has('romane'), true);
  assert.equal(t.has('romanus'), true);
  assert.equal(t.has('romulus'), true);
  assert.equal(t.has('rom'), false);
  assert.equal(t.get('romane'), 1);
  assert.equal(t.get('romanus'), 2);
  assert.equal(t.get('romulus'), 3);
  assert.equal(t.size, 3);
});

test('overwriting an existing key updates the value but not the size', () => {
  const t = new PatriciaTrie();
  t.insert('k', 1);
  t.insert('k', 2);
  assert.equal(t.size, 1);
  assert.equal(t.get('k'), 2);
});

test('empty string is a valid key and distinct from an empty trie', () => {
  const t = new PatriciaTrie();
  assert.equal(t.has(''), false);
  t.insert('', 'empty');
  assert.equal(t.has(''), true);
  assert.equal(t.get(''), 'empty');
  assert.equal(t.size, 1);
  // A trie with the empty key plus other keys should still answer both.
  t.insert('a', 1);
  assert.equal(t.has(''), true);
  assert.equal(t.has('a'), true);
  assert.equal(t.size, 2);
});

test('insert with value undefined still adds the key', () => {
  const t = new PatriciaTrie();
  t.insert('ghost', undefined);
  assert.equal(t.has('ghost'), true);
  assert.equal(t.get('ghost'), undefined);
  assert.equal(t.size, 1);
});

test('keys returns all stored keys in lexicographic order', () => {
  const t = new PatriciaTrie();
  const keys = ['banana', 'apple', 'cherry', 'app', 'apply'];
  for (const k of keys) t.insert(k, null);
  const out = t.keys();
  // UTF-16 code-unit order: shorter prefix sorts before its extensions.
  assert.deepEqual(out, ['app', 'apple', 'apply', 'banana', 'cherry']);
});

test('remove an existing key and verify it is gone', () => {
  const t = new PatriciaTrie();
  t.insert('alpha', 1);
  t.insert('beta', 2);
  assert.equal(t.remove('alpha'), true);
  assert.equal(t.has('alpha'), false);
  assert.equal(t.has('beta'), true);
  assert.equal(t.size, 1);
});

test('remove a missing key returns false and leaves the trie intact', () => {
  const t = new PatriciaTrie();
  t.insert('alpha', 1);
  assert.equal(t.remove('omega'), false);
  assert.equal(t.size, 1);
  assert.equal(t.has('alpha'), true);
});

test('remove the empty-string key', () => {
  const t = new PatriciaTrie();
  t.insert('', 'empty');
  assert.equal(t.remove(''), true);
  assert.equal(t.has(''), false);
  assert.equal(t.size, 0);
});

test('clear empties the trie', () => {
  const t = new PatriciaTrie();
  t.insert('a', 1);
  t.insert('ab', 2);
  t.insert('abc', 3);
  t.clear();
  assert.equal(t.size, 0);
  assert.equal(t.has('a'), false);
  assert.deepEqual(t.keys(), []);
});

test('keys returns a fresh array each call', () => {
  const t = new PatriciaTrie();
  t.insert('x', 1);
  const a = t.keys();
  const b = t.keys();
  assert.notEqual(a, b);
  a.push('mutated');
  assert.deepEqual(b, ['x']);
});
