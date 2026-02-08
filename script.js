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
        onMatch: (gameStateId) => {
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
        description: 'Congela il tempo per 5s!'
    },
    'M': {
        name: 'Swipe Block',
        type: 'malus',
        effectType: 'passive',
        duration: 4000,
        visualClass: 'effect-malus',
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

// --- GAME STATE ---
const gameState = {
    mode: 'story', // 'story' or 'arcade'
    level: 1, // Current level ID (Story 1-3, Arcade 1-Infinity)
    score: 0, // Arcade Score
    cards: [],
    flippedCards: [],
    matchedPairs: 0,
    isLocked: false,
    timer: null,
    timeLeft: 0,
    activeEffects: new Set(),
    // Story Mode Levels
    storyLevels: [
        { id: 1, pairs: 2, time: 30, specials: [] },
        { id: 2, pairs: 4, time: 45, specials: [] },
        { id: 3, pairs: 6, time: 55, specials: ['X', 'T', 'K'] }
    ],
    assets: ['C', 'F', 'H', 'I', 'K', 'L', 'Y', 'N', 'Q', 'R', 'T', 'U', 'X'] // Extended for larger grids
};

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

// --- ACT TRANSITIONS ---

document.getElementById('start-btn').addEventListener('click', () => {
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
    gameState.mode = 'arcade';
    gameState.score = 0;
    gameState.level = 1; // Arcade Level 1
    startGameLevel(1);
}

function getArcadeConfig(level) {
    // Updated Progression Logic per user request
    // Levels 1-2: 6 pairs
    // Levels 3-5: 7 pairs (14 cards)
    // Levels 6-9: 8 pairs (16 cards)
    // Level 10+: 9 pairs (18 cards)

    let pairs = 6;
    if (level >= 3 && level <= 5) pairs = 8;
    else if (level >= 6 && level <= 9) pairs = 10;
    else if (level >= 10) pairs = 10;

    // Time Calculation
    let time = pairs * 5; // slightly easier

    return {
        id: level,
        pairs: pairs,
        time: time,
        specials: ['X', 'T', 'M', 'K']
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
    gameState.activeEffects.clear();

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

function generateCards(pairsCount, allowedSpecials = [], fixedAssets = null) {
    let deck = [];

    // If fixedAssets is provided, use it directly (Story Mode)
    if (fixedAssets && fixedAssets.length > 0) {
        fixedAssets.forEach(asset => {
            deck.push({ value: asset, id: Math.random() });
            deck.push({ value: asset, id: Math.random() });
        });
        return deck.sort(() => 0.5 - Math.random());
    }

    // Logic for Arcade / Random Mode:
    let usedSpecials = [];
    if (allowedSpecials && allowedSpecials.length > 0) {
        if (pairsCount > 2) {
            // 1 random special
            const randomSpecial = allowedSpecials[Math.floor(Math.random() * allowedSpecials.length)];
            usedSpecials.push(randomSpecial);
        }
    }

    // Fill rest with Regulars
    const neededRegulars = pairsCount - usedSpecials.length;
    // Ensure we have enough assets
    const pool = gameState.assets.filter(a => !usedSpecials.includes(a));
    const shuffledRegulars = pool.sort(() => 0.5 - Math.random());

    // If we run out of unique assets, we might need to reuse logic
    // Assuming assets pool is large enough (13 assets > needed max 10 pairs)
    const selectedRegulars = shuffledRegulars.slice(0, neededRegulars);

    const finalAssets = [...usedSpecials, ...selectedRegulars];

    finalAssets.forEach(asset => {
        deck.push({ value: asset, id: Math.random() });
        deck.push({ value: asset, id: Math.random() });
    });

    return deck.sort(() => 0.5 - Math.random());
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

        if (gameState.flippedCards.length === 0) {
            // if (card.classList.contains('flipped')) {
            //     selectCard(card);
            //     if (card.peekTimeout) clearTimeout(card.peekTimeout);
            // } else {
            //     peek();
            // }
            selectCard(card);
            if (card.peekTimeout) clearTimeout(card.peekTimeout);
        }
        else if (gameState.flippedCards.length === 1) {
            selectCard(card);
            if (card.peekTimeout) clearTimeout(card.peekTimeout);
        }
    });

    return card;
}

document.addEventListener('touchmove', function (e) {
    const act3 = document.getElementById('act-iii');
    if (act3.classList.contains('hidden')) return;
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
        gameState.matchedPairs++;
        gameState.flippedCards = [];
        gameState.isLocked = false;

        // ARCADE SCORING
        if (gameState.mode === 'arcade') {
            gameState.score += 200;
            scoreVal.textContent = gameState.score;
        }

        if (SPECIAL_CARDS[card1.dataset.value]) {
            const config = SPECIAL_CARDS[card1.dataset.value];
            if (config.onMatch) {
                config.onMatch(gameState);
            }
        }

        // Check Win
        let requiredPairs;
        if (gameState.mode === 'story') {
            requiredPairs = getStoryConfig(gameState.level).pairs;
        } else {
            requiredPairs = getArcadeConfig(gameState.level).pairs;
        }

        if (gameState.matchedPairs === requiredPairs) {
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
            gameState.timeLeft--;
        }

        updateTimerUI(gameState.timeLeft, seconds);

        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timer);
            handleLevelLoss();
        }
    }, 1000);
}

function updateTimerUI(current, total) {
    const pct = (current / total) * 100;
    timerProgress.style.width = `${pct}%`;
    if (pct < 30) timerProgress.style.background = '#ff6b6b';
    else timerProgress.style.background = 'linear-gradient(90deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)';
}

function handleLevelWin() {
    clearInterval(gameState.timer);
    triggerWinParticles();

    setTimeout(() => {
        if (gameState.mode === 'story') {
            // STORY MODE WIN LOGIC
            if (gameState.level === 5) {
                gameMessageText.textContent = "You Won My Heart! ❤️";
                gameMessage.classList.remove('hidden');

                // Add Arcade Button here too
                arcadeBtn.onclick = () => {
                    startArcadeMode();
                }
                arcadeBtn.classList.remove('hidden');

            } else {
                gameMessageText.textContent = "Level Complete! ❤️";
                nextBtn.classList.remove('hidden');
                gameMessage.classList.remove('hidden');

                nextBtn.onclick = () => {
                    startGameLevel(gameState.level + 1);
                };
            }
        } else {
            // ARCADE MODE WIN LOGIC
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
    if (gameState.mode === 'story') {
        gameMessageText.textContent = "Time's up! 💔";
        restartBtn.innerText = "Try Again";
        restartBtn.onclick = () => {
            startGameLevel(gameState.level);
        };
    } else {
        // ARCADE GAME OVER
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
let winParticles = [];
class WinParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 8 + 4;
        this.color = `hsl(${Math.random() * 360}, 70%, 70%)`;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10 - 5;
        this.gravity = 0.2;
        this.life = 100;
        this.decay = Math.random() * 2 + 1;
    }
    update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / 100;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function triggerWinParticles() {
    for (let i = 0; i < 100; i++) {
        winParticles.push(new WinParticle(width / 2, height / 2));
    }
}

// --- CANVAS LOGIC ---
const CONFIG = {
    particleCount: 60,
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

        if (dist < CONFIG.interactionRadius) {
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
    winParticles.forEach((p, index) => {
        p.update();
        p.draw();
        if (p.life <= 0) winParticles.splice(index, 1);
    });
    requestAnimationFrame(animate);
}
