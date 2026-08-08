/**
 * @file app.js
 * @description Frontend JavaScript controller for the Nest MCP Web Client.
 */

// ─── State Management ────────────────────────────────────────────────────────
const state = {
  token: localStorage.getItem('nest_mcp_token') || null,
  user: JSON.parse(localStorage.getItem('nest_mcp_user') || 'null'),
  tools: [],
  messages: [],
  isThinking: false,
  promptHistory: JSON.parse(
    localStorage.getItem('nest_mcp_prompt_history') || '[]',
  ),
  historyIndex: -1,
  currentDraft: '',
  activeAbortController: null,
};

// ─── DOM Element References ──────────────────────────────────────────────────
const elements = {
  // Navigation & Header
  serverStatusPill: document.getElementById('serverStatusPill'),
  serverStatusText: document.getElementById('serverStatusText'),
  modelName: document.getElementById('modelName'),
  usagePill: document.getElementById('usagePill'),
  usageStatusText: document.getElementById('usageStatusText'),
  toggleToolsBtn: document.getElementById('toggleToolsBtn'),
  toolsCountBadge: document.getElementById('toolsCountBadge'),
  userProfile: document.getElementById('userProfile'),
  userAvatar: document.getElementById('userAvatar'),
  userName: document.getElementById('userName'),
  userRole: document.getElementById('userRole'),
  openLoginBtn: document.getElementById('openLoginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),

  // Sidebar
  toolsSidebar: document.getElementById('toolsSidebar'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  toolSearchInput: document.getElementById('toolSearchInput'),
  toolsList: document.getElementById('toolsList'),

  // Chat
  chatHistory: document.getElementById('chatHistory'),
  chatForm: document.getElementById('chatForm'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  stopBtn: document.getElementById('stopBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  typingIndicator: document.getElementById('typingIndicator'),
  authNotice: document.getElementById('authNotice'),
  noticeLoginBtn: document.getElementById('noticeLoginBtn'),

  // Login Modal
  loginModal: document.getElementById('loginModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  loginForm: document.getElementById('loginForm'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  loginError: document.getElementById('loginError'),

  // Containers
  toastContainer: document.getElementById('toastContainer'),
};

// ─── Helper Utilities ────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${escapeHtml(message)}</span>
  `;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMarkdown(text) {
  if (!text) return '';
  let formatted = escapeHtml(text);

  // Format code blocks ```code```
  formatted = formatted.replace(/```([\s\S]*?)```/g, (match, p1) => {
    return `<pre class="tool-execution-body"><code>${p1.trim()}</code></pre>`;
  });

  // Format inline code `code`
  formatted = formatted.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:2px 4px;border-radius:4px;font-family:var(--font-mono);font-size:12px;">$1</code>');

  // Format bold **text**
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Format line breaks
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}

function updateUsageBanner(usageText = '') {
  if (!usageText) {
    elements.usagePill.classList.add('hidden');
    return;
  }
  // Strip outer brackets and "Usage:" prefix if present
  const cleaned = usageText.replace(/^\[?Usage:\s*/i, '').replace(/\]$/, '').trim();
  elements.usageStatusText.textContent = cleaned;
  elements.usagePill.classList.remove('hidden');
}

// ─── Authentication API & UI ────────────────────────────────────────────────
function updateAuthUI() {
  if (state.token && state.user) {
    elements.userProfile.classList.remove('hidden');
    elements.openLoginBtn.classList.add('hidden');
    if (elements.authNotice) elements.authNotice.classList.add('hidden');

    elements.userAvatar.textContent = (state.user.firstName || state.user.email || 'A')[0].toUpperCase();
    elements.userName.textContent = state.user.firstName ? `${state.user.firstName} ${state.user.lastName || ''}`.trim() : state.user.email;
    elements.userRole.textContent = (state.user.role || 'USER').toUpperCase();
  } else {
    elements.userProfile.classList.add('hidden');
    elements.openLoginBtn.classList.remove('hidden');
    if (elements.authNotice) elements.authNotice.classList.remove('hidden');
  }
}

async function login(email, password) {
  try {
    elements.loginError.classList.add('hidden');
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    let data;
    const responseText = await res.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { message: responseText || 'Login failed' };
    }

    if (!res.ok) {
      throw new Error(
        Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message || 'Login failed. Please check credentials.',
      );
    }

    state.token = data.accessToken;
    state.user = data.user;

    localStorage.setItem('nest_mcp_token', state.token);
    localStorage.setItem('nest_mcp_user', JSON.stringify(state.user));

    updateAuthUI();
    closeLoginModal();
    showToast(`Welcome back, ${state.user.firstName || 'User'}!`, 'success');

    // Fetch tools now that we are authenticated
    fetchTools();
  } catch (err) {
    elements.loginError.textContent = err.message;
    elements.loginError.classList.remove('hidden');
  }
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('nest_mcp_token');
  localStorage.removeItem('nest_mcp_user');
  updateAuthUI();
  showToast('Logged out successfully', 'info');
}

function openLoginModal() {
  elements.loginModal.classList.remove('hidden');
}

function closeLoginModal() {
  elements.loginModal.classList.add('hidden');
  elements.loginError.classList.add('hidden');
}

// ─── Tools Sidebar API & UI ──────────────────────────────────────────────────
async function fetchTools() {
  try {
    const headers = {};
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    const res = await fetch('/api/v1/mcp/tools', { headers });
    if (!res.ok) {
      if (res.status === 401) {
        setServerStatus('Unauthorized', 'offline');
        elements.toolsList.innerHTML =
          '<div class="loading-state">Please log in to view MCP tools.</div>';
        return;
      }
      throw new Error('Failed to load MCP tools');
    }

    let data;
    const responseText = await res.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { tools: [] };
    }
    state.tools = data.tools || [];
    elements.toolsCountBadge.textContent = state.tools.length;
    renderToolsList(state.tools);
    setServerStatus('MCP Online', 'online');
  } catch (err) {
    console.error('Fetch tools error:', err);
    elements.toolsList.innerHTML = `<div class="loading-state" style="color:var(--accent-rose)">${escapeHtml(err.message)}</div>`;
    setServerStatus('Server Error', 'offline');
  }
}

function renderToolsList(tools) {
  if (!tools || tools.length === 0) {
    elements.toolsList.innerHTML = '<div class="loading-state">No MCP tools found</div>';
    return;
  }

  elements.toolsList.innerHTML = tools
    .map(
      (tool) => `
    <div class="tool-card">
      <div class="tool-name">🛠️ ${escapeHtml(tool.name)}</div>
      <div class="tool-desc">${escapeHtml(tool.description)}</div>
    </div>
  `
    )
    .join('');
}

function setServerStatus(text, statusClass) {
  elements.serverStatusText.textContent = text;
  elements.serverStatusPill.className = `status-pill ${statusClass}`;
}

// ─── Chat Logic ─────────────────────────────────────────────────────────────
function appendMessage(role, text, metadata = {}) {
  // Hide welcome hero on first message
  const welcomeHero = elements.chatHistory.querySelector('.welcome-hero');
  if (welcomeHero) {
    welcomeHero.style.display = 'none';
  }

  const row = document.createElement('div');
  row.className = `message-row ${role === 'user' ? 'user-row' : 'ai-row'}`;

  const avatarText = role === 'user' ? (state.user ? (state.user.firstName || 'U')[0] : 'U') : '🤖';

  let footerHtml = '';
  if (role === 'ai' && (metadata.processingTimeMs || metadata.model)) {
    footerHtml = `
      <div class="msg-footer">
        ${metadata.model ? `<span class="metric-tag">⚡ ${escapeHtml(metadata.model)}</span>` : ''}
        ${metadata.processingTimeMs ? `<span class="metric-tag">⏱️ ${metadata.processingTimeMs}ms</span>` : ''}
      </div>
    `;
  }

  let actionButtonsHtml = '';
  if (role === 'ai') {
    const buttons = [];

    if (text.includes('🔒 Authentication Required:')) {
      buttons.push('<button class="btn btn-primary btn-sm chat-login-btn">🔑 Sign In to Execute Database Commands</button>');
    } else if (text.includes('🚫 Permission Denied:')) {
      buttons.push('<button class="btn btn-warning btn-sm chat-login-btn">🔑 Switch Account (Elevated Role)</button>');
    }

    if (text.includes('📋 Payload Confirmation Required:')) {
      buttons.push('<button class="btn btn-primary btn-sm chat-action-chip" data-prompt="Confirm creation with confirm: true">✅ Confirm Creation</button>');
    }

    // Interactive Pagination Buttons (Previous & Next Page)
    const pageInfoMatch = text.match(/📌 Page (\d+) of (\d+)/i);
    const categoryMatch = text.match(/\b(users|tasks|comments)\b/i);
    if (pageInfoMatch) {
      const currentPage = parseInt(pageInfoMatch[1], 10);
      const totalPages = parseInt(pageInfoMatch[2], 10);
      const category = categoryMatch
        ? categoryMatch[1].toLowerCase()
        : 'users';

      if (currentPage > 1) {
        buttons.push(
          `<button class="btn btn-secondary btn-sm chat-action-chip" data-prompt="show page ${currentPage - 1} of ${category}">◀ Previous Page (${currentPage - 1})</button>`,
        );
      }
      if (currentPage < totalPages) {
        buttons.push(
          `<button class="btn btn-primary btn-sm chat-action-chip" data-prompt="show page ${currentPage + 1} of ${category}">▶ Next Page (${currentPage + 1})</button>`,
        );
      }
    }

    if (buttons.length > 0) {
      actionButtonsHtml = `
        <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
          ${buttons.join('')}
        </div>
      `;
    }
  }

  row.innerHTML = `
    <div class="msg-avatar">${avatarText}</div>
    <div class="msg-bubble">
      <div>${formatMarkdown(text)}</div>
      ${actionButtonsHtml}
      ${footerHtml}
    </div>
  `;

  elements.chatHistory.appendChild(row);
  elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
}

async function sendMessage(messageText) {
  if (!messageText.trim() || state.isThinking) return;

  const trimmedPrompt = messageText.trim();

  // Save prompt to history in LocalStorage
  if (
    state.promptHistory.length === 0 ||
    state.promptHistory[state.promptHistory.length - 1] !== trimmedPrompt
  ) {
    state.promptHistory.push(trimmedPrompt);
    if (state.promptHistory.length > 50) state.promptHistory.shift();
    localStorage.setItem(
      'nest_mcp_prompt_history',
      JSON.stringify(state.promptHistory),
    );
  }

  // Reset history navigation index
  state.historyIndex = -1;
  state.currentDraft = '';

  // Clear input
  elements.messageInput.value = '';
  elements.messageInput.style.height = 'auto';

  // Add User message
  appendMessage('user', trimmedPrompt);

  // Set typing & stop button state
  state.isThinking = true;
  state.activeAbortController = new AbortController();
  elements.typingIndicator.classList.remove('hidden');
  elements.sendBtn.classList.add('hidden');
  elements.stopBtn.classList.remove('hidden');

  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    const res = await fetch('/api/v1/mcp/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: trimmedPrompt }),
      signal: state.activeAbortController.signal,
    });

    let data;
    const responseText = await res.text();
    try {
      data = JSON.parse(responseText);
    } catch {
      data = {
        message:
          responseText ||
          `HTTP ${res.status}: ${res.statusText || 'Server Error'}`,
      };
    }

    if (!res.ok) {
      const errMsg = Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message || `Server returned ${res.status}`;
      throw new Error(errMsg);
    }

    if (data.model) {
      elements.modelName.textContent = data.model;
    }

    let aiMessageText = data.response || '';
    const usageMatch = aiMessageText.match(/^\[Usage:([^\]]+)\]\s*\n\s*/i);
    if (usageMatch) {
      updateUsageBanner(usageMatch[1]);
      aiMessageText = aiMessageText.replace(/^\[Usage:[^\]]+\]\s*\n\s*/i, '');
    }

    appendMessage('ai', aiMessageText, {
      processingTimeMs: data.processingTimeMs,
      model: data.model,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      appendMessage('ai', '⏹️ *Response generation was stopped.*');
      showToast('Generation stopped', 'info');
    } else {
      appendMessage('ai', `⚠️ **Error:** ${err.message}`);
      showToast(err.message, 'error');
    }
  } finally {
    state.isThinking = false;
    state.activeAbortController = null;
    elements.typingIndicator.classList.add('hidden');
    elements.stopBtn.classList.add('hidden');
    elements.sendBtn.classList.remove('hidden');
  }
}

// ─── Event Listeners ────────────────────────────────────────────────────────
function setupEventListeners() {
  // Toggle Sidebar
  elements.toggleToolsBtn.addEventListener('click', () => {
    elements.toolsSidebar.classList.toggle('collapsed');
  });

  elements.closeSidebarBtn.addEventListener('click', () => {
    elements.toolsSidebar.classList.add('collapsed');
  });

  // Search Tools
  elements.toolSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = state.tools.filter(
      (t) => t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)
    );
    renderToolsList(filtered);
  });

  // Auth Modals
  elements.openLoginBtn.addEventListener('click', openLoginModal);
  if (elements.noticeLoginBtn) elements.noticeLoginBtn.addEventListener('click', openLoginModal);
  elements.closeModalBtn.addEventListener('click', closeLoginModal);
  elements.logoutBtn.addEventListener('click', logout);

  // Form Login
  elements.loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    login(elements.emailInput.value, elements.passwordInput.value);
  });

  // Quick Dev Login Buttons
  document.querySelectorAll('.quick-login-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const email = btn.getAttribute('data-email');
      const pass = btn.getAttribute('data-pass');
      login(email, pass);
    });
  });

  // Chat Form Submit & Stop
  elements.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(elements.messageInput.value);
  });

  elements.stopBtn.addEventListener('click', () => {
    if (state.activeAbortController) {
      state.activeAbortController.abort();
    }
  });

  // Textarea enter key handling, arrow keys for prompt history & auto-height
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      elements.chatForm.dispatchEvent(new Event('submit'));
    } else if (e.key === 'ArrowUp') {
      const cursorAtStart =
        elements.messageInput.selectionStart === 0 &&
        elements.messageInput.selectionEnd === 0;
      if (cursorAtStart && state.promptHistory.length > 0) {
        e.preventDefault();
        if (state.historyIndex === -1) {
          state.currentDraft = elements.messageInput.value;
        }
        if (state.historyIndex < state.promptHistory.length - 1) {
          state.historyIndex++;
          const targetPrompt =
            state.promptHistory[
              state.promptHistory.length - 1 - state.historyIndex
            ];
          elements.messageInput.value = targetPrompt;
          elements.messageInput.style.height = 'auto';
          elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 140)}px`;
        }
      }
    } else if (e.key === 'ArrowDown') {
      const cursorAtEnd =
        elements.messageInput.selectionStart ===
        elements.messageInput.value.length;
      if (cursorAtEnd && state.historyIndex >= 0) {
        e.preventDefault();
        state.historyIndex--;
        if (state.historyIndex === -1) {
          elements.messageInput.value = state.currentDraft;
        } else {
          const targetPrompt =
            state.promptHistory[
              state.promptHistory.length - 1 - state.historyIndex
            ];
          elements.messageInput.value = targetPrompt;
        }
        elements.messageInput.style.height = 'auto';
        elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 140)}px`;
      }
    }
  });

  elements.messageInput.addEventListener('input', () => {
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 140)}px`;
  });

  // Clear Chat
  elements.clearChatBtn.addEventListener('click', () => {
    const welcomeHero = elements.chatHistory.querySelector('.welcome-hero');
    elements.chatHistory.innerHTML = '';
    if (welcomeHero) {
      welcomeHero.style.display = 'block';
      elements.chatHistory.appendChild(welcomeHero);
    }
    showToast('Chat history cleared', 'info');
  });

  // Prompt Chips, Pagination Action Chips & Chat Login Button
  document.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    if (
      target.classList.contains('prompt-chip') ||
      target.classList.contains('chat-action-chip')
    ) {
      const promptText =
        target.getAttribute('data-prompt') || target.textContent.trim();
      sendMessage(promptText);
    } else if (target.classList.contains('chat-login-btn')) {
      openLoginModal();
    }
  });
}

// ─── Initialization ──────────────────────────────────────────────────────────
async function init() {
  updateAuthUI();
  setupEventListeners();
  await fetchTools();
}

document.addEventListener('DOMContentLoaded', init);
