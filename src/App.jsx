import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CompteurProvider, useCompteur } from './lib/store.jsx';
import { LangueProvider, useT, ChoixLangue } from './i18n/index.jsx';
import { BottomNav, Toast, Aaddad } from './components/Chrome.jsx';
import AssistantAaddad from './components/AssistantAaddad.jsx';
import Bienvenue from './pages/Bienvenue.jsx';
import Accueil from './pages/Accueil.jsx';
import Releve from './pages/Releve.jsx';
import Simulateur from './pages/Simulateur.jsx';
import Kakeibo from './pages/Kakeibo.jsx';
import Kizuna from './pages/Kizuna.jsx';
import Reclamation from './pages/Reclamation.jsx';
import Steg from './pages/Steg.jsx';
import ConditionsSteg from './components/ConditionsSteg.jsx';

/** Tout premier écran : l'utilisateur choisit la langue de l'application. */
function PremiereLangue({ onContinuer }) {
  const { t, essayer } = useT();
  return (
    <div className="app no-nav langue-ecran">
      <div className="screen" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 56, gap: 20 }}>
        <img src="/assets/mieru-mark.svg" alt="Mieru" width="72" height="72" />
        <Aaddad humeur="calme" taille={120} />
        <h1 className="title">{t('lang.choose')}</h1>
        <p className="muted">Choisis ta langue · Choose your language · اختر لغتك</p>
        <ChoixLangue grand onChoisir={essayer} />
        <p className="small muted">{t('lang.chooseSub')}</p>
        <button className="btn btn-primary" style={{ maxWidth: 360 }} onClick={onContinuer}>{t('lang.continue')}</button>
      </div>
    </div>
  );
}

function Ecrans() {
  const { session, compteur, erreur, quitter } = useCompteur();
  const { t, langueChoisie, setLang, lang } = useT();
  const loc = useLocation();
  if (!langueChoisie) return <PremiereLangue onContinuer={() => setLang(lang)} />;
  if (loc.pathname === '/steg') return <Steg />; // espace STEG : accessible avec ou sans compteur
  if (!session) return <Routes><Route path="*" element={<Bienvenue />} /></Routes>;
  if (erreur) {
    return (
      <div className="screen" style={{ paddingTop: 48 }}>
        <h1 className="title">{t('common.loadError')}</h1>
        <p className="muted">{erreur}</p>
        <button className="btn" onClick={quitter}>{t('common.backHome')}</button>
      </div>
    );
  }
  if (!compteur) return <p className="screen muted" style={{ paddingTop: 48 }}>{t('common.loading')}</p>;
  const sansNav = loc.pathname === '/releve';
  return (
    <ConditionsSteg>
    <div className={`app${sansNav ? ' no-nav' : ''}`}>
      <Routes>
        <Route path="/" element={<Accueil />} />
        <Route path="/releve" element={<Releve />} />
        <Route path="/simulateur" element={<Simulateur />} />
        <Route path="/kakeibo" element={<Kakeibo />} />
        <Route path="/kizuna" element={<Kizuna />} />
        <Route path="/reclamation" element={<Reclamation />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />{/* masquée sur téléphone pendant le relevé (app.css), toujours visible sur ordinateur */}
      <AssistantAaddad />
    </div>
    </ConditionsSteg>
  );
}

export default function App() {
  return (
    <LangueProvider>
      <CompteurProvider>
        <HashRouter>
          <Ecrans />
          <Toast />
        </HashRouter>
      </CompteurProvider>
    </LangueProvider>
  );
}
