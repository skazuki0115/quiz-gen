import { useState } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  async function generateQuiz(e) {
    e?.preventDefault();
    setError(null);
    setQuiz(null);
    setSelected(null);

    if (!prompt.trim()) {
      setError('テーマを入力してください');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || '生成に失敗しました');
      else setQuiz(data.quiz);
    } catch (e) {
      setError('通信エラー: ' + String(e));
    } finally {
      setLoading(false);
    }
  }

  function selectChoice(i) {
    if (selected !== null) return;
    setSelected(i);
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>クイズ自動生成（プロトタイプ）</h1>

      <form onSubmit={generateQuiz} className={styles.form}>
        <label>
          テーマ
          <input
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="テーマを入力"
            className={styles.input}
          />
        </label>
        <div style={{ marginTop: 8 }}>
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? '生成中...' : 'クイズを生成'}
          </button>
        </div>
      </form>

      {error && <div className={styles.error}>{error}</div>}

      {quiz && (
        <div className={styles.quizBox}>
          <h2>問題</h2>
          <p className={styles.quizQuestion}>{quiz.question}</p>

          <div>
            {quiz.choices.map((choice, i) => {
              let classNames = styles.choiceButton;
              if (selected !== null) {
                if (i === quiz.answer) classNames += ` ${styles.correct}`;
                else if (i === selected) classNames += ` ${styles.wrong}`;
              }

              return (
                <button
                  key={i}
                  onClick={() => selectChoice(i)}
                  className={classNames}
                  disabled={selected !== null}
                >
                  {choice}
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <div className={styles.result}>
              {selected === quiz.answer
                ? '正解！'
                : `不正解。正解は「${quiz.choices[quiz.answer]}」です。`}
            </div>
          )}
        </div>
      )}
            {/* 注意文 */}
            <footer className="fixed bottom-0 w-full text-center text-gray-300 text-sm py-2 bg-white">
            ※回答は必ずしも正しいとは限りません
            </footer>
    </div>
  );
}
