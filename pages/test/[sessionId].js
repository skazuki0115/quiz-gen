'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import styles from '../../styles/TestResult.module.css';

export default function TestResultPage() {
  const router = useRouter();
  const { sessionId } = router.query || {};
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId || typeof sessionId !== 'string') return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/test/${sessionId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || '結果の取得に失敗しました');
          setSummary(null);
        } else {
          setSummary(data.summary);
        }
      } catch (err) {
        if (!cancelled) {
          setError('通信エラー: ' + String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!sessionId || typeof sessionId !== 'string') {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.statusCard}>
            <p>結果を読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.statusCard}>
            <div className={styles.spinner} />
            <p>結果を読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.errorCard}>
            <p>{error || '結果を表示できませんでした。'}</p>
            <Link href="/" className={styles.backLink}>
              トップへ戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { session, questions, stats } = summary;
  const difficultyLabel = toDifficultyLabel(session.difficulty);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1>{session.userName} さんのチャレンジ結果</h1>
            <p>
              テーマ: {session.prompt} / 難易度: {difficultyLabel}
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/" className={styles.primaryButton}>
              トップへ戻る
            </Link>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => navigator.clipboard.writeText(window.location.href).catch(() => {})}
            >
              URLをコピー
            </button>
          </div>
        </header>

        <section className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>正解数</span>
            <span className={styles.summaryValue}>
              {stats.correctCount} / {stats.totalQuestions}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>正答率</span>
            <span className={styles.summaryValue}>{stats.accuracy}%</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>受験日時</span>
            <span className={styles.summaryValue}>
              {session.createdAt ? formatDateTime(session.createdAt) : '--'}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>完了日時</span>
            <span className={styles.summaryValue}>
              {session.completedAt ? formatDateTime(session.completedAt) : '--'}
            </span>
          </div>
        </section>

        <section className={styles.listSection}>
          <h2 className={styles.sectionTitle}>出題内容と解説</h2>
          <p className={styles.sectionNote}>AI が生成した問題と解説です。復習に活用してください。</p>
          <ul className={styles.questionList}>
            {questions.map(question => (
              <li key={question.id} className={styles.questionItem}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemMeta}>
                    Q{question.questionIndex}・{question.isCorrect ? '正解' : '不正解'}
                  </span>
                  <span className={styles.itemMeta}>
                    選択: {question.userAnswer !== null ? String.fromCharCode(65 + question.userAnswer) : '---'}
                  </span>
                </div>
                <div className={styles.itemBody}>
                  <span className={styles.itemLabel}>問題</span>
                  <p>{question.question}</p>
                </div>
                <div className={styles.choicesBlock}>
                  <span className={styles.itemLabel}>選択肢</span>
                  <ul>
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

function toDifficultyLabel(value) {
  switch (value) {
    case 'easy':
      return 'かんたん';
    case 'hard':
      return 'むずかしい';
    case 'normal':
    default:
      return 'ふつう';
  }
}
