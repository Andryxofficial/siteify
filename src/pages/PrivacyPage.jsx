import { ShieldCheck, LockKeyhole, Brain, Trash2, EyeOff } from 'lucide-react';
import SEO from '../components/SEO';

export default function PrivacyPage() {
  return (
    <main className="main-content privacy-page">
      <SEO
        title="Privacy & Ikigai — ANDRYXify"
        description="Informativa privacy di ANDRYXify: dati, cookie, Ikigai, sicurezza, cifratura e diritti dell'utente."
        canonical="/privacy"
      />

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto 1.25rem', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginTop: 0 }}>
          <ShieldCheck size={30} /> Privacy & Sicurezza
        </h1>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
          ANDRYXify raccoglie solo ciò che serve per far funzionare il sito, la community e le funzioni interattive. Nessun dato viene venduto a terzi.
        </p>
      </section>

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto 1.25rem', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h2><Brain size={22} /> Ikigai</h2>
        <p>
          Ikigai è l’helper interno del sito. Serve a spiegare funzioni, tag, classifiche, premi, notifiche, impostazioni e percorsi utili.
        </p>
        <p>
          Per diventare più utile nel tempo, Ikigai può salvare un profilo adattivo minimale: interessi generici, sezioni usate, intenti ricorrenti e preferenze di risposta. Non viene salvato un profilo commerciale, né vengono vendute o cedute informazioni a terzi.
        </p>
      </section>

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto 1.25rem', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h2><LockKeyhole size={22} /> Cifratura e minimizzazione</h2>
        <ul style={{ lineHeight: 1.75 }}>
          <li>I profili adattivi di Ikigai sono pseudonimizzati.</li>
          <li>I dati salvati nella custodia Ikigai sono cifrati lato server con AES-256-GCM.</li>
          <li>Le domande possono essere trasformate in impronte/sintesi tecniche per ridurre i dati leggibili.</li>
          <li>Il creatore del sito non deve accedere ai contenuti leggibili dei profili Ikigai.</li>
          <li>La conservazione è limitata: i dati adattivi sono pensati per scadere automaticamente.</li>
        </ul>
        <p style={{ color: 'var(--text-muted)' }}>
          Nessun sistema può essere definito “a prova assoluta di hacker”, ma ANDRYXify usa una progettazione orientata alla riduzione del danno: meno dati, dati cifrati, accesso limitato, separazione e cancellazione.
        </p>
      </section>

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto 1.25rem', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h2><EyeOff size={22} /> Consenso e controllo</h2>
        <p>
          L’utente può usare Ikigai anche senza account. In quel caso viene usato un identificativo anonimo locale per mantenere continuità tra le sessioni. Gli utenti registrati possono avere un’esperienza più coerente perché Ikigai può adattarsi meglio al loro uso del sito.
        </p>
        <p>
          È possibile disattivare la personalizzazione di Ikigai e richiedere la cancellazione del profilo adattivo.
        </p>
      </section>

      <section className="glass-panel" style={{ maxWidth: 920, margin: '0 auto', padding: 'clamp(1.25rem, 4vw, 2rem)' }}>
        <h2><Trash2 size={22} /> Cancellazione</h2>
        <p>
          La cancellazione del profilo Ikigai elimina la custodia associata all’utente o all’identificativo anonimo locale. Alcune statistiche aggregate e non personali possono restare per capire quali funzioni del sito vengono usate di più.
        </p>
      </section>
    </main>
  );
}
