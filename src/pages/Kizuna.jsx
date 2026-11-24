// Écran 6 — Kizuna (絆) : le compteur partagé, ses membres reliés par le fil rouge, les encouragements (F6), et les réglages.
import { useState } from 'react';
import { useCompteur } from '../lib/store.jsx';
import { useT, ChoixLangue } from '../i18n/index.jsx';
import { envoyerMessage } from '../lib/db.js';
import { villeChoisie } from '../lib/meteo.js';
import { SelecteurVille } from '../components/Canicule.jsx';
import Icon from '../components/Icon.jsx';
import PartageSteg from '../components/PartageSteg.jsx';

const MESSAGES = ['bravo', 'clim', 'qui', 'torii'];

export default function Kizuna() {
  const { compteur, membres, releves, messages, etat, session, modeCloud, signaler, quitter } = useCompteur();
  const { t, date } = useT();
  const [ville, setVille] = useState(villeChoisie());
  const [grand, setGrand] = useState(() => document.documentElement.classList.contains('grand'));
  const [messageSaisi, setMessageSaisi] = useState('');
  const [envoiMessage, setEnvoiMessage] = useState(false);
  const basculerGrand = (v) => {
    setGrand(v);
    document.documentElement.classList.toggle('grand', v);
    try { localStorage.setItem('mieru:grand', v ? '1' : '0'); } catch { /* stockage indisponible */ }
  };
  const dernierDe = (id) => [...releves].reverse().find((r) => r.membreId === id);
  const prenom = (id) => membres.find((m) => m.id === id)?.prenom || t('kiz.someone');

  async function envoyer(texte, effacer = false) {
    const contenu = texte.trim();
    if (!contenu || envoiMessage) return;
    setEnvoiMessage(true);
    try {
      await envoyerMessage(compteur.id, session.membreId, contenu);
      if (effacer) setMessageSaisi('');
    } catch (e) {
      signaler(e.message || t('common.error'));
    } finally {
      setEnvoiMessage(false);
    }
  }

  function soumettreMessage(e) {
    e.preventDefault();
    envoyer(messageSaisi, true);
  }

  async function partager() {
    const texte = t('kiz.inviteText', { nom: compteur.nom, code: compteur.code });
    try {
      if (navigator.share) await navigator.share({ title: 'Mieru · Kizuna', text: texte });
      else { await navigator.clipboard.writeText(texte); signaler(t('kiz.copied')); }
    } catch { /* partage annulé ou refusé */ }
  }

  return (
    <>
      <div aria-hidden="true" className="kizuna-banniere" />
      <main className="screen" style={{ marginTop: -16 }}>
        <section className="card" style={{ position: 'relative' }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h1 className="title" style={{ fontSize: 22 }}>{compteur.nom}</h1>
            <span className="small muted">絆 · Kizuna</span>
          </div>
          <p className="small muted">{t('kiz.sub', { n: membres.length })} · <b style={{ color: 'var(--kincha)' }}>{t('kiz.left', { n: Math.max(0, Math.round(etat.resteKwh)) })}</b></p>
          <ul className="fil-rouge" style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, position: 'relative' }}>
            {membres.length > 1 && <li aria-hidden="true" className="fil-rouge-ligne" />}
            {membres.map((m) => {
              const r = dernierDe(m.id);
              return (
                <li key={m.id} className="row" style={{ minHeight: 54, flexWrap: 'nowrap', gap: 12 }}>
                  <span style={{ position: 'relative', zIndex: 1, width: 40, height: 40, flex: 'none', borderRadius: 999, background: 'var(--ai-soft)', color: 'var(--ai)', border: '3px solid var(--washi-raised)', boxShadow: '0 0 0 2px var(--vermillon)', display: 'grid', placeItems: 'center', fontWeight: 600 }}>{m.prenom.slice(0, 1).toUpperCase()}</span>
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{m.prenom}{m.id === session.membreId ? ` ${t('kiz.you')}` : ''}</span>
                    <span className="small muted">{t(`role.${m.role}`)}{r ? ` · ${t('kiz.read', { when: date(r.prisLe || r.recuLe, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) })}` : ''}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card" aria-label={t('kiz.messages')} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="heading">{t('kiz.messages')}</h2>
          <div role="log" aria-live="polite" aria-relevant="additions text" aria-label={t('kiz.messages')}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
            {messages.length === 0 && <p className="small muted">{t('kiz.chatEmpty')}</p>}
            {messages.slice(0, 20).reverse().map((m) => {
              const moi = m.membreId === session.membreId;
              return (
                <div key={m.id} style={{ alignSelf: moi ? 'flex-end' : 'flex-start', maxWidth: '90%', padding: '10px 14px', borderRadius: 16, borderEndStartRadius: moi ? 16 : 4, borderEndEndRadius: moi ? 4 : 16, background: moi ? 'var(--ai-soft)' : 'var(--sakura-soft)' }}>
                  <b style={{ color: 'var(--ai)' }}>{prenom(m.membreId)}</b>
                  <p style={{ overflowWrap: 'anywhere' }}>{m.texte}</p>
                  {m.creeLe && <span className="small muted">{date(m.creeLe, { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
              );
            })}
          </div>
          <form onSubmit={soumettreMessage} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="field">
              <span className="sr-only">{t('kiz.messagePh')}</span>
              <textarea className="input" rows="2" maxLength="120" value={messageSaisi}
                placeholder={t('kiz.messagePh')} aria-label={t('kiz.messagePh')}
                onChange={(e) => setMessageSaisi(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={envoiMessage || !messageSaisi.trim()}>{t('kiz.send')}</button>
          </form>
          <div className="row" aria-label={t('kiz.quickMessages')}>
            {MESSAGES.map((k) => <button key={k} type="button" className="chip" disabled={envoiMessage} onClick={() => envoyer(t(`msg.${k}`))}>{t(`msg.${k}`)}</button>)}
          </div>
          {!modeCloud && <p className="small alert tone-warn">{t('kiz.localWarn')}</p>}
        </section>

        <div className="card row" style={{ padding: '10px 12px', paddingInlineStart: 0, flexWrap: 'nowrap', overflow: 'hidden' }}>
          <span aria-hidden="true" style={{ alignSelf: 'stretch', width: 20, margin: '-10px 0', background: 'url(/assets/zellige.svg) 0 0 / 120px auto' }} />
          <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <span className="small muted">{t('kiz.code')}</span>
            <b className="mono" dir="ltr" style={{ fontSize: 22, letterSpacing: 3, color: 'var(--ai)', textAlign: 'start' }}>{compteur.code}</b>
          </span>
          <button className="btn btn-primary" style={{ width: 'auto', minHeight: 44, padding: '0 14px' }} onClick={partager}><Icon nom="partager" taille={18} />{t('kiz.invite')}</button>
        </div>
        <PartageSteg />

        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="heading">{t('kiz.settings')}</h2>
          <div className="field"><span className="caption">{t('lang.label')}</span><ChoixLangue /></div>
          <div className="field"><span className="caption">{t('kiz.city')}</span><SelecteurVille ville={ville} onChange={setVille} /></div>
          <label className="radio-row"><input type="checkbox" checked={grand} onChange={(ev) => basculerGrand(ev.target.checked)} />{t('kiz.big')}</label>
        </section>
        <button className="btn btn-quiet" onClick={quitter}>{t('kiz.quit')}</button>
      </main>
    </>
  );
}
