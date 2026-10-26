/**
 * InsForge RAG Chat - Cliente Frontend
 * Conexión directa a los endpoints de InsForge (/ingest y /ask),
 * soporte para carga y vectorización de múltiples archivos,
 * y persistencia limpia sin datos ficticios.
 */

// ==========================================
// 1. CONFIGURACIÓN DE ENDPOINTS
// ==========================================
const RAG_CONFIG = {
  INGEST_URL: 'https://d267y6sx.function2.insforge.app/ingest',
  ASK_URL: 'https://d267y6sx.function2.insforge.app/ask',
  STORAGE_KEY: 'insforge_rag_conversations_v2',
  THEME_KEY: 'insforge_rag_theme'
};

// ==========================================
// 2. ESTADO DE LA APLICACIÓN (SIN DATOS DE PRUEBA)
// ==========================================
let appState = {
  chats: loadStoredChats(),
  activeChatId: null,
  isProcessing: false,
  searchTerm: '',
  attachedFiles: [] // Archivos seleccionados para ingesta
};

// ==========================================
// 3. ELEMENTOS DEL DOM
// ==========================================
const elements = {
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebarBackdrop'),
  sidebarToggleCollapse: document.getElementById('sidebarToggleCollapse'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  btnNewChat: document.getElementById('btnNewChat'),
  chatHistoryNav: document.getElementById('chatHistoryNav'),
  searchInput: document.getElementById('searchInput'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  docsCountBadge: document.getElementById('docsCountBadge'),
  
  btnUploadHeader: document.getElementById('btnUploadHeader'),
  btnClearCurrentChat: document.getElementById('btnClearCurrentChat'),

  chatScrollArea: document.getElementById('chatScrollArea'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  chatThread: document.getElementById('chatThread'),
  suggestionCards: document.querySelectorAll('.suggestion-card'),

  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  btnSubmit: document.getElementById('btnSubmit'),
  btnAttach: document.getElementById('btnAttach'),
  fileInput: document.getElementById('fileInput'),
  attachedFilesBar: document.getElementById('attachedFilesBar'),
  dropZoneBox: document.getElementById('dropZoneBox')
};

// ==========================================
// 4. PERSISTENCIA LIMPIA
// ==========================================
function loadStoredChats() {
  try {
    // Limpiar claves antiguas con datos falsos de prueba si existieran
    localStorage.removeItem('chatgpt_ui_conversations_v1');

    const raw = localStorage.getItem(RAG_CONFIG.STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('No se pudo acceder al almacenamiento local:', err);
  }
  return []; // Lista vacía sin mocks
}

function saveChats() {
  try {
    localStorage.setItem(RAG_CONFIG.STORAGE_KEY, JSON.stringify(appState.chats));
  } catch (err) {
    console.warn('Error al guardar conversaciones:', err);
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem(RAG_CONFIG.THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem(RAG_CONFIG.THEME_KEY, next);
  } catch (e) {}
}

// ==========================================
// 5. GESTIÓN DE ARCHIVOS ADJUNTOS
// ==========================================
function handleFilesSelected(fileList) {
  if (!fileList || fileList.length === 0) return;

  const filesArray = Array.from(fileList);
  // Evitar duplicados por nombre y tamaño
  filesArray.forEach(newFile => {
    const exists = appState.attachedFiles.some(f => f.name === newFile.name && f.size === newFile.size);
    if (!exists) {
      appState.attachedFiles.push(newFile);
    }
  });

  renderAttachedFiles();
  updateSubmitButtonState();
  elements.fileInput.value = ''; // Reset input para permitir volver a seleccionar el mismo si se quitó
}

function removeAttachedFile(index) {
  appState.attachedFiles.splice(index, 1);
  renderAttachedFiles();
  updateSubmitButtonState();
}

function renderAttachedFiles() {
  const bar = elements.attachedFilesBar;
  if (appState.attachedFiles.length === 0) {
    bar.style.display = 'none';
    bar.innerHTML = '';
    return;
  }

  bar.style.display = 'flex';
  bar.innerHTML = '';

  appState.attachedFiles.forEach((file, index) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8;">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      <span class="file-chip-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
      <span class="file-chip-size">(${formatFileSize(file.size)})</span>
      <button type="button" class="btn-remove-chip" title="Eliminar archivo" aria-label="Eliminar archivo">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    chip.querySelector('.btn-remove-chip').addEventListener('click', (e) => {
      e.stopPropagation();
      removeAttachedFile(index);
    });

    bar.appendChild(chip);
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ==========================================
// 6. GESTIÓN DEL HISTORIAL Y CHATS
// ==========================================
function getActiveChat() {
  return appState.chats.find(c => c.id === appState.activeChatId);
}

function createNewChat() {
  appState.activeChatId = null;
  renderSidebarHistory();
  renderChatView();
  closeMobileSidebar();
  elements.chatInput.focus();
}

function selectChat(chatId) {
  appState.activeChatId = chatId;
  renderSidebarHistory();
  renderChatView();
  closeMobileSidebar();
}

function deleteChat(chatId, event) {
  if (event) event.stopPropagation();
  appState.chats = appState.chats.filter(c => c.id !== chatId);
  if (appState.activeChatId === chatId) {
    appState.activeChatId = null;
  }
  saveChats();
  renderSidebarHistory();
  renderChatView();
}

function renderSidebarHistory() {
  const container = elements.chatHistoryNav;
  container.innerHTML = '';

  const query = appState.searchTerm.toLowerCase().trim();
  const filtered = appState.chats.filter(c => 
    !query || c.title.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = 'padding: 16px 12px; font-size: 13px; color: var(--text-muted); text-align: center;';
    emptyMsg.textContent = query ? 'No se encontraron conversaciones' : 'Sin chats recientes';
    container.appendChild(emptyMsg);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'history-list';

  filtered.forEach(chat => {
    const item = document.createElement('li');
    item.className = `history-item ${chat.id === appState.activeChatId ? 'active' : ''}`;
    
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'history-link';
    link.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; opacity: 0.7;">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="history-title">${escapeHtml(chat.title)}</span>
    `;

    link.addEventListener('click', (e) => {
      e.preventDefault();
      selectChat(chat.id);
    });

    const actions = document.createElement('div');
    actions.className = 'history-actions';
    actions.innerHTML = `
      <button type="button" class="btn-history-action btn-delete-chat" title="Eliminar chat" aria-label="Eliminar chat">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        </svg>
      </button>
    `;

    actions.querySelector('.btn-delete-chat').addEventListener('click', (e) => {
      deleteChat(chat.id, e);
    });

    item.appendChild(link);
    item.appendChild(actions);
    list.appendChild(item);
  });

  container.appendChild(list);
}

// ==========================================
// 7. RENDERIZADO DEL CHAT
// ==========================================
function renderChatView() {
  const activeChat = getActiveChat();

  if (!activeChat || activeChat.messages.length === 0) {
    elements.welcomeScreen.classList.remove('hidden');
    elements.chatThread.innerHTML = '';
  } else {
    elements.welcomeScreen.classList.add('hidden');
    renderMessages(activeChat.messages);
  }

  scrollToBottom();
}

function renderMessages(messages) {
  elements.chatThread.innerHTML = '';
  messages.forEach(msg => {
    const row = createMessageRow(msg);
    elements.chatThread.appendChild(row);
  });
}

function createMessageRow(message) {
  const row = document.createElement('div');
  row.className = `message-row ${message.role}`;

  if (message.role === 'user') {
    let attachmentsHtml = '';
    if (message.files && message.files.length > 0) {
      attachmentsHtml = `
        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px;">
          ${message.files.map(f => `
            <span style="font-size: 11px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">
              📄 ${escapeHtml(f)}
            </span>
          `).join('')}
        </div>
      `;
    }

    row.innerHTML = `
      <div class="message-bubble">
        ${attachmentsHtml}
        ${escapeHtml(message.content)}
      </div>
    `;
  } else {
    // Rol del Asistente
    const formattedContent = parseMarkdownLike(message.content);

    // Fuentes de RAG si existen
    let sourcesHtml = '';
    if (message.sources && message.sources.length > 0) {
      sourcesHtml = `
        <div class="rag-sources-box">
          <span class="rag-sources-title">Fuentes recuperadas (pgvector):</span>
          <div class="rag-sources-tags">
            ${message.sources.map(src => `
              <span class="rag-source-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                ${escapeHtml(src)}
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }

    row.innerHTML = `
      <div class="assistant-avatar" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      </div>
      <div class="assistant-content-wrapper">
        <div class="message-text">${formattedContent}</div>
        ${sourcesHtml}
        <div class="message-actions-bar">
          <button type="button" class="btn-msg-action btn-copy-msg" title="Copiar respuesta" aria-label="Copiar respuesta">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    const copyBtn = row.querySelector('.btn-copy-msg');
    copyBtn.addEventListener('click', () => {
      copyToClipboard(message.content, copyBtn);
    });

    row.querySelectorAll('.btn-copy-code').forEach(btn => {
      btn.addEventListener('click', () => {
        const codeText = btn.closest('.code-block-container').querySelector('code').innerText;
        copyToClipboard(codeText, btn, '¡Copiado!');
      });
    });
  }

  return row;
}

// ==========================================
// 8. FLUJO COMPLETO: INGESTA Y CONSULTA RAG
// ==========================================
async function handleFormSubmit() {
  const textPrompt = elements.chatInput.value.trim();
  const filesToIngest = [...appState.attachedFiles];

  // Requiere texto o al menos un archivo
  if ((!textPrompt && filesToIngest.length === 0) || appState.isProcessing) return;

  // Asegurar chat activo
  if (!appState.activeChatId) {
    const title = textPrompt.length > 0 
      ? (textPrompt.length > 32 ? textPrompt.substring(0, 32) + '...' : textPrompt)
      : `Carga de ${filesToIngest.length} archivo(s)`;

    const newChat = {
      id: 'chat-' + Date.now(),
      title,
      updatedAt: Date.now(),
      messages: []
    };
    appState.chats.unshift(newChat);
    appState.activeChatId = newChat.id;
    saveChats();
    renderSidebarHistory();
  }

  const activeChat = getActiveChat();

  // Reset de la barra de archivos y del input
  appState.attachedFiles = [];
  renderAttachedFiles();
  elements.chatInput.value = '';
  adjustTextareaHeight();
  updateSubmitButtonState();

  // 1. Registrar mensaje del usuario en el chat
  const userMsg = {
    role: 'user',
    content: textPrompt || `Archivos adjuntos para vectorización: ${filesToIngest.map(f => f.name).join(', ')}`,
    files: filesToIngest.map(f => f.name),
    timestamp: Date.now()
  };
  activeChat.messages.push(userMsg);
  activeChat.updatedAt = Date.now();
  saveChats();
  renderChatView();

  appState.isProcessing = true;
  updateSubmitButtonState();

  // 2. Si hay archivos adjuntos, procesar la ingesta hacia /ingest
  if (filesToIngest.length > 0) {
    await processMultiFileIngestion(filesToIngest, activeChat);
  }

  // 3. Si hay una consulta de texto, enviar a /ask
  if (textPrompt) {
    await processRagQuery(textPrompt, activeChat);
  }

  appState.isProcessing = false;
  updateSubmitButtonState();
}

/**
 * Ingesta múltiples archivos en el backend de InsForge
 */
async function processMultiFileIngestion(files, chat) {
  // Insertar fila temporal de progreso en la UI
  const tempRow = document.createElement('div');
  tempRow.className = 'message-row assistant';
  tempRow.innerHTML = `
    <div class="assistant-avatar">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
    </div>
    <div class="assistant-content-wrapper">
      <div class="ingest-card">
        <div class="ingest-card-title">
          <span class="typing-dot" style="display: inline-block;"></span>
          Vectorizando ${files.length} archivo(s) en InsForge pgvector...
        </div>
        <ul class="ingest-card-list" id="ingestProgressList">
          ${files.map(f => `<li>⏳ Leyendo ${escapeHtml(f.name)}...</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
  elements.chatThread.appendChild(tempRow);
  scrollToBottom();

  const progressList = tempRow.querySelector('#ingestProgressList');
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const li = progressList.children[i];

    try {
      if (li) li.textContent = `⚡ Generando embeddings para ${file.name}...`;

      // Leer contenido de texto del archivo
      const fileText = await readFileAsText(file);

      if (!fileText.trim()) {
        if (li) li.textContent = `⚠️ ${file.name}: archivo vacío o no legible.`;
        results.push({ name: file.name, status: 'vacío', chunks: 0 });
        continue;
      }

      // Enviar al endpoint de ingesta
      const response = await fetch(RAG_CONFIG.INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fileText,
          source: file.name
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const chunkCount = data.total_chunks || (data.chunks ? data.chunks.length : 1);
        if (li) li.textContent = `✅ ${file.name}: ${chunkCount} chunks vectorizados exitosamente.`;
        results.push({ name: file.name, status: 'éxito', chunks: chunkCount });
      } else {
        if (li) li.textContent = `❌ ${file.name}: ${data.error || 'Error en el servidor'}`;
        results.push({ name: file.name, status: 'error', error: data.error });
      }
    } catch (err) {
      if (li) li.textContent = `❌ ${file.name}: ${err.message || 'Error de red'}`;
      results.push({ name: file.name, status: 'error', error: err.message });
    }
  }

  await sleep(400);

  // Mensaje final estructurado
  const successCount = results.filter(r => r.status === 'éxito').length;
  const totalChunks = results.reduce((acc, r) => acc + (r.chunks || 0), 0);

  const assistantReportMsg = {
    role: 'assistant',
    content: `### 📁 Reporte de Ingesta y Vectorización

Se procesaron **${files.length} archivo(s)** en la base de datos de InsForge:
- **Exitosos:** ${successCount} de ${files.length}
- **Total de chunks creados en pgvector:** ${totalChunks}

${results.map(r => r.status === 'éxito' 
  ? `- **${r.name}**: ✅ ${r.chunks} chunks indexados (modelo text-embedding-3-small 1536d)`
  : `- **${r.name}**: ⚠️ ${r.error || r.status}`
).join('\n')}

Los documentos ya se encuentran indexados con búsqueda por similitud de coseno. Puedes realizar cualquier pregunta sobre su contenido.`,
    timestamp: Date.now()
  };

  chat.messages.push(assistantReportMsg);
  saveChats();

  tempRow.remove();
  elements.chatThread.appendChild(createMessageRow(assistantReportMsg));
  scrollToBottom();
}

/**
 * Consulta la base de datos RAG en /ask
 */
async function processRagQuery(question, chat) {
  // Indicador de búsqueda semántica y pensamiento
  const tempRow = document.createElement('div');
  tempRow.className = 'message-row assistant';
  tempRow.innerHTML = `
    <div class="assistant-avatar">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
      </svg>
    </div>
    <div class="assistant-content-wrapper">
      <div class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  elements.chatThread.appendChild(tempRow);
  scrollToBottom();

  try {
    const response = await fetch(RAG_CONFIG.ASK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const data = await response.json();

    let answerText = '';
    let sources = [];
    let chunks = [];

    if (response.ok) {
      answerText = data.answer || 'Sin respuesta generada.';
      sources = data.sources || [];
      chunks = data.chunks || [];
    } else {
      answerText = `Error al consultar el servidor (${response.status}): ${data.error || 'Fallo desconocido'}`;
    }

    const assistantMsg = {
      role: 'assistant',
      content: answerText,
      sources,
      chunks,
      timestamp: Date.now()
    };

    chat.messages.push(assistantMsg);
    saveChats();

    tempRow.remove();
    elements.chatThread.appendChild(createMessageRow(assistantMsg));
    scrollToBottom();
  } catch (err) {
    tempRow.remove();
    const errorMsg = {
      role: 'assistant',
      content: `⚠️ No se pudo conectar con el endpoint RAG (/ask): ${err.message}. Verifica que el servicio esté en línea.`,
      timestamp: Date.now()
    };
    chat.messages.push(errorMsg);
    saveChats();
    elements.chatThread.appendChild(createMessageRow(errorMsg));
    scrollToBottom();
  }
}

/**
 * Lee el archivo como texto plano en el navegador
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo ' + file.name));
    reader.readAsText(file);
  });
}

// ==========================================
// 9. CONFIGURACIÓN DE EVENTOS
// ==========================================
function setupEventListeners() {
  // Ajuste automático de textarea
  elements.chatInput.addEventListener('input', () => {
    adjustTextareaHeight();
    updateSubmitButtonState();
  });

  // IME-safe Enter Submit
  elements.chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (event.isComposing || event.keyCode === 229) return;
      elements.chatForm.requestSubmit();
    }
  });

  // Envío del Formulario
  elements.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit();
  });

  // Botón adjuntar archivos
  elements.btnAttach.addEventListener('click', () => {
    elements.fileInput.click();
  });

  // Botón subir archivos en topbar
  elements.btnUploadHeader.addEventListener('click', () => {
    elements.fileInput.click();
  });

  // Evento change del input de archivos
  elements.fileInput.addEventListener('change', (e) => {
    handleFilesSelected(e.target.files);
  });

  // Drag and Drop de archivos sobre la caja de entrada
  const dropBox = elements.dropZoneBox;
  ['dragenter', 'dragover'].forEach(eventName => {
    dropBox.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropBox.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropBox.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropBox.classList.remove('drag-over');
    });
  });

  dropBox.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  });

  // Botón Nuevo Chat
  elements.btnNewChat.addEventListener('click', createNewChat);

  // Limpiar chat actual
  elements.btnClearCurrentChat.addEventListener('click', () => {
    const active = getActiveChat();
    if (active) {
      active.messages = [];
      saveChats();
      renderChatView();
    }
  });

  // Búsqueda en el historial
  elements.searchInput.addEventListener('input', (e) => {
    appState.searchTerm = e.target.value;
    renderSidebarHistory();
  });

  // Botones de sugerencias iniciales
  elements.suggestionCards.forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      if (prompt) {
        elements.chatInput.value = prompt;
        adjustTextareaHeight();
        updateSubmitButtonState();
        handleFormSubmit();
      }
    });
  });

  // Toggle de Tema
  elements.themeToggleBtn.addEventListener('click', toggleTheme);

  // Toggles de sidebar
  elements.sidebarToggleCollapse.addEventListener('click', () => {
    elements.sidebar.classList.toggle('collapsed');
  });

  elements.mobileMenuBtn.addEventListener('click', () => {
    elements.sidebar.classList.toggle('open');
    elements.sidebarBackdrop.classList.toggle('active');
  });

  elements.sidebarBackdrop.addEventListener('click', closeMobileSidebar);
}

// ==========================================
// 10. UTILIDADES
// ==========================================
function adjustTextareaHeight() {
  const ta = elements.chatInput;
  ta.style.height = 'auto';
  ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
}

function updateSubmitButtonState() {
  const hasText = elements.chatInput.value.trim().length > 0;
  const hasFiles = appState.attachedFiles.length > 0;
  elements.btnSubmit.disabled = (!hasText && !hasFiles) || appState.isProcessing;
}

function scrollToBottom() {
  elements.chatScrollArea.scrollTop = elements.chatScrollArea.scrollHeight;
}

function closeMobileSidebar() {
  elements.sidebar.classList.remove('open');
  elements.sidebarBackdrop.classList.remove('active');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseMarkdownLike(text) {
  if (!text) return '';

  let parsed = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'code';
    return `
      <div class="code-block-container">
        <div class="code-header">
          <span>${language}</span>
          <button type="button" class="btn-copy-code">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
            </svg>
            Copiar código
          </button>
        </div>
        <pre><code>${escapeHtml(code.trim())}</code></pre>
      </div>
    `;
  });

  parsed = parsed.replace(/`([^`]+)`/g, '<code style="background: rgba(125,125,125,0.2); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.9em;">$1</code>');
  parsed = parsed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  parsed = parsed.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const lines = parsed.split('\n');
  let result = [];
  let inList = false;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      result.push(`<li>${trimmed.substring(2)}</li>`);
    } else if (/^###\s+/.test(trimmed)) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h3 style="font-size: 16px; margin: 12px 0 6px;">${trimmed.substring(4)}</h3>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (trimmed.length > 0 && !trimmed.startsWith('<div') && !trimmed.startsWith('</div')) {
        result.push(`<p>${line}</p>`);
      } else {
        result.push(line);
      }
    }
  });

  if (inList) result.push('</ul>');

  return result.join('\n');
}

function copyToClipboard(text, triggerBtn, successText = '¡Copiado!') {
  navigator.clipboard.writeText(text).then(() => {
    const originalHtml = triggerBtn.innerHTML;
    triggerBtn.textContent = successText;
    triggerBtn.style.color = '#10a37f';
    setTimeout(() => {
      triggerBtn.innerHTML = originalHtml;
      triggerBtn.style.color = '';
    }, 1800);
  }).catch(err => {
    console.error('Error al copiar:', err);
  });
}

// ==========================================
// 11. INICIALIZACIÓN
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupEventListeners();

  // Iniciar en estado limpio
  renderSidebarHistory();
  renderChatView();
  updateSubmitButtonState();
});
