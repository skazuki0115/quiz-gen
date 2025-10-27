'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';
import styles from '../styles/Home.module.css';

const difficultyOptions = [
  { value: 'easy', label: 'かんたん' },
  { value: 'normal', label: 'ふつう' },
  { value: 'hard', label: 'むずかしい' },
];

const difficultyLabels = {
  easy: 'かんたん',
  normal: 'ふつう',
  hard: 'むずかしい',
};

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [difficulty, setDifficulty] = useState('normal');
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const audioContextRef = useRef(null);
  const masterGainRef = useRef(null);

  function ensureAudioContext() {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      const context = new AudioContextClass();
      const masterGain = context.createGain();
      masterGain.gain.value = soundEnabled ? 0.35 : 0;
      masterGain.connect(context.destination);
      audioContextRef.current = context;
      masterGainRef.current = masterGain;
    }

    return audioContextRef.current;
  }

  function playSound(kind) {
    if (!soundEnabled) return;

    const context = ensureAudioContext();
    const masterGain = masterGainRef.current;
    if (!context || !masterGain) return;

    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }

    const now = context.currentTime;
    let tonePlan;

    switch (kind) {
      case 'click':
        tonePlan = [{ frequency: 520, duration: 0.1, type: 'square', volume: 0.45 }];
        break;
      case 'correct':
        tonePlan = [
          { frequency: 660, duration: 0.18, type: 'triangle', volume: 0.5 },
          { frequency: 880, duration: 0.22, type: 'triangle', volume: 0.45, delay: 0.16 },
        ];
        break;
      case 'wrong':
        tonePlan = [
          { frequency: 320, duration: 0.26, type: 'sawtooth', volume: 0.45 },
          { frequency: 220, duration: 0.32, type: 'square', volume: 0.35, delay: 0.08 },
        ];
        break;
      default:
        tonePlan = [];
    }

    tonePlan.forEach(({ frequency, duration, type = 'sine', delay = 0, volume = 0.5 }) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now + delay);

      envelope.gain.setValueAtTime(0.0001, now + delay);
      envelope.gain.linearRampToValueAtTime(volume, now + delay + 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);

      oscillator.connect(envelope);
      envelope.connect(masterGain);

      oscillator.start(now + delay);
      oscillator.stop(now + delay + duration + 0.05);
    });
  }

  function toggleSound() {
    const willEnable = !soundEnabled;
    const context = ensureAudioContext();

    setSoundEnabled(prev => {
      const next = !prev;
      if (masterGainRef.current && context) {
        const targetValue = next ? 0.35 : 0;
        masterGainRef.current.gain.setTargetAtTime(targetValue, context.currentTime, 0.02);
      }
      if (next && context && context.state === 'suspended') {
        context.resume().catch(() => {});
      }
      return next;
    });

    if (willEnable) {
      setTimeout(() => playSound('click'), 0);
    }
  }

  async function generateQuiz(event) {
    event?.preventDefault();
    playSound('click');
    setError(null);
    setQuiz(null);
    setSelected(null);
    setShowExplanation(false);

    if (!prompt.trim()) {
      setError('テーマを入力してください');
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
        setError(data.error || '生成に失敗しました');
      } else {
        setQuiz(data.quiz);
        setShowExplanation(false);
      }
    } catch (err) {
      setError('通信エラー: ' + String(err));
    } finally {
      setLoading(false);
    }
  }

  function selectChoice(index) {
    if (selected !== null || !quiz) return;
    const isCorrect = index === quiz.answer;
    playSound(isCorrect ? 'correct' : 'wrong');
    setSelected(index);
    setShowExplanation(false);
  }

  function handleStart() {
    playSound('click');
    setStarted(true);
    setError(null);
    setQuiz(null);
    setSelected(null);
    setShowExplanation(false);
  }

  function handleRetry() {
    playSound('click');
    if (!prompt.trim()) {
      setError('テーマを入力してください');
      return;
    }
    generateQuiz();
  }

  function handleBackToStart() {
    playSound('click');
    setStarted(false);
    setQuiz(null);
    setSelected(null);
    setShowExplanation(false);
    setError(null);
  }

  function handleToggleExplanation() {
    playSound('click');
    setShowExplanation(prev => !prev);
  }

  const soundToggleLabel = soundEnabled ? '🔊 サウンドON' : '🔇 ミュート中';
  const soundToggleClassName = `${styles.soundToggle}${
    soundEnabled ? '' : ` ${styles.soundToggleMuted}`
  }`;

  if (!started) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.utilityBar}>
            <Link href="/history" className={styles.navButton}>
              履歴を見る
            </Link>
            <button
              type="button"
              className={soundToggleClassName}
              onClick={toggleSound}
              aria-pressed={soundEnabled}
              title="サウンドのオン/オフを切り替え"
            >
              {soundToggleLabel}
            </button>
          </div>
          <h1 className={styles.title}>クイズ自動生成（プロトタイプ！）</h1>
          <div className={styles.startScreen}>
            <div className={styles.logoBadge}>AI Quiz Lab</div>
            <p className={styles.startDescription}>
              テーマを入力すると、AIがユニークな4択クイズを生成します。まずは難易度を選んでスタートしましょう。
            </p>
            <div className={styles.difficultyGroup}>
              <span className={styles.difficultyLabel}>難易度を選択してください</span>
              <div className={styles.difficultyOptions}>
                {difficultyOptions.map(option => (
                  <label
                    key={option.value}
                    className={`${styles.difficultyOption}${
                      difficulty === option.value ? ` ${styles.difficultyOptionActive}` : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      value={option.value}
                      checked={difficulty === option.value}
                      onChange={event => setDifficulty(event.target.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
            <button type="button" className={styles.button} onClick={handleStart}>
              スタート
            </button>
          </div>
          <footer className={styles.notice}>
            ※回答内容が必ずしも正しいとは限りません
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {loading && (
        <div className={styles.loadingOverlay} aria-live="assertive">
          <div className={styles.spinner} />
          <span>クイズを生成しています...</span>
        </div>
      )}

      <div className={styles.container}>
        <div className={styles.utilityBar}>
          <Link href="/history" className={styles.navButton}>
            履歴を見る
          </Link>
          <button
            type="button"
            className={soundToggleClassName}
            onClick={toggleSound}
            aria-pressed={soundEnabled}
            title="サウンドのオン/オフを切り替え"
          >
            {soundToggleLabel}
          </button>
        </div>

        <header className={styles.gameHeader}>
          <div className={styles.appLogo}>AI Quiz Lab</div>
          <div className={styles.headerMeta}>
            <span className={`${styles.difficultyBadge} ${styles[`difficultyBadge${difficulty}`]}`}>
              難易度: {difficultyLabels[difficulty]}
            </span>
            {prompt && <span className={styles.currentPrompt}>テーマ: {prompt}</span>}
          </div>
        </header>

        <form onSubmit={generateQuiz} className={styles.form}>
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
                placeholder="例）江戸時代の文化、最新テクノロジー"
                className={styles.input}
              />
            </label>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? '生成中...' : 'クイズを生成'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleBackToStart}
              disabled={loading}
            >
              スタート画面に戻る
            </button>
          </div>
        </form>

        {error && <div className={styles.error}>{error}</div>}

        {quiz && (
          <div className={styles.quizBox}>
            <div className={styles.quizHeader}>
              <span className={styles.quizBadge}>Question</span>
              <span className={styles.quizMeta}>AIが生成したオリジナル問題です</span>
            </div>
            <p className={styles.quizQuestion}>{quiz.question}</p>

            <div className={styles.choiceList}>
              {quiz.choices.map((choice, index) => {
                let classNames = styles.choiceButton;
                if (selected !== null) {
                  if (index === quiz.answer) classNames += ` ${styles.correct}`;
                  else if (index === selected) classNames += ` ${styles.wrong}`;
                }

                return (
                  <button
                    key={index}
                    onClick={() => selectChoice(index)}
                    className={classNames}
                    disabled={selected !== null}
                  >
                    <span className={styles.choicePrefix}>{String.fromCharCode(65 + index)}</span>
                    <span className={styles.choiceText}>{choice}</span>
                  </button>
                );
              })}
            </div>

            {selected !== null && (
              <div
                className={`${styles.result} ${
                  selected === quiz.answer ? styles.resultCorrect : styles.resultWrong
                }`}
              >
                {selected === quiz.answer
                  ? '正解です！よくできました。'
                  : `不正解。正解は「${quiz.choices[quiz.answer]}」です。`}
              </div>
            )}

            {selected !== null && quiz.explanation && (
              <div className={styles.explanationSection}>
                <button
                  type="button"
                  className={`${styles.explanationToggle}${
                    showExplanation ? ` ${styles.explanationToggleActive}` : ''
                  }`}
                  onClick={handleToggleExplanation}
                >
                  {showExplanation ? '解説を閉じる' : '解説を見る'}
                </button>
                {showExplanation && (
                  <div className={styles.explanationCard}>
                    <div className={styles.explanationHeader}>
                      <span>解説</span>
                      <span className={styles.explanationBadge}>AI生成</span>
                    </div>
                    <p className={styles.explanationBody}>{quiz.explanation}</p>
                    <p className={styles.explanationNotice}>
                      ※この解説はAIが生成しました。内容の正確性には注意してください。
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.button}
                onClick={handleRetry}
                disabled={loading}
              >
                もう一問生成
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleBackToStart}
                disabled={loading}
              >
                難易度を選び直す
              </button>
            </div>
          </div>
        )}

        <footer className={styles.notice}>※回答内容が必ずしも正しいとは限りません</footer>
      </div>
    </div>
  );
}
