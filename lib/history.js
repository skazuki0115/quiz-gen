import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'quiz-history.db');
const LEGACY_JSON_PATH = path.join(DATA_DIR, 'quiz-history.json');
const FALLBACK_EXPLANATION = '正解の理由を特定できませんでした。';

function ensureDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function createDatabase() {
  ensureDirectory();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.prepare(
    `CREATE TABLE IF NOT EXISTS quiz_history (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      question TEXT NOT NULL,
      choices TEXT NOT NULL,
      answer INTEGER NOT NULL,
      explanation TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS test_sessions (
      id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      total_questions INTEGER NOT NULL,
      status TEXT NOT NULL,
      score INTEGER,
      created_at TEXT NOT NULL,
      completed_at TEXT
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS test_questions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      question_index INTEGER NOT NULL,
      question TEXT NOT NULL,
      choices TEXT NOT NULL,
      answer INTEGER NOT NULL,
      explanation TEXT NOT NULL,
      user_answer INTEGER,
      is_correct INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY(session_id) REFERENCES test_sessions(id)
    )`
  ).run();

  migrateLegacyJson(db);
  return db;
}

function migrateLegacyJson(db) {
  if (!fs.existsSync(LEGACY_JSON_PATH)) return;
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM quiz_history').get();
  if (count > 0) return;

  try {
    const raw = fs.readFileSync(LEGACY_JSON_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length === 0) return;

    const insert = db.prepare(
      `INSERT OR IGNORE INTO quiz_history
        (id, prompt, difficulty, question, choices, answer, explanation, created_at)
       VALUES
        (@id, @prompt, @difficulty, @question, @choices, @answer, @explanation, @created_at)`
    );

    const toInsert = parsed.map(item => ({
      id: item.id ?? randomUUID(),
      prompt: item.prompt ?? '',
      difficulty: item.difficulty ?? 'normal',
      question: item.question ?? '',
      choices: JSON.stringify(item.choices ?? []),
      answer: typeof item.answer === 'number' ? item.answer : 0,
      explanation: item.explanation ?? FALLBACK_EXPLANATION,
      created_at: item.createdAt ?? new Date().toISOString(),
    }));

    const transaction = db.transaction(rows => {
      rows.forEach(row => insert.run(row));
    });

    transaction(toInsert);
    fs.renameSync(LEGACY_JSON_PATH, `${LEGACY_JSON_PATH}.bak`);
  } catch (err) {
    console.error('Failed to migrate legacy quiz history JSON:', err);
  }
}

const db = createDatabase();

export function appendHistory(entry) {
  const timestamp = entry.createdAt ?? new Date().toISOString();
  db.prepare(
    `INSERT INTO quiz_history
      (id, prompt, difficulty, question, choices, answer, explanation, created_at)
     VALUES
      (@id, @prompt, @difficulty, @question, @choices, @answer, @explanation, @created_at)`
  ).run({
    id: entry.id ?? randomUUID(),
    prompt: entry.prompt,
    difficulty: entry.difficulty,
    question: entry.question,
    choices: JSON.stringify(entry.choices ?? []),
    answer: entry.answer,
    explanation: entry.explanation ?? FALLBACK_EXPLANATION,
    created_at: timestamp,
  });

  return { ...entry, createdAt: timestamp };
}

export function readHistory({ limit, order = 'ASC' } = {}) {
  const clause = order === 'DESC' ? 'DESC' : 'ASC';
  let query =
    'SELECT id, prompt, difficulty, question, choices, answer, explanation, created_at FROM quiz_history ORDER BY datetime(created_at) ' +
    clause;

  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    query += ' LIMIT ' + Math.floor(limit);
  }

  const rows = db.prepare(query).all();
  return rows.map(row => ({
    id: row.id,
    prompt: row.prompt,
    difficulty: row.difficulty,
    question: row.question,
    choices: parseChoices(row.choices),
    answer: row.answer,
    explanation: row.explanation,
    createdAt: row.created_at,
  }));
}

export function countHistory() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM quiz_history').get();
  return count ?? 0;
}

export function createTestSession({
  id = randomUUID(),
  userName,
  prompt,
  difficulty,
  totalQuestions,
}) {
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO test_sessions
      (id, user_name, prompt, difficulty, total_questions, status, score, created_at, completed_at)
     VALUES
      (@id, @user_name, @prompt, @difficulty, @total_questions, @status, NULL, @created_at, NULL)`
  ).run({
    id,
    user_name: userName,
    prompt,
    difficulty,
    total_questions: totalQuestions,
    status: 'active',
    created_at: createdAt,
  });

  return {
    id,
    userName,
    prompt,
    difficulty,
    totalQuestions,
    status: 'active',
    score: null,
    createdAt,
    completedAt: null,
  };
}

export function getTestSession(id) {
  const row = db
    .prepare(
      'SELECT id, user_name, prompt, difficulty, total_questions, status, score, created_at, completed_at FROM test_sessions WHERE id = ?'
    )
    .get(id);
  if (!row) return null;
  return {
    id: row.id,
    userName: row.user_name,
    prompt: row.prompt,
    difficulty: row.difficulty,
    totalQuestions: row.total_questions,
    status: row.status,
    score: row.score,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function insertTestQuestion({
  id = randomUUID(),
  sessionId,
  questionIndex,
  question,
  choices,
  answer,
  explanation,
}) {
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO test_questions
      (id, session_id, question_index, question, choices, answer, explanation, created_at)
     VALUES
      (@id, @session_id, @question_index, @question, @choices, @answer, @explanation, @created_at)`
  ).run({
    id,
    session_id: sessionId,
    question_index: questionIndex,
    question,
    choices: JSON.stringify(choices ?? []),
    answer,
    explanation: explanation ?? FALLBACK_EXPLANATION,
    created_at: createdAt,
  });

  return {
    id,
    sessionId,
    questionIndex,
    question,
    choices,
    answer,
    explanation: explanation ?? FALLBACK_EXPLANATION,
    createdAt,
  };
}

export function getTestQuestion(id) {
  const row = db
    .prepare(
      'SELECT id, session_id, question_index, question, choices, answer, explanation, user_answer, is_correct, created_at FROM test_questions WHERE id = ?'
    )
    .get(id);
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    questionIndex: row.question_index,
    question: row.question,
    choices: parseChoices(row.choices),
    answer: row.answer,
    explanation: row.explanation,
    userAnswer: typeof row.user_answer === 'number' ? row.user_answer : null,
    isCorrect: typeof row.is_correct === 'number' ? Boolean(row.is_correct) : null,
    createdAt: row.created_at,
  };
}

export function updateTestQuestionAnswer({ questionId, userAnswer, isCorrect }) {
  db.prepare(
    `UPDATE test_questions
     SET user_answer = @user_answer,
         is_correct = @is_correct
     WHERE id = @question_id`
  ).run({
    user_answer: userAnswer,
    is_correct: isCorrect ? 1 : 0,
    question_id: questionId,
  });
}

export function listTestQuestions(sessionId) {
  const rows = db
    .prepare(
      'SELECT id, session_id, question_index, question, choices, answer, explanation, user_answer, is_correct, created_at FROM test_questions WHERE session_id = ? ORDER BY question_index ASC'
    )
    .all(sessionId);

  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    questionIndex: row.question_index,
    question: row.question,
    choices: parseChoices(row.choices),
    answer: row.answer,
    explanation: row.explanation,
    userAnswer: typeof row.user_answer === 'number' ? row.user_answer : null,
    isCorrect: typeof row.is_correct === 'number' ? Boolean(row.is_correct) : null,
    createdAt: row.created_at,
  }));
}

export function completeTestSession(sessionId, { score, completedAt = new Date().toISOString() }) {
  db.prepare(
    `UPDATE test_sessions
     SET status = 'completed',
         score = @score,
         completed_at = @completed_at
     WHERE id = @session_id`
  ).run({
    session_id: sessionId,
    score,
    completed_at: completedAt,
  });
}

export function getTestSummary(sessionId) {
  const session = getTestSession(sessionId);
  if (!session) return null;
  const questions = listTestQuestions(sessionId);
  const correctCount = questions.filter(q => q.isCorrect).length;

  const stats = {
    correctCount,
    totalQuestions: session.totalQuestions,
    accuracy:
      session.totalQuestions > 0
        ? Math.round((correctCount / session.totalQuestions) * 100)
        : 0,
  };

  return {
    session: {
      ...session,
      score: session.score ?? correctCount,
    },
    questions,
    stats,
  };
}

function parseChoices(value) {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
