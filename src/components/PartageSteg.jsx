// Kizuna → « Ce que la STEG voit » : transparence sur le partage obligatoire, déclaration d'un besoin vital, accès au tableau de bord.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/index.jsx';
import { useCompteur } from '../lib/store.jsx';
import { lirePartage, ecrirePartage } from '../lib/db.js';
import { villeChoisie } from '../lib/meteo.js';
import { ListeDonneesSteg } from './ConditionsSteg.jsx';

export default function PartageSteg() {
  const { t, date } = useT();
  const { compteur, signaler } = useCompteur();
  const [p, setP] = useState(null);

  useEffect(() => { lirePartage(compteur.id).then(setP).catch((e) => signaler(e.message || t('common.error'))); }, [compteur.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return null;

  async function basculerPrioritaire(v) {
    const n = { ...p, niveau: 'nomme', ville: villeChoisie().id, nomFoyer: compteur.nom, prioritaire: v };
    try { await ecrirePartage(compteur.id, n); setP(n); signaler(t(v ? 'share.prioOn' : 'share.prioOff')); }
    catch (e) { signaler(e.message || t('common.error')); }
  }

  return (
    <section className="card" aria-labelledby="partage-steg" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 id="partage-steg" className="heading">{t('share.title2')}</h2>
      <p className="small muted">{t('share.intro2')}</p>
      <ListeDonneesSteg />
      <label className="radio-row" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" checked={Boolean(p.prioritaire)} onChange={(e) => basculerPrioritaire(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
        <span><b>{t('cgu.priority')}</b><span className="small muted" style={{ display: 'block' }}>{t('cgu.prioritySub')}</span></span>
      </label>
      {p.consentiLe && <p className="small muted">{t('share.accepted', { d: date(p.consentiLe, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>}
      <Link to="/steg" className="small" style={{ textAlign: 'center' }}>{t('share.seeDashboard')}</Link>
    </section>
  );
}
