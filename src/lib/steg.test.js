// Tests du tableau de bord STEG, et surtout de ses règles de confidentialité.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foyersDemo, agreger, pseudonyme, foyerPartage, chaleurDemo, penteChaleur, SEUIL_K } from './steg.js';

const tarifs = JSON.parse(readFileSync(new URL('./tarifs.json', import.meta.url)));
const now = new Date('2026-11-21T20:00:00');

test('les données de démo sont reproductibles', () => {
  assert.deepEqual(foyersDemo(now).slice(0, 3), foyersDemo(now).slice(0, 3));
  assert.equal(foyersDemo(now).length, 480);
});

test('agrégation : indicateurs cohérents', () => {
  const a = agreger(foyersDemo(now));
  assert.equal(a.n, 480);
  assert.ok(a.moyenne > 100 && a.moyenne < 300, `moyenne ${a.moyenne}`);
  assert.equal(a.tranches.reduce((s, t) => s + t.n, 0), 480);
  assert.equal(a.evolution.length, 6);
  assert.ok(a.partAuDessus > 0 && a.partAuDessus < 1);
});

test('confidentialité : un foyer « anonyme » ne figure jamais dans la liste nominative', () => {
  const foyers = foyersDemo(now);
  const anonymes = new Set(foyers.filter((f) => f.niveau === 'anonyme').map((f) => f.pseudo));
  const a = agreger(foyers);
  assert.ok(a.enHausse.length > 0);
  for (const f of a.enHausse) assert.ok(!anonymes.has(f.pseudo), f.pseudo);
  assert.ok(a.anonymesEnHausse > 0);
});

test('confidentialité : les champs identifiants ne sortent pas', () => {
  const a = agreger(foyersDemo(now));
  for (const f of a.enHausse) assert.deepEqual(Object.keys(f).sort(), ['auDessus', 'kwhMois', 'kwhPrec', 'personnes', 'pseudo', 'type', 'variation', 'ville']);
});

test(`confidentialité : une zone de moins de ${SEUIL_K} foyers est masquée`, () => {
  const peu = foyersDemo(now, 40).map((f, i) => ({ ...f, ville: i < 3 ? 'tozeur' : 'tunis' }));
  const a = agreger(peu);
  const tozeur = a.parZone.find((z) => z.ville === 'tozeur');
  assert.equal(tozeur.masque, true);
  assert.equal(tozeur.moyenne, null);
  assert.equal(a.zonesMasquees, 1);
});

test('un foyer qui ne partage pas est ignoré', () => {
  const r = foyerPartage({ compteur: { id: 'x', indexDepart: 100 }, releves: [], partage: { niveau: 'aucun' } }, tarifs, now);
  assert.equal(r, null);
  assert.equal(agreger([{ niveau: 'aucun', ville: 'tunis', mois: [], kwhMois: 300, kwhPrec: 100 }]).n, 0);
});

test('un vrai foyer qui partage devient une ligne anonyme', () => {
  const compteur = { id: 'c1', nom: 'Maison', code: 'K7Q2MX', indexDepart: 4600, creeLe: '2026-10-01T08:00:00' };
  const releves = [{ index: 4500, prisLe: '2026-09-30T20:00:00' }, { index: 4653, prisLe: '2026-10-31T20:00:00' }, { index: 4821, prisLe: '2026-11-21T19:42:00' }];
  const f = foyerPartage({ compteur, releves, partage: { niveau: 'contact', ville: 'sfax' } }, tarifs, now);
  assert.equal(f.pseudo, pseudonyme('c1'));
  assert.equal(f.kwhPrec, 153);
  assert.ok(!JSON.stringify(f).includes('K7Q2MX') && !JSON.stringify(f).includes('Maison'));
});

test('partage anonyme : conserve ville et consommation, exclut le profil du foyer', () => {
  const compteur = { id: 'c2', indexDepart: 4600, creeLe: '2026-10-01T08:00:00' };
  const releves = [{ index: 4653, prisLe: '2026-10-31T20:00:00' }, { index: 4821, prisLe: '2026-11-21T19:42:00' }];
  const foyer = foyerPartage({
    compteur,
    releves,
    partage: { niveau: 'anonyme', ville: 'sfax', type: 'maison', personnes: 4 },
  }, tarifs, now);

  assert.equal(foyer.ville, 'sfax');
  assert.ok(foyer.kwhMois > 0);
  assert.equal(foyer.type, null);
  assert.equal(foyer.personnes, null);
});

test('partage avec nom : le nom reste hors du tableau régional', () => {
  const compteur = { id: 'c3', nom: 'Maison Ben Salah', indexDepart: 4600, creeLe: '2026-10-01T08:00:00' };
  const releves = [{ index: 4653, prisLe: '2026-10-31T20:00:00' }, { index: 4821, prisLe: '2026-11-21T19:42:00' }];
  const foyer = foyerPartage({
    compteur,
    releves,
    partage: { niveau: 'nomme', ville: 'sfax', nomFoyer: compteur.nom },
  }, tarifs, now);

  assert.equal(foyer.niveau, 'nomme');
  assert.equal(foyer.ville, 'sfax');
  assert.ok(!JSON.stringify(foyer).includes('Maison Ben Salah'));
});

test('effet de la chaleur : la pente est positive', () => {
  assert.ok(penteChaleur(chaleurDemo()).a > 0);
});
