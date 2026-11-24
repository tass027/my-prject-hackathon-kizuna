// Graphiques du tableau de bord STEG (SVG, sans bibliothèque). Les axes restent de gauche à droite dans toutes les langues.
import { useT } from '../i18n/index.jsx';
import { VILLES, nomVille } from '../lib/meteo.js';

const T11 = { font: '600 11px var(--font-sans)', fill: 'var(--sumi-muted)' };
const T12 = { font: '600 12px var(--font-sans)', fill: 'var(--sumi)' };
const svgProps = (w, h, label) => ({ viewBox: `0 0 ${w} ${h}`, width: '100%', role: 'img', 'aria-label': label, style: { direction: 'ltr', display: 'block' } });

/** Consommation moyenne par gouvernorat (barres horizontales), seuil en vermillon, zones trop petites masquées. */
export function BarresZones({ zones, seuil }) {
  const { t, lang, nombre } = useT();
  const W = 520, L = 120, R = 56, H = 26 * zones.length + 34;
  const max = Math.max(seuil * 1.1, ...zones.map((z) => z.moyenne || 0));
  const X = (v) => L + (v / max) * (W - L - R);
  const nom = (id) => nomVille(VILLES.find((v) => v.id === id) || { nom: id, nomAr: id }, lang);
  return (
    <svg {...svgProps(W, H, t('steg.zonesAria'))}>
      {zones.map((z, i) => {
        const y = 10 + i * 26;
        return (
          <g key={z.ville}>
            <text x={L - 8} y={y + 13} textAnchor="end" style={T12}>{nom(z.ville)}</text>
            {z.masque
              ? <text x={L} y={y + 13} style={{ ...T11, fontStyle: 'italic' }}>{t('steg.masked', { k: 5 })}</text>
              : <>
                <rect x={L} y={y} width={X(z.moyenne) - L} height="18" rx="4" fill={z.moyenne > seuil ? 'var(--vermillon)' : 'var(--ai)'} opacity={z.moyenne > seuil * 0.9 ? 1 : 0.75} />
                <text x={X(z.moyenne) + 6} y={y + 13} style={T11}>{nombre(z.moyenne, 0)} · n={z.n}</text>
              </>}
          </g>
        );
      })}
      <path d={`M${X(seuil)} 4V${H - 22}`} stroke="var(--vermillon)" strokeWidth="2" strokeDasharray="5 4" />
      <text x={X(seuil)} y={H - 8} textAnchor="middle" style={{ ...T11, fill: 'var(--shu)' }}>⛩ {seuil} kWh</text>
    </svg>
  );
}

/** Répartition des foyers par tranche de consommation : le « mur » des 200 kWh se voit. */
export function Tranches({ tranches, seuil }) {
  const { t } = useT();
  const W = 520, H = 220, B = 34, G = 36;
  const max = Math.max(...tranches.map((x) => x.n), 1);
  const lw = (W - G - 10) / tranches.length;
  const Y = (v) => H - B - (v / max) * (H - B - 20);
  const etiquette = (x) => (x.a === Infinity ? `${x.de}+` : `${x.de}–${x.a}`);
  return (
    <svg {...svgProps(W, H, t('steg.tranchesAria'))}>
      {tranches.map((x, i) => {
        const xx = G + i * lw + 6;
        const auDela = x.de >= seuil;
        return (
          <g key={x.de}>
            <rect x={xx} y={Y(x.n)} width={lw - 12} height={H - B - Y(x.n)} rx="4" fill={auDela ? 'var(--vermillon)' : x.a === seuil ? 'var(--kincha)' : 'var(--ai)'} opacity={auDela || x.a === seuil ? 1 : 0.75} />
            <text x={xx + (lw - 12) / 2} y={Y(x.n) - 6} textAnchor="middle" style={T12}>{x.n}</text>
            <text x={xx + (lw - 12) / 2} y={H - B + 16} textAnchor="middle" style={T11}>{etiquette(x)}</text>
          </g>
        );
      })}
      <text x={G} y={H - 2} style={T11}>{t('steg.kwhMonth')}</text>
      <path d={`M${G + 3 * lw} 14V${H - B}`} stroke="var(--vermillon)" strokeWidth="2" strokeDasharray="5 4" />
      <text x={G + 3 * lw + 4} y={14} style={{ ...T11, fill: 'var(--shu)' }}>⛩ {seuil} kWh</text>
    </svg>
  );
}

/** Évolution de la consommation moyenne par foyer sur 6 mois. */
export function Evolution({ evolution, seuil }) {
  const { t, locale, nombre } = useT();
  const W = 520, H = 220, G = 40, D = 16, B = 30, HAUT = 18;
  const max = Math.ceil(Math.max(seuil * 1.15, ...evolution.map((e) => e.moyenne)) / 50) * 50;
  const X = (i) => G + (i / Math.max(1, evolution.length - 1)) * (W - G - D);
  const Y = (v) => HAUT + (1 - v / max) * (H - HAUT - B);
  const mois = (cle) => new Date(`${cle}-15T12:00:00`).toLocaleDateString(locale, { month: 'short' });
  const ligne = evolution.map((e, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(e.moyenne)}`).join('');
  return (
    <svg {...svgProps(W, H, t('steg.evolutionAria'))}>
      {[0, 100, 200].filter((v) => v <= max).map((v) => <g key={v}><path d={`M${G} ${Y(v)}H${W - D}`} stroke="var(--line)" /><text x={G - 6} y={Y(v) + 4} textAnchor="end" style={T11}>{v}</text></g>)}
      <path d={`M${G} ${Y(seuil)}H${W - D}`} stroke="var(--vermillon)" strokeWidth="2" strokeDasharray="5 4" />
      <path d={`${ligne}L${X(evolution.length - 1)} ${Y(0)}L${X(0)} ${Y(0)}Z`} fill="var(--ai)" opacity=".1" />
      <path d={ligne} stroke="var(--ai)" strokeWidth="2.5" fill="none" />
      {evolution.map((e, i) => (
        <g key={e.cle}>
          <circle cx={X(i)} cy={Y(e.moyenne)} r="4" fill="var(--washi-raised)" stroke="var(--ai)" strokeWidth="2" />
          <text x={X(i)} y={Y(e.moyenne) - 9} textAnchor="middle" style={T12}>{nombre(e.moyenne, 0)}</text>
          <text x={X(i)} y={H - 10} textAnchor="middle" style={T11}>{mois(e.cle)}</text>
        </g>
      ))}
    </svg>
  );
}

/** Chaleur et consommation : chaque point est un jour d'été, avec la tendance. */
export function Chaleur({ points, pente }) {
  const { t } = useT();
  const W = 520, H = 220, G = 40, D = 16, B = 34, HAUT = 14;
  const [tmin, tmaxi] = [28, 47];
  const ymax = Math.ceil(Math.max(...points.map((p) => p.kwhJour)) + 1);
  const X = (v) => G + ((v - tmin) / (tmaxi - tmin)) * (W - G - D);
  const Y = (v) => HAUT + (1 - v / ymax) * (H - HAUT - B);
  return (
    <svg {...svgProps(W, H, t('steg.heatAria', { a: pente.a }))}>
      {[0, 4, 8, 12].filter((v) => v <= ymax).map((v) => <g key={v}><path d={`M${G} ${Y(v)}H${W - D}`} stroke="var(--line)" /><text x={G - 6} y={Y(v) + 4} textAnchor="end" style={T11}>{v}</text></g>)}
      {[30, 35, 40, 45].map((v) => <text key={v} x={X(v)} y={H - 16} textAnchor="middle" style={T11}>{v} °C</text>)}
      <rect x={X(40)} y={HAUT} width={X(tmaxi) - X(40)} height={H - HAUT - B} fill="var(--shu-soft)" />
      <text x={X(43.5)} y={HAUT + 14} textAnchor="middle" style={{ ...T11, fill: 'var(--shu)' }}>{t('heat.canicule')}</text>
      {points.map((p, i) => <circle key={i} cx={X(p.tmax)} cy={Y(p.kwhJour)} r="4" fill="var(--ai)" opacity=".55" />)}
      <path d={`M${X(tmin)} ${Y(pente.a * tmin + pente.b)}L${X(tmaxi)} ${Y(pente.a * tmaxi + pente.b)}`} stroke="var(--vermillon)" strokeWidth="2.5" />
      <text x={G} y={H - 2} style={T11}>{t('steg.heatAxis')}</text>
    </svg>
  );
}
