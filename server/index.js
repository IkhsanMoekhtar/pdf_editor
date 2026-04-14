import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import morgan from 'morgan';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
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
    totalRequests: 0,
    compressRequests: 0,
    success: 0,
    failed: 0,
    bytesIn: 0,
    bytesOut: 0,
  },
  activeRequests: 0,
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
    activeRequests: runtimeMetrics.activeRequests,
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

function getUploadBytesFromRequest(req) {
  if (req?.file?.size && Number.isFinite(req.file.size)) {
    return Number(req.file.size);
  }

  if (Array.isArray(req?.files)) {
    return req.files.reduce((sum, file) => {
      const size = Number(file?.size || 0);
      return Number.isFinite(size) && size > 0 ? sum + size : sum;
    }, 0);
  }

  if (req?.files && typeof req.files === 'object') {
    return Object.values(req.files).flat().reduce((sum, file) => {
      const size = Number(file?.size || 0);
      return Number.isFinite(size) && size > 0 ? sum + size : sum;
    }, 0);
  }

  const contentLength = Number(req?.headers?.['content-length'] || 0);
  return Number.isFinite(contentLength) && contentLength > 0 ? contentLength : 0;
}

function requestMetricsMiddleware(req, res, next) {
  const startedAt = Date.now();
  runtimeMetrics.activeRequests += 1;

  if (req.path === '/api/compress') {
    runtimeMetrics.activeCompressRequests += 1;
  }

  res.on('finish', () => {
    runtimeMetrics.activeRequests = Math.max(0, runtimeMetrics.activeRequests - 1);
    if (req.path === '/api/compress') {
      runtimeMetrics.activeCompressRequests = Math.max(0, runtimeMetrics.activeCompressRequests - 1);
      runtimeMetrics.totals.compressRequests += 1;
    }

    runtimeMetrics.totals.totalRequests += 1;

    const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
    if (isSuccess) {
      runtimeMetrics.totals.success += 1;
    } else {
      runtimeMetrics.totals.failed += 1;
    }

    const compressionMeta = res.locals?.compressionMeta || {};
    const requestMeta = res.locals?.requestMetricsMeta || {};
    const mergedMeta = {
      ...compressionMeta,
      ...requestMeta,
    };

    const inputSize = Number(
      mergedMeta.inputSize
      || mergedMeta.originalSize
      || getUploadBytesFromRequest(req)
      || 0,
    );
    const outputSizeHeader = Number(res.getHeader('content-length') || 0);
    const outputSize = Number(
      mergedMeta.outputSize
      || mergedMeta.compressedSize
      || outputSizeHeader
      || 0,
    );

    if (inputSize > 0) runtimeMetrics.totals.bytesIn += inputSize;
    if (outputSize > 0) runtimeMetrics.totals.bytesOut += outputSize;

    const requestPath = typeof req.originalUrl === 'string' ? req.originalUrl.split('?')[0] : req.path;
    const operation = mergedMeta.operation || (
      requestPath === '/api/compress'
        ? 'compress'
        : requestPath === '/api/merge'
          ? 'merge'
          : requestPath === '/api/split'
            ? 'split'
            : requestPath === '/api/convert'
              ? 'convert'
            : 'request'
    );

    const savedPercentCandidate = Number(mergedMeta.savedPercent);
    const savedPercent = Number.isFinite(savedPercentCandidate)
      ? savedPercentCandidate
      : (inputSize > 0 && outputSize >= 0 ? ((inputSize - outputSize) / inputSize) * 100 : Number.NaN);

    pushRecentMetric({
      at: Date.now(),
      requestId: req.requestId || 'unknown',
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      route: requestPath,
      httpMethod: req.method,
      operation,
      level: mergedMeta.level || (requestPath === '/api/compress' ? normalizeCompressionLevel(req.body?.level) : '-'),
      method: mergedMeta.method || req.method,
      strategy: mergedMeta.strategy || '-',
      selectedFrom: mergedMeta.selectedFrom || '-',
      originalSize: inputSize,
      compressedSize: outputSize,
      savedPercent,
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

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const WORD_EXTENSIONS = new Set(['.doc', '.docx']);
const PPT_EXTENSIONS = new Set(['.ppt', '.pptx']);
const EXCEL_EXTENSIONS = new Set(['.xls', '.xlsx']);
const OFFICE_TO_FORMAT = {
  word: 'docx',
  ppt: 'pptx',
  excel: 'xlsx',
};

const PDF_TO_JPEG_QUALITY = Number(process.env.PDF_TO_JPEG_QUALITY || 88);
const PDF_TO_JPEG_DPI = Number(process.env.PDF_TO_JPEG_DPI || 160);

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

app.use(requestMetricsMiddleware);

const uploadStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    cb(null, req.requestTempDir || os.tmpdir());
  },
  filename: (_req, _file, cb) => {
    cb(null, 'input.pdf');
  },
});

const uploadConvertStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    cb(null, req.requestTempDir || os.tmpdir());
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    cb(null, `input${extension || ''}`);
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

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
    files: 20,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('File harus berformat PDF.'));
      return;
    }

    cb(null, true);
  },
});

const uploadConvert = multer({
  storage: uploadConvertStorage,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
    files: 1,
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

function sanitizeBaseFilename(filename = 'document') {
  const normalized = String(filename || 'document')
    .replace(/\.[^/.]+$/, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'document';
}

function parseSplitRanges(rawRanges, totalPages) {
  if (typeof rawRanges !== 'string' || !rawRanges.trim()) {
    throw new Error('Range halaman wajib diisi. Contoh: 1-3,5,8-10');
  }

  const parts = rawRanges
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!parts.length) {
    throw new Error('Format range tidak valid.');
  }

  const ranges = [];

  for (const part of parts) {
    const singleMatch = /^(\d+)$/.exec(part);
    const spanMatch = /^(\d+)\s*-\s*(\d+)$/.exec(part);

    let start;
    let end;

    if (singleMatch) {
      start = Number(singleMatch[1]);
      end = start;
    } else if (spanMatch) {
      start = Number(spanMatch[1]);
      end = Number(spanMatch[2]);
    } else {
      throw new Error(`Format range tidak valid: ${part}`);
    }

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1) {
      throw new Error(`Range tidak valid: ${part}`);
    }

    if (start > end) {
      throw new Error(`Range harus urut naik: ${part}`);
    }

    if (start > totalPages || end > totalPages) {
      throw new Error(`Range ${part} melebihi total halaman (${totalPages}).`);
    }

    ranges.push({ start, end });
  }

  return ranges;
}

const LEVEL_MIN_SAVING_PERCENT = {
  fast: 1.5,
  lossless: 0.5,
  balanced: 8,
  aggressive: 15,
};

function cloneSettings(settings, overrides = {}) {
  return {
    ...settings,
    ...overrides,
  };
}

let cachedGhostscriptCommand;
let ghostscriptLookupPromise = null;
let cachedQpdfCommand;
let qpdfLookupPromise = null;
let cachedLibreOfficeCommand;
let libreOfficeLookupPromise = null;

function getCompressionSettings(level) {
  // Distinct profiles so each level produces meaningful trade-offs.
  const settings = {
    fast: {
      name: 'Fast',
      imageResolution: 300,
      downsampling: false,
      pdfPreset: null,
      compatibilityLevel: '1.6',
      colorStrategy: 'LeaveColorUnchanged',
      jpegQuality: null,
      compressFonts: true,
      embedAllFonts: false,
      subsetFonts: true,
      adaptiveImageFiltering: true,
      downsampleThreshold: 1.5,
      passThroughImages: true,
      optimizeStructure: false,
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
      optimizeStructure: false,
    },
    balanced: {
      name: 'Balanced',
      imageResolution: 130,
      downsampling: true,
      pdfPreset: '/ebook',
      compatibilityLevel: '1.5',
      colorStrategy: 'LeaveColorUnchanged',
      jpegQuality: 50,
      compressFonts: true,
      embedAllFonts: false,
      subsetFonts: true,
      adaptiveImageFiltering: false,
      downsampleThreshold: 1.15,
      passThroughImages: false,
      optimizeStructure: true,
    },
    aggressive: {
      name: 'Aggressive',
      imageResolution: 64,
      downsampling: true,
      pdfPreset: '/screen',
      compatibilityLevel: '1.4',
      // Keep original color intent (no grayscale conversion), only increase lossy compression.
      colorStrategy: 'LeaveColorUnchanged',
      jpegQuality: 20,
      compressFonts: true,
      embedAllFonts: false,
      subsetFonts: true,
      adaptiveImageFiltering: false,
      downsampleThreshold: 1.0,
      passThroughImages: false,
      optimizeStructure: true,
    }
  };
  
  return settings[level] || settings.balanced;
}

function getCompressionCandidates(level) {
  const base = getCompressionSettings(level);

  if (level === 'lossless') {
    return [base];
  }

  if (level === 'fast') {
    return [base];
  }

  if (level === 'balanced') {
    return [
      base,
      cloneSettings(base, { imageResolution: 115, jpegQuality: 42, downsampleThreshold: 1.08 }),
      cloneSettings(base, { imageResolution: 100, jpegQuality: 36, downsampleThreshold: 1.02 }),
    ];
  }

  // aggressive
  return [
    base,
    cloneSettings(base, { imageResolution: 52, jpegQuality: 16, downsampleThreshold: 1.0 }),
    cloneSettings(base, { imageResolution: 44, jpegQuality: 12, downsampleThreshold: 1.0 }),
    cloneSettings(base, { imageResolution: 36, jpegQuality: 10, downsampleThreshold: 1.0 }),
  ];
}

function buildGhostscriptArgs(settings, inputPath, outputPath) {
  const shouldOptimizeStructure = settings.optimizeStructure !== false;
  const args = [
    '-sDEVICE=pdfwrite',
    `-dCompatibilityLevel=${settings.compatibilityLevel || '1.4'}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    `-dDetectDuplicateImages=${shouldOptimizeStructure ? 'true' : 'false'}`,
    `-dCompressPages=${shouldOptimizeStructure ? 'true' : 'false'}`,
    `-dEncodeColorImages=${shouldOptimizeStructure ? 'true' : 'false'}`,
    `-dEncodeGrayImages=${shouldOptimizeStructure ? 'true' : 'false'}`,
    `-dEncodeMonoImages=${shouldOptimizeStructure ? 'true' : 'false'}`,
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

async function findQpdfCommand() {
  const candidates = process.platform === 'win32'
    ? ['qpdf']
    : ['qpdf'];

  for (const cmd of candidates) {
    if (await commandExists(cmd)) return cmd;
  }

  if (process.platform === 'win32') {
    try {
      const qpdfBin = 'C:\\Program Files\\qpdf\\bin\\qpdf.exe';
      await fs.access(qpdfBin);
      return qpdfBin;
    } catch {
      // File doesn't exist, continue
    }
  }

  return null;
}

async function findLibreOfficeCommand() {
  const candidates = process.platform === 'win32'
    ? ['soffice', 'soffice.com', 'soffice.exe']
    : ['soffice', 'libreoffice'];

  for (const cmd of candidates) {
    if (await commandExists(cmd)) return cmd;
  }

  if (process.platform === 'win32') {
    const windowsCandidates = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    ];

    for (const filePath of windowsCandidates) {
      try {
        await fs.access(filePath);
        return filePath;
      } catch {
        // ignore and continue checking other paths
      }
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

async function getQpdfCommand() {
  if (cachedQpdfCommand !== undefined) {
    return cachedQpdfCommand;
  }

  if (qpdfLookupPromise) {
    return qpdfLookupPromise;
  }

  qpdfLookupPromise = findQpdfCommand()
    .then((cmd) => {
      cachedQpdfCommand = cmd;
      return cmd;
    })
    .finally(() => {
      qpdfLookupPromise = null;
    });

  return qpdfLookupPromise;
}

async function getLibreOfficeCommand() {
  if (cachedLibreOfficeCommand !== undefined) {
    return cachedLibreOfficeCommand;
  }

  if (libreOfficeLookupPromise) {
    return libreOfficeLookupPromise;
  }

  libreOfficeLookupPromise = findLibreOfficeCommand()
    .then((cmd) => {
      cachedLibreOfficeCommand = cmd;
      return cmd;
    })
    .finally(() => {
      libreOfficeLookupPromise = null;
    });

  return libreOfficeLookupPromise;
}

function runLibreOfficeConvert(inputPath, outputDir, outputFilter, libreOfficeCommand) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless',
      '--nologo',
      '--nolockcheck',
      '--norestore',
      '--convert-to',
      outputFilter,
      '--outdir',
      outputDir,
      inputPath,
    ];

    const proc = spawn(libreOfficeCommand, args, { windowsHide: true });
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || 'LibreOffice gagal mengonversi file.'));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

function runGhostscriptPdfToJpeg(inputPath, outputPattern, gsCommand) {
  return new Promise((resolve, reject) => {
    const args = [
      '-dNOPAUSE',
      '-dBATCH',
      '-dQUIET',
      '-sDEVICE=jpeg',
      `-r${PDF_TO_JPEG_DPI}`,
      `-dJPEGQ=${PDF_TO_JPEG_QUALITY}`,
      `-sOutputFile=${outputPattern}`,
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
        reject(new Error(stderr || 'Ghostscript gagal mengonversi PDF ke JPG.'));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

async function convertImageToPdf(inputPath) {
  const ext = path.extname(inputPath || '').toLowerCase();
  const imageBytes = await fs.readFile(inputPath);
  const doc = await PDFDocument.create();
  let image;

  if (ext === '.png') {
    image = await doc.embedPng(imageBytes);
  } else {
    image = await doc.embedJpg(imageBytes);
  }

  const page = doc.addPage([image.width, image.height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });

  const bytes = await doc.save({
    useObjectStreams: true,
    updateFieldAppearances: false,
    addDefaultPage: false,
  });
  return Buffer.from(bytes);
}

function detectSourceCategory(filePath) {
  const ext = path.extname(filePath || '').toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (WORD_EXTENSIONS.has(ext)) return 'word';
  if (PPT_EXTENSIONS.has(ext)) return 'ppt';
  if (EXCEL_EXTENSIONS.has(ext)) return 'excel';
  return 'unknown';
}

async function findFileByExtension(directory, extension) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const targetExt = extension.toLowerCase();
  const match = entries.find((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === targetExt);
  return match ? path.join(directory, match.name) : null;
}

async function findAllFilesByExtension(directory, extension) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const targetExt = extension.toLowerCase();
  return entries
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === targetExt)
    .map((entry) => path.join(directory, entry.name));
}

function runGhostscript(inputPath, outputPath, settings, gsCommand) {
  return new Promise((resolve, reject) => {
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

function runQpdfOptimize(inputPath, outputPath, qpdfCommand) {
  return new Promise((resolve, reject) => {
    const args = [
      '--stream-data=compress',
      '--object-streams=generate',
      '--replace-input',
      inputPath,
    ];

    const proc = spawn(qpdfCommand, args, {
      windowsHide: true,
      cwd: path.dirname(inputPath),
    });
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || 'qpdf gagal memproses file.'));
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

async function optimizeBufferWithQpdf(buffer, requestTempDir, qpdfCommand, fileTag) {
  if (!qpdfCommand || !buffer || !buffer.length) return null;

  const safeTag = String(fileTag || 'qpdf').replace(/[^a-z0-9_-]/gi, '_');
  const workPath = path.join(requestTempDir || os.tmpdir(), `${safeTag}.pdf`);
  await fs.writeFile(workPath, buffer);
  await runQpdfOptimize(workPath, workPath, qpdfCommand);
  return fs.readFile(workPath);
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
  const qpdfCommand = await getQpdfCommand();
  const libreOfficeCommand = await getLibreOfficeCommand();
  console.log('[Health Check] Found Ghostscript:', gsCommand);
  console.log('[Health Check] Found qpdf:', qpdfCommand);
  console.log('[Health Check] Found LibreOffice:', libreOfficeCommand);
  res.json({
    ok: true,
    service: 'pdf-compress-service',
    ghostscriptAvailable: Boolean(gsCommand),
    ghostscriptCommand: gsCommand,
    qpdfAvailable: Boolean(qpdfCommand),
    qpdfCommand,
    libreOfficeAvailable: Boolean(libreOfficeCommand),
    libreOfficeCommand,
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

app.post('/api/merge', uploadMemory.array('pdfs', 20), async (req, res) => {
  const files = req.files || [];

  if (files.length < 2) {
    res.status(400).json({ error: 'Upload minimal 2 file PDF untuk digabung.' });
    return;
  }

  try {
    const inputSize = files.reduce((sum, file) => sum + Number(file?.size || 0), 0);
    const mergedDoc = await PDFDocument.create();
    let totalPages = 0;

    for (const file of files) {
      const srcDoc = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
      const pageIndices = srcDoc.getPages().map((_, index) => index);
      const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);

      copiedPages.forEach((page) => mergedDoc.addPage(page));
      totalPages += copiedPages.length;
    }

    const bytes = await mergedDoc.save({
      useObjectStreams: true,
      updateFieldAppearances: false,
      addDefaultPage: false,
    });
    const outputBuffer = Buffer.from(bytes);

    res.locals.requestMetricsMeta = {
      operation: 'merge',
      method: 'pdf-lib-merge',
      strategy: 'ordered-append',
      level: '-',
      inputSize,
      outputSize: outputBuffer.length,
      savedPercent: Number.NaN,
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="merged.pdf"');
    res.setHeader('X-Merged-Files', String(files.length));
    res.setHeader('X-Total-Pages', String(totalPages));
    res.send(outputBuffer);
  } catch (error) {
    console.error('Merge error:', error);
    res.status(500).json({ error: 'Gagal menggabungkan PDF.' });
  }
});

app.post('/api/split', uploadMemory.single('pdf'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'File PDF tidak ditemukan.' });
    return;
  }

  const mode = typeof req.body?.mode === 'string' ? req.body.mode.trim().toLowerCase() : 'each';
  const allowedModes = new Set(['each', 'ranges']);

  if (!allowedModes.has(mode)) {
    res.status(400).json({ error: 'Mode split tidak valid. Gunakan each atau ranges.' });
    return;
  }

  try {
    const sourceDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true });
    const totalPages = sourceDoc.getPageCount();

    if (!totalPages) {
      res.status(400).json({ error: 'PDF tidak memiliki halaman untuk dipisah.' });
      return;
    }

    const ranges = mode === 'each'
      ? Array.from({ length: totalPages }, (_, index) => ({ start: index + 1, end: index + 1 }))
      : parseSplitRanges(req.body?.ranges, totalPages);

    const zip = new JSZip();
    const baseName = sanitizeBaseFilename(req.file.originalname || 'split');

    for (const range of ranges) {
      const splitDoc = await PDFDocument.create();
      const pageIndices = [];

      for (let page = range.start; page <= range.end; page += 1) {
        pageIndices.push(page - 1);
      }

      const copiedPages = await splitDoc.copyPages(sourceDoc, pageIndices);
      copiedPages.forEach((page) => splitDoc.addPage(page));

      const splitBytes = await splitDoc.save({
        useObjectStreams: true,
        updateFieldAppearances: false,
        addDefaultPage: false,
      });

      const suffix = range.start === range.end
        ? `p${String(range.start).padStart(3, '0')}`
        : `p${String(range.start).padStart(3, '0')}-${String(range.end).padStart(3, '0')}`;

      zip.file(`${baseName}_${suffix}.pdf`, Buffer.from(splitBytes));
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    res.locals.requestMetricsMeta = {
      operation: 'split',
      method: 'pdf-lib-split+zip',
      strategy: mode === 'each' ? 'split-each-page' : 'split-ranges',
      level: '-',
      inputSize: Number(req.file?.size || 0),
      outputSize: zipBuffer.length,
      savedPercent: Number.NaN,
    };

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}_split.zip"`);
    res.setHeader('X-Split-Mode', mode);
    res.setHeader('X-Split-Parts', String(ranges.length));
    res.setHeader('X-Total-Pages', String(totalPages));
    res.send(zipBuffer);
  } catch (error) {
    console.error('Split error:', error);
    res.status(500).json({ error: error.message || 'Gagal memisah PDF.' });
  }
});

app.post('/api/convert', uploadConvert.single('file'), async (req, res) => {
  if (!req.file?.path) {
    res.status(400).json({ error: 'File input tidak ditemukan.' });
    await cleanupRequestTemp(req.requestTempDir);
    return;
  }

  const direction = typeof req.body?.direction === 'string' ? req.body.direction.trim().toLowerCase() : '';
  const target = typeof req.body?.target === 'string' ? req.body.target.trim().toLowerCase() : '';
  const validDirections = new Set(['to-pdf', 'from-pdf']);
  const validTargets = new Set(['jpg', 'word', 'ppt', 'excel']);

  if (!validDirections.has(direction) || !validTargets.has(target)) {
    res.status(400).json({ error: 'Parameter konversi tidak valid.' });
    await cleanupRequestTemp(req.requestTempDir);
    return;
  }

  const inputPath = req.file.path;
  const inputName = req.file.originalname || path.basename(inputPath);
  const inputBaseName = sanitizeBaseFilename(inputName);
  const sourceCategory = detectSourceCategory(inputPath);

  try {
    let outputBuffer;
    let outputFileName;
    let contentType;
    let method;
    let conversionSource;
    let conversionTarget;

    if (direction === 'to-pdf') {
      if (target === 'jpg') {
        if (sourceCategory !== 'image') {
          res.status(400).json({ error: 'Konversi JPG ke PDF hanya menerima file JPG/JPEG/PNG.' });
          return;
        }

        outputBuffer = await convertImageToPdf(inputPath);
        outputFileName = `${inputBaseName}.pdf`;
        contentType = 'application/pdf';
        method = 'pdf-lib-image-to-pdf';
        conversionSource = 'image';
        conversionTarget = 'pdf';
      } else {
        const requiredSource = target;
        if (sourceCategory !== requiredSource) {
          const labelMap = {
            word: 'DOC/DOCX',
            ppt: 'PPT/PPTX',
            excel: 'XLS/XLSX',
          };
          res.status(400).json({ error: `Konversi ${target.toUpperCase()} ke PDF hanya menerima file ${labelMap[target]}.` });
          return;
        }

        const libreOfficeCommand = await getLibreOfficeCommand();
        if (!libreOfficeCommand) {
          res.status(503).json({ error: 'LibreOffice tidak tersedia di backend.' });
          return;
        }

        await runLibreOfficeConvert(inputPath, req.requestTempDir, 'pdf', libreOfficeCommand);
        const convertedPath = await findFileByExtension(req.requestTempDir, '.pdf');
        if (!convertedPath) {
          throw new Error('Hasil konversi PDF tidak ditemukan.');
        }

        outputBuffer = await fs.readFile(convertedPath);
        outputFileName = `${inputBaseName}.pdf`;
        contentType = 'application/pdf';
        method = `libreoffice:${libreOfficeCommand}`;
        conversionSource = target;
        conversionTarget = 'pdf';
      }
    } else {
      if (sourceCategory !== 'pdf') {
        res.status(400).json({ error: 'Konversi dari PDF hanya menerima file PDF.' });
        return;
      }

      if (target === 'jpg') {
        const gsCommand = await getGhostscriptCommand();
        if (!gsCommand) {
          res.status(503).json({ error: 'Ghostscript tidak tersedia di backend.' });
          return;
        }

        const outputPattern = path.join(req.requestTempDir, `${inputBaseName}_page_%03d.jpg`);
        await runGhostscriptPdfToJpeg(inputPath, outputPattern, gsCommand);
        const jpgFiles = await findAllFilesByExtension(req.requestTempDir, '.jpg');

        if (!jpgFiles.length) {
          throw new Error('Hasil JPG tidak ditemukan.');
        }

        const sortedJpgFiles = [...jpgFiles].sort((a, b) => a.localeCompare(b));

        if (sortedJpgFiles.length === 1) {
          outputBuffer = await fs.readFile(sortedJpgFiles[0]);
          outputFileName = `${inputBaseName}.jpg`;
          contentType = 'image/jpeg';
        } else {
          const zip = new JSZip();
          for (const jpgFile of sortedJpgFiles) {
            const bytes = await fs.readFile(jpgFile);
            zip.file(path.basename(jpgFile), bytes);
          }

          outputBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
          });
          outputFileName = `${inputBaseName}_jpg.zip`;
          contentType = 'application/zip';
        }

        method = `ghostscript:${gsCommand}`;
        conversionSource = 'pdf';
        conversionTarget = 'jpg';
      } else {
        const libreOfficeCommand = await getLibreOfficeCommand();
        if (!libreOfficeCommand) {
          res.status(503).json({ error: 'LibreOffice tidak tersedia di backend.' });
          return;
        }

        const officeFormat = OFFICE_TO_FORMAT[target];
        await runLibreOfficeConvert(inputPath, req.requestTempDir, officeFormat, libreOfficeCommand);
        const convertedPath = await findFileByExtension(req.requestTempDir, `.${officeFormat}`);
        if (!convertedPath) {
          throw new Error(`Hasil konversi ${officeFormat.toUpperCase()} tidak ditemukan.`);
        }

        outputBuffer = await fs.readFile(convertedPath);
        outputFileName = `${inputBaseName}.${officeFormat}`;

        const contentTypeByExt = {
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
        contentType = contentTypeByExt[officeFormat] || 'application/octet-stream';
        method = `libreoffice:${libreOfficeCommand}`;
        conversionSource = 'pdf';
        conversionTarget = target;
      }
    }

    res.locals.requestMetricsMeta = {
      operation: 'convert',
      method,
      strategy: `${direction}:${target}`,
      level: '-',
      inputSize: Number(req.file?.size || 0),
      outputSize: outputBuffer.length,
      savedPercent: Number.NaN,
    };

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"`);
    res.setHeader('X-Conversion-Method', method);
    res.setHeader('X-Conversion-Source', conversionSource);
    res.setHeader('X-Conversion-Target', conversionTarget);
    res.send(outputBuffer);
  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: error.message || 'Gagal mengonversi file.' });
  } finally {
    await cleanupRequestTemp(req.requestTempDir);
  }
});

app.post('/api/compress', compressRateLimiter, upload.single('pdf'), async (req, res) => {
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
    const qpdfCommand = await getQpdfCommand();
    let outputBuffer;
    let method = 'pdf-lib-fallback';
    let strategy = 'single-pass';
    let selectedFrom = level;

    if (level === 'fast') {
      // Fast mode prioritizes latency and fidelity over size reduction.
      outputBuffer = Buffer.from(await getOriginalBuffer());
      method = 'fast-pass-through-original';
      strategy = 'speed-first-pass-through';
      selectedFrom = 'original-fast-pass-through';
    } else if (level === 'lossless') {
      const pdfBytes = await fallbackCompressWithPdfLib(await getOriginalBuffer());
      outputBuffer = Buffer.from(pdfBytes);
      method = 'pdf-lib-lossless-single-pass';
      strategy = 'lossless-single-pass';
      selectedFrom = 'pdf-lib-lossless-single-pass';
    } else if (gsCommand) {
      try {
        const candidates = getCompressionCandidates(level);
        let bestOutputBuffer = null;
        let bestSelectedFrom = level;
        const savingTarget = LEVEL_MIN_SAVING_PERCENT[level] || 0;

        for (let idx = 0; idx < candidates.length; idx += 1) {
          const settings = candidates[idx];
          await runGhostscript(inputPath, outputPath, settings, gsCommand);
          const candidateBuffer = await fs.readFile(outputPath);

          if (!bestOutputBuffer || candidateBuffer.length < bestOutputBuffer.length) {
            bestOutputBuffer = candidateBuffer;
            bestSelectedFrom = `${level}:profile-${idx + 1}`;
          }

          if (bestOutputBuffer.length < originalSize) {
            const savedPercent = ((originalSize - bestOutputBuffer.length) / originalSize) * 100;
            const shouldStopForFast = level === 'fast' && savedPercent >= savingTarget;
            const shouldStopForBalanced = level === 'balanced' && idx >= 1 && savedPercent >= savingTarget;

            if (shouldStopForFast || shouldStopForBalanced) {
              break;
            }
          }
        }

        outputBuffer = bestOutputBuffer;
        selectedFrom = bestSelectedFrom;
        method = `ghostscript:${gsCommand}`;
        strategy = 'latency-first-single-pass';
      } catch (gsError) {
        // Keep API reliable when Ghostscript rejects specific PDFs/options.
        console.warn('Ghostscript gagal, fallback ke pdf-lib:', gsError?.message || gsError);
        const pdfBytes = await fallbackCompressWithPdfLib(await getOriginalBuffer());
        outputBuffer = Buffer.from(pdfBytes);
        method = 'pdf-lib-fallback-after-gs-failed';
        strategy = 'lossless-fallback-after-gs-failed';
        selectedFrom = 'pdf-lib-fallback-after-gs-failed';
      }
    } else {
      // Fallback tetap fungsional jika Ghostscript belum terpasang untuk mode lossy.
      const pdfBytes = await fallbackCompressWithPdfLib(await getOriginalBuffer());
      outputBuffer = Buffer.from(pdfBytes);
      method = 'pdf-lib-fallback-no-gs';
      strategy = 'lossless-fallback-no-gs';
      selectedFrom = 'pdf-lib-fallback-no-gs';
    }

    if (qpdfCommand) {
      try {
        const qpdfOptimized = await optimizeBufferWithQpdf(outputBuffer, req.requestTempDir, qpdfCommand, `${req.requestId || 'req'}-${level}-qpdf`);

        if (qpdfOptimized?.length && qpdfOptimized.length < outputBuffer.length) {
          outputBuffer = qpdfOptimized;
          method = `${method}|qpdf-opt`;
          strategy = `${strategy}+qpdf-structure`;
          selectedFrom = `qpdf-after-${selectedFrom}`;
        }
      } catch (qpdfErr) {
        console.warn('qpdf optimizer gagal:', qpdfErr?.message || qpdfErr);
      }
    }

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
      operation: 'compress',
      level,
      method,
      strategy,
      selectedFrom,
      inputSize: originalSize,
      outputSize: compressedSize,
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
