import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  formatInlineMarkdown,
  formatBodyLines,
  renderSafeMarkdown
} from '../src/modules/ui.js';

test('escapeHtml sanitizes HTML special characters', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml('Tom & Jerry "quote" \'single\''), 'Tom &amp; Jerry &quot;quote&quot; &#039;single&#039;');
  assert.equal(escapeHtml(''), '');
  assert.equal(escapeHtml(null), '');
});

test('formatInlineMarkdown handles bold, italic, and inline code without asterisks', () => {
  const result = formatInlineMarkdown('Maintain **upright posture** with *comfort* and `ergonomics`.');
  assert.ok(!result.includes('**'));
  assert.ok(!result.includes('`'));
  assert.ok(result.includes('<strong class="insight-bold">upright posture</strong>'));
  assert.ok(result.includes('<em>comfort</em>'));
  assert.ok(result.includes('<code class="insight-code">ergonomics</code>'));
});

test('renderSafeMarkdown formats bold headings and removes literal asterisks', () => {
  const input = `**Observed pattern:** Minor forward head tilt recorded during the session.

**Practical suggestions:** Take a 20-second neck stretch break every 30 minutes.

**Data limitation:** Non-clinical reflection based on webcam metrics.`;

  const output = renderSafeMarkdown(input);

  // Must not contain any literal asterisks
  assert.ok(!output.includes('**'), 'Output must not contain literal double asterisks');
  assert.ok(output.includes('class="insight-section-title"'));
  assert.ok(output.includes('Observed pattern'));
  assert.ok(output.includes('Practical suggestions'));
  assert.ok(output.includes('Data limitation'));
  assert.ok(output.includes('Minor forward head tilt recorded during the session.'));
});

test('renderSafeMarkdown handles separate block headings with list items', () => {
  const input = `**Observed pattern**
Good posture maintained for 10 minutes.

**Practical suggestions**
- Take regular micro-breaks.
- Check chair height.

**Data limitation**
Educational reflection only.`;

  const output = renderSafeMarkdown(input);

  assert.ok(!output.includes('**'));
  assert.ok(output.includes('<ul class="insight-list">'));
  assert.ok(output.includes('<li>Take regular micro-breaks.</li>'));
  assert.ok(output.includes('<li>Check chair height.</li>'));
  assert.ok(output.includes('Observed pattern'));
  assert.ok(output.includes('Educational reflection only.'));
});

test('renderSafeMarkdown safely handles plain-text rule-based fallback responses', () => {
  const fallbackText = 'No sustained posture-deviation events were recorded in this session.';
  const output = renderSafeMarkdown(fallbackText);

  assert.ok(output.includes(fallbackText));
  assert.ok(!output.includes('**'));
  assert.ok(output.includes('class="insight-section-body"'));
});

test('renderSafeMarkdown neutralizes script and HTML injection', () => {
  const malicious = '<script>alert("hack")</script> <img src=x onerror=alert(1)> **Normal Heading:** clean text';
  const output = renderSafeMarkdown(malicious);

  assert.ok(!output.includes('<script>'), 'Must not contain raw script tag');
  assert.ok(!output.includes('<img'), 'Must not contain raw img tag');
  assert.ok(output.includes('&lt;script&gt;'));
  assert.ok(output.includes('Normal Heading'));
  assert.ok(output.includes('clean text'));
});

test('renderSafeMarkdown handles null, undefined, and empty inputs gracefully', () => {
  assert.equal(renderSafeMarkdown(''), '');
  assert.equal(renderSafeMarkdown(null), '');
  assert.equal(renderSafeMarkdown(undefined), '');
  assert.equal(renderSafeMarkdown('   '), '');
});
