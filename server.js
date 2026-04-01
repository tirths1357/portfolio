require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const nodemailer = require("nodemailer");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_COOKIE_NAME = "portfolio_admin_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;
const LOCKED_NAME = "Tirth Shah";
const RESUME_FILE_NAME = "Tirth-Shah-Resume.pdf";

const projectRoot = __dirname;
const assetsDirectory = path.join(projectRoot, "assets");
const dataDirectory = path.join(projectRoot, "data");
const databasePath = path.join(dataDirectory, "portfolio.sqlite");
const contentPath = path.join(dataDirectory, "site-content.json");
const resumePath = path.join(assetsDirectory, RESUME_FILE_NAME);
const sessions = new Map();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter(_req, file, callback) {
    const isPdf =
      file.mimetype === "application/pdf" ||
      String(file.originalname || "").toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      callback(new Error("Please upload a PDF resume."));
      return;
    }

    callback(null, true);
  }
});

ensureDirectory(assetsDirectory);
ensureDirectory(dataDirectory);
ensureContentFile();

const database = new sqlite3.Database(databasePath, (error) => {
  if (error) {
    console.error("Database connection failed:", error.message);
    return;
  }

  console.log(`Connected to SQLite database at ${databasePath}`);
});

database.serialize(() => {
  database.run(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

const mailTransporter = createMailTransporter();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(projectRoot));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    authRequired: Boolean(ADMIN_EMAIL || ADMIN_PASSWORD)
  });
});

app.get("/api/content", (_req, res) => {
  res.json(readSiteContent());
});

app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({
      message: "Name, email, and message are required."
    });
  }

  const trimmedPayload = {
    name: String(name).trim(),
    email: String(email).trim(),
    message: String(message).trim()
  };

  const insertSql = `
    INSERT INTO contact_messages (name, email, message)
    VALUES (?, ?, ?)
  `;

  database.run(
    insertSql,
    [trimmedPayload.name, trimmedPayload.email, trimmedPayload.message],
    async function onInsert(error) {
      if (error) {
        console.error("Failed to save contact message:", error.message);
        return res.status(500).json({
          message: "Failed to save your message."
        });
      }

      const emailResult = await sendNotificationEmail({
        id: this.lastID,
        ...trimmedPayload
      });

      return res.status(201).json({
        message: "Message saved successfully.",
        id: this.lastID,
        emailNotification: emailResult.sent
      });
    }
  );
});

app.get("/api/admin/session", (req, res) => {
  const sessionToken = getSessionToken(req);

  return res.json({
    authRequired: Boolean(ADMIN_EMAIL || ADMIN_PASSWORD),
    authenticated: Boolean(sessionToken || (!ADMIN_EMAIL && !ADMIN_PASSWORD))
  });
});

app.post("/api/admin/login", (req, res) => {
  const providedEmail = String(req.body?.email || "").trim().toLowerCase();
  const providedPassword = req.body?.password || "";
  const expectedEmail = String(ADMIN_EMAIL || "").trim().toLowerCase();

  if (expectedEmail && providedEmail !== expectedEmail) {
    return res.status(401).json({
      message: "Incorrect admin email."
    });
  }

  if (ADMIN_PASSWORD && providedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({
      message: "Incorrect admin password."
    });
  }

  const sessionToken = createSession();
  setSessionCookie(res, sessionToken);

  return res.json({
    message: "Logged in successfully."
  });
});

app.post("/api/admin/logout", (req, res) => {
  const sessionToken = getSessionToken(req);

  if (sessionToken) {
    sessions.delete(sessionToken);
  }

  clearSessionCookie(res);
  return res.json({ message: "Logged out successfully." });
});

app.get("/api/admin/content", requireAdmin, (_req, res) => {
  res.json(readSiteContent());
});

app.put("/api/admin/content", requireAdmin, (req, res) => {
  try {
    const currentContent = readSiteContent();
    const nextContent = normalizeContent(req.body, currentContent);
    writeSiteContent(nextContent);

    return res.json({
      message: "Portfolio content updated successfully.",
      content: nextContent
    });
  } catch (error) {
    console.error("Failed to update content:", error.message);
    return res.status(400).json({
      message: error.message || "Unable to update portfolio content."
    });
  }
});

app.post("/api/admin/resume", requireAdmin, upload.single("resume"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      message: "Please choose a PDF file first."
    });
  }

  try {
    fs.writeFileSync(resumePath, req.file.buffer);

    const currentContent = readSiteContent();
    const nextContent = {
      ...currentContent,
      resume: {
        ...currentContent.resume,
        href: `/assets/${RESUME_FILE_NAME}`,
        fileName: RESUME_FILE_NAME,
        originalName: req.file.originalname || RESUME_FILE_NAME
      }
    };

    writeSiteContent(nextContent);

    return res.json({
      message: "Resume updated successfully.",
      resume: nextContent.resume
    });
  } catch (error) {
    console.error("Failed to upload resume:", error.message);
    return res.status(500).json({
      message: "Unable to upload the resume right now."
    });
  }
});

app.get("/api/admin/messages", requireAdmin, (_req, res) => {
  const sql = `
    SELECT id, name, email, message, created_at
    FROM contact_messages
    ORDER BY created_at DESC
  `;

  database.all(sql, [], (error, rows) => {
    if (error) {
      console.error("Failed to load messages:", error.message);
      return res.status(500).json({
        message: "Failed to load messages."
      });
    }

    return res.json(rows);
  });
});

app.delete("/api/admin/messages/:id", requireAdmin, (req, res) => {
  const messageId = Number(req.params.id);

  if (!Number.isInteger(messageId) || messageId <= 0) {
    return res.status(400).json({
      message: "Invalid message id."
    });
  }

  database.run(
    "DELETE FROM contact_messages WHERE id = ?",
    [messageId],
    function onDelete(error) {
      if (error) {
        console.error("Failed to delete message:", error.message);
        return res.status(500).json({
          message: "Failed to delete message."
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          message: "Message not found."
        });
      }

      return res.json({
        message: "Message deleted successfully."
      });
    }
  );
});

app.get("/api/admin/stats", requireAdmin, (_req, res) => {
  const statsSql = `
    SELECT
      COUNT(*) AS totalMessages,
      COUNT(DISTINCT email) AS uniqueEmails,
      MAX(created_at) AS latestMessage
    FROM contact_messages
  `;

  database.get(statsSql, [], (error, row) => {
    if (error) {
      console.error("Failed to load stats:", error.message);
      return res.status(500).json({
        message: "Failed to load dashboard stats."
      });
    }

    return res.json(row);
  });
});

app.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      message: error.message
    });
  }

  if (error) {
    return res.status(400).json({
      message: error.message || "Something went wrong."
    });
  }

  return next();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

function requireAdmin(req, res, next) {
  if (!ADMIN_EMAIL && !ADMIN_PASSWORD) {
    return next();
  }

  const sessionToken = getSessionToken(req);

  if (!sessionToken) {
    return res.status(401).json({
      message: "Unauthorized."
    });
  }

  return next();
}

function createSession() {
  const token = crypto.randomUUID();
  sessions.set(token, {
    expiresAt: Date.now() + SESSION_DURATION_MS
  });
  return token;
}

function getSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  const session = sessions.get(token);

  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  return token;
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_DURATION_MS / 1000}; SameSite=Lax`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

function parseCookies(cookieHeader) {
  return cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((cookies, pair) => {
      const separatorIndex = pair.indexOf("=");

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = pair.slice(0, separatorIndex);
      const value = pair.slice(separatorIndex + 1);
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function createMailTransporter() {
  const emailService = String(process.env.EMAIL_SERVICE || "").trim();
  const gmailUser = String(process.env.GMAIL_USER || "").trim();
  const gmailAppPassword = String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const rejectUnauthorized = process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== "false";

  if ((emailService && emailService.toLowerCase() === "gmail") || (gmailUser && gmailAppPassword)) {
    return nodemailer.createTransport({
      service: "gmail",
      tls: {
        rejectUnauthorized
      },
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
    tls: {
      rejectUnauthorized
    },
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

async function sendNotificationEmail(entry) {
  if (!mailTransporter) {
    return { sent: false, reason: "not-configured" };
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
    return { sent: false, reason: "missing-recipient" };
  }

  try {
    await mailTransporter.sendMail({
      from: senderAddress,
      to: recipient,
      subject: `New portfolio contact from ${entry.name}`,
      replyTo: entry.email,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #111827;">
          <h2 style="margin-bottom: 16px;">New portfolio message received</h2>
          <p><strong>Name:</strong> ${escapeEmailHtml(entry.name)}</p>
          <p><strong>Email:</strong> ${escapeEmailHtml(entry.email)}</p>
          <p><strong>Message ID:</strong> ${escapeEmailHtml(String(entry.id))}</p>
          <div style="margin-top: 20px; padding: 16px; border-radius: 12px; background: #f3f4f6;">
            <strong>Message</strong>
            <p style="margin-top: 10px; white-space: pre-wrap;">${escapeEmailHtml(entry.message)}</p>
          </div>
        </div>
      `,
      text: [
        "New portfolio message received.",
        "",
        `Name: ${entry.name}`,
        `Email: ${entry.email}`,
        `Message: ${entry.message}`,
        `Database ID: ${entry.id}`
      ].join("\n")
    });

    return { sent: true };
  } catch (error) {
    console.error("Email notification failed:", error.message);
    return { sent: false, reason: "send-failed" };
  }
}

function ensureDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function ensureContentFile() {
  if (!fs.existsSync(contentPath)) {
    const defaultContent = getDefaultContent();
    fs.writeFileSync(contentPath, JSON.stringify(defaultContent, null, 2));
  }
}

function readSiteContent() {
  ensureContentFile();

  try {
    const raw = fs.readFileSync(contentPath, "utf8");
    return normalizeContent(JSON.parse(raw), getDefaultContent());
  } catch (error) {
    console.error("Failed to read site content, falling back to defaults:", error.message);
    const fallback = getDefaultContent();
    writeSiteContent(fallback);
    return fallback;
  }
}

function writeSiteContent(content) {
  fs.writeFileSync(contentPath, JSON.stringify(normalizeContent(content, getDefaultContent()), null, 2));
}

function normalizeContent(input, fallback = getDefaultContent()) {
  const source = input && typeof input === "object" ? input : {};

  return {
    identity: {
      name: LOCKED_NAME,
      role: pickText(source.identity?.role, fallback.identity.role),
      emailSubject: pickText(source.identity?.emailSubject, fallback.identity.emailSubject)
    },
    hero: {
      tag: pickText(source.hero?.tag, fallback.hero.tag),
      headingPrefix: pickText(source.hero?.headingPrefix, fallback.hero.headingPrefix),
      headingHighlight: pickText(source.hero?.headingHighlight, fallback.hero.headingHighlight),
      headingSuffix: pickText(source.hero?.headingSuffix, fallback.hero.headingSuffix),
      intro: pickText(source.hero?.intro, fallback.hero.intro),
      focusedLabel: pickText(source.hero?.focusedLabel, fallback.hero.focusedLabel),
      focusedOn: normalizeStringArray(source.hero?.focusedOn, fallback.hero.focusedOn),
      primaryCtaText: pickText(source.hero?.primaryCtaText, fallback.hero.primaryCtaText),
      secondaryCtaText: pickText(source.hero?.secondaryCtaText, fallback.hero.secondaryCtaText),
      stats: normalizeCardArray(source.hero?.stats, fallback.hero.stats, ["value", "label"]),
      profileLabel: pickText(source.hero?.profileLabel, fallback.hero.profileLabel),
      profileBio: pickText(source.hero?.profileBio, fallback.hero.profileBio),
      profileSkills: normalizeStringArray(source.hero?.profileSkills, fallback.hero.profileSkills),
      profileCode: normalizeStringArray(source.hero?.profileCode, fallback.hero.profileCode)
    },
    about: {
      heading: pickText(source.about?.heading, fallback.about.heading),
      intro: pickText(source.about?.intro, fallback.about.intro),
      summaryTitle: pickText(source.about?.summaryTitle, fallback.about.summaryTitle),
      summaryBody: pickText(source.about?.summaryBody, fallback.about.summaryBody),
      highlights: normalizeCardArray(source.about?.highlights, fallback.about.highlights, ["title", "text"]),
      skills: normalizeCardArray(source.about?.skills, fallback.about.skills, ["icon", "title", "description"])
    },
    experience: {
      heading: pickText(source.experience?.heading, fallback.experience.heading),
      items: normalizeCardArray(source.experience?.items, fallback.experience.items, [
        "number",
        "title",
        "description",
        "linkLabel",
        "linkUrl"
      ]).map((item, index) => ({
        ...item,
        openInNewTab: Boolean(source.experience?.items?.[index]?.openInNewTab ?? item.openInNewTab)
      }))
    },
    projects: {
      heading: pickText(source.projects?.heading, fallback.projects.heading),
      intro: pickText(source.projects?.intro, fallback.projects.intro),
      items: normalizeCardArray(source.projects?.items, fallback.projects.items, [
        "number",
        "title",
        "description",
        "linkLabel",
        "linkUrl",
        "id"
      ]).map((item, index) => ({
        ...item,
        openInNewTab: Boolean(source.projects?.items?.[index]?.openInNewTab ?? item.openInNewTab)
      }))
    },
    services: {
      heading: pickText(source.services?.heading, fallback.services.heading),
      items: normalizeCardArray(source.services?.items, fallback.services.items, ["number", "title", "description"])
    },
    toolkit: {
      heading: pickText(source.toolkit?.heading, fallback.toolkit.heading),
      items: normalizeStringArray(source.toolkit?.items, fallback.toolkit.items),
      beyondTitle: pickText(source.toolkit?.beyondTitle, fallback.toolkit.beyondTitle),
      beyondBody: pickText(source.toolkit?.beyondBody, fallback.toolkit.beyondBody),
      interests: normalizeStringArray(source.toolkit?.interests, fallback.toolkit.interests)
    },
    opportunity: {
      tag: pickText(source.opportunity?.tag, fallback.opportunity.tag),
      heading: pickText(source.opportunity?.heading, fallback.opportunity.heading),
      buttonText: pickText(source.opportunity?.buttonText, fallback.opportunity.buttonText)
    },
    contact: {
      heading: pickText(source.contact?.heading, fallback.contact.heading),
      intro: pickText(source.contact?.intro, fallback.contact.intro),
      email: pickText(source.contact?.email, fallback.contact.email),
      phone: pickText(source.contact?.phone, fallback.contact.phone),
      address: pickText(source.contact?.address, fallback.contact.address)
    },
    resume: {
      href: `/assets/${RESUME_FILE_NAME}`,
      buttonLabel: pickText(source.resume?.buttonLabel, fallback.resume.buttonLabel),
      linkLabel: pickText(source.resume?.linkLabel, fallback.resume.linkLabel),
      fileName: RESUME_FILE_NAME,
      originalName: pickText(source.resume?.originalName, fallback.resume.originalName)
    }
  };
}

function normalizeStringArray(input, fallback) {
  if (!Array.isArray(input)) {
    return [...fallback];
  }

  const cleaned = input
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return cleaned.length ? cleaned : [...fallback];
}

function normalizeCardArray(input, fallback, keys) {
  if (!Array.isArray(input)) {
    return fallback.map((item) => ({ ...item }));
  }

  const cleaned = input
    .map((item) => {
      const nextItem = {};

      keys.forEach((key) => {
        nextItem[key] = pickText(item?.[key], "");
      });

      return nextItem;
    })
    .filter((item) => keys.some((key) => item[key]));

  return cleaned.length ? cleaned : fallback.map((item) => ({ ...item }));
}

function pickText(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getDefaultContent() {
  return {
    identity: {
      name: LOCKED_NAME,
      role: "Computer Engineering Student",
      emailSubject: "Portfolio Inquiry"
    },
    hero: {
      tag: "Computer Engineering Student",
      headingPrefix: "Building",
      headingHighlight: "data-driven projects",
      headingSuffix: "with Python, analysis, and modern web skills.",
      intro:
        "I'm Tirth Shah, a Computer Engineering student at SVIT, GTU with a strong interest in Python, data analysis, AI-based ideas, and practical solutions that solve real problems.",
      focusedLabel: "Focused on:",
      focusedOn: [
        "Python coding and automation",
        "Data analysis and insights",
        "AI and machine learning basics",
        "Real-world engineering projects"
      ],
      primaryCtaText: "View My Work",
      secondaryCtaText: "Contact Me",
      stats: [
        { value: "7.5", label: "Current CGPA" },
        { value: "2+", label: "Major Project Highlights" },
        { value: "2023-27", label: "Engineering Journey" }
      ],
      profileLabel: "Profile Snapshot",
      profileBio:
        "Python-focused engineering student interested in AI, data analysis, algorithmic thinking, and building useful digital solutions.",
      profileSkills: [
        "Python",
        "Data Analysis",
        "Machine Learning",
        "FastAPI",
        "AI Automation",
        "Mathematics"
      ],
      profileCode: [
        'const student = "Tirth Shah";',
        'const focus = ["Python", "AI", "Data Analysis"];',
        "buildUsefulSolutions(student, focus);"
      ]
    },
    about: {
      heading: "Computer Engineering student with strong Python and data analysis fundamentals.",
      intro:
        "I am seeking opportunities where I can apply analytical thinking, programming skills, and project experience to create useful, data-driven solutions. I enjoy learning by building and improving practical systems with clean logic and thoughtful design.",
      summaryTitle: "Profile Summary",
      summaryBody:
        "My strengths include Python coding, data analysis, mathematics, algorithmic thinking, and basic AI or machine learning concepts. I am especially interested in creating systems that help users make better decisions with real information.",
      highlights: [
        {
          title: "Core Strength",
          text: "Proficient in mathematics and analytical thinking"
        },
        {
          title: "Current Goal",
          text: "Apply programming and data skills in an entry-level technical role"
        }
      ],
      skills: [
        { icon: "Py", title: "Python Coding", description: "Building logical solutions and data-based applications." },
        { icon: "DA", title: "Data Analysis", description: "Turning data into useful insights and decisions." },
        { icon: "ML", title: "AI / ML Basics", description: "Exploring intelligent systems and machine learning concepts." },
        { icon: "WD", title: "Website Design", description: "Creating modern and clean websites with frontend tools." },
        { icon: "AD", title: "Algorithms", description: "Applying analysis and design of algorithms in problem solving." },
        { icon: "MT", title: "Mathematics", description: "Using strong quantitative foundations to support technical work." }
      ]
    },
    experience: {
      heading: "Hands-on project and innovation experiences from competitions and camps.",
      items: [
        {
          number: "2024",
          title: "MECIA HACKS 2.0 | SVIT SSIP",
          description:
            "Built a QR and barcode based medicine identification system to detect expired medicines. The project extracted manufacturing and expiry information, verified authenticity, and focused on validation logic with a user-friendly interface.",
          linkLabel: "Ask About This Project",
          linkUrl: "#contact",
          openInNewTab: false
        },
        {
          number: "2025",
          title: "AI-ML Innovation Camp | IBM SkillsBuild",
          description:
            "Participated in the innovation camp and worked on AI-oriented thinking, smart systems, and practical problem solving using modern tools and analytical methods.",
          linkLabel: "View Project Highlight",
          linkUrl: "#kissanmitra-project",
          openInNewTab: false
        },
        {
          number: "Focus",
          title: "Entry-Level Growth Path",
          description:
            "Looking for opportunities to apply Python, data analysis, machine learning basics, and engineering problem solving in professional environments.",
          linkLabel: "Connect With Me",
          linkUrl: "#contact",
          openInNewTab: false
        }
      ]
    },
    projects: {
      heading: "Projects that reflect real-world problem solving and practical engineering thinking.",
      intro:
        "My work focuses on combining technical logic, meaningful data, and useful interfaces to create solutions that solve actual user problems.",
      items: [
        {
          number: "01",
          id: "",
          title: "Medicine Identification System",
          description:
            "A QR and barcode medicine verification system designed to detect expired medicines by reading encoded product details and validating manufacturing and expiry dates.",
          linkLabel: "Request Details",
          linkUrl: "#contact",
          openInNewTab: false
        },
        {
          number: "02",
          id: "kissanmitra-project",
          title: "KissanMitra",
          description:
            "An AI-based smart farming solution with weather forecasting, temperature tracking, crop health monitoring, and actionable insights to support farmers in irrigation, harvesting, and crop protection decisions.",
          linkLabel: "Open Live Project",
          linkUrl: "https://kissanmitra-five.vercel.app/",
          openInNewTab: true
        },
        {
          number: "03",
          id: "",
          title: "Portfolio Contact Platform",
          description:
            "A premium portfolio website connected to a real database, admin dashboard, and Gmail-ready contact system to support communication and project visibility.",
          linkLabel: "Start a Conversation",
          linkUrl: "#contact",
          openInNewTab: false
        }
      ]
    },
    services: {
      heading: "A blend of programming, analysis, and project-focused learning.",
      items: [
        { number: "01", title: "Python Development", description: "Creating logical, structured solutions using Python for practical applications and analysis." },
        { number: "02", title: "Data-Driven Thinking", description: "Using data analysis techniques to support better decision-making and useful outcomes." },
        { number: "03", title: "Problem Solving", description: "Applying mathematics, algorithmic thinking, and engineering discipline to solve challenges." }
      ]
    },
    toolkit: {
      heading: "Technologies, interests, and strengths from my resume.",
      items: [
        "Python",
        "Data Analysis",
        "Machine Learning",
        "AI Automation",
        "FastAPI",
        "Analysis and Design Algorithm",
        "Creative Website Design with Vibe Coding"
      ],
      beyondTitle: "Beyond the classroom",
      beyondBody:
        "Outside technical work, I stay energized through team sports and table tennis, while my interest in business news and financial market trends keeps my mindset analytical, curious, and future-focused.",
      interests: ["Team Sports", "Table Tennis", "Business News", "Financial Market Trends"]
    },
    opportunity: {
      tag: "Open To Opportunities",
      heading: "Looking for internships, collaborations, and projects that push me forward.",
      buttonText: "Start a Conversation"
    },
    contact: {
      heading: "Let's connect and build something useful together.",
      intro:
        "I am open to internships, collaboration opportunities, technical discussions, and entry-level roles where I can grow while contributing value.",
      email: "tirths1308@gmail.com",
      phone: "+91 8141320360",
      address: "32, Shantipark Society, Sindhwaimata Road, Pratapnagar, Vadodara - 390004"
    },
    resume: {
      href: `/assets/${RESUME_FILE_NAME}`,
      buttonLabel: "View Resume",
      linkLabel: "Open Resume PDF",
      fileName: RESUME_FILE_NAME,
      originalName: RESUME_FILE_NAME
    }
  };
}

function escapeEmailHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
