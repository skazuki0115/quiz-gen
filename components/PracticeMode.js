import Link from 'next/link';
import { useState } from 'react';
import QuestionCard from './QuestionCard';
import layout from '../styles/layout.module.css';
import ui from '../styles/ui.module.css';
import styles from '../styles/PracticeMode.module.css';

export default function PracticeMode({
  difficultyOptions,
  difficultyLabels,
  playSound,
  soundEnabled,
  toggleSound,
  onBack,
}) {
  const [prompt, setPrompt] = useState('');
  const [difficulty, setDifficulty] = useState('normal');
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const utilityBar = (
    <div className={layout.utilityBar}>
      <button type="button" className={ui.backButton} onClick={onBack}>
        モード選択へ戻る
      </button>
      <Link href="/history" className={ui.navButton}>
        履歴を見る
      </Link>
      <button
        type="button"
        className={`${ui.soundToggle}${soundEnabled ? '' : ` ${ui.soundToggleMuted}`}`}
        onClick={toggleSound}
        aria-pressed={soundEnabled}
      >
        {soundEnabled ? 'サウンド ON' : 'サウンド OFF'}
      </button>
    </div>
  );

  const handleGenerate = async event => {
    event?.preventDefault();
    playSound('click');
    setError(null);
    setQuiz(null);
    setSelected(null);
    setShowExplanation(false);

    if (!prompt.trim()) {
      setError('テーマを入力してください。');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, difficulty }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'クイズの生成に失敗しました。');
      } else {
        setQuiz(data.quiz);
      }
    } catch (err) {
      setError('通信エラーが発生しました: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChoice = index => {
    if (!quiz || selected !== null) return;
    const isCorrect = quiz.answer === index;
    playSound(isCorrect ? 'correct' : 'wrong');
    setSelected(index);
    setShowExplanation(true);
  };

  const handleRetry = () => {
    if (!prompt.trim()) {
      setError('テーマを入力してください。');
      return;
    }
    handleGenerate();
  };

  const handleStart = () => {
    playSound('click');
    setStarted(true);
    setError(null);
    setQuiz(null);
    setSelected(null);
    setShowExplanation(false);
  };

  const handleBackToIntro = () => {
    playSound('click');
    setStarted(false);
    setQuiz(null);
    setSelected(null);
    setShowExplanation(false);
    setError(null);
  };

  if (!started) {
    return (
      <div className={layout.modePage}>
        <div className={layout.modeContainer}>
          {utilityBar}
          <div className={styles.practiceIntro}>
            <div className={styles.practiceIntroCard}>
              <span className={ui.modeBadge}>練習モード</span>
              <h1>好きなテーマでいろんな問題を出力しよう！</h1>
              <p>
              </p>
              <ul className={styles.practiceBullets}>
                <li>一問一答形式</li>
                <li>テーマが思いつかない？ 最近の結果を参考にしてみよう！</li>
              </ul>
              <div className={styles.practiceIntroActions}>
                <button type="button" className={ui.button} onClick={handleStart}>
                  練習をはじめる
                </button>
                <Link href="/history" className={ui.secondaryButtonLink}>
                  最近の結果を見る
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const resultMessage =
    selected === null
      ? ''
      : selected === quiz.answer
        ? '正解です。'
        : `不正解です。正解は「${quiz.choices[quiz.answer]}」です。`;

  return (
    <div className={layout.modePage}>
      <div className={layout.modeContainer}>
        {utilityBar}

        <header className={styles.practiceHeader}>
          <div>
            <h1>練習クイズ</h1>
            <p>テーマと難易度を決めて AI クイズに挑戦しましょう</p>
          </div>
          <div className={styles.practiceHeaderMeta}>
            <span className={ui.metaBadge}>難易度: {difficultyLabels[difficulty]}</span>
          </div>
        </header>

        <form onSubmit={handleGenerate} className={styles.form}>
          <div className={styles.formStack}>
            <label className={styles.formLabel}>
              難易度
              <select
                value={difficulty}
                onChange={event => setDifficulty(event.target.value)}
                className={styles.select}
              >
                {difficultyOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.formLabel}>
              テーマ
              <input
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                placeholder="学びたいこと、好きなことを入れてみよう！"
                className={styles.input}
              />
            </label>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={ui.button} disabled={loading}>
              {loading ? '生成しています…' : 'クイズを生成'}
            </button>
            <button
              type="button"
              className={ui.secondaryButton}
              onClick={handleBackToIntro}
              disabled={loading}
            >
              概要に戻る
            </button>
          </div>
        </form>

        {error && <div className={ui.error}>{error}</div>}

        {quiz && (
          <QuestionCard
            question={quiz}
            selected={selected}
            onSelect={handleSelectChoice}
            disableChoices={selected !== null || loading}
            showExplanation={showExplanation}
            onToggleExplanation={() => {
              playSound('click');
              setShowExplanation(prev => !prev);
            }}
            resultMessage={resultMessage}
            isCorrect={selected !== null && selected === quiz.answer}
            footer={
              <div className={styles.actionRow}>
                <button type="button" className={ui.button} onClick={handleRetry} disabled={loading}>
                  もう1問生成
                </button>
                <Link href="/history" className={ui.secondaryButtonLink}>
                  履歴を開く
                </Link>
              </div>
            }
          />
        )}

        <footer className={layout.notice}>
          出題内容は AI が自動生成した参考情報です。正確性が必要な場合は改めて確認してください。
        </footer>
      </div>
    </div>
  );
}
