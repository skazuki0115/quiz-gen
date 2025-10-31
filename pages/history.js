'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import ui from '../styles/ui.module.css';
import styles from '../styles/History.module.css';
import useSound from '../hooks/useSound';

const difficultyLabels = {
  easy: 'かんたん',
  normal: 'ふつう',
  hard: 'むずかしい',
};

export default function HistoryPage() {
  const { soundEnabled, toggleSound } = useSound(true);
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
      { easy: 0, normal: 0, hard: 0 },
    );

    const explanationAvg =
      total === 0
        ? 0
        : Math.round(
            history.reduce((sum, item) => sum + (item.explanation?.length ?? 0), 0) / total,
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
        timeZone: 'Asia/Tokyo',
      }),
    [],
  );

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>クイズ生成履歴</h1>
            <p className={styles.subtitle}>
              これまでに生成したクイズと解説を振り返れます。進行状況の確認や、振り返りにご活用ください。
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/" className={styles.backLink}>
              トップへ戻る
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
        </header>

        {loading && (
          <div className={styles.statusCard}>
            <div className={styles.spinner} />
            <p>読み込み中です…</p>
          </div>
        )}

        {!loading && error && <div className={styles.errorCard}>{error}</div>}

        {!loading && !error && history.length === 0 && (
          <div className={styles.emptyCard}>
            <h2>まだ履歴がありません</h2>
            <p>トップページでクイズを生成すると、ここに結果が自動で保存されます。</p>
            <Link href="/" className={styles.emptyAction}>
              クイズを生成する
            </Link>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <>
            <section className={styles.summarySection}>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>生成回数</span>
                <span className={styles.summaryValue}>{stats.total}</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>難易度の内訳</span>
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
                <span className={styles.summaryLabel}>解説の平均文字数</span>
                <span className={styles.summaryValue}>{stats.explanationAvg}文字</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>最新の生成</span>
                <span className={styles.summaryValue}>
                  {stats.lastGeneratedAt
                    ? formatter.format(new Date(stats.lastGeneratedAt))
                    : '---'}
                </span>
              </div>
            </section>

            <section className={styles.listSection}>
              <h2 className={styles.sectionTitle}>履歴一覧</h2>
              <p className={styles.sectionNote}>
                最新の項目から順に表示しています。AI が生成した内容のため、必要に応じて確認してください。
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
                            <span className={styles.choiceIndex}>{String.fromCharCode(65 + index)}</span>
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
