// State Management
let parsedCards = [];     // Parsed { question, answer } objects from textarea or JSON
let studyList = [];       // Array of card objects for current study pass
let studyChunks = [];     // Array of card chunks when studying n cards at a time
let currentChunkIndex = 0; // Active chunk index in studyChunks
let currentChunkCards = []; // Full cards of the active chunk
let studyOrder = 'sequential'; // 'sequential' or 'random'
let chunkSize = 'all';    // 'all', '5', '7', or '10'
let frontSideMode = '1';  // '1' ("front-1면": 1면=질문, 2면=답변) or '2' ("front-2면": 2면=질문, 1면=답변)
let backDisplayMode = 'both'; // 'both' ("back-1면, 2면" / "back-2면, 1면") or 'only2' ("back-2면" / "back-1면")
let currentDeckName = ''; // Deck title to show in study header
let currentImagesMap = {}; // Global or card-level image map (key -> { name, mimeType, data })
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
    CUSTOM_DELIMITER: 'flashcards_custom_delimiter',
    DECK_NAME: 'flashcards_deck_name',
    IMAGES_MAP: 'flashcards_images_map',
    FRONT_SIDE_MODE: 'flashcards_front_side_mode',
    BACK_DISPLAY_MODE: 'flashcards_back_display_mode'
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
    const btnLoadDeckJson = document.getElementById('btnLoadDeckJson');
    const deckJsonFileInput = document.getElementById('deckJsonFileInput');
    const btnLoadCsv = document.getElementById('btnLoadCsv');
    const csvFileInput = document.getElementById('csvFileInput');
    const btnOrderSequential = document.getElementById('btnOrderSequential');
    const btnOrderRandom = document.getElementById('btnOrderRandom');
    const chunkSizeSelect = document.getElementById('chunkSizeSelect');
    const btnFront1 = document.getElementById('btnFront1');
    const btnFront2 = document.getElementById('btnFront2');
    const btnBackBoth = document.getElementById('btnBackBoth');
    const btnBackOnly2 = document.getElementById('btnBackOnly2');

    // Clean up legacy occlusion storage key if present
    localStorage.removeItem('flashcards_occlusions_map');

    // Restore saved settings & data from localStorage
    const savedDelimiterType = localStorage.getItem(STORAGE_KEYS.DELIMITER_TYPE);
    const savedCustomDelimiter = localStorage.getItem(STORAGE_KEYS.CUSTOM_DELIMITER);
    const savedData = localStorage.getItem(STORAGE_KEYS.DATA);
    const savedDeckName = localStorage.getItem(STORAGE_KEYS.DECK_NAME);
    const savedImagesMap = localStorage.getItem(STORAGE_KEYS.IMAGES_MAP);
    const savedFrontSideMode = localStorage.getItem(STORAGE_KEYS.FRONT_SIDE_MODE);
    const savedBackDisplayMode = localStorage.getItem(STORAGE_KEYS.BACK_DISPLAY_MODE);

    if (savedDelimiterType && delimiterSelect) {
        delimiterSelect.value = savedDelimiterType;
    }
    if (savedCustomDelimiter !== null && customDelimiterInput) {
        customDelimiterInput.value = savedCustomDelimiter;
    }
    if (savedDeckName) {
        currentDeckName = savedDeckName;
    }
    if (savedImagesMap) {
        try {
            currentImagesMap = JSON.parse(savedImagesMap) || {};
        } catch (e) {
            currentImagesMap = {};
        }
    }
    if (savedFrontSideMode === '2' || savedFrontSideMode === '1') {
        setFrontSideMode(savedFrontSideMode);
    } else {
        updateBackModeButtonLabels();
    }
    if (savedBackDisplayMode === 'only2' || savedBackDisplayMode === 'both') {
        setBackDisplayMode(savedBackDisplayMode);
    }
    if (savedData !== null && dataInput) {
        dataInput.value = savedData;
    }

    updateCustomDelimiterVisibility();
    parsePastedData();

    // Study Order, Chunk Size, Front Side & Back Display Mode Event Listeners
    if (btnOrderSequential && btnOrderRandom) {
        btnOrderSequential.addEventListener('click', () => setStudyOrder('sequential'));
        btnOrderRandom.addEventListener('click', () => setStudyOrder('random'));
    }

    if (chunkSizeSelect) {
        chunkSizeSelect.value = 'all';
        chunkSize = 'all';
        chunkSizeSelect.addEventListener('change', () => {
            chunkSize = chunkSizeSelect.value || 'all';
        });
    }

    if (btnFront1 && btnFront2) {
        btnFront1.addEventListener('click', () => setFrontSideMode('1'));
        btnFront2.addEventListener('click', () => setFrontSideMode('2'));
    }

    if (btnBackBoth && btnBackOnly2) {
        btnBackBoth.addEventListener('click', () => setBackDisplayMode('both'));
        btnBackOnly2.addEventListener('click', () => setBackDisplayMode('only2'));
    }

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
            safeSaveStorage(STORAGE_KEYS.DATA, dataInput.value);
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
                safeSaveStorage(STORAGE_KEYS.DATA, dataInput.value);
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

    if (btnLoadDeckJson && deckJsonFileInput) {
        btnLoadDeckJson.addEventListener('click', () => {
            deckJsonFileInput.value = '';
            deckJsonFileInput.click();
        });

        deckJsonFileInput.addEventListener('change', handleDeckJsonFile);
    }

    if (btnLoadCsv && csvFileInput) {
        btnLoadCsv.addEventListener('click', () => {
            csvFileInput.value = '';
            csvFileInput.click();
        });

        csvFileInput.addEventListener('change', handleCsvFile);
    }

    if (btnClearData) {
        btnClearData.addEventListener('click', () => {
            if (dataInput) {
                dataInput.value = '';
                currentDeckName = '';
                currentImagesMap = {};
                localStorage.removeItem(STORAGE_KEYS.DATA);
                localStorage.removeItem(STORAGE_KEYS.DECK_NAME);
                localStorage.removeItem(STORAGE_KEYS.IMAGES_MAP);
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
    
    const btnNextChunk = document.getElementById('btnNextChunk');
    if (btnNextChunk) {
        btnNextChunk.addEventListener('click', startNextChunk);
    }
    document.getElementById('btnRestart').addEventListener('click', restartStudy);
    document.getElementById('btnStudyFailed').addEventListener('click', studyFailedOnly);
    document.getElementById('btnBackFromStats').addEventListener('click', backToList);

    // Click on flashcard to flip
    document.getElementById('flashcard').addEventListener('click', flipCard);

    // Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
});

function safeSaveStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn('localStorage quota exceeded or unavailable for key:', key);
    }
}

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

        currentDeckName = (jsonData && (jsonData.deckName || jsonData.bookTitle || (jsonData.book && jsonData.book.title))) ? String(jsonData.deckName || jsonData.bookTitle || jsonData.book.title).trim() : '';
        currentImagesMap = {};
        safeSaveStorage(STORAGE_KEYS.DECK_NAME, currentDeckName);
        localStorage.removeItem(STORAGE_KEYS.IMAGES_MAP);

        const dataInput = document.getElementById('dataInput');
        if (dataInput) {
            dataInput.value = lines.join('\n');
            safeSaveStorage(STORAGE_KEYS.DATA, dataInput.value);
            parsePastedData();
        }
    } catch (err) {
        console.error('Failed to parse highlight JSON:', err);
        alert('JSON 파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    }
}

async function handleDeckJsonFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
        const textContent = await file.text();
        const jsonData = JSON.parse(textContent);

        let cards = null;
        if (jsonData && Array.isArray(jsonData.cards)) {
            cards = jsonData.cards;
        } else if (Array.isArray(jsonData)) {
            cards = jsonData;
        }

        if (!cards) {
            alert('카드 데이터(cards)를 찾을 수 없는 JSON 파일입니다.');
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

        const mergedImagesMap = {};
        const lines = [];

        // Support root-level images map if present
        if (jsonData && jsonData.images && typeof jsonData.images === 'object') {
            Object.keys(jsonData.images).forEach((imgKey) => {
                const imgObj = jsonData.images[imgKey];
                if (imgObj && imgObj.data) {
                    mergedImagesMap[imgKey] = imgObj;
                }
            });
        }

        cards.forEach((card, cardIdx) => {
            if (!card || typeof card !== 'object') return;

            let frontStr = String(card.front !== undefined ? card.front : (card.font !== undefined ? card.font : (card.question || ''))).trim();
            let backStr = String(card.back !== undefined ? card.back : (card.answer || '')).trim();

            try {
                frontStr = frontStr.normalize('NFC');
                backStr = backStr.normalize('NFC');
            } catch (e) {}

            // If frontStr is empty but card.images exists, synthesize markdown image reference on front
            if (!frontStr && card.images && typeof card.images === 'object') {
                const firstKey = Object.keys(card.images)[0];
                if (firstKey && card.images[firstKey]) {
                    const imgName = card.images[firstKey].name || firstKey;
                    frontStr = `![${imgName}](${firstKey})`;
                }
            }

            if (!frontStr && !backStr) return;

            // Process card.images if present
            if (card.images && typeof card.images === 'object') {
                Object.keys(card.images).forEach((imgKey) => {
                    const imgObj = card.images[imgKey];
                    if (imgObj && imgObj.data) {
                        // Create a unique key across the deck if needed, or preserve key if unique
                        const uniqueKey = mergedImagesMap[imgKey] && mergedImagesMap[imgKey].data !== imgObj.data
                            ? `card${cardIdx + 1}_${imgKey}`
                            : imgKey;
                        mergedImagesMap[uniqueKey] = imgObj;

                        if (uniqueKey !== imgKey) {
                            // Replace markdown reference ![...](imgKey) with uniqueKey
                            const escapedKey = imgKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const imgRegex = new RegExp(`(!\\[[^\\]]*\\]\\(\\s*(?:image:)?)${escapedKey}(\\s*\\))`, 'g');
                            frontStr = frontStr.replace(imgRegex, `$1${uniqueKey}$2`);
                            backStr = backStr.replace(imgRegex, `$1${uniqueKey}$2`);
                        }
                    }
                });
            }

            const serializedFront = safeReplaceDelimiter(frontStr.replace(/\r?\n/g, '\\n'));
            const serializedBack = backStr.replace(/\r?\n/g, '\\n');

            lines.push(`${serializedFront}${delimiter}${serializedBack}`);
        });

        if (lines.length === 0) {
            alert('불러올 수 있는 카드 항목이 없습니다.');
            return;
        }

        let rawDeckName = (jsonData && jsonData.deckName) ? String(jsonData.deckName).trim() : file.name.replace(/\.json$/i, '');
        try {
            rawDeckName = rawDeckName.normalize('NFC');
        } catch (e) {}
        currentDeckName = rawDeckName;
        currentImagesMap = mergedImagesMap;

        safeSaveStorage(STORAGE_KEYS.DECK_NAME, currentDeckName);
        safeSaveStorage(STORAGE_KEYS.IMAGES_MAP, JSON.stringify(currentImagesMap));

        const dataInput = document.getElementById('dataInput');
        if (dataInput) {
            dataInput.value = lines.join('\n');
            safeSaveStorage(STORAGE_KEYS.DATA, dataInput.value);
            parsePastedData();
        }
    } catch (err) {
        console.error('Failed to parse deck JSON:', err);
        alert('JSON 파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    }
}

async function handleCsvFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
        const buffer = await file.arrayBuffer();
        let textContent = '';
        try {
            textContent = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch (decodeErr) {
            textContent = new TextDecoder('euc-kr').decode(buffer);
        }

        textContent = textContent.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
        try {
            textContent = textContent.normalize('NFC');
        } catch (e) {}

        let rawDeckName = file.name.replace(/\.csv$/i, '').trim();
        try {
            rawDeckName = rawDeckName.normalize('NFC');
        } catch (e) {}
        currentDeckName = rawDeckName;
        currentImagesMap = {};

        safeSaveStorage(STORAGE_KEYS.DECK_NAME, currentDeckName);
        localStorage.removeItem(STORAGE_KEYS.IMAGES_MAP);

        const dataInput = document.getElementById('dataInput');
        if (dataInput) {
            dataInput.value = textContent;
            safeSaveStorage(STORAGE_KEYS.DATA, dataInput.value);
            parsePastedData();
        }
    } catch (err) {
        console.error('Failed to read CSV file:', err);
        alert('CSV 파일을 읽는 중 오류가 발생했습니다: ' + err.message);
    }
}

function hasRichContent(text) {
    if (!text) return false;
    return /!\[([^\]]*)\]\(([^)]+)\)|\[\[(.*?)\]\]|<img\b/i.test(text);
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
                        question: question,
                        answer: answer
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
function setStudyOrder(order) {
    studyOrder = order === 'random' ? 'random' : 'sequential';
    const btnSeq = document.getElementById('btnOrderSequential');
    const btnRand = document.getElementById('btnOrderRandom');
    if (btnSeq) btnSeq.classList.toggle('active', studyOrder === 'sequential');
    if (btnRand) btnRand.classList.toggle('active', studyOrder === 'random');
}

function setFrontSideMode(side) {
    frontSideMode = side === '2' ? '2' : '1';
    safeSaveStorage(STORAGE_KEYS.FRONT_SIDE_MODE, frontSideMode);
    const btnFront1 = document.getElementById('btnFront1');
    const btnFront2 = document.getElementById('btnFront2');
    if (btnFront1) btnFront1.classList.toggle('active', frontSideMode === '1');
    if (btnFront2) btnFront2.classList.toggle('active', frontSideMode === '2');
    updateBackModeButtonLabels();
}

function updateBackModeButtonLabels() {
    const btnBoth = document.getElementById('btnBackBoth');
    const btnOnly2 = document.getElementById('btnBackOnly2');
    if (frontSideMode === '2') {
        if (btnBoth) btnBoth.textContent = 'back-2면, 1면';
        if (btnOnly2) btnOnly2.textContent = 'back-1면';
    } else {
        if (btnBoth) btnBoth.textContent = 'back-1면, 2면';
        if (btnOnly2) btnOnly2.textContent = 'back-2면';
    }
}

function setBackDisplayMode(mode) {
    backDisplayMode = mode === 'only2' ? 'only2' : 'both';
    safeSaveStorage(STORAGE_KEYS.BACK_DISPLAY_MODE, backDisplayMode);
    const btnBoth = document.getElementById('btnBackBoth');
    const btnOnly2 = document.getElementById('btnBackOnly2');
    if (btnBoth) btnBoth.classList.toggle('active', backDisplayMode === 'both');
    if (btnOnly2) btnOnly2.classList.toggle('active', backDisplayMode === 'only2');
}

function shuffleArray(arr) {
    const copy = arr.map(item => ({ ...item }));
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }
    return copy;
}

function isChunkStudyMode() {
    return chunkSize !== 'all' && Number(chunkSize) > 0;
}

function startStudy() {
    parsePastedData();
    if (parsedCards.length === 0) return;

    const chunkSizeSelect = document.getElementById('chunkSizeSelect');
    if (chunkSizeSelect) {
        chunkSize = chunkSizeSelect.value || 'all';
    }

    let orderedDeck = parsedCards.map(card => ({ ...card }));
    if (studyOrder === 'random') {
        orderedDeck = shuffleArray(orderedDeck);
    }

    studyChunks = [];
    if (isChunkStudyMode()) {
        const size = parseInt(chunkSize, 10);
        for (let i = 0; i < orderedDeck.length; i += size) {
            studyChunks.push(orderedDeck.slice(i, i + size));
        }
    } else {
        studyChunks.push(orderedDeck);
    }

    currentChunkIndex = 0;

    // Update deck title in header
    const deckTitleEl = document.getElementById('studyDeckTitle');
    if (deckTitleEl) {
        deckTitleEl.textContent = currentDeckName || '';
        deckTitleEl.style.display = currentDeckName ? 'block' : 'none';
    }

    loadChunk(0);
}

function loadChunk(chunkIdx) {
    if (!studyChunks.length || chunkIdx < 0 || chunkIdx >= studyChunks.length) return;

    currentChunkIndex = chunkIdx;
    currentChunkCards = studyChunks[currentChunkIndex].map(card => ({ ...card }));
    studyList = currentChunkCards.map(card => ({ ...card }));

    // Reset study state for this chunk
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

function startNextChunk() {
    if (!isChunkStudyMode()) return;
    if (currentChunkIndex >= studyChunks.length - 1) return;

    // Enforce mastery gate: all cards in current pass must be marked 'known'
    const allCorrect = cardStates.length > 0 && cardStates.every(state => state === 'known');
    if (!allCorrect) return;

    loadChunk(currentChunkIndex + 1);
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
    const progressEl = document.getElementById('progressText');
    if (progressEl) {
        if (isChunkStudyMode() && studyChunks.length > 1) {
            progressEl.textContent = `묶음 ${currentChunkIndex + 1}/${studyChunks.length} · ${currentIndex + 1} / ${studyList.length}`;
        } else {
            progressEl.textContent = `${currentIndex + 1} / ${studyList.length}`;
        }
    }
    const progressPercent = ((currentIndex + 1) / studyList.length) * 100;
    document.getElementById('progressBarFill').style.width = `${progressPercent}%`;

    // Make sure card is face down (unflipped)
    const cardInner = document.getElementById('cardInner');
    cardInner.classList.remove('flipped');

    // Populate Front (질문) and Back (답변) according to frontSideMode ('1' or '2')
    const frontTitle = document.getElementById('cardFrontTitle');
    const frontSentence = document.getElementById('cardFrontSentence');
    const backHeader = document.getElementById('cardBackHeader');
    const backTerm = document.getElementById('cardBackTerm');
    const backSentence = document.getElementById('cardBackSentence');
    const meaningDiv = document.getElementById('cardBackMeaning');

    const isReversed = frontSideMode === '2';
    const rawFront = isReversed ? (t.answer || '').trim() : (t.question || '').trim();
    const rawBack = isReversed ? (t.question || '').trim() : (t.answer || '').trim();
    const questionText = rawFront || '(질문 없음)';
    const answerText = rawBack;

    const qLines = questionText.split('\n');
    const questionHasRich = hasRichContent(questionText);
    const answerHasRich = hasRichContent(answerText);
    const isImageCard = questionHasRich || answerHasRich;
    const isBackOnly2 = backDisplayMode === 'only2';

    const flashcardEl = document.getElementById('flashcard');
    const studyViewEl = document.getElementById('studyView');
    const cardBackEl = document.querySelector('#cardInner .card-back');
    if (flashcardEl) {
        flashcardEl.classList.toggle('has-image-card', isImageCard);
        flashcardEl.classList.toggle('no-back-answer', !answerText && !isBackOnly2);
    }
    if (studyViewEl) {
        studyViewEl.classList.toggle('study-has-image', isImageCard);
    }
    if (cardBackEl) {
        cardBackEl.classList.toggle('card-back-only-2', isBackOnly2);
        cardBackEl.classList.toggle('card-back-image-only',
            isBackOnly2 ? answerHasRich : (isImageCard && !answerText)
        );
    }

    if (backHeader) {
        backHeader.style.display = isBackOnly2 ? 'none' : 'block';
    }

    if (questionHasRich) {
        const richFrontHtml = renderMarkdownAndMath(questionText);
        frontTitle.innerHTML = richFrontHtml;
        if (frontSentence) {
            frontSentence.style.display = 'none';
            frontSentence.innerHTML = '';
        }

        backTerm.innerHTML = richFrontHtml;
        if (backSentence) {
            backSentence.style.display = 'none';
            backSentence.innerHTML = '';
        }
    } else if (qLines.length > 1) {
        const mainText = qLines[0].trim();
        const sentenceText = qLines.slice(1).join('\n').trim();
        const highlightedSentenceHtml = highlightTargetInSentence(sentenceText, mainText);

        // Front (질문 면)
        frontTitle.textContent = mainText;
        if (frontSentence) {
            frontSentence.style.display = 'block';
            frontSentence.innerHTML = highlightedSentenceHtml;
            renderKaTeXInElement(frontSentence);
        }

        // Back Header (뒷면 상단 질문 면 표시)
        backTerm.textContent = mainText;
        if (backSentence) {
            backSentence.style.display = 'block';
            backSentence.innerHTML = highlightedSentenceHtml;
            renderKaTeXInElement(backSentence);
        }
    } else {
        // Front (질문 면)
        frontTitle.textContent = questionText;
        if (frontSentence) {
            frontSentence.style.display = 'none';
            frontSentence.innerHTML = '';
        }

        // Back Header (뒷면 상단 질문 면 표시)
        backTerm.textContent = questionText;
        if (backSentence) {
            backSentence.style.display = 'none';
            backSentence.innerHTML = '';
        }
    }
    renderKaTeXInElement(frontTitle);
    renderKaTeXInElement(backTerm);

    // Populate Answer Side on Back (뒷면 하단 답변 면 표시)
    const aLines = answerText ? answerText.split('\n') : [];
    const firstLineRich = aLines.length > 0 && hasRichContent(aLines[0]);

    if (!answerText) {
        if (backHeader) backHeader.style.borderBottom = 'none';
        if (isBackOnly2) {
            meaningDiv.style.display = '';
            meaningDiv.innerHTML = renderMarkdownAndMath('');
        } else {
            meaningDiv.style.display = 'none';
            meaningDiv.innerHTML = '';
        }
    } else {
        if (backHeader) backHeader.style.borderBottom = isBackOnly2 ? 'none' : '';
        meaningDiv.style.display = '';
        if (aLines.length > 1 && !firstLineRich) {
            const meaningHeader = aLines[0].trim();
            const translationBody = aLines.slice(1).join('\n').trim();
            const bodyHtml = isReversed && !hasRichContent(translationBody)
                ? highlightTargetInSentence(translationBody, meaningHeader).replace(/\n/g, '<br>')
                : renderMarkdownAndMath(translationBody);
            meaningDiv.innerHTML = `
                <div class="card-back-target-meaning">${escapeHtml(meaningHeader)}</div>
                <div class="card-back-translation-body">${bodyHtml}</div>
            `;
        } else {
            meaningDiv.innerHTML = renderMarkdownAndMath(answerText);
        }
        renderKaTeXInElement(meaningDiv);
    }

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
    let knownCount = 0;
    let unknownCount = 0;
    cardStates.forEach(state => {
        if (state === 'known') knownCount++;
        else unknownCount++; // unseen & unknown counted together
    });

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statKnown').textContent = knownCount;
    document.getElementById('statUnknown').textContent = unknownCount;

    const statsTitle = document.getElementById('statsTitle');
    const statsSubtitle = document.getElementById('statsSubtitle');
    const btnNextChunk = document.getElementById('btnNextChunk');
    const btnRestart = document.getElementById('btnRestart');
    const btnFailed = document.getElementById('btnStudyFailed');

    const chunkMode = isChunkStudyMode();
    const hasNextChunk = chunkMode && currentChunkIndex < studyChunks.length - 1;
    const allCorrect = total > 0 && unknownCount === 0;

    if (chunkMode) {
        if (allCorrect) {
            if (hasNextChunk) {
                const nextCount = studyChunks[currentChunkIndex + 1].length;
                if (statsTitle) {
                    statsTitle.textContent = `🎉 ${currentChunkIndex + 1} / ${studyChunks.length} 묶음 학습 완료!`;
                }
                if (statsSubtitle) {
                    statsSubtitle.textContent = `현재 묶음을 모두 맞췄습니다! 다음 ${nextCount}개 학습으로 넘어갈 수 있습니다.`;
                    statsSubtitle.className = 'stats-subtitle is-success';
                }
                if (btnNextChunk) {
                    btnNextChunk.style.display = 'inline-flex';
                    btnNextChunk.disabled = false;
                    btnNextChunk.textContent = `➡️ 다음 ${nextCount}개 학습하기 (${currentChunkIndex + 2}/${studyChunks.length})`;
                }
                if (btnRestart) {
                    btnRestart.className = 'btn btn-secondary';
                    btnRestart.textContent = '🔄 현재 묶음 다시 학습';
                }
            } else {
                if (statsTitle) {
                    statsTitle.textContent = '🎉 모든 학습을 완료했습니다!';
                }
                if (statsSubtitle) {
                    statsSubtitle.textContent = studyChunks.length > 1
                        ? `전체 ${studyChunks.length}개 묶음(${parsedCards.length}개 카드)을 모두 마스터했습니다!`
                        : '모든 카드를 완벽하게 맞췄습니다!';
                    statsSubtitle.className = 'stats-subtitle is-success';
                }
                if (btnNextChunk) {
                    btnNextChunk.style.display = 'none';
                }
                if (btnRestart) {
                    btnRestart.className = 'btn btn-primary';
                    btnRestart.textContent = '🔄 처음부터 다시 학습하기';
                }
            }
        } else {
            if (statsTitle) {
                statsTitle.textContent = studyChunks.length > 1
                    ? `📝 ${currentChunkIndex + 1} / ${studyChunks.length} 묶음 학습 결과`
                    : '📝 학습 결과';
            }
            if (statsSubtitle) {
                statsSubtitle.textContent = hasNextChunk
                    ? `⚠️ 현재 묶음의 카드를 모두 맞춰야 다음 학습으로 넘어갈 수 있습니다.`
                    : `⚠️ 현재 묶음의 카드를 모두 맞춰야 학습을 완료할 수 있습니다.`;
                statsSubtitle.className = 'stats-subtitle is-warning';
            }
            if (btnNextChunk) {
                if (hasNextChunk) {
                    const nextCount = studyChunks[currentChunkIndex + 1].length;
                    btnNextChunk.style.display = 'inline-flex';
                    btnNextChunk.disabled = true;
                    btnNextChunk.textContent = `🔒 다음 ${nextCount}개 학습하기 (모두 맞춤 필요)`;
                } else {
                    btnNextChunk.style.display = 'none';
                }
            }
            if (btnRestart) {
                btnRestart.className = 'btn btn-primary';
                btnRestart.textContent = '🔄 현재 묶음 다시 학습';
            }
        }
    } else {
        if (statsTitle) {
            statsTitle.textContent = '🎉 학습을 완료했습니다!';
        }
        if (statsSubtitle) {
            statsSubtitle.textContent = '학습 통계를 보여줍니다.';
            statsSubtitle.className = 'stats-subtitle';
        }
        if (btnNextChunk) {
            btnNextChunk.style.display = 'none';
        }
        if (btnRestart) {
            btnRestart.className = 'btn btn-primary';
            btnRestart.textContent = '🔄 다시 학습하기';
        }
    }

    // Show button to study only failed/unknown items if they exist
    if (btnFailed) {
        if (unknownCount > 0) {
            btnFailed.style.display = 'inline-flex';
            btnFailed.textContent = `❌ 틀린 ${unknownCount}개만 다시 학습`;
        } else {
            btnFailed.style.display = 'none';
        }
    }
}

// Stats actions: Restart
function restartStudy() {
    if (isChunkStudyMode()) {
        const allCorrect = cardStates.length > 0 && cardStates.every(state => state === 'known');
        const isLastChunk = currentChunkIndex >= studyChunks.length - 1;
        // If all chunks are completely finished, restart from the very first chunk
        if (allCorrect && isLastChunk) {
            startStudy();
            return;
        }
        // Otherwise, restart the current chunk with all n cards of this chunk
        loadChunk(currentChunkIndex);
        return;
    }

    // Non-chunk ('all') mode: restore full currentChunkCards (and re-shuffle if random)
    if (currentChunkCards.length > 0) {
        studyList = studyOrder === 'random'
            ? shuffleArray(currentChunkCards)
            : currentChunkCards.map(card => ({ ...card }));
    }

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

    studyList = studyOrder === 'random' ? shuffleArray(failedList) : failedList;
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
    const imageBlocks = [];
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
        (match, filename) => {
            const placeholder = `%%IMG_${imageBlocks.length}%%`;
            imageBlocks.push({
                placeholder,
                html: `<div class="image-container"><img src="img/${filename}" alt="${escapeHtml(filename)}" class="term-image"></div>`
            });
            return placeholder;
        }
    );

    // 2-1. Resolve embedded JSON markdown images ![alt](img_key)
    const map = currentImagesMap || {};
    processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, rawKey) => {
        const trimmedTarget = rawKey.trim().replace(/^image:/i, '').trim();
        const hashIdx = trimmedTarget.indexOf('#');
        const imgKey = hashIdx !== -1 ? trimmedTarget.slice(0, hashIdx).trim() : trimmedTarget;

        const imgObj = map[imgKey];
        if (imgObj && imgObj.data) {
            const imgHtml = `<div class="image-container"><img src="${imgObj.data}" alt="${escapeHtml(alt || imgObj.name || imgKey)}" class="term-image"></div>`;
            const placeholder = `%%IMG_${imageBlocks.length}%%`;
            imageBlocks.push({ placeholder, html: imgHtml });
            return placeholder;
        }
        return match;
    });

    // 3. Render Markdown using marked.js if available
    let html = '';
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
        html = marked.parse(processed);
    } else {
        html = processed.replace(/\n/g, '<br>');
    }

    // 3-1. Restore image blocks (unwrap surrounding <p> if sole element in paragraph)
    imageBlocks.forEach(item => {
        const pWrapped = `<p>${item.placeholder}</p>`;
        if (html.includes(pWrapped)) {
            html = html.split(pWrapped).join(item.html);
        } else {
            html = html.split(item.placeholder).join(item.html);
        }
    });

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
