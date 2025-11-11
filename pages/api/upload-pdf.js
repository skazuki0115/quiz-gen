import formidable from 'formidable';
import { promises as fs } from 'node:fs';
import pdfParse from 'pdf-parse';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_LENGTH = 6000;

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
    return res.status(200).json({
      text: trimmed,
      characters: trimmed.length,
      pageCount: parsed.numpages ?? null,
      filename: file.originalFilename ?? 'uploaded.pdf',
      excerpt: takeExcerpt(trimmed, 260),
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
