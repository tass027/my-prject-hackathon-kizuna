import { test } from 'node:test'; import assert from 'node:assert/strict';
import { previsionsDemo, impactChaleur, niveauChaleur } from './meteo.js';
test('niveaux', () => { assert.equal(niveauChaleur(34), 'normal'); assert.equal(niveauChaleur(36), 'chaleur'); assert.equal(niveauChaleur(41), 'canicule'); });
test('impact démo', () => {
  const j = previsionsDemo(new Date('2026-11-21T12:00:00'));
  assert.equal(j.length, 3); assert.equal(j[0].date, '2026-11-21');
  const i = impactChaleur(j, { moyenneJour: 8, resteKwh: 32 });
  assert.equal(i.joursChauds, 3); assert.equal(i.pire, 'canicule'); assert.equal(i.tmax, 43);
  assert.equal(i.kwhEnPlus, 9.2); assert.equal(i.passeLeSeuil, true);
});
