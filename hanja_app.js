const input = document.getElementById('koreanInput');
const resultList = document.getElementById('resultList');
const statusText = document.getElementById('status');
const meaningDisplay = document.getElementById('meaningDisplay');
const toast = document.getElementById('toast');

let toastTimeout;
const hanjaMap = new Map();
const strokeMap = new Map();

// 파일 하나를 fetch → 파싱 → hanjaMap에 추가
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
      if (!hanjaMap.has(korean)) {
        hanjaMap.set(korean, new Map());
      }
      hanjaMap.get(korean).set(hanja, meaning);
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

    // ─────────────────────────────────────────────────────────────
    // 1단계: strokes.json + 가장 작은 파일(h11ka.txt)을 먼저 로드
    //        → 완료되는 즉시 입력창 활성화
    // ─────────────────────────────────────────────────────────────
    const PRIORITY_FILES = ['h11ka.txt']; // 크기가 작아 빨리 로드되는 파일
    const remainingFiles = files.filter(f => !PRIORITY_FILES.includes(f));

    // strokes + 우선순위 파일을 병렬로 fetch
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

    const priorityPromises = PRIORITY_FILES.map(f => fetchAndParseFile(f));

    // 1단계 완료 대기
    await Promise.all([strokesPromise, ...priorityPromises]);

    // ── 입력창 즉시 활성화 ──
    input.disabled = false;
    input.focus();
    statusText.textContent = `입력 대기 중... (나머지 사전 로딩 중)`;

    // ─────────────────────────────────────────────────────────────
    // 2단계: 나머지 파일들을 모두 병렬로 fetch (백그라운드)
    // ─────────────────────────────────────────────────────────────
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
    return { hanja, meaning };
  });
}

input.addEventListener('input', () => {
  const word = input.value.trim();

  // Clear previous results
  resultList.innerHTML = '';
  meaningDisplay.textContent = '';
  meaningDisplay.classList.remove('show');

  if (!word) {
    statusText.textContent = '입력 대기 중...';
    statusText.classList.add('show');
    return;
  }

  const hanjas = findHanja(word);

  // Sort hanjas by stroke count (ascending order)
  if (hanjas) {
    hanjas.sort((a, b) => {
      const strokesA = strokeMap.get(a.hanja) || 999;
      const strokesB = strokeMap.get(b.hanja) || 999;
      if (strokesA !== strokesB) {
        return strokesA - strokesB;
      }
      return a.hanja.charCodeAt(0) - b.hanja.charCodeAt(0);
    });
  }

  if (hanjas && hanjas.length > 0) {
    statusText.textContent = `${hanjas.length}개의 한자를 찾았습니다. 클릭하여 복사하세요.`;
    statusText.classList.add('show');

    hanjas.forEach((itemObj, index) => {
      const item = document.createElement('div');
      item.className = 'hanja-item';
      item.textContent = itemObj.hanja;
      // Stagger animation delay
      item.style.animationDelay = `${index * 0.05}s`;

      item.addEventListener('click', async () => {
        try {
          // Use modern Web Clipboard API
          await navigator.clipboard.writeText(`${word}(${itemObj.hanja})`);

          // Show meaning if available
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

      resultList.appendChild(item);
    });
  } else {
    statusText.textContent = '일치하는 한자가 없습니다.';
    statusText.classList.add('show');
  }
});

function showToast() {
  toast.classList.add('show');

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// Start loading data
window.addEventListener('DOMContentLoaded', () => {
  input.disabled = true; // Disable input until 1단계 완료
  initApp();
});
