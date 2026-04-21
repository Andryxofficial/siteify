import { useEffect, useState } from 'react';

/* ─────────────────────────────────────────────────────────
   Fallback Suspense con ritardo
   ─────────────────────────────────────────────────────────
   I chunk lazy spesso si caricano in pochi ms (specie se
   pre-fetchati): mostrare uno skeleton immediato fa lampeggiare
   l'UI e dà la sensazione di "caricamento" anche quando non c'è.

   Questo componente attende `delayMs` prima di renderizzare il
   fallback. Se il chunk arriva entro la soglia, l'utente non
   vede nessuno skeleton — la transizione sembra istantanea.
   ───────────────────────────────────────────────────────── */
export default function FallbackRitardato({ delayMs = 180, children }) {
  const [mostra, setMostra] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMostra(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);
  if (!mostra) return null;
  return children;
}
