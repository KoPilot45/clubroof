/**
 * E-Mail-Versand. Mit SMTP_URL über SMTP (lokal: Mailpit unter http://localhost:8025),
 * sonst nur ins Server-Protokoll. Tests übergeben einen eigenen Mailer.
 */
import nodemailer from 'nodemailer';

export type Mail = { to: string; subject: string; text: string };

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export function createMailer(
  options: { smtpUrl: string | undefined; from: string },
  log: (msg: string) => void,
): Mailer {
  if (!options.smtpUrl) {
    return {
      async send(mail) {
        log(`E-Mail (nicht versendet, kein SMTP_URL) an ${mail.to}: ${mail.subject}\n${mail.text}`);
      },
    };
  }
  const transport = nodemailer.createTransport(options.smtpUrl);
  return {
    async send(mail) {
      await transport.sendMail({ from: options.from, ...mail });
    },
  };
}

/** Sammelt Mails im Speicher (für Tests). */
export function memoryMailer(): Mailer & { outbox: Mail[] } {
  const outbox: Mail[] = [];
  return {
    outbox,
    async send(mail) {
      outbox.push(mail);
    },
  };
}
