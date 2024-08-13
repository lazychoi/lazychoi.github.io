let terms = [];

// JSON 파일을 읽어오는 함수
function loadTermsFromJSON() {
    const loadingMessage = document.getElementById('loadingMessage');
    loadingMessage.style.display = 'block'; // 로딩 메시지 보이기

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            terms = data; // 데이터를 전역 배열에 할당
            loadingMessage.style.display = 'none'; // 데이터 로딩 완료 후 메시지 숨기기
        })
        .catch(error => {
            console.error('Error loading JSON file:', error);
            loadingMessage.textContent = '데이터를 로드하는 중 오류가 발생했습니다.';
        });
}

// 용어를 검색하는 함수
function searchTerms() {
    const query = document.getElementById('searchTerm').value.toLowerCase();
    const results = document.getElementById('results');
    const copyright = document.getElementById('copyright');
    results.innerHTML = ''; // 결과 리스트를 초기화

    if (query === '') {
        results.style.display = 'none'; // 검색어가 없을 때 결과를 숨김
        copyright.style.display = 'block'; 
        return;
    }

    results.style.display = 'block'; // 검색어가 있을 때 결과를 표시

    // 기존용어와 쉬운용어 모두 검색 대상으로 포함
    const filteredTerms = terms.filter(t => 
        t['기존용어'].toLowerCase().includes(query) || 
        t['쉬운용어'].toLowerCase().includes(query)
    );

    // 검색 결과를 DOM에 추가
    filteredTerms.forEach(t => {
        const li = document.createElement('li');
        if(t['원어'] == "" && t['쉬운용어'] == ""){
            li.innerHTML = `
                <span class="term">${t['기존용어']}</span>
                <div class="meaning">${t['뜻']}</div>
            `;
        } else if(t['쉬운용어'] == ""){
            li.innerHTML = `
                <span class="term">${t['기존용어']}(${t['원어']})</span>
                <div class="meaning">${t['뜻']}</div>
            `;
        } else if(t['원어'] == ""){
            li.innerHTML = `
                <span class="term">${t['기존용어']} → <span class="easyTerm">${t['쉬운용어']}</span></span>
                <div class="meaning">${t['뜻']}</div>
            `;
        } else{
            li.innerHTML = `
                <span class="term">${t['기존용어']}(${t['원어']}) → <span class="easyTerm">${t['쉬운용어']}</span></span>
                <div class="meaning">${t['뜻']}</div>
            `;
        }

        // 'results' 요소가 이미 다른 요소에 포함되어 있지 않은지 확인
        if (li.parentElement !== results) {
            results.appendChild(li); // li 요소를 results에 추가
        }

        // 결과화면에서 copyright 감추기
        copyright.style.display = 'none'; 
    });

    if (filteredTerms.length === 0) {
        results.textContent = '검색 결과가 없습니다.';
    }
}

// 페이지가 로드될 때 JSON 파일에서 용어를 불러옵니다.
window.onload = loadTermsFromJSON;