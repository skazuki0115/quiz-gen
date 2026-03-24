import formidable from 'formidable';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import pdfParse from 'pdf-parse';
import { createPdfIndex, saveChunks } from '../../lib/vectorStore';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_LENGTH = 6000;
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 80;
// チャンク最大数（カバレッジ精度とインデックスサイズのトレードオフ）
const MAX_CHUNKS = 400;

function normalizeWhitespace(text = '') {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function takeExcerpt(text = '', limit = 200) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}…`;
}

function detectChapters(text = '') {
  const lines = text.split('\n');
  const chapters = [];
  let offset = 0;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const headingMatch =
      // Chapter 1, Chapter 3.2, 数字ドット形式 (3.1, 3.2.1)
      /^\s*Chapter\s+\d+(\.\d+)?/i.test(trimmed) ||
      /^\s*CHAPTER\s+\d+(\.\d+)?/.test(trimmed) ||
      /^\s*\d+\.\d+(\.\d+)?/.test(trimmed);
    if (headingMatch) {
      chapters.push({
        id: `chapter-${chapters.length + 1}`,
        title: trimmed || `Chapter ${chapters.length + 1}`,
        startOffset: offset,
        lineIndex: index,
      });
    }
    offset += line.length + 1;
  });

  if (chapters.length === 0) {
    return [
      {
        id: 'chapter-1',
        title: '全体',
        startOffset: 0,
        endOffset: text.length,
      },
    ];
  }

  return chapters.map((chapter, idx) => ({
    ...chapter,
    endOffset: chapters[idx + 1]?.startOffset ?? text.length,
  }));
}

function buildChunks(text = '', chapters = []) {
  const chunks = [];
  const safeChapters =
    chapters.length > 0 ? chapters : [{ id: 'chapter-1', title: '全体', startOffset: 0, endOffset: text.length }];

  safeChapters.forEach(chapter => {
    const chapterText = text.slice(chapter.startOffset, chapter.endOffset ?? text.length);
    let pointer = 0;
    while (pointer < chapterText.length && chunks.length < MAX_CHUNKS) {
      const slice = chapterText.slice(pointer, pointer + CHUNK_SIZE);
      const offset = (chapter.startOffset ?? 0) + pointer;
      chunks.push({
        id: randomUUID(),
        text: slice,
        offset,
        length: slice.length,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        pageNumber: null,
      });
      if (slice.length < CHUNK_SIZE) break;
      pointer += CHUNK_SIZE - CHUNK_OVERLAP;
    }
  });

  return chunks;
}

async function embedTexts(texts = []) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Embedding failed: ${response.status} ${payload}`);
  }

  const payload = await response.json();
  return payload.data?.map(item => item.embedding) ?? [];
}

function firstFile(files) {
  if (!files) return null;
  if (Array.isArray(files.file)) return files.file[0];
  if (files.file) return files.file;
  const values = Object.values(files);
  if (values.length === 0) return null;
  return Array.isArray(values[0]) ? values[0][0] : values[0];
}

function parseForm(req) {
  const form = formidable({
    multiples: false,
    maxFileSize: MAX_FILE_SIZE,
    allowEmptyFiles: false,
    filter: part => {
      if (!part.mimetype) return false;
      return part.mimetype === 'application/pdf';
    },
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Only POST' });
  }

  let fileHandle;
  try {
    const { files } = await parseForm(req);
    const file = firstFile(files);

    if (!file) {
      return res.status(400).json({ error: 'PDFファイルを添付してください。' });
    }

    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'PDF形式のみ対応しています。' });
    }

    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: '5MB以下のPDFのみアップロードできます。' });
    }

    fileHandle = file.filepath;
    const buffer = await fs.readFile(file.filepath);
    const parsed = await pdfParse(buffer);
    const normalized = normalizeWhitespace(parsed.text || '');

    if (!normalized) {
      return res.status(422).json({ error: 'テキストを抽出できませんでした。' });
    }

    const trimmed = normalized.slice(0, MAX_TEXT_LENGTH);
    const chapters = detectChapters(trimmed);
    const chunkDefs = buildChunks(trimmed, chapters);
    const embeddings = await embedTexts(chunkDefs.map(item => item.text));

    const { id: pdfId } = createPdfIndex({
      filename: file.originalFilename ?? 'uploaded.pdf',
      pageCount: parsed.numpages ?? null,
      characters: trimmed.length,
    });

    const chunkIds = saveChunks(
      pdfId,
      chunkDefs.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index] ?? null,
      }))
    );

    return res.status(200).json({
      text: trimmed,
      characters: trimmed.length,
      pageCount: parsed.numpages ?? null,
      filename: file.originalFilename ?? 'uploaded.pdf',
      excerpt: takeExcerpt(trimmed, 260),
      pdfId,
      indexId: pdfId,
      chunkCount: chunkIds?.length ?? chunkDefs.length ?? 0,
      chapters: chapters.map(ch => ({ id: ch.id, title: ch.title })),
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    const message =
      error?.code === 'LIMIT_FILE_SIZE'
        ? '5MB以下のPDFのみアップロードできます。'
        : 'PDFの解析に失敗しました。';
    return res.status(500).json({ error: message });
  } finally {
    if (fileHandle) {
      try {
        await fs.unlink(fileHandle);
      } catch {
        // ignore cleanup failures
      }
    }
  }
}
