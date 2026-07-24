document.addEventListener('DOMContentLoaded', () => {
  const auditForm = document.getElementById('auditForm');
  const urlInput = document.getElementById('urlInput');
  const ignoreCacheCheckbox = document.getElementById('ignoreCache');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn.querySelector('.btn-text');
  const spinner = submitBtn.querySelector('.spinner');

  const resultsSection = document.getElementById('resultsSection');
  const errorBox = document.getElementById('errorBox');
  const copyJsonBtn = document.getElementById('copyJsonBtn');

  // Sample Chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      urlInput.value = chip.dataset.url;
      auditForm.dispatchEvent(new Event('submit'));
    });
  });

  // Handle Form Submit
  auditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;

    setLoading(true);
    hideResults();
    hideError();

    try {
      const response = await fetch('/api/v1/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          ignoreCache: ignoreCacheCheckbox.checked
        })
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        showError(
          json.error?.code || 'AUDIT_FAILED',
          json.error?.message || 'An unexpected error occurred during the audit.',
          json.requestId
        );
      } else {
        renderResults(json.data);
      }
    } catch (err) {
      showError('NETWORK_ERROR', `Failed to connect to audit server: ${err.message}`);
    } finally {
      setLoading(false);
    }
  });

  // Copy JSON button
  copyJsonBtn.addEventListener('click', () => {
    const jsonCode = document.getElementById('jsonCode').textContent;
    navigator.clipboard.writeText(jsonCode);
    copyJsonBtn.textContent = 'Copied!';
    setTimeout(() => copyJsonBtn.textContent = 'Copy JSON', 2000);
  });

  function setLoading(loading) {
    submitBtn.disabled = loading;
    if (loading) {
      btnText.classList.add('hidden');
      spinner.classList.remove('hidden');
    } else {
      btnText.classList.remove('hidden');
      spinner.classList.add('hidden');
    }
  }

  function hideResults() {
    resultsSection.classList.add('hidden');
  }

  function hideError() {
    errorBox.classList.add('hidden');
  }

  function showError(code, message, requestId) {
    document.getElementById('errorTitle').textContent = `Error: ${code}`;
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorReqId').textContent = requestId ? `Request ID: ${requestId}` : '';
    errorBox.classList.remove('hidden');
  }

  function renderResults(data) {
    document.getElementById('resUrl').textContent = data.targetUrl;
    document.getElementById('resTimestamp').textContent = new Date(data.auditedAt).toLocaleString();

    // Status Tag
    const statusTag = document.getElementById('resStatusTag');
    statusTag.textContent = `HTTP ${data.statusCode} ${data.statusText}`;
    statusTag.className = `status-tag ${data.isSuccess ? 'success' : 'error'}`;

    // Cache Tag
    const cacheTag = document.getElementById('resCacheTag');
    cacheTag.textContent = data.cached ? 'Cache HIT' : 'Cache MISS';
    cacheTag.className = `cache-tag ${data.cached ? 'hit' : 'miss'}`;

    // Metrics
    document.getElementById('resTTFB').textContent = `${data.metrics.ttfbMs} ms`;
    document.getElementById('resTotalTime').textContent = `${data.metrics.totalTimeMs} ms`;
    document.getElementById('resSize').textContent = `${(data.metrics.contentLengthBytes / 1024).toFixed(2)} KB`;
    document.getElementById('resRequestId').textContent = data.requestId || 'N/A';

    // Security Headers
    const secList = document.getElementById('securityList');
    secList.innerHTML = '';
    const secHeaders = [
      { name: 'Strict-Transport-Security (HSTS)', key: 'hsts' },
      { name: 'Content-Security-Policy (CSP)', key: 'csp' },
      { name: 'X-Frame-Options', key: 'xFrameOptions' },
      { name: 'X-Content-Type-Options', key: 'contentTypeOptions' },
      { name: 'Referrer-Policy', key: 'referrerPolicy' }
    ];

    secHeaders.forEach(h => {
      const isPresent = data.securityHeaders[h.key];
      const li = document.createElement('li');
      li.className = `check-item ${isPresent ? 'pass' : 'fail'}`;
      li.innerHTML = `
        <span>${h.name}</span>
        <strong>${isPresent ? '✓ Enabled' : '✗ Missing'}</strong>
      `;
      secList.appendChild(li);
    });

    // SEO
    document.getElementById('resTitle').textContent = data.seo.title || 'Not specified';
    document.getElementById('resMetaDesc').textContent = data.seo.metaDescription || 'Not specified';
    document.getElementById('resCanonical').textContent = data.seo.canonicalUrl || 'Not specified';

    // Raw JSON
    document.getElementById('jsonCode').textContent = JSON.stringify(data, null, 2);

    resultsSection.classList.remove('hidden');
  }
});
