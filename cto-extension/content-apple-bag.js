/* ==========================================================================
 *  STUDIO A — CTO 擴充：Apple 購物袋頁 content script
 * --------------------------------------------------------------------------
 *  在 apple.com/tw/shop/bag 注入一顆固定按鈕「📋 擷取規格到訂購單」。
 *  點擊 → 同步抓料（明細即使收合也已在 DOM）→ 交給 background：
 *    background 負責跨網域抓產品圖（解 CORS）、開/聚焦表單分頁。
 *  交付成功後，若購物袋有多筆，辨識保留筆並自動移除其餘（沿用書籤邏輯）。
 * ========================================================================== */
(function () {
  'use strict';
  var NS = window.__StudioACTO || {};
  var BTN_ID = 'studioa-cto-bag-btn';

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function injectButton() {
    if (document.getElementById(BTN_ID)) return;
    var b = document.createElement('button');
    b.id = BTN_ID;
    b.type = 'button';
    b.textContent = '📋 擷取規格到訂購單';
    b.style.cssText = [
      'position:fixed', 'right:20px', 'bottom:20px', 'z-index:2147483647',
      'background:#0071e3', 'color:#fff', 'border:0', 'border-radius:980px',
      'padding:14px 22px', 'font-size:15px', 'font-weight:600', 'cursor:pointer',
      'box-shadow:0 4px 16px rgba(0,0,0,.25)', 'font-family:-apple-system,system-ui,sans-serif'
    ].join(';');
    b.addEventListener('click', onCapture);
    document.body.appendChild(b);
  }

  function setBusy(busy, text) {
    var b = document.getElementById(BTN_ID);
    if (!b) return;
    b.disabled = busy;
    b.style.opacity = busy ? '0.6' : '1';
    b.textContent = text || (busy ? '⏳ 擷取中…' : '📋 擷取規格到訂購單');
  }

  function onCapture() {
    var items = (NS.getItems ? NS.getItems() : []);
    if (!items.length) { alert('購物袋是空的，或讀不到商品。請確認已加入購物袋。'); return; }

    var keep = items[0];                       // 置頂 = 最新加入
    var data = NS.scrapeBagItem(keep);
    data.bagUrl = data.productUrl || location.href;
    if (items.length > 1) data.extraCount = items.length - 1;
    var keepCode = NS.itemCode(keep);

    setBusy(true);
    // 交給 background：截圖 + 抓圖 + 開表單分頁。background 完成後回 ack。
    chrome.runtime.sendMessage(
      { type: 'CTO_DELIVER', data: data, appleUrl: location.href },
      function (resp) {
        setBusy(false);
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          alert('擷取交付失敗：' + ((resp && resp.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || '未知錯誤')
              + '\n請確認已安裝擴充並開啟表單分頁。');
          return;
        }
        // 交付成功 → 多筆才自動移除其餘（辨識保留筆，永不誤刪）
        if (items.length > 1) clearOthers(keepCode);
      }
    );
  }

  async function clearOthers(keepCode) {
    for (var g = 0; g < 12; g++) {
      var cur = NS.getItems();
      if (cur.length <= 1) break;
      var victim = null;
      for (var i = 0; i < cur.length; i++) {
        if (NS.itemCode(cur[i]) !== keepCode) { victim = cur[i]; break; }
      }
      if (!victim) break;                       // 辨識不出就不亂刪
      var rm = victim.querySelector('[data-autom="bag-item-remove-button"]');
      if (!rm) break;
      rm.click();
      await wait(900);
    }
  }

  // SPA：購物袋是動態渲染，按鈕在 DOM ready 後注入，並用 observer 防止被重繪移除
  function boot() {
    injectButton();
    var mo = new MutationObserver(function () {
      if (!document.getElementById(BTN_ID)) injectButton();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
