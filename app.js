'use strict';
const filesInput = document.querySelector('#files');
const convertButton = document.querySelector('#convert');
const clearButton = document.querySelector('#clear');
const cancelButton = document.querySelector('#cancel');
const results = document.querySelector('#results');
const selection = document.querySelector('#selection');
const status = document.querySelector('#status');
const dropzone = document.querySelector('#dropzone');
let selected = [], urls = [], busy = false, cancelled = false, job = null;
const supported = typeof Worker !== 'undefined' && typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
const human = bytes => `${(bytes / 1024).toLocaleString('es', { maximumFractionDigits: 1 })} KiB`;
if (!supported) { status.textContent = 'Tu navegador no admite esta herramienta. Actualizá Chrome, Edge, Firefox o Safari.'; filesInput.disabled = true; }
function releaseDownloads() { urls.forEach(url => URL.revokeObjectURL(url)); urls = []; results.replaceChildren(); }
function choose(files) {
  if (busy || !supported) return;
  selected = Array.from(files); selection.replaceChildren(); releaseDownloads();
  for (const file of selected) {
    const item = document.createElement('li'); item.textContent = `${file.name} · ${human(file.size)}`; selection.append(item);
  }
  convertButton.disabled = clearButton.disabled = !selected.length;
  status.textContent = selected.length ? `${selected.length} archivo(s) seleccionado(s).` : 'Seleccioná archivos para comenzar.';
}
filesInput.onchange = () => choose(filesInput.files);
dropzone.addEventListener('dragover', event => { event.preventDefault(); if (!busy) dropzone.classList.add('dragging'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', event => { event.preventDefault(); dropzone.classList.remove('dragging'); choose(event.dataTransfer.files); });
clearButton.onclick = () => { filesInput.value = ''; choose([]); };
cancelButton.onclick = () => { cancelled = true; if (job) { job.worker.terminate(); job.reject(Error('Conversión cancelada.')); job = null; } };
function runWorker(buffer, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./worker.js'); job = { worker, reject };
    const finish = (callback, value) => { worker.terminate(); job = null; callback(value); };
    worker.onmessage = event => {
      if (event.data.stage) onProgress(event.data.stage);
      else if (event.data.error) finish(reject, Error(event.data.error));
      else finish(resolve, event.data);
    };
    worker.onerror = event => { event.preventDefault(); finish(reject, Error('No se pudo iniciar el conversor. Verificá que worker.js y converter.js estén publicados junto a index.html.')); };
    worker.onmessageerror = () => finish(reject, Error('No se pudo recibir el resultado del conversor.'));
    worker.postMessage(buffer, [buffer]);
  });
}
convertButton.onclick = async () => {
  if (busy || !selected.length || !supported) return;
  busy = true; cancelled = false; releaseDownloads();
  convertButton.disabled = clearButton.disabled = filesInput.disabled = true; cancelButton.hidden = false;
  let ok = 0, processed = 0;
  try {
    for (let i = 0; i < selected.length && !cancelled; i++) {
      const file = selected[i], item = document.createElement('li'); results.append(item);
      const title = document.createElement('strong'); title.textContent = file.name; item.append(title);
      const progress = stage => { status.textContent = `${i + 1} de ${selected.length} · ${stage}`; };
      try {
        progress('Abriendo archivo…');
        if (!/\.mcstructure$/i.test(file.name)) throw Error('Seleccioná un archivo con extensión .mcstructure.');
        if (file.size > 128 * 1024 * 1024) throw Error('El archivo supera 128 MiB.');
        const buffer = await file.arrayBuffer();
        if (cancelled) throw Error('Conversión cancelada.');
        const { output, info } = await runWorker(buffer, progress);
        const url = URL.createObjectURL(new Blob([output], { type: 'application/octet-stream' })); urls.push(url);
        const detail = document.createElement('small');
        const reduction = (100 * (1 - info.after / info.before)).toFixed(1);
        detail.textContent = `${info.dimensions.join(' × ')} bloques · ${human(info.before)} → ${human(info.after)} · ${Number(reduction) < 0 ? 'Aumento' : 'Reducción'}: ${Math.abs(Number(reduction))} % · Integridad verificada`;
        const link = document.createElement('a'); link.className = 'download'; link.href = url;
        link.download = file.name; link.textContent = 'Descargar';
        item.append(detail, link); ok++;
      } catch (error) {
        const detail = document.createElement('small'); detail.className = 'error'; detail.textContent = error.message; item.append(detail);
      }
      processed++;
    }
    status.textContent = `${cancelled ? 'Cancelado' : 'Finalizado'}: ${ok} de ${processed} archivos procesados convertidos. Descargá cada resultado con su botón.`;
  } finally {
    busy = false; cancelButton.hidden = true; filesInput.disabled = false;
    convertButton.disabled = clearButton.disabled = !selected.length;
  }
};
window.addEventListener('beforeunload', event => { if (busy) { event.preventDefault(); event.returnValue = ''; } });
