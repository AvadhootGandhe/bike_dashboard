# Running Bike Dashboard on Raspberry Pi

This guide covers detailed steps to run the bike dashboard on a Raspberry Pi (Pi 4 recommended) with an Arduino connected via USB.

---

## Table of Contents

1. [Hardware Requirements](#1-hardware-requirements)
2. [Prerequisites](#2-prerequisites)
3. [Arduino Setup](#3-arduino-setup)
4. [Clone and Install on Pi](#4-clone-and-install-on-pi)
5. [Serial Port Permissions](#5-serial-port-permissions)
6. [Identify Serial Port](#6-identify-serial-port)
7. [Run the Application](#7-run-the-application)
8. [Production Deployment](#8-production-deployment)
9. [Autostart on Boot](#9-autostart-on-boot)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Hardware Requirements

| Component | Notes |
|-----------|-------|
| **Raspberry Pi** | Pi 4 (2GB+) recommended; Pi 3B+ may work but can be slow |
| **Arduino** | Any Arduino with USB serial (Uno, Nano, Mega, etc.) |
| **USB cable** | Connect Arduino to Pi via USB |
| **SD card** | 16GB+ with Raspberry Pi OS |
| **Display** (optional) | HDMI monitor, 7" touchscreen, or access from another device on the network |
| **Network** | Ethernet or Wi-Fi for SSH/remote access |

---

## 2. Prerequisites

### 2.1 Install Raspberry Pi OS

1. Flash [Raspberry Pi OS](https://www.raspberrypi.com/software/) (64-bit recommended for Pi 4) to an SD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2. Boot the Pi and complete initial setup (Wi‑Fi, user, etc.).
3. Update the system:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

### 2.2 Install Node.js 18+ (LTS)

**Option A – NodeSource (recommended):**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # Should show v20.x.x
npm -v
```

**Option B – Manual download:**

Visit [nodejs.org](https://nodejs.org/) and download the ARM64 build for Linux, or use `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### 2.3 Install pnpm (or use npm)

```bash
sudo npm install -g pnpm
# Or use npm directly – all commands work with npm run instead of pnpm
```

---

## 3. Arduino Setup

1. **Locate the sketch**  
   - Path: `src/app/script_for_arduino` in the project  
   - Or copy from `README.md` – it sends JSON lines over serial at 115200 baud.

2. **Open Arduino IDE** on your PC, create a new sketch, and paste the script.

3. **Upload to Arduino:**
   - Select board (e.g. Arduino Uno)
   - Select correct serial port (COM3, COM4 on Windows; `/dev/ttyACM0` etc. on Linux)
   - Click Upload

4. **Verify output** in Serial Monitor (115200 baud). You should see lines like:
   ```
   {"speed":0,"battery":100}
   {"speed":2,"battery":99}
   ```

5. **Disconnect from PC** and plug the Arduino into the Pi’s USB port.

---

## 4. Clone and Install on Pi

### 4.1 Clone the repository

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/bike_dashboard.git
cd bike_dashboard
```

(Replace `YOUR_USERNAME` with your GitHub username, or use your actual repo URL.)

### 4.2 Install dependencies

```bash
pnpm install
# or: npm install
```

This installs React, Vite, serialport, ws, and other dependencies. On ARM (Raspberry Pi), `serialport` will use prebuilt binaries for `linux-arm` or `linux-arm64`.

**If `serialport` fails to install:**

- Install build tools:
  ```bash
  sudo apt install -y build-essential python3
  ```
- Run `pnpm install` again so it can compile native bindings.

---

## 5. Serial Port Permissions

Non-root users need permission to access USB serial devices. Add your user to the `dialout` group:

```bash
sudo usermod -a -G dialout $USER
```

Log out and log back in, or reboot:

```bash
sudo reboot
```

After reboot, verify:

```bash
groups
# Should include "dialout"
```

---

## 6. Identify Serial Port

The Arduino usually appears as:

- `/dev/ttyACM0` – most Arduino Uno/Nano
- `/dev/ttyUSB0` – USB‑serial adapters (e.g. some Nano clones)

List serial devices:

```bash
ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
```

If you see `/dev/ttyUSB0` instead of `/dev/ttyACM0`, set the `SERIAL_PORT` environment variable when starting the server (see step 7).

---

## 7. Run the Application

You need two processes: the Node serial bridge and the frontend.

### 7.1 Terminal 1 – Serial bridge server

```bash
cd ~/bike_dashboard

# Default serial port: /dev/ttyACM0
pnpm run server

# Or if Arduino is on /dev/ttyUSB0:
SERIAL_PORT=/dev/ttyUSB0 pnpm run server

# Custom WebSocket port (default 8080):
WS_PORT=9000 pnpm run server
```

Expected output:

```
[serial] Opened /dev/ttyACM0 at 115200 baud
[ws] WebSocket server listening on ws://localhost:8080
[server] Started. Reading from /dev/ttyACM0, broadcasting on ws://localhost:8080
```

Leave this running.

### 7.2 Terminal 2 – Frontend (development)

```bash
cd ~/bike_dashboard
pnpm dev
```

Vite will start on `http://localhost:5173`.

### 7.3 Open the dashboard

- **On the Pi:** Open Chromium/Firefox and go to `http://localhost:5173`
- **From another device:** Use `http://<PI_IP>:5173` (e.g. `http://192.168.1.50:5173`)

To find the Pi’s IP:

```bash
hostname -I
```

The frontend connects to the WebSocket at `ws://<hostname>:8080`, so when you use the Pi’s IP to load the page, it will connect to the WebSocket on the same IP.

---

## 8. Production Deployment

For production, use the built assets instead of the Vite dev server.

### 8.1 Build the frontend

```bash
cd ~/bike_dashboard
pnpm run build
```

Output goes to `dist/`.

### 8.2 Serve the built files

**Option A – `serve` (simple):**

```bash
npx serve dist -l 5173
```

**Option B – systemd + nginx (recommended for production):**

- Use nginx as reverse proxy for both the static UI and (optionally) WebSocket.
- Or keep the Node server for WebSocket and serve `dist/` with nginx on port 80.

---

## 9. Autostart on Boot

### 9.1 Create a startup script

```bash
nano ~/bike_dashboard/start.sh
```

Add:

```bash
#!/bin/bash
cd /home/pi/bike_dashboard   # Adjust path if needed

# Start serial bridge in background
SERIAL_PORT=/dev/ttyACM0 node server.js &
SERVER_PID=$!

# Start static file server (after build)
npx serve dist -l 5173 &
SERVE_PID=$!

# Optional: launch browser in kiosk mode
# sleep 5
# chromium-browser --kiosk --app=http://localhost:5173

wait $SERVER_PID
```

Make it executable:

```bash
chmod +x ~/bike_dashboard/start.sh
```

### 9.2 systemd service

Create a service file:

```bash
sudo nano /etc/systemd/system/bike-dashboard.service
```

Content:

```ini
[Unit]
Description=Bike Dashboard (Serial Bridge + Web UI)
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/bike_dashboard
Environment="SERIAL_PORT=/dev/ttyACM0"
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable bike-dashboard
sudo systemctl start bike-dashboard
sudo systemctl status bike-dashboard
```

For the frontend, either add another service or run `serve dist` from the same script as above.

---

## 10. Troubleshooting

### "Cannot open /dev/ttyACM0: Permission denied"

- Add user to `dialout`: `sudo usermod -a -G dialout $USER`
- Log out and back in, or reboot.

### "Error: No such file or directory, cannot open /dev/ttyACM0"

- Arduino may be on a different port. Run: `ls /dev/ttyACM* /dev/ttyUSB*`
- Use `SERIAL_PORT=/dev/ttyUSB0 pnpm run server` if needed.
- Ensure Arduino is connected and detected: `dmesg | tail`.

### WebSocket connects but no data

- Confirm Arduino is sending JSON lines at 115200 baud.
- In Serial Monitor, you should see lines like `{"speed":42,"battery":95}`.
- Check server logs for `[serial] Opened` and any `[serial] Error` messages.

### serialport fails to install on Pi

- Install build tools: `sudo apt install -y build-essential python3`
- Use Node.js 18+ (20 LTS recommended).
- For 64‑bit Pi OS, ensure you use the ARM64 Node.js build.

### Page loads but "Waiting for Raspberry Pi Serial Bridge"

- Ensure the Node server is running (`pnpm run server`).
- If accessing from another device, use the Pi’s IP for both the page and WebSocket (e.g. `http://192.168.1.50:5173`).
- Check firewall: `sudo ufw allow 8080` and `sudo ufw allow 5173` if UFW is enabled.

### Slow or laggy UI on Pi

- Use production build (`pnpm run build`) and serve `dist/` instead of `pnpm dev`.
- Use a lightweight browser (e.g. Chromium in kiosk mode with reduced features).
- Prefer Raspberry Pi 4 with 4GB RAM for a smoother experience.
