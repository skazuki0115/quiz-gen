import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'quiz-history.db');
const LEGACY_JSON_PATH = path.join(DATA_DIR, 'quiz-history.json');

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
      explanation: item.explanation ?? '正解の理由を特定できませんでした。',
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
    id: entry.id,
    prompt: entry.prompt,
    difficulty: entry.difficulty,
    question: entry.question,
    choices: JSON.stringify(entry.choices ?? []),
    answer: entry.answer,
    explanation: entry.explanation ?? '正解の理由を特定できませんでした。',
    created_at: timestamp,
  });

  return { ...entry, createdAt: timestamp };
}

export function readHistory({ limit, order = 'ASC' } = {}) {
  const clause = order === 'DESC' ? 'DESC' : 'ASC';
  let query = 'SELECT id, prompt, difficulty, question, choices, answer, explanation, created_at FROM quiz_history ORDER BY datetime(created_at) ' + clause;

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

function parseChoices(value) {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
