// Mieru — dossier de réclamation PDF (Membre 3).
// Rassemble les relevés photo datés et scellés pour contester une facture estimée à l'agence STEG.
// Polices standard de jsPDF (Latin-1) : pas de kanji ni d'arabe dans le PDF.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const AI = [29, 92, 158], SUMI = [28, 38, 56], MUTED = [91, 82, 66], SHU = [179, 52, 27];
const dateFr = (d) => new Date(d).toLocaleString('fr-TN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

async function enDataUrl(url) {
  if (!url) return null;
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  } catch { return null; }
}

function sceau(doc, x, y) {
  doc.setDrawColor(...SHU); doc.setLineWidth(0.8);
  doc.roundedRect(x, y, 16, 16, 2, 2);
  doc.setTextColor(...SHU); doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
  doc.text('SCELLE', x + 8, y + 7, { align: 'center' });
  doc.text('MIERU', x + 8, y + 11.5, { align: 'center' });
}

/**
 * @param {object} p
 * @param {object} p.compteur        { nom, code }
 * @param {Array}  p.releves         relevés triés, chacun avec { index, prisLe, recuLe, sha256, source, photoUrl, auteur }
 * @param {object} p.facture         { kwhFacture, montant, periode } saisis par l'utilisateur
 * @param {number} p.kwhReel         consommation calculée à partir des relevés sur la même période
 * @param {string} p.titulaire       prénom de la personne qui présente le dossier
 */
export async function genererReclamation({ compteur, releves, facture, kwhReel, titulaire }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 18, W = 210 - 2 * L;
  let y = 20;

  doc.setFillColor(...AI); doc.rect(0, 0, 210, 6, 'F');
  doc.setTextColor(...SUMI); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text('Dossier de relevés de compteur', L, (y += 6));
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...MUTED);
  doc.text(`Compteur : ${compteur.nom}   ·   Préparé par : ${titulaire}   ·   Le ${dateFr(new Date())}`, L, (y += 8));

  // Comparaison
  y += 10;
  doc.setTextColor(...SUMI); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('1. Comparaison avec la facture contestée', L, y);
  autoTable(doc, {
    startY: y + 4, margin: { left: L, right: L }, theme: 'grid',
    headStyles: { fillColor: AI, textColor: 255 }, styles: { fontSize: 10, textColor: SUMI },
    head: [['', 'Consommation (kWh)', 'Montant']],
    body: [
      [`Facture estimée (${facture.periode || 'période indiquée'})`, String(facture.kwhFacture ?? '—'), facture.montant ? `${facture.montant} TND` : '—'],
      ['Consommation réelle d\'après les relevés ci-dessous', String(kwhReel), ''],
      ['Écart', String((facture.kwhFacture ?? 0) - kwhReel), ''],
    ],
  });
  y = doc.lastAutoTable.finalY + 10;

  // Tableau des relevés
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('2. Relevés photographiés', L, y);
  autoTable(doc, {
    startY: y + 4, margin: { left: L, right: L }, theme: 'striped',
    headStyles: { fillColor: AI, textColor: 255 }, styles: { fontSize: 9, textColor: SUMI },
    head: [['Index (kWh)', 'Photo prise le', 'Reçue par le serveur le', 'Empreinte SHA-256', 'Par']],
    body: releves.map((r) => [String(r.index), r.prisLe ? dateFr(r.prisLe) : '—', r.recuLe ? dateFr(r.recuLe) : '—', r.sha256 ? `${r.sha256.slice(0, 16)}…` : 'sans photo', r.auteur || '']),
  });
  y = doc.lastAutoTable.finalY + 10;

  // Photos
  const avecPhoto = releves.filter((r) => r.photoUrl).slice(-6);
  if (avecPhoto.length) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...SUMI);
    doc.text('3. Photos scellées', L, y);
    y += 6;
    const larg = (W - 8) / 3, haut = larg * 0.75;
    for (let i = 0; i < avecPhoto.length; i++) {
      const r = avecPhoto[i];
      const col = i % 3, x = L + col * (larg + 4);
      if (col === 0 && i > 0) y += haut + 16;
      if (y + haut > 280) { doc.addPage(); y = 20; }
      const data = await enDataUrl(r.photoUrl);
      if (data) doc.addImage(data, 'JPEG', x, y, larg, haut, undefined, 'FAST');
      sceau(doc, x + larg - 18, y + haut - 18);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text(`${r.index} kWh · ${r.prisLe ? dateFr(r.prisLe) : ''}`, x, y + haut + 4);
      doc.text(`SHA-256 ${r.sha256 ? r.sha256.slice(0, 20) + '…' : '—'}`, x, y + haut + 8);
    }
    y += haut + 18;
  }

  // Lettre
  if (y > 220) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...SUMI);
  doc.text('4. Demande de rectification', L, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  const lettre = `Madame, Monsieur,\n\nJe conteste la facture estimée portant sur ${facture.periode || 'la période indiquée'}, qui retient ${facture.kwhFacture ?? '…'} kWh. D'après les relevés photographiés et datés joints à ce dossier, ma consommation réelle sur cette période est de ${kwhReel} kWh. Je vous prie de bien vouloir établir une nouvelle facture sur la base de ma consommation réelle.\n\nVeuillez agréer, Madame, Monsieur, mes salutations distinguées.\n\n${titulaire}`;
  doc.text(doc.splitTextToSize(lettre, W), L, y + 7);

  // Mention obligatoire
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text("Document d'aide préparé par l'utilisateur avec l'application Mieru. Il n'a pas valeur de preuve officielle. Les empreintes SHA-256 permettent de vérifier que les photos n'ont pas été modifiées.", L, 290, { maxWidth: W });
  }
  doc.save(`mieru-reclamation-${new Date().toISOString().slice(0, 10)}.pdf`);
}
