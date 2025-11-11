import Link from 'next/link';
import ui from '../styles/ui.module.css';
import styles from '../styles/ModeSelection.module.css';

const modeCards = [
  {
    id: 'practice',
    title: '練習モード',
    tagline: 'いつでもトレーニング',
    description: 'テーマと難易度を自由に選んで、1問ずつAIクイズを楽しめます。',
    accent: 'blue',
    highlights: ['テーマ入力で即出題', '難易度の切り替えも自由'],
  },
  {
    id: 'document',
    title: 'PDFモード',
    tagline: '資料から即クイズ',
    description: 'PDFをアップロードすると、本文だけに基づく四択問題を生成します。',
    accent: 'green',
    highlights: ['PDFアップロード対応', '本文の事実に沿った出題'],
  },
  {
    id: 'test',
    title: '確認モード',
    tagline: '本番さながら',
    description: 'AIが3問連続で出題。ミニテスト感覚で腕試しができます。',
    accent: 'purple',
    highlights: ['3問のテスト形式', 'テーマと難易度はランダム'],
  },
];

const capitalize = value => value.charAt(0).toUpperCase() + value.slice(1);

export default function ModeSelection({ onSelect, soundEnabled, toggleSound, surveyUrl }) {
  const hasSurvey = typeof surveyUrl === 'string' && surveyUrl.length > 0;

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
          {hasSurvey && (
            <a
              href={surveyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={ui.navButton}
            >
              アップデート希望を送る
            </a>
          )}
          <Link href="/history" className={ui.navButton}>
            最近の履歴
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

      <main className={styles.heroContent}>
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>AI Quiz Lab</p>
          <h1 className={styles.heroTitle}>AIクイズで学びを加速しよう</h1>
          <p className={styles.heroDescription}>
            テーマ入力・PDFアップロード・テスト形式など、目的に合わせてモードを選べます。
          </p>
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
                <span className={ui.modeBadge}>{card.tagline}</span>
                <h2>{card.title}</h2>
              </div>
              <p className={styles.modeCardDescription}>{card.description}</p>
              <ul className={styles.modeHighlightList}>
                {card.highlights.map(point => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <span className={styles.modeCardCta}>このモードで始める</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
