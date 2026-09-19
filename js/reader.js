/**
 * ══════════════════════════════════════════════════════
 * reader.js — 영어 읽기 (Text & EPUB) + 형광펜 + AI 질문
 * ══════════════════════════════════════════════════════
 */

// ── Range.setStart / setEnd DOM Guard & ePub.CFI toRange Guard for ePub.js ──
// Prevents "Uncaught IndexSizeError: Failed to execute 'setStart'/'setEnd' on 'Range': There is no child at offset X"
function patchRangeForEpub(win) {
  if (!win || !win.Range || win.Range.prototype._patchedForEpub) return;
  const proto = win.Range.prototype;
  const origSetStart = proto.setStart;
  const origSetEnd = proto.setEnd;

  proto.setStart = function(node, offset) {
    if (!node) return;
    try {
      const max = (node.nodeType === 3 || node.nodeType === 4 || node.nodeType === 8)
        ? (typeof node.length === 'number' ? node.length : (node.nodeValue ? node.nodeValue.length : 0))
        : (node.childNodes ? node.childNodes.length : 0);
      const safeOffset = Math.max(0, Math.min(typeof offset === 'number' && !isNaN(offset) ? offset : 0, max));
      return origSetStart.call(this, node, safeOffset);
    } catch (err) {
      try {
        return origSetStart.call(this, node, 0);
      } catch (e) {}
    }
  };

  proto.setEnd = function(node, offset) {
    if (!node) return;
    try {
      const max = (node.nodeType === 3 || node.nodeType === 4 || node.nodeType === 8)
        ? (typeof node.length === 'number' ? node.length : (node.nodeValue ? node.nodeValue.length : 0))
        : (node.childNodes ? node.childNodes.length : 0);
      const safeOffset = Math.max(0, Math.min(typeof offset === 'number' && !isNaN(offset) ? offset : 0, max));
      return origSetEnd.call(this, node, safeOffset);
    } catch (err) {
      try {
        return origSetEnd.call(this, node, 0);
      } catch (e) {}
    }
  };

  try {
    win.addEventListener('error', (e) => {
      if (e && e.message && (e.message.includes("setStart") || e.message.includes("setEnd")) && e.message.includes("Range")) {
        console.warn('Suppressed iframe Range boundary error:', e.message);
        e.preventDefault();
      }
    });
  } catch (e) {}

  proto._patchedForEpub = true;
}

patchRangeForEpub(window);

function patchEpubCfi() {
  if (typeof ePub !== 'undefined' && ePub.CFI && ePub.CFI.prototype && !ePub.CFI.prototype._patchedForSafeRange) {
    const origToRange = ePub.CFI.prototype.toRange;
    ePub.CFI.prototype.toRange = function(_doc, ignoreClass) {
      const doc = _doc || (typeof document !== 'undefined' ? document : null);
      if (doc) {
        const win = doc.defaultView || (doc.ownerDocument && doc.ownerDocument.defaultView);
        if (win) {
          patchRangeForEpub(win);
        }
      }
      try {
        return origToRange.call(this, _doc, ignoreClass);
      } catch (err) {
        console.warn('ePub.CFI.toRange safely handled boundary error:', err);
        try {
          return doc ? doc.createRange() : null;
        } catch (e) {
          return null;
        }
      }
    };
    ePub.CFI.prototype._patchedForSafeRange = true;
  }
}

patchEpubCfi();

window.addEventListener('error', (e) => {
  if (e && e.message && (e.message.includes("setStart") || e.message.includes("setEnd")) && e.message.includes("Range")) {
    console.warn('Suppressed unhandled Range boundary error:', e.message);
    e.preventDefault();
  }
});

// ── State Management ──
const state = {
  currentBook: null, // { type: 'txt'|'epub', title: '', author: '', rawContent: any, id: '' }
  highlights: [],    // Array of highlight objects
  bookmarks: [],     // Array of bookmark objects
  bookmarkSortMode: 'position', // 'position' | 'latest'
  highlightSearchQuery: '', // Current search query in highlights drawer
  settings: {
    theme: 'light',
    fontSize: 18,
    lineHeight: 1.8,
    fontFamily: 'serif',
    copySearchHighlights: true,
    aiAutoAnalysis: true,
  },
  epub: {
    book: null,
    rendition: null,
    toc: [],
    locationsReady: false,
    resizeObserver: null,
    currentCfi: null,
    pendingRestoreCfi: null,
    isResizing: false,
  },
  txt: {
    currentRatio: 0,
    isResizing: false,
  },
  activeSelection: null, // { text, targetSentence, prevSentence, nextSentence, cfiRange, range, rect }
  activeHighlight: null, // clicked highlight item
  activeColor: 'yellow', // currently selected highlight color
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
function showToast(msg, duration = 2200) {
  const toast = document.getElementById('reader-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// ── DOM Elements ──
const elements = {
  navToggle: document.getElementById('nav-toggle'),
  navMenu: document.getElementById('nav-menu'),

  // Meta & Topbar
  displayTitle: document.getElementById('title-text'),
  displayAuthor: document.getElementById('display-book-author'),
  btnEditMeta: document.getElementById('btn-edit-meta'),
  btnResetDb: document.getElementById('btn-reset-db'),
  btnResetDbMobile: document.getElementById('btn-reset-db-mobile'),
  btnOpenFile: document.getElementById('btn-open-file'),
  fileListView: document.getElementById('file-list-view'),
  readerApp: document.getElementById('reader-app'),
  fileCardsList: document.getElementById('file-cards-list'),
  listFileInput: document.getElementById('list-file-input'),
  bookFileInput: document.getElementById('book-file-input'),
  emptyFileInput: document.getElementById('empty-file-input'),
  btnExportBook: document.getElementById('btn-export-book'),
  btnLoadSample: document.getElementById('btn-load-sample'),
  btnEmptySample: document.getElementById('btn-empty-sample'),
  btnToggleToc: document.getElementById('btn-toggle-toc'),
  btnToggleBookmarks: document.getElementById('btn-toggle-bookmarks'),
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
  btnBottomBookmark: document.getElementById('btn-bottom-bookmark'),

  // Toolbars & Menus
  selectionMenuBar: document.getElementById('selection-menu-bar'),
  btnMenuHighlight: document.getElementById('btn-menu-highlight'),
  btnMenuEditWord: document.getElementById('btn-menu-edit-word') || document.getElementById('btn-menu-highlight'),
  btnMenuAi: document.getElementById('btn-menu-ai'),
  btnMenuCopy: document.getElementById('btn-menu-copy'),
  highlightToolbar: document.getElementById('highlight-toolbar'),
  btnHlAi: document.getElementById('btn-hl-ai'),
  btnHlEdit: document.getElementById('btn-hl-edit'),
  btnHlRemove: document.getElementById('btn-hl-remove'),
  hlToolbarMeaning: document.getElementById('hl-toolbar-meaning'),

  // Drawer
  readerDrawer: document.getElementById('reader-drawer'),
  drawerBackdrop: document.getElementById('drawer-backdrop'),
  drawerTitle: document.getElementById('drawer-title-text'),
  drawerIcon: document.getElementById('drawer-icon'),
  drawerBody: document.getElementById('drawer-body'),
  btnDrawerClose: document.getElementById('btn-drawer-close'),
  drawerSearchBar: document.getElementById('drawer-search-bar'),
  inputHighlightSearch: document.getElementById('input-highlight-search'),
  btnClearHighlightSearch: document.getElementById('btn-clear-highlight-search'),

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

  // Bookmark Modal
  bookmarkModal: document.getElementById('bookmark-modal'),
  bookmarkModalTitle: document.getElementById('bookmark-modal-title'),
  inputBookmarkTitle: document.getElementById('input-bookmark-title'),
  bookmarkPreviewPct: document.getElementById('bookmark-preview-pct'),
  bookmarkPreviewChapter: document.getElementById('bookmark-preview-chapter'),
  bookmarkPreviewSnippet: document.getElementById('bookmark-preview-snippet'),
  btnCancelBookmark: document.getElementById('btn-cancel-bookmark'),
  btnSaveBookmark: document.getElementById('btn-save-bookmark'),
  bookmarkQuickChips: document.getElementById('bookmark-quick-chips'),

  // Word/Text Edit Modal Elements
  wordEditModal: document.getElementById('word-edit-modal'),
  wordEditTitle: document.getElementById('word-edit-title'),
  wordEditOriginal: document.getElementById('word-edit-original'),
  wordEditInput: document.getElementById('word-edit-input'),
  wordEditContextPreview: document.getElementById('word-edit-context-preview'),
  wordEditContextText: document.getElementById('word-edit-context-text'),
  btnCancelWordEdit: document.getElementById('btn-cancel-word-edit'),
  btnSaveWordEdit: document.getElementById('btn-save-word-edit'),
  btnCloseWordModal: document.getElementById('btn-close-word-modal'),

  // Settings
  themeBtns: document.querySelectorAll('.theme-btn[data-theme]'),
  btnFontDecrease: document.getElementById('btn-font-decrease'),
  btnFontIncrease: document.getElementById('btn-font-increase'),
  fontSizeIndicator: document.getElementById('font-size-indicator'),
  btnLhDecrease: document.getElementById('btn-lh-decrease'),
  btnLhIncrease: document.getElementById('btn-lh-increase'),
  lhIndicator: document.getElementById('lh-indicator'),
  fontFamilySelect: document.getElementById('font-family-select'),
  toggleCopySearchHighlights: document.getElementById('toggle-copy-search-highlights'),

  // Quiz & Vocab Elements
  btnOpenQuiz: document.getElementById('btn-open-quiz'),
  quizCounter: document.getElementById('quiz-counter'),
  drawerActionsBar: document.getElementById('drawer-actions-bar'),
  drawerBookmarkActionsBar: document.getElementById('drawer-bookmark-actions-bar'),
  btnAddCurrentBookmark: document.getElementById('btn-add-current-bookmark'),
  btnSortBookmarks: document.getElementById('btn-sort-bookmarks'),
  btnBatchVocab: document.getElementById('btn-batch-vocab'),
  btnExportVocab: document.getElementById('btn-export-vocab'),

  // Vocab Edit Modal Elements
  vocabEditModalBackdrop: document.getElementById('vocab-edit-modal-backdrop'),
  btnCloseVocabEdit: document.getElementById('btn-close-vocab-edit'),
  btnCancelVocabEdit: document.getElementById('btn-cancel-vocab-edit'),
  btnSaveVocabEdit: document.getElementById('btn-save-vocab-edit'),
  vocabEditPreviewTarget: document.getElementById('vocab-edit-preview-target'),
  vocabEditPreviewSentence: document.getElementById('vocab-edit-preview-sentence'),
  inputEditPhonetic: document.getElementById('input-edit-phonetic'),
  inputEditMeaning: document.getElementById('input-edit-meaning'),
  inputEditTrans: document.getElementById('input-edit-trans'),

  // Gemini API Settings
  inputGeminiApiKey: document.getElementById('input-gemini-api-key'),
  btnToggleApiMask: document.getElementById('btn-toggle-api-mask'),
  btnSaveApiKey: document.getElementById('btn-save-api-key'),
  btnDeleteApiKey: document.getElementById('btn-delete-api-key'),
  btnToggleAiActive: document.getElementById('btn-toggle-ai-active'),
  apiStatusBadge: document.getElementById('api-status-badge'),
  btnOpenApiGuide: document.getElementById('btn-open-api-guide'),
  apiGuideModalBackdrop: document.getElementById('api-guide-modal-backdrop'),
  btnCloseApiGuide: document.getElementById('btn-close-api-guide'),
  btnGuideConfirm: document.getElementById('btn-guide-confirm'),

  // Quiz Modal Elements
  quizModalBackdrop: document.getElementById('quiz-modal-backdrop'),
  btnCloseQuizModal: document.getElementById('btn-close-quiz-modal'),
  quizCriteriaDesc: document.getElementById('quiz-criteria-desc'),
  quizProgressText: document.getElementById('quiz-progress-text'),
  quizCardStats: document.getElementById('quiz-card-stats'),
  quizFlashcard: document.getElementById('quiz-flashcard'),
  quizQuestionSentence: document.getElementById('quiz-question-sentence'),
  quizAnswerSection: document.getElementById('quiz-answer-section'),
  quizAnswerMeaning: document.getElementById('quiz-target-meaning'),
  quizAnswerTrans: document.getElementById('quiz-sentence-trans'),
  quizActionsUnrevealed: document.getElementById('quiz-actions-unrevealed'),
  quizActionsRevealed: document.getElementById('quiz-actions-revealed'),
  btnQuizReveal: document.getElementById('btn-quiz-reveal'),
  btnQuizWrong: document.getElementById('btn-quiz-wrong'),
  btnQuizCorrect: document.getElementById('btn-quiz-correct'),
  quizEmptyState: document.getElementById('quiz-empty-state'),
  quizActiveView: document.getElementById('quiz-active-view'),
  quizResultView: document.getElementById('quiz-result-view'),
  btnQuizRetryWrong: document.getElementById('btn-quiz-retry-wrong'),
  btnQuizRestart: document.getElementById('btn-quiz-restart'),
  btnQuizFinish: document.getElementById('btn-quiz-finish'),
  btnQuizGoBatch: document.getElementById('btn-quiz-go-batch'),
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

async function updateActiveBookLastPosition(pos) {
  if (!state.currentBook || pos === undefined || pos === null) return;
  try {
    const db = await openReaderDB();
    if (!db) return;
    const tx = db.transaction(READER_STORE_NAME, 'readwrite');
    const store = tx.objectStore(READER_STORE_NAME);
    const bookId = state.currentBook.id;
    const req = store.get(bookId);
    req.onsuccess = () => {
      let record = req.result;
      if (!record) {
        const legReq = store.get('current_reading_book');
        legReq.onsuccess = () => {
          if (legReq.result) {
            legReq.result.lastPosition = pos;
            legReq.result.timestamp = Date.now();
            store.put(legReq.result);
          }
        };
        return;
      }
      record.lastPosition = pos;
      record.timestamp = Date.now();
      store.put(record);
    };
  } catch (e) {
    console.warn('Error updating last position in IndexedDB:', e);
  }
}

async function saveActiveBookToStorage(bookRecord) {
  try {
    const db = await openReaderDB();
    if (!db) return;
    const tx = db.transaction(READER_STORE_NAME, 'readwrite');
    const store = tx.objectStore(READER_STORE_NAME);
    const highlightsToStore = (Array.isArray(state.highlights) && state.highlights.length > 0)
      ? state.highlights
      : (bookRecord.highlights || []);

    const bookmarksToStore = (Array.isArray(state.bookmarks) && state.bookmarks.length > 0)
      ? state.bookmarks
      : (bookRecord.bookmarks || []);

    const bookId = bookRecord.bookId || (state.currentBook && state.currentBook.id) || ('book_' + Date.now());

    const lastPos = (bookRecord && bookRecord.lastPosition !== undefined && bookRecord.lastPosition !== null)
      ? bookRecord.lastPosition
      : (state.currentBook ? localStorage.getItem(`reader_pos_${bookId}`) : null);

    store.put({
      id: bookId,
      ...bookRecord,
      bookId: bookId,
      lastPosition: lastPos,
      highlights: highlightsToStore,
      bookmarks: bookmarksToStore,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('Failed to save book to IndexedDB:', err);
  }
}

async function saveActiveBookBookmarksToDB() {
  try {
    const db = await openReaderDB();
    if (!db || !state.currentBook) return;
    const tx = db.transaction(READER_STORE_NAME, 'readwrite');
    const store = tx.objectStore(READER_STORE_NAME);
    const bookId = state.currentBook.id;
    const req = store.get(bookId);
    req.onsuccess = () => {
      const record = req.result;
      if (record) {
        record.bookmarks = state.bookmarks;
        record.timestamp = Date.now();
        store.put(record);
      }
    };
  } catch (err) {
    console.warn('Failed to save bookmarks to IndexedDB:', err);
  }
}

async function getAllBooksFromStorage() {
  try {
    const db = await openReaderDB();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(READER_STORE_NAME, 'readonly');
      const store = tx.objectStore(READER_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        let books = req.result || [];
        books = books.map(b => {
          if (b.id === 'current_reading_book') {
            return { ...b, id: b.bookId || 'legacy_current_book' };
          }
          return b;
        });
        books.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(books);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('Failed to load books from IndexedDB:', err);
    return [];
  }
}

async function getBookByIdFromStorage(bookId) {
  try {
    const db = await openReaderDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(READER_STORE_NAME, 'readonly');
      const store = tx.objectStore(READER_STORE_NAME);
      const req = store.get(bookId);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          const legReq = store.get('current_reading_book');
          legReq.onsuccess = () => resolve(legReq.result || null);
          legReq.onerror = () => resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

async function deleteBookFromStorage(bookId) {
  try {
    const db = await openReaderDB();
    if (!db) return;
    const tx = db.transaction(READER_STORE_NAME, 'readwrite');
    const store = tx.objectStore(READER_STORE_NAME);
    store.delete(bookId);

    const legReq = store.get('current_reading_book');
    legReq.onsuccess = () => {
      if (legReq.result && (legReq.result.bookId === bookId || legReq.result.id === bookId)) {
        store.delete('current_reading_book');
      }
    };

    localStorage.removeItem(`reader_highlights_${bookId}`);
    localStorage.removeItem(`reader_bookmarks_${bookId}`);
    localStorage.removeItem(`reader_pos_${bookId}`);
    if (localStorage.getItem('reader_last_book_id') === bookId) {
      localStorage.removeItem('reader_last_book_id');
    }
  } catch (err) {
    console.warn('Failed to delete book from IndexedDB:', err);
  }
}

async function loadActiveBookFromStorage() {
  try {
    const db = await openReaderDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(READER_STORE_NAME, 'readonly');
      const store = tx.objectStore(READER_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const books = req.result || [];
        if (books.length > 0) {
          books.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          resolve(books[0]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Failed to load book from IndexedDB:', err);
    return null;
  }
}

function showReaderWorkspace() {
  const fileListView = document.getElementById('file-list-view');
  const readerApp = document.getElementById('reader-app');
  if (fileListView) fileListView.style.display = 'none';
  if (readerApp) readerApp.style.display = 'flex';
}

async function showReaderFileList() {
  const fileListView = document.getElementById('file-list-view');
  const readerApp = document.getElementById('reader-app');
  if (readerApp) readerApp.style.display = 'none';
  if (fileListView) fileListView.style.display = 'block';
  await renderReaderFileList();
}

async function renderReaderFileList() {
  const listContainer = document.getElementById('file-cards-list');
  if (!listContainer) return;

  const books = await getAllBooksFromStorage();
  if (!books || books.length === 0) {
    listContainer.innerHTML = `
      <div class="file-empty-state">
        <div class="empty-icon">📖</div>
        <h3>저장된 도서가 없습니다</h3>
        <p>상단의 [새 파일 열기] 버튼을 눌러 .txt, .epub, .md 도서를 추가해보세요.</p>
        <div class="empty-action-row">
          <button type="button" class="btn-secondary-action" id="btn-list-sample-book">
            샘플 도서 열기 (The Happy Prince)
          </button>
        </div>
      </div>
    `;
    const sampleBtn = document.getElementById('btn-list-sample-book');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        loadSampleBook();
      });
    }
    return;
  }

  listContainer.innerHTML = books.map(book => {
    const type = (book.type || 'txt').toUpperCase();
    let posText = '';
    if (book.lastPosition !== undefined && book.lastPosition !== null && book.lastPosition !== '') {
      if (typeof book.lastPosition === 'number' || /^\d+$/.test(book.lastPosition)) {
        posText = `진행률 ${book.lastPosition}%`;
      } else {
        posText = `읽던 위치 저장됨`;
      }
    } else {
      posText = `처음`;
    }

    let dateText = '';
    if (book.timestamp) {
      const d = new Date(book.timestamp);
      dateText = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    }

    const hlCount = (book.highlights && book.highlights.length) ? book.highlights.length : 0;
    const bmCount = (book.bookmarks && book.bookmarks.length) ? book.bookmarks.length : 0;
    const bookKey = book.id || book.bookId;

    return `
      <div class="file-card" data-id="${escapeHtml(bookKey)}">
        <div class="file-card-main" onclick="openBookFromList('${escapeHtml(bookKey)}')">
          <div class="file-card-icon">📖</div>
          <div class="file-card-info">
            <div class="file-card-title">${escapeHtml(book.title || '제목 없음')}</div>
            <div class="file-card-meta">
              <span class="file-meta-tag">${type}</span>
              ${book.author ? `<span class="file-meta-author">${escapeHtml(book.author)}</span>` : ''}
              <span class="file-meta-tag green">${posText}</span>
              ${hlCount > 0 ? `<span class="file-meta-tag amber">형광펜 ${hlCount}</span>` : ''}
              ${bmCount > 0 ? `<span class="file-meta-tag">책갈피 ${bmCount}</span>` : ''}
              ${dateText ? `<span class="file-meta-date">${dateText}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="file-card-actions">
          <button type="button" class="btn-card-delete" onclick="deleteBookFromList('${escapeHtml(bookKey)}', event)" title="도서 삭제">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            <span>삭제</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.openBookFromList = async function(bookId) {
  try {
    const record = await getBookByIdFromStorage(bookId);
    if (!record || !record.content) {
      alert('도서 데이터를 불러올 수 없습니다.');
      return;
    }
    const savedPos = (record.lastPosition !== undefined && record.lastPosition !== null && record.lastPosition !== '')
      ? record.lastPosition
      : localStorage.getItem(`reader_pos_${record.bookId || bookId}`);

    if (record.type === 'epub') {
      openEpubBook(record.title, record.author, record.content, record.bookId || bookId, true, record.highlights, savedPos, record.bookmarks);
    } else if (record.type === 'txt') {
      openTxtBook(record.title, record.author, record.content, record.bookId || bookId, true, record.highlights, savedPos, record.bookmarks);
    } else if (record.type === 'md' || record.type === 'markdown') {
      openMdBook(record.title, record.author, record.content, record.bookId || bookId, true, record.highlights, savedPos, record.bookmarks);
    }
  } catch (err) {
    console.warn('Error opening book from list:', err);
  }
};

window.deleteBookFromList = async function(bookId, e) {
  if (e) e.stopPropagation();
  if (!confirm('이 도서를 보관함에서 삭제하시겠습니까?')) return;
  await deleteBookFromStorage(bookId);
  if (state.currentBook && (state.currentBook.id === bookId || state.currentBook.bookId === bookId)) {
    state.currentBook = null;
  }
  await renderReaderFileList();
};

async function clearAllReaderIndexedDB() {
  try {
    const db = await openReaderDB();
    if (!db) return;
    const storeNames = Array.from(db.objectStoreNames);
    if (storeNames.length > 0) {
      const tx = db.transaction(storeNames, 'readwrite');
      storeNames.forEach(name => {
        tx.objectStore(name).clear();
      });
      await new Promise((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
    db.close();
  } catch (err) {
    console.warn('Failed to clear IndexedDB stores:', err);
  }
}

async function resetReaderApp() {
  if (!confirm('영어 읽기에 저장된 도서 및 형광펜/책갈피 데이터를 초기화하시겠습니까?\n(설정 및 저장된 AI API 키는 유지됩니다)')) {
    return;
  }

  // 1. IndexedDB 데이터 모두 삭제
  await clearAllReaderIndexedDB();

  // 2. 현재 열려 있는 도서 상태 정리
  cleanupEpub();
  if (elements.txtContent) {
    elements.txtContent.innerHTML = '';
  }
  if (state.currentBook) {
    try {
      localStorage.removeItem(`reader_pos_${state.currentBook.id}`);
      localStorage.removeItem(`reader_bookmarks_${state.currentBook.id}`);
    } catch (e) {}
  }
  state.currentBook = null;
  state.highlights = [];
  state.bookmarks = [];
  state.toc = [];
  state.highlightSearchQuery = '';
  if (elements.inputHighlightSearch) elements.inputHighlightSearch.value = '';
  if (elements.btnClearHighlightSearch) elements.btnClearHighlightSearch.style.display = 'none';
  updateBookmarkBadge();

  // 3. UI 초기화
  closeAllToolbars();
  if (typeof closeDrawer === 'function') {
    closeDrawer();
  }
  if (elements.txtViewer) elements.txtViewer.style.display = 'none';
  if (elements.epubViewer) elements.epubViewer.style.display = 'none';
  if (elements.emptyState) elements.emptyState.style.display = 'flex';
  if (elements.btnToggleToc) elements.btnToggleToc.style.display = 'none';
  if (elements.readerBottomBar) elements.readerBottomBar.style.display = 'none';

  updateMetadataUI();
  if (elements.currentChapterTitle) elements.currentChapterTitle.textContent = '';
  if (elements.progressSlider) elements.progressSlider.value = 0;
  if (elements.progressPercent) elements.progressPercent.textContent = '0%';
  if (elements.bookFileInput) elements.bookFileInput.value = '';
  if (elements.emptyFileInput) elements.emptyFileInput.value = '';

  updateHighlightBadge();
  showToast('저장된 도서 데이터(IndexedDB)가 초기화되었습니다.');
}

// 하이라이트 관련 요소 클릭 여부 판별 (EPUB.js SVG 어노테이션 및 내보낸 <mark> 태그 모두 인식)
function isHighlightTarget(target) {
  if (!target) return false;
  const tag = (target.tagName || '').toLowerCase();
  if (tag === 'rect' || tag === 'mark') return true;
  if (typeof target.closest === 'function') {
    if (target.closest('.epubjs-hl') || target.closest('.reader-highlight') || target.closest('mark') || target.closest('.reader-note-badge')) {
      return true;
    }
  }
  if (target.classList) {
    if (target.classList.contains('epubjs-hl') || target.classList.contains('reader-highlight') || target.classList.contains('reader-note-badge')) {
      return true;
    }
  }
  return false;
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
    } else if (state.currentBook && (state.currentBook.type === 'txt' || state.currentBook.type === 'md') && elements.txtViewer) {
      const scrollStep = elements.txtViewer.clientHeight * 0.8;
      if (dx < 0) {
        elements.txtViewer.scrollBy({ top: scrollStep, behavior: 'smooth' });
      } else {
        elements.txtViewer.scrollBy({ top: -scrollStep, behavior: 'smooth' });
      }
    }
  }, { passive: true });
}

// 설정 팝오버 위치 보정 (아이패드는 영향 없도록 640px 이하 모바일만 동적 보정 및 스크롤 적용)
function positionSettingsPopover() {
  if (!elements.settingsPopover || !elements.settingsPopover.classList.contains('open')) return;
  if (window.innerWidth <= 640) {
    const btnRect = elements.btnToggleSettings.getBoundingClientRect();
    const vh = window.innerHeight;

    elements.settingsPopover.style.position = 'fixed';
    elements.settingsPopover.style.left = '12px';
    elements.settingsPopover.style.right = '12px';
    elements.settingsPopover.style.width = 'auto';
    elements.settingsPopover.style.maxWidth = '350px';
    elements.settingsPopover.style.margin = '0 auto';

    // 기본 위치: 설정 버튼 바로 아래
    const idealTop = btnRect.bottom + 8;
    // 팝오버 실제 콘텐츠 높이 계산
    const contentHeight = elements.settingsPopover.scrollHeight > 100 ? elements.settingsPopover.scrollHeight : 480;
    const bottomPadding = 20;

    // 버튼 아래 배치 시 화면 하단이 넘어가면 상단으로 당겨 올려 전체 내용 노출
    let popoverTop = idealTop;
    if (idealTop + contentHeight > vh - bottomPadding) {
      const liftedTop = vh - contentHeight - bottomPadding;
      // 글로벌 상단 내비바(약 50px) 아래를 최소 상단 여백(52px)으로 설정
      popoverTop = Math.max(52, Math.min(idealTop, liftedTop));
    }

    elements.settingsPopover.style.top = `${popoverTop}px`;
    elements.settingsPopover.style.maxHeight = `calc(100dvh - ${popoverTop + 14}px - env(safe-area-inset-bottom, 12px))`;
    elements.settingsPopover.style.overflowY = 'auto';
    elements.settingsPopover.style.webkitOverflowScrolling = 'touch';
  } else {
    // 아이패드, 태블릿, 데스크톱 (641px 이상): CSS 원본 스타일 유지
    elements.settingsPopover.style.position = '';
    elements.settingsPopover.style.top = '';
    elements.settingsPopover.style.bottom = '';
    elements.settingsPopover.style.left = '';
    elements.settingsPopover.style.right = '';
    elements.settingsPopover.style.width = '';
    elements.settingsPopover.style.maxWidth = '';
    elements.settingsPopover.style.margin = '';
    elements.settingsPopover.style.maxHeight = '';
    elements.settingsPopover.style.overflowY = '';
    elements.settingsPopover.style.webkitOverflowScrolling = '';
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
  // 기본 폰트를 명조(serif)로 전환 (기존 기본값 sans-serif로 저장되어 있던 브라우저도 serif로 1회 마이그레이션)
  if (!localStorage.getItem('reader_font_serif_migrated')) {
    state.settings.fontFamily = 'serif';
    localStorage.setItem('reader_font_serif_migrated', 'true');
    saveSettings();
  }
  if (state.settings.copySearchHighlights === undefined) {
    state.settings.copySearchHighlights = true;
  }
  if (state.settings.aiAutoAnalysis === undefined) {
    state.settings.aiAutoAnalysis = true;
  }
  if (!state.settings.geminiApiKey) {
    state.settings.geminiApiKey = localStorage.getItem('gemini_api_key') || '';
  }
  if (elements.inputGeminiApiKey) {
    elements.inputGeminiApiKey.value = state.settings.geminiApiKey;
  }
  updateApiStatusBadge(!!state.settings.geminiApiKey);
  updateAiToggleUI();
  applySettings();
}

function updateApiStatusBadge(hasKey) {
  if (!elements.apiStatusBadge) return;
  if (hasKey) {
    elements.apiStatusBadge.textContent = '✅ 등록됨';
    elements.apiStatusBadge.className = 'api-status-badge configured';
  } else {
    elements.apiStatusBadge.textContent = '⚠️ 미등록';
    elements.apiStatusBadge.className = 'api-status-badge unconfigured';
  }
}

function updateAiToggleUI() {
  if (!elements.btnToggleAiActive) return;
  const isEnabled = state.settings.aiAutoAnalysis !== false;
  if (isEnabled) {
    elements.btnToggleAiActive.classList.add('on');
    elements.btnToggleAiActive.classList.remove('off');
    elements.btnToggleAiActive.setAttribute('aria-checked', 'true');
    elements.btnToggleAiActive.title = '형광펜 추가 시 AI API 작동 중 (클릭 시 끄기)';
  } else {
    elements.btnToggleAiActive.classList.remove('on');
    elements.btnToggleAiActive.classList.add('off');
    elements.btnToggleAiActive.setAttribute('aria-checked', 'false');
    elements.btnToggleAiActive.title = '형광펜 추가 시 AI API 꺼짐 (클릭 시 켜기)';
  }
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

  // Copy auto-search highlights toggle
  if (elements.toggleCopySearchHighlights) {
    elements.toggleCopySearchHighlights.checked = state.settings.copySearchHighlights !== false;
  }

  // AI API toggle button state
  updateAiToggleUI();

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

  const epubFontFamily = state.settings.fontFamily === 'serif'
    ? "'Noto Serif KR', Georgia, serif"
    : (state.settings.fontFamily === 'monospace' ? 'ui-monospace, Consolas, monospace' : '-apple-system, sans-serif');

  state.epub.rendition.themes.default({
    'body': {
      'background': `${bgColors[currentTheme]} !important`,
      'color': `${textColors[currentTheme]} !important`,
      'font-family': `${epubFontFamily} !important`,
      'font-size': `${state.settings.fontSize}px !important`,
      'line-height': `${currentLh} !important`,
      'padding': `${window.innerWidth <= 768 ? '12px 18px' : '20px 40px'} !important`,
      'box-sizing': 'border-box !important',
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
    '.epubjs-hl.hl-orange': { 'fill': '#fb923c !important' },
    '.epubjs-hl.hl-green':  { 'fill': '#4ade80 !important' },
    '.epubjs-hl.hl-purple': { 'fill': '#c084fc !important' },
    '.epubjs-hl.hl-blue':   { 'fill': '#38bdf8 !important' },
    '.epubjs-hl.hl-pink':   { 'fill': '#f472b6 !important' }
  });

  // 테마/폰트 크기/줄간격 변경 시 현재 읽던 위치(CFI) 및 형광펜 유지
  triggerEpubResizeSafe();
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
  } else if (state.currentBook && (state.currentBook.type === 'txt' || state.currentBook.type === 'md')) {
    if (typeof a.pIdx === 'number' && typeof b.pIdx === 'number' && a.pIdx !== b.pIdx) {
      return a.pIdx - b.pIdx;
    }
    if (typeof a.pIdx === 'number' && typeof b.pIdx === 'number' && a.pIdx === b.pIdx) {
      const offA = a.offset ?? 0;
      const offB = b.offset ?? 0;
      if (offA !== offB) return offA - offB;
    }
    if (a.fnTag && b.fnTag) {
      const numA = parseInt(a.fnTag, 10);
      const numB = parseInt(b.fnTag, 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
    }
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

function getStartCfi(cfiRange) {
  if (!cfiRange || typeof cfiRange !== 'string') return null;
  const match = cfiRange.match(/^epubcfi\((.+)\)$/);
  if (!match) return cfiRange;
  const inner = match[1];
  const parts = inner.split(',');
  if (parts.length >= 2) {
    const parent = parts[0];
    const start = parts[1];
    return `epubcfi(${parent}${start})`;
  }
  return cfiRange;
}

function sortHighlights() {
  if (Array.isArray(state.highlights)) {
    state.highlights.sort(compareHighlights);
  }
}

function getBookStorageKey(bookId) {
  return `reader_highlights_${bookId}`;
}

function loadHighlights(bookId, fallbackList = null) {
  if (!bookId) return [];
  let raw = null;
  try {
    raw = localStorage.getItem(getBookStorageKey(bookId));
  } catch (e) {
    console.warn(e);
  }

  let list = null;
  if (raw) {
    try {
      list = JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }
  }

  // Fallback to IndexedDB backup if localStorage is empty
  if (!list || !Array.isArray(list) || list.length === 0) {
    if (Array.isArray(fallbackList) && fallbackList.length > 0) {
      list = fallbackList;
    }
  }

  if (Array.isArray(list)) {
    // Clean and deduplicate existing records
    const uniqueList = [];
    const seen = new Set();
    list.forEach(item => {
      if (!item || !item.text) return;
      const key = item.id || (item.cfiRange ? item.cfiRange : `${item.pIdx}_${item.text.trim()}_${(item.targetSentence || '').trim()}`);
      if (!seen.has(key)) {
        seen.add(key);
        // 단어장 및 퀴즈 필드 보정 (마이그레이션)
        item.targetMeaning = item.targetMeaning || '';
        item.phonetic = item.phonetic || '';
        item.sentenceTranslation = item.sentenceTranslation || '';
        item.studyCount = Number(item.studyCount) || 0;
        item.wrongCount = Number(item.wrongCount) || 0;
        item.lastStudiedAt = item.lastStudiedAt || null;
        uniqueList.push(item);
      }
    });
    uniqueList.sort(compareHighlights);
    try {
      localStorage.setItem(getBookStorageKey(bookId), JSON.stringify(uniqueList));
    } catch (e) {}
    return uniqueList;
  }
  return [];
}

async function saveActiveBookHighlightsToDB() {
  try {
    const db = await openReaderDB();
    if (!db || !state.currentBook) return;
    const tx = db.transaction(READER_STORE_NAME, 'readwrite');
    const store = tx.objectStore(READER_STORE_NAME);
    const req = store.get('current_reading_book');
    req.onsuccess = () => {
      const record = req.result;
      if (record && record.bookId === state.currentBook.id) {
        record.highlights = state.highlights;
        store.put(record);
      }
    };
  } catch (err) {
    console.warn('Failed to save highlights to IndexedDB:', err);
  }
}

function saveHighlights() {
  if (!state.currentBook) return;
  try {
    localStorage.setItem(getBookStorageKey(state.currentBook.id), JSON.stringify(state.highlights));
  } catch (e) {
    console.warn('localStorage setItem failed (quota exceeded?):', e);
  }
  // 실시간 이중 저장 (IndexedDB 영구 백업)
  saveActiveBookHighlightsToDB();
  updateHighlightBadge();
}

function updateHighlightBadge() {
  if (elements.highlightCounter) {
    elements.highlightCounter.style.display = 'none';
  }
  updateQuizBadge();
}

function updateQuizBadge() {
  if (elements.quizCounter) {
    elements.quizCounter.style.display = 'none';
  }
}

// ── Bookmarks Storage & Helper Functions ──
function getBookmarkStorageKey(bookId) {
  return `reader_bookmarks_${bookId}`;
}

function loadBookmarks(bookId, fallbackList = null) {
  if (!bookId) return [];
  let raw = null;
  try {
    raw = localStorage.getItem(getBookmarkStorageKey(bookId));
  } catch (e) {
    console.warn('loadBookmarks error:', e);
  }

  let list = null;
  if (raw) {
    try {
      list = JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }
  }

  if (!list || !Array.isArray(list) || list.length === 0) {
    if (Array.isArray(fallbackList) && fallbackList.length > 0) {
      list = fallbackList;
    }
  }

  if (Array.isArray(list)) {
    const valid = list.filter(item => item && item.id);
    return valid;
  }
  return [];
}

function saveBookmarks() {
  if (!state.currentBook) return;
  try {
    localStorage.setItem(getBookmarkStorageKey(state.currentBook.id), JSON.stringify(state.bookmarks));
  } catch (e) {
    console.warn('localStorage setItem bookmarks failed:', e);
  }
  saveActiveBookBookmarksToDB();
  updateBookmarkBadge();
}

function updateBookmarkBadge() {
  // 책갈피 버튼에는 숫자를 표시하지 않고, 드로어 제목에만 개수를 표시함
  if (elements.readerDrawer && elements.readerDrawer.classList.contains('open') && elements.drawerTitle) {
    if (elements.drawerBookmarkActionsBar && elements.drawerBookmarkActionsBar.style.display !== 'none') {
      const count = (Array.isArray(state.bookmarks) && state.bookmarks.length) || 0;
      elements.drawerTitle.textContent = `책갈피 목록 (${count}개)`;
    }
  }
}

function sortBookmarks() {
  if (!Array.isArray(state.bookmarks)) return;
  if (state.bookmarkSortMode === 'latest') {
    state.bookmarks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } else {
    // Default: position order (pct ascending, then pIdx or createdAt)
    state.bookmarks.sort((a, b) => {
      const pctDiff = (a.pct ?? 0) - (b.pct ?? 0);
      if (pctDiff !== 0) return pctDiff;
      if (a.pIdx !== undefined && b.pIdx !== undefined) {
        return a.pIdx - b.pIdx;
      }
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }
}

function updateBookmarkSortBtnText() {
  if (!elements.btnSortBookmarks) return;
  elements.btnSortBookmarks.textContent = state.bookmarkSortMode === 'latest' ? '⇅ 최신순' : '⇅ 위치순';
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
  const isMd = fileName.toLowerCase().endsWith('.md') || fileName.toLowerCase().endsWith('.markdown') || file.type.includes('markdown');

  if (isEpub) {
    const reader = new FileReader();
    reader.onload = (e) => {
      openEpubBook(fileName.replace(/\.epub$/i, ''), '저자 확인 중...', e.target.result, `epub_${fileName}_${file.size}`);
    };
    reader.readAsArrayBuffer(file);
  } else if (isMd) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawContent = e.target.result || '';
      const meta = extractMarkdownMetadata(rawContent, fileName);
      openMdBook(meta.title, meta.author, rawContent, `md_${fileName}_${file.size}`);
    };
    reader.readAsText(file, 'utf-8');
  } else {
    // Assume TXT
    const reader = new FileReader();
    reader.onload = (e) => {
      openTxtBook(fileName.replace(/\.txt$/i, ''), '', e.target.result, `txt_${fileName}_${file.size}`);
    };
    reader.readAsText(file, 'utf-8');
  }
}

// ── Markdown & Highlights Export Management ──
function formatTxtParagraphHeading(pText) {
  const trimmed = pText.trim();
  if (/^#\s+/.test(trimmed)) {
    return trimmed.replace(/^#\s+/, '## ');
  }
  if (/^##\s+/.test(trimmed)) {
    return trimmed.replace(/^##\s+/, '### ');
  }
  if (/^###\s+/.test(trimmed)) {
    return trimmed.replace(/^###\s+/, '#### ');
  }

  if (trimmed.length <= 80 && !trimmed.includes('\n')) {
    if (/^(chapter|chap\.|part|book|act|scene)\s+([0-9ivxlcdm]+|\w+)([\s\:\.\-].*)?$/i.test(trimmed) ||
        /^제\s*\d+\s*[장절부편]([\s\:\.\-].*)?$/.test(trimmed)) {
      return `## ${trimmed}`;
    }
    if (/^(section|subchapter)\s+([0-9ivxlcdm]+|\w+)([\s\:\.\-].*)?$/i.test(trimmed)) {
      return `### ${trimmed}`;
    }
  }

  return trimmed;
}

async function exportBookAsMarkdown() {
  if (!state.currentBook) {
    showToast('내보낼 도서가 없습니다. 먼저 도서를 열어주세요.');
    return;
  }

  showToast('내보내기 파일 생성 중...');

  try {
    let markdownContent = '';
    if (state.currentBook.type === 'epub') {
      markdownContent = await exportEpubAsMarkdown();
    } else if (state.currentBook.type === 'md') {
      markdownContent = exportMdAsMarkdown();
    } else {
      markdownContent = exportTxtAsMarkdown();
    }

    const safeTitle = (state.currentBook.title || 'book')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .trim() || 'book';
    downloadMarkdown(markdownContent, `${safeTitle}.md`);
    showToast('내보내기가 완료되었습니다.');
  } catch (err) {
    console.error('Export Error:', err);
    showToast('내보내기 중 오류가 발생했습니다: ' + (err.message || ''));
  }
}

function exportTxtAsMarkdown() {
  const sortedHls = [...state.highlights].sort(compareHighlights);
  const hlFootnoteMap = new Map();
  sortedHls.forEach((hl, idx) => {
    hlFootnoteMap.set(hl.id, idx + 1);
  });

  const rawParagraphs = (state.currentBook.content || '').split(/\n\s*\n/);
  let bodyMd = '';

  rawParagraphs.forEach((pText, pIdx) => {
    const trimmed = pText.trim();
    if (!trimmed) return;

    const pHighlights = sortedHls.filter(h => h.pIdx === pIdx && h.text);
    if (pHighlights.length === 0) {
      bodyMd += `${formatTxtParagraphHeading(trimmed)}\n\n`;
      return;
    }

    const validatedHls = [];
    for (const hl of pHighlights) {
      let start = -1;
      const textLen = hl.text.length;
      if (typeof hl.offset === 'number' && hl.offset >= 0 && hl.offset + textLen <= trimmed.length) {
        if (trimmed.substring(hl.offset, hl.offset + textLen) === hl.text) {
          start = hl.offset;
        }
      }
      if (start === -1 && hl.targetSentence) {
        const targetSearch = trimmed.indexOf(hl.targetSentence);
        if (targetSearch !== -1) {
          const subIdx = trimmed.indexOf(hl.text, targetSearch);
          if (subIdx !== -1 && subIdx <= targetSearch + hl.targetSentence.length) {
            start = subIdx;
          }
        }
      }
      if (start === -1) {
        start = trimmed.indexOf(hl.text);
      }

      if (start !== -1) {
        validatedHls.push({
          ...hl,
          _start: start,
          _end: start + textLen,
          _fnNum: hlFootnoteMap.get(hl.id)
        });
      }
    }

    if (validatedHls.length === 0) {
      bodyMd += `${trimmed}\n\n`;
      return;
    }

    validatedHls.sort((a, b) => b._start - a._start);
    const nonOverlapping = [];
    let lastStart = Infinity;
    for (const item of validatedHls) {
      if (item._end <= lastStart) {
        nonOverlapping.push(item);
        lastStart = item._start;
      }
    }

    nonOverlapping.sort((a, b) => a._start - b._start);
    let pResult = '';
    let curIdx = 0;
    for (const hl of nonOverlapping) {
      if (hl._start > curIdx) {
        pResult += trimmed.substring(curIdx, hl._start);
      }
      const rawMatch = trimmed.substring(hl._start, hl._end);
      pResult += `${rawMatch}[^${hl._fnNum}]`;
      curIdx = hl._end;
    }
    if (curIdx < trimmed.length) {
      pResult += trimmed.substring(curIdx);
    }
    bodyMd += `${formatTxtParagraphHeading(pResult)}\n\n`;
  });

  let fullMd = `# ${state.currentBook.title || 'Untitled'}\n\n`;
  if (state.currentBook.author) {
    fullMd += `*저자: ${state.currentBook.author}*\n\n`;
  }
  fullMd += `---\n\n${bodyMd.trim()}\n\n`;

  if (sortedHls.length > 0) {
    fullMd += generateMarkdownQaSection(sortedHls, hlFootnoteMap);
  }

  return cleanMarkdown(fullMd) + '\n';
}

function exportMdAsMarkdown() {
  // Extract base body from currentBook.content, stripping existing QA section and footnote defs
  const { bodyText } = parseMarkdownFootnotes(state.currentBook.content || '', state.highlights);

  let cleanBody = bodyText;
  const locatedList = [];
  const occupiedRanges = [];

  function isOccupied(start, end) {
    return occupiedRanges.some(r => !(end <= r.start || start >= r.end));
  }

  function escapeRegex(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 1. Locate existing footnotes by fnTag in cleanBody
  state.highlights.filter(h => h.fnTag).forEach(hl => {
    const escapedTag = escapeRegex(hl.fnTag);
    const escapedTerm = escapeRegex(hl.text);
    const re = new RegExp(`(?:\\[\\*\\*${escapedTerm}\\*\\*\\]|\\[${escapedTerm}\\]|\\*\\*${escapedTerm}\\*\\*|\\*${escapedTerm}\\*|${escapedTerm})?\\s*\\[\\^${escapedTag}\\]`, 'g');
    let m;
    let found = false;
    while ((m = re.exec(cleanBody)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (!isOccupied(start, end)) {
        const prefix = m[0].replace(/\s*\[\^[^\]]+\]$/, '') || hl.text;
        locatedList.push({ hl, start, end, prefix, isExisting: true });
        occupiedRanges.push({ start, end });
        found = true;
        break;
      }
    }
    if (!found) {
      const tagOnlyRe = new RegExp(`\\[\\^${escapedTag}\\]`, 'g');
      let m2;
      while ((m2 = tagOnlyRe.exec(cleanBody)) !== null) {
        const start = m2.index;
        const end = m2.index + m2[0].length;
        if (!isOccupied(start, end)) {
          locatedList.push({ hl, start, end, prefix: hl.text, isExisting: true });
          occupiedRanges.push({ start, end });
          break;
        }
      }
    }
  });

  // 2. Locate newly added highlights without fnTag in cleanBody
  state.highlights.filter(h => !h.fnTag).forEach(hl => {
    const escapedTerm = escapeRegex(hl.text);
    const re = new RegExp(`(?:\\[\\*\\*${escapedTerm}\\*\\*\\]|\\[${escapedTerm}\\]|\\*\\*${escapedTerm}\\*\\*|\\*${escapedTerm}\\*|${escapedTerm})(?!\\s*\\[\\^)`, 'g');
    const candidates = [];
    let m;
    while ((m = re.exec(cleanBody)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (!isOccupied(start, end)) {
        let score = 10;
        if (hl.targetSentence) {
          const sentSnippet = cleanBody.substring(Math.max(0, start - 150), Math.min(cleanBody.length, end + 150));
          if (sentSnippet.includes(hl.targetSentence)) {
            score += 1000;
          } else {
            const targetWords = hl.targetSentence.split(/\s+/).filter(w => w.length > 2);
            let wordMatches = 0;
            targetWords.forEach(w => { if (sentSnippet.includes(w)) wordMatches++; });
            score += wordMatches * 10;
          }
        }
        candidates.push({ start, end, prefix: m[0], score });
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      locatedList.push({ hl, start: best.start, end: best.end, prefix: best.prefix, isExisting: false });
      occupiedRanges.push({ start: best.start, end: best.end });
    }
  });

  // 3. Sort strictly by appearance order in cleanBody (start offset ascending)
  locatedList.sort((a, b) => a.start - b.start);

  const hlFootnoteMap = new Map();
  locatedList.forEach((item, idx) => {
    item.fnNum = idx + 1;
    hlFootnoteMap.set(item.hl.id, item.fnNum);
    item.hl.fnTag = String(item.fnNum);
    item.hl.isFootnote = true;
  });

  // 4. Any highlights that could not be located in cleanBody (safeguard)
  const sortedHls = locatedList.map(item => item.hl);
  const unlocatedHls = state.highlights.filter(h => !hlFootnoteMap.has(h.id));
  unlocatedHls.forEach((hl, idx) => {
    const fnNum = locatedList.length + idx + 1;
    hlFootnoteMap.set(hl.id, fnNum);
    hl.fnTag = String(fnNum);
    hl.isFootnote = true;
    sortedHls.push(hl);
  });

  // 5. Replace in cleanBody from bottom to top so offsets do not shift
  const replaceList = [...locatedList].sort((a, b) => b.start - a.start);
  replaceList.forEach(item => {
    const replacement = `${item.prefix}[^${item.fnNum}]`;
    cleanBody = cleanBody.substring(0, item.start) + replacement + cleanBody.substring(item.end);
  });

  // Strip any raw tags if present
  cleanBody = cleanBody
    .replace(/<mark[^>]*class="[^"]*reader-highlight[^"]*"[^>]*>([\s\S]*?)<\/mark>/gi, '$1')
    .replace(/<sup[^>]*class="[^"]*fn-badge[^"]*"[^>]*>.*?<\/sup>/gi, '');

  let fullMd = '';
  if (!/^#\s+/m.test(cleanBody)) {
    fullMd += `# ${state.currentBook.title || 'Untitled'}\n\n`;
    if (state.currentBook.author) {
      fullMd += `*저자: ${state.currentBook.author}*\n\n`;
    }
    fullMd += `---\n\n`;
  }
  cleanBody = cleanBody.replace(/(?:\r?\n\s*---\s*)+$/, '').trim();
  fullMd += `${cleanBody}\n\n`;

  if (sortedHls.length > 0) {
    fullMd += generateMarkdownQaSection(sortedHls, hlFootnoteMap);
  }

  saveHighlights();

  return cleanMarkdown(fullMd) + '\n';
}

function cleanMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findSpineItemForHighlight(hl, allSpineItems, exportSpineItems) {
  if (!hl) return null;

  // 1. Try epub.js runtime spine lookup
  if (state.epub && state.epub.book && state.epub.book.spine && hl.cfiRange) {
    try {
      const sec = state.epub.book.spine.get(hl.cfiRange);
      if (sec) {
        if (sec.idref) {
          const found = exportSpineItems.find(s => s.idref === sec.idref);
          if (found) return found;
        }
        if (sec.href) {
          const found = exportSpineItems.find(s => s.href === sec.href || s.href.endsWith(sec.href) || sec.href.endsWith(s.href));
          if (found) return found;
        }
        if (typeof sec.index === 'number') {
          const original = allSpineItems[sec.index];
          if (original) {
            const found = exportSpineItems.find(s => s.spineIndex === original.spineIndex);
            if (found) return found;
          }
        }
      }
    } catch (e) {}
  }

  // 2. Parse CFI string directly
  if (hl.cfiRange && typeof hl.cfiRange === 'string') {
    // 2a. ID assertion in brackets: epubcfi(/6/14[ch01]!...)
    const idMatch = hl.cfiRange.match(/^epubcfi\(\/6\/\d+\[([^\]]+)\]/i);
    if (idMatch) {
      const asserted = idMatch[1];
      const found = exportSpineItems.find(s => s.idref === asserted || s.href === asserted || s.href.endsWith(asserted));
      if (found) return found;
    }

    // 2b. Step index: epubcfi(/6/14!...) -> (14 / 2) - 1 = index 6
    const stepMatch = hl.cfiRange.match(/^epubcfi\(\/6\/(\d+)/i);
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10);
      const spineIdx = (step / 2) - 1;
      if (spineIdx >= 0 && spineIdx < allSpineItems.length) {
        const original = allSpineItems[spineIdx];
        const found = exportSpineItems.find(s => s.spineIndex === original.spineIndex);
        if (found) return found;
      }
    }
  }

  return null;
}

function findTocItemForHref(href, tocList) {
  if (!href || !tocList || tocList.length === 0) return null;
  const cleanHref = href.split('#')[0].replace(/^.*[\\\/]/, '');

  function search(items) {
    for (const item of items) {
      const itemClean = (item.href || '').split('#')[0].replace(/^.*[\\\/]/, '');
      if (itemClean && (cleanHref === itemClean || href.endsWith(itemClean) || item.href.endsWith(cleanHref))) {
        return item;
      }
      if (Array.isArray(item.subitems) && item.subitems.length > 0) {
        const sub = search(item.subitems);
        if (sub) return sub;
      }
    }
    return null;
  }

  return search(tocList);
}

async function exportEpubAsMarkdown() {
  if (typeof JSZip === 'undefined') {
    throw new Error('ZIP 라이브러리를 불러오지 못했습니다.');
  }
  const zip = await JSZip.loadAsync(state.currentBook.content);

  // 1. Resolve OPF package file location
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

  // 2. Parse OPF to get chapter files in spine reading order
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error('EPUB OPF 메타데이터 파일을 찾을 수 없습니다.');
  }
  const opfText = await opfFile.async('text');
  const opfDoc = new DOMParser().parseFromString(opfText, 'application/xml');

  const manifestItems = {};
  opfDoc.querySelectorAll('manifest > item, item').forEach(item => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) manifestItems[id] = href;
  });

  // Collect all spine items with original 0-based spine index
  const allSpineItems = [];
  opfDoc.querySelectorAll('spine > itemref, itemref').forEach((ref, idx) => {
    const idref = ref.getAttribute('idref');
    const href = manifestItems[idref] || '';
    allSpineItems.push({
      spineIndex: idx,
      idref: idref || '',
      href: href || ''
    });
  });

  const exportSpineItems = allSpineItems.filter(item => {
    return item.href && !item.href.includes('highlights_appendix') && !item.href.includes('nav.xhtml');
  });

  const sortedHls = [...state.highlights].sort(compareHighlights);
  const hlFootnoteMap = new Map();
  sortedHls.forEach((hl, idx) => {
    hlFootnoteMap.set(hl.id, idx + 1);
  });

  // Chapter-isolate highlights: strictly group highlights by spine item
  const chapterHlsMap = new Map();
  exportSpineItems.forEach(item => chapterHlsMap.set(item, []));
  const unassignedHls = [];

  sortedHls.forEach(hl => {
    if (!hl.text) return;
    const matchedItem = findSpineItemForHighlight(hl, allSpineItems, exportSpineItems);
    if (matchedItem && chapterHlsMap.has(matchedItem)) {
      chapterHlsMap.get(matchedItem).push(hl);
    } else {
      unassignedHls.push(hl);
    }
  });

  let chaptersMd = '';

  for (const spineItem of exportSpineItems) {
    let cleanPath = opfDir + spineItem.href;
    const parts = cleanPath.split('/');
    const resolvedParts = [];
    for (const part of parts) {
      if (part === '..') {
        resolvedParts.pop();
      } else if (part !== '.' && part !== '') {
        resolvedParts.push(part);
      }
    }
    const resolvedPath = resolvedParts.join('/');

    const chapterFile = zip.file(resolvedPath) || zip.file(cleanPath) || zip.file(spineItem.href);
    if (!chapterFile) continue;

    const chapterHtml = await chapterFile.async('text');
    const doc = new DOMParser().parseFromString(chapterHtml, 'text/html');

    // Get highlights explicitly assigned to this chapter
    const chapterHls = chapterHlsMap.get(spineItem) || [];

    // Fallback: only match unassigned highlights if their targetSentence exists in this chapter
    for (let i = unassignedHls.length - 1; i >= 0; i--) {
      const uHl = unassignedHls[i];
      if (uHl.targetSentence && doc.body && doc.body.textContent.includes(uHl.targetSentence.trim())) {
        chapterHls.push(uHl);
        unassignedHls.splice(i, 1);
      }
    }

    // Process highlights in reverse reading order so DOM modifications don't shift earlier offsets
    chapterHls.sort((a, b) => compareHighlights(b, a));

    chapterHls.forEach(hl => {
      const fnNum = hlFootnoteMap.get(hl.id);
      injectFootnoteInDoc(doc, hl, fnNum);
    });

    // Determine the minimum heading level present in this chapter
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let minHeadingLevel = 6;
    let hasHeading = false;
    headings.forEach(h => {
      const lvl = parseInt(h.tagName.substring(1), 10);
      if (lvl < minHeadingLevel) minHeadingLevel = lvl;
      hasHeading = true;
    });

    const body = doc.body || doc.documentElement;
    let chapMd = cleanMarkdown(domToMarkdown(body, hasHeading ? minHeadingLevel : 1));

    // If chapter has no headings in DOM, check TOC to add H2 chapter title
    if (!hasHeading) {
      const tocItem = findTocItemForHref(spineItem.href, state.epub.toc);
      if (tocItem && tocItem.label && tocItem.label.trim()) {
        const tocTitle = tocItem.label.trim();
        const firstLine = chapMd.split('\n')[0].replace(/^[#*_\s]+|[#*_\s]+$/g, '').trim();
        if (firstLine && firstLine.toLowerCase() === tocTitle.toLowerCase()) {
          chapMd = chapMd.replace(/^[^\n]+/, `## ${tocTitle}`);
        } else {
          chapMd = `## ${tocTitle}\n\n${chapMd}`;
        }
      }
    }

    if (chapMd) {
      chaptersMd += `${chapMd}\n\n`;
    }
  }

  let fullMd = `# ${state.currentBook.title || 'EPUB Book'}\n\n`;
  if (state.currentBook.author) {
    fullMd += `*저자: ${state.currentBook.author}*\n\n`;
  }
  fullMd += `---\n\n${chaptersMd.trim()}\n\n`;

  if (sortedHls.length > 0) {
    fullMd += generateMarkdownQaSection(sortedHls, hlFootnoteMap);
  }

  return cleanMarkdown(fullMd) + '\n';
}

function injectFootnoteInDoc(doc, hl, fnNum) {
  if (!hl.text || !doc) return false;
  const body = doc.body || doc.documentElement;
  if (!body) return false;

  // 1. Try exact DOM Range via ePub.CFI if available
  if (typeof ePub !== 'undefined' && ePub.CFI && hl.cfiRange) {
    try {
      const cfi = new ePub.CFI(hl.cfiRange);
      const range = cfi.toRange(doc);
      if (range && range.endContainer) {
        if (range.endContainer.nodeType === Node.TEXT_NODE) {
          const val = range.endContainer.nodeValue;
          const offset = range.endOffset;
          range.endContainer.nodeValue = val.substring(0, offset) + `[^${fnNum}]` + val.substring(offset);
          return true;
        } else {
          const fnNode = doc.createTextNode(`[^${fnNum}]`);
          range.collapse(false);
          range.insertNode(fnNode);
          return true;
        }
      }
    } catch (e) {}
  }

  // 2. Context-aware sentence search inside the chapter element
  const targetSentence = (hl.targetSentence || '').trim();
  const hlText = hl.text.trim();

  if (targetSentence) {
    const candidates = Array.from(doc.querySelectorAll('p, li, blockquote, h1, h2, h3, h4, h5, h6, div'));
    let matchedEl = null;
    for (const el of candidates) {
      if (el.textContent && el.textContent.includes(targetSentence)) {
        matchedEl = el;
      }
    }

    if (matchedEl) {
      const walker = doc.createTreeWalker(matchedEl, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const val = node.nodeValue;
        if (!val) continue;

        if (val.includes(targetSentence)) {
          const sIdx = val.indexOf(targetSentence);
          const subIdx = val.indexOf(hlText, sIdx);
          if (subIdx !== -1 && subIdx <= sIdx + targetSentence.length) {
            const endIdx = subIdx + hlText.length;
            node.nodeValue = val.substring(0, endIdx) + `[^${fnNum}]` + val.substring(endIdx);
            return true;
          }
        } else if (val.includes(hlText)) {
          const matchIdx = val.indexOf(hlText);
          const endIdx = matchIdx + hlText.length;
          node.nodeValue = val.substring(0, endIdx) + `[^${fnNum}]` + val.substring(endIdx);
          return true;
        }
      }
    }
  }

  // 3. Fallback ONLY if hlText is sufficiently long and unique (>= 6 chars)
  // NEVER do loose matching for common short words like "into", "the", etc.
  if (!targetSentence && hlText.length >= 6) {
    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const val = node.nodeValue;
      if (!val) continue;
      const parentTag = (node.parentNode ? node.parentNode.nodeName : '').toLowerCase();
      if (parentTag === 'script' || parentTag === 'style') continue;

      if (val.includes(hlText)) {
        const matchIdx = val.indexOf(hlText);
        const endIdx = matchIdx + hlText.length;
        node.nodeValue = val.substring(0, endIdx) + `[^${fnNum}]` + val.substring(endIdx);
        return true;
      }
    }
  }

  return false;
}

function domToMarkdown(node, minHeadingLevel = 1) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue.replace(/[\r\n\t]+/g, ' ');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'meta' || tag === 'link') return '';

  let children = '';
  node.childNodes.forEach(child => {
    children += domToMarkdown(child, minHeadingLevel);
  });

  const clean = children.trim();

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      if (!clean) return '';
      const tagLevel = parseInt(tag.substring(1), 10);
      // Chapter heading is converted to H2 (##), Subchapter inside chapter is H3 (###)
      const targetLevel = Math.min(6, 2 + Math.max(0, tagLevel - minHeadingLevel));
      const hashes = '#'.repeat(targetLevel);
      return `\n\n${hashes} ${clean}\n\n`;
    }
    case 'p': return clean ? `\n\n${clean}\n\n` : '';
    case 'blockquote': return clean ? `\n\n> ${clean.replace(/\n+/g, '\n> ')}\n\n` : '';
    case 'ul': return clean ? `\n\n${clean}\n\n` : '';
    case 'ol': return clean ? `\n\n${clean}\n\n` : '';
    case 'li': return clean ? `\n- ${clean}` : '';
    case 'strong':
    case 'b': return clean ? `**${clean}**` : '';
    case 'em':
    case 'i': return clean ? `*${clean}*` : '';
    case 'code': return clean ? `\`${clean}\`` : '';
    case 'pre': return clean ? `\n\n\`\`\`\n${clean}\n\`\`\`\n\n` : '';
    case 'hr': return `\n\n---\n\n`;
    case 'br': return `\n`;
    default: return children;
  }
}

function generateMarkdownQaSection(sortedHls, hlFootnoteMap) {
  let qaMd = `\n---\n\n## 📑 Q&A (형광펜 및 단어장)\n\n`;

  sortedHls.forEach(hl => {
    const fnNum = hlFootnoteMap.get(hl.id);
    const phoneticStr = hl.phonetic && hl.phonetic.trim() ? ` *${hl.phonetic.trim()}*` : '';
    const meaningStr = hl.targetMeaning && hl.targetMeaning.trim() ? hl.targetMeaning.trim() : '(구문 뜻 미등록)';

    qaMd += `[^${fnNum}]: **${hl.text.trim()}**${phoneticStr}\n`;
    qaMd += `    - **💡 구문 뜻**: ${meaningStr}\n`;

    if (hl.targetSentence && hl.targetSentence.trim() && hl.targetSentence.trim() !== hl.text.trim()) {
      qaMd += `    - **📖 문맥 예문**: ${hl.targetSentence.trim().replace(/\n+/g, ' ')}\n`;
    }

    if (hl.sentenceTranslation && hl.sentenceTranslation.trim()) {
      const transLines = hl.sentenceTranslation.trim().split('\n');
      qaMd += `    - **📝 문장 해석 및 분석**:\n`;
      transLines.forEach(line => {
        qaMd += `      ${line}\n`;
      });
    }

    if (hl.note && hl.note.trim()) {
      qaMd += `    - **💬 독서 메모**: ${hl.note.trim()}\n`;
    }

    qaMd += `\n`;
  });

  return qaMd;
}

function downloadMarkdown(markdownContent, filename) {
  const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
let isRestoringTxtScroll = false;

function openTxtBook(title, author, content, bookId, skipSaveToDb = false, fallbackHighlights = null, fallbackPosition = null, fallbackBookmarks = null) {
  showReaderWorkspace();
  // Reset EPUB if any
  cleanupEpub();

  state.currentBook = {
    type: 'txt',
    title: title || 'Untitled Text',
    author: author || '',
    content,
    id: bookId || `txt_${Date.now()}`
  };

  state.highlights = loadHighlights(state.currentBook.id, fallbackHighlights);
  state.bookmarks = loadBookmarks(state.currentBook.id, fallbackBookmarks);
  state.highlightSearchQuery = '';
  if (elements.inputHighlightSearch) elements.inputHighlightSearch.value = '';
  if (elements.btnClearHighlightSearch) elements.btnClearHighlightSearch.style.display = 'none';
  updateMetadataUI();
  updateHighlightBadge();
  updateBookmarkBadge();

  elements.emptyState.style.display = 'none';
  elements.epubViewer.style.display = 'none';
  elements.btnToggleToc.style.display = 'none';
  elements.txtViewer.style.display = 'flex';
  elements.readerBottomBar.style.display = 'flex';
  elements.currentChapterTitle.textContent = state.currentBook.title;

  elements.txtContent.classList.remove('is-markdown');
  renderTxtContent(fallbackPosition);

  if (!skipSaveToDb) {
    saveActiveBookToStorage({
      type: 'txt',
      title: state.currentBook.title,
      author: state.currentBook.author,
      content,
      bookId: state.currentBook.id,
      lastPosition: fallbackPosition
    });
  }
}

function renderTxtContent(fallbackPosition = null) {
  const prevViewerScrollTop = elements.txtViewer ? elements.txtViewer.scrollTop : 0;
  const prevWindowScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  const wasScrolled = prevViewerScrollTop > 0 || prevWindowScrollY > 0;

  isRestoringTxtScroll = true;

  const frag = document.createDocumentFragment();
  const paragraphs = state.currentBook.content.split(/\n\s*\n/);
  paragraphs.forEach((pText, pIdx) => {
    const trimmed = pText.trim();
    if (!trimmed) return;

    const p = document.createElement('p');
    p.dataset.pIdx = pIdx;

    // Apply highlights if any exist for this paragraph
    p.innerHTML = applyHighlightsToParagraph(trimmed, pIdx);
    frag.appendChild(p);
  });

  elements.txtContent.innerHTML = '';
  elements.txtContent.appendChild(frag);

  // TXT Scroll progress tracking
  elements.txtViewer.onscroll = () => {
    if (isRestoringTxtScroll || (state.txt && state.txt.isResizing)) return;
    const scrollTop = elements.txtViewer.scrollTop;
    const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
    if (scrollHeight > 0) {
      const ratio = Math.min(1, Math.max(0, scrollTop / scrollHeight));
      if (!state.txt) state.txt = { currentRatio: 0, isResizing: false };
      state.txt.currentRatio = ratio;
      const pct = Math.min(100, Math.max(0, Math.round(ratio * 100)));
      elements.progressSlider.value = pct;
      elements.progressPercent.textContent = `${pct}%`;
      if (state.currentBook) {
        localStorage.setItem(`reader_pos_${state.currentBook.id}`, pct);
        localStorage.setItem('reader_last_book_id', state.currentBook.id);
        updateActiveBookLastPosition(pct);
      }
    }
  };

  // Restore saved scroll position if any
  if (fallbackPosition !== null && fallbackPosition !== undefined && fallbackPosition !== '') {
    const applyExplicitScroll = () => {
      const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
      if (scrollHeight > 0) {
        const ratio = Math.min(1, Math.max(0, parseFloat(fallbackPosition) / 100));
        if (!state.txt) state.txt = { currentRatio: 0, isResizing: false };
        state.txt.currentRatio = ratio;
        elements.txtViewer.scrollTop = ratio * scrollHeight;
        const pct = Math.round(parseFloat(fallbackPosition));
        elements.progressSlider.value = pct;
        elements.progressPercent.textContent = `${pct}%`;
      }
    };
    applyExplicitScroll();
    setTimeout(applyExplicitScroll, 50);
    setTimeout(() => {
      applyExplicitScroll();
      isRestoringTxtScroll = false;
    }, 200);
  } else if (wasScrolled) {
    if (elements.txtViewer && prevViewerScrollTop > 0) {
      elements.txtViewer.scrollTop = prevViewerScrollTop;
    }
    if (prevWindowScrollY > 0) {
      window.scrollTo(0, prevWindowScrollY);
    }
    requestAnimationFrame(() => {
      if (elements.txtViewer && prevViewerScrollTop > 0) {
        elements.txtViewer.scrollTop = prevViewerScrollTop;
      }
      if (prevWindowScrollY > 0) {
        window.scrollTo(0, prevWindowScrollY);
      }
      isRestoringTxtScroll = false;
    });
  } else {
    const savedPos = localStorage.getItem(`reader_pos_${state.currentBook.id}`);
    if (savedPos !== null && savedPos !== undefined && savedPos !== '') {
      const applySavedScroll = () => {
        const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
        if (scrollHeight > 0) {
          const ratio = Math.min(1, Math.max(0, parseFloat(savedPos) / 100));
          if (!state.txt) state.txt = { currentRatio: 0, isResizing: false };
          state.txt.currentRatio = ratio;
          elements.txtViewer.scrollTop = ratio * scrollHeight;
          const pct = Math.round(parseFloat(savedPos));
          elements.progressSlider.value = pct;
          elements.progressPercent.textContent = `${pct}%`;
        }
      };
      applySavedScroll();
      setTimeout(applySavedScroll, 50);
      setTimeout(() => {
        applySavedScroll();
        isRestoringTxtScroll = false;
      }, 200);
    } else {
      isRestoringTxtScroll = false;
    }
  }

  // Bind click on marks
  bindHighlightClickEvents();
}

function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function applyHighlightsToParagraph(paragraphText, pIdx) {
  const pHighlights = state.highlights.filter(h => h.pIdx === pIdx && h.text);
  if (pHighlights.length === 0) {
    return escapeHtml(paragraphText);
  }

  // Find precise start & end in raw paragraphText for each highlight
  const validatedHls = [];
  for (const hl of pHighlights) {
    let start = -1;
    const textLen = hl.text.length;
    if (typeof hl.offset === 'number' && hl.offset >= 0 && hl.offset + textLen <= paragraphText.length) {
      if (paragraphText.substring(hl.offset, hl.offset + textLen) === hl.text) {
        start = hl.offset;
      }
    }
    // Fallback: search closest or first occurrence if offset not matched
    if (start === -1) {
      if (hl.targetSentence) {
        const targetSearch = paragraphText.indexOf(hl.targetSentence);
        if (targetSearch !== -1) {
          const subIdx = paragraphText.indexOf(hl.text, targetSearch);
          if (subIdx !== -1 && subIdx <= targetSearch + hl.targetSentence.length) {
            start = subIdx;
          }
        }
      }
    }
    if (start === -1) {
      start = paragraphText.indexOf(hl.text);
    }

    if (start !== -1) {
      validatedHls.push({
        ...hl,
        _start: start,
        _end: start + textLen
      });
    }
  }

  if (validatedHls.length === 0) {
    return escapeHtml(paragraphText);
  }

  // Sort descending by start to filter out overlapping ranges
  validatedHls.sort((a, b) => b._start - a._start);
  const nonOverlapping = [];
  let lastStart = Infinity;
  for (const item of validatedHls) {
    if (item._end <= lastStart) {
      nonOverlapping.push(item);
      lastStart = item._start;
    }
  }

  // Build final HTML safely using forward construction
  nonOverlapping.sort((a, b) => a._start - b._start);
  let resultHtml = '';
  let curIdx = 0;

  for (const hl of nonOverlapping) {
    if (hl._start > curIdx) {
      resultHtml += escapeHtml(paragraphText.substring(curIdx, hl._start));
    }
    const rawMatch = paragraphText.substring(hl._start, hl._end);
    resultHtml += `<mark class="reader-highlight hl-${hl.color || 'yellow'}" data-hl-id="${escapeHtml(hl.id)}">${escapeHtml(rawMatch)}</mark>`;
    curIdx = hl._end;
  }
  if (curIdx < paragraphText.length) {
    resultHtml += escapeHtml(paragraphText.substring(curIdx));
  }

  return resultHtml;
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

// ── Markdown Book Viewer (marked.js) ──
function extractMarkdownMetadata(rawContent, fileName) {
  let title = fileName.replace(/\.(md|markdown|txt)$/i, '');
  let author = '';

  // 1. YAML frontmatter check
  const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const fmText = fmMatch[1];
    const titleMatch = fmText.match(/^title:\s*["']?(.*?)["']?$/m);
    if (titleMatch && titleMatch[1].trim()) title = titleMatch[1].trim();
    const authorMatch = fmText.match(/^author:\s*["']?(.*?)["']?$/m);
    if (authorMatch && authorMatch[1].trim()) author = authorMatch[1].trim();
  }

  // 2. Heading 1 check
  if (!fmMatch) {
    const h1Match = rawContent.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1].trim()) {
      title = h1Match[1].trim();
    }
  }

  // 3. Author check: *저자: ...* or _Author: ..._
  const authorMatch = rawContent.match(/^\*(?:저자|Author):\s*(.+)\*$/mi) || rawContent.match(/^_(?:저자|Author):\s*(.+)_$/mi);
  if (authorMatch && authorMatch[1].trim()) {
    author = authorMatch[1].trim();
  }

  return { title, author };
}

function openMdBook(title, author, content, bookId, skipSaveToDb = false, fallbackHighlights = null, fallbackPosition = null, fallbackBookmarks = null) {
  showReaderWorkspace();
  // Reset EPUB if any
  cleanupEpub();

  state.currentBook = {
    type: 'md',
    title: title || 'Untitled Markdown',
    author: author || '',
    content,
    id: bookId || `md_${Date.now()}`
  };

  state.highlights = loadHighlights(state.currentBook.id, fallbackHighlights);
  state.bookmarks = loadBookmarks(state.currentBook.id, fallbackBookmarks);
  state.highlightSearchQuery = '';
  if (elements.inputHighlightSearch) elements.inputHighlightSearch.value = '';
  if (elements.btnClearHighlightSearch) elements.btnClearHighlightSearch.style.display = 'none';
  updateMetadataUI();
  updateHighlightBadge();
  updateBookmarkBadge();

  elements.emptyState.style.display = 'none';
  elements.epubViewer.style.display = 'none';
  elements.txtViewer.style.display = 'flex';
  elements.readerBottomBar.style.display = 'flex';
  elements.currentChapterTitle.textContent = state.currentBook.title;
  elements.txtContent.classList.add('is-markdown');

  renderMdContent(fallbackPosition);

  if (!skipSaveToDb) {
    saveActiveBookToStorage({
      type: 'md',
      title: state.currentBook.title,
      author: state.currentBook.author,
      content,
      bookId: state.currentBook.id,
      lastPosition: fallbackPosition
    });
  }
}

function parseMarkdownFootnotes(content, existingHighlights = []) {
  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');

  let qaHeadingIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s+.*(?:Q&A|각주|형광펜|단어장|Footnote)/i.test(lines[i])) {
      qaHeadingIndex = i;
      break;
    }
  }

  const fnDefs = new Map();
  let curTag = null;
  let curLines = [];
  const bodyLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const defMatch = line.match(/^\[\^([^\]]+)\]:\s*(.*)$/);
    if (defMatch) {
      if (curTag) {
        fnDefs.set(curTag, curLines.join('\n'));
      }
      curTag = defMatch[1];
      curLines = [defMatch[2]];
    } else if (curTag) {
      if (/^(?:[ \t]{2,}|\t|\s*$)/.test(line)) {
        curLines.push(line);
      } else {
        fnDefs.set(curTag, curLines.join('\n'));
        curTag = null;
        curLines = [];
        if (qaHeadingIndex === -1 || i < qaHeadingIndex) {
          bodyLines.push(line);
        }
      }
    } else {
      if (qaHeadingIndex === -1 || i < qaHeadingIndex) {
        bodyLines.push(line);
      }
    }
  }
  if (curTag) {
    fnDefs.set(curTag, curLines.join('\n'));
  }

  while (bodyLines.length > 0 && /^\s*---\s*$/.test(bodyLines[bodyLines.length - 1])) {
    bodyLines.pop();
  }

  let bodyText = bodyLines.join('\n').trim();

  const parsedHls = [];
  fnDefs.forEach((body, tag) => {
    let term = '';
    let phonetic = '';
    let targetMeaning = '';
    let targetSentence = '';
    let sentenceTranslation = '';
    let note = '';

    const termMatch = body.match(/^\s*\*\*([^*]+)\*\*(?:\s*(?:\*([^*]+)\*|\/([^/]+)\/))?/);
    if (termMatch) {
      term = termMatch[1].trim();
      phonetic = (termMatch[2] || termMatch[3] || '').trim();
    }

    const meaningMatch = body.match(/-\s*\*\*💡\s*구문\s*뜻\*\*:\s*([^\n]+)/);
    if (meaningMatch) {
      targetMeaning = meaningMatch[1].trim();
    } else if (term) {
      const firstLineRest = body.split('\n')[0].replace(/^\s*\*\*[^*]+\*\*(?:\s*(?:\*[^*]+\*|\/[^/]+\/))?[:\s-]*/, '').trim();
      if (firstLineRest) {
        targetMeaning = firstLineRest;
      }
    } else {
      targetMeaning = body.split('\n')[0].trim();
    }

    const sentMatch = body.match(/-\s*\*\*📖\s*문맥\s*예문\*\*:\s*([^\n]+)/);
    if (sentMatch) {
      targetSentence = sentMatch[1].trim();
    }

    const transMatch = body.match(/-\s*\*\*📝\s*문장\s*해석[^*]*\*\*:\s*([\s\S]*?)(?=(?:\n\s*-\s*\*\*|$))/);
    if (transMatch) {
      sentenceTranslation = transMatch[1]
        .split('\n')
        .map(l => l.replace(/^[ \t]{2,}/, ''))
        .join('\n')
        .trim();
    }

    const noteMatch = body.match(/-\s*\*\*💬\s*독서\s*메모\*\*:\s*([\s\S]*?)(?=(?:\n\s*-\s*\*\*|$))/);
    if (noteMatch) {
      note = noteMatch[1].trim();
    }

    if (!term) {
      const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const refRegex = new RegExp(`(?:\\[([^\\]]+)\\]|\\*\\*([^*]+)\\*\\*|([A-Za-z0-9_\\-\\x27\\x22\\u2019]+))\\s*\\[\\^${escapedTag}\\]`);
      const match = bodyText.match(refRegex);
      if (match) {
        term = (match[1] || match[2] || match[3] || '').trim();
      } else {
        term = `각주 ${tag}`;
      }
    }

    const hlId = `fn_${tag}_${term.replace(/\W+/g, '_')}`;
    const existing = existingHighlights.find(h => h.id === hlId || (h.text === term && h.fnTag === tag));

    const hl = {
      id: hlId,
      text: term,
      phonetic: phonetic || (existing ? existing.phonetic : '') || '',
      targetMeaning: (existing && existing.targetMeaning) ? existing.targetMeaning : targetMeaning,
      targetSentence: targetSentence || (existing ? existing.targetSentence : ''),
      sentenceTranslation: (existing && existing.sentenceTranslation) ? existing.sentenceTranslation : sentenceTranslation,
      note: (existing && existing.note) ? existing.note : note,
      color: (existing && existing.color) ? existing.color : 'yellow',
      fnTag: tag,
      isFootnote: true,
      studyCount: existing ? (existing.studyCount || 0) : 0,
      wrongCount: existing ? (existing.wrongCount || 0) : 0,
      createdAt: existing ? existing.createdAt : Date.now()
    };
    parsedHls.push(hl);
  });

  return { parsedHls, bodyText };
}

function injectFootnoteHighlightsInMarkdown(bodyText, highlights) {
  let result = bodyText;
  const footnoteHls = (highlights || []).filter(h => h.isFootnote || h.fnTag);

  for (const hl of footnoteHls) {
    const escapedTag = String(hl.fnTag).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedTerm = String(hl.text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const bracketRegex = new RegExp(`(?:\\[\\*\\*${escapedTerm}\\*\\*\\]|\\[${escapedTerm}\\]|\\*\\*${escapedTerm}\\*\\*|\\*${escapedTerm}\\*|${escapedTerm})\\s*\\[\\^${escapedTag}\\]`, 'g');
    if (bracketRegex.test(result)) {
      result = result.replace(bracketRegex, `<mark class="reader-highlight hl-${hl.color || 'yellow'}" data-hl-id="${hl.id}" id="fn-src-${hl.fnTag}">${hl.text}</mark>`);
    } else {
      const standaloneRegex = new RegExp(`\\[\\^${escapedTag}\\]`, 'g');
      result = result.replace(standaloneRegex, '');
    }
  }

  // Remove any remaining raw footnote markers in body text so no [^tag] text is displayed in reader
  result = result.replace(/\[\^[a-zA-Z0-9_-]+\]/g, '');

  return result;
}

function extractMarkdownToc() {
  state.toc = [];
  const headings = elements.txtContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach((h, idx) => {
    if (h.classList.contains('footnotes-title')) return;
    const id = `md-h-${idx}`;
    h.id = id;
    h.classList.add('md-heading');
    const level = parseInt(h.tagName.substring(1), 10);
    const label = h.textContent.trim();
    if (label) {
      state.toc.push({ id, label, level });
    }
  });

  if (state.toc.length > 0) {
    elements.btnToggleToc.style.display = 'inline-flex';
  } else {
    elements.btnToggleToc.style.display = 'none';
  }
}

function applyDomHighlights(rootElem, highlights) {
  if (!highlights || highlights.length === 0) return;

  highlights.forEach(hl => {
    if (!hl.text) return;
    if (rootElem.querySelector(`[data-hl-id="${hl.id}"]`)) return;

    const walker = document.createTreeWalker(rootElem, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const matchedNodes = [];

    while ((node = walker.nextNode())) {
      if (node.parentElement && (node.parentElement.closest('.reader-highlight') || node.parentElement.closest('script, style, code, pre'))) {
        continue;
      }
      if (node.nodeValue && node.nodeValue.includes(hl.text)) {
        if (hl.targetSentence) {
          const parentP = node.parentElement ? node.parentElement.textContent : '';
          if (!parentP.includes(hl.targetSentence)) {
            continue;
          }
        }
        matchedNodes.push(node);
        break;
      }
    }

    matchedNodes.forEach(textNode => {
      const idx = textNode.nodeValue.indexOf(hl.text);
      if (idx !== -1) {
        const afterNode = textNode.splitText(idx);
        afterNode.splitText(hl.text.length);

        const mark = document.createElement('mark');
        mark.className = `reader-highlight hl-${hl.color || 'yellow'}`;
        mark.dataset.hlId = hl.id;
        mark.textContent = afterNode.nodeValue;

        afterNode.parentNode.replaceChild(mark, afterNode);
      }
    });
  });
}

function appendFootnotesSection(container, highlights) {
  const footnoteHls = (highlights || []).filter(h => h.isFootnote || h.fnTag);
  if (footnoteHls.length === 0) return;

  footnoteHls.sort((a, b) => {
    const numA = parseInt(a.fnTag, 10);
    const numB = parseInt(b.fnTag, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return String(a.fnTag).localeCompare(String(b.fnTag));
  });

  const section = document.createElement('div');
  section.className = 'markdown-footnotes-section';
  section.id = 'markdown-footnotes-section';

  const title = document.createElement('h2');
  title.className = 'footnotes-title';
  title.innerHTML = '<span>📑</span> 각주 및 Q&A 목록';
  section.appendChild(title);

  const ol = document.createElement('ol');
  ol.className = 'footnotes-list';

  footnoteHls.forEach(hl => {
    const li = document.createElement('li');
    li.className = 'footnote-item';
    li.id = `fn-ref-${hl.fnTag}`;

    const header = document.createElement('div');
    header.className = 'footnote-item-header';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '8px';

    const tagBadge = document.createElement('span');
    tagBadge.className = 'fn-badge';
    tagBadge.textContent = `[${hl.fnTag}]`;

    const wordEl = document.createElement('strong');
    wordEl.style.fontSize = '1.05em';
    wordEl.textContent = hl.text;

    left.appendChild(tagBadge);
    left.appendChild(wordEl);

    if (hl.phonetic) {
      const phEl = document.createElement('span');
      phEl.className = 'hl-phonetic-badge';
      phEl.textContent = hl.phonetic;
      left.appendChild(phEl);
    }

    const backLink = document.createElement('a');
    backLink.className = 'fn-backref';
    backLink.href = `#fn-src-${hl.fnTag}`;
    backLink.title = '본문으로 이동';
    backLink.textContent = '↩ 본문';
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      const mark = container.querySelector(`[data-hl-id="${hl.id}"]`);
      if (mark) {
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        mark.style.outline = '3px solid var(--accent)';
        mark.style.borderRadius = '3px';
        setTimeout(() => { mark.style.outline = 'none'; }, 1800);
      }
    });

    header.appendChild(left);
    header.appendChild(backLink);
    li.appendChild(header);

    const details = document.createElement('div');
    details.className = 'footnote-item-details';

    if (hl.targetMeaning) {
      const row = document.createElement('div');
      row.className = 'footnote-detail-row';
      row.innerHTML = `<strong>💡 뜻:</strong> <span>${escapeHtml(hl.targetMeaning)}</span>`;
      details.appendChild(row);
    }

    if (hl.targetSentence && hl.targetSentence !== hl.text) {
      const row = document.createElement('div');
      row.className = 'footnote-detail-row';
      row.innerHTML = `<strong>📖 예문:</strong> <span>${escapeHtml(hl.targetSentence)}</span>`;
      details.appendChild(row);
    }

    if (hl.sentenceTranslation) {
      const row = document.createElement('div');
      row.className = 'footnote-detail-row';
      row.innerHTML = `<strong>📝 해석:</strong> <span>${escapeHtml(hl.sentenceTranslation)}</span>`;
      details.appendChild(row);
    }

    if (hl.note) {
      const row = document.createElement('div');
      row.className = 'footnote-detail-row';
      row.innerHTML = `<strong>💬 메모:</strong> <span>${escapeHtml(hl.note)}</span>`;
      details.appendChild(row);
    }

    li.appendChild(details);
    ol.appendChild(li);
  });

  section.appendChild(ol);
  container.appendChild(section);
}

function bindFootnoteBadgeEvents() {
  const badges = elements.txtContent.querySelectorAll('.fn-badge');
  badges.forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      const hlId = badge.dataset.hlId;
      const hl = state.highlights.find(h => h.id === hlId);
      if (hl) {
        openHighlightToolbar(hl, badge);
      }
    });
  });
}

function renderMdContent(fallbackPosition = null) {
  // 1. Capture exact scroll positions BEFORE touching DOM!
  const prevViewerScrollTop = elements.txtViewer ? elements.txtViewer.scrollTop : 0;
  const prevWindowScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  const wasScrolled = prevViewerScrollTop > 0 || prevWindowScrollY > 0;

  isRestoringTxtScroll = true;

  const { parsedHls, bodyText } = parseMarkdownFootnotes(state.currentBook.content || '', state.highlights);

  let hlChanged = false;
  parsedHls.forEach(fnHl => {
    const idx = state.highlights.findIndex(h => h.id === fnHl.id || (h.text === fnHl.text && h.fnTag === fnHl.fnTag));
    if (idx === -1) {
      state.highlights.push(fnHl);
      hlChanged = true;
    } else {
      const existing = state.highlights[idx];
      if (!existing.targetMeaning && fnHl.targetMeaning) { existing.targetMeaning = fnHl.targetMeaning; hlChanged = true; }
      if (!existing.phonetic && fnHl.phonetic) { existing.phonetic = fnHl.phonetic; hlChanged = true; }
      if (!existing.sentenceTranslation && fnHl.sentenceTranslation) { existing.sentenceTranslation = fnHl.sentenceTranslation; hlChanged = true; }
      if (!existing.note && fnHl.note) { existing.note = fnHl.note; hlChanged = true; }
      existing.fnTag = fnHl.fnTag;
      existing.isFootnote = true;
    }
  });

  if (hlChanged) {
    sortHighlights();
    saveHighlights();
    updateHighlightBadge();
  }

  const transformedMd = injectFootnoteHighlightsInMarkdown(bodyText, state.highlights);

  let html = '';
  if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
    html = marked.parse(transformedMd);
  } else {
    html = transformedMd.replace(/\n/g, '<br>');
  }

  // Update DOM in a single operation without premature clearing
  elements.txtContent.innerHTML = html;
  elements.txtContent.classList.add('is-markdown');

  const blockElements = elements.txtContent.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, tr');
  blockElements.forEach((el, idx) => {
    el.dataset.pIdx = idx;
  });

  applyDomHighlights(elements.txtContent, state.highlights);

  const marks = elements.txtContent.querySelectorAll('.reader-highlight');
  marks.forEach(mark => {
    const hlId = mark.dataset.hlId;
    const hl = state.highlights.find(h => h.id === hlId);
    if (hl) {
      const parentBlock = mark.closest('[data-p-idx]');
      if (parentBlock) {
        hl.pIdx = parseInt(parentBlock.dataset.pIdx, 10);
      }
    }
  });

  extractMarkdownToc();
  appendFootnotesSection(elements.txtContent, state.highlights);

  elements.txtViewer.onscroll = () => {
    if (isRestoringTxtScroll || (state.txt && state.txt.isResizing)) return;
    const scrollTop = elements.txtViewer.scrollTop;
    const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
    if (scrollHeight > 0) {
      const ratio = Math.min(1, Math.max(0, scrollTop / scrollHeight));
      if (!state.txt) state.txt = { currentRatio: 0, isResizing: false };
      state.txt.currentRatio = ratio;
      const pct = Math.min(100, Math.max(0, Math.round(ratio * 100)));
      elements.progressSlider.value = pct;
      elements.progressPercent.textContent = `${pct}%`;
      if (state.currentBook) {
        localStorage.setItem(`reader_pos_${state.currentBook.id}`, pct);
        localStorage.setItem('reader_last_book_id', state.currentBook.id);
        updateActiveBookLastPosition(pct);
      }
    }

    if (state.currentBook && state.currentBook.type === 'md' && state.toc.length > 0) {
      const headings = elements.txtContent.querySelectorAll('.md-heading');
      let currentHeadingText = state.currentBook.title;
      const scrollThreshold = elements.txtViewer.scrollTop + 120;
      headings.forEach(h => {
        if (h.offsetTop <= scrollThreshold) {
          currentHeadingText = h.textContent.trim();
        }
      });
      elements.currentChapterTitle.textContent = currentHeadingText;
    }
  };

  // Restore scroll position
  if (fallbackPosition !== null && fallbackPosition !== undefined && fallbackPosition !== '') {
    const applyExplicitScroll = () => {
      const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
      if (scrollHeight > 0) {
        const ratio = Math.min(1, Math.max(0, parseFloat(fallbackPosition) / 100));
        if (!state.txt) state.txt = { currentRatio: 0, isResizing: false };
        state.txt.currentRatio = ratio;
        elements.txtViewer.scrollTop = ratio * scrollHeight;
        const pct = Math.round(parseFloat(fallbackPosition));
        elements.progressSlider.value = pct;
        elements.progressPercent.textContent = `${pct}%`;
      }
    };
    applyExplicitScroll();
    setTimeout(applyExplicitScroll, 50);
    setTimeout(() => {
      applyExplicitScroll();
      isRestoringTxtScroll = false;
    }, 200);
  } else if (wasScrolled) {
    // Synchronously restore previous scroll position on highlight edit
    if (elements.txtViewer && prevViewerScrollTop > 0) {
      elements.txtViewer.scrollTop = prevViewerScrollTop;
    }
    if (prevWindowScrollY > 0) {
      window.scrollTo(0, prevWindowScrollY);
    }
    requestAnimationFrame(() => {
      if (elements.txtViewer && prevViewerScrollTop > 0) {
        elements.txtViewer.scrollTop = prevViewerScrollTop;
      }
      if (prevWindowScrollY > 0) {
        window.scrollTo(0, prevWindowScrollY);
      }
      isRestoringTxtScroll = false;
    });
  } else {
    const savedPos = localStorage.getItem(`reader_pos_${state.currentBook.id}`);
    if (savedPos !== null && savedPos !== undefined && savedPos !== '') {
      const applySavedScroll = () => {
        const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
        if (scrollHeight > 0) {
          const ratio = Math.min(1, Math.max(0, parseFloat(savedPos) / 100));
          if (!state.txt) state.txt = { currentRatio: 0, isResizing: false };
          state.txt.currentRatio = ratio;
          elements.txtViewer.scrollTop = ratio * scrollHeight;
          const pct = Math.round(parseFloat(savedPos));
          elements.progressSlider.value = pct;
          elements.progressPercent.textContent = `${pct}%`;
        }
      };
      applySavedScroll();
      setTimeout(applySavedScroll, 50);
      setTimeout(() => {
        applySavedScroll();
        isRestoringTxtScroll = false;
      }, 200);
    } else {
      isRestoringTxtScroll = false;
    }
  }

  bindHighlightClickEvents();
  bindFootnoteBadgeEvents();
}

// ── EPUB Book Viewer (epub.js) ──
let epubResizeDebounceTimer = null;
let txtResizeDebounceTimer = null;

function cleanupEpub() {
  if (state.epub.resizeObserver) {
    try {
      state.epub.resizeObserver.disconnect();
    } catch (e) {}
    state.epub.resizeObserver = null;
  }
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
  state.epub.currentCfi = null;
  state.epub.pendingRestoreCfi = null;
  state.epub.isResizing = false;
  if (epubResizeDebounceTimer) {
    clearTimeout(epubResizeDebounceTimer);
    epubResizeDebounceTimer = null;
  }
  elements.epubArea.innerHTML = '';
}

/**
 * EPUB 뷰어 영역 리사이즈 및 오리엔테이션 회전 시 현재 읽던 위치(CFI) 보존 동기화
 */
function triggerEpubResizeSafe(immediateTargetCfi = null) {
  if (!state.currentBook || state.currentBook.type !== 'epub' || !state.epub.rendition) return;

  // 1. 화면 회전/리사이즈로 인해 레이아웃이 초기화(54%)되기 전의 온전한 읽기 위치(57%)를 즉시 확보하여 잠금
  const loc = state.epub.rendition.currentLocation();
  const currentCfi = immediateTargetCfi
    || state.epub.currentCfi
    || (loc && loc.start && loc.start.cfi)
    || localStorage.getItem(`reader_pos_${state.currentBook.id}`);

  if (currentCfi) {
    if (!state.epub.pendingRestoreCfi) {
      state.epub.pendingRestoreCfi = currentCfi;
    }
    state.epub.currentCfi = currentCfi;
  }

  // 2. 리사이즈 도중 epub.js가 챕터 첫 페이지로 튕기면서 발생하는 임시 relocated 이벤트가 localStorage를 덮어쓰지 못하도록 차단
  state.epub.isResizing = true;

  if (epubResizeDebounceTimer) {
    clearTimeout(epubResizeDebounceTimer);
  }

  // iPadOS 회전 애니메이션 프레임 떨림을 방지하기 위한 디바운스
  epubResizeDebounceTimer = setTimeout(async () => {
    await executeEpubResizeAndRestore();
  }, 120);
}

async function executeEpubResizeAndRestore() {
  if (!state.currentBook || state.currentBook.type !== 'epub' || !state.epub.rendition) {
    state.epub.isResizing = false;
    state.epub.pendingRestoreCfi = null;
    return;
  }

  const targetCfi = state.epub.pendingRestoreCfi || state.epub.currentCfi || localStorage.getItem(`reader_pos_${state.currentBook.id}`);

  try {
    const area = elements.epubArea;
    const w = area ? area.clientWidth : 0;
    const h = area ? area.clientHeight : 0;

    if (w > 0 && h > 0) {
      state.epub.rendition.resize(w, h);
    } else {
      state.epub.rendition.resize();
    }

    // 브라우저 렌더링 엔진(WebKit/Blink)이 새로운 칼럼 폭을 계산할 시간 부여
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // 가로/세로 변경된 화면 폭에 맞춰 직전에 읽던 정확한 문장/위치(CFI)로 복원
    if (targetCfi) {
      const pointCfi = getStartCfi(targetCfi) || targetCfi;
      try {
        await state.epub.rendition.display(pointCfi);
      } catch (err) {
        if (pointCfi !== targetCfi) {
          try {
            await state.epub.rendition.display(targetCfi);
          } catch (e2) {
            console.warn('Fallback targetCfi display error:', e2);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error during EPUB resize and restore:', err);
  } finally {
    setTimeout(() => {
      try {
        const finalLoc = state.epub.rendition ? state.epub.rendition.currentLocation() : null;
        if (finalLoc && finalLoc.start && finalLoc.start.cfi) {
          state.epub.currentCfi = finalLoc.start.cfi;
          localStorage.setItem(`reader_pos_${state.currentBook.id}`, finalLoc.start.cfi);
          localStorage.setItem('reader_last_book_id', state.currentBook.id);
          updateActiveBookLastPosition(finalLoc.start.cfi);
          updateEpubProgress(finalLoc);
        } else if (targetCfi) {
          state.epub.currentCfi = targetCfi;
          if (state.epub.book && state.epub.locationsReady) {
            const progress = state.epub.book.locations.percentageFromCfi(targetCfi);
            const pct = Math.round(progress * 100);
            elements.progressSlider.value = pct;
            elements.progressPercent.textContent = `${pct}%`;
          }
        }
      } catch (e) {}

      state.epub.isResizing = false;
      state.epub.pendingRestoreCfi = null;
      restoreEpubHighlights();
    }, 100);
  }
}

/**
 * TXT 뷰어 창 크기 및 화면 회전 시 스크롤 비율(독서 위치) 유지
 */
function triggerTxtResizeSafe() {
  if (!state.currentBook || (state.currentBook.type !== 'txt' && state.currentBook.type !== 'md') || !elements.txtViewer) return;
  if (!state.txt) state.txt = { currentRatio: 0, isResizing: false };

  const savedPos = localStorage.getItem(`reader_pos_${state.currentBook.id}`);
  const ratio = (state.txt.currentRatio > 0)
    ? state.txt.currentRatio
    : (savedPos !== null ? parseFloat(savedPos) / 100 : 0);

  state.txt.isResizing = true;
  if (txtResizeDebounceTimer) clearTimeout(txtResizeDebounceTimer);
  txtResizeDebounceTimer = setTimeout(() => {
    const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
    if (scrollHeight > 0 && ratio > 0) {
      elements.txtViewer.scrollTop = ratio * scrollHeight;
    }
    setTimeout(() => {
      if (state.txt) state.txt.isResizing = false;
    }, 100);
  }, 120);
}

function setupEpubResizeObserver() {
  if (!window.ResizeObserver || !elements.epubArea) return;
  if (state.epub.resizeObserver) {
    try {
      state.epub.resizeObserver.disconnect();
    } catch (e) {}
    state.epub.resizeObserver = null;
  }

  let lastObservedWidth = elements.epubArea.clientWidth || 0;
  let lastObservedHeight = elements.epubArea.clientHeight || 0;

  state.epub.resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const cr = entry.contentRect;
      if (!cr || cr.width <= 0 || cr.height <= 0) continue;

      if (Math.abs(cr.width - lastObservedWidth) > 1 || Math.abs(cr.height - lastObservedHeight) > 1) {
        lastObservedWidth = cr.width;
        lastObservedHeight = cr.height;

        triggerEpubResizeSafe();
      }
    }
  });

  state.epub.resizeObserver.observe(elements.epubArea);
}

function openEpubBook(initialTitle, initialAuthor, arrayBuffer, bookId, skipSaveToDb = false, fallbackHighlights = null, fallbackPosition = null, fallbackBookmarks = null) {
  showReaderWorkspace();
  cleanupEpub();

  state.currentBook = {
    type: 'epub',
    title: initialTitle || 'EPUB Book',
    author: initialAuthor || '',
    content: arrayBuffer,
    id: bookId || `epub_${Date.now()}`
  };

  state.highlights = loadHighlights(state.currentBook.id, fallbackHighlights);
  state.bookmarks = loadBookmarks(state.currentBook.id, fallbackBookmarks);
  state.highlightSearchQuery = '';
  if (elements.inputHighlightSearch) elements.inputHighlightSearch.value = '';
  if (elements.btnClearHighlightSearch) elements.btnClearHighlightSearch.style.display = 'none';
  updateMetadataUI();
  updateHighlightBadge();
  updateBookmarkBadge();

  elements.emptyState.style.display = 'none';
  elements.txtViewer.style.display = 'none';
  elements.epubViewer.style.display = 'flex';
  elements.btnToggleToc.style.display = 'inline-flex';
  elements.readerBottomBar.style.display = 'flex';

  // Force layout reflow so epubArea has definite width and height
  void elements.epubViewer.offsetWidth;
  void elements.epubViewer.offsetHeight;
  void elements.epubArea.offsetWidth;
  void elements.epubArea.offsetHeight;

  if (!skipSaveToDb) {
    saveActiveBookToStorage({
      type: 'epub',
      title: state.currentBook.title,
      author: state.currentBook.author,
      content: arrayBuffer,
      bookId: state.currentBook.id,
      lastPosition: fallbackPosition
    });
  }

  try {
    patchEpubCfi();
    const book = ePub(arrayBuffer);
    state.epub.book = book;

    const rendition = book.renderTo("epub-area", {
      width: "100%",
      height: "100%",
      spread: "none",
      minSpreadWidth: 10000,
      flow: "paginated",
      allowScriptedContent: true
    });
    state.epub.rendition = rendition;
    setupEpubResizeObserver();

    // View render hook: patch Range DOM prototype immediately when any view is created
    rendition.hooks.render.register((view) => {
      if (view) {
        if (view.window) patchRangeForEpub(view.window);
        if (view.document && view.document.defaultView) patchRangeForEpub(view.document.defaultView);
        if (view.iframe && view.iframe.contentWindow) patchRangeForEpub(view.iframe.contentWindow);
      }
    });

    const ensureRenditionLayout = () => {
      if (state.epub.rendition) {
        try {
          state.epub.rendition.resize();
        } catch (e) {}
      }
    };

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

    // Check if EPUB archive has embedded reader_highlights.json
    if (typeof JSZip !== 'undefined') {
      JSZip.loadAsync(arrayBuffer).then(zip => {
        const hlFile = zip.file('META-INF/reader_highlights.json');
        if (hlFile) {
          hlFile.async('text').then(jsonText => {
            try {
              const data = JSON.parse(jsonText);
              if (Array.isArray(data.highlights) && data.highlights.length > 0) {
                // 기존 state.highlights의 Q&A 뜻/해석/학습통계가 지워지지 않도록 지능형 병합(Merge) 수행
                const currentList = Array.isArray(state.highlights) ? [...state.highlights] : [];
                const currentMap = new Map();
                currentList.forEach(h => {
                  if (h.id) currentMap.set(h.id, h);
                  if (h.cfiRange) currentMap.set(h.cfiRange, h);
                  const textKey = `${h.pIdx}_${(h.text || '').trim()}`;
                  currentMap.set(textKey, h);
                });

                let hasChanges = false;
                data.highlights.forEach(embH => {
                  const match = (embH.id && currentMap.get(embH.id)) ||
                                (embH.cfiRange && currentMap.get(embH.cfiRange)) ||
                                currentMap.get(`${embH.pIdx}_${(embH.text || '').trim()}`);
                  if (match) {
                    // 기존 뜻/해석이 없을 때만 임베디드 파일의 값 채택 (기존 생성된 Q&A 보호)
                    if (!match.targetMeaning && embH.targetMeaning) {
                      match.targetMeaning = embH.targetMeaning;
                      hasChanges = true;
                    }
                    if (!match.phonetic && embH.phonetic) {
                      match.phonetic = embH.phonetic;
                      hasChanges = true;
                    }
                    if (!match.sentenceTranslation && embH.sentenceTranslation) {
                      match.sentenceTranslation = embH.sentenceTranslation;
                      hasChanges = true;
                    }
                    if (!match.note && embH.note) {
                      match.note = embH.note;
                      hasChanges = true;
                    }
                    if (!match.cfiRange && embH.cfiRange) {
                      match.cfiRange = embH.cfiRange;
                      hasChanges = true;
                    }
                    if (!match.targetSentence && embH.targetSentence) {
                      match.targetSentence = embH.targetSentence;
                      hasChanges = true;
                    }
                  } else {
                    // 신규 형광펜 항목 추가
                    const newH = {
                      ...embH,
                      targetMeaning: embH.targetMeaning || '',
                      phonetic: embH.phonetic || '',
                      sentenceTranslation: embH.sentenceTranslation || '',
                      studyCount: Number(embH.studyCount) || 0,
                      wrongCount: Number(embH.wrongCount) || 0,
                      lastStudiedAt: embH.lastStudiedAt || null
                    };
                    currentList.push(newH);
                    if (newH.id) currentMap.set(newH.id, newH);
                    if (newH.cfiRange) currentMap.set(newH.cfiRange, newH);
                    hasChanges = true;
                  }
                });

                state.highlights = currentList;
                sortHighlights();
                if (hasChanges) {
                  saveHighlights();
                }
                updateHighlightBadge();
                if (elements.readerDrawer && elements.readerDrawer.classList.contains('open')) {
                  renderHighlightDrawer();
                }
                setTimeout(() => {
                  restoreEpubHighlights();
                }, 100);
              }
            } catch (e) {
              console.warn('Error merging embedded reader_highlights.json:', e);
            }
          });
        }
      }).catch(() => {});
    }

    let initialLocationRestored = false;

    // Render initial page or restore saved location when book is ready
    book.ready.then(async () => {
      const savedCfi = fallbackPosition || localStorage.getItem(`reader_pos_${state.currentBook.id}`);
      if (savedCfi && typeof savedCfi === 'string' && savedCfi.startsWith('epubcfi(')) {
        try {
          await rendition.display(savedCfi);
          state.epub.currentCfi = savedCfi;
          initialLocationRestored = true;
          return;
        } catch (e) {
          console.warn('Initial rendition display with savedCfi failed, trying startCfi:', e);
          const startCfi = getStartCfi(savedCfi);
          if (startCfi && startCfi !== savedCfi) {
            try {
              await rendition.display(startCfi);
              state.epub.currentCfi = startCfi;
              initialLocationRestored = true;
              return;
            } catch (e2) {}
          }
        }
      }
      await rendition.display();
      initialLocationRestored = true;
    }).then(() => {
      applyEpubThemes();
      restoreEpubHighlights();

      // 초기 렌더링 직후 뷰포트 크기 확정 동기화 (아이패드 초기 로딩 시 컬럼 잘림 방지 및 위치 보존)
      requestAnimationFrame(() => {
        triggerEpubResizeSafe();
      });
    }).catch(err => {
      console.warn('Initial rendition display error, retrying default display:', err);
      if (state.epub.rendition) {
        state.epub.rendition.display();
      }
      initialLocationRestored = true;
    });

    // Generate locations for progress slider
    book.ready.then(() => {
      return book.locations.generate(1000);
    }).then(() => {
      state.epub.locationsReady = true;
      updateEpubProgress();
    }).catch(err => {
      console.warn('Location generation failed:', err);
    });

    // Rendition Relocated event (Page changes)
    rendition.on("relocated", (location) => {
      if (initialLocationRestored && location && location.start && location.start.cfi && state.currentBook) {
        if (!state.epub.isResizing) {
          state.epub.currentCfi = location.start.cfi;
          localStorage.setItem(`reader_pos_${state.currentBook.id}`, location.start.cfi);
          localStorage.setItem('reader_last_book_id', state.currentBook.id);
          updateActiveBookLastPosition(location.start.cfi);
        }
      }
      if (!state.epub.isResizing) {
        updateEpubProgress(location);
      }
      showNavButtonsTemporarily(1800);
      setTimeout(() => {
        restoreEpubHighlights();
      }, 50);
    });

    // Rendition Rendered event
    rendition.on("rendered", (section, view) => {
      if (view && view.window) {
        patchRangeForEpub(view.window);
      }
      if (view && view.document && view.document.defaultView) {
        patchRangeForEpub(view.document.defaultView);
      }
      setTimeout(() => {
        restoreEpubHighlights();
      }, 50);
    });

    // Register content hook for EPUB document styling & interaction
    rendition.hooks.content.register((contents) => {
      if (contents.window) {
        patchRangeForEpub(contents.window);
      }
      const doc = contents.document;
      if (doc && doc.defaultView) {
        patchRangeForEpub(doc.defaultView);
      }
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

          /* 내보내기된 EPUB 내 <mark> 형광펜 태그 상호작용 지원 */
          mark.reader-highlight,
          .reader-highlight {
            cursor: pointer !important;
            pointer-events: auto !important;
            user-select: text !important;
            -webkit-user-select: text !important;
            transition: filter 0.15s ease !important;
          }
          mark.reader-highlight:hover,
          .reader-highlight:hover {
            filter: brightness(0.9) !important;
          }
          .reader-note-badge {
            cursor: pointer !important;
            pointer-events: auto !important;
          }
        `;
        doc.head.appendChild(style);
      }

      if (doc) {
        // 스와이프 제스처 및 터치 시 네비게이션 버튼 표시
        attachSwipeGesture(doc, () => (contents.window ? contents.window.getSelection() : null));
        doc.addEventListener("click", () => { showNavButtonsTemporarily(); });

        // EPUB 내 이미 삽입된 <mark> 형광펜 요소들에 클릭/탭 이벤트 바인딩
        bindAllMarksInEpub();
        setTimeout(bindAllMarksInEpub, 200);
        setTimeout(bindAllMarksInEpub, 600);

        const recordPointer = (e) => {
          const clientX = getEventCoord(e, 'clientX');
          const clientY = getEventCoord(e, 'clientY');
          lastIframeClick = {
            clientX,
            clientY,
            target: e.target,
            rect: e.target && typeof e.target.getBoundingClientRect === 'function' ? e.target.getBoundingClientRect() : null
          };

          const isHl = isHighlightTarget(e.target);
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
      const isHl = isHighlightTarget(e && e.target);
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

// EPUB 내 삽입된 <mark> 태그들에 상호작용 바인딩
let lastMarkTapTime = 0;
function bindAllMarksInEpub() {
  const iframe = elements.epubArea.querySelector('iframe');
  if (!iframe) return;
  const doc = iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null);
  if (!doc) return;

  const marks = doc.querySelectorAll('mark.reader-highlight, .reader-highlight, mark');
  marks.forEach(mark => {
    if (mark.dataset.boundClick === 'true') return;
    mark.dataset.boundClick = 'true';

    const onMarkClick = (e) => {
      const now = Date.now();
      if (e.type === 'click' && now - lastMarkTapTime < 500) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      if (e.type === 'touchend') {
        lastMarkTapTime = now;
      }

      e.stopPropagation();
      e.preventDefault();
      justClickedHighlight = true;
      setTimeout(() => { justClickedHighlight = false; }, 400);

      const hlId = mark.dataset.hlId;
      const markText = mark.textContent.replace(/💬.*$/, '').trim();

      // 1. 정확한 ID로 매칭
      let hl = hlId ? state.highlights.find(h => h.id === hlId) : null;

      // 2. 정확한 텍스트 및 문맥으로 정밀 매칭
      if (!hl && markText) {
        // 2-1. 텍스트 완전 일치 항목 우선 탐색
        hl = state.highlights.find(h => h.text === markText);
        
        // 2-2. 부모 문맥이 일치하는 경우 탐색
        if (!hl) {
          const parentText = (mark.parentElement ? mark.parentElement.textContent : '').trim();
          hl = state.highlights.find(h => h.text === markText && h.targetSentence && parentText.includes(h.targetSentence));
        }
      }

      // 3. 매칭되는 하이라이트가 없을 때만 신규 생성 및 등록
      if (!hl && markText) {
        let detectedColor = 'yellow';
        for (const c of ['yellow', 'green', 'purple', 'blue', 'pink']) {
          if (mark.classList.contains('hl-' + c)) {
            detectedColor = c;
            break;
          }
        }
        const badge = mark.querySelector('.reader-note-badge');
        const noteText = badge ? badge.textContent.replace(/^💬\s*/, '').trim() : (mark.getAttribute('title') ? mark.getAttribute('title').replace(/^메모:\s*/, '').trim() : '');

        hl = {
          id: hlId || `hl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          text: markText,
          color: detectedColor,
          note: noteText || '',
          targetMeaning: '',
          phonetic: '',
          sentenceTranslation: '',
          studyCount: 0,
          wrongCount: 0,
          lastStudiedAt: null,
          createdAt: new Date().toISOString()
        };
        mark.dataset.hlId = hl.id;
        state.highlights.push(hl);
        sortHighlights();
        saveHighlights();
        updateHighlightBadge();
      }

      if (hl) {
        openHighlightToolbarFromEpub(hl, e, mark);
      }
    };

    mark.addEventListener('click', onMarkClick);
    mark.addEventListener('touchend', onMarkClick, { passive: false });
  });
}

function restoreEpubHighlights() {
  bindAllMarksInEpub();
  if (!state.epub.rendition || !state.currentBook || state.currentBook.type !== 'epub') return;
  if (!state.highlights || state.highlights.length === 0) return;

  const iframe = elements.epubArea.querySelector('iframe');
  if (iframe && iframe.contentWindow) {
    patchRangeForEpub(iframe.contentWindow);
  }
  const iframeDoc = iframe ? (iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null)) : null;

  const isDark = state.settings.theme === 'dark';

  state.highlights.forEach(hl => {
    if (hl.cfiRange) {
      // If this highlight is already present as an actual <mark> in the DOM (e.g. legacy exported EPUB), skip duplicate SVG annotation
      if (iframeDoc && hl.id && iframeDoc.querySelector(`mark[data-hl-id="${hl.id}"], [data-hl-id="${hl.id}"]`)) {
        return;
      }

      const colorName = hl.color || 'yellow';
      const colorHex = getHighlightColorHex(colorName);

      // Remove existing first to avoid duplicate annotation overlays
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
        console.warn('Annotation restore error for CFI:', hl.cfiRange, e);
      }
    }
  });
}

function getHighlightColorHex(colorName) {
  if (colorName && colorName.startsWith('#')) return colorName;
  const colors = {
    yellow: '#facc15',
    orange: '#fb923c',
    green: '#4ade80',
    purple: '#c084fc',
    blue: '#38bdf8',
    pink: '#f472b6'
  };
  return colors[colorName] || '#facc15';
}

function setActiveHighlightColor(colorName) {
  state.activeColor = colorName;
  document.querySelectorAll('#selection-menu-bar .color-dot').forEach(dot => {
    if (dot.dataset.color === colorName) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

function updateEpubProgress(location) {
  if (!state.epub.book || !state.epub.locationsReady) return;

  const currentLocation = location || (state.epub.rendition ? state.epub.rendition.currentLocation() : null);
  if (currentLocation && currentLocation.start && currentLocation.start.cfi) {
    if (state.currentBook && !state.epub.isResizing) {
      state.epub.currentCfi = currentLocation.start.cfi;
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
  if (e.target.closest('#selection-menu-bar') || e.target.closest('#highlight-toolbar') || e.target.closest('#settings-popover') || e.target.closest('.ai-modal') || e.target.closest('.meta-edit-modal')) {
    return;
  }
  closeAllToolbars();
});

document.addEventListener('mouseup', (e) => {
  if (e.target.closest('#selection-menu-bar') || e.target.closest('#highlight-toolbar') || e.target.closest('#settings-popover') || e.target.closest('.ai-modal') || e.target.closest('.meta-edit-modal')) {
    return;
  }

  if (state.currentBook && (state.currentBook.type === 'txt' || state.currentBook.type === 'md')) {
    setTimeout(() => {
      handleTxtSelection();
    }, 20);
  }
});

function getSelectionCharacterOffsetWithin(element, range) {
  try {
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    return preCaretRange.toString().length;
  } catch (e) {
    return -1;
  }
}

function handleTxtSelection() {
  const sel = window.getSelection();
  const selectedText = sel ? sel.toString().trim() : "";

  if (!selectedText || selectedText.length < 1) {
    state.activeSelection = null;
    return;
  }

  // Check if selection is within txt-viewer
  const range = sel.getRangeAt(0);
  const commonAncestor = range.commonAncestorContainer;
  const pElem = commonAncestor.nodeType === 1
    ? commonAncestor.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th')
    : (commonAncestor.parentElement ? commonAncestor.parentElement.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th') : null);

  if (!pElem || !elements.txtContent.contains(pElem)) {
    state.activeSelection = null;
    return;
  }

  const pIdx = parseInt(pElem.dataset.pIdx, 10);
  const fullParagraph = pElem.textContent;
  const context = extractContextFromText(fullParagraph, selectedText);
  const exactOffset = getSelectionCharacterOffsetWithin(pElem, range);
  const startOffset = exactOffset >= 0 ? exactOffset : fullParagraph.indexOf(selectedText);

  state.activeSelection = {
    text: selectedText,
    targetSentence: context.targetSentence,
    prevSentence: context.prevSentence,
    nextSentence: context.nextSentence,
    pIdx,
    offset: startOffset >= 0 ? startOffset : 0,
    range: range.cloneRange()
  };
}

// EPUB Viewer Selection
function handleEpubSelection(cfiRange, contents) {
  const sel = contents.window.getSelection();
  const selectedText = sel ? sel.toString().trim() : "";

  if (!selectedText) {
    state.activeSelection = null;
    return;
  }

  const range = sel.getRangeAt(0);

  // Extract surrounding paragraph text
  const parentP = range.commonAncestorContainer.nodeType === 1
    ? range.commonAncestorContainer.closest('p, div, section')
    : (range.commonAncestorContainer.parentElement ? range.commonAncestorContainer.parentElement.closest('p, div, section') : null);

  const fullParagraph = parentP ? parentP.textContent : selectedText;
  const context = extractContextFromText(fullParagraph, selectedText);

  state.activeSelection = {
    text: selectedText,
    targetSentence: context.targetSentence,
    prevSentence: context.prevSentence,
    nextSentence: context.nextSentence,
    cfiRange,
    contents,
    range: range.cloneRange()
  };
}

function closeAllToolbars() {
  if (elements.highlightToolbar) elements.highlightToolbar.style.display = 'none';
  if (elements.settingsPopover) elements.settingsPopover.classList.remove('open');
}

// ── Highlight Actions ──
function applyHighlight(colorName) {
  if (!state.activeSelection || !state.activeSelection.text) {
    showToast('먼저 텍스트를 선택해주세요.');
    return;
  }

  // 1. Deduplication check: see if highlight at same range or exact text+target already exists
  const existingIdx = state.highlights.findIndex(h => {
    if (state.currentBook.type === 'epub' && h.cfiRange && state.activeSelection.cfiRange) {
      return h.cfiRange === state.activeSelection.cfiRange;
    }
    if ((state.currentBook.type === 'txt' || state.currentBook.type === 'md') && h.pIdx !== undefined && state.activeSelection.pIdx !== undefined) {
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
      note: '',
      targetMeaning: '',
      phonetic: '',
      sentenceTranslation: '',
      studyCount: 0,
      wrongCount: 0,
      lastStudiedAt: null
    };

    if (state.currentBook.type === 'txt' || state.currentBook.type === 'md') {
      targetHighlight.pIdx = state.activeSelection.pIdx;
      targetHighlight.offset = state.activeSelection.offset ?? 0;
    } else if (state.currentBook.type === 'epub') {
      targetHighlight.cfiRange = state.activeSelection.cfiRange;
    }

    state.highlights.push(targetHighlight);
    autoFetchVocabForHighlight(targetHighlight);
  }

  sortHighlights();
  saveHighlights();

  if (state.currentBook.type === 'txt') {
    renderTxtContent();
  } else if (state.currentBook.type === 'md') {
    renderMdContent();
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
      try {
        state.activeSelection.contents.window.getSelection().removeAllRanges();
      } catch (e) {}
    }
  }

  // Clear TXT viewer selection
  try {
    window.getSelection().removeAllRanges();
  } catch (e) {}
  state.activeSelection = null;

  closeAllToolbars();
  showToast('형광펜이 추가되었습니다.');
}

function changeHighlightColor(hlId, newColor, showToastMsg = true) {
  const hl = state.highlights.find(h => h.id === hlId);
  if (!hl) return;
  if (hl.color === newColor) return;

  hl.color = newColor;
  saveHighlights();

  // 1. Update in TXT/MD viewer
  if (state.currentBook && (state.currentBook.type === 'txt' || state.currentBook.type === 'md')) {
    const marks = elements.txtContent.querySelectorAll(`mark[data-hl-id="${hlId}"]`);
    marks.forEach(m => {
      m.className = `reader-highlight hl-${newColor}`;
    });
  }

  // 2. Update in EPUB viewer
  if (state.currentBook && state.currentBook.type === 'epub') {
    const isDark = state.settings.theme === 'dark';
    if (state.epub.rendition && hl.cfiRange) {
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
          `hl-${newColor}`,
          {
            "fill": getHighlightColorHex(newColor),
            "fill-opacity": isDark ? "0.4" : "0.35",
            "mix-blend-mode": isDark ? "screen" : "multiply"
          }
        );
      } catch (err) {
        console.warn('Annotation color update error:', err);
      }
    }

    // Also update direct <mark> in iframe if any
    const iframe = elements.epubArea.querySelector('iframe');
    const iframeDoc = iframe ? (iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null)) : null;
    if (iframeDoc) {
      const marks = iframeDoc.querySelectorAll(`mark[data-hl-id="${hlId}"], [data-hl-id="${hlId}"]`);
      marks.forEach(m => {
        m.className = `reader-highlight hl-${newColor}`;
        m.style.backgroundColor = getHighlightColorHex(newColor);
      });
    }
  }

  // 3. Update highlight toolbar active dot
  document.querySelectorAll('#highlight-toolbar .color-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color === newColor);
  });

  // 4. Update drawer if open
  if (elements.readerDrawer && elements.readerDrawer.classList.contains('open')) {
    renderHighlightDrawer();
  }

  if (showToastMsg) {
    showToast('형광펜 색상이 변경되었습니다.');
  }
}

function showHighlightToolbar(rect) {
  closeAllToolbars();
  const tb = elements.highlightToolbar;

  // Update active color dot in #highlight-toolbar
  const currentColor = (state.activeHighlight && state.activeHighlight.color) || 'yellow';
  document.querySelectorAll('#highlight-toolbar .color-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color === currentColor);
  });

  // Render bottom meaning if present
  if (elements.hlToolbarMeaning) {
    const meaning = (state.activeHighlight && state.activeHighlight.targetMeaning)
      ? state.activeHighlight.targetMeaning.trim()
      : '';
    const phonetic = (state.activeHighlight && state.activeHighlight.phonetic)
      ? state.activeHighlight.phonetic.trim()
      : '';
    const phoneticBadge = phonetic ? `<span class="hl-phonetic-badge">${escapeHtml(phonetic)}</span>` : '';
    if (meaning) {
      elements.hlToolbarMeaning.innerHTML = `<span class="hl-meaning-icon">💡</span><span class="hl-meaning-text">${phoneticBadge}${escapeHtml(meaning)}</span>`;
      elements.hlToolbarMeaning.style.display = 'flex';
    } else {
      elements.hlToolbarMeaning.innerHTML = `<span class="hl-meaning-icon">💡</span><span class="hl-meaning-text" style="color:var(--text-muted); font-size:12px;">등록된 뜻 없음 (편집 버튼에서 추가)</span>`;
      elements.hlToolbarMeaning.style.display = 'flex';
    }
  }

  tb.style.display = 'flex';

  const tbWidth = tb.offsetWidth || 240;
  const tbHeight = tb.offsetHeight || 50;
  const x = rect.left + (rect.width / 2);
  let y = rect.top + window.scrollY;

  const isMobile = window.innerWidth <= 1024 || ('ontouchstart' in window);
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

  const minMargin = isMobile ? 28 : 16;
  const clampedX = Math.max(tbWidth / 2 + minMargin, Math.min(window.innerWidth - tbWidth / 2 - minMargin, x));
  tb.style.left = `${clampedX}px`;
  tb.style.top = `${y}px`;

  const arrowRelX = x - (clampedX - tbWidth / 2);
  const clampedArrowX = Math.max(16, Math.min(tbWidth - 16, arrowRelX));
  tb.style.setProperty('--arrow-left', `${clampedArrowX}px`);
}

function openHighlightToolbar(hl, elem) {
  state.activeHighlight = hl;
  const rect = elem.getBoundingClientRect();
  showHighlightToolbar(rect);
}

function openHighlightToolbarFromEpub(hl, e, markTarget = null) {
  state.activeHighlight = hl;
  justClickedHighlight = true;
  setTimeout(() => { justClickedHighlight = false; }, 400);

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

  // 0. If markTarget is passed directly
  if (markTarget && typeof markTarget.getBoundingClientRect === 'function') {
    const mRect = markTarget.getBoundingClientRect();
    if (tryShowWithRect(mRect)) return;
  }

  // 1. Try to find mark element in iframe by hl.id
  if (iframeDoc && hl && hl.id) {
    const markEl = iframeDoc.querySelector(`mark[data-hl-id="${hl.id}"], [data-hl-id="${hl.id}"]`);
    if (markEl && typeof markEl.getBoundingClientRect === 'function') {
      const mRect = markEl.getBoundingClientRect();
      if (tryShowWithRect(mRect)) return;
    }
  }

  // 2. Try to resolve exact live DOM Range via ePub.CFI directly in the rendered iframe document
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

  // 3. Try target element from event (or its parent group)
  const target = markTarget || (e && e.target ? e.target : (lastIframeClick ? lastIframeClick.target : null));
  if (target) {
    const hlGroup = (typeof target.closest === 'function') ? (target.closest('.epubjs-hl') || target.closest('mark.reader-highlight') || target.closest('.reader-highlight')) : null;
    const targetEl = hlGroup || target;
    if (typeof targetEl.getBoundingClientRect === 'function') {
      const tRect = targetEl.getBoundingClientRect();
      if (tryShowWithRect(tRect)) return;
    }
  }

  // 4. Try to find highlight element in iframe DOM intersecting with click position
  const clientX = getEventCoord(e, 'clientX') ?? (lastIframeClick ? lastIframeClick.clientX : undefined);
  const clientY = getEventCoord(e, 'clientY') ?? (lastIframeClick ? lastIframeClick.clientY : undefined);

  if (iframeDoc && clientX !== undefined && clientY !== undefined) {
    try {
      const hlElements = iframeDoc.querySelectorAll('.epubjs-hl rect, .epubjs-hl, mark.reader-highlight, .reader-highlight');
      for (const el of hlElements) {
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left - 10 && clientX <= rect.right + 10 &&
            clientY >= rect.top - 10 && clientY <= rect.bottom + 10) {
          if (tryShowWithRect(rect)) return;
        }
      }
    } catch (err) {}
  }

  // 5. Fallback to event coordinates (supporting mouse and mobile touch)
  if (clientX !== undefined && clientY !== undefined && clientX > 0 && clientY > 0) {
    showHighlightToolbar({
      top: iframeRect.top + clientY,
      left: iframeRect.left + clientX,
      width: 0,
      height: 20
    });
    return;
  }

  // 6. Final fallback: center of reading area
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
  sortHighlights();
  saveHighlights();
  updateHighlightBadge();

  if (state.currentBook.type === 'txt') {
    renderTxtContent();
  } else if (state.currentBook.type === 'md') {
    renderMdContent();
  } else if (state.currentBook.type === 'epub') {
    if (state.epub.rendition && hl.cfiRange) {
      try {
        state.epub.rendition.annotations.remove(hl.cfiRange, "highlight");
      } catch (e) {
        console.warn(e);
      }
    }
    // Also remove from EPUB iframe DOM if it was a <mark> element
    const iframe = elements.epubArea.querySelector('iframe');
    const iframeDoc = iframe ? (iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : null)) : null;
    if (iframeDoc) {
      const marks = iframeDoc.querySelectorAll(`mark[data-hl-id="${hlId}"], [data-hl-id="${hlId}"]`);
      marks.forEach(mark => {
        const badge = mark.querySelector('.reader-note-badge');
        if (badge) badge.remove();
        const parent = mark.parentNode;
        if (parent) {
          while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
          }
          parent.removeChild(mark);
        }
      });
    }
  }

  closeAllToolbars();
  showToast('형광펜이 삭제되었습니다.');
  if (elements.readerDrawer.classList.contains('open')) {
    renderHighlightDrawer();
  }
}

// ── Mobile / Tablet (iPadOS 포함) 환경 감지 ──
function isMobileOrTabletDevice() {
  const ua = navigator.userAgent || '';
  // iPadOS 13+ 데스크톱 모드 감지 (Macintosh UA + 다중 터치 포인트)
  const isIPadOS = /Macintosh/i.test(ua) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  // 태블릿(iPad 포함) 또는 모바일 기기이거나 터치 기반이면서 화면 폭이 1024px 이하인 경우
  return isMobileUA || isIPadOS || (isTouch && window.innerWidth <= 1024);
}

/**
 * 구글 AI 검색 실행:
 * - 아이패드 / 모바일: 팝업 차단 및 인터페이스 깨짐 방지를 위해 기존 새 탭(_blank) 안전 모드 100% 유지
 * - 데스크톱: 화면 우측에 독립된 팝업 창(Popup Window)으로 띄워 책 본문과 검색 결과를 나란히 참고 가능
 */
function openGoogleAISearch(promptText) {
  if (!promptText) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(promptText).catch(() => {});
  }

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(promptText)}&udm=50`;

  if (isMobileOrTabletDevice()) {
    // [아이패드 및 모바일 보호] 기존 새 탭 열기 유지
    window.open(searchUrl, '_blank');
  } else {
    // [데스크톱 환경] 화면 우측에 플로팅 팝업 창 생성
    const popupWidth = 560;
    const popupHeight = Math.min(860, Math.round(window.screen.availHeight * 0.9));
    const left = Math.max(0, window.screen.availWidth - popupWidth - 30);
    const top = Math.max(20, Math.round((window.screen.availHeight - popupHeight) / 2));
    const features = `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=yes`;

    const popup = window.open(searchUrl, 'GoogleAISearchPopup', features);
    if (popup && popup.focus) {
      popup.focus();
    } else {
      // 팝업이 브라우저 설정으로 차단된 경우를 대비한 새 탭 폴백
      window.open(searchUrl, '_blank');
    }
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
    openGoogleAISearch(promptText);
  }
}

// ── Vocab Edit Modal (단어장 Q&A 및 메모 수정 모달) ──
let currentEditingHighlight = null;
let currentEditingColor = 'yellow';

function openVocabEditModal(hl) {
  if (!hl) return;
  currentEditingHighlight = hl;
  currentEditingColor = hl.color || 'yellow';

  if (elements.vocabEditPreviewTarget) {
    elements.vocabEditPreviewTarget.textContent = hl.text || '';
  }
  if (elements.vocabEditPreviewSentence) {
    elements.vocabEditPreviewSentence.textContent = hl.targetSentence || hl.text || '';
  }
  if (elements.inputEditPhonetic) {
    elements.inputEditPhonetic.value = hl.phonetic || '';
  }
  if (elements.inputEditMeaning) {
    elements.inputEditMeaning.value = hl.targetMeaning || '';
  }
  if (elements.inputEditTrans) {
    elements.inputEditTrans.value = hl.sentenceTranslation || '';
  }

  // Update active color button in modal
  document.querySelectorAll('#vocab-edit-colors .color-dot-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === currentEditingColor);
  });

  if (elements.vocabEditModalBackdrop) {
    elements.vocabEditModalBackdrop.classList.add('open');
  }

  setTimeout(() => {
    if (elements.inputEditMeaning) {
      elements.inputEditMeaning.focus();
    }
  }, 60);
}

function closeVocabEditModal() {
  currentEditingHighlight = null;
  if (elements.vocabEditModalBackdrop) {
    elements.vocabEditModalBackdrop.classList.remove('open');
  }
}

function saveVocabEdit() {
  if (!currentEditingHighlight) {
    closeVocabEditModal();
    return;
  }

  const newPhonetic = elements.inputEditPhonetic ? elements.inputEditPhonetic.value.trim() : '';
  const newMeaning = elements.inputEditMeaning ? elements.inputEditMeaning.value.trim() : '';
  const newTrans = elements.inputEditTrans ? elements.inputEditTrans.value.trim() : '';

  currentEditingHighlight.phonetic = newPhonetic;
  currentEditingHighlight.targetMeaning = newMeaning;
  currentEditingHighlight.sentenceTranslation = newTrans;

  const colorChanged = currentEditingHighlight.color !== currentEditingColor;
  if (colorChanged) {
    changeHighlightColor(currentEditingHighlight.id, currentEditingColor, false);
  } else {
    saveHighlights();
    renderHighlightDrawer();
  }

  updateQuizBadge();
  closeVocabEditModal();
  showToast(colorChanged ? '단어장 정보 및 형광펜 색상이 저장되었습니다.' : '단어장 정보가 수정 및 저장되었습니다.');
}

// ── Drawer (TOC, Bookmarks & Highlights) ──
function openDrawer(mode, preserveSearch = false) {
  closeAllToolbars();
  if (elements.readerDrawer) elements.readerDrawer.scrollTop = 0;
  elements.readerDrawer.classList.add('open');
  elements.drawerBackdrop.classList.add('open');
  document.body.classList.add('drawer-open');

  if (elements.drawerActionsBar) elements.drawerActionsBar.style.display = 'none';
  if (elements.drawerBookmarkActionsBar) elements.drawerBookmarkActionsBar.style.display = 'none';
  if (elements.drawerSearchBar) elements.drawerSearchBar.style.display = 'none';

  if (mode === 'toc') {
    elements.drawerIcon.textContent = '📑';
    elements.drawerTitle.textContent = '목차 (Table of Contents)';
    renderTocDrawer();
  } else if (mode === 'bookmarks') {
    elements.drawerIcon.textContent = '🔖';
    if (elements.drawerBookmarkActionsBar) {
      elements.drawerBookmarkActionsBar.style.display = 'flex';
      updateBookmarkSortBtnText();
    }
    renderBookmarkDrawer();
  } else {
    elements.drawerIcon.textContent = '🖍️';
    if (!preserveSearch) {
      state.highlightSearchQuery = '';
      if (elements.inputHighlightSearch) elements.inputHighlightSearch.value = '';
    }
    renderHighlightDrawer();
  }
}

function closeDrawer() {
  elements.readerDrawer.classList.remove('open');
  elements.drawerBackdrop.classList.remove('open');
  document.body.classList.remove('drawer-open');
}

function renderTocDrawer() {
  if (elements.drawerActionsBar) {
    elements.drawerActionsBar.style.display = 'none';
  }
  if (elements.drawerSearchBar) {
    elements.drawerSearchBar.style.display = 'none';
  }
  if (elements.drawerBookmarkActionsBar) {
    elements.drawerBookmarkActionsBar.style.display = 'none';
  }
  elements.drawerBody.innerHTML = '';

  const isMd = state.currentBook && state.currentBook.type === 'md';
  const tocList = isMd ? state.toc : state.epub.toc;

  if (!tocList || tocList.length === 0) {
    elements.drawerBody.innerHTML = '<p style="color:var(--text-muted); padding:20px; text-align:center;">목차 정보가 없습니다.</p>';
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'toc-list';

  if (isMd) {
    state.toc.forEach(item => {
      const li = document.createElement('li');
      li.className = `toc-item toc-level-${item.level}`;
      li.textContent = item.label;
      li.addEventListener('click', () => {
        const headingEl = elements.txtContent.querySelector(`#${item.id}`);
        if (headingEl) {
          headingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          headingEl.classList.remove('bookmark-flash-target');
          void headingEl.offsetWidth;
          headingEl.classList.add('bookmark-flash-target');
          setTimeout(() => headingEl.classList.remove('bookmark-flash-target'), 2000);
        }
        closeDrawer();
      });
      ul.appendChild(li);
    });
  } else {
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
  }
  elements.drawerBody.appendChild(ul);
}

// ── Precision Navigation to Highlight in EPUB ──
function findHighlightTargetInDoc(doc, hl) {
  if (!doc) return null;

  // 1. Check DOM anchor/mark element if present (e.g. legacy EPUB or ID anchor)
  if (hl.id) {
    const el = doc.querySelector(`[data-hl-id="${hl.id}"], mark[data-hl-id="${hl.id}"], [id="${hl.id}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect && (rect.width > 0 || rect.height > 0)) {
        return { element: el, rect };
      }
    }
  }

  // 2. Resolve exact live DOM Range via ePub.CFI
  if (hl.cfiRange && typeof ePub !== 'undefined' && ePub.CFI) {
    try {
      const cfi = new ePub.CFI(hl.cfiRange);
      if (typeof cfi.toRange === 'function') {
        const domRange = cfi.toRange(doc);
        if (domRange && typeof domRange.getBoundingClientRect === 'function') {
          const r = domRange.getBoundingClientRect();
          if (r && (r.width > 0 || r.height > 0)) {
            return { element: null, rect: r, range: domRange };
          }
        }
      }
    } catch (err) {
      console.warn('CFI toRange in findHighlightTargetInDoc:', err);
    }
  }

  // 3. Check SVG annotation element rendered by epub.js
  if (hl.id) {
    const svgEl = doc.querySelector(`g[data-id="${hl.id}"], .hl-${hl.color || 'yellow'}[data-id="${hl.id}"]`);
    if (svgEl) {
      const rect = svgEl.getBoundingClientRect();
      if (rect && (rect.width > 0 || rect.height > 0)) {
        return { element: svgEl, rect };
      }
    }
  }

  // 4. Context-aware text search fallback (Smart Anchoring)
  if (hl.text) {
    try {
      const walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const val = node.nodeValue;
        if (val && val.includes(hl.text)) {
          if (hl.targetSentence) {
            const pText = (node.parentElement ? node.parentElement.textContent : '') || '';
            if (!val.includes(hl.targetSentence) && !pText.includes(hl.targetSentence)) {
              continue;
            }
          }
          const idx = val.indexOf(hl.text);
          const r = doc.createRange();
          r.setStart(node, idx);
          r.setEnd(node, idx + hl.text.length);
          const rRect = r.getBoundingClientRect();
          if (rRect && (rRect.width > 0 || rRect.height > 0)) {
            return { element: null, rect: rRect, range: r };
          }
        }
      }
    } catch (err) {
      console.warn('Fallback text search in findHighlightTargetInDoc:', err);
    }
  }

  return null;
}

async function jumpToHighlightInEpub(hl) {
  if (!state.epub.rendition || !hl) return;

  const startCfi = getStartCfi(hl.cfiRange);
  const targetCfi = startCfi || hl.cfiRange;

  // 1. Initial navigation to chapter/page via Point CFI
  if (targetCfi) {
    try {
      await state.epub.rendition.display(targetCfi);
    } catch (err) {
      console.warn('Navigation with targetCfi failed, retrying with cfiRange:', err);
      try {
        await state.epub.rendition.display(hl.cfiRange);
      } catch (e2) {}
    }
  }

  // 2. Poll until iframe DOM, fonts, and column layout are fully ready (up to 1200ms)
  let found = null;
  let targetRect = null;
  let targetElement = null;
  let activeWin = null;
  let activeDoc = null;

  const maxWait = 1200;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const iframe = elements.epubArea.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      activeWin = iframe.contentWindow;
      activeDoc = iframe.contentDocument || (activeWin ? activeWin.document : null);
      if (activeDoc && activeDoc.body && activeDoc.readyState !== 'loading') {
        found = findHighlightTargetInDoc(activeDoc, hl);
        if (found && found.rect && (found.rect.width > 0 || found.rect.height > 0)) {
          targetRect = found.rect;
          targetElement = found.element;
          break;
        }
      }
    }
    await new Promise(r => setTimeout(r, 60));
  }

  if (!activeDoc || !activeWin) return;

  // 3. In paginated mode: verify if target is on the currently visible page
  // When switching chapters, epub.js initial render may land on column 0 while the target is on column N.
  // Now that the chapter layout is 100% computed, re-displaying targetCfi accurately turns to that column.
  const isPaginated = !state.epub.rendition.settings || state.epub.rendition.settings.flow === 'paginated';
  if (isPaginated && targetRect) {
    const isOffscreen = (targetRect.left < 0 || targetRect.left >= activeWin.innerWidth);
    if (isOffscreen && targetCfi) {
      try {
        await state.epub.rendition.display(targetCfi);
        await new Promise(r => setTimeout(r, 80));
        const reFound = findHighlightTargetInDoc(activeDoc, hl);
        if (reFound && reFound.rect && (reFound.rect.width > 0 || reFound.rect.height > 0)) {
          targetRect = reFound.rect;
          targetElement = reFound.element || targetElement;
        }
      } catch (e) {
        console.warn('Re-display to page column failed:', e);
      }
    }
  }

  // 4. Ensure highlights are visually rendered
  restoreEpubHighlights();

  // 5. Centering scroll for scrolled flow (paginated mode handles paging via column display)
  if (!isPaginated) {
    if (targetElement && typeof targetElement.scrollIntoView === 'function') {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (targetRect) {
      const scrollY = activeWin.scrollY || activeWin.pageYOffset || 0;
      const targetY = scrollY + targetRect.top - (activeWin.innerHeight / 2) + (targetRect.height / 2);
      activeWin.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    }
  }

  // 6. Visual pulse glow overlay so user instantly spots the highlighted word
  if (targetRect) {
    showJumpPulseOverlay(activeDoc, activeWin, targetRect);
  }
}

function showJumpPulseOverlay(doc, win, rect) {
  try {
    const existing = doc.querySelectorAll('.reader-jump-pulse-overlay');
    existing.forEach(el => el.remove());

    const scrollX = win.scrollX || win.pageXOffset || 0;
    const scrollY = win.scrollY || win.pageYOffset || 0;

    const overlay = doc.createElement('div');
    overlay.className = 'reader-jump-pulse-overlay';
    overlay.style.position = 'absolute';
    overlay.style.left = `${scrollX + rect.left - 4}px`;
    overlay.style.top = `${scrollY + rect.top - 2}px`;
    overlay.style.width = `${Math.max(rect.width + 8, 20)}px`;
    overlay.style.height = `${Math.max(rect.height + 4, 16)}px`;
    overlay.style.borderRadius = '4px';
    overlay.style.outline = '3px solid #2563eb';
    overlay.style.backgroundColor = 'rgba(37, 99, 235, 0.2)';
    overlay.style.boxShadow = '0 0 16px rgba(37, 99, 235, 0.5)';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '99999';
    overlay.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';

    (doc.body || doc.documentElement).appendChild(overlay);

    setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.style.transform = 'scale(1.05)';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 600);
    }, 1800);
  } catch (err) {}
}

function renderHighlightDrawer() {
  elements.drawerBody.innerHTML = '';
  sortHighlights();

  const totalCount = (state.highlights && state.highlights.length) || 0;

  if (elements.drawerActionsBar) {
    elements.drawerActionsBar.style.display = totalCount > 0 ? 'flex' : 'none';
  }
  if (elements.drawerSearchBar) {
    elements.drawerSearchBar.style.display = totalCount > 0 ? 'block' : 'none';
  }

  if (totalCount === 0) {
    elements.drawerTitle.textContent = '형광펜 목록 (0개)';
    const searched = (state.highlightSearchQuery || '').trim();
    if (searched) {
      if (elements.drawerSearchBar) elements.drawerSearchBar.style.display = 'block';
      if (elements.inputHighlightSearch) elements.inputHighlightSearch.value = searched;
      if (elements.btnClearHighlightSearch) elements.btnClearHighlightSearch.style.display = 'flex';
      elements.drawerBody.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
          <div style="font-size:32px; margin-bottom:12px;">🔍</div>
          <p><strong>'${escapeHtml(searched)}'</strong>에 대한 검색 결과가 없습니다.</p>
          <p style="font-size:13px; margin-top:6px; color:var(--text-muted);">현재 도서에 저장된 형광펜이 없습니다.</p>
          <button type="button" class="btn-drawer-action" id="btn-reset-highlight-search" style="margin: 14px auto 0; max-width: 140px;">검색어 초기화</button>
        </div>
      `;
      const resetBtn = elements.drawerBody.querySelector('#btn-reset-highlight-search');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          state.highlightSearchQuery = '';
          if (elements.inputHighlightSearch) {
            elements.inputHighlightSearch.value = '';
            elements.inputHighlightSearch.focus();
          }
          renderHighlightDrawer();
        });
      }
    } else {
      state.highlightSearchQuery = '';
      if (elements.inputHighlightSearch) elements.inputHighlightSearch.value = '';
      if (elements.btnClearHighlightSearch) elements.btnClearHighlightSearch.style.display = 'none';
      elements.drawerBody.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
          <div style="font-size:32px; margin-bottom:12px;">🖍️</div>
          <p>저장된 형광펜 구문이 없습니다.</p>
          <p style="font-size:13px; margin-top:6px;">본문의 텍스트를 드래그하여 형광펜을 추가해보세요.</p>
        </div>
      `;
    }
    return;
  }

  // Filter highlights
  const rawQuery = (state.highlightSearchQuery || '').trim();
  const terms = rawQuery ? rawQuery.toLowerCase().split(/\s+/).filter(Boolean) : [];

  // Synchronize input value if different
  if (elements.inputHighlightSearch && elements.inputHighlightSearch.value !== rawQuery) {
    elements.inputHighlightSearch.value = rawQuery;
  }

  let displayedHighlights = state.highlights;
  if (terms.length > 0) {
    displayedHighlights = state.highlights.filter(hl => {
      const text = (hl.text || '').toLowerCase();
      const meaning = (hl.targetMeaning || '').toLowerCase();
      const trans = (hl.sentenceTranslation || '').toLowerCase();
      const sentence = (hl.targetSentence || '').toLowerCase();
      const note = (hl.note || '').toLowerCase();

      return terms.every(term => 
        text.includes(term) ||
        meaning.includes(term) ||
        trans.includes(term) ||
        sentence.includes(term) ||
        note.includes(term)
      );
    });
  }

  // Update title with filtered count
  if (rawQuery) {
    elements.drawerTitle.textContent = `형광펜 목록 (${displayedHighlights.length}/${totalCount}개)`;
  } else {
    elements.drawerTitle.textContent = `형광펜 목록 (${totalCount}개)`;
  }

  // Update clear button
  if (elements.btnClearHighlightSearch) {
    elements.btnClearHighlightSearch.style.display = rawQuery ? 'flex' : 'none';
  }

  if (displayedHighlights.length === 0) {
    elements.drawerBody.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
        <div style="font-size:32px; margin-bottom:12px;">🔍</div>
        <p><strong>'${escapeHtml(rawQuery)}'</strong>에 대한 검색 결과가 없습니다.</p>
        <p style="font-size:13px; margin-top:6px; color:var(--text-muted);">다른 단어나 뜻으로 검색해보세요.</p>
        <button type="button" class="btn-drawer-action" id="btn-reset-highlight-search" style="margin: 14px auto 0; max-width: 140px;">검색어 초기화</button>
      </div>
    `;
    const resetBtn = elements.drawerBody.querySelector('#btn-reset-highlight-search');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.highlightSearchQuery = '';
        if (elements.inputHighlightSearch) {
          elements.inputHighlightSearch.value = '';
          elements.inputHighlightSearch.focus();
        }
        renderHighlightDrawer();
      });
    }
    return;
  }

  // Render cards
  displayedHighlights.forEach(hl => {
    const card = document.createElement('div');
    card.className = 'highlight-card';

    const colorHex = getHighlightColorHex(hl.color || 'yellow');
    const dateStr = hl.createdAt ? new Date(hl.createdAt).toLocaleDateString() : '';
    const questionHtml = hl.targetSentence 
      ? formatQuestionHtml(hl.targetSentence, hl.text, terms) 
      : (terms.length > 0 ? highlightSearchTerm(hl.text, terms) : escapeHtml(hl.text));

    const meaningHtml = terms.length > 0 ? highlightSearchTerm(hl.targetMeaning, terms) : escapeHtml(hl.targetMeaning);
    const transHtml = terms.length > 0 ? highlightSearchTerm(hl.sentenceTranslation, terms) : escapeHtml(hl.sentenceTranslation);
    const noteHtml = terms.length > 0 ? highlightSearchTerm(hl.note, terms) : escapeHtml(hl.note);

    const phoneticBadge = (hl.phonetic && hl.phonetic.trim())
      ? `<span class="hl-phonetic-badge">${escapeHtml(hl.phonetic.trim())}</span>`
      : '';

    card.innerHTML = `
      <div class="highlight-card-header">
        <span style="display:flex; align-items:center; gap:6px;">
          <span class="hl-badge-color" style="background-color: ${colorHex};" title="형광펜 색상 변경"></span>
          <span>${dateStr}</span>
        </span>
        <span class="hl-stat-badge">학습 ${hl.studyCount || 0}회 · 오답 ${hl.wrongCount || 0}회</span>
      </div>
      <div class="highlight-card-text">${questionHtml}</div>
      ${hl.targetMeaning ? `
        <div class="highlight-vocab-box">
          <div class="vocab-meaning-line"><strong>💡 뜻:</strong> ${phoneticBadge}${meaningHtml}</div>
          ${hl.sentenceTranslation ? `<div class="vocab-trans-line"><strong>📖 해석:</strong> ${transHtml}</div>` : ''}
        </div>
      ` : `
        <div class="highlight-vocab-unready">
          <span style="font-size:12px; color:var(--text-muted);">Q&A 미생성</span>
          <button type="button" class="btn-card-action btn-card-gen-vocab" title="AI Q&A 생성">⚡ Q&A 생성</button>
        </div>
      `}
      ${hl.note ? `<div class="highlight-card-note">💬 ${noteHtml}</div>` : ''}
      <div class="highlight-card-actions">
        ${hl.targetMeaning ? `<button type="button" class="btn-card-action btn-card-gen-vocab" title="AI Q&A 다시 생성">🔄 Q&A</button>` : ''}
        <button type="button" class="btn-card-action btn-card-edit-vocab" title="뜻/해석 수정">✏️ 편집</button>
        <button type="button" class="btn-card-action btn-card-ai" title="AI 문맥 검색">🤖 검색</button>
        <button type="button" class="btn-card-action danger btn-card-del" title="삭제">삭제</button>
      </div>
    `;

    // Interactive color change via badge click
    const badgeColor = card.querySelector('.hl-badge-color');
    if (badgeColor) {
      badgeColor.addEventListener('click', (e) => {
        e.stopPropagation();
        const existingPopover = card.querySelector('.card-color-picker-popover');
        if (existingPopover) {
          existingPopover.remove();
          return;
        }

        // Remove popovers in other cards
        document.querySelectorAll('.card-color-picker-popover').forEach(p => p.remove());

        const popover = document.createElement('div');
        popover.className = 'card-color-picker-popover';
        const colors = ['yellow', 'orange', 'green', 'purple', 'blue', 'pink'];
        const currentHlColor = hl.color || 'yellow';

        colors.forEach(c => {
          const dot = document.createElement('div');
          dot.className = `color-dot ${c}${c === currentHlColor ? ' active' : ''}`;
          dot.title = `${c}으로 변경`;
          dot.addEventListener('click', (ev) => {
            ev.stopPropagation();
            changeHighlightColor(hl.id, c);
            popover.remove();
          });
          popover.appendChild(dot);
        });

        card.appendChild(popover);

        const closeHandler = (ev) => {
          if (!popover.contains(ev.target) && ev.target !== badgeColor) {
            popover.remove();
            document.removeEventListener('click', closeHandler);
          }
        };
        setTimeout(() => {
          document.addEventListener('click', closeHandler);
        }, 20);
      });
    }

    // Click card to jump to location
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-card-action') || e.target.closest('.card-color-picker-popover') || e.target.closest('.hl-badge-color')) return;

      if (state.currentBook.type === 'txt' || state.currentBook.type === 'md') {
        const mark = elements.txtContent.querySelector(`[data-hl-id="${hl.id}"]`);
        if (mark) {
          mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          mark.style.outline = '3px solid var(--accent)';
          mark.style.borderRadius = '3px';
          setTimeout(() => { mark.style.outline = 'none'; }, 1800);
        }
      } else if (state.currentBook.type === 'epub') {
        jumpToHighlightInEpub(hl);
      }
      closeDrawer();
    });

    // AI Q&A Generate/Regenerate button
    const genVocabBtn = card.querySelector('.btn-card-gen-vocab');
    if (genVocabBtn) {
      genVocabBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          showToast(`🤖 '${hl.text}' 문맥 분석 중...`);
          const res = await fetchGeminiVocabData(hl.text, hl.targetSentence || hl.text, {
            prevSentence: hl.prevSentence,
            nextSentence: hl.nextSentence,
            author: state.currentBook?.author,
            bookTitle: state.currentBook?.title
          });
          if (res && res.targetMeaning) {
            hl.targetMeaning = res.targetMeaning;
            hl.phonetic = res.phonetic || '';
            hl.sentenceTranslation = res.sentenceTranslation;
            saveHighlights();
            renderHighlightDrawer();
            showToast(`✨ Q&A 생성 완료: ${res.targetMeaning}`);
          }
        } catch (err) {
          if (err.message === 'API_KEY_MISSING') {
            showToast('⚠️ Gemini API 키가 설정되지 않았습니다.');
            closeDrawer();
            elements.settingsPopover.classList.add('open');
            positionSettingsPopover();
          } else {
            const isQuota = /429|quota|rate limit|too many|RESOURCE_EXHAUSTED/i.test(err.message) || err.status === 429;
            if (isQuota) {
              const retryInfo = parseQuotaRetryTime(err);
              showToast(retryInfo.fullMessage, 8000);
            } else {
              showToast('❌ 생성 실패: ' + err.message);
            }
          }
        }
      });
    }

    // Edit Vocab button
    const editVocabBtn = card.querySelector('.btn-card-edit-vocab');
    if (editVocabBtn) {
      editVocabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openVocabEditModal(hl);
      });
    }

    // AI Button in card
    card.querySelector('.btn-card-ai').addEventListener('click', (e) => {
      e.stopPropagation();
      triggerGoogleAISearch(hl);
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

// ── Bookmarks Drawer & Interaction ──
let pendingBookmarkData = null;
let editingBookmarkId = null;

function renderBookmarkDrawer() {
  if (!elements.drawerBody) return;
  elements.drawerBody.innerHTML = '';
  sortBookmarks();

  const count = (Array.isArray(state.bookmarks) && state.bookmarks.length) || 0;
  elements.drawerTitle.textContent = `책갈피 목록 (${count}개)`;

  if (!state.currentBook) {
    elements.drawerBody.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
        <div style="font-size:36px; margin-bottom:12px;">📖</div>
        <p style="font-weight:600; color:var(--reader-text); margin-bottom:6px;">열린 도서가 없습니다.</p>
        <p style="font-size:13px;">상단의 [열기] 버튼으로 도서를 먼저 불러와주세요.</p>
      </div>
    `;
    return;
  }

  if (count === 0) {
    elements.drawerBody.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
        <div style="font-size:36px; margin-bottom:12px;">🔖</div>
        <p style="font-weight:600; color:var(--reader-text); margin-bottom:6px;">저장된 책갈피가 없습니다.</p>
        <p style="font-size:13px; line-height:1.6; max-width:280px; margin:0 auto 14px;">중요한 구절이나 마지막으로 읽은 위치를 책갈피로 저장하고 언제든 다시 찾아오세요.</p>
        <button type="button" class="btn-drawer-action primary" id="btn-empty-add-bm" style="margin: 0 auto;">
          🔖 현재 위치 책갈피 추가
        </button>
      </div>
    `;
    const emptyAddBtn = elements.drawerBody.querySelector('#btn-empty-add-bm');
    if (emptyAddBtn) {
      emptyAddBtn.addEventListener('click', () => {
        openBookmarkModal();
      });
    }
    return;
  }

  const listContainer = document.createElement('div');
  listContainer.className = 'bookmarks-list';
  listContainer.style.display = 'flex';
  listContainer.style.flexDirection = 'column';
  listContainer.style.gap = '10px';
  listContainer.style.paddingBottom = '30px';

  state.bookmarks.forEach(bm => {
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    card.dataset.bmId = bm.id;

    const dateStr = bm.createdAt ? new Date(bm.createdAt).toLocaleDateString(undefined, {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '';

    const pIdxBadge = (bm.pIdx !== undefined && bm.pIdx !== null)
      ? `<span class="bookmark-badge-pidx" title="문단/블록 번호">#${bm.pIdx + 1}</span>`
      : '';
    const snippetHtml = (bm.sentence && bm.sentence !== bm.title)
      ? `<div class="bookmark-card-snippet" title="${escapeHtml(bm.sentence)}">“${escapeHtml(bm.sentence)}”</div>`
      : '';

    card.innerHTML = `
      <div class="bookmark-card-header">
        <div class="bookmark-card-badges">
          <span class="bookmark-badge-pct">${bm.pct !== undefined ? `${bm.pct}%` : '위치'}</span>
          ${bm.chapter ? `<span class="bookmark-badge-chapter" title="${escapeHtml(bm.chapter)}">${escapeHtml(bm.chapter)}</span>` : ''}
          ${pIdxBadge}
        </div>
        <span class="bookmark-card-date">${dateStr}</span>
      </div>
      <div class="bookmark-card-title-row">
        <span style="font-size:15px; flex-shrink:0;">📌</span>
        <h4 class="bookmark-card-title">${escapeHtml(bm.title)}</h4>
      </div>
      ${snippetHtml}
      <div class="bookmark-card-actions">
        <button type="button" class="btn-card-action primary btn-bm-jump" title="이 위치로 이동">🚀 이동</button>
        <button type="button" class="btn-card-action btn-bm-edit" title="수정">✏️ 수정</button>
        <button type="button" class="btn-card-action danger btn-bm-del" title="삭제">삭제</button>
      </div>
    `;

    // Click card to jump
    card.addEventListener('click', (e) => {
      if (e.target.closest('.bookmark-card-actions')) return;
      jumpToBookmark(bm);
    });

    // Jump button
    const jumpBtn = card.querySelector('.btn-bm-jump');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        jumpToBookmark(bm);
      });
    }

    // Edit button
    const editBtn = card.querySelector('.btn-bm-edit');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openBookmarkModal(null, bm);
      });
    }

    // Delete button
    const delBtn = card.querySelector('.btn-bm-del');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`'${bm.title}' 책갈피를 삭제하시겠습니까?`)) {
          state.bookmarks = state.bookmarks.filter(b => b.id !== bm.id);
          saveBookmarks();
          renderBookmarkDrawer();
          showToast('책갈피가 삭제되었습니다.');
        }
      });
    }

    listContainer.appendChild(card);
  });

  elements.drawerBody.appendChild(listContainer);
}

function jumpToBookmark(bm) {
  if (!bm || !state.currentBook) return;

  if (bm.type === 'txt' || bm.type === 'md' || state.currentBook.type === 'txt' || state.currentBook.type === 'md') {
    closeDrawer();
    let jumped = false;
    if (bm.pIdx !== undefined && bm.pIdx !== null && elements.txtContent) {
      const p = elements.txtContent.querySelector(`[data-p-idx="${bm.pIdx}"]`);
      if (p) {
        p.scrollIntoView({ behavior: 'smooth', block: 'start' });
        p.classList.remove('bookmark-flash-target');
        void p.offsetWidth;
        p.classList.add('bookmark-flash-target');
        setTimeout(() => p.classList.remove('bookmark-flash-target'), 2200);
        jumped = true;
      }
    }
    if (!jumped && elements.txtViewer) {
      if (bm.scrollTop !== undefined && bm.scrollTop !== null && bm.scrollTop >= 0) {
        elements.txtViewer.scrollTo({
          top: bm.scrollTop,
          behavior: 'smooth'
        });
        jumped = true;
      } else {
        const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
        if (scrollHeight > 0 && typeof bm.pct === 'number') {
          elements.txtViewer.scrollTo({
            top: (bm.pct / 100) * scrollHeight,
            behavior: 'smooth'
          });
          jumped = true;
        }
      }
    }
    showToast(`🔖 '${bm.title}'(으)로 이동했습니다.`);
  } else if (bm.type === 'epub' || state.currentBook.type === 'epub') {
    if (!state.epub.rendition || !bm.cfi) return;
    closeDrawer();
    state.epub.rendition.display(bm.cfi).then(() => {
      showToast(`🔖 '${bm.title}'(으)로 이동했습니다.`);
      if (elements.epubArea) {
        elements.epubArea.classList.remove('bookmark-flash-target');
        void elements.epubArea.offsetWidth;
        elements.epubArea.classList.add('bookmark-flash-target');
        setTimeout(() => elements.epubArea.classList.remove('bookmark-flash-target'), 2200);
      }
    }).catch(err => {
      console.warn('Initial rendition display with bookmark cfi failed, trying startCfi:', err);
      const startCfi = getStartCfi(bm.cfi);
      if (startCfi && startCfi !== bm.cfi) {
        state.epub.rendition.display(startCfi).then(() => {
          showToast(`🔖 '${bm.title}'(으)로 이동했습니다.`);
        }).catch(e => console.warn('startCfi failed too:', e));
      }
    });
  }
}

function getCurrentReadingPositionInfo() {
  if (!state.currentBook) return null;

  if (state.currentBook.type === 'txt' || state.currentBook.type === 'md') {
    let scrollTop = 0;
    let scrollHeight = 0;
    let clientHeight = 0;

    const isViewerScroll = elements.txtViewer && (elements.txtViewer.scrollHeight > elements.txtViewer.clientHeight);
    if (isViewerScroll) {
      scrollTop = elements.txtViewer.scrollTop;
      clientHeight = elements.txtViewer.clientHeight;
      scrollHeight = elements.txtViewer.scrollHeight - clientHeight;
    } else {
      scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      clientHeight = window.innerHeight;
      scrollHeight = Math.max(0, document.body.scrollHeight - clientHeight);
    }

    let pct = 0;
    if (scrollHeight > 0) {
      pct = Math.min(100, Math.max(0, Math.round((scrollTop / scrollHeight) * 100)));
    } else if (elements.progressSlider) {
      pct = parseInt(elements.progressSlider.value, 10) || 0;
    }

    let targetPIdx = 0;
    let targetSentence = '';
    let currentChapter = state.currentBook.title || (state.currentBook.type === 'md' ? '마크다운' : '텍스트');

    if (elements.txtViewer && elements.txtContent) {
      const viewerRect = elements.txtViewer.getBoundingClientRect();
      const containerTop = isViewerScroll ? viewerRect.top : 0;
      // Search all block elements in order (p, h1~h6, li, blockquote, tr)
      const blocks = elements.txtContent.querySelectorAll('[data-p-idx]');
      for (const block of blocks) {
        const r = block.getBoundingClientRect();
        if (r.bottom >= containerTop + 35) {
          targetPIdx = parseInt(block.dataset.pIdx, 10) || 0;
          const text = block.textContent.trim();
          if (text) {
            const match = text.match(/[^.!?\n]+[.!?]?/);
            targetSentence = match ? match[0].trim() : text.slice(0, 60);
          }
          break;
        }
      }
    }

    if (state.currentBook.type === 'md') {
      if (elements.currentChapterTitle && elements.currentChapterTitle.textContent.trim() && elements.currentChapterTitle.textContent.trim() !== state.currentBook.title) {
        currentChapter = elements.currentChapterTitle.textContent.trim();
      } else if (state.toc && state.toc.length > 0) {
        const scrollOffset = isViewerScroll ? elements.txtViewer.scrollTop : window.scrollY;
        for (const item of state.toc) {
          const h = elements.txtContent.querySelector(`#${item.id}`);
          if (h && h.offsetTop <= scrollOffset + 140) {
            currentChapter = item.label;
          }
        }
      }
    } else if (elements.currentChapterTitle && elements.currentChapterTitle.textContent.trim()) {
      currentChapter = elements.currentChapterTitle.textContent.trim();
    }

    return {
      type: state.currentBook.type,
      pct,
      pIdx: targetPIdx,
      scrollTop,
      sentence: targetSentence,
      chapter: currentChapter
    };
  } else if (state.currentBook.type === 'epub') {
    const loc = state.epub.rendition ? state.epub.rendition.currentLocation() : null;
    const cfi = (loc && loc.start && loc.start.cfi)
      ? loc.start.cfi
      : (localStorage.getItem(`reader_pos_${state.currentBook.id}`) || '');

    let pct = 0;
    if (state.epub.book && state.epub.locationsReady && cfi) {
      try {
        pct = Math.round(state.epub.book.locations.percentageFromCfi(cfi) * 100);
      } catch (e) {
        pct = elements.progressSlider ? parseInt(elements.progressSlider.value, 10) || 0 : 0;
      }
    } else if (elements.progressSlider) {
      pct = parseInt(elements.progressSlider.value, 10) || 0;
    }

    let chapter = '';
    if (state.epub.toc && state.epub.toc.length > 0 && loc && loc.start && loc.start.href) {
      const ch = state.epub.toc.find(item => loc.start.href.includes(item.href));
      if (ch && ch.label) chapter = ch.label.trim();
    }
    if (!chapter && elements.currentChapterTitle) {
      chapter = elements.currentChapterTitle.textContent.trim();
    }

    return {
      type: 'epub',
      pct,
      cfi,
      chapter
    };
  }
  return null;
}

function openBookmarkModal(customData = null, existingBm = null) {
  if (!state.currentBook) {
    showToast('도서를 먼저 열어주세요.');
    return;
  }

  const snippetElem = elements.bookmarkPreviewSnippet || document.getElementById('bookmark-preview-snippet');

  if (existingBm) {
    editingBookmarkId = existingBm.id;
    pendingBookmarkData = { ...existingBm };
    if (elements.bookmarkModalTitle) {
      elements.bookmarkModalTitle.innerHTML = '<span>✏️</span> 책갈피 수정';
    }
    if (elements.inputBookmarkTitle) elements.inputBookmarkTitle.value = existingBm.title || '';
    if (elements.bookmarkPreviewPct) elements.bookmarkPreviewPct.textContent = `진행률 ${existingBm.pct ?? 0}%`;
    if (elements.bookmarkPreviewChapter) elements.bookmarkPreviewChapter.textContent = existingBm.chapter || '';
    if (snippetElem) {
      if (existingBm.sentence) {
        snippetElem.textContent = `“${existingBm.sentence}”`;
        snippetElem.style.display = '-webkit-box';
      } else {
        snippetElem.style.display = 'none';
      }
    }
  } else {
    editingBookmarkId = null;
    const info = customData || getCurrentReadingPositionInfo();
    if (!info) {
      showToast('현재 위치를 가져올 수 없습니다.');
      return;
    }
    pendingBookmarkData = info;

    const sentencePreview = info.sentence || info.targetSentence;
    const defaultTitle = customData && customData.title
      ? customData.title
      : (sentencePreview
          ? `"${sentencePreview.slice(0, 24)}${sentencePreview.length > 24 ? '...' : ''}"`
          : `마지막 읽은 지점 (${info.pct ?? 0}%)`);

    if (elements.bookmarkModalTitle) {
      elements.bookmarkModalTitle.innerHTML = '<span>🔖</span> 책갈피 추가';
    }
    if (elements.inputBookmarkTitle) elements.inputBookmarkTitle.value = defaultTitle;
    if (elements.bookmarkPreviewPct) elements.bookmarkPreviewPct.textContent = `진행률 ${info.pct ?? 0}%`;
    if (elements.bookmarkPreviewChapter) elements.bookmarkPreviewChapter.textContent = info.chapter || '';
    if (snippetElem) {
      if (sentencePreview) {
        snippetElem.textContent = `“${sentencePreview}”`;
        snippetElem.style.display = '-webkit-box';
      } else {
        snippetElem.style.display = 'none';
      }
    }
  }

  if (elements.bookmarkModal) {
    elements.bookmarkModal.classList.add('open');
    setTimeout(() => {
      if (elements.inputBookmarkTitle) {
        elements.inputBookmarkTitle.focus();
        elements.inputBookmarkTitle.select();
      }
    }, 60);
  }
}

function closeBookmarkModal() {
  if (elements.bookmarkModal) {
    elements.bookmarkModal.classList.remove('open');
  }
  pendingBookmarkData = null;
  editingBookmarkId = null;
}

function saveBookmarkModal() {
  if (!state.currentBook) return;

  const title = (elements.inputBookmarkTitle ? elements.inputBookmarkTitle.value.trim() : '') || '책갈피';

  if (editingBookmarkId) {
    const targetIdx = state.bookmarks.findIndex(b => b.id === editingBookmarkId);
    if (targetIdx !== -1) {
      state.bookmarks[targetIdx].title = title;
      saveBookmarks();
      showToast('책갈피가 수정되었습니다.');
      if (elements.readerDrawer && elements.readerDrawer.classList.contains('open')) {
        renderBookmarkDrawer();
      }
    }
  } else if (pendingBookmarkData) {
    const newBm = {
      id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      bookId: state.currentBook.id,
      type: state.currentBook.type,
      title,
      pct: pendingBookmarkData.pct ?? 0,
      scrollTop: pendingBookmarkData.scrollTop,
      sentence: pendingBookmarkData.sentence || pendingBookmarkData.targetSentence || '',
      chapter: pendingBookmarkData.chapter || '',
      pIdx: pendingBookmarkData.pIdx,
      cfi: pendingBookmarkData.cfi,
      createdAt: Date.now()
    };
    state.bookmarks.push(newBm);
    saveBookmarks();
    showToast(`🔖 '${title}' 책갈피가 저장되었습니다.`);

    if (elements.readerDrawer && elements.readerDrawer.classList.contains('open')) {
      renderBookmarkDrawer();
    }
  }

  if (state.activeSelection) {
    try {
      if (state.activeSelection.contents) {
        state.activeSelection.contents.window.getSelection().removeAllRanges();
      } else {
        window.getSelection().removeAllRanges();
      }
    } catch (e) {}
    state.activeSelection = null;
  }

  closeBookmarkModal();
}

function addBookmarkFromSelection() {
  if (!state.activeSelection || !state.activeSelection.text) {
    showToast('선택된 텍스트가 없습니다.');
    return;
  }
  const selText = state.activeSelection.text.trim();
  const baseInfo = getCurrentReadingPositionInfo() || {};
  const targetSentence = state.activeSelection.targetSentence || selText;

  let defaultTitle = '';
  if (selText.length >= 10) {
    defaultTitle = `"${selText.slice(0, 24)}${selText.length > 24 ? '...' : ''}"`;
  } else if (targetSentence) {
    defaultTitle = `"${targetSentence.slice(0, 26)}${targetSentence.length > 26 ? '...' : ''}"`;
  } else {
    defaultTitle = `"${selText}"`;
  }

  const customData = {
    ...baseInfo,
    title: defaultTitle,
    sentence: targetSentence,
    pIdx: state.activeSelection.pIdx !== undefined ? state.activeSelection.pIdx : baseInfo.pIdx,
    cfi: state.activeSelection.cfiRange || baseInfo.cfi
  };

  closeAllToolbars();
  openBookmarkModal(customData);
}

// ── Word/Text Edit Modal & Logic ──
function openWordEditModal() {
  if (!state.currentBook) {
    showToast('열려있는 도서가 없습니다.');
    return;
  }

  if (!state.activeSelection || !state.activeSelection.text) {
    showToast('수정할 텍스트를 먼저 선택해주세요.');
    return;
  }

  const selText = state.activeSelection.text;
  if (elements.wordEditOriginal) {
    elements.wordEditOriginal.value = selText;
  }
  if (elements.wordEditInput) {
    elements.wordEditInput.value = selText;
  }

  // 문맥 미리보기 구성
  if (elements.wordEditContextPreview && elements.wordEditContextText) {
    const targetSentence = state.activeSelection.targetSentence || selText;
    if (targetSentence && targetSentence !== selText) {
      const escapedSentence = escapeHtml(targetSentence);
      const escapedWord = escapeHtml(selText);
      const highlightedHtml = escapedSentence.replace(
        escapedWord,
        `<span class="word-edit-highlight-word">${escapedWord}</span>`
      );
      elements.wordEditContextText.innerHTML = `“${highlightedHtml}”`;
      elements.wordEditContextPreview.style.display = 'block';
    } else {
      elements.wordEditContextPreview.style.display = 'none';
    }
  }

  closeAllToolbars();
  if (elements.wordEditModal) {
    elements.wordEditModal.classList.add('open');
  }

  setTimeout(() => {
    if (elements.wordEditInput) {
      elements.wordEditInput.focus();
      elements.wordEditInput.select();
    }
  }, 60);
}

function closeWordEditModal() {
  if (elements.wordEditModal) {
    elements.wordEditModal.classList.remove('open');
  }
}

async function executeWordEdit() {
  if (!state.currentBook) {
    showToast('열려있는 도서가 없습니다.');
    closeWordEditModal();
    return;
  }

  if (!state.activeSelection || !state.activeSelection.text) {
    showToast('수정할 텍스트 선택이 해제되었습니다.');
    closeWordEditModal();
    return;
  }

  const oldText = state.activeSelection.text;
  const newText = elements.wordEditInput ? elements.wordEditInput.value.trim() : '';

  if (!newText) {
    showToast('수정할 내용을 입력해주세요.');
    if (elements.wordEditInput) elements.wordEditInput.focus();
    return;
  }

  if (newText === oldText) {
    showToast('변경 사항이 없습니다.');
    closeWordEditModal();
    return;
  }

  const bookType = state.currentBook.type;
  const pIdx = state.activeSelection.pIdx;
  const charOffset = state.activeSelection.offset ?? 0;
  const delta = newText.length - oldText.length;

  let editSuccess = false;

  // 1. TXT 도서 원문 수정
  if (bookType === 'txt') {
    if (typeof state.currentBook.content === 'string') {
      const rawContent = state.currentBook.content;
      const pRegex = /\n\s*\n/g;
      let lastEnd = 0;
      let curIdx = 0;
      let match;
      let targetPStart = 0;
      let targetPEnd = rawContent.length;

      while ((match = pRegex.exec(rawContent)) !== null) {
        if (curIdx === pIdx) {
          targetPStart = lastEnd;
          targetPEnd = match.index;
          break;
        }
        lastEnd = match.index + match[0].length;
        curIdx++;
      }
      if (curIdx === pIdx && targetPEnd === rawContent.length) {
        targetPStart = lastEnd;
      }

      const pText = rawContent.substring(targetPStart, targetPEnd);
      let replaceStartInP = -1;
      if (charOffset >= 0 && charOffset + oldText.length <= pText.length && pText.substring(charOffset, charOffset + oldText.length) === oldText) {
        replaceStartInP = charOffset;
      } else {
        replaceStartInP = pText.indexOf(oldText);
      }

      if (replaceStartInP !== -1) {
        const newPText = pText.substring(0, replaceStartInP) + newText + pText.substring(replaceStartInP + oldText.length);
        state.currentBook.content = rawContent.substring(0, targetPStart) + newPText + rawContent.substring(targetPEnd);
        editSuccess = true;
      } else {
        const globalIdx = rawContent.indexOf(oldText);
        if (globalIdx !== -1) {
          state.currentBook.content = rawContent.substring(0, globalIdx) + newText + rawContent.substring(globalIdx + oldText.length);
          editSuccess = true;
        }
      }
    }
  }
  // 2. MD (Markdown) 도서 원문 수정
  else if (bookType === 'md') {
    if (typeof state.currentBook.content === 'string') {
      const rawContent = state.currentBook.content;
      let replaced = false;
      if (state.activeSelection.targetSentence) {
        const sentenceIdx = rawContent.indexOf(state.activeSelection.targetSentence);
        if (sentenceIdx !== -1) {
          const wordInSentenceIdx = rawContent.indexOf(oldText, sentenceIdx);
          if (wordInSentenceIdx !== -1 && wordInSentenceIdx <= sentenceIdx + state.activeSelection.targetSentence.length) {
            state.currentBook.content = rawContent.substring(0, wordInSentenceIdx) + newText + rawContent.substring(wordInSentenceIdx + oldText.length);
            replaced = true;
            editSuccess = true;
          }
        }
      }
      if (!replaced) {
        const wordIdx = rawContent.indexOf(oldText);
        if (wordIdx !== -1) {
          state.currentBook.content = rawContent.substring(0, wordIdx) + newText + rawContent.substring(wordIdx + oldText.length);
          editSuccess = true;
        }
      }
    }
  }
  // 3. EPUB 도서 수정
  else if (bookType === 'epub') {
    try {
      if (state.activeSelection.range && state.activeSelection.contents) {
        const range = state.activeSelection.range;
        const doc = state.activeSelection.contents.document;
        range.deleteContents();
        range.insertNode(doc.createTextNode(newText));
        editSuccess = true;
      }
    } catch (e) {
      console.warn('EPUB DOM direct text replacement warning:', e);
    }
  }

  if (!editSuccess) {
    showToast('본문에서 단어 위치를 찾지 못했습니다.');
    closeWordEditModal();
    return;
  }

  // ── 형광펜(Highlights) 연동 및 보정 ──
  if (Array.isArray(state.highlights) && state.highlights.length > 0) {
    let hlChanged = false;
    state.highlights.forEach(hl => {
      // Case A: 수정된 단어 자체에 형광펜이 칠해져 있었던 경우
      const isExactMatch = (pIdx !== undefined && hl.pIdx === pIdx && hl.text === oldText) ||
                           (hl.text === oldText && hl.targetSentence === state.activeSelection.targetSentence);
      const isOffsetOverlap = (pIdx !== undefined && hl.pIdx === pIdx && typeof hl.offset === 'number' &&
                               hl.offset <= charOffset && hl.offset + hl.text.length >= charOffset + oldText.length);

      if (isExactMatch || isOffsetOverlap) {
        hl.text = newText;
        if (hl.targetSentence) {
          hl.targetSentence = hl.targetSentence.replace(oldText, newText);
        }
        if (hl.prevSentence) {
          hl.prevSentence = hl.prevSentence.replace(oldText, newText);
        }
        if (hl.nextSentence) {
          hl.nextSentence = hl.nextSentence.replace(oldText, newText);
        }
        autoFetchVocabForHighlight(hl);
        hlChanged = true;
      }
      // Case B: 같은 문단 내에서 수정 단어 '뒤'에 있는 형광펜들의 오프셋 보정
      else if (pIdx !== undefined && hl.pIdx === pIdx && typeof hl.offset === 'number' && hl.offset > charOffset) {
        hl.offset += delta;
        if (hl.targetSentence && hl.targetSentence.includes(oldText)) {
          hl.targetSentence = hl.targetSentence.replace(oldText, newText);
        }
        hlChanged = true;
      }
    });

    if (hlChanged) {
      sortHighlights();
      saveHighlights();
      updateHighlightBadge();
      if (elements.readerDrawer && elements.readerDrawer.classList.contains('open')) {
        renderHighlightDrawer();
      }
    }
  }

  // ── 책갈피(Bookmarks) 연동 및 보정 ──
  if (Array.isArray(state.bookmarks) && state.bookmarks.length > 0) {
    let bmChanged = false;
    state.bookmarks.forEach(bm => {
      if (pIdx !== undefined && bm.pIdx === pIdx) {
        if (bm.sentence && bm.sentence.includes(oldText)) {
          bm.sentence = bm.sentence.replace(oldText, newText);
          bmChanged = true;
        }
        if (bm.title && bm.title.includes(oldText)) {
          bm.title = bm.title.replace(oldText, newText);
          bmChanged = true;
        }
      }
    });

    if (bmChanged) {
      saveBookmarks();
      if (elements.readerDrawer && elements.readerDrawer.classList.contains('open')) {
        renderBookmarkDrawer();
      }
    }
  }

  // ── 도서 내용 IndexedDB 영구 저장 ──
  if (bookType === 'txt' || bookType === 'md') {
    saveActiveBookToStorage({
      type: bookType,
      title: state.currentBook.title,
      author: state.currentBook.author,
      content: state.currentBook.content,
      bookId: state.currentBook.id
    });
  }

  // ── 뷰어 리렌더링 및 목차 갱신 ──
  if (bookType === 'txt') {
    renderTxtContent();
  } else if (bookType === 'md') {
    renderMdContent();
    if (elements.readerDrawer && elements.readerDrawer.classList.contains('open')) {
      renderTocDrawer();
    }
  }

  // ── 수정 위치 시각적 플래시 효과 ──
  if (pIdx !== undefined && elements.txtContent) {
    const pElem = elements.txtContent.querySelector(`[data-p-idx="${pIdx}"]`);
    if (pElem) {
      pElem.classList.remove('word-edit-flash');
      void pElem.offsetWidth;
      pElem.classList.add('word-edit-flash');
      setTimeout(() => pElem.classList.remove('word-edit-flash'), 2200);
    }
  }

  // ── 텍스트 선택 해제 및 정리 ──
  try {
    if (state.activeSelection.contents) {
      state.activeSelection.contents.window.getSelection().removeAllRanges();
    } else {
      window.getSelection().removeAllRanges();
    }
  } catch (e) {}
  state.activeSelection = null;

  closeWordEditModal();
  showToast(`✏️ '${oldText}' → '${newText}'(으)로 수정되었습니다.`);
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

// ── Gemini API & Vocab / Quiz Subsystem ──

function escapeRegex(str) {
  return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightSearchTerm(text, terms = []) {
  if (!text && text !== 0) return '';
  const escaped = escapeHtml(text);
  if (!terms || terms.length === 0) return escaped;
  const pattern = terms.map(t => escapeRegex(escapeHtml(t))).filter(Boolean).join('|');
  if (!pattern) return escaped;
  return escaped.replace(new RegExp(`(${pattern})`, 'gi'), '<mark class="search-match-highlight">$1</mark>');
}

function formatQuestionHtml(sentence, target, searchTerms = []) {
  if (!sentence) return `<mark class="vocab-q-target">${escapeHtml(target || '')}</mark>`;
  if (!target) return highlightSearchTerm(sentence, searchTerms);

  const escTarget = escapeRegex(target.trim());
  if (!escTarget) return escapeHtml(sentence);

  const parts = sentence.split(new RegExp(`(${escTarget})`, 'i'));
  return parts.map(part => {
    if (part.toLowerCase() === target.trim().toLowerCase()) {
      return `<mark class="vocab-q-target">${escapeHtml(part)}</mark>`;
    } else {
      return highlightSearchTerm(part, searchTerms);
    }
  }).join('');
}

let storedModel = localStorage.getItem('gemini_model');
if (storedModel === 'gemini-2.5-flash' || storedModel === 'gemini-3.8-flash' || !storedModel) {
  storedModel = 'gemini-2.0-flash';
  localStorage.setItem('gemini_model', storedModel);
}
let cachedGeminiModel = storedModel;

function getGeminiApiKey() {
  let key = (state.settings && state.settings.geminiApiKey) ? state.settings.geminiApiKey.trim() : '';
  if (!key) {
    key = (localStorage.getItem('gemini_api_key') || '').trim();
  }
  if (key) {
    if (!state.settings) state.settings = {};
    if (state.settings.geminiApiKey !== key) {
      state.settings.geminiApiKey = key;
    }
  }
  return key;
}

function extractGeminiVersion(name) {
  const m = (name || '').match(/gemini-(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : 0;
}

function extractRecommendedModelFromError(errMsg) {
  if (!errMsg) return null;
  const match = errMsg.match(/use\s+models\/(gemini-[\w.-]+)/i) || errMsg.match(/models\/(gemini-[\w.-]+)/i);
  return match ? match[1] : null;
}

async function resolveGeminiModel(apiKey, forceRefresh = false) {
  if (!apiKey) throw new Error('API 키가 없습니다.');

  if (!forceRefresh && cachedGeminiModel && cachedGeminiModel !== 'gemini-2.5-flash' && cachedGeminiModel !== 'gemini-3.8-flash') {
    return cachedGeminiModel;
  }

  // Google AI Studio 모델 목록 조회로 활성화된 모델 탐색
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        // generateContent 지원 모델 중 비활성화/과부하 모델 제외
        const supported = data.models
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''))
          .filter(name => name !== 'gemini-2.5-flash');

        // 1. 안정적인 고한도(15 RPM) 모델 우선 매핑 (과부하 503 및 5 RPM 방지)
        const preferredStable = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.6-flash'];
        for (const pref of preferredStable) {
          if (supported.includes(pref)) {
            cachedGeminiModel = pref;
            localStorage.setItem('gemini_model', cachedGeminiModel);
            return cachedGeminiModel;
          }
        }

        // 2. 그 외 flash 모델 중 최신순
        const flashModels = supported.filter(name => name.includes('flash'));
        flashModels.sort((a, b) => extractGeminiVersion(b) - extractGeminiVersion(a));

        if (flashModels.length > 0) {
          cachedGeminiModel = flashModels[0];
          localStorage.setItem('gemini_model', cachedGeminiModel);
          return cachedGeminiModel;
        }

        // 3. 전체 지원 모델 중 최신순
        supported.sort((a, b) => extractGeminiVersion(b) - extractGeminiVersion(a));
        if (supported.length > 0) {
          cachedGeminiModel = supported[0];
          localStorage.setItem('gemini_model', cachedGeminiModel);
          return cachedGeminiModel;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to fetch Gemini models list, using fallback:', e);
  }

  // 기본 fallback: 15 RPM 안정 모델 gemini-2.0-flash
  cachedGeminiModel = 'gemini-2.0-flash';
  localStorage.setItem('gemini_model', cachedGeminiModel);
  return cachedGeminiModel;
}

// ── Gemini API 쿼터 초과 시 재시도 대기 시간 분석 및 안내 메시지 생성 함수 ──
function parseQuotaRetryTime(err) {
  let waitSeconds = null;
  let isDailyReset = false;
  const msg = (err && (err.message || String(err))) || '';

  // 1. HTTP 응답 헤더 Retry-After 확인
  if (err && err.retryAfterHeader) {
    const sec = parseFloat(err.retryAfterHeader);
    if (!isNaN(sec) && sec > 0) {
      waitSeconds = sec;
    } else {
      const headerDate = new Date(err.retryAfterHeader);
      if (!isNaN(headerDate.getTime())) {
        waitSeconds = Math.max(0, (headerDate.getTime() - Date.now()) / 1000);
      }
    }
  }

  // 2. Google RPC 에러 상세 정보(RetryInfo) 확인
  if (waitSeconds === null && err && err.errorDetails && Array.isArray(err.errorDetails)) {
    const retryInfo = err.errorDetails.find(d => d && d['@type'] && d['@type'].includes('RetryInfo'));
    if (retryInfo && retryInfo.retryDelay) {
      const match = String(retryInfo.retryDelay).match(/([\d.]+)s?/i);
      if (match) {
        waitSeconds = parseFloat(match[1]);
      }
    }
  }

  // 3. 오류 메시지 텍스트 파싱
  if (waitSeconds === null) {
    // 3a. "retry in X.Xs" 또는 "retry in Xs"
    const matchSec = msg.match(/retry in ([\d.]+)\s*s(?:ec(?:ond)?s?)?/i);
    if (matchSec) {
      waitSeconds = parseFloat(matchSec[1]);
    }
  }

  if (waitSeconds === null) {
    // 3b. "retry in Xm" 또는 "retry in X min"
    const matchMin = msg.match(/retry in ([\d.]+)\s*m(?:in(?:ute)?s?)?/i);
    if (matchMin) {
      waitSeconds = parseFloat(matchMin[1]) * 60;
    }
  }

  if (waitSeconds === null) {
    // 3c. "retry in Xh" 또는 "retry in X hours"
    const matchHour = msg.match(/retry in ([\d.]+)\s*h(?:our)?s?/i);
    if (matchHour) {
      waitSeconds = parseFloat(matchHour[1]) * 3600;
    }
  }

  if (waitSeconds === null) {
    // 3d. "retry after <timestamp/date>"
    const matchAfter = msg.match(/retry after\s+([^\s,;\(\)]+)/i);
    if (matchAfter) {
      const dateStr = matchAfter[1].replace(/\.+$/, '');
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const diff = (date.getTime() - Date.now()) / 1000;
        if (diff > 0) {
          waitSeconds = diff;
        }
      }
    }
  }

  // 4. 분 단위 한도(RPM) 감지 시 기본 1분 대기
  if (waitSeconds === null && /minute|RPM/i.test(msg)) {
    waitSeconds = 60;
  }

  // 5. 대기 시간이 명시되지 않은 일일 쿼터 초과의 경우:
  // Google Gemini API 일일 쿼터는 태평양 표준시 자정(00:00 PT)에 리셋되므로 다음 자정까지 남은 시간 계산
  if (waitSeconds === null) {
    try {
      const now = new Date();
      const ptString = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
      const ptDate = new Date(ptString);
      const nextMidnightPT = new Date(ptDate);
      nextMidnightPT.setHours(24, 0, 0, 0);
      const diffMs = nextMidnightPT.getTime() - ptDate.getTime();
      waitSeconds = Math.max(60, Math.round(diffMs / 1000));
      isDailyReset = true;
    } catch (e) {
      waitSeconds = 86400;
      isDailyReset = true;
    }
  }

  const totalHours = waitSeconds / 3600;
  const hoursCeil = Math.ceil(totalHours);
  let h = Math.floor(totalHours);
  let m = Math.round((waitSeconds % 3600) / 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }

  let timeText = '';
  if (totalHours >= 1) {
    if (m > 0 && h > 0) {
      timeText = `약 ${h}시간 ${m}분 후(약 ${hoursCeil}시간 후)`;
    } else {
      timeText = `약 ${hoursCeil}시간 후`;
    }
  } else if (m > 0) {
    timeText = `약 1시간 이내(약 ${m}분 후)`;
  } else {
    timeText = `약 1시간 이내(약 1분 후)`;
  }

  let resetTimeStr = '';
  try {
    const resetDate = new Date(Date.now() + waitSeconds * 1000);
    resetTimeStr = resetDate.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  } catch (e) {}

  const extraResetText = resetTimeStr && (isDailyReset || totalHours >= 2) ? ` (${resetTimeStr}경 초기화)` : '';
  const fullMessage = `⚠️ Gemini API 쿼터가 초과되었습니다. 앞으로 ${timeText}${extraResetText}에 다시 시도해주세요.`;

  return {
    waitSeconds,
    totalHours,
    hoursCeil,
    timeText,
    resetTimeStr,
    fullMessage
  };
}

async function fetchGeminiVocabData(targetText, targetSentence, contextOptions = {}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  let modelName = cachedGeminiModel || localStorage.getItem('gemini_model');
  if (!modelName || modelName === 'gemini-2.5-flash') {
    modelName = await resolveGeminiModel(apiKey);
  }

  const prevSentence = contextOptions.prevSentence || '';
  const nextSentence = contextOptions.nextSentence || '';
  const author = contextOptions.author || (state.currentBook ? state.currentBook.author : '');
  const bookTitle = contextOptions.bookTitle || (state.currentBook ? state.currentBook.title : '');

  const cleanA = cleanAuthor(author);
  const cleanT = cleanBookTitle(bookTitle);
  const hasSourceInfo = (cleanA !== '저자' || cleanT !== '<책명>');

  let contextDetails = '';
  if (hasSourceInfo) {
    contextDetails += `Source Book & Author: ${cleanA}, ${cleanT}\n`;
  }
  if (prevSentence) {
    contextDetails += `Previous sentence (context): "${prevSentence}"\n`;
  }
  contextDetails += `Target sentence: "${targetSentence}"\n`;
  if (nextSentence) {
    contextDetails += `Next sentence (context): "${nextSentence}"\n`;
  }

  const prompt = `You are an expert bilingual English-Korean lexicographer and language tutor.
Target phrase: "${targetText}"
${contextDetails}
Analyze the target phrase in the exact context of the provided sentence, taking into account the surrounding context (previous/next sentences) and source book information, following these strict rules:

1. [Meaning (targetMeaning)]:
   - Prioritize the accurate, primary literal meaning (직역) so the learner understands the word's fundamental definition in this context.
   - Do NOT produce vague or overly interpretive paraphrases on their own.
   - Always base the meaning strictly on the literal meaning (직역 위주). If the literal meaning alone is awkward, unnatural, or insufficient to capture the contextual nuance in this passage, provide the literal meaning first, followed by the contextual interpretation/paraphrase in parentheses using the format: "직역 (문맥: 의역)".
     * Example (literal is sufficient): "금박을 입힌"
     * Example (needs contextual nuance): "달을 달라고 울다 (문맥: 불가능한 것을 조르다)"
     * Example (metaphorical): "수면을 스치다 (문맥: 구애하다)"

2. [Pronunciation (phonetic)]:
   - If the target word is difficult, advanced (CEFR B2+), uncommon, or phonetically tricky/irregular, provide its International Phonetic Alphabet (IPA) transcription enclosed in slashes (e.g. "/ˈɡɪldɪd/", "/ˌpɪnəˈfɔːr/").
   - If it is a common/elementary word (e.g. "happy", "crying", "river") or a multi-word phrase composed of basic words, return an empty string ("").

3. [Sentence Translation & Key Vocabulary (sentenceTranslation)]:
   - First, provide a fluent, natural Korean translation of the target sentence that faithfully reflects the surrounding context and tone of the book.
   - Then, immediately below the Korean translation (separated by an empty line and "[주요 단어 및 숙어]"), list and explain key words, idioms, phrasal verbs, and challenging grammatical expressions in the target sentence (just like Google AI Search results, helping English learners deeply understand the sentence structure and vocabulary).
   - Format strictly as follows:
     <자연스러운 한국어 문장 번역>

     [주요 단어 및 숙어]
     • <단어/숙어 1>: <문맥 속 한국어 뜻 및 설명>
     • <단어/숙어 2>: <문맥 속 한국어 뜻 및 설명>

Return ONLY a valid JSON object matching this schema without markdown fences:
{
  "phonetic": "IPA transcription for difficult/advanced words, or empty string",
  "targetMeaning": "Korean literal meaning first. If awkward, format as: 직역 (문맥: 의역)",
  "sentenceTranslation": "자연스러운 한국어 문장 번역\n\n[주요 단어 및 숙어]\n• 단어/숙어: 문맥 속 뜻 및 설명"
}`;

  async function executeRequest(mName) {
    // 일시적인 5xx 서버 오류에 대비해 1회 자동 재시도 (429 쿼터 초과는 즉시 반환하여 상위에서 처리)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2
            }
          })
        });
        if (res.status >= 500 && attempt === 0) {
          console.warn(`Transient server error (${res.status}), retrying in 1s...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return res;
      } catch (e) {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw e;
      }
    }
  }

  let response = await executeRequest(modelName);

  // 오류 시 추천 모델 파싱 또는 재탐색 후 1회 자동 재시도
  if (!response.ok) {
    let errBody = await response.json().catch(() => ({}));
    let errMsg = errBody.error?.message || `HTTP ${response.status}`;

    const suggestedModel = extractRecommendedModelFromError(errMsg);
    if (suggestedModel && suggestedModel !== modelName) {
      console.warn(`Retrying with Google suggested model: ${suggestedModel}`);
      modelName = suggestedModel;
      cachedGeminiModel = modelName;
      localStorage.setItem('gemini_model', modelName);
      response = await executeRequest(modelName);
      if (!response.ok) {
        errBody = await response.json().catch(() => ({}));
        errMsg = errBody.error?.message || `HTTP ${response.status}`;
      }
    } else if (response.status === 404 || response.status === 400) {
      console.warn(`Model ${modelName} failed (${response.status}), resolving fresh model...`);
      modelName = await resolveGeminiModel(apiKey, true);
      response = await executeRequest(modelName);
      if (!response.ok) {
        errBody = await response.json().catch(() => ({}));
        errMsg = errBody.error?.message || `HTTP ${response.status}`;
      }
    }

    if (!response.ok) {
      const customErr = new Error(errMsg);
      customErr.status = response.status;
      customErr.errorBody = errBody;
      customErr.errorDetails = errBody.error?.details;
      customErr.retryAfterHeader = response.headers ? response.headers.get('retry-after') : null;
      throw customErr;
    }
  }

  const data = await response.json();
  const textPart = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textPart) throw new Error('AI 응답 데이터가 비어 있습니다.');

  const parsed = JSON.parse(textPart);
  return {
    targetMeaning: (parsed.targetMeaning || '').trim(),
    phonetic: (parsed.phonetic || '').trim(),
    sentenceTranslation: (parsed.sentenceTranslation || '').trim()
  };
}

async function testGeminiApiKey(apiKey) {
  if (!apiKey) throw new Error('API 키를 입력해주세요.');

  // 1. 지원 가능한 최신 모델 자동 확인
  let modelName = await resolveGeminiModel(apiKey, true);

  async function tryPing(m) {
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(testUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Ping test. Reply with {"status":"ok"}' }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        if ((res.status >= 500 || res.status === 429) && attempt === 0) {
          console.warn(`Temporary ping error ${res.status}, retrying...`);
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        return res;
      } catch (err) {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        throw err;
      }
    }
  }

  // 2. Ping 테스트 수행
  let response = await tryPing(modelName);

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.error?.message || `연결 오류 (HTTP ${response.status})`;

    // Google 오류 메시지에 최신 추천 모델이 포함된 경우 (예: "use models/gemini-3.6-flash") 자동 전환 후 재시도
    const suggestedModel = extractRecommendedModelFromError(errMsg);
    if (suggestedModel && suggestedModel !== modelName) {
      console.warn(`Retrying test with Google recommended model: ${suggestedModel}`);
      modelName = suggestedModel;
      cachedGeminiModel = modelName;
      localStorage.setItem('gemini_model', modelName);
      response = await tryPing(modelName);
      if (response.ok) {
        return { ok: true, model: modelName };
      }
    }

    // fallback 모델 순차 시도
    const fallbacks = ['gemini-3.6-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    for (const fb of fallbacks) {
      if (fb !== modelName) {
        const retryRes = await tryPing(fb);
        if (retryRes.ok) {
          cachedGeminiModel = fb;
          localStorage.setItem('gemini_model', fb);
          return { ok: true, model: fb };
        }
      }
    }

    throw new Error(errMsg);
  }

  return { ok: true, model: modelName };
}

async function autoFetchVocabForHighlight(hl, isManual = false) {
  if (!isManual && state.settings.aiAutoAnalysis === false) return;
  const apiKey = getGeminiApiKey();
  if (!apiKey) return;
  try {
    showToast(`🤖 '${hl.text}' 문맥 분석 중...`);
    const res = await fetchGeminiVocabData(hl.text, hl.targetSentence || hl.text, {
      prevSentence: hl.prevSentence,
      nextSentence: hl.nextSentence,
      author: state.currentBook?.author,
      bookTitle: state.currentBook?.title
    });
    if (res && res.targetMeaning) {
      hl.targetMeaning = res.targetMeaning;
      hl.phonetic = res.phonetic || '';
      hl.sentenceTranslation = res.sentenceTranslation;
      saveHighlights();
      updateQuizBadge();
      if (elements.readerDrawer && elements.readerDrawer.classList.contains('open')) {
        renderHighlightDrawer();
      }
      const pText = hl.phonetic ? ` ${hl.phonetic}` : '';
      showToast(`✨ '${hl.text}'${pText}: ${res.targetMeaning}`);
    }
  } catch (err) {
    console.warn('Auto vocab analysis skipped/failed:', err);
    const isQuota = /429|quota|rate limit|too many|RESOURCE_EXHAUSTED/i.test(err.message) || err.status === 429;
    if (isQuota) {
      const retryInfo = parseQuotaRetryTime(err);
      showToast(retryInfo.fullMessage, 8000);
    }
  }
}

function exportVocabToCsv() {
  if (!state.highlights || state.highlights.length === 0) {
    showToast('내보낼 형광펜/단어가 없습니다.');
    return;
  }
  const bookTitle = state.currentBook ? state.currentBook.title : '도서';
  let csv = '\uFEFF'; // UTF-8 BOM for Excel / Anki
  csv += '구문,발음기호,문맥 질문(전체 문장),구문 뜻,전체 문장 해석,공부횟수,오답횟수,도서명,등록일\n';

  state.highlights.forEach(hl => {
    const target = `"${(hl.text || '').replace(/"/g, '""')}"`;
    const phonetic = `"${(hl.phonetic || '').replace(/"/g, '""')}"`;
    const qSentence = `"${(hl.targetSentence || hl.text || '').replace(/"/g, '""')}"`;
    const meaning = `"${(hl.targetMeaning || '').replace(/"/g, '""')}"`;
    const trans = `"${(hl.sentenceTranslation || '').replace(/"/g, '""')}"`;
    const study = hl.studyCount || 0;
    const wrong = hl.wrongCount || 0;
    const bTitle = `"${bookTitle.replace(/"/g, '""')}"`;
    const date = hl.createdAt ? hl.createdAt.slice(0, 10) : '';
    csv += `${target},${phonetic},${qSentence},${meaning},${trans},${study},${wrong},${bTitle},${date}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bookTitle}_단어장_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('단어장이 CSV 파일로 다운로드되었습니다.');
}

let isBatchGenerating = false;

async function batchGenerateVocab() {
  if (isBatchGenerating) {
    showToast('이미 Q&A 생성이 진행 중입니다.');
    return;
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    showToast('⚠️ Gemini API 키가 필요합니다. [설정]에서 등록해주세요.');
    elements.settingsPopover.classList.add('open');
    positionSettingsPopover();
    return;
  }

  const missing = state.highlights.filter(h => !h.targetMeaning);
  if (missing.length === 0) {
    showToast('모든 형광펜의 Q&A가 이미 완성되어 있습니다.');
    return;
  }

  isBatchGenerating = true;
  if (elements.btnBatchVocab) {
    elements.btnBatchVocab.disabled = true;
    elements.btnBatchVocab.textContent = '⏳ 생성 중...';
  }

  let successCount = 0;
  let idx = 0;
  let retryCountForCurrent = 0;
  let stoppedByQuota = false;
  const total = missing.length;

  showToast(`⚡ 총 ${total}개의 Q&A 스마트 생성을 시작합니다...`);

  try {
    while (idx < total) {
      const hl = missing[idx];
      const shortText = (hl.text || '').slice(0, 15);
      showToast(`Q&A 생성 중... (${idx + 1}/${total}) '${shortText}'`);

      try {
        const res = await fetchGeminiVocabData(hl.text, hl.targetSentence || hl.text, {
          prevSentence: hl.prevSentence,
          nextSentence: hl.nextSentence,
          author: state.currentBook?.author,
          bookTitle: state.currentBook?.title
        });
        if (res && res.targetMeaning) {
          hl.targetMeaning = res.targetMeaning;
          hl.phonetic = res.phonetic || '';
          hl.sentenceTranslation = res.sentenceTranslation;
          successCount++;
          saveHighlights();
          renderHighlightDrawer();
          updateQuizBadge();
        }
        idx++;
        retryCountForCurrent = 0;

        // 무료 요금제 15 RPM 한도를 안전하게 준수하기 위한 3.5초 딜레이
        if (idx < total) {
          await new Promise(r => setTimeout(r, 3500));
        }
      } catch (err) {
        console.warn(`Error on item "${hl.text}":`, err.message);

        // API 쿼터 초과(429, Quota, Rate Limit 등) 감지 시 재시도하지 않고 몇 시간 후 재시도 가능한지 안내 후 즉시 중단
        const isQuota = /429|quota|rate limit|too many|RESOURCE_EXHAUSTED/i.test(err.message) || err.status === 429;
        if (isQuota) {
          const retryInfo = parseQuotaRetryTime(err);
          stoppedByQuota = true;
          const progressText = successCount > 0 ? ` (${successCount}/${total}개 완료 후 중단)` : '';
          showToast(`${retryInfo.fullMessage}${progressText}`, 8000);
          console.warn('API 쿼터 초과로 일괄 생성을 중단합니다:', retryInfo);
          break; // 반복 재시도 루프 없이 즉시 중단
        }

        // 503(서버 과부하) 감지 시 모델 전환 또는 잠시 대기 후 재시도
        const is503 = /503|high demand|unavailable/i.test(err.message);
        if (is503 && retryCountForCurrent < 2) {
          retryCountForCurrent++;
          showToast(`⏳ 구글 서버 과부하 감지: 3초 후 재시도합니다... (${retryCountForCurrent}/2)`);
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }

        // 기타 일반 오류이거나 2회 이상 연속 실패 시 해당 단어만 건너뛰고 계속 진행
        retryCountForCurrent++;
        if (retryCountForCurrent >= 2) {
          console.warn(`Skipping item "${hl.text}" after 2 failures:`, err.message);
          idx++;
          retryCountForCurrent = 0;
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
  } finally {
    isBatchGenerating = false;
    if (elements.btnBatchVocab) {
      elements.btnBatchVocab.disabled = false;
      elements.btnBatchVocab.textContent = '⚡ Q&A 일괄생성';
    }
    if (!stoppedByQuota) {
      showToast(`🎉 총 ${successCount}/${total}개의 Q&A 생성을 완료했습니다!`);
    }
    renderHighlightDrawer();
    updateQuizBadge();
  }
}

// ── 퀴즈 시스템 (Quiz System) ──
let currentQuizList = [];
let currentQuizIndex = 0;
let quizStats = { correct: 0, wrong: 0, wrongItems: [] };
let currentCriteria = 'all';

function openQuizModal() {
  closeAllToolbars();
  if (elements.quizModalBackdrop) {
    elements.quizModalBackdrop.classList.add('open');
    document.body.classList.add('drawer-open');
  }
  initQuizSession(currentCriteria);
}

function closeQuizModal() {
  if (elements.quizModalBackdrop) {
    elements.quizModalBackdrop.classList.remove('open');
    document.body.classList.remove('drawer-open');
  }
}

function initQuizSession(criteria) {
  currentCriteria = criteria || 'all';
  document.querySelectorAll('.quiz-criteria-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.criteria === currentCriteria);
  });

  const pool = (state.highlights || []).filter(h => h.targetMeaning || h.text);
  if (pool.length === 0) {
    if (elements.quizActiveView) elements.quizActiveView.style.display = 'none';
    if (elements.quizResultView) elements.quizResultView.style.display = 'none';
    if (elements.quizEmptyState) elements.quizEmptyState.style.display = 'block';
    return;
  }

  if (elements.quizEmptyState) elements.quizEmptyState.style.display = 'none';
  if (elements.quizResultView) elements.quizResultView.style.display = 'none';
  if (elements.quizActiveView) elements.quizActiveView.style.display = 'block';

  let list = [...pool];
  const totalCount = pool.length;
  const wrongCount = pool.filter(h => (h.wrongCount || 0) > 0).length;

  if (currentCriteria === 'wrong-desc') {
    // 취약 단어 우선 (전체 단어를 출제하되 오답 많은 순)
    list.sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0));
  } else if (currentCriteria === 'study-asc') {
    // 신규 단어 우선 (전체 단어를 출제하되 공부 적은 순)
    list.sort((a, b) => (a.studyCount || 0) - (b.studyCount || 0));
  } else if (currentCriteria === 'wrong-only') {
    // 틀린 단어만 복습 (오답 1회 이상인 단어만 필터링)
    list = list.filter(h => (h.wrongCount || 0) > 0);
    if (list.length === 0) {
      showToast('오답 기록이 없습니다! 전체 단어로 출제합니다.');
      currentCriteria = 'all';
      document.querySelectorAll('.quiz-criteria-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.criteria === 'all');
      });
      list = [...pool].sort(() => Math.random() - 0.5);
    } else {
      list.sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0));
    }
  } else {
    // 전체 무작위
    list.sort(() => Math.random() - 0.5);
  }

  // 출제 기준 상세 설명 문구 실시간 갱신
  const descEl = elements.quizCriteriaDesc || document.getElementById('quiz-criteria-desc');
  if (descEl) {
    if (currentCriteria === 'wrong-desc') {
      descEl.textContent = `🔥 [취약 단어 우선 (전체)]: 등록된 모든 단어(${totalCount}개)를 출제하되, 오답 횟수가 많은 취약 단어부터 먼저 학습합니다.`;
    } else if (currentCriteria === 'study-asc') {
      descEl.textContent = `🆕 [신규 단어 우선 (전체)]: 등록된 모든 단어(${totalCount}개)를 출제하되, 공부 횟수가 적은 낯선 단어부터 먼저 학습합니다.`;
    } else if (currentCriteria === 'wrong-only') {
      descEl.textContent = `❌ [틀린 단어만 복습]: 1회 이상 틀렸던 오답 단어(${wrongCount}개)만 골라서 집중 복습합니다. (정답 단어 제외)`;
    } else {
      descEl.textContent = `🎲 [전체 (무작위)]: 등록된 모든 단어(${totalCount}개)를 무작위 순서로 골고루 출제합니다.`;
    }
  }

  currentQuizList = list;
  currentQuizIndex = 0;
  quizStats = { correct: 0, wrong: 0, wrongItems: [] };
  renderCurrentQuizCard();
}

function renderCurrentQuizCard() {
  if (currentQuizIndex >= currentQuizList.length) {
    showQuizResult();
    return;
  }

  const hl = currentQuizList[currentQuizIndex];
  if (elements.quizProgressText) {
    elements.quizProgressText.textContent = `${currentQuizIndex + 1} / ${currentQuizList.length}`;
  }
  if (elements.quizCardStats) {
    elements.quizCardStats.textContent = `학습: ${hl.studyCount || 0}회 | 오답: ${hl.wrongCount || 0}회`;
  }

  // 문장 내 구문 빨간색 강조 표시
  const sentence = hl.targetSentence || hl.text || '';
  const target = hl.text || '';
  const questionHtml = formatQuestionHtml(sentence, target);

  if (elements.quizQuestionSentence) {
    elements.quizQuestionSentence.innerHTML = questionHtml;
  }

  if (elements.quizAnswerMeaning) {
    const hasMeaning = !!(hl.targetMeaning && hl.targetMeaning.trim());
    const meaningText = hasMeaning ? hl.targetMeaning.trim() : "(뜻 미등록 - 형광펜 목록의 'Q&A 일괄생성'이나 단어 편집에서 등록해주세요)";
    const phoneticBadge = (hl.phonetic && hl.phonetic.trim())
      ? `<span class="quiz-phonetic-badge">${escapeHtml(hl.phonetic.trim())}</span>`
      : '';
    elements.quizAnswerMeaning.innerHTML = `<strong>💡 뜻:</strong> ${phoneticBadge}<span class="${hasMeaning ? '' : 'quiz-unregistered-text'}">${escapeHtml(meaningText)}</span>`;
  }

  if (elements.quizAnswerTrans) {
    const hasTrans = !!(hl.sentenceTranslation && hl.sentenceTranslation.trim());
    const transText = hasTrans ? hl.sentenceTranslation.trim() : "(해석 미등록 - 형광펜 목록의 'Q&A 일괄생성'이나 단어 편집에서 등록해주세요)";
    elements.quizAnswerTrans.innerHTML = `<strong>📖 해석:</strong> <span class="${hasTrans ? '' : 'quiz-unregistered-text'}">${escapeHtml(transText)}</span>`;

    // 뜻이나 해석이 누락되어 있고 Gemini API 키가 있는 경우, 원클릭 AI 즉시 보충 버튼 제공
    const hasApiKey = !!getGeminiApiKey();
    const isMissingData = !hl.targetMeaning || !hl.targetMeaning.trim() || !hl.sentenceTranslation || !hl.sentenceTranslation.trim();
    if (isMissingData && hasApiKey) {
      const inlineGenBtn = document.createElement('button');
      inlineGenBtn.type = 'button';
      inlineGenBtn.className = 'btn-quiz-inline-gen';
      inlineGenBtn.innerHTML = '⚡ AI 뜻/해석 생성';
      inlineGenBtn.onclick = async (ev) => {
        ev.stopPropagation();
        inlineGenBtn.disabled = true;
        inlineGenBtn.textContent = '⏳ AI 분석 중...';
        try {
          await autoFetchVocabForHighlight(hl, true);
          renderCurrentQuizCard();
          revealQuizAnswer();
        } catch (err) {
          inlineGenBtn.disabled = false;
          inlineGenBtn.textContent = '⚡ 재시도';
        }
      };
      elements.quizAnswerTrans.appendChild(inlineGenBtn);
    }
  }

  // 정답 가리기 및 버튼 상태 초기화
  if (elements.quizAnswerSection) elements.quizAnswerSection.style.display = 'none';
  if (elements.quizActionsUnrevealed) elements.quizActionsUnrevealed.style.display = 'flex';
  if (elements.quizActionsRevealed) elements.quizActionsRevealed.style.display = 'none';
}

function revealQuizAnswer() {
  if (elements.quizAnswerSection) elements.quizAnswerSection.style.display = 'block';
  if (elements.quizActionsUnrevealed) elements.quizActionsUnrevealed.style.display = 'none';
  if (elements.quizActionsRevealed) elements.quizActionsRevealed.style.display = 'flex';
}

function recordQuizAnswer(isCorrect) {
  const hl = currentQuizList[currentQuizIndex];
  if (hl) {
    hl.studyCount = (hl.studyCount || 0) + 1;
    hl.lastStudiedAt = new Date().toISOString();
    if (isCorrect) {
      quizStats.correct++;
    } else {
      hl.wrongCount = (hl.wrongCount || 0) + 1;
      quizStats.wrong++;
      quizStats.wrongItems.push(hl);
    }
    saveHighlights();
  }

  currentQuizIndex++;
  renderCurrentQuizCard();
}

function showQuizResult() {
  if (elements.quizActiveView) elements.quizActiveView.style.display = 'none';
  if (elements.quizResultView) elements.quizResultView.style.display = 'block';

  const totalCount = document.getElementById('result-total-count');
  const correctCount = document.getElementById('result-correct-count');
  const wrongCount = document.getElementById('result-wrong-count');

  if (totalCount) totalCount.textContent = currentQuizList.length;
  if (correctCount) correctCount.textContent = quizStats.correct;
  if (wrongCount) wrongCount.textContent = quizStats.wrong;

  if (elements.btnQuizRetryWrong) {
    elements.btnQuizRetryWrong.style.display = quizStats.wrongItems.length > 0 ? 'inline-block' : 'none';
  }
}

function openApiGuideModal() {
  if (elements.apiGuideModalBackdrop) {
    elements.apiGuideModalBackdrop.classList.add('open');
  }
}

function closeApiGuideModal() {
  if (elements.apiGuideModalBackdrop) {
    elements.apiGuideModalBackdrop.classList.remove('open');
  }
}

// ── Setup Event Listeners ──
function setupEventListeners() {
  // File Input Listeners
  if (elements.bookFileInput) {
    elements.bookFileInput.addEventListener('change', (e) => {
      handleFileSelection(e.target.files[0]);
      e.target.value = '';
    });
  }
  if (elements.listFileInput) {
    elements.listFileInput.addEventListener('change', (e) => {
      handleFileSelection(e.target.files[0]);
      e.target.value = '';
    });
  }
  if (elements.emptyFileInput) {
    elements.emptyFileInput.addEventListener('change', (e) => {
      handleFileSelection(e.target.files[0]);
      e.target.value = '';
    });
  }

  // 기존 열기 버튼 -> 목록 버튼으로 동작
  if (elements.btnOpenFile) {
    elements.btnOpenFile.addEventListener('click', (e) => {
      e.preventDefault();
      saveCurrentReadingPosition();
      showReaderFileList();
    });
  }

  // Storage Reset buttons (Desktop & Mobile)
  [elements.btnResetDb, elements.btnResetDbMobile].forEach(btn => {
    if (btn) {
      btn.addEventListener('click', resetReaderApp);
    }
  });

  // Sample Book & Export buttons
  if (elements.btnExportBook) {
    elements.btnExportBook.addEventListener('click', exportBookAsMarkdown);
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
  if (elements.btnToggleBookmarks) {
    elements.btnToggleBookmarks.addEventListener('mousedown', (e) => {
      // If there's an active text selection, prevent selection collapse on button press
      const winSel = window.getSelection();
      if ((state.activeSelection && state.activeSelection.text) || (winSel && winSel.toString().trim())) {
        e.preventDefault();
      }
    });

    elements.btnToggleBookmarks.addEventListener('click', (e) => {
      e.stopPropagation();
      let hasSelection = false;
      if (state.activeSelection && state.activeSelection.text) {
        hasSelection = true;
      } else {
        const winSel = window.getSelection();
        if (winSel && winSel.toString().trim()) {
          handleTxtSelection();
          if (state.activeSelection && state.activeSelection.text) {
            hasSelection = true;
          }
        }
      }

      if (hasSelection) {
        addBookmarkFromSelection();
      } else {
        openDrawer('bookmarks');
      }
    });
  }
  elements.btnToggleHighlights.addEventListener('click', () => openDrawer('highlights'));
  elements.btnDrawerClose.addEventListener('click', closeDrawer);
  elements.drawerBackdrop.addEventListener('click', closeDrawer);

  // Highlighter drawer search
  if (elements.inputHighlightSearch) {
    elements.inputHighlightSearch.addEventListener('input', (e) => {
      state.highlightSearchQuery = e.target.value;
      renderHighlightDrawer();
    });

    elements.inputHighlightSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (elements.inputHighlightSearch.value) {
          elements.inputHighlightSearch.value = '';
          state.highlightSearchQuery = '';
          renderHighlightDrawer();
        } else {
          closeDrawer();
        }
      }
    });
  }

  if (elements.btnClearHighlightSearch) {
    elements.btnClearHighlightSearch.addEventListener('click', () => {
      state.highlightSearchQuery = '';
      if (elements.inputHighlightSearch) {
        elements.inputHighlightSearch.value = '';
        elements.inputHighlightSearch.focus();
      }
      renderHighlightDrawer();
    });
  }

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

  // Copy auto-search highlights toggle
  if (elements.toggleCopySearchHighlights) {
    elements.toggleCopySearchHighlights.addEventListener('change', (e) => {
      state.settings.copySearchHighlights = e.target.checked;
      saveSettings();
      showToast(state.settings.copySearchHighlights
        ? '복사 시 형광펜 목록 자동 검색이 켜졌습니다.'
        : '복사 시 형광펜 목록 자동 검색이 꺼졌습니다.');
    });
  }

  // EPUB Nav arrows
  elements.btnEpubPrev.addEventListener('click', () => {
    if (state.epub.rendition) {
      state.epub.rendition.prev().catch(err => console.warn('Prev navigation:', err));
    }
    showNavButtonsTemporarily(2000);
  });
  elements.btnEpubNext.addEventListener('click', () => {
    if (state.epub.rendition) {
      state.epub.rendition.next().catch(err => console.warn('Next navigation:', err));
    }
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

    if (state.currentBook && (state.currentBook.type === 'txt' || state.currentBook.type === 'md')) {
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
        state.epub.rendition.prev().catch(err => console.warn('Key prev:', err));
      } else if (e.key === 'ArrowRight') {
        state.epub.rendition.next().catch(err => console.warn('Key next:', err));
      }
    }
  });

  // 2단 형광펜 및 선택 도구 메뉴 이벤트 바인딩
  if (elements.selectionMenuBar) {
    elements.selectionMenuBar.addEventListener('mousedown', (e) => {
      // 메뉴 클릭 시 본문 텍스트 선택(Range)이 브라우저 기본 동작으로 해제되지 않도록 방지
      e.preventDefault();
    });
  }

  // 원문 텍스트 수정 버튼 클릭
  const btnEditWord = elements.btnMenuEditWord || elements.btnMenuHighlight;
  if (btnEditWord) {
    btnEditWord.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.activeSelection || !state.activeSelection.text) {
        showToast('먼저 수정할 텍스트를 선택해주세요.');
        return;
      }
      openWordEditModal();
    });
  }

  // 단어 수정 모달 이벤트 바인딩
  if (elements.btnCancelWordEdit) {
    elements.btnCancelWordEdit.addEventListener('click', () => {
      closeWordEditModal();
    });
  }

  if (elements.btnCloseWordModal) {
    elements.btnCloseWordModal.addEventListener('click', () => {
      closeWordEditModal();
    });
  }

  if (elements.btnSaveWordEdit) {
    elements.btnSaveWordEdit.addEventListener('click', () => {
      executeWordEdit();
    });
  }

  if (elements.wordEditInput) {
    elements.wordEditInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeWordEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeWordEditModal();
      }
    });
  }

  if (elements.wordEditModal) {
    elements.wordEditModal.addEventListener('click', (e) => {
      if (e.target === elements.wordEditModal) {
        closeWordEditModal();
      }
    });
  }

  // 형광펜 색상 팔레트 dot 클릭
  document.querySelectorAll('#selection-menu-bar .color-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      const color = dot.dataset.color || 'yellow';
      setActiveHighlightColor(color);
      if (!state.activeSelection || !state.activeSelection.text) {
        showToast('먼저 텍스트를 선택해주세요.');
        return;
      }
      applyHighlight(color);
    });
  });

  // AI 분석 버튼 클릭
  if (elements.btnMenuAi) {
    elements.btnMenuAi.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.activeSelection || !state.activeSelection.text) {
        showToast('먼저 텍스트를 선택해주세요.');
        return;
      }
      triggerGoogleAISearch(state.activeSelection);
    });
  }

  // 복사 버튼 클릭
  if (elements.btnMenuCopy) {
    elements.btnMenuCopy.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.activeSelection || !state.activeSelection.text) {
        showToast('먼저 텍스트를 선택해주세요.');
        return;
      }
      const rawText = state.activeSelection.text;
      navigator.clipboard.writeText(rawText).catch(() => {});

      const shouldAutoSearch = state.settings.copySearchHighlights !== false;

      if (shouldAutoSearch) {
        // Sanitize search keyword: trim spaces and strip leading/trailing non-word punctuation
        const cleanedText = rawText.trim().replace(/^[^\w가-힣]+|[^\w가-힣]+$/g, '');
        const searchTerm = cleanedText || rawText.trim();

        showToast('텍스트를 복사하고 형광펜 목록을 검색합니다.');

        state.highlightSearchQuery = searchTerm;
        openDrawer('highlights', true);

        if (elements.inputHighlightSearch) {
          elements.inputHighlightSearch.value = searchTerm;
          setTimeout(() => {
            if (elements.inputHighlightSearch) {
              elements.inputHighlightSearch.focus();
              elements.inputHighlightSearch.select();
            }
          }, 60);
        }
        if (elements.btnClearHighlightSearch) {
          elements.btnClearHighlightSearch.style.display = searchTerm ? 'flex' : 'none';
        }
      } else {
        showToast('텍스트가 클립보드에 복사되었습니다.');
        closeAllToolbars();
      }
    });
  }

  // Highlight Popover Toolbar Color Dots
  document.querySelectorAll('#highlight-toolbar .color-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.activeHighlight) {
        changeHighlightColor(state.activeHighlight.id, dot.dataset.color);
      }
    });
  });

  // Highlight Popover Toolbar Buttons
  elements.btnHlAi.addEventListener('click', () => {
    if (state.activeHighlight) {
      triggerGoogleAISearch(state.activeHighlight);
    }
  });

  if (elements.btnHlEdit) {
    elements.btnHlEdit.addEventListener('click', () => {
      if (state.activeHighlight) {
        const hl = state.activeHighlight;
        closeAllToolbars();
        openVocabEditModal(hl);
      }
    });
  }

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
        openGoogleAISearch(promptText);
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

  // ── Gemini API Key Settings Listeners ──
  if (elements.inputGeminiApiKey) {
    elements.inputGeminiApiKey.addEventListener('input', () => {
      const val = elements.inputGeminiApiKey.value.trim();
      const savedKey = (localStorage.getItem('gemini_api_key') || '').trim();
      // 저장된 검증 키와 입력값이 정확히 일치할 때만 등록됨 표시, 새 입력/수정 시 미등록 표시
      if (!savedKey || val !== savedKey) {
        updateApiStatusBadge(false);
      } else {
        updateApiStatusBadge(true);
      }
    });
  }

  if (elements.btnSaveApiKey) {
    elements.btnSaveApiKey.addEventListener('click', async () => {
      const val = elements.inputGeminiApiKey ? elements.inputGeminiApiKey.value.trim() : '';
      if (!val) {
        showToast('저장할 API 키를 입력해주세요.');
        return;
      }

      // 저장 시 백그라운드로 자동 연결 테스트 수행
      try {
        elements.btnSaveApiKey.disabled = true;
        showToast('Gemini API 연결 확인 중...');
        const testResult = await testGeminiApiKey(val);

        // 연결 테스트가 성공했을 때만 공식 저장 및 '등록됨'으로 갱신!
        state.settings.geminiApiKey = val;
        localStorage.setItem('gemini_api_key', val);
        saveSettings();
        updateApiStatusBadge(true);
        showToast(`✅ 저장 및 연결 성공! (${testResult.model} 모델)`);
      } catch (err) {
        // 실패 시 등록됨으로 바꾸지 않고 오류 안내
        updateApiStatusBadge(false);
        showToast(`❌ 연결 실패: ${err.message}`, 6000);
      } finally {
        elements.btnSaveApiKey.disabled = false;
      }
    });
  }

  if (elements.btnDeleteApiKey) {
    elements.btnDeleteApiKey.addEventListener('click', () => {
      const currentKey = (state.settings?.geminiApiKey || localStorage.getItem('gemini_api_key') || (elements.inputGeminiApiKey ? elements.inputGeminiApiKey.value : '')).trim();
      if (!currentKey) {
        showToast('삭제할 저장된 API 키가 없습니다.');
        return;
      }
      if (!confirm('저장된 Gemini API 키를 삭제하시겠습니까?')) {
        return;
      }
      if (elements.inputGeminiApiKey) {
        elements.inputGeminiApiKey.value = '';
      }
      state.settings.geminiApiKey = '';
      localStorage.removeItem('gemini_api_key');
      saveSettings();
      updateApiStatusBadge(false);
      showToast('🗑️ API 키가 삭제되었습니다.');
    });
  }

  if (elements.btnToggleAiActive) {
    elements.btnToggleAiActive.addEventListener('click', () => {
      const current = state.settings.aiAutoAnalysis !== false;
      state.settings.aiAutoAnalysis = !current;
      saveSettings();
      updateAiToggleUI();
      if (state.settings.aiAutoAnalysis) {
        showToast('⚡ API가 켜졌습니다. 형광펜 시 AI가 작동합니다.');
      } else {
        showToast('⏸️ API가 꺼졌습니다. 형광펜만 조용히 칠해집니다.');
      }
    });

    const apiToggleWrap = document.getElementById('api-toggle-wrap');
    if (apiToggleWrap) {
      apiToggleWrap.addEventListener('click', (e) => {
        if (e.target !== elements.btnToggleAiActive && !elements.btnToggleAiActive.contains(e.target)) {
          elements.btnToggleAiActive.click();
        }
      });
    }
  }

  if (elements.btnToggleApiMask) {
    elements.btnToggleApiMask.addEventListener('click', () => {
      if (!elements.inputGeminiApiKey) return;
      const isPass = elements.inputGeminiApiKey.type === 'password';
      elements.inputGeminiApiKey.type = isPass ? 'text' : 'password';
      elements.btnToggleApiMask.textContent = isPass ? '🙈' : '👁️';
    });
  }

  if (elements.btnOpenApiGuide) {
    elements.btnOpenApiGuide.addEventListener('click', openApiGuideModal);
  }
  if (elements.btnCloseApiGuide) {
    elements.btnCloseApiGuide.addEventListener('click', closeApiGuideModal);
  }
  if (elements.btnGuideConfirm) {
    elements.btnGuideConfirm.addEventListener('click', closeApiGuideModal);
  }
  if (elements.apiGuideModalBackdrop) {
    elements.apiGuideModalBackdrop.addEventListener('click', (e) => {
      if (e.target === elements.apiGuideModalBackdrop) closeApiGuideModal();
    });
  }

  // ── Vocab Drawer Actions ──
  if (elements.btnExportVocab) {
    elements.btnExportVocab.addEventListener('click', exportVocabToCsv);
  }
  if (elements.btnBatchVocab) {
    elements.btnBatchVocab.addEventListener('click', batchGenerateVocab);
  }

  // ── Quiz Modal Listeners ──
  if (elements.btnOpenQuiz) {
    elements.btnOpenQuiz.addEventListener('click', openQuizModal);
  }
  if (elements.btnCloseQuizModal) {
    elements.btnCloseQuizModal.addEventListener('click', closeQuizModal);
  }
  if (elements.quizModalBackdrop) {
    elements.quizModalBackdrop.addEventListener('click', (e) => {
      if (e.target === elements.quizModalBackdrop) closeQuizModal();
    });
  }

  document.querySelectorAll('.quiz-criteria-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      initQuizSession(e.currentTarget.dataset.criteria);
    });
  });

  if (elements.btnQuizReveal) {
    elements.btnQuizReveal.addEventListener('click', revealQuizAnswer);
  }
  if (elements.quizFlashcard) {
    elements.quizFlashcard.addEventListener('click', () => {
      if (elements.quizActionsUnrevealed && elements.quizActionsUnrevealed.style.display !== 'none') {
        revealQuizAnswer();
      }
    });
  }
  if (elements.btnQuizWrong) {
    elements.btnQuizWrong.addEventListener('click', () => recordQuizAnswer(false));
  }
  if (elements.btnQuizCorrect) {
    elements.btnQuizCorrect.addEventListener('click', () => recordQuizAnswer(true));
  }
  if (elements.btnQuizRetryWrong) {
    elements.btnQuizRetryWrong.addEventListener('click', () => initQuizSession('wrong-only'));
  }
  if (elements.btnQuizRestart) {
    elements.btnQuizRestart.addEventListener('click', () => initQuizSession(currentCriteria));
  }
  if (elements.btnQuizFinish) {
    elements.btnQuizFinish.addEventListener('click', closeQuizModal);
  }
  if (elements.btnQuizGoBatch) {
    elements.btnQuizGoBatch.addEventListener('click', () => {
      closeQuizModal();
      openDrawer('highlights');
      batchGenerateVocab();
    });
  }

  // Vocab Edit Modal Listeners
  if (elements.btnCloseVocabEdit) {
    elements.btnCloseVocabEdit.addEventListener('click', closeVocabEditModal);
  }
  if (elements.btnCancelVocabEdit) {
    elements.btnCancelVocabEdit.addEventListener('click', closeVocabEditModal);
  }
  if (elements.btnSaveVocabEdit) {
    elements.btnSaveVocabEdit.addEventListener('click', saveVocabEdit);
  }
  if (elements.vocabEditModalBackdrop) {
    elements.vocabEditModalBackdrop.addEventListener('click', (e) => {
      if (e.target === elements.vocabEditModalBackdrop) {
        closeVocabEditModal();
      }
    });
  }

  // Vocab Edit Modal Color Buttons
  document.querySelectorAll('#vocab-edit-colors .color-dot-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentEditingColor = btn.dataset.color;
      document.querySelectorAll('#vocab-edit-colors .color-dot-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
      });
    });
  });

  // Keyboard Shortcuts (Quiz & Vocab Modal)
  document.addEventListener('keydown', (e) => {
    // Word Edit Modal shortcuts
    if (elements.wordEditModal && elements.wordEditModal.classList.contains('open')) {
      if (e.key === 'Escape') {
        closeWordEditModal();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        executeWordEdit();
        return;
      }
    }

    // Vocab Edit Modal shortcuts
    if (elements.vocabEditModalBackdrop && elements.vocabEditModalBackdrop.classList.contains('open')) {
      if (e.key === 'Escape') {
        closeVocabEditModal();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        saveVocabEdit();
        return;
      }
    }

    if (!elements.quizModalBackdrop || !elements.quizModalBackdrop.classList.contains('open')) return;
    if (e.key === 'Escape') {
      closeQuizModal();
    } else if (e.key === ' ' || e.code === 'Space') {
      if (elements.quizActionsUnrevealed && elements.quizActionsUnrevealed.style.display !== 'none') {
        e.preventDefault();
        revealQuizAnswer();
      }
    } else if (e.key === '1' || e.key === 'w' || e.key === 'W') {
      if (elements.quizActionsRevealed && elements.quizActionsRevealed.style.display !== 'none') {
        e.preventDefault();
        recordQuizAnswer(false);
      }
    } else if (e.key === '2' || e.key === 'c' || e.key === 'C') {
      if (elements.quizActionsRevealed && elements.quizActionsRevealed.style.display !== 'none') {
        e.preventDefault();
        recordQuizAnswer(true);
      }
    }
  });

  // 윈도우 리사이즈, 오리엔테이션 회전, 화면 복귀 시 뷰어 영역 안전 재계산 및 독서 위치(CFI/스크롤) 100% 보존
  const onViewerResize = () => {
    if (state.currentBook) {
      if (state.currentBook.type === 'epub') {
        triggerEpubResizeSafe();
      } else if (state.currentBook.type === 'txt' || state.currentBook.type === 'md') {
        triggerTxtResizeSafe();
      }
    }
  };

  window.addEventListener('resize', onViewerResize);

  // iPadOS 기기 회전(세로 ↔ 가로) 시 독서 위치(57%) 100% 보존 특화 핸들러
  window.addEventListener('orientationchange', () => {
    if (state.currentBook) {
      if (state.currentBook.type === 'epub') {
        const targetCfi = state.epub.currentCfi
          || (state.epub.rendition && state.epub.rendition.currentLocation()?.start?.cfi)
          || localStorage.getItem(`reader_pos_${state.currentBook.id}`);
        triggerEpubResizeSafe(targetCfi);
        // iPadOS 회전 애니메이션(약 300ms) 완료 직후 최종 뷰포트 크기로 안착
        setTimeout(() => {
          triggerEpubResizeSafe(targetCfi);
        }, 350);
      } else if (state.currentBook.type === 'txt' || state.currentBook.type === 'md') {
        triggerTxtResizeSafe();
        setTimeout(triggerTxtResizeSafe, 350);
      }
    }
  });

  window.addEventListener('pageshow', onViewerResize);
  window.addEventListener('load', onViewerResize);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(onViewerResize).catch(() => {});
  }

  // 탭 전환 / 다른 앱 전환 / 페이지 종료 시 현재 위치(CFI 또는 스크롤) 즉시 보존 및 복귀 시 리사이즈 동기화
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state.currentBook) {
      saveCurrentReadingPosition();
    } else if (document.visibilityState === 'visible' && state.currentBook) {
      setTimeout(onViewerResize, 100);
    }
  });

  window.addEventListener('pagehide', () => {
    if (state.currentBook) {
      saveCurrentReadingPosition();
    }
  });

  window.addEventListener('beforeunload', () => {
    if (state.currentBook) {
      saveCurrentReadingPosition();
    }
  });

  // Bookmarks Listeners
  if (elements.btnAddCurrentBookmark) {
    elements.btnAddCurrentBookmark.addEventListener('click', () => openBookmarkModal());
  }

  if (elements.btnBottomBookmark) {
    elements.btnBottomBookmark.addEventListener('click', () => openBookmarkModal());
  }

  if (elements.btnSortBookmarks) {
    elements.btnSortBookmarks.addEventListener('click', () => {
      state.bookmarkSortMode = state.bookmarkSortMode === 'latest' ? 'position' : 'latest';
      updateBookmarkSortBtnText();
      renderBookmarkDrawer();
    });
  }

  if (elements.btnCancelBookmark) {
    elements.btnCancelBookmark.addEventListener('click', closeBookmarkModal);
  }

  if (elements.btnSaveBookmark) {
    elements.btnSaveBookmark.addEventListener('click', saveBookmarkModal);
  }

  if (elements.inputBookmarkTitle) {
    elements.inputBookmarkTitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveBookmarkModal();
      } else if (e.key === 'Escape') {
        closeBookmarkModal();
      }
    });
  }

  if (elements.bookmarkQuickChips) {
    elements.bookmarkQuickChips.querySelectorAll('.bookmark-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.dataset.text;
        if (elements.inputBookmarkTitle && text) {
          elements.inputBookmarkTitle.value = text;
          elements.inputBookmarkTitle.focus();
        }
      });
    });
  }

  if (elements.bookmarkModal) {
    elements.bookmarkModal.addEventListener('click', (e) => {
      if (e.target === elements.bookmarkModal) {
        closeBookmarkModal();
      }
    });
  }
}

function saveCurrentReadingPosition() {
  if (!state.currentBook) return;
  if (state.currentBook.type === 'epub' && state.epub.rendition) {
    try {
      const loc = state.epub.rendition.currentLocation();
      const cfi = (!state.epub.isResizing && loc && loc.start && loc.start.cfi)
        ? loc.start.cfi
        : (state.epub.pendingRestoreCfi || state.epub.currentCfi);
      if (cfi) {
        state.epub.currentCfi = cfi;
        localStorage.setItem(`reader_pos_${state.currentBook.id}`, cfi);
        localStorage.setItem('reader_last_book_id', state.currentBook.id);
        updateActiveBookLastPosition(cfi);
      }
    } catch (e) {}
  } else if ((state.currentBook.type === 'txt' || state.currentBook.type === 'md') && elements.txtViewer) {
    const scrollTop = elements.txtViewer.scrollTop;
    const scrollHeight = elements.txtViewer.scrollHeight - elements.txtViewer.clientHeight;
    if (scrollHeight > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((scrollTop / scrollHeight) * 100)));
      localStorage.setItem(`reader_pos_${state.currentBook.id}`, pct);
      localStorage.setItem('reader_last_book_id', state.currentBook.id);
      updateActiveBookLastPosition(pct);
    }
  }
}

// ── 기존에 읽던 도서 복원 ──
async function restoreActiveBook() {
  try {
    const record = await loadActiveBookFromStorage();
    if (!record || !record.content) return;

    const savedPos = (record.lastPosition !== undefined && record.lastPosition !== null && record.lastPosition !== '')
      ? record.lastPosition
      : localStorage.getItem(`reader_pos_${record.bookId}`);

    if (record.type === 'epub') {
      openEpubBook(record.title, record.author, record.content, record.bookId, true, record.highlights, savedPos, record.bookmarks);
    } else if (record.type === 'txt') {
      openTxtBook(record.title, record.author, record.content, record.bookId, true, record.highlights, savedPos, record.bookmarks);
    } else if (record.type === 'md' || record.type === 'markdown') {
      openMdBook(record.title, record.author, record.content, record.bookId, true, record.highlights, savedPos, record.bookmarks);
    }
  } catch (err) {
    console.warn('Failed to restore active book from IndexedDB:', err);
  }
}

// ── Initialization ──
window.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  setupEventListeners();
  await showReaderFileList();
});
