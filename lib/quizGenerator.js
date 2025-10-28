import { randomUUID } from 'node:crypto';

export const DIFFICULTY_RULES = {
  easy: '難易度は「かんたん」です。初学者でも理解しやすい基礎的な内容にしてください。',
  normal: '難易度は「ふつう」です。一般的な知識を問う、ややひねりのある問題にしてください。',
  hard: '難易度は「むずかしい」です。専門的な知識や応用的な思考を必要とする問題にしてください。',
};

const FALLBACK_EXPLANATION = '正解の理由を特定できませんでした。';

export function normalizeDifficulty(value) {
  if (typeof value !== 'string') return 'normal';
  return DIFFICULTY_RULES[value] ? value : 'normal';
}

function buildInstruction(prompt, difficulty) {
  const trimmed = prompt.trim();
  const directive = DIFFICULTY_RULES[difficulty];
  return `テーマ「${trimmed}」に基づいて、毎回ユニークな四択クイズを作成してください。
${directive}
- 質問文は毎回異なる内容にすること。
- 正答は必ず1つにすること。
- 選択肢は必ず4つ用意し、同じ文字列を繰り返さないこと。
- 選択肢の並び順はランダムにすること。
- 質問文に登場する固有名詞をそのまま選択肢に流用しないこと。
- 出題形式は「～はどれ？」だけでなく、「誤っているのはどれ？」など複数のパターンを活用すること。
- 正解にたどり着く理由を説明する200文字以内の解説も準備し、回答の根拠が分かるようにすること。

以下のJSON形式で出力してください。
{
  "question": "...",
  "choices": ["...","...","...","..."],
  "answer": 0,
  "explanation": "..." // 日本語で、正解の理由と主要な根拠を含めてください
}`;
}

export async function generateQuiz({ prompt, difficulty }) {
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    throw new Error('テーマを入力してください。');
  }

  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const instruction = buildInstruction(prompt, normalizedDifficulty);

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
      temperature: 0.9,
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
    choices.push('その他の選択肢' + Math.floor(Math.random() * 100));
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
