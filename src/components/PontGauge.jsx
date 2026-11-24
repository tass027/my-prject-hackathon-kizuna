// La jauge « Pont Kizuna » : Aaddad traverse un pont japonais, de la porte de Sidi Bou Saïd (début du mois)
// jusqu'au torii (le seuil). En arabe, le pont est inversé : la porte à droite, le torii à gauche.
import { useT } from '../i18n/index.jsx';

const CX = 160, CY = 178, R = 118;
const pt = (t, r = R) => { const a = Math.PI * (1 - t); return [CX + r * Math.cos(a), CY - r * Math.sin(a)]; };
const f1 = (n) => n.toFixed(1);
const COULEUR = { ok: 'var(--matcha)', warn: 'var(--kincha)', over: 'var(--shu)' };

export default function PontGauge({ conso, seuil, projection, niveau, taille = 300 }) {
  const { t, dir, nombre } = useT();
  const f = Math.min(conso / seuil, 1);
  const fp = projection ? Math.min(projection / seuil, 1) : null;
  const reste = Math.round(seuil - conso);
  const [a0, a1] = [pt(0), pt(1)];
  const pe = pt(Math.max(f, 0.01));
  const m = pt(Math.min(Math.max(f, 0.04), 0.97));
  const p0 = pt(0, R + 26), p1 = pt(1, R + 26);
  const posts = Array.from({ length: 11 }, (_, i) => { const k = (i + 1) / 12; return [pt(k, R + 12), pt(k, R + 26)]; });
  const label = t('gauge.aria', { conso: nombre(conso, 0), seuil, level: t(`level.${niveau}`) });

  return (
    <svg width={taille} height={taille * 210 / 320} viewBox="0 0 320 210" role="img" aria-label={label} style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}>
      <g transform={dir === 'rtl' ? 'translate(320 0) scale(-1 1)' : undefined}>
        <path d={`M14 ${CY + 8}H306`} stroke="var(--ai-300)" strokeWidth="2" strokeDasharray="6 6" />
        {posts.map(([a, b], i) => <path key={i} d={`M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`} stroke="var(--sumi)" strokeWidth="2" strokeLinecap="round" opacity=".55" />)}
        <path d={`M${f1(p0[0])} ${f1(p0[1])}A${R + 26} ${R + 26} 0 0 1 ${f1(p1[0])} ${f1(p1[1])}`} fill="none" stroke="var(--sumi)" strokeWidth="2" opacity=".55" />
        <path d={`M${f1(a0[0])} ${f1(a0[1])}A${R} ${R} 0 0 1 ${f1(a1[0])} ${f1(a1[1])}`} fill="none" stroke="var(--ai-300)" strokeWidth="18" strokeLinecap="round" opacity=".55" />
        {fp && fp > f && (() => { const q = pt(fp); return <path d={`M${f1(pe[0])} ${f1(pe[1])}A${R} ${R} 0 0 1 ${f1(q[0])} ${f1(q[1])}`} fill="none" stroke={COULEUR[niveau]} strokeWidth="8" strokeLinecap="round" strokeDasharray="2 9" />; })()}
        <path d={`M${f1(a0[0])} ${f1(a0[1])}A${R} ${R} 0 0 1 ${f1(pe[0])} ${f1(pe[1])}`} fill="none" stroke={COULEUR[niveau]} strokeWidth="18" strokeLinecap="round" />
        {/* Départ : porte de Sidi Bou Saïd */}
        <g transform={`translate(${f1(a0[0] - 14)} ${f1(a0[1] - 6)})`}>
          <path d="M2 30V12a12 12 0 0 1 24 0V30Z" fill="var(--ai)" stroke="var(--sumi)" strokeWidth="2" />
          <circle cx="9" cy="17" r="1.4" fill="var(--washi-raised)" /><circle cx="19" cy="17" r="1.4" fill="var(--washi-raised)" /><circle cx="14" cy="23" r="1.4" fill="var(--washi-raised)" />
        </g>
        {/* Arrivée : torii = le seuil */}
        <g transform={`translate(${f1(a1[0] - 17)} ${f1(a1[1] - 30)})`}>
          <rect x="7" y="8" width="4" height="30" fill="var(--vermillon)" /><rect x="23" y="8" width="4" height="30" fill="var(--vermillon)" />
          <path d="M0 4Q17 0 34 4V9Q17 5 0 9Z" fill="var(--vermillon)" stroke="var(--sumi)" strokeWidth="1.5" />
          <rect x="4" y="13" width="26" height="3.5" fill="var(--vermillon)" />
        </g>
        {/* Aaddad, mini */}
        <g transform={`translate(${f1(m[0])} ${f1(m[1])})`}>
          <rect x="-6" y="-21" width="2.5" height="7" fill="var(--vermillon)" /><rect x="3.5" y="-21" width="2.5" height="7" fill="var(--vermillon)" />
          <path d="M-10 -21Q0 -24 10 -21V-18Q0 -21 -10 -18Z" fill="var(--vermillon)" />
          <rect x="-12" y="-15" width="24" height="28" rx="6" fill="var(--washi-raised)" stroke="var(--sumi)" strokeWidth="2.5" />
          <rect x="-8" y="-11" width="16" height="7" rx="2" fill="var(--sumi)" /><rect x="3" y="-10" width="4" height="5" fill="var(--vermillon)" />
          <circle cx="-4" cy="2" r="1.8" fill="var(--sumi)" /><circle cx="4" cy="2" r="1.8" fill="var(--sumi)" />
          <path d="M-2.5 6q2.5 2.5 5 0" stroke="var(--sumi)" strokeWidth="1.5" fill="none" />
        </g>
      </g>
      <text x="160" y="146" textAnchor="middle" style={{ font: '800 48px/1 var(--font-display)', fill: 'var(--sumi)' }}>{reste >= 0 ? reste : `+${-reste}`}</text>
      <text x="160" y="168" textAnchor="middle" style={{ font: '600 11px/1 var(--font-sans)', letterSpacing: dir === 'rtl' ? 0 : '0.6px', fill: 'var(--sumi-muted)' }}>{t(reste >= 0 ? 'gauge.before' : 'gauge.after')}</text>
    </svg>
  );
}
