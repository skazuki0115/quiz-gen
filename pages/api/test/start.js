import { randomUUID } from 'node:crypto';
import {
  appendHistory,
  createTestSession,
  insertTestQuestion,
} from '../../../lib/history';
import { generateQuiz, normalizeDifficulty } from '../../../lib/quizGenerator';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST' });
  }

  const { userName, prompt, difficulty, totalQuestions = 3 } = req.body ?? {};

  if (!userName || typeof userName !== 'string' || userName.trim() === '') {
    return res.status(400).json({ error: 'userName is required' });
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const safeTotal =
    typeof totalQuestions === 'number' && Number.isFinite(totalQuestions) && totalQuestions > 0
      ? Math.min(Math.floor(totalQuestions), 10)
      : 3;

  try {
    const normalizedDifficulty = normalizeDifficulty(difficulty);
    const session = createTestSession({
      id: randomUUID(),
      userName: userName.trim(),
      prompt: prompt.trim(),
      difficulty: normalizedDifficulty,
      totalQuestions: safeTotal,
    });

    const quiz = await generateQuiz({ prompt, difficulty: normalizedDifficulty });
    const question = insertTestQuestion({
      id: randomUUID(),
      sessionId: session.id,
      questionIndex: 1,
      question: quiz.question,
      choices: quiz.choices,
      answer: quiz.answer,
      explanation: quiz.explanation,
    });

    try {
      appendHistory({
        id: question.id,
        prompt: prompt.trim(),
        difficulty: normalizedDifficulty,
        question: quiz.question,
        choices: quiz.choices,
        answer: quiz.answer,
        explanation: quiz.explanation,
        createdAt: question.createdAt,
      });
    } catch (historyError) {
      console.error('Failed to save test question to history:', historyError);
    }

    return res.status(200).json({
      session: {
        id: session.id,
        userName: session.userName,
        prompt: session.prompt,
        difficulty: session.difficulty,
        totalQuestions: session.totalQuestions,
        status: session.status,
      },
      question: {
        id: question.id,
        sessionId: session.id,
        index: question.questionIndex,
        question: question.question,
        choices: question.choices,
        answer: question.answer,
        explanation: question.explanation,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'テストの開始に失敗しました' });
  }
}
