// Mieru — langues : français, anglais, arabe (de droite à gauche).
// t('cle', { variable }) renvoie le texte de la langue choisie (repli sur le français).
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { heuresMinutes } from '../lib/calcul.js';
import fr from './fr.js';
import en from './en.js';
import ar from './ar.js';

export const LANGUES = [
  { id: 'fr', nom: 'Français', court: 'FR' },
  { id: 'en', nom: 'English', court: 'EN' },
  { id: 'ar', nom: 'العربية', court: 'ع' },
];
const DICTS = { fr, en, ar };
const LOCALES = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-TN-u-nu-latn' };
const CLE = 'mieru:langue';
const lire = () => { try { return localStorage.getItem(CLE); } catch { return null; } };

const Ctx = createContext(null);

export function LangueProvider({ children }) {
  const [choisie, setChoisie] = useState(() => (DICTS[lire()] ? lire() : null)); // langue validée
  const [apercu, setApercu] = useState(null); // langue essayée sur le premier écran, pas encore validée
  const lang = apercu || choisie || 'fr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const valeur = useMemo(() => {
    const dict = DICTS[lang];
    const locale = LOCALES[lang];
    const t = (cle, v = {}) => String(dict[cle] ?? fr[cle] ?? cle).replace(/\{(\w+)\}/g, (_, n) => (v[n] ?? ''));
    const nombre = (n, p = 1) => new Intl.NumberFormat(locale, { maximumFractionDigits: p }).format(n);
    return {
      lang, locale, t, nombre,
      langueChoisie: Boolean(choisie),
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      setLang: (l) => { try { localStorage.setItem(CLE, l); } catch { /* stockage indisponible */ } setChoisie(l); setApercu(null); },
      essayer: (l) => setApercu(l),
      date: (d, o) => new Date(d).toLocaleString(locale, o),
      mois: (d = new Date()) => new Date(d).toLocaleDateString(locale, { month: 'long' }),
      /** Durée lisible : 3,24 h → « 3 h 14 » ; lessives → « 2 lessives ». */
      duree: (v, unite = 'h') => {
        if (unite !== 'h') return t(v >= 2 ? 'unit.cycles' : 'unit.cycle', { n: nombre(v, 1) });
        const { h, m } = heuresMinutes(v);
        if (h === 0) return t('unit.min', { m });
        return m ? t('unit.hm', { h, m: String(m).padStart(2, '0') }) : t('unit.h', { h });
      },
    };
  }, [lang, choisie, apercu]);

  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

/** Sélecteur de langue (trois boutons). */
export function ChoixLangue({ grand = false, onChoisir = null }) {
  const { lang, setLang, t } = useT();
  const choisir = onChoisir || setLang;
  return (
    <div className="row" role="group" aria-label={t('lang.label')}>
      {LANGUES.map((l) => (
        <button key={l.id} className={`chip${grand ? ' chip-lg' : ''}`} aria-pressed={lang === l.id} lang={l.id} onClick={() => choisir(l.id)}
          style={l.id === 'ar' ? { fontFamily: 'var(--font-arabic)' } : undefined}>
          {l.nom}
        </button>
      ))}
    </div>
  );
}
