// pages/api/generate-quiz.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST' });
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const instruction = `テーマ「${prompt}」に基づき、毎回ユニークな4択クイズを作成してください。
- 質問は毎回異なるもの
- 問題のジャンルはランダム
- 正答は1つだけ
- 選択肢は必ず4つで、同じ文字列を重複させないこと
- 選択肢の順番もランダムにしてください
- 問題に出てきてるものを選択肢に含めない
- 出題形式は、単純な「～はどれ？」だけでなく、「次のうち正しいものは？」「誤っているのはどれ？」なども混ぜる
必ず次のJSON形式で出力してください：
{
  "question": "...",
  "choices": ["...","...","...","..."],
  "answer": 0
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that outputs a single JSON object only.' },
          { role: 'user', content: instruction }
        ],
        temperature: 0.9,  // バリエーションを出すために上げる
        max_tokens: 400
      }),
    });

    const data = await response.json();
    let text = data?.choices?.[0]?.message?.content ?? JSON.stringify(data);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return res.status(500).json({ error: 'モデルの出力をJSONとして解析できませんでした', raw: text });
      }
    }

    // フォーマットチェック
    if (!parsed.question || !Array.isArray(parsed.choices) || parsed.choices.length !== 4 || typeof parsed.answer !== 'number') {
      return res.status(500).json({ error: 'モデル出力のフォーマットが正しくありません', parsed });
    }

    // ① 選択肢の重複を削除
    let choices = Array.from(new Set(parsed.choices));

    // ② 4つに足りない場合はダミーで補充（必要に応じて変更可能）
    while (choices.length < 4) {
      choices.push('その他の選択肢' + Math.floor(Math.random() * 100));
    }

    // ③ 選択肢の順番をランダム化
    choices = choices.sort(() => Math.random() - 0.5);

    // ④ 正解インデックスを更新
    const correctAnswerText = parsed.choices[parsed.answer];
    const newAnswerIndex = choices.indexOf(correctAnswerText);

    parsed.choices = choices;
    parsed.answer = newAnswerIndex;

    return res.status(200).json({ quiz: parsed });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'サーバーエラー', detail: String(err) });
  }
}
