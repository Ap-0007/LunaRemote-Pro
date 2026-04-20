/**
 * LunaRemote Pro v5.3.1 - Resilient UI Edition
 * Logic: UI Initialization -> Event Binding -> Socket Handshake
 */

// 1. UI Navigation (Highest Priority)
function initNavigation() {
    console.log("Initializing Navigation...");
    const tabs = document.querySelectorAll('.tab-link');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.onclick = () => {
            const targetId = tab.dataset.tab;
            const targetEl = document.getElementById(targetId);
            
            if (!targetEl) return;

            // Update UI State
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            targetEl.classList.add('active');
            
            triggerHaptic('light');
            console.log(`Switched to tab: ${targetId}`);
        };
    });
}

// 2. Global Socket Persistence
let socket = null;

function initSocket() {
    let target = window.location.origin;

    // Handle GitHub Pages / Vercel redirects
    if (target.includes('github.io') || target.includes('vercel.app')) {
        const saved = localStorage.getItem('luna_target');
        if (!saved) {
            target = prompt("Enter Mac Local IP or Tunnel URL:", "http://192.168.1.29:5001");
            if (target) localStorage.setItem('luna_target', target);
        } else {
            target = saved;
        }
    }

    console.log(`Connecting to: ${target}`);
    try {
        socket = io(target, { reconnectionAttempts: 5, timeout: 10000 });
        
        socket.on('connect', () => {
            document.getElementById('connection-status').innerText = "ONLINE";
            document.getElementById('connection-status').className = "active";
            console.log("Socket Connected!");
        });

        socket.on('disconnect', () => {
            const statusEl = document.getElementById('connection-status');
            statusEl.innerText = "OFFLINE (Double Tap to Reset IP)";
            statusEl.className = "";
        });

        // Click to reset IP
        document.getElementById('connection-status').onclick = () => {
            if (localStorage.getItem('luna_target')) {
                localStorage.removeItem('luna_target');
                alert("Saved IP reset! Note: The page will now reload.");
                window.location.reload();
            }
        };

        // Bind Controls (After Socket Init)
        bindControls();
    } catch (e) {
        console.error("Socket Init Failed:", e);
    }
}

// 3. Control Bindings
function bindControls() {
    if (!socket) return;

    // Trackpad
    const trackpad = document.getElementById('trackpad');
    if (trackpad) {
        let lastX = 0, lastY = 0;
        let isMoving = false;

        trackpad.ontouchstart = (e) => {
            const touch = e.touches[0];
            lastX = touch.clientX; lastY = touch.clientY;
            isMoving = true;
        };

        trackpad.ontouchmove = (e) => {
            if (!isMoving) return;
            const touch = e.touches[0];
            const dx = touch.clientX - lastX;
            const dy = touch.clientY - lastY;
            socket.emit('mouse_move', { dx, dy });
            lastX = touch.clientX; lastY = touch.clientY;
            e.preventDefault();
        };

        trackpad.onclick = () => socket.emit('mouse_click', { button: 'left' });
    }

    // Media & Apps
    document.querySelectorAll('.app-card').forEach(card => {
        card.onclick = () => socket.emit('launch_app', { app: card.dataset.app });
    });

    const bind = (id, event, data) => {
        document.getElementById(id).onclick = () => socket.emit(event, data);
    };

    bind('vol-up', 'volume', { action: 'up' });
    bind('vol-down', 'volume', { action: 'down' });
    bind('media-play', 'media', { action: 'playpause' });
}

// 4. Utility
function triggerHaptic(type) {
    if (window.navigator.vibrate) {
        window.navigator.vibrate(type === 'light' ? 15 : 40);
    }
}

// Start System
window.onload = () => {
    initNavigation();
    initSocket();
};
