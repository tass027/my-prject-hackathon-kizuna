import test from 'node:test';
import assert from 'node:assert/strict';
import { choisirLecture } from './ocr.js';

test('rejects a high-confidence OCR result with only one digit', () => {
  assert.deepEqual(
    choisirLecture([{ texte: '1', confiance: 87 }]),
    { valeur: null, texte: '', confiance: 0 },
  );
});

test('prefers a plausible meter index over a higher-confidence short result', () => {
  assert.deepEqual(
    choisirLecture([
      { texte: '1', confiance: 87 },
      { texte: '35487', confiance: 72 },
    ]),
    { valeur: 35487, texte: '35487', confiance: 72 },
  );
});
