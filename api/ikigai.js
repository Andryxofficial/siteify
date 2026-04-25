import { interpellaIkigai, statoIkigai } from './_ikigaiEngine.js';

export default async function gestoreIkigai(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      if (req.query?.action === 'status') return res.status(200).json(await statoIkigai());
      const domanda = String(req.query?.q || '').trim();
      return res.status(200).json(await interpellaIkigai({ domanda }));
    }

    if (req.method === 'POST') {
      const { question, domanda, history, cronologia } = req.body || {};
      return res.status(200).json(await interpellaIkigai({
        domanda: domanda || question,
        cronologia: cronologia || history,
      }));
    }

    return res.status(405).json({ error: 'Metodo non supportato.' });
  } catch (e) {
    console.error('[ikigai] error:', e);
    return res.status(500).json({ error: 'Ikigai non è riuscito a rispondere.' });
  }
}
