import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregerPVVisibles, productionPVDepuisRendement, consommationTotalePV } from './pv.js';

test('production PV estimée au prorata du mois et de la puissance installée', () => {
  assert.equal(productionPVDepuisRendement(100, 2.5, new Date(2026, 10, 15)), 125);
});

test('consommation du foyer combine import réseau, production PV et export mesuré', () => {
  assert.equal(consommationTotalePV(100, 80, 30), 150);
  assert.equal(consommationTotalePV(100, 80, null), null);
  assert.equal(consommationTotalePV(10, 5, 20), null);
});

test('puissance photovoltaïque invalide rejetée', () => {
  assert.throws(() => productionPVDepuisRendement(100, 0), RangeError);
});

test('les agrégats PV sous le seuil de cinq foyers sont masqués', () => {
  const lignes = [{ ville: 'tunis', foyers: 4 }, { ville: 'sfax', foyers: 5 }];
  assert.deepEqual(agregerPVVisibles(lignes), [lignes[1]]);
});
