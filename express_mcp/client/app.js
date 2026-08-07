const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const chatHistory = document.getElementById("chatHistory");

// Auth Elements
const authStatus = document.getElementById("authStatus");
const authBtn = document.getElementById("authBtn");
const loginModal = document.getElementById("loginModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");
const quickDevLoginBtn = document.getElementById("quickDevLoginBtn");

let token = localStorage.getItem("jwt_token") || null;
let userEmail = localStorage.getItem("user_email") || null;

function updateAuthUI() {
  if (token) {
    authStatus.textContent = `Logged in as ${userEmail || "User"}`;
    authStatus.classList.add("logged-in");
    authBtn.textContent = "Logout";
    authBtn.classList.add("logout");
  } else {
    authStatus.textContent = "Guest Mode";
    authStatus.classList.remove("logged-in");
    authBtn.textContent = "Login";
    authBtn.classList.remove("logout");
  }
}

// Initial UI setup
updateAuthUI();

// Auth Event Listeners
authBtn.addEventListener("click", () => {
  if (token) {
    // Logout
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user_email");
    token = null;
    userEmail = null;
    updateAuthUI();
    addMessage("🔒 Logged out successfully. Reverted to Guest Mode.", "system");
  } else {
    // Open Login Modal
    loginError.classList.add("hidden");
    loginModal.classList.remove("hidden");
  }
});

closeModalBtn.addEventListener("click", () => {
  loginModal.classList.add("hidden");
});

loginModal.addEventListener("click", (e) => {
  if (e.target === loginModal) {
    loginModal.classList.add("hidden");
  }
});

// Submit Login Form
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  loginError.classList.add("hidden");

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      loginError.textContent = data.error || "Login failed";
      loginError.classList.remove("hidden");
      return;
    }

    token = data.token;
    userEmail = email;
    localStorage.setItem("jwt_token", token);
    localStorage.setItem("user_email", userEmail);
    updateAuthUI();
    loginModal.classList.add("hidden");
    addMessage(`✅ Successfully logged in as <strong>${userEmail}</strong>! You now have access to authenticated user tools and database records.`, "system", false, true);
  } catch (err) {
    loginError.textContent = `Connection error: ${err.message}`;
    loginError.classList.remove("hidden");
  }
});

// Quick Dev Login
quickDevLoginBtn.addEventListener("click", async () => {
  loginError.classList.add("hidden");
  try {
    const res = await fetch("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "dev-admin-1",
        email: "admin@example.com",
        role: "admin",
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      loginError.textContent = data.error || "Dev login failed";
      loginError.classList.remove("hidden");
      return;
    }

    token = data.token;
    userEmail = "admin@example.com";
    localStorage.setItem("jwt_token", token);
    localStorage.setItem("user_email", userEmail);
    updateAuthUI();
    loginModal.classList.add("hidden");
    addMessage(`🚀 Quick Dev Login successful! Authenticated as <strong>${userEmail}</strong>.`, "system", false, true);
  } catch (err) {
    loginError.textContent = `Connection error: ${err.message}`;
    loginError.classList.remove("hidden");
  }
});

function renderMarkdownTable(text) {
  if (!text.includes("|")) return null;
  const lines = text.trim().split("\n");
  const tableLines = lines.filter(line => line.trim().startsWith("|"));
  
  if (tableLines.length < 2) return null;

  const parseRow = (line) => line.split("|").slice(1, -1).map(c => c.trim());
  const headerCols = parseRow(tableLines[0]);
  const bodyRows = tableLines.slice(2).map(parseRow);

  let html = `<div class="table-wrapper"><table class="mcp-table"><thead><tr>`;
  headerCols.forEach(col => {
    html += `<th>${col.replace(/\*\*/g, '')}</th>`;
  });
  html += `</tr></thead><tbody>`;

  bodyRows.forEach(row => {
    html += `<tr>`;
    row.forEach(col => {
      let cellText = col;
      cellText = cellText.replace(/`([^`]+)`/g, '<code>$1</code>');
      cellText = cellText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      html += `<td>${cellText}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  
  const nonTableText = lines.filter(line => !line.trim().startsWith("|")).join("<br/>")
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  return `<div class="markdown-table-container">${nonTableText ? `<div style="margin-bottom: 10px;">${nonTableText}</div>` : ''}${html}</div>`;
}

function addMessage(text, sender, isJson = false, isHtml = false) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", sender);

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");

  if (isJson) {
    const pre = document.createElement("pre");
    pre.textContent = text;
    bubble.appendChild(pre);
  } else if (isHtml) {
    bubble.innerHTML = text;
  } else {
    const tableHtml = renderMarkdownTable(text);
    if (tableHtml) {
      bubble.innerHTML = tableHtml;
    } else {
      bubble.textContent = text;
    }
  }

  msgDiv.appendChild(bubble);
  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function addTypingIndicator() {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", "assistant");
  msgDiv.id = "typingIndicator";

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");

  const indicator = document.createElement("div");
  indicator.classList.add("typing-indicator");
  indicator.innerHTML = "<span></span><span></span><span></span>";

  bubble.appendChild(indicator);
  msgDiv.appendChild(bubble);
  chatHistory.appendChild(msgDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById("typingIndicator");
  if (indicator) {
    indicator.remove();
  }
}

function getCommandsListHtml() {
  return `
    <strong>📋 Available Commands & MCP Tools:</strong>
    <ul style="margin: 8px 0 0 16px; padding: 0; line-height: 1.6;">
      <li><code>/login &lt;email&gt; &lt;password&gt;</code> - Log in directly from chat</li>
      <li><code>/logout</code> - Log out of current session</li>
      <li><code>/help</code> - Show this list of all available commands</li>
      <li><code>/add &lt;a&gt; &lt;b&gt;</code> - Add two numbers (e.g. <code>/add 25 17</code>)</li>
      <li><code>/get_all_users</code> or <code>List all users</code> - Fetch user database records (Requires login)</li>
    </ul>
  `;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  addMessage(text, "user");
  messageInput.value = "";

  const lowerText = text.toLowerCase();
  
  // Handle slash commands
  if (lowerText === "/command" || lowerText === "/commands" || lowerText === "/help") {
    addMessage(getCommandsListHtml(), "assistant", false, true);
    return;
  }

  if (lowerText === "/logout") {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user_email");
    token = null;
    userEmail = null;
    updateAuthUI();
    addMessage("🔒 Logged out successfully.", "system");
    return;
  }

  if (lowerText.startsWith("/login ")) {
    const parts = text.split(" ");
    const email = parts[1];
    const password = parts[2] || "password123";
    if (!email) {
      addMessage("Usage: <code>/login admin@example.com password123</code>", "system", false, true);
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        addMessage(`Login error: ${data.error || "Failed to log in"}`, "system");
        return;
      }
      token = data.token;
      userEmail = email;
      localStorage.setItem("jwt_token", token);
      localStorage.setItem("user_email", userEmail);
      updateAuthUI();
      addMessage(`✅ Logged in as <strong>${userEmail}</strong>!`, "system", false, true);
    } catch (err) {
      addMessage(`Login connection error: ${err.message}`, "system");
    }
    return;
  }

  addTypingIndicator();

  try {
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({ message: text }),
    });

    const rawText = await response.text();
    removeTypingIndicator();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      addMessage(`Server Error (${response.status}): ${rawText || "Server is starting up or disconnected."}`, "system");
      return;
    }

    if (data.error) {
      addMessage(`Error: ${data.error}`, "system");
    } else {
      if (data.content && data.content.length > 0) {
        data.content.forEach((c) => {
          if (c.type === "text") {
            try {
              const parsed = JSON.parse(c.text);
              addMessage(JSON.stringify(parsed, null, 2), "assistant", true);
            } catch {
              addMessage(c.text, "assistant");
            }
          }
        });
      } else {
        addMessage(JSON.stringify(data), "assistant", true);
      }
    }
  } catch (err) {
    removeTypingIndicator();
    addMessage(`Failed to connect to server: ${err.message}`, "system");
  }
});
