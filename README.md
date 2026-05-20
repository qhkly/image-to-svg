# image-to-svg

Convert PNG / JPG / WebP to **real vector SVG** (true `<path>` elements, no base64, no `<image>`).

Powered by:
- **VTracer** via [`@neplex/vectorizer`](https://www.npmjs.com/package/@neplex/vectorizer) — color mode
- **Potrace** via [`potrace`](https://www.npmjs.com/package/potrace) — monochrome mode
- **sharp** for image preprocessing (format unification, alpha flattening)

---

## Prerequisites

- Node.js >= 18

---

## Installation

```bash
cd image-to-svg
npm install
```

---

## CLI

```bash
# Color mode (multi-color flat icons, illustrations)
node cli.js input.png output.svg --mode color --colors 8

# Monochrome mode (logos, silhouettes, black & white icons)
node cli.js input.png output.svg --mode monochrome --threshold 128

# WebP input
node cli.js input.webp output.svg --mode color
```

### Options

| Flag | Alias | Default | Description |
|------|-------|---------|-------------|
| `--mode` | `-m` | `color` | `color` or `monochrome` |
| `--colors` | `-c` | `6` | Color precision 1–8 (color mode) |
| `--threshold` | `-t` | `auto` | Threshold 0–255 or `auto` (monochrome mode) |
| `--filter-speckle` | | `4` | Noise filter 0–20 (color mode) |
| `--help` | `-h` | | Show help |

---

## Web UI

```bash
node server.js
# Open http://localhost:5173
```

- Drag & drop or click to upload image
- Choose mode and tune parameters
- Click **Convert** to see live SVG preview
- Click **Download SVG** to save

---

## Modes

| Mode | Engine | Best for |
|------|--------|----------|
| `color` | VTracer (Rust) | Flat illustrations, multi-color icons, logos with gradient fills |
| `monochrome` | Potrace (JS) | Black & white silhouettes, line art, single-color logos |

### Color precision (`--colors`)

Controls the number of color clusters in the output:
- `1–2` — very few colors, geometric look
- `6` — balanced (default)
- `8` — maximum detail, closest to original

### Threshold (`--threshold`, monochrome only)

- `auto` (default) — Potrace auto-detects optimal threshold
- `1–255` — pixels darker than this value become black, rest become white
- Lower value = more dark areas traced; higher value = only darkest areas traced

---

## SVG Validation

Every output is checked for 4 requirements:

| Check | Rule |
|-------|------|
| ✓ has `<path>` | Must contain at least one `<path>` element |
| ✓ has `viewBox` | Root `<svg>` must have a `viewBox` attribute |
| ✓ no base64 | No embedded base64 data |
| ✓ no `<image>` | No `<image>` elements (would be a raster embed, not vector) |

Validation warnings are printed to stderr on CLI and shown in the UI. The SVG is still written even if warnings exist.

---

## Architecture

```
Input image (PNG/JPG/WebP)
        │
        ▼
  sharp.flatten()         ← normalize format, flatten alpha to white
        │
        ▼ PNG Buffer
   ┌────┴────┐
   │         │
color     monochrome
   │         │
@neplex/  potrace
vectorizer  .trace()
   │         │
   └────┬────┘
        │ SVG string
        ▼
  validateSVG()           ← 4 checks
        │
        ▼
   Output .svg
```

---

## Parameter Reference

| Parameter | CLI flag | Web UI control | Range | Default |
|-----------|----------|----------------|-------|---------|
| mode | `--mode` | Mode select | color / monochrome | color |
| colorPrecision | `--colors` | Colors slider | 1–8 | 6 |
| filterSpeckle | `--filter-speckle` | Filter Speckle slider | 0–20 | 4 |
| threshold | `--threshold` | Threshold slider | 0 (auto) – 255 | auto |

---

## Dependencies & Licenses

| Package | License | Purpose |
|---------|---------|---------|
| @neplex/vectorizer | MIT | VTracer Node.js bindings |
| potrace | **GPL-2.0** | Potrace JS port |
| sharp | Apache-2.0 | Image preprocessing |
| express | MIT | Web server |
| multer | MIT | File upload middleware |
| minimist | MIT | CLI argument parsing |

> **Note:** `potrace` is GPL-2.0 licensed. If you distribute a product containing this tool, ensure GPL-2.0 compliance.
