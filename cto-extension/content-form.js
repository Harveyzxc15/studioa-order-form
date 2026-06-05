/* ==========================================================================
 *  STUDIO A — CTO 擴充：表單頁 content script
 * --------------------------------------------------------------------------
 *  1. 載入時向 background 註冊「我是表單分頁」（供 background 精準回送資料）。
 *  2. 收到 background 的 CTO_APPLY → window.postMessage({__studioa_cto:data})，
 *     交給「表單頁既有的 message 監聽器」→ applyCtoData / applyCelData。
 *     ⇒ 表單核心邏輯零改動。
 * ========================================================================== */
(function () {
  'use strict';

  // 註冊自己（讓 background 記住這個分頁是表單）
  try { chrome.runtime.sendMessage({ type: 'FORM_READY' }); } catch (e) {}
  // SPA/重新整理後再次註冊
  window.addEventListener('pageshow', function () {
    try { chrome.runtime.sendMessage({ type: 'FORM_READY' }); } catch (e) {}
  });

  // 接 background → 轉成頁面既有監聽器吃的 postMessage
  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.type === 'CTO_APPLY' && msg.data) {
      window.postMessage({ __studioa_cto: msg.data }, '*');
    }
  });
})();
