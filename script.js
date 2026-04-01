const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
const adminLoginLink = document.getElementById("adminLoginLink");
const typingText = document.getElementById("typingText");
const scrollProgress = document.getElementById("scrollProgress");
const navAnchors = navLinks ? [...navLinks.querySelectorAll('a[href^="#"]')] : [];
const heroMockup = document.getElementById("heroMockup");
const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");

const heroTag = document.getElementById("heroTag");
const heroHeading = document.getElementById("heroHeading");
const heroIntro = document.getElementById("heroIntro");
const focusedLabel = document.getElementById("focusedLabel");
const primaryCta = document.getElementById("primaryCta");
const secondaryCta = document.getElementById("secondaryCta");
const heroStats = document.getElementById("heroStats");
const profileLabel = document.getElementById("profileLabel");
const profileBio = document.getElementById("profileBio");
const profileSkills = document.getElementById("profileSkills");
const profileCode = document.getElementById("profileCode");
const aboutHeading = document.getElementById("aboutHeading");
const aboutIntro = document.getElementById("aboutIntro");
const aboutSummaryTitle = document.getElementById("aboutSummaryTitle");
const aboutSummaryBody = document.getElementById("aboutSummaryBody");
const aboutHighlights = document.getElementById("aboutHighlights");
const aboutSkills = document.getElementById("aboutSkills");
const experienceHeading = document.getElementById("experienceHeading");
const experienceGrid = document.getElementById("experienceGrid");
const projectsHeading = document.getElementById("projectsHeading");
const projectsIntro = document.getElementById("projectsIntro");
const projectsGrid = document.getElementById("projectsGrid");
const servicesHeading = document.getElementById("servicesHeading");
const servicesGrid = document.getElementById("servicesGrid");
const toolkitHeading = document.getElementById("toolkitHeading");
const toolkitList = document.getElementById("toolkitList");
const beyondTitle = document.getElementById("beyondTitle");
const beyondBody = document.getElementById("beyondBody");
const interestsList = document.getElementById("interestsList");
const opportunityTag = document.getElementById("opportunityTag");
const opportunityHeading = document.getElementById("opportunityHeading");
const opportunityButton = document.getElementById("opportunityButton");
const contactHeading = document.getElementById("contactHeading");
const contactIntro = document.getElementById("contactIntro");
const contactEmailLink = document.getElementById("contactEmailLink");
const contactEmailText = document.getElementById("contactEmailText");
const contactPhone = document.getElementById("contactPhone");
const contactAddress = document.getElementById("contactAddress");
const resumeButton = document.getElementById("resumeButton");
const resumeLink = document.getElementById("resumeLink");
const footerEmailLink = document.getElementById("footerEmailLink");
const footerEmailText = document.getElementById("footerEmailText");

let typingWords = [
  "Python coding and automation",
  "Data analysis and insights",
  "AI and machine learning basics",
  "Real-world engineering projects"
];
let wordIndex = 0;
let charIndex = 0;
let deleting = false;
let typingTimer = null;
let revealObserver = null;

initialize();

function initialize() {
  initializeDeploymentAwareUi();
  initializeMenu();
  initializeRevealObserver();
  initializeScrollTracking();
  initializeInteractiveMockup();
  initializeProjectHighlight();
  initializeContactForm();
  runTypingEffect();
  loadSiteContent();
}

function initializeDeploymentAwareUi() {
  if (!adminLoginLink) return;

  if (isVercelDeployment()) {
    adminLoginLink.hidden = true;
  }
}

function initializeMenu() {
  if (!menuToggle || !navLinks) return;

  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("show");
    document.body.classList.toggle("menu-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("show");
      document.body.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

function initializeRevealObserver() {
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
        }
      });
    },
    { threshold: 0.14 }
  );

  observeRevealTargets();
}

function observeRevealTargets() {
  if (!revealObserver) return;

  document.querySelectorAll(".reveal").forEach((item) => {
    revealObserver.observe(item);
  });
}

function initializeScrollTracking() {
  updateScrollProgress();
  updateActiveNav();

  window.addEventListener("scroll", () => {
    updateScrollProgress();
    updateActiveNav();
  });
}

function initializeInteractiveMockup() {
  if (!heroMockup) return;

  heroMockup.addEventListener("mousemove", (event) => {
    const rect = heroMockup.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const rotateY = ((offsetX / rect.width) - 0.5) * 10;
    const rotateX = ((offsetY / rect.height) - 0.5) * -10;

    heroMockup.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });

  heroMockup.addEventListener("mouseleave", () => {
    heroMockup.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg)";
  });
}

function initializeProjectHighlight() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href="#kissanmitra-project"]');
    if (!link) return;

    const projectCard = document.getElementById("kissanmitra-project");
    if (!projectCard) return;

    projectCard.classList.remove("project-highlighted");

    requestAnimationFrame(() => {
      projectCard.classList.add("project-highlighted");
    });

    window.setTimeout(() => {
      projectCard.classList.remove("project-highlighted");
    }, 2600);
  });
}

function initializeContactForm() {
  if (!contactForm || !formMessage) return;

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = contactForm.querySelector('button[type="submit"]');
    const formData = new FormData(contactForm);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      message: String(formData.get("message") || "").trim()
    };

    formMessage.classList.remove("is-success", "is-error");

    if (!payload.name || !payload.email || !payload.message) {
      setFormMessage(
        "Please complete all fields.",
        "Add your name, email, and message before sending.",
        "is-error"
      );
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Sending...";
    }

    setFormMessage(
      "Sending your message...",
      "Your note is being saved and delivered to my Gmail inbox now."
    );

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to send your message right now.");
      }

      const deliveryMessage = result.emailNotification
        ? "Your message has been received, saved, and sent to my Gmail inbox successfully."
        : "Your message has been received and saved successfully. Email delivery is not active yet on this server.";

      setFormMessage(
        "Message received. Thank you for reaching out.",
        deliveryMessage,
        "is-success"
      );

      contactForm.reset();
    } catch (error) {
      setFormMessage(
        "Message could not be sent yet.",
        error.message || "Please make sure the localhost server is running and try again.",
        "is-error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Send Message";
      }
    }
  });
}

function setFormMessage(title, body, stateClass = "") {
  if (!formMessage) return;

  formMessage.innerHTML = "";

  const strong = document.createElement("strong");
  strong.textContent = title;

  const span = document.createElement("span");
  span.textContent = body;

  formMessage.append(strong, span);

  if (stateClass) {
    formMessage.classList.add(stateClass);
  }
}

function isVercelDeployment() {
  return window.location.hostname.endsWith("vercel.app");
}

async function loadSiteContent() {
  try {
    const response = await fetch("/api/content");

    if (!response.ok) {
      throw new Error("Unable to load portfolio content.");
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error("Portfolio content endpoint did not return JSON.");
    }

    const content = await response.json();
    renderSiteContent(content);
  } catch (_error) {
    resetTypingWords(typingWords);
  }
}

function renderSiteContent(content) {
  if (!content) return;

  if (heroTag) heroTag.textContent = content.hero.tag;
  if (heroHeading) {
    heroHeading.innerHTML = "";
    heroHeading.append(
      document.createTextNode(`${content.hero.headingPrefix} `),
      createGradientSpan(content.hero.headingHighlight),
      document.createTextNode(` ${content.hero.headingSuffix}`)
    );
  }
  if (heroIntro) heroIntro.textContent = content.hero.intro;
  if (focusedLabel) focusedLabel.textContent = content.hero.focusedLabel;
  if (primaryCta) primaryCta.textContent = content.hero.primaryCtaText;
  if (secondaryCta) secondaryCta.textContent = content.hero.secondaryCtaText;
  renderStats(content.hero.stats);

  if (profileLabel) profileLabel.textContent = content.hero.profileLabel;
  if (profileBio) profileBio.textContent = content.hero.profileBio;
  renderTagList(profileSkills, content.hero.profileSkills);
  renderCodeLines(content.hero.profileCode);

  if (aboutHeading) aboutHeading.textContent = content.about.heading;
  if (aboutIntro) aboutIntro.textContent = content.about.intro;
  if (aboutSummaryTitle) aboutSummaryTitle.textContent = content.about.summaryTitle;
  if (aboutSummaryBody) aboutSummaryBody.textContent = content.about.summaryBody;
  renderAboutHighlights(content.about.highlights);
  renderSkillCards(aboutSkills, content.about.skills);

  if (experienceHeading) experienceHeading.textContent = content.experience.heading;
  renderContentCards(experienceGrid, content.experience.items, "project");

  if (projectsHeading) projectsHeading.textContent = content.projects.heading;
  if (projectsIntro) projectsIntro.textContent = content.projects.intro;
  renderContentCards(projectsGrid, content.projects.items, "project");

  if (servicesHeading) servicesHeading.textContent = content.services.heading;
  renderContentCards(servicesGrid, content.services.items, "service");

  if (toolkitHeading) toolkitHeading.textContent = content.toolkit.heading;
  renderTagList(toolkitList, content.toolkit.items);
  if (beyondTitle) beyondTitle.textContent = content.toolkit.beyondTitle;
  if (beyondBody) beyondBody.textContent = content.toolkit.beyondBody;
  renderTagList(interestsList, content.toolkit.interests);

  if (opportunityTag) opportunityTag.textContent = content.opportunity.tag;
  if (opportunityHeading) opportunityHeading.textContent = content.opportunity.heading;
  if (opportunityButton) opportunityButton.textContent = content.opportunity.buttonText;

  if (contactHeading) contactHeading.textContent = content.contact.heading;
  if (contactIntro) contactIntro.textContent = content.contact.intro;
  if (contactPhone) contactPhone.textContent = content.contact.phone;
  if (contactAddress) contactAddress.textContent = content.contact.address;
  updateEmailLinks(content.contact.email, content.identity.emailSubject);
  updateResumeLinks(content.resume);

  resetTypingWords(content.hero.focusedOn);
  observeRevealTargets();
}

function createGradientSpan(text) {
  const span = document.createElement("span");
  span.className = "gradient-text";
  span.textContent = text;
  return span;
}

function renderStats(stats) {
  if (!heroStats) return;

  heroStats.innerHTML = "";

  stats.forEach((item) => {
    const card = document.createElement("div");
    card.className = "stat-card glass reveal";

    const value = document.createElement("h3");
    value.textContent = item.value;

    const label = document.createElement("p");
    label.textContent = item.label;

    card.append(value, label);
    heroStats.appendChild(card);
  });
}

function renderTagList(container, items) {
  if (!container) return;

  container.innerHTML = "";

  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.textContent = item;
    container.appendChild(chip);
  });
}

function renderCodeLines(lines) {
  if (!profileCode) return;

  profileCode.innerHTML = "";

  lines.forEach((line, index) => {
    const row = document.createElement("p");
    row.textContent = line;

    if (index === lines.length - 1) {
      row.className = "accent-line";
    }

    profileCode.appendChild(row);
  });
}

function renderAboutHighlights(items) {
  if (!aboutHighlights) return;

  aboutHighlights.innerHTML = "";

  items.forEach((item) => {
    const wrapper = document.createElement("div");
    const title = document.createElement("strong");
    const text = document.createElement("span");

    title.textContent = item.title;
    text.textContent = item.text;

    wrapper.append(title, text);
    aboutHighlights.appendChild(wrapper);
  });
}

function renderSkillCards(container, items) {
  if (!container) return;

  container.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "skill-card glass reveal";

    const icon = document.createElement("div");
    icon.className = "skill-icon";
    icon.textContent = item.icon;

    const title = document.createElement("h3");
    title.textContent = item.title;

    const description = document.createElement("p");
    description.textContent = item.description;

    card.append(icon, title, description);
    container.appendChild(card);
  });
}

function renderContentCards(container, items, type) {
  if (!container) return;

  container.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = `${type}-card glass reveal`;

    if (type === "project" && item.id) {
      card.id = item.id;
    }

    const number = document.createElement("span");
    number.className = type === "service" ? "service-icon" : "project-number";
    number.textContent = item.number;

    const title = document.createElement("h3");
    title.textContent = item.title;

    const description = document.createElement("p");
    description.textContent = item.description;

    const link = document.createElement("a");
    link.className = "card-btn";
    link.href = item.linkUrl || "#contact";
    link.textContent = item.linkLabel || "Learn More";

    if (item.openInNewTab) {
      link.target = "_blank";
      link.rel = "noreferrer";
    }

    card.append(number, title, description, link);
    container.appendChild(card);
  });
}

function updateEmailLinks(email, subject) {
  const gmailLink = buildGmailLink(email, subject);

  if (contactEmailLink) {
    contactEmailLink.href = gmailLink;
  }

  if (contactEmailText) {
    contactEmailText.textContent = email;
  }

  if (footerEmailLink) {
    footerEmailLink.href = gmailLink;
  }

  if (footerEmailText) {
    footerEmailText.textContent = "Email Me";
  }
}

function buildGmailLink(email, subject) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}`;
}

function updateResumeLinks(resume) {
  if (resumeButton) {
    resumeButton.href = resume.href;
    resumeButton.textContent = resume.buttonLabel;
  }

  if (resumeLink) {
    resumeLink.href = resume.href;
    resumeLink.textContent = resume.linkLabel;
  }
}

function resetTypingWords(nextWords) {
  typingWords = Array.isArray(nextWords) && nextWords.length ? [...nextWords] : [...typingWords];
  wordIndex = 0;
  charIndex = 0;
  deleting = false;

  if (typingTimer) {
    clearTimeout(typingTimer);
  }

  runTypingEffect();
}

function runTypingEffect() {
  if (!typingText || !typingWords.length) return;

  const currentWord = typingWords[wordIndex];
  typingText.textContent = currentWord.substring(0, charIndex);

  if (!deleting && charIndex < currentWord.length) {
    charIndex += 1;
    typingTimer = setTimeout(runTypingEffect, 80);
  } else if (deleting && charIndex > 0) {
    charIndex -= 1;
    typingTimer = setTimeout(runTypingEffect, 45);
  } else {
    deleting = !deleting;

    if (!deleting) {
      wordIndex = (wordIndex + 1) % typingWords.length;
    }

    typingTimer = setTimeout(runTypingEffect, deleting ? 1200 : 300);
  }
}

function updateScrollProgress() {
  if (!scrollProgress) return;

  const scrollTop = window.scrollY;
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
  scrollProgress.style.width = `${progress}%`;
}

function updateActiveNav() {
  if (!navAnchors.length) return;

  const sections = navAnchors
    .map((anchor) => document.querySelector(anchor.getAttribute("href")))
    .filter(Boolean);

  let currentId = "";

  sections.forEach((section) => {
    const top = section.offsetTop - 140;
    const bottom = top + section.offsetHeight;

    if (window.scrollY >= top && window.scrollY < bottom) {
      currentId = section.id;
    }
  });

  navAnchors.forEach((anchor) => {
    const isActive = anchor.getAttribute("href") === `#${currentId}`;
    anchor.classList.toggle("is-active", isActive);
  });
}
