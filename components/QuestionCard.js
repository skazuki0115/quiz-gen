import styles from '../styles/QuestionCard.module.css';

export default function QuestionCard({
  question,
  choices,
  answer,
  selected,
  onSelect,
  disableChoices,
  showExplanation,
  onToggleExplanation,
  resultMessage,
  isCorrect,
  footer,
  headerSlot,
  explanation,
}) {
  const hasChoices = Array.isArray(choices);
  if (typeof question !== 'string' || !hasChoices) {
    return null;
  }

  return (
    <div className={styles.quizBox}>
      <div className={styles.quizHeader}>
        <span className={styles.quizBadge}>Question</span>
        {headerSlot}
      </div>
      <p className={styles.quizQuestion}>{question}</p>

      <div className={styles.choiceList}>
        {choices.map((choice, index) => {
          let classNames = styles.choiceButton;
          if (selected !== null) {
            if (index === answer) classNames += ` ${styles.correct}`;
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

      {selected !== null && explanation && (
        <div className={styles.explanationSection}>
          <button
            type="button"
            className={`${styles.explanationToggle}${showExplanation ? ` ${styles.explanationToggleActive}` : ''}`}
            onClick={onToggleExplanation}
          >
            {showExplanation ? '解説を隠す' : '解説を見る'}
          </button>
          {showExplanation && (
            <div className={styles.explanationCard}>
              <div className={styles.explanationHeader}>
                <span>解説</span>
                <span className={styles.explanationBadge}>AI 生成</span>
              </div>
              <p className={styles.explanationBody}>{explanation}</p>
              <p className={styles.explanationNotice}>
                この内容は AI により生成されたものです。学習利用時は専門家の確認を推奨します。
              </p>
            </div>
          )}
        </div>
      )}

      {footer}
    </div>
  );
}
