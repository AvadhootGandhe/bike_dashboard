## Bike Dashboard on Raspberry Pi 4 (with Arduino)

This project shows a bike dashboard UI (speed, battery, indicators) that reads data from an Arduino.

On the Raspberry Pi, a small Node.js server reads the Arduino over serial and forwards data to the React UI through WebSocket. No Web Serial API or special browser support is required.

---

### 1. Arduino setup

1. Open the `src/app/script_for_arduino` file in the Arduino IDE.
2. Create a new sketch and paste the contents:

   - It uses:
     - `Serial.begin(115200);`
     - Sends JSON like:

       ```json
       {"speed":42,"battery":95}
       ```

3. Select your Arduino board and the correct serial port in the Arduino IDE.
4. Upload the sketch to the Arduino.

After upload, if you open the Arduino Serial Monitor at 115200 baud you should see JSON lines similar to:

```text
{"speed":0,"battery":100}
{"speed":2,"battery":99}
...
```

---

### 2. Raspberry Pi 4 prerequisites

On the Raspberry Pi:

- Raspberry Pi OS (or any recent Debian-based distro).
- Node.js 18+ installed (LTS is recommended).
- `pnpm` or `npm` installed.
- Any browser for display (Chromium, Firefox, etc.). The browser is only used for rendering the UI; it does **not** access the serial port directly.

Give your user permission to access serial ports:

```bash
sudo usermod -a -G dialout $USER
# then log out and log back in (or reboot)
```

Connect the Arduino to the Pi via USB. It will usually appear as `/dev/ttyACM0` or `/dev/ttyUSB0`:

```bash
ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
```

Note the correct path – by default this project uses `/dev/ttyACM0`. You can override it with the `SERIAL_PORT` environment variable if needed.

---

### 3. Install dependencies on the Pi

Clone or copy this repository to the Pi, then in the project directory:

```bash
cd bike_dashboard
pnpm install          # or: npm install
```

This installs:

- React + Vite frontend
- `serialport` and `@serialport/parser-readline` for Arduino serial communication
- `ws` for WebSocket broadcasting

---

### 4. Start the Raspberry Pi serial bridge server

The Node server is in `server.js`. It:

- Opens the Arduino serial port (115200 baud).
- Parses incoming lines as text.
- Broadcasts each line to all connected WebSocket clients on `ws://<pi-ip>:8080`.

On the Pi, from the project root:

```bash
# If your Arduino is on a different device, set SERIAL_PORT accordingly:
# SERIAL_PORT=/dev/ttyUSB0 pnpm run server

pnpm run server       # or: npm run server
```

You should see log messages like:

```text
[serial] Opened /dev/ttyACM0 at 115200 baud
[ws] WebSocket server listening on ws://localhost:8080
[server] Started. Reading from /dev/ttyACM0, broadcasting on ws://localhost:8080
```

Leave this terminal running.

---

### 5. Start the dashboard UI on the Pi

In a **second terminal** on the Pi, start the Vite dev server:

```bash
cd bike_dashboard
pnpm dev              # or: npm run dev
```

By default Vite will start on `http://localhost:5173`.

Open a browser on the Pi and navigate to:

- `http://localhost:5173`

The dashboard should appear. The React app will automatically:

- Connect to `ws://<hostname>:8080` (the Node serial bridge).
- Receive each JSON line from the Arduino.
- Update the speed, battery, and indicators accordingly.

No user interaction is needed to connect – it auto-connects when the page loads.

---

### 6. Running in “local display” mode

For a kiosk-style dashboard on the Pi:

1. Set the Pi to auto-login to your user.
2. Configure the desktop environment or a startup script to:
   - Start the Node server:

     ```bash
     cd /path/to/bike_dashboard
     pnpm run server
     ```

   - Start the Vite dev server or serve a built version:

     ```bash
     pnpm dev
     # or after building:
     pnpm build
     npx serve dist
     ```

   - Launch the browser in full-screen / kiosk mode pointing to `http://localhost:5173` (or your chosen port).

You can use any browser that runs on the Pi; the serial communication is handled entirely by Node.js, not the browser.

---

### 7. Environment variables (optional)

You can configure the server via environment variables:

- `SERIAL_PORT` – override the Arduino device path (default: `/dev/ttyACM0`).
- `WS_PORT` – WebSocket port for the frontend (default: `8080`).

Examples:

```bash
SERIAL_PORT=/dev/ttyUSB0 WS_PORT=9000 pnpm run server
```

If you change `WS_PORT`, also update the WebSocket URL in `src/app/App.tsx`.


  # Bike Speedometer Gauge

  This is a code bundle for Bike Speedometer Gauge. The original project is available at https://www.figma.com/design/WDh3AN4F9WVjkZ223MsPXg/Bike-Speedometer-Gauge.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  