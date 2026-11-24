// Langues : français (par défaut) et arabe / derja, avec passage de droite à gauche.
// Pour traduire un nouveau texte : ajoute la même clé dans `fr` et dans `ar`, puis utilise t('cle') dans la page.
import { useEffect, useState } from 'react';

const TEXTES = {
  fr: {
    bonjour: 'Bonjour',
    bonsoir: 'Bonsoir',
    joursRestants: (n) => `${n} jours restants`,
    reste: (n) => `Il te reste ${n} kWh`,
    auDela: (n) => `${n} kWh au-delà du seuil`,
    ecouter: 'Écouter Aaddad',
    sousSeuil: 'Sous le seuil',
    attention: 'Attention',
    depasse: 'Seuil dépassé',
    cotePont: 'De ce côté du pont',
    finMois: (n) => `Au rythme actuel, tu finis le mois vers ${n} kWh.`,
    combienClim: 'Combien de clim je peux utiliser ?',
    toriiApproche: 'Le torii approche',
    passeSeuilDans: (n) => `Au rythme actuel, tu passes le seuil dans ${n} jour${n > 1 ? 's' : ''}`,
    toutPres: 'Tu es tout près du seuil',
    surcout: (n) => ` : environ ${n} TND de plus.`,
    eviter: "Voir comment l'éviter →",
    depasseTexte: 'Ce mois-ci, toute ta consommation passe au tarif supérieur. Le mois prochain, on prépare la traversée ensemble avec ton bilan Kakeibo.',
    chaleur: (n) => `Chaleur annoncée : ${n} °C`,
    chaleurTexte: (jour) => `${jour}, la clim va beaucoup tourner. Mets-la à 26 °C et ferme les volets en journée.`,
    attend: "Aaddad t'attend",
    attendTexte: "ton dernier relevé date de plus d'une semaine.",
    meteoReseau: 'Météo du réseau',
    meteoTexte: "heure de pointe jusqu'à 22 h : si tu peux, lance la machine demain matin.",
    relever: 'Relever mon compteur',
    dernierReleve: 'Dernier relevé',
    ceMois: 'Ce mois-ci',
    legendeCourbe: "Trait plein : tes relevés. Pointillés : la projection jusqu'à la fin du mois.",
    premierReleve: ' · fais ton premier relevé du mois',
  },
  ar: {
    bonjour: 'صباح الخير',
    bonsoir: 'مساء الخير',
    joursRestants: (n) => `باقي ${n} أيام`,
    reste: (n) => `باقيلك ${n} كيلوواط`,
    auDela: (n) => `فتّ الحد بـ ${n} كيلوواط`,
    ecouter: 'اسمع عدّاد',
    sousSeuil: 'تحت الحد',
    attention: 'رد بالك',
    depasse: 'فتّ الحد',
    cotePont: 'مازلت من هالجيهة متاع الجسر',
    finMois: (n) => `كان تكمّل هكا، توصل لـ ${n} كيلوواط في آخر الشهر.`,
    combienClim: 'قدّاش نجم نشعل الكليماتيزور؟',
    toriiApproche: 'الحد قرّب',
    passeSeuilDans: (n) => `كان تكمّل هكا، تفوت الحد بعد ${n} أيام`,
    toutPres: 'راك قريب برشا من الحد',
    surcout: (n) => ` : تقريب ${n} دينار زايدين.`,
    eviter: 'كيفاش نتجنّبها ←',
    depasseTexte: 'هالشهر، الاستهلاك الكل يتحسب بالتعريفة الأعلى. الشهر الجاي نحضّرو مع بعضنا بالكاكيبو.',
    chaleur: (n) => `سخانة متوقعة : ${n} درجة`,
    chaleurTexte: (jour) => `${jour}، الكليماتيزور باش يخدم برشا. حطّو على 26 درجة وسكّر الشبابك في النهار.`,
    attend: 'عدّاد يستنّى فيك',
    attendTexte: 'آخر تصويرة للعدّاد عندها أكثر من جمعة.',
    meteoReseau: 'حالة الشبكة',
    meteoTexte: 'وقت الذروة حتى العشرة متاع الليل : كان تنجم، شعّل الماكينة غدوة الصباح.',
    relever: 'صوّر العدّاد',
    dernierReleve: 'آخر تصويرة',
    ceMois: 'هالشهر',
    legendeCourbe: 'الخط : تصاور العدّاد. النقاط : التوقع حتى آخر الشهر.',
    premierReleve: ' · صوّر العدّاد لأول مرة هالشهر',
  },
};

export const langueActuelle = () => { try { return localStorage.getItem('mieru:langue') || 'fr'; } catch { return 'fr'; } };

// La page garde le sens gauche → droite : seuls les écrans traduits passent en droite → gauche,
// avec dir={dir} sur leur <main> (voir useT). Les écrans pas encore traduits restent lisibles en français.
export function appliquerLangue(l = langueActuelle()) {
  document.documentElement.lang = l;
}

export function choisirLangue(l) {
  try { localStorage.setItem('mieru:langue', l); } catch { /* stockage indisponible */ }
  appliquerLangue(l);
  window.dispatchEvent(new Event('mieru:langue'));
}

/** const { t, langue } = useT();  puis  t('reste', 32) */
export function useT() {
  const [l, setL] = useState(langueActuelle());
  useEffect(() => {
    const f = () => setL(langueActuelle());
    window.addEventListener('mieru:langue', f);
    return () => window.removeEventListener('mieru:langue', f);
  }, []);
  const t = (cle, ...args) => {
    const v = TEXTES[l]?.[cle] ?? TEXTES.fr[cle] ?? cle;
    return typeof v === 'function' ? v(...args) : v;
  };
  return { t, langue: l, locale: l === 'ar' ? 'ar-TN' : 'fr-FR', dir: l === 'ar' ? 'rtl' : 'ltr' };
}
