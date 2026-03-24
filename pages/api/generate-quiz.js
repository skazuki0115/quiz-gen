import { randomUUID } from 'node:crypto';
import { appendHistory } from '../../lib/history';
import { generateQuiz, normalizeDifficulty } from '../../lib/quizGenerator';
import { queryChunks, recordChunkUsage } from '../../lib/vectorStore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST' });
  }

  const { prompt, difficulty, sourceText, pdfFilename, pdfIndexId, chapterId } = req.body ?? {};
  const hasPrompt = typeof prompt === 'string' && prompt.trim() !== '';
  const hasSource = typeof sourceText === 'string' && sourceText.trim() !== '';
  const useRag = typeof pdfIndexId === 'string' && pdfIndexId.length > 0;

  if (!hasPrompt && !hasSource && !useRag) {
    return res.status(400).json({ error: 'テーマを入力するかPDFを読み込んでください。' });
  }

  try {
    let contextChunks = [];

    if (useRag) {
      const queryText = hasPrompt ? prompt : sourceText || 'この章の内容';
      const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: queryText,
        }),
      });

      if (!embedRes.ok) {
        const text = await embedRes.text();
        throw new Error(`Embedding failed: ${text}`);
      }

      const embedPayload = await embedRes.json();
      const embedding = embedPayload?.data?.[0]?.embedding;
      if (Array.isArray(embedding)) {
        contextChunks = queryChunks({
          pdfId: pdfIndexId,
          chapterId: chapterId ?? null,
          queryEmbedding: embedding,
          limit: 6,
        });
      }
    }

    const quiz = await generateQuiz({
      prompt: hasPrompt ? prompt : '',
      sourceText: useRag ? '' : hasSource ? sourceText : '',
      difficulty: normalizeDifficulty(difficulty),
      contextChunks,
      chapterId,
      pdfId: pdfIndexId,
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
        pdfId: pdfIndexId ?? null,
        chapterId: chapterId ?? null,
        chapterTitle: quiz.chapterTitle ?? null,
        chunkIds: quiz.usedChunkIds ?? [],
        createdAt: new Date().toISOString(),
      });

      if (useRag && Array.isArray(quiz.usedChunkIds) && quiz.usedChunkIds.length > 0) {
        recordChunkUsage({
          quizId: quiz.id,
          chunkIds: quiz.usedChunkIds,
          pdfId: pdfIndexId,
          chapterId: chapterId ?? null,
        });
      }
    } catch (historyError) {
      console.error('Failed to save quiz history:', historyError);
    }

    return res.status(200).json({ quiz });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : '生成に失敗しました' });
  }
}
