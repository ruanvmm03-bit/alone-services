const nodemailer = require('nodemailer');

function isConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function createTransport() {
  if (!isConfigured()) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendVerificationCode(email, code) {
  const transport = createTransport();
  if (!transport) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('O envio de e-mail ainda não está configurado.');
    }
    console.log(`[auth] Código de confirmação para ${email}: ${code}`);
    return { delivered: false, development: true };
  }

  await transport.sendMail({
    from: `Alone <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Seu código de confirmação — Alone',
    text: `Seu código de confirmação é ${code}. Ele expira em 10 minutos. Se você não criou uma conta, ignore este e-mail.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>Confirme sua conta Alone</h2><p>Use este código para concluir seu cadastro:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p><p>O código expira em 10 minutos.</p></div>`,
  });
  return { delivered: true, development: false };
}

module.exports = { isConfigured, sendVerificationCode };
