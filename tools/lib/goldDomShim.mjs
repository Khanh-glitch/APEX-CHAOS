// ---------------------------------------------------------------------------
// Deterministic DOM shim for Gold bridge / engine gates.
//
// Implements exactly the DOM operations the Gold production bridge and the
// engine's legacy-node helper use, so the SHIPPING sources can be executed in
// Node without a browser. No production code depends on this file.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

export class ClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach((x) => this.set.add(x)); }
  remove(...c) { c.forEach((x) => this.set.delete(x)); }
  contains(c) { return this.set.has(c); }
  toggle(c, on) { if (on === undefined) on = !this.set.has(c); if (on) this.set.add(c); else this.set.delete(c); return on; }
}
export class ShimElement {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.style = {
      cssText: '', display: '', opacity: '', width: '', height: '', position: '', inset: '',
      left: '', top: '', transform: '', aspectRatio: '', maxWidth: '', maxHeight: '', margin: '',
    };
    this.dataset = {};
    this.classList = new ClassList();
    this._text = '';
  }
  get id() { return this.attributes.get('id') || ''; }
  set id(v) { if (v) this.attributes.set('id', v); else this.attributes.delete('id'); }
  get firstElementChild() { return this.children[0] || null; }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const i = this.parentElement.children.indexOf(this);
    return this.parentElement.children[i + 1] || null;
  }
  appendChild(node) {
    if (node.parentElement) node.parentElement.removeChild(node);
    node.parentElement = this; this.children.push(node); return node;
  }
  insertBefore(node, ref) {
    if (!ref) return this.appendChild(node);
    if (node.parentElement) node.parentElement.removeChild(node);
    const i = this.children.indexOf(ref);
    node.parentElement = this; this.children.splice(i < 0 ? this.children.length : i, 0, node); return node;
  }
  removeChild(node) {
    const i = this.children.indexOf(node);
    if (i >= 0) this.children.splice(i, 1);
    node.parentElement = null; return node;
  }
  contains(node) {
    if (node === this) return true;
    for (const c of this.children) if (c.contains(node)) return true;
    return false;
  }
  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
  removeAttribute(k) { this.attributes.delete(k); }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this.children.length = 0; }
  querySelectorAll(sel) { return matchAll(this, sel); }
  querySelector(sel) { return matchAll(this, sel)[0] || null; }
}
function descendants(el, out = []) {
  for (const c of el.children) { out.push(c); descendants(c, out); }
  return out;
}
export function matchAll(root, sel) {
  const s = String(sel).trim();
  if (s.startsWith('#') && s.split(' ').length === 1) {
    const id = s.slice(1);
    return descendants(root).filter((el) => el.id === id);
  }
  if (s.split(' ').length === 2) {
    const [a, b] = s.split(' ');
    const out = [];
    for (const sc of matchAll(root, a)) out.push(...matchAll(sc, b));
    return out;
  }
  const m = /^\[([a-zA-Z0-9-]+)="([^"]*)"\]$/.exec(s);
  if (m) return descendants(root).filter((el) => el.getAttribute(m[1]) === m[2]);
  if (!m) {
    const pm = /^\[([a-zA-Z0-9-]+)\]$/.exec(s);
    if (pm) return descendants(root).filter((el) => el.getAttribute(pm[1]) !== null);
  }
  return [];
}
export function parseSimpleHtml(html) {
  const root = new ShimElement('#document');
  const body = new ShimElement('body');
  root.appendChild(body);
  const stack = [body];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] === '/') { if (stack.length > 1) stack.pop(); continue; }
    const el = new ShimElement(m[2]);
    const attrRe = /([a-zA-Z-]+)(?:="([^"]*)")?/g;
    let a;
    while ((a = attrRe.exec(m[3] || ''))) {
      if (a[1] === 'id') el.id = a[2] === undefined ? '' : a[2];
      else el.setAttribute(a[1], a[2] === undefined ? '' : a[2]);
    }
    stack[stack.length - 1].appendChild(el);
    if (m[4] !== '/') stack.push(el);
  }
  root.documentElement = body;
  root.body = body;
  return root;
}
export function makeDocument() {
  const doc = new ShimElement('#document');
  doc.body = new ShimElement('body');
  doc.appendChild(doc.body);
  doc.createElement = (tag) => new ShimElement(tag);
  doc.createTextNode = (t) => { const n = new ShimElement('#text'); n.textContent = t; return n; };
  doc.getElementById = (id) => matchAll(doc, `#${id}`)[0] || null;
  doc.querySelector = (sel) => matchAll(doc, sel)[0] || null;
  doc.querySelectorAll = (sel) => matchAll(doc, sel);
  doc.importNode = (node) => {
    const copy = new ShimElement(node.tagName);
    for (const [k, v] of node.attributes) copy.setAttribute(k, v);
    copy._text = node._text;
    for (const c of node.children) copy.appendChild(doc.importNode(c));
    return copy;
  };
  doc.DOMParser = class {
    parseFromString(html) {
      const r = parseSimpleHtml(html);
      r.querySelectorAll = (sel) => matchAll(r, sel);
      r.querySelector = (sel) => matchAll(r, sel)[0] || null;
      return r;
    }
  };
  return doc;
}

// Sandbox globals every shimmed source may reference.
export function sandboxGlobals(document) {
  return {
    console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, Date, Math, JSON,
    Object, Array, String, Number, Boolean, RegExp, Error, Set, Map, WeakMap, Symbol,
    encodeURIComponent, decodeURIComponent, isNaN, parseInt, parseFloat,
    ArrayBuffer, Uint8Array, Audio: class {}, Element: ShimElement, HTMLElement: ShimElement,
    DOMParser: document.DOMParser,
  };
}

// Run a source file inside `window` so its bare-global reads resolve.
export function runInWindow(document, source, filename, windowExtras = {}) {
  const document2 = document;
  const window = Object.assign({
    DOMParser: document2.DOMParser,
    document: document2,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    setTimeout, clearTimeout, setInterval, clearInterval,
    console,
  }, windowExtras);
  const ctx = vm.createContext(new Proxy(Object.assign(sandboxGlobals(document2), { window }), {
    get(target, prop) { return prop in target ? target[prop] : undefined; },
    set(target, prop, value) { target[prop] = value; return true; },
    has() { return true; },
  }));
  const runner = vm.runInContext(
    `(function(){ var window = arguments[0]; with (window) {\n${source}\n} ; return window; })`,
    ctx, { filename });
  return runner(window);
}
