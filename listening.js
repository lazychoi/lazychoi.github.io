/* ══════════════════════════════════════════════════════
   listening.js — 영어 듣기 연습 앱 핵심 로직 (간소화 버전)
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
let loopCountRemaining = Infinity; // Remaining repeat count for current section


// SVG Icons for iOS Compatibility
const PLAY_SVG = `<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>`;
const PAUSE_SVG = `<svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>`;

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
const repeatCountInput = document.getElementById('repeat-count-input');
const transcriptPane = document.getElementById('transcript-pane');
const emptyPromptView = document.getElementById('empty-prompt-view');

// Timeline Elements
const timelineWrapper = document.getElementById('timeline-wrapper');
const timelineProgress = document.getElementById('timeline-progress');
const timelineLoopZone = document.getElementById('timeline-loop-zone');
const timelineMarkers = document.getElementById('timeline-markers');
const timelineHandle = document.getElementById('timeline-handle');
const currentTimeDisplay = document.getElementById('current-time-display');
const totalTimeDisplay = document.getElementById('total-time-display');

// ── Initialize App ──
window.addEventListener('DOMContentLoaded', () => {
  setupAudioPlayerListeners();
  setupControlBarListeners();
  setupImportListeners();
  setupHotkeyListeners();
  setupTimelineListeners();
});

// ── Audio Player Core Listeners ──
function setupAudioPlayerListeners() {
  audioPlayer.addEventListener('play', () => {
    playPauseBtn.innerHTML = PAUSE_SVG;
  });
  audioPlayer.addEventListener('pause', () => {
    playPauseBtn.innerHTML = PLAY_SVG;
  });

  audioPlayer.addEventListener('loadedmetadata', () => {
    totalTimeDisplay.textContent = formatTime(audioPlayer.duration);
    renderTimelineMarkers();
    updateTimelineProgress();
  });

  // Precision loop updates using requestAnimationFrame
  function updateLoop() {
    if (!audioPlayer.paused && !isDraggingTimeline) {
      const curTime = audioPlayer.currentTime;
      updateTimelineProgress();
      syncSubtitleHighlight(curTime);
      checkSectionLoop(curTime);
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

function renderTimelineMarkers() {
  timelineMarkers.innerHTML = "";
  const dur = audioPlayer.duration;
  if (!dur || subtitles.length === 0) return;

  subtitles.forEach((s) => {
    const pct = (s.start / dur) * 100;
    const marker = document.createElement('div');
    marker.className = "timeline-marker";
    marker.style.left = pct + '%';
    timelineMarkers.appendChild(marker);
  });
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
      if (val === '' || val === '∞' || isNaN(parseInt(val, 10)) || parseInt(val, 10) <= 0) {
        repeatCountInput.value = '∞';
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
  const btnSelectAll = document.getElementById('btn-select-all');
  const btnDeselectAll = document.getElementById('btn-deselect-all');
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      subtitles.forEach(s => s.checked = true);
      renderSubtitles();
    });
  }
  if (btnDeselectAll) {
    btnDeselectAll.addEventListener('click', () => {
      subtitles.forEach(s => s.checked = false);
      renderSubtitles();
    });
  }
}

function getDesiredRepeatCount() {
  if (!repeatCountInput) return Infinity;
  const val = repeatCountInput.value.trim();
  if (val === '∞' || val === '') return Infinity;
  const num = parseInt(val, 10);
  return isNaN(num) || num <= 0 ? Infinity : num;
}

function resetLoopCount() {
  loopCountRemaining = getDesiredRepeatCount();
}

function togglePlay() {
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
  if (!globalLoopEnabled) return;

  const checkedIndices = getCheckedIndices();

  if (checkedIndices.length > 0) {
    // ══════════════════════════════════════════════════════
    // [모드 A] 선택 구간 묶음 반복 (Group Loop)
    // ══════════════════════════════════════════════════════
    if (loopSectionIndex !== null && subtitles[loopSectionIndex]) {
      const section = subtitles[loopSectionIndex];

      // 만약 현재 재생 중인 구간이 체크 해제되었다면 즉시 다음 체크된 구간으로 점프
      if (section.checked === false) {
        const nextIdx = checkedIndices.find(idx => idx > loopSectionIndex);
        if (nextIdx !== undefined) {
          jumpToSection(nextIdx, true); // 리셋 없이 이동 (isAuto: true)
        } else {
          handleLoopCycleEnd(checkedIndices);
        }
        return;
      }

      if (curTime >= section.end) {
        const currentPosInChecked = checkedIndices.indexOf(loopSectionIndex);
        const isLastCheckedSection = (currentPosInChecked === checkedIndices.length - 1);

        if (isLastCheckedSection) {
          // 마지막 체크 구간 재생이 끝났으므로 1회 사이클 완료 처리
          handleLoopCycleEnd(checkedIndices);
        } else {
          // 중간 구간 재생이 끝났으므로 다음 체크 구간으로 자동 점프
          const nextIdx = checkedIndices[currentPosInChecked + 1];
          jumpToSection(nextIdx, true); // 리셋 없이 이동 (isAuto: true)
        }
      }
    }
  } else {
    // ══════════════════════════════════════════════════════
    // [모드 B] 개별 구간별 순차 반복 (Individual Sequential Loop)
    // ══════════════════════════════════════════════════════
    if (loopSectionIndex !== null && subtitles[loopSectionIndex]) {
      const section = subtitles[loopSectionIndex];

      if (curTime >= section.end) {
        if (loopCountRemaining > 1) {
          if (loopCountRemaining !== Infinity) {
            loopCountRemaining--;
          }
          audioPlayer.currentTime = section.start;
          if (audioPlayer.paused) audioPlayer.play();
        } else {
          // 지정된 반복 횟수를 채웠으므로, 다음 구간으로 자동 이동하면서 카운트 리셋
          const nextIdx = loopSectionIndex + 1;
          if (nextIdx < subtitles.length) {
            jumpToSection(nextIdx, false); // 새 구간이므로 루프 카운트 리셋 (isAuto: false)
          } else {
            // 마지막 구간인 경우 루프 모드 해제
            globalLoopEnabled = false;
            repeatToggleBtn.classList.remove('btn-active');
            loopSectionIndex = null;
            updateTimelineLoopZone();
          }
        }
      }
    }
  }
}

// ── 1회 사이클 완료(전체 묶음 반복 끝) 시의 처리 함수 ──
function handleLoopCycleEnd(checkedIndices) {
  if (loopCountRemaining > 1) {
    if (loopCountRemaining !== Infinity) {
      loopCountRemaining--;
    }
    const firstIdx = checkedIndices[0];
    jumpToSection(firstIdx, true);
  } else {
    // 모든 반복 횟수를 완료했으므로 루프 해제
    globalLoopEnabled = false;
    repeatToggleBtn.classList.remove('btn-active');
    loopSectionIndex = null;
    updateTimelineLoopZone();
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

// MM:SS.SS 또는 HH:MM:SS.SS 형식의 자막 시간 문자열을 초(seconds)로 변환하는 함수
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
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
  const rawSec = parseFloat(timeStr);
  return isNaN(rawSec) ? 0 : rawSec;
}

// ── Subtitle Parser ──
function parseSubtitleText(text) {
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
          checked: true
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
  audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    audioName = file.name;
    loadedAudioNameSpan.textContent = audioName;

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
      renderSubtitles();
      renderTimelineMarkers();
    };
    reader.readAsText(file);
  });
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
    checkbox.checked = (s.checked !== undefined) ? s.checked : true;
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation(); // 카드 클릭 이벤트로 전파 방지
      s.checked = checkbox.checked;
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
