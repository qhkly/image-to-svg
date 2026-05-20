'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const { vectorize } = require('./lib/vectorize');
const { validateSVG } = require('./lib/validate');

const app = express();
const PORT = process.env.PORT || 5173;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.post('/api/vectorize', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const mode = req.body.mode || 'color';
    if (mode !== 'color' && mode !== 'monochrome') {
      return res.status(400).json({ error: 'mode must be "color" or "monochrome"' });
    }

    const thresholdRaw = req.body.threshold;
    const opts = {
      colorPrecision: Math.min(8, Math.max(1, parseInt(req.body.colors, 10) || 6)),
      filterSpeckle: Math.min(20, Math.max(0, parseInt(req.body.filterSpeckle, 10) || 4)),
      threshold: thresholdRaw === 'auto' || !thresholdRaw || thresholdRaw === '0'
        ? 'auto'
        : parseInt(thresholdRaw, 10),
    };

    const svg = await vectorize(req.file.buffer, { mode, ...opts });
    const validation = validateSVG(svg);

    res.json({
      svg,
      validation,
      byteSize: Buffer.byteLength(svg, 'utf8'),
    });
  } catch (err) {
    console.error('[/api/vectorize]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// multer error handler
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (max 20MB)' });
  }
  res.status(400).json({ error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`image-to-svg server running at http://0.0.0.0:${PORT}`);
});
