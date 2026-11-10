const assert = require('node:assert/strict');
const test = require('node:test');

const { chooseConsentAction, isConsentText } = require('../src/consent-logic.js');

const consentContext = { isConsentContext: true };

function control(label, properties = {}) {
  return { labels: [label], visible: true, enabled: true, ...properties };
}

test('rejects optional cookies even if the necessary-only choice comes first', () => {
  const necessary = control('Only necessary');
  const reject = control('Reject all');

  assert.equal(chooseConsentAction([
    control('Accept all'), necessary, control('Manage preferences'), reject,
  ], consentContext), reject);
});

test('uses a visible necessary-only choice when reject controls cannot be used', () => {
  const necessary = control('  Ｏｎｌｙ\u00a0necessary  ');

  assert.equal(chooseConsentAction([
    control('Reject all', { visible: false }),
    control('Reject all cookies', { enabled: false }),
    necessary,
  ], consentContext), necessary);
});

test('never substitutes acceptance, saving preferences, or unrelated rejection', () => {
  assert.equal(chooseConsentAction([
    'Accept all cookies', 'Manage cookie preferences', 'Save my choices',
    'Continue', 'Close', 'Reject all pending invitations',
    'Accept all cookies except those you reject', 'Only necessary for employees',
  ].map((label) => control(label)), consentContext), null);
});

test('declines to click when independent labels contradict each other', () => {
  const contradictory = control('Reject all', { labels: ['Reject all', 'Accept all'] });
  const necessary = control('Accept only necessary cookies');

  assert.equal(chooseConsentAction([contradictory, necessary], consentContext), necessary);
});

test('does not let an old fallback label override the current action', () => {
  const relabeled = control('Save my choices', { labels: ['Save my choices', 'Reject all'] });

  assert.equal(chooseConsentAction([relabeled], consentContext), null);
});

test('requires local cookie context even for an exact action label', () => {
  assert.equal(chooseConsentAction([control('Reject all')], { isConsentContext: false }), null);
  assert.equal(isConsentText('We use cookies to remember your settings.'), true);
  assert.equal(isConsentText('Fresh cookies for your next party.'), false);
});

test('requires the scanner to verify a context before allowing a bare decline', () => {
  const decline = control('No thanks');
  const verifiedContext = { ...consentContext, allowBareDecline: true };

  assert.equal(chooseConsentAction([decline], consentContext), null);
  assert.equal(chooseConsentAction([decline], verifiedContext), decline);
  assert.equal(chooseConsentAction([decline], { ...verifiedContext, isConsentContext: false }), null);

  const necessary = control('Only necessary');
  assert.equal(chooseConsentAction([decline, necessary], verifiedContext), necessary);
});

test('recognizes common localized reject and necessary-only labels', () => {
  const localizedLabels = [
    '拒绝全部', '拒絕所有 Cookie', '仅使用必要 Cookie', 'Nur notwendige Cookies',
    'Tout refuser', 'Rechazar todo', 'Recusar tudo', 'Rifiuta tutto',
    'Alles weigeren', 'すべて拒否', '모두 거부',
  ];

  for (const label of localizedLabels) {
    const candidate = control(label);
    assert.equal(chooseConsentAction([candidate], consentContext), candidate, label);
  }
});
