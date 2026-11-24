// Consommation cumulée du mois : trait plein = relevés, pointillés = projection, ligne rouge = seuil.
import { dateReleve } from '../lib/calcul.js';

export default function Courbe({ releves, etat }) {
  const maintenant = new Date();
  const debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  const nbJours = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0).getDate();
  const indexDebut = etat.indexActuel - etat.consoPeriode;

  const points = releves
    .filter((r) => new Date(dateReleve(r)) >= debut)
    .map((r) => ({ j: (new Date(dateReleve(r)) - debut) / 86400000, kwh: r.index - indexDebut }))
    .sort((a, b) => a.j - b.j);

  const W = 320, H = 170, P = 30;
  const maxY = Math.max(etat.seuil * 1.15, etat.projection, ...points.map((p) => p.kwh));
  const x = (j) => P + (j / nbJours) * (W - 2 * P);
  const y = (k) => H - P - (k / maxY) * (H - 2 * P);

  const ligne = [{ j: 0, kwh: 0 }, ...points]
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.j).toFixed(1)} ${y(p.kwh).toFixed(1)}`)
    .join('');
  const dernier = points[points.length - 1] || { j: 0, kwh: 0 };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: 'block', direction: 'ltr' }}
      aria-label={`Consommation du mois : ${etat.consoPeriode} kWh, projection ${etat.projection} kWh`}>
      <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="var(--line)" />
      <line x1={P} x2={W - P} y1={y(etat.seuil)} y2={y(etat.seuil)} stroke="var(--vermillon)" strokeDasharray="4 4" />
      <text x={W - P} y={y(etat.seuil) - 6} textAnchor="end" fontSize="11" fill="var(--shu)">Seuil {etat.seuil} kWh</text>
      <path d={ligne} fill="none" stroke="var(--ai)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <path d={`M${x(dernier.j).toFixed(1)} ${y(dernier.kwh).toFixed(1)}L${x(nbJours).toFixed(1)} ${y(etat.projection).toFixed(1)}`}
        stroke="var(--ai)" strokeWidth="2" strokeDasharray="3 5" fill="none" />
      <circle cx={x(dernier.j)} cy={y(dernier.kwh)} r="4.5" fill="var(--ai)" />
      <text x={P} y={H - 10} fontSize="11" fill="var(--sumi-muted)">1er</text>
      <text x={W - P} y={H - 10} textAnchor="end" fontSize="11" fill="var(--sumi-muted)">{nbJours}</text>
    </svg>
  );
}
