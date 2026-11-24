// Tests du moteur de calcul : `npm test` (node --test), aucune dépendance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculerEtat, coutMensuel, surcout, verifierReleve, coutAppareil, projectionAppareils, formatDuree, periode, serieMois, heuresMinutes } from './calcul.js';

const tarifs = JSON.parse(readFileSync(new URL('./tarifs.json', import.meta.url)));
const compteur = { id: 'c1', indexDepart: 4600, creeLe: '2026-10-01T08:00:00', seuil: 200 };

test("l'effet de seuil : le 201e kWh coûte environ 28 TND", () => {
  assert.equal(coutMensuel(200, tarifs), 49.2);
  assert.equal(coutMensuel(201, tarifs), 77.61);
  assert.ok(Math.abs(coutMensuel(201, tarifs) - coutMensuel(200, tarifs) - 28.4) < 0.1);
  assert.equal(surcout(180, tarifs), 0);
});

test('période : novembre a 30 jours, le 21 il en reste 10', () => {
  const p = periode(new Date('2026-11-21T12:00:00'));
  assert.equal(p.total, 30);
  assert.equal(p.joursRestants, 10);
});

test('état : 168 kWh au 21 novembre → attention, dépassement projeté', () => {
  const releves = [
    { index: 4653, prisLe: '2026-10-31T20:00:00' },
    { index: 4807, prisLe: '2026-11-20T19:10:00' },
    { index: 4821, prisLe: '2026-11-21T19:42:00' },
  ];
  const e = calculerEtat(compteur, releves, tarifs, new Date('2026-11-21T20:00:00'));
  assert.equal(e.consoPeriode, 168);
  assert.equal(e.resteKwh, 32);
  assert.equal(e.niveau, 'warn');
  assert.ok(e.projection > 200, `projection ${e.projection}`);
  assert.ok(e.surcoutProjete > 20);
  assert.ok(e.joursAvantSeuil >= 3 && e.joursAvantSeuil <= 5, `jours ${e.joursAvantSeuil}`);
});

test('état : seuil dépassé', () => {
  const releves = [
    { index: 4600, prisLe: '2026-10-31T20:00:00' },
    { index: 4808, prisLe: '2026-11-25T19:00:00' },
  ];
  const e = calculerEtat(compteur, releves, tarifs, new Date('2026-11-25T20:00:00'));
  assert.equal(e.niveau, 'over');
  assert.equal(e.resteKwh, -8);
});

test('état : compteur neuf sans relevé', () => {
  const e = calculerEtat({ indexDepart: 1000, creeLe: '2026-11-21T10:00:00' }, [], tarifs, new Date('2026-11-21T11:00:00'));
  assert.equal(e.consoPeriode, 0);
  assert.equal(e.niveau, 'ok');
});

test('contrôle de relevé', () => {
  const r = [{ index: 4807, prisLe: '2026-11-20T19:00:00' }];
  assert.equal(verifierReleve(4821, compteur, r, new Date('2026-11-21T19:00:00')).ok, true);
  assert.equal(verifierReleve(4700, compteur, r, new Date('2026-11-21T19:00:00')).ok, false);
  assert.equal(verifierReleve(4990, compteur, r, new Date('2026-11-21T19:00:00')).ok, false);
});

test('contrôle de relevé : codes traduisibles', () => {
  const r = [{ index: 4807, prisLe: '2026-11-20T19:00:00' }];
  assert.deepEqual(verifierReleve(4700, compteur, r, new Date('2026-11-21T19:00:00')).avertissements, ['baisse']);
  assert.deepEqual(verifierReleve(4990, compteur, r, new Date('2026-11-21T19:00:00')).avertissements, ['trop']);
});

test('série du graphique : cumul depuis le 1er et projection', () => {
  const releves = [
    { index: 4653, prisLe: '2026-10-31T20:00:00' },
    { index: 4730, prisLe: '2026-11-10T19:00:00' },
    { index: 4821, prisLe: '2026-11-21T19:42:00' },
  ];
  const s = serieMois(compteur, releves, tarifs, new Date('2026-11-21T20:00:00'));
  assert.equal(s.points[0].kwh, 0);
  assert.equal(s.points.length, 3);
  assert.equal(s.points[2].kwh, 168);
  assert.equal(s.totalJours, 30);
  assert.ok(s.projection.kwh > 200);
  assert.equal(heuresMinutes(3.24).h, 3);
});

test('simulateur : clim', () => {
  const etat = { resteKwh: 32, joursRestants: 9 };
  const clim = tarifs.appareils.find((a) => a.id === 'clim');
  const c = coutAppareil(clim, 2, etat, tarifs);
  assert.equal(c.kwhTotal, 19.8);
  assert.equal(c.verdict, 'warn');
  assert.equal(formatDuree(c.maxParJour), '3 h 14');
});

test('simulateur : cumule plusieurs appareils dans la projection et applique le tarif projeté', () => {
  const etat = { projection: 180, seuil: 200, joursRestants: 10 };
  const clim = tarifs.appareils.find((a) => a.id === 'clim');
  const tv = tarifs.appareils.find((a) => a.id === 'tv');
  const scenario = projectionAppareils([
    { appareil: clim, quantite: 2 },
    { appareil: tv, quantite: 3 },
  ], etat, tarifs);

  assert.deepEqual(scenario, {
    kwhAjoutes: 25.0,
    kwhProjetes: 205,
    dinars: 79.15,
    verdict: 'over',
  });
});
