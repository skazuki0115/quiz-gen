import { getTestSummary } from '../../../lib/history';

export default async function handler(req, res) {
  const {
    query: { sessionId },
    method,
  } = req;

  if (method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const summary = getTestSummary(sessionId);
    if (!summary) {
      return res.status(404).json({ error: 'session not found' });
    }

    return res.status(200).json({ summary });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '結果の取得に失敗しました' });
  }
}
