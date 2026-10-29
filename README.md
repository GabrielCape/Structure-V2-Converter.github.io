# Conversor MCStructure para Bedrock 1.26.60

Herramienta local sin dependencias externas. Requiere Node.js 18 o posterior
(en este equipo se verificó con Node.js 22.19.0).

## Abrir la interfaz

Hacé doble clic en **Abrir conversor.cmd**. Se abre una consola y el navegador.
Si el navegador no se abre, copiá el enlace que aparece en la consola.
Seleccioná uno o varios archivos, pulsá **Convertir archivos** y descargá cada resultado.
Los nombres descargados terminan en `_v2.mcstructure`.
La consola debe permanecer abierta mientras usás la herramienta; cerrala al terminar.

Los archivos se envían únicamente al servidor de tu propia computadora, en
`127.0.0.1` y un puerto libre. La herramienta no usa servicios de Internet.
No modifica los originales ni instala paquetes. Procesa los archivos uno por uno.

## Línea de comandos

Desde esta carpeta:

```powershell
node cli.cjs "C:\ruta\estructura.mcstructure" --out "C:\ruta\convertidas"
node cli.cjs "C:\ruta\primera.mcstructure" "C:\ruta\segunda.mcstructure" --out "C:\ruta\convertidas"
```

Conserva el nombre dentro de la carpeta de salida. Rechaza sobrescribir un archivo
existente, incluido el original. Si falla un archivo, informa el error y continúa
con los demás; devuelve código de salida 1 si hubo errores.

## Formatos y conservación de datos

- Lee v1, v2 sin compresión y v2 con `compression: 1`.
- Escribe `format_version: 2`, listas de `IntArray` para los índices y compresión zlib.
- Comprime un NBT little-endian completo, con nombre raíz vacío, dentro de
  `structure` como `ByteArray`. Los demás campos raíz permanecen sin comprimir.
- Conserva la segunda capa si existe, incluso si está vacía.
- Conserva paletas, estados, entidades, datos de bloques, origen y campos desconocidos.
  No traduce bloques ni actualiza la versión de los bloques de la paleta.
- Después de convertir, vuelve a leer y descomprimir la salida y compara todos los
  datos con la entrada normalizada. La comprobación también conserva los bits
  de los números flotantes y los enteros de 64 bits.
- Límites de esta herramienta: 20 millones de posiciones, NBT descomprimido de
  hasta 512 MiB al leer y archivos de entrada de hasta 128 MiB en la interfaz.

La conversión no aumenta el límite de exportación del structure block, no une piezas
y no verifica la disponibilidad de los bloques personalizados en el mundo de destino.
No se ha probado aún la carga de los resultados dentro de Minecraft: hacelo primero
en una copia del mundo. La integridad verificada es del archivo, no una prueba en el juego.

## Ejemplos convertidos y validación

En `converted/` están las copias de los dos ejemplos proporcionados:

- `top.mcstructure`: 95 × 96 × 95; de 7.241.885 a 175.037 bytes (97,6 % menos).
- `octopus.mcstructure`: 63 × 117 × 57; ya comprimido, de 61.149 a 61.250 bytes.
  El contenido NBT descomprimido coincide byte por byte con el exportado por Minecraft.
  Zlib puede producir distintos bytes comprimidos para el mismo contenido.

Para ejecutar las pruebas desde esta carpeta:

```powershell
node --test converter.test.cjs
```

Las pruebas de referencia leen los originales de `../../structures/arenas/acropolis/`.

## Referencias del formato

- [Cambios oficiales de 26.50: estructura v2 e índices IntArray](https://feedback.minecraft.net/hc/en-us/articles/48826825649933-Minecraft-Bedrock-Edition-26-50-Changelog-Wilderness-Bound)
- [Cambios oficiales de 26.60: compresión zlib](https://feedback.minecraft.net/hc/en-us/articles/49852828563853-Minecraft-Bedrock-Edition-26-60-Changelog)

La representación binaria comprimida se contrastó con el archivo
`structures/arenas/acropolis/octopus.mcstructure` suministrado por el usuario.
