/**
 * ══════════════════════════════════════════════════════
 * reader.js — 영문 Text & EPUB 리더기 + 형광펜 + AI 질문
 * ══════════════════════════════════════════════════════
 */

// ── State Management ──
const state = {
  currentBook: null, // { type: 'txt'|'epub', title: '', author: '', rawContent: any, id: '' }
  highlights: [],    // Array of highlight objects
  settings: {
    theme: 'light',
    fontSize: 18,
    lineHeight: 1.8,
    fontFamily: 'sans-serif',
  },
  epub: {
    book: null,
    rendition: null,
    toc: [],
    locationsReady: false,
  },
  activeSelection: null, // { text, targetSentence, prevSentence, nextSentence, cfiRange, range, rect }
  activeHighlight: null, // clicked highlight item
};

// ── Sample Book: Oscar Wilde's "The Happy Prince" ──
const SAMPLE_BOOK = {
  type: 'txt',
  title: 'The Happy Prince',
  author: 'Oscar Wilde',
  id: 'sample_happy_prince',
  content: `High above the city, on a tall column, stood the statue of the Happy Prince. He was gilded all over with thin leaves of fine gold, for eyes he had two bright sapphires, and a large red ruby glowed on his sword-hilt.

He was very much admired indeed. "He is as beautiful as a weathercock," remarked one of the Town Councillors who wished to gain a reputation for having artistic tastes; "only not quite so useful," he added, fearing lest people should think him unpractical, which he really was not.

"Why can't you be like the Happy Prince?" asked a sensible mother of her little boy who was crying for the moon. "The Happy Prince never dreams of crying for anything."

"I am glad there is some one in the world who is quite happy," muttered a disappointed man as he gazed at the wonderful statue.

"He looks just like an angel," said the Charity Children as they came out of the cathedral in their bright scarlet cloaks and their clean white pinafores.

"How do you know?" said the Mathematical Master, "you have never seen one."

"Ah! but we have, in our dreams," answered the children; and the Mathematical Master frowned and looked very severe, for he did not approve of children dreaming.

One night there flew over the city a little Swallow. His friends had gone away to Egypt six weeks before, but he had stayed behind, for he was in love with the most beautiful Reed. He had met her early in the spring as he was flying down the river after a big yellow moth, and had been so attracted by her slender waist that he had stopped to talk to her.

"Shall I love you?" said the Swallow, who liked to come to the point at once, and the Reed made him a low bow. So he flew round and round her, touching the water with his wings and making light ripples of silver. This was his courtship, and it lasted all through the summer.

"It is a ridiculous attachment," twittered the other Swallows; "she has no money, and far too many relations"; and indeed the river was quite full of Reeds. Then, when the autumn came, they all flew away.`
};

// ── Helper Functions for Metadata & AI Prompt ──
function cleanAuthor(author) {
  if (!author) return "저자";
  const a = author.trim();
  if (a === "저자" || a === "저자 미지정" || a === "Unknown") return "저자";
  return a;
}

function cleanBookTitle(title) {
  if (!title) return "<책명>";
  let t = title.trim();
  if (t === "도서를 선택해주세요" || t === "책명" || t === "Untitled") return "<책명>";
  if (!t.startsWith('<')) {
    t = `<${t}>`;
  }
  return t;
}

function formatSentenceWithQuotes(text) {
  if (!text) return "";
  const trimmed = text.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('“') && trimmed.endsWith('”'))) {
    return trimmed;
  }
  return `"${trimmed}"`;
}

/**
 * 영어 듣기 앱과 동일한 형식의 AI 프롬프트 생성
 */
function buildAISearchPrompt({ targetSentence, prevSentence, nextSentence, author, bookTitle }) {
  const cleanA = cleanAuthor(author);
  const cleanT = cleanBookTitle(bookTitle);

  let prompt = `아래 [대상 문장]에 대해 1, 2, 3 항목별로 구체적으로 설명해줘.\n1. 한국어 번역\n2. 주요 단어 및 숙어 설명\n3. 주요 문법 설명\n\n`;
  prompt += `[대상 문장]\n${formatSentenceWithQuotes(targetSentence)}\n\n`;

  if (prevSentence || nextSentence) {
    prompt += `[앞뒤 문맥]\n`;
    if (prevSentence) prompt += `이전: ${formatSentenceWithQuotes(prevSentence)}\n`;
    if (nextSentence) prompt += `다음: ${formatSentenceWithQuotes(nextSentence)}\n`;
    prompt += `\n`;
  }

  prompt += `[출처: ${cleanA}, ${cleanT}]`;
  return prompt;
}

/**
 * 영문 문장 단위 분할 (Regex 기반 정교한 분할)
 */
function splitIntoSentences(text) {
  if (!text) return [];
  // 줄바꿈 정리
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  // 문장 분리 정규식 (마침표, 물음표, 느낌표 뒤의 공백과 대문자/따옴표)
  const tokens = normalized.match(/[^.!?]+[.!?]+["'’”]?|\S+$/g);
  if (!tokens) return [normalized];

  return tokens.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * 특정 텍스트 및 그 주변 문맥(이전/다음 문장) 추출
 */
function extractContextFromText(fullParagraph, selectedText) {
  const sentences = splitIntoSentences(fullParagraph);
  if (sentences.length === 0) {
    return {
      targetSentence: selectedText,
      prevSentence: '',
      nextSentence: ''
    };
  }

  const cleanSel = selectedText.trim().toLowerCase();

  // 선택된 텍스트가 포함된 문장 인덱스 찾기
  let targetIdx = -1;
  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].toLowerCase().includes(cleanSel)) {
      targetIdx = i;
      break;
    }
  }

  if (targetIdx === -1) {
    // 문장에 걸쳐 선택된 경우 또는 못 찾았을 때는 선택된 텍스트 자체를 대상 문장으로
    return {
      targetSentence: selectedText,
      prevSentence: sentences[0] !== selectedText ? sentences[0] : '',
      nextSentence: sentences[1] || ''
    };
  }

  const targetSentence = sentences[targetIdx];
  const prevSentence = targetIdx > 0 ? sentences[targetIdx - 1] : '';
  const nextSentence = targetIdx < sentences.length - 1 ? sentences[targetIdx + 1] : '';

  return { targetSentence, prevSentence, nextSentence };
}

// ── Notification Toast ──
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('reader-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// ── DOM Elements ──
const elements = {
  navToggle: document.getElementById('nav-toggle'),
  navMenu: document.getElementById('nav-menu'),

  // Meta & Topbar
  displayTitle: document.getElementById('title-text'),
  displayAuthor: document.getElementById('display-book-author'),
  btnEditMeta: document.getElementById('btn-edit-meta'),
  bookFileInput: document.getElementById('book-file-input'),
  emptyFileInput: document.getElementById('empty-file-input'),
  btnExportBook: document.getElementById('btn-export-book'),
  btnLoadSample: document.getElementById('btn-load-sample'),
  btnEmptySample: document.getElementById('btn-empty-sample'),
  btnToggleToc: document.getElementById('btn-toggle-toc'),
  btnToggleHighlights: document.getElementById('btn-toggle-highlights'),
  highlightCounter: document.getElementById('highlight-counter'),
  btnToggleSettings: document.getElementById('btn-toggle-settings'),
  settingsPopover: document.getElementById('settings-popover'),

  // Main Viewers
  emptyState: document.getElementById('empty-state'),
  txtViewer: document.getElementById('txt-viewer'),
  txtContent: document.getElementById('txt-content'),
  epubViewer: document.getElementById('epub-viewer'),
  epubArea: document.getElementById('epub-area'),
  btnEpubPrev: document.getElementById('btn-epub-prev'),
  btnEpubNext: document.getElementById('btn-epub-next'),
  readerBottomBar: document.getElementById('reader-bottom-bar'),
  currentChapterTitle: document.getElementById('current-chapter-title'),
  progressSlider: document.getElementById('reader-progress-slider'),
  progressPercent: document.getElementById('reader-progress-percent'),

  // Toolbars
  selectionToolbar: document.getElementById('selection-toolbar'),
  btnToolbarAi: document.getElementById('btn-toolbar-ai'),
  btnToolbarCopy: document.getElementById('btn-toolbar-copy'),
  highlightToolbar: document.getElementById('highlight-toolbar'),
  btnHlAi: document.getElementById('btn-hl-ai'),
  btnHlNote: document.getElementById('btn-hl-note'),
  btnHlRemove: document.getElementById('btn-hl-remove'),

  // Drawer
  readerDrawer: document.getElementById('reader-drawer'),
  drawerBackdrop: document.getElementById('drawer-backdrop'),
  drawerTitle: document.getElementById('drawer-title-text'),
  drawerIcon: document.getElementById('drawer-icon'),
  drawerBody: document.getElementById('drawer-body'),
  btnDrawerClose: document.getElementById('btn-drawer-close'),

  // AI Modal
  aiModalBackdrop: document.getElementById('ai-modal-backdrop'),
  btnCloseAiModal: document.getElementById('btn-close-ai-modal'),
  modalTargetText: document.getElementById('modal-target-text'),
  modalPrevText: document.getElementById('modal-prev-text'),
  modalNextText: document.getElementById('modal-next-text'),
  modalPrevRow: document.getElementById('modal-prev-row'),
  modalNextRow: document.getElementById('modal-next-row'),
  modalSourceText: document.getElementById('modal-source-text'),
  aiPromptInput: document.getElementById('ai-prompt-input'),
  btnCopyPrompt: document.getElementById('btn-copy-prompt'),
  btnLaunchGoogle: document.getElementById('btn-launch-google'),
  btnLaunchGemini: document.getElementById('btn-launch-gemini'),
  btnLaunchChatgpt: document.getElementById('btn-launch-chatgpt'),

  // Meta Modal
  metaEditModal: document.getElementById('meta-edit-modal'),
  inputEditTitle: document.getElementById('input-edit-title'),
  inputEditAuthor: document.getElementById('input-edit-author'),
  btnCancelMeta: document.getElementById('btn-cancel-meta'),
  btnSaveMeta: document.getElementById('btn-save-meta'),

  // Settings
  themeBtns: document.querySelectorAll('.theme-btn[data-theme]'),
  btnFontDecrease: document.getElementById('btn-font-decrease'),
  btnFontIncrease: document.getElementById('btn-font-increase'),
  fontSizeIndicator: document.getElementById('font-size-indicator'),
  btnLhDecrease: document.getElementById('btn-lh-decrease'),
  btnLhIncrease: document.getElementById('btn-lh-increase'),
  lhIndicator: document.getElementById('lh-indicator'),
  fontFamilySelect: document.getElementById('font-family-select'),
};

// 모듈 수준 전역 제어 변수
let justSelectedInEpub = false;
let justClickedHighlight = false;
let lastIframeClick = null;
let navButtonsTimer = null;

// ── IndexedDB 도서 지속성(Persistence) 관리 ──
const READER_DB_NAME = 'EnglishReaderDB';
const READER_DB_VERSION = 1;
const READER_STORE_NAME = 'active_book';

function openReaderDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      resolve(null);
      return;
    }
    const req = indexedDB.open(READER_DB_NAME, READER_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(READER_STORE_NAME)) {
        db.createObjectStore(READER_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.warn('IndexedDB open error:', req.error);
      resolve(null);
    };
  });
}

async function saveActiveBookToStorage(bookRecord) {
  try {
    const db = await openReaderDB();
    if (!db) return;
    const tx = db.transaction(READER_STORE_NAME, 'readwrite');
    const store = tx.objectStore(READER_STORE_NAME);
    store.put({ id: 'current_reading_book', ...bookRecord, timestamp: Date.now() });
  } catch (err) {
    console.warn('Failed to save book to IndexedDB:', err);
  }
}

async function loadActiveBookFromStorage() {
  try {
    const db = await openReaderDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(READER_STORE_NAME, 'readonly');
      const store = tx.objectStore(READER_STORE_NAME);
      const req = store.get('current_reading_book');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Failed to load book from IndexedDB:', err);
    return null;
  }
}

// 좌/우 페이지 넘김 버튼 일시 표시 후 자동 페이드아웃
function showNavButtonsTemporarily(duration = 2500) {
  if (!elements.btnEpubPrev || !elements.btnEpubNext) return;
  elements.btnEpubPrev.classList.add('visible');
  elements.btnEpubNext.classList.add('visible');

  if (navButtonsTimer) {
    clearTimeout(navButtonsTimer);
  }
  navButtonsTimer = setTimeout(() => {
    if (elements.btnEpubPrev) elements.btnEpubPrev.classList.remove('visible');
    if (elements.btnEpubNext) elements.btnEpubNext.classList.remove('visible');
    navButtonsTimer = null;
  }, duration);
}

// 모바일 터치 스와이프 제스처 핸들러 (좌우 넘김)
function attachSwipeGesture(targetElement, getIframeSelection = null) {
  if (!targetElement) return;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isSwiping = false;

  targetElement.addEventListener('touchstart', (e) => {
    showNavButtonsTemporarily();

    if (!e.touches || e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    isSwiping = true;
  }, { passive: true });

  targetElement.addEventListener('touchmove', (e) => {
    // 수평 스와이프 감지용 추적
  }, { passive: true });

  targetElement.addEventListener('touchend', (e) => {
    if (!isSwiping || !e.changedTouches || e.changedTouches.length === 0) return;
    isSwiping = false;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    const dt = Date.now() - touchStartTime;

    // 1. 제스처 시간 임계값: 800ms 이내 빠른 스와이프
    if (dt > 800) return;

    // 2. 가로 이동 최소 거리: 45px 이상
    if (Math.abs(dx) < 45) return;

    // 3. 방향 판별: 가로 이동이 세로 스크롤보다 우세해야 함
    if (Math.abs(dx) < Math.abs(dy) * 1.3) return;

    // 4. 텍스트 드래그 선택 중인 경우 페이지 넘김 방지
    const winSel = window.getSelection();
    if (winSel && winSel.toString().trim().length > 0) return;
    if (getIframeSelection) {
      const ifSel = getIframeSelection();
      if (ifSel && ifSel.toString().trim().length > 0) return;
    }
    if (justSelectedInEpub || justClickedHighlight) return;

    // 5. 페이지 넘김 동작 수행
    if (state.currentBook && state.currentBook.type === 'epub' && state.epub.rendition) {
      if (dx < 0) {
        state.epub.rendition.next();
      } else {
        state.epub.rendition.prev();
      }
    } else if (state.currentBook && state.currentBook.type === 'txt' && elements.txtViewer) {
      const scrollStep = elements.txtViewer.clientHeight * 0.8;
      if (dx < 0) {
        elements.txtViewer.scrollBy({ top: scrollStep, behavior: 'smooth' });
      } else {
        elements.txtViewer.scrollBy({ top: -scrollStep, behavior: 'smooth' });
      }
    }
  }, { passive: true });
}

// 설정 팝오버 위치 보정 (모바일에서 화면 밖 잘림 방지)
function positionSettingsPopover() {
  if (!elements.settingsPopover || !elements.settingsPopover.classList.contains('open')) return;
  if (window.innerWidth <= 768) {
    const btnRect = elements.btnToggleSettings.getBoundingClientRect();
    elements.settingsPopover.style.position = 'fixed';
    elements.settingsPopover.style.top = `${btnRect.bottom + 8}px`;
    elements.settingsPopover.style.left = '12px';
    elements.settingsPopover.style.right = '12px';
    elements.settingsPopover.style.width = 'auto';
    elements.settingsPopover.style.maxWidth = '340px';
    elements.settingsPopover.style.margin = '0 auto';
  } else {
    elements.settingsPopover.style.position = '';
    elements.settingsPopover.style.top = '';
    elements.settingsPopover.style.left = '';
    elements.settingsPopover.style.right = '';
    elements.settingsPopover.style.width = '';
    elements.settingsPopover.style.maxWidth = '';
    elements.settingsPopover.style.margin = '';
  }
}

// ── Settings Management ──
function loadSettings() {
  const saved = localStorage.getItem('reader_settings');
  if (saved) {
    try {
      state.settings = { ...state.settings, ...JSON.parse(saved) };
    } catch (e) {
      console.error(e);
    }
  }
  applySettings();
}

function saveSettings() {
  localStorage.setItem('reader_settings', JSON.stringify(state.settings));
}

function applySettings() {
  // Theme
  document.body.classList.remove('theme-light', 'theme-sepia', 'theme-dark');
  document.body.classList.add(`theme-${state.settings.theme}`);
  elements.themeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === state.settings.theme);
  });

  // Font Size
  document.documentElement.style.setProperty('--reader-font-size', `${state.settings.fontSize}px`);
  if (elements.fontSizeIndicator) {
    elements.fontSizeIndicator.textContent = `${state.settings.fontSize}px`;
  }

  // Line Height
  const currentLh = state.settings.lineHeight || 1.8;
  document.documentElement.style.setProperty('--reader-line-height', currentLh);
  if (elements.lhIndicator) {
    elements.lhIndicator.textContent = currentLh.toFixed(1);
  }

  // Font Family
  let fontValue = "'Inter', -apple-system, sans-serif";
  if (state.settings.fontFamily === 'serif') {
    fontValue = "'Noto Serif KR', Georgia, 'Times New Roman', serif";
  } else if (state.settings.fontFamily === 'monospace') {
    fontValue = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  }
  document.documentElement.style.setProperty('--reader-font-family', fontValue);
  if (elements.fontFamilySelect) {
    elements.fontFamilySelect.value = state.settings.fontFamily;
  }

  // EPUB rendition theme update
  if (state.epub.rendition) {
    applyEpubThemes();
  }
}

function applyEpubThemes() {
  if (!state.epub.rendition) return;

  const bgColors = {
    light: '#ffffff',
    sepia: '#fcf8f2',
    dark: '#1e293b'
  };
  const textColors = {
    light: '#1e293b',
    sepia: '#3d312a',
    dark: '#f1f5f9'
  };

  const currentTheme = state.settings.theme;
  const currentLh = state.settings.lineHeight || 1.8;
  const isDark = currentTheme === 'dark';

  state.epub.rendition.themes.default({
    'body': {
      'background': `${bgColors[currentTheme]} !important`,
      'color': `${textColors[currentTheme]} !important`,
      'font-family': `${state.settings.fontFamily === 'serif' ? 'Georgia, serif' : '-apple-system, sans-serif'} !important`,
      'font-size': `${state.settings.fontSize}px !important`,
      'line-height': `${currentLh} !important`,
      'padding': '20px 40px !important',
    },
    'p': {
      'margin-bottom': '1.4em !important',
      'line-height': `${currentLh} !important`
    },
    '::selection': {
      'background': 'rgba(37, 99, 235, 0.25) !important'
    },
    '.epubjs-hl': {
      'fill': '#facc15 !important',
      'fill-opacity': isDark ? '0.4 !important' : '0.35 !important',
      'mix-blend-mode': isDark ? 'screen !important' : 'multiply !important',
      'cursor': 'pointer !important',
      'pointer-events': 'auto !important'
    },
    '.epubjs-hl.hl-yellow': { 'fill': '#facc15 !important' },
    '.epubjs-hl.hl-green':  { 'fill': '#4ade80 !important' },
    '.epubjs-hl.hl-purple': { 'fill': '#c084fc !important' },
    '.epubjs-hl.hl-blue':   { 'fill': '#38bdf8 !important' },
    '.epubjs-hl.hl-pink':   { 'fill': '#f472b6 !important' }
  });

  // Re-sync highlights whenever themes (line-height, font-size, colors) change
  setTimeout(() => {
    restoreEpubHighlights();
  }, 100);
}

// ── Highlights LocalStorage & Sorting Management ──
function compareHighlights(a, b) {
  if (state.currentBook && state.currentBook.type === 'epub') {
    if (a.cfiRange && b.cfiRange) {
      return compareEpubCfi(a.cfiRange, b.cfiRange);
    }
  } else if (state.currentBook && state.currentBook.type === 'txt') {
    const pA = a.pIdx ?? 0;
    const pB = b.pIdx ?? 0;
    if (pA !== pB) return pA - pB;
    const offA = a.offset ?? 0;
    const offB = b.offset ?? 0;
    if (offA !== offB) return offA - offB;
  }
  const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return tA - tB;
}

function compareEpubCfi(cfiA, cfiB) {
  if (!cfiA || !cfiB) return 0;
  if (cfiA === cfiB) return 0;
  try {
    if (typeof ePub !== 'undefined' && ePub.CFI) {
      if (typeof ePub.CFI.compare === 'function') {
        return ePub.CFI.compare(cfiA, cfiB);
      }
      const cfi = new ePub.CFI();
      if (typeof cfi.compare === 'function') {
        return cfi.compare(cfiA, cfiB);
      }
    }
  } catch (e) {
    console.warn('CFI compare error:', e);
  }
  return cfiA.localeCompare(cfiB, undefined, { numeric: true });
}

function sortHighlights() {
  if (Array.isArray(state.highlights)) {
    state.highlights.sort(compareHighlights);
  }
}

function getBookStorageKey(bookId) {
  return `reader_highlights_${bookId}`;
}

function loadHighlights(bookId) {
  if (!bookId) return [];
  const raw = localStorage.getItem(getBookStorageKey(bookId));
  if (raw) {
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        // Clean and deduplicate existing records
        const uniqueList = [];
        const seen = new Set();
        list.forEach(item => {
          if (!item || !item.text) return;
          const key = item.cfiRange ? item.cfiRange : `${item.pIdx}_${item.text.trim()}_${(item.targetSentence || '').trim()}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueList.push(item);
          }
        });
        uniqueList.sort(compareHighlights);
        if (uniqueList.length !== list.length) {
          localStorage.setItem(getBookStorageKey(bookId), JSON.stringify(uniqueList));
        }
        return uniqueList;
      }
    } catch (e) {
      console.error(e);
    }
  }
  return [];
}

function saveHighlights() {
  if (!state.currentBook) return;
  localStorage.setItem(getBookStorageKey(state.currentBook.id), JSON.stringify(state.highlights));
  updateHighlightBadge();
}

function updateHighlightBadge() {
  if (elements.highlightCounter) {
    elements.highlightCounter.textContent = state.highlights.length;
  }
}

// ── Book Loading (TXT / EPUB / Sample) ──
function loadSampleBook() {
  openTxtBook(SAMPLE_BOOK.title, SAMPLE_BOOK.author, SAMPLE_BOOK.content, SAMPLE_BOOK.id);
  showToast('샘플 도서 "The Happy Prince"가 로드되었습니다.');
}

function handleFileSelection(file) {
  if (!file) return;

  const fileName = file.name;
  const isEpub = fileName.toLowerCase().endsWith('.epub') || file.type.includes('epub');

  if (isEpub) {
    const reader = new FileReader();
    reader.onload = (e) => {
      openEpubBook(fileName.replace(/\.epub$/i, ''), '저자 확인 중...', e.target.result, `epub_${fileName}_${file.size}`);
    };
    reader.readAsArrayBuffer(file);
  } else {
    // Assume TXT
    const reader = new FileReader();
    reader.onload = (e) => {
      openTxtBook(fileName.replace(/\.txt$/i, ''), '', e.target.result, `txt_${fileName}_${file.size}`);
    };
    reader.readAsText(file, 'utf-8');
  }
}

// ── EPUB & Highlights Export Management ──
async function exportBookWithHighlights() {
  if (!state.currentBook) {
    showToast('내보낼 도서가 없습니다. 먼저 도서를 열어주세요.');
    return;
  }

  if (typeof JSZip === 'undefined') {
    showToast('ZIP 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }

  showToast('형광펜 및 메모가 포함된 EPUB 파일 생성 중...');

  try {
    if (state.currentBook.type === 'epub') {
      await exportExistingEpubWithHighlights();
    } else {
      await exportTxtAsEpubWithHighlights();
    }
    showToast('EPUB 내보내기가 완료되었습니다.');
  } catch (err) {
    console.error('Export Error:', err);
    showToast('EPUB 내보내기 중 오류가 발생했습니다: ' + (err.message || ''));
  }
}

async function exportExistingEpubWithHighlights() {
  const zip = await JSZip.loadAsync(state.currentBook.content);

  // 1. Save metadata inside EPUB archive
  zip.file("META-INF/reader_highlights.json", JSON.stringify({
    title: state.currentBook.title,
    author: state.currentBook.author,
    exportedAt: new Date().toISOString(),
    highlights: state.highlights
  }, null, 2));

  // If no highlights, export as is
  if (!state.highlights || state.highlights.length === 0) {
    await downloadZipAsEpub(zip, state.currentBook.title);
    return;
  }

  // 2. Resolve OPF package file location
  let opfPath = 'OEBPS/content.opf';
  try {
    const containerFile = zip.file('META-INF/container.xml');
    if (containerFile) {
      const containerXml = await containerFile.async('text');
      const match = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/i);
      if (match) opfPath = match[1];
    }
  } catch (e) {}
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // 3. Inject highlight marks into XHTML/HTML chapter files
  const xhtmlFileNames = Object.keys(zip.files).filter(name => {
    const lower = name.toLowerCase();
    return (lower.endsWith('.xhtml') || lower.endsWith('.html') || lower.endsWith('.htm')) &&
           !lower.includes('toc') && !lower.includes('nav');
  });

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  for (const fileName of xhtmlFileNames) {
    const file = zip.file(fileName);
    if (!file) continue;

    const content = await file.async('text');
    const relevantHls = state.highlights.filter(hl => hl.text && content.includes(hl.text));
    if (relevantHls.length === 0) continue;

    try {
      const doc = parser.parseFromString(content, 'application/xhtml+xml');
      if (!doc.querySelector('parsererror')) {
        let modified = false;
        for (const hl of relevantHls) {
          if (injectHighlightInDoc(doc, hl)) {
            modified = true;
          }
        }
        if (modified) {
          if (doc.head && !doc.getElementById('exported-hl-style')) {
            const style = doc.createElementNS('http://www.w3.org/1999/xhtml', 'style');
            style.id = 'exported-hl-style';
            style.textContent = `
              mark.reader-highlight { padding: 1px 2px; border-radius: 2px; color: inherit; }
              mark.reader-highlight.hl-yellow { background-color: #fde047; }
              mark.reader-highlight.hl-green  { background-color: #86efac; }
              mark.reader-highlight.hl-purple { background-color: #d8b4fe; }
              mark.reader-highlight.hl-blue   { background-color: #7dd3fc; }
              mark.reader-highlight.hl-pink   { background-color: #f9a8d4; }
              .reader-note-badge { font-size: 0.75em; background: #2563eb; color: #ffffff; border-radius: 3px; padding: 0 4px; margin-left: 3px; vertical-align: super; }
            `;
            doc.head.appendChild(style);
          }
          const newContent = serializer.serializeToString(doc);
          zip.file(fileName, newContent);
        }
      }
    } catch (err) {
      console.warn('XHTML highlight injection error:', fileName, err);
    }
  }

  // 4. Create and append "Highlights & Notes" Appendix chapter
  const appendixFileName = `${opfDir}highlights_appendix.xhtml`;
  const appendixRelativeHref = 'highlights_appendix.xhtml';
  const appendixHtml = generateHighlightsAppendixHtml(state.currentBook.title, state.currentBook.author, state.highlights);
  zip.file(appendixFileName, appendixHtml);

  // 5. Register appendix in OPF manifest and spine
  try {
    const opfFile = zip.file(opfPath);
    if (opfFile) {
      let opfText = await opfFile.async('text');
      if (!opfText.includes('highlights_appendix.xhtml')) {
        const manifestItem = `  <item id="highlights-appendix" href="${appendixRelativeHref}" media-type="application/xhtml+xml"/>\n  </manifest>`;
        opfText = opfText.replace(/<\/manifest>/i, manifestItem);

        const spineItem = `  <itemref idref="highlights-appendix"/>\n  </spine>`;
        opfText = opfText.replace(/<\/spine>/i, spineItem);

        zip.file(opfPath, opfText);
      }
    }
  } catch (err) {
    console.warn('OPF update error:', err);
  }

  await downloadZipAsEpub(zip, state.currentBook.title);
}

async function exportTxtAsEpubWithHighlights() {
  const zip = new JSZip();

  // 1. mimetype (MUST be uncompressed per EPUB specification)
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // 2. META-INF/container.xml
  zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  // 3. META-INF/reader_highlights.json
  zip.file("META-INF/reader_highlights.json", JSON.stringify({
    title: state.currentBook.title,
    author: state.currentBook.author,
    exportedAt: new Date().toISOString(),
    highlights: state.highlights
  }, null, 2));

  // 4. Stylesheet
  zip.file("OEBPS/styles.css", `
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.8; padding: 24px 20px; color: #1e293b; max-width: 800px; margin: 0 auto; }
h1 { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
.author { font-size: 14px; color: #64748b; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
p { margin-bottom: 1.4em; }
mark.reader-highlight { padding: 1px 2px; border-radius: 2px; color: inherit; }
mark.reader-highlight.hl-yellow { background-color: #fde047; }
mark.reader-highlight.hl-green  { background-color: #86efac; }
mark.reader-highlight.hl-purple { background-color: #d8b4fe; }
mark.reader-highlight.hl-blue   { background-color: #7dd3fc; }
mark.reader-highlight.hl-pink   { background-color: #f9a8d4; }
.reader-note-badge { font-size: 0.75em; background: #2563eb; color: #ffffff; border-radius: 3px; padding: 0 4px; margin-left: 3px; vertical-align: super; }
`);

  // 5. Book Content (XHTML)
  const paragraphs = (state.currentBook.content || '').split(/\n\s*\n/);
  let bookBodyHtml = `<h1>${escapeHtml(state.currentBook.title || 'Untitled')}</h1>\n`;
  if (state.currentBook.author) {
    bookBodyHtml += `<div class="author">${escapeHtml(state.currentBook.author)}</div>\n`;
  }

  paragraphs.forEach((pText, pIdx) => {
    const trimmed = pText.trim();
    if (!trimmed) return;
    const pHtml = applyHighlightsToParagraph(trimmed, pIdx);
    bookBodyHtml += `<p>${pHtml}</p>\n`;
  });

  const bookXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="ko">
<head>
  <title>${escapeHtml(state.currentBook.title || 'Book')}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  ${bookBodyHtml}
</body>
</html>`;
  zip.file("OEBPS/book.xhtml", bookXhtml);

  const hasHighlights = state.highlights && state.highlights.length > 0;
  if (hasHighlights) {
    const appendixHtml = generateHighlightsAppendixHtml(state.currentBook.title, state.currentBook.author, state.highlights);
    zip.file("OEBPS/highlights_appendix.xhtml", appendixHtml);
  }

  // 6. content.opf
  const bookId = `urn:uuid:${generateUUID()}`;
  const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(state.currentBook.title || 'Book')}</dc:title>
    <dc:creator>${escapeXml(state.currentBook.author || 'Unknown')}</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">${bookId}</dc:identifier>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="css" href="styles.css" media-type="text/css"/>
    <item id="book" href="book.xhtml" media-type="application/xhtml+xml"/>
    ${hasHighlights ? '<item id="highlights-appendix" href="highlights_appendix.xhtml" media-type="application/xhtml+xml"/>' : ''}
    <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="toc">
    <itemref idref="book"/>
    ${hasHighlights ? '<itemref idref="highlights-appendix"/>' : ''}
  </spine>
</package>`;
  zip.file("OEBPS/content.opf", opfContent);

  // 7. toc.ncx
  const ncxContent = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId}"/>
  </head>
  <docTitle><text>${escapeXml(state.currentBook.title || 'Book')}</text></docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel><text>${escapeXml(state.currentBook.title || 'Book')}</text></navLabel>
      <content src="book.xhtml"/>
    </navPoint>
    ${hasHighlights ? `
    <navPoint id="navPoint-2" playOrder="2">
      <navLabel><text>형광펜 및 독서 메모</text></navLabel>
      <content src="highlights_appendix.xhtml"/>
    </navPoint>` : ''}
  </navMap>
</ncx>`;
  zip.file("OEBPS/toc.ncx", ncxContent);

  await downloadZipAsEpub(zip, state.currentBook.title);
}

function injectHighlightInDoc(doc, hl) {
  if (!hl.text || !doc) return false;
  const body = doc.body || doc.documentElement;
  if (!body) return false;

  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let node;
  let didInject = false;
  const nodesToProcess = [];

  while ((node = walker.nextNode())) {
    if (node.nodeValue && node.nodeValue.includes(hl.text)) {
      nodesToProcess.push(node);
    }
  }

  const colorHex = getHighlightColorHex(hl.color || 'yellow');

  for (const textNode of nodesToProcess) {
    const parent = textNode.parentNode;
    if (!parent) continue;
    const parentTag = (parent.nodeName || '').toLowerCase();
    if (parentTag === 'mark' || parentTag === 'script' || parentTag === 'style') {
      continue;
    }

    const val = textNode.nodeValue;
    const idx = val.indexOf(hl.text);
    if (idx === -1) continue;

    const before = val.substring(0, idx);
    const match = val.substring(idx, idx + hl.text.length);
    const after = val.substring(idx + hl.text.length);

    const mark = doc.createElementNS('http://www.w3.org/1999/xhtml', 'mark');
    mark.setAttribute('class', `reader-highlight hl-${hl.color || 'yellow'}`);
    mark.setAttribute('style', `background-color: ${colorHex}; color: inherit; padding: 1px 3px; border-radius: 3px;`);
    mark.textContent = match;

    if (hl.note) {
      mark.setAttribute('title', `메모: ${hl.note}`);
      const sup = doc.createElementNS('http://www.w3.org/1999/xhtml', 'span');
      sup.setAttribute('class', 'reader-note-badge');
      sup.setAttribute('style', 'font-size: 0.75em; background: #2563eb; color: #ffffff; border-radius: 3px; padding: 0 4px; margin-left: 3px; vertical-align: super;');
      sup.textContent = `💬 ${hl.note}`;
      mark.appendChild(sup);
    }

    const fragment = doc.createDocumentFragment();
    if (before) fragment.appendChild(doc.createTextNode(before));
    fragment.appendChild(mark);
    if (after) fragment.appendChild(doc.createTextNode(after));

    parent.replaceChild(fragment, textNode);
    didInject = true;
    break;
  }

  return didInject;
}

function generateHighlightsAppendixHtml(title, author, highlights) {
  let entriesHtml = '';
  highlights.forEach((hl, i) => {
    const colorHex = getHighlightColorHex(hl.color || 'yellow');
    const dateStr = hl.createdAt ? new Date(hl.createdAt).toLocaleDateString() : '';
    entriesHtml += `
      <div style="margin-bottom:18px; padding:14px 16px; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; border-left:4px solid ${colorHex};">
        <div style="font-size:12px; color:#64748b; margin-bottom:4px;">#${i + 1} · ${dateStr}</div>
        <div style="font-size:16px; font-weight:600; color:#0f172a; margin-bottom:6px;">"${escapeHtml(hl.text)}"</div>
        ${hl.targetSentence && hl.targetSentence !== hl.text ? `<div style="font-size:13px; color:#64748b; margin-bottom:6px; font-style:italic;">문맥: ${escapeHtml(hl.targetSentence)}</div>` : ''}
        ${hl.note ? `<div style="background:#eff6ff; color:#1e40af; border-radius:6px; padding:8px 12px; font-size:14px; margin-top:6px;">💬 메모: ${escapeHtml(hl.note)}</div>` : ''}
      </div>
    `;
  });

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="ko">
<head>
  <title>형광펜 및 독서 메모</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px 20px; line-height: 1.7; color: #1e293b; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 700; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 6px; }
    .meta { font-size: 13px; color: #64748b; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>📖 형광펜 및 독서 메모</h1>
  <div class="meta">
    도서: ${escapeHtml(title || '')} | 저자: ${escapeHtml(author || '미지정')} | 총 ${highlights.length}개 구문 | 내보낸 날짜: ${new Date().toLocaleDateString()}
  </div>
  ${entriesHtml}
</body>
</html>`;
}

function escapeXml(unsafe) {
  return (unsafe || '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function downloadZipAsEpub(zip, bookTitle) {
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  const safeTitle = (bookTitle || 'book').replace(/[/\\?%*:|"<>]/g, '_').trim();
  const fileName = `${safeTitle}_with_highlights.epub`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ── TXT Book Viewer ──
function openTxtBook(title, author, content, bookId, skipSaveToDb = false) {
  // Reset EPUB if any
  cleanupEpub();

  state.currentBook = {
    type: 'txt',
    title: title || 'Untitled Text',
    author: author || '',
    content,
    id: bookId || `txt_${Date.now()}`
  };

  state.highlights = loadHighlights(state.currentBook.id);
  updateMetadataUI();
  updateHighlightBadge();

  elements.emptyState.style.display = 'none';
  elements.epubViewer.style.display = 'none';
  elements.btnToggleToc.style.display = 'none';
  elements.txtViewer.style.display = 'flex';
  elements.readerBottomBar.style.display = 'flex';
  elements.currentChapterTitle.textContent = state.currentBook.title;

  renderTxtContent();

  if (!skipSaveToDb) {
    saveActiveBookToStorage({
      type: 'txt',
      title: state.currentBook.title,
      author: state.currentBook.author,
      content,
      bookId: state.currentBook.id
    });
  }
}

function renderTxtContent() {
  elements.txtContent.innerHTML = '';

  const paragraphs = state.currentBook.content.split(/\n\s*\n/);
  paragraphs.forEach((pText, pIdx) => {
    const trimmed = pText.trim();
    if (!trimmed) return;

    const p = document.createElement('p');
    p.dataset.pIdx = pIdx;

    // Apply highlights if any exist for this paragraph
    p.innerHTML = applyHighlightsToParagraph(trimmed, pIdx);
    elements.txtContent.appendChild(p);
  });

  // TXT Scroll progress tracking
  elements.txtViewer.onscroll = () => {
    const scrollTop = elements.txtViewer.scrollTop;
    const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
    if (scrollHeight > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((scrollTop / scrollHeight) * 100)));
      elements.progressSlider.value = pct;
      elements.progressPercent.textContent = `${pct}%`;
      if (state.currentBook) {
        localStorage.setItem(`reader_pos_${state.currentBook.id}`, pct);
      }
    }
  };

  // Restore saved scroll position if any
  const savedPos = localStorage.getItem(`reader_pos_${state.currentBook.id}`);
  if (savedPos) {
    const applySavedScroll = () => {
      const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
      if (scrollHeight > 0) {
        elements.txtViewer.scrollTop = (parseFloat(savedPos) / 100) * scrollHeight;
      }
    };
    setTimeout(applySavedScroll, 60);
    setTimeout(applySavedScroll, 250);
  }

  // Bind click on marks
  bindHighlightClickEvents();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function applyHighlightsToParagraph(paragraphText, pIdx) {
  const pHighlights = state.highlights.filter(h => h.pIdx === pIdx);
  if (pHighlights.length === 0) {
    return escapeHtml(paragraphText);
  }

  // Sort by offset to preserve paragraph order
  const sorted = [...pHighlights].sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));
  let html = escapeHtml(paragraphText);
  sorted.forEach(hl => {
    const escapedText = escapeHtml(hl.text);
    const markHtml = `<mark class="reader-highlight hl-${hl.color || 'yellow'}" data-hl-id="${hl.id}">${escapedText}</mark>`;
    html = html.replace(escapedText, markHtml);
  });

  return html;
}

function bindHighlightClickEvents() {
  const marks = elements.txtContent.querySelectorAll('.reader-highlight');
  marks.forEach(mark => {
    mark.addEventListener('click', (e) => {
      e.stopPropagation();
      const hlId = mark.dataset.hlId;
      const hl = state.highlights.find(h => h.id === hlId);
      if (hl) {
        openHighlightToolbar(hl, mark);
      }
    });
  });
}

// ── EPUB Book Viewer (epub.js) ──
function cleanupEpub() {
  if (state.epub.rendition) {
    try {
      state.epub.rendition.destroy();
    } catch (e) {
      console.warn(e);
    }
    state.epub.rendition = null;
  }
  if (state.epub.book) {
    try {
      state.epub.book.destroy();
    } catch (e) {
      console.warn(e);
    }
    state.epub.book = null;
  }
  elements.epubArea.innerHTML = '';
}

function openEpubBook(initialTitle, initialAuthor, arrayBuffer, bookId, skipSaveToDb = false) {
  cleanupEpub();

  state.currentBook = {
    type: 'epub',
    title: initialTitle || 'EPUB Book',
    author: initialAuthor || '',
    content: arrayBuffer,
    id: bookId || `epub_${Date.now()}`
  };

  state.highlights = loadHighlights(state.currentBook.id);
  updateMetadataUI();
  updateHighlightBadge();

  elements.emptyState.style.display = 'none';
  elements.txtViewer.style.display = 'none';
  elements.epubViewer.style.display = 'flex';
  elements.btnToggleToc.style.display = 'inline-flex';
  elements.readerBottomBar.style.display = 'flex';

  if (!skipSaveToDb) {
    saveActiveBookToStorage({
      type: 'epub',
      title: state.currentBook.title,
      author: state.currentBook.author,
      content: arrayBuffer,
      bookId: state.currentBook.id
    });
  }

  try {
    const book = ePub(arrayBuffer);
    state.epub.book = book;

    const rendition = book.renderTo("epub-area", {
      width: "100%",
      height: "100%",
      spread: "none",
      flow: "paginated",
      allowScriptedContent: true
    });
    state.epub.rendition = rendition;

    // Load Metadata
    book.loaded.metadata.then(meta => {
      let metaChanged = false;
      if (meta.title && state.currentBook.title !== meta.title) {
        state.currentBook.title = meta.title;
        metaChanged = true;
      }
      if (meta.creator && state.currentBook.author !== meta.creator) {
        state.currentBook.author = meta.creator;
        metaChanged = true;
      }
      updateMetadataUI();
      if (metaChanged) {
        saveActiveBookToStorage({
          type: 'epub',
          title: state.currentBook.title,
          author: state.currentBook.author,
          content: arrayBuffer,
          bookId: state.currentBook.id
        });
      }
    });

    // Load TOC
    book.loaded.navigation.then(nav => {
      state.epub.toc = nav.toc || [];
    });

    // Render initial page or restore saved location
    const savedCfi = localStorage.getItem(`reader_pos_${state.currentBook.id}`);
    rendition.display(savedCfi || undefined).then(() => {
      applyEpubThemes();
      restoreEpubHighlights();
    });

    // Check if EPUB archive has embedded reader_highlights.json
    if (state.highlights.length === 0 && typeof JSZip !== 'undefined') {
      JSZip.loadAsync(arrayBuffer).then(zip => {
        const hlFile = zip.file('META-INF/reader_highlights.json');
        if (hlFile) {
          hlFile.async('text').then(jsonText => {
            try {
              const data = JSON.parse(jsonText);
              if (Array.isArray(data.highlights) && data.highlights.length > 0) {
                state.highlights = data.highlights;
                sortHighlights();
                saveHighlights();
                updateHighlightBadge();
                if (elements.readerDrawer.classList.contains('open')) {
                  renderHighlightDrawer();
                }
                setTimeout(() => {
                  restoreEpubHighlights();
                }, 300);
              }
            } catch (e) {}
          });
        }
      }).catch(() => {});
    }

    // Generate locations for progress slider
    book.ready.then(() => {
      return book.locations.generate(1000);
    }).then(() => {
      state.epub.locationsReady = true;
      updateEpubProgress();
    });

    // Rendition Relocated event (Page changes)
    rendition.on("relocated", (location) => {
      if (location && location.start && location.start.cfi && state.currentBook) {
        localStorage.setItem(`reader_pos_${state.currentBook.id}`, location.start.cfi);
      }
      updateEpubProgress(location);
      showNavButtonsTemporarily(1800);
      setTimeout(() => {
        restoreEpubHighlights();
      }, 100);
    });

    // Rendition Rendered event
    rendition.on("rendered", () => {
      setTimeout(() => {
        restoreEpubHighlights();
      }, 100);
    });

    // Register content hook for EPUB document styling & interaction
    rendition.hooks.content.register((contents) => {
      const doc = contents.document;
      if (doc && doc.head && !doc.getElementById('reader-injected-hl-style')) {
        const style = doc.createElement('style');
        style.id = 'reader-injected-hl-style';
        const isDark = state.settings.theme === 'dark';
        style.textContent = `
          .epubjs-hl {
            cursor: pointer !important;
            pointer-events: auto !important;
            mix-blend-mode: ${isDark ? 'screen' : 'multiply'} !important;
            fill-opacity: ${isDark ? '0.4' : '0.35'} !important;
          }
          .epubjs-hl:hover {
            fill-opacity: ${isDark ? '0.55' : '0.5'} !important;
          }
          .epubjs-hl.hl-yellow { fill: #facc15 !important; }
          .epubjs-hl.hl-green  { fill: #4ade80 !important; }
          .epubjs-hl.hl-purple { fill: #c084fc !important; }
          .epubjs-hl.hl-blue   { fill: #38bdf8 !important; }
          .epubjs-hl.hl-pink   { fill: #f472b6 !important; }
        `;
        doc.head.appendChild(style);
      }

      if (doc) {
        // 스와이프 제스처 및 터치 시 네비게이션 버튼 표시
        attachSwipeGesture(doc, () => (contents.window ? contents.window.getSelection() : null));
        doc.addEventListener("click", () => { showNavButtonsTemporarily(); });

        const recordPointer = (e) => {
          const clientX = getEventCoord(e, 'clientX');
          const clientY = getEventCoord(e, 'clientY');
          lastIframeClick = {
            clientX,
            clientY,
            target: e.target,
            rect: e.target && typeof e.target.getBoundingClientRect === 'function' ? e.target.getBoundingClientRect() : null
          };

          // Check if click is on an existing highlight
          const isHl = e.target && (
            (typeof e.target.closest === 'function' && e.target.closest('.epubjs-hl')) ||
            (e.target.classList && e.target.classList.contains('epubjs-hl')) ||
            (e.target.tagName || '').toLowerCase() === 'rect'
          );
          if (!isHl && !justClickedHighlight) {
            closeAllToolbars();
          }
        };

        doc.addEventListener("pointerdown", recordPointer, true);
        doc.addEventListener("touchstart", recordPointer, { passive: true, capture: true });
        doc.addEventListener("mousedown", recordPointer, true);
      }
    });

    // Rendition Selection event (Official epub.js selection handler)
    rendition.on("selected", (cfiRange, contents) => {
      justSelectedInEpub = true;
      setTimeout(() => { justSelectedInEpub = false; }, 400);
      handleEpubSelection(cfiRange, contents);
    });

    // Click outside in epub iframe (Do not close if text is currently selected or highlight was just clicked)
    rendition.on("click", (e) => {
      if (justSelectedInEpub || justClickedHighlight) return;
      const isHl = e && e.target && (
        (typeof e.target.closest === 'function' && e.target.closest('.epubjs-hl')) ||
        (e.target.classList && e.target.classList.contains('epubjs-hl')) ||
        (e.target.tagName || '').toLowerCase() === 'rect'
      );
      if (isHl) return;

      const iframe = elements.epubArea.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        const sel = iframe.contentWindow.getSelection();
        if (sel && sel.toString().trim().length > 0) {
          return;
        }
      }
      closeAllToolbars();
    });

  } catch (err) {
    console.error('EPUB Loading Error:', err);
    showToast('EPUB 파일을 여는 중 오류가 발생했습니다.');
  }
}

function restoreEpubHighlights() {
  if (!state.epub.rendition || !state.currentBook || state.currentBook.type !== 'epub') return;
  if (!state.highlights || state.highlights.length === 0) return;

  const isDark = state.settings.theme === 'dark';

  state.highlights.forEach(hl => {
    if (hl.cfiRange) {
      const colorName = hl.color || 'yellow';
      const colorHex = getHighlightColorHex(colorName);

      // Remove existing first to avoid duplicates
      try {
        state.epub.rendition.annotations.remove(hl.cfiRange, "highlight");
      } catch (err) {}

      try {
        state.epub.rendition.annotations.add(
          "highlight",
          hl.cfiRange,
          { id: hl.id },
          (e) => {
            openHighlightToolbarFromEpub(hl, e);
          },
          `hl-${colorName}`,
          {
            "fill": colorHex,
            "fill-opacity": isDark ? "0.4" : "0.35",
            "mix-blend-mode": isDark ? "screen" : "multiply"
          }
        );
      } catch (e) {
        console.warn('Annotation restore error:', e);
      }
    }
  });
}

function getHighlightColorHex(colorName) {
  const colors = {
    yellow: '#facc15',
    green: '#4ade80',
    purple: '#c084fc',
    blue: '#38bdf8',
    pink: '#f472b6'
  };
  return colors[colorName] || '#facc15';
}

function updateEpubProgress(location) {
  if (!state.epub.book || !state.epub.locationsReady) return;

  const currentLocation = location || state.epub.rendition.currentLocation();
  if (currentLocation && currentLocation.start) {
    if (state.currentBook) {
      localStorage.setItem(`reader_pos_${state.currentBook.id}`, currentLocation.start.cfi);
    }
    const progress = state.epub.book.locations.percentageFromCfi(currentLocation.start.cfi);
    const pct = Math.round(progress * 100);
    elements.progressSlider.value = pct;
    elements.progressPercent.textContent = `${pct}%`;

    // Chapter title
    if (state.epub.toc.length > 0 && currentLocation.start.href) {
      const currentChapter = state.epub.toc.find(item => currentLocation.start.href.includes(item.href));
      if (currentChapter) {
        elements.currentChapterTitle.textContent = currentChapter.label.trim();
      }
    }
  }
}

// ── Text Selection & Floating Toolbar Handling ──

// TXT Viewer Selection
document.addEventListener('mousedown', (e) => {
  if (e.target.closest('#selection-toolbar') || e.target.closest('#highlight-toolbar') || e.target.closest('#settings-popover') || e.target.closest('.ai-modal') || e.target.closest('.meta-edit-modal')) {
    return;
  }
  closeAllToolbars();
});

document.addEventListener('mouseup', (e) => {
  if (e.target.closest('#selection-toolbar') || e.target.closest('#highlight-toolbar') || e.target.closest('#settings-popover') || e.target.closest('.ai-modal') || e.target.closest('.meta-edit-modal')) {
    return;
  }

  if (state.currentBook && state.currentBook.type === 'txt') {
    setTimeout(() => {
      handleTxtSelection();
    }, 20);
  }
});

function handleTxtSelection() {
  const sel = window.getSelection();
  const selectedText = sel ? sel.toString().trim() : "";

  if (!selectedText || selectedText.length < 1) {
    elements.selectionToolbar.style.display = 'none';
    return;
  }

  // Check if selection is within txt-viewer
  const range = sel.getRangeAt(0);
  const commonAncestor = range.commonAncestorContainer;
  const pElem = commonAncestor.nodeType === 1 ? commonAncestor.closest('p') : commonAncestor.parentElement.closest('p');

  if (!pElem || !elements.txtContent.contains(pElem)) {
    elements.selectionToolbar.style.display = 'none';
    return;
  }

  const pIdx = parseInt(pElem.dataset.pIdx, 10);
  const fullParagraph = pElem.textContent;
  const context = extractContextFromText(fullParagraph, selectedText);
  const startOffset = fullParagraph.indexOf(selectedText);

  const rect = range.getBoundingClientRect();
  state.activeSelection = {
    text: selectedText,
    targetSentence: context.targetSentence,
    prevSentence: context.prevSentence,
    nextSentence: context.nextSentence,
    pIdx,
    offset: startOffset >= 0 ? startOffset : 0,
    range: range.cloneRange(),
    rect
  };

  showFloatingToolbar(rect);
}

// EPUB Viewer Selection
function handleEpubSelection(cfiRange, contents) {
  const sel = contents.window.getSelection();
  const selectedText = sel ? sel.toString().trim() : "";

  if (!selectedText) {
    elements.selectionToolbar.style.display = 'none';
    return;
  }

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const iframeRect = elements.epubArea.querySelector('iframe').getBoundingClientRect();

  // Convert iframe rect to page rect
  const absRect = {
    top: iframeRect.top + rect.top,
    left: iframeRect.left + rect.left,
    width: rect.width,
    height: rect.height
  };

  // Extract surrounding paragraph text
  const parentP = range.commonAncestorContainer.nodeType === 1
    ? range.commonAncestorContainer.closest('p, div, section')
    : range.commonAncestorContainer.parentElement.closest('p, div, section');

  const fullParagraph = parentP ? parentP.textContent : selectedText;
  const context = extractContextFromText(fullParagraph, selectedText);

  state.activeSelection = {
    text: selectedText,
    targetSentence: context.targetSentence,
    prevSentence: context.prevSentence,
    nextSentence: context.nextSentence,
    cfiRange,
    contents,
    range: range.cloneRange(),
    rect: absRect
  };

  showFloatingToolbar(absRect);
}

function showFloatingToolbar(rect) {
  closeAllToolbars();
  const tb = elements.selectionToolbar;
  tb.style.display = 'flex';

  const tbWidth = tb.offsetWidth || 280;
  const tbHeight = tb.offsetHeight || 44;
  const x = rect.left + (rect.width / 2);
  let y = rect.top + window.scrollY;

  const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
  let placeBelow = false;
  let extraOffset = 0;

  if (isMobile) {
    // 모바일 OS(iOS Safari / Chrome) 자체 상황 팝업(복사/찾아보기 등) 위치를 동적으로 회피:
    // - 화면 상단~중간 살짝 위(약 44% 지점 이하): 모바일 OS 팝업이 글자 '아래'에 나타나므로, 앱 팝업은 글자 '위'에 배치
    // - 화면 중간 아래(약 44% 초과): 모바일 OS 팝업이 글자 '위'에 나타나므로, 앱 팝업은 글자 '아래'에 배치
    // - 단, 글자가 최상단(top < 120px)에 위치해 상단 여백이 좁은 경우: OS 팝업(약 44px) 아래쪽으로 추가 오프셋 배치
    const viewportY = rect.top;
    const isUpperHalf = viewportY <= window.innerHeight * 0.44;

    if (isUpperHalf) {
      if (viewportY < 120) {
        placeBelow = true;
        extraOffset = 54; // OS 팝업 높이(약 44px) + 여백(10px)을 피해 아래에 배치
      } else {
        placeBelow = false;
      }
    } else {
      placeBelow = true;
      extraOffset = 0;
    }
  } else {
    // 데스크톱: 상단 여백이 좁으면 하단 배치, 충분하면 상단 배치
    placeBelow = (y - tbHeight - 15 < window.scrollY + 60);
  }

  if (placeBelow) {
    tb.classList.add('flipped');
    tb.style.transform = 'translate(-50%, 0)';
    y = rect.top + (rect.height || 22) + window.scrollY + 8 + extraOffset;
  } else {
    tb.classList.remove('flipped');
    tb.style.transform = 'translate(-50%, -100%) translateY(-8px)';
    y = rect.top + window.scrollY - 8;
  }

  const clampedX = Math.max(tbWidth / 2 + 10, Math.min(window.innerWidth - tbWidth / 2 - 10, x));
  tb.style.left = `${clampedX}px`;
  tb.style.top = `${y}px`;
}

function closeAllToolbars() {
  if (elements.selectionToolbar) elements.selectionToolbar.style.display = 'none';
  if (elements.highlightToolbar) elements.highlightToolbar.style.display = 'none';
  if (elements.settingsPopover) elements.settingsPopover.classList.remove('open');
}

// ── Highlight Actions ──
function applyHighlight(colorName) {
  if (!state.activeSelection) return;

  // 1. Deduplication check: see if highlight at same range or exact text+target already exists
  const existingIdx = state.highlights.findIndex(h => {
    if (state.currentBook.type === 'epub' && h.cfiRange && state.activeSelection.cfiRange) {
      return h.cfiRange === state.activeSelection.cfiRange;
    }
    if (state.currentBook.type === 'txt' && h.pIdx !== undefined && state.activeSelection.pIdx !== undefined) {
      return h.pIdx === state.activeSelection.pIdx && h.text === state.activeSelection.text;
    }
    return h.text === state.activeSelection.text && h.targetSentence === state.activeSelection.targetSentence;
  });

  let hlId;
  let targetHighlight;

  if (existingIdx !== -1) {
    targetHighlight = state.highlights[existingIdx];
    targetHighlight.color = colorName;
    hlId = targetHighlight.id;
  } else {
    hlId = `hl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    targetHighlight = {
      id: hlId,
      color: colorName,
      text: state.activeSelection.text,
      targetSentence: state.activeSelection.targetSentence,
      prevSentence: state.activeSelection.prevSentence,
      nextSentence: state.activeSelection.nextSentence,
      createdAt: new Date().toISOString(),
      note: ''
    };

    if (state.currentBook.type === 'txt') {
      targetHighlight.pIdx = state.activeSelection.pIdx;
      targetHighlight.offset = state.activeSelection.offset ?? 0;
    } else if (state.currentBook.type === 'epub') {
      targetHighlight.cfiRange = state.activeSelection.cfiRange;
    }

    state.highlights.push(targetHighlight);
  }

  sortHighlights();
  saveHighlights();

  if (state.currentBook.type === 'txt') {
    renderTxtContent();
  } else if (state.currentBook.type === 'epub') {
    const isDark = state.settings.theme === 'dark';
    try {
      if (state.activeSelection.cfiRange) {
        try {
          state.epub.rendition.annotations.remove(state.activeSelection.cfiRange, "highlight");
        } catch (e) {}

        state.epub.rendition.annotations.add(
          "highlight",
          state.activeSelection.cfiRange,
          { id: hlId },
          (e) => {
            openHighlightToolbarFromEpub(targetHighlight, e);
          },
          `hl-${colorName}`,
          {
            "fill": getHighlightColorHex(colorName),
            "fill-opacity": isDark ? "0.4" : "0.35",
            "mix-blend-mode": isDark ? "screen" : "multiply"
          }
        );
      }
    } catch (e) {
      console.warn(e);
    }

    if (state.activeSelection.contents) {
      state.activeSelection.contents.window.getSelection().removeAllRanges();
    }
  }

  closeAllToolbars();
  showToast('형광펜이 추가되었습니다.');
}

function showHighlightToolbar(rect) {
  closeAllToolbars();
  const tb = elements.highlightToolbar;
  tb.style.display = 'flex';

  const tbWidth = tb.offsetWidth || 220;
  const tbHeight = tb.offsetHeight || 44;
  const x = rect.left + (rect.width / 2);
  let y = rect.top + window.scrollY;

  const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
  const placeBelow = isMobile || (y - tbHeight - 12 < window.scrollY + 70);

  if (placeBelow) {
    tb.classList.add('flipped');
    tb.style.transform = 'translate(-50%, 0)';
    y = rect.top + (rect.height || 22) + window.scrollY + 8;
  } else {
    tb.classList.remove('flipped');
    tb.style.transform = 'translate(-50%, -100%) translateY(-8px)';
    y = rect.top + window.scrollY - 8;
  }

  const clampedX = Math.max(tbWidth / 2 + 12, Math.min(window.innerWidth - tbWidth / 2 - 12, x));
  tb.style.left = `${clampedX}px`;
  tb.style.top = `${y}px`;
}

function openHighlightToolbar(hl, elem) {
  state.activeHighlight = hl;
  const rect = elem.getBoundingClientRect();
  showHighlightToolbar(rect);
}

function openHighlightToolbarFromEpub(hl, e) {
  state.activeHighlight = hl;
  justClickedHighlight = true;
  setTimeout(() => { justClickedHighlight = false; }, 300);

  const iframe = elements.epubArea.querySelector('iframe');
  if (!iframe) return;
  const iframeRect = iframe.getBoundingClientRect();
  const iframeDoc = iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);

  const tryShowWithRect = (r) => {
    if (r && (r.width > 0 || r.height > 0) && r.height < 400) {
      showHighlightToolbar({
        top: iframeRect.top + r.top,
        left: iframeRect.left + r.left,
        width: r.width,
        height: r.height
      });
      return true;
    }
    return false;
  };

  // 1. Primary: Try to resolve exact live DOM Range via ePub.CFI directly in the rendered iframe document
  if (iframeDoc && hl.cfiRange && typeof ePub !== 'undefined' && ePub.CFI) {
    try {
      const cfi = new ePub.CFI(hl.cfiRange);
      if (typeof cfi.toRange === 'function') {
        const domRange = cfi.toRange(iframeDoc);
        if (domRange && typeof domRange.getBoundingClientRect === 'function') {
          const rRect = domRange.getBoundingClientRect();
          if (tryShowWithRect(rRect)) return;
        }
      }
    } catch (err) {
      console.warn('DOM Range resolution via CFI error:', err);
    }
  }

  // 2. Try target element from event (or its parent group)
  const target = (e && e.target) ? e.target : (lastIframeClick ? lastIframeClick.target : null);
  if (target) {
    const hlGroup = (typeof target.closest === 'function') ? target.closest('.epubjs-hl') : null;
    const targetEl = hlGroup || target;
    if (typeof targetEl.getBoundingClientRect === 'function') {
      const tRect = targetEl.getBoundingClientRect();
      if (tryShowWithRect(tRect)) return;
    }
  }

  // 3. Try to find highlight element in iframe DOM intersecting with click position
  const clientX = getEventCoord(e, 'clientX') ?? (lastIframeClick ? lastIframeClick.clientX : undefined);
  const clientY = getEventCoord(e, 'clientY') ?? (lastIframeClick ? lastIframeClick.clientY : undefined);

  if (iframeDoc && clientX !== undefined && clientY !== undefined) {
    try {
      const hlElements = iframeDoc.querySelectorAll('.epubjs-hl rect, .epubjs-hl');
      for (const el of hlElements) {
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left - 10 && clientX <= rect.right + 10 &&
            clientY >= rect.top - 10 && clientY <= rect.bottom + 10) {
          if (tryShowWithRect(rect)) return;
        }
      }
    } catch (err) {}
  }

  // 4. Fallback to event coordinates (supporting mouse and mobile touch)
  if (clientX !== undefined && clientY !== undefined && clientX > 0 && clientY > 0) {
    showHighlightToolbar({
      top: iframeRect.top + clientY,
      left: iframeRect.left + clientX,
      width: 0,
      height: 20
    });
    return;
  }

  // 5. Final fallback: center of reading area
  showHighlightToolbar({
    top: iframeRect.top + (iframeRect.height / 3),
    left: iframeRect.left + (iframeRect.width / 2),
    width: 0,
    height: 20
  });
}

function getEventCoord(e, coordName) {
  if (!e) return undefined;
  if (e[coordName] !== undefined && e[coordName] > 0) return e[coordName];
  if (e.touches && e.touches.length > 0 && e.touches[0][coordName] !== undefined) {
    return e.touches[0][coordName];
  }
  if (e.changedTouches && e.changedTouches.length > 0 && e.changedTouches[0][coordName] !== undefined) {
    return e.changedTouches[0][coordName];
  }
  return undefined;
}

function removeHighlight(hlId) {
  const idx = state.highlights.findIndex(h => h.id === hlId);
  if (idx === -1) return;

  const hl = state.highlights[idx];
  state.highlights.splice(idx, 1);
  saveHighlights();

  if (state.currentBook.type === 'txt') {
    renderTxtContent();
  } else if (state.currentBook.type === 'epub' && state.epub.rendition && hl.cfiRange) {
    try {
      state.epub.rendition.annotations.remove(hl.cfiRange, "highlight");
    } catch (e) {
      console.warn(e);
    }
  }

  closeAllToolbars();
  showToast('형광펜이 삭제되었습니다.');
  if (elements.readerDrawer.classList.contains('open')) {
    renderHighlightDrawer();
  }
}

// ── AI Google Search Direct Execution ──
function triggerGoogleAISearch(contextData) {
  closeAllToolbars();

  const targetSentence = contextData.targetSentence || contextData.text || "";
  const prevSentence = contextData.prevSentence || "";
  const nextSentence = contextData.nextSentence || "";
  const author = state.currentBook ? state.currentBook.author : "";
  const bookTitle = state.currentBook ? state.currentBook.title : "";

  const promptText = buildAISearchPrompt({
    targetSentence,
    prevSentence,
    nextSentence,
    author,
    bookTitle
  });

  if (promptText) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(promptText).catch(() => {});
    }
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(promptText)}&udm=50`;
    window.open(searchUrl, '_blank');
  }
}

// ── Drawer (TOC & Highlights) ──
function openDrawer(mode) {
  closeAllToolbars();
  elements.readerDrawer.classList.add('open');
  elements.drawerBackdrop.classList.add('open');

  if (mode === 'toc') {
    elements.drawerIcon.textContent = '📑';
    elements.drawerTitle.textContent = '목차 (Table of Contents)';
    renderTocDrawer();
  } else {
    elements.drawerIcon.textContent = '🖍️';
    elements.drawerTitle.textContent = `형광펜 목록 (${state.highlights.length}개)`;
    renderHighlightDrawer();
  }
}

function closeDrawer() {
  elements.readerDrawer.classList.remove('open');
  elements.drawerBackdrop.classList.remove('open');
}

function renderTocDrawer() {
  elements.drawerBody.innerHTML = '';
  if (!state.epub.toc || state.epub.toc.length === 0) {
    elements.drawerBody.innerHTML = '<p style="color:var(--text-muted); padding:20px; text-align:center;">목차 정보가 없습니다.</p>';
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'toc-list';
  state.epub.toc.forEach(item => {
    const li = document.createElement('li');
    li.className = 'toc-item';
    li.textContent = item.label ? item.label.trim() : 'Chapter';
    li.addEventListener('click', () => {
      if (state.epub.rendition) {
        state.epub.rendition.display(item.href);
      }
      closeDrawer();
    });
    ul.appendChild(li);
  });
  elements.drawerBody.appendChild(ul);
}

function renderHighlightDrawer() {
  elements.drawerBody.innerHTML = '';
  sortHighlights();

  if (!state.highlights || state.highlights.length === 0) {
    elements.drawerBody.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
        <div style="font-size:32px; margin-bottom:12px;">🖍️</div>
        <p>저장된 형광펜 구문이 없습니다.</p>
        <p style="font-size:13px; margin-top:6px;">본문의 텍스트를 드래그하여 형광펜을 추가해보세요.</p>
      </div>
    `;
    return;
  }

  // Render cards
  state.highlights.forEach(hl => {
    const card = document.createElement('div');
    card.className = 'highlight-card';

    const colorHex = getHighlightColorHex(hl.color || 'yellow');
    const dateStr = hl.createdAt ? new Date(hl.createdAt).toLocaleDateString() : '';

    card.innerHTML = `
      <div class="highlight-card-header">
        <span style="display:flex; align-items:center; gap:6px;">
          <span class="hl-badge-color" style="background-color: ${colorHex};"></span>
          <span>${dateStr}</span>
        </span>
      </div>
      <div class="highlight-card-text">${escapeHtml(hl.text)}</div>
      ${hl.note ? `<div class="highlight-card-note">💬 ${escapeHtml(hl.note)}</div>` : ''}
      <div class="highlight-card-actions">
        <button type="button" class="btn-card-action btn-card-ai" title="AI 문맥 분석">🤖 AI 질문</button>
        <button type="button" class="btn-card-action btn-card-note" title="메모">${hl.note ? '메모 수정' : '메모 추가'}</button>
        <button type="button" class="btn-card-action danger btn-card-del" title="삭제">삭제</button>
      </div>
    `;

    // Click card to jump to location
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-card-action')) return;

      if (state.currentBook.type === 'txt') {
        const mark = elements.txtContent.querySelector(`[data-hl-id="${hl.id}"]`);
        if (mark) {
          mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          mark.style.outline = '2px solid var(--accent)';
          setTimeout(() => { mark.style.outline = 'none'; }, 1500);
        }
      } else if (state.currentBook.type === 'epub' && state.epub.rendition && hl.cfiRange) {
        state.epub.rendition.display(hl.cfiRange);
      }
      closeDrawer();
    });

    // AI Button in card
    card.querySelector('.btn-card-ai').addEventListener('click', (e) => {
      e.stopPropagation();
      triggerGoogleAISearch(hl);
    });

    // Note button in card
    card.querySelector('.btn-card-note').addEventListener('click', (e) => {
      e.stopPropagation();
      const newNote = prompt('메모를 입력하세요:', hl.note || '');
      if (newNote !== null) {
        hl.note = newNote.trim();
        saveHighlights();
        renderHighlightDrawer();
      }
    });

    // Delete button in card
    card.querySelector('.btn-card-del').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('이 형광펜을 삭제하시겠습니까?')) {
        removeHighlight(hl.id);
      }
    });

    elements.drawerBody.appendChild(card);
  });
}

// ── Metadata UI & Editing ──
function updateMetadataUI() {
  if (!state.currentBook) {
    elements.displayTitle.textContent = '도서를 선택해주세요';
    elements.displayAuthor.textContent = '저자 미지정';
    return;
  }
  elements.displayTitle.textContent = state.currentBook.title || 'Untitled';
  elements.displayAuthor.textContent = state.currentBook.author || '저자 미지정';
}

function openMetaModal() {
  if (!state.currentBook) return;
  elements.inputEditTitle.value = state.currentBook.title || '';
  elements.inputEditAuthor.value = state.currentBook.author || '';
  elements.metaEditModal.classList.add('open');
}

function closeMetaModal() {
  elements.metaEditModal.classList.remove('open');
}

function saveMetaEdits() {
  if (!state.currentBook) return;
  state.currentBook.title = elements.inputEditTitle.value.trim() || 'Untitled';
  state.currentBook.author = elements.inputEditAuthor.value.trim();
  updateMetadataUI();
  closeMetaModal();
  saveActiveBookToStorage({
    type: state.currentBook.type,
    title: state.currentBook.title,
    author: state.currentBook.author,
    content: state.currentBook.content,
    bookId: state.currentBook.id
  });
  showToast('도서 정보가 업데이트되었습니다.');
}

// ── Setup Event Listeners ──
function setupEventListeners() {
  // Mobile nav toggle
  if (elements.navToggle && elements.navMenu) {
    elements.navToggle.addEventListener('click', () => {
      elements.navMenu.classList.toggle('open');
    });
  }

  // File Input Listeners
  elements.bookFileInput.addEventListener('change', (e) => {
    handleFileSelection(e.target.files[0]);
    e.target.value = '';
  });
  elements.emptyFileInput.addEventListener('change', (e) => {
    handleFileSelection(e.target.files[0]);
    e.target.value = '';
  });

  // Sample Book & Export buttons
  if (elements.btnExportBook) {
    elements.btnExportBook.addEventListener('click', exportBookWithHighlights);
  }
  if (elements.btnLoadSample) {
    elements.btnLoadSample.addEventListener('click', loadSampleBook);
  }
  if (elements.btnEmptySample) {
    elements.btnEmptySample.addEventListener('click', loadSampleBook);
  }

  // Meta click
  elements.displayTitle.parentElement.addEventListener('click', openMetaModal);
  elements.btnEditMeta.addEventListener('click', openMetaModal);
  elements.btnCancelMeta.addEventListener('click', closeMetaModal);
  elements.btnSaveMeta.addEventListener('click', saveMetaEdits);

  // Drawer toggles
  elements.btnToggleToc.addEventListener('click', () => openDrawer('toc'));
  elements.btnToggleHighlights.addEventListener('click', () => openDrawer('highlights'));
  elements.btnDrawerClose.addEventListener('click', closeDrawer);
  elements.drawerBackdrop.addEventListener('click', closeDrawer);

  // Settings popover
  elements.btnToggleSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.settingsPopover.classList.toggle('open');
    if (elements.settingsPopover.classList.contains('open')) {
      positionSettingsPopover();
    }
  });

  window.addEventListener('resize', () => {
    if (elements.settingsPopover && elements.settingsPopover.classList.contains('open')) {
      positionSettingsPopover();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#settings-popover') && !e.target.closest('#btn-toggle-settings')) {
      elements.settingsPopover.classList.remove('open');
    }
  });

  // Theme buttons
  elements.themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.theme = btn.dataset.theme;
      applySettings();
      saveSettings();
    });
  });

  // Line Height decrease / increase buttons
  if (elements.btnLhDecrease) {
    elements.btnLhDecrease.addEventListener('click', () => {
      if (state.settings.lineHeight > 1.05) {
        state.settings.lineHeight = Math.round((state.settings.lineHeight - 0.1) * 10) / 10;
        applySettings();
        saveSettings();
      }
    });
  }
  if (elements.btnLhIncrease) {
    elements.btnLhIncrease.addEventListener('click', () => {
      if (state.settings.lineHeight < 2.6) {
        state.settings.lineHeight = Math.round((state.settings.lineHeight + 0.1) * 10) / 10;
        applySettings();
        saveSettings();
      }
    });
  }

  // Font Size buttons
  elements.btnFontDecrease.addEventListener('click', () => {
    if (state.settings.fontSize > 12) {
      state.settings.fontSize -= 2;
      applySettings();
      saveSettings();
    }
  });
  elements.btnFontIncrease.addEventListener('click', () => {
    if (state.settings.fontSize < 36) {
      state.settings.fontSize += 2;
      applySettings();
      saveSettings();
    }
  });

  // Font Family select
  elements.fontFamilySelect.addEventListener('change', (e) => {
    state.settings.fontFamily = e.target.value;
    applySettings();
    saveSettings();
  });

  // EPUB Nav arrows
  elements.btnEpubPrev.addEventListener('click', () => {
    if (state.epub.rendition) state.epub.rendition.prev();
    showNavButtonsTemporarily(2000);
  });
  elements.btnEpubNext.addEventListener('click', () => {
    if (state.epub.rendition) state.epub.rendition.next();
    showNavButtonsTemporarily(2000);
  });

  // 뷰어 영역 스와이프 제스처 및 터치 시 화살표 일시 표시
  if (elements.epubViewer) {
    attachSwipeGesture(elements.epubViewer);
    elements.epubViewer.addEventListener('click', () => { showNavButtonsTemporarily(); });
    elements.epubViewer.addEventListener('mousemove', () => { showNavButtonsTemporarily(); });
  }
  if (elements.txtViewer) {
    attachSwipeGesture(elements.txtViewer);
  }

  // 데스크톱 마우스 호버 시 화살표 유지 처리
  if (elements.btnEpubPrev) {
    elements.btnEpubPrev.addEventListener('mouseenter', () => {
      if (navButtonsTimer) clearTimeout(navButtonsTimer);
      elements.btnEpubPrev.classList.add('visible');
      elements.btnEpubNext.classList.add('visible');
    });
    elements.btnEpubPrev.addEventListener('mouseleave', () => {
      showNavButtonsTemporarily(1500);
    });
  }
  if (elements.btnEpubNext) {
    elements.btnEpubNext.addEventListener('mouseenter', () => {
      if (navButtonsTimer) clearTimeout(navButtonsTimer);
      elements.btnEpubPrev.classList.add('visible');
      elements.btnEpubNext.classList.add('visible');
    });
    elements.btnEpubNext.addEventListener('mouseleave', () => {
      showNavButtonsTemporarily(1500);
    });
  }

  // Progress Slider input
  elements.progressSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    elements.progressPercent.textContent = `${val}%`;

    if (state.currentBook && state.currentBook.type === 'txt') {
      const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
      elements.txtViewer.scrollTop = (val / 100) * scrollHeight;
    } else if (state.currentBook && state.currentBook.type === 'epub' && state.epub.locationsReady) {
      const cfi = state.epub.book.locations.cfiFromPercentage(val / 100);
      if (cfi) state.epub.rendition.display(cfi);
    }
  });

  // Keyboard navigation for EPUB
  window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

    if (state.currentBook && state.currentBook.type === 'epub' && state.epub.rendition) {
      if (e.key === 'ArrowLeft') {
        state.epub.rendition.prev();
      } else if (e.key === 'ArrowRight') {
        state.epub.rendition.next();
      }
    }
  });

  // Floating Selection Toolbar Buttons
  document.querySelectorAll('#selection-toolbar .color-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      applyHighlight(dot.dataset.color);
    });
  });

  elements.btnToolbarAi.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.activeSelection) {
      triggerGoogleAISearch(state.activeSelection);
    }
  });

  elements.btnToolbarCopy.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.activeSelection && state.activeSelection.text) {
      navigator.clipboard.writeText(state.activeSelection.text).then(() => {
        showToast('텍스트가 클립보드에 복사되었습니다.');
      });
      closeAllToolbars();
    }
  });

  // Highlight Popover Toolbar Buttons
  elements.btnHlAi.addEventListener('click', () => {
    if (state.activeHighlight) {
      triggerGoogleAISearch(state.activeHighlight);
    }
  });

  elements.btnHlNote.addEventListener('click', () => {
    if (state.activeHighlight) {
      const note = prompt('메모를 입력하세요:', state.activeHighlight.note || '');
      if (note !== null) {
        state.activeHighlight.note = note.trim();
        saveHighlights();
        showToast('메모가 저장되었습니다.');
      }
      closeAllToolbars();
    }
  });

  elements.btnHlRemove.addEventListener('click', () => {
    if (state.activeHighlight) {
      removeHighlight(state.activeHighlight.id);
    }
  });

  // AI Modal Listeners (if modal is present)
  if (elements.btnCloseAiModal) {
    elements.btnCloseAiModal.addEventListener('click', () => {
      if (elements.aiModalBackdrop) elements.aiModalBackdrop.classList.remove('open');
    });
  }
  if (elements.aiModalBackdrop) {
    elements.aiModalBackdrop.addEventListener('click', (e) => {
      if (e.target === elements.aiModalBackdrop) elements.aiModalBackdrop.classList.remove('open');
    });
  }

  // Copy Prompt
  if (elements.btnCopyPrompt) {
    elements.btnCopyPrompt.addEventListener('click', () => {
      const promptText = elements.aiPromptInput ? elements.aiPromptInput.value : '';
      navigator.clipboard.writeText(promptText).then(() => {
        showToast('AI 프롬프트가 클립보드에 복사되었습니다.');
      });
    });
  }

  // Launch Google AI Search
  if (elements.btnLaunchGoogle) {
    elements.btnLaunchGoogle.addEventListener('click', () => {
      const promptText = elements.aiPromptInput ? elements.aiPromptInput.value : '';
      if (promptText) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(promptText)}&udm=50`;
        window.open(searchUrl, '_blank');
      }
    });
  }

  // Launch Gemini
  if (elements.btnLaunchGemini) {
    elements.btnLaunchGemini.addEventListener('click', () => {
      const promptText = elements.aiPromptInput ? elements.aiPromptInput.value : '';
      navigator.clipboard.writeText(promptText).then(() => {
        showToast('프롬프트 복사 완료! Gemini에 붙여넣으세요.');
        window.open('https://gemini.google.com/app', '_blank');
      });
    });
  }

  // Launch ChatGPT
  if (elements.btnLaunchChatgpt) {
    elements.btnLaunchChatgpt.addEventListener('click', () => {
      const promptText = elements.aiPromptInput ? elements.aiPromptInput.value : '';
      navigator.clipboard.writeText(promptText).then(() => {
        showToast('프롬프트 복사 완료! ChatGPT에 붙여넣으세요.');
        window.open('https://chatgpt.com/', '_blank');
      });
    });
  }

  // 탭 전환 / 다른 앱 전환 시 현재 위치(CFI 또는 스크롤) 즉시 보존
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state.currentBook) {
      saveCurrentReadingPosition();
    }
  });

  window.addEventListener('pagehide', () => {
    if (state.currentBook) {
      saveCurrentReadingPosition();
    }
  });
}

function saveCurrentReadingPosition() {
  if (!state.currentBook) return;
  if (state.currentBook.type === 'epub' && state.epub.rendition) {
    try {
      const loc = state.epub.rendition.currentLocation();
      if (loc && loc.start && loc.start.cfi) {
        localStorage.setItem(`reader_pos_${state.currentBook.id}`, loc.start.cfi);
      }
    } catch (e) {}
  } else if (state.currentBook.type === 'txt' && elements.txtViewer) {
    const scrollTop = elements.txtViewer.scrollTop;
    const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
    if (scrollHeight > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((scrollTop / scrollHeight) * 100)));
      localStorage.setItem(`reader_pos_${state.currentBook.id}`, pct);
    }
  }
}

// ── 기존에 읽던 도서 복원 ──
async function restoreActiveBook() {
  try {
    const record = await loadActiveBookFromStorage();
    if (!record || !record.content) return;

    if (record.type === 'epub') {
      openEpubBook(record.title, record.author, record.content, record.bookId, true);
    } else if (record.type === 'txt') {
      openTxtBook(record.title, record.author, record.content, record.bookId, true);
    }
  } catch (err) {
    console.warn('Failed to restore active book from IndexedDB:', err);
  }
}

// ── Initialization ──
window.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  setupEventListeners();
  await restoreActiveBook();
});
