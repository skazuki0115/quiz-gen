import { randomUUID } from 'node:crypto';
import { appendHistory } from '../../lib/history';

const DIFFICULTY_RULES = {
  easy: '難易度は「かんたん」です。初学者でも理解しやすい基礎的な内容にしてください。',
  normal: '難易度は「ふつう」です。一般的な知識を問う、ややひねりのある問題にしてください。',
  hard: '難易度は「むずかしい」です。専門的な知識や応用的な思考を必要とする問題にしてください。',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST' });
  }

  const { prompt, difficulty } = req.body ?? {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const normalizedDifficulty =
    typeof difficulty === 'string' && DIFFICULTY_RULES[difficulty] ? difficulty : 'normal';
  const difficultyDirective = DIFFICULTY_RULES[normalizedDifficulty];

  const instruction = `テーマ「${prompt.trim()}」に基づいて、毎回ユニークな四択クイズを作成してください。
${difficultyDirective}
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

  try {
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

    const data = await response.json();
    let text = data?.choices?.[0]?.message?.content ?? JSON.stringify(data);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return res
          .status(500)
          .json({ error: 'モデル出力をJSONとして解析できませんでした', raw: text });
      }
    }

    if (
      !parsed.question ||
      !Array.isArray(parsed.choices) ||
      parsed.choices.length !== 4 ||
      typeof parsed.answer !== 'number'
    ) {
      return res.status(500).json({ error: 'モデル出力のフォーマットが正しくありません', parsed });
    }

    let choices = Array.from(new Set(parsed.choices));

    while (choices.length < 4) {
      choices.push('その他の選択肢' + Math.floor(Math.random() * 100));
    }

    choices = choices.sort(() => Math.random() - 0.5);

    const correctAnswerText = parsed.choices[parsed.answer];
    let newAnswerIndex = choices.indexOf(correctAnswerText);

    if (newAnswerIndex === -1) {
      choices[0] = correctAnswerText;
      newAnswerIndex = 0;
    }

    parsed.choices = choices;
    parsed.answer = newAnswerIndex;
    parsed.difficulty = normalizedDifficulty;
    parsed.explanation =
      typeof parsed.explanation === 'string' && parsed.explanation.trim().length > 0
        ? parsed.explanation.trim()
        : '正解の理由を特定できませんでした。';

    const historyEntry = {
      id: randomUUID(),
      prompt: prompt.trim(),
      difficulty: normalizedDifficulty,
      question: parsed.question,
      choices: parsed.choices,
      answer: parsed.answer,
      explanation: parsed.explanation,
      createdAt: new Date().toISOString(),
    };

    try {
      await appendHistory(historyEntry);
    } catch (writeError) {
      console.error('Failed to save quiz history:', writeError);
    }

    return res.status(200).json({ quiz: parsed });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'サーバーエラー', detail: String(err) });
  }
}
