// Écran 3 — Relevé : caméra avec cadre-guide → OCR → vérification → enregistrement scellé (F2 + preuves F8).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompteur } from '../lib/store.jsx';
import { useT } from '../i18n/index.jsx';
import { Hanko, Aaddad } from '../components/Chrome.jsx';
import Icon from '../components/Icon.jsx';
import { lireIndex } from '../lib/ocr.js';
import { preparerPhoto } from '../lib/preuve.js';
import { verifierReleve } from '../lib/calcul.js';
import { ajouterReleve } from '../lib/db.js';

export default function Releve() {
  const { compteur, releves, session, signaler, recharger } = useCompteur();
  const { t } = useT();
  const nav = useNavigate();
  const video = useRef(null);
  const fichier = useRef(null);
  const [flux, setFlux] = useState(null);
  const [photo, setPhoto] = useState(null);     // { blob, sha256, prisLe, url }
  const [lecture, setLecture] = useState(null); // { valeur, confiance } | 'en-cours'
  const [index, setIndex] = useState('');
  const [envoi, setEnvoi] = useState(false);

  // Caméra arrière ; si refusée ou absente, on passe par le sélecteur de fichier (qui ouvre aussi l'appareil photo).
  useEffect(() => {
    let actif = true, s = null;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
      .then((m) => { s = m; if (actif) { setFlux(m); if (video.current) video.current.srcObject = m; } else m.getTracks().forEach((x) => x.stop()); })
      .catch(() => setFlux(false));
    return () => { actif = false; s?.getTracks().forEach((x) => x.stop()); };
  }, []);
  useEffect(() => { if (flux && video.current) video.current.srcObject = flux; }, [flux, photo]);

  async function traiter(blobOuFichier) {
    const p = await preparerPhoto(blobOuFichier);
    setPhoto({ ...p, url: URL.createObjectURL(p.blob) });
    setLecture('en-cours');
    try {
      const r = await lireIndex(p.blob);
      setLecture(r);
      if (r.valeur !== null) setIndex(String(r.valeur));
      else signaler(t('read.ocrFail'));
    } catch {
      setLecture({ valeur: null, confiance: 0 });
      signaler(t('read.ocrFail'));
    }
  }

  function capturer() {
    const v = video.current;
    if (!v || !v.videoWidth) return fichier.current?.click();
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob((b) => traiter(new File([b], 'releve.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.9);
  }

  const valeur = Number(index);
  const controle = index ? verifierReleve(valeur, compteur, releves) : null;
  const source = !photo ? 'manuel' : lecture && lecture !== 'en-cours' && lecture.valeur === valeur ? 'ocr' : 'ocr_corrige';

  async function valider() {
    setEnvoi(true);
    try {
      await ajouterReleve({ compteurId: compteur.id, membreId: session.membreId, index: valeur, source, confiance: lecture?.confiance ?? null, photo: photo?.blob || null, sha256: photo?.sha256 || null, prisLe: photo?.prisLe || new Date().toISOString() });
      await recharger();
      signaler(t(photo ? 'read.savedSealed' : 'read.saved'));
      nav('/');
    } catch (e) { signaler(e.message || t('read.failed')); }
    finally { setEnvoi(false); }
  }

  return (
    <div className="releve">
      <section className="camera" aria-label={t('read.viewfinder')}>
        <header className="topbar" style={{ position: 'absolute', zIndex: 2, left: 0, right: 0, color: '#fff' }}>
          <button className="back" style={{ color: '#fff' }} aria-label={t('common.back')} onClick={() => nav(-1)}><Icon nom="retour" className="flip" /></button>
          <h1>{t('read.title')}</h1>
        </header>
        {photo ? <img className="shot" src={photo.url} alt={t('read.photoAlt')} />
          : flux ? <video ref={video} autoPlay playsInline muted />
            : <div style={{ height: 380 }} />}
        {!photo && <><div className="hint">{t('read.hint')}</div><div className="frame" /></>}
        {!photo && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, display: 'flex', justifyContent: 'center', gap: 24, alignItems: 'center' }}>
            <button onClick={capturer} aria-label={t('read.shoot')} style={{ width: 66, height: 66, borderRadius: 999, border: '4px solid #fff', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <span style={{ width: 48, height: 48, borderRadius: 999, background: '#fff' }} />
            </button>
            <button onClick={() => fichier.current?.click()} aria-label={t('read.pick')} title={t('read.pick')} style={{ width: 48, height: 48, borderRadius: 12, border: 0, background: 'rgba(255,255,255,.2)', color: '#fff', display: 'grid', placeItems: 'center' }}><Icon nom="image" /></button>
          </div>
        )}
        <input ref={fichier} type="file" accept="image/*" capture="environment" hidden onChange={(ev) => ev.target.files[0] && traiter(ev.target.files[0])} />
      </section>

      <section className="sheet" aria-label={t('read.check')}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <h2 className="title" style={{ fontSize: 21 }}>{t(photo ? 'read.verify' : 'read.orType')}</h2>
          <Aaddad humeur={controle && !controle.ok ? 'inquiet' : 'calme'} taille={56} />
        </div>
        {lecture === 'en-cours' && <p className="small muted">{t('read.reading')}</p>}
        <label className="field">
          <span className="caption">{t('read.indexLabel')}</span>
          <input className="input index" dir="ltr" inputMode="numeric" pattern="[0-9]*" value={index} onChange={(ev) => setIndex(ev.target.value.replace(/\D/g, ''))} placeholder="04821" />
        </label>
        {lecture && lecture !== 'en-cours' && lecture.valeur !== null && <p className="small"><span className="pill tone-ok" style={{ color: 'var(--matcha)' }}>{t('read.readAt', { n: lecture.confiance })}</span> {t('read.fix')}</p>}
        {controle && (controle.ok
          ? <p className="small">{t('read.coherent', { n: controle.delta })}</p>
          : controle.avertissements.map((a) => <p key={a} className="small alert tone-warn">{t(`read.warn.${a}`, { p: controle.precedent.index })}</p>))}
        {photo && (
          <div className="row" style={{ background: 'var(--washi)', borderRadius: 12, padding: '12px 14px', flexWrap: 'nowrap' }}>
            <Hanko grand />
            <p className="small muted">{t('read.sealed', { h: photo.sha256.slice(0, 8) })}</p>
          </div>
        )}
        <button className="btn btn-primary" disabled={!index || envoi || lecture === 'en-cours'} onClick={valider}>{t(envoi ? 'read.sending' : 'read.validate')}</button>
        {photo && <button className="btn btn-quiet" onClick={() => { setPhoto(null); setLecture(null); setIndex(''); }}>{t('read.retake')}</button>}
      </section>
    </div>
  );
}
