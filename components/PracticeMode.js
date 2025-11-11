import Link from 'next/link';
import { useRef, useState } from 'react';
import QuestionCard from './QuestionCard';
import layout from '../styles/layout.module.css';
import ui from '../styles/ui.module.css';
import styles from '../styles/PracticeMode.module.css';

const MODE_COPY = {
  practice: {
    introBadge: '練習モード',
    introTitle: '好きなテーマで気軽にクイズ！',
    introDescription: 'テーマと難易度を選ぶだけで、AIが1問ずつオリジナル問題を作成します。',
    introBullets: ['自由入力のテーマ', '難易度はその場で変更OK'],
    startButton: '練習を始める',
    headerTitle: '練習クイズ',
    headerDescription: 'テーマと難易度を指定してAIクイズを生成しましょう。',
    promptLabel: 'テーマ',
    promptPlaceholder: '例: 日本史の鎌倉時代 など',
    promptRequiredMessage: 'テーマを入力してください。',
    submitLabel: 'クイズを生成',
    backToIntroLabel: 'トップに戻る',
    retryButtonLabel: 'もう1問出題',
  },
  document: {
    introBadge: 'PDFモード',
    introTitle: 'PDFから一瞬でクイズ化',
    introDescription:
      '教材やスライドなどのPDFをアップロードすると、その本文に基づいた四択問題を自動生成します。',
    introBullets: ['PDFをアップロードするだけ', '本文の事実に沿った出題'],
    startButton: 'PDFモードを開始',
    headerTitle: 'PDFクイズ',
    headerDescription: 'アップロードした資料の本文からAIが問題を作ります。',
    promptLabel: '補足テーマ (任意)',
    promptPlaceholder: '例: 重要ポイントを中心に など',
    promptOptional: true,
    promptRequiredMessage: 'PDFを読み込んでください。',
    pdfRequiredMessage: 'PDFを読み込んでください。',
    pdfUploadingMessage: 'PDFの解析が完了してから生成してください。',
    submitLabel: 'PDFからクイズを生成',
    backToIntroLabel: 'モード一覧に戻る',
    retryButtonLabel: '同じ資料で再出題',
    pdf: {
      label: 'PDF からクイズを生成',
      hint: '5MB以下のPDFをアップロードすると本文から問題を作ります。',
      dropMessage: 'PDFをドラッグ＆ドロップするか、ファイルを選択してください。',
      uploading: 'テキストを抽出しています...',
      useHint: '抽出したテキストをクイズ生成に使用します。',
      buttonLabel: '別のPDFを選ぶ',
    },
  },
};

export default function PracticeMode({
  difficultyOptions,
  difficultyLabels,
  playSound,
  soundEnabled,
  toggleSound,
  onBack,
  modeVariant = 'practice',
}) {
  const variantKey = modeVariant ?? 'practice';
  const copy = MODE_COPY[variantKey] ?? MODE_COPY.practice;
  const enablePdfWorkflow = variantKey === 'document';
  const pdfCopy = copy.pdf ?? {
    label: 'PDF からクイズを生成',
    hint: '5MB以下のPDFをアップロードすると本文から問題を作ります。',
    dropMessage: 'PDFをドラッグ＆ドロップするか、ファイルを選択してください。',
    uploading: 'テキストを抽出しています...',
    useHint: '抽出したテキストをクイズ生成に使用します。',
    buttonLabel: '別のPDFを選ぶ',
  };
  const promptOptional = Boolean(copy.promptOptional);

  const [prompt, setPrompt] = useState('');
  const [difficulty, setDifficulty] = useState('normal');
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const fileInputRef = useRef(null);
  const [pdfText, setPdfText] = useState('');
  const [pdfMeta, setPdfMeta] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [pdfUploading, setPdfUploading] = useState(false);

  const disableSubmit = loading || (enablePdfWorkflow && pdfUploading);

  const utilityBar = (
    <div className={layout.utilityBar}>
      <button type="button" className={ui.backButton} onClick={onBack}>
        モード一覧へ戻る
      </button>
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
  );

  const clearPdfInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetPdfState = () => {
    setPdfText('');
    setPdfMeta(null);
    setPdfError(null);
    setPdfUploading(false);
  };

  const handlePdfUpload = async file => {
    if (!enablePdfWorkflow || !file) return;
    setPdfError(null);
    setPdfMeta(null);
    setPdfText('');
    setPdfUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setPdfError(data.error || 'PDFの解析に失敗しました。');
        clearPdfInput();
        return;
      }
      setPdfText(data.text || '');
      setPdfMeta({
        filename: data.filename,
        pageCount: data.pageCount,
        characters: data.characters,
        excerpt: data.excerpt,
      });
    } catch (err) {
      setPdfError('PDFのアップロードに失敗しました: ' + String(err));
      clearPdfInput();
    } finally {
      setPdfUploading(false);
    }
  };

  const handlePdfInputChange = event => {
    if (!enablePdfWorkflow) return;
    const file = event.target.files?.[0];
    if (!file) return;
    playSound('click');
    handlePdfUpload(file);
  };

  const handlePdfDrop = event => {
    if (!enablePdfWorkflow) return;
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    playSound('click');
    clearPdfInput();
    handlePdfUpload(file);
  };

  const handlePdfDragOver = event => {
    if (!enablePdfWorkflow) return;
    event.preventDefault();
  };

  const handlePdfClear = () => {
    if (!enablePdfWorkflow) return;
    playSound('click');
    clearPdfInput();
    resetPdfState();
  };

  const handleGenerate = async event => {
    event?.preventDefault();
    playSound('click');
    setError(null);
    setQuiz(null);
    setSelected(null);
    setShowExplanation(false);

    const hasPrompt = prompt.trim().length > 0;
    const hasPdf = enablePdfWorkflow && pdfText.trim().length > 0;

    if (!enablePdfWorkflow && !hasPrompt) {
      setError(copy.promptRequiredMessage ?? 'テーマを入力してください。');
      return;
    }

    if (enablePdfWorkflow && !hasPdf) {
      setError(copy.pdfRequiredMessage ?? 'PDFを読み込んでください。');
      return;
    }

    if (enablePdfWorkflow && pdfUploading) {
      setError(copy.pdfUploadingMessage ?? 'PDFの解析が完了してから生成してください。');
      return;
    }

    const payload = {
      prompt,
      difficulty,
    };

    if (enablePdfWorkflow && hasPdf) {
      payload.sourceText = pdfText;
      if (pdfMeta?.filename) {
        payload.pdfFilename = pdfMeta.filename;
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'クイズの作成に失敗しました。');
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
    const hasPrompt = prompt.trim().length > 0;
    const hasPdf = enablePdfWorkflow && pdfText.trim().length > 0;

    if (!enablePdfWorkflow && !hasPrompt) {
      setError(copy.promptRequiredMessage ?? 'テーマを入力してください。');
      return;
    }

    if (enablePdfWorkflow && !hasPdf) {
      setError(copy.pdfRequiredMessage ?? 'PDFを読み込んでください。');
      return;
    }

    if (enablePdfWorkflow && pdfUploading) {
      setError(copy.pdfUploadingMessage ?? 'PDFの解析が完了してから生成してください。');
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
    if (enablePdfWorkflow) {
      resetPdfState();
      clearPdfInput();
    }
  };

  const handleBackToIntro = () => {
    playSound('click');
    setStarted(false);
    setQuiz(null);
    setSelected(null);
    setShowExplanation(false);
    setError(null);
    if (enablePdfWorkflow) {
      resetPdfState();
      clearPdfInput();
    }
  };

  if (!started) {
    return (
      <div className={layout.modePage}>
        <div className={layout.modeContainer}>
          {utilityBar}
          <div className={styles.practiceIntro}>
            <div className={styles.practiceIntroCard}>
              <span className={ui.modeBadge}>{copy.introBadge}</span>
              <h1>{copy.introTitle}</h1>
              <p>{copy.introDescription}</p>
              <ul className={styles.practiceBullets}>
                {(copy.introBullets ?? []).map(point => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <div className={styles.practiceIntroActions}>
                <button type="button" className={ui.button} onClick={handleStart}>
                  {copy.startButton}
                </button>
                <Link href="/history" className={ui.secondaryButtonLink}>
                  履歴を見る
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
        ? '正解です！'
        : `惜しい！正解は「${quiz.choices[quiz.answer]}」です。`;

  return (
    <div className={layout.modePage}>
      <div className={layout.modeContainer}>
        {utilityBar}

        <header className={styles.practiceHeader}>
          <div>
            <h1>{copy.headerTitle}</h1>
            <p>{copy.headerDescription}</p>
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
            {copy.showPromptInput !== false && (
              <label className={styles.formLabel}>
                {copy.promptLabel ?? 'テーマ'}
                <input
                  value={prompt}
                  onChange={event => setPrompt(event.target.value)}
                  placeholder={copy.promptPlaceholder ?? '例: 世界史のルネサンス など'}
                  className={styles.input}
                />
              </label>
            )}
          </div>

          {enablePdfWorkflow && (
            <section className={styles.pdfSection}>
              <div className={styles.pdfHeader}>
                <div>
                  <p className={styles.pdfLabel}>{pdfCopy.label}</p>
                  <p className={styles.pdfHint}>{pdfCopy.hint}</p>
                </div>
                {pdfMeta && (
                  <div className={styles.pdfMeta}>
                    <span>{pdfMeta.filename || 'uploaded.pdf'}</span>
                    <span>{pdfMeta.pageCount ? `${pdfMeta.pageCount}ページ` : 'ページ数不明'}</span>
                    <span>{pdfMeta.characters ?? 0}文字</span>
                  </div>
                )}
              </div>
              <div
                className={`${styles.pdfDropzone}${pdfUploading ? ` ${styles.pdfDropzoneLoading}` : ''}`}
                onDrop={handlePdfDrop}
                onDragOver={handlePdfDragOver}
              >
                {pdfUploading ? (
                  <p>{pdfCopy.uploading ?? 'テキストを抽出しています...'}</p>
                ) : (
                  <>
                    <p>{pdfCopy.dropMessage}</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className={styles.pdfInput}
                      onChange={handlePdfInputChange}
                      disabled={pdfUploading}
                    />
                  </>
                )}
              </div>
              {pdfMeta && (
                <div className={styles.pdfSummary}>
                  {pdfMeta.excerpt && <p className={styles.pdfExcerpt}>{pdfMeta.excerpt}</p>}
                  <div className={styles.pdfButtons}>
                    <span className={styles.pdfHint}>{pdfCopy.useHint}</span>
                    <button
                      type="button"
                      className={ui.secondaryButton}
                      onClick={handlePdfClear}
                      disabled={pdfUploading || loading}
                    >
                      {pdfCopy.buttonLabel}
                    </button>
                  </div>
                </div>
              )}
              {pdfError && <div className={ui.error}>{pdfError}</div>}
            </section>
          )}

          <div className={styles.formActions}>
            <button type="submit" className={ui.button} disabled={disableSubmit}>
              {loading ? '生成中...' : copy.submitLabel ?? 'クイズを生成'}
            </button>
            <button
              type="button"
              className={ui.secondaryButton}
              onClick={handleBackToIntro}
              disabled={disableSubmit}
            >
              {copy.backToIntroLabel ?? 'トップに戻る'}
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
                <button
                  type="button"
                  className={ui.button}
                  onClick={handleRetry}
                  disabled={disableSubmit}
                >
                  {copy.retryButtonLabel ?? 'もう1問出題'}
                </button>
                <Link href="/history" className={ui.secondaryButtonLink}>
                  履歴を見る
                </Link>
              </div>
            }
          />
        )}

        <footer className={layout.notice}>
          生成された内容はAIによる自動作成です。重要な判断に使う場合は事実関係をご確認ください。
        </footer>
      </div>
    </div>
  );
}
