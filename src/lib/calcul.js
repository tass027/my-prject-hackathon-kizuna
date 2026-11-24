// Mieru — moteur de calcul (Membre 2). Fonctions pures, sans dépendance : testées avec `npm test`.
// Toutes les dates sont des chaînes ISO ou des objets Date. Les index sont en kWh.

const JOUR_MS = 86400000;

const toDate = (d) => (d instanceof Date ? d : new Date(d));
const jours = (a, b) => (toDate(b) - toDate(a)) / JOUR_MS;
const arrondi = (n, p = 1) => Math.round(n * 10 ** p) / 10 ** p;

/** Date à laquelle un relevé a été fait (date de la photo si connue, sinon date de réception). */
export const dateReleve = (r) => r.prisLe || r.recuLe;

/** Mois civil en cours : début, fin, nombre de jours, jours restants (aujourd'hui compris). */
export function periode(now = new Date()) {
  const n = toDate(now);
  const debut = new Date(n.getFullYear(), n.getMonth(), 1);
  const fin = new Date(n.getFullYear(), n.getMonth() + 1, 1);
  const total = Math.round(jours(debut, fin));
  const ecoules = jours(debut, n);
  return { debut, fin, total, ecoules, joursRestants: Math.max(0, Math.ceil(total - ecoules)) };
}

/** Prix d'un mois de consommation selon le régime (effet de seuil : tout bascule au-delà de 200 kWh). */
export function coutMensuel(kwh, tarifs) {
  const seuil = tarifs.seuilMensuelKwh;
  const [bas, haut] = tarifs.regimes;
  const prix = kwh <= seuil ? bas.prixMoyenDinarsParKwh : haut.prixMoyenDinarsParKwh;
  return arrondi(kwh * prix, 2);
}

/** Ce que coûte le passage au-dessus du seuil pour une consommation donnée (0 si sous le seuil). */
export function surcout(kwh, tarifs) {
  if (kwh <= tarifs.seuilMensuelKwh) return 0;
  const bas = tarifs.regimes[0].prixMoyenDinarsParKwh;
  return arrondi(coutMensuel(kwh, tarifs) - kwh * bas, 1);
}

/** Point de référence du mois : dernier relevé avant le 1er du mois, sinon l'index de départ du compteur. */
export function reference(compteur, releves, debut) {
  const avant = releves
    .filter((r) => toDate(dateReleve(r)) < debut)
    .sort((a, b) => toDate(dateReleve(b)) - toDate(dateReleve(a)));
  if (avant.length) return { index: avant[0].index, date: toDate(dateReleve(avant[0])) };
  const cree = toDate(compteur.creeLe || debut);
  return { index: compteur.indexDepart, date: cree > debut ? cree : debut };
}

/**
 * État complet du compteur pour l'écran d'accueil.
 * niveau : 'ok' (sous 80 % et projection sous 90 % du seuil), 'warn' (le seuil approche), 'over' (dépassé).
 */
export function calculerEtat(compteur, releves, tarifs, now = new Date()) {
  const seuil = compteur.seuil || tarifs.seuilMensuelKwh;
  const p = periode(now);
  const ref = reference(compteur, releves, p.debut);
  const duMois = releves
    .filter((r) => toDate(dateReleve(r)) >= p.debut)
    .sort((a, b) => toDate(dateReleve(a)) - toDate(dateReleve(b)));
  const dernier = duMois[duMois.length - 1] || null;
  const indexActuel = dernier ? dernier.index : ref.index;
  const consoPeriode = Math.max(0, indexActuel - ref.index);

  const joursMesures = dernier ? Math.max(1, jours(ref.date, dateReleve(dernier))) : 0;
  const moyenneJour = joursMesures ? consoPeriode / joursMesures : 0;
  const joursJusquaFin = dernier ? Math.max(0, jours(dateReleve(dernier), p.fin)) : p.joursRestants;
  const projection = consoPeriode + moyenneJour * joursJusquaFin;

  const resteKwh = seuil - consoPeriode;
  const ratio = consoPeriode / seuil;
  const joursAvantSeuil = moyenneJour > 0 && resteKwh > 0 ? resteKwh / moyenneJour : null;

  let niveau = 'ok';
  if (consoPeriode > seuil) niveau = 'over';
  else if (ratio >= 0.8 || projection > seuil * 0.9) niveau = 'warn';

  return {
    seuil,
    consoPeriode: arrondi(consoPeriode),
    resteKwh: arrondi(resteKwh),
    ratio,
    projection: arrondi(projection),
    moyenneJour: arrondi(moyenneJour, 2),
    joursRestants: p.joursRestants,
    joursAvantSeuil: joursAvantSeuil === null ? null : Math.floor(joursAvantSeuil),
    niveau,
    coutActuel: coutMensuel(consoPeriode, tarifs),
    surcoutProjete: surcout(projection, tarifs),
    surcoutPremierKwh: arrondi(coutMensuel(seuil + 1, tarifs) - coutMensuel(seuil, tarifs), 1),
    indexActuel,
    dernierReleve: dernier,
    nbRelevesMois: duMois.length,
  };
}

/** Contrôle d'un nouvel index avant validation (cahier des charges, F2). */
export function verifierReleve(nouvelIndex, compteur, releves, now = new Date()) {
  const tous = [...releves].sort((a, b) => toDate(dateReleve(b)) - toDate(dateReleve(a)));
  const precedent = tous[0] ? { index: tous[0].index, date: dateReleve(tous[0]) } : { index: compteur.indexDepart, date: compteur.creeLe || now };
  const delta = nouvelIndex - precedent.index;
  const nbJours = Math.max(1 / 24, jours(precedent.date, now));
  // Codes traduits par l'interface : 'nan', 'baisse', 'trop'.
  const avertissements = [];
  if (!Number.isFinite(nouvelIndex)) avertissements.push('nan');
  else if (delta < 0) avertissements.push('baisse');
  else if (delta / nbJours > 50) avertissements.push('trop');
  return { delta: arrondi(delta), precedent, avertissements, ok: avertissements.length === 0 };
}

/** Coût d'un appareil et durée maximale par jour pour rester sous le seuil (F5). */
export function coutAppareil(appareil, quantiteParJour, etat, tarifs) {
  const jr = Math.max(1, etat.joursRestants);
  const kwhTotal = appareil.kw * quantiteParJour * jr;
  const prix = tarifs.regimes[0].prixMoyenDinarsParKwh;
  const maxParJour = etat.resteKwh > 0 ? etat.resteKwh / jr / appareil.kw : 0;
  let verdict = 'ok';
  if (kwhTotal > etat.resteKwh) verdict = 'over';
  else if (kwhTotal > etat.resteKwh * 0.5) verdict = 'warn';
  return { kwhTotal: arrondi(kwhTotal), dinars: arrondi(kwhTotal * prix, 1), maxParJour, verdict };
}

/** Projection mensuelle avec les appareils ajoutés au scénario du simulateur. */
export function projectionAppareils(appareils, etat, tarifs) {
  const kwhAjoutes = appareils.reduce(
    (total, { appareil, quantite }) => total + appareil.kw * quantite * etat.joursRestants,
    0,
  );
  const kwhProjetes = etat.projection + kwhAjoutes;
  let verdict = 'ok';
  if (kwhProjetes > etat.seuil) verdict = 'over';
  else if (kwhProjetes > etat.seuil * 0.9) verdict = 'warn';
  return {
    kwhAjoutes: arrondi(kwhAjoutes),
    kwhProjetes: arrondi(kwhProjetes),
    dinars: coutMensuel(kwhProjetes, tarifs),
    verdict,
  };
}

/**
 * Série du graphique : consommation cumulée depuis le 1er du mois, un point par relevé,
 * plus la projection jusqu'à la fin du mois. Jours exprimés en jours décimaux depuis le 1er (0 = 1er à minuit).
 */
export function serieMois(compteur, releves, tarifs, now = new Date()) {
  const p = periode(now);
  const ref = reference(compteur, releves, p.debut);
  const pts = [{ jour: 0, kwh: 0 }];
  releves
    .filter((r) => toDate(dateReleve(r)) >= p.debut && toDate(dateReleve(r)) <= toDate(now))
    .sort((a, b) => toDate(dateReleve(a)) - toDate(dateReleve(b)))
    .forEach((r) => pts.push({ jour: arrondi(jours(p.debut, dateReleve(r)), 2), kwh: Math.max(0, r.index - ref.index) }));
  const etat = calculerEtat(compteur, releves, tarifs, now);
  const dernier = pts[pts.length - 1];
  const projection = { jour: p.total, kwh: Math.max(dernier.kwh, etat.projection) };
  return { points: pts, projection, totalJours: p.total, seuil: etat.seuil, aujourdhui: arrondi(p.ecoules, 2) };
}

/** Heures et minutes d'une durée décimale : 3,24 → { h: 3, m: 14 }. */
export const heuresMinutes = (v) => { let h = Math.floor(v), m = Math.round((v - h) * 60); if (m === 60) { h += 1; m = 0; } return { h, m }; };

/** « 3,2 » → « 3 h 10 » ; pour les unités non horaires, nombre arrondi. */
export function formatDuree(valeur, unite = 'h') {
  if (unite !== 'h') return `${arrondi(valeur, 1).toString().replace('.', ',')} ${unite}${valeur >= 2 ? 's' : ''}`;
  const h = Math.floor(valeur);
  const m = Math.round((valeur - h) * 60);
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

export const fmt = (n, p = 1) => arrondi(n, p).toString().replace('.', ',');
