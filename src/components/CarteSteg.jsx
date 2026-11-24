// Carte du réseau pour la STEG : Tunisie → gouvernorats → secteurs → maisons.
// SVG sans bibliothèque ni tuiles en ligne : fonctionne hors connexion. Molette / pincement / boutons pour zoomer, glisser pour se déplacer.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/index.jsx';
import { VILLES, nomVille } from '../lib/meteo.js';

// Contour simplifié de la Tunisie [lon, lat] (approximatif, pour situer les secteurs).
const CONTOUR = [[8.73, 36.95], [9.05, 37.08], [9.33, 37.2], [9.68, 37.34], [9.87, 37.33], [10.05, 37.26], [10.22, 37.18], [10.18, 37.02], [10.3, 36.9], [10.31, 36.82], [10.3, 36.76], [10.4, 36.72], [10.55, 36.78], [10.8, 36.95], [11.05, 37.08], [11.12, 36.85], [10.86, 36.55], [10.73, 36.45], [10.58, 36.38], [10.53, 36.15], [10.5, 35.98], [10.6, 35.85], [10.8, 35.78], [11.03, 35.62], [11.06, 35.5], [11.13, 35.25], [10.95, 35.0], [10.8, 34.8], [10.73, 34.7], [10.45, 34.5], [10.1, 34.3], [10.05, 34.05], [10.1, 33.88], [10.4, 33.68], [10.75, 33.55], [11.0, 33.55], [11.12, 33.45], [11.2, 33.2], [11.53, 33.17], [11.2, 32.5], [10.85, 32.1], [10.3, 31.7], [10.1, 31.4], [9.7, 30.6], [9.55, 30.23], [9.25, 30.9], [9.1, 31.8], [9.06, 32.1], [8.35, 32.5], [7.8, 33.1], [7.52, 33.35], [7.73, 33.85], [7.85, 34.15], [8.25, 34.65], [8.3, 35.05], [8.42, 35.7], [8.3, 36.15], [8.42, 36.5], [8.6, 36.85]];
const DJERBA = [[10.75, 33.85], [10.95, 33.9], [11.07, 33.8], [11.02, 33.65], [10.75, 33.65], [10.72, 33.75]];
const KERKENNAH = [[11.0, 34.62], [11.15, 34.72], [11.3, 34.8], [11.26, 34.7], [11.08, 34.62]];

const ECH = 92, LON0 = 7.3, LAT0 = 37.6, COS = Math.cos((34 * Math.PI) / 180);
const proj = (lat, lon) => [(lon - LON0) * ECH * COS, (LAT0 - lat) * ECH];
const chemin = (pts) => `M${pts.map(([lon, lat]) => proj(lat, lon).join(' ')).join('L')}Z`;
const BASE = { w: 340, h: 690, cx: 170, cy: 345 };
const PX_PAR_KM = ECH / 111;

export const couleurCharge = (c) => (c >= 1 ? 'var(--vermillon)' : c >= 0.9 ? 'var(--kincha)' : 'var(--ai)');
const COULEUR_STATUT = { coupe: '#3a352c', limite: 'var(--kincha)', programme: 'var(--kincha)', alerte: 'var(--vermillon)' };
const SOLEIL = '#e0a100';

/**
 * @param secteurs   secteurs avec leur état (etatSecteur) : { id, nom, ville, lat, lon, n, kw, capaciteKw, charge, … }
 * @param foyers     maisons : { id, ref, lat, lon, secteur, pv, prioritaire, reel? }
 * @param statuts    { [id]: 'normal' | 'alerte' | 'programme' | 'limite' | 'coupe' }
 * @param alertes    Set des id en surconsommation
 * @param filtre     'tout' | 'alertes' | 'solaire' | 'actions'
 * @param selection  { type: 'ville' | 'secteur' | 'foyer', id }
 */
export default function CarteSteg({ secteurs, foyers, statuts, alertes, filtre = 'tout', selection, onSelect, hauteur = 560, focus }) {
  const { t, lang, nombre } = useT();
  const boite = useRef(null);
  const svg = useRef(null);
  const [W, setW] = useState(() => Math.min(640, (typeof window !== 'undefined' ? window.innerWidth : 640) - 56));
  const H = hauteur;
  const k0 = Math.min(W / BASE.w, H / BASE.h) * 0.95;
  const [vue, setVue] = useState(null); // { k, tx, ty }
  const v = vue || { k: k0, tx: W / 2 - BASE.cx * k0, ty: H / 2 - BASE.cy * k0 };
  const z = v.k / k0;
  const anim = useRef(0);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    if (boite.current) ro.observe(boite.current);
    return () => ro.disconnect();
  }, []);

  const versVue = useCallback((cible, duree = 350) => {
    cancelAnimationFrame(anim.current);
    const depart = { ...v }, t0 = performance.now();
    const pas = (tm) => {
      const p = Math.min(1, (tm - t0) / duree), e = 1 - (1 - p) ** 3;
      setVue({ k: depart.k + (cible.k - depart.k) * e, tx: depart.tx + (cible.tx - depart.tx) * e, ty: depart.ty + (cible.ty - depart.ty) * e });
      if (p < 1) anim.current = requestAnimationFrame(pas);
    };
    anim.current = requestAnimationFrame(pas);
  }, [v]);

  const zoomSur = useCallback((lat, lon, zCible) => {
    const [x, y] = proj(lat, lon), k = zCible * k0;
    versVue({ k, tx: W / 2 - x * k, ty: H / 2 - y * k });
  }, [k0, W, H, versVue]);

  const zoomPoint = useCallback((facteur, sx, sy) => {
    setVue((ancienne) => {
      const a = ancienne || v;
      const k = Math.min(260 * k0, Math.max(k0 * 0.8, a.k * facteur));
      const f = k / a.k;
      return { k, tx: sx - (sx - a.tx) * f, ty: sy - (sy - a.ty) * f };
    });
  }, [k0, v]);

  // Recentrage demandé par la page (ex. clic dans une liste).
  useEffect(() => { if (focus) zoomSur(focus.lat, focus.lon, focus.z); }, [focus?.cle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Molette (écouteur non passif pour bloquer le défilement de la page).
  useEffect(() => {
    const el = svg.current;
    if (!el) return undefined;
    const roue = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomPoint(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', roue, { passive: false });
    return () => el.removeEventListener('wheel', roue);
  }, [zoomPoint]);

  // Glisser et pincer.
  const pointeurs = useRef(new Map());
  const bouge = useRef(0);
  const surBas = (e) => { pointeurs.current.set(e.pointerId, [e.clientX, e.clientY]); bouge.current = 0; cancelAnimationFrame(anim.current); };
  const surDeplacement = (e) => {
    const p = pointeurs.current;
    if (!p.has(e.pointerId)) return;
    const [ax, ay] = p.get(e.pointerId);
    if (p.size === 1) {
      const dx = e.clientX - ax, dy = e.clientY - ay;
      bouge.current += Math.abs(dx) + Math.abs(dy);
      if (bouge.current > 6 && !svg.current.hasPointerCapture(e.pointerId)) svg.current.setPointerCapture(e.pointerId); // capture seulement en glissant : les clics restent sur les maisons
      setVue((a) => ({ ...(a || v), tx: (a || v).tx + dx, ty: (a || v).ty + dy }));
    } else if (p.size === 2) {
      const [autre] = [...p.entries()].filter(([id]) => id !== e.pointerId).map(([, pt]) => pt);
      const avant = Math.hypot(ax - autre[0], ay - autre[1]), apres = Math.hypot(e.clientX - autre[0], e.clientY - autre[1]);
      const r = svg.current.getBoundingClientRect();
      if (avant > 0) zoomPoint(apres / avant, (e.clientX + autre[0]) / 2 - r.left, (e.clientY + autre[1]) / 2 - r.top);
      bouge.current += 10;
    }
    p.set(e.pointerId, [e.clientX, e.clientY]);
  };
  const surHaut = (e) => { pointeurs.current.delete(e.pointerId); };
  const clic = (fn) => (e) => { if (bouge.current > 6) return; e.stopPropagation(); fn(); };

  const ecran = (lat, lon) => { const [x, y] = proj(lat, lon); return [x * v.k + v.tx, y * v.k + v.ty]; };
  const visible = ([x, y], m = 40) => x > -m && y > -m && x < W + m && y < H + m;

  // Gouvernorats (agrégés depuis les secteurs).
  const villes = useMemo(() => {
    const g = {};
    for (const s of secteurs) {
      const e = (g[s.ville] ||= { id: s.ville, n: 0, kw: 0, cap: 0, nAlerte: 0, nCoupe: 0, nLimite: 0 });
      e.n += s.n; e.kw += s.kw; e.cap += s.capaciteKw; e.nAlerte += s.nAlerte; e.nCoupe += s.nCoupe; e.nLimite += s.nLimite;
    }
    return Object.values(g).map((e) => {
      const vi = VILLES.find((x) => x.id === e.id);
      return { ...e, lat: vi.lat, lon: vi.lon, nom: nomVille(vi, lang), charge: e.kw / e.cap, surcharges: secteurs.filter((s) => s.ville === e.id && s.charge >= 1).length };
    });
  }, [secteurs, lang]);

  const niveau = z < 2.6 ? 'villes' : z < 14 ? 'secteurs' : 'maisons';
  const rMaison = Math.max(2.6, Math.min(7, 1.2 + z * 0.09));
  const estVisibleFiltre = (f) => {
    const st = statuts[f.id] || 'normal';
    if (filtre === 'alertes') return alertes.has(f.id);
    if (filtre === 'solaire') return Boolean(f.pv);
    if (filtre === 'actions') return st !== 'normal' && st !== 'alerte';
    return true;
  };

  const fil = (() => {
    if (!selection) return [t('map.country')];
    const s = selection.type === 'secteur' ? secteurs.find((x) => x.id === selection.id) : selection.type === 'foyer' ? secteurs.find((x) => x.id === foyers.find((f) => f.id === selection.id)?.secteur) : null;
    const vid = selection.type === 'ville' ? selection.id : s?.ville;
    const vi = VILLES.find((x) => x.id === vid);
    return [t('map.country'), vi && nomVille(vi, lang), s?.nom, selection.type === 'foyer' ? foyers.find((f) => f.id === selection.id)?.ref : null].filter(Boolean);
  })();

  return (
    <div ref={boite} className="carte-steg" style={{ position: 'relative', height: H }}>
      <svg ref={svg} width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="application" aria-label={t('map.aria')}
        style={{ display: 'block', touchAction: 'none', cursor: 'grab', direction: 'ltr', background: 'var(--ai-soft)', borderRadius: 12 }}
        onPointerDown={surBas} onPointerMove={surDeplacement} onPointerUp={surHaut} onPointerCancel={surHaut}
        onClick={() => { if (bouge.current <= 6) onSelect(null); }}>
        <defs>
          <pattern id="mer" width="18" height="10" patternUnits="userSpaceOnUse"><path d="M0 8 Q4.5 2 9 8 T18 8" fill="none" stroke="var(--ai)" strokeOpacity=".12" /></pattern>
        </defs>
        <rect width={W} height={H} fill="url(#mer)" />
        <g transform={`translate(${v.tx} ${v.ty}) scale(${v.k})`}>
          {[CONTOUR, DJERBA, KERKENNAH].map((c, i) => <path key={i} d={chemin(c)} fill="var(--washi-raised)" stroke="var(--line)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />)}
        </g>

        {niveau === 'villes' && villes.map((g) => {
          const p = ecran(g.lat, g.lon);
          const r = 8 + Math.sqrt(g.n) * 0.75;
          const choisi = selection?.type === 'ville' && selection.id === g.id;
          return (
            <g key={g.id} transform={`translate(${p[0]} ${p[1]})`} style={{ cursor: 'pointer' }} role="button" tabIndex="0" aria-label={`${g.nom} : ${Math.round(g.charge * 100)} %`}
              onClick={clic(() => { onSelect({ type: 'ville', id: g.id }); zoomSur(g.lat, g.lon, 5); })}
              onKeyDown={(e) => { if (e.key === 'Enter') { onSelect({ type: 'ville', id: g.id }); zoomSur(g.lat, g.lon, 5); } }}>
              <circle r={r} fill={couleurCharge(g.charge)} fillOpacity=".85" stroke={choisi ? 'var(--sumi)' : 'var(--washi-raised)'} strokeWidth={choisi ? 3 : 2} />
              {g.surcharges > 0 && <circle r={r + 5} fill="none" stroke="var(--vermillon)" strokeWidth="2" strokeDasharray="3 3"><animate attributeName="r" values={`${r + 3};${r + 8};${r + 3}`} dur="1.6s" repeatCount="indefinite" /></circle>}
              <text y="4" textAnchor="middle" style={{ font: '700 11px var(--font-sans)', fill: '#fff' }}>{Math.round(g.charge * 100)}%</text>
              <text x={r + 4} y="4" style={{ font: '600 12px var(--font-sans)', fill: 'var(--sumi)', paintOrder: 'stroke', stroke: 'var(--washi-raised)', strokeWidth: 3 }}>{g.nom}</text>
            </g>
          );
        })}

        {niveau !== 'villes' && secteurs.map((s) => {
          const p = ecran(s.lat, s.lon);
          if (!visible(p, 120)) return null;
          const rKm = Math.max(niveau === 'secteurs' ? 14 : 0, 1.3 * PX_PAR_KM * v.k);
          const choisi = selection?.type === 'secteur' && selection.id === s.id;
          return (
            <g key={s.id} transform={`translate(${p[0]} ${p[1]})`} style={{ cursor: 'pointer' }} role="button" tabIndex="0" aria-label={`${s.nom} : ${Math.round(s.charge * 100)} %`}
              onClick={clic(() => { onSelect({ type: 'secteur', id: s.id }); if (niveau === 'secteurs') zoomSur(s.lat, s.lon, 90); })}
              onKeyDown={(e) => { if (e.key === 'Enter') { onSelect({ type: 'secteur', id: s.id }); zoomSur(s.lat, s.lon, 90); } }}>
              <circle r={rKm} fill={couleurCharge(s.charge)} fillOpacity={niveau === 'maisons' ? 0.07 : 0.8} stroke={choisi ? 'var(--sumi)' : couleurCharge(s.charge)} strokeWidth={choisi ? 3 : 1.5} strokeDasharray={niveau === 'maisons' ? '6 4' : undefined} />
              {niveau === 'secteurs' && <text y="4" textAnchor="middle" style={{ font: '700 10px var(--font-sans)', fill: '#fff' }}>{Math.round(s.charge * 100)}%</text>}
              <text y={niveau === 'maisons' ? -rKm - 6 : rKm + 13} textAnchor="middle" style={{ font: `600 ${niveau === 'maisons' ? 13 : 11}px var(--font-sans)`, fill: 'var(--sumi)', paintOrder: 'stroke', stroke: 'var(--washi-raised)', strokeWidth: 3 }}>
                {s.nom}{niveau === 'maisons' ? ` · ${Math.round(s.charge * 100)} %` : ''}
              </text>
            </g>
          );
        })}

        {niveau === 'maisons' && foyers.map((f) => {
          const p = ecran(f.lat, f.lon);
          if (!visible(p, 10)) return null;
          const st = statuts[f.id] || 'normal';
          const montre = estVisibleFiltre(f);
          const couleur = COULEUR_STATUT[st] || (alertes.has(f.id) ? 'var(--vermillon)' : 'var(--ai)');
          const choisi = selection?.type === 'foyer' && selection.id === f.id;
          const r = f.reel ? rMaison + 3 : rMaison;
          return (
            <g key={f.id} transform={`translate(${p[0]} ${p[1]})`} opacity={montre ? 1 : 0.15} style={{ cursor: 'pointer' }} onClick={clic(() => onSelect({ type: 'foyer', id: f.id }))}>
              {f.pv && <circle r={r + 2.5} fill="none" stroke={SOLEIL} strokeWidth="2" />}
              <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.35} fill={st === 'programme' ? 'var(--washi-raised)' : couleur} stroke={choisi ? 'var(--sumi)' : f.prioritaire ? 'var(--matcha)' : st === 'programme' ? couleur : 'var(--washi-raised)'} strokeWidth={choisi || f.prioritaire || st === 'programme' ? 2 : 1} />
              {st === 'coupe' && <path d={`M${-r * 0.55} ${-r * 0.55}L${r * 0.55} ${r * 0.55}M${r * 0.55} ${-r * 0.55}L${-r * 0.55} ${r * 0.55}`} stroke="#fff" strokeWidth="1.5" />}
              {f.prioritaire && <path d={`M0 ${-r * 0.6}V${r * 0.6}M${-r * 0.6} 0H${r * 0.6}`} stroke="#fff" strokeWidth="1.6" />}
              {f.reel && <text y={-r - 6} textAnchor="middle" style={{ font: '700 11px var(--font-sans)', fill: 'var(--sumi)', paintOrder: 'stroke', stroke: 'var(--washi-raised)', strokeWidth: 3 }}>{f.nomFoyer || t('map.realHome')}</text>}
            </g>
          );
        })}
      </svg>

      <nav className="carte-fil small" aria-label={t('map.breadcrumb')}>{fil.join(' › ')}<span className="muted"> · {t(`map.level.${niveau}`)}</span></nav>
      <div className="carte-zoom">
        <button type="button" aria-label={t('map.zoomIn')} onClick={() => zoomPoint(1.6, W / 2, H / 2)}>+</button>
        <button type="button" aria-label={t('map.zoomOut')} onClick={() => zoomPoint(1 / 1.6, W / 2, H / 2)}>−</button>
        <button type="button" aria-label={t('map.reset')} onClick={() => { onSelect(null); versVue({ k: k0, tx: W / 2 - BASE.cx * k0, ty: H / 2 - BASE.cy * k0 }); }}>⟲</button>
      </div>
      <div className="carte-legende small">
        {niveau === 'maisons' ? <>
          <span><i style={{ background: 'var(--ai)' }} />{t('map.lgNormal')}</span>
          <span><i style={{ background: 'var(--vermillon)' }} />{t('map.lgOver')}</span>
          <span><i style={{ background: 'var(--kincha)' }} />{t('map.lgLimited')}</span>
          <span><i style={{ background: '#3a352c' }} />{t('map.lgCut')}</span>
          <span><i style={{ background: 'transparent', border: `2px solid ${SOLEIL}`, borderRadius: 99 }} />{t('map.lgSolar')}</span>
          <span><i style={{ background: 'var(--ai)', border: '2px solid var(--matcha)' }} />{t('map.lgPriority')}</span>
        </> : <>
          <span><i style={{ background: 'var(--ai)', borderRadius: 99 }} />{t('map.lgLoadOk')}</span>
          <span><i style={{ background: 'var(--kincha)', borderRadius: 99 }} />{t('map.lgLoadHigh')}</span>
          <span><i style={{ background: 'var(--vermillon)', borderRadius: 99 }} />{t('map.lgLoadOver')}</span>
          <span className="muted">{t('map.hintZoom')}</span>
        </>}
        <span className="muted">{t('map.zoom', { z: nombre(z, 1) })}</span>
      </div>
    </div>
  );
}
