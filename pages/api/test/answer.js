import { randomUUID } from 'node:crypto';
import {
  appendHistory,
  completeTestSession,
  getTestQuestion,
  getTestSession,
  getTestSummary,
  insertTestQuestion,
  listTestQuestions,
  updateTestQuestionAnswer,
} from '../../../lib/history';
import { generateQuiz } from '../../../lib/quizGenerator';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST' });
  }

  const { sessionId, questionId, userAnswer } = req.body ?? {};

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  if (!questionId || typeof questionId !== 'string') {
    return res.status(400).json({ error: 'questionId is required' });
  }

  if (typeof userAnswer !== 'number' || !Number.isInteger(userAnswer)) {
    return res.status(400).json({ error: 'userAnswer must be a number' });
  }

  try {
    const session = getTestSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'session not found' });
    }

    if (session.status === 'completed') {
      const summary = getTestSummary(sessionId);
      return res.status(200).json({ status: 'completed', summary });
    }

    const question = getTestQuestion(questionId);
    if (!question || question.sessionId !== sessionId) {
      return res.status(404).json({ error: 'question not found' });
    }

    if (question.userAnswer !== null && question.userAnswer !== undefined) {
      return res.status(400).json({ error: 'question already answered' });
    }

    const isCorrect = question.answer === userAnswer;
    updateTestQuestionAnswer({ questionId, userAnswer, isCorrect });

    const questions = listTestQuestions(sessionId);
    const answeredCount = questions.filter(q => q.userAnswer !== null).length;
    const totalQuestions = session.totalQuestions;

    const basePayload = {
      isCorrect,
      questionResult: {
        id: question.id,
        sessionId,
        index: question.questionIndex,
        answer: question.answer,
        userAnswer,
        explanation: question.explanation,
        isCorrect,
      },
    };

    if (answeredCount >= totalQuestions) {
      const correctCount = questions.filter(q => q.isCorrect).length;
      completeTestSession(sessionId, { score: correctCount });
      const summary = getTestSummary(sessionId);

      return res.status(200).json({
        status: 'completed',
        ...basePayload,
        summary,
      });
    }

    const nextIndex = questions.length + 1;
    const quiz = await generateQuiz({ prompt: session.prompt, difficulty: session.difficulty });
    const nextQuestion = insertTestQuestion({
      id: randomUUID(),
      sessionId,
      questionIndex: nextIndex,
      question: quiz.question,
      choices: quiz.choices,
      answer: quiz.answer,
      explanation: quiz.explanation,
    });

    try {
      appendHistory({
        id: nextQuestion.id,
        prompt: session.prompt,
        difficulty: session.difficulty,
        question: nextQuestion.question,
        choices: nextQuestion.choices,
        answer: nextQuestion.answer,
        explanation: nextQuestion.explanation,
        createdAt: nextQuestion.createdAt,
      });
    } catch (historyError) {
      console.error('Failed to save test question to history:', historyError);
    }

    return res.status(200).json({
      status: 'in-progress',
      ...basePayload,
      nextQuestion: {
        id: nextQuestion.id,
        sessionId,
        index: nextQuestion.questionIndex,
        question: nextQuestion.question,
        choices: nextQuestion.choices,
        answer: nextQuestion.answer,
        explanation: nextQuestion.explanation,
      },
      progress: {
        answered: answeredCount,
        total: totalQuestions,
        nextIndex,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : '回答処理に失敗しました' });
  }
}
