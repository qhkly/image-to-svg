'use strict';

function validateSVG(svgString) {
  const errors = [];

  if (/base64/i.test(svgString)) {
    errors.push('contains base64 encoded data');
  }

  if (/<image[\s>/]/i.test(svgString)) {
    errors.push('contains <image> element (not a true vector)');
  }

  if (!/<path[\s/]/i.test(svgString)) {
    errors.push('missing <path> elements');
  }

  if (!/viewBox\s*=/i.test(svgString)) {
    errors.push('missing viewBox attribute');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateSVG };
