window.NEWSY_API_BASE = (function () {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  const meta = document.querySelector('meta[name="api-base"]');
  const value = meta && meta.getAttribute('content');
  if (value && !value.startsWith('__')) return value;
  console.error('[config] api-base meta tag not set — deploy may be misconfigured');
  return window.location.origin;
})();