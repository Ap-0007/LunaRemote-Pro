// Dynamic Socket Initialization v5.1.1
let currentTarget = window.location.origin;

// If served from GitHub Pages, we need to prompt for the Mac IP or Tunnel URL
if (currentTarget.includes('github.io') || currentTarget.includes('vercel.app')) {
    const savedTarget = localStorage.getItem('luna_target');
    currentTarget = prompt("Enter LunaRemote URL (e.g. http://192.168.2.108:5001 or Tunnel URL)", savedTarget || "");
    if (currentTarget) localStorage.setItem('luna_target', currentTarget);
}

const socket = io(currentTarget);

// ── Auth Logic ──
let pinInput = "";
const authOverlay = document.getElementById('auth-overlay');
const dots = document.querySelectorAll('#pin-dots .dot');

function updateDots() {
    dots.forEach((dot, i) => dot.classList.toggle('filled', i < pinInput.length));
}

function keyPress(key) {
    if (key === 'DEL') {
        pinInput = pinInput.slice(0, -1);
    } else if (pinInput.length < 6) {
        pinInput += key;
    }
    updateDots();
    triggerHaptic('light');

    if (pinInput.length === 6) {
        socket.emit('auth', { pin: pinInput });
    }
}

socket.on('connect', () => {
    console.log("Connected to Luna Server");
    const savedPin = localStorage.getItem('luna_pin');
    if (savedPin) socket.emit('auth', { pin: savedPin });
    else authOverlay.classList.remove('hidden');
});

socket.on('auth_success', () => {
    localStorage.setItem('luna_pin', pinInput || localStorage.getItem('luna_pin'));
    authOverlay.classList.add('hidden');
    triggerHaptic('medium');
    
    const stateEl = document.getElementById('auth-state');
    if (stateEl) {
        stateEl.innerText = "🔓";
        stateEl.classList.add('secure');
    }
    const statusEl = document.getElementById('connection-status');
    if (statusEl) statusEl.innerText = "Secure Connection";
});

socket.on('auth_fail', () => {
    const content = document.querySelector('.auth-content');
    content.classList.add('shake');
    triggerHaptic('heavy');
    
    setTimeout(() => {
        content.classList.remove('shake');
        pinInput = "";
        updateDots();
    }, 400);
});

socket.on('auth_required', () => {
    authOverlay.classList.remove('hidden');
    const stateEl = document.getElementById('auth-state');
    if (stateEl) stateEl.innerText = "🔒";
});

// UI Elements
const trackpad = document.getElementById('trackpad');
const status = document.getElementById('connection-status');
const kbInput = document.getElementById('kb-input');

// Interaction State
let lastX = 0, lastY = 0;
let isMoving = false, isScrolling = false;
let lastScrollY = 0;
const SCROLL_SENSITIVITY = 1.2;

// Mechanical Haptics Helper
const triggerHaptic = (type = 'light') => {
    if (!window.navigator.vibrate) return;
    if (type === 'light') window.navigator.vibrate(15);
    else if (type === 'medium') window.navigator.vibrate(40);
    else if (type === 'heavy') window.navigator.vibrate([100, 50, 100]);
};

// 4-Tab Navigation Logic
document.querySelectorAll('.tab-link').forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        const targetEl = document.getElementById(target);
        if (!targetEl) return;
        
        document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        targetEl.classList.add('active');
        triggerHaptic('light');
    });
});

// Trackpad Interaction Logic
if (trackpad) {
    let longPressTimer = null;
    let lastTapTime = 0;

    trackpad.addEventListener('touchstart', (e) => {
        const now = Date.now();
        if (e.touches.length === 1) {
            if (now - lastTapTime < 300) {
                socket.emit('mouse_click', { button: 'left', count: 2 });
                lastTapTime = 0;
            } else { lastTapTime = now; }
            
            longPressTimer = setTimeout(() => {
                socket.emit('mouse_click', { button: 'right' });
                triggerHaptic('medium');
            }, 600);
        }
        
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            lastX = touch.clientX; lastY = touch.clientY;
            isMoving = true; isScrolling = false;
        } else if (e.touches.length === 2) {
            const touch1 = e.touches[0], touch2 = e.touches[1];
            lastScrollY = (touch1.clientY + touch2.clientY) / 2;
            isScrolling = true; isMoving = false;
            clearTimeout(longPressTimer);
        }
    });

    trackpad.addEventListener('touchmove', (e) => {
        clearTimeout(longPressTimer);
        if (e.touches.length === 1 && isMoving) {
            const touch = e.touches[0];
            const dx = (touch.clientX - lastX);
            const dy = (touch.clientY - lastY);
            socket.emit('mouse_move', { dx, dy });
            lastX = touch.clientX; lastY = touch.clientY;
        } else if (e.touches.length === 2 && isScrolling) {
            const touch1 = e.touches[0], touch2 = e.touches[1];
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
        isMoving = false; isScrolling = false;
        clearTimeout(longPressTimer);
    });

    trackpad.addEventListener('click', () => {
        socket.emit('mouse_click', { button: 'left' });
        triggerHaptic('light');
    });
}

// Socket Bindings
const bindEvent = (id, eventName, data) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', () => {
        socket.emit(eventName, data);
        triggerHaptic('light');
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

document.querySelectorAll('.app-card').forEach(card => {
    card.addEventListener('click', () => {
        socket.emit('launch_app', { app: card.dataset.app });
        triggerHaptic('medium');
    });
});

if (kbInput) {
    kbInput.addEventListener('input', (e) => { if (e.data) socket.emit('keyboard', { text: e.data }); });
    kbInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { socket.emit('keyboard', { text: 'ENTER' }); kbInput.value = ''; kbInput.blur(); } });
}
document.getElementById('kb-backspace')?.addEventListener('click', () => { socket.emit('keyboard', { text: 'BACKSPACE' }); triggerHaptic('light'); });
