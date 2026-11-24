// Mieru — réseau STEG simulé : maisons géolocalisées par secteur, charge, alertes, délestage ciblé et solaire.
// Fonctions pures, testées avec `npm test` (src/lib/reseau.test.js).
//
// Principe du délestage ciblé (au lieu de couper tout un secteur comme pendant l'été 2026) :
//   1. on LIMITE d'abord la puissance des foyers qui tirent le plus (ex. 2 kVA : lumière, frigo, ventilateur restent) ;
//   2. on ne COUPE que si la limitation ne suffit pas, en commençant par les plus gros consommateurs ;
//   3. les foyers PRIORITAIRES (équipement médical déclaré) ne sont jamais limités ni coupés ;
//   4. chaque foyer touché reçoit une ANNONCE avant, avec l'heure et la durée (60 min maximum).
import { coutMensuel } from './calcul.js';
import { VILLES } from './meteo.js';

export const COUT_REVIENT = 0.472;   // TND/kWh : coût moyen de l'électricité (ministère de l'Industrie, audition 2025)
export const LIMITE_KVA = 2;         // puissance laissée à un foyer limité
export const DUREE_MAX_MIN = 60;     // durée maximale d'une coupure ciblée
export const PREAVIS_MIN = 15;       // délai entre l'annonce et l'action
export const KW_PAR_FOYER = 1.75;     // capacité du poste de distribution, par foyer raccordé (simulation)
export const AUTOCONSO_DEFAUT = 0.55; // part de la production consommée sur place si l'injection n'est pas mesurée

// Rendement mensuel d'1 kWc en Tunisie (kWh/kWc, plein sud 30°). Valeurs moyennes, utilisées quand PVGIS est injoignable.
export const RENDEMENT_TN = [100, 115, 150, 165, 180, 185, 195, 185, 155, 130, 105, 95];

// Secteurs de la simulation : [id, nom, décalage est (km), décalage nord (km), nombre de foyers].
// Positions approximatives, pour la démonstration.
export const SECTEURS = {
  tunis: [['bardo', 'Le Bardo', -5, 0.5, 64], ['hrairia', 'El Hraïria', -6, -4, 58], ['ezzouhour', 'Cité Ezzouhour', -3.5, -2.5, 52], ['bab-saadoun', 'Bab Saadoun', -1.5, 0.8, 46]],
  ariana: [['menzah5', 'El Menzah 5', -0.5, -2.5, 54], ['ennasr', 'Ennasr', -1.5, -1, 50], ['raoued', 'Raoued', 2.5, 4, 36]],
  'ben-arous': [['megrine', 'Mégrine', -1.5, 1, 40], ['mourouj', 'El Mourouj', -2.5, -3, 52], ['hammam-lif', 'Hammam-Lif', 5, -4, 38]],
  bizerte: [['bizerte-centre', 'Bizerte Centre', 0, 0, 40]],
  nabeul: [['nabeul-centre', 'Nabeul Centre', 0, 0, 36], ['hammamet', 'Hammamet', -10, -6, 42]],
  sousse: [['hammam-sousse', 'Hammam Sousse', 0, 4, 46], ['akouda', 'Akouda', -2, 8, 32], ['sahloul', 'Sahloul', -2, 2, 44], ['msaken', 'M’saken', -6, -10, 36]],
  monastir: [['monastir-centre', 'Monastir Centre', 0, 0, 34], ['ksar-hellal', 'Ksar Hellal', 6, -14, 28]],
  mahdia: [['mahdia-centre', 'Mahdia Centre', 0, 0, 30]],
  sfax: [['medina-sfax', 'Médina de Sfax', 0, 0, 48], ['sakiet-ezzit', 'Sakiet Ezzit', -1, 7, 44], ['sakiet-eddaier', 'Sakiet Eddaïer', 4, 6, 40], ['el-ain', 'El Aïn', -4, 3, 36]],
  kairouan: [['kairouan-nord', 'Kairouan Nord', 0, 2, 34], ['kairouan-sud', 'Kairouan Sud', 0, -2, 30]],
  gafsa: [['gafsa-centre', 'Gafsa Centre', 0, 0, 30]],
  tozeur: [['tozeur-centre', 'Tozeur', 0, 0, 24]],
  gabes: [['gabes-ville', 'Gabès Ville', 0, 0, 34], ['ghannouch', 'Ghannouch', 2, 5, 22]],
  medenine: [['medenine-centre', 'Médenine', 0, 0, 26]],
};

const CHALEUR = { tozeur: 1.3, gafsa: 1.2, kebili: 1.25, gabes: 1.2, medenine: 1.2, kairouan: 1.15, sfax: 1.1 };
const FACTEUR_MOIS = [1.05, 1.0, 0.9, 0.85, 0.95, 1.15, 1.35, 1.4, 1.2, 0.95, 0.9, 1.05];

function alea(graine) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
const arr = (n, p = 1) => Math.round(n * 10 ** p) / 10 ** p;
const cleMois = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
/** Décale un point (lat, lon) de dx km vers l'est et dy km vers le nord. */
export const decaler = (lat, lon, dx, dy) => [lat + dy / 111, lon + dx / (111 * Math.cos((lat * Math.PI) / 180))];

/** Référence client fictive au format STEG (10 chiffres). */
const refClient = (r) => Array.from({ length: 10 }, (_, i) => (i === 0 ? 1 + Math.floor(r() * 9) : Math.floor(r() * 10))).join('').replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3');

/** Production solaire et partage autoconsommation / injection d'une installation, pour un mois entier. */
export function bilanSolaire({ kwc, injectionMesuree = null }, mois, consoTotaleKwh = null) {
  const production = Math.round(kwc * RENDEMENT_TN[mois]);
  let injection = injectionMesuree ?? Math.round(production * (1 - AUTOCONSO_DEFAUT));
  if (consoTotaleKwh !== null) injection = Math.max(injection, production - consoTotaleKwh);
  injection = Math.min(injection, production);
  return { production, autoconso: production - injection, injection, estimee: injectionMesuree === null };
}

/**
 * Ce que le solaire rapporte, au foyer et à la STEG, pour un mois.
 * Facturation nette : le réseau facture ce qui est consommé MOINS ce qui est produit (l'injection est reprise sur la facture).
 *  • gain foyer = facture sans panneaux − facture avec panneaux ;
 *  • gain STEG  = coût de production évité (production × coût moyen) − recette perdue (= gain foyer).
 * Comme la STEG vend sous son coût, chaque kWh solaire lui fait gagner de l'argent.
 */
export function gainsSolaire(consoTotaleKwh, productionKwh, tarifs, coutRevient = COUT_REVIENT) {
  const factureSans = coutMensuel(consoTotaleKwh, tarifs);
  const factureNette = Math.max(0, consoTotaleKwh - productionKwh);
  const factureAvec = coutMensuel(factureNette, tarifs);
  const gainFoyer = arr(factureSans - factureAvec, 2);
  const gainSteg = arr(productionKwh * coutRevient - gainFoyer, 2);
  const seuil = tarifs.seuilMensuelKwh;
  return { factureSans, factureAvec, gainFoyer, gainSteg, sousSeuilGraceAuSolaire: consoTotaleKwh > seuil && factureNette <= seuil };
}

/** Réseau de démonstration : secteurs et maisons, avec une situation « maintenant » et une situation « pointe de canicule ». */
export function genererReseau(tarifs, now = new Date(), graine = 2026) {
  const r = alea(graine);
  const mois = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const secteurs = [];
  const foyers = [];
  for (const [villeId, liste] of Object.entries(SECTEURS)) {
    const ville = VILLES.find((v) => v.id === villeId);
    const chaleur = CHALEUR[villeId] || 1;
    for (const [sid, nom, dx, dy, n] of liste) {
      const [lat, lon] = decaler(ville.lat, ville.lon, dx, dy);
      secteurs.push({ id: sid, nom, ville: villeId, lat, lon, capaciteKw: Math.round(n * KW_PAR_FOYER) });
      for (let i = 0; i < n; i++) {
        const angle = r() * Math.PI * 2, dist = Math.sqrt(r()) * 1.2;
        const [flat, flon] = decaler(lat, lon, Math.cos(angle) * dist, Math.sin(angle) * dist);
        const type = r() < 0.5 ? 'appartement' : 'maison';
        const personnes = 1 + Math.floor(r() * 6);
        const kva = personnes >= 5 || (type === 'maison' && r() < 0.5) ? 6 : personnes >= 3 ? 4 : 2;
        const clim = r() < 0.62 ? 1 + Math.floor(r() * (kva >= 6 ? 3 : 2)) : 0;
        const base = (58 + 20 * personnes + (type === 'maison' ? 26 : 0) + clim * 12) * (0.82 + r() * 0.36);
        const anomalie = r() < 0.07 ? 1.35 + r() * 0.3 : 1;
        const serie = mois.map((m, k) => {
          const climat = 1 + (FACTEUR_MOIS[m.getMonth()] - 1) * chaleur * (clim ? 1.3 : 0.6);
          return { cle: cleMois(m), kwh: Math.round(base * climat * (0.93 + r() * 0.14) * (k === 5 ? anomalie : 1)) };
        });
        // Puissance appelée (kW) maintenant et à la pointe d'une canicule (15 h, 44 °C, clims en marche).
        const kwMaintenant = arr(Math.min(kva, 0.25 + r() * 0.9 + (anomalie > 1 ? 0.6 : 0)), 2);
        const kwPointe = arr(Math.min(kva * 0.98, 0.5 + r() * 0.7 + clim * (0.75 + r() * 0.45) * chaleur), 2);
        const aPV = r() < 0.17;
        const kwc = aPV ? [1.5, 2, 2.5, 3, 4][Math.floor(r() * 5)] : 0;
        const kwhMois = serie[5].kwh;
        foyers.push({
          id: `${sid}-${i}`, ref: refClient(r), pseudo: null, demo: true, niveau: 'nomme',
          ville: villeId, secteur: sid, lat: flat, lon: flon,
          type, personnes, kva, clim, prioritaire: r() < 0.015,
          mois: serie, kwhMois, kwhPrec: serie[4].kwh,
          kwMaintenant, kwPointe,
          // Le solaire produit à 15 h : il soulage la pointe (environ 0,65 kW par kWc en plein été).
          pv: aPV ? { kwc, injectionMesuree: null, kwPointe: arr(kwc * 0.65, 2) } : null,
        });
      }
    }
  }
  for (const f of foyers) f.pseudo = f.ref;
  return { secteurs, foyers, mois: now.getMonth() };
}

/** Puissance qu'un foyer tire sur le réseau dans le scénario donné (le solaire est déduit à la pointe). */
export function kwReseau(f, scenario = 'pointe') {
  if (scenario === 'pointe') return Math.max(0, arr(f.kwPointe - (f.pv?.kwPointe || 0), 2));
  return f.kwMaintenant;
}

/** Statut effectif d'un foyer à l'instant `now`, selon les actions de la STEG. */
export function statutFoyer(action, now = new Date()) {
  if (!action || action.type === 'alerte') return action?.type === 'alerte' ? 'alerte' : 'normal';
  const t = now.getTime();
  if (t < new Date(action.debut).getTime()) return 'programme';
  if (t > new Date(action.fin).getTime()) return 'normal';
  return action.type; // 'limite' | 'coupe'
}

/** Puissance tirée après action (limitée à LIMITE_KVA, ou 0 si coupé). */
export function kwApresAction(f, statut, scenario) {
  const kw = kwReseau(f, scenario);
  if (statut === 'coupe') return 0;
  if (statut === 'limite') return Math.min(kw, LIMITE_KVA);
  return kw;
}

/** Le foyer consomme-t-il trop ? 'seuil' : en route pour dépasser 200 kWh ; 'puissance' : tire presque toute sa puissance souscrite. */
export function surconsommation(f, scenario = 'pointe', seuil = 200) {
  const raisons = [];
  if (f.kwhMois > seuil) raisons.push('seuil');
  if (kwReseau(f, scenario) >= f.kva * 0.85) raisons.push('puissance');
  return raisons;
}

/** Indicateurs d'un secteur, en tenant compte des actions de délestage. */
export function etatSecteur(secteur, foyers, actions = {}, scenario = 'pointe', now = new Date()) {
  const liste = foyers.filter((f) => f.secteur === secteur.id);
  let kw = 0, kwSans = 0, nLimite = 0, nCoupe = 0, nProgramme = 0, nAlerte = 0, nPV = 0, kwPV = 0;
  for (const f of liste) {
    const st = statutFoyer(actions[f.id], now);
    kwSans += kwReseau(f, scenario);
    kw += kwApresAction(f, st, scenario);
    if (st === 'limite') nLimite++;
    if (st === 'coupe') nCoupe++;
    if (st === 'programme') nProgramme++;
    if (surconsommation(f, scenario).length) nAlerte++;
    if (f.pv) { nPV++; kwPV += scenario === 'pointe' ? f.pv.kwPointe : 0; }
  }
  return {
    ...secteur, n: liste.length, kw: arr(kw, 1), kwSans: arr(kwSans, 1),
    charge: arr(kw / secteur.capaciteKw, 3), depassementKw: arr(Math.max(0, kw - secteur.capaciteKw), 1),
    nLimite, nCoupe, nProgramme, nAlerte, nPV, kwPV: arr(kwPV, 1), nPrioritaires: liste.filter((f) => f.prioritaire).length,
  };
}

/**
 * Plan de délestage ciblé pour un secteur : quels foyers limiter, puis lesquels couper, pour baisser la charge de `kwAReduire`.
 * Ne touche jamais les foyers prioritaires. Compare avec le délestage classique (tout le secteur coupé).
 */
export function planDelestage(foyersSecteur, kwAReduire, { scenario = 'pointe', actions = {}, now = new Date(), limiteKva = LIMITE_KVA } = {}) {
  const libres = foyersSecteur
    .filter((f) => !f.prioritaire && statutFoyer(actions[f.id], now) !== 'coupe')
    .map((f) => ({ f, kw: kwReseau(f, scenario) }))
    .sort((a, b) => b.kw - a.kw);
  const plan = [];
  let reste = kwAReduire;
  // Étape 1 : limiter les plus gros consommateurs.
  for (const { f, kw } of libres) {
    if (reste <= 0) break;
    if (kw <= limiteKva) continue;
    const gain = arr(kw - limiteKva, 2);
    plan.push({ id: f.id, ref: f.ref, action: 'limite', kwAvant: kw, gainKw: gain });
    reste -= gain;
  }
  // Étape 2 : si la limitation ne suffit pas, couper (les plus gros d'abord ; un foyer déjà limité gagne le reste).
  for (const { f, kw } of libres) {
    if (reste <= 0) break;
    const deja = plan.find((p) => p.id === f.id);
    const gain = arr(deja ? kw - deja.gainKw : kw, 2);
    if (gain <= 0) continue;
    if (deja) { deja.action = 'coupe'; deja.gainKw = arr(kw, 2); } else plan.push({ id: f.id, ref: f.ref, action: 'coupe', kwAvant: kw, gainKw: gain });
    reste -= gain;
  }
  const total = arr(plan.reduce((s, p) => s + p.gainKw, 0), 1);
  return {
    plan, totalKw: total, atteint: reste <= 0.0001,
    nLimites: plan.filter((p) => p.action === 'limite').length,
    nCoupes: plan.filter((p) => p.action === 'coupe').length,
    nSecteur: foyersSecteur.length,
    nProteges: foyersSecteur.filter((f) => f.prioritaire).length,
  };
}

/** Actions à enregistrer pour appliquer un plan : annonce maintenant, action dans PREAVIS_MIN minutes, pendant DUREE_MAX_MIN au plus. */
export function actionsDepuisPlan(plan, now = new Date(), { preavisMin = PREAVIS_MIN, dureeMin = DUREE_MAX_MIN } = {}) {
  const debut = new Date(now.getTime() + preavisMin * 60000);
  const fin = new Date(debut.getTime() + Math.min(dureeMin, DUREE_MAX_MIN) * 60000);
  return Object.fromEntries(plan.plan.map((p) => [p.id, { type: p.action, annonceLe: now.toISOString(), debut: debut.toISOString(), fin: fin.toISOString() }]));
}

/** Synthèse solaire du réseau : par maison équipée, production, injection, gains foyer et STEG. */
export function syntheseSolaire(foyers, tarifs, mois) {
  const lignes = foyers.filter((f) => f.pv).map((f) => {
    const b = bilanSolaire(f.pv, mois, null);
    const consoTotale = f.kwhMois + b.autoconso; // le compteur ne voit que le réseau : on ajoute ce que les panneaux ont fourni sur place
    const g = gainsSolaire(consoTotale, b.production, tarifs);
    return { id: f.id, ref: f.ref, ville: f.ville, secteur: f.secteur, kwc: f.pv.kwc, ...b, consoTotale, ...g, reel: !f.demo };
  }).sort((a, b) => b.gainSteg - a.gainSteg);
  const somme = (k) => arr(lignes.reduce((s, l) => s + l[k], 0), 1);
  return {
    lignes, n: lignes.length, kwc: somme('kwc'), production: somme('production'), injection: somme('injection'),
    gainSteg: somme('gainSteg'), gainFoyers: somme('gainFoyer'), nSousSeuil: lignes.filter((l) => l.sousSeuilGraceAuSolaire).length,
  };
}

/** Place un vrai foyer Mieru (qui partage avec la STEG) sur le réseau : dans un secteur de sa ville, avec sa consommation réelle. */
export function foyerReelReseau({ compteur, releves, partage, pv }, etat, secteurs, i = 0) {
  const ville = VILLES.find((v) => v.id === partage.ville) || VILLES[0];
  let secteur = secteurs.find((s) => s.ville === ville.id);
  let nouveauSecteur = null;
  if (!secteur) {
    nouveauSecteur = { id: `mieru-${ville.id}`, nom: `Mieru · ${ville.nom}`, ville: ville.id, lat: ville.lat, lon: ville.lon, capaciteKw: 0 };
    secteur = nouveauSecteur;
  }
  const angle = (i * 2.4) % (Math.PI * 2);
  const [lat, lon] = decaler(secteur.lat, secteur.lon, 0.35 * Math.cos(angle), 0.35 * Math.sin(angle));
  const kva = 4;
  const kwMaintenant = arr(Math.min(kva, (etat.moyenneJour / 24) * 1.6), 2);
  const auj = new Date();
  const mois = auj.getMonth();
  // L'injection saisie va du 1er à aujourd'hui : on l'étend au mois entier, comme la production.
  const jourDuMois = Math.max(1, auj.getDate()), joursMois = new Date(auj.getFullYear(), mois + 1, 0).getDate();
  return {
    nouveauSecteur,
    foyer: {
      id: `reel-${compteur.id}`, compteurId: compteur.id, ref: partage.reference || `MIERU ${String(compteur.id).slice(0, 4).toUpperCase()}`,
      nomFoyer: partage.nomFoyer || compteur.nom || null, reel: true, demo: false, niveau: 'nomme',
      ville: ville.id, secteur: secteur.id, lat, lon, type: partage.type || null, personnes: partage.personnes || null, kva, clim: null,
      prioritaire: Boolean(partage.prioritaire),
      mois: [{ cle: `${new Date().getFullYear()}-${String(mois + 1).padStart(2, '0')}`, kwh: Math.round(etat.projection) }],
      kwhMois: Math.round(etat.projection), kwhPrec: etat.kwhPrec ?? null,
      kwMaintenant, kwPointe: arr(Math.min(kva * 0.98, kwMaintenant * 2.6), 2),
      pv: pv?.puissanceKwc ? { kwc: pv.puissanceKwc, injectionMesuree: pv.injection == null ? null : Math.round(pv.injection * joursMois / jourDuMois), kwPointe: arr(pv.puissanceKwc * 0.65, 2) } : null,
    },
  };
}
