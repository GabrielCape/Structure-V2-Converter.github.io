# MCStructure · Conversor web

Página estática para convertir estructuras de Minecraft Bedrock a v2 con
compresión zlib de 1.26.60. No necesita servidor, Node.js, instalación, claves
ni servicios externos. Los archivos se procesan en el navegador, en un Web Worker.

## Publicar en GitHub Pages

1. Subí **el contenido de esta carpeta** a la raíz de tu repositorio:
   `index.html`, `style.css`, `app.js`, `converter.js`, `worker.js`, `.nojekyll` y este README.
   `index.html` debe quedar directamente en la raíz, no dentro de `tools/` o de
   `mcstructure-converter/` si querés que aparezca en la dirección principal.
2. En GitHub, abrí **Settings → Pages**.
3. En **Build and deployment → Source**, elegí **Deploy from a branch**.
4. Seleccioná tu rama (normalmente `main`) y **/ (root)**. Guardá los cambios.
5. Cuando GitHub termine de publicar, abrí el enlace que aparece en Pages.

Si el repositorio se llama `usuario.github.io`, la página queda en
`https://usuario.github.io/`. Un repositorio con otro nombre se publica normalmente
en `https://usuario.github.io/nombre-del-repositorio/`. Los enlaces relativos de esta
web funcionan en ambos casos.

GitHub Pages sirve todo lo necesario como archivos estáticos. No subas los antiguos
`.cjs`, el lanzador `.cmd` ni archivos de estructuras de ejemplo. Ya no se usan.

## Uso

Elegí o arrastrá uno o varios `.mcstructure`, pulsá **Convertir archivos** y usá
**Descargar** en cada resultado. Las descargas mantienen el nombre original del archivo, sin agregar sufijos.
Podés cancelar la conversión; los resultados completados siguen disponibles.
La conversión por lotes es secuencial para reducir el uso de memoria.

Los originales se conservan. No se suben archivos a Internet, no hay analíticas,
fuentes remotas, CDN ni dependencias de terceros. Se requiere un navegador actual
con Web Workers, CompressionStream y DecompressionStream. Para probar la página,
servila por HTTP local o usá GitHub Pages: abrir index.html mediante `file://` puede
bloquear el Web Worker.

## Formato y límites

- Entrada: v1, v2 sin comprimir y v2 con zlib.
- Salida: `format_version: 2`, `block_indices` con IntArray y `compression: 1`.
- El compuesto `structure` se serializa como un NBT little-endian completo con
  nombre raíz vacío y se comprime con zlib en un ByteArray; los metadatos raíz
  quedan sin comprimir. Se conserva la segunda capa si existe.
- Se preservan paletas, estados, entidades, datos de bloques, origen y campos
  desconocidos. Se mantienen los bits de los números y las cadenas de los valores.
  No se actualizan versiones ni identificadores de bloques de las paletas.
- Cada resultado se vuelve a leer y se compara con todos los datos de entrada
  normalizados antes de habilitar la descarga.
- Hasta 128 MiB de entrada, 20 millones de posiciones y 512 MiB de NBT descomprimido
  por estructura. El navegador puede agotar la memoria antes, especialmente en móviles.

No une estructuras ni elimina el límite de exportación del structure block. La
validación del archivo no sustituye una prueba dentro de Minecraft. Probá las
estructuras convertidas en una copia del mundo y con los addons que necesiten.

## Referencias

- [Configurar GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Compression Streams: deflate usa el formato zlib](https://compression.spec.whatwg.org/)
- [Formato v2 en Bedrock 26.50](https://feedback.minecraft.net/hc/en-us/articles/48826825649933-Minecraft-Bedrock-Edition-26-50-Changelog-Wilderness-Bound)
- [Compresión en Bedrock 26.60](https://feedback.minecraft.net/hc/en-us/articles/49852828563853-Minecraft-Bedrock-Edition-26-60-Changelog)
