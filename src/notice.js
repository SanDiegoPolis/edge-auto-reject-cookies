(() => {
  "use strict";

  const duration = 3000;
  const language = navigator.language || "en";
  const messages = /^zh-(?:Hant|TW|HK|MO)\b/i.test(language)
    ? { reject: "已拒絕非必要 Cookie", necessary: "已選擇僅必要 Cookie" }
    : /^zh\b/i.test(language)
      ? { reject: "已拒绝非必要 Cookie", necessary: "已选择仅必要 Cookie" }
      : { reject: "Optional cookies rejected", necessary: "Necessary cookies only" };

  let host;
  let message;
  let timeout;

  function mount() {
    host = document.createElement("div");
    host.setAttribute("data-auto-reject-cookies-toast", "");
    const root = host.attachShadow({ mode: "open" });
    const styles = new CSSStyleSheet();
    styles.replaceSync(`
      :host {
        all: initial !important;
        position: fixed !important;
        right: 14px !important;
        bottom: 14px !important;
        max-width: calc(100% - 28px) !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        direction: ltr !important;
      }
      .notice {
        display: flex;
        align-items: center;
        gap: 7px;
        box-sizing: border-box;
        border: 1px solid #49615c;
        border-radius: 10px;
        padding: 8px 12px;
        background: #182925;
        color: #f5faf8;
        box-shadow: 0 3px 12px #0003;
        font: 500 13px/1.35 system-ui, sans-serif;
        overflow-wrap: anywhere;
      }
      .check { color: #a9edc6; font-weight: 700; }
    `);
    root.adoptedStyleSheets = [styles];

    const status = document.createElement("div");
    status.className = "notice";
    status.lang = /^zh\b/i.test(language) ? language : "en";
    status.setAttribute("role", "status");
    status.setAttribute("aria-atomic", "true");

    const check = document.createElement("span");
    check.className = "check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    message = document.createElement("span");
    status.append(check, message);
    root.append(status);
    document.documentElement.append(host);
  }

  function show(action) {
    if (!document.documentElement) return;
    if (!host?.isConnected) mount();

    message.textContent = action === "necessary" ? messages.necessary : messages.reject;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      host.remove();
      host = undefined;
      message = undefined;
    }, duration);
  }

  globalThis.CookieConsentNotice = Object.freeze({ show });
})();
