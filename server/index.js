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

function getCompressionSettings(level) {
  // Smart compression settings based on level
  const settings = {
    lossless: {
      name: 'Lossless',
      imageResolution: 300,
      downsampling: false,
      colorCompression: true,
      removeMetadata: true,
      quality: 'high'
    },
    balanced: {
      name: 'Balanced',
      imageResolution: 150,
      downsampling: true,
      colorCompression: true,
      removeMetadata: true,
      quality: 'medium'
    },
    aggressive: {
      name: 'Aggressive',
      imageResolution: 120,
      downsampling: true,
      colorCompression: true,
      removeMetadata: true,
      quality: 'low'
    }
  };
  
  return settings[level] || settings.balanced;
}

function buildGhostscriptArgs(settings, inputPath, outputPath) {
  const args = [
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    // Color and compression settings
    '-dDetectDuplicateImages',
    '-dCompressFonts=true',
    '-r' + settings.imageResolution + 'x' + settings.imageResolution,
    // Remove metadata for smaller size
    '-dEmbedAllFonts=false',
    '-dSubsetFonts=true',
  ];

  // Add downsampling for non-lossless
  if (settings.downsampling) {
    args.push('-dDownsampleColorImages=true');
    args.push('-dDownsampleGrayImages=true');
    args.push('-dDownsampleMonoImages=true');
    args.push('-dColorImageResolution=' + settings.imageResolution);
    args.push('-dGrayImageResolution=' + settings.imageResolution);
    args.push('-dMonoImageResolution=' + settings.imageResolution);
  }

  // Quality settings
  if (settings.quality === 'high') {
    args.push('-dColorConversionStrategy=/Leave');
  } else if (settings.quality === 'medium') {
    args.push('-dColorConversionStrategy=/sRGB');
  } else {
    args.push('-dColorConversionStrategy=/Gray');
  }

  args.push('-dAutoRotatePages=/None');
  args.push(`-sOutputFile=${outputPath}`);
  args.push(inputPath);

  return args;
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

  // Check Windows default installation directory
  if (process.platform === 'win32') {
    try {
      const gsBin = 'C:\\Program Files\\gs\\gs10.07.0\\bin\\gswin64c.exe';
      await fs.access(gsBin);
      return gsBin;
    } catch {
      // File doesn't exist, continue
    }
  }

  return null;
}

function runGhostscript(inputPath, outputPath, levelSetting, gsCommand) {
  return new Promise((resolve, reject) => {
    // Get smart compression settings
    const settings = getCompressionSettings(levelSetting);
    const args = buildGhostscriptArgs(settings, inputPath, outputPath);

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

app.get('/api/health', async (_req, res) => {
  const gsCommand = await findGhostscriptCommand();
  console.log('[Health Check] Found Ghostscript:', gsCommand);
  res.json({
    ok: true,
    service: 'pdf-compress-service',
    ghostscriptAvailable: Boolean(gsCommand),
    ghostscriptCommand: gsCommand,
  });
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

  const level = req.body.level || 'balanced';

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-compress-'));
  const inputPath = path.join(tempDir, 'input.pdf');
  const outputPath = path.join(tempDir, 'output.pdf');

  try {
    await fs.writeFile(inputPath, req.file.buffer);

    const gsCommand = await findGhostscriptCommand();

    let outputBuffer;
    let method = 'pdf-lib-fallback';

    if (gsCommand) {
      await runGhostscript(inputPath, outputPath, level, gsCommand);
      outputBuffer = await fs.readFile(outputPath);
      method = `ghostscript:${gsCommand}`;
    } else {
      // Fallback tetap fungsional jika Ghostscript belum terpasang.
      const pdfBytes = await fallbackCompressWithPdfLib(req.file.buffer);
      outputBuffer = Buffer.from(pdfBytes);
    }

    const originalSize = req.file.buffer.length;
    const compressedSize = outputBuffer.length;
    const savedBytes = Math.max(originalSize - compressedSize, 0);
    const savedPercent = originalSize > 0 ? ((savedBytes / originalSize) * 100).toFixed(2) : '0.00';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="compressed.pdf"');
    res.setHeader('X-Compression-Method', method);
    res.setHeader('X-Original-Size', String(originalSize));
    res.setHeader('X-Compressed-Size', String(compressedSize));
    res.setHeader('X-Saved-Bytes', String(savedBytes));
    res.setHeader('X-Saved-Percent', String(savedPercent));
    res.setHeader('X-Compression-Level', level);
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
