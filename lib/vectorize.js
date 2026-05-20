'use strict';

const sharp = require('sharp');
const potrace = require('potrace');

async function preprocess(inputBuffer) {
  return sharp(inputBuffer)
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();
}

async function vectorizeColor(pngBuffer, opts) {
  const { vectorize, ColorMode, Hierarchical, PathSimplifyMode } =
    await import('@neplex/vectorizer');

  // colorPrecision 1-8 controls number of color clusters
  const colorPrecision = Math.min(8, Math.max(1, opts.colorPrecision ?? 6));

  return vectorize(pngBuffer, {
    colorMode: ColorMode.Color,
    colorPrecision,
    filterSpeckle: opts.filterSpeckle ?? 4,
    spliceThreshold: opts.spliceThreshold ?? 45,
    cornerThreshold: opts.cornerThreshold ?? 60,
    hierarchical: Hierarchical.Stacked,
    mode: PathSimplifyMode.Spline,
    layerDifference: opts.layerDifference ?? 6,
    lengthThreshold: opts.lengthThreshold ?? 5,
    maxIterations: opts.maxIterations ?? 2,
    pathPrecision: opts.pathPrecision ?? 5,
  });
}

function vectorizeMono(pngBuffer, opts) {
  return new Promise((resolve, reject) => {
    // threshold=0 means auto; 1-255 is explicit
    const threshold =
      !opts.threshold || opts.threshold === 'auto' || opts.threshold === 0
        ? potrace.Potrace.THRESHOLD_AUTO
        : Math.min(255, Math.max(1, parseInt(opts.threshold, 10)));

    const params = {
      threshold,
      turdSize: opts.turdSize ?? 2,
      optCurve: true,
      color: opts.color ?? '#000000',
      background: opts.background ?? 'transparent',
    };

    potrace.trace(pngBuffer, params, (err, svg) => {
      if (err) reject(new Error(`Monochrome tracing failed: ${err.message}`));
      else resolve(svg);
    });
  });
}

// VTracer outputs width/height but no viewBox — inject it so SVG scales properly
function ensureViewBox(svg) {
  if (/viewBox\s*=/i.test(svg)) return svg;
  const m = svg.match(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"[^>]*\sheight="(\d+(?:\.\d+)?)"/i)
    || svg.match(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)"[^>]*\swidth="(\d+(?:\.\d+)?)"/i);
  if (!m) return svg;
  const [, w, h] = m;
  return svg.replace(/<svg /, `<svg viewBox="0 0 ${w} ${h}" `);
}

async function vectorize(inputBuffer, { mode = 'color', ...opts } = {}) {
  const pngBuffer = await preprocess(inputBuffer);

  let svg;
  if (mode === 'monochrome') {
    svg = await vectorizeMono(pngBuffer, opts);
  } else {
    svg = await vectorizeColor(pngBuffer, opts);
  }
  return ensureViewBox(svg);
}

module.exports = { vectorize };
