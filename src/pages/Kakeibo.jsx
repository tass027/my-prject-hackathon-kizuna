// Écran 5 — Kakeibo (家計簿) : objectif du mois, ce qui a compté, une seule amélioration (F7).
// Les événements et améliorations sont enregistrés par identifiant, et affichés dans la langue choisie.
import { useEffect, useState } from 'react';
import { useCompteur } from '../lib/store.jsx';
import { useT } from '../i18n/index.jsx';
import { TopBar, Aaddad } from '../components/Chrome.jsx';
import { lireKakeibo, ecrireKakeibo } from '../lib/db.js';

const EVENEMENTS = ['chaleur', 'invites', 'malade', 'absence', 'appareil'];
const AMELIORATIONS = ['chauffe-eau', 'machine', 'clim', 'releve'];
const ACTIONS_PAR_EVENEMENT = {
  chaleur: ['clim'],
  invites: ['chauffe-eau', 'machine'],
  malade: ['clim'],
  absence: ['chauffe-eau'],
  appareil: [],
};

const cleMois = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

export default function Kakeibo() {
  const { compteur, etat, signaler } = useCompteur();
  const { t, nombre, mois: nomMois } = useT();
  const mois = cleMois();
  const precedent = cleMois(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const [k, setK] = useState(null);
  const [rappel, setRappel] = useState(null);
  const [objectifChoisi, setObjectifChoisi] = useState(null);
  const [objectifPersonnalise, setObjectifPersonnalise] = useState('');

  useEffect(() => {
    lireKakeibo(compteur.id, mois).then((v) => {
      const donnees = v || { objectifKwh: compteur.seuil, evenements: [], amelioration: null };
      setK(donnees);
      setObjectifChoisi(null);
    });
    lireKakeibo(compteur.id, precedent).then((v) => setRappel(v?.amelioration || null));
  }, [compteur.id, mois, precedent, compteur.seuil]);

  if (!k) return null;
  const sauver = async (nv, message) => { setK(nv); await ecrireKakeibo(compteur.id, mois, nv); if (message) signaler(message); };
  const evenements = Array.isArray(k.evenements) ? k.evenements : [];
  const basculer = (ev) => sauver({ ...k, evenements: evenements.includes(ev) ? evenements.filter((x) => x !== ev) : [...evenements, ev] });
  const objectifs = Array.isArray(k.bilan?.objectifs) ? k.bilan.objectifs : (k.amelioration ? [k.amelioration] : []);
  const objectifsPersonnalises = Array.isArray(k.bilan?.objectifsPersonnalises) ? k.bilan.objectifsPersonnalises : [];
  const liensObjectifs = k.bilan?.liensObjectifs && typeof k.bilan.liensObjectifs === 'object' && !Array.isArray(k.bilan.liensObjectifs)
    ? k.bilan.liensObjectifs
    : {};
  const actionsRecommandees = [...new Set(evenements.flatMap((ev) => ACTIONS_PAR_EVENEMENT[ev] || []))];
  const autresActions = AMELIORATIONS.filter((action) => !actionsRecommandees.includes(action));
  const ajouterObjectif = () => {
    if (!objectifChoisi || objectifs.includes(objectifChoisi)) return;
    sauver({
      ...k,
      amelioration: objectifChoisi,
      bilan: {
        ...(k.bilan || {}),
        objectifs: [...objectifs, objectifChoisi],
        liensObjectifs: { ...liensObjectifs, [`action:${objectifChoisi}`]: [...evenements] },
      },
    }, t('kak.saved'));
    setObjectifChoisi(null);
  };
  const ajouterObjectifPersonnalise = () => {
    const texte = objectifPersonnalise.trim();
    const cleTexte = texte.toLocaleLowerCase();
    const dejaEnregistre = objectifsPersonnalises.some((objectif) => objectif.toLocaleLowerCase() === cleTexte)
      || objectifs.some((objectif) => t(`am.${objectif}`).toLocaleLowerCase() === cleTexte);
    if (!texte || dejaEnregistre) return;
    sauver({
      ...k,
      bilan: {
        ...(k.bilan || {}),
        objectifs,
        objectifsPersonnalises: [...objectifsPersonnalises, texte],
        liensObjectifs: { ...liensObjectifs, [`personnalise:${texte}`]: [...evenements] },
      },
    }, t('kak.customSaved'));
    setObjectifPersonnalise('');
  };
  const choisirAction = (action) => (
    <button key={action} type="button" aria-pressed={objectifChoisi === action}
      className={`radio-row${objectifChoisi === action ? ' on' : ''}`}
      style={{ minHeight: 56, textAlign: 'start' }}
      onClick={() => setObjectifChoisi(objectifChoisi === action ? null : action)}>
      {t(`am.${action}`)}
    </button>
  );
  const atteint = etat.projection <= k.objectifKwh;
  const reductionDemandee = Math.max(0, etat.projection - k.objectifKwh);
  const personnaliseExiste = objectifPersonnalise.trim().length > 0 && (
    objectifsPersonnalises.some((objectif) => objectif.toLocaleLowerCase() === objectifPersonnalise.trim().toLocaleLowerCase())
    || objectifs.some((objectif) => t(`am.${objectif}`).toLocaleLowerCase() === objectifPersonnalise.trim().toLocaleLowerCase())
  );

  return (
    <>
      <TopBar titre={t('kak.title', { month: nomMois() })} droite={<span className="small muted">家計簿 · Kakeibo</span>} />
      <main className="screen">
        <section className={`card ${atteint ? 'tone-fete' : 'tone-warn'}`} style={{ display: 'flex', flexDirection: 'column', gap: 14, border: 0 }}>
          <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
            <Aaddad humeur={atteint ? 'joie' : 'calme'} taille={64} alt={atteint ? t('kak.happy') : ''} />
            <div>
              <h1 className="title" style={{ fontSize: 21, color: atteint ? 'var(--matcha)' : 'var(--kincha)' }}>{t(atteint ? 'kak.onTrack' : 'kak.threat')}</h1>
              <p className="small">{t('kak.proj', { p: nombre(etat.projection, 0), o: k.objectifKwh })}{etat.surcoutProjete > 0 ? t('kak.cost', { d: nombre(etat.surcoutProjete, 0) }) : ''}</p>
            </div>
          </div>
          <section className="grid2">
            <div className="card" style={{ padding: 12 }}>
              <div className="caption">{t('kak.q1')}</div>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" dir="ltr" style={{ height: 40, width: 80, padding: '0 8px', font: '700 18px var(--font-display)' }} inputMode="numeric" value={k.objectifKwh}
                  onChange={(ev) => setK({ ...k, objectifKwh: Number(ev.target.value.replace(/\D/g, '')) || 0 })} onBlur={() => sauver(k)} aria-label={t('kak.goalAria')} />
                <span style={{ font: '700 18px var(--font-display)' }}>kWh</span>
              </div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="caption">{t('kak.q2')}</div>
              <div style={{ font: '700 18px/40px var(--font-display)' }}>{nombre(etat.consoPeriode, 0)} kWh</div>
            </div>
          </section>
        </section>

        {rappel && <p className="alert tone-info small"><span><b style={{ color: 'var(--ai)' }}>{t('kak.last')}</b> · {t(`am.${rappel}`)}</span></p>}

        <section className="card" style={{ padding: 12 }}>
          <h2 className="heading">{t('kak.q3')}</h2>
          <p className="small muted" style={{ marginTop: 6 }}>{t('kak.eventsHelp')}</p>
          <div className="row" style={{ marginTop: 8 }}>
            {EVENEMENTS.map((ev) => <button key={ev} className="chip" aria-pressed={evenements.includes(ev)} onClick={() => basculer(ev)}>{t(`ev.${ev}`)}</button>)}
          </div>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="heading">{t('kak.q4')}</h2>
          <p className="small">{t(atteint ? 'kak.goalReached' : 'kak.goalGap', { k: nombre(reductionDemandee, 0) })}</p>
          <p className="small muted">{t('kak.planIntro')}</p>
          {actionsRecommandees.length > 0 && (
            <p className="small tone-title"><b>{t('kak.recommendedFor', {
              events: evenements.filter((ev) => ACTIONS_PAR_EVENEMENT[ev]?.length).map((ev) => t(`ev.${ev}`)).join(', '),
            })}</b></p>
          )}
          {evenements.includes('appareil') && <p className="small muted">{t('kak.newApplianceHint')}</p>}
          <p className="small">{t('kak.actionChoose')}</p>
          {actionsRecommandees.length > 0 ? (
            <>
              <h3 className="heading">{t('kak.recommendedActions')}</h3>
              <div className="grid2" role="group" aria-label={t('kak.recommendedActions')}>
                {actionsRecommandees.map(choisirAction)}
              </div>
              {autresActions.length > 0 && <>
                <h3 className="heading">{t('kak.otherActions')}</h3>
                <div className="grid2" role="group" aria-label={t('kak.otherActions')}>
                  {autresActions.map(choisirAction)}
                </div>
              </>}
            </>
          ) : (
            <div className="grid2" role="group" aria-label={t('kak.actionChoose')}>
              {AMELIORATIONS.map(choisirAction)}
            </div>
          )}
          <button className="btn btn-primary" onClick={ajouterObjectif} disabled={!objectifChoisi || objectifs.includes(objectifChoisi)}>
            {t('kak.addObjective')}
          </button>
          <h3 className="heading">{t('kak.customTitle')}</h3>
          <label className="field">
            <span>{t('kak.customLabel')}</span>
            <input className="input" value={objectifPersonnalise} maxLength={120}
              placeholder={t('kak.customPlaceholder')} onChange={(ev) => setObjectifPersonnalise(ev.target.value)} />
          </label>
          <button className="btn btn-primary" onClick={ajouterObjectifPersonnalise}
            disabled={!objectifPersonnalise.trim() || personnaliseExiste}>
            {t('kak.customAdd')}
          </button>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <h3 className="heading">{t('kak.objectivesList')}</h3>
            {objectifs.length + objectifsPersonnalises.length === 0 ? (
              <p className="small muted" style={{ marginTop: 8 }}>{t('kak.noObjectives')}</p>
            ) : (
              <ul style={{ margin: '8px 0 0', paddingInlineStart: 20 }}>
                {objectifs.map((objectif) => {
                  const evenementsLies = liensObjectifs[`action:${objectif}`];
                  return <li key={objectif}>
                    {t(`am.${objectif}`)}
                    {Array.isArray(evenementsLies) && evenementsLies.length > 0 && (
                      <span className="small muted"> · {t('kak.linkedEvents', { events: evenementsLies.map((ev) => t(`ev.${ev}`)).join(', ') })}</span>
                    )}
                  </li>;
                })}
                {objectifsPersonnalises.map((objectif) => {
                  const evenementsLies = liensObjectifs[`personnalise:${objectif}`];
                  return <li key={`custom-${objectif}`}>
                    {objectif}
                    {Array.isArray(evenementsLies) && evenementsLies.length > 0 && (
                      <span className="small muted"> · {t('kak.linkedEvents', { events: evenementsLies.map((ev) => t(`ev.${ev}`)).join(', ') })}</span>
                    )}
                  </li>;
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
