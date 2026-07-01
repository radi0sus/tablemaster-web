# TableMaster Web

A browser-based tool that generates a crystallographic **"Table 1"** (crystal data and structure refinement details) from up to five CIF files — for side-by-side comparison of multiple structures in a single table.

TableMaster Web is a client-side JavaScript port of the PureBasic desktop application **TableMasterG2**. It runs entirely in your browser: no server, no build step, no upload. CIF files never leave your machine.

**Live demo (GitHub Pages):** https://radi0sus.github.io/tablemaster-web/

## Features

- Load up to **5 CIF files** at once and generate one combined comparison table.
- Only rows that actually have data in at least one loaded structure are included — no empty rows.
- Optional table content:
  - Temperature
  - Moiety formula
  - SI-style units (e.g. `/Å` instead of `[Å]`)
- Export formats:
  - **RTF** (Word-compatible, with A4 Auto / Portrait / Landscape page setup)
  - **HTML** (standalone file)
  - **Markdown**
  - **Plain text** (fixed-width table)
- Copy-to-clipboard shortcuts for formatted text (paste into Word etc.), Markdown, and plain text — no need to save a file first.
- Drag-and-drop or click-to-browse loading for each CIF slot, with a clear ("×") button per slot and a "Clear all" button.
- Runs from `file://` — no local web server required, no external dependencies, no data sent anywhere.

## Getting started

There is no installation and no build process.

**Option A — use it online:**
Just open https://radi0sus.github.io/tablemaster-web/ in your browser. This is the same code served via GitHub Pages, running entirely client-side (nothing is uploaded).

**Option B — run it locally:**
1. Download or clone this repository.
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).
3. Start loading CIF files.

Either way, everything runs client-side in plain JavaScript — no server required.

## Usage

1. **Load CIFs** – In the *Load* section, click a slot ("Load CIF 1" … "Load CIF 5") to browse for a `.cif` file, or drag and drop a file directly onto a slot. Slots activate left to right; you don't need to fill all five.
2. **Remove a CIF** – Hover over a loaded slot and click the small **×** in the top-right corner to clear that slot, or use **Clear all** to reset everything.
3. **Set options** – In the *Options* section, choose which optional rows to include (temperature, moiety formula, SI-style units) and, for RTF export, the page orientation.
4. **Preview** – The *Preview* section shows a live rendering of the combined table as soon as at least one CIF is loaded. Any parsing issues or missing data are shown in a warnings box above the preview.
5. **Copy or save** – Use the *Copy* section to copy the table directly to your clipboard (formatted for pasting into Word, as Markdown, or as plain text), or use the *Save* section to download the table as an `.rtf`, `.html`, `.md`, or `.txt` file.

## Table content

The generated table follows the typical "Crystal data and structure refinement" layout used in crystallographic publications and SI documents, including (where available in the CIF):

- Empirical formula, moiety formula, formula weight
- Temperature, crystal system, space group
- Unit cell parameters and volume, Z, density
- Radiation / wavelength, θ range, index (*hkl*) ranges
- Reflections collected / independent, R(int)
- Data / restraints / parameters
- Goodness-of-fit, final R indices, largest diff. peak/hole

Column headers are automatically labeled with the structure/compound names taken from the loaded CIF files, and the table caption lists all compared structures.

## Project structure

```
index.html                   Main page / UI markup
static/css/app.css            Styling
static/js/parser.js           CIF file parsing
static/js/format-helpers.js   Value cleanup, unit formatting, typographic helpers
static/js/cif-store.js        In-memory store for loaded CIF slots
static/js/table-model.js      Builds the row/column data model from parsed CIFs
static/js/formatters.js       Renders the data model to RTF / HTML / Markdown / plain text
static/js/app.js              UI wiring: slots, drag & drop, options, preview, copy/save
```

## Browser support

Any recent evergreen browser with support for standard ES5+ JavaScript, the File API, and the Clipboard API (for the copy buttons) will work. No frameworks, bundlers, or npm dependencies are used.

## Related projects

- [ciflordg-web](https://github.com/radi0sus) – shares parsing/formatting infrastructure with this project.
- TableMasterG2 – the original PureBasic desktop application this project is a web port of.

## License

See [LICENSE](LICENSE).

## Disclaimer

TableMaster Web is provided as-is for research and convenience use. Always double-check the generated table against your original CIF data before publication.
