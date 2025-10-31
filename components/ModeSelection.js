import Link from 'next/link';
import ui from '../styles/ui.module.css';
import styles from '../styles/ModeSelection.module.css';

const modeCards = [
  {
    id: 'practice',
    title: '練習モード',
    tagline: '気軽にウォームアップ',
    description: 'テーマと難易度を選ぶだけで、1問ずつテンポよく確認できます。',
    accent: 'blue',
    highlights: ['解説はワンタップで確認','演習時にテーマと難易度変更可']
  },
  {
    id: 'test',
    title: '確認モード',
    tagline: '本番前の腕試しに',
    description: '名前とテーマを入れるだけで、AIが3問のテストを自動作成します。',
    accent: 'purple',
    highlights: ['3問のテストを出題','テーマと難易度は固定']
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
              アンケートに回答
            </a>
          )}
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
      </header>

      <main className={styles.heroContent}>
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}>AI Quiz Lab</p>
          <h1 className={styles.heroTitle}>AIクイズを体験してみよう!</h1>
          <p className={styles.heroDescription}>
            テーマと難易度を選ぶだけでAIがクイズを生成します。
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
              <span className={styles.modeCardCta}>このモードを選ぶ</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
