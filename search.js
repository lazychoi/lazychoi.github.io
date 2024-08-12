let terms = [];

// TSV 파일을 읽어오는 함수
function loadTermsFromTSV() {
    const loadingMessage = document.getElementById('loadingMessage');
    loadingMessage.style.display = 'block'; // 로딩 메시지 보이기

    fetch('data.tsv')
        .then(response => response.text())
        .then(data => {
            const lines = data.split('\n');
            lines.forEach((line, index) => {
                if (index === 0) return; // 첫 번째 라인은 헤더이므로 건너뜁니다.
                const [term, original, easyTerm, meaning] = line.split('\t');
                if (term && original && easyTerm && meaning) {
                    terms.push({
                        term: term.trim(),
                        original: original.trim(),
                        easyTerm: easyTerm.trim(),
                        meaning: meaning.trim()
                    });
                }
            });
            loadingMessage.style.display = 'none'; // 데이터 로딩 완료 후 메시지 숨기기
        })
        .catch(error => {
            console.error('Error loading TSV file:', error);
            loadingMessage.textContent = '데이터를 로드하는 중 오류가 발생했습니다.';
        });
}

// 용어를 검색하는 함수
function searchTerms() {
    const query = document.getElementById('searchTerm').value.toLowerCase();
    const results = document.getElementById('results');
    results.innerHTML = '';

    if (query === '') {
        results.style.display = 'none'; // 검색어가 없을 때 결과를 숨깁니다.
        return;
    }

    results.style.display = 'block'; // 검색어가 있을 때 결과를 보이게 합니다.
    
    // 기존용어와 쉬운용어 모두 검색 대상으로 포함
    const filteredTerms = terms.filter(t => 
        t.term.toLowerCase().includes(query) || 
        t.easyTerm.toLowerCase().includes(query)
    );

    if (filteredTerms.length === 0) {
        results.innerHTML = '<li>검색 결과가 없습니다.</li>';
        return;
    }

    filteredTerms.forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="term">${t.term} (${t.original}) → <span class="easyTerm">${t.easyTerm}</span></span><br><br>
            <span class="meaning">${t.meaning}</span>
        `;
        results.appendChild(li);
    });
}

// 페이지가 로드될 때 TSV 파일에서 용어를 불러옵니다.
window.onload = loadTermsFromTSV;