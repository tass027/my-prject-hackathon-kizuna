// Mieru — tableau de bord STEG : agrégation des foyers qui partagent volontairement leurs données.
// Fonctions pures, testées avec `npm test`. Les règles de confidentialité sont appliquées ICI, pas seulement à l'affichage :
//  • niveau 'aucun'   : rien n'est partagé (par défaut) ;
//  • niveau 'anonyme' : le foyer compte dans les statistiques, jamais affiché individuellement ;
//  • niveau 'contact' : le foyer peut apparaître dans la liste « foyers en forte hausse », sous un identifiant anonyme ;
//  • une zone de moins de SEUIL_K foyers est masquée ; aucun nom, prénom, code de partage ni adresse ne sort.
import { calculerEtat, dateReleve } from './calcul.js';

export const NIVEAUX = ['aucun', 'anonyme', 'contact', 'nomme'];
export const SEUIL_K = 5;               // taille minimale d'un groupe affiché
export const SEUIL_HAUSSE = 0.2;        // +20 % par rapport au mois précédent = « forte hausse »
export const TRANCHES = [0, 100, 150, 200, 250, 300, Infinity];
const FACTEUR_MOIS = [1.05, 1.0, 0.9, 0.85, 0.95, 1.15, 1.35, 1.4, 1.2, 0.95, 0.9, 1.05]; // janvier → décembre

// Zones de la démo : poids = part des foyers, chaleur = surconsommation liée au climat.
const ZONES = [
  ['tunis', 16, 1.0], ['ariana', 8, 1.0], ['ben-arous', 8, 1.0], ['nabeul', 7, 1.0], ['sousse', 9, 1.05],
  ['monastir', 5, 1.05], ['sfax', 11, 1.1], ['kairouan', 7, 1.15], ['gabes', 6, 1.2], ['gafsa', 5, 1.2],
  ['tozeur', 3, 1.3], ['medenine', 4, 1.2], ['jendouba', 3, 0.95], ['tataouine', 2, 1.25],
];

/** Générateur pseudo-aléatoire reproductible (mêmes données à chaque démo). */
function alea(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

/** Identifiant anonyme stable d'un foyer (ne permet pas de retrouver le compteur). */
export function pseudonyme(id) {
  let h = 2166136261;
  for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const lettres = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) { s += lettres[(h >>> (i * 5)) % lettres.length]; }
  return `MIE-${s}`;
}

const cleMois = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const sixMois = (now) => Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));

/** Foyers simulés pour la démo devant le jury (affichés comme tels dans l'interface). */
export function foyersDemo(now = new Date(), n = 480, graine = 2026) {
  const r = alea(graine);
  const total = ZONES.reduce((s, z) => s + z[1], 0);
  const mois = sixMois(now);
  return Array.from({ length: n }, (_, i) => {
    let x = r() * total, zone = ZONES[0];
    for (const z of ZONES) { if ((x -= z[1]) <= 0) { zone = z; break; } }
    const type = r() < 0.55 ? 'appartement' : 'maison';
    const personnes = 1 + Math.floor(r() * 6);
    const base = (62 + 21 * personnes + (type === 'maison' ? 28 : 0)) * (0.82 + r() * 0.38);
    const anomalie = r() < 0.08 ? 1.35 + r() * 0.25 : 1; // appareil défectueux, fuite, nouvel équipement…
    const serie = mois.map((m, k) => {
      const climat = 1 + (FACTEUR_MOIS[m.getMonth()] - 1) * zone[2];
      const bruit = 0.93 + r() * 0.14;
      return { cle: cleMois(m), kwh: Math.round(base * climat * bruit * (k === mois.length - 1 ? anomalie : 1)) };
    });
    const u = r();
    return {
      id: `demo-${i}`, pseudo: pseudonyme(`demo-${i}`), demo: true,
      niveau: u < 0.68 ? 'anonyme' : 'contact',
      ville: zone[0], type, personnes,
      mois: serie,
      kwhMois: serie[serie.length - 1].kwh,
      kwhPrec: serie[serie.length - 2].kwh,
    };
  });
}

/** Relation chaleur / consommation (démo) : 62 jours d'été, kWh moyen par foyer et par jour selon la température. */
export function chaleurDemo(graine = 7) {
  const r = alea(graine);
  return Array.from({ length: 62 }, () => {
    const tmax = Math.round(29 + r() * 17);
    const kwhJour = 6.4 * (1 + 0.035 * Math.max(0, tmax - 28)) * (0.92 + r() * 0.16);
    return { tmax, kwhJour: Math.round(kwhJour * 10) / 10 };
  });
}

/** Transforme un vrai foyer qui partage (compteur + relevés) en ligne anonyme pour le tableau de bord. */
export function foyerPartage({ compteur, releves, partage }, tarifs, now = new Date()) {
  if (!partage || partage.niveau === 'aucun') return null;
  const etat = calculerEtat(compteur, releves, tarifs, now);
  const debut = new Date(now.getFullYear(), now.getMonth(), 1);
  const debutPrec = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const avant = (d) => releves.filter((x) => new Date(dateReleve(x)) < d).sort((a, b) => new Date(dateReleve(b)) - new Date(dateReleve(a)))[0];
  const a = avant(debut), b = avant(debutPrec);
  const kwhPrec = a && b ? Math.max(0, a.index - b.index) : null;
  return {
    id: compteur.id, pseudo: pseudonyme(compteur.id), demo: false,
    niveau: partage.niveau, ville: partage.ville,
    type: partage.niveau === 'contact' ? partage.type || null : null,
    personnes: partage.niveau === 'contact' ? partage.personnes || null : null,
    mois: [{ cle: cleMois(debut), kwh: Math.round(etat.projection) }],
    kwhMois: Math.round(etat.projection), kwhPrec,
  };
}

const moyenne = (l) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0);
const arr = (n, p = 1) => Math.round(n * 10 ** p) / 10 ** p;

/** Tous les indicateurs du tableau de bord. `foyers` ne contient que des foyers qui partagent. */
export function agreger(foyersEntree, { seuil = 200, k = SEUIL_K } = {}) {
  const foyers = foyersEntree.filter((f) => f && f.niveau !== 'aucun');
  const variation = (f) => (f.kwhPrec ? f.kwhMois / f.kwhPrec - 1 : null);
  const avecVar = foyers.filter((f) => variation(f) !== null);

  const zones = {};
  for (const f of foyers) (zones[f.ville] ||= []).push(f);
  const parZone = Object.entries(zones).map(([ville, l]) => ({
    ville, n: l.length, masque: l.length < k,
    moyenne: l.length < k ? null : arr(moyenne(l.map((f) => f.kwhMois)), 0),
    partAuDessus: l.length < k ? null : arr(l.filter((f) => f.kwhMois > seuil).length / l.length, 3),
  })).sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));

  const tranches = TRANCHES.slice(0, -1).map((de, i) => ({ de, a: TRANCHES[i + 1], n: foyers.filter((f) => f.kwhMois >= de && f.kwhMois < TRANCHES[i + 1]).length }));

  const cles = [...new Set(foyers.flatMap((f) => f.mois.map((m) => m.cle)))].sort();
  const evolution = cles.map((cle) => {
    const v = foyers.map((f) => f.mois.find((m) => m.cle === cle)?.kwh).filter((x) => x !== undefined);
    return { cle, n: v.length, moyenne: arr(moyenne(v), 0), nAuDessus: v.filter((x) => x > seuil).length };
  }).filter((e) => e.n >= k);

  const hausse = avecVar.filter((f) => variation(f) >= SEUIL_HAUSSE);
  const enHausse = hausse.filter((f) => f.niveau === 'contact' || f.niveau === 'nomme')
    .map((f) => ({ pseudo: f.pseudo, ville: f.ville, type: f.type, personnes: f.personnes, kwhMois: f.kwhMois, kwhPrec: f.kwhPrec, variation: arr(variation(f), 3), auDessus: f.kwhMois > seuil }))
    .sort((a, b) => b.variation - a.variation);

  return {
    n: foyers.length,
    nContact: foyers.filter((f) => f.niveau === 'contact' || f.niveau === 'nomme').length,
    nReels: foyers.filter((f) => !f.demo).length,
    moyenne: arr(moyenne(foyers.map((f) => f.kwhMois)), 0),
    partAuDessus: foyers.length ? arr(foyers.filter((f) => f.kwhMois > seuil).length / foyers.length, 3) : 0,
    nProchesSeuil: foyers.filter((f) => f.kwhMois > seuil * 0.9 && f.kwhMois <= seuil).length,
    variationMoyenne: avecVar.length ? arr(moyenne(avecVar.map(variation)), 3) : null,
    kwhTotal: foyers.reduce((s, f) => s + f.kwhMois, 0),
    parZone, tranches, evolution,
    enHausse,
    anonymesEnHausse: hausse.length - enHausse.length,
    zonesMasquees: parZone.filter((z) => z.masque).length,
  };
}

/** Pente simple (kWh par degré) de la relation chaleur / consommation, pour l'annotation du graphique. */
export function penteChaleur(points) {
  const mx = moyenne(points.map((p) => p.tmax)), my = moyenne(points.map((p) => p.kwhJour));
  const num = points.reduce((s, p) => s + (p.tmax - mx) * (p.kwhJour - my), 0);
  const den = points.reduce((s, p) => s + (p.tmax - mx) ** 2, 0);
  const a = den ? num / den : 0;
  return { a: arr(a, 2), b: arr(my - a * mx, 2) };
}
