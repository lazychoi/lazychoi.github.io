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

// DOM Elements
const audioPlayer = document.getElementById('audio-player');
const playPauseBtn = document.getElementById('btn-play-pause');
const playIcon = document.getElementById('play-icon');
const prevSectionBtn = document.getElementById('btn-prev-section');
const nextSectionBtn = document.getElementById('btn-next-section');
const repeatToggleBtn = document.getElementById('btn-repeat-toggle');
const speedSelect = document.getElementById('speed-select');

const audioFileInput = document.getElementById('audio-file');
const subFileInput = document.getElementById('subtitle-file');
const loadedAudioNameSpan = document.getElementById('loaded-audio-name');
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
    playIcon.textContent = "⏸";
  });
  audioPlayer.addEventListener('pause', () => {
    playIcon.textContent = "▶";
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


}

function togglePlay() {
  if (!audioPlayer.src || audioPlayer.src === "") {
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
  } else {
    repeatToggleBtn.classList.remove('btn-active');
    loopSectionIndex = null;
  }
  updateTimelineLoopZone();
}

// ── Precision Section Repeating Logic ──
function checkSectionLoop(curTime) {
  if (globalLoopEnabled && loopSectionIndex !== null && subtitles[loopSectionIndex]) {
    const section = subtitles[loopSectionIndex];
    if (curTime >= section.end || curTime < section.start - 0.5) {
      audioPlayer.currentTime = section.start;
      if (audioPlayer.paused) audioPlayer.play();
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
function jumpToSection(idx) {
  if (idx < 0 || idx >= subtitles.length) return;

  const section = subtitles[idx];
  audioPlayer.currentTime = section.start;

  if (audioPlayer.paused) {
    audioPlayer.play();
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
      const start = parseFloat(parts[0]);
      const end = parseFloat(parts[1]);
      const subtitleText = parts.slice(2).join('\t').trim();

      if (!isNaN(start) && !isNaN(end)) {
        parsed.push({
          index: index++,
          start: start,
          end: end,
          text: subtitleText
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
  // Audio Upload (local in-memory object URL)
  audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    audioName = file.name;
    loadedAudioNameSpan.textContent = audioName;

    const objectURL = URL.createObjectURL(file);
    audioPlayer.src = objectURL;
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

    const badge = document.createElement('span');
    badge.className = "time-badge";
    badge.textContent = `${formatTime(s.start)} - ${formatTime(s.end)}`;
    card.appendChild(badge);

    const textContainer = document.createElement('div');
    textContainer.className = "sub-text-container";
    textContainer.textContent = s.text;
    card.appendChild(textContainer);

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
