document.addEventListener('DOMContentLoaded', () => {
  const auditForm = document.getElementById('auditForm');
  const urlInput = document.getElementById('urlInput');
  const ignoreCacheCheckbox = document.getElementById('ignoreCache');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn.querySelector('.btn-text');
  const spinner = submitBtn.querySelector('.spinner');

  const progressBox = document.getElementById('progressBox');
  const progressStepText = document.getElementById('progressStepText');
  const progressBarFill = document.getElementById('progressBarFill');

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

  // Handle Form Submit with Step Animation
  auditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;

    setLoading(true);
    hideResults();
    hideError();
    startProgressAnimation();

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
      stopProgressAnimation();
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

  let progressInterval;
  function startProgressAnimation() {
    progressBox.classList.remove('hidden');
    const steps = [
      { text: '🔍 Validating URL & Checking SSRF Blocklist...', percent: 20 },
      { text: '🌐 Resolving Host & Connecting to Target...', percent: 45 },
      { text: '⏱️ Measuring TTFB & Downloading Content Payload...', percent: 70 },
      { text: '🛡️ Inspecting Security Headers & SEO Metadata...', percent: 90 },
      { text: '⚡ Calculating Health Index...', percent: 98 }
    ];

    let currentStep = 0;
    progressStepText.textContent = steps[0].text;
    progressBarFill.style.width = `${steps[0].percent}%`;

    progressInterval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        progressStepText.textContent = steps[currentStep].text;
        progressBarFill.style.width = `${steps[currentStep].percent}%`;
      }
    }, 400);
  }

  function stopProgressAnimation() {
    clearInterval(progressInterval);
    progressBarFill.style.width = '100%';
    setTimeout(() => {
      progressBox.classList.add('hidden');
      progressBarFill.style.width = '0%';
    }, 300);
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

    // Health Score Hero Card
    if (data.score) {
      document.getElementById('heroScoreNum').textContent = data.score.total;
      document.getElementById('heroScoreRating').textContent = data.score.rating;
      
      const circle = document.getElementById('scoreCircle');
      circle.className = `score-circle ${data.score.badgeColor}`;

      document.getElementById('scoreSec').textContent = `${data.score.breakdown.security}/40`;
      document.getElementById('scorePerf').textContent = `${data.score.breakdown.performance}/30`;
      document.getElementById('scoreSeo').textContent = `${data.score.breakdown.seo}/30`;
    }

    // Status Tag
    const statusTag = document.getElementById('resStatusTag');
    statusTag.textContent = `HTTP ${data.statusCode} ${data.statusText}`;
    statusTag.className = `status-tag ${data.isSuccess ? 'success' : 'error'}`;

    // Cache Tag
    const cacheTag = document.getElementById('resCacheTag');
    cacheTag.textContent = data.cached ? 'Cache HIT' : 'Cache MISS';
    cacheTag.className = `cache-tag ${data.cached ? 'hit' : 'miss'}`;

    // Color-Coded Metrics
    const ttfbCard = document.getElementById('cardTTFB');
    const ttfbVal = data.metrics.ttfbMs;
    document.getElementById('resTTFB').textContent = `${ttfbVal} ms`;
    ttfbCard.className = `metric-card ${ttfbVal < 200 ? 'good' : (ttfbVal <= 500 ? 'warn' : 'bad')}`;

    const totalCard = document.getElementById('cardTotalTime');
    const totalVal = data.metrics.totalTimeMs;
    document.getElementById('resTotalTime').textContent = `${totalVal} ms`;
    totalCard.className = `metric-card ${totalVal < 500 ? 'good' : (totalVal <= 1000 ? 'warn' : 'bad')}`;

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
