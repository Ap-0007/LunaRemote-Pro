const socket = io();
const trackpad = document.getElementById('trackpad');
const status = document.getElementById('connection-status');
const kbInput = document.getElementById('kb-input');

// Trackpad & Input State
let lastX = 0, lastY = 0;
let isMoving = false, isScrolling = false;
let lastScrollY = 0;
const SCROLL_SENSITIVITY = 1.0;

// Pro Features State
let isDragActive = false;
let lastTapTime = 0;
let tapTimeout = null;
let longPressTimer = null;

// Connection
socket.on('connect', () => {
    status.innerText = 'Connected';
    status.classList.add('connected');
});

socket.on('disconnect', () => {
    status.innerText = 'Disconnected';
    status.classList.remove('connected');
});

// Tab Navigation
document.querySelectorAll('.tab-link').forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(target).classList.add('active');
        if (window.navigator.vibrate) window.navigator.vibrate(10);
    });
});

// Pro Controls
const dragBtn = document.getElementById('pro-drag');
dragBtn?.addEventListener('click', () => {
    isDragActive = !isDragActive;
    dragBtn.classList.toggle('active', isDragActive);
    socket.emit(isDragActive ? 'mouse_press' : 'mouse_release', { button: 'left' });
    if (window.navigator.vibrate) window.navigator.vibrate(50);
});

document.getElementById('pro-rclick')?.addEventListener('click', () => {
    socket.emit('mouse_click', { button: 'right' });
    if (window.navigator.vibrate) window.navigator.vibrate(30);
});

// Trackpad Interaction Logic
trackpad.addEventListener('touchstart', (e) => {
    const now = Date.now();
    
    // Double Tap detection
    if (e.touches.length === 1) {
        if (now - lastTapTime < 300) {
            socket.emit('mouse_click', { button: 'left', count: 2 });
            lastTapTime = 0; // reset
        } else {
            lastTapTime = now;
        }
        
        // Long Press detection for Right Click
        longPressTimer = setTimeout(() => {
            socket.emit('mouse_click', { button: 'right' });
            if (window.navigator.vibrate) window.navigator.vibrate(40);
        }, 600);
    }

    if (e.touches.length === 1) {
        const touch = e.touches[0];
        lastX = touch.clientX;
        lastY = touch.clientY;
        isMoving = true;
        isScrolling = false;
    } else if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        lastScrollY = (touch1.clientY + touch2.clientY) / 2;
        isScrolling = true;
        isMoving = false;
        clearTimeout(longPressTimer);
    }
});

trackpad.addEventListener('touchmove', (e) => {
    clearTimeout(longPressTimer); // Finger moved, cancel long press
    
    if (e.touches.length === 1 && isMoving) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastX;
        const dy = touch.clientY - lastY;
        socket.emit('mouse_move', { dx, dy });
        lastX = touch.clientX;
        lastY = touch.clientY;
    } else if (e.touches.length === 2 && isScrolling) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentY = (touch1.clientY + touch2.clientY) / 2;
        const dy = (lastScrollY - currentY) * SCROLL_SENSITIVITY;
        if (Math.abs(dy) > 1) {
            socket.emit('mouse_scroll', { dy: Math.round(dy) });
            lastScrollY = currentY;
        }
    }
    e.preventDefault();
}, { passive: false });

trackpad.addEventListener('touchend', () => {
    isMoving = false;
    isScrolling = false;
    clearTimeout(longPressTimer);
});

trackpad.addEventListener('click', () => {
    socket.emit('mouse_click', { button: 'left' });
});

// AI Hub logic
const bindAi = (id, cmd) => {
    document.getElementById(id)?.addEventListener('click', () => {
        socket.emit('ai_command', { command: cmd });
        if (window.navigator.vibrate) window.navigator.vibrate([20, 40, 20]);
    });
};

bindAi('ai-siri', 'siri');
bindAi('ai-chatgpt', 'chatgpt');
bindAi('ai-gemini', 'gemini');
bindAi('ai-claude', 'claude');
bindAi('ai-ask', 'ask_ai');

// Application Launchpad
document.querySelectorAll('.app-card').forEach(card => {
    card.addEventListener('click', () => {
        socket.emit('launch_app', { app: card.dataset.app });
        if (window.navigator.vibrate) window.navigator.vibrate(30);
    });
});

// Config & Shortcuts
const bindEvent = (id, eventName, data) => {
    document.getElementById(id)?.addEventListener('click', () => {
        socket.emit(eventName, data);
        if (window.navigator.vibrate) window.navigator.vibrate(20);
    });
};

bindEvent('vol-up', 'volume', { action: 'up' });
bindEvent('vol-down', 'volume', { action: 'down' });
bindEvent('vol-mute', 'volume', { action: 'mute' });
bindEvent('media-play', 'media', { action: 'playpause' });
bindEvent('media-prev', 'media', { action: 'prev' });
bindEvent('media-next', 'media', { action: 'next' });
bindEvent('bright-up', 'brightness', { action: 'up' });
bindEvent('bright-down', 'brightness', { action: 'down' });
bindEvent('sys-lock', 'system', { action: 'lock' });
bindEvent('sys-sleep', 'system', { action: 'sleep' });
bindEvent('key-spotlight', 'key_combo', { combo: 'spotlight' });
bindEvent('key-tab', 'key_combo', { combo: 'tab' });

// Advanced Keyboard
kbInput.addEventListener('input', (e) => {
    if (e.data) socket.emit('keyboard', { text: e.data });
});
kbInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { socket.emit('keyboard', { text: 'ENTER' }); kbInput.value = ''; kbInput.blur(); }
});
document.getElementById('kb-backspace')?.addEventListener('click', () => socket.emit('keyboard', { text: 'BACKSPACE' }));
