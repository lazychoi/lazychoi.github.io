// Supabase Client Initialization
const supabaseUrl = 'https://tpwwwpcbinxdhxqvcvqc.supabase.co';
const supabaseKey = 'sb_publishable_A1sd3hvbeQx9-gVoFXL0qA_G923SWm9';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ── Application States ──
let allEvents = [];         // Supabase에서 로드한 전체 사건 목록 (연도순 정렬)
let loadedEvents = [];      // 현재 타임라인에 로드되어 있는 사건 목록
let anchorEvent = null;      // 검색 기준이 된 사건 객체
let isLoggedIn = false;      // 로그인 여부
let aiSearchMode = true;    // AI 검색 모드 상태 (구글 AI Overview 유도)
let editingEventId = null;   // 수정 중인 사건의 ID (null이면 신규 등록)
let isFetching = false;      // 무한 스크롤 중복 방지 플래그

// 인덱스 범위 기억 변수
let currentStartIdx = 0;
let currentEndIdx = 0;

// 페이징당 불러올 사건 수
const PAGE_LIMIT = 8;

// ── DOM Elements ──
const searchTerm = document.getElementById('searchTerm');
const emptyState = document.getElementById('emptyState');
const timelineWrapper = document.getElementById('timelineWrapper');
const timelineItemsList = document.getElementById('timelineItemsList');
const btnPrevHistory = document.getElementById('btnPrevHistory');
const btnNextHistory = document.getElementById('btnNextHistory');
const btnShowAddModal = document.getElementById('btnShowAddModal');

// Auth DOM
const authStatusText = document.getElementById('authStatusText');
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const loginDialog = document.getElementById('loginDialog');
const loginForm = document.getElementById('loginForm');
const btnCancelLogin = document.getElementById('btnCancelLogin');

// Form DOM
const timelineFormDialog = document.getElementById('timelineFormDialog');
const timelineForm = document.getElementById('timelineForm');
const formTitle = document.getElementById('formTitle');
const inputYear = document.getElementById('inputYear');
const inputEvent = document.getElementById('inputEvent');
const btnSubmitForm = document.getElementById('btnSubmitForm');
const btnCancelForm = document.getElementById('btnCancelForm');

// ── Initialize ──
window.addEventListener('DOMContentLoaded', () => {
    console.log("[Timeline] App Initialized.");

    // 최초 전체 데이터 로드
    loadAllEvents();

    // 1. Supabase 인증 리스너 등록
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

        // 로그인 상태가 변경되면 수정/삭제 버튼이 렌더링되거나 사라져야 하므로 타임라인 재렌더링
        renderTimeline();
    });

    // 2. 실시간 검색 이벤트 등록 (input 이벤트)
    searchTerm.addEventListener('input', filterEventsRealtime);

    // Enter 입력 시 기본 제출 동작 방지 및 실시간 검색 실행
    searchTerm.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            filterEventsRealtime();
        }
    });

    // 3. 인증 다이얼로그 제어
    btnLogin.addEventListener('click', () => loginDialog.showModal());
    btnCancelLogin.addEventListener('click', () => loginDialog.close());
    loginForm.addEventListener('submit', handleLogin);
    btnLogout.addEventListener('click', handleLogout);

    // 4. CRUD 다이얼로그 제어
    btnShowAddModal.addEventListener('click', () => {
        editingEventId = null;
        formTitle.textContent = '➕ 새 사건 추가';
        btnSubmitForm.textContent = '➕ 추가하기';
        timelineForm.reset();
        timelineFormDialog.showModal();
    });
    btnCancelForm.addEventListener('click', () => timelineFormDialog.close());
    timelineForm.addEventListener('submit', handleFormSubmit);

    // 5. 이전/이후 역사 더 보기 버튼 리스너
    btnPrevHistory.addEventListener('click', fetchPreviousChunk);
    btnNextHistory.addEventListener('click', fetchNextChunk);

    // 6. 무한 스크롤 이벤트 리스너 등록
    window.addEventListener('scroll', handleScrollInfinite);
});

// ── Supabase로부터 전체 데이터 로드 (1000개 단위 페이징 우회) ──
async function loadAllEvents() {
    try {
        let page = 0;
        const pageSize = 1000;
        let keepFetching = true;
        let tempEvents = [];

        while (keepFetching) {
            const { data, error } = await supabaseClient
                .from('history_timeline')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1)
                .order('year', { ascending: true })
                .order('id', { ascending: true });

            if (error) throw error;

            tempEvents = tempEvents.concat(data);
            if (data.length < pageSize) {
                keepFetching = false;
            } else {
                page++;
            }
        }
        
        allEvents = tempEvents;
        console.log(`[Timeline] Loaded ${allEvents.length} events from Supabase.`);
        
        // 데이터 로드 완료 후 검색어 필터 즉시 동기화
        if (searchTerm.value.trim()) {
            filterEventsRealtime();
        }
    } catch (err) {
        console.error("Error loading all events:", err);
    }
}

// ── Auth Handlers ──
async function handleLogin(e) {
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
}

async function handleLogout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        alert('로그아웃 실패: ' + error.message);
    }
}

// ── 실시간 검색 및 타임라인 로드 ──
function filterEventsRealtime() {
    const query = searchTerm.value.trim();
    
    if (!query) {
        loadedEvents = [];
        anchorEvent = null;
        timelineWrapper.style.display = 'none';
        emptyState.style.display = 'flex';
        // 초기 멘트 복구
        emptyState.innerHTML = `
            <div class="empty-icon">🔍</div>
            <h3 style="font-weight: 700; color: var(--text-main); font-size: 17px;">타임라인 탐색을 시작하세요</h3>
            <p style="font-size: 14px; line-height: 1.5; margin: 0; max-width: 400px; word-break: keep-all;">
                연도나 키워드를 입력하고 검색하면 매칭된 사건을 중심으로 이전/이후의 역사적 흐름이 한눈에 펼쳐집니다.
            </p>
        `;
        return;
    }

    loadedEvents = [];
    anchorEvent = null;

    // 1. 사건 내용 텍스트 매칭 검색
    let matchedEvents = allEvents.filter(ev => 
        ev.event.toLowerCase().includes(query.toLowerCase())
    );

    // 2. 매칭 결과가 없고 검색어가 숫자인 경우, 가장 가까운 연도의 사건을 매칭
    if (matchedEvents.length === 0 && !isNaN(query)) {
        const targetYear = parseInt(query, 10);
        if (allEvents.length > 0) {
            const closest = allEvents.reduce((prev, curr) => 
                Math.abs(curr.year - targetYear) < Math.abs(prev.year - targetYear) ? curr : prev
            );
            anchorEvent = closest;
        }
    } else if (matchedEvents.length > 0) {
        // 첫 번째 검색 결과를 기준 사건(Anchor)으로 삼음
        anchorEvent = matchedEvents[0];
    }

    // 3. 앵커 사건을 기준으로 타임라인 맨 위에 오도록 슬라이싱
    if (anchorEvent) {
        const anchorIdx = allEvents.findIndex(ev => ev.id === anchorEvent.id);
        
        if (anchorIdx !== -1) {
            currentStartIdx = anchorIdx;
            // 맨 위에 앵커가 오도록 하고 최초 로딩 시에는 PAGE_LIMIT(8개)만 로드해 성능 최적화
            currentEndIdx = Math.min(allEvents.length - 1, anchorIdx + PAGE_LIMIT - 1);
            loadedEvents = allEvents.slice(currentStartIdx, currentEndIdx + 1);
        }

        emptyState.style.display = 'none';
        timelineWrapper.style.display = 'flex';
        renderTimeline();
    } else {
        // 일치하는 사건이 없을 때
        loadedEvents = [];
        timelineWrapper.style.display = 'none';
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `
            <div class="empty-icon" style="font-size: 3rem; margin-bottom: 10px;">⚠️</div>
            <h3 style="font-weight: 700; color: var(--text-main); font-size: 17px; margin-bottom: 8px;">검색 결과가 없습니다</h3>
            <p style="font-size: 14.5px; line-height: 1.6; margin: 0; max-width: 440px; word-break: keep-all; color: var(--text-muted); text-align: center;">
                '${query}'에 매칭되는 사건이나 연도가 발견되지 않았습니다. 다른 키워드로 검색해 보세요.
            </p>
        `;
    }
}

// ── 더 보기 버튼 클릭 핸들러 (로컬 인덱스 범위 확장) ──
function fetchPreviousChunk() {
    if (currentStartIdx === 0) {
        alert("이전 역사의 끝에 도달했습니다.");
        return;
    }
    
    const prevBtn = document.getElementById('btnPrevHistory');
    prevBtn.disabled = true;
    prevBtn.textContent = '로드 중...';

    setTimeout(() => {
        currentStartIdx = Math.max(0, currentStartIdx - PAGE_LIMIT);
        loadedEvents = allEvents.slice(currentStartIdx, currentEndIdx + 1);
        
        prevBtn.disabled = false;
        prevBtn.textContent = '▲ 이전 역사 더 보기';
        renderTimeline();
    }, 100);
}

function fetchNextChunk() {
    if (currentEndIdx === allEvents.length - 1) {
        alert("이후 역사의 끝에 도달했습니다.");
        return;
    }
    
    const nextBtn = document.getElementById('btnNextHistory');
    nextBtn.disabled = true;
    nextBtn.textContent = '로드 중...';

    setTimeout(() => {
        currentEndIdx = Math.min(allEvents.length - 1, currentEndIdx + PAGE_LIMIT);
        loadedEvents = allEvents.slice(currentStartIdx, currentEndIdx + 1);
        
        nextBtn.disabled = false;
        nextBtn.textContent = '▼ 이후 역사 더 보기';
        renderTimeline();
    }, 100);
}

// ── 앵커 카드로 스크롤 이동 및 포커스 효과 ──
function focusAnchorCard() {
    setTimeout(() => {
        const anchorCard = document.querySelector('.timeline-item.anchor');
        if (anchorCard) {
            anchorCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
}

// ── 무한 스크롤 핸들러 (스크롤이 바닥에 닿으면 아래 데이터 자동 로딩) ──
function handleScrollInfinite() {
    if (timelineWrapper.style.display === 'none' || loadedEvents.length === 0) return;
    if (isFetching) return;

    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const clientHeight = document.documentElement.clientHeight;

    // 바닥으로부터 150px 이내로 스크롤 도달 시
    if (scrollHeight - scrollTop - clientHeight < 150) {
        if (currentEndIdx >= allEvents.length - 1) return; // 더 이상 데이터 없음

        isFetching = true;
        const nextBtn = document.getElementById('btnNextHistory');
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.textContent = '로드 중...';
        }

        setTimeout(() => {
            currentEndIdx = Math.min(allEvents.length - 1, currentEndIdx + PAGE_LIMIT);
            loadedEvents = allEvents.slice(currentStartIdx, currentEndIdx + 1);
            
            if (nextBtn) {
                nextBtn.disabled = false;
                nextBtn.textContent = '▼ 이후 역사 더 보기';
            }
            renderTimeline();
            isFetching = false;
        }, 120); // 부드러운 흐름을 위해 가볍게 딜레이 제공
    }
}

// ── 연도 포맷팅 함수 (음수일 때만 앞에 BC 추가) ──
function formatYear(year) {
    const y = parseInt(year, 10);
    if (isNaN(y)) return '';
    return y < 0 ? `BC ${Math.abs(y)}` : `${y}`;
}

// ── HTML Rendering ──
function renderTimeline() {
    timelineItemsList.innerHTML = '';
    
    if (loadedEvents.length === 0) return;

    // AI 모드가 활성화되어 있으므로 전체 컨테이너에 ai-active 클래스 상시 주입
    timelineWrapper.classList.add('ai-active');

    loadedEvents.forEach((ev, index) => {
        const isLeft = index % 2 === 0;
        const isAnchor = anchorEvent && ev.id === anchorEvent.id;
        
        const itemDiv = document.createElement('div');
        itemDiv.className = `timeline-item ${isLeft ? 'left' : 'right'} ${isAnchor ? 'anchor' : ''}`;
        itemDiv.setAttribute('data-id', ev.id);
        
        // Admin 기능 버튼 렌더링
        let adminActionHTML = '';
        if (isLoggedIn) {
            adminActionHTML = `
                <div class="admin-actions">
                    <button class="btn-icon-only edit" onclick="openEditForm(${ev.id})" title="수정">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button class="btn-icon-only delete" onclick="deleteEvent(${ev.id})" title="삭제">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            `;
        }

        const parsedContent = parseEventText(ev.event);

        itemDiv.innerHTML = `
            <div class="timeline-badge"></div>
            <div class="timeline-card">
                <div class="timeline-card-header">
                    <span class="timeline-year">${formatYear(ev.year)}</span>
                </div>
                <div class="timeline-event-content">${parsedContent}</div>
                ${adminActionHTML}
            </div>
        `;
        
        timelineItemsList.appendChild(itemDiv);
    });
}

// ── [[텍스트]] 파싱 및 구글 검색/AI 모드 링크 치환 ──
function parseEventText(text) {
    if (!text) return '';
    return text.replace(/\[\[(.*?)\]\]/g, (match, keyword) => {
        const cleanKeyword = keyword.trim();
        const encodedKeyword = encodeURIComponent(cleanKeyword);
        let url = `https://www.google.com/search?q=${encodedKeyword}`;
        
        if (aiSearchMode) {
            // AI 검색 모드 활성화 시, 구글에서 AI 요약(AI Overview)을 강하게 유도하는 접미사 쿼리 추가
            url += `+역사적+배경+및+의의+설명`;
        }
        
        return `<a class="event-link" href="${url}" target="_blank" rel="noopener noreferrer">${cleanKeyword}</a>`;
    });
}

// ── CRUD Operations ──

// Form Submit (추가 또는 수정)
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const yearVal = parseInt(inputYear.value, 10);
    const eventVal = inputEvent.value.trim();
    const submitBtn = document.getElementById('btnSubmitForm');
    
    if (isNaN(yearVal)) {
        alert('올바른 연도 숫자를 입력해주세요.');
        return;
    }

    const eventData = {
        year: yearVal,
        category: '',
        event: eventVal
    };

    submitBtn.disabled = true;
    submitBtn.textContent = '저장 중...';

    try {
        if (editingEventId) {
            // 1. 기존 데이터 수정
            const { error } = await supabaseClient
                .from('history_timeline')
                .update(eventData)
                .eq('id', editingEventId)
                .select();

            if (error) throw error;
            alert('사건이 성공적으로 수정되었습니다.');
        } else {
            // 2. 신규 데이터 추가
            const { data, error } = await supabaseClient
                .from('history_timeline')
                .insert([eventData])
                .select();

            if (error) throw error;
            alert('사건이 성공적으로 추가되었습니다.');
            
            // 신규 추가된 사건의 연도를 검색어 창에 넣어 앵커로 잡히도록 유도
            if (data && data.length > 0) {
                searchTerm.value = data[0].year.toString();
            }
        }

        timelineFormDialog.close();
        
        // 전체 데이터 리로드 후 자동 필터링 및 렌더링 갱신
        await loadAllEvents();

    } catch (err) {
        console.error("CRUD Submit Error:", err);
        alert("데이터 저장 실패: " + err.message);
    } finally {
        submitBtn.disabled = false;
    }
}

// 수정 모달창 열기 (Global 스코프로 노출)
window.openEditForm = async function(id) {
    editingEventId = id;
    const target = allEvents.find(ev => ev.id === id); // allEvents에서 조회
    if (!target) return;

    formTitle.textContent = '✏️ 사건 수정';
    btnSubmitForm.textContent = '✏️ 수정 완료';
    
    inputYear.value = target.year;
    inputEvent.value = target.event;
    
    timelineFormDialog.showModal();
};

// 삭제 처리 (Global 스코프로 노출)
window.deleteEvent = async function(id) {
    if (!confirm('정말로 이 역사 사건을 삭제하시겠습니까?')) return;

    try {
        const { error } = await supabaseClient
            .from('history_timeline')
            .delete()
            .eq('id', id);

        if (error) throw error;
        alert('성공적으로 삭제되었습니다.');
        
        // 전체 데이터 리로드 후 자동 화면 갱신
        await loadAllEvents();
    } catch (err) {
        console.error("Delete Error:", err);
        alert("삭제 중 오류가 발생했습니다: " + err.message);
    }
};
