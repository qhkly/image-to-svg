#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const { vectorize } = require('./lib/vectorize');
const { validateSVG } = require('./lib/validate');

const HELP = `
Usage: node cli.js <input> <output> [options]

Arguments:
  input              Input image path (PNG, JPG, JPEG, WebP)
  output             Output SVG path

Options:
  --mode, -m         Vectorization mode: color | monochrome  (default: color)
  --colors, -c       Color precision 1-8 [color mode]         (default: 6)
  --threshold, -t    Threshold 0-255 or "auto" [mono mode]    (default: auto)
  --filter-speckle   Noise filter 0-20 [color mode]           (default: 4)
  --help, -h         Show this help

Examples:
  node cli.js logo.png logo.svg --mode monochrome --threshold 128
  node cli.js banner.jpg banner.svg --mode color --colors 8
  node cli.js icon.webp icon.svg --mode color --colors 4
`.trim();

const argv = minimist(process.argv.slice(2), {
  string: ['mode', 'threshold'],
  default: {
    mode: 'color',
    colors: 6,
    threshold: 'auto',
    'filter-speckle': 4,
  },
  alias: {
    m: 'mode',
    c: 'colors',
    t: 'threshold',
    h: 'help',
  },
});

if (argv.help) {
  console.log(HELP);
  process.exit(0);
}

const [inputPath, outputPath] = argv._;

if (!inputPath || !outputPath) {
  console.error('Error: input and output paths are required.\n');
  console.error(HELP);
  process.exit(1);
}

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const ext = path.extname(inputPath).toLowerCase();
if (!ALLOWED_EXT.has(ext)) {
  console.error(`Error: unsupported input format "${ext}". Allowed: png, jpg, webp`);
  process.exit(1);
}

(async () => {
  let inputBuffer;
  try {
    inputBuffer = fs.readFileSync(inputPath);
  } catch (err) {
    console.error(`Error: cannot read "${inputPath}": ${err.message}`);
    process.exit(1);
  }

  const mode = argv.mode;
  if (mode !== 'color' && mode !== 'monochrome') {
    console.error(`Error: --mode must be "color" or "monochrome", got "${mode}"`);
    process.exit(1);
  }

  const opts = {
    colorPrecision: parseInt(argv.colors, 10) || 6,
    filterSpeckle: parseInt(argv['filter-speckle'], 10) ?? 4,
    threshold: argv.threshold === 'auto' ? 'auto' : parseInt(argv.threshold, 10),
  };

  console.log(`Converting: ${inputPath}`);
  console.log(`Mode: ${mode}${mode === 'color' ? ` | colors: ${opts.colorPrecision}` : ` | threshold: ${opts.threshold}`}`);

  let svg;
  try {
    svg = await vectorize(inputBuffer, { mode, ...opts });
  } catch (err) {
    console.error(`Error: vectorization failed: ${err.message}`);
    process.exit(2);
  }

  const { valid, errors } = validateSVG(svg);
  if (!valid) {
    console.warn('\nValidation warnings:');
    errors.forEach(e => console.warn(`  ✗ ${e}`));
  }

  try {
    fs.writeFileSync(outputPath, svg, 'utf8');
  } catch (err) {
    console.error(`Error: cannot write "${outputPath}": ${err.message}`);
    process.exit(2);
  }

  const kb = (Buffer.byteLength(svg, 'utf8') / 1024).toFixed(1);
  console.log(`\nDone: ${outputPath} (${kb} KB)${valid ? ' ✓ validated' : ' ⚠ see warnings above'}`);
})();
