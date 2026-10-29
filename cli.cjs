'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { convert } = require('./converter.cjs');
const args = process.argv.slice(2), flag = args.indexOf('--out');
if (flag < 0 || !args[flag + 1] || flag === 0 || flag + 2 !== args.length) {
  console.log('Uso: node cli.cjs archivo.mcstructure [otro.mcstructure ...] --out carpeta');
  process.exitCode = 1;
} else {
  const directory = path.resolve(args[flag + 1]);
  fs.mkdirSync(directory, { recursive: true });
  for (const source of args.slice(0, flag)) {
    try {
      const destination = path.join(directory, path.basename(source));
      if (path.resolve(source).toLowerCase() === destination.toLowerCase()) throw Error('La salida debe ser distinta del original');
      const { output, info } = convert(fs.readFileSync(source));
      fs.writeFileSync(destination, output, { flag: 'wx' });
      console.log(`${source} -> ${destination} | ${info.dimensions.join(' × ')} | ${info.before} -> ${info.after} bytes | integridad OK`);
    } catch (error) { console.error(`${source}: ${error.message}`); process.exitCode = 1; }
  }
}
