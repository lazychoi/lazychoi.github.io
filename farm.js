// Supabase Client Initialization
const supabaseUrl = 'https://tpwwwpcbinxdhxqvcvqc.supabase.co';
const supabaseKey = 'sb_publishable_A1sd3hvbeQx9-gVoFXL0qA_G923SWm9';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let terms = [];
let editingId = null; // 수정 시 DB 고유 ID를 보관 (동음이의어 지원)
let isLoggedIn = false; // 로그인 상태 여부

// 1. DOM Elements
const searchTerm = document.getElementById('searchTerm');
const resultsList = document.getElementById('results');
const loadingMessage = document.getElementById('loadingMessage');

// Auth DOM
const authStatusText = document.getElementById('authStatusText');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const loginDialog = document.getElementById('loginDialog');
const loginForm = document.getElementById('loginForm');
const btnCancelLogin = document.getElementById('btnCancelLogin');

// CRUD DOM
const btnShowAddModal = document.getElementById('btnShowAddModal');
const termFormDialog = document.getElementById('termFormDialog');
const termForm = document.getElementById('termForm');
const termFormTitle = document.getElementById('termFormTitle');
const btnSubmitTerm = document.getElementById('btnSubmitTerm');
const btnCancelTerm = document.getElementById('btnCancelTerm');

const inputTerm = document.getElementById('inputTerm');
const inputForeign = document.getElementById('inputForeign');
const inputEasy = document.getElementById('inputEasy');
const inputMeaning = document.getElementById('inputMeaning');
const previewCard = document.getElementById('previewCard');

// 2. Initialize
window.addEventListener('DOMContentLoaded', () => {
    console.log("[Diagnostics] farm.js Consolidated App loaded!");

    // Listen to Auth State Changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        const user = session?.user;
        isLoggedIn = !!user;

        if (user) {
            const adminNick = user.email.split('@')[0];
            authStatusText.innerHTML = `🟢 ${adminNick}`;
            btnLogin.style.display = 'none';
            btnLogout.style.display = 'inline-flex';
            btnShowAddModal.style.display = 'inline-flex';
        } else {
            authStatusText.innerHTML = '';
            btnLogin.style.display = 'inline-flex';
            btnLogout.style.display = 'none';
            btnShowAddModal.style.display = 'none';
        }

        // 로그인 상태에 따른 검색 리스트 실시간 리렌더링
        searchTerms();
    });

    // Login Dialog Events
    btnLogin.addEventListener('click', () => {
        loginDialog.showModal();
    });

    btnCancelLogin.addEventListener('click', () => {
        loginDialog.close();
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const submitBtn = document.getElementById('btnSubmitLogin');

        submitBtn.disabled = true;
        submitBtn.textContent = '로그인 중...';

        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

        submitBtn.disabled = false;
        submitBtn.textContent = '로그인';

        if (error) {
            alert('로그인 실패: ' + error.message);
        } else {
            loginForm.reset();
            loginDialog.close();
        }
    });

    btnLogout.addEventListener('click', async () => {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            alert('로그아웃 실패: ' + error.message);
        }
    });

    // Term Form Dialog Events (용어 추가/수정)
    btnShowAddModal.addEventListener('click', () => {
        editingId = null;
        termFormTitle.textContent = '➕ 새 용어 추가';
        btnSubmitTerm.innerHTML = '➕ 추가하기';
        termForm.reset();
        updatePreview();
        termFormDialog.showModal();
    });

    btnCancelTerm.addEventListener('click', () => {
        termFormDialog.close();
    });

    // Form inputs event listeners for real-time live preview inside dialog
    inputTerm.addEventListener('input', updatePreview);
    inputForeign.addEventListener('input', updatePreview);
    inputEasy.addEventListener('input', updatePreview);
    inputMeaning.addEventListener('input', updatePreview);

    termForm.addEventListener('submit', handleFormSubmit);

    // Initial load
    loadTermsFromSupabase();
});

// Load data from Supabase (paginated, bypassing 1000 limit)
async function loadTermsFromSupabase() {
    try {
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let keepFetching = true;

        while (keepFetching) {
            const { data, error } = await supabaseClient
                .from('terms')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1)
                .order('id', { ascending: true });

            if (error) throw error;

            allData = allData.concat(data);
            if (data.length < pageSize) {
                keepFetching = false;
            } else {
                page++;
            }
        }

        terms = allData.map(row => ({
            id: row.id,
            term: row.term || '',
            foreignTerm: row.foreign_term || '',
            easyTerm: row.easy_term || '',
            meaning: row.meaning || ''
        }));
        
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
        searchTerms(); // 초기 로드 후 검색 렌더링 동기화
    } catch (error) {
        console.error('Error loading data from Supabase:', error);
        if (loadingMessage) {
            loadingMessage.textContent = '데이터 로딩 중 오류가 발생했습니다.';
        }
    }
}

// Helper function to render Markdown and protect Math formulas from markdown compilation
function renderMarkdownAndMath(text) {
    if (!text) return '';

    const mathBlocks = [];
    let processed = text;

    // Match $$ ... $$ (block math)
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
        const placeholder = `%%BLOCKMATH_${mathBlocks.length}%%`;
        mathBlocks.push({ placeholder, formula, isBlock: true });
        return placeholder;
    });

    // Match $ ... $ (inline math)
    processed = processed.replace(/\$([^\$]+?)\$/g, (match, formula) => {
        const placeholder = `%%INLINEMATH_${mathBlocks.length}%%`;
        mathBlocks.push({ placeholder, formula, isBlock: false });
        return placeholder;
    });

    // 2. Process image tags [[filename]] (Clean single-line to avoid markdown codeblock issue)
    processed = processed.replace(
        /\[\[(.*?)\]\]/g,
        (match, filename) => `<div class="image-container"><img src="img/${filename}" alt="${filename}" class="term-image"></div>`
    );

    // 3. Render Markdown using marked.js if available
    let html = '';
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        html = marked.parse(processed);
    } else {
        html = processed.replace(/\n/g, '<br>');
    }

    // 4. Restore math blocks
    mathBlocks.forEach(item => {
        const mathHtml = item.isBlock ? `$$${item.formula}$$` : `$${item.formula}$`;
        html = html.replace(item.placeholder, mathHtml);
    });

    return html;
}

// Live Preview Render Logic
function updatePreview() {
    const term = inputTerm.value.trim() || '표제어';
    const foreign = inputForeign.value.trim();
    const easy = inputEasy.value.trim();
    const meaning = inputMeaning.value.trim() || '용어의 설명이 이곳에 표시됩니다.';

    const processedMeaning = renderMarkdownAndMath(meaning);

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
        previewCard.querySelectorAll('.ql-formula').forEach(el => {
            let formula = el.getAttribute('data-value');
            if (formula) {
                formula = formula.replace(/\|/g, '\\');
                try {
                    katex.render(formula, el, { throwOnError: false, displayMode: false });
                } catch (err) {
                    console.error('KaTeX ql-formula preview error:', err);
                }
            }
        });

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

// 용어를 검색하고 조건부 렌더링하는 함수
function searchTerms() {
    const query = searchTerm.value.toLowerCase().trim();
    resultsList.innerHTML = '';

    if (query === '') {
        resultsList.style.display = 'none';
        return;
    }

    resultsList.style.display = 'block';

    const filteredTerms = terms.filter(t => 
        t.term.toLowerCase().includes(query) || 
        t.easyTerm.toLowerCase().includes(query) ||
        t.foreignTerm.toLowerCase().includes(query)
    );

    filteredTerms.forEach(t => {
        const li = document.createElement('li');
        li.className = 'term-card';
        
        const processedMeaning = renderMarkdownAndMath(t.meaning);
        
        // 1. Title formatting based on values
        let titleHtml = '';
        if (t.foreignTerm === "" && t.easyTerm === "") {
            titleHtml = `<span class="term">${t.term}</span>`;
        } else if (t.easyTerm === "") {
            titleHtml = `<span class="term">${t.term}(${t.foreignTerm})</span>`;
        } else if (t.foreignTerm === "") {
            titleHtml = `<span class="term">${t.term} → <span class="easyTerm">${t.easyTerm}</span></span>`;
        } else {
            titleHtml = `<span class="term">${t.term}(${t.foreignTerm}) → <span class="easyTerm">${t.easyTerm}</span></span>`;
        }

        // 2. Action buttons if logged in
        let actionsHtml = '';
        if (isLoggedIn) {
            // we pass the unique id directly
            actionsHtml = `
                <div class="term-card-actions">
                    <button class="btn btn-secondary btn-mini" onclick="startEdit(${t.id})">✏️ 수정</button>
                    <button class="btn btn-danger btn-mini" onclick="deleteTerm(${t.id})">❌ 삭제</button>
                </div>
            `;
        }

        // 3. Assemble Card Layout
        li.innerHTML = `
            <div class="term-card-header">
                ${titleHtml}
                ${actionsHtml}
            </div>
            <div class="meaning">${processedMeaning}</div>
        `;

        resultsList.appendChild(li);

        // Render KaTeX for math formulas
        if (typeof katex !== 'undefined') {
            li.querySelectorAll('.ql-formula').forEach(el => {
                let formula = el.getAttribute('data-value');
                if (formula) {
                    formula = formula.replace(/\|/g, '\\');
                    try {
                        katex.render(formula, el, { throwOnError: false, displayMode: false });
                    } catch (err) {
                        console.error('KaTeX ql-formula error:', err);
                    }
                }
            });

            if (typeof renderMathInElement === 'function') {
                try {
                    renderMathInElement(li, {
                        delimiters: [
                            {left: '$$', right: '$$', display: true},
                            {left: '$', right: '$', display: false},
                            {left: '\\(', right: '\\)', display: false},
                            {left: '\\[', right: '\\]', display: true}
                        ],
                        throwOnError: false
                    });
                } catch (err) {
                    console.error('KaTeX auto-render error:', err);
                }
            }
        }
    });

    if (filteredTerms.length === 0) {
        resultsList.innerHTML = '<li style="text-align: center; color: var(--text-muted); padding: 20px;">검색 결과가 없습니다.</li>';
    }
}

// Form submission (Add or Edit)
async function handleFormSubmit(e) {
    e.preventDefault();
    const termVal = inputTerm.value.trim();
    const foreignVal = inputForeign.value.trim();
    const easyVal = inputEasy.value.trim();
    const meaningVal = inputMeaning.value.trim();

    if (!termVal) return;

    const termData = {
        term: termVal,
        foreign_term: foreignVal,
        easy_term: easyVal,
        meaning: meaningVal
    };

    const submitBtn = document.getElementById('btnSubmitTerm');
    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';

    try {
        if (editingId === null) {
            // Add Mode: check local duplicate first
            const duplicate = terms.find(t => t.term.toLowerCase() === termVal.toLowerCase());
            if (duplicate) {
                const editInstead = confirm(`이미 '${termVal}' 용어가 데이터에 존재합니다.\n이 기존 용어를 수정하시겠습니까?`);
                if (editInstead) {
                    termFormDialog.close();
                    startEdit(duplicate.id);
                }
                submitBtn.disabled = false;
                submitBtn.innerHTML = '➕ 추가하기';
                return;
            }

            // Insert
            const { data, error } = await supabaseClient.from('terms').insert([termData]).select();
            if (error) throw error;

            const inserted = data[0];
            terms.push({
                id: inserted.id,
                term: inserted.term,
                foreignTerm: inserted.foreign_term,
                easyTerm: inserted.easy_term,
                meaning: inserted.meaning
            });
        } else {
            // Edit Mode
            const { error } = await supabaseClient.from('terms').update(termData).eq('id', editingId);
            if (error) throw error;

            // Update local memory
            const idx = terms.findIndex(t => t.id === editingId);
            if (idx !== -1) {
                terms.splice(idx, 1);
            }
            terms.push({
                id: editingId,
                term: termVal,
                foreignTerm: foreignVal,
                easyTerm: easyVal,
                meaning: meaningVal
            });
            editingId = null;
        }

        termForm.reset();
        termFormDialog.close();
        searchTerms();
    } catch (err) {
        console.error('Error saving term:', err);
        alert('DB 저장 실패: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = editingId === null ? '➕ 추가하기' : '✏️ 수정완료';
    }
}

// Start Editing
window.startEdit = function(id) {
    const term = terms.find(t => t.id === id);
    if (!term) return;

    editingId = id;
    termFormTitle.textContent = '✏️ 용어 수정';
    btnSubmitTerm.innerHTML = '✏️ 수정완료';

    inputTerm.value = term.term;
    inputForeign.value = term.foreignTerm || '';
    inputEasy.value = term.easyTerm || '';
    inputMeaning.value = term.meaning || '';

    updatePreview();
    termFormDialog.showModal();
};

// Cancel Editing
function cancelEditing() {
    editingId = null;
    inputTerm.value = '';
    inputForeign.value = '';
    inputEasy.value = '';
    inputMeaning.value = '';
    
    btnSubmit.innerHTML = '➕ 용어 추가하기';
    btnCancelEdit.style.display = 'none';
    
    // Clear search
    inputSearch.value = '';
    if (btnClearSearch) btnClearSearch.style.display = 'none';

    updatePreview();
    renderTable('');
}

// Delete Term
window.deleteTerm = async function(id) {
    const term = terms.find(t => t.id === id);
    if (!term) return;

    const doubleCheck = confirm(`정말로 '${term.term}' 용어를 삭제하시겠습니까?`);
    if (doubleCheck) {
        try {
            const { error } = await supabaseClient.from('terms').delete().eq('id', id);
            if (error) throw error;

            // Remove locally
            const idx = terms.findIndex(t => t.id === id);
            if (idx !== -1) {
                terms.splice(idx, 1);
            }

            // Close form dialog if currently editing this deleted item
            if (editingId === id) {
                editingId = null;
                termForm.reset();
                termFormDialog.close();
            }

            searchTerms();
        } catch (err) {
            console.error('Error deleting term:', err);
            alert('삭제 실패: ' + err.message);
        }
    }
};
