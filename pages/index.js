'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
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

const modeCards = [
  {
    id: 'practice',
    title: '自由演習モード',
    tagline: '興味のあるテーマでAIと演習',
    description:
      '気になるテーマと難易度を入力すると、その場で四択クイズが自動生成されます。解説つきなので、自分のペースで理解を深められます。',
    accent: 'blue',
    highlights: ['テーマと難易度をその都度選択', '生成した問題は履歴に保存', '解説つきで復習が容易'],
  },
  {
    id: 'test',
    title: 'チャレンジテスト',
    tagline: '3問連続の本番形式',
    description:
      '来場者の名前とテーマを登録すると、同じ条件で3問が連続出題されます。最後に結果と出題内容をまとめて振り返ることができます。',
    accent: 'purple',
    highlights: ['3問連続で実施', '回答履歴と正解をまとめて確認', 'URLで結果ページを共有可能'],
  },
];

export default function Home() {
  const [mode, setMode] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioContextRef = useRef(null);
  const masterGainRef = useRef(null);

  const ensureAudioContext = () => {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      const context = new AudioContextClass();
      const masterGain = context.createGain();
      masterGain.gain.value = soundEnabled ? 0.3 : 0;
      masterGain.connect(context.destination);
      audioContextRef.current = context;
      masterGainRef.current = masterGain;
    }

    return audioContextRef.current;
  };

  const playSound = type => {
    if (!soundEnabled) return;

    const context = ensureAudioContext();
    const masterGain = masterGainRef.current;
    if (!context || !masterGain) return;

    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }

    const now = context.currentTime;
    let tonePlan;

    switch (type) {
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

    tonePlan.forEach(({ frequency, duration, type: wave = 'sine', delay = 0, volume = 0.5 }) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();

      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, now + delay);

      envelope.gain.setValueAtTime(0.0001, now + delay);
      envelope.gain.linearRampToValueAtTime(volume, now + delay + 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);

      oscillator.connect(envelope);
      envelope.connect(masterGain);

      oscillator.start(now + delay);
      oscillator.stop(now + delay + duration + 0.05);
    });
  };

  const toggleSound = () => {
    const willEnable = !soundEnabled;
    const context = ensureAudioContext();

    setSoundEnabled(prev => {
      const next = !prev;
      if (masterGainRef.current && context) {
        const targetValue = next ? 0.3 : 0;
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
  };

  if (!mode) {
    return (
      <ModeSelection
        onSelect={selectedMode => {
          playSound('click');
          setMode(selectedMode);
        }}
        soundEnabled={soundEnabled}
        toggleSound={toggleSound}
      />
    );
  }

  if (mode === 'practice') {
    return (
      <PracticeMode
        difficultyOptions={difficultyOptions}
        difficultyLabels={difficultyLabels}
        playSound={playSound}
        soundEnabled={soundEnabled}
        toggleSound={toggleSound}
        onBack={() => {
          playSound('click');
          setMode(null);
        }}
      />
    );
  }

  return (
    <TestMode
      difficultyOptions={difficultyOptions}
      difficultyLabels={difficultyLabels}
      playSound={playSound}
      soundEnabled={soundEnabled}
      toggleSound={toggleSound}
      onBack={() => {
        playSound('click');
        setMode(null);
      }}
    />
  );
}

function ModeSelection({ onSelect, soundEnabled, toggleSound }) {
  return (
    <div className={styles.selectionPage}>
      <div className={styles.heroDecorations}>
        <div className={styles.heroBlobOne} />
        <div className={styles.heroBlobTwo} />
        <div className={styles.heroGrid} />
      </div>

      <header className={styles.selectionHeader}>
        <div className={styles.brandMark}>AI Quiz Lab</div>
        <div className={styles.selectionActions}>
          <Link href="/history" className={styles.navButton}>
            履歴を見る
          </Link>
          <button
            type="button"
            className={`${styles.soundToggle}${soundEnabled ? '' : ` ${styles.soundToggleMuted}`}`}
            onClick={toggleSound}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? 'サウンド ON' : 'サウンド OFF'}
          </button>
        </div>
      </header>

      <main className={styles.heroContent}>
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>学際展示向け AI クイズ体験</p>
          <h1 className={styles.heroTitle}>
            興味のあるテーマを入力すると、
            <span className={styles.heroHighlight}>AI がその場でオリジナル問題を作成します</span>
          </h1>
          <p className={styles.heroDescription}>
            自由に演習したいときはその都度テーマを指定。来場者が腕試ししたいときは 3 問勝負のチャレンジテストに挑戦。AI が生成した解説とともに、学びの記録をわかりやすく残せます。
          </p>
          <ul className={styles.heroList}>
            <li>テーマ入力だけで四択クイズを即時生成</li>
            <li>解説つきの履歴保存で振り返りも簡単</li>
            <li>展示での操作が分かりやすい画面構成</li>
          </ul>
        </div>

        <div className={styles.modeCards}>
          {modeCards.map(card => (
            <button
              type="button"
              key={card.id}
              className={`${styles.modeCard} ${styles[`modeCard${capitalize(card.accent)}`]}`}
              onClick={() => onSelect(card.id)}
            >
              <div className={styles.modeCardHeader}>
                <span className={styles.modeBadge}>{card.tagline}</span>
                <h2>{card.title}</h2>
              </div>
              <p className={styles.modeCardDescription}>{card.description}</p>
              <ul className={styles.modeHighlightList}>
                {card.highlights.map(point => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <span className={styles.modeCardCta}>このモードを選択する</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function PracticeMode({
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
    <div className={styles.utilityBar}>
      <button type="button" className={styles.backButton} onClick={onBack}>
        モードを選び直す
      </button>
      <Link href="/history" className={styles.navButton}>
        履歴を見る
      </Link>
      <button
        type="button"
        className={`${styles.soundToggle}${soundEnabled ? '' : ` ${styles.soundToggleMuted}`}`}
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
      <div className={styles.modePage}>
        <div className={styles.modeContainer}>
          {utilityBar}
          <div className={styles.practiceIntro}>
            <div className={styles.practiceIntroCard}>
              <span className={styles.modeBadge}>自由演習モード</span>
              <h1>テーマを入力して AI クイズをすぐに体験</h1>
              <p>
                テーマと難易度を選ぶだけで、AI がその場で四択クイズを生成します。解説つきなので、演習と復習をセットで進められます。
              </p>
              <ul className={styles.practiceBullets}>
                <li>難易度は「かんたん / ふつう / むずかしい」から選択</li>
                <li>生成した問題と解説は履歴に自動保存</li>
                <li>来場者にも説明しやすいシンプルな操作</li>
              </ul>
              <div className={styles.practiceIntroActions}>
                <button type="button" className={styles.button} onClick={handleStart}>
                  自由演習を始める
                </button>
                <Link href="/history" className={styles.secondaryButtonLink}>
                  最近の生成結果を見る
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
    <div className={styles.modePage}>
      <div className={styles.modeContainer}>
        {utilityBar}

        <header className={styles.practiceHeader}>
          <div>
            <h1>自由演習</h1>
            <p>テーマと難易度を設定し、AI クイズに挑戦しましょう。</p>
          </div>
          <div className={styles.practiceHeaderMeta}>
            <span className={styles.metaBadge}>学習向けモード</span>
            <span className={styles.metaBadge}>難易度: {difficultyLabels[difficulty]}</span>
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
                placeholder="例）江戸時代の暮らし、再生可能エネルギー、世界の建築様式"
                className={styles.input}
              />
            </label>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? '問題を生成しています…' : 'クイズを生成'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleBackToIntro}
              disabled={loading}
            >
              概要に戻る
            </button>
          </div>
        </form>

        {error && <div className={styles.error}>{error}</div>}

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
                <button type="button" className={styles.button} onClick={handleRetry} disabled={loading}>
                  もう一問生成
                </button>
                <Link href="/history" className={styles.secondaryButtonLink}>
                  履歴を表示
                </Link>
              </div>
            }
          />
        )}

        <footer className={styles.notice}>
          ※生成される解説は AI が作成した内容です。必ずしも正確とは限りません。
        </footer>
      </div>
    </div>
  );
}

function TestMode({
  difficultyOptions,
  difficultyLabels,
  playSound,
  soundEnabled,
  toggleSound,
  onBack,
}) {
  const [formValues, setFormValues] = useState({
    userName: '',
    prompt: '',
    difficulty: 'normal',
  });
  const [stage, setStage] = useState('form');
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [pendingNext, setPendingNext] = useState(null);
  const [progress, setProgress] = useState({ answered: 0, total: 3, current: 1 });
  const [summary, setSummary] = useState(null);
  const [readyForSummary, setReadyForSummary] = useState(false);
  const [isWaitingForNext, setIsWaitingForNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const utilityBar = (
    <div className={styles.utilityBar}>
      <button type="button" className={styles.backButton} onClick={onBack}>
        モードを選び直す
      </button>
      <Link href="/history" className={styles.navButton}>
        履歴を見る
      </Link>
      <button
        type="button"
        className={`${styles.soundToggle}${soundEnabled ? '' : ` ${styles.soundToggleMuted}`}`}
        onClick={toggleSound}
        aria-pressed={soundEnabled}
      >
        {soundEnabled ? 'サウンド ON' : 'サウンド OFF'}
      </button>
    </div>
  );

  const handleInputChange = event => {
    const { name, value } = event.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const handleStartTest = async event => {
    event?.preventDefault();
    playSound('click');
    setError(null);

    if (!formValues.userName.trim()) {
      setError('ユーザー名を入力してください。');
      return;
    }
    if (!formValues.prompt.trim()) {
      setError('テーマを入力してください。');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/test/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: formValues.userName,
          prompt: formValues.prompt,
          difficulty: formValues.difficulty,
          totalQuestions: 3,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'テストの開始に失敗しました。');
        return;
      }

      setSession(data.session);
      setCurrentQuestion(data.question);
      setSelected(null);
      setShowExplanation(false);
      setPendingNext(null);
      setReadyForSummary(false);
      setSummary(null);
      setProgress({ answered: 0, total: data.session.totalQuestions, current: 1 });
      setStage('question');
    } catch (err) {
      setError('通信エラーが発生しました: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChoice = async index => {
    if (!currentQuestion || selected !== null || loading || !session) return;

    setSelected(index);
    setShowExplanation(true);
    playSound(currentQuestion.answer === index ? 'correct' : 'wrong');
    setLoading(true);
    setIsWaitingForNext(true);

    try {
      const res = await fetch('/api/test/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          questionId: currentQuestion.id,
          userAnswer: index,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '回答の送信に失敗しました。');
        return;
      }

      setSession(prev => ({ ...prev, status: data.status === 'completed' ? 'completed' : 'active' }));

      if (data.status === 'completed') {
        setSummary(data.summary);
        setReadyForSummary(true);
        setPendingNext(null);
        setProgress(prev => ({ ...prev, answered: prev.total, current: prev.total }));
      } else {
        setPendingNext({
          question: data.nextQuestion,
          progress: {
            answered: data.progress.answered,
            total: data.progress.total,
            current: data.progress.nextIndex,
          },
        });
      }
    } catch (err) {
      setError('通信エラーが発生しました: ' + String(err));
    } finally {
      setLoading(false);
      setIsWaitingForNext(false);
    }
  };

  const handleNextQuestion = () => {
    if (!pendingNext) return;
    playSound('click');
    setCurrentQuestion(pendingNext.question);
    setProgress(pendingNext.progress);
    setSelected(null);
    setShowExplanation(false);
    setPendingNext(null);
    setError(null);
  };

  const handleShowSummary = () => {
    playSound('click');
    setStage('summary');
  };

  const testSummary = useMemo(() => {
    if (!summary) return null;
    return {
      ...summary,
      stats: {
        ...summary.stats,
        label: `${summary.stats.correctCount} / ${summary.stats.totalQuestions} 問正解`,
      },
    };
  }, [summary]);

  if (stage === 'form') {
    return (
      <div className={styles.modePage}>
        <div className={styles.modeContainer}>
          {utilityBar}
          <div className={styles.testIntro}>
            <div className={styles.practiceIntroCard}>
              <span className={styles.modeBadge}>チャレンジテスト</span>
              <h1>3 問連続のテストで成果を記録</h1>
              <p>
                来場者の名前とテーマ、難易度を設定すると、同じ条件で 3 問が連続出題されます。正解数と出題内容は結果ページにまとまり、URL を共有することもできます。
              </p>
            </div>
            <form className={styles.testForm} onSubmit={handleStartTest}>
              <h2>テストの設定</h2>
              <label className={styles.formLabel}>
                ユーザー名
                <input
                  name="userName"
                  value={formValues.userName}
                  onChange={handleInputChange}
                  className={styles.input}
                  placeholder="例）展示スタッフA、来場者Bさん"
                />
              </label>
              <label className={styles.formLabel}>
                テーマ
                <input
                  name="prompt"
                  value={formValues.prompt}
                  onChange={handleInputChange}
                  className={styles.input}
                  placeholder="例）宇宙開発の歴史、環境問題、音楽理論"
                />
              </label>
              <label className={styles.formLabel}>
                難易度
                <select
                  name="difficulty"
                  value={formValues.difficulty}
                  onChange={handleInputChange}
                  className={styles.select}
                >
                  {difficultyOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" className={styles.button} disabled={loading}>
                {loading ? '準備しています…' : 'テストを開始'}
              </button>
              {error && <div className={styles.error}>{error}</div>}
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'summary' && testSummary) {
    return (
      <div className={styles.modePage}>
        <div className={styles.modeContainer}>
          {utilityBar}
          <header className={styles.testHeader}>
            <div>
              <h1>{testSummary.session.userName} さんの結果</h1>
              <p>
                テーマ: {testSummary.session.prompt} / 難易度: {difficultyLabels[testSummary.session.difficulty]}
              </p>
            </div>
            <div className={styles.summaryActions}>
              <Link href={`/test/${testSummary.session.id}`} className={styles.secondaryButtonLink}>
                結果ページを表示
              </Link>
              <button type="button" className={styles.button} onClick={onBack}>
                モードを選び直す
              </button>
            </div>
          </header>

          <section className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>正解数</span>
              <span className={styles.summaryValue}>{testSummary.stats.label}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>正答率</span>
              <span className={styles.summaryValue}>{testSummary.stats.accuracy}%</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>実施日時</span>
              <span className={styles.summaryValue}>
                {testSummary.session.completedAt
                  ? new Date(testSummary.session.completedAt).toLocaleString('ja-JP')
                  : '--'}
              </span>
            </div>
          </section>

          <section className={styles.listSection}>
            <h2 className={styles.sectionTitle}>出題内容</h2>
            <p className={styles.sectionNote}>
              出題された問題と解説をまとめています。展示後の振り返りにもご活用ください。
            </p>
            <ul className={styles.historyList}>
              {testSummary.questions.map(question => (
                <li key={question.id} className={styles.historyItem}>
                  <div className={styles.itemHeader}>
                    <span className={`${styles.difficultyBadge} ${styles[`difficultyBadge${testSummary.session.difficulty}`] || ''}`}>
                      Q{question.questionIndex}・{question.isCorrect ? '正解' : '不正解'}
                    </span>
                    <span className={styles.timestamp}>
                      選択: {question.userAnswer !== null ? String.fromCharCode(65 + question.userAnswer) : '--'}
                    </span>
                  </div>
                  <div className={styles.itemQuestion}>
                    <span className={styles.itemLabel}>問題</span>
                    <p>{question.question}</p>
                  </div>
                  <div className={styles.choicesBlock}>
                    <span className={styles.itemLabel}>選択肢</span>
                    <ul className={styles.choiceList}>
                      {question.choices.map((choice, index) => (
                        <li
                          key={index}
                          className={`${styles.choiceRow}${
                            index === question.answer ? ` ${styles.choiceRowCorrect}` : ''
                          }${index === question.userAnswer ? ` ${styles.choiceRowSelected}` : ''}`}
                        >
                          <span className={styles.choiceIndex}>{String.fromCharCode(65 + index)}</span>
                          <span className={styles.choiceText}>{choice}</span>
                          {index === question.answer && <span className={styles.choiceTag}>正解</span>}
                          {index === question.userAnswer && index !== question.answer && (
                            <span className={styles.choiceTagWrong}>選択</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={styles.itemExplanation}>
                    <span className={styles.itemLabel}>解説（AI 生成）</span>
                    <p>{question.explanation}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className={styles.modePage}>
        <div className={styles.modeContainer}>
          {utilityBar}
          <div className={styles.statusCard}>
            <p>問題を読み込んでいます。少しお待ちください。</p>
          </div>
        </div>
      </div>
    );
  }

  const resultMessage =
    selected === null
      ? ''
      : selected === currentQuestion.answer
        ? '正解です。'
        : `不正解です。正解は「${currentQuestion.choices[currentQuestion.answer]}」でした。`;

  return (
    <div className={styles.modePage}>
      <div className={styles.modeContainer}>
        {utilityBar}
        <header className={styles.testHeader}>
          <div>
            <h1>{session?.userName} さんのテスト</h1>
            <p>
              テーマ: {session?.prompt} / 難易度: {difficultyLabels[session?.difficulty] ?? session?.difficulty}
            </p>
          </div>
          <div className={styles.testMeta}>
            <span className={styles.metaBadge}>
              Q{progress.current} / {progress.total}
            </span>
            <span className={styles.metaBadge}>
              正解数 {progress.answered}/{progress.total}
            </span>
          </div>
        </header>

        {error && <div className={styles.error}>{error}</div>}

        <QuestionCard
          question={currentQuestion}
          selected={selected}
          onSelect={handleSelectChoice}
          disableChoices={selected !== null || loading}
          showExplanation={showExplanation}
          onToggleExplanation={() => {
            playSound('click');
            setShowExplanation(prev => !prev);
          }}
          resultMessage={resultMessage}
          isCorrect={selected !== null && selected === currentQuestion.answer}
          headerSlot={
            <div className={styles.progressTrack}>
              <div
                className={styles.progressBar}
                style={{ width: `${((progress.answered + (selected !== null ? 1 : 0)) / progress.total) * 100}%` }}
              />
            </div>
          }
          footer={
            <div className={styles.actionRow}>
              {isWaitingForNext && <span className={styles.loadingNotice}>次の問題を準備しています...</span>}
              {!isWaitingForNext && pendingNext && (
                <button type="button" className={styles.button} onClick={handleNextQuestion}>
                  次の問題へ進む
                </button>
              )}
              {!isWaitingForNext && readyForSummary && (
                <button type="button" className={styles.button} onClick={handleShowSummary}>
                  結果を見る
                </button>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  selected,
  onSelect,
  disableChoices,
  showExplanation,
  onToggleExplanation,
  resultMessage,
  isCorrect,
  footer,
  headerSlot,
}) {
  return (
    <div className={styles.quizBox}>
      <div className={styles.quizHeader}>
        <span className={styles.quizBadge}>Question</span>
        {headerSlot}
      </div>
      <p className={styles.quizQuestion}>{question.question}</p>

      <div className={styles.choiceList}>
        {question.choices.map((choice, index) => {
          let classNames = styles.choiceButton;
          if (selected !== null) {
            if (index === question.answer) classNames += ` ${styles.correct}`;
            else if (index === selected) classNames += ` ${styles.wrong}`;
          }

          return (
            <button
              key={index}
              onClick={() => onSelect(index)}
              className={classNames}
              disabled={disableChoices}
            >
              <span className={styles.choicePrefix}>{String.fromCharCode(65 + index)}</span>
              <span className={styles.choiceText}>{choice}</span>
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className={`${styles.result} ${isCorrect ? styles.resultCorrect : styles.resultWrong}`}>
          {resultMessage}
        </div>
      )}

      {selected !== null && question.explanation && (
        <div className={styles.explanationSection}>
          <button
            type="button"
            className={`${styles.explanationToggle}${showExplanation ? ` ${styles.explanationToggleActive}` : ''}`}
            onClick={onToggleExplanation}
          >
            {showExplanation ? '解説を閉じる' : '解説を表示'}
          </button>
          {showExplanation && (
            <div className={styles.explanationCard}>
              <div className={styles.explanationHeader}>
                <span>解説</span>
                <span className={styles.explanationBadge}>AI 生成</span>
              </div>
              <p className={styles.explanationBody}>{question.explanation}</p>
              <p className={styles.explanationNotice}>
                ※この解説は AI が生成した内容です。利用する際は事実関係をご確認ください。
              </p>
            </div>
          )}
        </div>
      )}

      {footer}
    </div>
  );
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
