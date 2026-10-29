'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inflateSync } = require('node:zlib');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { parse, encode, unpack, field, integer } = require('./nbt.cjs');
const { convert, normalize } = require('./converter.cjs');
const base = path.resolve(__dirname, '../..');
const oldFile = path.join(base, 'structures/arenas/acropolis/core/top.mcstructure');
const newFile = path.join(base, 'structures/arenas/acropolis/octopus.mcstructure');

function fixture() {
  const int = (name, n) => ({ type: 3, name, value: integer(n) });
  const list = (name, elementType, items) => ({ type: 9, name, value: { elementType, items } });
  return { type: 10, name: '', value: [int('format_version', 1), list('size', 3, [integer(1), integer(1), integer(1)]),
    { type: 10, name: 'structure', value: [list('block_indices', 9, [
      { elementType: 3, items: [integer(0)] }, { elementType: 3, items: [integer(-1)] }]),
    list('entities', 10, [[{ type: 4, name: 'UniqueID', value: Buffer.from('ffffffffffffff7f', 'hex') },
      { type: 5, name: 'floatBits', value: Buffer.from('0100c07f', 'hex') }]]),
    { type: 10, name: 'palette', value: [{ type: 10, name: 'default', value: [
      list('block_palette', 10, [[{ type: 8, name: 'name', value: Buffer.from('minecraft:stone') }]]),
      { type: 10, name: 'block_position_data', value: [{ type: 10, name: '0', value: [
        { type: 8, name: 'Text', value: Buffer.from('Árbol\u0000🐙') },
        { type: 7, name: 'bytes', value: Buffer.from([0, 128, 255]) },
        { type: 12, name: 'longs', value: Buffer.alloc(16, 255) } ] }] } ] }] } ] },
    { type: 8, name: 'custom_metadata', value: Buffer.from('preservar') } ] };
}
test('Referencia v1: round trip exacto y conservación completa al convertir', () => {
  const source = fs.readFileSync(oldFile);
  assert.deepEqual(encode(parse(source)), source);
  const { output, info } = convert(source);
  const before = unpack(source), after = unpack(output);
  normalize(before); normalize(after);
  assert.deepEqual(encode(after), encode(before));
  assert.deepEqual(info.dimensions, [95, 96, 95]);
  assert.ok(output.length < source.length / 10);
  assert.equal(field(parse(output), 'compression').value.readInt32LE(), 1);
});
test('Referencia 1.26.60: payload descomprimido idéntico byte por byte', () => {
  const source = fs.readFileSync(newFile), { output } = convert(source);
  assert.deepEqual(encode(parse(source)), source);
  assert.deepEqual(inflateSync(field(parse(output), 'structure').value), inflateSync(field(parse(source), 'structure').value));
  assert.equal(parse(inflateSync(field(parse(output), 'structure').value)).name, '');
});
test('Conserva int64, bits float, texto, block entity y metadatos desconocidos', () => {
  const source = fixture(), expected = parse(encode(source)); normalize(expected);
  const decoded = unpack(convert(encode(source)).output); normalize(decoded);
  assert.deepEqual(encode(decoded), encode(expected));
});
test('Admite v2 sin comprimir con una sola capa', () => {
  const root = fixture(); normalize(root);
  field(field(root, 'structure'), 'block_indices').value.items.pop();
  const result = unpack(convert(encode(root)).output);
  assert.equal(field(field(result, 'structure'), 'block_indices').value.items.length, 1);
});
test('Rechaza índices inválidos, longitudes incorrectas, versiones futuras y truncamiento', () => {
  let root = fixture();
  field(field(root, 'structure'), 'block_indices').value.items[0].items[0] = integer(3);
  assert.throws(() => convert(encode(root)), /paleta/);
  root = fixture(); field(root, 'size').value.items[0] = integer(2);
  assert.throws(() => convert(encode(root)), /índices/);
  root = fixture(); field(root, 'format_version').value = integer(3);
  assert.throws(() => convert(encode(root)), /format_version/);
  assert.throws(() => convert(encode(fixture()).subarray(0, 30)), /NBT/);
});
test('Interfaz local: convierte, devuelve errores y rechaza solicitudes sin token', async () => {
  const child = spawn(process.execPath, [path.join(__dirname, 'server.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const url = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { reject(Error('Servidor no inició')); }, 10000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.stdout.on('data', chunk => { const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
    });
    const html = await (await fetch(url)).text();
    const token = html.match(/const token = '([a-f0-9]+)'/)[1];
    const response = await fetch(url + '/convert', { method: 'POST', headers: { Origin: url, 'X-Converter-Token': token }, body: encode(fixture()) });
    assert.equal(response.status, 200);
    assert.equal(field(parse(Buffer.from(await response.arrayBuffer())), 'compression').value.readInt32LE(), 1);
    assert.equal((await fetch(url + '/convert', { method: 'POST', body: 'x' })).status, 403);
    assert.equal((await fetch(url + '/convert', { method: 'POST', headers: { Origin: url, 'X-Converter-Token': token }, body: 'x' })).status, 400);
  } finally { const exit = once(child, 'exit'); child.kill(); await exit; }
});
