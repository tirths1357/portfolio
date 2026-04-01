const loginForm = document.getElementById("siteLoginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginNote = document.getElementById("loginNote");

initializeLogin();

async function initializeLogin() {
  clearLoginFields();

  window.addEventListener("pageshow", clearLoginFields);

  if (isVercelDeployment()) {
    setLoginNote(
      "This Vercel deployment supports the public portfolio and contact form. Admin editing needs Railway or another backend with persistent storage.",
      "is-error"
    );

    if (loginEmail) {
      loginEmail.disabled = true;
    }

    if (loginPassword) {
      loginPassword.disabled = true;
    }

    const submitButton = loginForm ? loginForm.querySelector('button[type=\"submit\"]') : null;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Unavailable On Vercel";
    }

    return;
  }

  try {
    const response = await fetch("/api/admin/session");

    if (!response.ok) {
      return;
    }

    const session = await response.json();

    if (session.authRequired && session.authenticated) {
      window.location.replace("/admin.html");
      return;
    }

    if (!session.authRequired) {
      setLoginNote(
        "Admin email and password are not configured yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to protect this page.",
        "is-success"
      );
    }
  } catch (_error) {
    setLoginNote("Unable to connect to the admin service.", "is-error");
  }
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    setLoginNote("Opening dashboard...", "");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: loginEmail ? loginEmail.value : "",
          password: loginPassword ? loginPassword.value : ""
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Login failed.");
      }

      window.location.replace("/admin.html");
    } catch (error) {
      setLoginNote(error.message || "Login failed.", "is-error");
    }
  });
}

function setLoginNote(text, stateClass) {
  if (!loginNote) return;

  loginNote.textContent = text;
  loginNote.className = "admin-note";

  if (stateClass) {
    loginNote.classList.add(stateClass);
  }
}

function clearLoginFields() {
  if (loginEmail) {
    loginEmail.value = "";
  }

  if (loginPassword) {
    loginPassword.value = "";
  }
}

function isVercelDeployment() {
  return window.location.hostname.endsWith("vercel.app");
}
