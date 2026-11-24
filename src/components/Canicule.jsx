// Météo des 3 prochains jours et alerte canicule (Open-Meteo). En mode démo, un exemple de canicule est affiché comme tel.
import { useEffect, useState } from 'react';
import { useT } from '../i18n/index.jsx';
import { useCompteur } from '../lib/store.jsx';
import { VILLES, villeChoisie, choisirVille, previsions, previsionsDemo, impactChaleur, nomVille } from '../lib/meteo.js';
import { Aaddad } from './Chrome.jsx';

const TEINTE = { normal: ['var(--washi)', 'var(--sumi)'], chaleur: ['var(--kincha-soft)', 'var(--kincha)'], canicule: ['var(--shu-soft)', 'var(--shu)'] };

function Soleil({ niveau }) {
  const c = niveau === 'normal' ? 'var(--or)' : niveau === 'chaleur' ? 'var(--kincha)' : 'var(--vermillon)';
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="6" fill={c} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M14 2.5V6.5" stroke={c} strokeWidth="2" strokeLinecap="round" transform={`rotate(${a} 14 14)`} />)}
    </svg>
  );
}

export function SelecteurVille({ ville, onChange }) {
  const { t, lang } = useT();
  return (
    <label className="row small" style={{ gap: 6 }}>
      <span className="muted">{t('heat.city')}</span>
      <select value={ville.id} onChange={(e) => { choisirVille(e.target.value); onChange(VILLES.find((v) => v.id === e.target.value)); }}
        style={{ height: 36, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--washi-raised)', padding: '0 8px' }}>
        {VILLES.map((v) => <option key={v.id} value={v.id}>{nomVille(v, lang)}</option>)}
      </select>
    </label>
  );
}

export default function Canicule({ className = '' }) {
  const { t, date, lang } = useT();
  const { session, etat } = useCompteur();
  const [ville, setVille] = useState(villeChoisie());
  const [jours, setJours] = useState(null);
  const [statut, setStatut] = useState('chargement'); // chargement | ok | demo | erreur

  useEffect(() => {
    let vivant = true;
    setStatut('chargement');
    if (session?.demo) { setJours(previsionsDemo()); setStatut('demo'); return undefined; }
    previsions(ville)
      .then((j) => { if (vivant) { setJours(j); setStatut('ok'); } })
      .catch(() => { if (vivant) setStatut('erreur'); });
    return () => { vivant = false; };
  }, [ville, session?.demo]);

  const impact = jours ? impactChaleur(jours, etat) : null;
  const nomJour = (iso, i) => (i === 0 ? t('heat.today') : i === 1 ? t('heat.tomorrow') : date(`${iso}T12:00:00`, { weekday: 'long' }));

  return (
    <section className={`card ${className}`} aria-label={t('heat.title', { city: nomVille(ville, lang) })} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="heading" style={{ fontSize: 16 }}>{t('heat.title', { city: nomVille(ville, lang) })}</h2>
        {!session?.demo && <SelecteurVille ville={ville} onChange={setVille} />}
      </div>

      {statut === 'chargement' && <p className="small muted">{t('heat.loading')}</p>}
      {statut === 'erreur' && <p className="small muted">{t('heat.unavailable')}</p>}

      {jours && statut !== 'erreur' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {jours.map((j, i) => {
            const [fond, encre] = TEINTE[j.niveau];
            return (
              <div key={j.date} style={{ background: fond, borderRadius: 12, padding: '10px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span className="small" style={{ fontWeight: 600, textTransform: 'capitalize' }}>{nomJour(j.date, i)}</span>
                <Soleil niveau={j.niveau} />
                <span style={{ font: '800 22px/26px var(--font-display)', color: encre }}>{j.tmax}°</span>
                <span className="small muted">{t('heat.min')} {j.tmin}°</span>
              </div>
            );
          })}
        </div>
      )}

      {impact && statut !== 'erreur' && (impact.pire === 'normal'
        ? <p className="small muted">{t('heat.none')}</p>
        : (
          <div className={`alert ${impact.pire === 'canicule' ? 'tone-over' : 'tone-warn'}`} role="status">
            <Aaddad humeur="inquiet" taille={46} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <b className="tone-title">{t(impact.pire === 'canicule' ? 'heat.canicule' : 'heat.chaleur')}</b>
              <span className="small">{t('heat.text', { n: impact.joursChauds, t: impact.tmax, kwh: impact.kwhEnPlus })}{impact.passeLeSeuil ? ` ${t('heat.passe')}` : ''}</span>
              <span className="small muted">{t('heat.tips')}</span>
            </div>
          </div>
        ))}
      {statut === 'demo' && <p className="caption" style={{ textTransform: 'none', letterSpacing: 0 }}>{t('heat.demo')}</p>}
    </section>
  );
}
