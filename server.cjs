'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { convert } = require('./converter.cjs');
const token = crypto.randomBytes(24).toString('hex');
const limit = 128 * 1024 * 1024;
const server = http.createServer(async (req, res) => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const reply = (status, body, type = 'text/plain; charset=utf-8') => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(body); };
  if (req.headers.host !== new URL(base).host) return reply(403, 'Host inválido');
  if (req.method === 'GET' && req.url === '/') {
    return reply(200, fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace('__TOKEN__', token), 'text/html; charset=utf-8');
  }
  if (req.method !== 'POST' || req.url !== '/convert') return reply(404, 'No encontrado');
  if (req.headers.origin !== base || req.headers['x-converter-token'] !== token) return reply(403, 'Origen inválido');
  try {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) return reply(413, 'El archivo supera 128 MiB');
      chunks.push(chunk);
    }
    const { output, info } = convert(Buffer.concat(chunks));
    res.setHeader('X-Conversion-Info', JSON.stringify(info));
    reply(200, output, 'application/octet-stream');
  } catch (error) { reply(400, error.message); }
});
server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}`;
  console.log(`Conversor MCStructure: ${url}\nAbrí ese enlace en tu navegador. Para cerrar el servidor: Ctrl+C.`);
  if (process.argv.includes('--open')) {
    const child = spawn('explorer.exe', [url], { stdio: 'ignore', windowsHide: true });
    child.on('error', () => console.log('Abrí el enlace manualmente.'));
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
