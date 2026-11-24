// Mieru — preuves d'une photo de compteur (Membre 3) : date de prise de vue (EXIF), empreinte SHA-256, compression.
import exifr from 'exifr';

/** Empreinte SHA-256 hexadécimale d'un Blob. */
export async function sha256(blob) {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Réduit la photo à 1600 px de large en JPEG (envoi rapide, même en 3G). */
export async function compresser(file, largeurMax = 1600, qualite = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const r = Math.min(1, largeurMax / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', qualite));
  } finally { URL.revokeObjectURL(url); }
}

/**
 * Prépare une photo : { blob, sha256, prisLe }.
 * prisLe = date EXIF de l'appareil photo si elle existe, sinon l'heure actuelle du téléphone.
 * L'empreinte est calculée sur le fichier envoyé : si la photo est modifiée ensuite, l'empreinte ne correspond plus.
 */
export async function preparerPhoto(file) {
  let prisLe = null;
  try {
    const exif = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']);
    const d = exif?.DateTimeOriginal || exif?.CreateDate;
    if (d instanceof Date && !Number.isNaN(d.getTime())) prisLe = d.toISOString();
  } catch { /* pas d'EXIF : capture depuis la caméra du navigateur */ }
  const blob = file.type === 'image/jpeg' && file.size < 900000 ? file : await compresser(file);
  return { blob, sha256: await sha256(blob), prisLe: prisLe || new Date().toISOString() };
}

export const empreinteCourte = (h) => (h ? `${h.slice(0, 4)}…${h.slice(-4)}` : '—');
