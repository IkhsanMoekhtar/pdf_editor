import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import morgan from 'morgan';
import { PDFDocument } from 'pdf-lib';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import rateLimit from 'express-rate-limit';

const app = express();
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 200);
const PORT = Number(process.env.PORT || 8787);
const TRUST_PROXY = process.env.TRUST_PROXY || '1';
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 20);
const ENABLE_SECOND_PASS_OPTIMIZER = process.env.ENABLE_SECOND_PASS_OPTIMIZER === '1';
const DASHBOARD_TOKEN = (process.env.DASHBOARD_TOKEN || '').trim();
const DASHBOARD_RETENTION = Math.max(20, Number(process.env.DASHBOARD_RETENTION || 200));
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const serverRootDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardPublicDir = path.join(serverRootDir, 'public');

app.set('trust proxy', TRUST_PROXY);
app.use(morgan('tiny'));
app.use(helmet({
  crossOriginResourcePolicy: false,
  // Hugging Face Spaces renders the app in an iframe from huggingface.co.
  // Disable frameguard so the hf.space app is not blocked with "refused to connect".
  frameguard: false,
  // Helmet's default CSP includes frame-ancestors 'self', which blocks
  // Hugging Face App iframe rendering even when frameguard is disabled.
  contentSecurityPolicy: false,
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

const runtimeMetrics = {
  startedAt: Date.now(),
  totals: {
    compressRequests: 0,
    success: 0,
    failed: 0,
    bytesIn: 0,
    bytesOut: 0,
  },
  activeCompressRequests: 0,
  recent: [],
};

function pushRecentMetric(entry) {
  runtimeMetrics.recent.unshift(entry);
  if (runtimeMetrics.recent.length > DASHBOARD_RETENTION) {
    runtimeMetrics.recent.length = DASHBOARD_RETENTION;
  }
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function summarizeMetrics() {
  const durations = runtimeMetrics.recent
    .map((item) => Number(item.durationMs || 0))
    .filter((value) => Number.isFinite(value) && value >= 0);

  const avgLatency = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;

  return {
    startedAt: runtimeMetrics.startedAt,
    uptimeMs: Date.now() - runtimeMetrics.startedAt,
    activeCompressRequests: runtimeMetrics.activeCompressRequests,
    totals: runtimeMetrics.totals,
    latencyMs: {
      avg: avgLatency,
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
    },
  };
}

function hasDashboardAccess(req) {
  if (!DASHBOARD_TOKEN) return true;

  const queryToken = typeof req.query?.token === 'string' ? req.query.token : '';
  const headerToken = req.get('x-dashboard-token') || '';
  return queryToken === DASHBOARD_TOKEN || headerToken === DASHBOARD_TOKEN;
}

function requireDashboardAccess(req, res, next) {
  if (!hasDashboardAccess(req)) {
    res.status(401).json({ error: 'Akses dashboard tidak diizinkan.' });
    return;
  }

  next();
}

function compressionMetricsMiddleware(req, res, next) {
  const startedAt = Date.now();
  runtimeMetrics.activeCompressRequests += 1;

  res.on('finish', () => {
    runtimeMetrics.activeCompressRequests = Math.max(0, runtimeMetrics.activeCompressRequests - 1);
    runtimeMetrics.totals.compressRequests += 1;

    const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
    if (isSuccess) {
      runtimeMetrics.totals.success += 1;
    } else {
      runtimeMetrics.totals.failed += 1;
    }

    const meta = res.locals?.compressionMeta || {};
    const inputSize = Number(meta.originalSize || 0);
    const outputSize = Number(meta.compressedSize || 0);

    if (inputSize > 0) runtimeMetrics.totals.bytesIn += inputSize;
    if (outputSize > 0) runtimeMetrics.totals.bytesOut += outputSize;

    pushRecentMetric({
      at: Date.now(),
      requestId: req.requestId || 'unknown',
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      level: meta.level || normalizeCompressionLevel(req.body?.level),
      method: meta.method || 'unknown',
      strategy: meta.strategy || 'unknown',
      selectedFrom: meta.selectedFrom || 'unknown',
      originalSize: inputSize,
      compressedSize: outputSize,
      savedPercent: Number(meta.savedPercent || 0),
      remoteAddress: req.ip || 'unknown',
    });
  });

  next();
}

const compressRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak request kompresi. Coba lagi sebentar.' },
});

const REQUEST_TMP_PREFIX = 'pdf-compress-';

async function cleanupRequestTemp(tempDir) {
  if (!tempDir) return;

  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (cleanupErr) {
    console.warn('Gagal membersihkan temporary folder:', cleanupErr?.message || cleanupErr);
  }
}

app.use(async (req, _res, next) => {
  try {
    const requestId = crypto.randomUUID();
    const requestTempDir = path.join(os.tmpdir(), `${REQUEST_TMP_PREFIX}${requestId}`);
    await fs.mkdir(requestTempDir, { recursive: true });

    req.requestId = requestId;
    req.requestTempDir = requestTempDir;
    next();
  } catch (err) {
    next(err);
  }
});

const uploadStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    cb(null, req.requestTempDir || os.tmpdir());
  },
  filename: (_req, _file, cb) => {
    cb(null, 'input.pdf');
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
  // Distinct profiles so each level produces meaningful trade-offs.
  const settings = {
    fast: {
      name: 'Fast',
      imageResolution: 220,
      downsampling: true,
      pdfPreset: '/ebook',
      compatibilityLevel: '1.6',
      colorStrategy: 'LeaveColorUnchanged',
      jpegQuality: 78,
      compressFonts: true,
      embedAllFonts: false,
      subsetFonts: true,
      adaptiveImageFiltering: false,
      downsampleThreshold: 1.35,
      passThroughImages: false,
    },
    lossless: {
      name: 'Lossless',
      imageResolution: 300,
      downsampling: false,
      pdfPreset: null,
      compatibilityLevel: '1.7',
      colorStrategy: 'LeaveColorUnchanged',
      jpegQuality: null,
      compressFonts: false,
      embedAllFonts: true,
      subsetFonts: false,
      passThroughImages: true,
      adaptiveImageFiltering: true,
    },
    balanced: {
      name: 'Balanced',
      imageResolution: 150,
      downsampling: true,
      pdfPreset: '/ebook',
      compatibilityLevel: '1.5',
      colorStrategy: 'LeaveColorUnchanged',
      jpegQuality: 62,
      compressFonts: true,
      embedAllFonts: false,
      subsetFonts: true,
      adaptiveImageFiltering: false,
      downsampleThreshold: 1.25,
      passThroughImages: false,
    },
    aggressive: {
      name: 'Aggressive',
      imageResolution: 96,
      downsampling: true,
      pdfPreset: '/screen',
      compatibilityLevel: '1.4',
      colorStrategy: 'RGB',
      jpegQuality: 38,
      compressFonts: true,
      embedAllFonts: false,
      subsetFonts: true,
      adaptiveImageFiltering: false,
      downsampleThreshold: 1.1,
      passThroughImages: false,
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
    '-dDetectDuplicateImages=true',
    '-dCompressPages=true',
    '-dEncodeColorImages=true',
    '-dEncodeGrayImages=true',
    '-dEncodeMonoImages=true',
    '-dUseCropBox=true',
    '-dPreserveOverprintSettings=true',
    '-dKeepDeviceN=true',
    `-dConvertCMYKImagesToRGB=${settings.colorStrategy === 'RGB' ? 'true' : 'false'}`,
  ];

  if (settings.downsampling) {
    args.push('-r' + settings.imageResolution + 'x' + settings.imageResolution);
  }

  if (settings.pdfPreset) {
    args.push(`-dPDFSETTINGS=${settings.pdfPreset}`);
  }

  args.push(`-dCompressFonts=${settings.compressFonts === false ? 'false' : 'true'}`);
  args.push(`-dEmbedAllFonts=${settings.embedAllFonts ? 'true' : 'false'}`);
  args.push(`-dSubsetFonts=${settings.subsetFonts === false ? 'false' : 'true'}`);

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
    args.push('-dColorImageDownsampleThreshold=' + (settings.downsampleThreshold || 1.5));
    args.push('-dGrayImageDownsampleThreshold=' + (settings.downsampleThreshold || 1.5));
    args.push('-dMonoImageDownsampleThreshold=' + (settings.downsampleThreshold || 1.5));

    if (settings.adaptiveImageFiltering) {
      args.push('-dAutoFilterColorImages=true');
      args.push('-dAutoFilterGrayImages=true');
    }

    if (Number.isFinite(settings.jpegQuality)) {
      if (!settings.adaptiveImageFiltering) {
        args.push('-dAutoFilterColorImages=false');
        args.push('-dAutoFilterGrayImages=false');
        args.push('-dColorImageFilter=/DCTEncode');
        args.push('-dGrayImageFilter=/DCTEncode');
      }
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

app.get('/', (req, res) => {
  const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  const tokenQuery = queryToken ? `?token=${encodeURIComponent(queryToken)}` : '';

  if (!DASHBOARD_TOKEN || queryToken) {
    res.redirect(302, `/dashboard${tokenQuery}`);
    return;
  }

  res.type('html').send(`<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PDF Backend Service</title>
  <style>
    body { font-family: Segoe UI, Tahoma, Arial, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .card { max-width: 620px; width: 100%; background: #111827; border: 1px solid #334155; border-radius: 14px; padding: 20px; }
    h1 { margin: 0 0 10px; font-size: 1.25rem; }
    p { margin: 0 0 12px; color: #cbd5e1; }
    code { background: #1f2937; padding: 2px 6px; border-radius: 6px; }
    a { color: #38bdf8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>PDF Backend Service Aktif</h1>
      <p>Dashboard diproteksi token. Akses dengan format:</p>
      <p><code>/dashboard?token=TOKEN_ANDA</code></p>
      <p>Endpoint health check: <a href="/api/health">/api/health</a></p>
    </div>
  </div>
</body>
</html>`);
});

app.get('/api/health', async (_req, res) => {
  const gsCommand = await getGhostscriptCommand();
  console.log('[Health Check] Found Ghostscript:', gsCommand);
  res.json({
    ok: true,
    service: 'pdf-compress-service',
    ghostscriptAvailable: Boolean(gsCommand),
    ghostscriptCommand: gsCommand,
    secondPassOptimizerEnabled: ENABLE_SECOND_PASS_OPTIMIZER,
    dashboardEnabled: true,
    dashboardProtected: Boolean(DASHBOARD_TOKEN),
  });
});

app.get('/dashboard', requireDashboardAccess, (_req, res) => {
  res.sendFile(path.join(dashboardPublicDir, 'dashboard.html'));
});

app.get('/dashboard/dashboard.js', (_req, res) => {
  res.type('application/javascript').sendFile(path.join(dashboardPublicDir, 'dashboard.js'));
});

app.get('/api/dashboard/metrics', requireDashboardAccess, (req, res) => {
  const compact = String(req.query.compact || '') === '1';
  const limitRaw = Number(req.query.limit || 40);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 40, 1), DASHBOARD_RETENTION);
  const summary = summarizeMetrics();

  if (compact) {
    res.json({ summary });
    return;
  }

  res.json({
    summary,
    recent: runtimeMetrics.recent.slice(0, limit),
    retention: DASHBOARD_RETENTION,
  });
});

app.post('/api/compress', compressionMetricsMiddleware, compressRateLimiter, upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'File PDF tidak ditemukan.' });
    return;
  }

  res.setHeader('X-Request-Id', req.requestId || 'unknown');

  const level = normalizeCompressionLevel(req.body.level);
  const inputPath = req.file.path;
  const outputPath = path.join(req.requestTempDir || os.tmpdir(), 'compressed.pdf');
  const startedAt = Date.now();
  const originalSize = (await fs.stat(inputPath)).size;
  let originalBuffer;

  const getOriginalBuffer = async () => {
    if (!originalBuffer) {
      originalBuffer = await fs.readFile(inputPath);
    }

    return originalBuffer;
  };

  try {
    const gsCommand = await getGhostscriptCommand();
    let outputBuffer;
    let method = 'pdf-lib-fallback';
    let strategy = 'single-pass';
    let selectedFrom = level;

    if (gsCommand) {
      try {
        await runGhostscript(inputPath, outputPath, level, gsCommand);
        outputBuffer = await fs.readFile(outputPath);
        method = `ghostscript:${gsCommand}`;
      } catch (gsError) {
        // Keep API reliable when Ghostscript rejects specific PDFs/options.
        console.warn('Ghostscript gagal, fallback ke pdf-lib:', gsError?.message || gsError);
        const pdfBytes = await fallbackCompressWithPdfLib(await getOriginalBuffer());
        outputBuffer = Buffer.from(pdfBytes);
        method = 'pdf-lib-fallback-after-gs-failed';
        selectedFrom = 'pdf-lib-fallback-after-gs-failed';
      }
    } else {
      // Fallback tetap fungsional jika Ghostscript belum terpasang.
      const pdfBytes = await fallbackCompressWithPdfLib(await getOriginalBuffer());
      outputBuffer = Buffer.from(pdfBytes);
      selectedFrom = 'pdf-lib-fallback-no-gs';
    }

    // Default mode prioritizes request latency. Enable second pass only when explicitly needed.
    strategy = 'latency-first-single-pass';

    if (ENABLE_SECOND_PASS_OPTIMIZER && method.startsWith('ghostscript')) {
      strategy = 'fidelity-smart-min-processed-only';
      const candidates = [{ buffer: outputBuffer, method }];

      try {
        const optimizedBytes = await fallbackCompressWithPdfLib(await getOriginalBuffer());
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
      selectedFrom = best.method;
    }

    // No-gain fallback: retry a safer lossless Ghostscript profile first.
    if (outputBuffer.length >= originalSize) {
      if (gsCommand && level !== 'lossless') {
        try {
          await runGhostscript(inputPath, outputPath, 'lossless', gsCommand);
          const losslessRetryBuffer = await fs.readFile(outputPath);

          if (losslessRetryBuffer.length < outputBuffer.length) {
            outputBuffer = losslessRetryBuffer;
            method = `ghostscript:${gsCommand}|lossless-retry-after-no-gain`;
            strategy = `${strategy}+no-gain-lossless-retry`;
            selectedFrom = 'lossless-retry-after-no-gain';
          }
        } catch (losslessRetryErr) {
          console.warn('Lossless retry gagal:', losslessRetryErr?.message || losslessRetryErr);
        }
      }
    }

    // Secondary fallback: try pdf-lib optimizer before applying hard size guard.
    if (outputBuffer.length >= originalSize) {
      try {
        const optimizedBytes = await fallbackCompressWithPdfLib(await getOriginalBuffer());
        const optimizedBuffer = Buffer.from(optimizedBytes);

        if (optimizedBuffer.length < outputBuffer.length) {
          outputBuffer = optimizedBuffer;
          method = 'pdf-lib-lossless-optimizer-after-no-gain';
          strategy = `${strategy}+no-gain-optimizer`;
          selectedFrom = 'pdf-lib-lossless-optimizer-after-no-gain';
        }
      } catch (optErr) {
        console.warn('No-gain optimizer gagal:', optErr?.message || optErr);
      }
    }

    // Guardrail: never return a "compressed" file that is larger than the original.
    if (outputBuffer.length >= originalSize) {
      outputBuffer = Buffer.from(await getOriginalBuffer());
      method = `${method}|size-guard-original`;
      strategy = `${strategy}+size-guard`;
      selectedFrom = 'original-size-guard';
    }

    const compressedSize = outputBuffer.length;

    const savedBytes = originalSize - compressedSize;
    const savedPercent = originalSize > 0 ? ((savedBytes / originalSize) * 100).toFixed(2) : '0.00';

    res.locals.compressionMeta = {
      level,
      method,
      strategy,
      selectedFrom,
      originalSize,
      compressedSize,
      savedPercent,
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="compressed.pdf"');
    res.setHeader('X-Compression-Method', method);
    res.setHeader('X-Original-Size', String(originalSize));
    res.setHeader('X-Compressed-Size', String(compressedSize));
    res.setHeader('X-Saved-Bytes', String(savedBytes));
    res.setHeader('X-Saved-Percent', String(savedPercent));
    res.setHeader('X-Compression-Level', level);
    res.setHeader('X-Compression-Strategy', strategy);
    res.setHeader('X-Compression-Selected-From', selectedFrom);
    res.setHeader('X-Processing-Time-Ms', String(Date.now() - startedAt));
    res.send(outputBuffer);
  } catch (error) {
    console.error('Compression error:', error);
    res.status(500).json({ error: 'Gagal mengompres PDF.' });
  } finally {
    await cleanupRequestTemp(req.requestTempDir);
  }
});

app.use(async (err, req, res, _next) => {
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

  if (req?.requestTempDir) {
    await cleanupRequestTemp(req.requestTempDir);
  }

  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PDF compression server running on http://0.0.0.0:${PORT}`);
});
