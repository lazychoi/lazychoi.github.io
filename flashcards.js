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
    
    // Load data from farm_data.txt
    loadDataFromServer();

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

// Load data from server
function loadDataFromServer() {
    const loadingMessage = document.getElementById('loadingMessage');
    fetch('data/farm_data.txt')
        .then(response => {
            if (!response.ok) throw new Error('서버에서 data/farm_data.txt 파일을 찾을 수 없습니다.');
            return response.text();
        })
        .then(text => {
            allTerms = parseCSV(text);
            // Get the 100 most recent terms (the last 100 entries in the file)
            // and list them in reverse order (newest first)
            displayTerms = allTerms.slice(-100).reverse();

            if (loadingMessage) {
                loadingMessage.style.display = 'none';
            }

            renderSelectionTable();
        })
        .catch(err => {
            console.error('Error loading data:', err);
            if (loadingMessage) {
                loadingMessage.textContent = '데이터 로딩 중 오류가 발생했습니다: ' + err.message;
                loadingMessage.style.color = '#ef4444';
            }
        });
}

// Parse CSV text securely (identical parsing logic to farm_search.js/farm_add.js)
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
            const rawMeaning = values[3] || '';
            const unescapedMeaning = rawMeaning
                .replace(/(?<!\\)\\n/g, '\n')
                .replace(/\\\\/g, '\\');

            parsedTerms.push({
                term: values[0] || '',
                foreignTerm: values[1] || '',
                easyTerm: values[2] || '',
                meaning: unescapedMeaning
            });
        }
    });
    return parsedTerms;
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

    // 1. Extract block and inline math to protect from marked parsing
    const mathBlocks = [];
    let processed = text;

    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
        const placeholder = `%%BLOCKMATH_${mathBlocks.length}%%`;
        mathBlocks.push({ placeholder, formula, isBlock: true });
        return placeholder;
    });

    processed = processed.replace(/\$([^\$]+?)\$/g, (match, formula) => {
        const placeholder = `%%INLINEMATH_${mathBlocks.length}%%`;
        mathBlocks.push({ placeholder, formula, isBlock: false });
        return placeholder;
    });

    // 2. Process image tags [[filename]]
    processed = processed.replace(
        /\[\[(.*?)\]\]/g,
        (match, filename) => `
            <div class="image-container" style="text-align: center; margin: 10px 0;">
                <img src="img/${filename}" alt="${filename}" style="max-width: 90%; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
            </div>
        `
    );

    // 3. Render Markdown
    let html = '';
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        html = marked.parse(processed);
    } else {
        html = processed.replace(/\n/g, '<br>');
    }

    // 4. Restore protected math blocks
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
