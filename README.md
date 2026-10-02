patricia-trie — a zero-dependency ES module implementing a Patricia (radix) trie that compresses single-child paths for compact storage of sparse string sets.

## Usage

```js
import { PatriciaTrie } from './src/index.js';

const t = new PatriciaTrie();
t.insert('apple', 1);
t.insert('app', 2);
t.insert('apply', 3);

t.has('app');    // true
t.get('apple');  // 1
t.keys();        // ['app', 'apple', 'apply']
t.size;          // 3
t.remove('app'); // true
t.clear();
```

## Why

A naive trie stores one node per character per key, so for a set of a few thousand sparse strings the node count balloons well past what the data warrants. A Patricia trie collapses chains of single-child edges into shared label strings, which keeps the node count proportional to the number of *branch points* plus the number of keys, not to the total character count. The trade-off: every insert may split an existing edge, and removal leaves edges un-recompressed (correctness preserved, structure slightly looser). This library targets the build-once / query-many workflow — lookups are O(key length) regardless of how full the trie is.

## Keys and the awkward edge

Keys are JavaScript strings and edges are compared one UTF-16 code unit at a time (via `charCodeAt`). Multi-byte code points (e.g. emoji) therefore occupy two edges internally; this is documented rather than papered over. The empty string is a valid key: it is stored as a terminal flag on the root and is distinguishable from an empty trie. `get` returns `undefined` both for missing keys and for present keys whose stored value is `undefined` — call `has` first if you need to tell them apart. On removal we do not re-compress parent edges; the trie stays correct but may be slightly less compact than one built fresh.

## API

- `new PatriciaTrie()` — empty trie.
- `trie.insert(key: string, value?: any)` — add or overwrite a key. `value` defaults to `undefined`; the key is still considered present.
- `trie.has(key: string): boolean`
- `trie.get(key: string): any` — stored value, or `undefined` if absent (see note above).
- `trie.remove(key: string): boolean` — true if a key was removed, false if it was absent.
- `trie.keys(): string[]` — all stored keys in lexicographic (UTF-16 code-unit) order. Fresh array each call.
- `trie.clear()` — remove everything.
- `trie.size: number` — number of stored keys.
