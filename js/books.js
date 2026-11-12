/* ══════════════════════════════════════════════════════
   books.js — 독서 기록 앱 (Reading Log)
   Supabase DB 연동, JSON 백업/복원, 국립중앙도서관 & 해외 무료 도서검색 API,
   읽을 책/읽은 책 관리, 상하 순서 이동, 표지/제목 보기,
   다중 기준 정렬, 목차·문장 수집(페이지 포함)·독서 메모·별점 관리
   ══════════════════════════════════════════════════════ */

// 1. Supabase 클라이언트 초기화 (사이트 공통 프로젝트 연동)
const supabaseUrl = 'https://tpwwwpcbinxdhxqvcvqc.supabase.co';
const supabaseKey = 'sb_publishable_A1sd3hvbeQx9-gVoFXL0qA_G923SWm9';
const supabaseClient = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

const TABLE_NAME = 'reading_books';
const LOCAL_STORAGE_KEY = 'reading_books_local_v1';
const API_KEYS_STORAGE_KEY = 'reading_books_api_keys_v2';

// 2. 애플리케이션 상태
let books = [];
let currentStatusTab = 'to_read'; // 'to_read' | 'read' | 'all'
let currentViewMode = localStorage.getItem('reading_books_view_mode') || 'cover'; // 'cover' | 'title'
let currentSortField = 'sort_order'; // 'sort_order' | 'title' | 'author' | 'publisher' | 'pub_date' | 'completed_date'
let currentSortAsc = true;
let selectedBookIds = new Set();
let activeDetailBookId = null;
let isLoggedIn = false;
let supabaseTableReady = true;
let isSeedingToSupabase = false;
let hasInitializedTab = false;
let lastRenderedIds = []; // 동적 정렬 시 기존 DOM 노드 재정렬 판별용
let apiSearchCandidates = []; // 최근 도서 검색 결과 목록

// HTML 이스케이프 헬퍼
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// HTML 태그 제거 헬퍼 (국립중앙도서관 검색 결과의 <span class="searching_txt"> 등 제거)
function stripHtmlTags(str) {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// 도서검색 API 목차(TOC) HTML/텍스트 정규화 헬퍼
function formatTocText(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 검색어 정규식 이스케이프 및 하이라이트 헬퍼
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatch(text, query) {
  if (!text) return '';
  const safeText = escapeHtml(text);
  if (!query || !query.trim()) return safeText;
  const pattern = new RegExp(`(${escapeRegExp(escapeHtml(query.trim()))})`, 'gi');
  return safeText.replace(pattern, '<mark class="search-hl">$1</mark>');
}

// 오늘 날짜 YYYY-MM-DD 반환
function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 데이터 정규화 헬퍼 (목차 toc는 DB의 memos JSONB 컬럼에 호환 저장하여 별도 ALTER TABLE 없이 즉시 연동)
function normalizeBookRow(row, fallbackIndex = 0) {
  let quotes = [];
  if (Array.isArray(row.quotes)) {
    quotes = row.quotes;
  } else if (typeof row.quotes === 'string' && row.quotes.trim()) {
    try { quotes = JSON.parse(row.quotes); } catch (_) { quotes = []; }
  }

  let rawMemos = [];
  if (Array.isArray(row.memos)) {
    rawMemos = row.memos;
  } else if (typeof row.memos === 'string' && row.memos.trim()) {
    try { rawMemos = JSON.parse(row.memos); } catch (_) { rawMemos = []; }
  }

  // toc(목차) 추출: row.toc가 있으면 우선 사용하고, 없으면 memos JSONB 안의 { type: 'toc', content }에서 추출
  let toc = typeof row.toc === 'string' ? row.toc.trim() : '';
  if (!toc && Array.isArray(rawMemos)) {
    const tocEntry = rawMemos.find(m => m && m.type === 'toc' && typeof m.content === 'string');
    if (tocEntry) toc = tocEntry.content.trim();
  }

  return {
    id: row.id ?? Date.now() + fallbackIndex,
    status: row.status === 'read' ? 'read' : 'to_read',
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : fallbackIndex,
    title: (row.title || '').trim(),
    author: (row.author || '').trim(),
    publisher: (row.publisher || '').trim(),
    pub_date: (row.pub_date || '').trim(),
    cover_url: (row.cover_url || '').trim(),
    completed_date: (row.completed_date || '').trim(),
    rating: Math.min(5, Math.max(0, parseFloat(row.rating) || 0)),
    toc,
    quotes: quotes.map((q, idx) => ({
      id: q.id || `q_${Date.now()}_${idx}`,
      page: q.page !== undefined && q.page !== null ? String(q.page).trim() : '',
      text: (q.text || '').trim(),
      note: (q.note || '').trim(),
      created_at: q.created_at || new Date().toISOString()
    })),
    memo: (row.memo || '').trim(),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString()
  };
}

// 로컬 스토리지 저장 및 로드
function saveBooksToLocalCache() {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(books));
  } catch (err) {
    console.warn('[Books] Failed to save local cache:', err);
  }
}

function loadBooksFromLocalCache() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((r, i) => normalizeBookRow(r, i));
    }
  } catch (err) {
    console.warn('[Books] Failed to parse local cache:', err);
  }
  return null;
}

// API 키 설정 로드/저장 (국립중앙도서관 Open API 인증키 & Google Books API 키)
function getSavedApiKeys() {
  try {
    const raw = localStorage.getItem(API_KEYS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { nlkKey: '', googleKey: '' };
}

function saveApiKeys(keys) {
  localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
  updateInlineNlkKeyBarVisibility();
}

function updateInlineNlkKeyBarVisibility() {
  const bar = document.getElementById('inlineNlkKeyBar');
  if (!bar) return;
  const { nlkKey } = getSavedApiKeys();
  bar.style.display = nlkKey && nlkKey.trim() ? 'none' : 'flex';
}

// ══════════════════════════════════════════════════════
// 3. Modern Web Guidance: Dialog Light-Dismiss Fallback & DOM Reorder
// ══════════════════════════════════════════════════════
function setupDialogLightDismissFallbacks() {
  const dialogs = document.querySelectorAll('dialog[closedby="any"]');
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialogs.forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        if (isDialogContent) return;
        dialog.close();
      });
    });
  }

  document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close-dialog');
      const dlg = document.getElementById(targetId);
      if (dlg && dlg.open) dlg.close();
    });
  });
}

function reorderDomNodes(container, orderedNodes) {
  const move = Object.hasOwn(Element.prototype, 'moveBefore')
    ? (node) => container.moveBefore(node, null)
    : (node) => container.append(node);

  for (const node of orderedNodes) {
    move(node);
  }
}

function reorderWithTransition(container, orderedNodes, statusMessage) {
  const update = () => reorderDomNodes(container, orderedNodes);

  if (orderedNodes.length <= 200) {
    if (container.startViewTransition) {
      container.startViewTransition(update);
    } else if (document.startViewTransition) {
      document.startViewTransition(update);
    } else {
      update();
    }
  } else {
    update();
  }

  if (statusMessage) {
    const statusEl = document.getElementById('reorderStatus');
    if (statusEl) statusEl.textContent = statusMessage;
  }
}

// ══════════════════════════════════════════════════════
// 4. 초기화 및 이벤트 바인딩
// ══════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  setupDialogLightDismissFallbacks();
  bindAuthEvents();
  bindMainToolbarEvents();
  bindSearchModalEvents();
  bindEditModalEvents();
  bindDetailModalEvents();
  bindSettingsModalEvents();

  updateViewToggleUI();
  updateInlineNlkKeyBarVisibility();
  loadAllBooks();
});

function bindAuthEvents() {
  const authStatusText = document.getElementById('authStatusText');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const loginDialog = document.getElementById('loginDialog');
  const loginForm = document.getElementById('loginForm');

  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      isLoggedIn = !!user;

      if (user) {
        const adminNick = user.email.split('@')[0];
        if (authStatusText) authStatusText.innerHTML = `🟢 ${escapeHtml(adminNick)}`;
        if (btnLogin) btnLogin.style.display = 'none';
        if (btnLogout) btnLogout.style.display = 'inline-flex';
        seedBackupBooksToSupabaseIfEmpty();
      } else {
        if (authStatusText) authStatusText.innerHTML = '';
        if (btnLogin) btnLogin.style.display = 'inline-flex';
        if (btnLogout) btnLogout.style.display = 'none';
      }
    });
  }

  if (btnLogin && loginDialog) {
    btnLogin.addEventListener('click', () => loginDialog.showModal());
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!supabaseClient) return;
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const submitBtn = document.getElementById('btnSubmitLogin');

      submitBtn.disabled = true;
      submitBtn.textContent = '로그인 중...';

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

      submitBtn.disabled = false;
      submitBtn.textContent = '로그인';

      if (error) {
        alert('로그인 실패: ' + error.message);
      } else {
        loginForm.reset();
        loginDialog.close();
        loadAllBooks();
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (!supabaseClient) return;
      const { error } = await supabaseClient.auth.signOut();
      if (error) alert('로그아웃 실패: ' + error.message);
    });
  }
}

// ══════════════════════════════════════════════════════
// 5. Supabase 데이터 로드 및 CRUD 동기화
// ══════════════════════════════════════════════════════
async function fetchBackupJsonBooks() {
  try {
    const res = await fetch('data/backup-reading_books.json?t=' + Date.now());
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        return json.map((r, i) => normalizeBookRow(r, i));
      }
    }
  } catch (e) {
    console.warn('[Books] Fallback JSON load skipped:', e);
  }
  return [];
}

function serializeBookForSupabase(b, fallbackOrder = 0) {
  return {
    status: b.status || 'read',
    sort_order: b.sort_order ?? fallbackOrder,
    title: (b.title || '').trim(),
    author: (b.author || '').trim(),
    publisher: (b.publisher || '').trim(),
    pub_date: (b.pub_date || '').trim(),
    pages: 0,
    isbn: '',
    cover_url: (b.cover_url || '').trim(),
    completed_date: (b.completed_date || '').trim(),
    rating: Math.min(5, Math.max(0, parseFloat(b.rating) || 0)),
    quotes: Array.isArray(b.quotes) ? b.quotes : [],
    memo: (b.memo || '').trim(),
    // 목차(toc)를 기존 memos JSONB 컬럼에 호환 저장
    memos: b.toc && b.toc.trim() ? [{ type: 'toc', content: b.toc.trim() }] : [],
    updated_at: new Date().toISOString()
  };
}

// Supabase reading_books 테이블이 비어 있을 때 로그인 상태이면 백업 데이터를 DB에 자동 이관
async function seedBackupBooksToSupabaseIfEmpty() {
  if (!supabaseClient || !supabaseTableReady || !isLoggedIn || isSeedingToSupabase) return;
  try {
    isSeedingToSupabase = true;
    const { count, error: countErr } = await supabaseClient
      .from(TABLE_NAME)
      .select('id', { count: 'exact', head: true });

    if (countErr || (count !== null && count > 0)) {
      isSeedingToSupabase = false;
      return;
    }

    const seedSource = books.length > 0 ? books : await fetchBackupJsonBooks();
    if (seedSource.length === 0) {
      isSeedingToSupabase = false;
      return;
    }

    const cleanRows = seedSource.map((b, idx) => serializeBookForSupabase(b, idx + 1));

    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .insert(cleanRows)
      .select();

    if (!error && Array.isArray(data) && data.length > 0) {
      books = data.map((r, i) => normalizeBookRow(r, i));
      saveBooksToLocalCache();
      renderBooksView(false);
      console.log(`[Books] Automatically migrated ${data.length} books to Supabase reading_books table.`);
    }
  } catch (err) {
    console.warn('[Books] Auto-seed warning:', err);
  } finally {
    isSeedingToSupabase = false;
  }
}

async function loadAllBooks() {
  const loadingEl = document.getElementById('booksLoading');
  if (loadingEl) loadingEl.style.display = 'flex';

  let loadedFromSupabase = false;

  if (supabaseClient) {
    try {
      let allRows = [];
      let page = 0;
      const pageSize = 1000;
      let keepFetching = true;

      while (keepFetching) {
        const { data, error } = await supabaseClient
          .from(TABLE_NAME)
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true });

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          allRows = allRows.concat(data);
          if (data.length < pageSize) {
            keepFetching = false;
          } else {
            page++;
          }
        } else {
          keepFetching = false;
        }
      }

      supabaseTableReady = true;

      if (allRows.length > 0) {
        loadedFromSupabase = true;
        books = allRows.map((r, i) => normalizeBookRow(r, i));
        saveBooksToLocalCache();
      } else {
        const backupBooks = await fetchBackupJsonBooks();
        const localCached = loadBooksFromLocalCache();
        if (backupBooks.length > 0) {
          books = backupBooks;
          saveBooksToLocalCache();
          loadedFromSupabase = true;
          await seedBackupBooksToSupabaseIfEmpty();
        } else if (localCached && localCached.length > 0) {
          books = localCached;
          loadedFromSupabase = true;
          await seedBackupBooksToSupabaseIfEmpty();
        }
      }
    } catch (err) {
      console.warn('[Books] Supabase table fetch warning:', err.message || err);
      supabaseTableReady = false;
    }
  }

  if (!loadedFromSupabase) {
    const backupBooks = await fetchBackupJsonBooks();
    const localCached = loadBooksFromLocalCache();
    if (localCached && localCached.length >= backupBooks.length && localCached.length > 0) {
      books = localCached;
    } else if (backupBooks.length > 0) {
      books = backupBooks;
      saveBooksToLocalCache();
    }
  }

  // 백업 데이터에 포함된 목차(toc)가 기존 로컬/DB 도서에 비어 있는 경우 자동 보완
  try {
    const backupBooksForToc = await fetchBackupJsonBooks();
    if (backupBooksForToc.length > 0 && books.length > 0) {
      const tocByTitle = new Map();
      for (const bb of backupBooksForToc) {
        if (bb.title && bb.toc) {
          tocByTitle.set(bb.title.trim().toLowerCase(), bb.toc);
        }
      }
      let backfilled = false;
      for (const b of books) {
        if (!b.toc && b.title) {
          const matchedToc = tocByTitle.get(b.title.trim().toLowerCase());
          if (matchedToc) {
            b.toc = matchedToc;
            backfilled = true;
            if (supabaseClient && supabaseTableReady && isLoggedIn) {
              supabaseClient
                .from(TABLE_NAME)
                .update({ memos: [{ type: 'toc', content: matchedToc }] })
                .eq('id', b.id)
                .then(() => {});
            }
          }
        }
      }
      if (backfilled) {
        saveBooksToLocalCache();
      }
    }
  } catch (_) {}

  // 최초 로드 시 '읽을 책'이 0권이고 '읽은 책'에 도서가 있으면 '읽은 책' 탭을 기본 활성화
  if (!hasInitializedTab && books.length > 0) {
    hasInitializedTab = true;
    const toReadCnt = books.filter(b => b.status === 'to_read').length;
    const readCnt = books.filter(b => b.status === 'read').length;
    if (toReadCnt === 0 && readCnt > 0) {
      currentStatusTab = 'read';
      document.querySelectorAll('.status-tab').forEach(t => {
        const match = t.getAttribute('data-status') === 'read';
        t.classList.toggle('active', match);
        t.setAttribute('aria-selected', String(match));
      });
    }
  }

  if (loadingEl) loadingEl.style.display = 'none';
  renderBooksView(false);
}

// 단일 도서 DB 추가 (INSERT)
async function insertBookToDb(bookObj) {
  const sameStatusBooks = books.filter(b => b.status === bookObj.status);
  const minOrder = sameStatusBooks.length > 0
    ? Math.min(...sameStatusBooks.map(b => b.sort_order || 0))
    : 1;

  const normalized = normalizeBookRow({
    ...bookObj,
    status: bookObj.status || 'to_read',
    sort_order: bookObj.sort_order !== undefined ? bookObj.sort_order : (minOrder - 1),
    completed_date: bookObj.status === 'read'
      ? (bookObj.completed_date || getTodayDateString())
      : (bookObj.completed_date || '')
  });

  const payload = serializeBookForSupabase(normalized, normalized.sort_order);

  if (supabaseClient && supabaseTableReady) {
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .insert([payload])
      .select();

    if (!error && data && data.length > 0) {
      const created = normalizeBookRow(data[0], 0);
      books.unshift(created);
      saveBooksToLocalCache();
      return created;
    } else if (error) {
      console.warn('[Books] Supabase insert error, saving to local cache:', error.message);
      if (!isLoggedIn) {
        alert('안내: 현재 관리자 로그인이 되어 있지 않아 브라우저 로컬 저장소에 저장되었습니다. (Supabase 클라우드 반영은 상단 로그인 후 가능합니다)');
      }
    }
  }

  const localCreated = normalizeBookRow({
    ...normalized,
    id: Date.now() + Math.floor(Math.random() * 1000),
    created_at: new Date().toISOString()
  });
  books.unshift(localCreated);
  saveBooksToLocalCache();
  return localCreated;
}

// 단일 도서 DB 수정 (UPDATE)
async function updateBookInDb(bookId, updates) {
  const idx = books.findIndex(b => String(b.id) === String(bookId));
  if (idx === -1) return null;

  const updatedBook = normalizeBookRow({
    ...books[idx],
    ...updates,
    updated_at: new Date().toISOString()
  }, idx);

  books[idx] = updatedBook;
  saveBooksToLocalCache();

  if (supabaseClient && supabaseTableReady) {
    const dbPayload = serializeBookForSupabase(updatedBook, updatedBook.sort_order);

    const { error } = await supabaseClient
      .from(TABLE_NAME)
      .update(dbPayload)
      .eq('id', bookId);

    if (error) {
      console.warn('[Books] Supabase update warning (saved locally):', error.message);
    }
  }

  return updatedBook;
}

// 도서 삭제 (DELETE - 단건 및 다건 지원)
async function deleteBooksFromDb(idArray) {
  const idSet = new Set(idArray.map(id => String(id)));
  books = books.filter(b => !idSet.has(String(b.id)));
  idArray.forEach(id => selectedBookIds.delete(String(id)));
  saveBooksToLocalCache();

  if (supabaseClient && supabaseTableReady) {
    const { error } = await supabaseClient
      .from(TABLE_NAME)
      .delete()
      .in('id', idArray);

    if (error) {
      console.warn('[Books] Supabase delete warning:', error.message);
    }
  }
}

// ══════════════════════════════════════════════════════
// 6. 데이터 백업 (JSON 파일 다운로드 & JSON 복원)
// ══════════════════════════════════════════════════════
async function exportTableToJsonFile() {
  let dataToExport = books;

  if (supabaseClient && supabaseTableReady) {
    try {
      const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select('*')
        .order('id', { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) {
        dataToExport = data.map((r, i) => normalizeBookRow(r, i));
      }
    } catch (_) {}
  }

  const jsonString = JSON.stringify(dataToExport, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const dateStr = getTodayDateString();
  a.href = url;
  a.download = `backup-reading_books-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function importTableFromJsonFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      alert('유효한 도서 백업 JSON 배열 형식이 아닙니다.');
      return;
    }

    const normalizedList = parsed.map((row, i) => normalizeBookRow(row, i));
    if (!confirm(`총 ${normalizedList.length}권의 도서 데이터를 백업 파일에서 불러오시겠습니까?`)) {
      return;
    }

    books = normalizedList;
    saveBooksToLocalCache();

    if (supabaseClient && supabaseTableReady && isLoggedIn && normalizedList.length > 0) {
      const cleanRows = normalizedList.map((b, idx) => serializeBookForSupabase(b, idx + 1));
      const { error } = await supabaseClient.from(TABLE_NAME).insert(cleanRows);
      if (!error) {
        await loadAllBooks();
      }
    }

    renderBooksView(false);
    alert(`총 ${normalizedList.length}권의 데이터를 성공적으로 복원했습니다.`);
  } catch (err) {
    alert('JSON 파일 읽기 오류: ' + err.message);
  }
}

// ══════════════════════════════════════════════════════
// 7. 목록 필터링 (문장 수집 / 독서 메모 검색 포함) & 정렬
// ══════════════════════════════════════════════════════
function matchBookBySearch(book, query, scope) {
  if (!query) {
    return { matched: true, matchedQuotes: [], matchedMemos: [] };
  }

  const qLower = query.toLowerCase();
  let bookInfoMatched = false;
  const matchedQuotes = [];
  const matchedMemos = [];

  // 1) 책 기본 정보 검색 (제목, 저자, 출판사, 목차)
  if (scope === 'all' || scope === 'book') {
    const targetStr = `${book.title} ${book.author} ${book.publisher} ${book.toc || ''}`.toLowerCase();
    if (targetStr.includes(qLower)) {
      bookInfoMatched = true;
    }
  }

  // 2) 문장 수집(quotes) 검색
  if (scope === 'all' || scope === 'notes_quotes' || scope === 'quotes') {
    if (Array.isArray(book.quotes)) {
      for (const qItem of book.quotes) {
        const hay = `${qItem.text || ''} ${qItem.note || ''} ${qItem.page ? 'p.' + qItem.page : ''}`.toLowerCase();
        if (hay.includes(qLower)) {
          matchedQuotes.push(qItem);
        }
      }
    }
  }

  // 3) 독서 메모(memo) 검색
  if (scope === 'all' || scope === 'notes_quotes' || scope === 'memo') {
    if (book.memo && book.memo.toLowerCase().includes(qLower)) {
      matchedMemos.push({ content: book.memo });
    }
  }

  const matched = bookInfoMatched || matchedQuotes.length > 0 || matchedMemos.length > 0;
  return { matched, matchedQuotes, matchedMemos };
}

function compareBooks(a, b, field, asc) {
  const dir = asc ? 1 : -1;

  if (field === 'sort_order') {
    const diff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (diff !== 0) return diff * dir;
    return (b.id - a.id) * dir;
  }

  const valA = String(a[field] || '').trim();
  const valB = String(b[field] || '').trim();

  if (!valA && !valB) return 0;
  if (!valA) return 1;
  if (!valB) return -1;

  const cmp = valA.localeCompare(valB, 'ko', { numeric: true, sensitivity: 'base' });
  if (cmp !== 0) return cmp * dir;
  return a.title.localeCompare(b.title, 'ko');
}

function getFilteredAndSortedBooks() {
  const query = (document.getElementById('listSearchInput')?.value || '').trim();
  const scope = document.getElementById('searchScopeSelect')?.value || 'all';

  const results = [];

  for (const book of books) {
    if (currentStatusTab !== 'all' && book.status !== currentStatusTab) {
      continue;
    }

    const matchResult = matchBookBySearch(book, query, scope);
    if (matchResult.matched) {
      results.push({
        book,
        matchedQuotes: matchResult.matchedQuotes,
        matchedMemos: matchResult.matchedMemos
      });
    }
  }

  results.sort((x, y) => compareBooks(x.book, y.book, currentSortField, currentSortAsc));
  return results;
}

// ══════════════════════════════════════════════════════
// 8. 도서 목록 렌더링 (표지 이미지 보기 / 제목 보기 & 동적 정렬)
// ══════════════════════════════════════════════════════
function updateTabCounts() {
  const toReadCount = books.filter(b => b.status === 'to_read').length;
  const readCount = books.filter(b => b.status === 'read').length;
  const allCount = books.length;

  const elToRead = document.getElementById('countToRead');
  const elRead = document.getElementById('countRead');
  const elAll = document.getElementById('countAll');

  if (elToRead) elToRead.textContent = toReadCount;
  if (elRead) elRead.textContent = readCount;
  if (elAll) elAll.textContent = allCount;
}

function updateSelectionBarUI(visibleBookIds) {
  const countText = document.getElementById('selectionCountText');
  const chkAll = document.getElementById('chkSelectAll');
  const btnEdit = document.getElementById('btnEditSelected');
  const btnMove = document.getElementById('btnMoveSelectedStatus');
  const btnDelete = document.getElementById('btnDeleteSelected');

  const existingIds = new Set(books.map(b => String(b.id)));
  for (const id of Array.from(selectedBookIds)) {
    if (!existingIds.has(id)) selectedBookIds.delete(id);
  }

  const selCount = selectedBookIds.size;
  if (countText) countText.textContent = `${selCount}권 선택됨`;
  if (btnEdit) btnEdit.disabled = selCount !== 1;
  if (btnMove) btnMove.disabled = selCount === 0;
  if (btnDelete) btnDelete.disabled = selCount === 0;

  if (chkAll) {
    chkAll.checked = visibleBookIds.length > 0 && visibleBookIds.every(id => selectedBookIds.has(String(id)));
    chkAll.indeterminate = selCount > 0 && !chkAll.checked;
  }
}

function buildSearchMatchSnippetsHtml(bookId, matchedQuotes, matchedMemos, query) {
  if ((!matchedQuotes || matchedQuotes.length === 0) && (!matchedMemos || matchedMemos.length === 0)) {
    return '';
  }

  const itemsHtml = [];

  for (const q of matchedQuotes.slice(0, 2)) {
    const pageLabel = q.page ? `p.${escapeHtml(q.page)}` : '문장';
    const snippet = q.text.length > 110 ? q.text.slice(0, 110) + '…' : q.text;
    itemsHtml.push(`
      <div class="search-match-item">
        <span class="search-match-tag quote">🔖 문장 (${pageLabel})</span>
        <span>"${highlightMatch(snippet, query)}"</span>
        ${q.note ? `<span style="color: var(--text-muted);"> — ${highlightMatch(q.note, query)}</span>` : ''}
      </div>
    `);
  }

  for (const m of matchedMemos.slice(0, 2)) {
    const snippet = m.content.length > 110 ? m.content.slice(0, 110) + '…' : m.content;
    itemsHtml.push(`
      <div class="search-match-item">
        <span class="search-match-tag memo">📝 독서 메모</span>
        <span>${highlightMatch(snippet, query)}</span>
      </div>
    `);
  }

  return `
    <div class="search-match-snippets" data-open-detail="${escapeHtml(bookId)}" title="클릭하여 상세 페이지의 문장 수집/독서 메모 보기">
      ${itemsHtml.join('')}
    </div>
  `;
}

function renderBooksView(tryReorderOnly = false, statusAnnouncement = '') {
  updateTabCounts();

  const filtered = getFilteredAndSortedBooks();
  const visibleIds = filtered.map(item => String(item.book.id));
  const query = (document.getElementById('listSearchInput')?.value || '').trim();

  const emptyState = document.getElementById('booksEmptyState');
  const emptyTitle = document.getElementById('emptyStateTitle');
  const emptyDesc = document.getElementById('emptyStateDesc');
  const listSection = document.getElementById('booksListSection');
  const coverGrid = document.getElementById('booksCoverGrid');
  const titleList = document.getElementById('booksTitleList');

  updateSelectionBarUI(visibleIds);

  if (filtered.length === 0) {
    if (listSection) listSection.style.display = 'none';
    if (emptyState) {
      emptyState.style.display = 'flex';
      if (query) {
        if (emptyTitle) emptyTitle.textContent = `'${query}' 검색 결과가 없습니다`;
        if (emptyDesc) emptyDesc.textContent = '다른 검색어를 입력하거나 검색 대상(전체/문장수집/독서메모)을 변경해 보세요.';
      } else if (currentStatusTab === 'to_read') {
        if (emptyTitle) emptyTitle.textContent = '읽을 책 목록이 비어 있습니다';
        if (emptyDesc) emptyDesc.innerHTML = '상단의 <strong>＋ 책 검색 / 추가</strong> 버튼을 눌러 읽고 싶은 국내·국외 도서를 담아 보세요.';
      } else if (currentStatusTab === 'read') {
        if (emptyTitle) emptyTitle.textContent = '완독한 책이 아직 없습니다';
        if (emptyDesc) emptyDesc.innerHTML = '읽은 책을 추가하거나 읽을 책 목록에서 <strong>읽은 책으로 이동</strong>해 보세요.';
      } else {
        if (emptyTitle) emptyTitle.textContent = '등록된 책이 없습니다';
      }
    }
    lastRenderedIds = [];
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (listSection) listSection.style.display = 'block';

  const activeContainer = currentViewMode === 'cover' ? coverGrid : titleList;
  const inactiveContainer = currentViewMode === 'cover' ? titleList : coverGrid;

  if (activeContainer) activeContainer.style.display = currentViewMode === 'cover' ? 'grid' : 'flex';
  if (inactiveContainer) inactiveContainer.style.display = 'none';

  const isSameSet =
    tryReorderOnly &&
    lastRenderedIds.length === visibleIds.length &&
    lastRenderedIds.every(id => visibleIds.includes(id));

  if (isSameSet && activeContainer) {
    const nodeMap = new Map();
    Array.from(activeContainer.children).forEach(el => {
      const bid = el.getAttribute('data-book-id');
      if (bid) nodeMap.set(bid, el);
    });

    if (nodeMap.size === visibleIds.length) {
      const orderedNodes = visibleIds.map(id => nodeMap.get(id)).filter(Boolean);
      reorderWithTransition(activeContainer, orderedNodes, statusAnnouncement);
      lastRenderedIds = visibleIds;
      updateUpDownButtonStates(activeContainer, visibleIds);
      return;
    }
  }

  const showUpDown = currentStatusTab === 'to_read';

  if (currentViewMode === 'cover') {
    coverGrid.innerHTML = filtered.map(({ book, matchedQuotes, matchedMemos }, idx) => {
      const isSelected = selectedBookIds.has(String(book.id));
      const totalNotesCount = (book.quotes?.length || 0) + (book.memo ? 1 : 0);
      const isFirst = idx === 0;
      const isLast = idx === filtered.length - 1;
      const snippetsHtml = buildSearchMatchSnippetsHtml(book.id, matchedQuotes, matchedMemos, query);

      return `
        <article class="book-cover-card${isSelected ? ' selected' : ''}" data-book-id="${escapeHtml(book.id)}">
          <div class="cover-card-top-bar">
            <label class="cover-select-chk-wrap" title="책 선택">
              <input type="checkbox" class="chk-select-book" data-book-id="${escapeHtml(book.id)}" ${isSelected ? 'checked' : ''} aria-label="${escapeHtml(book.title)} 선택">
            </label>
            ${showUpDown ? `
              <div class="cover-order-btns">
                <button type="button" class="btn-move-order btn-move-up" data-book-id="${escapeHtml(book.id)}" ${isFirst ? 'disabled' : ''} title="위로 이동" aria-label="위로 이동">▲</button>
                <button type="button" class="btn-move-order btn-move-down" data-book-id="${escapeHtml(book.id)}" ${isLast ? 'disabled' : ''} title="아래로 이동" aria-label="아래로 이동">▼</button>
              </div>
            ` : ''}
          </div>

          <div class="cover-image-area" data-open-detail="${escapeHtml(book.id)}">
            ${book.cover_url ? `
              <img src="${escapeHtml(book.cover_url)}" alt="${escapeHtml(book.title)} 표지" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div class="cover-fallback-art" style="display: none;">
                <span class="fallback-icon">📘</span>
                <span class="fallback-title">${escapeHtml(book.title)}</span>
              </div>
            ` : `
              <div class="cover-fallback-art">
                <span class="fallback-icon">📘</span>
                <span class="fallback-title">${escapeHtml(book.title)}</span>
              </div>
            `}
            <div class="cover-badges-overlay">
              ${book.rating > 0 ? `<span class="cover-rating-pill">★ ${book.rating}</span>` : '<span></span>'}
              ${totalNotesCount > 0 ? `<span class="cover-notes-pill">🔖 ${totalNotesCount}</span>` : ''}
            </div>
          </div>

          <div class="cover-card-body" data-open-detail="${escapeHtml(book.id)}">
            <h3 class="cover-book-title" title="${escapeHtml(book.title)}">${highlightMatch(book.title, query)}</h3>
            <p class="cover-book-author">${highlightMatch(book.author || '저자 미상', query)}</p>
            <div class="cover-book-meta">
              ${book.publisher ? `<span>${highlightMatch(book.publisher, query)}</span>` : ''}
              ${book.pub_date ? `<span>· ${escapeHtml(book.pub_date.slice(0, 10))}</span>` : ''}
              ${book.completed_date ? `<span style="color: var(--accent-green);">· 완독 ${escapeHtml(book.completed_date)}</span>` : ''}
            </div>
            ${snippetsHtml}
          </div>

          <div class="cover-card-footer">
            <button type="button" class="card-icon-btn btn-quick-status" data-book-id="${escapeHtml(book.id)}" title="${book.status === 'to_read' ? '읽은 책으로 이동' : '읽을 책으로 이동'}">
              ${book.status === 'to_read' ? '✅ 완독 처리' : '📌 읽을 책으로'}
            </button>
            <div style="display: flex; gap: 2px;">
              <button type="button" class="card-icon-btn btn-quick-edit" data-book-id="${escapeHtml(book.id)}" title="책 정보 수정" aria-label="수정">✏️</button>
              <button type="button" class="card-icon-btn danger btn-quick-delete" data-book-id="${escapeHtml(book.id)}" title="책 삭제" aria-label="삭제">🗑️</button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  } else {
    titleList.innerHTML = filtered.map(({ book, matchedQuotes, matchedMemos }, idx) => {
      const isSelected = selectedBookIds.has(String(book.id));
      const quotesCount = book.quotes?.length || 0;
      const hasMemo = book.memo && book.memo.trim().length > 0;
      const isFirst = idx === 0;
      const isLast = idx === filtered.length - 1;
      const snippetsHtml = buildSearchMatchSnippetsHtml(book.id, matchedQuotes, matchedMemos, query);

      return `
        <article class="book-title-row${isSelected ? ' selected' : ''}" data-book-id="${escapeHtml(book.id)}">
          <div class="title-row-main">
            <div class="title-row-left-controls">
              <input type="checkbox" class="chk-select-book" data-book-id="${escapeHtml(book.id)}" ${isSelected ? 'checked' : ''} aria-label="${escapeHtml(book.title)} 선택">
              ${showUpDown ? `
                <div class="title-row-order-btns">
                  <button type="button" class="btn-move-order btn-move-up" data-book-id="${escapeHtml(book.id)}" ${isFirst ? 'disabled' : ''} title="위로 이동" aria-label="위로 이동">▲</button>
                  <button type="button" class="btn-move-order btn-move-down" data-book-id="${escapeHtml(book.id)}" ${isLast ? 'disabled' : ''} title="아래로 이동" aria-label="아래로 이동">▼</button>
                </div>
              ` : ''}
            </div>

            <div class="title-row-content" data-open-detail="${escapeHtml(book.id)}">
              <span class="title-row-book-title">${highlightMatch(book.title, query)}</span>
              <div class="title-row-meta">
                ${book.author ? `<span>✍️ ${highlightMatch(book.author, query)}</span>` : ''}
                ${book.publisher ? `<span><span class="meta-divider">|</span> 🏢 ${highlightMatch(book.publisher, query)}</span>` : ''}
                ${book.pub_date ? `<span><span class="meta-divider">|</span> 출간 ${escapeHtml(book.pub_date.slice(0, 10))}</span>` : ''}
                ${book.completed_date ? `<span style="color: var(--accent-green); font-weight: 600;"><span class="meta-divider">|</span> 완독 ${escapeHtml(book.completed_date)}</span>` : ''}
              </div>
            </div>

            <div class="title-row-badges" data-open-detail="${escapeHtml(book.id)}" style="cursor: pointer;">
              ${currentStatusTab === 'all' ? `
                <span class="status-chip-mini ${book.status === 'read' ? 'read' : 'to-read'}">
                  ${book.status === 'read' ? '읽은 책' : '읽을 책'}
                </span>
              ` : ''}
              ${book.rating > 0 ? `<span class="rating-stars-inline">★ ${book.rating}</span>` : ''}
              ${quotesCount > 0 ? `<span class="count-chip" title="수집 문장 ${quotesCount}개">🔖 ${quotesCount}</span>` : ''}
              ${hasMemo ? `<span class="count-chip" title="독서 메모 있음">📝 메모</span>` : ''}
            </div>

            <div class="title-row-actions">
              <button type="button" class="card-icon-btn btn-quick-status" data-book-id="${escapeHtml(book.id)}" title="${book.status === 'to_read' ? '읽은 책으로 이동' : '읽을 책으로 이동'}">
                ${book.status === 'to_read' ? '✅ 완독' : '📌 읽을책'}
              </button>
              <button type="button" class="card-icon-btn btn-quick-edit" data-book-id="${escapeHtml(book.id)}" title="수정">✏️ 수정</button>
              <button type="button" class="card-icon-btn danger btn-quick-delete" data-book-id="${escapeHtml(book.id)}" title="삭제">🗑️ 삭제</button>
            </div>
          </div>
          ${snippetsHtml}
        </article>
      `;
    }).join('');
  }

  lastRenderedIds = visibleIds;

  if (statusAnnouncement) {
    const statusEl = document.getElementById('reorderStatus');
    if (statusEl) statusEl.textContent = statusAnnouncement;
  }
}

function updateUpDownButtonStates(container, orderedIds) {
  orderedIds.forEach((id, idx) => {
    const card = container.querySelector(`[data-book-id="${CSS.escape(id)}"]`);
    if (!card) return;
    const upBtn = card.querySelector('.btn-move-up');
    const downBtn = card.querySelector('.btn-move-down');
    if (upBtn) upBtn.disabled = idx === 0;
    if (downBtn) downBtn.disabled = idx === orderedIds.length - 1;
  });
}

// ══════════════════════════════════════════════════════
// 9. 읽을 책 상하 이동 (▲ / ▼) 및 툴바 이벤트
// ══════════════════════════════════════════════════════
async function moveBookOrder(bookId, direction) {
  const filtered = getFilteredAndSortedBooks();
  const currentList = filtered.map(item => item.book);
  const idx = currentList.findIndex(b => String(b.id) === String(bookId));
  if (idx === -1) return;

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= currentList.length) return;

  currentList.forEach((b, i) => {
    b.sort_order = i + 1;
  });

  const bookA = currentList[idx];
  const bookB = currentList[targetIdx];
  const tempOrder = bookA.sort_order;
  bookA.sort_order = bookB.sort_order;
  bookB.sort_order = tempOrder;

  currentSortField = 'sort_order';
  currentSortAsc = true;
  const sortSelect = document.getElementById('sortFieldSelect');
  if (sortSelect) sortSelect.value = 'sort_order';
  updateSortDirectionButtonUI();

  saveBooksToLocalCache();
  const announceMsg = `${bookA.title} 도서를 ${direction === 'up' ? '위로' : '아래로'} 이동했습니다.`;
  renderBooksView(true, announceMsg);

  if (supabaseClient && supabaseTableReady) {
    await Promise.all([
      supabaseClient.from(TABLE_NAME).update({ sort_order: bookA.sort_order, updated_at: new Date().toISOString() }).eq('id', bookA.id),
      supabaseClient.from(TABLE_NAME).update({ sort_order: bookB.sort_order, updated_at: new Date().toISOString() }).eq('id', bookB.id)
    ]);
  }
}

function updateViewToggleUI() {
  const btnCover = document.getElementById('btnViewCover');
  const btnTitle = document.getElementById('btnViewTitle');
  if (btnCover && btnTitle) {
    const isCover = currentViewMode === 'cover';
    btnCover.classList.toggle('active', isCover);
    btnCover.setAttribute('aria-pressed', String(isCover));
    btnTitle.classList.toggle('active', !isCover);
    btnTitle.setAttribute('aria-pressed', String(!isCover));
  }
}

function updateSortDirectionButtonUI() {
  const icon = document.getElementById('sortDirIcon');
  const text = document.getElementById('sortDirText');
  const btn = document.getElementById('btnSortDirection');
  if (icon) icon.textContent = currentSortAsc ? '▲' : '▼';
  if (text) text.textContent = currentSortAsc ? '오름차순' : '내림차순';
  if (btn) {
    btn.setAttribute('aria-label', currentSortAsc ? '오름차순 정렬 중 (클릭 시 내림차순)' : '내림차순 정렬 중 (클릭 시 오름차순)');
  }
}

function bindMainToolbarEvents() {
  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.status-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      currentStatusTab = tab.getAttribute('data-status') || 'to_read';
      selectedBookIds.clear();
      renderBooksView(false);
    });
  });

  const btnViewCover = document.getElementById('btnViewCover');
  const btnViewTitle = document.getElementById('btnViewTitle');

  if (btnViewCover) {
    btnViewCover.addEventListener('click', () => {
      if (currentViewMode === 'cover') return;
      currentViewMode = 'cover';
      localStorage.setItem('reading_books_view_mode', 'cover');
      updateViewToggleUI();
      lastRenderedIds = [];
      renderBooksView(false);
    });
  }

  if (btnViewTitle) {
    btnViewTitle.addEventListener('click', () => {
      if (currentViewMode === 'title') return;
      currentViewMode = 'title';
      localStorage.setItem('reading_books_view_mode', 'title');
      updateViewToggleUI();
      lastRenderedIds = [];
      renderBooksView(false);
    });
  }

  const listSearchInput = document.getElementById('listSearchInput');
  const btnClearListSearch = document.getElementById('btnClearListSearch');
  const searchScopeSelect = document.getElementById('searchScopeSelect');

  if (listSearchInput) {
    listSearchInput.addEventListener('input', () => {
      if (btnClearListSearch) {
        btnClearListSearch.style.display = listSearchInput.value.length > 0 ? 'flex' : 'none';
      }
      renderBooksView(false);
    });
  }

  if (btnClearListSearch && listSearchInput) {
    btnClearListSearch.addEventListener('click', () => {
      listSearchInput.value = '';
      btnClearListSearch.style.display = 'none';
      listSearchInput.focus();
      renderBooksView(false);
    });
  }

  if (searchScopeSelect) {
    searchScopeSelect.addEventListener('change', () => {
      renderBooksView(false);
    });
  }

  const sortFieldSelect = document.getElementById('sortFieldSelect');
  const btnSortDirection = document.getElementById('btnSortDirection');

  const sortLabels = {
    sort_order: '지정 순서',
    title: '제목',
    author: '저자',
    publisher: '출판사',
    pub_date: '출간일',
    completed_date: '완독일'
  };

  if (sortFieldSelect) {
    sortFieldSelect.addEventListener('change', () => {
      currentSortField = sortFieldSelect.value;
      if (currentSortField === 'pub_date' || currentSortField === 'completed_date') {
        currentSortAsc = false;
      } else {
        currentSortAsc = true;
      }
      updateSortDirectionButtonUI();
      const label = sortLabels[currentSortField] || currentSortField;
      renderBooksView(true, `${label} 기준 ${currentSortAsc ? '오름차순' : '내림차순'}으로 정렬되었습니다.`);
    });
  }

  if (btnSortDirection) {
    btnSortDirection.addEventListener('click', () => {
      currentSortAsc = !currentSortAsc;
      updateSortDirectionButtonUI();
      const label = sortLabels[currentSortField] || currentSortField;
      renderBooksView(true, `${label} 기준 ${currentSortAsc ? '오름차순' : '내림차순'}으로 정렬되었습니다.`);
    });
  }

  const btnBackupJson = document.getElementById('btnBackupJson');
  const btnRestoreJson = document.getElementById('btnRestoreJson');
  const inputRestoreJsonFile = document.getElementById('inputRestoreJsonFile');

  if (btnBackupJson) {
    btnBackupJson.addEventListener('click', exportTableToJsonFile);
  }
  if (btnRestoreJson && inputRestoreJsonFile) {
    btnRestoreJson.addEventListener('click', () => inputRestoreJsonFile.click());
    inputRestoreJsonFile.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) importTableFromJsonFile(file);
      inputRestoreJsonFile.value = '';
    });
  }

  const chkSelectAll = document.getElementById('chkSelectAll');
  const btnEditSelected = document.getElementById('btnEditSelected');
  const btnMoveSelectedStatus = document.getElementById('btnMoveSelectedStatus');
  const btnDeleteSelected = document.getElementById('btnDeleteSelected');

  if (chkSelectAll) {
    chkSelectAll.addEventListener('change', () => {
      const visibleIds = getFilteredAndSortedBooks().map(item => String(item.book.id));
      if (chkSelectAll.checked) {
        visibleIds.forEach(id => selectedBookIds.add(id));
      } else {
        visibleIds.forEach(id => selectedBookIds.delete(id));
      }
      renderBooksView(false);
    });
  }

  if (btnEditSelected) {
    btnEditSelected.addEventListener('click', () => {
      if (selectedBookIds.size !== 1) return;
      const onlyId = Array.from(selectedBookIds)[0];
      openEditBookModal(onlyId);
    });
  }

  if (btnMoveSelectedStatus) {
    btnMoveSelectedStatus.addEventListener('click', async () => {
      if (selectedBookIds.size === 0) return;
      const ids = Array.from(selectedBookIds);
      const targetStatus = currentStatusTab === 'read' ? 'to_read' : 'read';
      const targetLabel = targetStatus === 'read' ? '읽은 책' : '읽을 책';

      if (!confirm(`선택한 ${ids.length}권의 책을 '${targetLabel}' 목록으로 이동하시겠습니까?`)) return;

      for (const id of ids) {
        const b = books.find(item => String(item.id) === String(id));
        if (!b) continue;
        const completedDate = targetStatus === 'read'
          ? (b.completed_date || getTodayDateString())
          : b.completed_date;
        await updateBookInDb(id, { status: targetStatus, completed_date: completedDate });
      }
      selectedBookIds.clear();
      renderBooksView(false);
    });
  }

  if (btnDeleteSelected) {
    btnDeleteSelected.addEventListener('click', async () => {
      if (selectedBookIds.size === 0) return;
      const ids = Array.from(selectedBookIds);
      if (!confirm(`선택한 ${ids.length}권의 책을 정말 삭제하시겠습니까?`)) return;
      await deleteBooksFromDb(ids);
      renderBooksView(false);
    });
  }

  const listSection = document.getElementById('booksListSection');
  if (listSection) {
    listSection.addEventListener('click', async (e) => {
      const upBtn = e.target.closest('.btn-move-up');
      if (upBtn) {
        e.stopPropagation();
        await moveBookOrder(upBtn.getAttribute('data-book-id'), 'up');
        return;
      }

      const downBtn = e.target.closest('.btn-move-down');
      if (downBtn) {
        e.stopPropagation();
        await moveBookOrder(downBtn.getAttribute('data-book-id'), 'down');
        return;
      }

      const editBtn = e.target.closest('.btn-quick-edit');
      if (editBtn) {
        e.stopPropagation();
        openEditBookModal(editBtn.getAttribute('data-book-id'));
        return;
      }

      const delBtn = e.target.closest('.btn-quick-delete');
      if (delBtn) {
        e.stopPropagation();
        const bid = delBtn.getAttribute('data-book-id');
        const targetBook = books.find(b => String(b.id) === String(bid));
        if (targetBook && confirm(`'${targetBook.title}' 도서를 삭제하시겠습니까?`)) {
          await deleteBooksFromDb([bid]);
          renderBooksView(false);
        }
        return;
      }

      const statusBtn = e.target.closest('.btn-quick-status');
      if (statusBtn) {
        e.stopPropagation();
        const bid = statusBtn.getAttribute('data-book-id');
        const targetBook = books.find(b => String(b.id) === String(bid));
        if (targetBook) {
          const nextStatus = targetBook.status === 'to_read' ? 'read' : 'to_read';
          const nextCompleted = nextStatus === 'read'
            ? (targetBook.completed_date || getTodayDateString())
            : targetBook.completed_date;
          await updateBookInDb(bid, { status: nextStatus, completed_date: nextCompleted });
          renderBooksView(false);
        }
        return;
      }

      const chk = e.target.closest('.chk-select-book');
      if (chk) {
        e.stopPropagation();
        const bid = String(chk.getAttribute('data-book-id'));
        if (chk.checked) {
          selectedBookIds.add(bid);
        } else {
          selectedBookIds.delete(bid);
        }
        const card = chk.closest('[data-book-id]');
        if (card) card.classList.toggle('selected', chk.checked);
        const visibleIds = getFilteredAndSortedBooks().map(item => String(item.book.id));
        updateSelectionBarUI(visibleIds);
        return;
      }

      const detailTrigger = e.target.closest('[data-open-detail]');
      if (detailTrigger) {
        const bid = detailTrigger.getAttribute('data-open-detail');
        openBookDetailModal(bid);
      }
    });
  }
}

// ══════════════════════════════════════════════════════
// 10. 도서 검색 API 연동 (국립중앙도서관 API + Google Books + Open Library)
// ══════════════════════════════════════════════════════

// 국립중앙도서관 날짜 포맷 정규화 (예: "20241201" -> "2024-12-01")
function formatNlkDate(raw) {
  if (!raw) return '';
  const clean = String(raw).trim();
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  return clean;
}

// 표지 이미지 URL 정규화 (상대 경로 및 http Mixed Content 대응)
function normalizeCoverUrl(rawUrl) {
  if (!rawUrl) return '';
  let url = String(rawUrl).trim();
  if (!url) return '';
  if (url.startsWith('//')) {
    url = 'https:' + url;
  } else if (url.startsWith('/')) {
    url = 'https://www.nl.go.kr' + url;
  } else if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }
  return url;
}

// 1) 국립중앙도서관 Open API 검색 (ISBN 서지정보 API + 소장자료 통합검색 API 동시 호출)
async function searchNlkBooks(query) {
  const { nlkKey } = getSavedApiKeys();
  if (!nlkKey || !nlkKey.trim()) return [];

  const cleanKey = nlkKey.trim();
  const cleanQuery = query.trim();

  // 1-A. 국립중앙도서관 ISBN 서지정보 API (제목 검색 & 저자 검색 병렬)
  const seojiTitleUrl = `https://www.nl.go.kr/seoji/SearchApi.do?cert_key=${encodeURIComponent(cleanKey)}&result_style=json&page_no=1&page_size=20&title=${encodeURIComponent(cleanQuery)}`;
  const seojiAuthorUrl = `https://www.nl.go.kr/seoji/SearchApi.do?cert_key=${encodeURIComponent(cleanKey)}&result_style=json&page_no=1&page_size=10&author=${encodeURIComponent(cleanQuery)}`;

  // 1-B. 국립중앙도서관 소장자료 통합검색 Open API
  const searchOpenApiUrl = `https://www.nl.go.kr/NL/search/openApi/search.do?key=${encodeURIComponent(cleanKey)}&apiType=json&srchTarget=total&kwd=${encodeURIComponent(cleanQuery)}&pageNum=1&pageSize=20&category=${encodeURIComponent('도서')}`;

  async function fetchSeoji(url) {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.docs)) return [];
    return data.docs.map(doc => ({
      source: '국립중앙도서관(서지)',
      title: stripHtmlTags(doc.TITLE || doc.SERIES_TITLE || ''),
      author: stripHtmlTags(doc.AUTHOR || ''),
      publisher: stripHtmlTags(doc.PUBLISHER || ''),
      pub_date: formatNlkDate(doc.REAL_PUBLISH_DATE || doc.PUBLISH_PREDATE || ''),
      cover_url: normalizeCoverUrl(doc.TITLE_URL || ''),
      toc: formatTocText(doc.BOOK_TB_CNT || ''),
      toc_url: normalizeCoverUrl(doc.BOOK_TB_CNT_URL || '')
    })).filter(b => b.title);
  }

  async function fetchNlkCatalog(url) {
    const res = await fetch(url);
    if (!res.ok) return [];
    const text = await res.text();

    // JSON 응답 파싱
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data.result)) {
        return data.result.map(item => ({
          source: '국립중앙도서관',
          title: stripHtmlTags(item.titleInfo || ''),
          author: stripHtmlTags(item.authorInfo || ''),
          publisher: stripHtmlTags(item.pubInfo || ''),
          pub_date: formatNlkDate(item.pubYearInfo || ''),
          cover_url: normalizeCoverUrl(item.imageUrl || ''),
          toc: formatTocText(item.toc || item.mokcha || item.BOOK_TB_CNT || '')
        })).filter(b => b.title);
      }
    } catch (_) {
      // XML 응답인 경우 DOMParser로 파싱
      try {
        const xmlDoc = new DOMParser().parseFromString(text, 'text/xml');
        const items = Array.from(xmlDoc.querySelectorAll('item'));
        return items.map(node => ({
          source: '국립중앙도서관',
          title: stripHtmlTags(node.querySelector('title_info, titleInfo')?.textContent || ''),
          author: stripHtmlTags(node.querySelector('author_info, authorInfo')?.textContent || ''),
          publisher: stripHtmlTags(node.querySelector('pub_info, pubInfo')?.textContent || ''),
          pub_date: formatNlkDate(node.querySelector('pub_year_info, pubYearInfo')?.textContent || ''),
          cover_url: normalizeCoverUrl(node.querySelector('image_url, imageUrl')?.textContent || ''),
          toc: formatTocText(node.querySelector('toc, mokcha, BOOK_TB_CNT')?.textContent || '')
        })).filter(b => b.title);
      } catch (__) {}
    }
    return [];
  }

  const settled = await Promise.allSettled([
    fetchSeoji(seojiTitleUrl),
    fetchNlkCatalog(searchOpenApiUrl),
    fetchSeoji(seojiAuthorUrl)
  ]);

  const combined = [];
  for (const s of settled) {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) {
      combined.push(...s.value);
    }
  }
  return combined;
}

// 2) Google Books API 검색 (국내·국외 겸용)
async function searchGoogleBooks(query, region) {
  const { googleKey } = getSavedApiKeys();
  const qParam = query.trim();

  let langRestrict = '';
  if (region === 'kr') langRestrict = '&langRestrict=ko';
  else if (region === 'en') langRestrict = '&langRestrict=en';

  const keyParam = googleKey ? `&key=${encodeURIComponent(googleKey)}` : '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(qParam)}&maxResults=15${langRestrict}${keyParam}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Books HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.items)) return [];

  return data.items.map(item => {
    const vi = item.volumeInfo || {};
    let cover = vi.imageLinks?.thumbnail || vi.imageLinks?.smallThumbnail || '';
    if (cover.startsWith('http://')) cover = cover.replace('http://', 'https://');

    return {
      source: 'Google Books',
      title: vi.title ? (vi.subtitle ? `${vi.title}: ${vi.subtitle}` : vi.title) : '제목 미상',
      author: (vi.authors || []).join(', '),
      publisher: vi.publisher || '',
      pub_date: vi.publishedDate || '',
      cover_url: cover
    };
  });
}

// 3) Open Library Search API 검색 (완전 무료/키 불필요, 국외·국내 도서)
async function searchOpenLibrary(query) {
  const cleanQ = query.trim();
  const searchParam = `q=${encodeURIComponent(cleanQ.length < 3 ? `"${cleanQ}"` : cleanQ)}`;
  const fields = 'key,title,author_name,publisher,first_publish_year,publish_date,isbn,cover_i';
  const url = `https://openlibrary.org/search.json?${searchParam}&fields=${fields}&limit=15`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Library HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.docs)) return [];

  return data.docs.map(doc => {
    const firstIsbn = Array.isArray(doc.isbn) && doc.isbn.length > 0 ? doc.isbn[0] : '';
    const coverUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : (firstIsbn ? `https://covers.openlibrary.org/b/isbn/${firstIsbn}-M.jpg` : '');

    let pubDate = '';
    if (doc.first_publish_year) {
      pubDate = String(doc.first_publish_year);
    } else if (Array.isArray(doc.publish_date) && doc.publish_date.length > 0) {
      pubDate = String(doc.publish_date[0]);
    }

    return {
      source: 'Open Library',
      title: doc.title || '제목 미상',
      author: (doc.author_name || []).slice(0, 3).join(', '),
      publisher: (doc.publisher || [])[0] || '',
      pub_date: pubDate,
      cover_url: coverUrl,
      toc: '',
      work_key: doc.key || '',
      first_isbn: firstIsbn
    };
  });
}

// 한국어 날짜 문자열 정규화 ("2024년 12월 01일" -> "2024-12-01", "2014년 05월" -> "2014-05")
function parseKoreanDateString(raw) {
  if (!raw) return '';
  const str = String(raw).trim();
  const fullMatch = str.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (fullMatch) {
    return `${fullMatch[1]}-${String(fullMatch[2]).padStart(2, '0')}-${String(fullMatch[3]).padStart(2, '0')}`;
  }
  const ymMatch = str.match(/(\d{4})년\s*(\d{1,2})월/);
  if (ymMatch) {
    return `${ymMatch[1]}-${String(ymMatch[2]).padStart(2, '0')}`;
  }
  return str;
}

// 4) 방법 A: Supabase 프록시(RPC fetch_yes24_page 또는 Edge Function book-proxy)를 통한 도서 검색·표지·목차 조회
async function fetchYes24HtmlViaSupabase(path) {
  if (!supabaseClient || !path) return '';

  // 4-A. Supabase SQL RPC (public.fetch_yes24_page) 우선 호출
  try {
    const { data, error } = await supabaseClient.rpc('fetch_yes24_page', { p_path: path });
    if (!error && typeof data === 'string' && data.length > 100) {
      return data;
    }
  } catch (_) {}

  // 4-B. Supabase Edge Function (book-proxy) 폴백 호출
  try {
    const { data, error } = await supabaseClient.functions.invoke('book-proxy', {
      body: { path }
    });
    if (!error && data && typeof data.html === 'string' && data.html.length > 100) {
      return data.html;
    }
  } catch (_) {}

  return '';
}

// Supabase 프록시를 통해 Yes24 도서 검색 결과(고화질 표지 이미지 + 상품번호 포함) 조회
async function searchYes24BooksViaSupabase(query) {
  const cleanQ = (query || '').trim();
  if (!cleanQ) return [];

  const path = `/Product/Search?domain=BOOK&query=${encodeURIComponent(cleanQ)}`;
  const html = await fetchYes24HtmlViaSupabase(path);
  if (!html) return [];

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const items = Array.from(doc.querySelectorAll('#yesSchList > li[data-goods-no]'));

  return items.slice(0, 15).map(li => {
    const goodsNo = li.getAttribute('data-goods-no') || '';
    const titleEl = li.querySelector('a.gd_name');
    const authEl = li.querySelector('.authPub.info_auth');
    const pubEl = li.querySelector('.authPub.info_pub');
    const dateEl = li.querySelector('.authPub.info_date');

    const title = (titleEl?.textContent || '').trim();
    const author = (authEl?.textContent || '').replace(/\s+/g, ' ').trim();
    const publisher = (pubEl?.textContent || '').trim();
    const pubDate = parseKoreanDateString(dateEl?.textContent || '');
    const coverUrl = goodsNo ? `https://image.yes24.com/goods/${goodsNo}/L` : '';

    return {
      source: '국내도서(표지·목차)',
      goods_no: goodsNo,
      title,
      author,
      publisher,
      pub_date: pubDate,
      cover_url: coverUrl,
      toc: ''
    };
  }).filter(b => b.title);
}

// Supabase 프록시를 통해 특정 도서(goodsNo)의 상세 목차(#infoset_toc) 및 표지·출간일 조회
async function fetchYes24GoodsDetailViaSupabase(goodsNo) {
  if (!goodsNo) return null;
  const html = await fetchYes24HtmlViaSupabase(`/Product/Goods/${encodeURIComponent(goodsNo)}`);
  if (!html) return null;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tocTextarea = doc.querySelector('#infoset_toc textarea');
  const tocDiv = doc.querySelector('#infoset_toc .infoWrap_txtInner');
  const rawToc = tocTextarea ? (tocTextarea.value || tocTextarea.textContent || '') : (tocDiv?.innerHTML || '');
  const toc = formatTocText(rawToc);

  const dateText = doc.querySelector('.gd_date')?.textContent || '';
  const pubDate = parseKoreanDateString(dateText);
  const coverUrl = `https://image.yes24.com/goods/${goodsNo}/L`;

  return {
    goods_no: goodsNo,
    cover_url: coverUrl,
    pub_date: pubDate,
    toc
  };
}

// 도서검색 API 및 Supabase 프록시에서 표지 이미지(cover_url)와 목차(toc) 상세 조회
async function fetchBookDetailAndTocFromApis(item) {
  if (!item) return { toc: '', cover_url: '', pub_date: '' };

  let resolvedToc = item.toc ? item.toc.trim() : '';
  let resolvedCover = item.cover_url ? item.cover_url.trim() : '';
  let resolvedPubDate = item.pub_date ? item.pub_date.trim() : '';

  // 1) goods_no 추출 (후보 객체에 있거나 cover_url이 image.yes24.com/goods/{id} 형태인 경우)
  let goodsNo = item.goods_no || '';
  if (!goodsNo && resolvedCover) {
    const m = resolvedCover.match(/image\.yes24\.com\/goods\/(\d+)/);
    if (m) goodsNo = m[1];
  }

  // 2) goods_no가 없으면 제목으로 Supabase 프록시 검색을 수행하여 goods_no 및 표지 이미지 확보
  if (!goodsNo && item.title) {
    try {
      const searchQuery = `${item.title} ${(item.author || '').split(/[,/]/)[0].replace(/저|지음|옮김/g, '').trim()}`.trim();
      let yItems = await searchYes24BooksViaSupabase(searchQuery);
      if (yItems.length === 0) {
        yItems = await searchYes24BooksViaSupabase(item.title);
      }
      if (yItems.length > 0) {
        goodsNo = yItems[0].goods_no || '';
        if (!resolvedCover && yItems[0].cover_url) {
          resolvedCover = yItems[0].cover_url;
        }
        if (!resolvedPubDate && yItems[0].pub_date) {
          resolvedPubDate = yItems[0].pub_date;
        }
      }
    } catch (_) {}
  }

  // 3) goods_no가 있으면 상세 페이지에서 목차(#infoset_toc)와 표지·출간일 조회
  if (goodsNo && (!resolvedToc || !resolvedCover)) {
    try {
      const detail = await fetchYes24GoodsDetailViaSupabase(goodsNo);
      if (detail) {
        if (!resolvedToc && detail.toc) resolvedToc = detail.toc;
        if (!resolvedCover && detail.cover_url) resolvedCover = detail.cover_url;
        if (detail.pub_date && detail.pub_date.length > resolvedPubDate.length) {
          resolvedPubDate = detail.pub_date;
        }
      }
    } catch (_) {}
  }

  if (resolvedToc) {
    return { toc: resolvedToc, cover_url: resolvedCover, pub_date: resolvedPubDate };
  }

  // 4) 국립중앙도서관 BOOK_TB_CNT_URL / SearchApi.do 조회
  if (item.toc_url) {
    try {
      const res = await fetch(item.toc_url);
      if (res.ok) {
        const txt = formatTocText(await res.text());
        if (txt) return { toc: txt, cover_url: resolvedCover, pub_date: resolvedPubDate };
      }
    } catch (_) {}
  }

  const { nlkKey } = getSavedApiKeys();
  if (nlkKey && nlkKey.trim() && item.title) {
    try {
      const cleanKey = nlkKey.trim();
      const seojiUrl = `https://www.nl.go.kr/seoji/SearchApi.do?cert_key=${encodeURIComponent(cleanKey)}&result_style=json&page_no=1&page_size=10&title=${encodeURIComponent(item.title.trim())}`;
      const res = await fetch(seojiUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.docs)) {
          for (const doc of data.docs) {
            if (!resolvedCover && doc.TITLE_URL) {
              resolvedCover = normalizeCoverUrl(doc.TITLE_URL);
            }
            const directToc = formatTocText(doc.BOOK_TB_CNT || '');
            if (directToc) return { toc: directToc, cover_url: resolvedCover, pub_date: resolvedPubDate };
          }
        }
      }
    } catch (_) {}
  }

  // 5) Open Library Books / Works Editions API에서 table_of_contents 조회
  try {
    let isbnToCheck = item.first_isbn || '';
    let workKeyToCheck = item.work_key || '';

    if (!isbnToCheck && !workKeyToCheck && item.title) {
      const q = item.title.trim();
      const searchParam = `q=${encodeURIComponent(q.length < 3 ? `"${q}"` : q)}`;
      const sRes = await fetch(`https://openlibrary.org/search.json?${searchParam}&fields=key,isbn,cover_i&limit=3`);
      if (sRes.ok) {
        const sData = await sRes.json();
        const firstDoc = sData.docs?.[0];
        if (firstDoc) {
          workKeyToCheck = firstDoc.key || '';
          isbnToCheck = Array.isArray(firstDoc.isbn) && firstDoc.isbn.length > 0 ? firstDoc.isbn[0] : '';
          if (!resolvedCover && firstDoc.cover_i) {
            resolvedCover = `https://covers.openlibrary.org/b/id/${firstDoc.cover_i}-M.jpg`;
          }
        }
      }
    }

    if (isbnToCheck) {
      const bRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbnToCheck)}&format=json&jscmd=data`);
      if (bRes.ok) {
        const bData = await bRes.json();
        const entry = bData[`ISBN:${isbnToCheck}`];
        if (entry && Array.isArray(entry.table_of_contents) && entry.table_of_contents.length > 0) {
          const lines = entry.table_of_contents
            .map(ch => [ch.label, ch.title, ch.pagenum ? `(p.${ch.pagenum})` : ''].filter(Boolean).join(' '))
            .filter(Boolean);
          if (lines.length > 0) {
            return { toc: lines.join('\n'), cover_url: resolvedCover, pub_date: resolvedPubDate };
          }
        }
      }
    }

    if (workKeyToCheck) {
      const edRes = await fetch(`https://openlibrary.org${workKeyToCheck}/editions.json?limit=8`);
      if (edRes.ok) {
        const edData = await edRes.json();
        if (Array.isArray(edData.entries)) {
          for (const ed of edData.entries) {
            if (Array.isArray(ed.table_of_contents) && ed.table_of_contents.length > 0) {
              const lines = ed.table_of_contents
                .map(ch => typeof ch === 'string' ? ch : [ch.label, ch.title, ch.pagenum ? `(p.${ch.pagenum})` : ''].filter(Boolean).join(' '))
                .filter(Boolean);
              if (lines.length > 0) {
                return { toc: lines.join('\n'), cover_url: resolvedCover, pub_date: resolvedPubDate };
              }
            }
          }
        }
      }
    }
  } catch (_) {}

  // 6) 백업 도서 카탈로그에 등록된 표지·목차가 있는 경우 반환
  if (item.title) {
    try {
      const backupList = await fetchBackupJsonBooks();
      const targetTitle = item.title.trim().toLowerCase();
      const found = backupList.find(b => b.title && b.title.trim().toLowerCase() === targetTitle);
      if (found) {
        if (!resolvedCover && found.cover_url) resolvedCover = found.cover_url;
        if (!resolvedToc && found.toc) resolvedToc = found.toc;
      }
    } catch (_) {}
  }

  return { toc: resolvedToc, cover_url: resolvedCover, pub_date: resolvedPubDate };
}

async function fetchTocFromBookApis(item) {
  const res = await fetchBookDetailAndTocFromApis(item);
  return res.toc || '';
}

// 통합 도서 검색 실행 (Supabase 표지·목차 프록시 + 국립중앙도서관 + Google Books + Open Library)
async function performCombinedBookSearch(query, region) {
  const tasks = [];

  if (region === 'en') {
    tasks.push(searchOpenLibrary(query));
    tasks.push(searchGoogleBooks(query, region));
    tasks.push(searchYes24BooksViaSupabase(query));
  } else if (region === 'kr') {
    tasks.push(searchYes24BooksViaSupabase(query));
    tasks.push(searchNlkBooks(query));
    tasks.push(searchGoogleBooks(query, region));
    tasks.push(searchOpenLibrary(query));
  } else {
    tasks.push(searchYes24BooksViaSupabase(query));
    tasks.push(searchNlkBooks(query));
    tasks.push(searchGoogleBooks(query, region));
    tasks.push(searchOpenLibrary(query));
  }

  const settled = await Promise.allSettled(tasks);
  const rawList = [];

  for (const item of settled) {
    if (item.status === 'fulfilled' && Array.isArray(item.value)) {
      rawList.push(...item.value);
    }
  }

  // (제목+저자) 기준 중복 병합 및 빈 표지 이미지·목차·상품번호 상호 보완
  const mergedMap = new Map();

  for (const item of rawList) {
    if (!item.title) continue;
    const normTitle = item.title.toLowerCase().replace(/\s+/g, '');
    const normAuthor = (item.author || '').replace(/저|지음|옮김|역/g, '').toLowerCase().replace(/\s+/g, '').slice(0, 6);
    const key = `${normTitle}_${normAuthor}`;

    if (!mergedMap.has(key)) {
      mergedMap.set(key, { ...item });
    } else {
      const existing = mergedMap.get(key);
      if (!existing.cover_url && item.cover_url) existing.cover_url = item.cover_url;
      if (!existing.goods_no && item.goods_no) existing.goods_no = item.goods_no;
      if (!existing.publisher && item.publisher) existing.publisher = item.publisher;
      if ((!existing.pub_date || existing.pub_date.length < (item.pub_date || '').length) && item.pub_date) {
        existing.pub_date = item.pub_date;
      }
      if (!existing.author && item.author) existing.author = item.author;
      if (!existing.toc && item.toc) existing.toc = item.toc;
      if (!existing.toc_url && item.toc_url) existing.toc_url = item.toc_url;
      if (!existing.work_key && item.work_key) existing.work_key = item.work_key;
      if (!existing.first_isbn && item.first_isbn) existing.first_isbn = item.first_isbn;
    }
  }

  return Array.from(mergedMap.values());
}

// ══════════════════════════════════════════════════════
// 11. 도서 검색 모달 및 직접 입력 이벤트
// ══════════════════════════════════════════════════════
function openSearchModal(defaultTab = 'api') {
  const dlg = document.getElementById('bookSearchDialog');
  if (!dlg) return;
  updateInlineNlkKeyBarVisibility();
  switchSearchModalTab(defaultTab);
  dlg.showModal();
  if (defaultTab === 'api') {
    document.getElementById('apiSearchQuery')?.focus();
  } else {
    document.getElementById('manualTitle')?.focus();
  }
}

function switchSearchModalTab(tabName) {
  const btnApi = document.getElementById('btnTabApiSearch');
  const btnManual = document.getElementById('btnTabManualAdd');
  const panelApi = document.getElementById('panelApiSearch');
  const panelManual = document.getElementById('panelManualAdd');

  const isApi = tabName === 'api';
  if (btnApi) btnApi.classList.toggle('active', isApi);
  if (btnManual) btnManual.classList.toggle('active', !isApi);
  if (panelApi) panelApi.style.display = isApi ? 'block' : 'none';
  if (panelManual) panelManual.style.display = isApi ? 'none' : 'block';
}

function renderApiSearchResults(items) {
  const container = document.getElementById('apiSearchResults');
  if (!container) return;

  apiSearchCandidates = items;
  const { nlkKey } = getSavedApiKeys();

  if (!items || items.length === 0) {
    const keyHint = !nlkKey
      ? `<br><span style="color: var(--accent); font-weight: 600;">💡 국내 도서를 정확히 검색하려면 위 입력란 또는 상단 ⚙️ 설정에 국립중앙도서관 Open API 인증키를 입력해 주세요.</span>`
      : '';
    container.innerHTML = `
      <div class="api-search-placeholder">
        검색 결과가 없습니다.${keyHint}<br>
        검색어를 다르게 입력하시거나 상단의 <strong>'✍️ 직접 입력하여 추가'</strong> 탭을 이용해 보세요.
      </div>
    `;
    return;
  }

  container.innerHTML = items.map((item, idx) => `
    <div class="api-result-card" data-candidate-idx="${idx}">
      <div class="api-result-cover">
        ${item.cover_url
          ? `<img src="${escapeHtml(item.cover_url)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.style.display='none'; this.parentElement.textContent='📘';">`
          : '📘'}
      </div>
      <div class="api-result-info">
        <div class="api-result-title">${escapeHtml(item.title)}</div>
        <div class="api-result-sub">
          ${escapeHtml(item.author || '저자 미상')}
          ${item.publisher ? ` · ${escapeHtml(item.publisher)}` : ''}
          ${item.pub_date ? ` · ${escapeHtml(item.pub_date)}` : ''}
        </div>
        <div class="api-result-specs">
          <span class="spec-badge source">${escapeHtml(item.source)}</span>
          ${item.toc ? `<span class="spec-badge">📑 목차 포함</span>` : ''}
        </div>
      </div>
      <div class="api-result-actions">
        <button type="button" class="btn btn-secondary btn-mini btn-status-to-read btn-pick-to-read" data-idx="${idx}">
          📌 읽을 책으로
        </button>
        <button type="button" class="btn btn-primary btn-mini btn-pick-read" data-idx="${idx}">
          ✅ 읽은 책으로
        </button>
        <button type="button" class="btn btn-secondary btn-mini btn-pick-edit-first" data-idx="${idx}">
          ✏️ 확인/수정 후 추가
        </button>
      </div>
    </div>
  `).join('');
}

async function fillManualFormWithCandidate(item) {
  switchSearchModalTab('manual');
  document.getElementById('manualTitle').value = item.title || '';
  document.getElementById('manualAuthor').value = item.author || '';
  document.getElementById('manualPublisher').value = item.publisher || '';
  document.getElementById('manualPubDate').value = item.pub_date || '';
  document.getElementById('manualCoverUrl').value = item.cover_url || '';
  document.getElementById('manualCompletedDate').value = getTodayDateString();
  updateManualCoverPreview(item.cover_url || '');

  const manualTocEl = document.getElementById('manualToc');
  if (manualTocEl) manualTocEl.value = item.toc || '';

  if (!item.toc || !item.cover_url) {
    const detail = await fetchBookDetailAndTocFromApis(item);
    if (manualTocEl && !manualTocEl.value && detail.toc) {
      manualTocEl.value = detail.toc;
    }
    const coverInput = document.getElementById('manualCoverUrl');
    if (coverInput && !coverInput.value && detail.cover_url) {
      coverInput.value = detail.cover_url;
      updateManualCoverPreview(detail.cover_url);
    }
    const pubDateInput = document.getElementById('manualPubDate');
    if (pubDateInput && detail.pub_date && detail.pub_date.length > (pubDateInput.value || '').length) {
      pubDateInput.value = detail.pub_date;
    }
  }
}

function updateManualCoverPreview(url) {
  const img = document.getElementById('manualCoverPreviewImg');
  const ph = document.getElementById('manualCoverPlaceholder');
  if (!img || !ph) return;
  if (url && url.trim()) {
    img.src = url.trim();
    img.style.display = 'block';
    ph.style.display = 'none';
    img.onerror = () => {
      img.style.display = 'none';
      ph.style.display = 'block';
    };
  } else {
    img.src = '';
    img.style.display = 'none';
    ph.style.display = 'block';
  }
}

function bindSearchModalEvents() {
  const btnOpenSearchModal = document.getElementById('btnOpenSearchModal');
  const btnEmptyAddBook = document.getElementById('btnEmptyAddBook');
  const btnTabApiSearch = document.getElementById('btnTabApiSearch');
  const btnTabManualAdd = document.getElementById('btnTabManualAdd');
  const apiBookSearchForm = document.getElementById('apiBookSearchForm');
  const apiSearchQuery = document.getElementById('apiSearchQuery');
  const btnClearApiSearch = document.getElementById('btnClearApiSearch');
  const apiSearchResults = document.getElementById('apiSearchResults');
  const manualCoverUrl = document.getElementById('manualCoverUrl');
  const btnAddManualToRead = document.getElementById('btnAddManualToRead');
  const btnAddManualRead = document.getElementById('btnAddManualRead');
  const btnSaveInlineNlkKey = document.getElementById('btnSaveInlineNlkKey');

  if (btnOpenSearchModal) {
    btnOpenSearchModal.addEventListener('click', () => openSearchModal('api'));
  }
  if (btnEmptyAddBook) {
    btnEmptyAddBook.addEventListener('click', () => openSearchModal('api'));
  }
  if (btnTabApiSearch) {
    btnTabApiSearch.addEventListener('click', () => switchSearchModalTab('api'));
  }
  if (btnTabManualAdd) {
    btnTabManualAdd.addEventListener('click', () => {
      document.getElementById('manualCompletedDate').value = getTodayDateString();
      switchSearchModalTab('manual');
    });
  }

  // 검색 모달 내 인라인 국립중앙도서관 API 키 즉시 저장
  if (btnSaveInlineNlkKey) {
    btnSaveInlineNlkKey.addEventListener('click', () => {
      const val = document.getElementById('inlineNlkKeyInput')?.value.trim() || '';
      if (!val) {
        alert('국립중앙도서관 Open API 인증키를 입력해 주세요.');
        return;
      }
      const currentKeys = getSavedApiKeys();
      saveApiKeys({ ...currentKeys, nlkKey: val });
      alert('국립중앙도서관 API 인증키가 저장되었습니다. 이제 국내 도서를 검색해 보세요!');
    });
  }

  if (apiSearchQuery && btnClearApiSearch) {
    apiSearchQuery.addEventListener('input', () => {
      btnClearApiSearch.style.display = apiSearchQuery.value.length > 0 ? 'flex' : 'none';
    });
    btnClearApiSearch.addEventListener('click', () => {
      apiSearchQuery.value = '';
      btnClearApiSearch.style.display = 'none';
      apiSearchQuery.focus();
    });
  }

  if (apiBookSearchForm) {
    apiBookSearchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = apiSearchQuery.value.trim();
      if (!query) return;
      const region = document.getElementById('apiRegionSelect')?.value || 'all';
      const loadingEl = document.getElementById('apiSearchLoading');
      const btnRun = document.getElementById('btnRunApiSearch');

      if (loadingEl) loadingEl.style.display = 'flex';
      if (btnRun) btnRun.disabled = true;

      try {
        const items = await performCombinedBookSearch(query, region);
        renderApiSearchResults(items);
      } catch (err) {
        console.error('[Books] Search error:', err);
      } finally {
        if (loadingEl) loadingEl.style.display = 'none';
        if (btnRun) btnRun.disabled = false;
      }
    });
  }

  if (apiSearchResults) {
    apiSearchResults.addEventListener('click', async (e) => {
      const toReadBtn = e.target.closest('.btn-pick-to-read');
      const readBtn = e.target.closest('.btn-pick-read');
      const editFirstBtn = e.target.closest('.btn-pick-edit-first');

      if (toReadBtn || readBtn) {
        const activeBtn = toReadBtn || readBtn;
        const idx = parseInt(activeBtn.getAttribute('data-idx'), 10);
        const candidate = apiSearchCandidates[idx];
        if (!candidate) return;

        activeBtn.disabled = true;
        const origLabel = activeBtn.textContent;
        activeBtn.textContent = '추가 중...';

        // 도서검색 API 및 Supabase 프록시에서 표지 이미지(cover_url)·목차(toc)·출간일 자동 조회 후 함께 저장
        const detail = await fetchBookDetailAndTocFromApis(candidate);
        const resolvedToc = detail.toc || candidate.toc || '';
        const resolvedCover = detail.cover_url || candidate.cover_url || '';
        const resolvedPubDate =
          detail.pub_date && detail.pub_date.length >= (candidate.pub_date || '').length
            ? detail.pub_date
            : (candidate.pub_date || '');

        const targetStatus = readBtn ? 'read' : 'to_read';
        await insertBookToDb({
          ...candidate,
          cover_url: resolvedCover,
          pub_date: resolvedPubDate,
          toc: resolvedToc,
          status: targetStatus,
          completed_date: targetStatus === 'read' ? getTodayDateString() : ''
        });

        activeBtn.disabled = false;
        activeBtn.textContent = origLabel;

        currentStatusTab = targetStatus;
        document.querySelectorAll('.status-tab').forEach(t => {
          const match = t.getAttribute('data-status') === targetStatus;
          t.classList.toggle('active', match);
          t.setAttribute('aria-selected', String(match));
        });

        document.getElementById('bookSearchDialog')?.close();
        renderBooksView(false);
        return;
      }

      if (editFirstBtn) {
        const idx = parseInt(editFirstBtn.getAttribute('data-idx'), 10);
        const candidate = apiSearchCandidates[idx];
        if (candidate) await fillManualFormWithCandidate(candidate);
      }
    });
  }

  if (manualCoverUrl) {
    manualCoverUrl.addEventListener('input', () => updateManualCoverPreview(manualCoverUrl.value));
  }

  async function submitManualBook(targetStatus) {
    const titleEl = document.getElementById('manualTitle');
    const title = titleEl?.value.trim();
    if (!title) {
      alert('책이름(제목)을 입력해 주세요.');
      titleEl?.focus();
      return;
    }

    const author = document.getElementById('manualAuthor')?.value.trim() || '';
    let coverUrl = document.getElementById('manualCoverUrl')?.value.trim() || '';
    let toc = document.getElementById('manualToc')?.value.trim() || '';
    if (!toc || !coverUrl) {
      const detail = await fetchBookDetailAndTocFromApis({ title, author, cover_url: coverUrl, toc });
      if (!toc && detail.toc) toc = detail.toc;
      if (!coverUrl && detail.cover_url) coverUrl = detail.cover_url;
    }

    await insertBookToDb({
      status: targetStatus,
      title,
      author,
      publisher: document.getElementById('manualPublisher')?.value.trim() || '',
      pub_date: document.getElementById('manualPubDate')?.value.trim() || '',
      cover_url: coverUrl,
      toc,
      completed_date: targetStatus === 'read'
        ? (document.getElementById('manualCompletedDate')?.value || getTodayDateString())
        : '',
      rating: parseFloat(document.getElementById('manualRating')?.value) || 0
    });

    document.getElementById('manualBookForm')?.reset();
    const manualTocEl = document.getElementById('manualToc');
    if (manualTocEl) manualTocEl.value = '';
    updateManualCoverPreview('');

    currentStatusTab = targetStatus;
    document.querySelectorAll('.status-tab').forEach(t => {
      const match = t.getAttribute('data-status') === targetStatus;
      t.classList.toggle('active', match);
      t.setAttribute('aria-selected', String(match));
    });

    document.getElementById('bookSearchDialog')?.close();
    renderBooksView(false);
  }

  if (btnAddManualToRead) {
    btnAddManualToRead.addEventListener('click', () => submitManualBook('to_read'));
  }
  if (btnAddManualRead) {
    btnAddManualRead.addEventListener('click', () => submitManualBook('read'));
  }
}

// ══════════════════════════════════════════════════════
// 12. 도서 정보 수정 모달 이벤트
// ══════════════════════════════════════════════════════
function openEditBookModal(bookId) {
  const book = books.find(b => String(b.id) === String(bookId));
  if (!book) return;

  document.getElementById('editBookId').value = book.id;
  document.getElementById('editTitle').value = book.title || '';
  document.getElementById('editAuthor').value = book.author || '';
  document.getElementById('editPublisher').value = book.publisher || '';
  document.getElementById('editPubDate').value = book.pub_date || '';
  document.getElementById('editCoverUrl').value = book.cover_url || '';
  document.getElementById('editStatus').value = book.status || 'to_read';
  document.getElementById('editCompletedDate').value = book.completed_date || '';
  document.getElementById('editRating').value = book.rating || 0;

  updateEditCoverPreview(book.cover_url || '');

  const dlg = document.getElementById('bookEditDialog');
  if (dlg) dlg.showModal();
}

function updateEditCoverPreview(url) {
  const img = document.getElementById('editCoverPreviewImg');
  const ph = document.getElementById('editCoverPlaceholder');
  if (!img || !ph) return;
  if (url && url.trim()) {
    img.src = url.trim();
    img.style.display = 'block';
    ph.style.display = 'none';
    img.onerror = () => {
      img.style.display = 'none';
      ph.style.display = 'block';
    };
  } else {
    img.src = '';
    img.style.display = 'none';
    ph.style.display = 'block';
  }
}

function bindEditModalEvents() {
  const editForm = document.getElementById('bookEditForm');
  const editCoverUrl = document.getElementById('editCoverUrl');
  const btnDeleteFromEditModal = document.getElementById('btnDeleteFromEditModal');

  if (editCoverUrl) {
    editCoverUrl.addEventListener('input', () => updateEditCoverPreview(editCoverUrl.value));
  }

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bookId = document.getElementById('editBookId').value;
      if (!bookId) return;

      const nextStatus = document.getElementById('editStatus').value;
      let nextCompleted = document.getElementById('editCompletedDate').value;
      if (nextStatus === 'read' && !nextCompleted) {
        nextCompleted = getTodayDateString();
      }

      await updateBookInDb(bookId, {
        title: document.getElementById('editTitle').value.trim(),
        author: document.getElementById('editAuthor').value.trim(),
        publisher: document.getElementById('editPublisher').value.trim(),
        pub_date: document.getElementById('editPubDate').value.trim(),
        cover_url: document.getElementById('editCoverUrl').value.trim(),
        status: nextStatus,
        completed_date: nextCompleted,
        rating: parseFloat(document.getElementById('editRating').value) || 0
      });

      document.getElementById('bookEditDialog')?.close();
      renderBooksView(false);

      if (activeDetailBookId && String(activeDetailBookId) === String(bookId)) {
        renderBookDetailContent(bookId);
      }
    });
  }

  if (btnDeleteFromEditModal) {
    btnDeleteFromEditModal.addEventListener('click', async () => {
      const bookId = document.getElementById('editBookId').value;
      const book = books.find(b => String(b.id) === String(bookId));
      if (!book) return;
      if (!confirm(`'${book.title}' 도서를 정말 삭제하시겠습니까?`)) return;

      await deleteBooksFromDb([bookId]);
      document.getElementById('bookEditDialog')?.close();
      document.getElementById('bookDetailDialog')?.close();
      renderBooksView(false);
    });
  }
}

// ══════════════════════════════════════════════════════
// 13. 책 상세 페이지 (목차, 문장 수집[페이지 추가], 독서 메모, 별점)
// ══════════════════════════════════════════════════════
function openBookDetailModal(bookId) {
  activeDetailBookId = bookId;
  renderBookDetailContent(bookId);
  const dlg = document.getElementById('bookDetailDialog');
  if (dlg && !dlg.open) dlg.showModal();

  // 표지 이미지나 목차 정보가 비어 있으면 도서검색 API 및 Supabase 프록시에서 자동으로 조회 시도
  const book = books.find(b => String(b.id) === String(bookId));
  if (book && (!book.toc || !book.cover_url)) {
    fetchAndSaveBookToc(bookId, { silentIfEmpty: true });
  }
}

function renderDetailTocView(book) {
  const tocView = document.getElementById('detailTocView');
  if (!tocView) return;

  const query = (document.getElementById('listSearchInput')?.value || '').trim();
  if (book.toc && book.toc.trim()) {
    tocView.innerHTML = highlightMatch(book.toc.trim(), query);
  } else {
    tocView.innerHTML = `<div class="toc-empty-msg">목차 정보가 없습니다. 상단 ⚙️ 설정의 Supabase 프록시 SQL 실행 후 <strong>'🔄 표지·목차 가져오기'</strong>를 눌러 보세요.</div>`;
  }
}

async function fetchAndSaveBookToc(bookId, { silentIfEmpty = false } = {}) {
  const book = books.find(b => String(b.id) === String(bookId));
  if (!book) return;

  const statusSpan = document.getElementById('tocFetchStatus');
  const btnFetch = document.getElementById('btnFetchTocFromApi');
  const tocView = document.getElementById('detailTocView');

  if (statusSpan) statusSpan.textContent = '표지·목차 조회 중...';
  if (btnFetch) btnFetch.disabled = true;
  if (tocView && !book.toc) {
    tocView.innerHTML = `<div class="toc-empty-msg">도서 검색 API 및 프록시에서 표지·목차를 불러오는 중입니다...</div>`;
  }

  try {
    const detail = await fetchBookDetailAndTocFromApis({
      title: book.title,
      author: book.author,
      cover_url: book.cover_url,
      pub_date: book.pub_date,
      toc: ''
    });

    const updates = {};
    if (detail.toc) updates.toc = detail.toc;
    if (!book.cover_url && detail.cover_url) updates.cover_url = detail.cover_url;
    if (detail.pub_date && detail.pub_date.length > (book.pub_date || '').length) {
      updates.pub_date = detail.pub_date;
    }

    if (Object.keys(updates).length > 0) {
      const updated = await updateBookInDb(bookId, updates);
      if (String(activeDetailBookId) === String(bookId) && updated) {
        renderBookDetailContent(bookId);
      }
      if (statusSpan) {
        statusSpan.textContent = '✓ 표지·목차 연동 완료';
        setTimeout(() => { statusSpan.textContent = ''; }, 2500);
      }
      renderBooksView(false);
    } else {
      if (String(activeDetailBookId) === String(bookId)) {
        renderDetailTocView(book);
      }
      if (statusSpan) {
        statusSpan.textContent = silentIfEmpty ? '' : '목차 정보 없음';
        if (!silentIfEmpty) {
          setTimeout(() => { statusSpan.textContent = ''; }, 2500);
        }
      }
    }
  } catch (err) {
    console.warn('[Books] TOC API fetch warning:', err);
    if (statusSpan) statusSpan.textContent = '';
    if (String(activeDetailBookId) === String(bookId)) {
      renderDetailTocView(book);
    }
  } finally {
    if (btnFetch) btnFetch.disabled = false;
  }
}

function renderBookDetailContent(bookId) {
  const book = books.find(b => String(b.id) === String(bookId));
  if (!book) return;

  const statusBadge = document.getElementById('detailStatusBadge');
  const btnToggleStatus = document.getElementById('btnToggleDetailStatus');
  if (statusBadge) {
    statusBadge.className = `status-pill ${book.status === 'read' ? 'read' : 'to-read'}`;
    statusBadge.textContent = book.status === 'read' ? '✅ 읽은 책' : '📌 읽을 책';
  }
  if (btnToggleStatus) {
    btnToggleStatus.textContent = book.status === 'read' ? '📌 읽을 책으로 이동' : '✅ 읽은 책으로 이동';
  }

  const coverImg = document.getElementById('detailCoverImg');
  const coverFallback = document.getElementById('detailCoverFallback');
  if (book.cover_url) {
    coverImg.src = book.cover_url;
    coverImg.style.display = 'block';
    coverFallback.style.display = 'none';
    coverImg.onerror = () => {
      coverImg.style.display = 'none';
      coverFallback.style.display = 'block';
    };
  } else {
    coverImg.src = '';
    coverImg.style.display = 'none';
    coverFallback.style.display = 'block';
  }

  document.getElementById('detailBookTitle').textContent = book.title || '제목 미상';
  document.getElementById('detailBookAuthor').textContent = book.author || '저자 미상';
  document.getElementById('detailBookPublisher').textContent = book.publisher || '-';
  document.getElementById('detailBookPubDate').textContent = book.pub_date || '-';
  document.getElementById('detailCompletedDateInput').value = book.completed_date || '';

  renderDetailStars(book.rating || 0);

  // 목차(toc - 도서검색 API 연동) 및 독서 메모(memo) 렌더링
  const tocStatus = document.getElementById('tocFetchStatus');
  if (tocStatus) tocStatus.textContent = '';
  renderDetailTocView(book);

  document.getElementById('detailGeneralMemo').value = book.memo || '';
  document.getElementById('memoSaveStatus').textContent = '';

  resetQuoteForm();
  renderDetailQuotesList(book);
}

function renderDetailStars(rating) {
  const numRating = Math.min(5, Math.max(0, parseFloat(rating) || 0));
  const valEl = document.getElementById('detailRatingValue');
  if (valEl) valEl.textContent = numRating.toFixed(1);

  document.querySelectorAll('#detailStarWidget .star-btn').forEach(btn => {
    const starVal = parseInt(btn.getAttribute('data-star'), 10);
    btn.classList.remove('filled', 'half');
    if (numRating >= starVal) {
      btn.classList.add('filled');
    } else if (numRating >= starVal - 0.5) {
      btn.classList.add('half');
    }
  });
}

function renderDetailQuotesList(book) {
  const listEl = document.getElementById('detailQuotesList');
  const countEl = document.getElementById('detailQuotesCount');
  const sortMode = document.getElementById('quoteSortSelect')?.value || 'page_asc';
  const query = (document.getElementById('listSearchInput')?.value || '').trim();

  const quotes = Array.isArray(book.quotes) ? [...book.quotes] : [];
  if (countEl) countEl.textContent = quotes.length;

  if (quotes.length === 0) {
    if (listEl) {
      listEl.innerHTML = `<div class="api-search-placeholder" style="padding: 20px;">수집된 문장이 없습니다. 위 입력창에 페이지 번호와 문장을 추가해 보세요.</div>`;
    }
    return;
  }

  if (sortMode === 'page_asc') {
    quotes.sort((a, b) => {
      const pA = parseInt(String(a.page).replace(/[^0-9]/g, ''), 10) || 999999;
      const pB = parseInt(String(b.page).replace(/[^0-9]/g, ''), 10) || 999999;
      if (pA !== pB) return pA - pB;
      return String(a.created_at).localeCompare(String(b.created_at));
    });
  } else {
    quotes.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  listEl.innerHTML = quotes.map(q => `
    <div class="quote-card-item" data-quote-id="${escapeHtml(q.id)}">
      <div class="quote-card-header">
        <span class="quote-page-badge">${q.page ? `p. ${escapeHtml(q.page)}` : '페이지 미지정'}</span>
        <div class="quote-card-actions">
          <button type="button" class="card-icon-btn btn-copy-quote" data-quote-id="${escapeHtml(q.id)}" title="문장 복사">📋</button>
          <button type="button" class="card-icon-btn btn-edit-quote" data-quote-id="${escapeHtml(q.id)}" title="문장 수정">✏️</button>
          <button type="button" class="card-icon-btn danger btn-delete-quote" data-quote-id="${escapeHtml(q.id)}" title="문장 삭제">🗑️</button>
        </div>
      </div>
      <div class="quote-card-text">"${highlightMatch(q.text, query)}"</div>
      ${q.note ? `<div class="quote-card-note">💡 ${highlightMatch(q.note, query)}</div>` : ''}
    </div>
  `).join('');
}

function resetQuoteForm() {
  document.getElementById('editingQuoteId').value = '';
  document.getElementById('inputQuotePage').value = '';
  document.getElementById('inputQuoteNote').value = '';
  document.getElementById('inputQuoteText').value = '';
  document.getElementById('btnSubmitQuote').textContent = '＋ 문장 추가';
  document.getElementById('btnCancelEditQuote').style.display = 'none';
}

function bindDetailModalEvents() {
  const btnToggleDetailStatus = document.getElementById('btnToggleDetailStatus');
  const btnEditFromDetail = document.getElementById('btnEditFromDetail');
  const btnDeleteFromDetail = document.getElementById('btnDeleteFromDetail');
  const starWidget = document.getElementById('detailStarWidget');
  const btnResetRating = document.getElementById('btnResetRating');
  const completedDateInput = document.getElementById('detailCompletedDateInput');
  const quoteSortSelect = document.getElementById('quoteSortSelect');
  const quoteAddForm = document.getElementById('quoteAddForm');
  const btnCancelEditQuote = document.getElementById('btnCancelEditQuote');
  const detailQuotesList = document.getElementById('detailQuotesList');
  const btnFetchTocFromApi = document.getElementById('btnFetchTocFromApi');
  const btnSaveGeneralMemo = document.getElementById('btnSaveGeneralMemo');
  const detailGeneralMemo = document.getElementById('detailGeneralMemo');

  if (btnToggleDetailStatus) {
    btnToggleDetailStatus.addEventListener('click', async () => {
      if (!activeDetailBookId) return;
      const book = books.find(b => String(b.id) === String(activeDetailBookId));
      if (!book) return;

      const nextStatus = book.status === 'to_read' ? 'read' : 'to_read';
      const nextCompleted = nextStatus === 'read'
        ? (book.completed_date || getTodayDateString())
        : book.completed_date;

      await updateBookInDb(activeDetailBookId, { status: nextStatus, completed_date: nextCompleted });
      renderBookDetailContent(activeDetailBookId);
      renderBooksView(false);
    });
  }

  if (btnEditFromDetail) {
    btnEditFromDetail.addEventListener('click', () => {
      if (activeDetailBookId) openEditBookModal(activeDetailBookId);
    });
  }

  if (btnDeleteFromDetail) {
    btnDeleteFromDetail.addEventListener('click', async () => {
      if (!activeDetailBookId) return;
      const book = books.find(b => String(b.id) === String(activeDetailBookId));
      if (!book) return;
      if (!confirm(`'${book.title}' 도서를 정말 삭제하시겠습니까?`)) return;

      await deleteBooksFromDb([activeDetailBookId]);
      document.getElementById('bookDetailDialog')?.close();
      renderBooksView(false);
    });
  }

  if (starWidget) {
    starWidget.addEventListener('click', async (e) => {
      const starBtn = e.target.closest('.star-btn');
      if (!starBtn || !activeDetailBookId) return;
      const book = books.find(b => String(b.id) === String(activeDetailBookId));
      if (!book) return;

      const clickedStar = parseInt(starBtn.getAttribute('data-star'), 10);
      let newRating = clickedStar;
      if (book.rating === clickedStar) {
        newRating = clickedStar - 0.5;
      }

      renderDetailStars(newRating);
      await updateBookInDb(activeDetailBookId, { rating: newRating });
      renderBooksView(false);
    });
  }

  if (btnResetRating) {
    btnResetRating.addEventListener('click', async () => {
      if (!activeDetailBookId) return;
      renderDetailStars(0);
      await updateBookInDb(activeDetailBookId, { rating: 0 });
      renderBooksView(false);
    });
  }

  if (completedDateInput) {
    completedDateInput.addEventListener('change', async () => {
      if (!activeDetailBookId) return;
      await updateBookInDb(activeDetailBookId, { completed_date: completedDateInput.value });
      renderBooksView(false);
    });
  }

  if (quoteSortSelect) {
    quoteSortSelect.addEventListener('change', () => {
      const book = books.find(b => String(b.id) === String(activeDetailBookId));
      if (book) renderDetailQuotesList(book);
    });
  }

  if (quoteAddForm) {
    quoteAddForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeDetailBookId) return;
      const book = books.find(b => String(b.id) === String(activeDetailBookId));
      if (!book) return;

      const pageVal = document.getElementById('inputQuotePage').value.trim();
      const noteVal = document.getElementById('inputQuoteNote').value.trim();
      const textVal = document.getElementById('inputQuoteText').value.trim();
      const editingId = document.getElementById('editingQuoteId').value;

      if (!textVal) return;

      const nextQuotes = Array.isArray(book.quotes) ? [...book.quotes] : [];
      if (editingId) {
        const qIdx = nextQuotes.findIndex(q => String(q.id) === String(editingId));
        if (qIdx !== -1) {
          nextQuotes[qIdx] = {
            ...nextQuotes[qIdx],
            page: pageVal,
            note: noteVal,
            text: textVal
          };
        }
      } else {
        nextQuotes.push({
          id: `q_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          page: pageVal,
          text: textVal,
          note: noteVal,
          created_at: new Date().toISOString()
        });
      }

      const updatedBook = await updateBookInDb(activeDetailBookId, { quotes: nextQuotes });
      resetQuoteForm();
      if (updatedBook) renderDetailQuotesList(updatedBook);
      renderBooksView(false);
    });
  }

  if (btnCancelEditQuote) {
    btnCancelEditQuote.addEventListener('click', resetQuoteForm);
  }

  if (detailQuotesList) {
    detailQuotesList.addEventListener('click', async (e) => {
      if (!activeDetailBookId) return;
      const book = books.find(b => String(b.id) === String(activeDetailBookId));
      if (!book) return;

      const copyBtn = e.target.closest('.btn-copy-quote');
      if (copyBtn) {
        const qid = copyBtn.getAttribute('data-quote-id');
        const q = (book.quotes || []).find(item => String(item.id) === String(qid));
        if (q) {
          const formatted = `"${q.text}" — 『${book.title}』${q.page ? ` (p.${q.page})` : ''}`;
          await navigator.clipboard?.writeText(formatted);
          copyBtn.textContent = '✅';
          setTimeout(() => { copyBtn.textContent = '📋'; }, 1200);
        }
        return;
      }

      const editBtn = e.target.closest('.btn-edit-quote');
      if (editBtn) {
        const qid = editBtn.getAttribute('data-quote-id');
        const q = (book.quotes || []).find(item => String(item.id) === String(qid));
        if (q) {
          document.getElementById('editingQuoteId').value = q.id;
          document.getElementById('inputQuotePage').value = q.page || '';
          document.getElementById('inputQuoteNote').value = q.note || '';
          document.getElementById('inputQuoteText').value = q.text || '';
          document.getElementById('btnSubmitQuote').textContent = '💾 문장 수정 저장';
          document.getElementById('btnCancelEditQuote').style.display = 'inline-flex';
          document.getElementById('inputQuoteText').focus();
        }
        return;
      }

      const delBtn = e.target.closest('.btn-delete-quote');
      if (delBtn) {
        const qid = delBtn.getAttribute('data-quote-id');
        if (!confirm('이 수집 문장을 삭제하시겠습니까?')) return;
        const nextQuotes = (book.quotes || []).filter(item => String(item.id) !== String(qid));
        const updatedBook = await updateBookInDb(activeDetailBookId, { quotes: nextQuotes });
        if (updatedBook) renderDetailQuotesList(updatedBook);
        renderBooksView(false);
      }
    });
  }

  // 도서검색 API에서 목차 다시 가져오기
  if (btnFetchTocFromApi) {
    btnFetchTocFromApi.addEventListener('click', () => {
      if (activeDetailBookId) {
        fetchAndSaveBookToc(activeDetailBookId, { silentIfEmpty: false });
      }
    });
  }

  // 독서 메모 저장
  async function saveGeneralMemoNow() {
    if (!activeDetailBookId) return;
    const memoVal = detailGeneralMemo.value.trim();
    await updateBookInDb(activeDetailBookId, { memo: memoVal });
    const statusSpan = document.getElementById('memoSaveStatus');
    if (statusSpan) {
      statusSpan.textContent = '✓ 저장됨';
      setTimeout(() => { statusSpan.textContent = ''; }, 2000);
    }
    renderBooksView(false);
  }

  if (btnSaveGeneralMemo) {
    btnSaveGeneralMemo.addEventListener('click', saveGeneralMemoNow);
  }

  if (detailGeneralMemo) {
    detailGeneralMemo.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveGeneralMemoNow();
      }
    });
  }
}

// ══════════════════════════════════════════════════════
// 14. 도서 검색 API 설정 모달 (국립중앙도서관 API)
// ══════════════════════════════════════════════════════
function bindSettingsModalEvents() {
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const settingsDialog = document.getElementById('booksSettingsDialog');
  const btnSaveApiKeys = document.getElementById('btnSaveApiKeys');
  const btnCopyProxySql = document.getElementById('btnCopyProxySql');

  function openSettings() {
    const keys = getSavedApiKeys();
    const nlkInput = document.getElementById('inputNlkApiKey');
    const googleInput = document.getElementById('inputGoogleBooksKey');
    if (nlkInput) nlkInput.value = keys.nlkKey || '';
    if (googleInput) googleInput.value = keys.googleKey || '';
    settingsDialog?.showModal();
  }

  if (btnOpenSettings) btnOpenSettings.addEventListener('click', openSettings);

  if (btnCopyProxySql) {
    btnCopyProxySql.addEventListener('click', async () => {
      const codeEl = document.getElementById('supabaseProxySqlCode');
      if (!codeEl) return;
      await navigator.clipboard?.writeText(codeEl.textContent);
      const orig = btnCopyProxySql.textContent;
      btnCopyProxySql.textContent = '✅ 복사 완료!';
      setTimeout(() => { btnCopyProxySql.textContent = orig; }, 2000);
    });
  }

  if (btnSaveApiKeys) {
    btnSaveApiKeys.addEventListener('click', () => {
      const nlkKey = document.getElementById('inputNlkApiKey')?.value.trim() || '';
      const googleKey = document.getElementById('inputGoogleBooksKey')?.value.trim() || '';
      saveApiKeys({ nlkKey, googleKey });
      settingsDialog?.close();
      alert('국립중앙도서관 API 설정이 저장되었습니다.');
    });
  }
}
