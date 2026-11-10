(() => {
  'use strict';

  function normalizeText(text) {
    return typeof text === 'string'
      ? text.normalize('NFKC').toLowerCase()
        .replace(/[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, '')
        .replace(/[’‘]/g, "'")
        .replace(/[‐‑‒–—]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.!。！]+$/, '')
        .trimEnd()
      : '';
  }

  // Exact labels keep explanatory text and buttons with a second action out of the match.
  const rejectLabels = new Set([
    'reject all', 'reject all cookies', 'reject cookies', 'reject optional cookies',
    'reject all optional cookies', 'reject non-essential cookies', 'reject all non-essential cookies',
    'reject nonessential cookies', 'reject all nonessential cookies', 'reject unnecessary cookies',
    'decline all', 'decline all cookies', 'decline cookies', 'decline optional cookies',
    'decline all optional cookies', 'decline non-essential cookies', 'deny all', 'deny all cookies', 'refuse all',
    'refuse all cookies', 'do not accept cookies', "don't accept cookies",
    'continue without accepting', 'continue without accepting cookies', 'continue without agreeing',
    'continue without consenting', 'continue without consent', 'continue without consent to cookies',
    'continue without cookies',
    '拒绝全部', '拒绝所有', '全部拒绝', '全部不接受', '拒绝全部cookies', '拒绝所有cookies',
    '拒绝全部cookie', '拒绝所有cookie', '拒绝cookie', '拒绝cookies', '拒绝非必要cookie',
    '拒绝非必要cookies', '拒绝所有非必要cookie', '拒绝所有非必要cookies', '拒绝可选cookie',
    '拒绝可选cookies', '拒绝所有可选cookie', '拒绝所有可选cookies', '不接受并继续',
    '拒絕全部', '拒絕所有', '全部拒絕', '拒絕全部cookies', '拒絕所有cookies',
    '拒絕全部cookie', '拒絕所有cookie', '拒絕cookie', '拒絕cookies', '拒絕非必要cookie',
    '拒絕非必要cookies', '拒絕所有非必要cookie', '拒絕所有非必要cookies', '拒絕選用cookie',
    '拒絕所有選用cookie', '不接受並繼續',
    'alle ablehnen', 'alle cookies ablehnen', 'optionale cookies ablehnen', 'alles ablehnen',
    'nicht notwendige cookies ablehnen', 'ohne zustimmung fortfahren',
    'tout refuser', 'refuser tout', 'refuser tous les cookies', 'refuser les cookies',
    'refuser les cookies facultatifs', 'continuer sans accepter', 'continuer sans consentir',
    'rechazar todo', 'rechazar todas', 'rechazar todas las cookies', 'rechazar cookies',
    'rechazar cookies opcionales', 'continuar sin aceptar',
    'recusar tudo', 'rejeitar tudo', 'rejeitar todos', 'rejeitar todos os cookies',
    'recusar todos os cookies', 'continuar sem aceitar',
    'rifiuta tutto', 'rifiuta tutti', 'rifiuta tutti i cookie', 'rifiuta i cookie',
    'continua senza accettare', 'continua senza consenso',
    'alles weigeren', 'alle cookies weigeren', 'alles afwijzen', 'alle cookies afwijzen',
    'doorgaan zonder te accepteren',
    'すべて拒否', '全て拒否', 'すべて拒否する', 'すべてのcookieを拒否', 'すべてのクッキーを拒否',
    '모두 거부', '모든 쿠키 거부', '선택적 쿠키 거부',
  ]);

  const necessaryLabels = new Set([
    'necessary only', 'essential only', 'required only', 'only necessary', 'only essential',
    'only required', 'strictly necessary only', 'only strictly necessary',
    '仅必要', '仅限必要', '只接受必要', '仅接受必要', '仅保留必要', '仅使用必要',
    '僅必要', '僅限必要', '只接受必要', '僅接受必要', '僅保留必要', '僅使用必要',
    'nur notwendige cookies', 'nur notwendige cookies zulassen', 'nur erforderliche cookies',
    'nur essenzielle cookies', 'nur essentielle cookies', 'nur notwendige akzeptieren',
    'cookies nécessaires uniquement', 'uniquement les cookies nécessaires',
    'accepter uniquement les cookies nécessaires', 'seulement les cookies nécessaires',
    'solo necesarias', 'solo cookies necesarias', 'solo las cookies necesarias',
    'solo cookies esenciales', 'aceptar solo las cookies necesarias',
    'apenas os cookies necessários', 'apenas cookies necessários', 'somente cookies necessários',
    'apenas cookies essenciais', 'aceitar apenas cookies necessários',
    'solo cookie necessari', 'solo i cookie necessari', 'solo cookie essenziali',
    'accetta solo i cookie necessari',
    'alleen noodzakelijke cookies', 'alleen essentiële cookies',
    'alleen noodzakelijke cookies toestaan',
    '必要なcookieのみ', '必要なクッキーのみ', '必須cookieのみ', '必須クッキーのみ',
    '必要なcookieのみ許可', '必要なクッキーのみ許可', '必須cookieのみ許可',
    '필수 쿠키만', '필수 쿠키만 허용', '필수 쿠키만 수락',
  ]);

  const bareDeclineLabels = new Set([
    'reject', 'decline', 'deny', 'refuse', 'no thanks', 'no, thanks', 'no thank you', 'no, thank you',
    '拒绝', '拒絕', '不同意', '不接受', 'ablehnen', 'refuser', 'rechazar', 'recusar',
    'rejeitar', 'rifiuta', 'weigeren', 'afwijzen', '拒否', '拒否する', '거부',
  ]);

  const acceptLabels = new Set([
    'accept', 'accept all', 'accept cookies', 'accept all cookies', 'accept all and continue',
    'allow', 'allow all', 'allow cookies', 'allow all cookies', 'agree', 'agree to all', 'i agree',
    'accept optional cookies', 'accept all optional cookies', 'allow optional cookies',
    '接受', '接受全部', '全部接受', '同意', '同意全部', '全部同意', '接受所有cookie',
    '接受所有cookies', '接受全部cookie', '接受全部cookies', '允许所有cookie', '允许所有cookies',
    '允許所有cookie', '允許所有cookies', 'alle akzeptieren', 'alles akzeptieren',
    'alle cookies akzeptieren', 'akzeptieren', 'tout accepter', 'accepter tout', 'accepter',
    'accepter tous les cookies', 'aceptar todo', 'aceptar todas', 'aceptar todas las cookies',
    'aceptar', 'aceitar tudo', 'aceitar todos', 'aceitar todos os cookies', 'aceitar',
    'accetta tutto', 'accetta tutti', 'accetta tutti i cookie', 'accetta', 'alles accepteren',
    'alle cookies accepteren', 'accepteren', 'すべて許可', 'すべて受け入れる', 'すべて同意',
    'すべてのcookieを許可', 'すべてのクッキーを許可', '모두 수락', '모두 허용', '모든 쿠키 허용',
  ]);

  // Keep the positions of “only” explicit so bare category names do not become actions.
  const englishNecessary = /^(?:(?:(?:accept|allow|use|keep|enable|continue with) )?only |only (?:accept|allow|use|keep|enable) )(?:strictly )?(?:necessary|essential|required|mandatory) cookies?$|^(?:(?:accept|allow|use|keep|enable|continue with) )?(?:strictly )?(?:necessary|essential|required|mandatory) cookies? only$/;
  const chineseNecessary = /^(?:(?:仅|僅|只)(?:限|接受|使用|保留|允许|允許|启用|啟用)?(?:严格|嚴格)?(?:必需|必须|必須|必要)(?:的)?(?:cookies?)|(?:只|仅|僅)接受(?:必需|必须|必須|必要)项)$/;

  function normalizeLabel(label) {
    return normalizeText(label)
      .replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]) (?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|cookies?\b)/gu, '$1')
      .replace(/(cookies?) (?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, '$1');
  }

  function classifyLabel(normalized) {
    if (rejectLabels.has(normalized)) return 'reject';
    if (necessaryLabels.has(normalized) || englishNecessary.test(normalized) || chineseNecessary.test(normalized)) {
      return 'necessary';
    }
    if (bareDeclineLabels.has(normalized)) return 'decline';
    if (acceptLabels.has(normalized.replace(/\s*\([^()]{1,40}\)$/, ''))) return 'accept';
    return null;
  }

  function classifyActionLabel(label) {
    const action = classifyLabel(normalizeLabel(label));
    return action === 'accept' ? null : action;
  }

  function isAcceptLabel(label) {
    return classifyLabel(normalizeLabel(label)) === 'accept';
  }

  const consentContexts = [
    /\bcookies? (?:consent|preferences|settings|choices|options|notice|banner|controls|policy)\b/,
    /\b(?:use|uses|using|allow|accept|reject|manage|choose|decline) (?:all |optional |some |certain |our own |your )?cookies?\b/,
    /\b(?:optional|non-essential|nonessential|necessary|essential|analytical|advertising|marketing|tracking|third-party) cookies?\b/,
    /(?:cookies?|饼干|餅乾).{0,80}(?:使用|同意|偏好|设置|設定|拒绝|拒絕|必要|必需|隐私|隱私)|(?:使用|同意|偏好|设置|設定|拒绝|拒絕|必要|必需|隐私|隱私).{0,40}(?:cookies?|饼干|餅乾)/,
    /\b(?:cookies?[- ](?:einstellungen|hinweis|präferenzen)|(?:verwenden|nutzen) cookies?|notwendige cookies?)\b/,
    /\b(?:utilisons des cookies?|gestion des cookies?|préférences de cookies?|paramètres des cookies?|politique de cookies?|cookies? nécessaires)\b/,
    /\b(?:utilizamos cookies?|usamos cookies?|configuración de cookies?|preferencias de cookies?|política de cookies?|cookies? necesarias)\b/,
    /\b(?:configuração de cookies?|preferências de cookies?|política de cookies?|cookies? necessários)\b/,
    /\b(?:utilizziamo (?:i )?cookies?|impostazioni (?:dei )?cookies?|preferenze sui cookies?|informativa sui cookies?|cookies? necessari)\b/,
    /\b(?:gebruiken (?:we )?cookies?|cookie-?instellingen|cookie-?voorkeuren|noodzakelijke cookies?)\b/,
    /(?:cookies?|クッキー).{0,40}(?:使用|同意|設定|拒否|必須|プライバシー)|(?:使用|同意|設定|拒否|必須).{0,40}(?:cookies?|クッキー)/,
    /쿠키.{0,40}(?:사용|설정|동의|선택|거부|허용)|(?:필수|선택적) 쿠키/,
  ];

  function isConsentText(text) {
    const normalized = normalizeText(text);
    return consentContexts.some((pattern) => pattern.test(normalized));
  }

  const actionPriority = { reject: 3, necessary: 2, decline: 1 };

  function chooseConsentAction(controls, { isConsentContext, allowBareDecline = false } = {}) {
    if (!isConsentContext) return null;

    let selected = null;
    let priority = 0;
    for (const control of controls) {
      if (control.visible !== true || control.enabled !== true) continue;

      const actions = control.labels.map(normalizeLabel).filter(Boolean).map(classifyLabel);
      const [action, ...secondaryActions] = actions;
      if (!actionPriority[action] || (action === 'decline' && !allowBareDecline)) continue;
      if (secondaryActions.some((other) => other !== null && other !== action)) continue;

      if (actionPriority[action] > priority) {
        selected = control;
        priority = actionPriority[action];
      }
    }
    return selected;
  }

  const logic = Object.freeze({
    normalizeText,
    classifyActionLabel,
    isAcceptLabel,
    isConsentText,
    chooseConsentAction,
  });

  if (typeof module === 'object' && module.exports) {
    module.exports = logic;
  } else {
    globalThis.CookieConsentLogic = logic;
  }
})();
