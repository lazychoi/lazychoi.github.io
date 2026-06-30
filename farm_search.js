let terms = [];
console.log("[Diagnostics] farm_search.js v2 loaded successfully!");

// Helper function to render Markdown and protect Math formulas from markdown compilation
function renderMarkdownAndMath(text) {
    console.log("[Diagnostics] renderMarkdownAndMath execution. text content: ", text);
    console.log("[Diagnostics] marked global variable type: ", typeof marked);
    if (!text) return '';

    // 1. Temporarily extract math blocks to protect them from Markdown parsing
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

    // 2. Process image tags [[filename]]
    processed = processed.replace(
        /\[\[(.*?)\]\]/g,
        (match, filename) => `
            <div class="image-container">
                <img src="img/${filename}" alt="${filename}" class="term-image">
            </div>
        `
    );

    // 3. Render Markdown using marked.js if available
    let html = '';
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        html = marked.parse(processed);
    } else {
        // Fallback if marked is not loaded
        html = processed.replace(/\n/g, '<br>');
    }

    // 4. Restore math blocks
    mathBlocks.forEach(item => {
        const mathHtml = item.isBlock ? `$$${item.formula}$$` : `$${item.formula}$`;
        html = html.replace(item.placeholder, mathHtml);
    });

    return html;
}

// CSV 파일을 읽어오는 함수
function loadTermsFromCSV() {
    fetch('data/farm_data.txt')
        .then(response => response.text())
        .then(data => {
            const lines = data.split('\n');
            lines.forEach((line, index) => {
                if (index === 0 || !line.trim()) return; // 첫 번째 라인(헤더)이나 빈 줄은 건너뜁니다.
                
                // Safe parsing: only split by the first 3 '|' separators to keep formulas containing '|' in the meaning column.
                const parts = [];
                let temp = line;
                for (let i = 0; i < 3; i++) {
                    const idx = temp.indexOf('|');
                    if (idx === -1) break;
                    parts.push(temp.substring(0, idx));
                    temp = temp.substring(idx + 1);
                }
                parts.push(temp);

                const values = parts.map(value => value ? value.trim() : '');
                if (values.length >= 4) {  // 최소 4개의 값이 있는지 확인
                    // Unescape newlines (\n -> actual newline, \\ -> \)
                    const rawMeaning = values[3] || '';
                    const unescapedMeaning = rawMeaning
                        .replace(/(?<!\\)\\n/g, '\n')
                        .replace(/\\\\/g, '\\');

                    terms.push({
                        term: values[0] || '',
                        foreignTerm: values[1] || '',
                        easyTerm: values[2] || '',
                        meaning: unescapedMeaning
                    });
                }
            });
            const loadingMessage = document.getElementById('loadingMessage');
            if (loadingMessage) {
                loadingMessage.style.display = 'none'; // 데이터 로딩 완료 후 메시지 숨기기
            }
        })
        .catch(error => {
            console.error('Error loading CSV file:', error);
            const loadingMessage = document.getElementById('loadingMessage');
            if (loadingMessage) {
                loadingMessage.textContent = '데이터 로딩 중 오류가 발생했습니다.';
            }
        });
}


// 용어를 검색하는 함수
function searchTerms() {
    const query = document.getElementById('searchTerm').value.toLowerCase();
    const results = document.getElementById('results');
    results.innerHTML = '';

    if (query === '') {
        results.style.display = 'none';
        return;
    }

    results.style.display = 'block';

    const filteredTerms = terms.filter(t => 
        t.term.toLowerCase().includes(query) || 
        t.easyTerm.toLowerCase().includes(query)
    );

    filteredTerms.forEach(t => {
        const li = document.createElement('li');
        
        const processedMeaning = renderMarkdownAndMath(t.meaning);

        if(t.foreignTerm == "" && t.easyTerm == ""){
            li.innerHTML = `
                <span class="term">${t.term}</span>
                <div class="meaning">${processedMeaning}</div>
            `;
        } else if(t.easyTerm == ""){
            li.innerHTML = `
                <span class="term">${t.term}(${t.foreignTerm})</span>
                <div class="meaning">${processedMeaning}</div>
            `;
        } else if(t.foreignTerm == ""){
            li.innerHTML = `
                <span class="term">${t.term} → <span class="easyTerm">${t.easyTerm}</span></span>
                <div class="meaning">${processedMeaning}</div>
            `;
        } else{
            li.innerHTML = `
                <span class="term">${t.term}(${t.foreignTerm}) → <span class="easyTerm">${t.easyTerm}</span></span>
                <div class="meaning">${processedMeaning}</div>
            `;
        }

        if (li.parentElement !== results) {
            results.appendChild(li);
        }

        // Render KaTeX for math formulas
        if (typeof katex !== 'undefined') {
            // 1. Render ql-formula spans (with '|' replaced with '\')
            li.querySelectorAll('.ql-formula').forEach(el => {
                let formula = el.getAttribute('data-value');
                if (formula) {
                    formula = formula.replace(/\|/g, '\\');
                    try {
                        katex.render(formula, el, {
                            throwOnError: false,
                            displayMode: false
                        });
                    } catch (err) {
                        console.error('KaTeX ql-formula error:', err);
                    }
                }
            });

            // 2. Render standard inline/block LaTeX ($...$, $$...$$) using auto-render
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
        results.textContent = '검색 결과가 없습니다.';
    }
}

// 페이지가 로드될 때 JSON 파일에서 용어를 불러옵니다.
window.onload = loadTermsFromCSV;
