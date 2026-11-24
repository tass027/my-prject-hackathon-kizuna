// Écran 7 — Réclamation : comparer une facture estimée aux relevés scellés et générer le dossier PDF (F8).
// Le PDF reste en français : il est destiné à l'agence STEG.
import { useEffect, useMemo, useState } from 'react';
import { useCompteur } from '../lib/store.jsx';
import { useT } from '../i18n/index.jsx';
import { TopBar, Hanko } from '../components/Chrome.jsx';
import Icon from '../components/Icon.jsx';
import { urlPhoto } from '../lib/db.js';
import { empreinteCourte } from '../lib/preuve.js';
import { dateReleve } from '../lib/calcul.js';

const jourIso = (d) => new Date(d).toISOString().slice(0, 10);

/** Index au plus près d'une date : dernier relevé avant ou à cette date. */
function indexA(releves, d) {
  const limite = new Date(d).getTime();
  const avant = releves.filter((r) => new Date(dateReleve(r)).getTime() <= limite);
  return avant.length ? avant[avant.length - 1] : null;
}

export default function Reclamation() {
  const { compteur, releves, membres, moi, signaler } = useCompteur();
  const { t, date, lang } = useT();
  const tries = useMemo(() => [...releves].sort((a, b) => new Date(dateReleve(a)) - new Date(dateReleve(b))), [releves]);
  const [du, setDu] = useState(tries[0] ? jourIso(dateReleve(tries[0])) : jourIso(new Date()));
  const [au, setAu] = useState(jourIso(new Date()));
  const [kwhFacture, setKwhFacture] = useState('');
  const [montant, setMontant] = useState('');
  const [photos, setPhotos] = useState({});
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    let vivant = true;
    Promise.all(tries.filter((r) => r.photoChemin).map(async (r) => [r.id, await urlPhoto(r)])).then((l) => vivant && setPhotos(Object.fromEntries(l)));
    return () => { vivant = false; };
  }, [tries]);

  const debut = indexA(tries, `${du}T23:59:59`) || tries[0];
  const fin = indexA(tries, `${au}T23:59:59`);
  const kwhReel = debut && fin ? Math.max(0, fin.index - debut.index) : 0;
  const dansPeriode = tries.filter((r) => { const d = jourIso(dateReleve(r)); return d >= du && d <= au; });
  const ecart = kwhFacture ? Number(kwhFacture) - kwhReel : null;

  async function generer() {
    setOccupe(true);
    try {
      const { genererReclamation } = await import('../lib/pdf.js');
      await genererReclamation({
        compteur, kwhReel, titulaire: moi?.prenom || '',
        facture: { kwhFacture: kwhFacture ? Number(kwhFacture) : null, montant, periode: `du ${new Date(du).toLocaleDateString('fr-FR')} au ${new Date(au).toLocaleDateString('fr-FR')}` },
        releves: dansPeriode.map((r) => ({ ...r, photoUrl: photos[r.id] || null, auteur: membres.find((m) => m.id === r.membreId)?.prenom })),
      });
    } catch (e) { signaler(t('claim.pdfFail', { e: e.message || e })); }
    finally { setOccupe(false); }
  }

  return (
    <>
      <TopBar titre={t('claim.title')} retour />
      <main className="screen">
        <p className="muted">{t('claim.intro')}</p>
        <section className="grid2">
          <label className="field"><span className="caption">{t('claim.from')}</span><input className="input" type="date" value={du} onChange={(ev) => setDu(ev.target.value)} /></label>
          <label className="field"><span className="caption">{t('claim.to')}</span><input className="input" type="date" value={au} onChange={(ev) => setAu(ev.target.value)} /></label>
          <label className="field"><span className="caption">{t('claim.kwhBilled')}</span><input className="input" dir="ltr" inputMode="numeric" value={kwhFacture} onChange={(ev) => setKwhFacture(ev.target.value.replace(/\D/g, ''))} placeholder={t('claim.billedPh')} /></label>
          <label className="field"><span className="caption">{t('claim.amount')}</span><input className="input" dir="ltr" inputMode="decimal" value={montant} onChange={(ev) => setMontant(ev.target.value)} placeholder={t('claim.optional')} /></label>
        </section>
        <section className="grid2" aria-label={t('claim.compare')}>
          <div className="card" style={{ padding: 12 }}><div className="caption">{t('claim.billed')}</div><div style={{ font: '800 22px/28px var(--font-display)' }}>{kwhFacture || '—'} kWh</div></div>
          <div className="card tone-info" style={{ padding: 12, border: 0 }}><div className="caption" style={{ color: 'var(--ai)' }}>{t('claim.real')}</div><div style={{ font: '800 22px/28px var(--font-display)' }}>{kwhReel} kWh</div></div>
        </section>
        {ecart !== null && ecart > 0 && <p className="alert tone-warn small"><b className="tone-title" style={{ fontSize: 16 }}>{t('claim.gap', { n: ecart })}</b></p>}

        <section className="card">
          <h2 className="heading">{t('claim.photos')}</h2>
          {dansPeriode.length === 0 && <p className="small muted" style={{ marginTop: 8 }}>{t('claim.none')}</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {[...dansPeriode].reverse().slice(0, 8).map((r) => (
              <li key={r.id} className="row" style={{ flexWrap: 'nowrap', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ position: 'relative', width: 56, height: 56, flex: 'none', borderRadius: 10, background: photos[r.id] ? '#2a2d33' : 'var(--washi)', border: photos[r.id] ? 0 : '1px dashed var(--line)', color: 'var(--sumi-muted)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                  {photos[r.id] ? <img src={photos[r.id]} alt={t('claim.photoAlt', { n: r.index })} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon nom="camera" taille={20} />}
                  {r.sha256 && <span style={{ position: 'absolute', insetInlineEnd: 2, bottom: 2 }}><Hanko /></span>}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <b className="mono" dir="ltr" style={{ textAlign: 'start' }}>{String(r.index).padStart(5, '0')} kWh</b>
                  <span className="small muted">{date(dateReleve(r), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · <span className="mono">{r.sha256 ? empreinteCourte(r.sha256) : t('claim.noPhoto')}</span></span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <button className="btn btn-primary" disabled={occupe || dansPeriode.length === 0} onClick={generer}><Icon nom="reclamation" taille={20} />{t(occupe ? 'claim.preparing' : 'claim.gen')}</button>
        <p className="small muted">{t('claim.note')}{lang !== 'fr' ? ` ${t('claim.pdfLang')}` : ''}</p>
      </main>
    </>
  );
}
