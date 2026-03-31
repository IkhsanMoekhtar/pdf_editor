FROM node:20-bookworm-slim

WORKDIR /app

# Install Ghostscript for stronger PDF compression in production.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ghostscript \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server

ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

CMD ["node", "server/index.js"]
