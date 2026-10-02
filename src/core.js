/**
 * Core Patricia trie implementation.
 *
 * Design decisions:
 * - Keys are JS strings; each char is a UTF-16 code unit (charCodeAt). Multi-byte
 *   code points therefore occupy two edges. This keeps slicing O(1) and avoids
 *   dragging in a UTF-8 decoder. We document this explicitly.
 * - A "key" passed to insert is stored verbatim; empty-string key is a valid member
 *   and represented by a terminal flag on the root. This is the awkward edge: a trie
 *   whose root has no edges still must distinguish {\"\"} from {}.
 * - Values may be any JS value, including undefined. Presence is tracked by an
 *   internal "terminal" flag rather than by checking for undefined, so insert(k, undefined)
 *   genuinely adds the key.
 * - has/get return primitives; get returns undefined for both "missing" and for a
 *   present key whose stored value is undefined. Callers needing that distinction
 *   should use has() first. We picked this over returning a sentinel object to keep
 *   the API flat and predictable.
 */

/**
 * @typedef {Object} TrieNode
 * @property {Record<number, TrieNode>} children  keyed by first char code
 * @property {string} label                           shared edge string
 * @property {boolean} terminal                        end-of-key marker
 * @property {any} value                              stored value for the key
 */

/**
 * Internal: find the common prefix length of two strings.
 * Iterates code unit by code unit.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function commonPrefixLength(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) {
    i += 1;
  }
  return i;
}

/**
 * Internal: split an existing child's edge at the given prefix length.
 * Modifies `child` in place: it becomes the middle node holding the suffix.
 *
 * @param {TrieNode} child
 * @param {number} prefixLen
 * @returns {TrieNode} the new parent node (middle of the split)
 */
function splitChild(child, prefixLen) {
  const suffix = child.label.slice(prefixLen);
  const middle = {
    children: {},
    label: child.label.slice(0, prefixLen),
    terminal: false,
    value: undefined,
  };
  child.label = suffix;
  // Only relocate child if the suffix is non-empty. If suffix is empty the
  // child was the exact terminal for its prior key; its terminal flag is
  // preserved and it has no children to move.
  if (suffix.length > 0) {
    const childCode = suffix.charCodeAt(0);
    middle.children[childCode] = child;
  } else {
    // suffix collapsed entirely; fold child's terminal/value into middle.
    middle.terminal = child.terminal;
    middle.value = child.value;
    // Transfer any grandchildren the child happened to have (possible if a
    // previous split left a zero-suffix node). Keeps the structure valid.
    for (const k of Object.keys(child.children)) {
      middle.children[Number(k)] = child.children[k];
    }
  }
  return middle;
}

export class PatriciaTrie {
  constructor() {
    /** @type {TrieNode} */
    this.root = {
      children: {},
      label: '',
      terminal: false,
      value: undefined,
    };
    /** @type {number} */
    this._size = 0;
  }

  /** @returns {number} number of stored keys */
  get size() {
    return this._size;
  }

  /**
   * Insert a key with an associated value. Overwrites an existing key's value
   * without changing the size. value defaults to undefined but the key is still
   * considered present.
   *
   * @param {string} key
   * @param {any} [value=undefined]
   * @returns {void}
   */
  insert(key, value = undefined) {
    if (typeof key !== 'string') {
      throw new TypeError('PatriciaTrie.insert: key must be a string');
    }

    // Root-level empty key: the one case where we touch root's terminal flag
    // rather than traversing an edge.
    if (key.length === 0) {
      if (!this.root.terminal) {
        this.root.terminal = true;
        this._size += 1;
      }
      this.root.value = value;
      return;
    }

    let node = this.root;
    let remaining = key;

    while (remaining.length > 0) {
      const code = remaining.charCodeAt(0);
      const child = node.children[code];

      if (!child) {
        // No edge for this prefix: hang a fresh leaf with the whole remainder.
        node.children[code] = {
          children: {},
          label: remaining,
          terminal: true,
          value,
        };
        this._size += 1;
        return;
      }

      const cp = commonPrefixLength(remaining, child.label);

      if (cp === child.label.length) {
        // Edge fully consumed: descend into child and keep inserting the tail.
        remaining = remaining.slice(cp);
        node = child;
        continue;
      }

      if (cp === 0) {
        // Should be unreachable because we dispatch on the first code unit,
        // but guard defensively against label corruption.
        throw new Error('PatriciaTrie: invariant violation (zero common prefix)');
      }

      // Partial match: split the child's edge at cp.
      const middle = splitChild(child, cp);
      node.children[code] = middle;

      if (cp === remaining.length) {
        // Remaining key is consumed exactly by the new middle node's label.
        if (!middle.terminal) {
          middle.terminal = true;
          this._size += 1;
        }
        middle.value = value;
        return;
      }

      // Key still has a tail beyond the split: add a fresh sibling leaf.
      const tail = remaining.slice(cp);
      middle.children[tail.charCodeAt(0)] = {
        children: {},
        label: tail,
        terminal: true,
        value,
      };
      this._size += 1;
      return;
    }

    // We consumed the key exactly by landing on an existing node whose edge
    // was a strict prefix of nothing-left-to-consume. Mark it terminal.
    if (!node.terminal) {
      node.terminal = true;
      this._size += 1;
    }
    node.value = value;
  }

  /**
   * Resolve the node that represents `key`, or null if the key is absent.
   *
   * @param {string} key
   * @returns {TrieNode|null}
   */
  _findNode(key) {
    if (typeof key !== 'string') return null;
    if (key.length === 0) {
      return this.root.terminal ? this.root : null;
    }

    let node = this.root;
    let remaining = key;

    while (remaining.length > 0) {
      const code = remaining.charCodeAt(0);
      const child = node.children[code];
      if (!child) return null;

      if (remaining.startsWith(child.label)) {
        remaining = remaining.slice(child.label.length);
        node = child;
        continue;
      }
      return null;
    }

    return node.terminal ? node : null;
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this._findNode(key) !== null;
  }

  /**
   * @param {string} key
   * @returns {any} the stored value, or undefined if the key is absent.
   *   Note: a present key whose value is undefined also returns undefined;
   *   use has() to disambiguate.
   */
  get(key) {
    const node = this._findNode(key);
    return node === null ? undefined : node.value;
  }

  /**
   * Remove a key. Returns true if something was removed, false if the key was
   * not present. Does not re-compress parent edges on removal: correctness is
n   * preserved, the trie may be slightly looser than a freshly built one. We
   * chose simplicity over re-compression because the common workflow is
   * build-once/query-many.
   *
   * @param {string} key
   * @returns {boolean}
   */
  remove(key) {
    const node = this._findNode(key);
    if (node === null) return false;

    // Root-level empty key special case.
    if (node === this.root) {
      this.root.terminal = false;
      this.root.value = undefined;
      this._size -= 1;
      return true;
    }

    node.terminal = false;
    node.value = undefined;
    this._size -= 1;
    return true;
  }

  /**
   * Return all stored keys in lexicographic order (by UTF-16 code unit).
   * Result is a fresh array; callers may mutate it freely.
   *
   * @returns {string[]}
   */
  keys() {
    /** @type {string[]} */
    const out = [];
    const visit = (node, prefix) => {
      if (node.terminal) out.push(prefix);
      // Iterate children in ascending first-char order for determinism.
      const codes = Object.keys(node.children)
        .map((s) => Number(s))
        .sort((a, b) => a - b);
      for (const c of codes) {
        const child = node.children[c];
        visit(child, prefix + child.label);
      }
    };
    visit(this.root, '');
    return out;
  }

  /**
   * Remove every key. Size becomes 0; the root is reset to its initial state.
   *
   * @returns {void}
   */
  clear() {
    this.root = {
      children: {},
      label: '',
      terminal: false,
      value: undefined,
    };
    this._size = 0;
  }
}
