import { randomUUID } from 'node:crypto';
import { appendHistory } from '../../lib/history';
import { generateQuiz, normalizeDifficulty } from '../../lib/quizGenerator';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST' });
  }

  const { prompt, difficulty, sourceText, pdfFilename } = req.body ?? {};
  const hasPrompt = typeof prompt === 'string' && prompt.trim() !== '';
  const hasSource = typeof sourceText === 'string' && sourceText.trim() !== '';

  if (!hasPrompt && !hasSource) {
    return res.status(400).json({ error: 'テーマを入力するかPDFを読み込んでください。' });
  }

  try {
    const quiz = await generateQuiz({
      prompt: hasPrompt ? prompt : '',
      sourceText: hasSource ? sourceText : '',
      difficulty: normalizeDifficulty(difficulty),
    });

    const historyPrompt =
      hasPrompt && prompt
        ? prompt.trim()
        : pdfFilename
          ? `[PDF] ${pdfFilename}`
          : '[PDF] アップロード資料';

    try {
      appendHistory({
        id: randomUUID(),
        prompt: historyPrompt,
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
