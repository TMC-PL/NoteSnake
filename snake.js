// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Game constants
const visibleRange = 1000;
const detectionRadius = 150;
const numGalaxies = 100;
const maxStars = 100;
const minStars = 30;

// Snake properties
const snakeSegments = [];
let targetSnakeLength = 30;
const snakeSpeed = 2;

// Game state variables
let time = 0;
let direction = 0;
let targetDirection = 0;
let hue = 0;
let cameraOffsetX = 0;
let cameraOffsetY = 0;
let stripeHue = Math.random() * 360;

// Arrays to store game objects
const galaxies = [];
let stars = [];

// Audio context
let audioContext;
let soundfontPlayer;
let audioInitialized = false;
const audioSupported = !!(window.AudioContext || window.webkitAudioContext);

// Initialize audio
async function initAudio() {
    if (audioInitialized) return;

    if (!audioSupported) {
        console.warn("Web Audio API is not supported in this browser. Sound will be disabled.");
        return;
    }

    try {
        console.log("Initializing audio...");
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();
        
        if (typeof Soundfont === 'undefined') {
            throw new Error("Soundfont library not loaded.");
        }

        soundfontPlayer = await Soundfont.instrument(audioContext, 'acoustic_grand_piano');
        audioInitialized = true;
        console.log("Audio initialized successfully");
    } catch (error) {
        console.error("Failed to initialize audio:", error);
        audioInitialized = false;
        throw error;
    }
}

// Classes
class SnakeSegment {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class Galaxy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 3 + 1;
        this.brightness = Math.random() * 0.5 + 0.5;
    }

    draw() {
        const drawX = this.x - cameraOffsetX + canvas.width / 2;
        const drawY = this.y - cameraOffsetY + canvas.height / 2;
        ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${this.brightness})`;
        ctx.beginPath();
        ctx.arc(drawX, drawY, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Star {
    constructor(x, y) {
        this.worldX = x;
        this.worldY = y;
        this.screenX = this.worldX - cameraOffsetX + canvas.width / 2;
        this.screenY = this.worldY - cameraOffsetY + canvas.height / 2;
        this.value = Math.floor(Math.random() * 41) + 10;
        this.size = this.value / 2;
        this.haloSize = this.size * 2;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.isConsumed = false;
        this.isFlashing = false;
        this.flashIntensity = 0;
        this.isNewborn = true;
        this.birthProgress = 0;
        this.birthDuration = 60;
    }

    draw() {
        const drawX = this.screenX;
        const drawY = this.screenY;

        if (this.isNewborn) {
            const birthPhase = this.birthProgress / this.birthDuration;
            const fadeIn = Math.min(birthPhase * 2, 1);
            const blinkIntensity = Math.sin(birthPhase * Math.PI * 2) * 0.5 + 0.5;

            ctx.fillStyle = `rgba(255, 255, 255, ${fadeIn * blinkIntensity})`;
            ctx.beginPath();
            ctx.arc(drawX, drawY, this.size * (1 + blinkIntensity), 0, Math.PI * 2);
            ctx.fill();

            this.drawNormalStar(drawX, drawY, fadeIn);
        } else if (this.isConsumed) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.flashIntensity})`;
            ctx.beginPath();
            ctx.arc(drawX, drawY, this.haloSize * 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            if (this.isFlashing) {
                ctx.fillStyle = `rgba(255, 255, 255, ${this.flashIntensity})`;
                ctx.beginPath();
                ctx.arc(this.screenX, this.screenY, this.size * 2, 0, Math.PI * 2);
                ctx.fill();
            }
            this.drawNormalStar(drawX, drawY, 1);
        }
    }

    drawNormalStar(drawX, drawY, opacity) {
        const haloGradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, this.haloSize);
        haloGradient.addColorStop(0, `rgba(255, 100, 100, ${0.3 * opacity})`);
        haloGradient.addColorStop(1, 'rgba(255, 100, 100, 0)');

        ctx.fillStyle = haloGradient;
        ctx.beginPath();
        ctx.arc(drawX, drawY, this.haloSize, 0, Math.PI * 2);
        ctx.fill();

        const coreGradient = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, this.size);
        coreGradient.addColorStop(0, `rgba(255, 50, 50, ${opacity})`);
        coreGradient.addColorStop(1, `rgba(255, 100, 100, ${0.5 * opacity})`);

        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(drawX, drawY, this.size, 0, Math.PI * 2);
        ctx.fill();
    }

    update() {
        this.worldX += this.vx;
        this.worldY += this.vy;
        
        if (this.isNewborn) {
            this.birthProgress++;
            if (this.birthProgress >= this.birthDuration) {
                this.isNewborn = false;
            }
        }

        if (this.isFlashing) {
            this.flashIntensity -= 0.05;
            if (this.flashIntensity <= 0) {
                this.isFlashing = false;
                this.flashIntensity = 0;
            }
        }
        
        if (this.isConsumed) {
            this.flashIntensity -= 0.02;
            return this.flashIntensity <= 0;
        }
        return false;
    }
}

// Initialize game objects
function initializeGame() {
    for (let i = 0; i < targetSnakeLength; i++) {
        snakeSegments.push(new SnakeSegment(canvas.width / 2, canvas.height / 2));
    }

    cameraOffsetX = 0;
    cameraOffsetY = 0;

    for (let i = 0; i < numGalaxies; i++) {
        galaxies.push(new Galaxy(Math.random() * visibleRange * 2 - visibleRange, Math.random() * visibleRange * 2 - visibleRange));
    }
}

// Drawing functions
function drawBackground() {
    const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
    gradient.addColorStop(0, `hsl(${hue}, 50%, 20%)`);
    gradient.addColorStop(1, `hsl(${hue}, 50%, 5%)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    galaxies.forEach(galaxy => galaxy.draw());
    stars.forEach(star => star.draw());

    while (stars.length < minStars) {
        addNewStarAhead();
    }
}

function drawSnake() {
    if (snakeSegments.length > 0) {
        const startX = canvas.width / 2;
        const startY = canvas.height / 2;

        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = snakeSegments.length - 1; i >= 0; i--) {
            const drawX = startX + (snakeSegments[i].x - snakeSegments[0].x);
            const drawY = startY + (snakeSegments[i].y - snakeSegments[0].y);

            const segmentHue = (hue + i * 2) % 360;
            const intensity = (Math.sin(time * 0.1 + i * 0.1) + 1) / 2;

            ctx.strokeStyle = `hsl(${segmentHue}, 100%, ${50 + intensity * 50}%)`;
            ctx.shadowColor = `hsl(${segmentHue}, 100%, 70%)`;
            ctx.shadowBlur = 15;

            ctx.beginPath();
            if (i === snakeSegments.length - 1) {
                ctx.moveTo(drawX, drawY);
            } else {
                ctx.moveTo(startX + (snakeSegments[i + 1].x - snakeSegments[0].x), startY + (snakeSegments[i + 1].y - snakeSegments[0].y));
            }
            ctx.lineTo(drawX, drawY);
            ctx.stroke();
        }

        ctx.fillStyle = 'white';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(startX, startY, 8, 0, Math.PI * 2);
        ctx.fill();

        const eyeOffset = 3;
        const eyeSize = 2;
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.arc(startX + Math.cos(direction) * eyeOffset - Math.sin(direction) * eyeOffset, startY + Math.sin(direction) * eyeOffset + Math.cos(direction) * eyeOffset, eyeSize, 0, Math.PI * 2);
        ctx.arc(startX + Math.cos(direction) * eyeOffset + Math.sin(direction) * eyeOffset, startY + Math.sin(direction) * eyeOffset - Math.cos(direction) * eyeOffset, eyeSize, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Update functions
function updateSnake() {
    if (Math.random() < 0.025) {
        targetDirection += (Math.random() - 0.5) * Math.PI * 0.4;
    }

    const turnSpeed = 0.02;
    direction += Math.sin(targetDirection - direction) * turnSpeed;

    const newX = snakeSegments[0].x + Math.cos(direction) * snakeSpeed;
    const newY = snakeSegments[0].y + Math.sin(direction) * snakeSpeed;

    snakeSegments.unshift(new SnakeSegment(newX, newY));

    if (snakeSegments.length > targetSnakeLength) {
        snakeSegments.pop();
    }

    cameraOffsetX = snakeSegments[0].x - canvas.width / 2;
    cameraOffsetY = snakeSegments[0].y - canvas.height / 2;

    updateStars();

    while (stars.length < minStars) {
        addNewStarAhead();
    }
}

function updateStars() {
    for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];
        star.update();

        star.screenX = star.worldX - cameraOffsetX + canvas.width / 2;
        star.screenY = star.worldY - cameraOffsetY + canvas.height / 2;

        const isOnScreen = star.screenX >= -100 && star.screenX <= canvas.width + 100 &&
                           star.screenY >= -100 && star.screenY <= canvas.height + 100;

        if (!star.isConsumed && isOnScreen) {
            const dx = star.screenX - canvas.width / 2;
            const dy = star.screenY - canvas.height / 2;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const collisionRadius = star.size + 25;

            if (distance < collisionRadius) {
                star.isConsumed = true;
                star.flashIntensity = 1;
                targetSnakeLength += star.value;
                console.log("Star consumed at:", star.screenX, star.screenY);
                console.log("Snake head at:", canvas.width / 2, canvas.height / 2);
            }

            if (distance < detectionRadius && !star.isFlashing) {
                star.isFlashing = true;
                star.flashIntensity = 1;

                const minFrequency = 261.63;
                const maxFrequency = 1046.50;
                const frequency = minFrequency + (star.value / 50) * (maxFrequency - minFrequency);
                playSound(frequency);
            }
        }

        if ((!isOnScreen && !star.isConsumed) || (star.isConsumed && star.flashIntensity <= 0)) {
            stars.splice(i, 1);
        }
    }
}

// Utility functions
function addNewGalaxy() {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * visibleRange + canvas.width;
    const x = Math.cos(angle) * distance + cameraOffsetX;
    const y = Math.sin(angle) * distance + cameraOffsetY;
    galaxies.push(new Galaxy(x, y));
}

function addNewStarAhead() {
    const angle = Math.random() * Math.PI * 2;
    const minDistance = Math.max(canvas.width, canvas.height) / 2;
    const maxDistance = visibleRange / 2;
    const distance = Math.random() * (maxDistance - minDistance) + minDistance;
    const worldX = Math.cos(angle) * distance + cameraOffsetX;
    const worldY = Math.sin(angle) * distance + cameraOffsetY;
    const newStar = new Star(worldX, worldY);
    newStar.screenX = worldX - cameraOffsetX + canvas.width / 2;
    newStar.screenY = worldY - cameraOffsetY + canvas.height / 2;
    stars.push(newStar);
}

function playSound(frequency) {
    if (!audioInitialized || !soundfontPlayer) {
        console.warn("Audio not ready. Skipping sound playback.");
        return;
    }
    
    if (audioContext.state !== 'running') {
        audioContext.resume().then(() => {
            playSoundInternal(frequency);
        }).catch(error => {
            console.error("Failed to resume audio context:", error);
        });
        return;
    }
    
    playSoundInternal(frequency);
}

function playSoundInternal(frequency) {
    try {
        const midiNote = Math.round(12 * Math.log2(frequency / 440) + 69);
        soundfontPlayer.play(midiNote, audioContext.currentTime, {duration: 0.3});
        console.log("Sound played successfully");
    } catch (error) {
        console.error("Error playing sound:", error);
    }
}

function drawDebugInfo() {
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    const headSegment = snakeSegments[0];
    ctx.fillText(`Snake Head: (${Math.round(headSegment.x)}, ${Math.round(headSegment.y)})`, 10, 20);
    ctx.fillText(`Camera Offset: (${Math.round(cameraOffsetX)}, ${Math.round(cameraOffsetY)})`, 10, 40);
    ctx.fillText(`Stars: ${stars.length}`, 10, 60);
}

// Main game loop
function gameLoop() {
    time++;
    hue = (hue + 0.1) % 360;
    stripeHue = (stripeHue + 0.5) % 360;

    drawBackground();
    updateSnake();
    drawSnake();
    drawDebugInfo();

    requestAnimationFrame(gameLoop);
}

// Initialize the game and start the game loop
let audioInitializationInProgress = false;

async function startGame() {
    initializeGame();
    
    if (!audioInitialized && !audioInitializationInProgress) {
        audioInitializationInProgress = true;
        try {
            await initAudio();
        } catch (error) {
            console.error("Failed to initialize audio:", error);
        } finally {
            audioInitializationInProgress = false;
        }
    }
    
    gameLoop();
}

// Add this new code:
document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.createElement('button');
    startButton.id = 'startButton';
    startButton.textContent = 'Start Game';
    startButton.style.position = 'absolute';
    startButton.style.top = '50%';
    startButton.style.left = '50%';
    startButton.style.transform = 'translate(-50%, -50%)';
    startButton.style.fontSize = '24px';
    startButton.style.padding = '10px 20px';
    document.body.appendChild(startButton);

    startButton.addEventListener('click', function() {
        this.style.display = 'none';
        startGame();
    });
});
