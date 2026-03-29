import express from 'express';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const PORT = Number(process.env.PORT || 8787);

function mapCompressionLevel(level) {
  if (level === 'high') return '/screen';
  if (level === 'low') return '/printer';
  return '/ebook';
}

async function commandExists(commandName) {
  const checkCmd = process.platform === 'win32' ? 'where' : 'which';
  return new Promise((resolve) => {
    const proc = spawn(checkCmd, [commandName]);
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

async function findGhostscriptCommand() {
  const candidates = process.platform === 'win32'
    ? ['gswin64c', 'gswin32c', 'gs']
    : ['gs'];

  for (const cmd of candidates) {
    if (await commandExists(cmd)) return cmd;
  }

  return null;
}

function runGhostscript(inputPath, outputPath, levelSetting, gsCommand) {
  return new Promise((resolve, reject) => {
    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-dPDFSETTINGS=${levelSetting}`,
      `-sOutputFile=${outputPath}`,
      inputPath,
    ];

    const proc = spawn(gsCommand, args, { windowsHide: true });
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || 'Ghostscript gagal memproses file.'));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

async function fallbackCompressWithPdfLib(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  return doc.save({
    useObjectStreams: true,
    updateFieldAppearances: false,
    addDefaultPage: false,
    objectsPerTick: 50,
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'pdf-compress-service' });
});

app.post('/api/compress', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'File PDF tidak ditemukan.' });
    return;
  }

  if (req.file.mimetype !== 'application/pdf') {
    res.status(400).json({ error: 'File harus berformat PDF.' });
    return;
  }

  const level = req.body.level || 'medium';
  const levelSetting = mapCompressionLevel(level);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-compress-'));
  const inputPath = path.join(tempDir, 'input.pdf');
  const outputPath = path.join(tempDir, 'output.pdf');

  try {
    await fs.writeFile(inputPath, req.file.buffer);

    const gsCommand = await findGhostscriptCommand();

    let outputBuffer;

    if (gsCommand) {
      await runGhostscript(inputPath, outputPath, levelSetting, gsCommand);
      outputBuffer = await fs.readFile(outputPath);
    } else {
      // Fallback tetap fungsional jika Ghostscript belum terpasang.
      const pdfBytes = await fallbackCompressWithPdfLib(req.file.buffer);
      outputBuffer = Buffer.from(pdfBytes);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="compressed.pdf"');
    res.send(outputBuffer);
  } catch (error) {
    console.error('Compression error:', error);
    res.status(500).json({ error: 'Gagal mengompres PDF.' });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

app.listen(PORT, () => {
  console.log(`PDF compression server running on http://localhost:${PORT}`);
});
