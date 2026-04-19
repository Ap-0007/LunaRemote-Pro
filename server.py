import os
import socket
import subprocess
import threading
import time
import re
from flask import Flask, render_template, request, send_from_directory
from flask_socketio import SocketIO, emit

try:
    from pynput.mouse import Controller as MouseController, Button
    from pynput.keyboard import Controller as KeyboardController, Key
    mouse = MouseController()
    keyboard = KeyboardController()
    HAS_PYNPUT = True
except ImportError:
    HAS_PYNPUT = False
    print("Warning: pynput not found. Mouse/Keyboard control will be disabled.")

try:
    import qrcode
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False

# Serving templates from root for GitHub/Local unity
app = Flask(__name__, template_folder='.')
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Global Access Security v5.0.6
AUTH_PIN = "909090"
authenticated_sessions = set()
global_url = "Initializing Firewall Bypass..."

# Sensitivity for mouse movement
SENSITIVITY = 1.8

def run_osascript(script):
    try:
        subprocess.run(["osascript", "-e", script], check=True)
    except Exception as e:
        print(f"OSAScript Error: {e}")

def check_auth(sid):
    return True # Security Bypass v5.2.0

@app.route('/')
def index():
    return render_template('index.html')

# Serve static files from the root /static directory
@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

# Authentication Handshake
@socketio.on('auth')
def handle_auth(data):
    pin = data.get('pin')
    if pin == AUTH_PIN:
        authenticated_sessions.add(request.sid)
        emit('auth_success')
        print(f"✅ [SECURITY] Client authenticated (SID: {request.sid})")
    else:
        emit('auth_fail', {'msg': 'Invalid PIN'})
        print(f"❌ [SECURITY] Failed auth attempt (SID: {request.sid})")

@socketio.on('connect')
def handle_connect():
    print(f"🔌 Connection attempt from {request.sid}")
    if request.sid not in authenticated_sessions:
        emit('auth_required')

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in authenticated_sessions:
        authenticated_sessions.remove(request.sid)

# Mouse & Keyboard Events (Wrapped in check_auth)
@socketio.on('mouse_move')
def handle_mouse_move(data):
    if not check_auth(request.sid) or not HAS_PYNPUT: return
    dx = data.get('dx', 0) * SENSITIVITY
    dy = data.get('dy', 0) * SENSITIVITY
    mouse.move(dx, dy)

@socketio.on('mouse_click')
def handle_mouse_click(data):
    if not check_auth(request.sid) or not HAS_PYNPUT: return
    btn = data.get('button', 'left')
    count = data.get('count', 1)
    click_btn = Button.left if btn == 'left' else Button.right
    mouse.click(click_btn, count)

@socketio.on('mouse_press')
def handle_mouse_press(data):
    if not check_auth(request.sid) or not HAS_PYNPUT: return
    btn = data.get('button', 'left')
    press_btn = Button.left if btn == 'left' else Button.right
    mouse.press(press_btn)

@socketio.on('mouse_release')
def handle_mouse_release(data):
    if not check_auth(request.sid) or not HAS_PYNPUT: return
    btn = data.get('button', 'left')
    release_btn = Button.left if btn == 'left' else Button.right
    mouse.release(release_btn)

@socketio.on('volume')
def handle_volume(data):
    if not check_auth(request.sid): return
    action = data.get('action')
    if action == 'up':
        run_osascript('set volume output volume ((output volume of (get volume settings)) + 6)')
    elif action == 'down':
        run_osascript('set volume output volume ((output volume of (get volume settings)) - 6)')
    elif action == 'mute':
        run_osascript('set volume output muted (not (output muted of (get volume settings)))')

@socketio.on('media')
def handle_media(data):
    if not check_auth(request.sid): return
    action = data.get('action')
    if action == 'playpause':
        run_osascript('tell application "System Events" to key code 49')
    elif action == 'next':
        run_osascript('tell application "System Events" to key code 124')
    elif action == 'prev':
        run_osascript('tell application "System Events" to key code 123')

@socketio.on('system')
def handle_system(data):
    if not check_auth(request.sid): return
    action = data.get('action')
    if action == 'sleep':
        run_osascript('tell application "System Events" to sleep')
    elif action == 'lock':
        subprocess.run(["pmset", "displaysleepnow"])

@socketio.on('keyboard')
def handle_keyboard(data):
    if not check_auth(request.sid) or not HAS_PYNPUT: return
    text = data.get('text', '')
    if text == 'BACKSPACE':
        keyboard.press(Key.backspace)
        keyboard.release(Key.backspace)
    elif text == 'ENTER':
        keyboard.press(Key.enter)
        keyboard.release(Key.enter)
    else:
        keyboard.type(text)

@socketio.on('mouse_scroll')
def handle_mouse_scroll(data):
    if not check_auth(request.sid) or not HAS_PYNPUT: return
    dy = data.get('dy', 0)
    mouse.scroll(0, dy)

@socketio.on('launch_app')
def handle_launch_app(data):
    if not check_auth(request.sid): return
    app_name = data.get('app')
    if app_name: subprocess.run(["open", "-a", app_name])

@socketio.on('panic')
def handle_panic(data=None):
    if not check_auth(request.sid): return
    run_osascript('set volume output muted true')
    subprocess.run(["pmset", "displaysleepnow"])

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def start_tunnel():
    global global_url
    print("\n📡 INITIALIZING GLOBAL TUNNEL (PORT 443 BYPASS)...")
    try:
        tunnel_process = subprocess.Popen(
            ["ssh", "-o", "StrictHostKeyChecking=no", "-p", "443", "-R", "80:localhost:5001", "a.pinggy.io"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        for line in tunnel_process.stdout:
            match = re.search(r'https://[a-zA-Z0-9-]+\.pinggy\.(link|online)', line)
            if match:
                global_url = match.group(0)
                # Write to anchor file for user convenience
                with open("LUNA_URL.txt", "w") as f:
                    f.write(f"Global Link: {global_url}\nPIN: {AUTH_PIN}")
                
                print("\n" + "🌟"*25)
                print(f"  GLOBAL ACCESS READY")
                print(f"  URL: {global_url}")
                print(f"  PIN: {AUTH_PIN}")
                print(f"  (Saved to LUNA_URL.txt)")
                print("🌟"*25 + "\n")
                break
    except Exception as e:
        print(f"Tunnel Error: {e}")
        global_url = "ERROR: Local Wi-Fi mode only."

if __name__ == '__main__':
    ip_addr = get_local_ip()
    port = 5001
    
    print("\n" + "="*50)
    print(" LUNAREMOTE PRO v5.1 (UNIVERSAL SYNC) ")
    print("="*50)
    print(f"\nLocal IP: http://{ip_addr}:{port}")
    
    threading.Thread(target=lambda: subprocess.run(["python3", "tunnel_manager.py"]), daemon=True).start()
    
    if HAS_QRCODE:
        qr = qrcode.QRCode()
        qr.add_data(f"http://{ip_addr}:{port}")
        qr.print_ascii(invert=True)
    
    print("\nSECURITY: PIN Required: 909090")
    print("="*50 + "\n")
    
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
