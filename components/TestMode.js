import Link from 'next/link';
import { useMemo, useState } from 'react';
import QuestionCard from './QuestionCard';
import layout from '../styles/layout.module.css';
import ui from '../styles/ui.module.css';
import styles from '../styles/TestMode.module.css';

const dateTimeFormatOptions = {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
};

const formatDateTime = value => {
  if (!value) return '--';
  return new Date(value).toLocaleString('ja-JP', dateTimeFormatOptions);
};

export default function TestMode({
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

  const handleInputChange = event => {
    const { name, value } = event.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const handleStartTest = async event => {
    event?.preventDefault();
    playSound('click');
    setError(null);

    if (!formValues.userName.trim()) {
      setError('受験者名を入力してください。');
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
      <div className={layout.modePage}>
        <div className={layout.modeContainer}>
          {utilityBar}
          <div className={styles.testIntro}>
            <div className={styles.introCard}>
              <span className={ui.modeBadge}>確認モード</span>
              <h1>学びは定着してるかな？ クイズで確かめてみよう！</h1>
              <p>
                名前とテーマ、難易度を入力するだけ。AIが3問のミニテストを自動作成し、結果は履歴から確認できます。
                テスト中はテーマ、難易度ともに変えることができません
              </p>
            </div>
            <form className={styles.testForm} onSubmit={handleStartTest}>
              <h2>テストの設定</h2>
              <label className={styles.formLabel}>
                受験者名
                <input
                  name="userName"
                  value={formValues.userName}
                  onChange={handleInputChange}
                  className={styles.input}
                  placeholder="名前、ニックネームをいれてね！"
                />
              </label>
              <label className={styles.formLabel}>
                テーマ
                <input
                  name="prompt"
                  value={formValues.prompt}
                  onChange={handleInputChange}
                  className={styles.input}
                  placeholder="テストしたいテーマを入れてみよう！"
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

              <button type="submit" className={ui.button} disabled={loading}>
                {loading ? '読み込み中…' : 'テストを開始'}
              </button>
              {error && <div className={ui.error}>{error}</div>}
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'summary' && testSummary) {
    return (
      <div className={layout.modePage}>
        <div className={layout.modeContainer}>
          {utilityBar}
          <header className={styles.testHeader}>
            <div>
              <h1>{testSummary.session.userName} さんの結果</h1>
              <p>
                テーマ: {testSummary.session.prompt} / 難易度: {difficultyLabels[testSummary.session.difficulty]}
              </p>
            </div>
            <div className={styles.summaryActions}>
              <Link href={`/test/${testSummary.session.id}`} className={ui.secondaryButtonLink}>
                結果ページを開く
              </Link>
              <button type="button" className={ui.button} onClick={onBack}>
                モード選択へ戻る
              </button>
            </div>
          </header>

          <section className={styles.summarySection}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>正答数</span>
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
                  ? formatDateTime(testSummary.session.completedAt)
                  : '--'}
              </span>
            </div>
          </section>

          <section className={styles.listSection}>
            <h2 className={styles.sectionTitle}>出題内容</h2>
            <p className={styles.sectionNote}>
              それぞれの問題と解説を見返せます。復習やフィードバックにご利用ください。
            </p>
            <ul className={styles.historyList}>
              {testSummary.questions.map(question => (
                <li key={question.id} className={styles.historyItem}>
                  <div className={styles.itemHeader}>
                    <span
                      className={`${styles.difficultyBadge} ${
                        styles[`difficultyBadge${testSummary.session.difficulty}`] || ''
                      }`}
                    >
                      Q{question.questionIndex}・{question.isCorrect ? '正解' : '不正解'}
                    </span>
                    <span className={styles.timestamp}>
                      回答: {question.userAnswer !== null ? String.fromCharCode(65 + question.userAnswer) : '--'}
                    </span>
                  </div>
                  <div>
                    <span className={styles.itemLabel}>テーマ</span>
                    <span className={styles.itemPromptValue}>{testSummary.session.prompt}</span>
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
                    <span className={styles.itemLabel}>解説（AI生成）</span>
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
      <div className={layout.modePage}>
        <div className={layout.modeContainer}>
          {utilityBar}
          <div className={layout.statusCard}>
            <p>準備中です。少しだけお待ちください。</p>
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
        : `不正解です。正解は「${currentQuestion.choices[currentQuestion.answer]}」です。`;

  return (
    <div className={layout.modePage}>
      <div className={layout.modeContainer}>
        {utilityBar}
        <header className={styles.testHeader}>
          <div>
            <h1>{session?.userName} さんのテスト</h1>
            <p>
              テーマ: {session?.prompt} / 難易度: {difficultyLabels[session?.difficulty] ?? session?.difficulty}
            </p>
          </div>
          <div className={styles.testMeta}>
            <span className={ui.metaBadge}>
              Q{progress.current} / {progress.total}
            </span>
            <span className={ui.metaBadge}>
              解答 {progress.answered}/{progress.total}
            </span>
          </div>
        </header>

        {error && <div className={ui.error}>{error}</div>}

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
            <div className={layout.progressTrack}>
              <div
                className={layout.progressBar}
                style={{ width: `${((progress.answered + (selected !== null ? 1 : 0)) / progress.total) * 100}%` }}
              />
            </div>
          }
          footer={
            <div className={styles.actionRow}>
              {isWaitingForNext && <span className={ui.loadingNotice}>次の問題を準備中です…</span>}
              {!isWaitingForNext && pendingNext && (
                <button type="button" className={ui.button} onClick={handleNextQuestion}>
                  次の問題へ
                </button>
              )}
              {!isWaitingForNext && readyForSummary && (
                <button type="button" className={ui.button} onClick={handleShowSummary}>
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
