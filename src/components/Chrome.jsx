// En-têtes, navigation, sceau hanko et petits éléments partagés.
import { NavLink, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useCompteur } from '../lib/store.jsx';
import { useT, LANGUES } from '../i18n/index.jsx';

export function TopBar({ titre, retour = false, droite = null }) {
  const nav = useNavigate();
  const { t } = useT();
  return (
    <header className="topbar">
      {retour
        ? <button className="back" aria-label={t('common.back')} onClick={() => nav(-1)}><Icon nom="retour" className="flip" /></button>
        : <img className="mark" src="/assets/mieru-mark.svg" alt="Mieru" />}
      <h1>{titre}</h1>
      {droite}
    </header>
  );
}

/** Sélecteur de langue compact (barre latérale sur ordinateur). */
export function LangueCompacte() {
  const { lang, setLang, t } = useT();
  return (
    <div className="row" role="group" aria-label={t('lang.label')} style={{ gap: 4, justifyContent: 'center' }}>
      {LANGUES.map((l) => (
        <button key={l.id} className="chip" aria-pressed={lang === l.id} lang={l.id} title={l.nom} onClick={() => setLang(l.id)}
          style={{ minHeight: 32, padding: '0 10px', fontSize: 13, fontFamily: l.id === 'ar' ? 'var(--font-arabic)' : undefined }}>
          {l.court}
        </button>
      ))}
    </div>
  );
}

/** Barre du bas sur téléphone, barre latérale sur ordinateur (voir app.css, @media min-width 900px). */
export function BottomNav() {
  const { compteur } = useCompteur();
  const { t } = useT();
  const items = [
    ['/', 'accueil', 'nav.home'], ['/releve', 'camera', 'nav.read'], ['/simulateur', 'simulateur', 'nav.sim', true],
    ['/kakeibo', 'kakeibo', 'nav.kakeibo'], ['/kizuna', 'kizuna', 'nav.kizuna'], ['/reclamation', 'reclamation', 'nav.claim', true],
  ];
  return (
    <nav className="bottom-nav" aria-label={t('nav.main')}>
      <div className="nav-brand">
        <img src="/assets/mieru-mark.svg" alt="" width="40" height="40" />
        <span><strong>Mieru</strong><small>見える · عدّاد</small></span>
      </div>
      {items.map(([to, ic, cle, extra]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `${isActive ? 'active' : ''}${extra ? ' nav-extra' : ''}`}>
          <Icon nom={ic} /><span>{t(cle)}</span>
        </NavLink>
      ))}
      <div className="nav-foot">
        <LangueCompacte />
        {compteur && <span className="small muted">{t('nav.meter')} · <b style={{ color: 'var(--sumi)' }}>{compteur.nom}</b></span>}
        <img src="/assets/aaddad-calme.svg" alt="" width="72" height="83" />
      </div>
    </nav>
  );
}

export function Hanko({ grand = false }) {
  const { t } = useT();
  return <span className={`hanko${grand ? ' lg' : ''}`} role="img" aria-label={t('hanko.aria')}>見</span>;
}

/** Avatars des membres reliés par le fil rouge (Kizuna). */
export function Avatars({ membres = [] }) {
  const { t } = useT();
  return (
    <span style={{ display: 'flex', alignItems: 'center' }} aria-label={t('members.aria', { n: membres.length })}>
      {membres.slice(0, 4).map((m, i) => (
        <span key={m.id} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && <span style={{ width: 8, height: 2, background: 'var(--vermillon)' }} />}
          <span style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--ai-soft)', color: 'var(--ai)', border: '2px solid var(--vermillon)', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 13 }}>
            {m.prenom.slice(0, 1).toUpperCase()}
          </span>
        </span>
      ))}
    </span>
  );
}

export function Toast() {
  const { toast } = useCompteur();
  return toast ? <div className="toast" role="status">{toast}</div> : null;
}

/** Image de la mascotte selon l'humeur. */
export const Aaddad = ({ humeur = 'calme', taille = 56, alt = '' }) => (
  <img src={`/assets/aaddad-${humeur}.svg`} alt={alt} width={taille} height={Math.round(taille * 300 / 260)} style={{ flex: 'none' }} />
);
