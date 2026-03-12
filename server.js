// Simple Node.js server for Raspberry Pi that:
// - Reads JSON lines from the Arduino over a serial port
// - Broadcasts each line to any connected WebSocket clients
//
// This lets the React UI run in any browser (no Web Serial API needed)
// while the Pi itself talks to the Arduino.

import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { WebSocketServer } from "ws";

const SERIAL_PATH = process.env.SERIAL_PORT || "/dev/ttyACM0"; // Adjust if needed
const SERIAL_BAUD = 115200; // Must match Serial.begin(...) on Arduino
const WS_PORT = Number(process.env.WS_PORT || 8080);

function createSerialPort() {
  const port = new SerialPort({
    path: SERIAL_PATH,
    baudRate: SERIAL_BAUD,
  });

  port.on("open", () => {
    console.log(`[serial] Opened ${SERIAL_PATH} at ${SERIAL_BAUD} baud`);
  });

  port.on("error", (err) => {
    console.error("[serial] Error:", err.message);
  });

  return port;
}

const serialPort = createSerialPort();
const parser = serialPort.pipe(
  new ReadlineParser({
    delimiter: "\n",
  })
);

const wss = new WebSocketServer({ port: WS_PORT });

wss.on("listening", () => {
  console.log(`[ws] WebSocket server listening on ws://localhost:${WS_PORT}`);
});

wss.on("connection", (socket) => {
  console.log("[ws] Client connected");

  socket.on("close", () => {
    console.log("[ws] Client disconnected");
  });
});

parser.on("data", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  // Optionally validate JSON here; we simply forward the raw line
  // so the frontend can reuse its existing parsing logic.

  // Broadcast to all connected WebSocket clients
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(trimmed);
    }
  }
});

console.log(
  `[server] Started. Reading from ${SERIAL_PATH}, broadcasting on ws://localhost:${WS_PORT}`
);

