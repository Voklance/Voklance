import { describe, expect, it } from 'vitest';
import { verificationTemplate } from './emailTemplates.js';

describe('verification email template', () => {
  it('includes accessible HTML and plain text without an unescaped link', () => {
    const url = 'https://example.test/verify-email#token=a&b';
    const message = verificationTemplate(url);
    expect(message.subject).toBe('Verify your email address — VOKLANCE');
    expect(message.text).toContain(url);
    expect(message.html).toContain('href="https://example.test/verify-email#token=a&amp;b"');
    expect(message.html).toContain('Verify Email Address</a>');
    expect(message.html).not.toContain('tracking');
  });
});
