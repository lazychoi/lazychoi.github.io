// ══════════════════════════════════════════════════════
// rebalance.js — 주식 리밸런싱 프로그램 인터랙티브 로직
// ══════════════════════════════════════════════════════

// ── 상태 관리 (State) ──
let state = {
  stocks: [],
  weightMode: 'equal', // 'equal' or 'custom'
  cashBalance: 0,
  additionalCash: 0
};

// 다음 추가될 종목의 임시 ID 고유값
let nextStockId = 1;

// ── DOM 요소 참조 ──
const elements = {
  btnModeEqual: document.getElementById('btnModeEqual'),
  btnModeCustom: document.getElementById('btnModeCustom'),
  inputCashBalance: document.getElementById('inputCashBalance'),
  inputAdditionalCash: document.getElementById('inputAdditionalCash'),
  stockCountDisplay: document.getElementById('stockCountDisplay'),
  stockTableBody: document.getElementById('stockTableBody'),
  btnAddStock: document.getElementById('btnAddStock'),
  btnCalculate: document.getElementById('btnCalculate'),
  btnResetAll: document.getElementById('btnResetAll'),
  btnImportExport: document.getElementById('btnImportExport'),
  weightAlertBanner: document.getElementById('weightAlertBanner'),
  weightAlertMessage: document.getElementById('weightAlertMessage'),
  btnNormalizeWeights: document.getElementById('btnNormalizeWeights'),
  thTargetWeight: document.getElementById('thTargetWeight'),
  
  // 결과 영역
  resultsSection: document.getElementById('resultsSection'),
  btnCopyReport: document.getElementById('btnCopyReport'),
  summaryTotalStocks: document.getElementById('summaryTotalStocks'),
  summaryCurrentWeight: document.getElementById('summaryCurrentWeight'),
  summaryTotalCash: document.getElementById('summaryTotalCash'),
  summaryCashWeight: document.getElementById('summaryCashWeight'),
  summaryTotalPortfolio: document.getElementById('summaryTotalPortfolio'),
  visualRatioContainer: document.getElementById('visualRatioContainer'),
  actionTableBody: document.getElementById('actionTableBody'),
  leftoverCashText: document.getElementById('leftoverCashText'),
  toastMessage: document.getElementById('toastMessage'),

  // 모달 영역
  modalOverlay: document.getElementById('modalOverlay'),
  modalTextarea: document.getElementById('modalTextarea'),
  btnModalCopy: document.getElementById('btnModalCopy'),
  btnModalImport: document.getElementById('btnModalImport'),
  btnModalClose: document.getElementById('btnModalClose')
};

// ── 유틸리티 함수 ──

// 천단위 콤마 포맷팅 (원 표시)
function formatMoney(num) {
  if (isNaN(num) || num === null) return '0원';
  return Math.round(num).toLocaleString('ko-KR') + '원';
}

// 일반 숫자 3자리마다 콤마 추가 유틸리티 (인풋 입력필드 및 테이블용)
function formatNumberWithCommas(val) {
  let str = String(val).replace(/[^0-9]/g, '');
  if (!str) return '';
  return Number(str).toLocaleString('ko-KR');
}

// 퍼센트 포맷팅 (소수점 1자리)
function formatPercent(num) {
  if (isNaN(num) || num === null) return '0.0%';
  return num.toFixed(1) + '%';
}

// 토스트 메시지 출력
function showToast(message) {
  elements.toastMessage.textContent = message;
  elements.toastMessage.classList.add('show');
  setTimeout(() => {
    elements.toastMessage.classList.remove('show');
  }, 2500);
}
// 실시간 콤마 적용 인풋 헬퍼 (커서 유지)
function handleLiveCommaInput(input, onUpdateValue) {
  let cleanVal = input.value.replace(/[^0-9]/g, '');
  let numVal = parseFloat(cleanVal) || 0;
  onUpdateValue(numVal);
  
  let oldStart = input.selectionStart;
  let oldLen = input.value.length;
  let formatted = formatNumberWithCommas(cleanVal);
  input.value = formatted;
  let newLen = formatted.length;
  let newStart = oldStart + (newLen - oldLen);
  input.setSelectionRange(newStart, newStart);
}

// ── 데이터 저장 및 로드 ──

function saveToLocalStorage() {
  localStorage.setItem('lazychoi_rebalance_data', JSON.stringify({
    stocks: state.stocks,
    weightMode: state.weightMode,
    cashBalance: state.cashBalance,
    additionalCash: state.additionalCash,
    nextStockId: nextStockId
  }));
}

function loadFromLocalStorage() {
  const savedData = localStorage.getItem('lazychoi_rebalance_data');
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData);
      state.stocks = parsed.stocks || [];
      state.weightMode = parsed.weightMode || 'equal';
      state.cashBalance = parsed.cashBalance || 0;
      state.additionalCash = parsed.additionalCash || 0;
      nextStockId = parsed.nextStockId || 1;

      // 구버전 데이터 대응용 ID 할당
      state.stocks.forEach(stock => {
        if (!stock.id) {
          stock.id = nextStockId++;
        }
      });
    } catch (e) {
      console.error('LocalStorage 로드 실패, 기본값 사용', e);
      loadDefaultStocks();
    }
  } else {
    loadDefaultStocks();
  }
}

// 초기 기본 예시 데이터 적재
function loadDefaultStocks() {
  state.stocks = [
    { id: 1, name: '삼성전자 (005930)', quantity: 15, price: 72000, targetRatio: 40 },
    { id: 2, name: 'AAPL', quantity: 3, price: 240000, targetRatio: 30 },
    { id: 3, name: '맥쿼리인프라 (125000)', quantity: 50, price: 12500, targetRatio: 30 }
  ];
  state.weightMode = 'equal';
  state.cashBalance = 350000;
  state.additionalCash = 100000;
  nextStockId = 4;
}

// ── UI 렌더링 함수 ──

// 전체 렌더링
function renderAll() {
  // 모드 버튼 클래스 설정
  if (state.weightMode === 'equal') {
    elements.btnModeEqual.classList.add('active');
    elements.btnModeCustom.classList.remove('active');
    elements.thTargetWeight.textContent = '목표 비중 (%)';
  } else {
    elements.btnModeEqual.classList.remove('active');
    elements.btnModeCustom.classList.add('active');
    elements.thTargetWeight.textContent = '목표 비중 (%) *';
  }

  // 예수금 필드값 설정 (실시간 콤마 적용)
  elements.inputCashBalance.value = formatNumberWithCommas(state.cashBalance);
  elements.inputAdditionalCash.value = (state.additionalCash < 0 ? '-' : '') + formatNumberWithCommas(Math.abs(state.additionalCash));

  // 종목 카운트 설정
  elements.stockCountDisplay.textContent = `등록된 종목: ${formatNumberWithCommas(state.stocks.length)}개`;

  // 테이블 행 렌더링
  renderStockTable();
  // 경고 배너 체크
  checkWeightWarning();
}

// 종목 입력 테이블 렌더링
function renderStockTable() {
  elements.stockTableBody.innerHTML = '';
  
  if (state.stocks.length === 0) {
    elements.stockTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="color: var(--text-muted); padding: 30px;">
          등록된 주식 종목이 없습니다. [종목 추가] 버튼을 눌러 자산을 입력하세요.
        </td>
      </tr>
    `;
    return;
  }

  const totalStocksVal = calculateTotalStocksValue();

  state.stocks.forEach((stock, index) => {
    const tr = document.createElement('tr');
    tr.className = 'stock-row';
    tr.dataset.id = stock.id;

    // 평가금액 및 현재 비중 계산
    const evalAmount = stock.quantity * stock.price;
    const currentRatio = totalStocksVal > 0 ? (evalAmount / totalStocksVal) * 100 : 0;

    // 목표 비중 셀
    let targetRatioHtml = '';
    if (state.weightMode === 'equal') {
      const equalRatio = 100 / state.stocks.length;
      targetRatioHtml = `<span class="calc-ratio">${equalRatio.toFixed(1)}%</span>`;
    } else {
      targetRatioHtml = `
        <div class="input-table-cell text-right">
          <input type="number" class="input-target-ratio text-right" data-id="${stock.id}" 
            value="${stock.targetRatio}" min="0" max="100" step="any" style="width: 80px; display: inline-block;">
        </div>
      `;
    }

    tr.innerHTML = `
      <td>
        <div class="input-table-cell">
          <input type="text" class="input-name" data-id="${stock.id}" value="${stock.name}" placeholder="종목명 또는 티커 (예: 삼성전자, AAPL)">
        </div>
      </td>
      <td>
        <div class="input-table-cell text-right">
          <input type="text" class="input-quantity text-right" data-id="${stock.id}" value="${formatNumberWithCommas(stock.quantity)}" placeholder="수량">
        </div>
      </td>
      <td>
        <div class="input-table-cell text-right">
          <input type="text" class="input-price text-right" data-id="${stock.id}" value="${formatNumberWithCommas(stock.price)}" placeholder="현재가">
        </div>
      </td>
      <td class="text-right">
        <div style="display: flex; flex-direction: column;">
          <span class="calc-value">${formatMoney(evalAmount)}</span>
          <span class="calc-ratio" style="font-size: 11px;">비중: ${formatPercent(currentRatio)}</span>
        </div>
      </td>
      <td class="text-right">
        ${targetRatioHtml}
      </td>
      <td class="text-center">
        <button class="trash-btn" data-id="${stock.id}">🗑️</button>
      </td>
    `;

    elements.stockTableBody.appendChild(tr);
  });

  bindTableInputs();
}

// 테이블 입력 요소 이벤트 바인딩
function bindTableInputs() {
  // 이름 수정
  document.querySelectorAll('.input-name').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = parseInt(e.target.dataset.id);
      const stock = state.stocks.find(s => s.id === id);
      if (stock) {
        stock.name = e.target.value;
        saveToLocalStorage();
      }
    });
  });

  // 보유수량 수정 (실시간 콤마 포맷팅)
  document.querySelectorAll('.input-quantity').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = parseInt(e.target.dataset.id);
      const stock = state.stocks.find(s => s.id === id);
      if (stock) {
        handleLiveCommaInput(e.target, (val) => {
          stock.quantity = val;
          saveToLocalStorage();
          updateCalculatedFields();
        });
      }
    });
  });

  // 현재가 수정 (실시간 콤마 포맷팅)
  document.querySelectorAll('.input-price').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = parseInt(e.target.dataset.id);
      const stock = state.stocks.find(s => s.id === id);
      if (stock) {
        handleLiveCommaInput(e.target, (val) => {
          stock.price = val;
          saveToLocalStorage();
          updateCalculatedFields();
          // 결과 리포트가 펼쳐져 있으면 즉시 재계산
          if (elements.resultsSection.style.display !== 'none') {
            calculateRebalancing();
          }
        });
      }
    });
  });

  // 목표 비중 직접 수정 (Custom 모드일 때만 존재)
  document.querySelectorAll('.input-target-ratio').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = parseInt(e.target.dataset.id);
      const stock = state.stocks.find(s => s.id === id);
      if (stock) {
        stock.targetRatio = Math.max(0, parseFloat(e.target.value) || 0);
        saveToLocalStorage();
        checkWeightWarning();
      }
    });
  });

  // 삭제 버튼
  document.querySelectorAll('.trash-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const btnElement = e.target.closest('.trash-btn');
      const id = parseInt(btnElement.dataset.id);
      deleteStock(id);
    });
  });
}

// 실시간 평가금액 및 간이 비중 업데이트 (DOM만 빠르게 변경)
function updateCalculatedFields() {
  const totalStocksVal = calculateTotalStocksValue();
  state.stocks.forEach(stock => {
    const row = elements.stockTableBody.querySelector(`tr[data-id="${stock.id}"]`);
    if (row) {
      const evalAmount = stock.quantity * stock.price;
      const currentRatio = totalStocksVal > 0 ? (evalAmount / totalStocksVal) * 100 : 0;
      
      const valSpan = row.querySelector('.calc-value');
      const ratioSpan = row.querySelector('.calc-ratio');
      
      if (valSpan) valSpan.textContent = formatMoney(evalAmount);
      if (ratioSpan) ratioSpan.textContent = `비중: ${formatPercent(currentRatio)}`;
    }
  });
}

// 경고 배너 렌더링 조건 체크
function checkWeightWarning() {
  if (state.weightMode === 'equal' || state.stocks.length === 0) {
    elements.weightAlertBanner.style.display = 'none';
    return;
  }

  const sum = state.stocks.reduce((acc, stock) => acc + (stock.targetRatio || 0), 0);
  // 부동소수점 오차 감안 99.9% ~ 100.1% 허용
  if (Math.abs(sum - 100) > 0.01) {
    elements.weightAlertMessage.innerHTML = `목표 비중의 합이 100%가 아닙니다. (현재 합계: <strong>${sum.toFixed(1)}%</strong>)`;
    elements.weightAlertBanner.style.display = 'flex';
  } else {
    elements.weightAlertBanner.style.display = 'none';
  }
}

// ── 계산 기능 (Rebalancing Logic) ──

// 총 주식 평가금액 합산
function calculateTotalStocksValue() {
  return state.stocks.reduce((acc, stock) => acc + (stock.quantity * stock.price), 0);
}

// 리밸런싱 계산 수행 및 결과 출력
function calculateRebalancing() {
  if (state.stocks.length === 0) {
    showToast('계산할 주식 종목을 추가해 주세요.');
    return;
  }

  // 커스텀 모드일 경우 비중 확인
  if (state.weightMode === 'custom') {
    const sum = state.stocks.reduce((acc, stock) => acc + (stock.targetRatio || 0), 0);
    if (Math.abs(sum - 100) > 0.01) {
      showToast('목표 비중의 합을 100%로 맞춰야 계산이 가능합니다.');
      elements.weightAlertBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }

  // 기본 원장 데이터 계산
  const totalStocksVal = calculateTotalStocksValue();
  const totalCash = Math.max(0, state.cashBalance + state.additionalCash);
  const totalPortfolioVal = totalStocksVal + totalCash;

  if (totalPortfolioVal <= 0) {
    showToast('총 자산 평가금액이 0원입니다. 수량과 가격 또는 예수금을 설정하세요.');
    return;
  }

  // 주식 평가비중 및 현금 비중
  const stockWeight = totalPortfolioVal > 0 ? (totalStocksVal / totalPortfolioVal) * 100 : 0;
  const cashWeight = totalPortfolioVal > 0 ? (totalCash / totalPortfolioVal) * 100 : 0;

  // 요약 영역 업데이트
  elements.summaryTotalStocks.textContent = formatMoney(totalStocksVal);
  elements.summaryCurrentWeight.textContent = `보유 비중 ${formatPercent(stockWeight)}`;
  elements.summaryTotalCash.textContent = formatMoney(totalCash);
  elements.summaryCashWeight.textContent = `보유 비중 ${formatPercent(cashWeight)}`;
  elements.summaryTotalPortfolio.textContent = formatMoney(totalPortfolioVal);

  // 1. 목표 비율 분배 목록 계산
  const rebalanceData = [];
  let equalRatio = 100 / state.stocks.length;

  state.stocks.forEach(stock => {
    const targetRatio = state.weightMode === 'equal' ? equalRatio : stock.targetRatio;
    // 목표 평가액 (포트폴리오 총액 대비 목표비율)
    const targetValue = totalPortfolioVal * (targetRatio / 100);
    
    // 목표 수량 계산 (1주 미만은 거래 불가능하므로 반올림 또는 버림)
    // 주식 거래 성격 상 '반올림'으로 처리하여 이상적인 비중에 가장 가깝게 만듭니다.
    let targetQty = 0;
    if (stock.price > 0) {
      targetQty = Math.round(targetValue / stock.price);
    }
    
    const currentVal = stock.quantity * stock.price;
    const currentRatio = totalPortfolioVal > 0 ? (currentVal / totalPortfolioVal) * 100 : 0;

    rebalanceData.push({
      ...stock,
      currentVal,
      currentRatio,
      targetRatio,
      targetValue,
      targetQty
    });
  });

  // 정수형 수량 확정으로 인한 소수점 단주 절사/올림 오차 계산
  // 실제 구매/매도 후 최종 포트폴리오 잔여 현금 계산
  let deployedCash = 0;
  rebalanceData.forEach(item => {
    deployedCash += item.targetQty * item.price;
  });
  const leftoverCash = totalPortfolioVal - deployedCash;

  // 2. 비중 시각화 바 렌더링
  renderVisualization(rebalanceData);

  // 3. 거래 실행 가이드 테이블 렌더링
  renderActionTable(rebalanceData);

  // 남은 현금 표시
  elements.leftoverCashText.textContent = formatMoney(leftoverCash);
  if (leftoverCash < 0) {
    elements.leftoverCashText.innerHTML = `${formatMoney(leftoverCash)} <span style="color: #f87171; font-weight: normal; font-size: 11px;">(예수금 한도를 초과하여 ${formatMoney(Math.abs(leftoverCash))}의 추가 입금이 필요할 수 있습니다)</span>`;
  }

  // 결과 화면 펼치기
  elements.resultsSection.style.display = 'block';
  elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
  
  showToast('리밸런싱 계산이 완료되었습니다!');
}

// 비중 그래프 시각화
function renderVisualization(data) {
  elements.visualRatioContainer.innerHTML = '';

  data.forEach(item => {
    const row = document.createElement('div');
    row.className = 'ratio-bar-row';

    row.innerHTML = `
      <div class="ratio-bar-label">
        <span>${item.name}</span>
        <span>
          <span style="color: var(--accent); font-weight: 700;">현재 ${formatPercent(item.currentRatio)}</span>
          <span style="color: var(--text-muted);">→</span>
          <span style="color: var(--amber); font-weight: 700;">목표 ${formatPercent(item.targetRatio)}</span>
        </span>
      </div>
      <div class="ratio-bar-track">
        <div class="ratio-bar-fill current" style="width: ${item.currentRatio}%"></div>
        <div class="ratio-bar-fill target" style="width: ${item.targetRatio}%"></div>
      </div>
    `;

    elements.visualRatioContainer.appendChild(row);
  });
}

// 거래 실행 가이드 테이블 렌더링 (숫자 세자리마다 쉼표 적용)
function renderActionTable(data) {
  elements.actionTableBody.innerHTML = '';

  data.forEach(item => {
    const qtyDiff = item.targetQty - item.quantity;
    const valueDiff = qtyDiff * item.price;

    let actionBadge = '';
    let actionDetails = '';

    if (qtyDiff > 0) {
      actionBadge = `<span class="badge badge-buy">매수</span>`;
      actionDetails = `<span class="action-text-buy">추가 매수 ${formatNumberWithCommas(qtyDiff)}주 (+${formatMoney(valueDiff)})</span>`;
    } else if (qtyDiff < 0) {
      actionBadge = `<span class="badge badge-sell">매도</span>`;
      actionDetails = `<span class="action-text-sell">일부 매도 ${formatNumberWithCommas(Math.abs(qtyDiff))}주 (${formatMoney(valueDiff)})</span>`;
    } else {
      actionBadge = `<span class="badge badge-hold">유지</span>`;
      actionDetails = `<span style="color: var(--text-muted);">변동 없음 (현상 유지)</span>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 600;">${item.name}</td>
      <td class="text-right">${formatNumberWithCommas(item.quantity)}주</td>
      <td class="text-right">${formatPercent(item.targetRatio)}</td>
      <td class="text-right">${formatMoney(item.targetValue)}</td>
      <td class="text-right" style="font-weight: 600;">${formatNumberWithCommas(item.targetQty)}주</td>
      <td class="text-center">${actionBadge} <div style="margin-top: 4px; font-size: 13px;">${actionDetails}</div></td>
    `;

    elements.actionTableBody.appendChild(tr);
  });
}

// ── 데이터 편집 동작 ──

// 종목 추가
function addStock() {
  const newStock = {
    id: nextStockId++,
    name: '',
    quantity: 0,
    price: 0,
    targetRatio: 0
  };
  state.stocks.push(newStock);
  saveToLocalStorage();
  renderStockTable();
  elements.stockCountDisplay.textContent = `등록된 종목: ${formatNumberWithCommas(state.stocks.length)}개`;
  checkWeightWarning();
}

// 종목 삭제
function deleteStock(id) {
  state.stocks = state.stocks.filter(s => s.id !== id);
  saveToLocalStorage();
  renderStockTable();
  elements.stockCountDisplay.textContent = `등록된 종목: ${formatNumberWithCommas(state.stocks.length)}개`;
  checkWeightWarning();
  // 결과 숨김
  elements.resultsSection.style.display = 'none';
}

// 비중 자동 정규화 (100% 분배)
function normalizeWeights() {
  if (state.stocks.length === 0) return;

  const currentSum = state.stocks.reduce((acc, s) => acc + (s.targetRatio || 0), 0);
  
  if (currentSum === 0) {
    // 모든 비중이 0일 경우 N분의 1 처리
    const equalVal = 100 / state.stocks.length;
    state.stocks.forEach(s => s.targetRatio = parseFloat(equalVal.toFixed(2)));
  } else {
    // 상대적 가중치 비율로 스케일링
    let runningSum = 0;
    state.stocks.forEach((s, idx) => {
      if (idx === state.stocks.length - 1) {
        // 마지막 요소는 반올림 정밀도를 채우기 위해 100에서 뺌
        s.targetRatio = parseFloat((100 - runningSum).toFixed(2));
      } else {
        const val = (s.targetRatio / currentSum) * 100;
        s.targetRatio = parseFloat(val.toFixed(2));
        runningSum += s.targetRatio;
      }
    });
  }

  saveToLocalStorage();
  renderAll();
  showToast('목표 비중 합계를 100%로 자동 조정했습니다.');
}

// 전체 초기화
function resetAll() {
  if (confirm('모든 주식 종목 데이터와 예수금 설정이 공장 초기화됩니다. 계속하시겠습니까?')) {
    localStorage.removeItem('lazychoi_rebalance_data');
    loadDefaultStocks();
    renderAll();
    elements.resultsSection.style.display = 'none';
    showToast('전체 초기화가 완료되었습니다.');
  }
}

// ── 데이터 백업 / 복원 (JSON Import/Export) ──

function openImportExportModal() {
  const exportData = {
    stocks: state.stocks,
    weightMode: state.weightMode,
    cashBalance: state.cashBalance,
    additionalCash: state.additionalCash
  };
  
  elements.modalTextarea.value = JSON.stringify(exportData, null, 2);
  elements.modalOverlay.style.display = 'flex';
  elements.modalTextarea.focus();
}

function closeImportExportModal() {
  elements.modalOverlay.style.display = 'none';
}

function copyModalText() {
  elements.modalTextarea.select();
  document.execCommand('copy');
  showToast('백업 텍스트가 클립보드에 복사되었습니다.');
}

function importDataFromModal() {
  const text = elements.modalTextarea.value.trim();
  if (!text) {
    showToast('복원할 데이터를 입력 상자에 입력해주세요.');
    return;
  }

  try {
    const parsed = JSON.parse(text);
    if (!parsed.stocks || !Array.isArray(parsed.stocks)) {
      throw new Error('유효한 종목 목록(stocks)이 포함되어 있지 않습니다.');
    }

    state.stocks = parsed.stocks;
    state.weightMode = parsed.weightMode || 'equal';
    state.cashBalance = parsed.cashBalance || 0;
    state.additionalCash = parsed.additionalCash || 0;
    
    // 최대 ID 재정의
    nextStockId = 1;
    state.stocks.forEach(stock => {
      stock.id = nextStockId++;
      if (typeof stock.quantity !== 'number') stock.quantity = parseFloat(stock.quantity) || 0;
      if (typeof stock.price !== 'number') stock.price = parseFloat(stock.price) || 0;
      if (typeof stock.targetRatio !== 'number') stock.targetRatio = parseFloat(stock.targetRatio) || 0;
    });

    saveToLocalStorage();
    renderAll();
    closeImportExportModal();
    elements.resultsSection.style.display = 'none';
    showToast('데이터 복원이 성공적으로 완료되었습니다.');
  } catch (err) {
    alert('데이터 복원에 실패했습니다. 복사본 코드를 다시 한 번 확인해 주세요.\n오류 정보: ' + err.message);
  }
}

// ── 리밸런싱 결과 리포트 복사 ──
function copyReportToClipboard() {
  const totalStocksVal = calculateTotalStocksValue();
  const totalCash = Math.max(0, state.cashBalance + state.additionalCash);
  const totalPortfolioVal = totalStocksVal + totalCash;
  
  let report = `📊 [자산 리밸런싱 실행 리포트]\n`;
  report += `───────────────────────────────\n`;
  report += `■ 총 포트폴리오 자산 규모: ${formatMoney(totalPortfolioVal)}\n`;
  report += `  - 주식 평가금액: ${formatMoney(totalStocksVal)} (${formatPercent(totalPortfolioVal > 0 ? (totalStocksVal / totalPortfolioVal)*100 : 0)})\n`;
  report += `  - 예수금 (현금): ${formatMoney(totalCash)} (${formatPercent(totalPortfolioVal > 0 ? (totalCash / totalPortfolioVal)*100 : 0)})\n`;
  report += `───────────────────────────────\n`;
  report += `■ 거래 실행 가이드:\n`;

  const rows = elements.actionTableBody.querySelectorAll('tr');
  if (rows.length === 0) return;

  rows.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    const name = tds[0].textContent;
    const curQty = tds[1].textContent;
    const targetWeight = tds[2].textContent;
    const targetQty = tds[4].textContent;
    const actionText = tds[5].textContent.replace(/\s+/g, ' ').trim();
    
    report += `• [${name}] (현재 ${curQty} | 목표비중 ${targetWeight} | 목표수량 ${targetQty})\n`;
    report += `  → 실행 행동: ${actionText}\n`;
  });

  const leftoverTextClean = elements.leftoverCashText.textContent.split('(')[0].trim();
  report += `───────────────────────────────\n`;
  report += `■ 최종 잔여 예상 예수금: ${leftoverTextClean}\n`;
  report += `* 주식 거래단위 정수화(1주 단위 절사) 처리에 따라 오차가 존재할 수 있습니다.`;

  const tempTextarea = document.createElement('textarea');
  tempTextarea.value = report;
  document.body.appendChild(tempTextarea);
  tempTextarea.select();
  document.execCommand('copy');
  document.body.removeChild(tempTextarea);

  showToast('리밸런싱 리포트가 복사되었습니다!');
}

// ── 이벤트 리스너 설정 ──

function initEventListeners() {
  // 모드 전환
  elements.btnModeEqual.addEventListener('click', () => {
    if (state.weightMode !== 'equal') {
      state.weightMode = 'equal';
      saveToLocalStorage();
      renderAll();
      elements.resultsSection.style.display = 'none';
    }
  });

  elements.btnModeCustom.addEventListener('click', () => {
    if (state.weightMode !== 'custom') {
      state.weightMode = 'custom';
      // 모든 비율 합계가 0일 경우 기본 비율 분배 초기화
      const totalRatio = state.stocks.reduce((sum, s) => sum + (s.targetRatio || 0), 0);
      if (totalRatio === 0 && state.stocks.length > 0) {
        const eq = parseFloat((100 / state.stocks.length).toFixed(1));
        state.stocks.forEach(s => s.targetRatio = eq);
      }
      saveToLocalStorage();
      renderAll();
      elements.resultsSection.style.display = 'none';
    }
  });

  // 예수금 입력 관리 (실시간 3자리 콤마 포맷팅)
  elements.inputCashBalance.addEventListener('input', (e) => {
    let cleanVal = e.target.value.replace(/[^0-9]/g, '');
    let numVal = parseFloat(cleanVal) || 0;
    state.cashBalance = numVal;
    saveToLocalStorage();
    
    // 포맷팅 후 커서 위치 보존
    let oldStart = e.target.selectionStart;
    let oldLen = e.target.value.length;
    let formatted = formatNumberWithCommas(cleanVal);
    e.target.value = formatted;
    let newLen = formatted.length;
    let newStart = oldStart + (newLen - oldLen);
    e.target.setSelectionRange(newStart, newStart);
  });

  elements.inputAdditionalCash.addEventListener('input', (e) => {
    let raw = e.target.value;
    let isNegative = raw.startsWith('-');
    let cleanVal = raw.replace(/[^0-9]/g, '');
    let numVal = parseFloat(cleanVal) || 0;
    if (isNegative && numVal > 0) numVal = -numVal;
    
    state.additionalCash = numVal;
    saveToLocalStorage();
    
    // 포맷팅 후 커서 위치 보존
    let oldStart = e.target.selectionStart;
    let oldLen = e.target.value.length;
    let formatted = (isNegative && cleanVal ? '-' : '') + formatNumberWithCommas(cleanVal);
    if (raw === '-') formatted = '-';
    e.target.value = formatted;
    let newLen = formatted.length;
    let newStart = oldStart + (newLen - oldLen);
    e.target.setSelectionRange(newStart, newStart);
  });

  // 종목 추가
  elements.btnAddStock.addEventListener('click', addStock);

  // 리밸런싱 계산 실행
  elements.btnCalculate.addEventListener('click', calculateRebalancing);

  // 비중 정규화 버튼
  elements.btnNormalizeWeights.addEventListener('click', normalizeWeights);

  // 전체 초기화
  elements.btnResetAll.addEventListener('click', resetAll);

  // 모달 제어
  elements.btnImportExport.addEventListener('click', openImportExportModal);
  elements.btnModalClose.addEventListener('click', closeImportExportModal);
  elements.btnModalCopy.addEventListener('click', copyModalText);
  elements.btnModalImport.addEventListener('click', importDataFromModal);
  elements.modalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.modalOverlay) {
      closeImportExportModal();
    }
  });

  // 결과 리포트 복사
  elements.btnCopyReport.addEventListener('click', copyReportToClipboard);
}

// ── 어플리케이션 시작 (Entry Point) ──
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  initEventListeners();
  renderAll();
});
