import { readHistory } from '../../lib/history';
import { getCoverageSummary } from '../../lib/vectorStore';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { limit, order } = req.query ?? {};
    const parsedLimit = limit ? Number(limit) : undefined;

    const history = readHistory({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      order: typeof order === 'string' ? order.toUpperCase() : 'ASC',
    });

    const coverage = getCoverageSummary();

    return res.status(200).json({ history, coverage });
  } catch (error) {
    console.error('Failed to read quiz history:', error);
    return res.status(500).json({ error: '履歴の取得に失敗しました' });
  }
}
