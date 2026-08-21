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
let loopCountRemaining = 10; // Default repeat count for current section (10 times)
let loopDelayTimer = null;   // Timer for 1-second pause between loops
let isLoopWaiting = false;    // Flag indicating 1-second silent pause is active

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
const repeatCountInput = document.getElementById('repeat-count-input');
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
  function getTimelineSeekTime(e) {
    const rect = timelineWrapper.getBoundingClientRect();
    let pct = (e.clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));
    return pct * (audioPlayer.duration || 0);
  }

  timelineWrapper.addEventListener('mousedown', (e) => {
    if (!audioPlayer.duration) return;
    clearLoopWaitTimer();
    isDraggingTimeline = true;
    const seekTime = getTimelineSeekTime(e);
    audioPlayer.currentTime = seekTime;
    updateTimelineProgress();

    function onMouseMove(moveEvent) {
      const t = getTimelineSeekTime(moveEvent);
      audioPlayer.currentTime = t;
      updateTimelineProgress();
    }

    function onMouseUp() {
      isDraggingTimeline = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
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

  // Repeat count input handlers
  if (repeatCountInput) {
    repeatCountInput.addEventListener('blur', () => {
      const val = repeatCountInput.value.trim();
      if (val === '' || isNaN(parseInt(val, 10)) || parseInt(val, 10) <= 0) {
        if (val !== '∞') {
          repeatCountInput.value = '10';
        }
      }
      resetLoopCount();
    });
    repeatCountInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        repeatCountInput.blur();
      }
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
}

function getDesiredRepeatCount() {
  if (!repeatCountInput) return 10;
  const val = repeatCountInput.value.trim();
  if (val === '∞') return Infinity;
  const num = parseInt(val, 10);
  return isNaN(num) || num <= 0 ? 10 : num;
}

function resetLoopCount() {
  loopCountRemaining = getDesiredRepeatCount();
}

function togglePlay() {
  clearLoopWaitTimer();
  if (!audioName) {
    alert("음원 파일을 선택한 후 재생할 수 있습니다.");
    return;
  }
  if (audioPlayer.paused) {
    audioPlayer.play();
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
  if (!globalLoopEnabled || isLoopWaiting) return;
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
      let nextIdx = (loopSectionIndex + 1 < subtitles.length) ? loopSectionIndex + 1 : 0;

      loopSectionIndex = nextIdx;
      resetLoopCount();
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
  }
}

// ── Sync Active Subtitle & Auto-Scroll ──
function syncSubtitleHighlight(curTime) {
  if (subtitles.length === 0) return;

  let foundIndex = -1;

  // If looping is active, lock the highlighted subtitle to the looped one
  if (globalLoopEnabled && loopSectionIndex !== null) {
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

  if (foundIndex !== -1 && foundIndex !== activeIndex) {
    activeIndex = foundIndex;

    const cards = transcriptPane.querySelectorAll('.sub-card');
    cards.forEach((card, idx) => {
      if (idx === activeIndex) {
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        card.classList.remove('active');
      }
    });

    if (globalLoopEnabled) {
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

  // On iOS Safari, play() must be triggered first (user interaction context)
  // and setting currentTime should occur within play's promise resolution
  // to prevent Safari from resetting the playhead to 0.
  if (audioPlayer.paused) {
    audioPlayer.play().then(() => {
      audioPlayer.currentTime = section.start;
    }).catch((err) => {
      console.warn("Playback failed:", err);
      audioPlayer.currentTime = section.start;
    });
  } else {
    audioPlayer.currentTime = section.start;
  }

  // If global loop repeat is active, lock the loop target to the new section
  if (globalLoopEnabled) {
    loopSectionIndex = idx;
    updateTimelineLoopZone();
  }

  syncSubtitleHighlight(section.start);
}

function jumpToPreviousSection() {
  if (subtitles.length === 0) return;
  let target = activeIndex - 1;
  if (target < 0) target = 0;
  jumpToSection(target);
}

function jumpToNextSection() {
  if (subtitles.length === 0) return;
  let target = activeIndex + 1;
  if (target >= subtitles.length) target = subtitles.length - 1;
  jumpToSection(target);
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

// ── Subtitle Parser ──
function parseSubtitleText(text) {
  if (text.includes('-->')) {
    return parseSrtText(text);
  }

  const lines = text.split(/\r?\n/);
  const parsed = [];
  let index = 0;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Check if header line and skip
    if (line.includes("시작시간") || line.includes("자막") || line.includes("Start") || line.includes("Subtitle") || line.includes("종료시간")) {
      continue;
    }

    // Support both Tabs or Multiple Spaces (useful for raw copy-paste fallbacks)
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
          checked: false
        });
      }
    }
  }

  // Timing Normalization Step: Ensure no zero-duration cards
  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i].end <= parsed[i].start) {
      if (i + 1 < parsed.length && parsed[i + 1].start > parsed[i].start) {
        parsed[i].end = parsed[i + 1].start;
      } else {
        parsed[i].end = parsed[i].start + 2.0; // default 2 seconds
      }
    }
  }

  return parsed;
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

    // Use <source> element reloading trick for Safari compatibility
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
      
      // Save subtitle text to localStorage
      localStorage.setItem('listening_subtitle_text', text);
      localStorage.setItem('listening_subtitle_name', file.name);
      localStorage.removeItem('listening_checked_indices');
      if (btnClearStorage) btnClearStorage.style.display = 'inline-block';

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

        audioPlayer.pause();
        audioPlayer.src = "";
        audioPlayer.innerHTML = "";
        audioName = "";
        subtitles = [];
        loadedAudioNameSpan.textContent = "로드된 음원 없음";
        btnClearStorage.style.display = 'none';
        renderSubtitles();
      }
    });
  }
}

// ── AI Prompt Construction ──
function buildAISearchPrompt(index) {
  const current = subtitles[index];
  if (!current) return "";

  const prev = (index > 0) ? subtitles[index - 1].text : "";
  const next = (index < subtitles.length - 1) ? subtitles[index + 1].text : "";

  let prompt = "";
  if (prev || next) {
    prompt += `[앞뒤 문맥]\n`;
    if (prev) prompt += `이전 문장: "${prev}"\n`;
    if (next) prompt += `다음 문장: "${next}"\n`;
    prompt += `\n`;
  }

  prompt += `[대상 문장]\n"${current.text}"\n\n`;
  prompt += `위 문맥을 참고하여 [대상 문장]에 대해 아래 3가지를 설명해줘:\n1. 한국어 번역\n2. 주요 단어 및 숙어 설명\n3. 주요 문법 설명`;

  return prompt;
}

// ── Subtitle Card Rendering ──
function renderSubtitles() {
  transcriptPane.innerHTML = "";
  activeIndex = -1;

  if (subtitles.length === 0) {
    transcriptPane.appendChild(emptyPromptView);
    return;
  }

  subtitles.forEach((s) => {
    const card = document.createElement('div');
    card.className = "sub-card";
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

    const badge = document.createElement('span');
    badge.className = "time-badge";
    badge.textContent = `${formatTime(s.start)} - ${formatTime(s.end)}`;
    contentWrapper.appendChild(badge);

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
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(promptText)}`;
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
    // Avoid hotkeys triggering when user is focusing an input (e.g. file pickers)
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input') return;

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
}
