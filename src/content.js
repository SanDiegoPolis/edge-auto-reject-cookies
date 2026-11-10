(() => {
  "use strict";

  const { classifyActionLabel, isAcceptLabel, isConsentText, normalizeText, chooseConsentAction } =
    globalThis.CookieConsentLogic;

  const controlSelector = 'button, input[type="button"], [role="button"]';
  const knownBannerSelector = [
    "#onetrust-banner-sdk", "#onetrust-pc-sdk", "#CybotCookiebotDialog",
    "#didomi-notice", "#didomi-popup", ".cky-consent-container", ".cky-preference-center",
    "#uc-main-dialog", ".qc-cmp2-container",
  ].join(", ");
  const dialogSelector = 'dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]';
  const cookieMarker = /\bcookies?\b|쿠키|クッキー|曲奇|餅乾|饼干/i;
  const bannerMarker = /\b(?:consent|banner|notice|dialog|popup|modal|preferences?|settings|bar|overlay)\b/i;
  const scanDelay = 300;
  const maxActionsPerPage = 3;

  const rootObservers = new Map();
  const pendingShadowSearches = new Set();
  let nextScan;
  let currentPage = pageKey();
  const handledElements = new WeakSet();
  const handledBanners = new Set();
  const handledSignatures = new Set();

  function pageKey() {
    return location.pathname + location.search + location.hash;
  }

  function composedParent(element) {
    return element.assignedSlot || element.parentElement || element.getRootNode().host;
  }

  function containsComposed(container, element) {
    for (let node = element; node; node = composedParent(node)) {
      if (node === container) return true;
    }
    return false;
  }

  function nearbyContainers(element, scope) {
    const containers = [];
    for (let node = composedParent(element); node && containers.length < 3; node = composedParent(node)) {
      containers.push(node);
      if (node === scope) break;
    }
    return containers;
  }

  function labelledBy(element) {
    const ids = element.getAttribute("aria-labelledby");
    if (!ids) return "";
    const root = element.getRootNode();
    return ids.trim().split(/\s+/u).map((id) => {
      const label = root.getElementById(id);
      return label?.innerText || label?.textContent || "";
    }).join(" ");
  }

  function labelsFor(element) {
    const isInput = element instanceof HTMLInputElement;
    const text = isInput ? element.value : element.textContent;
    const alternativeLabels = [labelledBy(element), element.getAttribute("aria-label"), element.title];
    // Only read rendered text (which can cause layout) for plausible controls.
    if (![text, ...alternativeLabels].some((label) => classifyActionLabel(label) || isAcceptLabel(label))) {
      return [];
    }
    const visibleLabel = isInput ? text : element.innerText;
    return [visibleLabel, ...alternativeLabels].filter((label) => normalizeText(label));
  }

  function isSafeControl(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected) return false;
    if (element.matches(':disabled, [aria-pressed], [aria-checked], [aria-expanded], [popovertarget], [commandfor]')) {
      return false;
    }
    if ((element instanceof HTMLButtonElement || element instanceof HTMLInputElement) &&
        element.form && element.type !== "button") return false;
    if (element instanceof HTMLInputElement && element.type !== "button") return false;
    if (element instanceof HTMLAnchorElement &&
        ((element.hasAttribute("href") && element.getAttribute("href") !== "#") ||
        element.hasAttribute("target") || element.hasAttribute("download") || element.hasAttribute("ping"))) {
      return false;
    }
    for (let node = element; node; node = composedParent(node)) {
      if (node.matches('[disabled], [hidden], [inert], [aria-hidden="true" i], [aria-disabled="true" i]')) return false;
      if (node !== element && node.matches('a[href], label, button, [role="button"]')) return false;
    }
    return true;
  }

  function hitTargetAt(x, y) {
    let hit = document.elementFromPoint(x, y);
    while (hit?.shadowRoot) {
      const inner = hit.shadowRoot.elementFromPoint?.(x, y);
      if (!inner || inner === hit || !containsComposed(hit, inner)) break;
      hit = inner;
    }
    return hit;
  }

  function isDirectHit(control, target) {
    for (let node = target; node; node = composedParent(node)) {
      if (node === control) return true;
      if (node.matches('a[href], button, input, select, textarea, label, [role="button"]')) return false;
    }
    return false;
  }

  function isVisible(element) {
    if (typeof element.checkVisibility === "function") {
      if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false;
    } else {
      for (let node = element; node; node = composedParent(node)) {
        const style = getComputedStyle(node);
        if (style.opacity === "0" || style.contentVisibility === "hidden") return false;
      }
      if (getComputedStyle(element).visibility !== "visible") return false;
    }

    const rect = element.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const right = Math.min(window.innerWidth, rect.right);
    const top = Math.max(0, rect.top);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    if (right - left < 2 || bottom - top < 2) return false;

    // A bounding box can still be clipped, covered or unable to receive clicks.
    return [0.5, 0.25, 0.75].some((portion) => {
      const x = left + (right - left) * portion;
      const y = (top + bottom) / 2;
      return isDirectHit(element, hitTargetAt(x, y));
    });
  }

  function bannerIdentifiers(element) {
    return [element.id, element.getAttribute("class"), element.getAttribute("data-testid")]
      .join(" ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ");
  }

  function bannerText(element) {
    // Limit generic detection to a local notice rather than scanning page copy.
    if (element.textContent.length > 10000) return "";
    const shadowText = element.shadowRoot && Array.from(element.shadowRoot.children)
      .filter((child) => !child.matches("style, script, link"))
      .map((child) => child.innerText || "").join(" ");
    return [labelledBy(element), element.getAttribute("aria-label"), element.innerText, shadowText]
      .join(" ").slice(0, 5000);
  }

  function consentBannerFor(control, acceptPeers, contextCache) {
    for (let scope = composedParent(control.element); scope; scope = composedParent(scope)) {
      if (scope === document.body || scope === document.documentElement) break;
      if (!contextCache.has(scope)) {
        const knownBanner = scope.matches(knownBannerSelector);
        const identifiers = bannerIdentifiers(scope);
        const markedBanner = cookieMarker.test(identifiers) && bannerMarker.test(identifiers);
        const dialog = scope.matches(dialogSelector);
        const position = getComputedStyle(scope).position;
        const overlay = position === "fixed" || position === "sticky";
        const hasContext = knownBanner || ((markedBanner || dialog || overlay) && isConsentText(bannerText(scope))) ||
          (markedBanner && acceptPeers.some((peer) => containsComposed(scope, peer)));
        contextCache.set(scope, hasContext);
      }
      if (!contextCache.get(scope)) continue;
      if (control.action !== "decline") return scope;

      const groups = nearbyContainers(control.element, scope);
      if (acceptPeers.some((peer) => containsComposed(scope, peer) &&
        nearbyContainers(peer, scope).some((group) => groups.includes(group)))) {
        return scope;
      }
      return null;
    }
    return null;
  }

  function observeRoot(root) {
    if (rootObservers.has(root)) return;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.target.shadowRoot) pendingShadowSearches.add(record.target.shadowRoot);
        for (const node of record.addedNodes) {
          if (node instanceof Element) pendingShadowSearches.add(node);
        }
      }
      scheduleScan();
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-checked", "aria-disabled", "aria-expanded", "aria-hidden", "aria-label",
        "aria-labelledby", "aria-modal", "aria-pressed", "class", "commandfor", "data-testid", "disabled",
        "download", "form", "hidden", "href", "id", "inert", "open", "ping", "popovertarget", "role",
        "style", "target", "title", "type", "value"],
    });
    root.addEventListener("transitionend", scheduleScan);
    root.addEventListener("animationend", scheduleScan);
    rootObservers.set(root, observer);
    pendingShadowSearches.add(root);
  }

  function updateObservedRoots() {
    for (const [root, observer] of rootObservers) {
      if (root !== document && !root.host.isConnected) {
        observer.disconnect();
        root.removeEventListener("transitionend", scheduleScan);
        root.removeEventListener("animationend", scheduleScan);
        rootObservers.delete(root);
      }
    }
    for (const subtree of pendingShadowSearches) {
      if (subtree !== document && !subtree.isConnected) continue;
      if (subtree instanceof ShadowRoot) observeRoot(subtree);
      if (subtree.shadowRoot) observeRoot(subtree.shadowRoot);
      for (const element of subtree.querySelectorAll("*")) {
        if (element.shadowRoot) observeRoot(element.shadowRoot);
      }
    }
    pendingShadowSearches.clear();
  }

  function scan() {
    nextScan = undefined;
    if (currentPage !== pageKey()) {
      currentPage = pageKey();
      handledSignatures.clear();
    }
    for (const scope of handledBanners) {
      if (!scope.isConnected) handledBanners.delete(scope);
    }
    updateObservedRoots();
    if (handledSignatures.size >= maxActionsPerPage) return;

    const acceptPeers = [];
    const candidates = [];
    for (const root of rootObservers.keys()) {
      for (const element of root.querySelectorAll(controlSelector)) {
        if (handledElements.has(element)) continue;
        const labels = labelsFor(element);
        const action = classifyActionLabel(labels[0]);
        const accepts = isAcceptLabel(labels[0]);
        if ((!action && !accepts) || !isSafeControl(element) || !isVisible(element)) continue;
        if (accepts) acceptPeers.push(element);
        if (action) candidates.push({ element, labels, action, visible: true, enabled: true });
      }
    }

    const contextCache = new Map();
    const eligible = [];
    for (const candidate of candidates) {
      const scope = consentBannerFor(candidate, acceptPeers, contextCache);
      if (!scope || [...handledBanners].some((handled) =>
        containsComposed(handled, scope) || containsComposed(scope, handled))) continue;
      const identity = scope.id ? `#${scope.id}` : normalizeText(bannerText(scope)).slice(0, 200);
      const signature = `${scope.localName}|${identity}`;
      if (!handledSignatures.has(signature)) eligible.push({ ...candidate, scope, signature });
    }
    const selected = chooseConsentAction(eligible, { isConsentContext: true, allowBareDecline: true });
    if (!selected || !isSafeControl(selected.element) || !isVisible(selected.element)) return;

    // Mark before clicking so a page that rerenders on every click cannot create a loop.
    handledElements.add(selected.element);
    handledBanners.add(selected.scope);
    handledSignatures.add(selected.signature);
    HTMLElement.prototype.click.call(selected.element);
    scheduleScan();
  }

  function scheduleScan() {
    if (nextScan === undefined) nextScan = setTimeout(scan, scanDelay);
  }

  function rediscoverShadows() {
    pendingShadowSearches.add(document);
    scheduleScan();
  }

  observeRoot(document);
  scheduleScan();
  // A host already in the DOM can attach a shadow root without a DOM mutation.
  for (const delay of [1000, 3000, 8000]) setTimeout(rediscoverShadows, delay);
  setInterval(() => {
    if (!document.hidden && handledSignatures.size < maxActionsPerPage) rediscoverShadows();
  }, 15000);
  window.addEventListener("pageshow", rediscoverShadows);
  window.addEventListener("hashchange", scheduleScan);
  window.addEventListener("popstate", scheduleScan);
  window.addEventListener("resize", scheduleScan, { passive: true });
  window.addEventListener("scroll", scheduleScan, { capture: true, passive: true });
  document.addEventListener("visibilitychange", rediscoverShadows);
})();
