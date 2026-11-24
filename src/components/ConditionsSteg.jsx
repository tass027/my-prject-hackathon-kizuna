// Conditions d'utilisation : transmettre ses relevés à la STEG est obligatoire pour utiliser Mieru.
// L'écran s'affiche une fois par compteur (création, invitation Kizuna, démo, ou compte existant).
import { useEffect, useState } from 'react';
import { useT } from '../i18n/index.jsx';
import { useCompteur } from '../lib/store.jsx';
import { lirePartage, ecrirePartage } from '../lib/db.js';
import { villeChoisie } from '../lib/meteo.js';
import { LIMITE_KVA, DUREE_MAX_MIN, PREAVIS_MIN } from '../lib/reseau.js';

export function ListeDonneesSteg() {
  const { t } = useT();
  return (
    <div className="small" style={{ display: 'grid', gap: 6 }}>
      <p><b>{t('cgu.sees')}</b> {t('cgu.seesList')}</p>
      <p><b>{t('cgu.notSees')}</b> {t('cgu.notSeesList')}</p>
      <p><b>{t('cgu.uses')}</b> {t('cgu.usesList', { kva: LIMITE_KVA, min: DUREE_MAX_MIN, pre: PREAVIS_MIN })}</p>
    </div>
  );
}

export default function ConditionsSteg({ children }) {
  const { t } = useT();
  const { compteur, quitter, signaler } = useCompteur();
  const [etat, setEtat] = useState('chargement'); // 'chargement' | 'a-accepter' | 'ok'
  const [lu, setLu] = useState(false);
  const [prioritaire, setPrioritaire] = useState(false);

  useEffect(() => {
    let actif = true;
    lirePartage(compteur.id)
      .then((p) => { if (actif) setEtat(p.niveau === 'nomme' && p.consentiLe ? 'ok' : 'a-accepter'); })
      .catch(() => { if (actif) setEtat('a-accepter'); });
    return () => { actif = false; };
  }, [compteur.id]);

  async function accepter() {
    try {
      await ecrirePartage(compteur.id, { niveau: 'nomme', ville: villeChoisie().id, nomFoyer: compteur.nom, prioritaire });
      setEtat('ok');
    } catch (e) { signaler(e.message || t('common.error')); }
  }

  if (etat === 'ok') return children;
  if (etat === 'chargement') return <p className="screen muted" style={{ paddingTop: 48 }}>{t('common.loading')}</p>;
  return (
    <div className="app no-nav">
      <div className="screen" style={{ paddingTop: 32, gap: 14, maxWidth: 640, marginInline: 'auto' }}>
        <img src="/assets/mieru-mark.svg" alt="" width="48" height="48" />
        <h1 className="title">{t('cgu.title')}</h1>
        <p>{t('cgu.intro')}</p>
        <div className="card"><ListeDonneesSteg /></div>
        <label className="radio-row" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={prioritaire} onChange={(e) => setPrioritaire(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
          <span><b>{t('cgu.priority')}</b><span className="small muted" style={{ display: 'block' }}>{t('cgu.prioritySub')}</span></span>
        </label>
        <label className="radio-row" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={lu} onChange={(e) => setLu(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
          <span>{t('cgu.accept')}</span>
        </label>
        <button className="btn btn-primary" disabled={!lu} onClick={accepter}>{t('cgu.continue')}</button>
        <button className="btn btn-quiet" onClick={quitter}>{t('cgu.refuse')}</button>
        <p className="small muted">{t('cgu.legal')}</p>
      </div>
    </div>
  );
}
