import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import {
  emailChangedTemplate,
  emailChangeTemplate,
  passwordChangedTemplate,
  passwordResetTemplate,
  verificationTemplate
} from './emailTemplates.js';

export interface EmailProvider {
  send(message: { to: string; subject: string; html: string; text: string }): Promise<boolean>;
}

const transport = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpPort === 465,
  requireTLS: env.nodeEnv === 'production' && env.smtpPort !== 465,
  auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPassword } : undefined,
  connectionTimeout: 1500,
  greetingTimeout: 1500,
  socketTimeout: 3000
});

const smtpProvider: EmailProvider = {
  async send(message) {
    const result = await transport.sendMail({ from: env.emailFrom, ...message });
    return result.accepted.includes(message.to);
  }
};

// Tests inject a capture provider; no automated test connects to SMTP.
let provider: EmailProvider = env.nodeEnv === 'test' ? { send: async () => true } : smtpProvider;
export function setEmailProviderForTests(next: EmailProvider) {
  if (env.nodeEnv !== 'test') throw new Error('Email test provider is only available in tests.');
  provider = next;
}

export async function sendVerificationEmail(input: { to: string; verificationUrl: string }) {
  return provider.send({ to: input.to, ...verificationTemplate(input.verificationUrl) });
}
export async function sendPasswordResetEmail(input: { to: string; resetUrl: string }) {
  return provider.send({ to: input.to, ...passwordResetTemplate(input.resetUrl) });
}
export async function sendPasswordChangedEmail(to: string) {
  return provider.send({ to, ...passwordChangedTemplate() });
}
export async function sendEmailChangeEmail(input: { to: string; url: string }) {
  return provider.send({ to: input.to, ...emailChangeTemplate(input.url) });
}
export async function sendEmailChangedEmail(to: string) {
  return provider.send({ to, ...emailChangedTemplate() });
}
