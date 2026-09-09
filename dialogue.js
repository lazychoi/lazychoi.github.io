/* ══════════════════════════════════════════════════════
   dialogue.js — 영어 대화 암기 앱 핵심 컨트롤러
   (모바일/iPhone 최적화, 단계별 암기 학습, 신호음, 반복 토글)
   ══════════════════════════════════════════════════════ */

// ── Application State ──
let subtitles = [];              // Array of { id, index, start, end, duration, speaker: 'A'|'B', text, enText, koText }
let activeIndex = -1;            // Currently active / playing segment index
let targetIndex = 0;             // Target segment for 'from-prev' and 'from-start' modes
let audioBlob = null;
let audioName = "";
let srtName = "";

// Learning Modes: 'shadowing' | 'listen-speak' | 'from-prev' | 'from-start' | 'role-a' | 'role-b'
let currentMode = 'shadowing';
let activeRole = 'B';            // Active role for stage 5 ('B' | 'A')
let currentSubtitleLang = 'ko';  // Current subtitle language ('ko' | 'en') - Default: 'ko'
let isRepeatEnabled = false;     // Repeat toggle state (false: 1회/연속, true: 무한 반복)
let playbackSpeed = 1.0;

// Internal Flags & Timers
let isRepeatWaiting = false;     // Flag during 'listen-speak' wait countdown
let repeatTimerId = null;
let repeatTimerEnd = 0;
let repeatDurationTotal = 0;
let isCueCountingDown = false;   // Flag during 3, 2, 1, 삐 countdown
let cueTimeoutId = null;
let wakeLock = null;
let animationFrameId = null;

// IndexedDB Constants
const DB_NAME = 'DialogueAppDB_v2';
const DB_VERSION = 1;
const STORE_AUDIO = 'audioStore';

// DOM Elements
const audioPlayer = document.getElementById('dialogue-audio');
const dialogueList = document.getElementById('dialogue-list');
const emptyState = document.getElementById('empty-state');
const fileStatusText = document.getElementById('file-status-text');
const statusDot = document.querySelector('.status-dot');
const statusCounter = document.getElementById('status-counter');
const cueCountdownBanner = document.getElementById('cue-countdown-banner');
const cueCountdownText = document.getElementById('cue-countdown-text');

const audioFileInput = document.getElementById('audio-file-input');
const srtFileInput = document.getElementById('srt-file-input');
const btnEmptySample = document.getElementById('btn-empty-sample');
const btnReset = document.getElementById('btn-reset');
const btnGuide = document.getElementById('btn-guide');
const guideModal = document.getElementById('guide-modal');
const guideModalClose = document.getElementById('guide-modal-close');

const speedSelect = document.getElementById('speed-select');
const btnRepeatToggle = document.getElementById('btn-repeat-toggle');
const repeatToggleLabel = document.getElementById('repeat-toggle-label');
const modeSelector = document.getElementById('mode-selector');
const btnRoleToggle = document.getElementById('btn-role-toggle');
const roleStageName = document.getElementById('role-stage-name');
const btnLangToggle = document.getElementById('btn-lang-toggle');

// ── Built-in Realistic Everyday Dialogue Sample (Bilingual: English | Korean) ──
const SAMPLE_DIALOGUE_SRT = `1
00:00:00,500 --> 00:00:03,800
A: Hi Sarah, good to see you! How has your week been?|안녕 사라, 만나서 반가워! 이번 주 어땠어?

2
00:00:04,200 --> 00:00:08,100
B: Hey John! It's been pretty busy, but everything is going well.|안녕 존! 꽤 바빴지만, 다 잘 되어가고 있어.

3
00:00:08,500 --> 00:00:12,300
A: Are you still working on that marketing presentation for Friday?|금요일 마케팅 발표 준비는 아직 하고 있어?

4
00:00:12,700 --> 00:00:16,900
B: Yes, I just finished the final draft this morning. What about you?|응, 오늘 아침에 최종 초안을 막 마쳤어. 너는 어때?

5
00:00:17,400 --> 00:00:21,200
A: I'm almost done with the quarterly budget report.|분기 예산 보고서 거의 다 끝나가.

6
00:00:21,700 --> 00:00:25,500
B: That sounds like a lot of work. Do you want to grab coffee later?|일이 정말 많았겠네. 나중에 커피 한잔할래?

7
00:00:26,000 --> 00:00:29,600
A: That would be great! How about meeting around two o'clock?|좋지! 두 시쯤에 만나는 거 어때?

8
00:00:30,100 --> 00:00:33,800
B: Two o'clock works perfectly for me. See you at the cafe!|두 시 딱 좋아. 카페에서 보자!`;

// ── Web Audio Context for Sound Effects & Cues ──
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Crisp beep generator using Web Audio
function playTone(frequency, durationMs, type = 'sine') {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (durationMs / 1000));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + (durationMs / 1000));
  } catch (e) {
    console.warn('Audio tone error:', e);
  }
}

// Gentle turn chime before user speaks
function playTurnChime() {
  playTone(660, 140, 'triangle');
}

// Countdown Cue: "3 -> 2 -> 1 -> 삐!" (비프음 전용)
function startStartingCueCountdown(onComplete) {
  cancelCueCountdown();
  isCueCountingDown = true;
  cueCountdownBanner.style.display = 'flex';

  // Step 3
  cueCountdownText.textContent = '3';
  playTone(523.25, 150); // C5

  cueTimeoutId = setTimeout(() => {
    if (!isCueCountingDown) return;
    // Step 2
    cueCountdownText.textContent = '2';
    playTone(523.25, 150); // C5

    cueTimeoutId = setTimeout(() => {
      if (!isCueCountingDown) return;
      // Step 1
      cueCountdownText.textContent = '1';
      playTone(523.25, 150); // C5

      cueTimeoutId = setTimeout(() => {
        if (!isCueCountingDown) return;
        // Step Start!
        cueCountdownText.textContent = '시작! 🗣️';
        playTone(1046.5, 320, 'triangle'); // C6 High Chime

        setTimeout(() => {
          isCueCountingDown = false;
          cueCountdownBanner.style.display = 'none';
          if (onComplete) onComplete();
        }, 400);
      }, 900);
    }, 900);
  }, 900);
}

function cancelCueCountdown() {
  if (isCueCountingDown) {
    isCueCountingDown = false;
    if (cueTimeoutId) {
      clearTimeout(cueTimeoutId);
      cueTimeoutId = null;
    }
    cueCountdownBanner.style.display = 'none';
  }
}

// ── Initialize App ──
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  setupAudioListeners();
  setupMediaSession();
  setSpeedSelectValue(1.00); // Ensure 1.00x is default
  updateLangButtonUI();
  updateRoleButtonUI();
  await initDB();
  await restoreSavedState();
  startRAFPrecisionLoop();
});

// ── Speed Helper ──
function setSpeedSelectValue(speed) {
  const speedVal = parseFloat(speed) || 1.00;
  playbackSpeed = speedVal;
  audioPlayer.playbackRate = speedVal;

  let matched = false;
  for (let i = 0; i < speedSelect.options.length; i++) {
    if (Math.abs(parseFloat(speedSelect.options[i].value) - speedVal) < 0.01) {
      speedSelect.selectedIndex = i;
      matched = true;
      break;
    }
  }
  if (!matched) {
    for (let i = 0; i < speedSelect.options.length; i++) {
      if (Math.abs(parseFloat(speedSelect.options[i].value) - 1.00) < 0.01) {
        speedSelect.selectedIndex = i;
        break;
      }
    }
  }
}

// ── IndexedDB Storage ──
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO);
      }
    };
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveAudioToDB(blob, name) {
  try {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(STORE_AUDIO, 'readwrite');
      tx.objectStore(STORE_AUDIO).put({ blob, name }, 'currentAudio');
    };
  } catch (err) {
    console.warn('Failed to save audio to DB:', err);
  }
}

async function getAudioFromDB() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(STORE_AUDIO, 'readonly');
        const getReq = tx.objectStore(STORE_AUDIO).get('currentAudio');
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function clearAudioFromDB() {
  try {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(STORE_AUDIO, 'readwrite');
      tx.objectStore(STORE_AUDIO).delete('currentAudio');
    };
  } catch (err) {
    console.warn('Failed to clear audio DB:', err);
  }
}

// ── Filename Comparison Helpers ──
function getBaseFileName(fileName) {
  if (!fileName) return '';
  const clean = fileName.trim().split(/[/\\]/).pop();
  const lastDotIndex = clean.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return clean.substring(0, lastDotIndex).trim();
  }
  return clean.trim();
}

function isSampleFile(name) {
  return !name || name.includes('샘플') || name === '대화 자막';
}

function saveStateToStorage() {
  const state = {
    subtitles,
    audioName,
    srtName,
    currentMode,
    activeRole,
    currentSubtitleLang,
    isRepeatEnabled,
    playbackSpeed,
    activeIndex,
    targetIndex
  };
  try {
    localStorage.setItem('dialogue_app_state_v2', JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

async function restoreSavedState() {
  const savedStateStr = localStorage.getItem('dialogue_app_state_v2');
  if (savedStateStr) {
    try {
      const state = JSON.parse(savedStateStr);
      if (state.subtitles && state.subtitles.length > 0) {
        subtitles = state.subtitles;
        srtName = state.srtName || "대화 자막";
        currentMode = state.currentMode || 'shadowing';
        activeRole = state.activeRole || ((currentMode === 'role-a') ? 'A' : 'B');
        currentSubtitleLang = state.currentSubtitleLang || 'ko';
        isRepeatEnabled = !!state.isRepeatEnabled;
        playbackSpeed = state.playbackSpeed || 1.0;
        targetIndex = state.targetIndex || 0;
        activeIndex = (state.activeIndex >= 0 && state.activeIndex < subtitles.length) ? state.activeIndex : 0;

        // Apply UI values
        setSpeedSelectValue(playbackSpeed || 1.00);
        updateRepeatButtonUI();
        updateRoleButtonUI();
        updateLangButtonUI();
        updateModeSelectorUI(currentMode);

        renderDialogueList();
      }
    } catch (e) {
      console.warn('Failed parsing saved state:', e);
    }
  }

  // Restore Audio from IndexedDB
  const savedAudio = await getAudioFromDB();
  if (savedAudio && savedAudio.blob) {
    audioBlob = savedAudio.blob;
    audioName = savedAudio.name;
    const audioUrl = URL.createObjectURL(audioBlob);
    audioPlayer.src = audioUrl;
    updateStatusBanner(`음원: ${audioName} (${subtitles.length}개 구간)`);
  } else if (subtitles.length > 0) {
    updateStatusBanner(`자막: ${srtName} (${subtitles.length}개 구간, 음원 선택 필요)`);
  }
}

// ── SRT Subtitle Parser (Detecting A/B Roles) ──
function parseSRT(text) {
  if (!text) return [];
  const cleanText = text.replace(/^\uFEFF/, '').trim();

  // If text is pipe-delimited (like listening.html .txt export), parse with pipe parser
  if (!cleanText.includes('-->') && cleanText.includes('|')) {
    return parsePipeDelimitedSubtitles(cleanText);
  }

  const rawBlocks = cleanText.split(/\r?\n\r?\n/);
  const parsed = [];
  let index = 0;

  for (let block of rawBlocks) {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) continue;

    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIdx = i;
        break;
      }
    }
    if (timeLineIdx === -1) continue;

    const timeParts = lines[timeLineIdx].split('-->');
    const startSec = parseTimeToSeconds(timeParts[0].trim());
    const endSec = parseTimeToSeconds(timeParts[1].trim().split(/\s+/)[0]);
    if (startSec === null || endSec === null || endSec <= startSec) continue;

    const textLines = lines.slice(timeLineIdx + 1);
    let fullText = textLines.join(' ').replace(/<[^>]*>/g, '').trim();
    if (!fullText) continue;

    let speaker = (index % 2 === 0) ? 'A' : 'B';
    let cleanSentence = fullText;

    const speakerRegex = /^(?:\[(A|B)\]|\((A|B)\)|(A|B)\s*:|(Speaker\s*1|Person\s*1)\s*:|(Speaker\s*2|Person\s*2)\s*:)\s*(.*)$/i;
    const match = fullText.match(speakerRegex);

    if (match) {
      const explicitRole = (match[1] || match[2] || match[3] || match[4] || match[5] || '').toUpperCase();
      if (explicitRole.includes('A') || explicitRole.includes('1')) {
        speaker = 'A';
      } else if (explicitRole.includes('B') || explicitRole.includes('2')) {
        speaker = 'B';
      }
      cleanSentence = match[6].trim();
    } else {
      const nameMatch = fullText.match(/^([A-Za-z가-힣0-9_]+)\s*:\s*(.*)$/);
      if (nameMatch) {
        cleanSentence = nameMatch[2].trim();
        speaker = (index % 2 === 0) ? 'A' : 'B';
      }
    }

    // Split English and Korean by '|'
    let enText = cleanSentence;
    let koText = cleanSentence;
    if (cleanSentence.includes('|')) {
      const pIdx = cleanSentence.indexOf('|');
      enText = cleanSentence.substring(0, pIdx).trim();
      koText = cleanSentence.substring(pIdx + 1).trim();

      const koSpeakerMatch = koText.match(/^(?:\[(A|B)\]|\((A|B)\)|(A|B)\s*:|(Speaker\s*1|Person\s*1)\s*:|(Speaker\s*2|Person\s*2)\s*:)\s*(.*)$/i);
      if (koSpeakerMatch) {
        koText = (koSpeakerMatch[6] || '').trim();
      }
    }

    parsed.push({
      id: `diag-${index}`,
      index: index,
      start: startSec,
      end: endSec,
      duration: Math.max(0.1, endSec - startSec),
      speaker: speaker,
      text: cleanSentence || fullText,
      enText: enText || cleanSentence || fullText,
      koText: koText || cleanSentence || fullText
    });

    index++;
  }

  return parsed;
}

// Support pipe-delimited text exports from listening app or transcript files
function parsePipeDelimitedSubtitles(cleanText) {
  const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const parsed = [];
  let index = 0;

  for (let line of lines) {
    // Skip metadata headers if present (e.g. Author, Title)
    if (!line.includes('|')) continue;
    const parts = line.split('|');
    if (parts.length < 3) continue;

    const startSec = parseTimeToSeconds(parts[0].trim());
    const endSec = parseTimeToSeconds(parts[1].trim());
    if (startSec === null || endSec === null || endSec <= startSec) continue;

    const fullText = parts.slice(2).join('|').trim();
    if (!fullText) continue;

    let speaker = (index % 2 === 0) ? 'A' : 'B';
    let cleanSentence = fullText;

    const speakerRegex = /^(?:\[(A|B)\]|\((A|B)\)|(A|B)\s*:|(Speaker\s*1|Person\s*1)\s*:|(Speaker\s*2|Person\s*2)\s*:)\s*(.*)$/i;
    const match = fullText.match(speakerRegex);
    if (match) {
      const explicitRole = (match[1] || match[2] || match[3] || match[4] || match[5] || '').toUpperCase();
      if (explicitRole.includes('A') || explicitRole.includes('1')) speaker = 'A';
      else if (explicitRole.includes('B') || explicitRole.includes('2')) speaker = 'B';
      cleanSentence = match[6].trim();
    }

    let enText = cleanSentence;
    let koText = cleanSentence;
    if (cleanSentence.includes('|')) {
      const pIdx = cleanSentence.indexOf('|');
      enText = cleanSentence.substring(0, pIdx).trim();
      koText = cleanSentence.substring(pIdx + 1).trim();

      const koSpeakerMatch = koText.match(/^(?:\[(A|B)\]|\((A|B)\)|(A|B)\s*:|(Speaker\s*1|Person\s*1)\s*:|(Speaker\s*2|Person\s*2)\s*:)\s*(.*)$/i);
      if (koSpeakerMatch) {
        koText = (koSpeakerMatch[6] || '').trim();
      }
    }

    parsed.push({
      id: `diag-${index}`,
      index: index,
      start: startSec,
      end: endSec,
      duration: Math.max(0.1, endSec - startSec),
      speaker: speaker,
      text: cleanSentence || fullText,
      enText: enText || cleanSentence || fullText,
      koText: koText || cleanSentence || fullText
    });
    index++;
  }

  return parsed;
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.replace(',', '.').split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const s = parseFloat(parts[2]);
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    return m * 60 + s;
  }
  return null;
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Synthetic Audio Generator (Fallback Demo Audio) ──
function createSyntheticAudioForDialogue(dialogueItems) {
  if (dialogueItems.length === 0) return null;
  const totalDuration = dialogueItems[dialogueItems.length - 1].end + 1.0;
  const sampleRate = 22050;
  const numFrames = Math.floor(sampleRate * totalDuration);

  const ctx = getAudioContext();
  const buffer = ctx.createBuffer(1, numFrames, sampleRate);
  const channelData = buffer.getChannelData(0);

  dialogueItems.forEach((item) => {
    const startSample = Math.floor(item.start * sampleRate);
    const endSample = Math.floor(item.end * sampleRate);
    const freq = item.speaker === 'A' ? 440 : 554;

    for (let i = startSample; i < endSample && i < numFrames; i++) {
      const t = (i - startSample) / sampleRate;
      const env = Math.sin(Math.min(Math.PI, t * 10)) * 0.15;
      channelData[i] = Math.sin(2 * Math.PI * freq * t) * env;
    }
  });

  return bufferToWave(buffer, numFrames);
}

function bufferToWave(abuffer, totalSamples) {
  const numOfChan = abuffer.numberOfChannels;
  const length = totalSamples * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels = [];
  let pos = 0;

  function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
  function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (let i = 0; i < abuffer.numberOfChannels; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  for (let i = 0; i < totalSamples; i++) {
    for (let c = 0; c < numOfChan; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c][i]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}

// ── Screen Wake Lock ──
async function requestWakeLock() {
  if ('wakeLock' in navigator && !wakeLock) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch {}
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

// ── Audio Player Setup & Core Listeners ──
function setupAudioListeners() {
  audioPlayer.addEventListener('play', () => {
    requestWakeLock();
    updateStatusCounter();
  });

  audioPlayer.addEventListener('pause', () => {
    releaseWakeLock();
    updateStatusCounter();
  });

  audioPlayer.addEventListener('ended', () => {
    handlePlaybackEnded();
  });
}

// ── Precision Animation Frame Audio Loop ──
function startRAFPrecisionLoop() {
  function loop() {
    if (!audioPlayer.paused && activeIndex !== -1 && subtitles[activeIndex]) {
      const curTime = audioPlayer.currentTime;
      checkAudioProgress(curTime);
    }
    animationFrameId = requestAnimationFrame(loop);
  }
  animationFrameId = requestAnimationFrame(loop);
}

// ── Real-time Progress & Mute Handling ──
function checkAudioProgress(curTime) {
  if (isRepeatWaiting || isCueCountingDown) return;
  const seg = subtitles[activeIndex];
  if (!seg) return;

  // 1. Role-play Mute Logic (for 'role-a' and 'role-b')
  if (currentMode === 'role-a') {
    if (seg.speaker === 'A') {
      if (!audioPlayer.muted) {
        audioPlayer.muted = true;
      }
      updateCardStatusUI(activeIndex, 'speaking-a', curTime);
    } else {
      if (audioPlayer.muted) {
        audioPlayer.muted = false;
      }
      updateCardStatusUI(activeIndex, 'listening-b', curTime);
    }
  } else if (currentMode === 'role-b') {
    if (seg.speaker === 'B') {
      if (!audioPlayer.muted) {
        audioPlayer.muted = true;
      }
      updateCardStatusUI(activeIndex, 'speaking-b', curTime);
    } else {
      if (audioPlayer.muted) {
        audioPlayer.muted = false;
      }
      updateCardStatusUI(activeIndex, 'listening-a', curTime);
    }
  } else {
    // Other modes: normal unmuted listening
    if (audioPlayer.muted) {
      audioPlayer.muted = false;
    }
    updateCardStatusUI(activeIndex, 'normal-listening', curTime);
  }

  // 2. Segment Boundary Reached
  if (curTime >= seg.end) {
    handleSegmentEndReached(seg);
  }
}

// ── Mode-specific Segment End Handler ──
function handleSegmentEndReached(seg) {
  // ── Stage 1: 섀도잉 (Shadowing) ──
  if (currentMode === 'shadowing') {
    if (isRepeatEnabled) {
      // 반복 ON: 현재 구간 무한 반복
      audioPlayer.currentTime = seg.start;
      audioPlayer.play().catch(() => {});
    } else {
      // 반복 OFF: 다음 구간으로 바로 넘어감
      if (activeIndex < subtitles.length - 1) {
        advanceToSegment(activeIndex + 1);
      } else {
        // 마지막 구간 도달 시 종료
        stopAudioPlayback();
      }
    }
    return;
  }

  // ── Stage 2: 듣고 말하기 (Listen & Speak) ──
  if (currentMode === 'listen-speak') {
    startListenSpeakPause(seg);
    return;
  }

  // ── Stage 3: 직전 구간부터 (From Previous) ──
  if (currentMode === 'from-prev') {
    if (activeIndex < targetIndex) {
      // 직전 구간(targetIndex - 1) 끝남 -> 현재 구간(targetIndex)으로 이동
      advanceToSegment(activeIndex + 1);
    } else {
      // 현재 구간(targetIndex) 끝남
      if (isRepeatEnabled) {
        // 반복 ON: 직전 구간부터 다시 무한 반복
        const startIdx = Math.max(0, targetIndex - 1);
        jumpToSegment(startIdx, true);
      } else {
        // 반복 OFF: 1회 완료 후 정지
        stopAudioPlayback();
      }
    }
    return;
  }

  // ── Stage 4: 처음~현재 (From Start) ──
  if (currentMode === 'from-start') {
    if (activeIndex < targetIndex) {
      // 다음 구간으로 진행
      advanceToSegment(activeIndex + 1);
    } else {
      // 목표 구간(targetIndex) 도달 완료
      if (isRepeatEnabled) {
        // 반복 ON: 1번 문장부터 다시 무한 반복
        jumpToSegment(0, true);
      } else {
        // 반복 OFF: 1회 완료 후 정지
        stopAudioPlayback();
      }
    }
    return;
  }

  // ── Stage 5: A 말하기 (Role A) ──
  if (currentMode === 'role-a') {
    if (activeIndex < subtitles.length - 1) {
      advanceToSegment(activeIndex + 1);
    } else {
      // 전체 대화 끝
      if (isRepeatEnabled) {
        jumpToSegment(0, true);
      } else {
        stopAudioPlayback();
      }
    }
    return;
  }

  // ── Stage 6: B 말하기 (Role B) ──
  if (currentMode === 'role-b') {
    if (activeIndex < subtitles.length - 1) {
      advanceToSegment(activeIndex + 1);
    } else {
      // 전체 대화 끝
      if (isRepeatEnabled) {
        jumpToSegment(0, true);
      } else {
        stopAudioPlayback();
      }
    }
    return;
  }
}

// ── Listen & Speak Countdown Delay ──
function startListenSpeakPause(seg) {
  isRepeatWaiting = true;
  audioPlayer.pause();

  const speakDurationSec = Math.max(1.2, seg.duration / audioPlayer.playbackRate);
  repeatDurationTotal = speakDurationSec;
  repeatTimerEnd = performance.now() + (speakDurationSec * 1000);

  updateCardStatusUI(activeIndex, 'speak-wait', 0);

  function countdownStep() {
    if (!isRepeatWaiting) return;
    const now = performance.now();
    const remainingMs = Math.max(0, repeatTimerEnd - now);
    const elapsedSec = (repeatDurationTotal * 1000 - remainingMs) / 1000;

    updateCardStatusUI(activeIndex, 'speak-progress', elapsedSec);

    if (remainingMs <= 20) {
      isRepeatWaiting = false;
      clearCardStatusUI(activeIndex);

      if (isRepeatEnabled) {
        // 반복 ON: 현재 구간 무한 반복 (듣기 -> 말하기)
        jumpToSegment(activeIndex, true);
      } else {
        // 반복 OFF: 다음 구간으로 자동 진행
        if (activeIndex < subtitles.length - 1) {
          advanceToSegment(activeIndex + 1);
        } else {
          stopAudioPlayback();
        }
      }
    } else {
      repeatTimerId = requestAnimationFrame(countdownStep);
    }
  }

  repeatTimerId = requestAnimationFrame(countdownStep);
}

function cancelRepeatWait() {
  if (isRepeatWaiting) {
    isRepeatWaiting = false;
    if (repeatTimerId) {
      cancelAnimationFrame(repeatTimerId);
      repeatTimerId = null;
    }
    if (activeIndex !== -1) {
      clearCardStatusUI(activeIndex);
    }
  }
}

// ── Segment Navigation & Touch Toggle ──
function handleSegmentTouch(index) {
  if (index < 0 || index >= subtitles.length) return;

  // Case 1: Touching the currently active segment -> Toggle Play/Pause!
  if (activeIndex === index) {
    if (isCueCountingDown) {
      cancelCueCountdown();
      return;
    }
    if (isRepeatWaiting) {
      cancelRepeatWait();
      audioPlayer.pause();
      return;
    }

    if (!audioPlayer.paused) {
      audioPlayer.pause();
    } else {
      audioPlayer.play().catch(e => console.warn(e));
    }
    return;
  }

  // Case 2: Touching a different segment -> Switch to it based on current mode
  cancelRepeatWait();
  cancelCueCountdown();

  targetIndex = index;
  saveStateToStorage();

  if (currentMode === 'from-prev') {
    // 직전 구간부터 듣기: index - 1부터 시작
    const startIdx = Math.max(0, index - 1);
    jumpToSegment(startIdx, true);
  } else if (currentMode === 'from-start') {
    // 처음부터 현재까지: 0부터 시작하여 index까지
    jumpToSegment(0, true);
  } else {
    // 섀도잉, 듣고 말하기, A/B 말하기: 해당 구간으로 점프
    jumpToSegment(index, true);
  }
}

function jumpToSegment(index, autoPlay = true) {
  if (index < 0 || index >= subtitles.length) return;
  cancelRepeatWait();

  activeIndex = index;
  const seg = subtitles[index];

  // Set audio time
  audioPlayer.currentTime = seg.start;

  // Set mute status based on role
  if (currentMode === 'role-a') {
    audioPlayer.muted = (seg.speaker === 'A');
  } else if (currentMode === 'role-b') {
    audioPlayer.muted = (seg.speaker === 'B');
  } else {
    audioPlayer.muted = false;
  }

  updateActiveCardUI();
  updateStatusCounter();
  saveStateToStorage();

  if (autoPlay) {
    audioPlayer.play().catch(err => console.warn('Play prevented:', err));
  }
}

function advanceToSegment(index) {
  // If transitioning to A in 'role-a', or B in 'role-b', play gentle turn chime
  const nextSeg = subtitles[index];
  if (nextSeg) {
    if ((currentMode === 'role-a' && nextSeg.speaker === 'A') ||
        (currentMode === 'role-b' && nextSeg.speaker === 'B')) {
      playTurnChime();
    }
  }
  jumpToSegment(index, true);
}

function stopAudioPlayback() {
  audioPlayer.pause();
  cancelRepeatWait();
  cancelCueCountdown();
  if (subtitles[0]) {
    audioPlayer.currentTime = subtitles[0].start;
  }
  updateStatusCounter();
}

function handlePlaybackEnded() {
  cancelRepeatWait();
  stopAudioPlayback();
}

// ── UI Rendering & Dialogue Feed ──
function renderDialogueList() {
  if (!subtitles || subtitles.length === 0) {
    emptyState.style.display = 'flex';
    dialogueList.style.display = 'none';
    statusCounter.textContent = '- / -';
    return;
  }

  emptyState.style.display = 'none';
  dialogueList.style.display = 'flex';
  dialogueList.innerHTML = '';

  subtitles.forEach((seg, idx) => {
    const card = document.createElement('div');
    card.className = `dialogue-card speaker-${seg.speaker.toLowerCase()} ${idx === activeIndex ? 'is-active' : ''}`;
    card.id = `card-${idx}`;
    card.dataset.index = idx;

    const speakerColorClass = seg.speaker === 'A' ? 'badge-speaker-a' : 'badge-speaker-b';

    const displayText = (currentSubtitleLang === 'en') ? (seg.enText || seg.text) : (seg.koText || seg.text);

    card.innerHTML = `
      <div class="bubble-content" data-index="${idx}">
        <div class="bubble-header">
          <button class="speaker-badge-btn ${speakerColorClass}" data-index="${idx}" title="화자 변경 (A ↔ B)">
            <span>${seg.speaker}</span>
          </button>
          <div class="bubble-time-info">
            <span>${formatTime(seg.start)} - ${formatTime(seg.end)}</span>
          </div>
        </div>
        <div class="bubble-text" id="text-${idx}">
          ${escapeHTML(displayText)}
        </div>
        <div class="bubble-status-footer" id="footer-${idx}" style="display: none;">
          <div class="status-badge-live" id="badge-${idx}"></div>
          <div class="bubble-progress-track">
            <div class="bubble-progress-fill" id="fill-${idx}"></div>
          </div>
        </div>
      </div>
    `;

    // Click anywhere on bubble -> Toggle Play/Pause or select segment
    const bubbleContent = card.querySelector('.bubble-content');
    bubbleContent.addEventListener('click', (e) => {
      // Tap speaker badge to toggle A <-> B
      if (e.target.closest('.speaker-badge-btn')) {
        e.stopPropagation();
        toggleSpeaker(idx);
        return;
      }
      handleSegmentTouch(idx);
    });

    dialogueList.appendChild(card);
  });

  updateActiveCardUI();
  updateStatusCounter();
}

function updateActiveCardUI() {
  const cards = document.querySelectorAll('.dialogue-card');
  cards.forEach((c, idx) => {
    if (idx === activeIndex) {
      c.classList.add('is-active');
      c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      c.classList.remove('is-active', 'is-role-muted', 'is-repeat-waiting');
      const footer = document.getElementById(`footer-${idx}`);
      if (footer) footer.style.display = 'none';
    }
  });
}

function updateCardStatusUI(index, type, curTimeOrElapsed) {
  const card = document.getElementById(`card-${index}`);
  const footer = document.getElementById(`footer-${index}`);
  const badge = document.getElementById(`badge-${index}`);
  const fill = document.getElementById(`fill-${index}`);
  if (!card || !footer || !badge || !fill) return;

  const seg = subtitles[index];
  if (!seg) return;

  footer.style.display = 'flex';

  if (type === 'speaking-a' || type === 'speaking-b') {
    // User speaking turn (muted)
    card.classList.add('is-role-muted');
    card.classList.remove('is-repeat-waiting');
    const roleName = type === 'speaking-a' ? 'A' : 'B';
    const remaining = Math.max(0, seg.end - curTimeOrElapsed);
    badge.className = 'status-badge-live status-badge-speaking';
    badge.innerHTML = `🗣️ ${roleName} 말하기 (${remaining.toFixed(1)}s)`;

    fill.className = 'bubble-progress-fill fill-speaking';
    const pct = Math.min(100, Math.max(0, ((curTimeOrElapsed - seg.start) / seg.duration) * 100));
    fill.style.width = `${pct}%`;
  } else if (type === 'listening-a' || type === 'listening-b' || type === 'normal-listening') {
    // Listening partner's turn (or normal listening)
    card.classList.remove('is-role-muted', 'is-repeat-waiting');
    badge.className = 'status-badge-live status-badge-listening';
    const partner = type === 'listening-a' ? 'A' : (type === 'listening-b' ? 'B' : '');
    badge.innerHTML = `
      <div class="sound-wave-icon"><span></span><span></span><span></span></div>
      <span>${partner ? partner + ' ' : ''}듣는 중</span>
    `;

    fill.className = 'bubble-progress-fill';
    const pct = Math.min(100, Math.max(0, ((curTimeOrElapsed - seg.start) / seg.duration) * 100));
    fill.style.width = `${pct}%`;
  } else if (type === 'speak-wait' || type === 'speak-progress') {
    // In Listen & Speak wait delay
    card.classList.add('is-repeat-waiting');
    card.classList.remove('is-role-muted');
    const remaining = Math.max(0, repeatDurationTotal - curTimeOrElapsed);
    badge.className = 'status-badge-live status-badge-repeat';
    badge.innerHTML = `🗣️ 따라 말하기 (${remaining.toFixed(1)}s)`;

    fill.className = 'bubble-progress-fill fill-repeat';
    const pct = Math.min(100, Math.max(0, (curTimeOrElapsed / repeatDurationTotal) * 100));
    fill.style.width = `${pct}%`;
  }
}

function clearCardStatusUI(index) {
  const card = document.getElementById(`card-${index}`);
  const footer = document.getElementById(`footer-${index}`);
  if (card) {
    card.classList.remove('is-role-muted', 'is-repeat-waiting');
  }
  if (footer) {
    footer.style.display = 'none';
  }
}

// ── Manual Speaker Toggle (A ↔ B) ──
function toggleSpeaker(index) {
  if (!subtitles[index]) return;
  subtitles[index].speaker = (subtitles[index].speaker === 'A') ? 'B' : 'A';
  saveStateToStorage();
  renderDialogueList();
}

// ── Status Bar Updates ──
function updateStatusCounter() {
  if (!subtitles || subtitles.length === 0) {
    statusCounter.textContent = '- / -';
    return;
  }
  const curNum = (activeIndex >= 0) ? activeIndex + 1 : 1;
  statusCounter.textContent = `${curNum} / ${subtitles.length}`;
}

function updateStatusBanner(text) {
  fileStatusText.textContent = text;
  statusDot.classList.add('active');
}

function updateRepeatButtonUI() {
  btnRepeatToggle.classList.toggle('active', isRepeatEnabled);
  repeatToggleLabel.textContent = isRepeatEnabled ? '반복 켜짐' : '반복 꺼짐';
}

function updateModeSelectorUI(mode) {
  const buttons = modeSelector.querySelectorAll('.stage-btn');
  buttons.forEach(b => {
    if (b.id === 'btn-lang-toggle') return;

    if (b.id === 'btn-role-toggle') {
      const isRoleMode = (mode === 'role-a' || mode === 'role-b');
      b.classList.toggle('active', isRoleMode);
      updateRoleButtonUI();
    } else {
      b.classList.toggle('active', b.dataset.mode === mode);
    }
  });
}

function updateRoleButtonUI() {
  if (!btnRoleToggle || !roleStageName) return;
  // B 말하기 상태(기본값)일 때는 'A 말하기로', A 말하기 상태일 때는 'B 말하기로' 표시
  const targetRole = (activeRole === 'B') ? 'A' : 'B';
  roleStageName.textContent = `${targetRole} 말하기로`;
  btnRoleToggle.classList.toggle('is-role-a', activeRole === 'A');
  btnRoleToggle.title = `A/B 말하기 (현재 ${activeRole} 역할 진행 중, 터치 시 ${targetRole} 말하기로 전환)`;
}

// ── Subtitle Language Switcher ──
function setSubtitleLanguage(lang) {
  if (lang !== 'ko' && lang !== 'en') return;
  currentSubtitleLang = lang;
  updateLangButtonUI();
  updateDialogueBubbleTexts();
  saveStateToStorage();
}

function toggleSubtitleLanguage() {
  setSubtitleLanguage(currentSubtitleLang === 'ko' ? 'en' : 'ko');
}

function updateLangButtonUI() {
  const langToggleName = document.getElementById('lang-toggle-name');
  if (langToggleName) {
    // 한글 상태(기본값)일 때는 '영어로', 영문 상태일 때는 '한글로' 표시
    langToggleName.textContent = (currentSubtitleLang === 'ko') ? '영어로' : '한글로';
  }
  if (btnLangToggle) {
    btnLangToggle.dataset.lang = currentSubtitleLang;
    btnLangToggle.title = `자막 언어 전환 (터치 시 ${currentSubtitleLang === 'ko' ? '영어 자막으로' : '한글 자막으로'} 전환)`;
  }
}

function updateDialogueBubbleTexts() {
  subtitles.forEach((seg, idx) => {
    const textElem = document.getElementById(`text-${idx}`);
    if (textElem) {
      const displayText = (currentSubtitleLang === 'en') ? (seg.enText || seg.text) : (seg.koText || seg.text);
      textElem.textContent = displayText;
    }
  });
}

// ── Event Listeners Setup ──
function setupEventListeners() {
  // Repeat Toggle Button
  btnRepeatToggle.addEventListener('click', () => {
    isRepeatEnabled = !isRepeatEnabled;
    updateRepeatButtonUI();
    saveStateToStorage();
  });

  // Audio File Picker
  audioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check filename match with existing SRT file
    if (srtName && !isSampleFile(srtName) && subtitles.length > 0) {
      const audioBase = getBaseFileName(file.name);
      const srtBase = getBaseFileName(srtName);
      if (audioBase.toLowerCase() !== srtBase.toLowerCase()) {
        alert('음원 파일과 자막 파일이 다릅니다.');
        updateStatusBanner(`⚠️ 음원 파일과 자막 파일이 다릅니다. (음원: ${file.name}, 자막: ${srtName})`);
      }
    }

    audioBlob = file;
    audioName = file.name;
    const url = URL.createObjectURL(file);
    audioPlayer.src = url;

    await saveAudioToDB(file, file.name);
    saveStateToStorage();
    if (!fileStatusText.textContent.includes('⚠️')) {
      updateStatusBanner(`음원: ${file.name}`);
    }
    if (subtitles.length > 0) {
      jumpToSegment(0, false);
    }
  });

  // iOS Safari Compatibility:
  // iOS does not have a system UTI for .srt. If accept attribute is present without a matching UTI,
  // iOS Files app grays out .srt files. Removing accept on iOS guarantees .srt and .txt files are selectable.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    srtFileInput.removeAttribute('accept');
  }

  const ensureIOSAcceptRemoved = () => {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      srtFileInput.removeAttribute('accept');
    }
  };
  srtFileInput.addEventListener('pointerdown', ensureIOSAcceptRemoved);
  srtFileInput.addEventListener('click', ensureIOSAcceptRemoved);

  // SRT / TXT Subtitle File Picker
  srtFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Check filename match with existing Audio file
    if (audioName && !isSampleFile(audioName)) {
      const srtBase = getBaseFileName(file.name);
      const audioBase = getBaseFileName(audioName);
      if (srtBase.toLowerCase() !== audioBase.toLowerCase()) {
        alert('음원 파일과 자막 파일이 다릅니다.');
        updateStatusBanner(`⚠️ 음원 파일과 자막 파일이 다릅니다. (자막: ${file.name}, 음원: ${audioName})`);
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseSRT(text);
      if (parsed.length > 0) {
        subtitles = parsed;
        srtName = file.name;
        activeIndex = 0;
        targetIndex = Math.min(1, subtitles.length - 1);
        saveStateToStorage();
        renderDialogueList();
        if (!fileStatusText.textContent.includes('⚠️')) {
          updateStatusBanner(`자막: ${file.name} (${parsed.length}개 구간)`);
        }
      } else {
        alert('유효한 자막 형식(SRT 또는 TXT)을 찾을 수 없습니다.');
      }
    };
    reader.readAsText(file);
  });

  // Empty State Sample Button
  if (btnEmptySample) {
    btnEmptySample.addEventListener('click', () => loadSampleDialogue());
  }

  // Reset Button
  btnReset.addEventListener('click', async () => {
    if (confirm('저장된 대화 자막과 음원 데이터를 모두 초기화하시겠습니까?')) {
      cancelRepeatWait();
      cancelCueCountdown();
      await clearAudioFromDB();
      localStorage.removeItem('dialogue_app_state_v2');
      audioPlayer.pause();
      audioPlayer.src = '';
      subtitles = [];
      activeIndex = -1;
      targetIndex = 0;
      audioBlob = null;
      audioName = '';
      srtName = '';
      currentSubtitleLang = 'ko';
      activeRole = 'B';
      updateRoleButtonUI();
      updateLangButtonUI();
      updateModeSelectorUI('shadowing');
      statusDot.classList.remove('active');
      fileStatusText.textContent = '음원과 SRT 자막을 불러와 학습을 시작하세요';
      renderDialogueList();
    }
  });

  // Guide Modal
  if (btnGuide) btnGuide.addEventListener('click', () => { guideModal.style.display = 'flex'; });
  if (guideModalClose) guideModalClose.addEventListener('click', () => { guideModal.style.display = 'none'; });
  if (guideModal) {
    guideModal.addEventListener('click', (e) => {
      if (e.target === guideModal) guideModal.style.display = 'none';
    });
  }

  // Speed Select
  speedSelect.addEventListener('change', (e) => {
    setSpeedSelectValue(e.target.value);
    saveStateToStorage();
  });

  // Mode Selector (5 Stages + Language Toggle)
  modeSelector.addEventListener('click', (e) => {
    // 1. Language Toggle button clicked ('영어로' / '한글로')
    const langBtn = e.target.closest('#btn-lang-toggle');
    if (langBtn) {
      toggleSubtitleLanguage();
      return;
    }

    const btn = e.target.closest('.stage-btn');
    if (!btn) return;

    // 2. Role Toggle button clicked (Stage 5)
    if (btn.id === 'btn-role-toggle') {
      cancelRepeatWait();
      cancelCueCountdown();

      // 버튼에 표시된 대상('A 말하기로' or 'B 말하기로')으로 역할 전환 및 시작
      activeRole = (activeRole === 'B') ? 'A' : 'B';
      currentMode = (activeRole === 'B') ? 'role-b' : 'role-a';
      updateModeSelectorUI(currentMode);
      saveStateToStorage();

      // Start role-play playback with countdown cue if applicable
      const roleSpeaker = activeRole;
      if (subtitles.length > 0 && subtitles[0].speaker === roleSpeaker) {
        startStartingCueCountdown(() => {
          jumpToSegment(0, true);
        });
      } else {
        jumpToSegment(0, true);
      }
      return;
    }

    // 3. Other stage buttons (1, 2, 3, 4)
    const mode = btn.dataset.mode;
    if (!mode || mode === currentMode) return;

    cancelRepeatWait();
    cancelCueCountdown();
    currentMode = mode;
    updateModeSelectorUI(mode);
    saveStateToStorage();

    if (currentMode === 'from-prev') {
      const startIdx = Math.max(0, targetIndex - 1);
      jumpToSegment(startIdx, true);
    } else if (currentMode === 'from-start') {
      jumpToSegment(0, true);
    } else {
      // 섀도잉 / 듣고 말하기: start at activeIndex
      if (activeIndex === -1) activeIndex = 0;
      jumpToSegment(activeIndex, true);
    }
  });

  // Prevent iOS pull-to-refresh & rubber-band bouncing when dragging on header/menu area
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest('.dialogue-feed') || e.target.closest('.modal-body')) {
      return; // Allow natural scrolling inside the dialogue feed and modal dialogs
    }
    e.preventDefault();
  }, { passive: false });
}

// ── Sample Dialogue Fallback Loader ──
function loadSampleDialogue() {
  subtitles = parseSRT(SAMPLE_DIALOGUE_SRT);
  srtName = "샘플 일상 대화 (8개 구간)";
  activeIndex = 0;
  targetIndex = 1;

  try {
    const demoAudioBlob = createSyntheticAudioForDialogue(subtitles);
    if (demoAudioBlob) {
      audioBlob = demoAudioBlob;
      audioName = "샘플 대화 음원";
      audioPlayer.src = URL.createObjectURL(demoAudioBlob);
      saveAudioToDB(demoAudioBlob, audioName);
    }
  } catch (e) {
    console.warn('Synthetic audio creation failed:', e);
  }

  saveStateToStorage();
  updateLangButtonUI();
  updateRoleButtonUI();
  renderDialogueList();
  updateStatusBanner(`샘플 대화 로드됨: ${srtName}`);
  jumpToSegment(0, false);
}

// ── Media Session API ──
function setupMediaSession() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      audioPlayer.play();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audioPlayer.pause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (activeIndex > 0) handleSegmentTouch(activeIndex - 1);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (activeIndex < subtitles.length - 1) handleSegmentTouch(activeIndex + 1);
    });
  }
}

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
