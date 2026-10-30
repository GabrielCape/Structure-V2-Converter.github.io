/* MCStructure browser converter. No network or third-party dependencies. */
(() => {
  'use strict';
  const MAX_NBT = 512 * 1024 * 1024;
  const widths = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 4, 6: 8 };
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const encoder = new TextEncoder();
  const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const int = bytes => view(bytes).getInt32(0, true);
  const integer = n => { const bytes = new Uint8Array(4); view(bytes).setInt32(0, n, true); return bytes; };
  const field = (node, name) => node.value.find(tag => tag.name === name);
  function set(node, tag) {
    const index = node.value.findIndex(entry => entry.name === tag.name);
    if (index < 0) node.value.push(tag); else node.value[index] = tag;
  }
  function parse(buffer) {
    let offset = 0, tags = 0;
    function take(length) {
      if (!Number.isSafeInteger(length) || length < 0 || offset + length > buffer.length) throw Error('Truncated NBT or invalid length.');
      const bytes = buffer.subarray(offset, offset + length); offset += length; return bytes;
    }
    function count() { const n = int(take(4)); if (n < 0) throw Error('Negative NBT length.'); return n; }
    function string() { return decoder.decode(take(view(take(2)).getUint16(0, true))); }
    function payload(type, depth) {
      if (depth > 128 || ++tags > 20000000) throw Error('NBT is too complex.');
      if (widths[type]) return take(widths[type]);
      if ([7, 11, 12].includes(type)) return take(count() * ({ 7: 1, 11: 4, 12: 8 }[type]));
      if (type === 8) return take(view(take(2)).getUint16(0, true));
      if (type === 9) {
        const elementType = take(1)[0], length = count();
        if (length > buffer.length || (length && !elementType) || elementType > 12) throw Error('Invalid NBT list.');
        // Preserve primitive lists as packed bytes instead of millions of JS objects.
        if (widths[elementType]) return { elementType, length, packed: take(length * widths[elementType]) };
        return { elementType, items: Array.from({ length }, () => payload(elementType, depth + 1)) };
      }
      if (type === 10) {
        const children = [];
        for (;;) { const t = take(1)[0]; if (!t) return children; children.push({ type: t, name: string(), value: payload(t, depth + 1) }); }
      }
      throw Error(`Unknown NBT type: ${type}.`);
    }
    const type = take(1)[0];
    if (type !== 10) throw Error('Expected a little-endian NBT structure.');
    const root = { type, name: string(), value: payload(type, 0) };
    if (offset !== buffer.length) throw Error('Unexpected bytes after the NBT data.');
    return root;
  }
  function encode(root) {
    const chunks = []; let total = 0;
    const add = bytes => { total += bytes.length; if (total > MAX_NBT) throw Error('NBT exceeds 512 MiB.'); chunks.push(bytes); };
    const byte = n => add(Uint8Array.of(n));
    function length(n, width = 4) {
      const bytes = new Uint8Array(width);
      if (width === 2) { if (n > 65535) throw Error('NBT text is too long.'); view(bytes).setUint16(0, n, true); }
      else view(bytes).setInt32(0, n, true);
      add(bytes);
    }
    function named(tag) { byte(tag.type); const name = encoder.encode(tag.name); length(name.length, 2); add(name); payload(tag.type, tag.value); }
    function payload(type, value) {
      if (type === 10) { value.forEach(named); byte(0); }
      else if (type === 9) {
        byte(value.elementType); length(value.packed ? value.length : value.items.length);
        if (value.packed) add(value.packed); else value.items.forEach(item => payload(value.elementType, item));
      } else {
        if ([7, 8, 11, 12].includes(type)) length(value.length / ({ 11: 4, 12: 8 }[type] || 1), type === 8 ? 2 : 4);
        add(value);
      }
    }
    named(root);
    const output = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output;
  }
  async function transform(bytes, compress) {
    const Stream = compress ? globalThis.CompressionStream : globalThis.DecompressionStream;
    if (!Stream) throw Error('Your browser does not support native compression. Use a recent version of Chrome, Edge, Firefox, or Safari.');
    // "deflate" includes the zlib wrapper required by Minecraft (not deflate-raw).
    const reader = new Blob([bytes]).stream().pipeThrough(new Stream('deflate')).getReader();
    const chunks = []; let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.length;
        if (total > MAX_NBT) { await reader.cancel(); throw Error('Decompressed content exceeds 512 MiB.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const output = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output;
  }
  async function unpack(bytes) {
    const root = parse(bytes), version = field(root, 'format_version'), compression = field(root, 'compression');
    if (version?.type !== 3 || ![1, 2].includes(int(version.value))) throw Error('format_version must be 1 or 2.');
    if (compression && (compression.type !== 3 || ![0, 1].includes(int(compression.value)))) throw Error('Unsupported compression.');
    let structure = field(root, 'structure');
    if (compression && int(compression.value) === 1) {
      if (structure?.type !== 7) throw Error('Compressed structure must be a ByteArray.');
      structure = parse(await transform(structure.value, false));
      structure.name = 'structure'; set(root, structure);
    }
    if (structure?.type !== 10) throw Error('Missing structure compound.');
    return root;
  }
  function normalize(root) {
    const size = field(root, 'size');
    if (size?.type !== 9 || size.value.elementType !== 3 || size.value.length !== 3) throw Error('size must contain three integers.');
    const dimensions = [0, 4, 8].map(offset => view(size.value.packed).getInt32(offset, true));
    if (dimensions.some(n => n < 1)) throw Error('Invalid dimensions.');
    const volume = dimensions.reduce((a, b) => a * b, 1);
    if (!Number.isSafeInteger(volume) || volume > 20000000) throw Error('Up to 20 million positions per structure are supported.');
    const structure = field(root, 'structure'), indices = field(structure, 'block_indices');
    if (indices?.type !== 9 || ![9, 11].includes(indices.value.elementType) || ![1, 2].includes(indices.value.items.length)) throw Error('Invalid block_indices format.');
    if (indices.value.elementType === 9) {
      indices.value.items = indices.value.items.map(layer => {
        if (layer.elementType !== 3 || layer.length !== volume) throw Error('Invalid index layer.');
        return layer.packed;
      });
      indices.value.elementType = 11;
    }
    const palette = field(field(structure, 'palette') || { value: [] }, 'default');
    const blocks = palette && field(palette, 'block_palette');
    if (blocks?.type !== 9 || blocks.value.elementType !== 10) throw Error('Missing default block palette.');
    for (const layer of indices.value.items) {
      if (layer.length !== volume * 4) throw Error('Index count does not match size.');
      const data = view(layer);
      for (let i = 0; i < layer.length; i += 4) {
        const index = data.getInt32(i, true);
        if (index < -1 || index >= blocks.value.items.length) throw Error('Block index is outside the palette.');
      }
    }
    set(root, { type: 3, name: 'format_version', value: integer(2) });
    set(root, { type: 3, name: 'compression', value: integer(0) });
    return { dimensions, volume, layers: indices.value.items.length };
  }
  function equal(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  async function convert(input, progress = () => {}) {
    if (input.byteLength > 128 * 1024 * 1024) throw Error('The file exceeds 128 MiB.');
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    progress('Reading structure…');
    const root = await unpack(bytes), info = normalize(root), structure = field(root, 'structure');
    const expected = encode(root);
    progress('Compressing with zlib…');
    const compressed = await transform(encode({ ...structure, name: '' }), true);
    set(root, { type: 7, name: 'structure', value: compressed });
    set(root, { type: 3, name: 'compression', value: integer(1) });
    const output = encode(root);
    progress('Verifying integrity…');
    const checked = await unpack(output); normalize(checked);
    if (!equal(expected, encode(checked))) throw Error('Integrity verification failed.');
    return { output, info: { ...info, before: bytes.length, after: output.length } };
  }
  globalThis.MCStructure = { parse, encode, unpack, normalize, convert, field, int, equal };
})();
