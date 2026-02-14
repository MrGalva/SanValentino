/**
 * Valentine's Day Interactive Experience
 * Act I: Intro
 * Act II: Greeting
 * Act III: Memory Game (Story or Arcade)
 */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
let active = false; // State Management

// --- CARD CONFIGURATION SYSTEM ---
const SPECIAL_CARDS = {
    'X': {
        name: 'The Revealer',
        type: 'buff',
        effectType: 'instant',
        onMatch: () => {
            // Reveal all cards for 1 second
            const allCards = document.querySelectorAll('.card');
            allCards.forEach(card => {
                if (!card.classList.contains('matched') && !card.classList.contains('flipped')) {
                    card.classList.add('flipped');
                }
            });
            setTimeout(() => {
                allCards.forEach(card => {
                    if (!card.classList.contains('matched') && !card.classList.contains('selected')) {
                        card.classList.remove('flipped');
                    }
                });
            }, 1000);
        },
        description: 'Rivela tutte le carte!'
    },
    'T': {
        name: 'Time Freeze',
        type: 'buff',
        effectType: 'duration',
        duration: 4000,
        visualClass: 'effect-pulse',
        onMatch: () => {
            gameState.activeEffects.add('freeze_timer');
            const bar = document.getElementById('timer-progress');
            bar.classList.add('frozen');

            setTimeout(() => {
                gameState.activeEffects.delete('freeze_timer');
                bar.classList.remove('frozen');
            }, 4000);
        },
        description: 'Congela il tempo per 4s!'
    },
    'C': {
        name: 'Time Freeze',
        type: 'buff',
        effectType: 'duration',
        duration: 2000,
        visualClass: 'effect-pulse',
        onMatch: () => {
            gameState.activeEffects.add('freeze_timer');
            const bar = document.getElementById('timer-progress');
            bar.classList.add('frozen');

            setTimeout(() => {
                gameState.activeEffects.delete('freeze_timer');
                bar.classList.remove('frozen');
            }, 2000);
        },
        description: 'Congela il tempo per 2s!'
    },
    'M': {
        name: 'Swipe Block',
        type: 'malus',
        effectType: 'passive',
        duration: 4000,
        visualClass: 'effect-malus-2',
        onMatch: () => {
            gameState.activeEffects.add('block_swipe');
            const allCards = document.querySelectorAll('.card');
            allCards.forEach(card => {
                if (!card.classList.contains('matched') && !card.classList.contains('effect-malus')) {
                    card.classList.add('effect-malus');
                }
            });
            setTimeout(() => {
                gameState.activeEffects.delete('block_swipe');
                const allCards = document.querySelectorAll('.card');
                allCards.forEach(card => {
                    if (card.classList.contains('effect-malus')) {
                        card.classList.remove('effect-malus');
                    }
                    if (card.classList.contains('effect-malus-2')) {
                        card.classList.remove('effect-malus-2');
                    }
                });
            }, 4000);
        },
        description: 'Blocca lo swipe (Malus)!'
    },
    'K': {
        name: 'Extra Time',
        type: 'buff',
        effectType: 'instant',
        onMatch: () => {
            gameState.timeLeft += 4;
        },
        description: 'Extra Time (+4s)!'
    }
};

// --- ARCADE MILESTONES ---
const MILESTONES = [
    { score: 20000, img: 'assets/20.png', text: 'Amazing! 20,000 Points! 🌟 \n Take a screenshot to prove your milestone!' },
    { score: 25000, img: 'assets/25.png', text: 'Incredible! 25,000 Points! 💖 \n Take a screenshot to prove your milestone!' },
    { score: 30000, img: 'assets/30.png', text: 'Legendary! 30,000 Points! 🏆 \n Take a screenshot to prove your milestone!' },
];

// --- GAME STATE ---
const gameState = {
    mode: 'story', // 'story' or 'arcade'
    level: 1, // Current level ID (Story 1-3, Arcade 1-Infinity)
    score: 0, // Arcade Score

    flippedCards: [],
    matchedPairs: 0,
    isLocked: false,
    timer: null,
    timeLeft: 0,
    activeEffects: new Set(),
    triggeredMilestones: new Set(),
    assets: ['C', 'F', 'H', 'I', 'K', 'L', 'M', 'T', 'X', 'Y']
};

// --- SOUND SYSTEM (AudioManager) ---
class AudioManager {
    constructor() {
        this.enabled = true;
        this.useWebAudio = true;
        this.buffers = {};
        this.fallback = {};
        this.loaded = false;
        this.musicStarted = false;

        // ── Volume Settings (tune these) ──
        this.sfxVol = 0.3;   // SFX volume (Web Audio gain & fallback)
        this.ambientVol = 0.04;  // Ambient music normal volume
        this.duckVol = 0.01;  // Ambient music ducked volume

        // Ambient Music
        this.ambient = new Audio('assets/sounds/ambient_music.mp3');
        this.ambient.loop = true;
        this.ambient.volume = this.ambientVol;

        // SFX Files
        this.sfxFiles = {
            flip: 'assets/sounds/card_flip.wav',
            match: 'assets/sounds/card_match_pop.wav',
            select: 'assets/sounds/card_select.wav',
            level: 'assets/sounds/level.wav',
            milestone: 'assets/sounds/milestone.wav',
        };

        // Web Audio Context (graceful fallback if unavailable)
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            // SFX Gain
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.value = this.sfxVol;
            this.gainNode.connect(this.ctx.destination);

            // Music Gain (for iOS volume control)
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = this.ambientVol;
            this.musicGain.connect(this.ctx.destination);

            // Connect Ambient Element to Web Audio Graph
            // This allows volume control on iOS where .volume property is ignored
            if (this.ctx.createMediaElementSource) {
                const source = this.ctx.createMediaElementSource(this.ambient);
                source.connect(this.musicGain);
            }
        } catch (e) {
            this.useWebAudio = false;
            this.ctx = null;
            this.gainNode = null;
        }

        // Pre-create fallbacks
        for (const [name, url] of Object.entries(this.sfxFiles)) {
            this.fallback[name] = new Audio(url);
        }
    }

    init() {
        if (this.loaded) return;
        this.loaded = true;

        if (!this.ctx) return; // Web Audio unavailable, rely on fallbacks

        // Mobile Safari Unlock: play a silent sound & resume
        const unlock = () => {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().then(() => {
                    // Play silent buffer to fully wake up audio engine
                    const src = this.ctx.createBufferSource();
                    src.buffer = this.ctx.createBuffer(1, 1, 22050);
                    src.connect(this.ctx.destination);
                    src.start(0);
                });
            }
            document.removeEventListener('touchstart', unlock);
            document.removeEventListener('click', unlock);
        };

        // Try to unlock immediately (if init called from user gesture)
        unlock();

        // Also add listeners in case the first attempt failed
        document.addEventListener('touchstart', unlock);
        document.addEventListener('click', unlock);

        // Decode SFX
        for (const [name, url] of Object.entries(this.sfxFiles)) {
            fetch(url)
                .then(res => res.arrayBuffer())
                .then(buf => this.ctx.decodeAudioData(buf))
                .then(decoded => { this.buffers[name] = decoded; })
                .catch(() => {
                    // Only skip this sound — don't disable Web Audio globally
                    delete this.buffers[name];
                });
        }

    }

    play(name) {
        if (!this.enabled) return;

        // Web Audio Path
        if (this.useWebAudio && this.buffers[name]) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers[name];
            source.connect(this.gainNode);
            source.start(0);
            return;
        }

        // Fallback Path
        if (this.fallback[name]) {
            const s = this.fallback[name].cloneNode();
            s.volume = this.sfxVol;
            s.addEventListener('ended', () => s.remove());
            s.play().catch(() => { });
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        const btn = document.getElementById('sound-toggle');
        if (btn) btn.textContent = this.enabled ? '🔊' : '🔇';

        if (this.enabled) {
            if (this.musicStarted) this.ambient.play().catch(() => { });
        } else {
            this.ambient.pause();
        }
    }

    duckMusic(active) {
        this.ambient.volume = active ? this.duckVol : this.ambientVol;
    }

    startMusic() {
        this.musicStarted = true;
        if (this.enabled && (this.ambient.paused || this.ambient.currentTime === 0)) {
            if (this.useWebAudio && this.musicGain) {
                this.musicGain.gain.value = this.ambientVol;
            } else {
                this.ambient.volume = this.ambientVol;
            }
            this.ambient.play().catch(() => { });
        } else if (this.enabled) {
            // Ensure volume is correct even if already playing
            if (this.useWebAudio && this.musicGain) {
                this.musicGain.gain.value = this.ambientVol;
            } else {
                this.ambient.volume = this.ambientVol;
            }
        }
    }

    stopMusic() {
        this.musicStarted = false;
        this.ambient.pause();
        this.ambient.currentTime = 0;
    }
}

const audioManager = new AudioManager();

document.getElementById('sound-toggle').addEventListener('click', () => {
    audioManager.toggle();
});

// DOM Elements for Game
const gameGrid = document.getElementById('game-grid');
const levelIndicator = document.getElementById('level-indicator');
const scoreDisplay = document.getElementById('score-display');
const scoreVal = document.getElementById('score-val');
const timerProgress = document.getElementById('timer-progress');
const gameMessage = document.getElementById('game-message');
const gameMessageText = document.getElementById('game-message-text');

const nextBtn = document.getElementById('game-next-btn');
const restartBtn = document.getElementById('game-restart-btn');
const arcadeBtn = document.getElementById('game-arcade-btn'); // In Win screen

// DOM Elements for Milestones
const milestonePopup = document.getElementById('milestone-popup');
const milestoneImg = document.getElementById('milestone-img');
const milestoneText = document.getElementById('milestone-text');
const milestoneBtn = document.getElementById('milestone-btn');
const act3El = document.getElementById('act-iii');

// --- ACT TRANSITIONS ---

document.getElementById('start-btn').addEventListener('click', () => {
    audioManager.init(); // Resume AudioContext & decode SFX on first interaction
    gtag('event', 'sv_click_start');
    transitionToAct2();
});

function transitionToAct2() {
    const act1 = document.getElementById('act-i');
    const act2 = document.getElementById('act-ii');

    act1.style.opacity = '0';
    setTimeout(() => {
        act1.style.display = 'none';
        act2.classList.remove('hidden');

        // Start Canvas
        active = true;
        resize();
        initParticles();
        animate();

        void act2.offsetWidth;
        act2.style.opacity = '1';
    }, 1000);
}

// Story Mode Start
document.getElementById('act2-btn').addEventListener('click', () => {
    gtag('event', 'sv_story_start');
    gameState.mode = 'story';
    transitionToAct3();
});

// Arcade Mode Start (Act II)
document.getElementById('act2-arcade-btn').addEventListener('click', () => {
    startArcadeMode();
    transitionToAct3();
});

function transitionToAct3() {
    const act2 = document.getElementById('act-ii');
    const act3 = document.getElementById('act-iii');

    act2.style.opacity = '0';
    setTimeout(() => {
        act2.style.display = 'none';
        act3.classList.remove('hidden');
        void act3.offsetWidth;
        act3.style.opacity = '1';

        if (gameState.mode === 'story') {
            startGameLevel(1);
        }
    }, 1000);
}

// --- GAME LOGIC ---

function startArcadeMode() {
    gtag('event', 'sv_arcade');
    gameState.mode = 'arcade';
    gameState.score = 0;
    gameState.level = 1; // Arcade Level 1
    gameState.triggeredMilestones.clear();
    startGameLevel(1);
}

function getArcadeConfig(level) {
    // Arcade Progression:
    // Levels 1-2: 6 pairs (12 cards)
    // Levels 3-5: 8 pairs (16 cards)
    // Levels 6+:  10 pairs (20 cards)

    let pairs = 6;
    if (level >= 3 && level <= 5) pairs = 8;
    else if (level >= 6) pairs = 10;

    // Time Calculation
    let time = pairs * (5.1 - (1.8 * level / 10));

    return {
        id: level,
        pairs: pairs,
        time: time,
        specials: ['X', 'T', 'M', 'K', 'C']
    };
}

function getStoryConfig(levelId) {
    // Custom Story Mode Configuration
    let pairs = 2;
    let customDeck = [];

    if (levelId === 1) {
        pairs = 2;
        customDeck = ['L', 'Y'];
    } else if (levelId === 2) {
        pairs = 4;
        customDeck = ['I', 'L', 'Y', 'H'];
    } else if (levelId === 3) {
        pairs = 6;
        customDeck = ['I', 'L', 'Y', 'H', 'X', 'M'];
    } else if (levelId === 4) {
        pairs = 8;
        customDeck = ['I', 'L', 'Y', 'H', 'X', 'M', 'T', 'K'];
    } else if (levelId >= 5) {
        pairs = 10;
        customDeck = ['I', 'L', 'Y', 'H', 'H', 'X', 'M', 'T', 'K', 'C'];
    }

    // Time Calculation
    let time = pairs * 5;

    return {
        id: levelId,
        pairs: pairs,
        time: time,
        fixedAssets: customDeck // Pass custom deck
    };
}

function startGameLevel(levelId) {
    gtag('event', 'sv_level_start', { level: levelId, mode: gameState.mode });
    let levelConfig;

    if (gameState.mode === 'story') {
        levelConfig = getStoryConfig(levelId);
        scoreDisplay.classList.add('hidden');
        levelIndicator.textContent = `Level ${levelId}`;
    } else {
        // Arcade
        levelConfig = getArcadeConfig(levelId);
        scoreDisplay.classList.remove('hidden');
        scoreVal.textContent = gameState.score;
        levelIndicator.textContent = `Arcade Level ${levelId}`;
    }

    gameState.level = levelId;
    gameState.matchedPairs = 0;
    gameState.flippedCards = [];
    gameState.isLocked = false;
    gameState.timeLeft = levelConfig.time;
    gameState.pairs = levelConfig.pairs;
    gameState.activeEffects.clear();

    // Start ambient music
    audioManager.startMusic();

    gameMessage.classList.add('hidden');
    nextBtn.classList.add('hidden');
    restartBtn.classList.add('hidden');
    arcadeBtn.classList.add('hidden');

    // Grid Setup
    gameGrid.className = '';
    // Correct grid class based on card count (pairs * 2)
    // This now maps correctly to the new CSS classes:
    // 7 pairs -> grid-14
    // 8 pairs -> grid-16
    // 9 pairs -> grid-18
    const cardCount = levelConfig.pairs * 2;
    gameGrid.classList.add(`grid-${cardCount}`);

    gameGrid.innerHTML = '';

    // Generate Cards
    const cards = generateCards(levelConfig.pairs, levelConfig.specials, levelConfig.fixedAssets);
    cards.forEach(cardData => {
        const cardEl = createCardElement(cardData);
        gameGrid.appendChild(cardEl);
    });

    startTimer(levelConfig.time);
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function generateCards(pairsCount, allowedSpecials = [], fixedAssets = null) {
    let deck = [];

    // If fixedAssets is provided, use it directly (Story Mode)
    if (fixedAssets && fixedAssets.length > 0) {
        fixedAssets.forEach(asset => {
            deck.push({ value: asset, id: Math.random() });
            deck.push({ value: asset, id: Math.random() });
        });
        return shuffleArray(deck);
    }

    // Logic for Arcade / Random Mode:
    const allSpecialKeys = Object.keys(SPECIAL_CARDS);
    let usedSpecials = [];
    if (allowedSpecials && allowedSpecials.length > 0) {
        if (pairsCount > 2) {
            // 1 random special
            const randomSpecial = allowedSpecials[Math.floor(Math.random() * allowedSpecials.length)];
            usedSpecials.push(randomSpecial);
        }
    }

    // Fill rest with Regulars (exclude ALL special card keys from the pool)
    const neededRegulars = pairsCount - usedSpecials.length;
    const pool = gameState.assets.filter(a => !usedSpecials.includes(a) && !allSpecialKeys.includes(a));
    const shuffledRegulars = shuffleArray([...pool]);

    // If we run out of unique assets, we might need to reuse logic
    let selectedRegulars = shuffledRegulars.slice(0, neededRegulars);

    // If we don't have enough regular cards, fill with 'H'
    while (selectedRegulars.length < neededRegulars) {
        selectedRegulars.push('H');
    }

    const finalAssets = [...usedSpecials, ...selectedRegulars];

    finalAssets.forEach(asset => {
        deck.push({ value: asset, id: Math.random() });
        deck.push({ value: asset, id: Math.random() });
    });

    return shuffleArray(deck);
}

function createCardElement(cardData) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.value = cardData.value;

    if (SPECIAL_CARDS[cardData.value]) {
        const config = SPECIAL_CARDS[cardData.value];
        if (config.visualClass) {
            card.classList.add(config.visualClass);
        }
    }

    const front = document.createElement('div');
    front.className = 'card-face card-front';

    const back = document.createElement('div');
    back.className = 'card-face card-back';

    const img = document.createElement('img');
    img.src = `assets/${cardData.value}.png`;
    img.alt = cardData.value;
    img.onerror = function () { this.style.display = 'none'; this.parentNode.innerText = cardData.value; };
    back.appendChild(img);

    card.appendChild(front);
    card.appendChild(back);

    // Interaction
    const peek = () => {
        if (gameState.activeEffects.has('block_swipe')) return;
        if (gameState.flippedCards.length > 0) return;
        if (gameState.isLocked || card.classList.contains('flipped') || card.classList.contains('matched') || card.classList.contains('selected')) return;

        card.classList.add('flipped');
        audioManager.play('flip');
        if (card.peekTimeout) clearTimeout(card.peekTimeout);

        card.peekTimeout = setTimeout(() => {
            if (!card.classList.contains('selected') && !card.classList.contains('matched')) {
                card.classList.remove('flipped');
            }
        }, 1500);
    };

    card.addEventListener('mouseenter', peek);

    card.addEventListener('click', (e) => {
        if (gameState.isLocked) return;
        if (card.classList.contains('matched') || card.classList.contains('selected')) return;

        if (gameState.flippedCards.length < 2) {
            selectCard(card);
            if (card.peekTimeout) clearTimeout(card.peekTimeout);
        }
    });

    return card;
}

document.addEventListener('touchmove', function (e) {
    if (act3El.classList.contains('hidden')) return;
    if (gameState.activeEffects.has('block_swipe')) return;
    if (gameState.flippedCards.length > 0) return;

    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const card = target ? target.closest('.card') : null;

    if (card && !card.classList.contains('flipped')) {
        const event = new Event('mouseenter');
        card.dispatchEvent(event);
    }
    e.preventDefault();
}, { passive: false });

function selectCard(card) {
    if (gameState.isLocked) return;
    if (card.classList.contains('selected') || card.classList.contains('matched')) return;

    card.classList.add('flipped');
    card.classList.add('selected');
    audioManager.play('select');

    gameState.flippedCards.push(card);

    if (gameState.flippedCards.length === 2) {
        checkMatch();
    }
}

function checkMatch() {
    gameState.isLocked = true;
    const [card1, card2] = gameState.flippedCards;

    const match = card1.dataset.value === card2.dataset.value;

    if (match) {
        card1.classList.remove('selected');
        card2.classList.remove('selected');
        card1.classList.add('matched');
        card2.classList.add('matched');
        audioManager.play('match');

        // Spawn a big heart at card2's position
        const rect = card2.getBoundingClientRect();
        const p = new Particle();
        p.mouseInteraction = false;
        p.x = rect.left + rect.width / 2;
        p.y = rect.top + rect.height / 2;
        p.size = 32;
        p.speedY = Math.random() * 1.5 + 0.5;
        p.speedX = (Math.random() - 0.5) * 0.5;
        p.opacity = 0.9;
        particles.push(p);

        gameState.matchedPairs++;
        gameState.flippedCards = [];
        gameState.isLocked = false;

        // ARCADE SCORING
        if (gameState.mode === 'arcade') {
            const prevScore = gameState.score;
            gameState.score += 200 + (20 * gameState.level);
            scoreVal.textContent = gameState.score;
            checkMilestones(prevScore, gameState.score);
        }

        gtag('event', 'sv_match_found', { level: gameState.level, mode: gameState.mode, card: card1.dataset.value });

        if (SPECIAL_CARDS[card1.dataset.value]) {
            const config = SPECIAL_CARDS[card1.dataset.value];
            gtag('event', 'sv_special_card', { card_type: config.type, level: gameState.level });
            if (config.onMatch) {
                config.onMatch(gameState);
            }
        }

        // Check Win
        if (gameState.matchedPairs === gameState.pairs) {
            handleLevelWin();
        }

    } else {
        setTimeout(() => {
            card1.classList.remove('selected', 'flipped');
            card2.classList.remove('selected', 'flipped');
            gameState.flippedCards = [];
            gameState.isLocked = false;
        }, 500);
    }
}

function startTimer(seconds) {
    clearInterval(gameState.timer);
    gameState.timeLeft = seconds;
    updateTimerUI(seconds, seconds);

    gameState.timer = setInterval(() => {
        if (!gameState.activeEffects.has('freeze_timer')) {
            gameState.timeLeft = Math.max(0, gameState.timeLeft - 1);
        }

        updateTimerUI(gameState.timeLeft, seconds);

        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timer);
            handleLevelLoss();
        }
    }, 1000);
}

// --- MILESTONE CHECK ---
function checkMilestones(prevScore, newScore) {
    for (const milestone of MILESTONES) {
        if (prevScore < milestone.score && newScore >= milestone.score && !gameState.triggeredMilestones.has(milestone.score)) {
            gameState.triggeredMilestones.add(milestone.score);
            gtag('event', 'sv_milestone', { score: milestone.score, level: gameState.level });
            showMilestonePopup(milestone);
        }
    }
}

function showMilestonePopup(milestone) {
    milestoneImg.src = milestone.img;
    milestoneText.textContent = milestone.text;
    milestonePopup.classList.add('visible');
    audioManager.play('milestone');

    // Pause timer, lock game, and duck music
    gameState.activeEffects.add('freeze_timer');
    gameState.isLocked = true;
    audioManager.duckMusic(true);

    milestoneBtn.onclick = () => {
        milestonePopup.classList.remove('visible');
        gameState.activeEffects.delete('freeze_timer');
        gameState.isLocked = false;
        audioManager.duckMusic(false);
    };
}

function updateTimerUI(current, total) {
    const pct = (current / total) * 100;
    timerProgress.style.width = `${pct}%`;
    if (pct < 30) timerProgress.style.background = '#ff6b6b';
    else timerProgress.style.background = 'linear-gradient(90deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)';
}

function handleLevelWin() {
    clearInterval(gameState.timer);
    audioManager.duckMusic(true);
    triggerWinParticles();

    setTimeout(() => {
        // audioManager.duckMusic(false);
        audioManager.play('level');
        if (gameState.mode === 'story') {
            // STORY MODE WIN LOGIC
            if (gameState.level === 5) {
                gtag('event', 'sv_game_complete');
                gameMessageText.textContent = "I hope this game adds a little joy to your day. It's my way of bridging the gap between us until I can see you again. Happy Valentine's Day! ❤️";
                gameMessage.classList.remove('hidden');

                // Add Arcade Button here too
                arcadeBtn.onclick = () => {
                    startArcadeMode();
                }
                arcadeBtn.classList.remove('hidden');

            } else {
                gtag('event', 'sv_level_win', { level: gameState.level, mode: 'story', time_remaining: gameState.timeLeft });
                gameMessageText.textContent = "Level Complete! ❤️";
                nextBtn.classList.remove('hidden');
                gameMessage.classList.remove('hidden');

                nextBtn.onclick = () => {
                    startGameLevel(gameState.level + 1);
                };
            }
        } else {
            // ARCADE MODE WIN LOGIC
            gtag('event', 'sv_level_win', { level: gameState.level, mode: 'arcade', score: gameState.score, time_remaining: gameState.timeLeft });
            gameMessageText.innerHTML = `Level Complete! <br> Score: ${gameState.score}`;
            nextBtn.classList.remove('hidden');
            gameMessage.classList.remove('hidden');

            nextBtn.onclick = () => {
                startGameLevel(gameState.level + 1);
            };
        }
    }, 1000);
}

function handleLevelLoss() {
    audioManager.play('level');
    audioManager.duckMusic(true);
    if (gameState.mode === 'story') {
        gtag('event', 'sv_level_fail', { level: gameState.level, mode: 'story' });
        gameMessageText.textContent = "Time's up! 💔";
        restartBtn.innerText = "Try Again";
        restartBtn.onclick = () => {
            startGameLevel(gameState.level);
        };
    } else {
        // ARCADE GAME OVER
        gtag('event', 'sv_level_fail', { level: gameState.level, mode: 'arcade' });
        gtag('event', 'sv_arcade_score', { score: gameState.score, level: gameState.level });
        gameMessageText.innerHTML = `Game Over! <br> Score: ${gameState.score} 💔`;
        restartBtn.innerText = "New Arcade Run";
        restartBtn.onclick = () => {
            startArcadeMode();
        };
    }
    restartBtn.classList.remove('hidden');
    gameMessage.classList.remove('hidden');
}

// --- PARTICLES ---
function triggerWinParticles() {
    for (let i = 0; i < 40; i++) {
        const p = new Particle();
        p.x = width / 2 + (Math.random() - 0.5) * 60;
        p.y = height / 2 + (Math.random() - 0.5) * 60;
        p.size = Math.random() * 16 + 8;
        p.speedY = Math.random() * 3 + 1.5;
        p.speedX = (Math.random() - 0.5) * 2;
        p.opacity = Math.random() * 0.4 + 0.6;
        particles.push(p);
    }
}

// --- CANVAS LOGIC ---
const CONFIG = {
    particleCount: 40,
    heartColor: '#ffb7c5',
    heartColor2: '#ff6b6b',
    interactionRadius: 55,
    mouseForce: 0.1,
};

const mouse = { x: -1000, y: -1000 };

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    if (active) initParticles();
}

window.addEventListener('resize', resize);

function updateMouse(e) {
    if (!active) return;
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const y = e.clientY || (e.touches && e.touches[0].clientY);
    if (x !== undefined && y !== undefined) {
        mouse.x = x;
        mouse.y = y;
    }
}

function resetMouse() {
    mouse.x = -1000;
    mouse.y = -1000;
}

window.addEventListener('mousemove', updateMouse);
window.addEventListener('mouseleave', resetMouse);
window.addEventListener('touchstart', updateMouse, { passive: false });
window.addEventListener('touchend', resetMouse);

class Particle {
    constructor() {
        this.init(true);
        this.mouseInteraction = true;
    }

    init(randomY = false) {
        this.x = Math.random() * width;
        this.y = randomY ? Math.random() * height : height + 20;
        this.size = Math.random() * 10 + 5;
        this.baseSize = this.size;
        const colors = ['#ff9a9e', '#fad0c4', '#ffecd2', '#fcb69f', '#ffb7c5'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.speedY = Math.random() * 1.5 + 0.5;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.wobble = Math.random() * Math.PI * 2;
        this.wobbleSpeed = Math.random() * 0.05 + 0.02;
        this.vx = 0;
        this.vy = 0;
        this.opacity = Math.random() * 0.5 + 0.3;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        const s = this.size / 10;
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-5, -5, -10, 0, 0, 10);
        ctx.bezierCurveTo(10, 0, 5, -5, 0, 0);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.wobble += this.wobbleSpeed;
        this.y -= this.speedY;
        this.x += Math.sin(this.wobble) * 0.5 + this.speedX;
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (this.mouseInteraction && dist < CONFIG.interactionRadius) {
            const force = (CONFIG.interactionRadius - dist) / CONFIG.interactionRadius;
            const angle = Math.atan2(dy, dx);
            const fx = Math.cos(angle) * force * 15;
            const fy = Math.sin(angle) * force * 15;
            this.vx += fx;
            this.vy += fy;
        }
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.9;
        this.vy *= 0.9;
        if (this.y < -50 || this.x < -50 || this.x > width + 50) this.init(false);
    }
}

function initParticles() {
    particles = [];
    let count = CONFIG.particleCount;
    if (width < 600) count = count * 0.6;
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }
}

function animate() {
    if (!active) return;
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    requestAnimationFrame(animate);
}
