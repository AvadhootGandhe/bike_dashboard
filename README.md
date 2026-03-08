
  # Bike Speedometer Gauge

  This is a code bundle for Bike Speedometer Gauge. The original project is available at https://www.figma.com/design/WDh3AN4F9WVjkZ223MsPXg/Bike-Speedometer-Gauge.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Running on Raspberry Pi (Option B: Pi reads Arduino serial)

This mode makes the **Raspberry Pi** talk to the Arduino over USB serial and stream the data to the React UI over **WebSocket**.  
You do **not** need Web Serial in the browser anymore; the Pi handles the serial connection.

### 1. What runs where

- **On the Arduino**
  - You flash `src/app/script_for_arduino` (or equivalent) so it prints JSON lines like:
    - `{"speed":12,"battery":99}`
  - Baud rate: **115200** (must match the Pi service).

- **On the Raspberry Pi**
  - `npm run start:pi` runs `server/index.mjs` which:
    - Opens the Arduino serial port (e.g. `/dev/ttyACM0`).
    - For each line from Arduino, broadcasts a WebSocket message at `ws://<pi-ip>:5173/ws`.
    - Serves the built React app from `dist/` at `http://<pi-ip>:5173`.

- **In the browser**
  - The React app (in `App.tsx`) automatically connects to `/ws`, updates speed/battery/indicators, and shows a connection status line at the bottom.

---

### 2. One-time setup on the Pi

Run these on the Raspberry Pi (Raspberry Pi OS recommended).

```bash
sudo apt update && sudo apt upgrade -y

# basic tools
sudo apt install -y git

# tools used if serialport needs to compile native bindings
sudo apt install -y python3 make g++
```

#### Install Node.js (LTS)

Install a **Node.js LTS** version (18 or 20 is fine).  
You can use a method you prefer (e.g. `nvm`, NodeSource, or the official installer from `https://nodejs.org`).

Verify:

```bash
node -v
npm -v
```

---

### 3. Get the repo and build the UI (on the Pi)

```bash
cd ~
git clone <your-repo-url>
cd bike_dashboard

# install dependencies from package-lock.json
npm ci

# build the React app into dist/
npm run build
```

You should now have a `dist/` folder in the project root (it is what the Pi server serves).

---

### 4. Give the Pi access to the Arduino serial port

Add your user to the `dialout` group so it can open `/dev/tty*` serial ports:

```bash
sudo usermod -aG dialout $USER
```

Then **log out and log back in**, or reboot the Pi once so the group change takes effect:

```bash
sudo reboot
```

---

### 5. Find the Arduino serial port

After the Pi has rebooted, plug the Arduino into the Pi via USB and run:

```bash
ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
```

Typical results:

- `/dev/ttyACM0` (common for Arduino-style boards)
- `/dev/ttyUSB0`

Remember the path you see (e.g. `/dev/ttyACM0`); you can use it in the next step.

---

### 6. Start the Pi service (manual run)

From inside the `bike_dashboard` folder:

```bash
cd ~/bike_dashboard

# simplest: let the server auto-detect /dev/ttyACM* and /dev/ttyUSB*
npm run start:pi
```

If auto-detect doesn’t pick the right port, you can force it:

```bash
SERIAL_PATH=/dev/ttyACM0 npm run start:pi
```

Environment variables used by the server:

- **`PORT`** (default `5173`): HTTP/WebSocket port.
- **`BAUD_RATE`** (default `115200`): must match `Serial.begin(...)` in your Arduino sketch.
- **`SERIAL_PATH`** (optional): set this to force a specific device, like `/dev/ttyACM0`.

When the server starts successfully you will see a log like:

```text
bike_dashboard server on http://localhost:5173
```

Leave this running while you test.

---

### 7. Open the dashboard

#### On the Pi itself (with desktop / HDMI display)

- Open a browser (Chromium is fine).
- Go to `http://localhost:5173`.

#### From another device on your network

1. Find the Pi’s IP:

   ```bash
   hostname -I
   ```

2. On your laptop/phone browser, open:

   - `http://<pi-ip>:5173`

You should see the speedometer UI. The status line at the bottom will say things like:

- `Live Data • Serial: /dev/ttyACM0` when connected.
- `Disconnected. Reconnecting...` while it is trying to reconnect.

---

### 8. Autostart the backend on boot (systemd)

This makes the **Pi service** (serial reader + web server) start automatically whenever the Pi boots.

Create a new service file:

```bash
sudo nano /etc/systemd/system/bike-dashboard.service
```

Paste the following (edit `User`, `WorkingDirectory`, and `SERIAL_PATH` to match your Pi):

```ini
[Unit]
Description=Bike Dashboard (UI + Serial -> WebSocket)
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/bike_dashboard
Environment=NODE_ENV=production
Environment=PORT=5173
Environment=BAUD_RATE=115200
# Set this to the actual Arduino device if you want to force it:
# Environment=SERIAL_PATH=/dev/ttyACM0
ExecStart=/usr/bin/npm run start:pi
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bike-dashboard
sudo systemctl status bike-dashboard --no-pager
```

From now on, every time the Pi boots:

- `bike-dashboard` will start in the background.
- It will try to connect to the Arduino on the configured serial port.
- It will host the dashboard at `http://<pi-ip>:5173`.

To see logs:

```bash
sudo journalctl -u bike-dashboard -f
```

---

### 9. (Optional) Auto-open the dashboard on the Pi display (kiosk style)

If you are using **Raspberry Pi OS with Desktop** and want the dashboard to appear automatically on the HDMI screen:

1. Install Chromium (if not already installed):

   ```bash
   sudo apt install -y chromium-browser
   ```

2. Add a simple autostart entry for your desktop environment so that, after login, Chromium launches in fullscreen pointing to your dashboard, for example:

   ```bash
   chromium-browser --kiosk --incognito http://localhost:5173
   ```

Combine this with the `systemd` service above and you get:

- Backend service starts at boot.
- When the user session starts, Chromium opens the dashboard fullscreen.

(The exact desktop autostart file path can vary by Raspberry Pi OS version; use the standard autostart method you prefer.)

---

### 10. What this setup will do

- **On boot (with systemd enabled)**:
  - The Pi automatically starts the **bike-dashboard** service.
  - The service opens the Arduino serial port and begins reading JSON lines.
  - It serves the React UI and a WebSocket endpoint on `http://<pi-ip>:5173`.

- **On the display / in the browser**:
  - When you open `http://<pi-ip>:5173` (or `http://localhost:5173` on the Pi), the speedometer UI loads.
  - The UI automatically connects to the Pi’s WebSocket, receives live data from the Arduino, and updates:
    - **Speed**, **battery level**, and indicator lights.
    - A status message at the bottom showing connection state.

- **If you also configure desktop autostart/kiosk**:
  - After the Pi boots and logs into the desktop, the dashboard will **automatically appear fullscreen** on the HDMI display and stay in sync with the Arduino without you needing to click anything.
  