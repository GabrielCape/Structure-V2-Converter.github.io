# MCStructure · Web Converter

A static website that converts Minecraft Bedrock structures to v2 with zlib
compression. No server, Node.js installation, API keys, or external services are
required. Files are processed entirely in the browser using a Web Worker.

## Publish on GitHub Pages

1. Upload **the contents of this folder** to the root of your repository:
   index.html, style.css, app.js, converter.js, worker.js, .nojekyll, and this README.
   Place index.html directly in the root to display the site at its main address.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Select your branch (usually main) and **/ (root)**, then save.
5. Once publishing finishes, open the link displayed in Pages.

A repository named username.github.io is published at https://username.github.io/.
Other repositories are usually published at https://username.github.io/repository-name/.
This website uses relative paths and supports both locations.

Do not upload the old .cjs files, the .cmd launcher, or example structure files.

## Usage

Select or drag one or more .mcstructure files, click **Convert files**, and use
**Download** for each result. You can cancel conversion; completed results remain
available. Batch conversion processes files sequentially to reduce memory usage.

Original files are not modified. Nothing is uploaded to the Internet. There are
no analytics, remote fonts, CDNs, or third-party dependencies. A modern browser
with Web Workers, CompressionStream, and DecompressionStream is required.
For a local preview, serve the site over HTTP: opening index.html through file://
may block the Web Worker.

## Format and limits

- Input: v1, uncompressed v2, and v2 with zlib.
- Output: format_version: 2, block_indices using IntArray, and compression: 1.
- The structure compound is serialized as complete little-endian NBT with an
  empty root name, then zlib-compressed into a ByteArray. Root metadata stays
  uncompressed. The second block layer is preserved when present.
- Palettes, states, entities, block data, origin, and unknown fields are preserved,
  including numeric bits and string values. Palette block versions and identifiers
  are not updated.
- Each result is read back and compared with all normalized input data before
  the download becomes available.
- Limits per file: 128 MiB input, 20 million positions, and 512 MiB decompressed
  NBT. Browsers may run out of memory earlier, especially on mobile devices.

This tool does not merge structures or remove the structure block export limit.
File verification does not replace testing in Minecraft. Test converted structures
in a copy of your world with any required addons enabled.

## References

- [Configure GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Compression Streams specification](https://compression.spec.whatwg.org/)
