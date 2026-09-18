/* ══════════════════════════════════════════════════════
   listening.js — 영어 듣기 앱 핵심 로직
   ══════════════════════════════════════════════════════ */

// Audio & Subtitle States
let subtitles = [];
let audioName = "";
let activeIndex = -1;

// Playback Settings
let speed = 1.0;
let volume = 1.0;

// Looping & Timeline Status
let globalLoopEnabled = false; // "R" toggle (Repeat Current Section)
let loopSectionIndex = null;   // The locked section index for looping when globalLoopEnabled is ON
let isRangeLoopActive = false; // Flag indicating custom range loop is active (롱프레스 구간 반복)
let rangeLoopStart = 0;        // Start index for range loop
let rangeLoopEnd = 0;          // End index for range loop
let isDraggingTimeline = false;
let loopCountRemaining = 5; // Default repeat count for current section (5 times)
let loopDelayTimer = null;   // Timer for 1-second pause between loops
let isLoopWaiting = false;    // Flag indicating 1-second silent pause is active
let isSubtitleHidden = false; // Flag indicating if subtitles are currently hidden
let sortMode = 'sequential';  // Sort mode: 'sequential' (시간순) | 'hardest' (어려운 순)

function clearLoopWaitTimer() {
  if (loopDelayTimer) {
    clearTimeout(loopDelayTimer);
    loopDelayTimer = null;
  }
  isLoopWaiting = false;
}

// ── Toast Notification ──
let toastTimer = null;
function showListeningToast(message) {
  let toast = document.getElementById('listening-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'listening-toast';
    toast.className = 'listening-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 1800);
}

// ── Custom Range Loop (길게 누른 구간부터 현재 재생 구간까지 반복) ──
function startCustomRangeLoop(pressedIdx) {
  if (subtitles.length === 0) return;
  clearLoopWaitTimer();

  // 현재 재생 중인 구간 파악 (오디오가 흐르고 있다면 activeIndex 또는 currentTime 기준)
  let curPlayingIdx = activeIndex;
  if (curPlayingIdx === -1) {
    const curTime = audioPlayer.currentTime;
    for (let i = 0; i < subtitles.length; i++) {
      if (curTime >= subtitles[i].start && curTime < subtitles[i].end) {
        curPlayingIdx = i;
        break;
      }
    }
  }
  if (curPlayingIdx === -1) {
    curPlayingIdx = pressedIdx;
  }

  const fromIdx = Math.min(pressedIdx, curPlayingIdx);
  const toIdx = Math.max(pressedIdx, curPlayingIdx);

  isRangeLoopActive = true;
  rangeLoopStart = fromIdx;
  rangeLoopEnd = toIdx;

  // 루프 버튼 활성화
  globalLoopEnabled = true;
  repeatToggleBtn.classList.add('btn-active');
  loopSectionIndex = fromIdx;

  // 시작 구간으로 점프하여 바로 재생
  jumpToSection(fromIdx);

  updateTimelineLoopZone();
  updateRangeLoopCardsUI();

  const startNum = fromIdx + 1;
  const endNum = toIdx + 1;
  showListeningToast(`🔁 구간 반복: #${startNum} ~ #${endNum} 구간`);
}

function cancelCustomRangeLoop() {
  if (!isRangeLoopActive) return;
  isRangeLoopActive = false;
  rangeLoopStart = 0;
  rangeLoopEnd = 0;
  updateRangeLoopCardsUI();
  updateTimelineLoopZone();
}

function updateRangeLoopCardsUI() {
  const cards = transcriptPane.querySelectorAll('.sub-card');
  cards.forEach(card => {
    const idx = parseInt(card.dataset.index, 10);

    // 기존 동적 배지 제거
    const existingStart = card.querySelector('.range-badge-start');
    if (existingStart) existingStart.remove();
    const existingEnd = card.querySelector('.range-badge-end');
    if (existingEnd) existingEnd.remove();

    if (isRangeLoopActive && idx >= rangeLoopStart && idx <= rangeLoopEnd) {
      card.classList.add('is-in-range');
      const badgeWrapper = card.querySelector('.sub-card-content > div:first-child');
      if (badgeWrapper) {
        if (idx === rangeLoopStart) {
          const startBadge = document.createElement('span');
          startBadge.className = 'range-badge range-badge-start';
          startBadge.textContent = '🔁 시작';
          badgeWrapper.appendChild(startBadge);
        }
        if (idx === rangeLoopEnd && rangeLoopStart !== rangeLoopEnd) {
          const endBadge = document.createElement('span');
          endBadge.className = 'range-badge range-badge-end';
          endBadge.textContent = '🎯 끝';
          badgeWrapper.appendChild(endBadge);
        }
      }
    } else {
      card.classList.remove('is-in-range');
    }
  });
}


// SVG Icons for iOS Compatibility
const PLAY_SVG = `<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>`;
const PAUSE_SVG = `<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>`;

// ── IndexedDB Storage for Audio & Subtitle Sets ──
const DB_NAME = 'ListeningAppDB';
const DB_VERSION = 2;
const STORE_NAME = 'audioStore';
const STORE_ITEMS = 'listening_items';

let currentListeningItemId = null;
let itemToAttachAudio = null;
let itemToAttachSub = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function getAllListeningItemsFromDB() {
  try {
    const db = await openDB();
    await migrateLegacyListeningData(db);

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      const store = tx.objectStore(STORE_ITEMS);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        // Auto-correct previously corrupted items where title was wrongly set to "Project Hail Mary"
        for (const item of items) {
          const isHailMaryAudio = (item.audioName && item.audioName.toLowerCase().includes('hail mary')) ||
                                  (item.subtitleName && item.subtitleName.toLowerCase().includes('hail mary'));
          if (!isHailMaryAudio) {
            let modified = false;
            if (item.title === 'Project Hail Mary' || item.docBookTitle === 'Project Hail Mary') {
              item.title = (item.subtitleName || item.audioName || '새 학습 파일').replace(/\.[^/.]+$/, '');
              item.docBookTitle = item.title;
              modified = true;
            }
            if (item.docAuthor === 'Andy Weir') {
              item.docAuthor = '';
              modified = true;
            }
            if (modified) {
              store.put(item);
            }
          }
        }
        if (localStorage.getItem('listening_doc_title') === 'Project Hail Mary' || localStorage.getItem('listening_doc_author') === 'Andy Weir') {
          localStorage.removeItem('listening_doc_title');
          localStorage.removeItem('listening_doc_author');
        }
        items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(items);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('Failed to get listening items:', err);
    return [];
  }
}

async function getListeningItemFromDB(id) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_ITEMS, 'readonly');
      const store = tx.objectStore(STORE_ITEMS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

async function saveListeningItemToDB(item) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_ITEMS, 'readwrite');
    const store = tx.objectStore(STORE_ITEMS);
    item.updatedAt = Date.now();
    store.put(item);
  } catch (err) {
    console.warn('Failed to save listening item:', err);
  }
}

async function deleteListeningItemFromDB(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_ITEMS, 'readwrite');
    const store = tx.objectStore(STORE_ITEMS);
    store.delete(id);
  } catch (err) {
    console.warn('Failed to delete listening item:', err);
  }
}

async function migrateLegacyListeningData(db) {
  try {
    if (!db.objectStoreNames.contains(STORE_ITEMS)) return;
    const count = await new Promise((resolve) => {
      const tx = db.transaction(STORE_ITEMS, 'readonly');
      const req = tx.objectStore(STORE_ITEMS).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
    if (count > 0) return;

    let legacyAudio = null;
    if (db.objectStoreNames.contains(STORE_NAME)) {
      legacyAudio = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get('lastAudio');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
    }

    const legacySubText = localStorage.getItem('listening_subtitle_text');
    const legacySubName = localStorage.getItem('listening_subtitle_name');
    const legacyAuthor = localStorage.getItem('listening_doc_author') || "";
    const legacyTitle = localStorage.getItem('listening_doc_title') || "";

    if (legacyAudio || legacySubText) {
      const parsedSubs = legacySubText ? parseSubtitleText(legacySubText) : [];
      const itemTitle = legacyTitle || (legacyAudio ? legacyAudio.name : legacySubName) || "기존 학습 파일";
      const newItem = {
        id: 'listen_' + Date.now(),
        title: itemTitle,
        docAuthor: legacyAuthor,
        docBookTitle: legacyTitle,
        audioBlob: legacyAudio ? legacyAudio.blob : null,
        audioName: legacyAudio ? legacyAudio.name : '',
        subtitles: parsedSubs,
        subtitleText: legacySubText || '',
        subtitleName: legacySubName || '',
        lastTime: parseFloat(localStorage.getItem('listening_last_time')) || 0,
        sortMode: localStorage.getItem('listening_sort_mode') || 'sequential',
        checkedIndices: [],
        updatedAt: Date.now()
      };
      const tx = db.transaction(STORE_ITEMS, 'readwrite');
      tx.objectStore(STORE_ITEMS).put(newItem);
    }
  } catch (e) {
    console.warn('Legacy migration skipped:', e);
  }
}

async function saveCurrentListeningItemState() {
  if (!currentListeningItemId) return;
  try {
    const item = await getListeningItemFromDB(currentListeningItemId);
    if (!item) return;

    item.docAuthor = docAuthor || "";
    item.docBookTitle = docBookTitle || "";
    if (docBookTitle) {
      item.title = docBookTitle;
    } else if (item.subtitleName) {
      item.title = item.subtitleName.replace(/\.[^/.]+$/, '');
      item.docBookTitle = item.title;
    } else if (item.audioName) {
      item.title = item.audioName.replace(/\.[^/.]+$/, '');
      item.docBookTitle = item.title;
    }
    item.subtitles = subtitles;
    item.subtitleText = localStorage.getItem('listening_subtitle_text') || item.subtitleText;
    item.sortMode = sortMode;
    item.checkedIndices = getCheckedIndices();
    if (audioPlayer && audioPlayer.currentTime > 0) {
      item.lastTime = audioPlayer.currentTime;
    }
    item.updatedAt = Date.now();
    await saveListeningItemToDB(item);
  } catch (err) {
    console.warn('Error saving current listening state:', err);
  }
}

function showListeningWorkspace() {
  const fileListView = document.getElementById('file-list-view');
  const playerView = document.getElementById('player-view');
  if (fileListView) fileListView.style.display = 'none';
  if (playerView) playerView.style.display = 'flex';
}

async function showListeningFileList() {
  if (audioPlayer && !audioPlayer.paused) {
    audioPlayer.pause();
  }
  await saveCurrentListeningItemState();

  const fileListView = document.getElementById('file-list-view');
  const playerView = document.getElementById('player-view');
  if (playerView) playerView.style.display = 'none';
  if (fileListView) fileListView.style.display = 'block';

  await renderListeningFileList();
}

async function renderListeningFileList() {
  const listContainer = document.getElementById('file-cards-list');
  if (!listContainer) return;

  const items = await getAllListeningItemsFromDB();
  if (!items || items.length === 0) {
    listContainer.innerHTML = `
      <div class="file-empty-state">
        <div class="empty-icon">🎧</div>
        <h3>저장된 학습 파일이 없습니다</h3>
        <p>상단의 [새 파일 열기] 버튼을 눌러 음원(.mp3)이나 대본(.srt, .txt) 파일을 추가해보세요.</p>
        <div class="empty-action-row">
          <button type="button" class="btn-primary-action" onclick="document.getElementById('btn-toggle-new-picker').click()">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"></path></svg>
            새 파일 추가
          </button>
        </div>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = items.map(item => {
    let dateText = '';
    if (item.updatedAt) {
      const d = new Date(item.updatedAt);
      dateText = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    }

    const hasAudio = !!(item.audioBlob || item.audioName);
    const subCount = (item.subtitles && item.subtitles.length) ? item.subtitles.length : 0;
    const hasSub = subCount > 0;
    const title = item.title || item.docBookTitle || item.audioName || item.subtitleName || '듣기 학습 세트';

    return `
      <div class="file-card" data-id="${escapeHtml(item.id)}">
        <div class="file-card-main" onclick="openListeningItemFromList('${escapeHtml(item.id)}')">
          <div class="file-card-icon">🎧</div>
          <div class="file-card-info">
            <div class="file-card-title">${escapeHtml(title)}</div>
            <div class="file-card-meta">
              ${item.docAuthor ? `<span class="file-meta-author">${escapeHtml(item.docAuthor)}</span>` : ''}
              ${hasAudio ? `<span class="file-meta-tag green">🎵 ${escapeHtml(item.audioName || '음원 등록됨')}</span>` : `<span class="file-meta-tag amber">음원 없음</span>`}
              ${hasSub ? `<span class="file-meta-tag">📝 대본 ${subCount}구간</span>` : `<span class="file-meta-tag amber">대본 없음</span>`}
              ${dateText ? `<span class="file-meta-date">${dateText}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="file-card-actions">
          ${!hasAudio ? `
            <button type="button" class="btn-card-action" onclick="attachAudioToItem('${escapeHtml(item.id)}', event)" title="음원 추가">
              + 음원
            </button>
          ` : ''}
          ${!hasSub ? `
            <button type="button" class="btn-card-action" onclick="attachSubtitleToItem('${escapeHtml(item.id)}', event)" title="대본 추가">
              + 대본
            </button>
          ` : ''}
          <button type="button" class="btn-card-delete" onclick="deleteListeningItemFromList('${escapeHtml(item.id)}', event)" title="삭제">
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

async function openListeningItem(itemId) {
  try {
    const item = await getListeningItemFromDB(itemId);
    if (!item) {
      alert('학습 데이터를 불러올 수 없습니다.');
      return;
    }

    currentListeningItemId = item.id;
    docAuthor = item.docAuthor || "";
    docBookTitle = item.docBookTitle || item.title || "";
    updateMetadataUI();

    // 1. Restore Subtitles
    if (item.subtitles && item.subtitles.length > 0) {
      subtitles = item.subtitles;
      if (item.checkedIndices && Array.isArray(item.checkedIndices)) {
        const checkedSet = new Set(item.checkedIndices);
        subtitles.forEach(s => s.checked = checkedSet.has(s.index));
      }
      if (btnExportData) btnExportData.style.display = 'inline-block';
      if (btnClearStorage) btnClearStorage.style.display = 'inline-block';
      renderSubtitles();
    } else if (item.subtitleText) {
      subtitles = parseSubtitleText(item.subtitleText, item.subtitleName || item.title || '');
      if (item.docAuthor !== undefined && item.docAuthor !== null) {
        docAuthor = item.docAuthor;
      }
      if (item.docBookTitle) {
        docBookTitle = item.docBookTitle;
      }
      updateMetadataUI();
      if (btnExportData) btnExportData.style.display = 'inline-block';
      if (btnClearStorage) btnClearStorage.style.display = 'inline-block';
      renderSubtitles();
    } else {
      subtitles = [];
      renderSubtitles();
    }

    // 2. Restore Audio
    if (item.audioBlob) {
      audioName = item.audioName || "저장된 음원";
      if (loadedAudioNameSpan) loadedAudioNameSpan.textContent = audioName;
      if (btnClearStorage) btnClearStorage.style.display = 'inline-block';

      const mimeType = item.audioBlob.type || "audio/mpeg";
      const objectURL = URL.createObjectURL(item.audioBlob);

      audioPlayer.src = objectURL;
      audioPlayer.innerHTML = "";
      const source = document.createElement('source');
      source.src = objectURL;
      source.type = mimeType;
      audioPlayer.appendChild(source);
      audioPlayer.load();

      const restoreTime = () => {
        const savedTime = item.lastTime || 0;
        if (savedTime > 0 && savedTime < (audioPlayer.duration || Infinity)) {
          audioPlayer.currentTime = savedTime;
          updateTimelineProgress();
          syncSubtitleHighlight(savedTime);
        }
      };

      if (audioPlayer.readyState >= 1) {
        restoreTime();
      } else {
        audioPlayer.addEventListener('loadedmetadata', restoreTime, { once: true });
      }
    } else {
      audioName = "";
      audioPlayer.src = "";
      audioPlayer.innerHTML = "";
      if (loadedAudioNameSpan) loadedAudioNameSpan.textContent = "음원 없음";
    }

    // 3. Sort Mode
    sortMode = item.sortMode || 'sequential';
    updateSortUI();

    showListeningWorkspace();
  } catch (err) {
    console.warn('Failed opening listening item:', err);
  }
}

// Global functions for template callbacks
window.openListeningItemFromList = function(id) {
  openListeningItem(id);
};

window.deleteListeningItemFromList = async function(id, e) {
  if (e) e.stopPropagation();
  if (!confirm('이 학습 파일을 보관함에서 삭제하시겠습니까?')) return;
  await deleteListeningItemFromDB(id);
  if (currentListeningItemId === id) {
    currentListeningItemId = null;
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.src = "";
    }
  }
  await renderListeningFileList();
};

window.attachAudioToItem = function(id, e) {
  if (e) e.stopPropagation();
  itemToAttachAudio = id;
  const picker = document.getElementById('audio-file');
  if (picker) {
    picker.value = '';
    picker.click();
  }
};

window.attachSubtitleToItem = function(id, e) {
  if (e) e.stopPropagation();
  itemToAttachSub = id;
  const picker = document.getElementById('subtitle-file');
  if (picker) {
    picker.value = '';
    picker.click();
  }
};

// 2단계 모바일 단일 파일 선택 임시 변수
let tempListeningAudio = null;
let tempListeningSubtitle = null;

function updateSelectedTagsUI() {
  const tagsBox = document.getElementById('selected-tags-box');
  const startBtn = document.getElementById('btn-start-selected-learning');
  if (!tagsBox) return;

  tagsBox.innerHTML = '';
  if (tempListeningAudio) {
    const tag = document.createElement('div');
    tag.className = 'selected-file-tag';
    tag.title = '터치하여 선택 취소';
    tag.innerHTML = `<span>🎵 음원: ${escapeHtml(tempListeningAudio.name)}</span> <span class="tag-remove-icon">&times;</span>`;
    tag.addEventListener('click', () => {
      tempListeningAudio = null;
      const audInput = document.getElementById('picker-audio-input');
      if (audInput) audInput.value = '';
      updateSelectedTagsUI();
    });
    tagsBox.appendChild(tag);
  }

  if (tempListeningSubtitle) {
    const tag = document.createElement('div');
    tag.className = 'selected-file-tag';
    tag.title = '터치하여 선택 취소';
    tag.innerHTML = `<span>📝 대본: ${escapeHtml(tempListeningSubtitle.name)} (${tempListeningSubtitle.parsed.length}구간)</span> <span class="tag-remove-icon">&times;</span>`;
    tag.addEventListener('click', () => {
      tempListeningSubtitle = null;
      const subInput = document.getElementById('picker-sub-input');
      if (subInput) subInput.value = '';
      updateSelectedTagsUI();
    });
    tagsBox.appendChild(tag);
  }

  if (startBtn) {
    startBtn.style.display = (tempListeningAudio || tempListeningSubtitle) ? 'inline-flex' : 'none';
  }
}

async function startLearningWithSelectedFiles() {
  if (!tempListeningAudio && !tempListeningSubtitle) {
    alert('음원 또는 대본 파일을 최소 1개 이상 선택해주세요.');
    return;
  }

  let itemTitle = '';
  let author = '';
  let bookTitle = '';

  if (tempListeningSubtitle) {
    author = docAuthor || '';
    bookTitle = docBookTitle || tempListeningSubtitle.name.replace(/\.[^/.]+$/, '');
    itemTitle = bookTitle;
  }
  if (!itemTitle && tempListeningAudio) {
    itemTitle = tempListeningAudio.name.replace(/\.[^/.]+$/, '');
    bookTitle = itemTitle;
    author = '';
  }

  const newItem = {
    id: 'listen_' + Date.now(),
    title: itemTitle || '듣기 학습 파일',
    docAuthor: author || '',
    docBookTitle: bookTitle || itemTitle,
    audioBlob: tempListeningAudio ? tempListeningAudio.blob : null,
    audioName: tempListeningAudio ? tempListeningAudio.name : '',
    subtitles: tempListeningSubtitle ? tempListeningSubtitle.parsed : [],
    subtitleText: tempListeningSubtitle ? tempListeningSubtitle.text : '',
    subtitleName: tempListeningSubtitle ? tempListeningSubtitle.name : '',
    lastTime: 0,
    sortMode: 'sequential',
    checkedIndices: [],
    updatedAt: Date.now()
  };

  await saveListeningItemToDB(newItem);

  tempListeningAudio = null;
  tempListeningSubtitle = null;
  updateSelectedTagsUI();
  const pickerCard = document.getElementById('new-file-picker-card');
  if (pickerCard) pickerCard.style.display = 'none';

  await openListeningItem(newItem.id);
}

function setupFileListListeners() {
  const btnToggleNewPicker = document.getElementById('btn-toggle-new-picker');
  const btnCloseNewPicker = document.getElementById('btn-close-new-picker');
  const pickerCard = document.getElementById('new-file-picker-card');
  const pickerAudioInput = document.getElementById('picker-audio-input');
  const pickerSubInput = document.getElementById('picker-sub-input');
  const btnStartSelected = document.getElementById('btn-start-selected-learning');
  const btnShowList = document.getElementById('btn-show-list');

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && pickerSubInput) {
    pickerSubInput.removeAttribute('accept');
  }

  if (btnToggleNewPicker && pickerCard) {
    btnToggleNewPicker.addEventListener('click', () => {
      const isHidden = pickerCard.style.display === 'none' || !pickerCard.style.display;
      pickerCard.style.display = isHidden ? 'flex' : 'none';
    });
  }

  if (btnCloseNewPicker && pickerCard) {
    btnCloseNewPicker.addEventListener('click', () => {
      pickerCard.style.display = 'none';
      tempListeningAudio = null;
      tempListeningSubtitle = null;
      updateSelectedTagsUI();
    });
  }

  if (pickerAudioInput) {
    pickerAudioInput.addEventListener('click', () => {
      pickerAudioInput.value = '';
    });
    pickerAudioInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      let mimeType = file.type || "audio/mpeg";
      if (file.name.endsWith('.mp3')) mimeType = "audio/mpeg";
      else if (file.name.endsWith('.m4a')) mimeType = "audio/mp4";
      else if (file.name.endsWith('.wav')) mimeType = "audio/wav";

      const audioBlob = new Blob([file], { type: mimeType });
      tempListeningAudio = { blob: audioBlob, name: file.name };
      updateSelectedTagsUI();
    });
  }

  if (pickerSubInput) {
    pickerSubInput.addEventListener('click', () => {
      pickerSubInput.value = '';
    });
    pickerSubInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const text = await readFileAsTextSmart(file);
      const parsed = parseSubtitleText(text, file.name);
      tempListeningSubtitle = { text, name: file.name, parsed };
      updateSelectedTagsUI();
    });
  }

  if (btnStartSelected) {
    btnStartSelected.addEventListener('click', startLearningWithSelectedFiles);
  }

  if (btnShowList) {
    btnShowList.addEventListener('click', () => {
      showListeningFileList();
    });
  }
}

// ── Legacy Storage Functions for Backwards Compatibility ──
async function saveAudioToDB(blob, name) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ blob, name }, 'lastAudio');
  } catch (err) {
    console.warn('Failed to save audio to IndexedDB:', err);
  }
}

async function getAudioFromDB() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('lastAudio');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Failed to retrieve audio from IndexedDB:', err);
    return null;
  }
}

async function clearAudioFromDB() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete('lastAudio');
  } catch (err) {
    console.warn('Failed to clear audio from IndexedDB:', err);
  }
}

let lastSavedTime = 0;
function saveCurrentPlaybackTime() {
  if (audioPlayer && audioPlayer.currentTime > 0) {
    if (Math.abs(audioPlayer.currentTime - lastSavedTime) >= 0.5) {
      lastSavedTime = audioPlayer.currentTime;
      localStorage.setItem('listening_last_time', audioPlayer.currentTime.toString());
    }
  }
}

function saveCheckedState() {
  const checkedIndices = getCheckedIndices();
  localStorage.setItem('listening_checked_indices', JSON.stringify(checkedIndices));
}

// Metadata States (저자, <책명>)
let docAuthor = "";
let docBookTitle = "";

function isPlaceholderText(str) {
  if (!str) return true;
  const s = str.trim();
  return s === "저자" || s === "책명" || s === "<책명>" || s === "책이름" || s === "<책이름>" || s === "저자, <책명>" || s === "저자, <책이름>";
}

function cleanAuthor(author) {
  if (!author || isPlaceholderText(author)) return "";
  const a = author.trim();
  return isPlaceholderText(a) ? "" : a;
}

function cleanBookTitle(title) {
  if (!title || isPlaceholderText(title)) return "";
  let t = title.trim();
  if (t.startsWith('<') && t.endsWith('>')) {
    t = t.slice(1, -1).trim();
  }
  return isPlaceholderText(t) ? "" : t;
}

function updateMetadataUI() {
  const authorInput = document.getElementById('meta-author-input');
  const titleInput = document.getElementById('meta-title-input');
  if (authorInput && authorInput !== document.activeElement) {
    authorInput.value = docAuthor;
  }
  if (titleInput && titleInput !== document.activeElement) {
    titleInput.value = docBookTitle;
  }
}

function getCurrentDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function saveSubtitleStateToStorage() {
  if (!subtitles || subtitles.length === 0) return;

  const author = cleanAuthor(docAuthor);
  const rawTitle = cleanBookTitle(docBookTitle);
  const bookTitle = rawTitle ? (rawTitle.startsWith('<') ? rawTitle : `<${rawTitle}>`) : "";

  let headerAuthor = author || "저자";
  let headerTitle = bookTitle || "<책명>";

  let exportText = `${headerAuthor}, ${headerTitle}\n`;
  subtitles.forEach((s) => {
    const inTime = formatTime(s.start);
    const outTime = formatTime(s.end);
    const text = (s.text || "").replace(/\r?\n/g, ' ');
    const count = s.repeated_number || 0;
    const date = s.last_updated || "";
    exportText += `${inTime}|${outTime}|${text}|${count}|${date}\n`;
  });

  localStorage.setItem('listening_subtitle_text', exportText);

  if (author) localStorage.setItem('listening_doc_author', author);
  else localStorage.removeItem('listening_doc_author');

  if (rawTitle) localStorage.setItem('listening_doc_title', rawTitle);
  else localStorage.removeItem('listening_doc_title');

  saveCheckedState();

  if (currentListeningItemId) {
    saveCurrentListeningItemState();
  }
}

// DOM Elements
const audioPlayer = document.getElementById('audio-player');
const playPauseBtn = document.getElementById('btn-play-pause');
const prevSectionBtn = document.getElementById('btn-prev-section');
const nextSectionBtn = document.getElementById('btn-next-section');
const repeatToggleBtn = document.getElementById('btn-repeat-toggle');
const speedSelect = document.getElementById('speed-select');

const audioFileInput = document.getElementById('audio-file');
const subFileInput = document.getElementById('subtitle-file');
const loadedAudioNameSpan = document.getElementById('loaded-audio-name');
const btnClearStorage = document.getElementById('btn-clear-storage');
const btnExportData = document.getElementById('btn-export-data');
const repeatCountSelect = document.getElementById('repeat-count-select');
const toggleSortBtn = document.getElementById('btn-toggle-sort');
const toggleSubtitlesBtn = document.getElementById('btn-toggle-subtitles');
const transcriptPane = document.getElementById('transcript-pane');
const emptyPromptView = document.getElementById('empty-prompt-view');

// Timeline Elements
const timelineWrapper = document.getElementById('timeline-wrapper');
const timelineProgress = document.getElementById('timeline-progress');
const timelineLoopZone = document.getElementById('timeline-loop-zone');
const timelineHandle = document.getElementById('timeline-handle');
const currentTimeDisplay = document.getElementById('current-time-display');
const totalTimeDisplay = document.getElementById('total-time-display');

// ── Initialize App ──
window.addEventListener('DOMContentLoaded', async () => {
  setupAudioPlayerListeners();
  setupControlBarListeners();
  setupImportListeners();
  setupHotkeyListeners();
  setupTimelineListeners();
  setupFileListListeners();
  await showListeningFileList();
});

// ── Audio Player Core Listeners ──
function setupAudioPlayerListeners() {
  audioPlayer.addEventListener('play', () => {
    playPauseBtn.innerHTML = PAUSE_SVG;
  });
  audioPlayer.addEventListener('pause', () => {
    playPauseBtn.innerHTML = PLAY_SVG;
    saveCurrentPlaybackTime();
  });
  audioPlayer.addEventListener('timeupdate', () => {
    saveCurrentPlaybackTime();
  });

  audioPlayer.addEventListener('loadedmetadata', () => {
    totalTimeDisplay.textContent = formatTime(audioPlayer.duration);
    updateTimelineProgress();
  });

  // Precision loop updates using requestAnimationFrame
  function updateLoop() {
    if (!audioPlayer.paused && !isDraggingTimeline) {
      const curTime = audioPlayer.currentTime;
      updateTimelineProgress();
      syncSubtitleHighlight(curTime);
      checkSectionLoop(curTime);
      saveCurrentPlaybackTime();
    }
    requestAnimationFrame(updateLoop);
  }
  requestAnimationFrame(updateLoop);
}

// ── Timeline Dragging & Seeking ──
function setupTimelineListeners() {
  function getTimelineSeekTime(clientX) {
    const rect = timelineWrapper.getBoundingClientRect();
    let pct = (clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));
    return pct * (audioPlayer.duration || 0);
  }

  function handleStart(clientX) {
    if (!audioPlayer.duration) return;
    clearLoopWaitTimer();
    isDraggingTimeline = true;
    const seekTime = getTimelineSeekTime(clientX);
    audioPlayer.currentTime = seekTime;
    updateTimelineProgress();
    syncSubtitleHighlight(seekTime, true);
  }

  function handleMove(clientX) {
    if (!isDraggingTimeline) return;
    const t = getTimelineSeekTime(clientX);
    audioPlayer.currentTime = t;
    updateTimelineProgress();
    syncSubtitleHighlight(t, true);
  }

  function handleEnd() {
    if (!isDraggingTimeline) return;
    isDraggingTimeline = false;
    if (audioPlayer.duration) {
      syncSubtitleHighlight(audioPlayer.currentTime, true);
    }
  }

  timelineWrapper.addEventListener('mousedown', (e) => {
    handleStart(e.clientX);

    function onMouseMove(moveEvent) {
      handleMove(moveEvent.clientX);
    }

    function onMouseUp() {
      handleEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  timelineWrapper.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 0) {
      handleStart(e.touches[0].clientX);
    }
  }, { passive: true });

  timelineWrapper.addEventListener('touchmove', (e) => {
    if (isDraggingTimeline && e.touches && e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  }, { passive: true });

  timelineWrapper.addEventListener('touchend', () => {
    handleEnd();
  });
}

function updateTimelineProgress() {
  const dur = audioPlayer.duration || 0;
  const cur = audioPlayer.currentTime || 0;
  currentTimeDisplay.textContent = formatTime(cur);

  if (dur > 0) {
    const pct = (cur / dur) * 100;
    timelineProgress.style.width = pct + '%';
    timelineHandle.style.left = pct + '%';
  } else {
    timelineProgress.style.width = '0%';
    timelineHandle.style.left = '0%';
  }
}

function updateTimelineLoopZone() {
  const dur = audioPlayer.duration;
  if (!dur) return;

  if (isRangeLoopActive && subtitles[rangeLoopStart] && subtitles[rangeLoopEnd]) {
    const startSec = subtitles[rangeLoopStart].start;
    const endSec = subtitles[rangeLoopEnd].end;
    const startPct = (startSec / dur) * 100;
    const widthPct = Math.max(0, ((endSec - startSec) / dur) * 100);
    timelineLoopZone.style.left = startPct + '%';
    timelineLoopZone.style.width = widthPct + '%';
    timelineLoopZone.style.display = 'block';
    return;
  }

  if (globalLoopEnabled && loopSectionIndex !== null && subtitles[loopSectionIndex]) {
    const section = subtitles[loopSectionIndex];
    const startPct = (section.start / dur) * 100;
    const widthPct = ((section.end - section.start) / dur) * 100;
    timelineLoopZone.style.left = startPct + '%';
    timelineLoopZone.style.width = widthPct + '%';
    timelineLoopZone.style.display = 'block';
  } else {
    timelineLoopZone.style.display = 'none';
  }
}

// ── Format time to MM:SS.SS ──
function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00.00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

// ── Control Bar Events ──
function setupControlBarListeners() {
  playPauseBtn.addEventListener('click', togglePlay);

  prevSectionBtn.addEventListener('click', jumpToPreviousSection);
  nextSectionBtn.addEventListener('click', jumpToNextSection);

  repeatToggleBtn.addEventListener('click', toggleGlobalSectionRepeat);

  speedSelect.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    setPlaybackSpeed(val);
  });

  // Repeat count dropdown handler
  if (repeatCountSelect) {
    repeatCountSelect.addEventListener('change', () => {
      resetLoopCount();
      localStorage.setItem('listening_repeat_count', repeatCountSelect.value);
    });
  }

  // Subtitle selection control buttons
  const btnDeselectAll = document.getElementById('btn-deselect-all');
  if (btnDeselectAll) {
    btnDeselectAll.addEventListener('click', () => {
      subtitles.forEach(s => s.checked = false);
      saveCheckedState();
      renderSubtitles();
    });
  }

  // Sort mode toggle button
  if (toggleSortBtn) {
    toggleSortBtn.addEventListener('click', toggleSortMode);
  }

  // Subtitle visibility toggle button
  if (toggleSubtitlesBtn) {
    toggleSubtitlesBtn.addEventListener('click', toggleSubtitlesVisibility);
  }

  // Data export button
  if (btnExportData) {
    btnExportData.addEventListener('click', exportDataAsTxt);
  }

  // Guide Modal listeners
  const btnGuide = document.getElementById('btn-guide');
  const guideModal = document.getElementById('guide-modal');
  const guideModalClose = document.getElementById('guide-modal-close');

  if (btnGuide && guideModal) {
    btnGuide.addEventListener('click', () => {
      guideModal.style.display = 'flex';
    });
  }

  if (guideModalClose && guideModal) {
    guideModalClose.addEventListener('click', () => {
      guideModal.style.display = 'none';
    });
  }

  if (guideModal) {
    guideModal.addEventListener('click', (e) => {
      if (e.target === guideModal) {
        guideModal.style.display = 'none';
      }
    });
  }
}

function getDisplayedSubtitles() {
  if (!subtitles || subtitles.length === 0) return [];
  if (sortMode === 'sequential') {
    return subtitles;
  } else {
    // Mode 'hardest': filter out repeated_number === 0, sort descending by repeated_number, then ascending by start
    return subtitles
      .filter(s => (s.repeated_number || 0) > 0)
      .slice()
      .sort((a, b) => {
        const countA = a.repeated_number || 0;
        const countB = b.repeated_number || 0;
        if (countB !== countA) {
          return countB - countA;
        }
        return a.start - b.start;
      });
  }
}

function toggleSortMode() {
  sortMode = (sortMode === 'sequential') ? 'hardest' : 'sequential';
  updateSortUI();
  localStorage.setItem('listening_sort_mode', sortMode);
  renderSubtitles();
}

function updateSortUI() {
  if (!toggleSortBtn) return;
  if (sortMode === 'hardest') {
    toggleSortBtn.classList.add('btn-active');
    toggleSortBtn.setAttribute('aria-pressed', 'true');
    toggleSortBtn.textContent = '순서대로 듣기';
  } else {
    toggleSortBtn.classList.remove('btn-active');
    toggleSortBtn.setAttribute('aria-pressed', 'false');
    toggleSortBtn.textContent = '어려운 것부터 듣기';
  }
}

function exportDataAsTxt() {
  if (!subtitles || subtitles.length === 0) {
    alert("내보낼 자막 데이터가 없습니다.");
    return;
  }

  const author = cleanAuthor(docAuthor) || "저자";
  const rawTitle = cleanBookTitle(docBookTitle);
  const bookTitle = rawTitle ? (rawTitle.startsWith('<') ? rawTitle : `<${rawTitle}>`) : "<책명>";

  let exportText = `${author}, ${bookTitle}\n`;

  subtitles.forEach((s) => {
    const inTime = formatTime(s.start);
    const outTime = formatTime(s.end);
    const text = (s.text || "").replace(/\r?\n/g, ' ');
    const count = s.repeated_number || 0;
    const date = s.last_updated || "";
    exportText += `${inTime}|${outTime}|${text}|${count}|${date}\n`;
  });

  const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  let fileName = "listening_subtitle.txt";
  const rawAudioName = audioName || localStorage.getItem('listening_audio_name');
  if (rawAudioName) {
    const audioBaseName = rawAudioName.replace(/\.[^/.]+$/, "");
    fileName = `${audioBaseName}_subtitle.txt`;
  } else if (localStorage.getItem('listening_subtitle_name')) {
    const subBaseName = localStorage.getItem('listening_subtitle_name').replace(/\.[^/.]+$/, "");
    fileName = `${subBaseName}_subtitle.txt`;
  }
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getDesiredRepeatCount() {
  if (!repeatCountSelect) return 5;
  const val = repeatCountSelect.value.trim();
  if (val === '무한대' || val === '∞' || val === 'infinity') return Infinity;
  const num = parseInt(val, 10);
  return isNaN(num) || num <= 0 ? 5 : num;
}

function resetLoopCount() {
  loopCountRemaining = getDesiredRepeatCount();
}

function toggleSubtitlesVisibility() {
  isSubtitleHidden = !isSubtitleHidden;
  updateSubtitleVisibilityUI();
  localStorage.setItem('listening_subtitle_hidden', isSubtitleHidden ? 'true' : 'false');
  syncSubtitleHighlight(audioPlayer.currentTime, true);
}

function updateSubtitleVisibilityUI() {
  if (isSubtitleHidden) {
    transcriptPane.classList.add('subtitles-hidden');
    if (toggleSubtitlesBtn) {
      toggleSubtitlesBtn.classList.add('btn-active');
      toggleSubtitlesBtn.setAttribute('aria-pressed', 'true');
      toggleSubtitlesBtn.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908A9.974 9.974 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18"></path></svg>
        <span>자막 보이기</span>
      `;
    }
  } else {
    transcriptPane.classList.remove('subtitles-hidden');
    if (toggleSubtitlesBtn) {
      toggleSubtitlesBtn.classList.remove('btn-active');
      toggleSubtitlesBtn.setAttribute('aria-pressed', 'false');
      toggleSubtitlesBtn.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
        <span>자막 가리기</span>
      `;
    }
  }
}

function togglePlay() {
  clearLoopWaitTimer();
  if (!audioName || !audioPlayer.src) {
    alert("음원 파일을 선택한 후 재생할 수 있습니다.");
    return;
  }
  if (audioPlayer.paused) {
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        syncSubtitleHighlight(audioPlayer.currentTime, true);
      }).catch((err) => {
        console.warn("Playback error:", err);
      });
    }
    syncSubtitleHighlight(audioPlayer.currentTime, true);
  } else {
    audioPlayer.pause();
  }
}

function toggleGlobalSectionRepeat() {
  clearLoopWaitTimer();
  if (isRangeLoopActive) {
    cancelCustomRangeLoop();
    globalLoopEnabled = false;
    repeatToggleBtn.classList.remove('btn-active');
    loopSectionIndex = null;
    return;
  }
  globalLoopEnabled = !globalLoopEnabled;
  if (globalLoopEnabled) {
    repeatToggleBtn.classList.add('btn-active');
    loopSectionIndex = (activeIndex !== -1) ? activeIndex : 0;
    resetLoopCount(); // Reset repeat count when enabling loop
  } else {
    repeatToggleBtn.classList.remove('btn-active');
    loopSectionIndex = null;
  }
  updateTimelineLoopZone();
}

// ── 체크박스가 활성화된 구간들의 인덱스 목록 획득 ──
function getCheckedIndices() {
  const indices = [];
  subtitles.forEach((s) => {
    if (s.checked) {
      indices.push(s.index);
    }
  });
  return indices;
}

// ── Precision Section Repeating Logic ──
function checkSectionLoop(curTime) {
  if (isLoopWaiting) return;

  // Case -1: 롱프레스 구간 범위 반복 모드 (rangeLoopStart ~ rangeLoopEnd)
  if (isRangeLoopActive) {
    const endSection = subtitles[rangeLoopEnd];
    if (endSection && curTime >= endSection.end) {
      isLoopWaiting = true;
      audioPlayer.pause();

      // 반복듣기 시 repeated_number +1 및 last_updated 갱신
      endSection.repeated_number = (endSection.repeated_number || 0) + 1;
      endSection.last_updated = getCurrentDateString();
      saveSubtitleStateToStorage();

      // 시작 구간으로 이동 후 1초간 무음 대기 후 반복 재생
      audioPlayer.currentTime = subtitles[rangeLoopStart].start;
      updateTimelineProgress();
      syncSubtitleHighlight(subtitles[rangeLoopStart].start);

      loopDelayTimer = setTimeout(() => {
        if (isRangeLoopActive && globalLoopEnabled) {
          audioPlayer.play().catch(err => console.warn("Playback error:", err));
        }
        isLoopWaiting = false;
        loopDelayTimer = null;
      }, 1000);
    }
    return;
  }

  // Case 0: '어려운 것부터 듣기' 모드 + Loop 버튼 OFF ➔ 해당 구간 1회 재생 후 멈춤
  if (sortMode === 'hardest' && !globalLoopEnabled) {
    if (activeIndex !== -1 && subtitles[activeIndex]) {
      const section = subtitles[activeIndex];
      if (curTime >= section.end) {
        audioPlayer.pause();
        audioPlayer.currentTime = section.start;
        updateTimelineProgress();
        syncSubtitleHighlight(section.start);
      }
    }
    return;
  }

  if (!globalLoopEnabled) return;

  if (loopSectionIndex === null || !subtitles[loopSectionIndex]) {
    loopSectionIndex = (activeIndex !== -1) ? activeIndex : 0;
    if (!subtitles[loopSectionIndex]) return;
  }

  const section = subtitles[loopSectionIndex];
  const checkedIndices = getCheckedIndices();

  // Case 1: 체크박스가 1개 이상 선택된 경우 -> 선택된 구간들을 전체적으로 순서대로 반복 재생 (b -> d -> b -> d)
  if (checkedIndices.length > 0) {
    // 만약 현재 재생 중인 구간이 체크 해제된 상태라면 다음 체크된 구간으로 이동
    if (!section.checked) {
      const nextIdx = checkedIndices.find(idx => idx > loopSectionIndex) ?? checkedIndices[0];
      jumpToSection(nextIdx, false);
      return;
    }

    if (curTime >= section.end) {
      isLoopWaiting = true;
      audioPlayer.pause();

      // 반복듣기 시 repeated_number +1 및 last_updated 갱신
      section.repeated_number = (section.repeated_number || 0) + 1;
      section.last_updated = getCurrentDateString();
      saveSubtitleStateToStorage();

      // 다음 체크된 구간 찾기 (마지막 구간이면 첫 번째 체크 구간으로 순환)
      const currentPosInChecked = checkedIndices.indexOf(loopSectionIndex);
      let nextIdx;
      if (currentPosInChecked !== -1 && currentPosInChecked + 1 < checkedIndices.length) {
        nextIdx = checkedIndices[currentPosInChecked + 1];
      } else {
        nextIdx = checkedIndices[0];
      }

      loopSectionIndex = nextIdx;
      const nextSection = subtitles[nextIdx];
      audioPlayer.currentTime = nextSection.start;
      updateTimelineProgress();
      updateTimelineLoopZone();
      syncSubtitleHighlight(nextSection.start);

      loopDelayTimer = setTimeout(() => {
        if (globalLoopEnabled) {
          audioPlayer.play().catch(err => console.warn("Playback error:", err));
        }
        isLoopWaiting = false;
        loopDelayTimer = null;
      }, 1000);
    }
    return;
  }

  // Case 2: 체크박스가 선택되지 않은 경우 -> 기존처럼 각 구간을 지정 횟수(loopCountRemaining)만큼 반복 후 다음 구간으로 이동
  if (curTime >= section.end) {
    isLoopWaiting = true;
    audioPlayer.pause();

    // 반복듣기 시 repeated_number +1 및 last_updated 갱신
    section.repeated_number = (section.repeated_number || 0) + 1;
    section.last_updated = getCurrentDateString();
    saveSubtitleStateToStorage();

    if (loopCountRemaining > 1) {
      if (loopCountRemaining !== Infinity) {
        loopCountRemaining--;
      }
      // 구간 시작 위치로 이동 후 1초간 무음 대기
      audioPlayer.currentTime = section.start;
      updateTimelineProgress();
      syncSubtitleHighlight(section.start);

      loopDelayTimer = setTimeout(() => {
        if (globalLoopEnabled) {
          audioPlayer.play().catch(err => console.warn("Playback error:", err));
        }
        isLoopWaiting = false;
        loopDelayTimer = null;
      }, 1000);
    } else {
      // 지정된 반복 횟수 완료: 1초 무음 대기 후 다음 구간으로 이동
      const displayedList = getDisplayedSubtitles();
      const currentPosInDisplayed = displayedList.findIndex(s => s.index === loopSectionIndex);
      let nextPos = (currentPosInDisplayed !== -1 && currentPosInDisplayed + 1 < displayedList.length) ? currentPosInDisplayed + 1 : 0;
      const nextSection = displayedList[nextPos] || subtitles[0];
      const nextIdx = nextSection ? nextSection.index : 0;

      loopSectionIndex = nextIdx;
      resetLoopCount();
      audioPlayer.currentTime = nextSection.start;
      updateTimelineProgress();
      updateTimelineLoopZone();
      syncSubtitleHighlight(nextSection.start);

      loopDelayTimer = setTimeout(() => {
        if (globalLoopEnabled) {
          audioPlayer.play().catch(err => console.warn("Playback error:", err));
        }
        isLoopWaiting = false;
        loopDelayTimer = null;
      }, 1000);
    }
  }
}

// ── Sync Active Subtitle & Auto-Scroll ──
function syncSubtitleHighlight(curTime, forceRealTimeSync = false) {
  if (subtitles.length === 0) return;

  let foundIndex = -1;

  // If forceRealTimeSync is false and looping is active (단일 구간 루프 시), lock the highlighted subtitle to the looped one
  if (!forceRealTimeSync && !isRangeLoopActive && globalLoopEnabled && loopSectionIndex !== null) {
    foundIndex = loopSectionIndex;
  } else {
    for (let i = 0; i < subtitles.length; i++) {
      if (curTime >= subtitles[i].start && curTime < subtitles[i].end) {
        foundIndex = i;
        break;
      }
    }

    // Gap fallback
    if (foundIndex === -1 && curTime > 0) {
      for (let i = 0; i < subtitles.length; i++) {
        if (i === subtitles.length - 1 && curTime >= subtitles[i].end) {
          foundIndex = i;
        } else if (curTime >= subtitles[i].end && curTime < subtitles[i + 1].start) {
          foundIndex = i;
        }
      }
    }
  }

  if (foundIndex !== -1 && (foundIndex !== activeIndex || forceRealTimeSync)) {
    const isIndexChanged = (foundIndex !== activeIndex);
    activeIndex = foundIndex;

    if (isIndexChanged && subtitles[activeIndex]) {
      subtitles[activeIndex].last_updated = getCurrentDateString();
      saveSubtitleStateToStorage();
    }

function scrollPaneToCard(card) {
  if (!card || !transcriptPane) return;
  const paneRect = transcriptPane.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const relativeTop = cardRect.top - paneRect.top;
  const targetScrollTop = transcriptPane.scrollTop + relativeTop - 12;

  transcriptPane.scrollTo({
    top: Math.max(0, targetScrollTop),
    behavior: 'smooth'
  });

  if (window.scrollY !== 0 || window.scrollX !== 0) {
    window.scrollTo(0, 0);
  }
}

    const cards = transcriptPane.querySelectorAll('.sub-card');
    cards.forEach((card) => {
      const idx = parseInt(card.dataset.index, 10);
      if (idx === activeIndex) {
        card.classList.add('active');
        if (isIndexChanged || forceRealTimeSync) {
          scrollPaneToCard(card);
        }
      } else {
        card.classList.remove('active');
      }
    });

    if (globalLoopEnabled) {
      if (forceRealTimeSync) {
        loopSectionIndex = activeIndex;
        resetLoopCount();
      }
      updateTimelineLoopZone();
    }
  }
}

// ── Jump to Section Index ──
function jumpToSection(idx, isAuto = false) {
  if (idx < 0 || idx >= subtitles.length) return;
  if (!isAuto) {
    clearLoopWaitTimer();
  }

  const section = subtitles[idx];

  // 사용자가 수동으로 구간을 변경한 경우에만 루프 반복 횟수 재설정
  if (globalLoopEnabled && !isAuto && idx !== loopSectionIndex) {
    resetLoopCount();
  }

  audioPlayer.currentTime = section.start;
  if (audioPlayer.paused) {
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn("Playback failed:", err);
      });
    }
  }

  // If global loop repeat is active, lock the loop target to the new section
  if (globalLoopEnabled) {
    loopSectionIndex = idx;
    updateTimelineLoopZone();
  }

  syncSubtitleHighlight(section.start);
}

function jumpToPreviousSection() {
  const displayedList = getDisplayedSubtitles();
  if (displayedList.length === 0) return;

  const currentPosInDisplayed = displayedList.findIndex(s => s.index === activeIndex);
  let targetIndex;
  if (currentPosInDisplayed > 0) {
    targetIndex = displayedList[currentPosInDisplayed - 1].index;
  } else {
    targetIndex = displayedList[0].index;
  }
  jumpToSection(targetIndex);
}

function jumpToNextSection() {
  const displayedList = getDisplayedSubtitles();
  if (displayedList.length === 0) return;

  const currentPosInDisplayed = displayedList.findIndex(s => s.index === activeIndex);
  let targetIndex;
  if (currentPosInDisplayed !== -1 && currentPosInDisplayed + 1 < displayedList.length) {
    targetIndex = displayedList[currentPosInDisplayed + 1].index;
  } else {
    targetIndex = displayedList[displayedList.length - 1].index;
  }
  jumpToSection(targetIndex);
}

// MM:SS.SS 또는 HH:MM:SS.SS (또는 SRT/VTT의 HH:MM:SS,mmm) 형식의 자막 시간 문자열을 초(seconds)로 변환하는 함수
// ── Smart File Reader (UTF-8 with fallback to EUC-KR / CP949) ──
async function readFileAsTextSmart(file) {
  if (file && file.arrayBuffer) {
    try {
      const buffer = await file.arrayBuffer();
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        return utf8Decoder.decode(buffer);
      } catch (e) {
        try {
          const euckrDecoder = new TextDecoder('euc-kr');
          return euckrDecoder.decode(buffer);
        } catch (e2) {
          return new TextDecoder().decode(buffer);
        }
      }
    } catch (e) {
      console.warn('Smart text decoding failed, fallback to FileReader:', e);
    }
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result || '');
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

// MM:SS.SS 또는 HH:MM:SS.SS (또는 SRT/VTT의 HH:MM:SS,mmm) 형식의 자막 시간 문자열을 초(seconds)로 변환하는 함수
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const cleanStr = timeStr.trim().replace(/[\[\]]/g, '').replace(',', '.');
  const parts = cleanStr.includes(':') ? cleanStr.split(':') : (cleanStr.includes('.') && cleanStr.split('.').length === 3 ? [cleanStr.split('.')[0], cleanStr.split('.')[1] + '.' + cleanStr.split('.')[2]] : cleanStr.split(':'));

  if (parts.length === 2) {
    // MM:SS.SS
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return (mins * 60) + secs;
  } else if (parts.length === 3) {
    // HH:MM:SS.SS
    const hrs = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return (hrs * 3600) + (mins * 60) + secs;
  }
  const rawSec = parseFloat(cleanStr);
  return isNaN(rawSec) ? 0 : rawSec;
}

// ── Normalize End Times ──
function normalizeEndTimes(parsed) {
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].end <= parsed[i].start) {
      if (i + 1 < parsed.length && parsed[i + 1].start > parsed[i].start) {
        parsed[i].end = parsed[i + 1].start;
      } else {
        parsed[i].end = parsed[i].start + 2.0;
      }
    } else if (i + 1 < parsed.length && parsed[i].end > parsed[i + 1].start && parsed[i + 1].start > parsed[i].start) {
      parsed[i].end = parsed[i + 1].start;
    }
  }
}

// ── SRT / VTT Subtitle Parser ──
function parseSrtText(text) {
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/);
  const parsed = [];
  let index = 0;

  let currentStart = null;
  let currentEnd = null;
  let currentTextLines = [];

  function flushCurrent() {
    if (currentStart !== null && currentEnd !== null) {
      const subtitleText = currentTextLines.join('\n').replace(/<[^>]*>/g, '').trim();
      if (subtitleText) {
        parsed.push({
          index: index++,
          start: currentStart,
          end: currentEnd,
          text: subtitleText,
          repeated_number: 0,
          last_updated: "",
          checked: false
        });
      }
    }
    currentStart = null;
    currentEnd = null;
    currentTextLines = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.toLowerCase() === 'webvtt') continue;

    if (line.includes('-->')) {
      flushCurrent();
      const timeParts = line.split('-->');
      const startStr = timeParts[0].trim();
      const endStr = timeParts[1].trim().split(/\s+/)[0];

      currentStart = parseTimeToSeconds(startStr);
      currentEnd = parseTimeToSeconds(endStr);
    } else if (currentStart !== null) {
      if (line === '') {
        flushCurrent();
      } else {
        if (/^\d+$/.test(line)) {
          let lookaheadIdx = i + 1;
          while (lookaheadIdx < lines.length && lines[lookaheadIdx].trim() === '') {
            lookaheadIdx++;
          }
          if (lookaheadIdx < lines.length && lines[lookaheadIdx].includes('-->')) {
            flushCurrent();
            continue;
          }
        }
        currentTextLines.push(line);
      }
    }
  }
  flushCurrent();
  normalizeEndTimes(parsed);
  return parsed;
}

// ── Pipe / Tab Delimited Parser ──
function parsePipeOrDelimiter(lines, delimiter) {
  const parsed = [];
  let index = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (/^(in|out|start|end|시작시간|자막|종료시간)/i.test(line)) continue;

    const parts = line.split(delimiter);
    if (parts.length >= 3) {
      const start = parseTimeToSeconds(parts[0]);
      const end = parseTimeToSeconds(parts[1]);
      const subtitleText = parts.slice(2).join(delimiter).trim();
      const count = (parts.length >= 4) ? (parseInt(parts[3].trim(), 10) || 0) : 0;
      const date = (parts.length >= 5) ? parts[4].trim() : "";

      if (!isNaN(start) && !isNaN(end) && subtitleText) {
        parsed.push({
          index: index++,
          start: start,
          end: end,
          text: subtitleText,
          repeated_number: count,
          last_updated: date,
          checked: false
        });
      }
    } else if (parts.length === 2) {
      let start = parseTimeToSeconds(parts[0]);
      let subtitleText = parts[1].trim();
      if (isNaN(start) || (start === 0 && !/^0{1,2}[:\.]0{2}/.test(parts[0].trim()))) {
        start = parseTimeToSeconds(parts[1]);
        subtitleText = parts[0].trim();
      }
      if (!isNaN(start) && subtitleText) {
        parsed.push({
          index: index++,
          start: start,
          end: start + 2.0,
          text: subtitleText,
          repeated_number: 0,
          last_updated: "",
          checked: false
        });
      }
    }
  }

  normalizeEndTimes(parsed);
  return parsed;
}

// ── Range Timestamps Parser: e.g. "00:01 ~ 00:04 Text" or "00:01 - 00:04 Text" ──
function parseRangeTimestamps(lines) {
  const rangeRegex = /^\[?(\d{1,2}[:\.]\d{2}(?:[:\.]\d{2,3})?)\]?\s*(?:~|–|-|—|-->)\s*\[?(\d{1,2}[:\.]\d{2}(?:[:\.]\d{2,3})?)\]?[:\s\t]+(.+)$/;
  const parsed = [];
  let index = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const m = line.match(rangeRegex);
    if (m) {
      const start = parseTimeToSeconds(m[1]);
      const end = parseTimeToSeconds(m[2]);
      const text = m[3].trim();
      if (!isNaN(start) && text) {
        parsed.push({
          index: index++,
          start: start,
          end: (!isNaN(end) && end > start) ? end : start + 2.0,
          text: text,
          repeated_number: 0,
          last_updated: "",
          checked: false
        });
      }
    }
  }

  normalizeEndTimes(parsed);
  return parsed;
}

// ── Single Timestamp Parser: e.g. "00:01 Text" or "[00:01.00] Text" (LRC) ──
function parseSingleTimestampLines(lines) {
  const singleTimeRegex = /^\[?(\d{1,2}[:\.]\d{2}(?:[:\.]\d{2,3})?)\]?[\s\t:|-]+(.+)$/;
  const parsed = [];
  let index = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const m = line.match(singleTimeRegex);
    if (m) {
      const start = parseTimeToSeconds(m[1]);
      const text = m[2].trim();
      if (!isNaN(start) && text) {
        parsed.push({
          index: index++,
          start: start,
          end: start + 2.0,
          text: text,
          repeated_number: 0,
          last_updated: "",
          checked: false
        });
      }
    }
  }

  normalizeEndTimes(parsed);
  return parsed;
}

// ── Plain Text Lines Parser (Estimates durations for un-timestamped scripts) ──
function parsePlainTextLines(lines) {
  const parsed = [];
  let index = 0;
  let currentTime = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (/^(in|out|시작시간|자막)/i.test(line)) continue;

    parsed.push({
      index: index++,
      start: currentTime,
      end: currentTime + 3.0,
      text: line,
      repeated_number: 0,
      last_updated: "",
      checked: false
    });
    currentTime += 3.0;
  }
  return parsed;
}

// ── Universal Subtitle Dispatcher ──
function parseUniversalSubtitles(text) {
  if (!text || !text.trim()) return [];
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  const rawLines = cleanText.split(/\r?\n/);
  const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];

  // 1. SRT format
  if (cleanText.includes('-->')) {
    const srtParsed = parseSrtText(cleanText);
    if (srtParsed && srtParsed.length > 0) return srtParsed;
  }

  // 2. Pipe delimited format
  if (lines.some(l => l.includes('|') && !l.toLowerCase().startsWith('in|') && !l.toLowerCase().startsWith('start|'))) {
    const pipeParsed = parsePipeOrDelimiter(lines, '|');
    if (pipeParsed && pipeParsed.length > 0) return pipeParsed;
  }

  // 3. Tab delimited format
  if (lines.some(l => l.includes('\t'))) {
    const tabParsed = parsePipeOrDelimiter(lines, '\t');
    if (tabParsed && tabParsed.length > 0) return tabParsed;
  }

  // 4. Range timestamps
  const rangeParsed = parseRangeTimestamps(lines);
  if (rangeParsed && rangeParsed.length > 0) return rangeParsed;

  // 5. Single timestamp / LRC format
  const singleTimeParsed = parseSingleTimestampLines(lines);
  if (singleTimeParsed && singleTimeParsed.length > 0) return singleTimeParsed;

  // 6. Plain text fallback
  return parsePlainTextLines(lines);
}

function checkIsLine1Metadata(line1) {
  if (!line1) return false;
  const trimmed = line1.trim();

  // If pure digits (SRT sequence number)
  if (/^\d+$/.test(trimmed)) return false;

  // If contains SRT arrow or WEBVTT
  if (trimmed.includes('-->') || /^WEBVTT/i.test(trimmed)) return false;

  // If starts with timestamp pattern (e.g. 00:00, 0:00, 00.00, in|, start|, 시작시간, [00:00)
  if (/^\[?\d{1,2}[:\.]\d{2}/.test(trimmed)) return false;
  if (/^(in|out|start|end|시작시간|자막|종료시간)/i.test(trimmed)) return false;

  // If line contains pipe with timestamp e.g. "00:01|00:03"
  if (/\|\s*\d{1,2}[:\.]\d{2}/.test(trimmed)) return false;

  // If it matches standard metadata angle brackets: Author <BookTitle> or <BookTitle>
  if (/<[^>]+>/.test(trimmed)) return true;

  // If it has placeholder metadata text like "저자, <책명>"
  if (isPlaceholderText(trimmed)) return true;

  // If explicit metadata prefix
  if (/^(저자|제목|책명|책이름|출처|author|title|book)\s*[:：]/i.test(trimmed)) return true;

  // If line contains pipe delimiter (e.g. "Author | BookTitle") and not a timestamp row
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|');
    if (parts.length === 2 && !/^\d+/.test(parts[0].trim())) {
      return true;
    }
  }

  return false;
}

function parseMetadataLine(line1) {
  let raw = line1.trim().replace(/\|+$/, '').trim();

  let author = "";
  let bookTitle = "";

  if (isPlaceholderText(raw)) {
    return { author: "", bookTitle: "" };
  }

  // Case 0: Key-value prefixes (저자: ..., 제목: ...)
  const authorMatch = raw.match(/(?:저자|author)\s*[:：]\s*([^,\/\|\n]+)/i);
  const titleMatch = raw.match(/(?:제목|책명|책이름|title|book)\s*[:：]\s*([^,\/\|\n]+)/i);
  if (authorMatch || titleMatch) {
    if (authorMatch) author = cleanAuthor(authorMatch[1]);
    if (titleMatch) bookTitle = cleanBookTitle(titleMatch[1]);
    return { author, bookTitle };
  }

  // Case 1: Angle brackets pattern: Author <BookTitle> or Author, <BookTitle> or <BookTitle>
  const angleMatch = raw.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (angleMatch) {
    let rawAuthor = angleMatch[1].trim().replace(/[,|\-:\t]+$/, '').trim();
    let rawTitle = angleMatch[2].trim();
    author = cleanAuthor(rawAuthor);
    bookTitle = cleanBookTitle(rawTitle);
    return { author, bookTitle };
  }

  // Case 2: Delimiters (pipe, tab, ' - ', colon, comma)
  let parts = null;
  if (raw.includes('|')) {
    parts = raw.split('|');
  } else if (raw.includes('\t')) {
    parts = raw.split('\t');
  } else if (raw.includes(' - ')) {
    parts = raw.split(' - ');
  } else if (raw.includes(':')) {
    parts = raw.split(':');
  } else if (raw.includes(',')) {
    parts = raw.split(',');
  }

  if (parts && parts.length >= 2) {
    author = cleanAuthor(parts[0]);
    let t = parts.slice(1).join(' ').trim();
    bookTitle = cleanBookTitle(t);
    return { author, bookTitle };
  }

  // Single value without delimiter
  bookTitle = cleanBookTitle(raw);
  return { author, bookTitle };
}

// ── Subtitle Parser ──
function parseSubtitleText(text, fileName = '') {
  if (!text) return [];
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  const lines = cleanText.split(/\r?\n/);

  if (lines.length === 0) return [];

  let startIndex = 0;
  const line1 = lines[0].trim();

  const isLine1Metadata = checkIsLine1Metadata(line1);

  if (isLine1Metadata) {
    const meta = parseMetadataLine(line1);
    docAuthor = meta.author || "";
    docBookTitle = meta.bookTitle || (fileName ? fileName.replace(/\.[^/.]+$/, '').trim() : "");
    startIndex = 1;
  } else {
    // When no book title or author in file:
    // Book title is the filename (without extension), author is blank
    docAuthor = "";
    docBookTitle = fileName ? fileName.replace(/\.[^/.]+$/, '').trim() : "";
    startIndex = 0;
  }

  updateMetadataUI();

  const remainingLines = lines.slice(startIndex);
  const remainingText = remainingLines.join('\n');

  return parseUniversalSubtitles(remainingText);
}

// ── Import Actions & File Listeners ──
function setupImportListeners() {
  const authorInput = document.getElementById('meta-author-input');
  const titleInput = document.getElementById('meta-title-input');
  const searchInput = document.getElementById('sub-search-input');
  const btnSearchPrev = document.getElementById('btn-search-prev');
  const btnSearchNext = document.getElementById('btn-search-next');

  if (authorInput) {
    authorInput.addEventListener('input', (e) => {
      docAuthor = e.target.value.trim();
      if (docAuthor) localStorage.setItem('listening_doc_author', docAuthor);
      else localStorage.removeItem('listening_doc_author');
      saveSubtitleStateToStorage();
    });
  }

  if (titleInput) {
    titleInput.addEventListener('input', (e) => {
      docBookTitle = e.target.value.trim();
      if (docBookTitle) localStorage.setItem('listening_doc_title', docBookTitle);
      else localStorage.removeItem('listening_doc_title');
      saveSubtitleStateToStorage();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchMatchIdx = 0;
      performSearch(e.target.value);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          navigateSearch('prev');
        } else {
          navigateSearch('next');
        }
      } else if (e.key === 'Escape') {
        searchInput.value = '';
        performSearch('');
        searchInput.blur();
      }
    });
  }

  if (btnSearchPrev) {
    btnSearchPrev.addEventListener('click', () => {
      navigateSearch('prev');
    });
  }

  if (btnSearchNext) {
    btnSearchNext.addEventListener('click', () => {
      navigateSearch('next');
    });
  }

  // Audio Upload (local in-memory object URL with explicit typing and source reloading for Safari)
  audioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Explicitly enforce MIME type in iOS Safari to enable proper seeking
    let mimeType = file.type || "audio/mpeg";
    if (file.name.endsWith('.mp3')) {
      mimeType = "audio/mpeg";
    } else if (file.name.endsWith('.m4a')) {
      mimeType = "audio/mp4";
    } else if (file.name.endsWith('.wav')) {
      mimeType = "audio/wav";
    }

    const audioBlob = new Blob([file], { type: mimeType });

    if (itemToAttachAudio) {
      const item = await getListeningItemFromDB(itemToAttachAudio);
      if (item) {
        item.audioBlob = audioBlob;
        item.audioName = file.name;
        await saveListeningItemToDB(item);
      }
      if (currentListeningItemId === itemToAttachAudio) {
        audioName = file.name;
        if (loadedAudioNameSpan) loadedAudioNameSpan.textContent = audioName;
        const objectURL = URL.createObjectURL(audioBlob);
        audioPlayer.src = objectURL;
        audioPlayer.load();
      }
      itemToAttachAudio = null;
      await renderListeningFileList();
      return;
    }

    audioName = file.name;
    if (loadedAudioNameSpan) loadedAudioNameSpan.textContent = audioName;
    if (btnClearStorage) btnClearStorage.style.display = 'inline-block';

    const objectURL = URL.createObjectURL(audioBlob);

    // Save audio blob to IndexedDB & metadata to localStorage
    await saveAudioToDB(audioBlob, file.name);
    localStorage.setItem('listening_audio_name', file.name);
    localStorage.setItem('listening_last_time', '0');

    if (currentListeningItemId) {
      const item = await getListeningItemFromDB(currentListeningItemId);
      if (item) {
        item.audioBlob = audioBlob;
        item.audioName = file.name;
        await saveListeningItemToDB(item);
      }
    }

    // Directly assign src to audioPlayer for iOS Safari compatibility
    audioPlayer.src = objectURL;
    audioPlayer.innerHTML = "";
    const source = document.createElement('source');
    source.src = objectURL;
    source.type = mimeType;
    audioPlayer.appendChild(source);
    audioPlayer.load();
  });

  // Subtitle Upload
  subFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await readFileAsTextSmart(file);
    const parsed = parseSubtitleText(text, file.name);

    if (itemToAttachSub) {
      const item = await getListeningItemFromDB(itemToAttachSub);
      if (item) {
        item.subtitles = parsed;
        item.subtitleText = text;
        item.subtitleName = file.name;
        if (docBookTitle) {
          item.title = docBookTitle;
          item.docBookTitle = docBookTitle;
        } else if (!item.title || item.title === 'Project Hail Mary') {
          item.title = file.name.replace(/\.[^/.]+$/, '');
          item.docBookTitle = item.title;
        }
        item.docAuthor = docAuthor || (item.docAuthor === 'Andy Weir' ? '' : (item.docAuthor || ''));
        await saveListeningItemToDB(item);
      }
      if (currentListeningItemId === itemToAttachSub) {
        subtitles = parsed;
        renderSubtitles();
      }
      itemToAttachSub = null;
      await renderListeningFileList();
      return;
    }

    subtitles = parsed;
    localStorage.setItem('listening_subtitle_name', file.name);
    localStorage.removeItem('listening_checked_indices');
    saveSubtitleStateToStorage();

    if (currentListeningItemId) {
      const item = await getListeningItemFromDB(currentListeningItemId);
      if (item) {
        item.subtitles = parsed;
        item.subtitleText = text;
        item.subtitleName = file.name;
        if (docBookTitle) {
          item.title = docBookTitle;
          item.docBookTitle = docBookTitle;
        } else if (!item.title || item.title === 'Project Hail Mary') {
          item.title = file.name.replace(/\.[^/.]+$/, '');
          item.docBookTitle = item.title;
        }
        item.docAuthor = docAuthor || (item.docAuthor === 'Andy Weir' ? '' : (item.docAuthor || ''));
        await saveListeningItemToDB(item);
      }
    }

    if (btnClearStorage) btnClearStorage.style.display = 'inline-block';
    if (btnExportData) btnExportData.style.display = 'inline-block';

    if (searchInput && searchInput.value.trim()) {
      performSearch(searchInput.value);
    } else {
      renderSubtitles();
    }
  });

  // Storage Clear / Reset Button
  if (btnClearStorage) {
    btnClearStorage.addEventListener('click', async () => {
      if (confirm('저장된 음원과 대본 학습 데이터를 모두 초기화하시겠습니까?')) {
        await clearAudioFromDB();
        localStorage.removeItem('listening_subtitle_text');
        localStorage.removeItem('listening_subtitle_name');
        localStorage.removeItem('listening_audio_name');
        localStorage.removeItem('listening_last_time');
        localStorage.removeItem('listening_checked_indices');
        localStorage.removeItem('listening_playback_speed');
        localStorage.removeItem('listening_repeat_count');
        localStorage.removeItem('listening_subtitle_hidden');
        localStorage.removeItem('listening_sort_mode');
        localStorage.removeItem('listening_doc_author');
        localStorage.removeItem('listening_doc_title');

        isSubtitleHidden = false;
        updateSubtitleVisibilityUI();

        sortMode = 'sequential';
        updateSortUI();

        docAuthor = "";
        docBookTitle = "";
        updateMetadataUI();

        if (searchInput) searchInput.value = "";
        performSearch("");

        audioPlayer.pause();
        audioPlayer.src = "";
        audioPlayer.innerHTML = "";
        audioName = "";
        subtitles = [];
        if (loadedAudioNameSpan) loadedAudioNameSpan.textContent = "로드된 음원 없음";
        btnClearStorage.style.display = 'none';
        if (btnExportData) btnExportData.style.display = 'none';
        renderSubtitles();
      }
    });
  }
}

function formatSentenceWithQuotes(text) {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed;
  }
  return `"${trimmed}"`;
}

// ── AI Prompt Construction ──
function buildAISearchPrompt(index) {
  const current = subtitles[index];
  if (!current) return "";

  const prevText = (index > 0) ? subtitles[index - 1].text : "";
  const nextText = (index < subtitles.length - 1) ? subtitles[index + 1].text : "";

  const cleanA = cleanAuthor(docAuthor);
  const cleanT = cleanBookTitle(docBookTitle);

  const author = cleanA || "저자";
  let bookTitle = cleanT || "책명";
  if (!bookTitle.startsWith('<')) {
    bookTitle = `<${bookTitle}>`;
  }

  let prompt = `아래 [대상 문장]에 대해 1, 2, 3 항목별로 구체적으로 설명해줘.\n1. 한국어 번역\n2. 주요 단어 및 숙어 설명\n3. 주요 문법 설명\n\n`;

  prompt += `[대상 문장]\n${formatSentenceWithQuotes(current.text)}\n\n`;

  if (prevText || nextText) {
    prompt += `[앞뒤 문맥]\n`;
    if (prevText) prompt += `이전: ${formatSentenceWithQuotes(prevText)}\n`;
    if (nextText) prompt += `다음: ${formatSentenceWithQuotes(nextText)}\n`;
    prompt += `\n`;
  }

  prompt += `[출처: ${author}, ${bookTitle}]`;

  return prompt;
}

// ── Subtitle Search Logic ──
let searchQuery = "";
let searchMatches = [];
let currentSearchMatchIdx = -1;

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function performSearch(query) {
  searchQuery = (query || "").trim().toLowerCase();
  const counterSpan = document.getElementById('search-counter');
  const btnPrev = document.getElementById('btn-search-prev');
  const btnNext = document.getElementById('btn-search-next');

  if (!searchQuery || !subtitles || subtitles.length === 0) {
    searchMatches = [];
    currentSearchMatchIdx = -1;
    if (counterSpan) {
      counterSpan.style.display = 'none';
      counterSpan.textContent = '';
    }
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    renderSubtitles();
    return;
  }

  const displayed = getDisplayedSubtitles();
  searchMatches = displayed.filter(s => (s.text || "").toLowerCase().includes(searchQuery));

  if (searchMatches.length === 0) {
    currentSearchMatchIdx = -1;
    if (counterSpan) {
      counterSpan.style.display = 'inline-block';
      counterSpan.textContent = '0/0';
    }
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    renderSubtitles();
    return;
  }

  if (currentSearchMatchIdx < 0 || currentSearchMatchIdx >= searchMatches.length) {
    currentSearchMatchIdx = 0;
  }

  updateSearchUIAndJump(true);
}

function navigateSearch(direction) {
  if (!searchMatches || searchMatches.length === 0) return;

  if (direction === 'next') {
    currentSearchMatchIdx = (currentSearchMatchIdx + 1) % searchMatches.length;
  } else if (direction === 'prev') {
    currentSearchMatchIdx = (currentSearchMatchIdx - 1 + searchMatches.length) % searchMatches.length;
  }

  updateSearchUIAndJump(true);
}

function updateSearchUIAndJump(doJump = true) {
  const counterSpan = document.getElementById('search-counter');
  const btnPrev = document.getElementById('btn-search-prev');
  const btnNext = document.getElementById('btn-search-next');

  if (!searchMatches || searchMatches.length === 0) {
    if (counterSpan) {
      counterSpan.style.display = 'none';
    }
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    return;
  }

  if (counterSpan) {
    counterSpan.style.display = 'inline-block';
    counterSpan.textContent = `${currentSearchMatchIdx + 1}/${searchMatches.length}`;
  }
  if (btnPrev) btnPrev.disabled = false;
  if (btnNext) btnNext.disabled = false;

  renderSubtitles();

  if (doJump && currentSearchMatchIdx >= 0 && currentSearchMatchIdx < searchMatches.length) {
    const targetSection = searchMatches[currentSearchMatchIdx];
    jumpToSection(targetSection.index);
  }
}

// ── Subtitle Card Rendering ──
function renderSubtitles() {
  transcriptPane.innerHTML = "";
  activeIndex = -1;

  const displayedList = getDisplayedSubtitles();

  if (displayedList.length === 0) {
    if (subtitles.length > 0 && sortMode === 'hardest') {
      const emptySortMsg = document.createElement('div');
      emptySortMsg.className = "no-subtitle-prompt";
      emptySortMsg.innerHTML = `
        <div class="icon">📊</div>
        <h3>반복 학습한 구간이 없습니다.</h3>
        <p style="max-width: 450px; font-size: 14px;">
          구간 반복 듣기를 진행하면 반복 횟수가 1회 이상인 어려운 구간들이 이곳에 모아서 표시됩니다.
        </p>
      `;
      transcriptPane.appendChild(emptySortMsg);
    } else {
      transcriptPane.appendChild(emptyPromptView);
    }
    return;
  }

  displayedList.forEach((s) => {
    const card = document.createElement('div');
    card.className = "sub-card";
    card.dataset.index = s.index;
    if (s.index === activeIndex) {
      card.classList.add('active');
    }

    // 1. 체크박스 생성
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'sub-checkbox';
    checkbox.checked = (s.checked !== undefined) ? s.checked : false;
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation(); // 카드 클릭 이벤트로 전파 방지
      s.checked = checkbox.checked;
      saveCheckedState();
    });
    card.appendChild(checkbox);

    // 2. 세로 텍스트/시간 콘텐츠를 감싸는 wrapper 생성
    const contentWrapper = document.createElement('div');
    contentWrapper.className = "sub-card-content";
    contentWrapper.style.display = "flex";
    contentWrapper.style.flexDirection = "column";
    contentWrapper.style.gap = "8px";
    contentWrapper.style.flex = "1";

    const badgeWrapper = document.createElement('div');
    badgeWrapper.style.display = "flex";
    badgeWrapper.style.gap = "6px";
    badgeWrapper.style.alignItems = "center";

    // Section Number Badge (#1, #2, ...)
    const numBadge = document.createElement('span');
    numBadge.className = "section-number";
    numBadge.textContent = `#${s.index + 1}`;
    badgeWrapper.appendChild(numBadge);

    const badge = document.createElement('span');
    badge.className = "time-badge";
    badge.textContent = `${formatTime(s.start)} - ${formatTime(s.end)}`;
    badgeWrapper.appendChild(badge);

    if ((s.repeated_number || 0) > 0) {
      const countBadge = document.createElement('span');
      countBadge.className = "count-badge";
      countBadge.style.fontSize = "11px";
      countBadge.style.fontWeight = "600";
      countBadge.style.padding = "2px 8px";
      countBadge.style.borderRadius = "10px";
      countBadge.style.background = "rgba(37, 99, 235, 0.1)";
      countBadge.style.color = "var(--accent)";
      countBadge.textContent = `${s.repeated_number}회`;
      badgeWrapper.appendChild(countBadge);
    }

    contentWrapper.appendChild(badgeWrapper);

    const textContainer = document.createElement('div');
    textContainer.className = "sub-text-container";

    if (searchQuery && (s.text || "").toLowerCase().includes(searchQuery)) {
      const regex = new RegExp(`(${escapeRegExp(searchQuery)})`, 'gi');
      const parts = (s.text || "").split(regex);
      textContainer.innerHTML = "";
      parts.forEach(part => {
        if (part.toLowerCase() === searchQuery) {
          const mark = document.createElement('mark');
          mark.className = 'search-highlight';
          mark.textContent = part;
          if (searchMatches[currentSearchMatchIdx] && searchMatches[currentSearchMatchIdx].index === s.index) {
            mark.classList.add('active-search-match');
          }
          textContainer.appendChild(mark);
        } else {
          textContainer.appendChild(document.createTextNode(part));
        }
      });
    } else {
      textContainer.textContent = s.text;
    }
    contentWrapper.appendChild(textContainer);

    card.appendChild(contentWrapper);

    // 3. AI 검색 버튼 생성
    const aiBtn = document.createElement('button');
    aiBtn.className = 'btn-ai-search';
    aiBtn.title = 'Google AI 분석 (번역, 단어, 문법)';
    aiBtn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg> AI`;
    aiBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // 카드 클릭 시 구간 재생 방지
      const promptText = buildAISearchPrompt(s.index);
      if (promptText) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(promptText)}&udm=50`;
        window.open(searchUrl, '_blank');
      }
    });
    card.appendChild(aiBtn);

    // ── Long-press & Click Handler ──
    // - 길게 누르기 (450ms): 특정 구간부터 현재 재생 구간까지 무한 반복 모드
    // - 싱글 클릭: 해당 구간으로 점프하여 재생
    let longPressTimer = null;
    let isLongPressTriggered = false;
    let suppressClickUntil = 0;
    let touchStartX = 0;
    let touchStartY = 0;

    const startLongPress = () => {
      isLongPressTriggered = false;
      card.classList.add('is-pressing');
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        isLongPressTriggered = true;
        card.classList.remove('is-pressing');
        suppressClickUntil = Date.now() + 500; // 롱프레스 후 발생하는 click 방지

        // 햅틱 진동 피드백
        if (navigator.vibrate) {
          try { navigator.vibrate(60); } catch {}
        }
        startCustomRangeLoop(s.index);
      }, 450);
    };

    const cancelLongPress = () => {
      card.classList.remove('is-pressing');
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    card.addEventListener('click', (e) => {
      // 체크박스나 AI 버튼 클릭 시에는 카드 클릭 무시
      if (e.target.closest('.sub-checkbox') || e.target.closest('.btn-ai-search')) {
        return;
      }
      if (isLongPressTriggered || Date.now() < suppressClickUntil) {
        isLongPressTriggered = false;
        e.stopPropagation();
        return;
      }

      // 일반 클릭 시 기존 범위 루프가 있었다면 해제하고 해당 구간으로 이동
      if (isRangeLoopActive) {
        cancelCustomRangeLoop();
      }
      jumpToSection(s.index);
    });

    // 데스크톱 마우스 롱클릭 지원
    card.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('.sub-checkbox') || e.target.closest('.btn-ai-search')) return;
      startLongPress();
    });
    card.addEventListener('mouseup', () => cancelLongPress());
    card.addEventListener('mouseleave', () => cancelLongPress());

    // 모바일 터치 이벤트
    card.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || e.target.closest('.sub-checkbox') || e.target.closest('.btn-ai-search')) {
        cancelLongPress();
        return;
      }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      startLongPress();
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        cancelLongPress();
      }
    }, { passive: true });

    card.addEventListener('touchend', () => cancelLongPress(), { passive: true });
    card.addEventListener('touchcancel', () => cancelLongPress(), { passive: true });

    transcriptPane.appendChild(card);
  });

  // Sync highlighting and range loop cards UI after render
  syncSubtitleHighlight(audioPlayer.currentTime);
  updateRangeLoopCardsUI();
}

// ── Keyboard Hotkeys ──
function setupHotkeyListeners() {
  window.addEventListener('keydown', (e) => {
    // Avoid hotkeys triggering when user is focusing an input or select element
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'select') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        jumpToPreviousSection();
        break;
      case 'ArrowRight':
        e.preventDefault();
        jumpToNextSection();
        break;
      case 'KeyR':
        e.preventDefault();
        toggleGlobalSectionRepeat();
        break;
      case 'KeyS':
        e.preventDefault();
        toggleSubtitlesVisibility();
        break;
      case 'KeyL':
        e.preventDefault();
        if (activeIndex !== -1 && subtitles[activeIndex]) {
          audioPlayer.currentTime = subtitles[activeIndex].start;
          if (audioPlayer.paused) audioPlayer.play();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        adjustSpeedValue(0.05);
        break;
      case 'ArrowDown':
        e.preventDefault();
        adjustSpeedValue(-0.05);
        break;
      case 'Escape':
        const gModal = document.getElementById('guide-modal');
        if (gModal && gModal.style.display !== 'none') {
          gModal.style.display = 'none';
        }
        break;
    }
  });
}

function setPlaybackSpeed(val) {
  speed = val;
  audioPlayer.playbackRate = speed;
  localStorage.setItem('listening_playback_speed', val.toString());

  // Sync with dropdown selection
  let optionExists = false;
  for (let i = 0; i < speedSelect.options.length; i++) {
    if (parseFloat(speedSelect.options[i].value) === val) {
      speedSelect.selectedIndex = i;
      optionExists = true;
      break;
    }
  }
  if (!optionExists) {
    const newOpt = new Option(val.toFixed(2) + 'x', val.toString());
    speedSelect.add(newOpt);
    speedSelect.value = val.toString();
  }
}

function adjustSpeedValue(delta) {
  let newSpeed = speed + delta;
  newSpeed = Math.max(0.5, Math.min(2.0, newSpeed));
  newSpeed = Math.round(newSpeed * 20) / 20; // Round to nearest 0.05
  setPlaybackSpeed(newSpeed);
}

// ── Restore Saved Learning State ──
async function restoreSavedState() {
  const savedAuthor = localStorage.getItem('listening_doc_author');
  const savedTitle = localStorage.getItem('listening_doc_title');
  if (savedAuthor) docAuthor = savedAuthor;
  if (savedTitle) docBookTitle = savedTitle;
  updateMetadataUI();

  // 1. Restore Subtitles from LocalStorage
  const savedSubText = localStorage.getItem('listening_subtitle_text');
  if (savedSubText) {
    subtitles = parseSubtitleText(savedSubText);

    // Restore checkbox states if saved
    const savedChecked = localStorage.getItem('listening_checked_indices');
    if (savedChecked) {
      try {
        const checkedIndices = JSON.parse(savedChecked);
        if (Array.isArray(checkedIndices)) {
          const checkedSet = new Set(checkedIndices);
          subtitles.forEach(s => s.checked = checkedSet.has(s.index));
        }
      } catch (e) {}
    }

    if (btnExportData) btnExportData.style.display = 'inline-block';
    renderSubtitles();
  }

  // 2. Restore Audio File from IndexedDB
  const savedAudio = await getAudioFromDB();
  if (savedAudio && savedAudio.blob) {
    audioName = savedAudio.name || "저장된 음원";
    if (loadedAudioNameSpan) loadedAudioNameSpan.textContent = audioName;
    if (btnClearStorage) btnClearStorage.style.display = 'inline-block';

    const mimeType = savedAudio.blob.type || "audio/mpeg";
    const objectURL = URL.createObjectURL(savedAudio.blob);

    // Directly assign src to audioPlayer for iOS Safari compatibility
    audioPlayer.src = objectURL;
    audioPlayer.innerHTML = "";
    const source = document.createElement('source');
    source.src = objectURL;
    source.type = mimeType;
    audioPlayer.appendChild(source);
    audioPlayer.load();

    // 3. Restore Playback Position
    const restoreTime = () => {
      const savedTime = parseFloat(localStorage.getItem('listening_last_time'));
      if (!isNaN(savedTime) && savedTime > 0 && savedTime < (audioPlayer.duration || Infinity)) {
        audioPlayer.currentTime = savedTime;
        updateTimelineProgress();
        syncSubtitleHighlight(savedTime);
      }
    };

    if (audioPlayer.readyState >= 1) {
      restoreTime();
    } else {
      audioPlayer.addEventListener('loadedmetadata', restoreTime, { once: true });
    }
  } else if (savedSubText) {
    if (btnClearStorage) btnClearStorage.style.display = 'inline-block';
  }

  // 4. Restore Playback Speed
  const savedSpeed = parseFloat(localStorage.getItem('listening_playback_speed'));
  if (!isNaN(savedSpeed) && savedSpeed > 0) {
    setPlaybackSpeed(savedSpeed);
  }

  // 5. Restore Repeat Count Preference
  const savedRepeatCount = localStorage.getItem('listening_repeat_count');
  if (savedRepeatCount && repeatCountSelect) {
    if (savedRepeatCount === '무한대') {
      repeatCountSelect.value = '∞';
    } else {
      repeatCountSelect.value = savedRepeatCount;
    }
    resetLoopCount();
  }

  // 6. Restore Subtitle Visibility State
  const savedSubtitleHidden = localStorage.getItem('listening_subtitle_hidden');
  if (savedSubtitleHidden === 'true') {
    isSubtitleHidden = true;
  } else {
    isSubtitleHidden = false;
  }
  updateSubtitleVisibilityUI();

  // 7. Restore Sort Mode State
  const savedSortMode = localStorage.getItem('listening_sort_mode');
  if (savedSortMode === 'hardest') {
    sortMode = 'hardest';
  } else {
    sortMode = 'sequential';
  }
  updateSortUI();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHTML(str) {
  return escapeHtml(str);
}
