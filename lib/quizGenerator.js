import { randomUUID } from 'node:crypto';

export const DIFFICULTY_RULES = {
  easy: '難易度は「かんたん」です。小中学生でも理解しやすい基礎的な問題にしてください。',
  normal: '難易度は「ふつう」です。一般的な知識を問う、やりごたえのある問題にしてください。',
  hard: '難易度は「むずかしい」です。専門的な知識や応用的な思考が求められる問題にしてください。',
};

const FALLBACK_EXPLANATION = '正解の根拠を特定できませんでした。';
const SOURCE_TEXT_LIMIT = 2000;

export function normalizeDifficulty(value) {
  if (typeof value !== 'string') return 'normal';
  return DIFFICULTY_RULES[value] ? value : 'normal';
}

function sanitizeSourceText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\u0000/g, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, SOURCE_TEXT_LIMIT);
}

function buildInstruction({ prompt, difficulty, sourceText, contextChunks, chapterId }) {
  const trimmedPrompt = prompt?.trim();
  const directive = DIFFICULTY_RULES[difficulty];
  const topicLabel = trimmedPrompt && trimmedPrompt.length > 0 ? trimmedPrompt : 'アップロードされた資料';
  const context = sanitizeSourceText(sourceText);
  const chapterLabel = chapterId ? `章: ${chapterId}` : '指定章';

  const ragContext =
    Array.isArray(contextChunks) && contextChunks.length > 0
      ? contextChunks
          .map((chunk, idx) => {
            const header = chunk.chapterTitle ? `${chunk.chapterTitle}` : chapterLabel;
            return `#${idx + 1} [${header}] ${chunk.text}`;
          })
          .join('\n---\n')
      : '';

  const contextBlock = ragContext
    ? `\n以下のコンテキストのみを根拠に、日本語で四択クイズを作ってください。コンテキスト外の知識は使わないこと。\n---\n${ragContext}\n---\n`
    : context
      ? `\n以下は教材となる本文抜粋です。必ずここに書かれた内容から答えが導ける問題にし、本文と矛盾しないようにしてください。\n---\n${context}\n---\n`
      : '';

  return `テーマ「${topicLabel}」に基づいて、毎回ユニークな四択クイズを作成してください。
${directive}
- 質問文は毎回異なる内容にすること。
- 正答は必ず1つにすること。
- 選択肢は4つ用意し、似通った表現を避けること。
- 選択肢の並び順はランダムにすること。
- 固有名詞をそのまま選択肢にコピペしないこと。
- 「〜はどれ？」だけでなく「誤っているのはどれ？」など複数の出題形式を活用すること。
- 正解に至る理由を100文字以上で説明し、回答の根拠がわかるようにすること。
- コンテキスト外の情報は使わないこと。根拠が不足する場合は「情報不足」と回答すること。
${contextBlock}
以下をJSON形式で出力してください。
{
  "question": "...",
  "choices": ["...","...","...","..."],
  "answer": 0,
  "explanation": "...", // 日本語で、正解の根拠を含めてください
  "references": ["chunk-id-1", "chunk-id-2"] // 使ったチャンクIDを含める
}`;
}

export async function generateQuiz({ prompt, difficulty, sourceText, contextChunks = [], chapterId, pdfId }) {
  const trimmedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
  const trimmedSource = typeof sourceText === 'string' ? sourceText.trim() : '';
  const hasContextChunks = Array.isArray(contextChunks) && contextChunks.length > 0;

  if (!trimmedPrompt && !trimmedSource && !hasContextChunks) {
    throw new Error('テーマまたは教材本文を入力してください。');
  }

  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const instruction = buildInstruction({
    prompt: trimmedPrompt,
    difficulty: normalizedDifficulty,
    sourceText: trimmedSource,
    contextChunks,
    chapterId,
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that outputs a single JSON object only.',
        },
        { role: 'user', content: instruction },
      ],
      temperature: 0.7,
      max_tokens: 450,
    }),
  });

  const payload = await response.json();
  let text = payload?.choices?.[0]?.message?.content ?? JSON.stringify(payload);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error('AIの出力を正しく解析できませんでした。');
    }
  }

  if (
    !parsed.question ||
    !Array.isArray(parsed.choices) ||
    parsed.choices.length !== 4 ||
    typeof parsed.answer !== 'number'
  ) {
    throw new Error('AIの出力フォーマットが想定と異なります。');
  }

  let choices = Array.from(new Set(parsed.choices));
  while (choices.length < 4) {
    choices.push(`その他の選択肢${Math.floor(Math.random() * 100)}`);
  }

  const shuffled = shuffleArray(choices);
  const correctText = parsed.choices[parsed.answer];
  let answerIndex = shuffled.indexOf(correctText);
  if (answerIndex === -1) {
    shuffled[0] = correctText;
    answerIndex = 0;
  }

  const explanation =
    typeof parsed.explanation === 'string' && parsed.explanation.trim().length > 0
      ? parsed.explanation.trim()
      : FALLBACK_EXPLANATION;

  return {
    id: randomUUID(),
    question: parsed.question,
    choices: shuffled,
    answer: answerIndex,
    explanation,
    difficulty: normalizedDifficulty,
    usedChunkIds: hasContextChunks ? contextChunks.map(chunk => chunk.id) : [],
    chapterTitle: contextChunks?.[0]?.chapterTitle ?? null,
    pdfId: pdfId ?? null,
  };
}

function shuffleArray(source) {
  const arr = [...source];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
