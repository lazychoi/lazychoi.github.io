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

// Learning Modes: 'shadowing' | 'listen-speak' | 'from-prev' | 'from-start' | 'role-a' | 'role-b' | 'custom-range'
let currentMode = 'shadowing';
let rangeStartIdx = 0;           // Start segment for 'custom-range' (triple-tap gesture)
let activeRole = 'B';            // Active role for stage 5 ('B' | 'A')
let currentSubtitleLang = 'ko';  // Current subtitle language ('ko' | 'en') - Default: 'ko'
let isRepeatEnabled = false;     // Repeat toggle state (false: 1회/연속, true: 무한 반복)
let playbackSpeed = 1.0;

// ── 사용자 발화 시간 배율 설정 (말하기 시간 조절) ──
// 실제 원어민 문장 길이 대비 몇 배의 시간을 제공할지 설정합니다.
// - 2.0 : 실제 문장 길이의 2배 (기본값: 초보자/학습자가 여유있게 말하기)
// - 1.0 : 실제 문장 길이와 동일 (나중에 실력이 늘어 원어민 속도로 연습할 때 이 값을 1.0으로 변경)
const USER_SPEAKING_DURATION_RATIO = 1.5;

// Internal Flags & Timers
let isRepeatWaiting = false;     // Flag during 'listen-speak' wait countdown
let repeatTimerId = null;
let repeatTimerEnd = 0;
let repeatDurationTotal = 0;
let isCueCountingDown = false;   // Flag during 3, 2, 1, 삐 countdown
let cueTimeoutId = null;
let wakeLock = null;
let animationFrameId = null;

// Speech Recognition (STT) State
let sttRecognition = null;
let isSTTEnabled = localStorage.getItem('dialogue_stt_enabled') !== 'false';
let isSTTListening = false;
let currentSTTTranscript = '';
let activeSTTIndex = -1;
let sttAnimFrameId = null;
let isSingleRetryTurn = false;
let isWeakPracticeOnly = false;
let weakIndices = [];
let weakPracticePos = 0;

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
const btnSTTToggle = document.getElementById('btn-stt-toggle');
const sttToggleLabel = document.getElementById('stt-toggle-label');

// Roleplay Summary Modal Elements
const roleplaySummaryModal = document.getElementById('roleplay-summary-modal');
const summaryModalClose = document.getElementById('summary-modal-close');
const summaryAvgScore = document.getElementById('summary-avg-score');
const summaryScoreCircle = document.getElementById('summary-score-circle');
const summaryScoreTitle = document.getElementById('summary-score-title');
const summaryScoreDesc = document.getElementById('summary-score-desc');
const summaryTurnCount = document.getElementById('summary-turn-count');
const summarySentencesList = document.getElementById('summary-sentences-list');
const btnSummaryRetryWeak = document.getElementById('btn-summary-retry-weak');
const btnSummaryRestart = document.getElementById('btn-summary-restart');
const btnSummaryClose = document.getElementById('btn-summary-close');

// ── Built-in Realistic Everyday Dialogue Sample (Bilingual: Korean | English) ──
const SAMPLE_DIALOGUE_SRT = `1
00:00:00,500 --> 00:00:03,800
A: 안녕 사라, 만나서 반가워! 이번 주 어땠어?|Hi Sarah, good to see you! How has your week been?

2
00:00:04,200 --> 00:00:08,100
B: 안녕 존! 꽤 바빴지만, 다 잘 되어가고 있어.|Hey John! It's been pretty busy, but everything is going well.

3
00:00:08,500 --> 00:00:12,300
A: 금요일 마케팅 발표 준비는 아직 하고 있어?|Are you still working on that marketing presentation for Friday?

4
00:00:12,700 --> 00:00:16,900
B: 응, 오늘 아침에 최종 초안을 막 마쳤어. 너는 어때?|Yes, I just finished the final draft this morning. What about you?

5
00:00:17,400 --> 00:00:21,200
A: 분기 예산 보고서 거의 다 끝나가.|I'm almost done with the quarterly budget report.

6
00:00:21,700 --> 00:00:25,500
B: 일이 정말 많았겠네. 나중에 커피 한잔할래?|That sounds like a lot of work. Do you want to grab coffee later?

7
00:00:26,000 --> 00:00:29,600
A: 좋지! 두 시쯤에 만나는 거 어때?|That would be great! How about meeting around two o'clock?

8
00:00:30,100 --> 00:00:33,800
B: 두 시 딱 좋아. 카페에서 보자!|Two o'clock works perfectly for me. See you at the cafe!`;

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
  initSTT();
  updateSTTButtonUI();
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
    targetIndex,
    rangeStartIdx
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
        if (currentMode === 'role-a') {
          activeRole = 'A';
        } else if (currentMode === 'role-b') {
          activeRole = 'B';
        } else {
          activeRole = state.activeRole || 'B';
          subtitles.forEach(s => {
            delete s.lastScore;
            delete s.lastSpoken;
            delete s.lastDiff;
          });
        }
        currentSubtitleLang = state.currentSubtitleLang || 'ko';
        isRepeatEnabled = !!state.isRepeatEnabled;
        playbackSpeed = state.playbackSpeed || 1.0;
        targetIndex = state.targetIndex || 0;
        rangeStartIdx = state.rangeStartIdx || 0;
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

    // Split Korean and English by '|' (Format: '한글|영어')
    let koText = cleanSentence;
    let enText = cleanSentence;
    if (cleanSentence.includes('|')) {
      const pIdx = cleanSentence.indexOf('|');
      koText = cleanSentence.substring(0, pIdx).trim();
      enText = cleanSentence.substring(pIdx + 1).trim();

      const koSpeakerMatch = koText.match(/^(?:\[(A|B)\]|\((A|B)\)|(A|B)\s*:|(Speaker\s*1|Person\s*1)\s*:|(Speaker\s*2|Person\s*2)\s*:)\s*(.*)$/i);
      if (koSpeakerMatch) {
        koText = (koSpeakerMatch[6] || '').trim();
      }

      const enSpeakerMatch = enText.match(/^(?:\[(A|B)\]|\((A|B)\)|(A|B)\s*:|(Speaker\s*1|Person\s*1)\s*:|(Speaker\s*2|Person\s*2)\s*:)\s*(.*)$/i);
      if (enSpeakerMatch) {
        enText = (enSpeakerMatch[6] || '').trim();
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

    let koText = cleanSentence;
    let enText = cleanSentence;
    if (cleanSentence.includes('|')) {
      const pIdx = cleanSentence.indexOf('|');
      koText = cleanSentence.substring(0, pIdx).trim();
      enText = cleanSentence.substring(pIdx + 1).trim();

      const koSpeakerMatch = koText.match(/^(?:\[(A|B)\]|\((A|B)\)|(A|B)\s*:|(Speaker\s*1|Person\s*1)\s*:|(Speaker\s*2|Person\s*2)\s*:)\s*(.*)$/i);
      if (koSpeakerMatch) {
        koText = (koSpeakerMatch[6] || '').trim();
      }

      const enSpeakerMatch = enText.match(/^(?:\[(A|B)\]|\((A|B)\)|(A|B)\s*:|(Speaker\s*1|Person\s*1)\s*:|(Speaker\s*2|Person\s*2)\s*:)\s*(.*)$/i);
      if (enSpeakerMatch) {
        enText = (enSpeakerMatch[6] || '').trim();
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
      // 직전 구간(targetIndex - 1) 끝남 -> 현재 구간(targetIndex)으로 이동 (끊김 없는 연속 재생)
      advanceToSegmentSeamless(activeIndex + 1);
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
      // 다음 구간으로 진행 (음성 튐 없이 자연스럽게 연속 재생)
      advanceToSegmentSeamless(activeIndex + 1);
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

  // ── Custom Range: 특정 구간부터 암기중 구간까지 반복 (트리플탭 제스처) ──
  if (currentMode === 'custom-range') {
    const startIdx = Math.min(rangeStartIdx, targetIndex);
    const endIdx = Math.max(rangeStartIdx, targetIndex);

    if (activeIndex < endIdx) {
      // 다음 구간으로 연속 진행 (음성 튐 없이 매끄럽게 재생)
      advanceToSegmentSeamless(activeIndex + 1);
    } else {
      // 목표 구간(endIdx) 도달 완료
      if (isRepeatEnabled) {
        // 반복 ON: 지정한 시작 구간부터 다시 무한 반복
        jumpToSegment(startIdx, true);
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
      if (isSTTEnabled) {
        stopAudioPlayback();
        cancelCueCountdown();
        setTimeout(() => showRoleplaySummaryModal(), 600);
        return; // 채점 ON 상태에서는 평가 모달을 띄우고 배경에서 자동 반복하지 않음
      }
      if (isRepeatEnabled) {
        // A 말하기 상태에서 반복 켜짐 시, 매 반복 시작 전에 시작 신호음 카운트다운(3, 2, 1, 시작!) 재생
        if (subtitles.length > 0 && subtitles[0].speaker === 'A') {
          audioPlayer.pause();
          startStartingCueCountdown(() => {
            jumpToSegment(0, true);
          });
        } else {
          jumpToSegment(0, true);
        }
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
      if (isSTTEnabled) {
        stopAudioPlayback();
        cancelCueCountdown();
        setTimeout(() => showRoleplaySummaryModal(), 600);
        return; // 채점 ON 상태에서는 평가 모달을 띄우고 배경에서 자동 반복하지 않음
      }
      if (isRepeatEnabled) {
        if (subtitles.length > 0 && subtitles[0].speaker === 'B') {
          audioPlayer.pause();
          startStartingCueCountdown(() => {
            jumpToSegment(0, true);
          });
        } else {
          jumpToSegment(0, true);
        }
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

  const speakDurationSec = Math.max(1.5, (seg.duration * USER_SPEAKING_DURATION_RATIO) / audioPlayer.playbackRate);
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
    if (activeSTTIndex !== -1) {
      cancelSTTTurn();
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
  cancelSTTTurn();

  if (currentMode === 'custom-range') {
    // 구간 반복 모드: 해당 구간으로 점프하여 재생하되 암기중 목표(targetIndex)와 반복 범위는 유지
    jumpToSegment(index, true);
    const s = Math.min(rangeStartIdx, targetIndex) + 1;
    const e = Math.max(rangeStartIdx, targetIndex) + 1;
    updateStatusBanner(`구간 반복 (${s}번 ~ 암기중 ${e}번 문장)`);
    return;
  }

  targetIndex = index;
  saveStateToStorage();

  if (currentMode === 'from-prev') {
    // 직전 구간부터 듣기: index - 1부터 시작 (index가 암기중 목표 구간)
    const startIdx = Math.max(0, index - 1);
    jumpToSegment(startIdx, true);
    updateStatusBanner(`직전 구간부터 (암기중: ${targetIndex + 1}번 문장)`);
  } else if (currentMode === 'from-start') {
    // 처음부터 현재까지: 0부터 시작하여 index까지 (index가 암기중 목표 구간)
    jumpToSegment(0, true);
    updateStatusBanner(`처음~현재 (1번 ~ 암기중 ${targetIndex + 1}번 문장)`);
  } else {
    // 섀도잉, 듣고 말하기, A/B 말하기: 해당 구간으로 점프
    if (currentMode === 'role-a' && index === 0 && subtitles[0] && subtitles[0].speaker === 'A') {
      audioPlayer.pause();
      startStartingCueCountdown(() => {
        jumpToSegment(0, true);
      });
    } else {
      jumpToSegment(index, true);
    }
  }
}

function jumpToSegment(index, autoPlay = true) {
  if (index < 0 || index >= subtitles.length) return;
  cancelRepeatWait();
  cancelSTTTurn();

  activeIndex = index;
  const seg = subtitles[index];

  // Set audio time
  audioPlayer.currentTime = seg.start;

  // Check if role-play user speaking turn
  const isUserTurnInRoleplay = (currentMode === 'role-a' && seg.speaker === 'A') || 
                               (currentMode === 'role-b' && seg.speaker === 'B');

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
    if (isUserTurnInRoleplay && isSTTEnabled && isSTTSupported() && sttRecognition) {
      audioPlayer.pause();
      startRoleSTTTurn(seg, index);
      return;
    }
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

// Seamlessly transition active card in continuous range without touching audio playback
function advanceToSegmentSeamless(index) {
  if (index < 0 || index >= subtitles.length) return;
  cancelRepeatWait();
  activeIndex = index;
  updateActiveCardUI();
  updateStatusCounter();
  saveStateToStorage();
}

// ── Gesture Toast Notification & Direct Mode Switchers ──
let toastTimer = null;
function showGestureToast(message) {
  const toast = document.getElementById('gesture-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = 'flex';
  void toast.offsetWidth;
  toast.classList.add('show');
  if (navigator.vibrate) {
    try { navigator.vibrate(25); } catch {}
  }
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toast.style.display = 'none'; }, 250);
  }, 1300);
}

function switchToShadowingMode(index) {
  clearSTTFeedback();
  cancelRepeatWait();
  cancelCueCountdown();
  currentMode = 'shadowing';
  targetIndex = index;
  updateModeSelectorUI('shadowing');
  saveStateToStorage();
  jumpToSegment(index, true);
  showGestureToast('1️⃣ 섀도잉 모드로 전환');
}

function switchToListenSpeakMode(index) {
  clearSTTFeedback();
  cancelRepeatWait();
  cancelCueCountdown();
  currentMode = 'listen-speak';
  targetIndex = index;
  updateModeSelectorUI('listen-speak');
  saveStateToStorage();
  jumpToSegment(index, true);
  showGestureToast('2️⃣ 듣고 말하기 모드로 전환');
}

function switchToFromPrevMode(index) {
  clearSTTFeedback();
  cancelRepeatWait();
  cancelCueCountdown();
  currentMode = 'from-prev';
  targetIndex = index;
  updateModeSelectorUI('from-prev');
  saveStateToStorage();
  const startIdx = Math.max(0, index - 1);
  jumpToSegment(startIdx, true);
  showGestureToast(`3️⃣ 직전 구간부터 모드 (암기중: ${index + 1}번)`);
}

function switchToCustomRangeMode(index) {
  clearSTTFeedback();
  cancelRepeatWait();
  cancelCueCountdown();
  currentMode = 'custom-range';
  rangeStartIdx = index;

  // targetIndex가 유효하지 않으면 현재 activeIndex 또는 index로 지정
  if (targetIndex < 0 || targetIndex >= subtitles.length) {
    targetIndex = (activeIndex >= 0 && activeIndex < subtitles.length) ? activeIndex : index;
  }

  // 사용자 요청: "그 구간부터 암기중인 구간까지 반복되는 기능"에 따라 반복 기능 자동 활성화
  isRepeatEnabled = true;
  updateRepeatButtonUI();

  updateModeSelectorUI('custom-range');
  saveStateToStorage();

  const startIdx = Math.min(rangeStartIdx, targetIndex);
  const endIdx = Math.max(rangeStartIdx, targetIndex);

  jumpToSegment(startIdx, true);
  updateStatusBanner(`구간 반복 (${startIdx + 1}번 ~ 암기중 ${endIdx + 1}번 문장)`);
  showGestureToast(`🔁 구간 반복: ${startIdx + 1}번 ~ ${endIdx + 1}번 문장`);
}

function setRoleMode(role) {
  clearSTTFeedback();
  cancelRepeatWait();
  cancelCueCountdown();
  cancelSTTTurn();
  isWeakPracticeOnly = false;
  activeRole = role;
  currentMode = (role === 'B') ? 'role-b' : 'role-a';
  updateRoleButtonUI();
  updateModeSelectorUI(currentMode);
  saveStateToStorage();

  if (role === 'B') {
    updateStatusBanner(`B 말하기 (내 역할: B 대사 따라 말하기 / 상대방 A 청취)`);
    showGestureToast('5️⃣ B 말하기 모드 시작');
  } else {
    updateStatusBanner(`A 말하기 (내 역할: A 대사 따라 말하기 / 상대방 B 청취)`);
    showGestureToast('5️⃣ A 말하기 모드 시작');
  }

  // 1번 문장이 내가 말할 차례이면 시작 신호음(3, 2, 1, 시작!) 재생
  const roleSpeaker = activeRole;
  if (subtitles.length > 0 && subtitles[0].speaker === roleSpeaker) {
    audioPlayer.pause();
    startStartingCueCountdown(() => {
      jumpToSegment(0, true);
    });
  } else {
    jumpToSegment(0, true);
  }
}

function stopAudioPlayback() {
  audioPlayer.pause();
  cancelRepeatWait();
  cancelCueCountdown();
  cancelSTTTurn();
  if (subtitles[0]) {
    audioPlayer.currentTime = subtitles[0].start;
  }
  updateStatusCounter();
}

function handlePlaybackEnded() {
  cancelRepeatWait();
  cancelSTTTurn();
  stopAudioPlayback();
}

// ── Text Normalization & Speech Evaluation Algorithm ──
function expandContractions(str) {
  if (!str) return '';
  return str
    .replace(/\bi'm\b/gi, 'i am')
    .replace(/\bit's\b/gi, 'it is')
    .replace(/\bdon't\b/gi, 'do not')
    .replace(/\bcan't\b/gi, 'cannot')
    .replace(/\bwon't\b/gi, 'will not')
    .replace(/\byou're\b/gi, 'you are')
    .replace(/\bwe're\b/gi, 'we are')
    .replace(/\bthey're\b/gi, 'they are')
    .replace(/\bthat's\b/gi, 'that is')
    .replace(/\bwhat's\b/gi, 'what is')
    .replace(/\bthere's\b/gi, 'there is')
    .replace(/\blet's\b/gi, 'let us')
    .replace(/\bdidn't\b/gi, 'did not')
    .replace(/\bdoesn't\b/gi, 'does not')
    .replace(/\bisn't\b/gi, 'is not')
    .replace(/\baren't\b/gi, 'are not')
    .replace(/\bwasn't\b/gi, 'was not')
    .replace(/\bweren't\b/gi, 'were not')
    .replace(/\bhaven't\b/gi, 'have not')
    .replace(/\bhasn't\b/gi, 'has not')
    .replace(/\bcouldn't\b/gi, 'could not')
    .replace(/\bwouldn't\b/gi, 'would not')
    .replace(/\bshouldn't\b/gi, 'should not')
    .replace(/\bgonna\b/gi, 'going to')
    .replace(/\bwanna\b/gi, 'want to')
    .replace(/\bgotta\b/gi, 'got to')
    .replace(/\byeah\b/gi, 'yes')
    .replace(/\byep\b/gi, 'yes')
    .replace(/\bnope\b/gi, 'no');
}

const NUMBER_MAP = {
  "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
  "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten"
};

function cleanWordForCompare(w) {
  if (!w) return '';
  let cleaned = w.toLowerCase().replace(/[^a-z0-9']/g, '').trim();
  if (NUMBER_MAP[cleaned]) {
    cleaned = NUMBER_MAP[cleaned];
  }
  return cleaned;
}

function computeLevenshtein(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1) return s2.length;
  if (!s2) return s1.length;

  const d = [];
  for (let i = 0; i <= s1.length; i++) d[i] = [i];
  for (let j = 0; j <= s2.length; j++) d[0][j] = j;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = (s1[i - 1] === s2[j - 1]) ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[s1.length][s2.length];
}

function evaluateSpeechAccuracy(targetEnText, spokenText) {
  if (!targetEnText) return { score: 0, diffHtml: '', spokenText: '', matchedCount: 0, totalWords: 0 };

  const rawTargetWords = targetEnText.trim().split(/\s+/).filter(w => w.length > 0);
  if (rawTargetWords.length === 0) return { score: 100, diffHtml: '', spokenText, matchedCount: 0, totalWords: 0 };

  // Expand contractions on spoken side
  const expandedSpoken = expandContractions(spokenText || '');
  const rawSpokenWords = expandedSpoken.trim().split(/\s+/).filter(w => w.length > 0);
  const spokenTokens = rawSpokenWords.map(cleanWordForCompare).filter(w => w.length > 0);

  const usedSpokenIndices = new Set();
  let correctCount = 0;
  let similarCount = 0;

  const wordResults = rawTargetWords.map((origWord) => {
    // Expand target contraction if any (e.g. "I'm" -> "i", "am")
    const expandedOrig = expandContractions(origWord);
    const subWords = expandedOrig.split(/\s+/).map(cleanWordForCompare).filter(w => w.length > 0);

    if (subWords.length === 0) {
      return { orig: origWord, status: 'correct' };
    }

    let allSubMatched = true;
    let anySimilar = false;

    for (let sub of subWords) {
      let foundIdx = -1;
      for (let i = 0; i < spokenTokens.length; i++) {
        if (!usedSpokenIndices.has(i) && spokenTokens[i] === sub) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx !== -1) {
        usedSpokenIndices.add(foundIdx);
        continue;
      }

      // Try Fuzzy match (Levenshtein)
      let bestDist = 999;
      let bestIdx = -1;
      for (let i = 0; i < spokenTokens.length; i++) {
        if (!usedSpokenIndices.has(i)) {
          const dist = computeLevenshtein(sub, spokenTokens[i]);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        }
      }

      const threshold = sub.length >= 7 ? 2 : (sub.length >= 4 ? 1 : 0);
      if (bestIdx !== -1 && bestDist <= threshold && bestDist > 0) {
        usedSpokenIndices.add(bestIdx);
        anySimilar = true;
        continue;
      }

      allSubMatched = false;
      break;
    }

    if (allSubMatched) {
      if (anySimilar) {
        similarCount++;
        return { orig: origWord, status: 'similar' };
      } else {
        correctCount++;
        return { orig: origWord, status: 'correct' };
      }
    }

    return { orig: origWord, status: 'missed' };
  });

  const totalWords = rawTargetWords.length;
  const rawScore = ((correctCount * 1.0 + similarCount * 0.7) / totalWords) * 100;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  const diffHtml = wordResults.map(item => {
    let cls = 'diff-word-correct';
    if (item.status === 'similar') cls = 'diff-word-similar';
    else if (item.status === 'missed') cls = 'diff-word-missed';
    return `<span class="diff-word ${cls}">${escapeHTML(item.orig)}</span>`;
  }).join(' ');

  return {
    score,
    diffHtml,
    spokenText: spokenText || '(음성 감지되지 않음)',
    matchedCount: correctCount,
    totalWords
  };
}

function getScoreBadgeClass(score) {
  if (score >= 90) return 'score-perfect';
  if (score >= 70) return 'score-good';
  return 'score-try';
}

function getScoreBadgeLabel(score) {
  if (score >= 90) return `🌟 ${score}% Perfect!`;
  if (score >= 70) return `👍 ${score}% Good`;
  return `⚠️ ${score}% Try Again`;
}

// ── Web Speech API (STT) Controller ──
function isSTTSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function initSTT() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('SpeechRecognition not supported or disabled due to insecure HTTP context.');
    isSTTEnabled = false;
    updateSTTButtonUI();
    return;
  }

  try {
    sttRecognition = new SpeechRecognition();
    sttRecognition.lang = 'en-US';
    sttRecognition.interimResults = true;
    sttRecognition.continuous = false;
    sttRecognition.maxAlternatives = 1;

    sttRecognition.onstart = () => {
      isSTTListening = true;
    };

    sttRecognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const text = (final || interim).trim();
      if (text) {
        currentSTTTranscript = text;
        if (activeSTTIndex !== -1) {
          const liveText = document.getElementById(`stt-live-text-${activeSTTIndex}`);
          if (liveText) {
            liveText.textContent = `"${text}"`;
          }
        }
      }
    };

    sttRecognition.onerror = (event) => {
      console.warn('STT error:', event.error);
      if (event.error === 'not-allowed') {
        showGestureToast('⚠️ 마이크 권한이 필요합니다');
      }
      isSTTListening = false;
    };

    sttRecognition.onend = () => {
      isSTTListening = false;
    };
  } catch (err) {
    console.error('Failed to init SpeechRecognition:', err);
    sttRecognition = null;
    isSTTEnabled = false;
  }
  updateSTTButtonUI();
}

function startSpeechRecognition() {
  if (!sttRecognition || !isSTTEnabled) return;
  try {
    sttRecognition.start();
  } catch (e) {
    // Already running or aborted
  }
}

function stopSpeechRecognition() {
  if (!sttRecognition) return;
  try {
    sttRecognition.stop();
  } catch (e) {}
  isSTTListening = false;
}

function toggleSTT() {
  if (!isSTTSupported()) {
    if (!window.isSecureContext) {
      alert('⚠️ 마이크 권한 요청이 나오지 않는 이유:\n\n' +
            '애플(Safari) 및 구글(Chrome)의 보안 정책상 마이크(음성 인식) 기능은 HTTPS 보안 연결(예: GitHub Pages https://lazychoi.github.io) 또는 localhost에서만 허용됩니다.\n\n' +
            '현재 접속하신 주소(' + location.host + ')는 일반 HTTP 사설 IP 주소여서 브라우저가 마이크 권한 팝업 자체를 차단했습니다.\n\n' +
            '👉 해결 방법: GitHub Pages(https://lazychoi.github.io)로 접속하시거나 HTTPS 연결을 사용해 주세요.');
      return;
    }
    alert('현재 브라우저에서는 음성 인식을 지원하지 않습니다. (iOS Safari 또는 Chrome을 권장합니다)');
    return;
  }
  isSTTEnabled = !isSTTEnabled;
  localStorage.setItem('dialogue_stt_enabled', isSTTEnabled ? 'true' : 'false');
  updateSTTButtonUI();
  showGestureToast(isSTTEnabled ? '🎙️ 실시간 채점 ON' : '🔇 실시간 채점 OFF (무음 모드)');
}

function updateSTTButtonUI() {
  const btn = document.getElementById('btn-stt-toggle');
  const label = document.getElementById('stt-toggle-label');
  if (!btn || !label) return;

  if (!isSTTSupported()) {
    btn.classList.remove('active');
    btn.style.opacity = '0.6';
    if (!window.isSecureContext) {
      label.textContent = '🎙️ HTTPS 필요';
      btn.title = '마이크 기능은 HTTPS 보안 연결에서만 활성화됩니다';
    } else {
      label.textContent = '🎙️ 미지원';
      btn.title = '이 브라우저는 Web Speech API를 지원하지 않습니다';
    }
    return;
  }

  btn.style.opacity = '1';
  btn.classList.toggle('active', isSTTEnabled);
  label.textContent = isSTTEnabled ? '🎙️ 채점 ON' : '🔇 채점 OFF';
  btn.title = isSTTEnabled ? '실시간 음성인식 채점 켜짐 (클릭 시 끄기)' : '실시간 음성인식 채점 꺼짐 (클릭 시 켜기)';
}

// ── Roleplay STT Turn Lifecycle ──
function startRoleSTTTurn(seg, index, isSingleRetry = false) {
  cancelRepeatWait();
  cancelSTTTurn();

  isSingleRetryTurn = isSingleRetry;
  activeSTTIndex = index;
  activeIndex = index;
  currentSTTTranscript = '';

  updateActiveCardUI();
  updateStatusCounter();

  const card = document.getElementById(`card-${index}`);
  const liveBox = document.getElementById(`stt-live-box-${index}`);
  const liveText = document.getElementById(`stt-live-text-${index}`);
  const feedbackBox = document.getElementById(`stt-feedback-${index}`);

  if (card) {
    card.classList.add('is-stt-listening');
  }
  if (liveBox) {
    liveBox.style.display = 'block';
  }
  if (liveText) {
    liveText.textContent = '말씀해 주세요...';
  }
  if (feedbackBox && !isSingleRetry) {
    feedbackBox.style.display = 'none';
  }

  playTurnChime();
  startSpeechRecognition();

  const speakDurationSec = Math.max(3.0, (seg.duration * USER_SPEAKING_DURATION_RATIO) / playbackSpeed);
  repeatDurationTotal = speakDurationSec;
  const startTime = performance.now();
  repeatTimerEnd = startTime + (speakDurationSec * 1000);

  updateCardStatusUI(index, (activeRole === 'A' ? 'speaking-a' : 'speaking-b'), 0);

  function sttCountdownStep() {
    if (activeSTTIndex !== index) return;
    const now = performance.now();
    const remainingMs = Math.max(0, repeatTimerEnd - now);
    const elapsedSec = (repeatDurationTotal * 1000 - remainingMs) / 1000;

    updateCardStatusUI(index, (activeRole === 'A' ? 'speaking-a' : 'speaking-b'), elapsedSec);

    if (remainingMs <= 20) {
      finishRoleSTTTurn(index, isSingleRetry);
    } else {
      sttAnimFrameId = requestAnimationFrame(sttCountdownStep);
    }
  }

  sttAnimFrameId = requestAnimationFrame(sttCountdownStep);
}

function finishRoleSTTTurn(index, isSingleRetry) {
  if (sttAnimFrameId) {
    cancelAnimationFrame(sttAnimFrameId);
    sttAnimFrameId = null;
  }

  stopSpeechRecognition();

  const seg = subtitles[index];
  if (!seg) return;

  const card = document.getElementById(`card-${index}`);
  const liveBox = document.getElementById(`stt-live-box-${index}`);
  if (card) {
    card.classList.remove('is-stt-listening');
  }
  if (liveBox) {
    liveBox.style.display = 'none';
  }
  clearCardStatusUI(index);

  const targetText = seg.enText || seg.text;
  const evalResult = evaluateSpeechAccuracy(targetText, currentSTTTranscript);

  seg.lastScore = evalResult.score;
  seg.lastSpoken = evalResult.spokenText;
  seg.lastDiff = evalResult.diffHtml;
  saveStateToStorage();

  updateCardSTTResultUI(index, evalResult);

  if (evalResult.score >= 90) {
    playTone(1046.5, 200, 'triangle');
  } else if (evalResult.score >= 70) {
    playTone(784, 180, 'triangle');
  }

  if (isSingleRetry) {
    activeSTTIndex = -1;
    showGestureToast(`✨ 채점 완료: ${evalResult.score}%`);
    return;
  }

  activeSTTIndex = -1;

  if (isWeakPracticeOnly) {
    weakPracticePos++;
    if (weakPracticePos < weakIndices.length) {
      setTimeout(() => {
        jumpToSegment(weakIndices[weakPracticePos], true);
      }, 700);
    } else {
      isWeakPracticeOnly = false;
      setTimeout(() => {
        showRoleplaySummaryModal();
      }, 800);
    }
    return;
  }

  if (index < subtitles.length - 1) {
    setTimeout(() => {
      advanceToSegment(index + 1);
    }, 700);
  } else {
    stopAudioPlayback();
    cancelCueCountdown();
    setTimeout(() => {
      showRoleplaySummaryModal();
    }, 800);
  }
}

function cancelSTTTurn() {
  if (sttAnimFrameId) {
    cancelAnimationFrame(sttAnimFrameId);
    sttAnimFrameId = null;
  }
  if (activeSTTIndex !== -1) {
    const card = document.getElementById(`card-${activeSTTIndex}`);
    const liveBox = document.getElementById(`stt-live-box-${activeSTTIndex}`);
    if (card) card.classList.remove('is-stt-listening');
    if (liveBox) liveBox.style.display = 'none';
    clearCardStatusUI(activeSTTIndex);
    activeSTTIndex = -1;
  }
  stopSpeechRecognition();
}

function updateCardSTTResultUI(index, evalResult) {
  const headerBadge = document.getElementById(`score-badge-${index}`);
  const feedbackBox = document.getElementById(`stt-feedback-${index}`);
  const diffBox = document.getElementById(`stt-diff-${index}`);
  const spokenBox = document.getElementById(`stt-spoken-${index}`);

  if (headerBadge) {
    headerBadge.className = `stt-score-badge ${getScoreBadgeClass(evalResult.score)}`;
    headerBadge.textContent = getScoreBadgeLabel(evalResult.score);
    headerBadge.style.display = 'inline-flex';
  }

  if (feedbackBox) {
    feedbackBox.style.display = 'flex';
  }
  if (diffBox) {
    diffBox.innerHTML = evalResult.diffHtml;
  }
  if (spokenBox) {
    spokenBox.textContent = `🗣️ 인식: "${evalResult.spokenText}"`;
  }
}

// ── Clear STT Feedback & Diff (모드 전환 시 초기화) ──
function clearSTTFeedback() {
  cancelSTTTurn();
  closeRoleplaySummaryModal();
  isWeakPracticeOnly = false;
  weakIndices = [];

  if (subtitles && subtitles.length > 0) {
    subtitles.forEach((seg, idx) => {
      delete seg.lastScore;
      delete seg.lastSpoken;
      delete seg.lastDiff;

      const headerBadge = document.getElementById(`score-badge-${idx}`);
      if (headerBadge) {
        headerBadge.className = 'stt-score-badge';
        headerBadge.textContent = '';
        headerBadge.style.display = 'none';
      }

      const feedbackBox = document.getElementById(`stt-feedback-${idx}`);
      if (feedbackBox) {
        feedbackBox.style.display = 'none';
      }

      const diffBox = document.getElementById(`stt-diff-${idx}`);
      if (diffBox) {
        diffBox.innerHTML = '';
      }

      const spokenBox = document.getElementById(`stt-spoken-${idx}`);
      if (spokenBox) {
        spokenBox.textContent = '';
      }

      const liveBox = document.getElementById(`stt-live-box-${idx}`);
      if (liveBox) {
        liveBox.style.display = 'none';
      }

      const liveText = document.getElementById(`stt-live-text-${idx}`);
      if (liveText) {
        liveText.textContent = '말씀해 주세요...';
      }

      const card = document.getElementById(`card-${idx}`);
      if (card) {
        card.classList.remove('is-stt-listening');
      }
    });
  }
  saveStateToStorage();
}

function retrySingleSegmentSTT(index) {
  if (index < 0 || index >= subtitles.length) return;
  const seg = subtitles[index];
  stopAudioPlayback();
  cancelRepeatWait();
  cancelCueCountdown();
  cancelSTTTurn();

  startRoleSTTTurn(seg, index, /* isSingleRetry = */ true);
}

// ── Roleplay Summary Modal ──
function showRoleplaySummaryModal() {
  stopAudioPlayback();
  cancelRepeatWait();
  cancelCueCountdown();
  cancelSTTTurn();

  const modal = document.getElementById('roleplay-summary-modal');
  if (!modal) return;

  const roleSegments = subtitles.filter(s => s.speaker === activeRole);
  if (roleSegments.length === 0) return;

  let totalScore = 0;
  let scoredCount = 0;
  let weakList = [];

  roleSegments.forEach((s) => {
    if (s.lastScore !== undefined) {
      totalScore += s.lastScore;
      scoredCount++;
      if (s.lastScore < 75) {
        weakList.push(s);
      }
    } else {
      weakList.push(s);
    }
  });

  const avgScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0;

  const scoreVal = document.getElementById('summary-avg-score');
  const scoreCircle = document.getElementById('summary-score-circle');
  const scoreTitle = document.getElementById('summary-score-title');
  const scoreDesc = document.getElementById('summary-score-desc');
  const turnCount = document.getElementById('summary-turn-count');
  const listContainer = document.getElementById('summary-sentences-list');
  const btnRetryWeak = document.getElementById('btn-summary-retry-weak');

  if (scoreVal) scoreVal.textContent = `${avgScore}%`;
  if (turnCount) turnCount.textContent = `${roleSegments.length}개 중 ${scoredCount}개 채점 완료`;

  if (scoreCircle) {
    if (avgScore >= 90) {
      scoreCircle.style.borderColor = '#10b981';
      if (scoreVal) scoreVal.style.color = '#047857';
    } else if (avgScore >= 70) {
      scoreCircle.style.borderColor = '#3b82f6';
      if (scoreVal) scoreVal.style.color = '#1d4ed8';
    } else {
      scoreCircle.style.borderColor = '#f43f5e';
      if (scoreVal) scoreVal.style.color = '#be123c';
    }
  }

  if (scoreTitle && scoreDesc) {
    if (avgScore >= 90) {
      scoreTitle.textContent = '🌟 완벽한 대화였습니다!';
      scoreDesc.textContent = `${activeRole} 역할의 대사를 원어민처럼 정확하게 발화했습니다.`;
    } else if (avgScore >= 70) {
      scoreTitle.textContent = '👍 훌륭합니다!';
      scoreDesc.textContent = '의미 전달이 원활합니다. 놓친 단어들을 확인해 보세요.';
    } else {
      scoreTitle.textContent = '⚠️ 조금 더 연습이 필요해요';
      scoreDesc.textContent = '누락되거나 부정확한 단어들을 집중적으로 복습해보세요.';
    }
  }

  if (btnRetryWeak) {
    btnRetryWeak.style.display = weakList.length > 0 ? 'block' : 'none';
    btnRetryWeak.textContent = `❌ 취약 문장 (${weakList.length}개) 다시 연습`;
  }

  if (listContainer) {
    listContainer.innerHTML = '';
    roleSegments.forEach((seg) => {
      const isWeak = (seg.lastScore === undefined || seg.lastScore < 75);
      const item = document.createElement('div');
      item.className = `summary-sentence-item ${isWeak ? 'is-weak' : ''}`;
      
      const score = seg.lastScore !== undefined ? seg.lastScore : 0;
      item.innerHTML = `
        <div class="summary-item-header">
          <span class="summary-item-speaker">${seg.speaker} 역할 (#${seg.index + 1})</span>
          <span class="stt-score-badge ${getScoreBadgeClass(score)}">${getScoreBadgeLabel(score)}</span>
        </div>
        <div class="summary-item-ko">${escapeHTML(seg.koText || '')}</div>
        <div class="stt-diff-words">${seg.lastDiff || `<span class="diff-word">${escapeHTML(seg.enText || seg.text)}</span>`}</div>
      `;
      listContainer.appendChild(item);
    });
  }

  modal.style.display = 'flex';
}

function closeRoleplaySummaryModal() {
  const modal = document.getElementById('roleplay-summary-modal');
  if (modal) modal.style.display = 'none';
}

function startWeakSentencesPractice() {
  weakIndices = [];
  subtitles.forEach((s, i) => {
    if (s.speaker === activeRole && (s.lastScore === undefined || s.lastScore < 75)) {
      weakIndices.push(i);
    }
  });

  if (weakIndices.length === 0) {
    showGestureToast('취약 문장이 없습니다! 👍');
    return;
  }

  isWeakPracticeOnly = true;
  weakPracticePos = 0;
  showGestureToast(`❌ 취약 ${weakIndices.length}개 문장 집중 연습 시작`);
  jumpToSegment(weakIndices[0], true);
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

    const isRoleplayMode = (currentMode === 'role-a' || currentMode === 'role-b');
    const hasScore = isRoleplayMode && (seg.lastScore !== undefined);
    const scoreClass = hasScore ? getScoreBadgeClass(seg.lastScore) : '';
    const scoreText = hasScore ? getScoreBadgeLabel(seg.lastScore) : '';

    card.innerHTML = `
      <div class="bubble-content" data-index="${idx}">
        <div class="bubble-header">
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <button class="speaker-badge-btn ${speakerColorClass}" data-index="${idx}" title="화자 변경 (A ↔ B)">
              <span>${seg.speaker}</span>
            </button>
            <span class="range-start-badge" id="start-badge-${idx}" style="display: none;">🔁 시작</span>
            <span class="target-segment-badge" id="target-badge-${idx}" style="display: none;">🎯 암기중</span>
          </div>
          <div style="display: inline-flex; align-items: center; gap: 8px;">
            <span class="stt-score-badge ${scoreClass}" id="score-badge-${idx}" style="${hasScore ? '' : 'display: none;'}">${scoreText}</span>
            <div class="bubble-time-info">
              <span>${formatTime(seg.start)} - ${formatTime(seg.end)}</span>
            </div>
          </div>
        </div>
        <div class="bubble-text" id="text-${idx}">
          ${escapeHTML(displayText)}
        </div>

        <!-- STT Live In-turn indicator -->
        <div class="stt-live-box" id="stt-live-box-${idx}" style="display: none;">
          <div class="stt-live-indicator">
            <span class="stt-mic-waves"><span></span><span></span><span></span><span></span></span>
            <span>듣고 있습니다...</span>
          </div>
          <div class="stt-live-transcript" id="stt-live-text-${idx}">말씀해 주세요...</div>
        </div>

        <!-- STT Feedback Result (Diff & Score) -->
        <div class="stt-feedback-container" id="stt-feedback-${idx}" style="${hasScore ? '' : 'display: none;'}">
          <div class="stt-diff-words" id="stt-diff-${idx}">
            ${seg.lastDiff || ''}
          </div>
          <div class="stt-spoken-sub" id="stt-spoken-${idx}">
            🗣️ 인식: "${escapeHTML(seg.lastSpoken || '')}"
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 2px;">
            <button class="btn-stt-retry" data-index="${idx}">
              <span>🔄</span><span>다시 말하기</span>
            </button>
          </div>
        </div>

        <div class="bubble-status-footer" id="footer-${idx}" style="display: none;">
          <div class="status-badge-live" id="badge-${idx}"></div>
          <div class="bubble-progress-track">
            <div class="bubble-progress-fill" id="fill-${idx}"></div>
          </div>
        </div>
        <div class="swipe-action-hint swipe-hint-listen-speak" id="swipe-hint-ls-${idx}">
          <span>🗣️ 듣고 말하기</span>
        </div>
        <div class="swipe-action-hint swipe-hint-from-prev" id="swipe-hint-fp-${idx}">
          <span>⏮️ 직전 구간부터</span>
        </div>
      </div>
    `;

    const bubbleContent = card.querySelector('.bubble-content');

    // 1. Long-press & Tap (Single / Double) Handler
    // - 길게 누르기 (450ms): 해당 구간부터 [🎯 암기중] 구간까지 무한 반복 모드로 전환
    // - 더블 탭: 1. 섀도잉 모드로 전환
    // - 싱글 탭: 재생 / 일시정지 토글
    let lastTapTime = 0;
    let tapMoved = false;
    let longPressTimer = null;
    let isLongPressTriggered = false;
    let suppressClickUntil = 0;

    const startLongPress = () => {
      isLongPressTriggered = false;
      card.classList.add('is-pressing');
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        isLongPressTriggered = true;
        card.classList.remove('is-pressing');
        suppressClickUntil = Date.now() + 500; // 롱프레스 후 touchend로 발생하는 click 방지

        // 햅틱 진동 피드백
        if (navigator.vibrate) {
          try { navigator.vibrate(60); } catch {}
        }
        switchToCustomRangeMode(idx);
      }, 450);
    };

    const cancelLongPress = () => {
      card.classList.remove('is-pressing');
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    bubbleContent.addEventListener('click', (e) => {
      // Tap speaker badge to toggle A <-> B
      if (e.target.closest('.speaker-badge-btn')) {
        e.stopPropagation();
        toggleSpeaker(idx);
        return;
      }

      // Tap STT retry button
      const retryBtn = e.target.closest('.btn-stt-retry');
      if (retryBtn) {
        e.stopPropagation();
        retrySingleSegmentSTT(idx);
        return;
      }

      // 롱프레스가 발동되었거나 스크롤 이동한 경우 클릭 무시
      if (isLongPressTriggered || Date.now() < suppressClickUntil) {
        isLongPressTriggered = false;
        e.stopPropagation();
        return;
      }
      if (tapMoved) {
        tapMoved = false;
        return;
      }

      const now = Date.now();
      const diff = now - lastTapTime;

      // 더블탭 판정 (40ms ~ 320ms 간격)
      if (diff > 40 && diff < 320) {
        lastTapTime = 0;
        switchToShadowingMode(idx);
        return;
      }

      // 싱글탭: 즉각 재생 / 일시정지 토글
      lastTapTime = now;
      handleSegmentTouch(idx);
    });

    bubbleContent.addEventListener('dblclick', (e) => {
      e.preventDefault();
    });

    // 데스크톱 마우스 롱클릭 지원
    bubbleContent.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('.speaker-badge-btn')) return;
      startLongPress();
    });
    bubbleContent.addEventListener('mouseup', () => cancelLongPress());
    bubbleContent.addEventListener('mouseleave', () => cancelLongPress());

    // 2. Touch Gesture Engine (롱프레스 / 좌 스와이프: 듣고 말하기 / 우 스와이프: 직전 구간부터)
    let touchStartX = 0;
    let touchStartY = 0;
    let isSwiping = false;
    let swipeDirection = null;

    bubbleContent.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) {
        cancelLongPress();
        return;
      }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isSwiping = false;
      swipeDirection = null;
      tapMoved = false;
      startLongPress();
    }, { passive: true });

    bubbleContent.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      const curX = e.touches[0].clientX;
      const curY = e.touches[0].clientY;
      const dx = curX - touchStartX;
      const dy = curY - touchStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // 손가락이 8px 이상 움직이면 롱프레스 취소
      if (absX > 8 || absY > 8) {
        cancelLongPress();
      }

      if (!isSwiping) {
        if (absX > 10 && absX > absY * 1.3) {
          isSwiping = true;
          tapMoved = true;
          bubbleContent.style.transition = 'none';
        } else if (absY > 8) {
          // 세로 스크롤 시 제스처 무시하여 부드러운 네이티브 스크롤 보장
          return;
        }
      }

      if (isSwiping) {
        if (e.cancelable) e.preventDefault();
        const clampedX = Math.max(-100, Math.min(100, dx));
        bubbleContent.style.transform = `translateX(${clampedX}px)`;

        const hintLS = card.querySelector('.swipe-hint-listen-speak');
        const hintFP = card.querySelector('.swipe-hint-from-prev');

        if (dx < -28) {
          if (hintLS) hintLS.style.display = 'inline-flex';
          if (hintFP) hintFP.style.display = 'none';
          swipeDirection = 'left';
        } else if (dx > 28) {
          if (hintFP) hintFP.style.display = 'inline-flex';
          if (hintLS) hintLS.style.display = 'none';
          swipeDirection = 'right';
        } else {
          if (hintLS) hintLS.style.display = 'none';
          if (hintFP) hintFP.style.display = 'none';
          swipeDirection = null;
        }
      }
    }, { passive: false });

    const finishSwipe = () => {
      cancelLongPress();
      if (!isSwiping) return;
      isSwiping = false;
      bubbleContent.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
      bubbleContent.style.transform = '';

      const hintLS = card.querySelector('.swipe-hint-listen-speak');
      const hintFP = card.querySelector('.swipe-hint-from-prev');
      if (hintLS) hintLS.style.display = 'none';
      if (hintFP) hintFP.style.display = 'none';

      if (swipeDirection === 'left') {
        switchToListenSpeakMode(idx);
      } else if (swipeDirection === 'right') {
        switchToFromPrevMode(idx);
      }
      swipeDirection = null;
    };

    bubbleContent.addEventListener('touchend', finishSwipe, { passive: true });
    bubbleContent.addEventListener('touchcancel', () => {
      cancelLongPress();
      isSwiping = false;
      swipeDirection = null;
      bubbleContent.style.transition = 'transform 0.25s ease';
      bubbleContent.style.transform = '';
      const hintLS = card.querySelector('.swipe-hint-listen-speak');
      const hintFP = card.querySelector('.swipe-hint-from-prev');
      if (hintLS) hintLS.style.display = 'none';
      if (hintFP) hintFP.style.display = 'none';
    }, { passive: true });

    dialogueList.appendChild(card);
  });

  updateActiveCardUI();
  updateStatusCounter();
}

function updateActiveCardUI() {
  const cards = document.querySelectorAll('.dialogue-card');
  const isCustomRange = (currentMode === 'custom-range');
  const isTargetMode = (currentMode === 'from-prev' || currentMode === 'from-start' || isCustomRange);
  const minRange = isCustomRange ? Math.min(rangeStartIdx, targetIndex) : -1;
  const maxRange = isCustomRange ? Math.max(rangeStartIdx, targetIndex) : -1;

  cards.forEach((c, idx) => {
    // 1. [🎯 암기중] 구간 배지 표시
    const targetBadge = document.getElementById(`target-badge-${idx}`);
    if (isTargetMode && idx === targetIndex) {
      c.classList.add('is-target');
      if (targetBadge) targetBadge.style.display = 'inline-flex';
    } else {
      c.classList.remove('is-target');
      if (targetBadge) targetBadge.style.display = 'none';
    }

    // 2. [🔁 시작] 구간 배지 표시 (트리플탭 구간 반복 모드)
    const startBadge = document.getElementById(`start-badge-${idx}`);
    if (isCustomRange && idx === rangeStartIdx && rangeStartIdx !== targetIndex) {
      if (startBadge) startBadge.style.display = 'inline-flex';
    } else {
      if (startBadge) startBadge.style.display = 'none';
    }

    // 3. [구간 반복 범위 하이라이트]
    if (isCustomRange && idx >= minRange && idx <= maxRange) {
      c.classList.add('is-in-range');
    } else {
      c.classList.remove('is-in-range');
    }

    // 4. 현재 재생 중인 활성 구간 강조
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
  updateActiveCardUI();
}

function updateRoleButtonUI() {
  if (!btnRoleToggle || !roleStageName) return;
  if (currentMode === 'role-a') {
    activeRole = 'A';
  } else if (currentMode === 'role-b') {
    activeRole = 'B';
  }
  // B 말하기 상태(기본값)일 때는 'B 말하기', A 말하기 상태일 때는 'A 말하기' 표시
  roleStageName.textContent = `${activeRole} 말하기`;
  btnRoleToggle.classList.toggle('is-role-a', activeRole === 'A');
  const targetRole = (activeRole === 'B') ? 'A' : 'B';
  btnRoleToggle.title = `A/B 말하기 (현재: ${activeRole} 말하기, 터치 시 ${targetRole} 말하기로 전환)`;
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
    // 한글 자막 표시 중일 때는 '한글보기', 영문 자막 표시 중일 때는 '영문보기' 표시
    langToggleName.textContent = (currentSubtitleLang === 'ko') ? '한글보기' : '영문보기';
  }
  if (btnLangToggle) {
    btnLangToggle.dataset.lang = currentSubtitleLang;
    btnLangToggle.classList.add('active');
    btnLangToggle.classList.toggle('is-en', currentSubtitleLang === 'en');
    const targetLabel = (currentSubtitleLang === 'ko') ? '영문보기' : '한글보기';
    btnLangToggle.title = `자막 언어 전환 (현재: ${currentSubtitleLang === 'ko' ? '한글보기' : '영문보기'}, 터치 시 ${targetLabel}로 전환)`;
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
      }
    }

    audioBlob = file;
    audioName = file.name;
    const url = URL.createObjectURL(file);
    audioPlayer.src = url;

    await saveAudioToDB(file, file.name);
    saveStateToStorage();
    updateStatusBanner(`음원: ${file.name}`);
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
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseSRT(text);
      if (parsed.length > 0) {
        clearSTTFeedback();
        subtitles = parsed;
        srtName = file.name;
        activeIndex = 0;
        targetIndex = Math.min(1, subtitles.length - 1);
        saveStateToStorage();
        renderDialogueList();
        updateStatusBanner(`자막: ${file.name} (${parsed.length}개 구간)`);
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
      clearSTTFeedback();
      cancelRepeatWait();
      cancelCueCountdown();
      await clearAudioFromDB();
      localStorage.removeItem('dialogue_app_state_v2');
      audioPlayer.pause();
      audioPlayer.src = '';
      subtitles = [];
      activeIndex = -1;
      targetIndex = 0;
      rangeStartIdx = 0;
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

  // STT Toggle Button
  if (btnSTTToggle) {
    btnSTTToggle.addEventListener('click', toggleSTT);
  }

  // Roleplay Summary Modal Listeners
  if (summaryModalClose) {
    summaryModalClose.addEventListener('click', closeRoleplaySummaryModal);
  }
  if (btnSummaryClose) {
    btnSummaryClose.addEventListener('click', closeRoleplaySummaryModal);
  }
  if (roleplaySummaryModal) {
    roleplaySummaryModal.addEventListener('click', (e) => {
      if (e.target === roleplaySummaryModal) closeRoleplaySummaryModal();
    });
  }
  if (btnSummaryRestart) {
    btnSummaryRestart.addEventListener('click', () => {
      closeRoleplaySummaryModal();
      setRoleMode(activeRole);
    });
  }
  if (btnSummaryRetryWeak) {
    btnSummaryRetryWeak.addEventListener('click', () => {
      closeRoleplaySummaryModal();
      startWeakSentencesPractice();
    });
  }

  // Speed Select
  speedSelect.addEventListener('change', (e) => {
    setSpeedSelectValue(e.target.value);
    saveStateToStorage();
  });

  // Mode Selector (5 Stages + Language Toggle)
  modeSelector.addEventListener('click', (e) => {
    // 1. Language Toggle button clicked ('한글보기' / '영문보기')
    const langBtn = e.target.closest('#btn-lang-toggle');
    if (langBtn) {
      toggleSubtitleLanguage();
      return;
    }

    const btn = e.target.closest('.stage-btn');
    if (!btn) return;

    // 2. Role Toggle button clicked (Stage 5)
    if (btn.id === 'btn-role-toggle') {
      // 만약 이미 B 말하기 상태라면 -> A 말하기로 전환
      if (currentMode === 'role-b') {
        setRoleMode('A');
      }
      // 만약 이미 A 말하기 상태라면 -> B 말하기로 전환
      else if (currentMode === 'role-a') {
        setRoleMode('B');
      }
      // 그 외 모드(섀도잉, 듣고말하기 등)에서 누르면 무조건 기본값인 'B 말하기'로 즉시 시작!
      else {
        setRoleMode('B');
      }
      return;
    }

    // 3. Other stage buttons (1, 2, 3, 4)
    const mode = btn.dataset.mode;
    if (!mode || mode === currentMode) return;

    clearSTTFeedback();
    cancelRepeatWait();
    cancelCueCountdown();
    currentMode = mode;
    updateModeSelectorUI(mode);

    // 섀도잉이나 듣고 말하기 등에서 선택/재생 중이던 구간을 '암기중' 구간으로 동기화
    if (activeIndex >= 0) {
      targetIndex = activeIndex;
    }
    saveStateToStorage();

    if (currentMode === 'from-prev') {
      const startIdx = Math.max(0, targetIndex - 1);
      jumpToSegment(startIdx, true);
      updateStatusBanner(`직전 구간부터 (암기중: ${targetIndex + 1}번 문장)`);
    } else if (currentMode === 'from-start') {
      jumpToSegment(0, true);
      updateStatusBanner(`처음~현재 (1번 ~ 암기중 ${targetIndex + 1}번 문장)`);
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
  clearSTTFeedback();
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
