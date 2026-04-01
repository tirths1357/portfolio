const nodemailer = require("nodemailer");

function createMailTransporter() {
  const emailService = String(process.env.EMAIL_SERVICE || "").trim().toLowerCase();
  const gmailUser = String(process.env.GMAIL_USER || "").trim();
  const gmailAppPassword = String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  const smtpHost = String(process.env.SMTP_HOST || "").trim();
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = String(process.env.SMTP_USER || "").trim();
  const smtpPass = String(process.env.SMTP_PASS || "").trim();
  const rejectUnauthorized = process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== "false";

  if ((emailService === "gmail") || (gmailUser && gmailAppPassword)) {
    return nodemailer.createTransport({
      service: "gmail",
      tls: { rejectUnauthorized },
      auth: {
        user: gmailUser,
        pass: gmailAppPassword
      }
    });
  }

  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    tls: { rejectUnauthorized },
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

function escapeEmailHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  const { name, email, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({
      message: "Name, email, and message are required."
    });
  }

  const transporter = createMailTransporter();

  if (!transporter) {
    return res.status(500).json({
      message: "Email delivery is not configured on this deployment."
    });
  }

  const recipient =
    process.env.CONTACT_NOTIFICATION_EMAIL ||
    process.env.OWNER_EMAIL ||
    process.env.GMAIL_USER ||
    process.env.SMTP_USER;

  const senderAddress =
    process.env.SMTP_FROM ||
    process.env.GMAIL_USER ||
    process.env.SMTP_USER;

  if (!recipient || !senderAddress) {
    return res.status(500).json({
      message: "Missing contact notification email settings."
    });
  }

  try {
    await transporter.sendMail({
      from: senderAddress,
      to: recipient,
      subject: `New portfolio contact from ${String(name).trim()}`,
      replyTo: String(email).trim(),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #111827;">
          <h2 style="margin-bottom: 16px;">New portfolio message received</h2>
          <p><strong>Name:</strong> ${escapeEmailHtml(String(name).trim())}</p>
          <p><strong>Email:</strong> ${escapeEmailHtml(String(email).trim())}</p>
          <div style="margin-top: 20px; padding: 16px; border-radius: 12px; background: #f3f4f6;">
            <strong>Message</strong>
            <p style="margin-top: 10px; white-space: pre-wrap;">${escapeEmailHtml(String(message).trim())}</p>
          </div>
        </div>
      `,
      text: [
        "New portfolio message received.",
        "",
        `Name: ${String(name).trim()}`,
        `Email: ${String(email).trim()}`,
        `Message: ${String(message).trim()}`
      ].join("\n")
    });

    return res.status(200).json({
      message: "Message sent successfully.",
      emailNotification: true
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to send your message right now."
    });
  }
};
