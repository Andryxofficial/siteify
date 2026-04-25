import { interpellaIkigai, statoIkigai } from './_ikigaiEngine.js';
import {
  identificaCustodia,
  ottieniRedisCustodia,
  impostaConsensoIkigai,
  dimenticaProfiloIkigai,
} from './_custodiaIkigai.js';

export default async function gestoreIkigai(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Ikigai-Anon, X-Andryx-Client');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      if (req.query?.action === 'status') return res.status(200).json(await statoIkigai());
      const domanda = String(req.query?.q || '').trim();
      return res.status(200).json(await interpellaIkigai({ domanda, req }));
    }

    if (req.method === 'POST') {
      const corpo = req.body || {};
      const { question, domanda, history, cronologia, contestoPagina, pageContext, action, preferenze, optOut } = corpo;
      const redis = await ottieniRedisCustodia();
      const { idCustodia } = identificaCustodia(req, corpo);

      if (action === 'consenso') {
        const risultato = await impostaConsensoIkigai(redis, idCustodia, { optOut, preferenze });
        return res.status(200).json(risultato);
      }

      return res.status(200).json(await interpellaIkigai({
        domanda: domanda || question,
        cronologia: cronologia || history,
        contestoPagina: contestoPagina || pageContext,
        req,
        corpo,
      }));
    }

    if (req.method === 'DELETE') {
      const redis = await ottieniRedisCustodia();
      const { idCustodia } = identificaCustodia(req, req.body || {});
      return res.status(200).json(await dimenticaProfiloIkigai(redis, idCustodia));
    }

    return res.status(405).json({ error: 'Metodo non supportato.' });
  } catch (e) {
    console.error('[ikigai] error:', e);
    return res.status(500).json({ error: 'Ikigai non è riuscito a rispondere.' });
  }
}
