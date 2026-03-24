import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'quiz-history.db');

function ensureDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function ensureColumns(db) {
  const alterStatements = [
    'ALTER TABLE quiz_history ADD COLUMN pdf_id TEXT',
    'ALTER TABLE quiz_history ADD COLUMN chapter_id TEXT',
    'ALTER TABLE quiz_history ADD COLUMN chapter_title TEXT',
    'ALTER TABLE quiz_history ADD COLUMN chunk_ids TEXT',
  ];

  alterStatements.forEach(stmt => {
    try {
      db.prepare(stmt).run();
    } catch {
      // ignore if column already exists
    }
  });
}

function createDatabase() {
  ensureDirectory();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.prepare(
    `CREATE TABLE IF NOT EXISTS pdf_indexes (
      id TEXT PRIMARY KEY,
      filename TEXT,
      page_count INTEGER,
      characters INTEGER,
      created_at TEXT NOT NULL
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      pdf_id TEXT NOT NULL,
      chapter_id TEXT,
      chapter_title TEXT,
      text TEXT NOT NULL,
      embedding TEXT,
      page_number INTEGER,
      offset INTEGER,
      length INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY(pdf_id) REFERENCES pdf_indexes(id)
    )`
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS chunk_usage (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      chunk_id TEXT NOT NULL,
      pdf_id TEXT NOT NULL,
      chapter_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(chunk_id) REFERENCES chunks(id)
    )`
  ).run();

  ensureColumns(db);
  return db;
}

const db = createDatabase();

export function createPdfIndex({ filename, pageCount = null, characters = null }) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO pdf_indexes (id, filename, page_count, characters, created_at)
     VALUES (@id, @filename, @page_count, @characters, @created_at)`
  ).run({
    id,
    filename: filename ?? 'uploaded.pdf',
    page_count: pageCount ?? null,
    characters: characters ?? null,
    created_at: createdAt,
  });
  return { id, createdAt };
}

export function saveChunks(pdfId, chunkList) {
  if (!pdfId || !Array.isArray(chunkList) || chunkList.length === 0) return;
  const insert = db.prepare(
    `INSERT OR REPLACE INTO chunks
      (id, pdf_id, chapter_id, chapter_title, text, embedding, page_number, offset, length, created_at)
     VALUES
      (@id, @pdf_id, @chapter_id, @chapter_title, @text, @embedding, @page_number, @offset, @length, @created_at)`
  );
  const createdAt = new Date().toISOString();
  const toInsert = chunkList.map(chunk => ({
    id: chunk.id ?? randomUUID(),
    pdf_id: pdfId,
    chapter_id: chunk.chapterId ?? null,
    chapter_title: chunk.chapterTitle ?? null,
    text: chunk.text,
    embedding: Array.isArray(chunk.embedding) ? JSON.stringify(chunk.embedding) : null,
    page_number: chunk.pageNumber ?? null,
    offset: chunk.offset ?? null,
    length: chunk.length ?? null,
    created_at: chunk.createdAt ?? createdAt,
  }));

  const transaction = db.transaction(rows => {
    rows.forEach(row => insert.run(row));
  });

  transaction(toInsert);
  return toInsert.map(row => row.id);
}

export function recordChunkUsage({ quizId, chunkIds, pdfId, chapterId }) {
  if (!quizId || !pdfId || !Array.isArray(chunkIds) || chunkIds.length === 0) return;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO chunk_usage
      (id, quiz_id, chunk_id, pdf_id, chapter_id, created_at)
     VALUES
      (@id, @quiz_id, @chunk_id, @pdf_id, @chapter_id, @created_at)`
  );
  const createdAt = new Date().toISOString();
  const rows = chunkIds.map(chunkId => ({
    id: randomUUID(),
    quiz_id: quizId,
    chunk_id: chunkId,
    pdf_id: pdfId,
    chapter_id: chapterId ?? null,
    created_at: createdAt,
  }));

  const transaction = db.transaction(items => {
    items.forEach(item => insert.run(item));
  });

  transaction(rows);
}

function dotProduct(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return -Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

export function queryChunks({ pdfId, chapterId = null, queryEmbedding, limit = 6 }) {
  if (!pdfId || !Array.isArray(queryEmbedding)) return [];

  const rows = db
    .prepare(
      `SELECT id, pdf_id, chapter_id, chapter_title, text, embedding, page_number, offset, length
       FROM chunks
       WHERE pdf_id = @pdf_id ${chapterId ? 'AND chapter_id = @chapter_id' : ''}`
    )
    .all({ pdf_id: pdfId, chapter_id: chapterId });

  const scored = rows
    .map(row => {
      const emb = row.embedding ? JSON.parse(row.embedding) : null;
      const score = emb ? dotProduct(queryEmbedding, emb) : -Infinity;
      return {
        id: row.id,
        pdfId: row.pdf_id,
        chapterId: row.chapter_id,
        chapterTitle: row.chapter_title,
        text: row.text,
        pageNumber: row.page_number,
        offset: row.offset,
        length: row.length,
        score,
      };
    })
    .filter(item => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));

  return scored;
}

export function getCoverageSummary() {
  const pdfs = db
    .prepare('SELECT id, filename, page_count, characters FROM pdf_indexes ORDER BY created_at DESC')
    .all();

  const chunkCounts = db
    .prepare('SELECT pdf_id AS pdfId, chapter_id AS chapterId, COUNT(*) AS total FROM chunks GROUP BY pdf_id, chapter_id')
    .all();

  const usedCounts = db
    .prepare(
      'SELECT pdf_id AS pdfId, chapter_id AS chapterId, COUNT(DISTINCT chunk_id) AS used FROM chunk_usage GROUP BY pdf_id, chapter_id'
    )
    .all();

  return pdfs.map(pdf => {
    const perChapter = chunkCounts
      .filter(row => row.pdfId === pdf.id)
      .map(row => {
        const usedRow = usedCounts.find(u => u.pdfId === row.pdfId && u.chapterId === row.chapterId);
        const used = usedRow?.used ?? 0;
        const total = row.total ?? 0;
        return {
          chapterId: row.chapterId,
          total,
          used,
          coverage: total === 0 ? 0 : used / total,
        };
      });

    const totalChunks = perChapter.reduce((sum, ch) => sum + (ch.total ?? 0), 0);
    const totalUsed = perChapter.reduce((sum, ch) => sum + (ch.used ?? 0), 0);

    return {
      pdfId: pdf.id,
      filename: pdf.filename,
      pageCount: pdf.page_count,
      characters: pdf.characters,
      totalChunks,
      usedChunks: totalUsed,
      coverage: totalChunks === 0 ? 0 : totalUsed / totalChunks,
      perChapter,
    };
  });
}
