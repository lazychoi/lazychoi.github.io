let terms = [];

// CSV 파일을 읽어오는 함수
// search.js

// TSV 파일을 읽어오는 함수
function loadTermsFromCSV() {
    fetch('data.csv')
        .then(response => response.text())
        .then(data => {
            const lines = data.split('\n');
            lines.forEach((line, index) => {
                if (index === 0 || !line.trim()) return; // 첫 번째 라인(헤더)이나 빈 줄은 건너뜁니다.
                
                const values = line.split(';').map(value => value ? value.trim() : '');
                if (values.length >= 4) {  // 최소 4개의 값이 있는지 확인
                    terms.push({
                        term: values[0] || '',
                        foreignTerm: values[1] || '',
                        easyTerm: values[2] || '',
                        meaning: values[3] || ''
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

// ... 나머지 코드는 동일


// 용어를 검색하는 함수
// search.js
function searchTerms() {
    const query = document.getElementById('searchTerm').value.toLowerCase();
    const results = document.getElementById('results');
    const copyright = document.getElementById('copyright');
    results.innerHTML = '';

    if (query === '') {
        results.style.display = 'none';
        copyright.style.display = 'block'; 
        return;
    }

    results.style.display = 'block';

    const filteredTerms = terms.filter(t => 
        t.term.toLowerCase().includes(query) || 
        t.easyTerm.toLowerCase().includes(query)
    );

    filteredTerms.forEach(t => {
        const li = document.createElement('li');
        
        // 이미지 태그가 포함된 의미 텍스트 처리
        const processedMeaning = t.meaning.replace(
            /\[\[(.*?)\]\]/g,
            (match, filename) => `
                <div class="image-container">
                    <img src="img/${filename}" alt="${filename}" class="term-image">
                </div>
            `
        );

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

        copyright.style.display = 'none'; 
    });

    if (filteredTerms.length === 0) {
        results.textContent = '검색 결과가 없습니다.';
    }
}

// 페이지가 로드될 때 JSON 파일에서 용어를 불러옵니다.
window.onload = loadTermsFromCSV;
