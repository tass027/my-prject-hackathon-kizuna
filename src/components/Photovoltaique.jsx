// Accueil → « Mon solaire » : ce que produisent les panneaux, ce que consomme la maison, et ce que ça rapporte (au foyer et à la STEG).
// Production : PVGIS si le réseau répond, sinon rendement moyen tunisien. Injection : mesurée (compteur bidirectionnel) ou estimée.
import { useEffect, useState } from 'react';
import { useCompteur } from '../lib/store.jsx';
import { useT } from '../i18n/index.jsx';
import { ecrirePhotovoltaique, lirePhotovoltaique, modeCloud, publierAgregatPhotovoltaique } from '../lib/db.js';
import { villeChoisie } from '../lib/meteo.js';
import { estimerProductionPV, productionPVDepuisRendement } from '../lib/pv.js';
import { RENDEMENT_TN, AUTOCONSO_DEFAUT, COUT_REVIENT, gainsSolaire } from '../lib/reseau.js';

const cleMois = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const lireNombre = (v) => Number(String(v).replace(',', '.'));
const SOLEIL = '#e0a100';

function Barre({ parts }) {
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  return (
    <div className="pv-barre" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round(p.v)} kWh`).join(', ')}>
      {parts.map((p) => p.v > 0 && <span key={p.label} style={{ flexGrow: p.v / total, background: p.c, color: p.texte || '#fff' }}>{Math.round(p.v)}</span>)}
    </div>
  );
}

export default function Photovoltaique({ importReseauKwh, className = '' }) {
  const { compteur, tarifs } = useCompteur();
  const { t, nombre, locale } = useT();
  const aujourdHui = new Date();
  const mois = cleMois(aujourdHui);
  const ville = villeChoisie();
  const [installation, setInstallation] = useState(undefined);
  const [puissance, setPuissance] = useState('');
  const [injection, setInjection] = useState('');
  const [production, setProduction] = useState(null);
  const [source, setSource] = useState('moyenne');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    lirePhotovoltaique(compteur.id).then((v) => {
      setInstallation(v);
      setPuissance(v?.puissanceKwc ? String(v.puissanceKwc) : '');
      setInjection(v?.exportations?.[mois] ?? '');
    }).catch(() => setInstallation(null));
  }, [compteur.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!installation?.puissanceKwc) return undefined;
    let actif = true;
    const secours = productionPVDepuisRendement(RENDEMENT_TN[aujourdHui.getMonth()], installation.puissanceKwc, aujourdHui);
    setProduction(secours); setSource('moyenne');
    estimerProductionPV(installation.puissanceKwc, ville, aujourdHui)
      .then((kwh) => { if (actif) { setProduction(kwh); setSource('pvgis'); } })
      .catch(() => { /* hors connexion : on garde le rendement moyen tunisien */ });
    return () => { actif = false; };
  }, [installation?.puissanceKwc, ville.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enregistrer(e) {
    e.preventDefault();
    const kwc = lireNombre(puissance);
    const inj = injection === '' ? null : lireNombre(injection);
    if (!Number.isFinite(kwc) || kwc <= 0) { setErreur(t('pv.invalidPower')); return; }
    if (inj !== null && (!Number.isFinite(inj) || inj < 0)) { setErreur(t('pv.invalidExport')); return; }
    const nouvelle = { puissanceKwc: kwc, partagerAgrege: true, exportations: { ...(installation?.exportations || {}), [mois]: inj } };
    try {
      await ecrirePhotovoltaique(compteur.id, nouvelle);
      setInstallation(nouvelle); setErreur('');
      if (modeCloud) {
        const prod = productionPVDepuisRendement(RENDEMENT_TN[aujourdHui.getMonth()], kwc, aujourdHui);
        await publierAgregatPhotovoltaique(compteur.id, { mois: `${mois}-01`, ville: ville.id, productionKwh: prod, exportKwh: inj, partager: true }).catch(() => {});
      }
    } catch (e2) { setErreur(t('pv.saveError', { error: e2.message || e2 })); }
  }

  if (installation === undefined) return null;

  const formulaire = (
    <form onSubmit={enregistrer} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="grid2">
        <label className="field"><span className="caption" style={{ minHeight: 48 }}>{t('pv.capacity')}</span>
          <input className="input" inputMode="decimal" value={puissance} onChange={(e) => setPuissance(e.target.value)} placeholder={t('pv.capacityPlaceholder')} required /></label>
        <label className="field"><span className="caption" style={{ minHeight: 48 }}>{t('solar.injInput')}</span>
          <input className="input" inputMode="decimal" value={injection} onChange={(e) => setInjection(e.target.value)} placeholder={t('pv.exportPlaceholder')} /></label>
      </div>
      <p className="small muted">{t('solar.injHelp')}</p>
      {erreur && <p className="alert tone-warn small" role="alert">{erreur}</p>}
      <button className="btn btn-primary" type="submit">{t(installation ? 'pv.save' : 'pv.add')}</button>
    </form>
  );

  if (!installation?.puissanceKwc) {
    return (
      <section className={`card ${className}`} aria-labelledby="pv-title" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="pv-title" className="heading">☀ {t('solar.title')}</h2>
        <p className="small muted">{t('solar.noPanels')}</p>
        <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>{t('solar.addPanels')}</summary><div style={{ marginTop: 10 }}>{formulaire}</div></details>
      </section>
    );
  }

  // Bilan depuis le 1er du mois.
  const P = production ?? 0;
  const injMesuree = installation.exportations?.[mois];
  const J = Math.min(P, injMesuree ?? P * (1 - AUTOCONSO_DEFAUT));
  const A = Math.max(0, P - J);           // produit et consommé sur place
  const C = importReseauKwh + A;          // consommation réelle de la maison
  const g = gainsSolaire(C, P, tarifs);
  const debut = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), 1).toLocaleDateString(locale, { day: 'numeric', month: 'long' });

  return (
    <section className={`card ${className}`} aria-labelledby="pv-title" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h2 id="pv-title" className="heading">☀ {t('solar.title')}</h2>
        <p className="small muted">{t('solar.sub', { kwc: nombre(installation.puissanceKwc, 1), ville: ville.nom, debut })}</p>
      </div>

      <div className="grid2">
        <div className="pv-chiffre" style={{ borderColor: SOLEIL }}><span className="caption">{t('solar.produced')}</span><b style={{ color: '#9a6a00' }}>{nombre(P, 0)} kWh</b></div>
        <div className="pv-chiffre"><span className="caption">{t('solar.consumed')}</span><b>{nombre(C, 0)} kWh</b></div>
      </div>

      <div className="pv-bloc">
        <span className="small"><b>{t('solar.houseUses')}</b></span>
        <Barre parts={[{ label: t('solar.fromSun'), v: A, c: SOLEIL, texte: '#3a2a00' }, { label: t('solar.fromGrid'), v: importReseauKwh, c: 'var(--ai)' }]} />
        <div className="pv-legende small"><span><i style={{ background: SOLEIL }} />{t('solar.fromSun')} {nombre(A, 0)}</span><span><i style={{ background: 'var(--ai)' }} />{t('solar.fromGrid')} {nombre(importReseauKwh, 0)}</span></div>
      </div>
      <div className="pv-bloc">
        <span className="small"><b>{t('solar.panelsGive')}</b></span>
        <Barre parts={[{ label: t('solar.usedHere'), v: A, c: SOLEIL, texte: '#3a2a00' }, { label: t('solar.sentGrid'), v: J, c: 'var(--matcha)' }]} />
        <div className="pv-legende small"><span><i style={{ background: SOLEIL }} />{t('solar.usedHere')} {nombre(A, 0)}</span><span><i style={{ background: 'var(--matcha)' }} />{t('solar.sentGrid')} {nombre(J, 0)}{injMesuree == null ? '*' : ''}</span></div>
      </div>

      <div className="grid2">
        <div className="alert tone-ok" style={{ flexDirection: 'column', gap: 2 }}><span className="caption">{t('solar.youSave')}</span><b style={{ font: '800 22px/28px var(--font-display)' }}>{nombre(g.gainFoyer, 1)} {t('sim.currency')}</b><span className="small">{t('solar.youSaveSub', { avec: nombre(g.factureAvec, 1), sans: nombre(g.factureSans, 1) })}</span></div>
        <div className="alert tone-info" style={{ flexDirection: 'column', gap: 2 }}><span className="caption">{t('solar.stegSaves')}</span><b style={{ font: '800 22px/28px var(--font-display)' }}>{nombre(g.gainSteg, 1)} {t('sim.currency')}</b><span className="small">{t('solar.stegSavesSub', { cout: nombre(COUT_REVIENT, 3) })}</span></div>
      </div>
      {g.sousSeuilGraceAuSolaire && <p className="alert tone-ok small">{t('solar.underThanks')}</p>}

      <p className="small muted">{t(source === 'pvgis' ? 'solar.srcPvgis' : 'solar.srcAvg')}{injMesuree == null ? ` ${t('solar.injEstimated', { pct: Math.round(AUTOCONSO_DEFAUT * 100) })}` : ''}</p>
      <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>{t('solar.edit')}</summary><div style={{ marginTop: 10 }}>{formulaire}</div></details>
    </section>
  );
}
