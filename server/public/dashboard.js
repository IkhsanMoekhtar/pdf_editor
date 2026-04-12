const lastUpdatedEl = document.getElementById('last-updated');
const healthStatusEl = document.getElementById('health-status');
const activeEl = document.getElementById('active');
const totalEl = document.getElementById('total');
const successRateEl = document.getElementById('success-rate');
const latencyEl = document.getElementById('latency');
const bytesEl = document.getElementById('bytes');
const uptimeEl = document.getElementById('uptime');
const recentBodyEl = document.getElementById('recent-body');
const errorMsgEl = document.getElementById('error-msg');
const refreshBtn = document.getElementById('refresh-btn');

const params = new URLSearchParams(window.location.search);
const token = params.get('token') || '';
const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatUptime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}j ${minutes}m ${seconds}d`;
}

function fmtTime(ts) {
  if (!Number.isFinite(ts)) return '-';
  return new Date(ts).toLocaleTimeString('id-ID', { hour12: false });
}

function renderRecent(recent) {
  if (!Array.isArray(recent) || recent.length === 0) {
    recentBodyEl.innerHTML = '<tr><td colspan="11">Belum ada request.</td></tr>';
    return;
  }

  const rows = recent.map((item) => {
    const isOk = item.statusCode >= 200 && item.statusCode < 400;
    const statusClass = isOk ? 'ok' : 'bad';
    return `
      <tr>
        <td>${fmtTime(item.at)}</td>
        <td>${item.httpMethod || '-'}</td>
        <td>${item.route || '-'}</td>
        <td class="${statusClass}">${item.statusCode}</td>
        <td>${formatDuration(item.durationMs)}</td>
        <td>${item.operation || '-'}</td>
        <td>${item.level || '-'}</td>
        <td>${item.method || '-'}</td>
        <td>${formatBytes(item.originalSize)}</td>
        <td>${formatBytes(item.compressedSize)}</td>
        <td>${Number.isFinite(item.savedPercent) ? `${item.savedPercent.toFixed(2)}%` : '-'}</td>
        <td>${item.requestId || '-'}</td>
      </tr>`;
  });

  recentBodyEl.innerHTML = rows.join('');
}

function renderSummary(summary) {
  const totals = summary?.totals || {};
  const latency = summary?.latencyMs || {};

  const total = Number(totals.totalRequests || totals.compressRequests || 0);
  const success = Number(totals.success || 0);
  const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : '0.0';

  activeEl.textContent = Number(summary?.activeRequests || summary?.activeCompressRequests || 0);
  totalEl.textContent = total;
  successRateEl.textContent = `${successRate}%`;
  latencyEl.textContent = `${formatDuration(latency.avg || 0)} / ${formatDuration(latency.p95 || 0)}`;
  bytesEl.textContent = `${formatBytes(totals.bytesIn || 0)} / ${formatBytes(totals.bytesOut || 0)}`;
  uptimeEl.textContent = formatUptime(summary?.uptimeMs || 0);
}

async function fetchHealth() {
  const res = await fetch(`/api/health${tokenQuery}`);
  if (!res.ok) throw new Error(`Health check gagal (${res.status})`);
  const health = await res.json();

  const ok = Boolean(health.ok);
  healthStatusEl.textContent = ok ? 'Service Online' : 'Service Bermasalah';
  healthStatusEl.className = `status ${ok ? 'ok' : 'warn'}`;
}

async function fetchMetrics() {
  const res = await fetch(`/api/dashboard/metrics${tokenQuery ? `${tokenQuery}&limit=50` : '?limit=50'}`);
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Akses dashboard ditolak. Tambahkan token pada URL: ?token=...');
    }
    throw new Error(`Gagal mengambil metrik (${res.status})`);
  }

  return res.json();
}

async function refreshAll() {
  errorMsgEl.textContent = '';

  try {
    await fetchHealth();
    const payload = await fetchMetrics();
    renderSummary(payload.summary || {});
    renderRecent(payload.recent || []);
    lastUpdatedEl.textContent = `Update terakhir: ${new Date().toLocaleTimeString('id-ID', { hour12: false })}`;
  } catch (err) {
    errorMsgEl.textContent = err?.message || 'Terjadi kesalahan saat memuat dashboard.';
  }
}

refreshBtn.addEventListener('click', () => {
  refreshAll();
});

refreshAll();
window.setInterval(refreshAll, 5000);
