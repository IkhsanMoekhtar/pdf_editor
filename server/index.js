import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import morgan from 'morgan';
import { PDFDocument } from 'pdf-lib';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import rateLimit from 'express-rate-limit';

const app = express();
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 200);
const PORT = Number(process.env.PORT || 8787);
const TRUST_PROXY = process.env.TRUST_PROXY || '1';
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 20);
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set('trust proxy', TRUST_PROXY);
app.use(morgan('tiny'));
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests and trusted origins.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin tidak diizinkan oleh konfigurasi CORS.'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86_400,
}));

const compressRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request kompresi. Coba lagi sebentar.' },
});

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('File harus berformat PDF.'));
      return;
    }

    cb(null, true);
  },
});

const SUPPORTED_COMPRESSION_LEVELS = new Set(['fast', 'lossless', 'balanced', 'aggressive']);

function normalizeCompressionLevel(level) {
  if (typeof level !== 'string') {
    return 'balanced';
  }

  const normalizedLevel = level.trim().toLowerCase();
  return SUPPORTED_COMPRESSION_LEVELS.has(normalizedLevel) ? normalizedLevel : 'balanced';
}

let cachedGhostscriptCommand;
let ghostscriptLookupPromise = null;

function getCompressionSettings(level) {
  // Speed-first Ghostscript profiles.
  const settings = {
    fast: {
      name: 'Fast',
      imageResolution: 96,
      downsampling: true,
      pdfPreset: '/screen',
      colorStrategy: 'RGB',
      jpegQuality: 45,
    },
    lossless: {
      name: 'Lossless',
      imageResolution: 300,
      downsampling: false,
      pdfPreset: null,
      compatibilityLevel: '1.7',
      colorStrategy: 'LeaveColorUnchanged',
      jpegQuality: null,
      preserveFonts: true,
      passThroughImages: true,
    },
    balanced: {
      name: 'Balanced',
      imageResolution: 150,
      downsampling: true,
      pdfPreset: '/ebook',
      colorStrategy: 'RGB',
      jpegQuality: 65,
    },
    aggressive: {
      name: 'Aggressive',
      imageResolution: 72,
      downsampling: true,
      pdfPreset: '/screen',
      colorStrategy: 'RGB',
      jpegQuality: 35,
    }
  };
  
  return settings[level] || settings.balanced;
}

function buildGhostscriptArgs(settings, inputPath, outputPath) {
  const args = [
    '-sDEVICE=pdfwrite',
    `-dCompatibilityLevel=${settings.compatibilityLevel || '1.4'}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    '-r' + settings.imageResolution + 'x' + settings.imageResolution,
  ];

  if (settings.pdfPreset) {
    args.push(`-dPDFSETTINGS=${settings.pdfPreset}`);
  }

  if (settings.preserveFonts) {
    args.push('-dCompressFonts=false');
    args.push('-dEmbedAllFonts=true');
    args.push('-dSubsetFonts=false');
  } else {
    args.push('-dCompressFonts=true');
    args.push('-dEmbedAllFonts=false');
    args.push('-dSubsetFonts=true');
  }

  // Add downsampling for non-lossless
  if (settings.downsampling) {
    args.push('-dDownsampleColorImages=true');
    args.push('-dDownsampleGrayImages=true');
    args.push('-dDownsampleMonoImages=true');
    args.push('-dColorImageDownsampleType=/Bicubic');
    args.push('-dGrayImageDownsampleType=/Bicubic');
    args.push('-dMonoImageDownsampleType=/Subsample');
    args.push('-dColorImageResolution=' + settings.imageResolution);
    args.push('-dGrayImageResolution=' + settings.imageResolution);
    args.push('-dMonoImageResolution=' + settings.imageResolution);

    if (Number.isFinite(settings.jpegQuality)) {
      args.push('-dAutoFilterColorImages=false');
      args.push('-dAutoFilterGrayImages=false');
      args.push('-dColorImageFilter=/DCTEncode');
      args.push('-dGrayImageFilter=/DCTEncode');
      args.push('-dJPEGQ=' + settings.jpegQuality);
    }
  }

  if (settings.passThroughImages) {
    args.push('-dPassThroughJPEGImages=true');
    args.push('-dPassThroughJPXImages=true');
  }

  args.push(`-sColorConversionStrategy=${settings.colorStrategy}`);

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

async function getGhostscriptCommand() {
  if (cachedGhostscriptCommand !== undefined) {
    return cachedGhostscriptCommand;
  }

  if (ghostscriptLookupPromise) {
    return ghostscriptLookupPromise;
  }

  ghostscriptLookupPromise = findGhostscriptCommand()
    .then((cmd) => {
      cachedGhostscriptCommand = cmd;
      return cmd;
    })
    .finally(() => {
      ghostscriptLookupPromise = null;
    });

  return ghostscriptLookupPromise;
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
  const gsCommand = await getGhostscriptCommand();
  console.log('[Health Check] Found Ghostscript:', gsCommand);
  res.json({
    ok: true,
    service: 'pdf-compress-service',
    ghostscriptAvailable: Boolean(gsCommand),
    ghostscriptCommand: gsCommand,
  });
});

app.post('/api/compress', compressRateLimiter, upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'File PDF tidak ditemukan.' });
    return;
  }

  const level = normalizeCompressionLevel(req.body.level);
  const inputPath = req.file.path;
  const outputPath = `${inputPath}.compressed.pdf`;
  const startedAt = Date.now();
  const originalBuffer = await fs.readFile(inputPath);
  const originalSize = originalBuffer.length;

  try {
    const gsCommand = await getGhostscriptCommand();
    const isLossless = level === 'lossless';

    let outputBuffer;
    let method = 'pdf-lib-fallback';
    let strategy = 'single-pass';

    if (gsCommand) {
      try {
        await runGhostscript(inputPath, outputPath, level, gsCommand);
        outputBuffer = await fs.readFile(outputPath);
        method = `ghostscript:${gsCommand}`;
      } catch (gsError) {
        // Keep API reliable when Ghostscript rejects specific PDFs/options.
        console.warn('Ghostscript gagal, fallback ke pdf-lib:', gsError?.message || gsError);
        const pdfBytes = await fallbackCompressWithPdfLib(originalBuffer);
        outputBuffer = Buffer.from(pdfBytes);
        method = 'pdf-lib-fallback-after-gs-failed';
      }
    } else {
      // Fallback tetap fungsional jika Ghostscript belum terpasang.
      const pdfBytes = await fallbackCompressWithPdfLib(originalBuffer);
      outputBuffer = Buffer.from(pdfBytes);
    }

    if (isLossless) {
      // For lossless, pick the smallest among quality-safe candidates.
      strategy = 'lossless-smart-min';
      const candidates = [
        { buffer: originalBuffer, method: 'original' },
      ];

      if (outputBuffer) {
        candidates.push({ buffer: outputBuffer, method });
      }

      try {
        const optimizedBytes = await fallbackCompressWithPdfLib(originalBuffer);
        candidates.push({
          buffer: Buffer.from(optimizedBytes),
          method: 'pdf-lib-lossless-optimizer',
        });
      } catch (optErr) {
        console.warn('Optimizer lossless gagal:', optErr?.message || optErr);
      }

      const best = candidates.reduce((currentBest, item) => {
        return item.buffer.length < currentBest.buffer.length ? item : currentBest;
      });

      outputBuffer = best.buffer;
      method = best.method;
    }

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
    res.setHeader('X-Compression-Strategy', strategy);
    res.setHeader('X-Processing-Time-Ms', String(Date.now() - startedAt));
    res.send(outputBuffer);
  } catch (error) {
    console.error('Compression error:', error);
    res.status(500).json({ error: 'Gagal mengompres PDF.' });
  } finally {
    await Promise.all([
      fs.rm(inputPath, { force: true }),
      fs.rm(outputPath, { force: true }),
    ]);
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: `Ukuran file melebihi batas ${MAX_UPLOAD_MB} MB.`,
      });
      return;
    }

    res.status(400).json({ error: err.message || 'Upload PDF tidak valid.' });
    return;
  }

  if (err?.message?.includes('CORS')) {
    res.status(403).json({ error: err.message });
    return;
  }

  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PDF compression server running on http://0.0.0.0:${PORT}`);
});
