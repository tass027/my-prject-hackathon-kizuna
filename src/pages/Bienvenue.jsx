// Écran 1 — Bienvenue : créer un compteur, rejoindre un compteur Kizuna, ou lancer la démo.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompteur } from '../lib/store.jsx';
import { useT, ChoixLangue } from '../i18n/index.jsx';
import { VILLES, villeChoisie, choisirVille, nomVille } from '../lib/meteo.js';
import * as db from '../lib/db.js';

export default function Bienvenue() {
  const { connecter, signaler, modeCloud } = useCompteur();
  const { t, lang } = useT();
  const [mode, setMode] = useState(null); // null | 'creer' | 'rejoindre'
  const [f, setF] = useState({ prenom: '', nom: t('create.meterNameDefault'), index: '', code: '', distance: false, ville: villeChoisie().id });
  const [occupe, setOccupe] = useState(false);
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function lancer(action) {
    setOccupe(true);
    try { await action(); connecter(); }
    catch (e) { signaler(e.message || t('common.error')); }
    finally { setOccupe(false); }
  }

  return (
    <div className="app no-nav bienvenue">
      <img className="bienvenue-art" src="/assets/pont-kizuna.svg" alt={t('welcome.art')} style={{ display: 'block', width: '100%' }} />
      <div className="screen" style={{ paddingTop: 18, paddingBottom: 28, gap: 14 }}>
        <div className="row">
          <img src="/assets/mieru-mark.svg" alt="" width="26" height="26" />
          <strong style={{ font: '800 18px/22px var(--font-display)' }}>Mieru</strong>
          <span className="small muted">見える · عدّاد</span>
        </div>

        {!mode && <>
          <h1 className="display" style={{ fontSize: 29, lineHeight: '40px' }}>{t('welcome.title1')}<br />{t('welcome.title2')}</h1>
          <p className="muted">{t('welcome.body')}</p>
          <ChoixLangue />
          <button className="btn btn-primary" onClick={() => setMode('creer')}>{t('welcome.create')}</button>
          <button className="btn" onClick={() => setMode('rejoindre')}>
            <span style={{ width: 18, height: 3, borderRadius: 2, background: 'var(--vermillon)' }} />{t('welcome.join')}
          </button>
          <button className="btn btn-quiet" disabled={occupe} onClick={() => lancer(() => db.creerDemo(new Date(), { nom: t('demo.nom'), message: t('demo.msg') }))}>{t('welcome.demo')}</button>
          <p className="small muted" style={{ textAlign: 'center' }}>{t('welcome.stegNote')}</p>
          <Link to="/steg" className="small" style={{ textAlign: 'center', marginTop: 4 }}>{t('welcome.steg')}</Link>
        </>}

        {mode === 'creer' && <form className="screen" style={{ padding: 0 }} onSubmit={(e) => { e.preventDefault(); choisirVille(f.ville); lancer(() => db.creerCompteur({ nom: f.nom, prenom: f.prenom, indexDepart: Number(f.index) })); }}>
          <h1 className="title">{t('create.title')}</h1>
          <label className="field"><span className="caption">{t('create.firstName')}</span><input className="input" required value={f.prenom} onChange={maj('prenom')} autoComplete="given-name" /></label>
          <label className="field"><span className="caption">{t('create.meterName')}</span><input className="input" required value={f.nom} onChange={maj('nom')} placeholder={t('create.meterNamePh')} /></label>
          <label className="field"><span className="caption">{t('create.index')}</span><input className="input index" dir="ltr" required inputMode="numeric" pattern="[0-9]*" value={f.index} onChange={maj('index')} placeholder="04821" /></label>
          <label className="field"><span className="caption">{t('create.city')}</span>
            <select className="input" value={f.ville} onChange={maj('ville')}>{VILLES.map((v) => <option key={v.id} value={v.id}>{nomVille(v, lang)}</option>)}</select>
          </label>
          <p className="small muted">{t('create.hint')}</p>
          <button className="btn btn-primary" disabled={occupe}>{t('create.go')}</button>
          <button type="button" className="btn btn-quiet" onClick={() => setMode(null)}>{t('common.back')}</button>
        </form>}

        {mode === 'rejoindre' && <form className="screen" style={{ padding: 0 }} onSubmit={(e) => { e.preventDefault(); lancer(() => db.rejoindreCompteur(f.code, f.prenom, f.distance ? 'suivi_distance' : 'membre')); }}>
          <h1 className="title">{t('join.title')}</h1>
          {!modeCloud && <p className="small alert tone-warn">{t('join.localWarn')}</p>}
          <label className="field"><span className="caption">{t('join.code')}</span><input className="input index" dir="ltr" required value={f.code} onChange={maj('code')} maxLength={6} style={{ textTransform: 'uppercase' }} placeholder="K7Q2MX" /></label>
          <label className="field"><span className="caption">{t('create.firstName')}</span><input className="input" required value={f.prenom} onChange={maj('prenom')} /></label>
          <label className="radio-row"><input type="checkbox" checked={f.distance} onChange={maj('distance')} />{t('join.remote')}</label>
          <button className="btn btn-primary" disabled={occupe}>{t('join.go')}</button>
          <button type="button" className="btn btn-quiet" onClick={() => setMode(null)}>{t('common.back')}</button>
        </form>}
      </div>
    </div>
  );
}
