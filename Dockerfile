FROM node:20-bookworm-slim

WORKDIR /app

# Install conversion engines for production (Ghostscript, qpdf, LibreOffice, Python OCR stack).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ghostscript \
    qpdf \
    python3 \
    python3-pip \
    python3-venv \
    tesseract-ocr \
    tesseract-ocr-ind \
    tesseract-ocr-eng \
    poppler-utils \
    fonts-liberation \
    fonts-dejavu-core \
    libreoffice-core \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir \
  "PyMuPDF==1.24.14" \
  "pdf2docx==0.5.8" \
  "python-docx==1.1.2" \
  "pdfplumber==0.11.4" \
  "pytesseract==0.3.13" \
  "Pillow==11.1.0"

RUN python3 -c "import fitz; import pdf2docx; import pdfplumber; import pytesseract; print('Python deps OK')"

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server

ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

CMD ["node", "server/index.js"]
