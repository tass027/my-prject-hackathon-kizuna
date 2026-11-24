// Accueil : alertes de surconsommation et annonces de limitation / coupure envoyées par la STEG à ce foyer.
import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n/index.jsx';
import { useCompteur } from '../lib/store.jsx';
import { lireAvisSteg, marquerAvisLu } from '../lib/db.js';
import { parler, VOIX } from '../lib/voix.js';

const TON = { alerte: 'tone-warn', limite: 'tone-warn', coupe: 'tone-over', retabli: 'tone-ok' };

export default function AvisSteg({ className = '' }) {
  const { t, lang, locale } = useT();
  const { compteur } = useCompteur();
  const [avis, setAvis] = useState([]);
  const [now, setNow] = useState(() => new Date());

  const charger = useCallback(() => { lireAvisSteg(compteur.id).then(setAvis).catch(() => setAvis([])); }, [compteur.id]);
  useEffect(() => {
    charger();
    const id = setInterval(() => { setNow(new Date()); charger(); }, 10000);
    window.addEventListener('mieru:maj', charger);
    window.addEventListener('storage', charger); // la STEG agit depuis un autre onglet
    return () => { clearInterval(id); window.removeEventListener('mieru:maj', charger); window.removeEventListener('storage', charger); };
  }, [charger]);

  // Avis encore utiles : non lus, ou action pas encore terminée. Un « rétabli » remplace tout ce qui précède.
  const actifs = [];
  for (const a of avis) {
    if (a.type === 'retabli') { if (!a.luLe) actifs.push(a); break; }
    const termine = a.fin && new Date(a.fin) < now;
    if (!termine && (!a.luLe || a.type !== 'alerte')) actifs.push(a);
  }
  if (!actifs.length) return null;
  const a = actifs[0];
  const h = (d) => new Date(d).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const enCours = a.debut && new Date(a.debut) <= now;
  const cle = a.type === 'alerte' ? 'notice.alert' : a.type === 'retabli' ? 'notice.restored' : `notice.${a.type}${enCours ? 'Now' : 'Soon'}`;
  const texte = t(`${cle}Text`, { debut: a.debut && h(a.debut), fin: a.fin && h(a.fin), kva: 2 });

  return (
    <section className={`alert ${TON[a.type]} ${className}`} role="alert" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <b className="tone-title">STEG · {t(cle)}</b>
      <p className="small">{texte}</p>
      {a.type === 'alerte' && <p className="small muted">{t('notice.alertTips')}</p>}
      {(a.type === 'limite' || a.type === 'coupe') && <p className="small muted">{t('notice.whyYou')}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button className="chip" onClick={() => parler(`${t(cle)}. ${texte}`, VOIX[lang])}>{t('home.listen')}</button>
        {(a.type === 'alerte' || a.type === 'retabli') && <button className="chip" onClick={() => marquerAvisLu(compteur.id, a.id).then(charger)}>{t('notice.ok')}</button>}
      </div>
    </section>
  );
}
