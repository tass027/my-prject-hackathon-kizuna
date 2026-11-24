// Graphique du mois : consommation cumulée (trait plein), projection jusqu'à la fin du mois (pointillés),
// seuil (ligne vermillon, le torii). En arabe, l'axe du temps va de droite à gauche.
import { useT } from '../i18n/index.jsx';

const W = 340, H = 196, G = 34, D = 14, HAUT = 16, BAS = 30;
const COULEUR = { ok: 'var(--matcha)', warn: 'var(--kincha)', over: 'var(--shu)' };

export default function Graphique({ serie, niveau, moyenneJour }) {
  const { t, dir, nombre } = useT();
  const rtl = dir === 'rtl';
  const { points, projection, totalJours, seuil, aujourdhui } = serie;
  if (points.length < 2) return <p className="small muted">{t('chart.empty')}</p>;

  const yMax = Math.ceil(Math.max(seuil * 1.15, projection.kwh * 1.05, points[points.length - 1].kwh) / 50) * 50;
  const largeur = W - G - D;
  const X = (j) => { const x = (j / totalJours) * largeur; return rtl ? W - G - x : G + x; };
  const Y = (k) => HAUT + (1 - k / yMax) * (H - HAUT - BAS);
  const dernier = points[points.length - 1];
  const ligne = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.jour).toFixed(1)} ${Y(p.kwh).toFixed(1)}`).join('');
  const aire = `${ligne}L${X(dernier.jour).toFixed(1)} ${Y(0)}L${X(0).toFixed(1)} ${Y(0)}Z`;
  const graduationsY = Array.from({ length: Math.floor(yMax / 100) + 1 }, (_, i) => i * 100);
  const jalons = [1, 10, 20, totalJours];
  const texte = { font: '600 11px var(--font-sans)', fill: 'var(--sumi-muted)' };

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" direction="ltr" style={{ direction: 'ltr' }}
        aria-label={t('chart.aria', { conso: nombre(dernier.kwh, 0), jour: Math.max(1, Math.ceil(dernier.jour)), proj: nombre(projection.kwh, 0), seuil })}>
        {graduationsY.map((k) => (
          <g key={k}>
            <path d={`M${G} ${Y(k)}H${W - D}`} stroke="var(--line)" strokeWidth="1" />
            <text x={rtl ? W - G + 6 : G - 6} y={Y(k) + 4} textAnchor={rtl ? 'start' : 'end'} style={texte}>{k}</text>
          </g>
        ))}
        {jalons.map((j) => <text key={j} x={X(j - (j === 1 ? 1 : 0))} y={H - 10} textAnchor="middle" style={texte}>{j}</text>)}
        {/* Aujourd'hui */}
        <path d={`M${X(aujourdhui)} ${HAUT}V${Y(0)}`} stroke="var(--sumi-muted)" strokeWidth="1" strokeDasharray="2 4" />
        {/* Seuil = torii */}
        <path d={`M${G} ${Y(seuil)}H${W - D}`} stroke="var(--vermillon)" strokeWidth="2" strokeDasharray="6 4" />
        <text x={rtl ? W - D - 4 : G + 4} y={Y(seuil) - 6} textAnchor={rtl ? 'end' : 'start'} style={{ ...texte, fill: 'var(--shu)' }}>⛩ {t('chart.seuil', { n: seuil })}</text>
        {/* Consommé */}
        <path d={aire} fill="var(--ai)" opacity=".12" />
        <path d={`M${X(dernier.jour)} ${Y(dernier.kwh)}L${X(projection.jour)} ${Y(projection.kwh)}`} stroke={COULEUR[niveau]} strokeWidth="2.5" strokeDasharray="3 5" strokeLinecap="round" fill="none" />
        <path d={ligne} stroke="var(--ai)" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
        {points.slice(1).map((p, i) => <circle key={i} cx={X(p.jour)} cy={Y(p.kwh)} r="3" fill="var(--washi-raised)" stroke="var(--ai)" strokeWidth="2" />)}
        <circle cx={X(projection.jour)} cy={Y(projection.kwh)} r="4" fill={COULEUR[niveau]} />
      </svg>
      <figcaption className="row small muted" style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <span className="row" style={{ gap: 12 }}>
          <span className="row" style={{ gap: 6 }}><span style={{ width: 16, height: 3, background: 'var(--ai)', borderRadius: 2 }} />{t('chart.conso')}</span>
          <span className="row" style={{ gap: 6 }}><span style={{ width: 16, height: 0, borderTop: `3px dotted ${COULEUR[niveau]}` }} />{t('chart.proj')}</span>
        </span>
        <span>{t('chart.avg', { n: nombre(moyenneJour, 1) })}</span>
      </figcaption>
    </figure>
  );
}
