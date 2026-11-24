// Écran 2 — Accueil : la jauge Pont Kizuna, le graphique du mois, l'alerte canicule et l'action principale.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompteur } from '../lib/store.jsx';
import { useT } from '../i18n/index.jsx';
import { TopBar, Avatars, Hanko, Aaddad } from '../components/Chrome.jsx';
import PontGauge from '../components/PontGauge.jsx';
import Graphique from '../components/Graphique.jsx';
import Canicule from '../components/Canicule.jsx';
import Photovoltaique from '../components/Photovoltaique.jsx';
import AvisSteg from '../components/AvisSteg.jsx';
import Icon from '../components/Icon.jsx';
import { serieMois, dateReleve } from '../lib/calcul.js';
import { parler, VOIX } from '../lib/voix.js';

const PASTILLE = { ok: 'var(--matcha-soft)', warn: 'var(--kincha-soft)', over: 'var(--shu-soft)' };
const ENCRE = { ok: 'var(--matcha)', warn: 'var(--kincha)', over: 'var(--shu)' };

export default function Accueil() {
  const { compteur, membres, releves, etat: e, moi, tarifs } = useCompteur();
  const { t, nombre, date, mois, lang } = useT();
  const [ecouteActive, setEcouteActive] = useState(false);
  const serie = useMemo(() => serieMois(compteur, releves, tarifs), [compteur, releves, tarifs]);
  const auteur = membres.find((m) => m.id === e.dernierReleve?.membreId)?.prenom;
  const h = new Date().getHours();
  const salut = t(h < 5 || h >= 18 ? 'greet.evening' : 'greet.morning');
  const reste = Math.round(e.resteKwh);
  const dernier = releves.length ? Math.max(...releves.map((r) => new Date(dateReleve(r)).getTime())) : null;
  const enAttente = dernier !== null && Date.now() - dernier > 7 * 86400000;
  const ecouter = () => {
    if ('speechSynthesis' in window && (ecouteActive || window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      window.speechSynthesis.cancel();
      setEcouteActive(false);
      return;
    }

    const phrases = [
      reste >= 0 ? t('voice.left', { n: reste, days: e.joursRestants }) : t('voice.over', { n: -reste }),
      t('gauge.aria', { conso: nombre(e.consoPeriode, 0), seuil: e.seuil, level: t(`level.${e.niveau}`) }),
    ];

    if (e.niveau === 'ok') phrases.push(t('home.okText', { n: nombre(e.projection, 0) }));
    if (e.niveau === 'warn') {
      phrases.push(e.joursAvantSeuil === null
        ? t('home.warnNear')
        : e.joursAvantSeuil <= 1
          ? t('home.warnDays1')
          : t('home.warnDaysN', { n: e.joursAvantSeuil }));
      if (e.surcoutProjete > 0) phrases.push(t('home.warnCost', { n: nombre(e.surcoutProjete, 0) }));
    }
    if (e.niveau === 'over') phrases.push(t('home.overText'));
    if (enAttente) phrases.push(`${t('home.waitTitle')}, ${t('home.waitText')}`);

    if (parler(phrases.join(' '), VOIX[lang], () => setEcouteActive(false))) setEcouteActive(true);
  };

  return (
    <>
      <TopBar titre={compteur.nom} droite={<Link to="/kizuna" style={{ textDecoration: 'none' }}><Avatars membres={membres} /></Link>} />
      <main className="screen accueil">
        <div className="accueil-head">
          <p className="small muted">{t('home.sub', { greet: salut, name: moi?.prenom || '', month: mois(), days: e.joursRestants })}</p>
          <h1 className="display">{e.resteKwh >= 0 ? t('home.left', { n: Math.round(e.resteKwh) }) : t('home.over', { n: Math.round(-e.resteKwh) })}</h1>
          <button className="chip row" style={{ marginTop: 8, gap: 6, display: 'inline-flex' }} onClick={ecouter} aria-label={t(ecouteActive ? 'home.stop' : 'home.listen')} aria-pressed={ecouteActive}>
            <Icon nom="son" taille={18} className="flip" /> {t(ecouteActive ? 'home.stop' : 'home.listen')}
          </button>
        </div>

        <div className="accueil-main">
          <section className="card arch o-jauge" aria-label={t('home.gaugeSection')} style={{ textAlign: 'center' }}>
            <PontGauge conso={e.consoPeriode} seuil={e.seuil} projection={e.projection} niveau={e.niveau} />
            <div className="row" style={{ justifyContent: 'center', marginTop: 4 }}>
              <span className="pill" style={{ background: PASTILLE[e.niveau], color: ENCRE[e.niveau] }}>{t(`level.${e.niveau}`)}</span>
              <span className="small muted">{nombre(e.consoPeriode, 0)} / {e.seuil} kWh{e.nbRelevesMois ? '' : ` · ${t('home.firstReading')}`}</span>
            </div>
          </section>
          <section className="card o-graph">
            <h2 className="heading" style={{ fontSize: 16, marginBottom: 8 }}>{t('chart.title')}</h2>
            <Graphique serie={serie} niveau={e.niveau} moyenneJour={e.moyenneJour} />
          </section>
        </div>

        <div className="accueil-side">
          <AvisSteg className="o-avis" />
          {e.niveau === 'ok' && (
            <section className="alert tone-ok o-alerte" role="status">
              <Aaddad humeur="joie" taille={50} />
              <div><h2 className="tone-title">{t('home.okTitle')}</h2>
                <p className="small">{t('home.okText', { n: nombre(e.projection, 0) })} <Link to="/simulateur">{t('home.okLink')}</Link></p></div>
            </section>
          )}
          {e.niveau === 'warn' && (
            <section className="alert tone-warn o-alerte" role="status">
              <Aaddad humeur="inquiet" taille={50} />
              <div><h2 className="tone-title">{t('home.warnTitle')}</h2>
                <p className="small">
                  {e.joursAvantSeuil === null ? t('home.warnNear') : e.joursAvantSeuil <= 1 ? t('home.warnDays1') : t('home.warnDaysN', { n: e.joursAvantSeuil })}
                  {e.surcoutProjete > 0 ? t('home.warnCost', { n: nombre(e.surcoutProjete, 0) }) : '.'} <Link to="/simulateur" style={{ fontWeight: 600 }}>{t('home.warnLink')}</Link>
                </p></div>
            </section>
          )}
          {e.niveau === 'over' && (
            <section className="alert tone-over o-alerte" role="alert">
              <div><h2 className="tone-title">{t('home.overTitle')}</h2><p className="small">{t('home.overText')}</p></div>
            </section>
          )}

          {enAttente && (
            <section className="alert tone-info o-alerte" role="status">
              <Aaddad humeur="calme" taille={46} />
              <div><h2 className="tone-title">{t('home.waitTitle')}</h2><p className="small">{t('home.waitText')}</p></div>
            </section>
          )}
          <Canicule className="o-meteo" />
          <Photovoltaique importReseauKwh={e.consoPeriode} className="o-solaire" />

          {h >= 17 && h < 23 && (
            <p className="alert tone-info small o-reseau" style={{ alignItems: 'center', padding: '8px 12px' }}>
              <span style={{ color: 'var(--ai)' }}><Icon nom="reseau" taille={18} /></span>
              <span><b style={{ color: 'var(--ai)' }}>{t('home.grid')}</b> · {t('home.gridText')}</span>
            </p>
          )}

          <Link to="/releve" className="btn btn-primary o-btn"><Icon nom="camera" taille={20} />{t('home.readBtn')}</Link>

          {e.dernierReleve && (
            <Link to="/reclamation" className="row small muted o-last" style={{ textDecoration: 'none', flexWrap: 'nowrap' }}>
              {e.dernierReleve.sha256 ? <Hanko /> : <Icon nom="camera" taille={20} />}
              <span style={{ flex: 1 }}>{t('home.last')} <b className="mono" style={{ color: 'var(--sumi)' }}>{String(e.dernierReleve.index).padStart(5, '0')}</b>{auteur ? ` · ${auteur}` : ''}, {date(e.dernierReleve.prisLe || e.dernierReleve.recuLe, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              <Icon nom="suite" taille={18} className="flip" />
            </Link>
          )}
        </div>
      </main>
      <div className="waves" aria-hidden="true" />
    </>
  );
}
