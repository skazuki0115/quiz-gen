import { randomUUID } from 'node:crypto';
import { appendHistory } from '../../lib/history';
import { generateQuiz, normalizeDifficulty } from '../../lib/quizGenerator';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST' });
  }

  const { prompt, difficulty } = req.body ?? {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const quiz = await generateQuiz({ prompt, difficulty: normalizeDifficulty(difficulty) });

    try {
      appendHistory({
        id: randomUUID(),
        prompt: prompt.trim(),
        difficulty: quiz.difficulty,
        question: quiz.question,
        choices: quiz.choices,
        answer: quiz.answer,
        explanation: quiz.explanation,
        createdAt: new Date().toISOString(),
      });
    } catch (historyError) {
      console.error('Failed to save quiz history:', historyError);
    }

    return res.status(200).json({ quiz });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : '生成に失敗しました' });
  }
}
