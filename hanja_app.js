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

let toastTimeout;
const hanjaMap = new Map();
const strokeMap = new Map();
const hanjaList = []; // 평탄화된 단일 한자 목록 { korean, hanja, meaning }

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
      const meaning = parts[2] || '';
      
      // hanjaMap에 추가
      if (!hanjaMap.has(korean)) {
        hanjaMap.set(korean, new Map());
      }
      hanjaMap.get(korean).set(hanja, meaning);

      // 평탄화된 목록에 추가 (단일 한자만 대상)
      if (hanja.length === 1) {
        hanjaList.push({ korean, hanja, meaning });
      }
    }
  });
}

async function initApp() {
  try {
    statusText.textContent = '사전 데이터 불러오는 중...';
    statusText.classList.add('show');

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

    // 부수 검색 데이터 구축 완료 시 UI 렌더링 호출
    initRadicalSearch();

    // ── 입력창 즉시 활성화 ──
    input.disabled = false;
    input.focus();
    statusText.textContent = `입력 대기 중... (나머지 사전 로딩 중)`;

    // 2단계: 나머지 파일들을 모두 병렬로 fetch (백그라운드)
    const remainingPromises = remainingFiles.map(f => fetchAndParseFile(f));

    // 백그라운드 로딩 — 사용자는 이미 검색 가능
    Promise.all(remainingPromises)
      .then(() => {
        statusText.textContent = '입력 대기 중...';
      })
      .catch(err => {
        console.error('일부 사전 파일 로딩 실패:', err);
        statusText.textContent = '일부 사전 파일 로딩 실패';
      });

  } catch (error) {
    console.error(error);
    statusText.textContent = '데이터 로딩 실패: ' + error.message;
  }
}

function findHanja(word) {
  if (!hanjaMap.has(word)) return [];
  return Array.from(hanjaMap.get(word).entries()).map(([hanja, meaning]) => {
    return { hanja, meaning, korean: word };
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
      try {
        const copyWord = customWord || itemObj.korean || '';
        await navigator.clipboard.writeText(`${copyWord}(${itemObj.hanja})`);

        if (itemObj.meaning) {
          meaningDisplay.textContent = `${itemObj.meaning}`;
          meaningDisplay.classList.add('show');
        } else {
          meaningDisplay.textContent = '뜻 정보 없음';
          meaningDisplay.classList.add('show');
        }

        showToast();
      } catch (err) {
        console.error('Failed to copy text: ', err);
        alert('클립보드 복사에 실패했습니다.');
      }
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
input.addEventListener('input', () => {
  const word = input.value.trim();

  resultList.innerHTML = '';
  meaningDisplay.textContent = '';
  meaningDisplay.classList.remove('show');

  if (!word) {
    statusText.textContent = '입력 대기 중...';
    statusText.classList.add('show');
    return;
  }

  const exactMatches = findHanja(word);
  const meaningMatches = findHanjaByMeaning(word);

  if (exactMatches.length > 0 || meaningMatches.length > 0) {
    statusText.textContent = `검색 완료. 클릭하여 복사하세요.`;
    statusText.classList.add('show');

    // 음/단어 검색 결과와 뜻/훈 검색 결과가 둘 다 있는 경우 분리 렌더링
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
  } else {
    statusText.textContent = '일치하는 한자가 없습니다.';
    statusText.classList.add('show');
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
  ctx.strokeStyle = '#818cf8';

  canvas.addEventListener('pointerdown', (e) => {
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
  if (strokes.length === 0) return;

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

function searchHanjaCharacter(char) {
  resultList.innerHTML = '';
  meaningDisplay.textContent = '';
  meaningDisplay.classList.remove('show');

  const matches = hanjaList.filter(item => item.hanja === char);

  if (matches.length > 0) {
    statusText.textContent = `한자 '${char}'의 정보입니다. 클릭하여 복사하세요.`;
    renderHanjaList(matches, false);
  } else {
    statusText.textContent = `사전에 없는 한자입니다. 클릭하여 복사하세요.`;
    // 뜻 정보가 없는 한자도 복사할 수 있도록 렌더링
    renderHanjaList([{ hanja: char, korean: '?', meaning: '사전 정보 없음' }], false);
  }
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

// 토스트 메시지 보이기
function showToast() {
  toast.classList.add('show');

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// 데이터 로드 시작 및 요소 초기화
window.addEventListener('DOMContentLoaded', () => {
  input.disabled = true; // Disable input until 1단계 완료
  initApp();
  initCanvas();
});
