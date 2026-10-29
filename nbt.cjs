'use strict';
const { inflateSync, deflateSync } = require('node:zlib');

// Keep scalar payloads as bytes: unknown tags, float bits and int64s survive exactly.
function parse(buffer) {
  let offset = 0, tags = 0;
  function take(n) {
    if (!Number.isSafeInteger(n) || n < 0 || offset + n > buffer.length) throw Error('NBT truncado o longitud inválida');
    const result = buffer.subarray(offset, offset + n); offset += n; return result;
  }
  function count() { const n = take(4).readInt32LE(); if (n < 0) throw Error('Longitud NBT negativa'); return n; }
  function string() { return take(take(2).readUInt16LE()).toString('utf8'); }
  function payload(type, depth) {
    if (depth > 128 || ++tags > 20000000) throw Error('NBT demasiado complejo');
    const widths = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 4, 6: 8 };
    if (widths[type]) return take(widths[type]);
    if ([7, 11, 12].includes(type)) return take(count() * ({ 7: 1, 11: 4, 12: 8 }[type]));
    if (type === 8) { const length = take(2).readUInt16LE(); return take(length); }
    if (type === 9) {
      const elementType = take(1)[0], n = count();
      if (n > buffer.length || (n && !elementType)) throw Error('Lista NBT inválida');
      return { elementType, items: Array.from({ length: n }, () => payload(elementType, depth + 1)) };
    }
    if (type === 10) {
      const children = [];
      for (;;) { const t = take(1)[0]; if (!t) return children; children.push({ type: t, name: string(), value: payload(t, depth + 1) }); }
    }
    throw Error(`Tipo NBT desconocido: ${type}`);
  }
  const type = take(1)[0];
  if (type !== 10) throw Error('Se esperaba un compuesto NBT little-endian');
  const root = { type, name: string(), value: payload(type, 0) };
  if (offset !== buffer.length) throw Error('Hay bytes adicionales después del NBT');
  return root;
}
function encode(root) {
  const chunks = [];
  const byte = n => chunks.push(Buffer.from([n]));
  function length(n, width = 4) { const b = Buffer.alloc(width); width === 2 ? b.writeUInt16LE(n) : b.writeInt32LE(n); chunks.push(b); }
  function named(tag) { byte(tag.type); const name = Buffer.from(tag.name, 'utf8'); length(name.length, 2); chunks.push(name); payload(tag.type, tag.value); }
  function payload(type, value) {
    if (type === 10) { value.forEach(named); byte(0); }
    else if (type === 9) { byte(value.elementType); length(value.items.length); value.items.forEach(v => payload(value.elementType, v)); }
    else { if ([7, 8, 11, 12].includes(type)) length(value.length / ({ 11: 4, 12: 8 }[type] || 1), type === 8 ? 2 : 4); chunks.push(value); }
  }
  named(root); return Buffer.concat(chunks);
}
const field = (node, name) => node.value.find(t => t.name === name);
function integer(n) { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; }
function set(node, tag) { const i = node.value.findIndex(t => t.name === tag.name); if (i < 0) node.value.push(tag); else node.value[i] = tag; }
function unpack(buffer) {
  const root = parse(buffer), version = field(root, 'format_version'), compression = field(root, 'compression');
  if (version?.type !== 3 || ![1, 2].includes(version.value.readInt32LE())) throw Error('format_version debe ser 1 o 2');
  if (compression && (compression.type !== 3 || ![0, 1].includes(compression.value.readInt32LE()))) throw Error('Compresión no soportada');
  let structure = field(root, 'structure');
  if (compression?.value.readInt32LE() === 1) {
    if (structure?.type !== 7) throw Error('structure comprimido debe ser ByteArray');
    structure = parse(inflateSync(structure.value, { maxOutputLength: 512 * 1024 * 1024 }));
    structure.name = 'structure'; set(root, structure);
  }
  if (structure?.type !== 10) throw Error('Falta el compuesto structure');
  return root;
}
module.exports = { parse, encode, field, integer, set, unpack, deflateSync };
