'use strict';
const { unpack, encode, field, set, integer, deflateSync } = require('./nbt.cjs');

function normalize(root) {
  const size = field(root, 'size');
  if (size?.type !== 9 || size.value.elementType !== 3 || size.value.items.length !== 3) throw Error('size debe contener tres enteros');
  const dimensions = size.value.items.map(b => b.readInt32LE());
  if (dimensions.some(n => n < 1)) throw Error('Dimensiones inválidas');
  const volume = dimensions.reduce((a, b) => a * b, 1);
  if (!Number.isSafeInteger(volume) || volume > 20000000) throw Error('La herramienta admite hasta 20 millones de bloques por archivo');
  const structure = field(root, 'structure'), indices = field(structure, 'block_indices');
  if (indices?.type !== 9 || ![9, 11].includes(indices.value.elementType) || ![1, 2].includes(indices.value.items.length)) throw Error('block_indices no tiene un formato válido');
  if (indices.value.elementType === 9) {
    indices.value.items = indices.value.items.map(layer => {
      if (layer.elementType !== 3 || layer.items.length !== volume) throw Error('Capa de índices inválida');
      return Buffer.concat(layer.items);
    });
    indices.value.elementType = 11;
  }
  const palette = field(field(structure, 'palette') || { value: [] }, 'default');
  const blocks = palette && field(palette, 'block_palette');
  if (blocks?.type !== 9 || blocks.value.elementType !== 10) throw Error('Falta la paleta de bloques default');
  for (const layer of indices.value.items) {
    if (layer.length !== volume * 4) throw Error('La cantidad de índices no coincide con size');
    for (let i = 0; i < layer.length; i += 4) {
      const index = layer.readInt32LE(i);
      if (index < -1 || index >= blocks.value.items.length) throw Error('Índice de bloque fuera de la paleta');
    }
  }
  set(root, { type: 3, name: 'format_version', value: integer(2) });
  set(root, { type: 3, name: 'compression', value: integer(0) });
  return { dimensions, volume, layers: indices.value.items.length };
}
function convert(input) {
  const root = unpack(input), info = normalize(root);
  const structure = field(root, 'structure');
  // The 1.26.60 reference uses a complete, unnamed little-endian NBT root.
  const payload = encode({ ...structure, name: '' });
  const compressed = deflateSync(payload, { level: 6 });
  set(root, { type: 7, name: 'structure', value: compressed });
  set(root, { type: 3, name: 'compression', value: integer(1) });
  const output = encode(root);
  // Re-read the generated file and compare all decoded tags and exact payloads.
  const checked = unpack(output); normalize(checked);
  set(root, structure); set(root, { type: 3, name: 'compression', value: integer(0) });
  if (!encode(root).equals(encode(checked))) throw Error('Falló la verificación de integridad');
  return { output, info: { ...info, before: input.length, after: output.length } };
}
module.exports = { convert, normalize };
