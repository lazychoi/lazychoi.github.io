let terms = [];
let editingIndex = -1; // -1 means adding, >= 0 means editing
let isDataLoaded = false; // Safety flag to prevent overwriting when not loaded

// 1. DOM Elements
const inputTerm = document.getElementById('inputTerm');
const inputForeign = document.getElementById('inputForeign');
const inputEasy = document.getElementById('inputEasy');
const inputMeaning = document.getElementById('inputMeaning');

const btnSubmit = document.getElementById('btnSubmit');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const inputSearch = document.getElementById('inputSearch');

// 2. Initialize: Fetch data/farm_data.txt from server on page load
window.addEventListener('DOMContentLoaded', () => {
    // Protocol check: warn if opened via file://
    if (window.location.protocol === 'file:') {
        alert('⚠️ 경고: 현재 브라우저가 로컬 파일(file://)로 직접 실행 중입니다.\n' +
              '이 상태에서는 보안 제약으로 인해 저장 요청(POST)을 보낼 수 없습니다.\n\n' +
              '반드시 터미널에서 "python3 admin_server.py"를 실행하신 후,\n' +
              'http://localhost:8000/farm_add.html 로 접속하여 작업해 주세요.');
    }

    loadDataFromServer();

    // Form inputs event listeners for real-time live preview
    inputTerm.addEventListener('input', updatePreview);
    inputForeign.addEventListener('input', updatePreview);
    inputEasy.addEventListener('input', updatePreview);
    inputMeaning.addEventListener('input', updatePreview);

    // Search bar event listener
    inputSearch.addEventListener('input', (e) => {
        renderTable(e.target.value);
    });

    // Button event listeners
    btnSubmit.addEventListener('click', handleFormSubmit);
    btnCancelEdit.addEventListener('click', cancelEditing);
});

// Load data from server
function loadDataFromServer() {
    fetch('data/farm_data.txt')
        .then(response => {
            if (!response.ok) throw new Error('서버에서 data/farm_data.txt 파일을 찾을 수 없습니다.');
            return response.text();
        })
        .then(text => {
            terms = parseCSV(text);
            isDataLoaded = true;
            renderTable();
            updatePreview();
        })
        .catch(err => {
            console.error('Error fetching data:', err);
            alert('데이터 로드 실패: ' + err.message);
        });
}

// 3. Parsing CSV text safely (respecting internal '|' inside math formulas)
function parseCSV(text) {
    const lines = text.split('\n');
    const parsedTerms = [];
    lines.forEach((line, index) => {
        if (index === 0 || !line.trim()) return; // skip header or empty lines
        
        const parts = [];
        let temp = line;
        for (let i = 0; i < 3; i++) {
            const idx = temp.indexOf('|');
            if (idx === -1) break;
            parts.push(temp.substring(0, idx));
            temp = temp.substring(idx + 1);
        }
        parts.push(temp);

        const values = parts.map(v => v ? v.trim() : '');
        if (values.length >= 4) {
            parsedTerms.push({
                term: values[0] || '',
                foreignTerm: values[1] || '',
                easyTerm: values[2] || '',
                meaning: values[3] || ''
            });
        }
    });
    return parsedTerms;
}

// 4. Generating CSV Text from terms array
function generateCSVText() {
    let csv = "표제어|외래어|쉬운용어|설명\n";
    terms.forEach(t => {
        csv += `${t.term}|${t.foreignTerm}|${t.easyTerm}|${t.meaning}\n`;
    });
    return csv;
}

// 5. Send the updated CSV content to our python backend server to save to data/farm_data.txt
function saveToServer() {
    const csvContent = generateCSVText();
    return fetch('/api/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain; charset=utf-8'
        },
        body: csvContent
    })
    .then(async response => {
        if (!response.ok) {
            let errMsg = `서버 저장 API 오류 (상태 코드: ${response.status} ${response.statusText})`;
            
            // Check if user is running standard HTTP server which returns 404 or 501 for POST
            if (response.status === 404 || response.status === 501 || response.status === 405) {
                errMsg += '\n\n💡 원인 분석 및 해결 방법:\n' +
                          '1. 터미널에서 "python3 admin_server.py"를 정상적으로 실행하셨나요?\n' +
                          '2. 혹시 VS Code Live Server나 기본 "python -m http.server"로 접속하셨나요?\n' +
                          '   → 이 경우 POST 요청을 받지 못해 에러가 납니다.\n' +
                          '   → 반드시 admin_server.py가 실행해 준 주소인 http://localhost:8000/farm_add.html 로 접속하세요.';
            } else {
                try {
                    const errData = await response.json();
                    if (errData && errData.error) {
                        errMsg += `\n\n서버 에러 내용:\n${errData.error}`;
                    }
                } catch (e) {}
            }
            throw new Error(errMsg);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('data/farm_data.txt에 성공적으로 저장되었습니다.');
        } else {
            throw new Error(data.error || '알 수 없는 오류');
        }
    })
    .catch(err => {
        console.error('Error saving to server:', err);
        alert('로컬 data/farm_data.txt 저장 실패:\n' + err.message);
    });
}

// 6. Live Preview Render Logic
function updatePreview() {
    const term = inputTerm.value.trim() || '표제어';
    const foreign = inputForeign.value.trim();
    const easy = inputEasy.value.trim();
    const meaning = inputMeaning.value.trim() || '용어의 설명이 이곳에 표시됩니다.';

    const previewCard = document.getElementById('previewCard');

    // Process image tags [[filename]]
    const processedMeaning = meaning.replace(
        /\[\[(.*?)\]\]/g,
        (match, filename) => `
            <div class="image-container">
                <img src="img/${filename}" alt="${filename}" class="term-image">
            </div>
        `
    );

    let html = '';
    if (foreign === '' && easy === '') {
        html = `
            <span class="term">${term}</span>
            <div class="meaning">${processedMeaning}</div>
        `;
    } else if (easy === '') {
        html = `
            <span class="term">${term}(${foreign})</span>
            <div class="meaning">${processedMeaning}</div>
        `;
    } else if (foreign === '') {
        html = `
            <span class="term">${term} → <span class="easyTerm">${easy}</span></span>
            <div class="meaning">${processedMeaning}</div>
        `;
    } else {
        html = `
            <span class="term">${term}(${foreign}) → <span class="easyTerm">${easy}</span></span>
            <div class="meaning">${processedMeaning}</div>
        `;
    }

    previewCard.innerHTML = html;

    // Render KaTeX for live preview
    if (typeof katex !== 'undefined') {
        // 1. Render ql-formula spans (with '|' replaced with '\')
        previewCard.querySelectorAll('.ql-formula').forEach(el => {
            let formula = el.getAttribute('data-value');
            if (formula) {
                formula = formula.replace(/\|/g, '\\');
                try {
                    katex.render(formula, el, {
                        throwOnError: false,
                        displayMode: false
                    });
                } catch (err) {
                    console.error('KaTeX ql-formula preview error:', err);
                }
            }
        });

        // 2. Render standard inline/block LaTeX ($...$, $$...$$) using auto-render
        if (typeof renderMathInElement === 'function') {
            try {
                renderMathInElement(previewCard, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\(', right: '\\)', display: false},
                        {left: '\\[', right: '\\]', display: true}
                    ],
                    throwOnError: false
                });
            } catch (err) {
                console.error('KaTeX auto-render preview error:', err);
            }
        }
    }
}

// 7. Form submission (Add or Edit)
async function handleFormSubmit() {
    if (!isDataLoaded) {
        alert('데이터 로딩 중입니다. 잠시만 기다려주세요.');
        return;
    }
    const termVal = inputTerm.value.trim();
    const foreignVal = inputForeign.value.trim();
    const easyVal = inputEasy.value.trim();
    const meaningVal = inputMeaning.value.trim();

    if (!termVal) {
        alert('표제어는 필수 입력 항목입니다.');
        inputTerm.focus();
        return;
    }

    const newTermObj = {
        term: termVal,
        foreignTerm: foreignVal,
        easyTerm: easyVal,
        meaning: meaningVal
    };

    if (editingIndex === -1) {
        // Adding new term: check duplicate
        const duplicateIdx = terms.findIndex(t => t.term.toLowerCase() === termVal.toLowerCase());
        if (duplicateIdx !== -1) {
            const editInstead = confirm(`이미 '${termVal}' 용어가 데이터에 존재합니다.\n이 기존 용어를 수정하시겠습니까?`);
            if (editInstead) {
                startEdit(duplicateIdx);
            }
            return;
        }

        // Add
        terms.push(newTermObj);
    } else {
        // Editing existing term
        terms[editingIndex] = newTermObj;
        editingIndex = -1;
        btnSubmit.innerHTML = '➕ 용어 추가하기';
        btnCancelEdit.style.display = 'none';
    }

    // Reset fields
    inputTerm.value = '';
    inputForeign.value = '';
    inputEasy.value = '';
    inputMeaning.value = '';
    
    // Save directly to server
    await saveToServer();
    
    renderTable(inputSearch.value);
    updatePreview();
}

// 8. Start Editing
window.startEdit = function(index) {
    if (index < 0 || index >= terms.length) return;
    
    editingIndex = index;
    const term = terms[index];
    
    inputTerm.value = term.term;
    inputForeign.value = term.foreignTerm;
    inputEasy.value = term.easyTerm;
    inputMeaning.value = term.meaning;

    btnSubmit.innerHTML = '✏️ 용어 수정완료';
    btnCancelEdit.style.display = 'inline-flex';
    
    // Scroll form into view
    document.querySelector('.form-grid').scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    updatePreview();
};

// 9. Cancel Editing
function cancelEditing() {
    editingIndex = -1;
    inputTerm.value = '';
    inputForeign.value = '';
    inputEasy.value = '';
    inputMeaning.value = '';
    
    btnSubmit.innerHTML = '➕ 용어 추가하기';
    btnCancelEdit.style.display = 'none';
    
    updatePreview();
}

// 10. Delete Term
window.deleteTerm = async function(index) {
    if (!isDataLoaded) {
        alert('데이터 로딩 중입니다. 잠시만 기다려주세요.');
        return;
    }
    if (index < 0 || index >= terms.length) return;
    
    const term = terms[index];
    const doubleCheck = confirm(`정말로 '${term.term}' 용어를 삭제하시겠습니까?`);
    if (doubleCheck) {
        // If the item deleted was currently being edited, cancel edit
        if (editingIndex === index) {
            cancelEditing();
        } else if (editingIndex > index) {
            // Adjust editing index if it was pointing after deleted item
            editingIndex--;
        }

        terms.splice(index, 1);
        
        // Save directly to server
        await saveToServer();
        
        renderTable(inputSearch.value);
    }
};

// 11. Render Table with display limit = 2
function renderTable(filterText = '') {
    const tbody = document.getElementById('termsTableBody');
    tbody.innerHTML = '';

    const query = filterText.toLowerCase().trim();
    const filtered = terms.filter(t => 
        t.term.toLowerCase().includes(query) || 
        t.meaning.toLowerCase().includes(query) ||
        t.easyTerm.toLowerCase().includes(query) ||
        t.foreignTerm.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">
                    검색 결과가 없습니다.
                </td>
            </tr>
        `;
        return;
    }

    const displayLimit = 2; // Show only the first 2 items
    const itemsToDisplay = filtered.slice(0, displayLimit);

    itemsToDisplay.forEach((t) => {
        const globalIndex = terms.indexOf(t);
        const tr = document.createElement('tr');
        
        let detailsHtml = '';
        if (t.foreignTerm && t.easyTerm) {
            detailsHtml = `<span style="font-weight: bold; color: var(--accent-green);">${t.easyTerm}</span><br><span style="font-size: 12px; color: var(--text-muted);">${t.foreignTerm}</span>`;
        } else if (t.easyTerm) {
            detailsHtml = `<span style="font-weight: bold; color: var(--accent-green);">${t.easyTerm}</span>`;
        } else if (t.foreignTerm) {
            detailsHtml = `<span style="font-size: 12px; color: var(--text-muted);">${t.foreignTerm}</span>`;
        } else {
            detailsHtml = `<span style="color: var(--text-muted);">-</span>`;
        }

        // Clean meaning text for table preview (strip html tags, truncate)
        let cleanMeaning = t.meaning.replace(/<[^>]*>/g, '');
        if (cleanMeaning.length > 60) {
            cleanMeaning = cleanMeaning.substring(0, 60) + '...';
        }
        if (!cleanMeaning) {
            cleanMeaning = '<span style="color: var(--text-muted); font-style: italic;">설명 없음</span>';
        }

        tr.innerHTML = `
            <td style="font-weight: bold; color: var(--text-main);">${t.term}</td>
            <td>${detailsHtml}</td>
            <td><div class="meaning-cell-text" title="${t.meaning.replace(/"/g, '&quot;')}">${cleanMeaning}</div></td>
            <td class="actions">
                <button class="btn btn-secondary btn-mini" onclick="startEdit(${globalIndex})">✏️ 수정</button>
                <button class="btn btn-danger btn-mini" onclick="deleteTerm(${globalIndex})">❌ 삭제</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (filtered.length > displayLimit) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="4" style="text-align: center; color: var(--accent); font-weight: bold; background: rgba(129, 140, 248, 0.05); padding: 10px;">
                ⚠ 총 ${filtered.length}개 항목 중 처음 ${displayLimit}개만 표시하고 있습니다. 특정 항목을 찾으려면 검색창을 이용해 주세요.
            </td>
        `;
        tbody.appendChild(tr);
    }
}
