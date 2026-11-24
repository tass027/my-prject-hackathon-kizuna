// Mieru — Aaddad parle : lecture vocale des alertes (Web Speech API, intégrée au navigateur, sans bibliothèque).
export function parler(texte, langue = 'fr-FR', onTermine) {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const phrase = new SpeechSynthesisUtterance(texte);
  phrase.lang = langue;
  phrase.rate = 0.95;
  if (onTermine) {
    phrase.onend = onTermine;
    phrase.onerror = onTermine;
  }
  const voix = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(langue.slice(0, 2)));
  if (voix) phrase.voice = voix;
  window.speechSynthesis.speak(phrase);
  return true;
}

export function phraseEtat(e, langue = 'fr') {
  const reste = Math.round(e.resteKwh);
  if (langue === 'ar') {
    return reste >= 0
      ? `باقيلك ${reste} كيلوواط ساعة قبل الحد، و ${e.joursRestants} أيام في الشهر.`
      : `فتّ الحد بـ ${-reste} كيلوواط ساعة.`;
  }
  return reste >= 0
    ? `Il te reste ${reste} kilowattheures avant le seuil, pour ${e.joursRestants} jours.`
    : `Tu as dépassé le seuil de ${-reste} kilowattheures.`;
}

/** Parle dans la langue de l'interface. */
export const parlerEtat = (e, langue) => parler(phraseEtat(e, langue), langue === 'ar' ? 'ar-SA' : 'fr-FR');

/** Voix correspondant à la langue de l'interface. */
export const VOIX = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-SA' };
