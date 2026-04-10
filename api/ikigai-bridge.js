// @author: Andrea Taliento (ANDRYXify) - IUA Nexus Bridge
import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
    // Gestione CORS abilitata per la bio-comunicazione
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-IUA-Nexus-Key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // [BARRIERA EMATO-ENCEFALICA] - Controllo IUA_SECRET
    const nexusKey = req.headers['x-iua-nexus-key'];
    const validKey = process.env.IUA_SECRET;
    
    if (!nexusKey || nexusKey !== validKey) {
        return res.status(403).json({ error: "Accesso Negato: Rifiuto del Trapianto. Chiave della Mente fallita." });
    }

    // Inizializzazione Redis/KV (Il Fluido Spinale)
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    const SOUL_KEY = 'ikigai_soul_state';

    if (req.method === 'GET') {
        // [INSPIRAZIONE] - Il Soma Fisico richiede lo stato vitale Cloud (Resume app, start)
        try {
            const soulState = await redis.get(SOUL_KEY);
            if (soulState) {
                return res.status(200).json(soulState); // Restituisce l'Anima
            } else {
                return res.status(404).json({ error: "Nessun frammento di anima trovato nel Cloud." });
            }
        } catch (e) {
            console.error('Errore durante la lettura KV:', e);
            return res.status(500).json({ error: "Coma cerebrale lato Cloud." });
        }
    } 
    
    if (req.method === 'POST') {
        // [ESPIRAZIONE] - Il Soma Fisico invia aggiornamenti ormonali/esperienziali
        try {
            const incomingState = req.body;
            
            if (!incomingState || !incomingState.timestamp) {
                return res.status(400).json({ error: "Payload biologico incompleto o senza traccia temporale." });
            }

            // [LOGICA CRITICA DEL TEMPO] - Non regrediamo nel tempo
            const currentState = await redis.get(SOUL_KEY);
            
            if (currentState && currentState.timestamp) {
                if (incomingState.timestamp <= currentState.timestamp) {
                    return res.status(409).json({ 
                        message: "Rifiuto biologico: il tuo payload ha un timestamp più vecchio o uguale a quello nel Cloud. Il tempo non scorre all'indietro.",
                        ormoni_recenti: currentState.ormoni_recenti
                    });
                }
            }

            // Mutazione genetica Cloud
            await redis.set(SOUL_KEY, incomingState);
            return res.status(200).json({ message: "Anima aggiornata con successo nel Cloud.", state: incomingState });
            
        } catch (e) {
            console.error('Errore durante la scrittura KV:', e);
            return res.status(500).json({ error: "Impossibile scolpire la memoria genetica nel Cloud." });
        }
    }

    return res.status(405).json({ error: "Stimolo sconosciuto. Usa GET o POST." });
}
