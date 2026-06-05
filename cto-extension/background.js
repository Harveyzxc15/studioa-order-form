/* ==========================================================================
 *  STUDIO A — CTO 擴充：背景服務（service worker, MV3）
 * --------------------------------------------------------------------------
 *  職責：
 *   1. fetch 產品圖 → dataURL（host_permissions 下無 taint，解 CORS 汙染）
 *   2. 找既有表單分頁 → 聚焦並送資料；無則開新分頁
 *
 *  注意：
 *   - 自動加入購物袋已移除（Apple 後段選項變化多，易出錯）。
 *     流程＝店員手動加入購物袋 → 在購物袋頁按插件按鈕擷取。
 *   - 規格截圖由表單端「重繪規格卡」產生，不截 Apple 原生畫面
 *     （原生畫面規格收合、含結帳/分期雜訊，較差）。
 *
 *  ⚙️ 設定：FORM_URL 改成你的正式表單網址（沒有既有表單分頁時用來開新分頁）。
 * ========================================================================== */
'use strict';

// ── 設定（部署時調整）─────────────────────────────────────────────
var FORM_URL = 'https://harveyzxc15.github.io/studioa-order-form/index-cto-test.html';
// 用來辨識「哪個分頁是表單」。預設比對 GitHub Pages 與本機測試。
var FORM_URL_MATCH = [
  /harveyzxc15\.github\.io\/studioa-order-form\//i,
  /^https?:\/\/(localhost|127\.0\.0\.1)/i
];

var formTabId = null;   // 由表單頁 content script 註冊

// 表單頁 content script 載入時註冊自己（最可靠的分頁辨識）
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.type === 'FORM_READY' && sender.tab) {
    formTabId = sender.tab.id;
    sendResponse && sendResponse({ ok: true });
    return; // 同步回應
  }
  if (msg && msg.type === 'CTO_DELIVER') {
    handleDeliver(msg, sender).then(sendResponse).catch(function (e) {
      sendResponse({ ok: false, error: String(e && e.message || e) });
    });
    return true; // 非同步回應
  }
});

async function handleDeliver(msg, sender) {
  var data = msg.data || {};
  data.detail = data.detail || {};

  // 1) 產品圖跨網域抓 → dataURL（避免表單端 html2canvas taint）
  //    規格截圖由表單端用購物袋明細「重繪規格卡」產生（比截 Apple 原生畫面乾淨，
  //    且原生畫面規格是收合的、含結帳/分期等雜訊，故不採用 captureVisibleTab）。
  if (data.detail.img && /^https?:/i.test(data.detail.img)) {
    try {
      var resp = await fetch(data.detail.img);
      var blob = await resp.blob();
      data.detail.img = await blobToDataUrl(blob);
    } catch (e) { /* 抓不到就維持原 URL，表單端再嘗試 */ }
  }

  // 原價(起) 購物袋頁無法取得，由人員手動補填（同書籤時代）。

  // 2) 找/開表單分頁 → 聚焦並送資料
  var tab = await resolveFormTab();
  if (!tab) {
    tab = await chrome.tabs.create({ url: FORM_URL, active: true });
    await waitTabComplete(tab.id);
    await wait(600); // 給 content-form.js + 表單腳本就緒
    formTabId = tab.id;
  } else {
    await chrome.tabs.update(tab.id, { active: true });
    try { await chrome.windows.update(tab.windowId, { focused: true }); } catch (e) {}
  }

  await chrome.tabs.sendMessage(tab.id, { type: 'CTO_APPLY', data: data });
  return { ok: true };
}

// 找出表單分頁：優先用已註冊的 formTabId，否則用 URL 比對掃描
async function resolveFormTab() {
  if (formTabId != null) {
    try { var t = await chrome.tabs.get(formTabId); if (t) return t; } catch (e) { formTabId = null; }
  }
  var all = await chrome.tabs.query({});
  var hit = all.filter(function (t) {
    return t.url && FORM_URL_MATCH.some(function (re) { return re.test(t.url); });
  });
  // 偏好最近作用中的那個
  hit.sort(function (a, b) { return (b.lastAccessed || 0) - (a.lastAccessed || 0); });
  return hit[0] || null;
}

function waitTabComplete(tabId) {
  return new Promise(function (resolve) {
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    // 保險：最多等 10 秒
    setTimeout(function () { try { chrome.tabs.onUpdated.removeListener(listener); } catch (e) {} resolve(); }, 10000);
  });
}

// MV3 service worker 沒有 FileReader → 用 arrayBuffer + btoa 轉 dataURL
async function blobToDataUrl(blob) {
  var buf = new Uint8Array(await blob.arrayBuffer());
  var bin = '';
  var chunk = 0x8000;
  for (var i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + chunk));
  }
  return 'data:' + (blob.type || 'image/jpeg') + ';base64,' + btoa(bin);
}

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
