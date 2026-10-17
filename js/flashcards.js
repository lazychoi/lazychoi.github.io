// State Management
let parsedCards = [];     // Parsed { question, answer } objects from textarea
let studyList = [];       // Array of card objects for current study session
let currentIndex = 0;     // Current card index in studyList
let stats = {
    known: 0,
    unknown: 0
};
let cardStates = [];      // 'unseen', 'known', or 'unknown' for each card in studyList
let isAnimating = false;  // Prevent actions during slide animations

const STORAGE_KEYS = {
    DATA: 'flashcards_pasted_data',
    DELIMITER_TYPE: 'flashcards_delimiter_type',
    CUSTOM_DELIMITER: 'flashcards_custom_delimiter'
};

// 1. Initial Setup on Page Load
window.addEventListener('DOMContentLoaded', () => {
    console.log("[Diagnostics] flashcards.js loaded successfully!");

    const delimiterSelect = document.getElementById('delimiterSelect');
    const customDelimiterInput = document.getElementById('customDelimiter');
    const dataInput = document.getElementById('dataInput');
    const btnClearData = document.getElementById('btnClearData');
    const btnLoadHighlights = document.getElementById('btnLoadHighlights');
    const highlightFileInput = document.getElementById('highlightFileInput');

    // Restore saved settings & data from localStorage
    const savedDelimiterType = localStorage.getItem(STORAGE_KEYS.DELIMITER_TYPE);
    const savedCustomDelimiter = localStorage.getItem(STORAGE_KEYS.CUSTOM_DELIMITER);
    const savedData = localStorage.getItem(STORAGE_KEYS.DATA);

    if (savedDelimiterType && delimiterSelect) {
        delimiterSelect.value = savedDelimiterType;
    }
    if (savedCustomDelimiter !== null && customDelimiterInput) {
        customDelimiterInput.value = savedCustomDelimiter;
    }
    if (savedData !== null && dataInput) {
        dataInput.value = savedData;
    }

    updateCustomDelimiterVisibility();
    parsePastedData();

    // Delimiter & Textarea Event Listeners
    if (delimiterSelect) {
        delimiterSelect.addEventListener('change', () => {
            localStorage.setItem(STORAGE_KEYS.DELIMITER_TYPE, delimiterSelect.value);
            updateCustomDelimiterVisibility();
            if (delimiterSelect.value === 'custom' && customDelimiterInput) {
                customDelimiterInput.focus();
            }
            parsePastedData();
        });
    }

    if (customDelimiterInput) {
        customDelimiterInput.addEventListener('input', () => {
            localStorage.setItem(STORAGE_KEYS.CUSTOM_DELIMITER, customDelimiterInput.value);
            parsePastedData();
        });
    }

    if (dataInput) {
        dataInput.addEventListener('input', () => {
            localStorage.setItem(STORAGE_KEYS.DATA, dataInput.value);
            parsePastedData();
        });

        // Allow inserting Tab character in textarea when Tab delimiter is selected
        dataInput.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && delimiterSelect && delimiterSelect.value === 'tab') {
                e.preventDefault();
                const start = dataInput.selectionStart;
                const end = dataInput.selectionEnd;
                dataInput.value = dataInput.value.substring(0, start) + '\t' + dataInput.value.substring(end);
                dataInput.selectionStart = dataInput.selectionEnd = start + 1;
                localStorage.setItem(STORAGE_KEYS.DATA, dataInput.value);
                parsePastedData();
            }
        });
    }

    if (btnLoadHighlights && highlightFileInput) {
        btnLoadHighlights.addEventListener('click', () => {
            highlightFileInput.value = '';
            highlightFileInput.click();
        });

        highlightFileInput.addEventListener('change', handleHighlightJsonFile);
    }

    if (btnClearData) {
        btnClearData.addEventListener('click', () => {
            if (dataInput) {
                dataInput.value = '';
                localStorage.removeItem(STORAGE_KEYS.DATA);
                parsePastedData();
                dataInput.focus();
            }
        });
    }

    // Event Listeners for study controls
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

// 2. Delimiter & Data Parsing Helpers
function updateCustomDelimiterVisibility() {
    const delimiterSelect = document.getElementById('delimiterSelect');
    const customDelimiterInput = document.getElementById('customDelimiter');
    if (!delimiterSelect || !customDelimiterInput) return;

    if (delimiterSelect.value === 'custom') {
        customDelimiterInput.style.display = 'inline-block';
    } else {
        customDelimiterInput.style.display = 'none';
    }
}

function getActiveDelimiter() {
    const delimiterSelect = document.getElementById('delimiterSelect');
    const customDelimiterInput = document.getElementById('customDelimiter');
    if (!delimiterSelect) return '|';

    const type = delimiterSelect.value;
    if (type === 'tab') return '\t';
    if (type === 'custom') return customDelimiterInput ? customDelimiterInput.value : '';
    return type; // '|' or ';'
}

async function handleHighlightJsonFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
        const textContent = await file.text();
        const jsonData = JSON.parse(textContent);

        let highlights = null;
        if (Array.isArray(jsonData)) {
            highlights = jsonData;
        } else if (jsonData && Array.isArray(jsonData.highlights)) {
            highlights = jsonData.highlights;
        }

        if (!highlights) {
            alert('형광펜 데이터(highlights)를 찾을 수 없는 JSON 파일입니다.');
            return;
        }

        let delimiter = getActiveDelimiter();
        if (!delimiter) {
            const delimiterSelect = document.getElementById('delimiterSelect');
            if (delimiterSelect) {
                delimiterSelect.value = '|';
                localStorage.setItem(STORAGE_KEYS.DELIMITER_TYPE, '|');
                updateCustomDelimiterVisibility();
            }
            delimiter = '|';
        }

        const safeReplaceDelimiter = (str) => {
            if (!delimiter) return str;
            return str.split(delimiter).join(' ');
        };

        const lines = [];
        highlights.forEach((hl) => {
            if (!hl || typeof hl !== 'object') return;

            const rawText = safeReplaceDelimiter(String(hl.text || '').trim().replace(/\r?\n+/g, ' '));
            const rawSentence = safeReplaceDelimiter(String(hl.targetSentence || '').trim().replace(/\r?\n+/g, ' '));
            const rawMeaning = String(hl.targetMeaning || '').trim().replace(/\r?\n+/g, ' ');
            const rawTranslation = String(hl.sentenceTranslation || '').trim().replace(/\r?\n/g, '\\n');

            if (!rawText && !rawSentence) return;

            // 1면: text와 targetSentence
            let frontPart = '';
            if (rawText && rawSentence) {
                frontPart = `${rawText}\\n${rawSentence}`;
            } else {
                frontPart = rawText || rawSentence;
            }

            // 2면: targetMeaning와 sentenceTranslation
            let backPart = '';
            if (rawMeaning && rawTranslation) {
                backPart = `${rawMeaning}\\n${rawTranslation}`;
            } else if (rawMeaning) {
                backPart = rawMeaning;
            } else if (rawTranslation) {
                backPart = `(뜻 미등록)\\n${rawTranslation}`;
            } else {
                backPart = '(뜻/해석 미등록)';
            }

            lines.push(`${frontPart}${delimiter}${backPart}`);
        });

        if (lines.length === 0) {
            alert('불러올 수 있는 형광펜 항목이 없습니다.');
            return;
        }

        const dataInput = document.getElementById('dataInput');
        if (dataInput) {
            dataInput.value = lines.join('\n');
            localStorage.setItem(STORAGE_KEYS.DATA, dataInput.value);
            parsePastedData();
        }
    } catch (err) {
        console.error('Failed to parse highlight JSON:', err);
        alert('JSON 파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    }
}

function parsePastedData() {
    const dataInput = document.getElementById('dataInput');
    const rawText = dataInput ? dataInput.value : '';
    const delimiter = getActiveDelimiter();

    parsedCards = [];

    if (rawText.trim() && delimiter.length > 0) {
        const lines = rawText.split(/\r?\n/);
        lines.forEach((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;

            const sepIndex = line.indexOf(delimiter);
            if (sepIndex !== -1) {
                const question = line.slice(0, sepIndex).trim().replace(/\\n/g, '\n');
                const answer = line.slice(sepIndex + delimiter.length).trim().replace(/\\n/g, '\n');
                if (question || answer) {
                    parsedCards.push({
                        question: question || '(질문 없음)',
                        answer: answer || '(답변 없음)'
                    });
                }
            }
        });
    }

    updateStartButtonCount();
}

function updateStartButtonCount() {
    const count = parsedCards.length;
    const badge = document.getElementById('parsedCountBadge');
    if (badge) {
        badge.textContent = `${count}개 카드`;
    }

    const btn = document.getElementById('btnStartStudy');
    if (btn) {
        btn.textContent = `⚡ 학습 시작하기 (${count}개)`;
        btn.disabled = count === 0;

        if (count === 0) {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    }
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function highlightTargetInSentence(sentence, target) {
    const safeSentence = escapeHtml(sentence);
    const safeTarget = escapeHtml(target);
    if (!safeTarget) return safeSentence;

    const escapedRegex = safeTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
        const regex = new RegExp(`(${escapedRegex})`, 'gi');
        return safeSentence.replace(regex, '<span class="hl-target">$1</span>');
    } catch (e) {
        return safeSentence;
    }
}

// 3. Study Mode Control Flow
function startStudy() {
    parsePastedData();
    if (parsedCards.length === 0) return;

    studyList = parsedCards.map(card => ({ ...card }));

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

// 4. Render Current Flashcard
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

    // Populate Side 1 (Front): Question (or text + targetSentence)
    const frontTitle = document.getElementById('cardFrontTitle');
    const frontSentence = document.getElementById('cardFrontSentence');
    const backHeader = document.getElementById('cardBackHeader');
    const backTerm = document.getElementById('cardBackTerm');
    const backSentence = document.getElementById('cardBackSentence');
    const meaningDiv = document.getElementById('cardBackMeaning');

    const qLines = t.question.split('\n');

    if (backHeader) backHeader.style.display = 'block';

    if (qLines.length > 1) {
        const mainText = qLines[0].trim();
        const sentenceText = qLines.slice(1).join('\n').trim();
        const highlightedSentenceHtml = highlightTargetInSentence(sentenceText, mainText);

        // Front (1면)
        frontTitle.textContent = mainText;
        if (frontSentence) {
            frontSentence.style.display = 'block';
            frontSentence.innerHTML = highlightedSentenceHtml;
            renderKaTeXInElement(frontSentence);
        }

        // Back Header (뒷면 상단 1면 표시)
        backTerm.textContent = mainText;
        if (backSentence) {
            backSentence.style.display = 'block';
            backSentence.innerHTML = highlightedSentenceHtml;
            renderKaTeXInElement(backSentence);
        }
    } else {
        // Front (1면)
        frontTitle.textContent = t.question;
        if (frontSentence) {
            frontSentence.style.display = 'none';
            frontSentence.innerHTML = '';
        }

        // Back Header (뒷면 상단 1면 표시)
        backTerm.textContent = t.question;
        if (backSentence) {
            backSentence.style.display = 'none';
            backSentence.innerHTML = '';
        }
    }
    renderKaTeXInElement(frontTitle);
    renderKaTeXInElement(backTerm);

    // Populate Side 2 on Back (뒷면 하단 2면 표시: targetMeaning + sentenceTranslation 또는 답변)
    const aLines = t.answer.split('\n');

    if (aLines.length > 1) {
        const meaningHeader = aLines[0].trim();
        const translationBody = aLines.slice(1).join('\n').trim();
        meaningDiv.innerHTML = `
            <div class="card-back-target-meaning">${escapeHtml(meaningHeader)}</div>
            <div class="card-back-translation-body">${renderMarkdownAndMath(translationBody)}</div>
        `;
    } else {
        meaningDiv.innerHTML = renderMarkdownAndMath(t.answer);
    }
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

    // Wrap tables in responsive container for overflow handling
    html = html.replace(/<table>/g, '<div class="table-responsive"><table>').replace(/<\/table>/g, '</table></div>');

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
