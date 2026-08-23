/* ══════════════════════════════════════════════════════
   listening.js — 영어 듣기 연습 앱 핵심 로직
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


// SVG Icons for iOS Compatibility
const PLAY_SVG = `<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>`;
const PAUSE_SVG = `<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>`;

// ── IndexedDB Storage for Audio File Persistence ──
const DB_NAME = 'ListeningAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'audioStore';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

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
let docAuthor = "저자";
let docBookTitle = "<책명>";

function getCurrentDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function saveSubtitleStateToStorage() {
  if (!subtitles || subtitles.length === 0) return;

  let author = docAuthor || "저자";
  let bookTitle = docBookTitle || "<책명>";
  if (!bookTitle.startsWith('<')) bookTitle = `<${bookTitle}>`;

  let exportText = `${author}, ${bookTitle}\n`;
  subtitles.forEach((s) => {
    const inTime = formatTime(s.start);
    const outTime = formatTime(s.end);
    const text = (s.text || "").replace(/\r?\n/g, ' ');
    const count = s.repeated_number || 0;
    const date = s.last_updated || "";
    exportText += `${inTime}|${outTime}|${text}|${count}|${date}\n`;
  });

  localStorage.setItem('listening_subtitle_text', exportText);
  saveCheckedState();
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
  await restoreSavedState();
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

  let author = docAuthor || "저자";
  let bookTitle = docBookTitle || "<책명>";
  if (!bookTitle.startsWith('<')) bookTitle = `<${bookTitle}>`;

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

  // If forceRealTimeSync is false and looping is active, lock the highlighted subtitle to the looped one
  if (!forceRealTimeSync && globalLoopEnabled && loopSectionIndex !== null) {
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

    const cards = transcriptPane.querySelectorAll('.sub-card');
    cards.forEach((card) => {
      const idx = parseInt(card.dataset.index, 10);
      if (idx === activeIndex) {
        card.classList.add('active');
        if (isIndexChanged || forceRealTimeSync) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const cleanStr = timeStr.trim().replace(',', '.');
  const parts = cleanStr.split(':');
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

  // Timing Normalization Step: Ensure no zero-duration cards
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].end <= parsed[i].start) {
      if (i + 1 < parsed.length && parsed[i + 1].start > parsed[i].start) {
        parsed[i].end = parsed[i + 1].start;
      } else {
        parsed[i].end = parsed[i].start + 2.0;
      }
    }
  }

  return parsed;
}

function parsePipeDelimitedText(lines) {
  const parsed = [];
  let index = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.toLowerCase().startsWith('in|') || line.toLowerCase().startsWith('start|')) {
      continue;
    }

    const parts = line.split('|');
    if (parts.length >= 3) {
      const start = parseTimeToSeconds(parts[0]);
      const end = parseTimeToSeconds(parts[1]);
      const subtitleText = parts[2].trim();
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
    }
  }

  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].end <= parsed[i].start) {
      if (i + 1 < parsed.length && parsed[i + 1].start > parsed[i].start) {
        parsed[i].end = parsed[i + 1].start;
      } else {
        parsed[i].end = parsed[i].start + 2.0;
      }
    }
  }

  return parsed;
}

function parseTabDelimitedText(lines) {
  const parsed = [];
  let index = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.includes("시작시간") || line.includes("자막") || line.includes("Start") || line.includes("Subtitle") || line.includes("종료시간")) {
      continue;
    }

    let parts = line.split('\t');
    if (parts.length < 3) {
      parts = line.split(/\s{2,}/);
    }

    if (parts.length >= 3) {
      const start = parseTimeToSeconds(parts[0]);
      const end = parseTimeToSeconds(parts[1]);
      const subtitleText = parts.slice(2).join('\t').trim();

      if (!isNaN(start) && !isNaN(end)) {
        parsed.push({
          index: index++,
          start: start,
          end: end,
          text: subtitleText,
          repeated_number: 0,
          last_updated: "",
          checked: false
        });
      }
    }
  }

  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].end <= parsed[i].start) {
      if (i + 1 < parsed.length && parsed[i + 1].start > parsed[i].start) {
        parsed[i].end = parsed[i + 1].start;
      } else {
        parsed[i].end = parsed[i].start + 2.0;
      }
    }
  }

  return parsed;
}

// ── Subtitle Parser ──
function parseSubtitleText(text) {
  if (!text) return [];
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  const lines = cleanText.split(/\r?\n/);

  if (lines.length === 0) return [];

  let startIndex = 0;
  const line1 = lines[0].trim();

  // Line 1 metadata check ("저자, <책명>")
  const isLine1Metadata = (line1.includes(',') || line1.includes('<')) &&
                          !line1.includes('-->') &&
                          !line1.includes('|') &&
                          !/^\d+$/.test(line1);

  if (isLine1Metadata) {
    const firstComma = line1.indexOf(',');
    if (firstComma !== -1) {
      docAuthor = line1.substring(0, firstComma).trim() || "저자";
      docBookTitle = line1.substring(firstComma + 1).trim() || "<책명>";
    } else {
      docAuthor = "저자";
      docBookTitle = line1 || "<책명>";
    }
    startIndex = 1;
  } else {
    docAuthor = "저자";
    docBookTitle = "<책명>";
    startIndex = 0;
  }

  const remainingLines = lines.slice(startIndex);
  const remainingText = remainingLines.join('\n');

  if (remainingText.includes('|')) {
    return parsePipeDelimitedText(remainingLines);
  } else if (remainingText.includes('-->')) {
    return parseSrtText(remainingText);
  } else {
    return parseTabDelimitedText(remainingLines);
  }
}

// ── Import Actions & File Listeners ──
function setupImportListeners() {
  // Audio Upload (local in-memory object URL with explicit typing and source reloading for Safari)
  audioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    audioName = file.name;
    loadedAudioNameSpan.textContent = audioName;
    if (btnClearStorage) btnClearStorage.style.display = 'inline-block';

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
    const objectURL = URL.createObjectURL(audioBlob);

    // Save audio blob to IndexedDB & metadata to localStorage
    await saveAudioToDB(audioBlob, file.name);
    localStorage.setItem('listening_audio_name', file.name);
    localStorage.setItem('listening_last_time', '0');

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
  subFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      subtitles = parseSubtitleText(text);

      localStorage.setItem('listening_subtitle_name', file.name);
      localStorage.removeItem('listening_checked_indices');
      saveSubtitleStateToStorage();

      if (btnClearStorage) btnClearStorage.style.display = 'inline-block';
      if (btnExportData) btnExportData.style.display = 'inline-block';

      renderSubtitles();
    };
    reader.readAsText(file);
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

        isSubtitleHidden = false;
        updateSubtitleVisibilityUI();

        sortMode = 'sequential';
        updateSortUI();

        docAuthor = "저자";
        docBookTitle = "<책명>";

        audioPlayer.pause();
        audioPlayer.src = "";
        audioPlayer.innerHTML = "";
        audioName = "";
        subtitles = [];
        loadedAudioNameSpan.textContent = "로드된 음원 없음";
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

  let author = docAuthor || "";
  let bookTitle = docBookTitle || "";
  if (bookTitle && !bookTitle.startsWith('<')) bookTitle = `<${bookTitle}>`;

  let prompt = `아래 [대상 문장]에 대해 1, 2, 3 항목별로 구체적으로 설명해줘.\n1. 한국어 번역\n2. 주요 단어 및 숙어 설명\n3. 주요 문법 설명\n\n`;

  prompt += `[대상 문장]\n${formatSentenceWithQuotes(current.text)}\n\n`;

  if (prevText || nextText) {
    prompt += `[앞뒤 문맥]\n`;
    if (prevText) prompt += `이전: ${formatSentenceWithQuotes(prevText)}\n`;
    if (nextText) prompt += `다음: ${formatSentenceWithQuotes(nextText)}\n`;
    prompt += `\n`;
  }

  if (author || bookTitle) {
    prompt += `[출처: ${author} ${bookTitle}]`.trim();
  }

  return prompt;
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
      countBadge.textContent = `${s.repeated_number}회 반복`;
      badgeWrapper.appendChild(countBadge);
    }

    contentWrapper.appendChild(badgeWrapper);

    const textContainer = document.createElement('div');
    textContainer.className = "sub-text-container";
    textContainer.textContent = s.text;
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

    // Card click defaults to seek to start and play
    card.addEventListener('click', () => {
      jumpToSection(s.index);
    });

    transcriptPane.appendChild(card);
  });

  // Sync highlighting after render
  syncSubtitleHighlight(audioPlayer.currentTime);
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
    loadedAudioNameSpan.textContent = audioName;
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
