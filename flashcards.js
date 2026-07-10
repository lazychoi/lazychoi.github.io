// Supabase Client Initialization
const supabaseUrl = 'https://tpwwwpcbinxdhxqvcvqc.supabase.co';
const supabaseKey = 'sb_publishable_A1sd3hvbeQx9-gVoFXL0qA_G923SWm9';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// State Management
let allTerms = [];        // All parsed terms from CSV
let displayTerms = [];    // 100 most recent terms
let selectedIndices = new Set(); // Indices from displayTerms
let studyList = [];       // Array of selected term objects for current study session
let currentIndex = 0;     // Current card index in studyList
let stats = {
    known: 0,
    unknown: 0
};
let cardStates = [];      // 'unseen', 'known', or 'unknown' for each card in studyList
let isAnimating = false;  // Prevent actions during slide animations

// 1. Initial Setup on Page Load
window.addEventListener('DOMContentLoaded', () => {
    console.log("[Diagnostics] flashcards.js loaded successfully!");
    
    // Set default filter date (1 week ago)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const dateInput = document.getElementById('filterStartDate');
    if (dateInput) {
        dateInput.value = oneWeekAgo.toISOString().split('T')[0];
        // 클릭 시 곧바로 브라우저 달력 선택창 띄우기
        dateInput.addEventListener('click', () => {
            try {
                dateInput.showPicker();
            } catch (err) {
                console.warn('Native picker not supported', err);
            }
        });
    }

    // Load data from Supabase
    loadDataFromSupabase();

    // Filter UI event listeners
    const filterType = document.getElementById('filterType');
    const recentFilterContainer = document.getElementById('recentFilterContainer');
    const dateFilterContainer = document.getElementById('dateFilterContainer');
    
    if (filterType) {
        filterType.addEventListener('change', () => {
            if (filterType.value === 'recent') {
                recentFilterContainer.style.display = 'flex';
                dateFilterContainer.style.display = 'none';
            } else {
                recentFilterContainer.style.display = 'none';
                dateFilterContainer.style.display = 'flex';
            }
        });
    }

    const btnReload = document.getElementById('btnReload');
    if (btnReload) {
        btnReload.addEventListener('click', loadDataFromSupabase);
    }

    // Event Listeners for controls
    document.getElementById('btnSelectAll').addEventListener('click', selectAll);
    document.getElementById('btnSelectNone').addEventListener('click', selectNone);
    document.getElementById('btnStartStudy').addEventListener('click', startStudy);
    document.getElementById('btnBackToList').addEventListener('click', backToList);
    document.getElementById('btnPrev').addEventListener('click', prevCard);
    document.getElementById('btnNext').addEventListener('click', nextCard);
    document.getElementById('btnFlip').addEventListener('click', flipCard);
    document.getElementById('btnUnknown').addEventListener('click', () => markCard('unknown'));
    document.getElementById('btnKnown').addEventListener('click', () => markCard('known'));
    
    document.getElementById('btnRestart').addEventListener('click', restartStudy);
    document.getElementById('btnStudyFailed').addEventListener('click', studyFailedOnly);
    document.getElementById('btnBackFromStats').addEventListener('click', backToList);

    // Click on flashcard to flip
    document.getElementById('flashcard').addEventListener('click', flipCard);

    // Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
});

// Load data from Supabase DB with filter conditions (bypassing 1000 rows limit via pagination)
async function loadDataFromSupabase() {
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) {
        loadingMessage.style.display = 'block';
        loadingMessage.textContent = '데이터를 로드하는 중입니다...';
        loadingMessage.style.color = 'var(--text-muted)';
    }
    
    const typeElement = document.getElementById('filterType');
    const type = typeElement ? typeElement.value : 'recent';
    
    try {
        let allData = [];
        let page = 0;
        const pageSize = 1000;
        let keepFetching = true;

        if (type === 'recent') {
            const limitInput = document.getElementById('recentLimit');
            const targetLimit = limitInput ? (parseInt(limitInput.value) || 100) : 100;
            
            // 최신 N개 가져오기 루프
            while (keepFetching && allData.length < targetLimit) {
                const fetchCount = Math.min(pageSize, targetLimit - allData.length);
                const { data, error } = await supabaseClient
                    .from('terms')
                    .select('*')
                    .range(page * pageSize, page * pageSize + fetchCount - 1)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                allData = allData.concat(data);
                
                if (data.length < fetchCount) {
                    keepFetching = false;
                } else {
                    page++;
                }
            }
        } else {
            const startDateInput = document.getElementById('filterStartDate');
            const startDateStr = startDateInput ? startDateInput.value : '';
            if (!startDateStr) {
                alert('날짜를 선택해 주세요.');
                if (loadingMessage) loadingMessage.style.display = 'none';
                return;
            }
            const startDate = new Date(startDateStr + 'T00:00:00Z').toISOString();
            
            // 특정 날짜 이후 모든 데이터 가져오기 루프 (1000개 초과 데이터 대응)
            while (keepFetching) {
                const { data, error } = await supabaseClient
                    .from('terms')
                    .select('*')
                    .gte('created_at', startDate)
                    .range(page * pageSize, (page + 1) * pageSize - 1)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                allData = allData.concat(data);

                if (data.length < pageSize) {
                    keepFetching = false;
                } else {
                    page++;
                }
            }
        }

        displayTerms = allData.map(row => ({
            id: row.id,
            term: row.term || '',
            foreignTerm: row.foreign_term || '',
            easyTerm: row.easy_term || '',
            meaning: row.meaning || ''
        }));

        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }

        renderSelectionTable();
    } catch (err) {
        console.error('Error fetching cards from Supabase:', err);
        if (loadingMessage) {
            loadingMessage.textContent = '데이터 로딩 중 오류가 발생했습니다: ' + err.message;
            loadingMessage.style.color = '#ef4444';
        }
    }
}

// 2. Render Selection Screen
function renderSelectionTable() {
    const tbody = document.getElementById('selectionTableBody');
    tbody.innerHTML = '';

    if (displayTerms.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; color: var(--text-muted); padding: 30px;">
                    등록된 용어가 없습니다.
                </td>
            </tr>
        `;
        return;
    }

    selectedIndices.clear();

    displayTerms.forEach((t, index) => {
        const tr = document.createElement('tr');
        
        // Select only the top 10 most recent terms by default
        const isChecked = index < 10;
        if (isChecked) {
            selectedIndices.add(index);
        }
        
        tr.innerHTML = `
            <td class="checkbox-cell">
                <input type="checkbox" class="custom-checkbox term-checkbox" data-index="${index}" ${isChecked ? 'checked' : ''}>
            </td>
            <td class="term-cell">
                ${t.term}
                ${t.foreignTerm ? `<span style="font-weight: normal; font-size: 13px; color: var(--text-muted); margin-left: 6px;">(${t.foreignTerm})</span>` : ''}
            </td>
            <td class="info-cell">
                ${t.easyTerm ? `<span style="color: var(--accent-green); font-weight: 600;">${t.easyTerm}</span>` : '<span style="color: var(--text-muted); font-style: italic;">쉬운용어 없음</span>'}
            </td>
        `;

        // Click row to toggle checkbox
        tr.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = tr.querySelector('.term-checkbox');
                checkbox.checked = !checkbox.checked;
                toggleIndexSelection(index, checkbox.checked);
            }
        });

        // Checkbox change listener
        const checkbox = tr.querySelector('.term-checkbox');
        checkbox.addEventListener('change', (e) => {
            toggleIndexSelection(index, e.target.checked);
        });

        tbody.appendChild(tr);
    });

    updateStartButtonCount();
}

function toggleIndexSelection(index, isChecked) {
    if (isChecked) {
        selectedIndices.add(index);
    } else {
        selectedIndices.delete(index);
    }
    updateStartButtonCount();
}

function updateStartButtonCount() {
    const btn = document.getElementById('btnStartStudy');
    btn.textContent = `⚡ 학습 시작하기 (${selectedIndices.size}개 선택됨)`;
    btn.disabled = selectedIndices.size === 0;
    
    // Style check: disable state visual
    if (selectedIndices.size === 0) {
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    } else {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
}

// Select All / Deselect All
function selectAll() {
    const checkboxes = document.querySelectorAll('.term-checkbox');
    checkboxes.forEach((cb) => {
        cb.checked = true;
        const idx = parseInt(cb.getAttribute('data-index'));
        selectedIndices.add(idx);
    });
    updateStartButtonCount();
}

function selectNone() {
    const checkboxes = document.querySelectorAll('.term-checkbox');
    checkboxes.forEach((cb) => {
        cb.checked = false;
        const idx = parseInt(cb.getAttribute('data-index'));
        selectedIndices.delete(idx);
    });
    updateStartButtonCount();
}

// 3. Smart English / Hanja Parser for Card Side 1
function getFrontValue(t) {
    if (!t.foreignTerm) {
        return { value: t.term, type: '표제어' };
    }

    // Split by comma, semicolon, or slash
    const parts = t.foreignTerm.split(/[,;\/]/).map(p => p.trim());
    
    // 1. Look for English part (contains latin alphabetic characters)
    const englishParts = parts.filter(p => /[a-zA-Z]/.test(p));
    if (englishParts.length > 0) {
        return { value: englishParts.join(', '), type: '영어' };
    }

    // 2. Look for Hanja part (contains Chinese characters)
    // Unicode ranges for Hanja: \u4e00-\u9fff, \u3400-\u4dbf, \uf900-\ufaff
    const hanjaParts = parts.filter(p => /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(p));
    if (hanjaParts.length > 0) {
        return { value: hanjaParts.join(', '), type: '한자' };
    }

    // 3. Fallback to foreignTerm itself or the Term
    return { value: t.foreignTerm || t.term, type: '외래어' };
}

// 4. Study Mode Control Flow
function startStudy() {
    if (selectedIndices.size === 0) return;

    // Build the studyList from selected displayTerms
    studyList = [];
    selectedIndices.forEach((idx) => {
        studyList.push(displayTerms[idx]);
    });

    // Shuffle the studyList for better learning (optional, but let's keep the order or shuffle?)
    // Let's keep the order (recent first) as requested, but users can re-study.
    
    // Reset study state
    currentIndex = 0;
    stats.known = 0;
    stats.unknown = 0;
    cardStates = new Array(studyList.length).fill('unseen');
    isAnimating = false;

    // Reset slide animation classes if any
    const flashcard = document.getElementById('flashcard');
    if (flashcard) {
        flashcard.classList.remove('animate-slide-out-left', 'animate-slide-out-right', 'animate-slide-in-left', 'animate-slide-in-right');
    }

    // Switch view
    document.getElementById('selectionView').style.display = 'none';
    document.getElementById('studyView').style.display = 'block';
    document.getElementById('statsView').style.display = 'none';

    renderCurrentCard();
}

function backToList() {
    document.getElementById('selectionView').style.display = 'block';
    document.getElementById('studyView').style.display = 'none';
    document.getElementById('statsView').style.display = 'none';
}

// 5. Render Current Flashcard
function renderCurrentCard() {
    if (studyList.length === 0 || currentIndex >= studyList.length) {
        showStats();
        return;
    }

    const t = studyList[currentIndex];
    
    // Update progress text & progress bar
    document.getElementById('progressText').textContent = `${currentIndex + 1} / ${studyList.length}`;
    const progressPercent = ((currentIndex + 1) / studyList.length) * 100;
    document.getElementById('progressBarFill').style.width = `${progressPercent}%`;

    // Make sure card is face down (unflipped)
    const cardInner = document.getElementById('cardInner');
    cardInner.classList.remove('flipped');

    // Populate Side 1 (Front): English, Hanja, or Term
    const frontObj = getFrontValue(t);
    document.getElementById('cardFrontTitle').textContent = frontObj.value;
    //document.getElementById('cardFrontHint').textContent = `힌트: ${frontObj.type} (클릭하여 뒤집기)`;

    // Populate Side 2 (Back): Headword, Easy Term, Meaning/Markdown/LaTeX
    document.getElementById('cardBackTerm').innerHTML = `${t.term} ${t.foreignTerm ? `<span style="font-size: 14px; font-weight: normal; color: var(--text-muted); margin-left: 6px;">(${t.foreignTerm})</span>` : ''}`;
    
    const easyRow = document.getElementById('cardBackEasy');
    if (t.easyTerm) {
        easyRow.style.display = 'block';
        easyRow.textContent = t.easyTerm;
    } else {
        easyRow.style.display = 'none';
    }

    // Meaning with markdown, images, formulas
    const meaningDiv = document.getElementById('cardBackMeaning');
    meaningDiv.innerHTML = renderMarkdownAndMath(t.meaning);
// Render KaTeX formulas in the back card
    renderKaTeXInElement(meaningDiv);

    // Disable/Enable Nav buttons
    document.getElementById('btnPrev').disabled = currentIndex === 0;
    document.getElementById('btnNext').disabled = currentIndex === studyList.length - 1;
}

// Card Transition slide helper
function transitionCard(direction, callback) {
    if (isAnimating) return;
    isAnimating = true;

    const flashcard = document.getElementById('flashcard');
    const cardInner = document.getElementById('cardInner');
    
    if (!flashcard) {
        callback();
        isAnimating = false;
        return;
    }

    // Temporarily disable 3D flip transition to prevent spinning when changing cards
    if (cardInner) {
        cardInner.style.transition = 'none';
    }

    // Remove any leftover animation classes
    flashcard.classList.remove('animate-slide-out-left', 'animate-slide-out-right', 'animate-slide-in-left', 'animate-slide-in-right');

    // Apply slide-out animation class
    const outClass = direction === 'next' ? 'animate-slide-out-left' : 'animate-slide-out-right';
    flashcard.classList.add(outClass);

    // Wait for the slide-out animation (220ms matches CSS duration)
    setTimeout(() => {
        // Update content (this also calls renderCurrentCard which removes 'flipped' class instantly)
        callback();

        // Swap outClass to inClass
        flashcard.classList.remove(outClass);
        const inClass = direction === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left';
        flashcard.classList.add(inClass);

        // Wait for slide-in animation to complete
        setTimeout(() => {
            flashcard.classList.remove(inClass);
            // Restore the 3D flip transition after slide animation is fully complete
            if (cardInner) {
                cardInner.style.transition = '';
            }
            isAnimating = false;
        }, 220);
    }, 220);
}

// Flip Card Action
function flipCard() {
    if (isAnimating) return;
    const cardInner = document.getElementById('cardInner');
    if (cardInner) {
        cardInner.classList.toggle('flipped');
    }
}

// Next / Prev Card Navigation
function nextCard() {
    if (isAnimating) return;
    if (currentIndex < studyList.length - 1) {
        transitionCard('next', () => {
            currentIndex++;
            renderCurrentCard();
        });
    } else {
        // Show result stats if they click next on the last card
        showStats();
    }
}

function prevCard() {
    if (isAnimating) return;
    if (currentIndex > 0) {
        transitionCard('prev', () => {
            currentIndex--;
            renderCurrentCard();
        });
    }
}

// Mark card as Known/Unknown
function markCard(state) {
    if (isAnimating) return;
    const prevState = cardStates[currentIndex];
    
    // Update stats count
    if (prevState === 'seen' || prevState === 'unseen') {
        stats[state]++;
    } else if (prevState !== state) {
        // Switch state
        stats[state]++;
        stats[prevState === 'known' ? 'known' : 'unknown']--;
    }
    
    cardStates[currentIndex] = state;

    if (currentIndex < studyList.length - 1) {
        transitionCard('next', () => {
            currentIndex++;
            renderCurrentCard();
        });
    } else {
        showStats();
    }
}

// 6. Show Study Statistics Summary
function showStats() {
    document.getElementById('selectionView').style.display = 'none';
    document.getElementById('studyView').style.display = 'none';
    document.getElementById('statsView').style.display = 'block';

    const total = studyList.length;
    // Calculate unseen cards as unknown or ignore?
    // Let's count unseen cards as unknown or count actual clicks
    let knownCount = 0;
    let unknownCount = 0;
    cardStates.forEach(state => {
        if (state === 'known') knownCount++;
        else unknownCount++; // unseen & unknown counted together
    });

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statKnown').textContent = knownCount;
    document.getElementById('statUnknown').textContent = unknownCount;

    // Show button to study only failed/unknown items if they exist
    const btnFailed = document.getElementById('btnStudyFailed');
    if (unknownCount > 0) {
        btnFailed.style.display = 'inline-flex';
        btnFailed.textContent = `❌ 틀린 ${unknownCount}개만 다시 학습`;
    } else {
        btnFailed.style.display = 'none';
    }
}

// Stats actions: Restart
function restartStudy() {
    currentIndex = 0;
    stats.known = 0;
    stats.unknown = 0;
    cardStates = new Array(studyList.length).fill('unseen');
    isAnimating = false;
    
    const flashcard = document.getElementById('flashcard');
    if (flashcard) {
        flashcard.classList.remove('animate-slide-out-left', 'animate-slide-out-right', 'animate-slide-in-left', 'animate-slide-in-right');
    }

    document.getElementById('statsView').style.display = 'none';
    document.getElementById('studyView').style.display = 'block';
    
    renderCurrentCard();
}

// Study failed only
function studyFailedOnly() {
    const failedList = [];
    studyList.forEach((t, idx) => {
        if (cardStates[idx] !== 'known') {
            failedList.push(t);
        }
    });

    studyList = failedList;
    currentIndex = 0;
    stats.known = 0;
    stats.unknown = 0;
    cardStates = new Array(studyList.length).fill('unseen');
    isAnimating = false;

    const flashcard = document.getElementById('flashcard');
    if (flashcard) {
        flashcard.classList.remove('animate-slide-out-left', 'animate-slide-out-right', 'animate-slide-in-left', 'animate-slide-in-right');
    }

    document.getElementById('statsView').style.display = 'none';
    document.getElementById('studyView').style.display = 'block';

    renderCurrentCard();
}

// 7. Markdown and KaTeX Helpers
function renderMarkdownAndMath(text) {
    if (!text) return '<span style="color: var(--text-muted); font-style: italic;">설명 없음</span>';

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

function renderKaTeXInElement(element) {
    if (typeof katex !== 'undefined') {
        // 1. Render ql-formula spans (with '|' replaced with '\')
        element.querySelectorAll('.ql-formula').forEach(el => {
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

        // 2. Render standard LaTeX delimiters using auto-render
        if (typeof renderMathInElement === 'function') {
            try {
                renderMathInElement(element, {
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
}

// 8. Keyboard Shortcut navigation Handler
function handleKeyboardShortcuts(e) {
    if (isAnimating) return;
    // Only capture shortcuts when Study View is actively displayed
    const studyView = document.getElementById('studyView');
    if (studyView && studyView.style.display === 'block') {
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                flipCard();
                break;
            case 'ArrowLeft':
                prevCard();
                break;
            case 'ArrowRight':
                nextCard();
                break;
            case 'Digit1':
            case 'Numpad1':
                markCard('unknown');
                break;
            case 'Digit2':
            case 'Numpad2':
                markCard('known');
                break;
            case 'Escape':
            case 'Backspace':
                backToList();
                break;
        }
    }
}
