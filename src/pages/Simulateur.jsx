// Écran 4 — Simulateur : combien coûte un appareil, et combien d'heures par jour pour rester sous le seuil (F5).
import { useState } from 'react';
import { useCompteur } from '../lib/store.jsx';
import { useT } from '../i18n/index.jsx';
import { TopBar, Aaddad } from '../components/Chrome.jsx';
import { projectionAppareils } from '../lib/calcul.js';

const TON = { ok: 'tone-ok', warn: 'tone-warn', over: 'tone-over' };

export default function Simulateur() {
  const { etat, tarifs } = useCompteur();
  const { t, nombre, duree } = useT();
  const [machines, setMachines] = useState([]);
  const [appareilsPerso, setAppareilsPerso] = useState([]);
  const [formulaireAutre, setFormulaireAutre] = useState(false);
  const [nomAutre, setNomAutre] = useState('');
  const [kwhParHeureAutre, setKwhParHeureAutre] = useState('');
  const [erreurAutre, setErreurAutre] = useState('');
  const appareils = [...tarifs.appareils, ...appareilsPerso];
  const nomAppareil = (appareil) => appareil.personnalise ? appareil.nom : t(`app.${appareil.id}`);
  const scenario = projectionAppareils(
    machines.map((machine) => ({
      appareil: appareils.find((a) => a.id === machine.appareilId),
      quantite: machine.quantite,
    })),
    etat,
    tarifs,
  );
  const pourcentageSeuil = Math.round(scenario.kwhProjetes / etat.seuil * 100);
  const basculerAppareil = (appareil) => {
    setMachines((actuelles) => {
      if (actuelles.some((machine) => machine.appareilId === appareil.id)) {
        return actuelles.filter((machine) => machine.appareilId !== appareil.id);
      }
      return [...actuelles, { appareilId: appareil.id, quantite: appareil.unite === 'h' ? 2 : 1 }];
    });
  };
  const ajusterQuantite = (appareil, variation) => {
    setMachines((actuelles) => actuelles.map((machine) => (
      machine.appareilId === appareil.id
        ? { ...machine, quantite: Math.max(0, Math.min(24, Math.round((machine.quantite + variation) * 10) / 10)) }
        : machine
    )));
  };
  const ajouterAutreAppareil = (ev) => {
    ev.preventDefault();
    const nom = nomAutre.trim();
    const kw = Number(kwhParHeureAutre);
    if (!nom || !Number.isFinite(kw) || kw <= 0) {
      setErreurAutre(t('sim.otherInvalid'));
      return;
    }

    const appareil = { id: `perso-${Date.now()}`, nom, kw, unite: 'h', pas: 0.5, personnalise: true };
    setAppareilsPerso((actuels) => [...actuels, appareil]);
    setMachines((actuelles) => [...actuelles, { appareilId: appareil.id, quantite: 1 }]);
    setNomAutre('');
    setKwhParHeureAutre('');
    setErreurAutre('');
    setFormulaireAutre(false);
  };

  return (
    <>
      <TopBar titre={t('sim.title')} retour />
      <main className="screen">
        <p className="muted">{t('sim.intro')}</p>
        <section className={`card sim-results ${TON[scenario.verdict]}`} aria-live="polite">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="heading">{t('sim.scenarioTitle')}</h2>
            <b className="tone-title">{t(`sim.${scenario.verdict}`)}</b>
          </div>
          <div className="sim-kpis">
            <div className="sim-kpi">
              <span className="small muted">{t('sim.totalConsumption')}</span>
              <strong>{nombre(scenario.kwhProjetes)} <small>kWh</small></strong>
            </div>
            <div className="sim-kpi">
              <span className="small muted">{t('sim.estimatedBill')}</span>
              <strong>{nombre(scenario.dinars, 2)} <small>{t('sim.currency')}</small></strong>
            </div>
          </div>
          <p className="small">{t('sim.thresholdProgress', { percent: nombre(pourcentageSeuil) })}</p>
          <div className="sim-progress" role="progressbar" aria-label={t('sim.thresholdProgress', { percent: nombre(pourcentageSeuil) })}
            aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.min(100, Math.max(0, pourcentageSeuil))}>
            <span style={{ width: `${Math.min(100, Math.max(0, pourcentageSeuil))}%` }} />
          </div>
          <p className="small">{t('sim.addedConsumption', { kwh: nombre(scenario.kwhAjoutes), days: etat.joursRestants })}</p>
          <p className="small muted">{t('sim.scenarioHint')}</p>
        </section>
        <div className="grid2" role="group" aria-label={t('sim.appliance')}>
          {appareils.map((a) => (
            <button key={a.id} type="button" aria-pressed={machines.some((machine) => machine.appareilId === a.id)}
              className={`radio-row${machines.some((machine) => machine.appareilId === a.id) ? ' on' : ''}`}
              style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 12px', minHeight: 64, textAlign: 'start' }}
              onClick={() => basculerAppareil(a)}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{nomAppareil(a)}</span>
              <span className="small muted">{t(a.unite === 'h' ? 'sim.perHour' : 'sim.perCycle', { kw: nombre(a.kw, 2) })}</span>
            </button>
          ))}
          <button type="button" aria-expanded={formulaireAutre} aria-controls="sim-autre-form"
            className={`radio-row${formulaireAutre ? ' on' : ''}`}
            style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 12px', minHeight: 64, textAlign: 'start' }}
            onClick={() => { setFormulaireAutre(!formulaireAutre); setErreurAutre(''); }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{t('sim.other')}</span>
            <span className="small muted">{t('sim.otherHint')}</span>
          </button>
        </div>
        {formulaireAutre && (
          <form id="sim-autre-form" className="card" onSubmit={ajouterAutreAppareil}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label className="small" htmlFor="sim-autre-nom">{t('sim.otherName')}
              <input id="sim-autre-nom" className="input" type="text" maxLength="60" required
                value={nomAutre} onChange={(ev) => { setNomAutre(ev.target.value); setErreurAutre(''); }} />
            </label>
            <label className="small" htmlFor="sim-autre-kwh">{t('sim.otherKwh')}
              <input id="sim-autre-kwh" className="input" type="number" inputMode="decimal" min="0.01" step="0.01" required
                value={kwhParHeureAutre} onChange={(ev) => { setKwhParHeureAutre(ev.target.value); setErreurAutre(''); }} />
            </label>
            {erreurAutre && <p className="small" role="alert">{erreurAutre}</p>}
            <button type="submit" className="btn btn-primary">{t('sim.otherAdd')}</button>
          </form>
        )}
        {machines.length > 0 && (
          <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 className="heading">{t('sim.selectedTitle')}</h2>
            {machines.map((machine) => {
              const appareil = appareils.find((a) => a.id === machine.appareilId);
              const horaire = appareil.unite === 'h';
              return (
                <div key={machine.appareilId} className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{nomAppareil(appareil)}</span>
                  <div className="row">
                    <button className="chip" aria-label={t('sim.minusAppliance', { name: nomAppareil(appareil) })}
                      disabled={machine.quantite === 0} style={{ width: 44, height: 44 }}
                      onClick={() => ajusterQuantite(appareil, -appareil.pas)}>−</button>
                    <span style={{ minWidth: 64, textAlign: 'center', font: '800 20px/28px var(--font-display)' }}>
                      {duree(machine.quantite, horaire ? 'h' : 'lessive')}
                    </span>
                    <button className="chip" aria-label={t('sim.plusAppliance', { name: nomAppareil(appareil) })}
                      disabled={machine.quantite === 24} style={{ width: 44, height: 44 }}
                      onClick={() => ajusterQuantite(appareil, appareil.pas)}>+</button>
                  </div>
                </div>
              );
            })}
          </section>
        )}
        <p className="alert tone-over small" style={{ alignItems: 'center' }}>
          <Aaddad humeur="inquiet" taille={44} />
          <span><b style={{ color: 'var(--shu)' }}>{t('sim.mottainai')}</b> · {t('sim.mottText', { n: etat.seuil + 1, d: nombre(etat.surcoutPremierKwh, 0) })}</span>
        </p>
      </main>
    </>
  );
}
