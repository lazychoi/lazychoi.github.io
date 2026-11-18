// Supabase Client Initialization (용어노트, 가계도앱과 동일)
const supabaseUrl = 'https://tpwwwpcbinxdhxqvcvqc.supabase.co';
const supabaseKey = 'sb_publishable_A1sd3hvbeQx9-gVoFXL0qA_G923SWm9';
const supabaseClient = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

let isLoggedIn = false;

// 인증 관련 DOM 요소
const authStatusText = document.getElementById('authStatusText');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const loginDialog = document.getElementById('loginDialog');
const loginForm = document.getElementById('loginForm');
const btnCancelLogin = document.getElementById('btnCancelLogin');
const btnSubmitLogin = document.getElementById('btnSubmitLogin');
const loginError = document.getElementById('loginError');

const input = document.getElementById('koreanInput');
const resultList = document.getElementById('resultList');
const statusText = document.getElementById('status');
const meaningDisplay = document.getElementById('meaningDisplay');
const toast = document.getElementById('toast');

// 탭 버튼 및 패널 요소
const tabSearchBtn = document.getElementById('tabSearchBtn');
const tabDrawBtn = document.getElementById('tabDrawBtn');
const tabFilterBtn = document.getElementById('tabFilterBtn');
const panelSearch = document.getElementById('panelSearch');
const panelDraw = document.getElementById('panelDraw');
const panelFilter = document.getElementById('panelFilter');

// 상세 보기 패널 요소
const panelDetail = document.getElementById('panelDetail');
const detailHanja = document.getElementById('detailHanja');
const detailStroke = document.getElementById('detailStroke');
const detailKorean = document.getElementById('detailKorean');
const detailMeaning = document.getElementById('detailMeaning');
const backToSearchBtn = document.getElementById('backToSearchBtn');

let prevStatusText = '';
let currentTabMode = 'search';

let toastTimeout;
const hanjaMap = new Map();
const strokeMap = new Map();
const hanjaList = []; // 평탄화된 단일 한자 목록 { korean, hanja, meaning, file }
const hanjaListIndexMap = new Map(); // `${hanja}_${korean}` -> hanjaList 인덱스
let currentDetailItem = null; // 현재 상세 보기 중인 한자 아이템
let firstStageLoaded = false;
let allFilesLoaded = false;
let pendingSupabaseSyncItems = []; // 로컬 사전이 더 상세하거나 Supabase에 아직 미등록된 항목
let isSyncingPending = false;
let supabaseSyncCompleted = false;

// ── IndexedDB & 실시간 동기화 상태 ──
const HANJA_IDB_NAME = 'hanja_dict_cache_db';
const HANJA_IDB_VERSION = 1;
const HANJA_IDB_OVERRIDES_STORE = 'overrides';
const HANJA_IDB_META_STORE = 'meta';
const HANJA_LEGACY_LS_KEY = 'hanja_dict_overrides';
const HANJA_RECENT_LS_KEY = 'hanja_dict_recent_overrides';
const HANJA_RECENT_LS_MAX = 100;
const KOREAN_QUERY_COOLDOWN_MS = 2000;

let hanjaCacheDBPromise = null;
const overrideCacheMap = new Map(); // `${hanja}_${korean}` -> { id, hanja, korean, meaning, updated_at, preferRemote }
const knownSupabaseKeys = new Set(); // Supabase DB에 존재함이 확인된 `${hanja}_${korean}` 키 집합
let supabaseBaselineLoaded = false;
let loadHanjaOverridesPromise = null;
let syncRecentPromise = null;
let lastRecentSyncAtMs = 0;

const inFlightKoreanQueries = new Map();
const recentKoreanQueryTimestamps = new Map();
const inFlightSingleHanjaQueries = new Map();
let searchDebounceTimer = null;
let currentSearchSeq = 0;
let detailViewRequestSeq = 0;

const SEARCH_PLACEHOLDER_LOGGED_IN = '한글 음 또는 한자 뜻 입력 (예: 가관, 하늘)';
const SEARCH_PLACEHOLDER_LOGGED_OUT = '로그인 후 사용할 수 있습니다';

function upsertSingleCharInList(korean, hanja, meaning, file) {
  if (!hanja || hanja.length !== 1) return;
  const key = `${hanja}_${korean}`;
  if (hanjaListIndexMap.has(key)) {
    const idx = hanjaListIndexMap.get(key);
    hanjaList[idx].meaning = meaning;
    if (file && !hanjaList[idx].file) {
      hanjaList[idx].file = file;
    }
  } else {
    hanjaListIndexMap.set(key, hanjaList.length);
    hanjaList.push({ korean, hanja, meaning, file: file || '' });
  }
}

// 부수 데이터용 전역 변수
const radicalsList = []; // 214개 부수 메타데이터
const characterRadicalsMap = new Map(); // 한자 -> [radical_number, remaining_strokes]

// 파일 하나를 fetch → 파싱 → hanjaMap 및 hanjaList에 추가
async function fetchAndParseFile(file) {
  const response = await fetch(`data/${file}`);
  const arrayBuffer = await response.arrayBuffer();

  // Auto-detect encoding: check for UTF-16LE BOM (FF FE)
  const uint8Array = new Uint8Array(arrayBuffer);
  let decoder;
  if (uint8Array.length >= 2 && uint8Array[0] === 0xff && uint8Array[1] === 0xfe) {
    decoder = new TextDecoder('utf-16le');
  } else {
    decoder = new TextDecoder('utf-8');
  }

  const text = decoder.decode(arrayBuffer);
  text.split('\n').forEach(line => {
    const parts = line.trim().split('|');
    if (parts.length >= 2) {
      const korean = parts[0];
      const hanja = parts[1];
      const meaning = parts.slice(2).join('|') || '';
      
      // hanjaMap에 추가 (같은 파일/이전 로드에서 이미 채워진 뜻을 빈 뜻이 덮어쓰지 않도록 보호,
      // 실시간 DB 조회/수정이 이미 반영된 경우에는 그 뜻을 유지)
      if (!hanjaMap.has(korean)) {
        hanjaMap.set(korean, new Map());
      }
      const inner = hanjaMap.get(korean);
      const prev = inner.get(hanja);
      const keepPrevRemote = Boolean(prev && prev.preferRemote && prev.meaning);
      const effectiveMeaning = keepPrevRemote
        ? prev.meaning
        : (meaning || (prev && prev.meaning) || '');
      inner.set(hanja, {
        meaning: effectiveMeaning,
        file,
        preferRemote: Boolean(prev && prev.preferRemote)
      });

      // 평탄화된 목록에 추가 (단일 한자만 대상)
      if (hanja.length === 1) {
        upsertSingleCharInList(korean, hanja, effectiveMeaning, file);
      }
    }
  });
}

async function initApp() {
  try {
    if (isLoggedIn) {
      statusText.textContent = '사전 데이터 불러오는 중...';
      statusText.classList.add('show');
    }

    // manifest.json fetch
    const manifestResponse = await fetch('data/manifest.json');
    if (!manifestResponse.ok) {
      throw new Error('manifest.json을 찾을 수 없습니다. 배포 전 build.js를 실행했는지 확인하세요.');
    }
    const files = await manifestResponse.json();

    const PRIORITY_FILES = ['h11ka.txt']; // 크기가 작아 빨리 로드되는 파일
    const remainingFiles = files.filter(f => !PRIORITY_FILES.includes(f));

    // strokes + 부수 목록 + 캐릭터 부수 매핑 + 우선순위 파일을 병렬로 fetch
    const strokesPromise = fetch('data/strokes.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          for (const [char, count] of Object.entries(data)) {
            strokeMap.set(char, count);
          }
        }
      })
      .catch(e => console.warn('Failed to load strokes.json', e));

    const radicalsListPromise = fetch('data/radicals_list.json')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        radicalsList.push(...data);
      })
      .catch(e => console.warn('Failed to load radicals_list.json', e));

    const characterRadicalsPromise = fetch('data/character_radicals.json')
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        for (const [char, val] of Object.entries(data)) {
          characterRadicalsMap.set(char, val);
        }
      })
      .catch(e => console.warn('Failed to load character_radicals.json', e));

    const priorityPromises = PRIORITY_FILES.map(f => fetchAndParseFile(f));

    // 1단계 완료 대기
    await Promise.all([strokesPromise, radicalsListPromise, characterRadicalsPromise, ...priorityPromises]);
    firstStageLoaded = true;

    // 부수 검색 데이터 구축 완료 시 UI 렌더링 호출
    initRadicalSearch();

    // ── 1단계 완료 시점에 이미 저장된 커스텀 뜻 오버라이드 1차 적용 ──
    loadHanjaOverridesFromSupabase();

    // ── 로그인 상태에 따른 입력창 및 UI 상태 동기화 ──
    updateAppAuthState();

    // 2단계: 나머지 파일들을 모두 병렬로 fetch (백그라운드)
    const remainingPromises = remainingFiles.map(f => fetchAndParseFile(f));

    // 백그라운드 로딩 — 사용자는 이미 검색 가능
    Promise.all(remainingPromises)
      .then(() => {
        allFilesLoaded = true;
        if (
          isLoggedIn &&
          currentTabMode === 'search' &&
          !input.value.trim() &&
          !(panelDetail && panelDetail.classList.contains('active'))
        ) {
          statusText.textContent = '입력 대기 중...';
        }
        // 전체 텍스트 파일 로드 완료 후 캐시된 Supabase 오버라이드 재적용 및 미등록 항목 동기화
        reapplyCachedOverridesAfterAllFilesLoaded();
      })
      .catch(err => {
        console.error('일부 사전 파일 로딩 실패:', err);
        if (isLoggedIn) {
          statusText.textContent = '일부 사전 파일 로딩 실패';
        }
      });

  } catch (error) {
    console.error(error);
    if (isLoggedIn) {
      statusText.textContent = '데이터 로딩 실패: ' + error.message;
    }
  }
}

function findHanja(word) {
  if (!hanjaMap.has(word)) return [];
  return Array.from(hanjaMap.get(word).entries()).map(([hanja, obj]) => {
    return { hanja, meaning: obj.meaning, file: obj.file, korean: word };
  });
}

// 뜻/훈으로 한자 검색 (중복 제거)
function findHanjaByMeaning(query) {
  const results = [];
  const seen = new Set();
  
  for (const item of hanjaList) {
    if (item.meaning && item.meaning.includes(query)) {
      const key = `${item.hanja}-${item.korean}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    }
  }
  return results;
}

// 한자 획수 정보 가져오기 (부수 정보가 있을 경우 어노테이션 추가)
function getStrokeInfo(hanja) {
  const chars = Array.from(hanja); // 유니코드 안전 분리
  let total = 0;
  let hasUnknown = false;
  const parts = chars.map(char => {
    const count = strokeMap.get(char);
    if (count !== undefined) {
      total += count;
      return `${char} ${count}`;
    } else {
      hasUnknown = true;
      return `${char} ?`;
    }
  });

  if (chars.length === 1) {
    const radInfo = characterRadicalsMap.get(hanja);
    if (radInfo && radicalsList.length > 0) {
      const radId = radInfo[0];
      const remStrokes = radInfo[1];
      const radObj = radicalsList.find(r => r.id === radId);
      if (radObj) {
        let radDisp = radObj.radical;
        if (radObj.variants) {
          radDisp += `(${radObj.variants.split(', ')[0]})`;
        }
        return `${total}획 [부수: ${radDisp} ${radObj.name} + ${remStrokes}획]`;
      }
    }
    return hasUnknown ? '획수 정보 없음' : `${total}획`;
  } else {
    const detail = parts.join(' + ');
    return hasUnknown ? `총 ?획 (${detail})` : `총 ${total}획 (${detail})`;
  }
}

// ── Markdown 전처리, 안전한 HTML 정화(Sanitizer) 및 렌더링 ──
const HANJA_MARKDOWN_ALLOWED_ELEMENTS = [
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'del', 's', 'u', 'mark',
  'blockquote', 'ul', 'ol', 'li', 'code', 'pre', 'hr', 'a',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'img', 'figure', 'figcaption', 'span', 'div'
];
const HANJA_MARKDOWN_ALLOWED_ELEMENTS_SET = new Set(HANJA_MARKDOWN_ALLOWED_ELEMENTS);
const HANJA_MARKDOWN_ALLOWED_ATTRIBUTES = [
  'class', 'href', 'title', 'target', 'rel',
  'src', 'alt', 'loading', 'decoding', 'width', 'height',
  'align', 'colspan', 'rowspan', 'tabindex', 'role', 'aria-label'
];
const HANJA_MARKDOWN_DROPPED_CONTAINERS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math',
  'noscript', 'template', 'textarea', 'select', 'form', 'button'
]);

function escapeHanjaHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeHanjaMarkdownHref(rawHref) {
  if (!rawHref) return false;
  const cleaned = String(rawHref).replace(/[\u0000-\u001f\u007f\s]+/g, '').trim();
  if (!cleaned) return false;
  if (cleaned.startsWith('#') || (cleaned.startsWith('/') && !cleaned.startsWith('//'))) {
    return true;
  }
  return /^(https?:|mailto:)/i.test(cleaned);
}

function isSafeHanjaImageSrc(rawSrc) {
  if (!rawSrc) return false;
  const trimmed = String(rawSrc).trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return false;
  if (
    /^(?:\.?\/)?img\/[^?#]+(?:\?[^#]*)?$/i.test(trimmed) &&
    !trimmed.includes('..') &&
    !trimmed.startsWith('//')
  ) {
    return true;
  }
  const compact = trimmed.replace(/\s+/g, '');
  if (/^https?:\/\//i.test(compact)) {
    return true;
  }
  if (/^data:image\/(?:png|jpeg|jpg|gif|webp|bmp);base64,[a-z0-9+/=]+$/i.test(compact)) {
    return true;
  }
  return false;
}

function preprocessHanjaMarkdown(rawText) {
  if (!rawText) return '';
  let text = String(rawText)
    .replace(/\r\n?/g, '\n')
    .replace(/<\/br>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  // 1. [[파일명]] 태그를 표준 Markdown 이미지 문법으로 변환
  text = text.replace(/\[\[([^\]]+?)\]\]/g, (_, filename) => {
    const cleanName = filename.trim();
    if (!cleanName) return '';
    const src = cleanName.startsWith('img/') ? cleanName : `img/${cleanName}`;
    return `![${cleanName}](${src.replace(/ /g, '%20')})`;
  });

  // 2. 코드 블록 및 인라인 코드 보호
  const codeSpans = [];
  text = text.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    const token = `@@HMDSPAN${codeSpans.length}X@@`;
    codeSpans.push(match);
    return token;
  });

  // 3. 기존 사전 데이터의 <b>...</b> 및 유효한 자동 링크(<https://...>, <mailto:...>) 외의 '<' 이스케이프
  text = text.replace(/<(?!(?:\/?b>|(?:https?:\/\/|mailto:)[^\s<>]+>))/gi, '&lt;');

  // 4. 한국어 문장부호/조사 경계에서의 CJK 강조(**굵게**, *기울임*, ~~취소선~~) 전처리
  text = text.replace(/\*\*\*(?!\s)((?:(?!\*\*\*|\n).)+?)(?<!\s)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/(?<!\*)\*\*(?!\s)(?!\*)((?:(?!\*\*|\n).)+?)(?<!\s)\*\*(?!\*)/g, '<strong>$1</strong>');
  text = text.replace(/(?<!\*)\*(?!\s)(?!\*)([^\n*]+?)(?<!\s)\*(?!\*)/g, '<em>$1</em>');
  text = text.replace(/~~(?!\s)((?:(?!~~|\n).)+?)(?<!\s)~~/g, '<del>$1</del>');

  // 5. 코드 블록 및 인라인 코드 복원
  text = text.replace(/@@HMDSPAN(\d+)X@@/g, (_, idx) => codeSpans[Number(idx)]);
  return text;
}

function sanitizeHanjaMarkdownHtml(dirtyHtml) {
  if (!dirtyHtml) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${dirtyHtml}</div>`, 'text/html');
  const container = doc.body.firstElementChild;
  if (!container) return '';

  function sanitizeElementTree(parent) {
    const children = Array.from(parent.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        continue;
      }

      const tag = child.tagName.toLowerCase();

      // GFM 할 일 목록 체크박스(<input type="checkbox" disabled>)는 안전한 텍스트 배지로 치환
      if (tag === 'input' && (child.getAttribute('type') || '').toLowerCase() === 'checkbox') {
        const span = doc.createElement('span');
        span.className = 'md-task-checkbox';
        span.textContent = child.hasAttribute('checked') ? '☑ ' : '☐ ';
        parent.replaceChild(span, child);
        continue;
      }

      if (HANJA_MARKDOWN_DROPPED_CONTAINERS.has(tag)) {
        child.remove();
        continue;
      }

      if (!HANJA_MARKDOWN_ALLOWED_ELEMENTS_SET.has(tag)) {
        sanitizeElementTree(child);
        const frag = doc.createDocumentFragment();
        while (child.firstChild) frag.appendChild(child.firstChild);
        parent.replaceChild(frag, child);
        continue;
      }

      const attrs = Array.from(child.attributes);
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase();
        if (!HANJA_MARKDOWN_ALLOWED_ATTRIBUTES.includes(attrName)) {
          child.removeAttribute(attr.name);
        }
      }

      if (tag === 'a') {
        const rawHref = child.getAttribute('href') || '';
        if (isSafeHanjaMarkdownHref(rawHref)) {
          const cleanHref = rawHref.trim();
          child.setAttribute('href', cleanHref);
          if (/^https?:/i.test(cleanHref)) {
            child.setAttribute('target', '_blank');
            child.setAttribute('rel', 'noopener noreferrer');
          } else {
            child.removeAttribute('target');
            child.removeAttribute('rel');
          }
        } else {
          child.removeAttribute('href');
          child.removeAttribute('target');
          child.removeAttribute('rel');
        }
      } else {
        child.removeAttribute('href');
        child.removeAttribute('target');
        child.removeAttribute('rel');
      }

      if (tag === 'img') {
        const rawSrc = child.getAttribute('src') || '';
        if (!isSafeHanjaImageSrc(rawSrc)) {
          child.remove();
          continue;
        }
        child.setAttribute('src', rawSrc.trim());
        if (!child.getAttribute('loading')) child.setAttribute('loading', 'lazy');
        if (!child.getAttribute('decoding')) child.setAttribute('decoding', 'async');
      } else {
        child.removeAttribute('src');
        child.removeAttribute('alt');
        child.removeAttribute('loading');
        child.removeAttribute('decoding');
      }

      sanitizeElementTree(child);
    }
  }

  sanitizeElementTree(container);

  // 표를 반응형 스크롤 래퍼로 감쌈 (키보드 스크롤 및 sticky 헤더 지원)
  const tables = Array.from(container.querySelectorAll('table'));
  tables.forEach((table) => {
    if (table.parentElement && table.parentElement.classList.contains('table-wrapper')) {
      return;
    }
    const wrapper = doc.createElement('div');
    wrapper.className = 'table-wrapper';
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', '표 데이터');
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  return container.innerHTML;
}

function renderHanjaMarkdown(rawText) {
  if (!rawText) return '';
  const preprocessed = preprocessHanjaMarkdown(rawText);
  let rawHtml = '';

  if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
    rawHtml = marked.parse(preprocessed, { breaks: true, gfm: true });
  }

  if (!rawHtml) {
    rawHtml = escapeHanjaHtml(preprocessed).replace(/\n/g, '<br>');
  }

  return sanitizeHanjaMarkdownHtml(rawHtml);
}

function safeSetHanjaMarkdownHTML(el, rawText) {
  if (!el) return;
  const sanitizedHtml = renderHanjaMarkdown(rawText);
  if (!sanitizedHtml) {
    el.textContent = '';
    return;
  }
  if ('setHTML' in Element.prototype) {
    el.setHTML(sanitizedHtml, {
      sanitizer: {
        elements: HANJA_MARKDOWN_ALLOWED_ELEMENTS,
        attributes: HANJA_MARKDOWN_ALLOWED_ATTRIBUTES
      }
    });
  } else {
    el.innerHTML = sanitizedHtml;
  }
}

// 상세 보기 패널 열기
function showDetailView(itemObj, customWord) {
  const reqSeq = ++detailViewRequestSeq;

  // 1. 상세 보기 패널 내용 채우기
  detailHanja.textContent = itemObj.hanja;
  detailStroke.textContent = getStrokeInfo(itemObj.hanja);

  let soundText = customWord || itemObj.korean || '';
  let resolvedInitialMeaning = itemObj.meaning || '';
  let resolvedFile = itemObj.file || '';

  // 메모리(hanjaMap / hanjaList)에 최신 뜻 정보가 반영되어 있으면 먼저 동기화
  if (soundText && soundText !== '?' && !soundText.includes(',')) {
    const latestEntry = hanjaMap.get(soundText)?.get(itemObj.hanja);
    if (latestEntry) {
      if (latestEntry.meaning) {
        resolvedInitialMeaning = latestEntry.meaning;
      }
      if (latestEntry.file && !resolvedFile) {
        resolvedFile = latestEntry.file;
      }
    }
  } else if (!soundText || soundText === '?' || resolvedInitialMeaning === '사전 정보 없음') {
    const listMatches = hanjaList.filter(entry => entry.hanja === itemObj.hanja && entry.meaning);
    if (listMatches.length === 1) {
      soundText = listMatches[0].korean || soundText;
      resolvedInitialMeaning = listMatches[0].meaning;
      resolvedFile = listMatches[0].file || resolvedFile;
    } else if (listMatches.length > 1) {
      soundText = listMatches.map(m => m.korean).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
      resolvedInitialMeaning = listMatches.map((m, idx) => {
        const s = m.korean ? `[${m.korean}] ` : '';
        return `${idx + 1}. ${s}${m.meaning}`;
      }).join('\n\n');
    }
  }

  if (soundText) {
    detailKorean.textContent = `${soundText} (${itemObj.hanja})`;
  } else {
    detailKorean.textContent = `(${itemObj.hanja})`;
  }

  const hasInitialMeaning = Boolean(resolvedInitialMeaning && resolvedInitialMeaning !== '사전 정보 없음');
  if (hasInitialMeaning) {
    safeSetHanjaMarkdownHTML(detailMeaning, resolvedInitialMeaning);
  } else if (supabaseClient) {
    detailMeaning.textContent = '뜻 정보 확인 중...';
  } else {
    detailMeaning.textContent = resolvedInitialMeaning || '뜻 정보 없음';
  }

  // 현재 아이템 저장 (수정 시 참조)
  currentDetailItem = {
    ...itemObj,
    korean: soundText,
    meaning: hasInitialMeaning ? resolvedInitialMeaning : '',
    file: resolvedFile
  };

  // 로그인 상태에 따른 편집 버튼 및 폼 초기화 (로그인한 사용자만 수정 가능)
  const startEditBtn = document.getElementById('startEditBtn');
  const editArea = document.getElementById('editArea');
  if (startEditBtn) {
    if (isLoggedIn) {
      startEditBtn.style.display = 'flex';
    } else {
      startEditBtn.style.display = 'none';
    }
  }
  if (editArea) editArea.style.display = 'none';
  detailMeaning.style.display = 'block';

  // 이전 상태 텍스트 저장
  prevStatusText = statusText.textContent;

  // 2. 다른 UI 요소들 숨기기
  const container = document.querySelector('.container');
  if (container) container.classList.add('detail-mode');

  const tabsEl = document.querySelector('.search-tabs');
  if (tabsEl) tabsEl.style.display = 'none';
  if (panelSearch) panelSearch.classList.remove('active');
  if (panelDraw) panelDraw.classList.remove('active');
  if (panelFilter) panelFilter.classList.remove('active');

  const wrapperEl = document.querySelector('.result-wrapper');
  if (wrapperEl) wrapperEl.style.display = 'none';

  statusText.classList.remove('show');
  meaningDisplay.classList.remove('show');

  // 3. 상세 보기 패널 보여주기
  panelDetail.classList.add('active');

  // 4. 실시간 Supabase 단건 조회 (뜻이 비어 있으면 즉시 채우고, 기존 뜻도 최신 SQL 수정분으로 갱신)
  if (supabaseClient) {
    const targetHanja = itemObj.hanja;
    const targetSound = soundText;
    fetchSingleHanjaFromSupabase(targetHanja, targetSound).then((remoteItems) => {
      if (
        reqSeq !== detailViewRequestSeq ||
        !currentDetailItem ||
        currentDetailItem.hanja !== targetHanja ||
        !(panelDetail && panelDetail.classList.contains('active'))
      ) {
        return;
      }

      const activeEditArea = document.getElementById('editArea');
      if (activeEditArea && activeEditArea.style.display === 'flex') {
        return;
      }

      if (remoteItems && remoteItems.length > 0) {
        const hasSpecificSound = Boolean(targetSound && targetSound !== '?' && !targetSound.includes(','));
        const exactRow = hasSpecificSound
          ? remoteItems.find(r => r.korean === targetSound)
          : null;

        let remoteMeaning = '';
        let remoteKorean = targetSound;

        if (exactRow) {
          remoteMeaning = exactRow.meaning || '';
        } else if (!hasSpecificSound || !hasInitialMeaning) {
          if (remoteItems.length === 1) {
            remoteMeaning = remoteItems[0].meaning || '';
            if (!hasSpecificSound) {
              remoteKorean = remoteItems[0].korean || remoteKorean;
            }
          } else {
            if (!hasSpecificSound) {
              remoteKorean = remoteItems
                .map(r => r.korean)
                .filter(Boolean)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(', ');
            }
            remoteMeaning = remoteItems.map((r, idx) => {
              const s = r.korean ? `[${r.korean}] ` : '';
              return `${idx + 1}. ${s}${r.meaning}`;
            }).join('\n\n');
          }
        }

        if (remoteMeaning) {
          currentDetailItem.meaning = remoteMeaning;
          if (remoteKorean && remoteKorean !== '?' && (!currentDetailItem.korean || currentDetailItem.korean === '?')) {
            currentDetailItem.korean = remoteKorean;
            detailKorean.textContent = `${remoteKorean} (${targetHanja})`;
          }
          safeSetHanjaMarkdownHTML(detailMeaning, remoteMeaning);
          if (meaningDisplay) {
            safeSetHanjaMarkdownHTML(meaningDisplay, remoteMeaning);
          }
          return;
        }
      }

      if (!hasInitialMeaning) {
        const fallbackText = resolvedInitialMeaning === '사전 정보 없음' ? '사전 정보 없음' : '뜻 정보 없음';
        detailMeaning.textContent = fallbackText;
        if (meaningDisplay) {
          meaningDisplay.textContent = fallbackText;
        }
      }
    });
  }
}

// 상세 보기 패널 닫기 (이전 화면 복원)
function hideDetailView() {
  detailViewRequestSeq++;
  currentDetailItem = null;
  const editArea = document.getElementById('editArea');
  if (editArea) editArea.style.display = 'none';

  // 1. 상세 보기 패널 숨기기
  panelDetail.classList.remove('active');
  
  // 2. 다른 UI 요소들 다시 보여주기
  const container = document.querySelector('.container');
  if (container) container.classList.remove('detail-mode');

  const tabsEl = document.querySelector('.search-tabs');
  if (tabsEl) tabsEl.style.display = '';
  const wrapperEl = document.querySelector('.result-wrapper');
  if (wrapperEl) {
    if (currentTabMode === 'draw') {
      wrapperEl.style.display = 'none';
    } else {
      wrapperEl.style.display = '';
    }
  }
  
  // 원래 활성화되어 있던 탭 패널 다시 활성화 및 포커스 복원
  if (currentTabMode === 'search') {
    if (panelSearch) panelSearch.classList.add('active');
    if (input) {
      input.focus();
    }
  } else if (currentTabMode === 'draw') {
    if (panelDraw) panelDraw.classList.add('active');
  } else if (currentTabMode === 'filter') {
    if (panelFilter) panelFilter.classList.add('active');
  }
  
  statusText.textContent = prevStatusText;
  statusText.classList.add('show');
}

// 한자 리스트를 지정된 그리드 컨테이너에 렌더링
function renderHanjaListToGrid(hanjas, container, customWord) {
  // 획수 오름차순 정렬
  hanjas.sort((a, b) => {
    const strokesA = strokeMap.get(a.hanja) || 999;
    const strokesB = strokeMap.get(b.hanja) || 999;
    if (strokesA !== strokesB) {
      return strokesA - strokesB;
    }
    return a.hanja.charCodeAt(0) - b.hanja.charCodeAt(0);
  });

  hanjas.forEach((itemObj, index) => {
    const item = document.createElement('div');
    item.className = 'hanja-item';
    item.style.animationDelay = `${index * 0.02}s`;

    item.appendChild(document.createTextNode(itemObj.hanja));

    const label = document.createElement('span');
    label.className = 'stroke-label';
    label.textContent = getStrokeInfo(itemObj.hanja);
    item.appendChild(label);

    item.addEventListener('click', async () => {
      const copyWord = customWord || itemObj.korean || '';
      const copyText = copyWord ? `${copyWord}(${itemObj.hanja})` : itemObj.hanja;

      // 클릭 시점 메모리(hanjaMap)의 최신 뜻 우선 참조
      const latestMapEntry = copyWord ? hanjaMap.get(copyWord)?.get(itemObj.hanja) : null;
      const effectiveMeaning = (latestMapEntry && latestMapEntry.meaning) || itemObj.meaning || '';
      itemObj.meaning = effectiveMeaning;
      if (latestMapEntry && latestMapEntry.file && !itemObj.file) {
        itemObj.file = latestMapEntry.file;
      }

      if (effectiveMeaning) {
        safeSetHanjaMarkdownHTML(meaningDisplay, effectiveMeaning);
        meaningDisplay.classList.add('show');
      } else {
        meaningDisplay.textContent = supabaseClient ? '뜻 정보 확인 중...' : '뜻 정보 없음';
        meaningDisplay.classList.add('show');
      }

      try {
        await navigator.clipboard.writeText(copyText);
        showToast(`${copyText} → 클립보드로 복사됨`);
      } catch (err) {
        console.warn('Failed to copy text:', err);
      }

      showDetailView(itemObj, customWord);
    });

    container.appendChild(item);
  });
}

// 한자 리스트 전체 렌더링
function renderHanjaList(hanjas, isExact, customWord) {
  resultList.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'result-container';
  renderHanjaListToGrid(hanjas, container, customWord);
  resultList.appendChild(container);
}

// ── 1. 음/뜻 검색 이벤트 처리 ──
// 찾으시는 한자가 없는 경우 보여줄 추가 버튼 생성 및 이벤트 바인딩
function appendAddButton(word) {
  const btnWrapper = document.createElement('div');
  btnWrapper.style.display = 'flex';
  btnWrapper.style.justifyContent = 'center';
  btnWrapper.style.marginTop = '20px';
  btnWrapper.style.marginBottom = '20px';
  btnWrapper.style.width = '100%';
  
  const addLink = document.createElement('button');
  addLink.className = 'control-btn';
  addLink.style.width = 'auto';
  addLink.style.padding = '10px 20px';
  addLink.style.fontSize = '13px';
  addLink.style.borderStyle = 'dashed';
  addLink.style.borderColor = 'var(--accent)';
  addLink.style.color = 'var(--accent)';
  addLink.style.background = 'rgba(37, 99, 235, 0.03)';
  addLink.style.margin = '0';
  addLink.textContent = '➕ 찾으시는 한자가 없나요? 새 한자 추가';
  
  addLink.addEventListener('click', () => {
    showAddForm(word);
  });
  
  btnWrapper.appendChild(addLink);
  resultList.appendChild(btnWrapper);
}

// 새 한자 등록 폼 렌더링
function showAddForm(word) {
  resultList.innerHTML = '';
  statusText.textContent = '새 한자 추가 모드';
  statusText.classList.add('show');
  
  const addCard = document.createElement('div');
  addCard.className = 'add-hanja-card';
  
  const title = document.createElement('h3');
  title.textContent = '✨ 새 한자 추가하기';
  addCard.appendChild(title);
  
  const desc = document.createElement('p');
  desc.className = 'add-desc';
  desc.innerHTML = `단어/음 '<b>${word}</b>'에 대한 한자 정보를 새로 등록합니다.`;
  addCard.appendChild(desc);
  
  // 추가할 한자 입력그룹
  const charGroup = document.createElement('div');
  charGroup.className = 'add-form-group';
  const charLabel = document.createElement('label');
  charLabel.textContent = '추가할 한자';
  const charInput = document.createElement('input');
  charInput.type = 'text';
  charInput.id = 'addHanjaChar';
  charInput.placeholder = '예: 韓';
  charInput.maxLength = 10;
  charGroup.appendChild(charLabel);
  charGroup.appendChild(charInput);
  addCard.appendChild(charGroup);
  
  // 한글 음 입력그룹
  const korGroup = document.createElement('div');
  korGroup.className = 'add-form-group';
  const korLabel = document.createElement('label');
  korLabel.textContent = '한글 음';
  const korInput = document.createElement('input');
  korInput.type = 'text';
  korInput.id = 'addHanjaKorean';
  korInput.value = word;
  korInput.placeholder = '예: 한';
  korGroup.appendChild(korLabel);
  korGroup.appendChild(korInput);
  addCard.appendChild(korGroup);
  
  // 뜻 설명 입력그룹
  const meaningGroup = document.createElement('div');
  meaningGroup.className = 'add-form-group';
  const meaningLabel = document.createElement('label');
  meaningLabel.textContent = '뜻 설명';
  const meaningInput = document.createElement('textarea');
  meaningInput.id = 'addHanjaMeaning';
  meaningInput.placeholder = '예: 나라 이름 한\n여러 줄 입력이 가능합니다.';
  meaningInput.rows = 3;
  meaningGroup.appendChild(meaningLabel);
  meaningGroup.appendChild(meaningInput);
  addCard.appendChild(meaningGroup);
  
  // 버튼 그룹
  const btnGroup = document.createElement('div');
  btnGroup.style.display = 'flex';
  btnGroup.style.gap = '10px';
  btnGroup.style.width = '100%';
  
  // 취소 버튼
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'control-btn';
  cancelBtn.style.flex = '1';
  cancelBtn.style.margin = '0';
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => {
    // 이전 검색 결과 다시 노출
    input.dispatchEvent(new Event('input'));
  });
  
  // 등록 버튼
  const submitBtn = document.createElement('button');
  submitBtn.className = 'add-submit-btn';
  submitBtn.style.flex = '2';
  submitBtn.textContent = '💾 사전 등록하기';
  submitBtn.addEventListener('click', async () => {
    if (!isLoggedIn) {
      alert('새 한자 등록은 로그인한 사용자만 가능합니다. 먼저 로그인해 주세요.');
      if (loginDialog) loginDialog.showModal();
      return;
    }

    const addedHanja = charInput.value.trim();
    const addedKorean = korInput.value.trim();
    const addedMeaning = meaningInput.value.trim();
    
    if (!addedHanja || !addedKorean) {
      alert('한자와 한글 음을 입력해 주세요.');
      return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = '등록 중...';
    
    const processedMeaning = addedMeaning.replace(/\n/g, '</br>');
    let saveOk = false;
    let errorMessage = '';

    // 1. Supabase hanja_dict 테이블에 저장
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('hanja_dict').upsert({
          hanja: addedHanja,
          korean: addedKorean,
          meaning: processedMeaning,
          updated_at: new Date().toISOString()
        }, { onConflict: 'hanja,korean' });

        if (error) {
          console.warn('Supabase add error:', error);
          errorMessage = error.message;
        } else {
          saveOk = true;
        }
      } catch (dbErr) {
        console.warn('Supabase DB error:', dbErr);
        errorMessage = dbErr.message;
      }
    }

    // 2. 로컬 개발 서버가 있는 경우 로컬 파일 동기화 시도
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      try {
        const response = await fetch('/api/add_hanja', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            korean: addedKorean,
            hanja: addedHanja,
            meaning: addedMeaning
          })
        });
        const resData = await response.json();
        if (resData.success) {
          saveOk = true;
        }
      } catch (localErr) {
        // 로컬 파이썬 서버 오프라인 가능
      }
    }

    // 3. 브라우저 캐시 백업 (IndexedDB + 최근 100건 localStorage)
    const nowIso = new Date().toISOString();
    const cachedOk = await saveSingleOverrideToCache({
      hanja: addedHanja,
      korean: addedKorean,
      meaning: processedMeaning,
      updated_at: nowIso
    }, {
      preferRemote: true,
      knownInSupabase: saveOk
    });
    if (!saveOk && !errorMessage && cachedOk) saveOk = true;

    if (!saveOk && errorMessage) {
      if (errorMessage.includes('relation "hanja_dict" does not exist') || errorMessage.includes('404')) {
        alert('Supabase에 "hanja_dict" 테이블이 아직 생성되지 않아 현재 브라우저에 임시 저장되었습니다.\nSQL Editor에서 scripts/create_hanja_dict_table.sql 을 실행해주세요.');
      } else {
        alert('저장 중 경고: ' + errorMessage + '\n(현재 브라우저에는 정상 반영되었습니다)');
      }
    }

    // 메모리 데이터 동기화
    const file = 'h15.txt';
    if (!hanjaMap.has(addedKorean)) {
      hanjaMap.set(addedKorean, new Map());
    }
    hanjaMap.get(addedKorean).set(addedHanja, {
      meaning: processedMeaning,
      file,
      preferRemote: true
    });
    
    if (addedHanja.length === 1) {
      upsertSingleCharInList(addedKorean, addedHanja, processedMeaning, file);
    }
    
    showToast('새 한자가 사전에 등록되었습니다!');
    
    input.value = addedKorean;
    input.dispatchEvent(new Event('input'));
  });
  
  btnGroup.appendChild(cancelBtn);
  btnGroup.appendChild(submitBtn);
  addCard.appendChild(btnGroup);
  resultList.appendChild(addCard);
}

function renderSearchResultsForWord(word, exactMatches, meaningMatches) {
  resultList.innerHTML = '';
  meaningDisplay.textContent = '';
  meaningDisplay.classList.remove('show');

  if (exactMatches.length > 0 || meaningMatches.length > 0) {
    statusText.textContent = '검색 완료. 클릭하여 복사하세요.';
    statusText.classList.add('show');

    if (exactMatches.length > 0 && meaningMatches.length > 0) {
      const pSection = document.createElement('div');
      pSection.className = 'result-section';
      const pTitle = document.createElement('div');
      pTitle.className = 'result-section-title pronunciation';
      pTitle.textContent = `음/단어 검색 결과 (${exactMatches.length}개)`;
      pSection.appendChild(pTitle);

      const pGrid = document.createElement('div');
      pGrid.className = 'result-container';
      renderHanjaListToGrid(exactMatches, pGrid, word);
      pSection.appendChild(pGrid);
      resultList.appendChild(pSection);

      const mSection = document.createElement('div');
      mSection.className = 'result-section';
      const mTitle = document.createElement('div');
      mTitle.className = 'result-section-title';
      mTitle.textContent = `뜻/훈 검색 결과 (${meaningMatches.length}개)`;
      mSection.appendChild(mTitle);

      const mGrid = document.createElement('div');
      mGrid.className = 'result-container';
      renderHanjaListToGrid(meaningMatches, mGrid, null);
      mSection.appendChild(mGrid);
      resultList.appendChild(mSection);
    } else if (exactMatches.length > 0) {
      renderHanjaList(exactMatches, true, word);
    } else {
      renderHanjaList(meaningMatches, false);
    }

    // 일치 결과가 있는 경우에도 하단에 '추가' 버튼 노출!
    appendAddButton(word);
  } else {
    statusText.textContent = '일치하는 한자가 없습니다.';
    statusText.classList.add('show');

    // 일치 결과가 없는 경우 폼을 바로 노출
    showAddForm(word);
  }
}

function refreshActiveSearchResultsIfNeeded() {
  if (
    !isLoggedIn ||
    currentTabMode !== 'search' ||
    (panelDetail && panelDetail.classList.contains('active'))
  ) {
    return;
  }

  const addHanjaCharInput = document.getElementById('addHanjaChar');
  if (addHanjaCharInput && addHanjaCharInput.value.trim()) {
    return;
  }

  const word = input ? input.value.trim() : '';
  if (!word) return;

  const exactMatches = findHanja(word);
  const meaningMatches = findHanjaByMeaning(word);
  renderSearchResultsForWord(word, exactMatches, meaningMatches);
}

input.addEventListener('input', () => {
  if (!isLoggedIn) {
    input.value = '';
    return;
  }

  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }

  const word = input.value.trim();
  const searchSeq = ++currentSearchSeq;

  if (!word) {
    resultList.innerHTML = '';
    meaningDisplay.textContent = '';
    meaningDisplay.classList.remove('show');
    statusText.textContent = '입력 대기 중...';
    statusText.classList.add('show');
    return;
  }

  const initialExactMatches = findHanja(word);
  const initialMeaningMatches = findHanjaByMeaning(word);
  const initialExactHanjaSet = new Set(initialExactMatches.map(m => m.hanja));
  const initialHadNoResults = initialExactMatches.length === 0 && initialMeaningMatches.length === 0;

  renderSearchResultsForWord(word, initialExactMatches, initialMeaningMatches);

  if (supabaseClient) {
    searchDebounceTimer = setTimeout(async () => {
      searchDebounceTimer = null;
      const remoteRows = await fetchHanjaByKoreanFromSupabase(word);
      if (!remoteRows || remoteRows.length === 0) return;

      if (
        searchSeq !== currentSearchSeq ||
        !isLoggedIn ||
        currentTabMode !== 'search' ||
        input.value.trim() !== word ||
        (panelDetail && panelDetail.classList.contains('active'))
      ) {
        return;
      }

      const addHanjaCharInput = document.getElementById('addHanjaChar');
      if (addHanjaCharInput && addHanjaCharInput.value.trim()) {
        return;
      }

      const updatedExactMatches = findHanja(word);
      const updatedMeaningMatches = findHanjaByMeaning(word);
      const hasNewHanja = updatedExactMatches.some(m => !initialExactHanjaSet.has(m.hanja));

      if (initialHadNoResults || hasNewHanja) {
        renderSearchResultsForWord(word, updatedExactMatches, updatedMeaningMatches);
      }
    }, 120);
  }
});

// ── 2. 필기 인식 구현 ──
let isDrawing = false;
let strokes = []; // [[[x1, x2, ...], [y1, y2, ...], [t1, t2, ...]], ...]
let currentX = [];
let currentY = [];
let currentT = [];
let strokeStartTime = 0;

function initCanvas() {
  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d');

  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4f46e5';

  canvas.addEventListener('pointerdown', (e) => {
    if (!isLoggedIn) return;
    isDrawing = true;
    canvas.setPointerCapture(e.pointerId);

    const pos = getCanvasPos(canvas, e);
    currentX = [pos.x];
    currentY = [pos.y];
    if (strokes.length === 0) {
      strokeStartTime = Date.now();
    }
    currentT = [Date.now() - strokeStartTime];

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isDrawing) return;
    const pos = getCanvasPos(canvas, e);
    currentX.push(pos.x);
    currentY.push(pos.y);
    currentT.push(Date.now() - strokeStartTime);

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    canvas.releasePointerCapture(e.pointerId);

    strokes.push([currentX, currentY, currentT]);
    recognizeHandwriting();
  });

  canvas.addEventListener('pointercancel', () => {
    isDrawing = false;
  });

  document.getElementById('clearBtn').addEventListener('click', clearCanvas);
  document.getElementById('undoBtn').addEventListener('click', undoStroke);
}

function getCanvasPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { x: Math.round(x), y: Math.round(y) };
}

function clearCanvas() {
  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes = [];
  document.getElementById('candidatesList').innerHTML = '<span class="no-candidates">글자를 그려주세요</span>';
  resultList.innerHTML = '';
  meaningDisplay.textContent = '';
  meaningDisplay.classList.remove('show');
  statusText.textContent = '마우스나 터치로 한자를 그려주세요.';
}

function undoStroke() {
  if (strokes.length === 0) return;
  strokes.pop();

  const canvas = document.getElementById('drawCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  strokes.forEach(stroke => {
    const xs = stroke[0];
    const ys = stroke[1];
    if (xs.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length; i++) {
      ctx.lineTo(xs[i], ys[i]);
    }
    ctx.stroke();
  });

  if (strokes.length === 0) {
    document.getElementById('candidatesList').innerHTML = '<span class="no-candidates">글자를 그려주세요</span>';
    resultList.innerHTML = '';
    meaningDisplay.textContent = '';
    meaningDisplay.classList.remove('show');
    statusText.textContent = '마우스나 터치로 한자를 그려주세요.';
  } else {
    recognizeHandwriting();
  }
}

async function recognizeHandwriting() {
  if (!isLoggedIn || strokes.length === 0) return;

  try {
    const response = await fetch('https://www.google.com/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        options: 'enable_pre_space',
        requests: [
          {
            writing_guide: {
              writing_area_width: 300,
              writing_area_height: 300
            },
            ink: strokes,
            language: 'zh-TW'
          },
          {
            writing_guide: {
              writing_area_width: 300,
              writing_area_height: 300
            },
            ink: strokes,
            language: 'ko'
          },
          {
            writing_guide: {
              writing_area_width: 300,
              writing_area_height: 300
            },
            ink: strokes,
            language: 'zh'
          }
        ]
      })
    });

    if (!response.ok) throw new Error('API request failed');

    const data = await response.json();
    if (data && data[0] === 'SUCCESS') {
      const candidates = [];
      const seen = new Set();
      
      data[1].forEach(resultItem => {
        const itemCandidates = resultItem[1] || [];
        itemCandidates.forEach(char => {
          // 한글 필터링 (초성/중성/종성 및 완성형)
          const code = char.charCodeAt(0);
          const isHangul = (code >= 0xAC00 && code <= 0xD7A3) || 
                          (code >= 0x1100 && code <= 0x11FF) || 
                          (code >= 0x3130 && code <= 0x318F);
                          
          // 특수 기호 / 영어 / 숫자 필터링 (CJK 문자 블록은 0x2E80 이상)
          const isSymbol = char.length === 1 && (code < 0x2E80 || (code >= 0xFF00 && code <= 0xFFEF));
          
          if (!isHangul && !isSymbol && char.length === 1) {
            if (!seen.has(char)) {
              seen.add(char);
              candidates.push(char);
            }
          }
        });
      });

      renderCandidates(candidates);
    }
  } catch (err) {
    console.error('Handwriting recognition error:', err);
  }
}

function renderCandidates(candidates) {
  const container = document.getElementById('candidatesList');
  container.innerHTML = '';

  if (candidates.length === 0) {
    container.innerHTML = '<span class="no-candidates">후보 없음</span>';
    return;
  }

  // 24개까지의 후보를 노출하여 희귀 한자도 노출되도록 개선
  candidates.slice(0, 24).forEach(char => {
    const chip = document.createElement('span');
    chip.className = 'candidate-chip';
    chip.textContent = char;
    chip.addEventListener('click', () => {
      searchHanjaCharacter(char);
    });
    container.appendChild(chip);
  });
}

async function searchHanjaCharacter(char) {
  if (!isLoggedIn) return;
  resultList.innerHTML = '';
  meaningDisplay.textContent = '';
  meaningDisplay.classList.remove('show');

  const matches = hanjaList.filter(item => item.hanja === char);
  let itemObj;

  if (matches.length > 0) {
    if (matches.length === 1) {
      itemObj = matches[0];
    } else {
      // 여러 개 있으면 합쳐서 노출
      itemObj = {
        hanja: char,
        korean: matches.map(m => m.korean).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
        meaning: matches.map((m, idx) => {
          const sound = m.korean ? `[${m.korean}] ` : '';
          return `${idx + 1}. ${sound}${m.meaning}`;
        }).join('\n\n')
      };
    }
  } else {
    itemObj = { hanja: char, korean: '?', meaning: '사전 정보 없음' };
  }

  // 클립보드 복사
  try {
    const copyWord = itemObj.korean && itemObj.korean !== '?' ? itemObj.korean.split(',')[0].trim() : '';
    const copyText = copyWord ? `${copyWord}(${itemObj.hanja})` : itemObj.hanja;
    await navigator.clipboard.writeText(copyText);
    showToast(`${copyText} → 클립보드로 복사됨`);
  } catch (err) {
    console.error('Failed to copy to clipboard in searchHanjaCharacter:', err);
  }

  // 상세 보기 바로 실행
  showDetailView(itemObj);
}

// ── 3. 부수/획수 검색 구현 ──
let selectedRadicalId = null;
let selectedRemainingStrokes = null; // null이면 '전체'

function initRadicalSearch() {
  const groupTabsContainer = document.getElementById('radicalGroupTabs');
  if (!groupTabsContainer) return;

  const changeRadicalBtn = document.getElementById('changeRadicalBtn');
  if (changeRadicalBtn) {
    changeRadicalBtn.addEventListener('click', resetRadicalFilters);
  }
  
  // 1. 부수를 획수별로 그룹화
  const groups = {}; // 획수 -> 부수 리스트
  radicalsList.forEach(rad => {
    if (!groups[rad.strokes]) {
      groups[rad.strokes] = [];
    }
    groups[rad.strokes].push(rad);
  });

  groupTabsContainer.innerHTML = '';
  const strokeCounts = Object.keys(groups).map(Number).sort((a, b) => a - b);
  
  strokeCounts.forEach((strokes, idx) => {
    const tab = document.createElement('button');
    tab.className = 'radical-tab';
    tab.textContent = `${strokes}획`;
    tab.addEventListener('click', () => {
      groupTabsContainer.querySelectorAll('.radical-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderRadicalsInGroup(groups[strokes]);
    });
    groupTabsContainer.appendChild(tab);
    
    // 첫 번째 획수 탭 기본 활성화
    if (idx === 0) {
      tab.click();
    }
  });
}

function renderRadicalsInGroup(radicals) {
  const container = document.getElementById('radicalListContainer');
  if (!container) return;
  container.innerHTML = '';
  
  radicals.forEach(rad => {
    const btn = document.createElement('button');
    btn.className = 'radical-btn';
    if (selectedRadicalId === rad.id) {
      btn.classList.add('active');
    }
    
    const charSpan = document.createElement('span');
    charSpan.className = 'rad-char';
    charSpan.textContent = rad.radical;
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'rad-name';
    let dispName = rad.name;
    if (rad.variants) {
      dispName += `(${rad.variants.split(', ')[0]})`;
    }
    nameSpan.textContent = dispName;
    
    btn.appendChild(charSpan);
    btn.appendChild(nameSpan);
    
    btn.addEventListener('click', () => {
      container.querySelectorAll('.radical-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectRadical(rad);
    });
    
    container.appendChild(btn);
  });
}

function selectRadical(radical) {
  if (!isLoggedIn) return;
  selectedRadicalId = radical.id;
  selectedRemainingStrokes = null; // '전체'가 디폴트
  
  const selectionArea = document.getElementById('radicalSelectionArea');
  if (selectionArea) {
    selectionArea.style.display = 'none';
  }
  
  const selectedContainer = document.getElementById('radicalSelectedContainer');
  if (!selectedContainer) return;
  selectedContainer.style.display = 'flex';
  
  document.getElementById('selectedRadicalChar').textContent = radical.radical;
  let dispName = radical.name;
  if (radical.variants) {
    dispName += ` (변형: ${radical.variants})`;
  }
  document.getElementById('selectedRadicalName').textContent = dispName;
  document.getElementById('selectedRadicalStrokes').textContent = radical.strokes;
  
  // 이 부수를 사용하는 모든 한자 검색
  const matchingHanjas = [];
  const remStrokesSet = new Set();
  
  for (const item of hanjaList) {
    const radInfo = characterRadicalsMap.get(item.hanja);
    if (radInfo && radInfo[0] === radical.id) {
      matchingHanjas.push(item);
      remStrokesSet.add(radInfo[1]);
    }
  }
  
  // 나머지 획수 필터 버튼 구성
  const remButtonsContainer = document.getElementById('remainingStrokesButtons');
  remButtonsContainer.innerHTML = '';
  
  // '전체' 버튼 추가
  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn active';
  allBtn.textContent = '전체';
  allBtn.addEventListener('click', () => {
    remButtonsContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    selectedRemainingStrokes = null;
    applyRadicalFilter(matchingHanjas);
  });
  remButtonsContainer.appendChild(allBtn);
  
  // 나머지 획수 버튼 오름차순 나열
  const remStrokesSorted = Array.from(remStrokesSet).sort((a, b) => a - b);
  
  remStrokesSorted.forEach(rem => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.textContent = `${rem}획`;
    btn.addEventListener('click', () => {
      remButtonsContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRemainingStrokes = rem;
      applyRadicalFilter(matchingHanjas);
    });
    remButtonsContainer.appendChild(btn);
  });
  
  // 최초 '전체' 결과 출력
  applyRadicalFilter(matchingHanjas);
}

function applyRadicalFilter(matchingHanjas) {
  resultList.innerHTML = '';
  meaningDisplay.textContent = '';
  meaningDisplay.classList.remove('show');
  
  let filtered = matchingHanjas;
  if (selectedRemainingStrokes !== null) {
    filtered = matchingHanjas.filter(item => {
      const radInfo = characterRadicalsMap.get(item.hanja);
      return radInfo && radInfo[1] === selectedRemainingStrokes;
    });
  }
  
  // 나머지 획수 순 정렬
  filtered.sort((a, b) => {
    const radInfoA = characterRadicalsMap.get(a.hanja);
    const radInfoB = characterRadicalsMap.get(b.hanja);
    const remA = radInfoA ? radInfoA[1] : 99;
    const remB = radInfoB ? radInfoB[1] : 99;
    
    if (remA !== remB) {
      return remA - remB;
    }
    return a.korean.localeCompare(b.korean);
  });
  
  if (filtered.length > 0) {
    statusText.textContent = `${filtered.length}개의 한자를 찾았습니다. 클릭하여 복사하세요.`;
    statusText.classList.add('show');
    renderHanjaList(filtered, false);
  } else {
    statusText.textContent = '부수에 일치하는 한자가 없습니다.';
    statusText.classList.add('show');
  }
}

function resetRadicalFilters() {
  selectedRadicalId = null;
  selectedRemainingStrokes = null;
  
  document.querySelectorAll('.radical-list-container .radical-btn').forEach(b => b.classList.remove('active'));
  
  const selectionArea = document.getElementById('radicalSelectionArea');
  if (selectionArea) {
    selectionArea.style.display = 'flex';
  }
  
  const selectedContainer = document.getElementById('radicalSelectedContainer');
  if (selectedContainer) {
    selectedContainer.style.display = 'none';
  }
  
  resultList.innerHTML = '';
  meaningDisplay.textContent = '';
  meaningDisplay.classList.remove('show');
  statusText.textContent = '위에서 부수를 선택해 주세요.';
}

// ── 탭 전환 로직 ──
function switchTab(mode) {
  if (!isLoggedIn) return;
  currentTabMode = mode;

  // 상세 보기 관련 UI 숨기기 및 원래대로 복구
  if (panelDetail) panelDetail.classList.remove('active');
  const container = document.querySelector('.container');
  if (container) container.classList.remove('detail-mode');

  const tabsEl = document.querySelector('.search-tabs');
  if (tabsEl) tabsEl.style.display = '';
  const wrapperEl = document.querySelector('.result-wrapper');
  if (wrapperEl) {
    if (mode === 'draw') {
      wrapperEl.style.display = 'none';
    } else {
      wrapperEl.style.display = '';
    }
  }

  tabSearchBtn.classList.remove('active');
  tabDrawBtn.classList.remove('active');
  tabFilterBtn.classList.remove('active');

  panelSearch.classList.remove('active');
  panelDraw.classList.remove('active');
  panelFilter.classList.remove('active');

  resultList.innerHTML = '';
  meaningDisplay.textContent = '';
  meaningDisplay.classList.remove('show');

  if (mode === 'search') {
    tabSearchBtn.classList.add('active');
    panelSearch.classList.add('active');
    input.focus();
    statusText.textContent = '입력 대기 중...';
  } else if (mode === 'draw') {
    tabDrawBtn.classList.add('active');
    panelDraw.classList.add('active');
    clearCanvas();
  } else if (mode === 'filter') {
    tabFilterBtn.classList.add('active');
    panelFilter.classList.add('active');
    resetRadicalFilters();
  }
}

tabSearchBtn.addEventListener('click', () => switchTab('search'));
tabDrawBtn.addEventListener('click', () => switchTab('draw'));
tabFilterBtn.addEventListener('click', () => switchTab('filter'));
if (backToSearchBtn) {
  backToSearchBtn.addEventListener('click', hideDetailView);
}

// ── 인증 및 뜻 수정 관련 로직 ──

// 상세 화면에서 수정 버튼 표시 여부 갱신
function updateEditButtonVisibility() {
  const startEditBtn = document.getElementById('startEditBtn');
  const editArea = document.getElementById('editArea');
  if (!startEditBtn) return;

  if (panelDetail && panelDetail.classList.contains('active')) {
    if (isLoggedIn) {
      if (editArea && editArea.style.display === 'flex') {
        startEditBtn.style.display = 'none';
      } else {
        startEditBtn.style.display = 'flex';
      }
    } else {
      startEditBtn.style.display = 'none';
      if (editArea && editArea.style.display === 'flex') {
        editArea.style.display = 'none';
        detailMeaning.style.display = 'block';
      }
    }
  }
}

// 로그인 여부에 따른 전체 한자 앱 UI 활성화/비활성화 동기화
function updateAppAuthState() {
  const clearBtn = document.getElementById('clearBtn');
  const undoBtn = document.getElementById('undoBtn');
  const canvas = document.getElementById('drawCanvas');

  if (!isLoggedIn) {
    // 상세 보기 중이었다면 닫고 기본 레이아웃 복원
    if (panelDetail && panelDetail.classList.contains('active')) {
      currentDetailItem = null;
      const editArea = document.getElementById('editArea');
      if (editArea) editArea.style.display = 'none';
      panelDetail.classList.remove('active');
      const container = document.querySelector('.container');
      if (container) container.classList.remove('detail-mode');
      const tabsEl = document.querySelector('.search-tabs');
      if (tabsEl) tabsEl.style.display = '';
    }

    // 탭 모드를 기본 검색 탭으로 초기화
    currentTabMode = 'search';
    if (tabSearchBtn) tabSearchBtn.classList.add('active');
    if (tabDrawBtn) tabDrawBtn.classList.remove('active');
    if (tabFilterBtn) tabFilterBtn.classList.remove('active');
    if (panelSearch) panelSearch.classList.add('active');
    if (panelDraw) panelDraw.classList.remove('active');
    if (panelFilter) panelFilter.classList.remove('active');
    const wrapperEl = document.querySelector('.result-wrapper');
    if (wrapperEl) wrapperEl.style.display = '';

    // 검색 입력 비활성화 및 초기화
    if (input) {
      input.value = '';
      input.disabled = true;
      input.placeholder = SEARCH_PLACEHOLDER_LOGGED_OUT;
    }

    // 결과 및 뜻 표시 초기화
    if (resultList) resultList.innerHTML = '';
    if (meaningDisplay) {
      meaningDisplay.textContent = '';
      meaningDisplay.classList.remove('show');
    }

    // 필기 인식 캔버스 및 컨트롤 비활성화/초기화
    if (canvas) {
      canvas.classList.add('disabled');
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    strokes = [];
    const candList = document.getElementById('candidatesList');
    if (candList) candList.innerHTML = '<span class="no-candidates">글자를 그려주세요</span>';
    if (clearBtn) clearBtn.disabled = true;
    if (undoBtn) undoBtn.disabled = true;

    // 탭 및 부수 필터 버튼 비활성화
    if (tabSearchBtn) tabSearchBtn.disabled = true;
    if (tabDrawBtn) tabDrawBtn.disabled = true;
    if (tabFilterBtn) tabFilterBtn.disabled = true;
    document.querySelectorAll('#panelFilter button').forEach(btn => {
      btn.disabled = true;
    });

    if (statusText) {
      statusText.textContent = '로그인이 필요합니다. 우측 상단에서 로그인해 주세요.';
      statusText.classList.add('show');
    }
  } else {
    if (tabSearchBtn) tabSearchBtn.disabled = false;
    if (tabDrawBtn) tabDrawBtn.disabled = false;
    if (tabFilterBtn) tabFilterBtn.disabled = false;
    if (canvas) canvas.classList.remove('disabled');
    if (clearBtn) clearBtn.disabled = false;
    if (undoBtn) undoBtn.disabled = false;
    document.querySelectorAll('#panelFilter button').forEach(btn => {
      btn.disabled = false;
    });

    if (input) {
      input.placeholder = SEARCH_PLACEHOLDER_LOGGED_IN;
      if (firstStageLoaded) {
        input.disabled = false;
        if (currentTabMode === 'search' && !(panelDetail && panelDetail.classList.contains('active'))) {
          if (!(loginDialog && loginDialog.open)) {
            input.focus();
          }
          if (!input.value.trim() && statusText) {
            statusText.textContent = allFilesLoaded
              ? '입력 대기 중...'
              : '입력 대기 중... (나머지 사전 로딩 중)';
            statusText.classList.add('show');
          }
        }
      } else {
        input.disabled = true;
        if (statusText) {
          statusText.textContent = '사전 데이터 불러오는 중...';
          statusText.classList.add('show');
        }
      }
    }
  }

  updateEditButtonVisibility();
}

// Supabase Auth 초기화 및 이벤트 바인딩
function initAuth() {
  if (!supabaseClient) {
    console.warn('Supabase client not available.');
    return;
  }

  // 로그인 상태 변화 리스너
  supabaseClient.auth.onAuthStateChange((event, session) => {
    const user = session?.user;
    isLoggedIn = !!user;

    if (user) {
      const adminNick = user.email ? user.email.split('@')[0] : 'admin';
      if (authStatusText) authStatusText.innerHTML = `🟢 ${adminNick}`;
      if (btnLogin) btnLogin.style.display = 'none';
      if (btnLogout) btnLogout.style.display = 'inline-flex';
      if (allFilesLoaded && pendingSupabaseSyncItems.length > 0 && !supabaseSyncCompleted) {
        syncPendingHanjaToSupabase();
      }
    } else {
      if (authStatusText) authStatusText.innerHTML = '';
      if (btnLogin) btnLogin.style.display = 'inline-flex';
      if (btnLogout) btnLogout.style.display = 'none';
    }

    updateAppAuthState();
  });

  // 로그인 모달 열기
  if (btnLogin && loginDialog) {
    btnLogin.addEventListener('click', () => {
      if (loginError) {
        loginError.style.display = 'none';
        loginError.textContent = '';
      }
      loginDialog.showModal();
    });
  }

  // 로그인 모달 취소/닫기
  if (btnCancelLogin && loginDialog) {
    btnCancelLogin.addEventListener('click', () => {
      loginDialog.close();
    });
  }

  // 로그인 폼 제출
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail')?.value.trim();
      const password = document.getElementById('loginPassword')?.value;

      if (!email || !password) return;

      if (btnSubmitLogin) {
        btnSubmitLogin.disabled = true;
        btnSubmitLogin.textContent = '로그인 중...';
      }
      if (loginError) {
        loginError.style.display = 'none';
        loginError.textContent = '';
      }

      try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          if (loginError) {
            loginError.textContent = '로그인 실패: ' + error.message;
            loginError.style.display = 'block';
          } else {
            alert('로그인 실패: ' + error.message);
          }
        } else {
          loginForm.reset();
          loginDialog?.close();
          showToast('성공적으로 로그인되었습니다.');
          if (!input.disabled && currentTabMode === 'search') {
            input.focus();
          }
        }
      } catch (err) {
        alert('로그인 오류: ' + err.message);
      } finally {
        if (btnSubmitLogin) {
          btnSubmitLogin.disabled = false;
          btnSubmitLogin.textContent = '로그인';
        }
      }
    });
  }

  // 로그아웃 처리
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
          alert('로그아웃 실패: ' + error.message);
        } else {
          showToast('로그아웃되었습니다.');
        }
      } catch (err) {
        alert('로그아웃 오류: ' + err.message);
      }
    });
  }
}

// ── IndexedDB 캐시 및 실시간/증분 Supabase 동기화 헬퍼 ──

function openHanjaCacheDB() {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (hanjaCacheDBPromise) {
    return hanjaCacheDBPromise;
  }

  hanjaCacheDBPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(HANJA_IDB_NAME, HANJA_IDB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(HANJA_IDB_OVERRIDES_STORE)) {
          db.createObjectStore(HANJA_IDB_OVERRIDES_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(HANJA_IDB_META_STORE)) {
          db.createObjectStore(HANJA_IDB_META_STORE, { keyPath: 'k' });
        }
      };
      request.onsuccess = (event) => {
        const db = event.target.result;
        db.onversionchange = () => {
          db.close();
          hanjaCacheDBPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        console.warn('IndexedDB open failed:', request.error);
        hanjaCacheDBPromise = null;
        resolve(null);
      };
      request.onblocked = () => {
        console.warn('IndexedDB open blocked');
        hanjaCacheDBPromise = null;
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB unavailable:', err);
      hanjaCacheDBPromise = null;
      resolve(null);
    }
  });

  return hanjaCacheDBPromise;
}

async function getHanjaCacheMeta() {
  const db = await openHanjaCacheDB();
  if (!db) return {};

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([HANJA_IDB_META_STORE], 'readonly');
      const req = tx.objectStore(HANJA_IDB_META_STORE).getAll();
      req.onsuccess = () => {
        const meta = {};
        for (const row of req.result || []) {
          if (row && row.k) meta[row.k] = row.v;
        }
        resolve(meta);
      };
      req.onerror = () => resolve({});
    } catch (err) {
      resolve({});
    }
  });
}

async function loadAllOverridesFromIndexedDB() {
  const db = await openHanjaCacheDB();
  if (!db) return { items: [], meta: {} };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([HANJA_IDB_OVERRIDES_STORE, HANJA_IDB_META_STORE], 'readonly');
      const overridesReq = tx.objectStore(HANJA_IDB_OVERRIDES_STORE).getAll();
      const metaReq = tx.objectStore(HANJA_IDB_META_STORE).getAll();

      let items = [];
      let meta = {};

      overridesReq.onsuccess = () => {
        items = overridesReq.result || [];
      };
      metaReq.onsuccess = () => {
        meta = {};
        for (const row of metaReq.result || []) {
          if (row && row.k) meta[row.k] = row.v;
        }
      };

      tx.oncomplete = () => resolve({ items, meta });
      tx.onerror = () => resolve({ items: [], meta: {} });
      tx.onabort = () => resolve({ items: [], meta: {} });
    } catch (err) {
      console.warn('Failed to read from IndexedDB:', err);
      resolve({ items: [], meta: {} });
    }
  });
}

async function saveOverridesToIndexedDB(items, metaUpdates = null) {
  const hasItems = Array.isArray(items) && items.length > 0;
  const metaEntries = metaUpdates ? Object.entries(metaUpdates) : [];
  if (!hasItems && metaEntries.length === 0) return true;

  const db = await openHanjaCacheDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const storeNames = [];
      if (hasItems) storeNames.push(HANJA_IDB_OVERRIDES_STORE);
      if (metaEntries.length > 0) storeNames.push(HANJA_IDB_META_STORE);

      const tx = db.transaction(storeNames, 'readwrite');
      if (hasItems) {
        const overridesStore = tx.objectStore(HANJA_IDB_OVERRIDES_STORE);
        const fallbackNow = new Date().toISOString();
        for (const item of items) {
          if (!item || !item.hanja || !item.korean || item.meaning === undefined) continue;
          const record = {
            key: `${item.hanja}_${item.korean}`,
            hanja: item.hanja,
            korean: item.korean,
            meaning: item.meaning,
            updated_at: item.updated_at || item.created_at || fallbackNow
          };
          if (item.id !== undefined && item.id !== null) {
            record.id = item.id;
          }
          overridesStore.put(record);
        }
      }
      if (metaEntries.length > 0) {
        const metaStore = tx.objectStore(HANJA_IDB_META_STORE);
        for (const [k, v] of metaEntries) {
          metaStore.put({ k, v });
        }
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.warn('IndexedDB write error:', tx.error);
        resolve(false);
      };
      tx.onabort = () => resolve(false);
    } catch (err) {
      console.warn('Failed to write to IndexedDB:', err);
      resolve(false);
    }
  });
}

function saveRecentLocalStorageBackup(items) {
  const list = Array.isArray(items) ? items : [items];
  if (list.length === 0) return false;
  try {
    const existing = JSON.parse(localStorage.getItem(HANJA_RECENT_LS_KEY) || '{}');
    const nowIso = new Date().toISOString();
    for (const item of list) {
      if (!item || !item.hanja || !item.korean || item.meaning === undefined) continue;
      const key = `${item.hanja}_${item.korean}`;
      existing[key] = {
        hanja: item.hanja,
        korean: item.korean,
        meaning: item.meaning,
        updated_at: item.updated_at || nowIso
      };
    }

    const entries = Object.entries(existing);
    if (entries.length > HANJA_RECENT_LS_MAX) {
      entries.sort((a, b) => String(b[1]?.updated_at || '').localeCompare(String(a[1]?.updated_at || '')));
      const trimmed = Object.fromEntries(entries.slice(0, HANJA_RECENT_LS_MAX));
      localStorage.setItem(HANJA_RECENT_LS_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(HANJA_RECENT_LS_KEY, JSON.stringify(existing));
    }
    return true;
  } catch (lsErr) {
    console.warn('localStorage recent backup warning:', lsErr);
    return false;
  }
}

async function saveSingleOverrideToCache(item, options = {}) {
  if (!item || !item.hanja || !item.korean || item.meaning === undefined) return false;
  const normalized = {
    id: item.id,
    hanja: item.hanja,
    korean: item.korean,
    meaning: item.meaning,
    updated_at: item.updated_at || new Date().toISOString()
  };
  const key = `${normalized.hanja}_${normalized.korean}`;
  overrideCacheMap.set(key, {
    ...normalized,
    preferRemote: options.preferRemote !== undefined ? Boolean(options.preferRemote) : true
  });
  if (options.knownInSupabase) {
    knownSupabaseKeys.add(key);
  }

  const idbSaved = await saveOverridesToIndexedDB([normalized]);
  const lsSaved = saveRecentLocalStorageBackup(normalized);
  return idbSaved || lsSaved;
}

function recordOverridesInCacheMap(items, preferRemote = false) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!item || !item.hanja || !item.korean || item.meaning === undefined) continue;
    const key = `${item.hanja}_${item.korean}`;
    const prev = overrideCacheMap.get(key);
    overrideCacheMap.set(key, {
      id: item.id !== undefined ? item.id : prev?.id,
      hanja: item.hanja,
      korean: item.korean,
      meaning: item.meaning,
      updated_at: item.updated_at || prev?.updated_at || '',
      preferRemote: preferRemote || Boolean(prev && prev.preferRemote)
    });
  }
}

async function loadCachedOverridesIntoMemory() {
  const { items: idbItems, meta } = await loadAllOverridesFromIndexedDB();
  const idbItemMap = new Map();

  if (idbItems.length > 0) {
    applyOverridesToMemory(idbItems);
    recordOverridesInCacheMap(idbItems, false);
    for (const item of idbItems) {
      if (item && item.hanja && item.korean) {
        idbItemMap.set(`${item.hanja}_${item.korean}`, item);
      }
    }
  }

  // 기존 대용량 localStorage 캐시('hanja_dict_overrides')를 IndexedDB로 이관 후 삭제하여 5MB 쿼터 초과 방지
  try {
    const legacyRaw = localStorage.getItem(HANJA_LEGACY_LS_KEY);
    if (legacyRaw) {
      const legacyObj = JSON.parse(legacyRaw);
      const legacyItems = Object.values(legacyObj || {});
      if (legacyItems.length > 0) {
        applyOverridesToMemory(legacyItems);
        recordOverridesInCacheMap(legacyItems, false);
        await saveOverridesToIndexedDB(legacyItems);
      }
      localStorage.removeItem(HANJA_LEGACY_LS_KEY);
    }
  } catch (e) {
    console.warn('Failed to migrate legacy hanja overrides:', e);
    try {
      localStorage.removeItem(HANJA_LEGACY_LS_KEY);
    } catch (_) {}
  }

  // 최근 로컬 수정/조회 백업(최대 100건) 중 IndexedDB보다 최신인 항목 반영
  try {
    const recentRaw = localStorage.getItem(HANJA_RECENT_LS_KEY);
    if (recentRaw) {
      const recentItems = Object.values(JSON.parse(recentRaw) || {});
      const newerItems = recentItems.filter(item => {
        if (!item || !item.hanja || !item.korean) return false;
        const key = `${item.hanja}_${item.korean}`;
        const idbEntry = idbItemMap.get(key);
        if (!idbEntry) return true;
        return Boolean(item.updated_at && idbEntry.updated_at && item.updated_at > idbEntry.updated_at);
      });
      if (newerItems.length > 0) {
        applyOverridesToMemory(newerItems, { preferRemote: true });
        recordOverridesInCacheMap(newerItems, true);
      }
    }
  } catch (e) {
    console.warn('Failed to parse recent hanja overrides:', e);
  }

  return { idbItems, meta };
}

// 검색어(한글 음/단어) 실시간 Supabase 조회
async function fetchHanjaByKoreanFromSupabase(koreanWord, options = {}) {
  if (!supabaseClient || !koreanWord) return [];
  const word = koreanWord.trim();
  if (!word) return [];

  if (inFlightKoreanQueries.has(word)) {
    return inFlightKoreanQueries.get(word);
  }

  const force = Boolean(options.force);
  const lastQueriedAt = recentKoreanQueryTimestamps.get(word) || 0;
  if (!force && Date.now() - lastQueriedAt < KOREAN_QUERY_COOLDOWN_MS) {
    return [];
  }

  const promise = (async () => {
    try {
      const { data, error } = await supabaseClient
        .from('hanja_dict')
        .select('id,hanja,korean,meaning,updated_at')
        .eq('korean', word)
        .neq('meaning', '');

      recentKoreanQueryTimestamps.set(word, Date.now());

      if (error || !Array.isArray(data) || data.length === 0) {
        return [];
      }

      applyOverridesToMemory(data, { preferRemote: true });
      recordOverridesInCacheMap(data, true);
      data.forEach(row => {
        if (row && row.hanja && row.korean) {
          knownSupabaseKeys.add(`${row.hanja}_${row.korean}`);
        }
      });
      await saveOverridesToIndexedDB(data);
      return data;
    } catch (err) {
      console.warn('Korean word Supabase lookup failed:', err);
      return [];
    } finally {
      inFlightKoreanQueries.delete(word);
    }
  })();

  inFlightKoreanQueries.set(word, promise);
  return promise;
}

// 상세 보기용 한자 단건 실시간 Supabase 조회
async function fetchSingleHanjaFromSupabase(hanja, korean) {
  if (!supabaseClient || !hanja) return [];
  const cleanKorean = korean && korean !== '?' && !korean.includes(',') ? korean.trim() : '';
  const inflightKey = `${hanja}_${cleanKorean}`;

  if (inFlightSingleHanjaQueries.has(inflightKey)) {
    return inFlightSingleHanjaQueries.get(inflightKey);
  }

  const promise = (async () => {
    try {
      let rows = [];
      if (cleanKorean) {
        const { data, error } = await supabaseClient
          .from('hanja_dict')
          .select('id,hanja,korean,meaning,updated_at')
          .eq('hanja', hanja)
          .eq('korean', cleanKorean)
          .neq('meaning', '');

        if (!error && Array.isArray(data) && data.length > 0) {
          rows = data;
        }
      }

      if (rows.length === 0) {
        const { data, error } = await supabaseClient
          .from('hanja_dict')
          .select('id,hanja,korean,meaning,updated_at')
          .eq('hanja', hanja)
          .neq('meaning', '');

        if (!error && Array.isArray(data) && data.length > 0) {
          rows = data;
        }
      }

      if (rows.length > 0) {
        applyOverridesToMemory(rows, { preferRemote: true });
        recordOverridesInCacheMap(rows, true);
        rows.forEach(row => {
          if (row && row.hanja && row.korean) {
            knownSupabaseKeys.add(`${row.hanja}_${row.korean}`);
          }
        });
        await saveOverridesToIndexedDB(rows);
        saveRecentLocalStorageBackup(rows.slice(0, 10));
      }

      return rows;
    } catch (err) {
      console.warn('Single hanja Supabase lookup failed:', err);
      return [];
    } finally {
      inFlightSingleHanjaQueries.delete(inflightKey);
    }
  })();

  inFlightSingleHanjaQueries.set(inflightKey, promise);
  return promise;
}

// 전체 사전 오버라이드 최초 스트리밍 로드 (최신 데이터부터 페이지 단위 즉시 반영)
async function fetchAllHanjaOverridesStreaming() {
  if (!supabaseClient) return false;

  const pageSize = 1000;
  let page = 0;
  let keepFetching = true;
  let fetchFailed = false;
  let totalFetched = 0;
  let maxId = 0;
  let maxUpdatedAt = '';
  const syncStartedAt = new Date().toISOString();

  while (keepFetching) {
    const { data, error } = await supabaseClient
      .from('hanja_dict')
      .select('id,hanja,korean,meaning,updated_at')
      .neq('meaning', '')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      fetchFailed = true;
      keepFetching = false;
      break;
    }

    if (data && data.length > 0) {
      totalFetched += data.length;

      // 각 페이지 도착 즉시 메모리에 반영하여 최신 SQL 데이터가 바로 보이도록 함
      applyOverridesToMemory(data);
      recordOverridesInCacheMap(data, false);

      for (const item of data) {
        if (!item.hanja || !item.korean) continue;
        knownSupabaseKeys.add(`${item.hanja}_${item.korean}`);
        if (typeof item.id === 'number' && item.id > maxId) {
          maxId = item.id;
        }
        if (item.updated_at && (!maxUpdatedAt || item.updated_at > maxUpdatedAt)) {
          maxUpdatedAt = item.updated_at;
        }
      }

      await saveOverridesToIndexedDB(data);

      if (data.length < pageSize) {
        keepFetching = false;
      } else {
        page++;
      }
    } else {
      keepFetching = false;
    }
  }

  if (!fetchFailed && totalFetched > 0) {
    supabaseBaselineLoaded = true;
    const effectiveSyncAt = maxUpdatedAt && maxUpdatedAt > syncStartedAt ? maxUpdatedAt : syncStartedAt;
    await saveOverridesToIndexedDB([], {
      hasFullSync: true,
      lastMaxId: maxId,
      lastSyncAt: effectiveSyncAt
    });
    lastRecentSyncAtMs = Date.now();
    return true;
  }

  return false;
}

// 마지막 동기화 이후 추가·수정된 증분(Delta) 데이터만 빠르게 조회하여 반영
async function syncRecentHanjaFromSupabase(options = {}) {
  if (!supabaseClient) return [];
  const force = Boolean(options.force);
  const nowMs = Date.now();
  if (!force && nowMs - lastRecentSyncAtMs < 5000) {
    return [];
  }
  if (syncRecentPromise) {
    return syncRecentPromise;
  }

  syncRecentPromise = (async () => {
    try {
      let lastSyncAt = options.lastSyncAt;
      let lastMaxId = typeof options.lastMaxId === 'number' ? options.lastMaxId : 0;

      if (!lastSyncAt || lastMaxId === 0) {
        const meta = await getHanjaCacheMeta();
        if (!lastSyncAt) lastSyncAt = meta.lastSyncAt;
        if (!lastMaxId) lastMaxId = Number(meta.lastMaxId) || 0;
      }

      if (!lastSyncAt) {
        return [];
      }

      // SQL 스크립트 생성 시각과 실행 시각 사이의 시차를 감안한 24시간 안전 여유분
      const baseMs = Date.parse(lastSyncAt);
      const sinceIso = Number.isFinite(baseMs)
        ? new Date(baseMs - 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const syncStartedAt = new Date().toISOString();
      const updatedRowsMap = new Map();
      const pageSize = 1000;

      const fetchDeltaStream = async (applyFilterFn) => {
        let page = 0;
        let keepFetching = true;
        while (keepFetching) {
          let query = supabaseClient
            .from('hanja_dict')
            .select('id,hanja,korean,meaning,updated_at')
            .neq('meaning', '');
          query = applyFilterFn(query);
          const { data, error } = await query
            .order('updated_at', { ascending: false })
            .order('id', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) {
            console.warn('Delta sync query error:', error);
            return false;
          }

          if (data && data.length > 0) {
            applyOverridesToMemory(data, { preferRemote: true });
            recordOverridesInCacheMap(data, true);
            for (const item of data) {
              if (!item.hanja || !item.korean) continue;
              const key = `${item.hanja}_${item.korean}`;
              updatedRowsMap.set(key, item);
              knownSupabaseKeys.add(key);
            }
            if (data.length < pageSize) {
              keepFetching = false;
            } else {
              page++;
            }
          } else {
            keepFetching = false;
          }
        }
        return true;
      };

      const queries = [
        fetchDeltaStream(q => q.gte('updated_at', sinceIso))
      ];
      if (lastMaxId > 0) {
        queries.push(fetchDeltaStream(q => q.gt('id', lastMaxId)));
      }

      const results = await Promise.all(queries);
      const allOk = results.every(Boolean);

      if (allOk) {
        lastRecentSyncAtMs = Date.now();
        const deltaRows = Array.from(updatedRowsMap.values());
        let nextMaxId = lastMaxId;
        let maxUpdatedAt = lastSyncAt;

        for (const item of deltaRows) {
          if (typeof item.id === 'number' && item.id > nextMaxId) {
            nextMaxId = item.id;
          }
          if (item.updated_at && (!maxUpdatedAt || item.updated_at > maxUpdatedAt)) {
            maxUpdatedAt = item.updated_at;
          }
        }

        const nextSyncAt = syncStartedAt > maxUpdatedAt ? syncStartedAt : maxUpdatedAt;
        await saveOverridesToIndexedDB(deltaRows, {
          hasFullSync: true,
          lastMaxId: nextMaxId,
          lastSyncAt: nextSyncAt
        });

        if (deltaRows.length > 0) {
          recentKoreanQueryTimestamps.clear();
          refreshActiveSearchResultsIfNeeded();
        }
        return deltaRows;
      }
      return [];
    } catch (err) {
      console.warn('Error in syncRecentHanjaFromSupabase:', err);
      return [];
    } finally {
      syncRecentPromise = null;
    }
  })();

  return syncRecentPromise;
}

// Supabase 및 IndexedDB 캐시에서 뜻 정보를 가져와 메모리에 반영
async function loadHanjaOverridesFromSupabase() {
  if (loadHanjaOverridesPromise) {
    return loadHanjaOverridesPromise;
  }

  loadHanjaOverridesPromise = (async () => {
    try {
      const { idbItems, meta } = await loadCachedOverridesIntoMemory();

      if (!supabaseClient) return;

      if (meta && meta.hasFullSync && idbItems.length > 0) {
        idbItems.forEach(item => {
          if (item && item.hanja && item.korean) {
            knownSupabaseKeys.add(`${item.hanja}_${item.korean}`);
          }
        });
        supabaseBaselineLoaded = true;

        await syncRecentHanjaFromSupabase({
          lastSyncAt: meta.lastSyncAt,
          lastMaxId: Number(meta.lastMaxId) || 0,
          force: true
        });
      } else {
        await fetchAllHanjaOverridesStreaming();
      }
    } catch (err) {
      console.warn('Error fetching hanja_dict overrides from Supabase:', err);
    } finally {
      if (!supabaseBaselineLoaded) {
        loadHanjaOverridesPromise = null;
      }
    }
  })();

  return loadHanjaOverridesPromise;
}

// 전체 로컬 텍스트 파일 로딩 완료 후 캐시된 오버라이드 재적용 및 미등록/더 상세한 항목 DB 동기화 준비
async function reapplyCachedOverridesAfterAllFilesLoaded() {
  if (loadHanjaOverridesPromise) {
    await loadHanjaOverridesPromise;
  }

  const pendingMap = new Map();
  const baselineItems = [];
  const remotePreferredItems = [];

  for (const item of overrideCacheMap.values()) {
    if (item.preferRemote) {
      remotePreferredItems.push(item);
    } else {
      baselineItems.push(item);
    }
  }

  if (baselineItems.length > 0) {
    applyOverridesToMemory(baselineItems, { trackPendingMap: pendingMap, preferRemote: false });
  }
  if (remotePreferredItems.length > 0) {
    applyOverridesToMemory(remotePreferredItems, { preferRemote: true });
  }

  if (supabaseBaselineLoaded) {
    for (const [korean, innerMap] of hanjaMap.entries()) {
      for (const [hanja, obj] of innerMap.entries()) {
        if (!obj || !obj.meaning) continue;
        const key = `${hanja}_${korean}`;
        if (!knownSupabaseKeys.has(key) && !pendingMap.has(key)) {
          pendingMap.set(key, { hanja, korean, meaning: obj.meaning });
        }
      }
    }
    pendingSupabaseSyncItems = Array.from(pendingMap.values());

    if (isLoggedIn && pendingSupabaseSyncItems.length > 0 && !supabaseSyncCompleted) {
      syncPendingHanjaToSupabase();
    }
  }
}

// 오버라이드 데이터를 hanjaMap과 hanjaList에 적용하는 헬퍼 함수
function applyOverridesToMemory(items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) return;
  const trackPendingMap = options.trackPendingMap || null;
  const preferRemote = Boolean(options.preferRemote);

  const isDetailOpen = Boolean(panelDetail && panelDetail.classList.contains('active') && currentDetailItem);
  const editAreaEl = isDetailOpen ? document.getElementById('editArea') : null;
  const isEditingDetail = Boolean(editAreaEl && editAreaEl.style.display === 'flex');

  for (const item of items) {
    const { hanja, korean, meaning } = item;
    if (!hanja || !korean || meaning === undefined) continue;

    // hanjaMap 확인 및 반영
    if (!hanjaMap.has(korean)) {
      hanjaMap.set(korean, new Map());
    }
    const inner = hanjaMap.get(korean);
    const existing = inner.get(hanja) || {};

    // 로컬 사전의 뜻이 구버전 캐시나 DB 레코드보다 더 상세한 경우(새로 추가된 표·그림 포함) 로컬 뜻을 유지하고 DB 동기화 대상에 포함
    // 단, 실시간 DB 조회나 최신 변경분 동기화(preferRemote: true)에서는 DB의 최신 수정 뜻을 우선 적용
    const localIsRicher = !preferRemote && Boolean(
      existing.meaning &&
      existing.meaning.length > (meaning || '').length
    );

    if (localIsRicher) {
      if (trackPendingMap) {
        trackPendingMap.set(`${hanja}_${korean}`, {
          hanja,
          korean,
          meaning: existing.meaning
        });
      }
      continue;
    }

    inner.set(hanja, {
      ...existing,
      meaning,
      preferRemote: preferRemote || Boolean(existing.preferRemote)
    });

    // hanjaList 반영 (단일 한자만 대상)
    if (hanja.length === 1) {
      upsertSingleCharInList(korean, hanja, meaning, existing.file || '');
    }

    // 현재 상세 보기 중인 항목과 일치하면(편집 중이 아닐 때) 상세 화면 즉시 갱신
    if (isDetailOpen && !isEditingDetail && currentDetailItem && currentDetailItem.hanja === hanja) {
      const detailKoreanStr = currentDetailItem.korean || '';
      const detailKoreanParts = detailKoreanStr
        .split(',')
        .map(s => s.trim())
        .filter(s => s && s !== '?');

      if (detailKoreanStr === korean || detailKoreanParts.length === 0) {
        if (!detailKoreanStr || detailKoreanStr === '?') {
          currentDetailItem.korean = korean;
          if (detailKorean) {
            detailKorean.textContent = `${korean} (${hanja})`;
          }
        }
        currentDetailItem.meaning = meaning;
        if (detailMeaning) {
          if (meaning) {
            safeSetHanjaMarkdownHTML(detailMeaning, meaning);
          } else {
            detailMeaning.textContent = '뜻 정보 없음';
          }
        }
        if (meaningDisplay && meaningDisplay.classList.contains('show')) {
          if (meaning) {
            safeSetHanjaMarkdownHTML(meaningDisplay, meaning);
          } else {
            meaningDisplay.textContent = '뜻 정보 없음';
          }
        }
      } else if (detailKoreanParts.length > 1 && detailKoreanParts.includes(korean)) {
        const matches = hanjaList.filter(entry => entry.hanja === hanja && entry.meaning);
        if (matches.length > 0) {
          const combinedMeaning = matches.length === 1
            ? matches[0].meaning
            : matches.map((m, idx) => `${idx + 1}. ${m.korean ? `[${m.korean}] ` : ''}${m.meaning}`).join('\n\n');
          currentDetailItem.meaning = combinedMeaning;
          if (detailMeaning) {
            safeSetHanjaMarkdownHTML(detailMeaning, combinedMeaning);
          }
        }
      }
    }
  }
}

// 로컬 사전에는 있으나 Supabase에 미반영/구버전인 항목을 로그인 상태에서 자동 동기화
async function syncPendingHanjaToSupabase() {
  if (!supabaseClient || !isLoggedIn || isSyncingPending || pendingSupabaseSyncItems.length === 0) {
    return;
  }

  isSyncingPending = true;
  const itemsToSync = [...pendingSupabaseSyncItems];
  const nowIso = new Date().toISOString();
  const batchSize = 100;
  let syncedCount = 0;

  try {
    for (let i = 0; i < itemsToSync.length; i += batchSize) {
      const batch = itemsToSync.slice(i, i + batchSize).map(item => ({
        hanja: item.hanja,
        korean: item.korean,
        meaning: item.meaning,
        updated_at: nowIso
      }));

      const { error } = await supabaseClient
        .from('hanja_dict')
        .upsert(batch, { onConflict: 'hanja,korean' });

      if (error) {
        console.warn('Supabase pending hanja sync error:', error);
        return;
      }
      syncedCount += batch.length;
    }

    const syncedKeys = new Set(itemsToSync.map(item => `${item.hanja}_${item.korean}`));
    pendingSupabaseSyncItems = pendingSupabaseSyncItems.filter(
      item => !syncedKeys.has(`${item.hanja}_${item.korean}`)
    );
    if (pendingSupabaseSyncItems.length === 0) {
      supabaseSyncCompleted = true;
    }

    const syncedRecords = itemsToSync.map(item => ({
      hanja: item.hanja,
      korean: item.korean,
      meaning: item.meaning,
      updated_at: nowIso
    }));
    syncedKeys.forEach(k => knownSupabaseKeys.add(k));
    recordOverridesInCacheMap(syncedRecords, false);
    await saveOverridesToIndexedDB(syncedRecords, { lastSyncAt: nowIso });

    if (syncedCount > 0) {
      showToast(`사전 데이터 ${syncedCount}건 Supabase DB 동기화 완료`);
    }
  } catch (err) {
    console.warn('Supabase auto-sync exception:', err);
  } finally {
    isSyncingPending = false;
  }
}

// 한자 뜻 편집 관련 이벤트 바인딩
const startEditBtn = document.getElementById('startEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const editArea = document.getElementById('editArea');
const editMeaningInput = document.getElementById('editMeaningInput');

if (startEditBtn) {
  startEditBtn.addEventListener('click', () => {
    if (!isLoggedIn) {
      alert('뜻 정보 편집은 로그인한 사용자만 가능합니다. 먼저 로그인해 주세요.');
      if (loginDialog) loginDialog.showModal();
      return;
    }
    if (!currentDetailItem) return;
    // </br> 및 <br> 태그를 줄바꿈(\n)으로 복원해서 편집 창에 채워 넣음
    const rawMeaning = (currentDetailItem.meaning || '')
      .replace(/<\/br>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n');
    editMeaningInput.value = rawMeaning;
    detailMeaning.style.display = 'none';
    startEditBtn.style.display = 'none';
    editArea.style.display = 'flex';
    editMeaningInput.focus();
  });
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener('click', () => {
    editArea.style.display = 'none';
    detailMeaning.style.display = 'block';
    if (isLoggedIn) {
      startEditBtn.style.display = 'flex';
    }
  });
}

if (saveEditBtn) {
  saveEditBtn.addEventListener('click', async () => {
    if (!currentDetailItem) return;

    if (!isLoggedIn) {
      alert('뜻 정보 편집은 로그인한 사용자만 가능합니다. 먼저 로그인해 주세요.');
      if (loginDialog) loginDialog.showModal();
      return;
    }

    const rawInput = editMeaningInput.value.trim();
    // 줄바꿈을 </br>로 치환하여 저장
    const processedMeaning = rawInput.replace(/\n/g, '</br>');

    saveEditBtn.disabled = true;
    saveEditBtn.textContent = '저장 중...';

    const hanjaChar = currentDetailItem.hanja;
    const koreanSound = currentDetailItem.korean || '';
    let saveOk = false;
    let errorMessage = '';

    // 1. Supabase hanja_dict 테이블에 저장
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('hanja_dict').upsert({
          hanja: hanjaChar,
          korean: koreanSound,
          meaning: processedMeaning,
          updated_at: new Date().toISOString()
        }, { onConflict: 'hanja,korean' });

        if (error) {
          console.warn('Supabase hanja_dict upsert error:', error);
          errorMessage = error.message;
        } else {
          saveOk = true;
        }
      } catch (dbErr) {
        console.warn('Supabase connection error:', dbErr);
        errorMessage = dbErr.message;
      }
    }

    // 2. 로컬 개발 서버(/api/save_hanja)가 켜져 있는 경우 로컬 파일 동기화도 시도
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal && currentDetailItem.file) {
      try {
        const response = await fetch('/api/save_hanja', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file: currentDetailItem.file,
            korean: koreanSound,
            hanja: hanjaChar,
            meaning: processedMeaning
          })
        });
        const resData = await response.json();
        if (resData.success) {
          saveOk = true;
        }
      } catch (localErr) {
        // 로컬 파이썬 서버가 꺼져 있을 수 있으므로 조용히 무시
      }
    }

    // 3. 브라우저 캐시 백업 (IndexedDB + 최근 100건 localStorage)
    const cachedOk = await saveSingleOverrideToCache({
      hanja: hanjaChar,
      korean: koreanSound,
      meaning: processedMeaning,
      updated_at: new Date().toISOString()
    }, {
      preferRemote: true,
      knownInSupabase: saveOk
    });
    if (!saveOk && !errorMessage && cachedOk) saveOk = true;

    saveEditBtn.disabled = false;
    saveEditBtn.textContent = '저장';

    if (!saveOk && errorMessage) {
      if (errorMessage.includes('relation "hanja_dict" does not exist') || errorMessage.includes('404')) {
        alert('Supabase에 "hanja_dict" 테이블이 아직 생성되지 않아 현재 브라우저에 임시 저장되었습니다.\nSQL Editor에서 scripts/create_hanja_dict_table.sql 을 실행해주세요.');
      } else {
        alert('저장 중 경고: ' + errorMessage + '\n(현재 브라우저에는 정상 반영되었습니다)');
      }
    }

    // 메모리 데이터 동기화
    currentDetailItem.meaning = processedMeaning;

    // hanjaMap 업데이트
    if (currentDetailItem.korean) {
      if (!hanjaMap.has(currentDetailItem.korean)) {
        hanjaMap.set(currentDetailItem.korean, new Map());
      }
      const innerMap = hanjaMap.get(currentDetailItem.korean);
      if (innerMap.has(currentDetailItem.hanja)) {
        const entry = innerMap.get(currentDetailItem.hanja);
        entry.meaning = processedMeaning;
        entry.preferRemote = true;
      } else {
        innerMap.set(currentDetailItem.hanja, {
          meaning: processedMeaning,
          file: currentDetailItem.file || '',
          preferRemote: true
        });
      }
    }

    // hanjaList 업데이트
    if (currentDetailItem.hanja && currentDetailItem.hanja.length === 1) {
      upsertSingleCharInList(
        currentDetailItem.korean,
        currentDetailItem.hanja,
        processedMeaning,
        currentDetailItem.file
      );
    }

    // 뷰 갱신 및 상태 복구
    if (processedMeaning) {
      safeSetHanjaMarkdownHTML(detailMeaning, processedMeaning);
    } else {
      detailMeaning.textContent = '뜻 정보 없음';
    }
    editArea.style.display = 'none';
    detailMeaning.style.display = 'block';
    if (isLoggedIn) {
      startEditBtn.style.display = 'flex';
    }

    showToast('뜻 설명이 성공적으로 저장되었습니다!');
  });
}

// 토스트 메시지 보이기
function showToast(message) {
  if (message) {
    toast.textContent = message;
  } else {
    toast.textContent = '클립보드에 복사되었습니다!';
  }

  toast.classList.add('show');

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// 탭 복귀 시 자동 증분 동기화 (SQL Editor 등에서 데이터 반영 후 탭 전환 시 즉시 갱신)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !supabaseClient) return;

  recentKoreanQueryTimestamps.clear();

  if (supabaseBaselineLoaded) {
    syncRecentHanjaFromSupabase();
  } else if (!loadHanjaOverridesPromise) {
    loadHanjaOverridesFromSupabase();
  }

  if (panelDetail && panelDetail.classList.contains('active') && currentDetailItem) {
    const editAreaEl = document.getElementById('editArea');
    const isEditing = editAreaEl && editAreaEl.style.display === 'flex';
    if (!isEditing) {
      fetchSingleHanjaFromSupabase(currentDetailItem.hanja, currentDetailItem.korean);
    }
  }
});

// 데이터 로드 시작 및 요소 초기화
window.addEventListener('DOMContentLoaded', () => {
  updateAppAuthState();
  initApp();
  initCanvas();
  initAuth();
});
