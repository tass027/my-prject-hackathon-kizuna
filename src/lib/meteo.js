// Mieru — alerte canicule : prévisions des 3 prochains jours (Open-Meteo, gratuit, sans clé).
// https://open-meteo.com — si le réseau est indisponible, l'interface affiche un message (ou l'exemple en mode démo).

export const VILLES = [
  { id: 'tunis', nom: 'Tunis', nomAr: 'تونس', lat: 36.81, lon: 10.18 },
  { id: 'ariana', nom: 'Ariana', nomAr: 'أريانة', lat: 36.86, lon: 10.19 },
  { id: 'ben-arous', nom: 'Ben Arous', nomAr: 'بن عروس', lat: 36.75, lon: 10.23 },
  { id: 'bizerte', nom: 'Bizerte', nomAr: 'بنزرت', lat: 37.27, lon: 9.87 },
  { id: 'nabeul', nom: 'Nabeul', nomAr: 'نابل', lat: 36.45, lon: 10.74 },
  { id: 'sousse', nom: 'Sousse', nomAr: 'سوسة', lat: 35.83, lon: 10.64 },
  { id: 'monastir', nom: 'Monastir', nomAr: 'المنستير', lat: 35.78, lon: 10.83 },
  { id: 'mahdia', nom: 'Mahdia', nomAr: 'المهدية', lat: 35.5, lon: 11.06 },
  { id: 'sfax', nom: 'Sfax', nomAr: 'صفاقس', lat: 34.74, lon: 10.76 },
  { id: 'kairouan', nom: 'Kairouan', nomAr: 'القيروان', lat: 35.68, lon: 10.1 },
  { id: 'beja', nom: 'Béja', nomAr: 'باجة', lat: 36.73, lon: 9.18 },
  { id: 'jendouba', nom: 'Jendouba', nomAr: 'جندوبة', lat: 36.5, lon: 8.78 },
  { id: 'le-kef', nom: 'Le Kef', nomAr: 'الكاف', lat: 36.17, lon: 8.71 },
  { id: 'siliana', nom: 'Siliana', nomAr: 'سليانة', lat: 36.08, lon: 9.37 },
  { id: 'kasserine', nom: 'Kasserine', nomAr: 'القصرين', lat: 35.17, lon: 8.83 },
  { id: 'sidi-bouzid', nom: 'Sidi Bouzid', nomAr: 'سيدي بوزيد', lat: 35.04, lon: 9.48 },
  { id: 'gafsa', nom: 'Gafsa', nomAr: 'قفصة', lat: 34.43, lon: 8.78 },
  { id: 'tozeur', nom: 'Tozeur', nomAr: 'توزر', lat: 33.92, lon: 8.13 },
  { id: 'kebili', nom: 'Kébili', nomAr: 'قبلي', lat: 33.7, lon: 8.97 },
  { id: 'gabes', nom: 'Gabès', nomAr: 'قابس', lat: 33.88, lon: 10.1 },
  { id: 'medenine', nom: 'Médenine', nomAr: 'مدنين', lat: 33.35, lon: 10.5 },
  { id: 'tataouine', nom: 'Tataouine', nomAr: 'تطاوين', lat: 32.93, lon: 10.45 },
];

// Seuils de chaleur (°C, température maximale du jour). Valeurs simples, à ajuster si besoin.
export const SEUIL_CHALEUR = 35;
export const SEUIL_CANICULE = 40;
// Hausse estimée de la consommation d'un jour très chaud (la clim tourne plus) : estimation, pas une mesure.
const HAUSSE = { chaleur: 0.25, canicule: 0.45 };

const CLE_VILLE = 'mieru:ville';
export function villeChoisie() {
  try { return VILLES.find((v) => v.id === localStorage.getItem(CLE_VILLE)) || VILLES[0]; } catch { return VILLES[0]; }
}
export function choisirVille(id) { try { localStorage.setItem(CLE_VILLE, id); } catch { /* stockage indisponible */ } }

/** Nom de la ville dans la langue de l'interface. */
export const nomVille = (v, lang) => (lang === 'ar' ? v.nomAr : v.nom);

export const niveauChaleur = (tmax) => (tmax >= SEUIL_CANICULE ? 'canicule' : tmax >= SEUIL_CHALEUR ? 'chaleur' : 'normal');

const cache = new Map();

/** Prévisions des 3 prochains jours (aujourd'hui compris) : [{ date: 'YYYY-MM-DD', tmax, tmin, niveau }]. */
export async function previsions(ville) {
  const cle = `${ville.id}:${new Date().toISOString().slice(0, 13)}`;
  if (cache.has(cle)) return cache.get(cle);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${ville.lat}&longitude=${ville.lon}&daily=temperature_2m_max,temperature_2m_min&timezone=Africa%2FTunis&forecast_days=3`;
  const rep = await fetch(url);
  if (!rep.ok) throw new Error(`Open-Meteo ${rep.status}`);
  const d = (await rep.json()).daily;
  const jours = d.time.map((date, i) => ({ date, tmax: Math.round(d.temperature_2m_max[i]), tmin: Math.round(d.temperature_2m_min[i]), niveau: niveauChaleur(d.temperature_2m_max[i]) }));
  cache.set(cle, jours);
  return jours;
}

/** Exemple de canicule pour la démo devant le jury (affiché comme tel dans l'interface). */
export function previsionsDemo(now = new Date()) {
  return [41, 43, 38].map((tmax, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { date, tmax, tmin: tmax - 13, niveau: niveauChaleur(tmax) };
  });
}

/**
 * Effet estimé des jours chauds sur le budget : kWh en plus sur les 3 jours,
 * et si ce surplus fait passer le seuil. `etat` vient de calculerEtat().
 */
export function impactChaleur(jours, etat) {
  const chauds = jours.filter((j) => j.niveau !== 'normal');
  const moyenne = etat.moyenneJour || 0;
  const kwhEnPlus = Math.round(chauds.reduce((s, j) => s + moyenne * HAUSSE[j.niveau], 0) * 10) / 10;
  return {
    joursChauds: chauds.length,
    pire: chauds.some((j) => j.niveau === 'canicule') ? 'canicule' : chauds.length ? 'chaleur' : 'normal',
    tmax: Math.max(...jours.map((j) => j.tmax)),
    kwhEnPlus,
    passeLeSeuil: etat.resteKwh > 0 && kwhEnPlus + moyenne * jours.length >= etat.resteKwh,
  };
}
