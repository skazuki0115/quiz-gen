'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from '../styles/History.module.css';

const difficultyLabels = {
  easy: 'かんたん',
  normal: 'ふつう',
  hard: 'むずかしい',
};

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        setLoading(true);
        const res = await fetch('/api/history');
        if (!res.ok) {
          throw new Error('履歴の取得に失敗しました');
        }
        const data = await res.json();
        if (!cancelled) {
          setHistory(Array.isArray(data.history) ? data.history : []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '履歴の取得に失敗しました');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const total = history.length;
    const perDifficulty = history.reduce(
      (acc, item) => {
        const key = item.difficulty || 'normal';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { easy: 0, normal: 0, hard: 0 }
    );

    const explanationAvg =
      total === 0
        ? 0
        : Math.round(
            history.reduce((sum, item) => sum + (item.explanation?.length ?? 0), 0) / total
          );

    const lastGeneratedAt = total > 0 ? history[history.length - 1].createdAt : null;

    return {
      total,
      perDifficulty,
      explanationAvg,
      lastGeneratedAt,
    };
  }, [history]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    []
  );

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>クイズ生成履歴</h1>
            <p className={styles.subtitle}>
              生成したクイズと解説の履歴を振り返り、難易度別の傾向を確認できます。
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/" className={styles.backLink}>
              トップへ戻る
            </Link>
          </div>
        </header>

        {loading && (
          <div className={styles.statusCard}>
            <div className={styles.spinner} />
            <p>履歴を読み込んでいます...</p>
          </div>
        )}

        {!loading && error && <div className={styles.errorCard}>{error}</div>}

        {!loading && !error && history.length === 0 && (
          <div className={styles.emptyCard}>
            <h2>まだ履歴がありません</h2>
            <p>トップページからクイズを生成すると、ここに解説付きで保存されます。</p>
            <Link href="/" className={styles.emptyAction}>
              クイズを生成する
            </Link>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <>
            <section className={styles.summarySection}>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>累積生成数</span>
                <span className={styles.summaryValue}>{stats.total}</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>難易度別</span>
                <ul className={styles.summaryList}>
                  {['easy', 'normal', 'hard'].map(key => (
                    <li key={key}>
                      <span>{difficultyLabels[key]}:</span>
                      <span>{stats.perDifficulty[key] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>解説平均文字数</span>
                <span className={styles.summaryValue}>{stats.explanationAvg}文字</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>最終更新</span>
                <span className={styles.summaryValue}>
                  {stats.lastGeneratedAt
                    ? formatter.format(new Date(stats.lastGeneratedAt))
                    : '---'}
                </span>
              </div>
            </section>

            <section className={styles.listSection}>
              <h2 className={styles.sectionTitle}>生成履歴</h2>
              <p className={styles.sectionNote}>
                最新の履歴が上に表示されます。解説はAIが生成した内容のため、利用時には確認を行ってください。
              </p>
              <ul className={styles.historyList}>
                {[...history].reverse().map(entry => (
                  <li key={entry.id} className={styles.historyItem}>
                    <div className={styles.itemHeader}>
                      <span
                        className={`${styles.difficultyBadge} ${
                          styles[`difficultyBadge${entry.difficulty}`] || ''
                        }`}
                      >
                        {difficultyLabels[entry.difficulty] ?? entry.difficulty ?? 'ふつう'}
                      </span>
                      <span className={styles.timestamp}>
                        {entry.createdAt ? formatter.format(new Date(entry.createdAt)) : '---'}
                      </span>
                    </div>
                    <div className={styles.itemPrompt}>
                      <span className={styles.itemLabel}>テーマ</span>
                      <span className={styles.itemPromptValue}>{entry.prompt || '（未入力）'}</span>
                    </div>
                    <div className={styles.itemQuestion}>
                      <span className={styles.itemLabel}>問題</span>
                      <p>{entry.question}</p>
                    </div>
                    <div className={styles.choicesBlock}>
                      <span className={styles.itemLabel}>選択肢</span>
                      <ul className={styles.choiceList}>
                        {entry.choices?.map((choice, index) => (
                          <li
                            key={index}
                            className={`${styles.choiceRow}${
                              index === entry.answer ? ` ${styles.choiceRowCorrect}` : ''
                            }`}
                          >
                            <span className={styles.choiceIndex}>
                              {String.fromCharCode(65 + index)}
                            </span>
                            <span className={styles.choiceText}>{choice}</span>
                            {index === entry.answer && <span className={styles.choiceTag}>正解</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className={styles.itemExplanation}>
                      <span className={styles.itemLabel}>解説（AI生成）</span>
                      <p>{entry.explanation}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
