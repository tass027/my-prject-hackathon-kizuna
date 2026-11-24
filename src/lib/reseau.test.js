// Tests du réseau simulé : délestage ciblé, protection des foyers prioritaires, gains solaires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  genererReseau, etatSecteur, planDelestage, actionsDepuisPlan, statutFoyer, kwReseau, gainsSolaire,
  bilanSolaire, syntheseSolaire, surconsommation, LIMITE_KVA, DUREE_MAX_MIN, COUT_REVIENT,
} from './reseau.js';

const tarifs = JSON.parse(readFileSync(new URL('./tarifs.json', import.meta.url)));
const now = new Date('2026-11-22T15:00:00');
const reseau = genererReseau(tarifs, now);

test('le réseau de démo est reproductible et géolocalisé', () => {
  assert.equal(genererReseau(tarifs, now).foyers.length, reseau.foyers.length);
  assert.ok(reseau.foyers.length > 1000);
  for (const f of reseau.foyers.slice(0, 50)) assert.ok(f.lat > 30 && f.lat < 38 && f.lon > 7 && f.lon < 12);
});

test('à la pointe de canicule, certains secteurs dépassent leur capacité', () => {
  const surcharges = reseau.secteurs.map((s) => etatSecteur(s, reseau.foyers, {}, 'pointe', now)).filter((s) => s.charge > 1);
  assert.ok(surcharges.length > 0);
});

test('délestage ciblé : on limite avant de couper, et on touche bien moins de foyers que le secteur entier', () => {
  const s = etatSecteur(reseau.secteurs[0], reseau.foyers, {}, 'pointe', now);
  const foyers = reseau.foyers.filter((f) => f.secteur === s.id);
  const p = planDelestage(foyers, 20, { now });
  assert.ok(p.atteint);
  assert.ok(p.totalKw >= 20);
  assert.ok(p.nLimites + p.nCoupes < p.nSecteur / 2, `${p.nLimites + p.nCoupes} / ${p.nSecteur}`);
  assert.ok(p.nLimites >= p.nCoupes);
});

test('délestage ciblé : un foyer prioritaire n’est jamais touché', () => {
  const foyers = reseau.foyers.filter((f) => f.secteur === 'bardo').map((f, i) => ({ ...f, prioritaire: i < 10 }));
  const p = planDelestage(foyers, 1000, { now }); // objectif impossible : tout ce qui peut l'être est coupé
  const prioritaires = new Set(foyers.filter((f) => f.prioritaire).map((f) => f.id));
  assert.equal(p.atteint, false);
  for (const a of p.plan) assert.ok(!prioritaires.has(a.id));
  assert.equal(p.nProteges, 10);
});

test('une action est annoncée avant, et dure au plus 60 minutes', () => {
  const foyers = reseau.foyers.filter((f) => f.secteur === 'bardo');
  const actions = actionsDepuisPlan(planDelestage(foyers, 10, { now }), now, { dureeMin: 240 });
  for (const a of Object.values(actions)) {
    assert.ok(new Date(a.debut) > now);
    assert.equal((new Date(a.fin) - new Date(a.debut)) / 60000, DUREE_MAX_MIN);
    assert.equal(statutFoyer(a, now), 'programme');
    assert.equal(statutFoyer(a, new Date(new Date(a.debut).getTime() + 60000)), a.type);
    assert.equal(statutFoyer(a, new Date(new Date(a.fin).getTime() + 60000)), 'normal');
  }
});

test('appliquer le plan fait baisser la charge du secteur', () => {
  const s = reseau.secteurs.find((x) => x.id === 'bardo');
  const avant = etatSecteur(s, reseau.foyers, {}, 'pointe', now);
  const foyers = reseau.foyers.filter((f) => f.secteur === s.id);
  const actions = actionsDepuisPlan(planDelestage(foyers, 15, { now }), now);
  const pendant = etatSecteur(s, reseau.foyers, actions, 'pointe', new Date(now.getTime() + 20 * 60000));
  assert.ok(pendant.kw <= avant.kw - 15 + 0.2, `${pendant.kw} vs ${avant.kw}`);
  assert.ok(pendant.nLimite > 0);
});

test('un foyer limité garde au plus 2 kVA', () => {
  const f = reseau.foyers.find((x) => kwReseau(x, 'pointe') > 3);
  const p = planDelestage([f], 0.5, { now });
  assert.equal(p.plan[0].action, 'limite');
  assert.equal(p.plan[0].gainKw, Math.round((kwReseau(f, 'pointe') - LIMITE_KVA) * 100) / 100);
});

test('solaire : le foyer et la STEG y gagnent tous les deux', () => {
  // 260 kWh consommés, 3 kWc en novembre ≈ 315 kWh produits.
  const g = gainsSolaire(260, 315, tarifs);
  assert.equal(g.factureAvec, 0);
  assert.ok(g.gainFoyer > 0);
  assert.ok(g.gainSteg > 0);
  assert.equal(g.gainSteg, Math.round((315 * COUT_REVIENT - g.gainFoyer) * 100) / 100);
  // Le solaire fait repasser sous le seuil de 200 kWh.
  assert.equal(gainsSolaire(240, 60, tarifs).sousSeuilGraceAuSolaire, true);
});

test('bilan solaire : production = autoconsommation + injection', () => {
  const b = bilanSolaire({ kwc: 3, injectionMesuree: null }, 10);
  assert.equal(b.production, b.autoconso + b.injection);
  assert.equal(b.estimee, true);
  assert.equal(bilanSolaire({ kwc: 3, injectionMesuree: 40 }, 10).injection, 40);
});

test('synthèse solaire du réseau', () => {
  const s = syntheseSolaire(reseau.foyers, tarifs, now.getMonth());
  assert.ok(s.n > 100);
  assert.ok(s.gainSteg > 0);
  assert.ok(s.lignes[0].gainSteg >= s.lignes[s.lignes.length - 1].gainSteg);
});

test('alertes de surconsommation', () => {
  const f = { kwhMois: 240, kva: 4, kwPointe: 3.6, kwMaintenant: 1, pv: null };
  assert.deepEqual(surconsommation(f, 'pointe'), ['seuil', 'puissance']);
  assert.deepEqual(surconsommation({ ...f, kwhMois: 150 }, 'maintenant'), []);
});
