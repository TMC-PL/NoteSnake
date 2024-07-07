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
const audioSupported = !!(window.AudioContext || window.webkitAudioContext);

if (!audioSupported) {
    console.warn("Web Audio API is not supported in this browser. Sound will be disabled.");
}

// Initialize audio
function initAudio() {
    console.log("Initializing audio...");
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("AudioContext created successfully. State:", audioContext.state);
    } catch (error) {
        console.error("Failed to create AudioContext:", error);
        return;
    }

    if (audioContext.state === 'suspended') {
        console.log("AudioContext is suspended. Waiting for user interaction.");
        const resumeAudio = function() {
            audioContext.resume().then(() => {
                console.log("AudioContext resumed successfully");
            }).catch(error => {
                console.error("Failed to resume AudioContext:", error);
            });
            document.body.removeEventListener('click', resumeAudio);
            document.body.removeEventListener('touchstart', resumeAudio);
        };
        
        document.body.addEventListener('click', resumeAudio);
        document.body.addEventListener('touchstart', resumeAudio);
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
        this.value = Math.floor(Math.random() * 41) + 10; // 10 to 50
        this.size = this.value / 2;
        this.haloSize = this.size * 2;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.isConsumed = false;
        this.isFlashing = false;
        this.flashIntensity = 0;
		this.isNewborn = true;
        this.birthProgress = 0;
        this.birthDuration = 60; // Number of frames for birth animation
    }

    draw() {
        const drawX = this.screenX;
        const drawY = this.screenY;

        if (this.isNewborn) {
            const birthPhase = this.birthProgress / this.birthDuration;
            const fadeIn = Math.min(birthPhase * 2, 1); // Fade in during first half
            const blinkIntensity = Math.sin(birthPhase * Math.PI * 2) * 0.5 + 0.5; // Blink effect

            ctx.fillStyle = `rgba(255, 255, 255, ${fadeIn * blinkIntensity})`;
            ctx.beginPath();
            ctx.arc(drawX, drawY, this.size * (1 + blinkIntensity), 0, Math.PI * 2);
            ctx.fill();

            // Draw the normal star with increasing opacity
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
        // Draw halo
        const haloGradient = ctx.createRadialGradient(
            drawX, drawY, 0,
            drawX, drawY, this.haloSize
        );
        haloGradient.addColorStop(0, `rgba(255, 100, 100, ${0.3 * opacity})`);
        haloGradient.addColorStop(1, 'rgba(255, 100, 100, 0)');

        ctx.fillStyle = haloGradient;
        ctx.beginPath();
        ctx.arc(drawX, drawY, this.haloSize, 0, Math.PI * 2);
        ctx.fill();

        // Draw star core
        const coreGradient = ctx.createRadialGradient(
            drawX, drawY, 0,
            drawX, drawY, this.size
        );
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
    // Initialize snake at the center of the screen
    for (let i = 0; i < targetSnakeLength; i++) {
        snakeSegments.push(new SnakeSegment(canvas.width / 2, canvas.height / 2));
    }

    // Reset initial camera offset
    cameraOffsetX = 0;
    cameraOffsetY = 0;

    // Create initial galaxies
    for (let i = 0; i < numGalaxies; i++) {
        galaxies.push(new Galaxy(Math.random() * visibleRange * 2 - visibleRange, Math.random() * visibleRange * 2 - visibleRange));
    }
}

// Drawing functions
function drawBackground() {
    // Create gradient
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, `hsl(${hue}, 50%, 20%)`);
    gradient.addColorStop(1, `hsl(${hue}, 50%, 5%)`);

    // Fill background
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw galaxies
    galaxies.forEach(galaxy => galaxy.draw());

    // Draw stars
    stars.forEach(star => star.draw());

    // Check if new stars need to be added
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
                ctx.moveTo(
                    startX + (snakeSegments[i+1].x - snakeSegments[0].x),
                    startY + (snakeSegments[i+1].y - snakeSegments[0].y)
                );
            }
            ctx.lineTo(drawX, drawY);
            ctx.stroke();
        }

        // Draw head
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(startX, startY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Draw eyes
        const eyeOffset = 3;
        const eyeSize = 2;
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.arc(startX + Math.cos(direction) * eyeOffset - Math.sin(direction) * eyeOffset, 
                startY + Math.sin(direction) * eyeOffset + Math.cos(direction) * eyeOffset, 
                eyeSize, 0, Math.PI * 2);
        ctx.arc(startX + Math.cos(direction) * eyeOffset + Math.sin(direction) * eyeOffset, 
                startY + Math.sin(direction) * eyeOffset - Math.cos(direction) * eyeOffset, 
                eyeSize, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Update functions
function updateSnake() {
    // Randomly change target direction
    if (Math.random() < 0.025) {
        targetDirection += (Math.random() - 0.5) * Math.PI * 0.4; // Reduced for smoother turns
    }

    // Smoothly interpolate current direction towards target direction
    const turnSpeed = 0.02;
    direction += Math.sin(targetDirection - direction) * turnSpeed;

    // Calculate new head position
    const newX = snakeSegments[0].x + Math.cos(direction) * snakeSpeed;
    const newY = snakeSegments[0].y + Math.sin(direction) * snakeSpeed;

    // Add new head to the beginning of the snake array
    snakeSegments.unshift(new SnakeSegment(newX, newY));

    // Adjust snake length dynamically
    if (snakeSegments.length > targetSnakeLength) {
        snakeSegments.pop(); // Remove the tail segment if the snake is longer than target
    }

    // Update camera offset to keep the snake centered
    cameraOffsetX = snakeSegments[0].x - canvas.width / 2;
    cameraOffsetY = snakeSegments[0].y - canvas.height / 2;

    // Manage stars
    updateStars();

    // Add new stars if needed
    while (stars.length < minStars) {
        addNewStarAhead();
    }
}

function updateStars() {
    for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];
        star.update(); // Update star position

        // Update screen coordinates
        star.screenX = star.worldX - cameraOffsetX + canvas.width / 2;
        star.screenY = star.worldY - cameraOffsetY + canvas.height / 2;

        const isOnScreen = star.screenX >= -100 && star.screenX <= canvas.width + 100 &&
                           star.screenY >= -100 && star.screenY <= canvas.height + 100;

        // Collision detection
        if (!star.isConsumed && isOnScreen) {
            const dx = star.screenX - canvas.width / 2;
            const dy = star.screenY - canvas.height / 2;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const collisionRadius = star.size + 25; // Increased radius for collision

            if (distance < collisionRadius) {
                star.isConsumed = true;
                star.flashIntensity = 1;
                targetSnakeLength += star.value; // Increase snake length
                console.log("Star consumed at:", star.screenX, star.screenY);
                console.log("Snake head at:", canvas.width / 2, canvas.height / 2);
            }

            // Star flashing and sound
            if (distance < detectionRadius && !star.isFlashing) {
                star.isFlashing = true;
                star.flashIntensity = 1;
                
                // Play sound based on star's value
                const minFrequency = 261.63; // C4
                const maxFrequency = 1046.50; // C6
                const frequency = minFrequency + (star.value / 50) * (maxFrequency - minFrequency);
                playSound(frequency);
            }
        }

        // Remove off-screen and fully consumed stars
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
    if (!audioSupported) {
        console.warn("Attempted to play sound, but audio is not supported.");
        return;
    }
    if (!audioContext) {
        console.error("AudioContext not initialized. Attempting to initialize now.");
        initAudio();
        if (!audioContext) {
            console.error("Failed to initialize AudioContext. Cannot play sound.");
            return;
        }
    }
    if (audioContext.state !== 'running') {
        console.warn("AudioContext not running. Current state:", audioContext.state);
        return;
    }
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
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
    initAudio();
    time++;
    hue = (hue + 0.1) % 360;
    stripeHue = (stripeHue + 0.5) % 360;

    drawBackground();
    updateSnake();
    drawSnake();
    drawDebugInfo();

    requestAnimationFrame(gameLoop);
}

const audioBuffers = {};

function loadSample(url) {
    return fetch(url)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
            const note = url.split('/').pop().split('.')[0];
            audioBuffers[note] = audioBuffer;
        });
}

// Initialize the game and start the game loop
function startGame() {
    initializeGame();
	initAudio();
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
/*	const testSoundButton = document.createElement('button');
    testSoundButton.textContent = 'Test Sound';
    testSoundButton.style.position = 'absolute';
    testSoundButton.style.top = '60%';
    testSoundButton.style.left = '50%';
    testSoundButton.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(testSoundButton);

    testSoundButton.addEventListener('click', function() {
        console.log("Test sound button clicked");
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log("AudioContext resumed from test button");
                playSound(440); // Play a test tone (A4)
            });
        } else {
            playSound(440);
        }
    });
*/
});