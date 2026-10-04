import nodemailer from "nodemailer";

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASSWORD
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          }
        : undefined,
  };
}

function createTransporter() {
  const config = getSmtpConfig();

  if (!config.host) {
    const error = new Error("SMTP_HOST nao configurado.");
    error.statusCode = 500;
    throw error;
  }

  return nodemailer.createTransport(config);
}

export async function sendParticipantAccessEmail({ email, accessCode }) {
  const transporter = createTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!from) {
    const error = new Error("SMTP_FROM nao configurado.");
    error.statusCode = 500;
    throw error;
  }

  await transporter.sendMail({
    from,
    to: email,
    subject: "Acesso ao Experimento - Geracao de Casos de Teste",
    text: [
      "Ola,",
      "",
      "Voce foi cadastrado para participar do experimento sobre geracao de casos de teste.",
      "",
      "Seu codigo de acesso e:",
      "",
      accessCode,
      "",
      "Acesse a aplicacao e informe seu e-mail e o codigo acima.",
      "",
      "Este codigo e pessoal e nao deve ser compartilhado.",
    ].join("\n"),
  });
}
