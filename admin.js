const adminLogin = document.getElementById("adminLogin");
const adminDashboard = document.getElementById("adminDashboard");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const adminNote = document.getElementById("adminNote");
const logoutButton = document.getElementById("logoutButton");
const messagesGrid = document.getElementById("messagesGrid");
const messageSearch = document.getElementById("messageSearch");
const totalMessages = document.getElementById("totalMessages");
const uniqueEmails = document.getElementById("uniqueEmails");
const latestMessageDate = document.getElementById("latestMessageDate");
const adminEmpty = document.getElementById("adminEmpty");

const contentEditorForm = document.getElementById("contentEditorForm");
const contentSaveNote = document.getElementById("contentSaveNote");
const resumeUploadForm = document.getElementById("resumeUploadForm");
const resumeFileInput = document.getElementById("resumeFileInput");
const currentResumeFile = document.getElementById("currentResumeFile");
const resumeUploadNote = document.getElementById("resumeUploadNote");

let allMessages = [];
let siteContent = null;

const collectionConfigs = {
  heroStatsEditor: {
    fields: [
      { key: "value", label: "Value" },
      { key: "label", label: "Label" }
    ]
  },
  aboutHighlightsEditor: {
    fields: [
      { key: "title", label: "Title" },
      { key: "text", label: "Text", type: "textarea" }
    ]
  },
  aboutSkillsEditor: {
    fields: [
      { key: "icon", label: "Icon" },
      { key: "title", label: "Title" },
      { key: "description", label: "Description", type: "textarea" }
    ]
  },
  experienceEditor: {
    fields: [
      { key: "number", label: "Number / Tag" },
      { key: "title", label: "Title" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "linkLabel", label: "Button Text" },
      { key: "linkUrl", label: "Button Link" },
      { key: "openInNewTab", label: "Open in new tab", type: "checkbox" }
    ]
  },
  projectsEditor: {
    fields: [
      { key: "number", label: "Number / Tag" },
      { key: "id", label: "Card ID (optional)" },
      { key: "title", label: "Title" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "linkLabel", label: "Button Text" },
      { key: "linkUrl", label: "Button Link" },
      { key: "openInNewTab", label: "Open in new tab", type: "checkbox" }
    ]
  },
  servicesEditor: {
    fields: [
      { key: "number", label: "Number" },
      { key: "title", label: "Title" },
      { key: "description", label: "Description", type: "textarea" }
    ]
  }
};

initializeAdmin();

async function initializeAdmin() {
  clearAdminLoginFields();
  window.addEventListener("pageshow", clearAdminLoginFields);

  if (isVercelDeployment()) {
    showLogin();
    disableAdminForVercel();
    return;
  }

  try {
    const sessionResponse = await fetch("/api/admin/session");
    const session = await sessionResponse.json();

    if (session.authenticated) {
      showDashboard();
      await loadDashboardData();
    } else {
      showLogin();

      if (!session.authRequired) {
        setAdminNote("No admin credentials are configured. Click open dashboard to continue.", "is-success");
      }
    }
  } catch (_error) {
    showLogin();
    setAdminNote("Unable to connect to the admin service.", "is-error");
  }
}

if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    setAdminNote("Opening dashboard...", "");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: adminEmail ? adminEmail.value : "",
          password: adminPassword ? adminPassword.value : ""
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Login failed.");
      }

      showDashboard();
      await loadDashboardData();
      setAdminNote("", "");
    } catch (error) {
      setAdminNote(error.message || "Login failed.", "is-error");
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await fetch("/api/admin/logout", {
      method: "POST"
    });

    showLogin();
    setAdminNote("Logged out successfully.", "is-success");
    clearAdminLoginFields();
  });
}

if (messageSearch) {
  messageSearch.addEventListener("input", () => {
    renderMessages(filterMessages(messageSearch.value));
  });
}

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-target]");

  if (addButton) {
    const targetId = addButton.getAttribute("data-add-target");
    const config = collectionConfigs[targetId];
    const container = document.getElementById(targetId);

    if (config && container) {
      appendEditorItem(container, config.fields, {});
    }

    return;
  }

  const removeButton = event.target.closest("[data-remove-item]");

  if (removeButton) {
    const item = removeButton.closest(".editor-item");

    if (item) {
      item.remove();
    }
  }
});

if (contentEditorForm) {
  contentEditorForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    setInlineNote(contentSaveNote, "Saving your website content...", "");

    try {
      const payload = buildContentPayload();
      const response = await fetch("/api/admin/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.status === 401) {
        handleExpiredSession();
        return;
      }

      if (!response.ok) {
        throw new Error(result.message || "Unable to save content.");
      }

      siteContent = result.content;
      fillContentForm(siteContent);
      setInlineNote(contentSaveNote, "Portfolio content saved successfully.", "is-success");
    } catch (error) {
      setInlineNote(contentSaveNote, error.message || "Unable to save content.", "is-error");
    }
  });
}

if (resumeUploadForm) {
  resumeUploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!resumeFileInput || !resumeFileInput.files || !resumeFileInput.files.length) {
      setInlineNote(resumeUploadNote, "Choose a PDF resume first.", "is-error");
      return;
    }

    const body = new FormData();
    body.append("resume", resumeFileInput.files[0]);

    setInlineNote(resumeUploadNote, "Uploading your new resume...", "");

    try {
      const response = await fetch("/api/admin/resume", {
        method: "POST",
        body
      });

      const result = await response.json();

      if (response.status === 401) {
        handleExpiredSession();
        return;
      }

      if (!response.ok) {
        throw new Error(result.message || "Unable to upload the resume.");
      }

      if (siteContent) {
        siteContent.resume = {
          ...siteContent.resume,
          ...result.resume
        };
        fillContentForm(siteContent);
      }

      if (resumeFileInput) {
        resumeFileInput.value = "";
      }

      setInlineNote(resumeUploadNote, "Resume uploaded successfully.", "is-success");
    } catch (error) {
      setInlineNote(resumeUploadNote, error.message || "Unable to upload the resume.", "is-error");
    }
  });
}

async function loadDashboardData() {
  const [statsResponse, messagesResponse, contentResponse] = await Promise.all([
    fetch("/api/admin/stats"),
    fetch("/api/admin/messages"),
    fetch("/api/admin/content")
  ]);

  if ([statsResponse, messagesResponse, contentResponse].some((response) => response.status === 401)) {
    handleExpiredSession();
    return;
  }

  const [stats, messages, content] = await Promise.all([
    statsResponse.json(),
    messagesResponse.json(),
    contentResponse.json()
  ]);

  allMessages = Array.isArray(messages) ? messages : [];
  siteContent = content;

  totalMessages.textContent = stats.totalMessages ?? 0;
  uniqueEmails.textContent = stats.uniqueEmails ?? 0;
  latestMessageDate.textContent = stats.latestMessage
    ? formatDate(stats.latestMessage)
    : "-";

  fillContentForm(siteContent);
  renderMessages(allMessages);
}

function fillContentForm(content) {
  if (!content) return;

  setValue("contentHeroTag", content.hero.tag);
  setValue("contentFocusedLabel", content.hero.focusedLabel);
  setValue("contentHeroPrefix", content.hero.headingPrefix);
  setValue("contentHeroHighlight", content.hero.headingHighlight);
  setValue("contentHeroSuffix", content.hero.headingSuffix);
  setValue("contentHeroIntro", content.hero.intro);
  setValue("contentPrimaryCta", content.hero.primaryCtaText);
  setValue("contentSecondaryCta", content.hero.secondaryCtaText);
  setValue("contentFocusedOn", content.hero.focusedOn.join("\n"));
  setValue("contentProfileLabel", content.hero.profileLabel);
  setValue("contentProfileBio", content.hero.profileBio);
  setValue("contentProfileSkills", content.hero.profileSkills.join("\n"));
  setValue("contentProfileCode", content.hero.profileCode.join("\n"));

  setValue("contentAboutHeading", content.about.heading);
  setValue("contentAboutIntro", content.about.intro);
  setValue("contentAboutSummaryTitle", content.about.summaryTitle);
  setValue("contentAboutSummaryBody", content.about.summaryBody);

  setValue("contentExperienceHeading", content.experience.heading);
  setValue("contentProjectsHeading", content.projects.heading);
  setValue("contentProjectsIntro", content.projects.intro);
  setValue("contentServicesHeading", content.services.heading);
  setValue("contentToolkitHeading", content.toolkit.heading);
  setValue("contentToolkitItems", content.toolkit.items.join("\n"));
  setValue("contentBeyondTitle", content.toolkit.beyondTitle);
  setValue("contentBeyondBody", content.toolkit.beyondBody);
  setValue("contentInterests", content.toolkit.interests.join("\n"));
  setValue("contentOpportunityTag", content.opportunity.tag);
  setValue("contentOpportunityHeading", content.opportunity.heading);
  setValue("contentOpportunityButton", content.opportunity.buttonText);
  setValue("contentContactHeading", content.contact.heading);
  setValue("contentContactIntro", content.contact.intro);
  setValue("contentContactEmail", content.contact.email);
  setValue("contentEmailSubject", content.identity.emailSubject);
  setValue("contentContactPhone", content.contact.phone);
  setValue("contentContactAddress", content.contact.address);
  setValue("currentResumeFile", content.resume.originalName || content.resume.fileName);

  renderCollectionEditor("heroStatsEditor", content.hero.stats);
  renderCollectionEditor("aboutHighlightsEditor", content.about.highlights);
  renderCollectionEditor("aboutSkillsEditor", content.about.skills);
  renderCollectionEditor("experienceEditor", content.experience.items);
  renderCollectionEditor("projectsEditor", content.projects.items);
  renderCollectionEditor("servicesEditor", content.services.items);
}

function renderCollectionEditor(containerId, items) {
  const container = document.getElementById(containerId);
  const config = collectionConfigs[containerId];

  if (!container || !config) return;

  container.innerHTML = "";

  items.forEach((item) => {
    appendEditorItem(container, config.fields, item);
  });
}

function appendEditorItem(container, fields, data) {
  const item = document.createElement("div");
  item.className = "editor-item";

  fields.forEach((field) => {
    const label = document.createElement("label");
    label.className = field.type === "checkbox" ? "editor-checkbox" : "";
    label.dataset.field = field.key;

    if (field.type === "checkbox") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(data[field.key]);

      const span = document.createElement("span");
      span.textContent = field.label;

      label.append(input, span);
    } else if (field.type === "textarea") {
      const textarea = document.createElement("textarea");
      textarea.rows = field.rows || 4;
      textarea.value = data[field.key] || "";

      const title = document.createElement("span");
      title.className = "editor-field-title";
      title.textContent = field.label;

      label.append(title, textarea);
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.value = data[field.key] || "";

      const title = document.createElement("span");
      title.className = "editor-field-title";
      title.textContent = field.label;

      label.append(title, input);
    }

    item.appendChild(label);
  });

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "btn btn-secondary admin-mini-button";
  removeButton.setAttribute("data-remove-item", "true");
  removeButton.textContent = "Remove";

  item.appendChild(removeButton);
  container.appendChild(item);
}

function buildContentPayload() {
  return {
    identity: {
      emailSubject: getValue("contentEmailSubject")
    },
    hero: {
      tag: getValue("contentHeroTag"),
      headingPrefix: getValue("contentHeroPrefix"),
      headingHighlight: getValue("contentHeroHighlight"),
      headingSuffix: getValue("contentHeroSuffix"),
      intro: getValue("contentHeroIntro"),
      focusedLabel: getValue("contentFocusedLabel"),
      focusedOn: getLines("contentFocusedOn"),
      primaryCtaText: getValue("contentPrimaryCta"),
      secondaryCtaText: getValue("contentSecondaryCta"),
      stats: collectCollectionItems("heroStatsEditor"),
      profileLabel: getValue("contentProfileLabel"),
      profileBio: getValue("contentProfileBio"),
      profileSkills: getLines("contentProfileSkills"),
      profileCode: getLines("contentProfileCode")
    },
    about: {
      heading: getValue("contentAboutHeading"),
      intro: getValue("contentAboutIntro"),
      summaryTitle: getValue("contentAboutSummaryTitle"),
      summaryBody: getValue("contentAboutSummaryBody"),
      highlights: collectCollectionItems("aboutHighlightsEditor"),
      skills: collectCollectionItems("aboutSkillsEditor")
    },
    experience: {
      heading: getValue("contentExperienceHeading"),
      items: collectCollectionItems("experienceEditor")
    },
    projects: {
      heading: getValue("contentProjectsHeading"),
      intro: getValue("contentProjectsIntro"),
      items: collectCollectionItems("projectsEditor")
    },
    services: {
      heading: getValue("contentServicesHeading"),
      items: collectCollectionItems("servicesEditor")
    },
    toolkit: {
      heading: getValue("contentToolkitHeading"),
      items: getLines("contentToolkitItems"),
      beyondTitle: getValue("contentBeyondTitle"),
      beyondBody: getValue("contentBeyondBody"),
      interests: getLines("contentInterests")
    },
    opportunity: {
      tag: getValue("contentOpportunityTag"),
      heading: getValue("contentOpportunityHeading"),
      buttonText: getValue("contentOpportunityButton")
    },
    contact: {
      heading: getValue("contentContactHeading"),
      intro: getValue("contentContactIntro"),
      email: getValue("contentContactEmail"),
      phone: getValue("contentContactPhone"),
      address: getValue("contentContactAddress")
    }
  };
}

function collectCollectionItems(containerId) {
  const container = document.getElementById(containerId);
  const config = collectionConfigs[containerId];

  if (!container || !config) {
    return [];
  }

  return [...container.querySelectorAll(".editor-item")]
    .map((item) => {
      const result = {};

      config.fields.forEach((field) => {
        const fieldLabel = item.querySelector(`[data-field="${field.key}"]`);

        if (!fieldLabel) {
          return;
        }

        if (field.type === "checkbox") {
          const input = fieldLabel.querySelector("input");
          result[field.key] = Boolean(input?.checked);
          return;
        }

        const input = fieldLabel.querySelector("input, textarea");
        result[field.key] = String(input?.value || "").trim();
      });

      return result;
    })
    .filter((item) => Object.values(item).some((value) => value !== "" && value !== false));
}

async function refreshStats() {
  const response = await fetch("/api/admin/stats");

  if (response.status === 401) {
    handleExpiredSession();
    return;
  }

  const stats = await response.json();
  totalMessages.textContent = stats.totalMessages ?? 0;
  uniqueEmails.textContent = stats.uniqueEmails ?? 0;
  latestMessageDate.textContent = stats.latestMessage
    ? formatDate(stats.latestMessage)
    : "-";
}

function renderMessages(messages) {
  if (!messagesGrid || !adminEmpty) return;

  messagesGrid.innerHTML = "";

  if (!messages.length) {
    adminEmpty.hidden = false;
    return;
  }

  adminEmpty.hidden = true;

  messages.forEach((message) => {
    const card = document.createElement("article");
    card.className = "message-card";
    card.innerHTML = `
      <div class="message-head">
        <div>
          <h3>${escapeHtml(message.name)}</h3>
          <a class="message-email" href="mailto:${escapeAttribute(message.email)}">${escapeHtml(message.email)}</a>
        </div>
        <div class="message-actions">
          <span class="message-meta">${formatDate(message.created_at)}</span>
          <button class="message-delete-button" type="button" data-message-id="${message.id}">
            Delete
          </button>
        </div>
      </div>
      <p class="message-body">${escapeHtml(message.message)}</p>
    `;

    const deleteButton = card.querySelector(".message-delete-button");
    if (deleteButton) {
      deleteButton.addEventListener("click", () => {
        deleteMessage(message.id, deleteButton);
      });
    }

    messagesGrid.appendChild(card);
  });
}

async function deleteMessage(messageId, button) {
  const confirmed = window.confirm("Delete this message permanently?");

  if (!confirmed) {
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Deleting...";

  try {
    const response = await fetch(`/api/admin/messages/${messageId}`, {
      method: "DELETE"
    });

    const result = await response.json();

    if (response.status === 401) {
      handleExpiredSession();
      return;
    }

    if (!response.ok) {
      throw new Error(result.message || "Delete failed.");
    }

    allMessages = allMessages.filter((message) => message.id !== messageId);
    renderMessages(filterMessages(messageSearch ? messageSearch.value : ""));
    await refreshStats();
  } catch (error) {
    window.alert(error.message || "Unable to delete this message.");
    button.disabled = false;
    button.textContent = originalText;
  }
}

function filterMessages(searchTerm) {
  const query = searchTerm.trim().toLowerCase();

  if (!query) {
    return allMessages;
  }

  return allMessages.filter((message) => {
    return [message.name, message.email, message.message]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(query));
  });
}

function showLogin() {
  if (adminLogin) {
    adminLogin.hidden = false;
  }

  if (adminDashboard) {
    adminDashboard.hidden = true;
  }
}

function showDashboard() {
  if (adminLogin) {
    adminLogin.hidden = true;
  }

  if (adminDashboard) {
    adminDashboard.hidden = false;
  }
}

function handleExpiredSession() {
  showLogin();
  setAdminNote("Your admin session expired. Please log in again.", "is-error");
}

function setAdminNote(text, stateClass) {
  if (!adminNote) return;

  adminNote.textContent = text;
  adminNote.className = "admin-note";

  if (stateClass) {
    adminNote.classList.add(stateClass);
  }
}

function setInlineNote(element, text, stateClass) {
  if (!element) return;

  element.textContent = text;
  element.className = "admin-note";

  if (stateClass) {
    element.classList.add(stateClass);
  }
}

function clearAdminLoginFields() {
  if (adminEmail) {
    adminEmail.value = "";
  }

  if (adminPassword) {
    adminPassword.value = "";
  }
}

function disableAdminForVercel() {
  setAdminNote(
    "Admin editing, messages, and resume upload are disabled on Vercel because this project uses local files and SQLite. Deploy the full app on Railway for admin features.",
    "is-error"
  );

  if (adminEmail) {
    adminEmail.disabled = true;
  }

  if (adminPassword) {
    adminPassword.disabled = true;
  }

  const submitButton = adminLoginForm ? adminLoginForm.querySelector('button[type="submit"]') : null;

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Unavailable On Vercel";
  }
}

function isVercelDeployment() {
  return window.location.hostname.endsWith("vercel.app");
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value ?? "";
  }
}

function getValue(id) {
  const element = document.getElementById(id);
  return String(element?.value || "").trim();
}

function getLines(id) {
  return getValue(id)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
