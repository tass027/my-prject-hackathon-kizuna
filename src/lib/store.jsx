// Mieru — état partagé de l'application : session, compteur, relevés, état calculé.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as db from './db.js';
import { calculerEtat } from './calcul.js';
import tarifs from './tarifs.json';

const Ctx = createContext(null);

export function CompteurProvider({ children }) {
  const [sess, setSess] = useState(db.session());
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [toast, setToast] = useState(null);

  const recharger = useCallback(async () => {
    if (!sess?.compteurId) { setDonnees(null); return; }
    try { setDonnees(await db.chargerCompteur(sess.compteurId)); setErreur(null); }
    catch (e) { setErreur(e.message || String(e)); }
  }, [sess?.compteurId]);

  useEffect(() => { recharger(); }, [recharger]);
  useEffect(() => (sess?.compteurId ? db.ecouter(sess.compteurId, recharger) : undefined), [sess?.compteurId, recharger]);

  const etat = useMemo(() => (donnees ? calculerEtat(donnees.compteur, donnees.releves, tarifs) : null), [donnees]);

  const valeur = {
    session: sess,
    ...(donnees || {}),
    etat,
    tarifs,
    erreur,
    modeCloud: db.modeCloud,
    recharger,
    moi: donnees?.membres?.find((m) => m.id === sess?.membreId) || null,
    connecter: () => setSess(db.session()),
    quitter: () => { db.quitter(); setSess(null); setDonnees(null); },
    signaler: (texte) => { setToast(texte); setTimeout(() => setToast(null), 3500); },
    toast,
  };
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export const useCompteur = () => useContext(Ctx);
