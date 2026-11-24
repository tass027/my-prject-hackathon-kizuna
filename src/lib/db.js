// Mieru — couche de données (Membre 2).
// Deux modes, même interface :
//  • CLOUD  : Supabase (si VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont remplis) → partage Kizuna en temps réel.
//  • LOCAL  : localStorage + IndexedDB, sans configuration → tout marche sur un seul téléphone.
import { createClient } from '@supabase/supabase-js';
import { get as idbGet, set as idbSet } from 'idb-keyval';

const URL_SB = import.meta.env.VITE_SUPABASE_URL;
const CLE_SB = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const modeCloud = Boolean(URL_SB && CLE_SB);
const sb = modeCloud ? createClient(URL_SB, CLE_SB) : null;

/** Envoie une conversation à l'assistant Aaddad via Supabase Edge Functions. */
export async function demanderAaddad(messages, langue) {
  if (!modeCloud) throw new Error('Configure Supabase pour utiliser l’assistant Aaddad.');
  const { data, error } = await sb.functions.invoke('aaddad-assistant', { body: { messages, langue } });
  if (error) {
    let detail = error.message;
    try {
      const body = await error.context.json();
      detail = body.error || detail;
    } catch { /* La réponse peut ne pas contenir de JSON. */ }
    throw new Error(detail);
  }
  if (!data?.reply) throw new Error('L’assistant n’a pas renvoyé de réponse.');
  return data.reply;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const nouveauCode = () => {
  const lettres = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => lettres[Math.floor(Math.random() * lettres.length)]).join('');
};

// ---------- Session (qui suis-je, quel compteur) ----------
const CLE_SESSION = 'mieru:session';
export function session() {
  try { return JSON.parse(localStorage.getItem(CLE_SESSION)) || null; } catch { return null; }
}
function enregistrerSession(s) { localStorage.setItem(CLE_SESSION, JSON.stringify(s)); }
export function quitter() { localStorage.removeItem(CLE_SESSION); }

// ---------- Conversions base ↔ application ----------
const compteurDepuis = (r) => ({ id: r.id, nom: r.nom, code: r.code_partage, indexDepart: Number(r.index_depart), seuil: Number(r.seuil_kwh_mois), creeLe: r.cree_le });
const membreDepuis = (r) => ({ id: r.id, compteurId: r.compteur_id, prenom: r.prenom, role: r.role, rejointLe: r.rejoint_le });
const releveDepuis = (r) => ({ id: r.id, compteurId: r.compteur_id, membreId: r.membre_id, index: Number(r.index_kwh), source: r.source, confiance: r.confiance_ocr, photoChemin: r.photo_chemin, sha256: r.photo_sha256, prisLe: r.pris_le, recuLe: r.recu_le });
const messageDepuis = (r) => ({ id: r.id, membreId: r.membre_id, texte: r.texte, creeLe: r.cree_le });

// ---------- Stockage local ----------
const CLE_LOCAL = 'mieru:donnees';
const lireLocal = () => { try { return JSON.parse(localStorage.getItem(CLE_LOCAL)) || { compteurs: {} }; } catch { return { compteurs: {} }; } };
const ecrireLocal = (d) => { localStorage.setItem(CLE_LOCAL, JSON.stringify(d)); window.dispatchEvent(new Event('mieru:maj')); };
const CLE_PV_LOCAL = 'mieru:pv';

function lirePhotovoltaiquesLocal() {
  const texte = localStorage.getItem(CLE_PV_LOCAL);
  return texte ? JSON.parse(texte) : {};
}

// ---------- API ----------
export async function creerCompteur({ nom, prenom, indexDepart, seuil = 200 }) {
  const code = nouveauCode();
  if (modeCloud) {
    const { data: c, error } = await sb.from('compteurs').insert({ nom, code_partage: code, index_depart: indexDepart, seuil_kwh_mois: seuil }).select().single();
    if (error) throw error;
    const { data: m, error: e2 } = await sb.from('membres').insert({ compteur_id: c.id, prenom, role: 'createur' }).select().single();
    if (e2) throw e2;
    enregistrerSession({ compteurId: c.id, membreId: m.id, prenom });
    return { compteur: compteurDepuis(c), membre: membreDepuis(m) };
  }
  const d = lireLocal();
  const compteur = { id: uid(), nom, code, indexDepart, seuil, creeLe: new Date().toISOString() };
  const membre = { id: uid(), compteurId: compteur.id, prenom, role: 'createur', rejointLe: compteur.creeLe };
  d.compteurs[compteur.id] = { compteur, membres: [membre], releves: [], messages: [], kakeibo: {} };
  ecrireLocal(d);
  enregistrerSession({ compteurId: compteur.id, membreId: membre.id, prenom });
  return { compteur, membre };
}

export async function rejoindreCompteur(code, prenom, role = 'membre') {
  const c0 = code.trim().toUpperCase();
  if (modeCloud) {
    const { data: c, error } = await sb.from('compteurs').select().eq('code_partage', c0).maybeSingle();
    if (error) throw error;
    if (!c) throw new Error('Aucun compteur avec ce code.');
    const { data: m, error: e2 } = await sb.from('membres').insert({ compteur_id: c.id, prenom, role }).select().single();
    if (e2) throw e2;
    enregistrerSession({ compteurId: c.id, membreId: m.id, prenom });
    return { compteur: compteurDepuis(c), membre: membreDepuis(m) };
  }
  const d = lireLocal();
  const entree = Object.values(d.compteurs).find((x) => x.compteur.code === c0);
  if (!entree) throw new Error("Aucun compteur avec ce code sur ce téléphone. Le partage entre téléphones demande Supabase (voir README).");
  const membre = { id: uid(), compteurId: entree.compteur.id, prenom, role, rejointLe: new Date().toISOString() };
  entree.membres.push(membre);
  ecrireLocal(d);
  enregistrerSession({ compteurId: entree.compteur.id, membreId: membre.id, prenom });
  return { compteur: entree.compteur, membre };
}

/** Tout ce qu'il faut pour afficher le compteur : { compteur, membres, releves, messages }. */
export async function chargerCompteur(compteurId) {
  if (modeCloud) {
    const [c, m, r, msg] = await Promise.all([
      sb.from('compteurs').select().eq('id', compteurId).single(),
      sb.from('membres').select().eq('compteur_id', compteurId).order('rejoint_le'),
      sb.from('releves').select().eq('compteur_id', compteurId).order('recu_le'),
      sb.from('messages').select().eq('compteur_id', compteurId).order('cree_le', { ascending: false }).limit(20),
    ]);
    const err = c.error || m.error || r.error || msg.error;
    if (err) throw err;
    return { compteur: compteurDepuis(c.data), membres: m.data.map(membreDepuis), releves: r.data.map(releveDepuis), messages: msg.data.map(messageDepuis) };
  }
  const e = lireLocal().compteurs[compteurId];
  if (!e) throw new Error('Compteur introuvable.');
  return { compteur: e.compteur, membres: e.membres, releves: e.releves, messages: [...e.messages].reverse() };
}

/** Enregistre un relevé. `photo` = Blob (facultatif), `sha256` et `prisLe` viennent de preuve.js. */
export async function ajouterReleve({ compteurId, membreId, index, source, confiance = null, photo = null, sha256 = null, prisLe = null }) {
  const id = uid();
  if (modeCloud) {
    let photoChemin = null;
    if (photo) {
      photoChemin = `${compteurId}/${id}.jpg`;
      const { error } = await sb.storage.from('releves').upload(photoChemin, photo, { contentType: photo.type || 'image/jpeg' });
      if (error) throw error;
    }
    const { data, error } = await sb.from('releves').insert({ id, compteur_id: compteurId, membre_id: membreId, index_kwh: index, source, confiance_ocr: confiance, photo_chemin: photoChemin, photo_sha256: sha256, pris_le: prisLe }).select().single();
    if (error) throw error;
    return releveDepuis(data);
  }
  if (photo) await idbSet(`photo:${id}`, photo);
  const releve = { id, compteurId, membreId, index, source, confiance, photoChemin: photo ? `idb:${id}` : null, sha256, prisLe, recuLe: new Date().toISOString() };
  const d = lireLocal();
  d.compteurs[compteurId].releves.push(releve);
  ecrireLocal(d);
  return releve;
}

/** URL affichable d'une photo de relevé (ou null). */
export async function urlPhoto(releve) {
  if (!releve.photoChemin) return null;
  if (releve.photoChemin.startsWith('idb:')) {
    const blob = await idbGet(`photo:${releve.id}`);
    return blob ? URL.createObjectURL(blob) : null;
  }
  if (releve.photoChemin.startsWith('demo:')) return releve.photoChemin.slice(5);
  return sb.storage.from('releves').getPublicUrl(releve.photoChemin).data.publicUrl;
}

export async function envoyerMessage(compteurId, membreId, texte) {
  if (modeCloud) {
    const { error } = await sb.from('messages').insert({ compteur_id: compteurId, membre_id: membreId, texte });
    if (error) throw error;
    return;
  }
  const d = lireLocal();
  d.compteurs[compteurId].messages.push({ id: uid(), membreId, texte, creeLe: new Date().toISOString() });
  ecrireLocal(d);
}

export async function lireKakeibo(compteurId, mois) {
  if (modeCloud) {
    const { data } = await sb.from('kakeibo').select().eq('compteur_id', compteurId).eq('mois', mois).maybeSingle();
    return data ? { objectifKwh: Number(data.objectif_kwh), evenements: data.evenements, amelioration: data.amelioration, bilan: data.bilan } : null;
  }
  return lireLocal().compteurs[compteurId]?.kakeibo?.[mois] || null;
}

export async function ecrireKakeibo(compteurId, mois, k) {
  if (modeCloud) {
    const { error } = await sb.from('kakeibo').upsert({ compteur_id: compteurId, mois, objectif_kwh: k.objectifKwh, evenements: k.evenements || [], amelioration: k.amelioration || null, bilan: k.bilan || null }, { onConflict: 'compteur_id,mois' });
    if (error) throw error;
    return;
  }
  const d = lireLocal();
  d.compteurs[compteurId].kakeibo[mois] = k;
  ecrireLocal(d);
}

/** Appelle `rappel` à chaque changement (autre téléphone en mode cloud, autre onglet en local). Renvoie la fonction d'arrêt. */
export function ecouter(compteurId, rappel) {
  if (modeCloud) {
    const canal = sb.channel(`compteur-${compteurId}`);
    for (const table of ['releves', 'membres', 'messages']) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table, filter: `compteur_id=eq.${compteurId}` }, rappel);
    }
    canal.subscribe();
    return () => sb.removeChannel(canal);
  }
  const f = () => rappel();
  window.addEventListener('mieru:maj', f);
  window.addEventListener('storage', f);
  return () => { window.removeEventListener('mieru:maj', f); window.removeEventListener('storage', f); };
}

/** Données de démo pour le pitch : « Maison Ben Salah », 3 membres, relevés d'octobre et novembre. */
export async function creerDemo(now = new Date(), { nom = 'Maison Ben Salah', message = 'On reste de ce côté du torii ce mois-ci !' } = {}) {
  const { compteur, membre } = await creerCompteur({ nom, prenom: 'Sonia', indexDepart: 4420 });
  enregistrerSession({ ...session(), demo: true });
  const autres = [];
  for (const [prenom, role] of [['Samir', 'membre'], ['Leila', 'membre'], ['Youssef', 'suivi_distance']]) {
    if (modeCloud) {
      const { data } = await sb.from('membres').insert({ compteur_id: compteur.id, prenom, role }).select().single();
      autres.push(data.id);
    } else {
      const d = lireLocal();
      const m = { id: uid(), compteurId: compteur.id, prenom, role, rejointLe: new Date().toISOString() };
      d.compteurs[compteur.id].membres.push(m); ecrireLocal(d); autres.push(m.id);
    }
  }
  // 168 kWh consommés depuis le 1er du mois, ~8 kWh/jour.
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
  const soir = (offsetJours) => new Date(debutMois.getTime() + offsetJours * 86400000 + 19.5 * 3600000);
  const hier = now.getDate() - 2; // décalage en jours depuis le 1er
  const ref = 4653;
  const points = [[soir(-1), ref]];
  for (let j = 3; j < hier; j += 4) points.push([soir(j), Math.round(ref + 154 * (j / Math.max(1, hier)))]);
  if (hier >= 0) points.push([soir(hier), ref + 154]);
  points.push([new Date(now.getTime() - 30 * 60000), ref + 168]);
  const ids = [membre.id, ...autres.slice(0, 2)];
  let i = 0;
  for (const [date, index] of points) {
    if (modeCloud) {
      await sb.from('releves').insert({ compteur_id: compteur.id, membre_id: ids[i % 3], index_kwh: index, source: 'manuel', pris_le: date.toISOString() });
    } else {
      const d = lireLocal();
      d.compteurs[compteur.id].releves.push({ id: uid(), compteurId: compteur.id, membreId: ids[i % 3], index, source: 'manuel', prisLe: date.toISOString(), recuLe: date.toISOString() });
      ecrireLocal(d);
    }
    i++;
  }
  await envoyerMessage(compteur.id, autres[2], message);
  // Démo : la maison a 3 kWc de panneaux ; 41 kWh injectés sur le réseau depuis le 1er (mesure du compteur bidirectionnel).
  await ecrirePhotovoltaique(compteur.id, { puissanceKwc: 3, partagerAgrege: true, exportations: { [now.toISOString().slice(0, 7)]: 41 } });
  return compteur;
}

// ---------- Partage avec la STEG (condition d'utilisation) ----------
// Utiliser Mieru implique de transmettre ses relevés à la STEG (conditions acceptées à l'inscription).
// Base légale : convention entre le foyer et la STEG (loi organique 2004-63, art. 29), déclarée à l'INPDP.
// Le foyer garde une page « Ce que la STEG voit » et peut déclarer un besoin vital (équipement médical) : il n'est alors jamais coupé.
const depuisLigne = (data) => ({
  niveau: data.niveau, ville: data.ville, nomFoyer: data.nom_foyer || null,
  type: data.type_logement || null, personnes: data.personnes || null,
  prioritaire: Boolean(data.prioritaire), consentiLe: data.consenti_le,
});

export async function lirePartage(compteurId) {
  if (modeCloud) {
    const { data, error } = await sb.from('partages_steg').select().eq('compteur_id', compteurId).maybeSingle();
    if (error) throw error;
    return data ? depuisLigne(data) : { niveau: 'aucun' };
  }
  return lireLocal().compteurs[compteurId]?.partage || { niveau: 'aucun' };
}

/** Enregistre l'acceptation des conditions (niveau 'nomme') et les informations du foyer. */
export async function ecrirePartage(compteurId, p) {
  const consentiLe = p.niveau === 'aucun' ? null : (p.consentiLe || new Date().toISOString());
  const ligne = { niveau: p.niveau, ville: p.ville, nomFoyer: p.nomFoyer || null, type: p.type || null, personnes: p.personnes || null, prioritaire: Boolean(p.prioritaire), consentiLe };
  if (modeCloud) {
    const { error } = await sb.from('partages_steg').upsert({
      compteur_id: compteurId, niveau: ligne.niveau, ville: ligne.ville, nom_foyer: ligne.nomFoyer, type_logement: ligne.type,
      personnes: ligne.personnes, prioritaire: ligne.prioritaire, consenti_le: consentiLe, modifie_le: new Date().toISOString(),
    });
    if (error) throw error;
    return;
  }
  const d = lireLocal();
  d.compteurs[compteurId].partage = ligne;
  ecrireLocal(d);
}

/** Pour le tableau de bord STEG : tous les foyers Mieru. [{ compteur, releves, partage, pv }] */
export async function listerPartages() {
  if (modeCloud) {
    const { data, error } = await sb.from('steg_foyers').select();
    if (error) throw error;
    return data.map((f) => ({
      compteur: { id: f.compteur_id, nom: f.nom_foyer, indexDepart: Number(f.index_depart), creeLe: f.cree_le },
      releves: f.releves.map((r) => ({ index: Number(r.index), prisLe: r.prisLe, recuLe: r.recuLe })),
      partage: depuisLigne(f),
      pv: f.pv_kwc ? { puissanceKwc: Number(f.pv_kwc), injection: f.pv_injection === null ? null : Number(f.pv_injection) } : null,
    }));
  }
  const pvs = lirePhotovoltaiquesLocal();
  const cle = new Date().toISOString().slice(0, 7);
  return Object.values(lireLocal().compteurs)
    .filter((e) => e.partage && e.partage.niveau !== 'aucun')
    .map((e) => {
      const pv = pvs[e.compteur.id];
      return {
        compteur: { id: e.compteur.id, nom: e.compteur.nom, indexDepart: e.compteur.indexDepart, creeLe: e.compteur.creeLe },
        releves: e.releves.map(({ index, prisLe, recuLe }) => ({ index, prisLe, recuLe })),
        partage: e.partage,
        pv: pv?.puissanceKwc ? { puissanceKwc: pv.puissanceKwc, injection: pv.exportations?.[cle] ?? null } : null,
      };
    });
}

// ---------- Avis de la STEG vers un foyer : alerte de surconsommation, annonce de limitation ou de coupure ----------
const CLE_AVIS = 'mieru:avis-steg';
const lireAvisLocal = () => { try { return JSON.parse(localStorage.getItem(CLE_AVIS)) || {}; } catch { return {}; } };

/** avis = { type: 'alerte' | 'limite' | 'coupe' | 'retabli', debut?, fin?, raisons? } */
export async function envoyerAvisSteg(compteurId, avis) {
  const ligne = { id: uid(), ...avis, envoyeLe: new Date().toISOString() };
  if (modeCloud) {
    const { error } = await sb.from('avis_steg').insert({ compteur_id: compteurId, type: avis.type, debut: avis.debut || null, fin: avis.fin || null, raisons: avis.raisons || null });
    if (error) throw error;
    return ligne;
  }
  const tous = lireAvisLocal();
  tous[compteurId] = [ligne, ...(tous[compteurId] || [])].slice(0, 20);
  localStorage.setItem(CLE_AVIS, JSON.stringify(tous));
  window.dispatchEvent(new Event('mieru:maj'));
  return ligne;
}

export async function lireAvisSteg(compteurId) {
  if (modeCloud) {
    const { data, error } = await sb.from('avis_steg').select().eq('compteur_id', compteurId).order('envoye_le', { ascending: false }).limit(20);
    if (error) throw error;
    return data.map((a) => ({ id: a.id, type: a.type, debut: a.debut, fin: a.fin, raisons: a.raisons, envoyeLe: a.envoye_le, luLe: a.lu_le }));
  }
  return lireAvisLocal()[compteurId] || [];
}

export async function marquerAvisLu(compteurId, avisId) {
  if (modeCloud) { await sb.from('avis_steg').update({ lu_le: new Date().toISOString() }).eq('id', avisId); return; }
  const tous = lireAvisLocal();
  tous[compteurId] = (tous[compteurId] || []).map((a) => (a.id === avisId ? { ...a, luLe: new Date().toISOString() } : a));
  localStorage.setItem(CLE_AVIS, JSON.stringify(tous));
  window.dispatchEvent(new Event('mieru:maj'));
}

export async function lirePhotovoltaique(compteurId) {
  return lirePhotovoltaiquesLocal()[compteurId] || null;
}

export async function ecrirePhotovoltaique(compteurId, donnees) {
  const installationsPV = lirePhotovoltaiquesLocal();
  installationsPV[compteurId] = donnees;
  localStorage.setItem(CLE_PV_LOCAL, JSON.stringify(installationsPV));
  window.dispatchEvent(new Event('mieru:maj'));
  if (modeCloud) {
    // Partage obligatoire : la STEG voit la puissance installée et l'injection du mois.
    const injection = donnees.exportations?.[new Date().toISOString().slice(0, 7)] ?? null;
    await sb.from('partages_steg').update({ pv_kwc: donnees.puissanceKwc, pv_injection_kwh: injection }).eq('compteur_id', compteurId);
  }
}

export async function publierAgregatPhotovoltaique(compteurId, { mois, ville, productionKwh, exportKwh, partager }) {
  if (!modeCloud) return false;
  const { error } = await sb.rpc('soumettre_pv_agrege', {
    p_compteur_id: compteurId,
    p_mois: mois,
    p_ville: ville,
    p_production_estimee_kwh: productionKwh,
    p_export_mesure_kwh: exportKwh,
    p_partager: partager,
  });
  if (error) throw error;
  return true;
}

export async function listerAgregatsPhotovoltaiques() {
  if (!modeCloud) return [];
  const { data, error } = await sb.from('steg_pv_agregats')
    .select('mois, ville, foyers_pv, production_estimee_kwh, export_mesure_kwh')
    .order('mois', { ascending: false });
  if (error) throw error;
  return data.map((ligne) => ({
    mois: ligne.mois,
    ville: ligne.ville,
    foyers: Number(ligne.foyers_pv),
    productionEstimeeKwh: Number(ligne.production_estimee_kwh),
    exportMesureKwh: ligne.export_mesure_kwh === null ? null : Number(ligne.export_mesure_kwh),
  }));
}
