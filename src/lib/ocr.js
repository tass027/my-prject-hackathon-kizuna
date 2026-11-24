// Mieru — lecture de l'index par OCR (Membre 3).
// Tesseract.js tourne dans le navigateur. La première lecture télécharge le modèle (~2 Mo) : prévoir internet.
// L'OCR ne valide jamais seul : l'écran de vérification affiche toujours la valeur, modifiable.
import { createWorker } from 'tesseract.js';

let workerPromesse = null;
function worker() {
  if (!workerPromesse) {
    workerPromesse = (async () => {
      const w = await createWorker('eng');
      await w.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '7' }); // 7 = une seule ligne
      return w;
    })();
  }
  return workerPromesse;
}

/**
 * Recadre la bande centrale de l'image (là où est le cadre-guide), la passe en niveaux de gris,
 * augmente le contraste et l'agrandit. Le cadre de l'écran Relevé couvre 80 % de la largeur
 * et la bande verticale 38 %–64 % de la hauteur : garder ces valeurs synchronisées avec app.css (.camera .frame).
 */
export async function preparerImage(source, cadre = { x: 0.1, y: 0.38, w: 0.8, h: 0.26 }) {
  const img = await chargerImage(source);
  const sx = img.naturalWidth * cadre.x, sy = img.naturalHeight * cadre.y;
  const sw = img.naturalWidth * cadre.w, sh = img.naturalHeight * cadre.h;
  const echelle = Math.min(3, 1200 / sw);
  const c = document.createElement('canvas');
  c.width = Math.round(sw * echelle); c.height = Math.round(sh * echelle);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const px = ctx.getImageData(0, 0, c.width, c.height);
  const d = px.data;
  let somme = 0;
  for (let i = 0; i < d.length; i += 4) { const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = g; somme += g; }
  const moyenne = somme / (d.length / 4);
  for (let i = 0; i < d.length; i += 4) { const v = d[i] > moyenne ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; }
  ctx.putImageData(px, 0, 0);
  return c;
}

function chargerImage(source) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = ko;
    img.src = source instanceof Blob ? URL.createObjectURL(source) : source;
  });
}

export function choisirLecture(essais) {
  const bons = essais
    .filter((e) => /^\d{4,6}$/.test(e.texte))
    .sort((a, b) => b.confiance - a.confiance);
  const meilleur = bons[0];
  return meilleur
    ? { valeur: Number(meilleur.texte), texte: meilleur.texte, confiance: meilleur.confiance }
    : { valeur: null, texte: '', confiance: 0 };
}

/** Lit l'index sur la photo. Renvoie { valeur: 4821 | null, texte: '04821', confiance: 0–100 }. */
export async function lireIndex(imageBlob) {
  const w = await worker();
  const essais = [];
  for (const image of [await preparerImage(imageBlob), imageBlob]) {
    const { data } = await w.recognize(image);
    const chiffres = (data.text || '').replace(/\D/g, '');
    essais.push({ texte: chiffres, confiance: Math.round(data.confidence || 0) });
  }
  return choisirLecture(essais);
}
