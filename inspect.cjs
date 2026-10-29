const fs = require('node:fs');
const { parse, field } = require('./nbt.cjs');
const { inflateSync } = require('node:zlib');
for (const file of process.argv.slice(2)) {
  const bytes = fs.readFileSync(file), root = parse(bytes);
  console.log(file, bytes.length, root.value.map(t => [t.name, t.type, t.type === 3 ? t.value.readInt32LE() : t.type === 7 ? t.value.length : '']));
  let structure = field(root, 'structure');
  if (structure.type === 7) {
    const inflated = inflateSync(structure.value);
    console.log('Inflated header:', inflated.subarray(0, 80).toString('hex'));
    structure = parse(inflated);
    console.log('Inflated root name:', structure.name);
  }
  console.log('Structure children:', structure.value.map(t => [t.name, t.type]));
  const indices = field(structure, 'block_indices');
  console.log('Indices:', indices.type, indices.value.elementType, indices.value.items.map(x => Buffer.isBuffer(x) ? x.length : x.items?.length));
}
