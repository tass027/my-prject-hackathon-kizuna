// Espace STEG — tableau de bord du réseau : carte des secteurs et des maisons, délestage ciblé, alertes, solaire, statistiques.
// Tous les foyers Mieru transmettent leurs relevés (condition d'utilisation) ; les maisons simulées sont signalées comme telles.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/index.jsx';
import { useCompteur } from '../lib/store.jsx';
import { LangueCompacte } from '../components/Chrome.jsx';
import CarteSteg, { couleurCharge } from '../components/CarteSteg.jsx';
import { BarresZones, Tranches, Evolution, Chaleur } from '../components/StegCharts.jsx';
import { listerPartages, envoyerAvisSteg } from '../lib/db.js';
import { calculerEtat } from '../lib/calcul.js';
import { foyerPartage, agreger, chaleurDemo, penteChaleur, SEUIL_HAUSSE } from '../lib/steg.js';
import {
  genererReseau, foyerReelReseau, etatSecteur, statutFoyer, surconsommation, planDelestage, actionsDepuisPlan,
  kwReseau, bilanSolaire, gainsSolaire, syntheseSolaire, COUT_REVIENT, LIMITE_KVA, DUREE_MAX_MIN, PREAVIS_MIN,
} from '../lib/reseau.js';
import { VILLES, nomVille } from '../lib/meteo.js';

const CLE_ACTIONS = 'mieru:steg-actions';
const lireActions = () => { try { return JSON.parse(localStorage.getItem(CLE_ACTIONS)) || {}; } catch { return {}; } };

function Tuile({ titre, valeur, detail, ton = 'var(--sumi)' }) {
  return (
    <div className="card steg-tuile">
      <span className="caption">{titre}</span>
      <span className="steg-tuile-valeur" style={{ color: ton }}>{valeur}</span>
      {detail && <span className="small muted">{detail}</span>}
    </div>
  );
}

function Jauge({ charge }) {
  return (
    <div className="steg-jauge" aria-hidden="true">
      <span style={{ width: `${Math.min(100, charge * 100)}%`, background: couleurCharge(charge) }} />
      <i style={{ insetInlineStart: '100%' }} />
    </div>
  );
}

export default function Steg() {
  const { t, lang, nombre, locale, date } = useT();
  const { tarifs, signaler } = useCompteur();
  const [onglet, setOnglet] = useState('carte');
  const [scenario, setScenario] = useState('pointe');
  const [filtre, setFiltre] = useState('tout');
  const [selection, setSelection] = useState(null);
  const [focus, setFocus] = useState(null);
  const [actions, setActions] = useState(lireActions);
  const [entreesReelles, setEntreesReelles] = useState([]);
  const [plan, setPlan] = useState(null);
  const [objectifKw, setObjectifKw] = useState('');
  const [confirmer, setConfirmer] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(id); }, []);
  useEffect(() => { listerPartages().then(setEntreesReelles).catch(() => setEntreesReelles([])); }, []);
  useEffect(() => { try { localStorage.setItem(CLE_ACTIONS, JSON.stringify(actions)); } catch { /* stockage plein */ } }, [actions]);

  // Réseau = maisons simulées + vrais foyers Mieru.
  const reseau = useMemo(() => {
    const base = genererReseau(tarifs, new Date());
    const secteurs = [...base.secteurs];
    const foyers = [...base.foyers];
    entreesReelles.forEach((e, i) => {
      const etat = calculerEtat(e.compteur, e.releves, tarifs);
      const fp = foyerPartage({ ...e, partage: { ...e.partage, niveau: 'nomme' } }, tarifs);
      const { foyer, nouveauSecteur } = foyerReelReseau(e, { ...etat, kwhPrec: fp?.kwhPrec ?? null }, secteurs, i);
      if (nouveauSecteur && !secteurs.some((s) => s.id === nouveauSecteur.id)) secteurs.push(nouveauSecteur);
      foyers.push(foyer);
    });
    for (const s of secteurs) if (!s.capaciteKw) s.capaciteKw = Math.max(4, foyers.filter((f) => f.secteur === s.id).length * 1.75);
    return { secteurs, foyers, mois: base.mois };
  }, [tarifs, entreesReelles]);

  const etats = useMemo(() => reseau.secteurs.map((s) => etatSecteur(s, reseau.foyers, actions, scenario, now)), [reseau, actions, scenario, now]);
  const statuts = useMemo(() => Object.fromEntries(reseau.foyers.map((f) => [f.id, statutFoyer(actions[f.id], now)])), [reseau, actions, now]);
  const alertes = useMemo(() => new Set(reseau.foyers.filter((f) => surconsommation(f, scenario, tarifs.seuilMensuelKwh).length).map((f) => f.id)), [reseau, scenario, tarifs]);
  const solaire = useMemo(() => syntheseSolaire(reseau.foyers, tarifs, reseau.mois), [reseau, tarifs]);
  const agg = useMemo(() => agreger(reseau.foyers, { seuil: tarifs.seuilMensuelKwh }), [reseau, tarifs]);
  const chaleur = useMemo(() => chaleurDemo(), []);
  const pente = useMemo(() => penteChaleur(chaleur), [chaleur]);

  const totalKw = etats.reduce((s, e) => s + e.kw, 0);
  const totalCap = etats.reduce((s, e) => s + e.capaciteKw, 0);
  const surcharges = etats.filter((e) => e.charge >= 1).sort((a, b) => b.charge - a.charge);
  const nReels = reseau.foyers.filter((f) => f.reel).length;
  const nom = (id) => nomVille(VILLES.find((v) => v.id === id) || { nom: id, nomAr: id }, lang);
  const pct = (x) => `${nombre(x * 100, 0)} %`;
  const heure = (d) => new Date(d).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const dinars = (x) => `${nombre(x, x >= 100 ? 0 : 2)} ${t('sim.currency')}`;

  const selFoyer = selection?.type === 'foyer' ? reseau.foyers.find((f) => f.id === selection.id) : null;
  const selSecteur = selection?.type === 'secteur' ? etats.find((s) => s.id === selection.id) : selFoyer ? etats.find((s) => s.id === selFoyer.secteur) : null;
  const selVille = selection?.type === 'ville' ? selection.id : null;

  const choisir = useCallback((sel) => { setSelection(sel); setPlan(null); setConfirmer(null); }, []);
  const allerA = (sel, lat, lon, z) => { choisir(sel); setOnglet('carte'); setFocus({ lat, lon, z, cle: Date.now() }); };

  // Avis au foyer réel (les maisons simulées n'ont pas de téléphone).
  async function prevenir(f, avis) {
    if (f.reel && f.compteurId) { try { await envoyerAvisSteg(f.compteurId, avis); } catch (e) { signaler(e.message); } }
  }
  async function alerter(liste) {
    const nouvelles = {};
    for (const f of liste) {
      if (statutFoyer(actions[f.id], now) !== 'normal') continue;
      nouvelles[f.id] = { type: 'alerte', annonceLe: now.toISOString(), raisons: surconsommation(f, scenario) };
      await prevenir(f, { type: 'alerte', raisons: nouvelles[f.id].raisons });
    }
    setActions((a) => ({ ...a, ...nouvelles }));
    signaler(t('steg.alertSent', { n: Object.keys(nouvelles).length }));
  }
  async function agir(f, type) {
    const a = actionsDepuisPlan({ plan: [{ id: f.id, action: type }] }, now)[f.id];
    setActions((x) => ({ ...x, [f.id]: a }));
    await prevenir(f, { type, debut: a.debut, fin: a.fin });
    setConfirmer(null);
    signaler(t(type === 'coupe' ? 'steg.cutAnnounced' : 'steg.limitAnnounced', { ref: f.ref, h: heure(a.debut) }));
  }
  async function retablir(liste) {
    setActions((x) => { const n = { ...x }; for (const f of liste) delete n[f.id]; return n; });
    for (const f of liste) await prevenir(f, { type: 'retabli' });
    signaler(t('steg.restored', { n: liste.length }));
  }
  function preparer(secteur) {
    const kw = Number(String(objectifKw).replace(',', '.')) || Math.max(1, Math.ceil(secteur.depassementKw) || Math.ceil(secteur.kw * 0.1));
    setObjectifKw(String(kw));
    setPlan({ secteur: secteur.id, ...planDelestage(reseau.foyers.filter((f) => f.secteur === secteur.id), kw, { scenario, actions, now }) });
  }
  async function appliquer() {
    const nouvelles = actionsDepuisPlan(plan, now);
    setActions((x) => ({ ...x, ...nouvelles }));
    for (const id of Object.keys(nouvelles)) {
      const f = reseau.foyers.find((x) => x.id === id);
      await prevenir(f, { type: nouvelles[id].type, debut: nouvelles[id].debut, fin: nouvelles[id].fin });
    }
    signaler(t('steg.planApplied', { n: plan.plan.length, h: heure(Object.values(nouvelles)[0]?.debut || now) }));
    setPlan(null);
  }

  const listeAlertes = reseau.foyers.filter((f) => alertes.has(f.id)).sort((a, b) => kwReseau(b, scenario) / b.kva - kwReseau(a, scenario) / a.kva);

  return (
    <div className="steg">
      <header className="steg-entete">
        <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
          <img src="/assets/mieru-mark.svg" alt="" width="40" height="40" />
          <div>
            <h1 className="title" style={{ fontSize: 24 }}>{t('steg.title')}</h1>
            <p className="small muted">{t('steg.sub2', { n: nombre(reseau.foyers.length, 0), reels: nReels })}</p>
          </div>
        </div>
        <div className="row">
          <div className="segmente" role="group" aria-label={t('steg.scenario')}>
            <button aria-pressed={scenario === 'maintenant'} onClick={() => setScenario('maintenant')}>{t('steg.scNow')}</button>
            <button aria-pressed={scenario === 'pointe'} onClick={() => setScenario('pointe')}>{t('steg.scPeak')}</button>
          </div>
          <LangueCompacte />
          <Link to="/" className="btn" style={{ width: 'auto', minHeight: 40, padding: '0 14px' }}>{t('steg.back')}</Link>
        </div>
      </header>

      <main className="steg-corps">
        <section className="steg-tuiles steg-tuiles-5">
          <Tuile titre={t('steg.kpiLoad')} valeur={`${nombre(totalKw / 1000, 2)} MW`} ton={couleurCharge(totalKw / totalCap)} detail={t('steg.kpiLoadSub', { pct: pct(totalKw / totalCap), cap: nombre(totalCap / 1000, 2) })} />
          <Tuile titre={t('steg.kpiOverSectors')} valeur={surcharges.length} ton={surcharges.length ? 'var(--shu)' : 'var(--matcha)'} detail={t('steg.kpiOverSectorsSub', { n: etats.length })} />
          <Tuile titre={t('steg.kpiAlerts')} valeur={alertes.size} ton="var(--shu)" detail={t('steg.kpiAlertsSub')} />
          <Tuile titre={t('steg.kpiActions')} valeur={Object.values(statuts).filter((s) => s === 'limite' || s === 'coupe' || s === 'programme').length} ton="var(--kincha)" detail={t('steg.kpiActionsSub', { n: Object.values(statuts).filter((s) => s === 'coupe').length })} />
          <Tuile titre={t('steg.kpiSolarGain')} valeur={dinars(solaire.gainSteg)} ton="var(--matcha)" detail={t('steg.kpiSolarGainSub', { n: solaire.n })} />
        </section>

        <div className="onglets" role="tablist">
          {['carte', 'solaire', 'stats'].map((o) => <button key={o} role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)}>{t(`steg.tab.${o}`)}</button>)}
        </div>

        {onglet === 'carte' && (
          <section className="steg-carte-grille">
            <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {['tout', 'alertes', 'solaire', 'actions'].map((x) => <button key={x} className="chip" aria-pressed={filtre === x} onClick={() => setFiltre(x)}>{t(`map.filter.${x}`)}</button>)}
              </div>
              <CarteSteg secteurs={etats} foyers={reseau.foyers} statuts={statuts} alertes={alertes} filtre={filtre} selection={selection} onSelect={choisir} focus={focus} />
              <p className="small muted">{t('map.note')}</p>
            </div>

            <aside className="card steg-panneau">
              {/* --- Rien de sélectionné : priorités du moment --- */}
              {!selection && <>
                <h2 className="heading">{t('steg.priorities')}</h2>
                <p className="small muted">{t(scenario === 'pointe' ? 'steg.prioritiesPeak' : 'steg.prioritiesNow')}</p>
                <h3 className="caption" style={{ marginTop: 8 }}>{t('steg.overSectors')}</h3>
                {surcharges.length === 0 && <p className="small muted">{t('steg.noOverSectors')}</p>}
                {surcharges.slice(0, 8).map((s) => (
                  <button key={s.id} className="ligne-btn" onClick={() => allerA({ type: 'secteur', id: s.id }, s.lat, s.lon, 90)}>
                    <span><b>{s.nom}</b> <span className="muted">· {nom(s.ville)}</span><Jauge charge={s.charge} /></span>
                    <span style={{ color: 'var(--shu)', fontWeight: 700 }}>{pct(s.charge)}</span>
                  </button>
                ))}
                <h3 className="caption" style={{ marginTop: 12 }}>{t('steg.overHomes', { n: listeAlertes.length })}</h3>
                {listeAlertes.slice(0, 6).map((f) => (
                  <button key={f.id} className="ligne-btn" onClick={() => allerA({ type: 'foyer', id: f.id }, f.lat, f.lon, 170)}>
                    <span><span className="mono" dir="ltr">{f.ref}</span> <span className="muted">· {reseau.secteurs.find((s) => s.id === f.secteur)?.nom}</span>
                      <span className="small muted" style={{ display: 'block' }}>{surconsommation(f, scenario).map((r) => t(`steg.reason.${r}`, { kwh: f.kwhMois, kw: nombre(kwReseau(f, scenario), 1), kva: f.kva })).join(' · ')}</span></span>
                    <span className="small" style={{ color: 'var(--shu)' }}>{statuts[f.id] === 'alerte' ? t('steg.alerted') : ''}</span>
                  </button>
                ))}
                <button className="btn" onClick={() => alerter(listeAlertes)} disabled={!listeAlertes.length}>{t('steg.alertAll', { n: listeAlertes.filter((f) => statuts[f.id] === 'normal').length })}</button>
              </>}

              {/* --- Gouvernorat --- */}
              {selVille && <>
                <h2 className="heading">{nom(selVille)}</h2>
                {etats.filter((s) => s.ville === selVille).map((s) => (
                  <button key={s.id} className="ligne-btn" onClick={() => allerA({ type: 'secteur', id: s.id }, s.lat, s.lon, 90)}>
                    <span><b>{s.nom}</b> <span className="muted small">· {t('steg.homes', { n: s.n })}</span><Jauge charge={s.charge} /></span>
                    <span style={{ color: couleurCharge(s.charge), fontWeight: 700 }}>{pct(s.charge)}</span>
                  </button>
                ))}
              </>}

              {/* --- Secteur : état + délestage ciblé --- */}
              {selSecteur && !selFoyer && <>
                <h2 className="heading">{selSecteur.nom} <span className="muted small">· {nom(selSecteur.ville)}</span></h2>
                <Jauge charge={selSecteur.charge} />
                <dl className="steg-dl">
                  <dt>{t('steg.load')}</dt><dd style={{ color: couleurCharge(selSecteur.charge) }}>{nombre(selSecteur.kw, 0)} / {nombre(selSecteur.capaciteKw, 0)} kW ({pct(selSecteur.charge)})</dd>
                  <dt>{t('steg.homesConnected')}</dt><dd>{selSecteur.n}</dd>
                  <dt>{t('steg.overHomesShort')}</dt><dd>{selSecteur.nAlerte}</dd>
                  <dt>{t('steg.solarRelief')}</dt><dd>{t('steg.solarReliefVal', { n: selSecteur.nPV, kw: nombre(selSecteur.kwPV, 1) })}</dd>
                  <dt>{t('steg.priorityHomes')}</dt><dd>{selSecteur.nPrioritaires}</dd>
                  {(selSecteur.nLimite + selSecteur.nCoupe + selSecteur.nProgramme > 0) && <><dt>{t('steg.inProgress')}</dt><dd>{t('steg.inProgressVal', { l: selSecteur.nLimite, c: selSecteur.nCoupe, p: selSecteur.nProgramme })}</dd></>}
                </dl>

                <div className="steg-delestage">
                  <h3 className="heading" style={{ fontSize: 17 }}>{t('steg.shedTitle')}</h3>
                  <p className="small muted">{t('steg.shedIntro', { kva: LIMITE_KVA, min: DUREE_MAX_MIN })}</p>
                  <label className="field"><span className="caption">{t('steg.shedTarget')}</span>
                    <input className="input" inputMode="decimal" value={objectifKw} placeholder={String(Math.max(1, Math.ceil(selSecteur.depassementKw) || Math.ceil(selSecteur.kw * 0.1)))} onChange={(e) => { setObjectifKw(e.target.value); setPlan(null); }} />
                  </label>
                  <button className="btn btn-primary" onClick={() => preparer(selSecteur)}>{t('steg.shedPrepare')}</button>
                  {plan && plan.secteur === selSecteur.id && <>
                    <div className="steg-compare">
                      <div className="tone-warn"><span className="caption">{t('steg.shedClassic')}</span><b>{t('steg.shedClassicVal', { n: plan.nSecteur })}</b><span className="small">{t('steg.shedClassicSub')}</span></div>
                      <div className="tone-info"><span className="caption">{t('steg.shedTargeted')}</span><b>{t('steg.shedTargetedVal', { l: plan.nLimites, c: plan.nCoupes })}</b><span className="small">{t('steg.shedTargetedSub', { kw: nombre(plan.totalKw, 1), p: plan.nProteges })}</span></div>
                    </div>
                    {!plan.atteint && <p className="alert tone-warn small">{t('steg.shedNotEnough')}</p>}
                    <ul className="steg-plan">
                      {plan.plan.map((p) => (
                        <li key={p.id}><span className="mono" dir="ltr">{p.ref}</span><span>{nombre(p.kwAvant, 1)} kW</span><span style={{ color: p.action === 'coupe' ? 'var(--shu)' : 'var(--kincha)', fontWeight: 600 }}>{t(p.action === 'coupe' ? 'steg.actCut' : 'steg.actLimit', { kva: LIMITE_KVA })}</span></li>
                      ))}
                    </ul>
                    <button className="btn btn-primary" onClick={appliquer} disabled={!plan.plan.length}>{t('steg.shedApply', { min: PREAVIS_MIN })}</button>
                  </>}
                  {(selSecteur.nLimite + selSecteur.nCoupe + selSecteur.nProgramme > 0) && (
                    <button className="btn btn-quiet" onClick={() => retablir(reseau.foyers.filter((f) => f.secteur === selSecteur.id && ['limite', 'coupe', 'programme'].includes(statuts[f.id])))}>{t('steg.restoreSector')}</button>
                  )}
                </div>
              </>}

              {/* --- Maison --- */}
              {selFoyer && (() => {
                const f = selFoyer, st = statuts[f.id], a = actions[f.id];
                const raisons = surconsommation(f, scenario);
                const b = f.pv ? bilanSolaire(f.pv, reseau.mois) : null;
                const g = b ? gainsSolaire(f.kwhMois + b.autoconso, b.production, tarifs) : null;
                return <>
                  <button className="btn-lien small" onClick={() => choisir({ type: 'secteur', id: f.secteur })}>← {selSecteur?.nom}</button>
                  <h2 className="heading"><span className="mono" dir="ltr">{f.ref}</span>{f.reel && <span className="badge" style={{ marginInlineStart: 8 }}>{t('map.realHome')}</span>}</h2>
                  {f.nomFoyer && <p className="small">{f.nomFoyer}</p>}
                  <p className="small muted">{[f.type && t(`steg.type.${f.type}`), f.personnes && t('steg.people', { n: f.personnes }), t('steg.kva', { kva: f.kva })].filter(Boolean).join(' · ')}</p>
                  {f.prioritaire && <p className="alert tone-ok small">{t('steg.priorityBadge')}</p>}
                  <span className={`badge-statut st-${st}`}>{t(`steg.status.${st}`)}{a?.debut && st !== 'alerte' ? ` · ${heure(a.debut)}–${heure(a.fin)}` : ''}</span>
                  <dl className="steg-dl">
                    <dt>{t('steg.powerNow')}</dt><dd>{nombre(kwReseau(f, scenario), 1)} kW / {f.kva} kVA</dd>
                    <dt>{t('steg.monthKwh')}</dt><dd style={{ color: f.kwhMois > tarifs.seuilMensuelKwh ? 'var(--shu)' : undefined }}>{nombre(f.kwhMois, 0)} kWh</dd>
                    {f.kwhPrec != null && <><dt>{t('steg.prevKwh')}</dt><dd>{nombre(f.kwhPrec, 0)} kWh</dd></>}
                  </dl>
                  {raisons.length > 0 && <p className="alert tone-warn small">{raisons.map((r) => t(`steg.reason.${r}`, { kwh: f.kwhMois, kw: nombre(kwReseau(f, scenario), 1), kva: f.kva })).join(' · ')}</p>}
                  {b && (
                    <div className="steg-solaire-mini">
                      <span className="caption">☀ {t('steg.solarHome', { kwc: nombre(f.pv.kwc, 1) })}</span>
                      <dl className="steg-dl">
                        <dt>{t('solar.production')}</dt><dd>{nombre(b.production, 0)} kWh</dd>
                        <dt>{t('solar.injected')}</dt><dd>{nombre(b.injection, 0)} kWh{b.estimee ? '*' : ''}</dd>
                        <dt>{t('solar.gainHome')}</dt><dd>{dinars(g.gainFoyer)}</dd>
                        <dt>{t('solar.gainSteg')}</dt><dd style={{ color: 'var(--matcha)', fontWeight: 700 }}>{dinars(g.gainSteg)}</dd>
                      </dl>
                      {g.sousSeuilGraceAuSolaire && <p className="small muted">{t('solar.cliffNote')}</p>}
                    </div>
                  )}
                  <div className="steg-actions">
                    {st === 'normal' && raisons.length > 0 && <button className="btn" onClick={() => alerter([f])}>{t('steg.actAlert')}</button>}
                    {!f.prioritaire && ['normal', 'alerte'].includes(st) && <>
                      <button className="btn" onClick={() => agir(f, 'limite')}>{t('steg.actLimitBtn', { kva: LIMITE_KVA, min: PREAVIS_MIN })}</button>
                      {confirmer === f.id
                        ? <button className="btn btn-danger" onClick={() => agir(f, 'coupe')}>{t('steg.actCutConfirm', { min: PREAVIS_MIN, d: DUREE_MAX_MIN })}</button>
                        : <button className="btn btn-quiet" style={{ color: 'var(--shu)' }} onClick={() => setConfirmer(f.id)}>{t('steg.actCutBtn')}</button>}
                    </>}
                    {['limite', 'coupe', 'programme'].includes(st) && <button className="btn btn-primary" onClick={() => retablir([f])}>{t('steg.actRestore')}</button>}
                  </div>
                  {f.reel && <p className="small muted">{t('steg.realNotified')}</p>}
                </>;
              })()}
            </aside>
          </section>
        )}

        {onglet === 'solaire' && <>
          <section className="steg-tuiles">
            <Tuile titre={t('solar.kpiHomes')} valeur={solaire.n} detail={t('solar.kpiKwc', { kwc: nombre(solaire.kwc, 0) })} />
            <Tuile titre={t('solar.kpiProd')} valeur={`${nombre(solaire.production / 1000, 1)} MWh`} detail={t('solar.kpiInjected', { mwh: nombre(solaire.injection / 1000, 1) })} />
            <Tuile titre={t('solar.kpiGainHomes')} valeur={dinars(solaire.gainFoyers)} detail={t('solar.kpiUnder', { n: solaire.nSousSeuil })} />
            <Tuile titre={t('solar.kpiGainSteg')} valeur={dinars(solaire.gainSteg)} ton="var(--matcha)" detail={t('solar.kpiGainStegSub', { cout: nombre(COUT_REVIENT, 3) })} />
          </section>
          <section className="card">
            <h2 className="heading">{t('solar.howTitle')}</h2>
            <p className="small" style={{ marginTop: 6 }}>{t('solar.how1')}</p>
            <p className="small" style={{ marginTop: 4 }}>{t('solar.how2', { cout: nombre(COUT_REVIENT, 3) })}</p>
            <p className="small muted" style={{ marginTop: 4 }}>{t('solar.how3')}</p>
            <p className="small muted" style={{ marginTop: 4 }}>{t('solar.cliffNote')}</p>
          </section>
          <section className="card">
            <h2 className="heading">{t('solar.tableTitle')}</h2>
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table className="steg-table">
                <thead><tr><th>{t('steg.colRef')}</th><th>{t('steg.colZone')}</th><th>kWc</th><th>{t('solar.production')}</th><th>{t('solar.injected')}</th><th>{t('solar.gainHome')}</th><th>{t('solar.gainSteg')}</th><th aria-label={t('steg.colAction')} /></tr></thead>
                <tbody>
                  {[...solaire.lignes.filter((l) => l.reel), ...solaire.lignes.filter((l) => !l.reel).slice(0, 14)].map((l) => {
                    const f = reseau.foyers.find((x) => x.id === l.id);
                    return (
                      <tr key={l.id} style={l.reel ? { background: 'var(--sakura-soft)' } : undefined}>
                        <td className="mono" dir="ltr">{l.ref}{l.reel ? ' ★' : ''}</td>
                        <td>{reseau.secteurs.find((s) => s.id === l.secteur)?.nom}</td>
                        <td>{nombre(l.kwc, 1)}</td>
                        <td>{nombre(l.production, 0)} kWh</td>
                        <td>{nombre(l.injection, 0)} kWh{l.estimee ? '*' : ''}</td>
                        <td>{dinars(l.gainFoyer)}</td>
                        <td style={{ color: 'var(--matcha)', fontWeight: 700 }}>{dinars(l.gainSteg)}</td>
                        <td><button className="chip" onClick={() => allerA({ type: 'foyer', id: l.id }, f.lat, f.lon, 170)}>{t('steg.seeOnMap')}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>{t('solar.estimatedNote')}</p>
          </section>
        </>}

        {onglet === 'stats' && <>
          <section className="steg-tuiles">
            <Tuile titre={t('steg.kpiHouseholds')} valeur={nombre(agg.n, 0)} detail={t('steg.realHomes', { n: nReels })} />
            <Tuile titre={t('steg.kpiAvg')} valeur={`${nombre(agg.moyenne, 0)} kWh`} detail={t('steg.kpiAvgSub', { total: nombre(agg.kwhTotal / 1000, 1) })} />
            <Tuile titre={t('steg.kpiOver', { seuil: tarifs.seuilMensuelKwh })} valeur={`${nombre(agg.partAuDessus * 100, 1)} %`} ton="var(--shu)" detail={t('steg.kpiOverSub', { n: agg.nProchesSeuil })} />
            <Tuile titre={t('steg.kpiVar')} valeur={agg.variationMoyenne === null ? '—' : `${agg.variationMoyenne > 0 ? '+' : ''}${nombre(agg.variationMoyenne * 100, 1)} %`} ton={agg.variationMoyenne > 0 ? 'var(--kincha)' : 'var(--matcha)'} detail={t('steg.kpiVarSub')} />
          </section>
          <section className="steg-grille">
            <article className="card"><h2 className="heading">{t('steg.zones')}</h2><p className="small muted">{t('steg.zonesSub2')}</p><BarresZones zones={agg.parZone} seuil={tarifs.seuilMensuelKwh} /></article>
            <article className="card"><h2 className="heading">{t('steg.tranches')}</h2><p className="small muted">{t('steg.tranchesSub', { n: agg.nProchesSeuil, seuil: tarifs.seuilMensuelKwh })}</p><Tranches tranches={agg.tranches} seuil={tarifs.seuilMensuelKwh} /></article>
            <article className="card"><h2 className="heading">{t('steg.evolution')}</h2><p className="small muted">{t('steg.evolutionSub')}</p>{agg.evolution.length > 1 ? <Evolution evolution={agg.evolution} seuil={tarifs.seuilMensuelKwh} /> : <p className="small muted">{t('steg.notEnough')}</p>}</article>
            <article className="card"><h2 className="heading">{t('steg.heat')}</h2><p className="small muted">{t('steg.heatSub', { a: nombre(pente.a, 2) })}</p><Chaleur points={chaleur} pente={pente} /></article>
          </section>
          <section className="card">
            <h2 className="heading">{t('steg.rising', { pct: Math.round(SEUIL_HAUSSE * 100) })}</h2>
            <p className="small muted" style={{ marginBottom: 8 }}>{t('steg.risingSub2')}</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="steg-table">
                <thead><tr><th>{t('steg.colRef')}</th><th>{t('steg.colZone')}</th><th>{t('steg.colPrev')}</th><th>{t('steg.colNow')}</th><th>{t('steg.colVar')}</th><th aria-label={t('steg.colAction')} /></tr></thead>
                <tbody>
                  {agg.enHausse.slice(0, 12).map((r) => {
                    const f = reseau.foyers.find((x) => x.ref === r.pseudo);
                    return (
                      <tr key={r.pseudo}>
                        <td className="mono" dir="ltr">{r.pseudo}</td>
                        <td>{f ? reseau.secteurs.find((s) => s.id === f.secteur)?.nom : nom(r.ville)}</td>
                        <td>{nombre(r.kwhPrec, 0)} kWh</td>
                        <td style={{ color: r.auDessus ? 'var(--shu)' : 'inherit', fontWeight: 600 }}>{nombre(r.kwhMois, 0)} kWh</td>
                        <td style={{ color: 'var(--kincha)', fontWeight: 600 }}>+{nombre(r.variation * 100, 1)} %</td>
                        <td>{f && <button className="chip" onClick={() => allerA({ type: 'foyer', id: f.id }, f.lat, f.lon, 170)}>{t('steg.seeOnMap')}</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>}

      </main>
    </div>
  );
}
