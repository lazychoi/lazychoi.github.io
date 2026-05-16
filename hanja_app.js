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

/**
 * 한자 문자열의 총 획수를 계산해 툴팁 텍스트를 반환합니다.
 *
 * 알고리즘:
 * 1. Array.from()으로 문자열을 유니코드 안전하게 개별 문자 배열로 분리
 *    (split('')은 보조 문자를 2개로 잘못 분리할 수 있어 Array.from 사용)
 * 2. strokeMap에서 각 문자의 획수를 조회
 * 3. 획수가 있으면 합산, 없으면 '?'로 표시
 * 4. 단일 문자면 "12획", 복합 문자면 "총 22획 (朝 12 + 家 10)" 형식으로 반환
 */
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
    // 단일 한자: "12획" 또는 "?획"
    return hasUnknown ? '획수 정보 없음' : `${total}획`;
  } else {
    // 복합 한자: "총 22획 (朝 12 + 家 10)"
    const detail = parts.join(' + ');
    return hasUnknown ? `총 ?획 (${detail})` : `총 ${total}획 (${detail})`;
  }
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
      // Stagger animation delay
      item.style.animationDelay = `${index * 0.05}s`;

      // 한자 텍스트 노드
      item.appendChild(document.createTextNode(itemObj.hanja));

      // 획수 레이블: .hanja-item 안에 <span>으로 삽입
      // CSS position:absolute (부모 .hanja-item 기준)로 한자 위에 표시
      // hover는 CSS ".hanja-item:hover .stroke-label { opacity: 1 }"으로 처리
      // → 외부 요소 위치 계산 불필요, overflow/stacking context 문제 없음
      const label = document.createElement('span');
      label.className = 'stroke-label';
      label.textContent = getStrokeInfo(itemObj.hanja);
      item.appendChild(label);

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
