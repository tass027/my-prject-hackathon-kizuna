import { useEffect, useRef, useState } from 'react';
import { parler, VOIX } from '../lib/voix.js';
import { demanderAaddad } from '../lib/db.js';
import { useT } from '../i18n/index.jsx';
import { useCompteur } from '../lib/store.jsx';
import { Aaddad } from './Chrome.jsx';
import Icon from './Icon.jsx';

const LANGUES_RECONNAISSANCE = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-TN' };

export default function AssistantAaddad() {
  const { t, lang, dir } = useT();
  const { modeCloud } = useCompteur();
  const [ouvert, setOuvert] = useState(false);
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState('');
  const [chargement, setChargement] = useState(false);
  const [ecoute, setEcoute] = useState(false);
  const [erreur, setErreur] = useState('');
  const finMessages = useRef(null);
  const reconnaissance = useRef(null);

  useEffect(() => {
    finMessages.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, chargement, ouvert]);

  useEffect(() => () => {
    reconnaissance.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (!ouvert) return undefined;
    const fermerAvecEchap = (event) => {
      if (event.key === 'Escape') setOuvert(false);
    };
    window.addEventListener('keydown', fermerAvecEchap);
    return () => window.removeEventListener('keydown', fermerAvecEchap);
  }, [ouvert]);

  async function envoyer(event) {
    event.preventDefault();
    const contenu = texte.trim();
    if (!contenu || chargement) return;

    const conversation = [...messages, { role: 'user', content: contenu }];
    setMessages(conversation);
    setTexte('');
    setErreur('');
    setChargement(true);
    try {
      const reponse = await demanderAaddad(conversation.slice(-8), lang);
      setMessages((precedents) => [...precedents, { role: 'assistant', content: reponse }]);
    } catch (e) {
      setErreur(e.message || t('ai.error'));
    } finally {
      setChargement(false);
    }
  }

  function dicter() {
    const Constructeur = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Constructeur) {
      setErreur(t('ai.voiceUnavailable'));
      return;
    }
    if (reconnaissance.current) {
      reconnaissance.current.stop();
      reconnaissance.current = null;
      setEcoute(false);
      return;
    }

    const instance = new Constructeur();
    instance.lang = LANGUES_RECONNAISSANCE[lang];
    instance.interimResults = true;
    instance.onresult = (event) => {
      const resultat = Array.from(event.results).map((partie) => partie[0].transcript).join('');
      setTexte(resultat);
    };
    instance.onerror = () => {
      setErreur(t('ai.voiceError'));
      setEcoute(false);
      reconnaissance.current = null;
    };
    instance.onend = () => {
      setEcoute(false);
      reconnaissance.current = null;
    };
    reconnaissance.current = instance;
    setErreur('');
    setEcoute(true);
    try {
      instance.start();
    } catch {
      reconnaissance.current = null;
      setEcoute(false);
      setErreur(t('ai.voiceError'));
    }
  }

  function lire(message) {
    if (!parler(message, VOIX[lang])) setErreur(t('ai.voiceUnavailable'));
  }

  return (
    <>
      <button
        className="assistant-launcher"
        type="button"
        aria-label={t('ai.open')}
        aria-expanded={ouvert}
        aria-controls="aaddad-assistant"
        onClick={() => setOuvert((valeur) => !valeur)}
      >
        <Aaddad humeur={ouvert ? 'joie' : 'calme'} taille={48} />
      </button>
      {ouvert && (
        <section id="aaddad-assistant" className="assistant-panel" aria-label={t('ai.title')} dir={dir}>
          <header className="assistant-header">
            <Aaddad humeur="joie" taille={44} />
            <div className="assistant-heading">
              <h2>{t('ai.title')}</h2>
              <p>{t('ai.privacy')}</p>
            </div>
            <button className="assistant-close" type="button" aria-label={t('ai.close')} onClick={() => setOuvert(false)}>×</button>
          </header>
          <div className="assistant-messages" aria-live="polite">
            <div className="assistant-message assistant-reply">
              <p>{t('ai.greeting')}</p>
              <button type="button" className="assistant-speak" aria-label={t('ai.readAloud')} onClick={() => lire(t('ai.greeting'))}>
                <Icon nom="son" taille={18} />
              </button>
            </div>
            {messages.map((message, index) => (
              <div key={`${index}-${message.role}`} className={`assistant-message${message.role === 'user' ? ' assistant-user' : ' assistant-reply'}`}>
                <p>{message.content}</p>
                {message.role === 'assistant' && (
                  <button type="button" className="assistant-speak" aria-label={t('ai.readAloud')} onClick={() => lire(message.content)}>
                    <Icon nom="son" taille={18} />
                  </button>
                )}
              </div>
            ))}
            {chargement && <p className="assistant-thinking" role="status">{t('ai.loading')}</p>}
            <div ref={finMessages} />
          </div>
          {!modeCloud && <p className="assistant-setup" role="status">{t('ai.setup')}</p>}
          {erreur && <p className="assistant-error" role="alert">{erreur}</p>}
          {modeCloud && (
            <form className="assistant-form" onSubmit={envoyer}>
              <textarea
                className="input assistant-input"
                value={texte}
                onChange={(event) => setTexte(event.target.value)}
                placeholder={t('ai.placeholder')}
                aria-label={t('ai.placeholder')}
                rows={2}
                maxLength={2000}
                disabled={chargement}
              />
              <div className="assistant-actions">
                <button className={`assistant-icon-button${ecoute ? ' listening' : ''}`} type="button" aria-label={ecoute ? t('ai.stopListening') : t('ai.listen')} onClick={dicter} disabled={chargement}>
                  <Icon nom="micro" taille={20} />
                </button>
                <button className="btn btn-primary assistant-send" type="submit" disabled={chargement || !texte.trim()}>{t('ai.send')}</button>
              </div>
            </form>
          )}
        </section>
      )}
    </>
  );
}
