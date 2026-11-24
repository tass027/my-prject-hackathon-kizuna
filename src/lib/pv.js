const rendementCache = new Map();
const arrondir = (n) => Math.round(n * 10) / 10;

export function productionPVDepuisRendement(rendementMensuelKwhParKwc, puissanceKwc, date = new Date()) {
  if (!Number.isFinite(rendementMensuelKwhParKwc) || rendementMensuelKwhParKwc < 0) {
    throw new RangeError('Rendement PV mensuel invalide.');
  }
  if (!Number.isFinite(puissanceKwc) || puissanceKwc <= 0) {
    throw new RangeError('La puissance photovoltaïque doit être supérieure à zéro.');
  }
  const joursMois = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return arrondir(rendementMensuelKwhParKwc * puissanceKwc * date.getDate() / joursMois);
}

export function consommationTotalePV(importReseauKwh, productionKwh, exportReseauKwh) {
  if (![importReseauKwh, productionKwh, exportReseauKwh].every((v) => Number.isFinite(v) && v >= 0)) return null;
  const total = importReseauKwh + productionKwh - exportReseauKwh;
  return total >= 0 ? arrondir(total) : null;
}

export function agregerPVVisibles(lignes, minimumFoyers = 5) {
  return lignes.filter((ligne) => Number.isFinite(ligne.foyers) && ligne.foyers >= minimumFoyers);
}

export async function rendementsMensuelsPV(ville) {
  if (!ville?.id || !Number.isFinite(ville.lat) || !Number.isFinite(ville.lon)) {
    throw new TypeError('Une ville avec coordonnées est nécessaire pour estimer la production PV.');
  }
  if (rendementCache.has(ville.id)) return rendementCache.get(ville.id);

  const params = new URLSearchParams({
    lat: String(ville.lat),
    lon: String(ville.lon),
    peakpower: '1',
    loss: '14',
    angle: '30',
    aspect: '0',
    outputformat: 'json',
  });
  const response = await fetch(`https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?${params}`);
  if (!response.ok) throw new Error(`PVGIS ${response.status}`);
  const data = await response.json();
  const rendements = data.outputs?.monthly?.fixed;
  if (!Array.isArray(rendements) || rendements.length !== 12 || rendements.some((m) => !Number.isFinite(Number(m.E_m)) || Number(m.E_m) < 0)) {
    throw new Error('Réponse de rendement photovoltaïque invalide.');
  }
  const valeurs = rendements.map((m) => Number(m.E_m));
  rendementCache.set(ville.id, valeurs);
  return valeurs;
}

export async function estimerProductionPV(puissanceKwc, ville, date = new Date()) {
  const rendements = await rendementsMensuelsPV(ville);
  return productionPVDepuisRendement(rendements[date.getMonth()], puissanceKwc, date);
}
