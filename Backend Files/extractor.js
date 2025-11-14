// extractor.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const Tesseract = require('tesseract.js');
const FileType = require('file-type');

async function readText(filePath) {
  return fs.promises.readFile(filePath, 'utf8');
}

async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(err));
  });
}

async function parsePDF(filePath) {
  const data = await fs.promises.readFile(filePath);
  const parsed = await pdfParse(data);
  return parsed.text;
}

async function parseDOCX(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function parseHTML(filePath) {
  const html = await readText(filePath);
  const $ = cheerio.load(html);
  return $('body').text().replace(/\s+/g, ' ').trim();
}

async function parseXML(filePath) {
  const xml = await readText(filePath);
  return xml2js.parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });
}

async function parseImage(filePath) {
  const worker = Tesseract.createWorker();
  try {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data } = await worker.recognize(filePath);
    await worker.terminate();
    return data.text;
  } catch (e) {
    try { await worker.terminate(); } catch (_) {}
    throw e;
  }
}

async function extractFile(filePath, originalName, providedMime) {
  let mime = providedMime || null;
  if (!mime) {
    const ft = await FileType.fromFile(filePath);
    mime = ft ? ft.mime : null;
  }
  const ext = (path.extname(originalName) || '').toLowerCase();

  try {
    if (mime === 'application/json' || ext === '.json') {
      const txt = await readText(filePath);
      const parsed = JSON.parse(txt);
      return { type: 'json', payload: parsed };
    }

    if (mime === 'text/csv' || ext === '.csv') {
      const rows = await parseCSV(filePath);
      return { type: 'json', payload: rows };
    }

    if (mime === 'application/pdf' || ext === '.pdf') {
      const text = await parsePDF(filePath);
      return { type: 'text', payload: text };
    }

    if (ext === '.docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const text = await parseDOCX(filePath);
      return { type: 'text', payload: text };
    }

    if ((mime && mime.startsWith('text/')) || ext === '.txt') {
      const text = await readText(filePath);
      return { type: 'text', payload: text };
    }

    if (mime === 'text/html' || ext === '.html' || ext === '.htm') {
      const text = await parseHTML(filePath);
      return { type: 'text', payload: text };
    }

    if (ext === '.xml' || mime === 'application/xml' || mime === 'text/xml') {
      const json = await parseXML(filePath);
      return { type: 'json', payload: json };
    }

    if ((mime && mime.startsWith('image/')) || ['.png','.jpg','.jpeg','.tiff','.bmp','.gif'].includes(ext)) {
      const text = await parseImage(filePath);
      return { type: 'text', payload: text };
    }

    // fallback
    const txt = await readText(filePath);
    try {
      const parsed = JSON.parse(txt);
      return { type: 'json', payload: parsed };
    } catch (_) {
      return { type: 'text', payload: txt };
    }
  } catch (err) {
    return { type: 'error', payload: { error: err.message } };
  }
}

module.exports = { extractFile };
