import React, { useEffect, useState } from 'react';
import { Speedometer } from '@/app/components/Speedometer';

export default function App() {
  const [speed, setSpeed] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState(0);
  const [isBlinkingLeft, setIsBlinkingLeft] = useState(false);
  const [isBlinkingRight, setIsBlinkingRight] = useState(false);
  const [isHighBeam, setIsHighBeam] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastRawLine, setLastRawLine] = useState<string>('');

  const MAX_SPEED = 150;

  useEffect(() => {
    // Connect to local WebSocket server on the Raspberry Pi
    // The Node server (server.js) reads from the Arduino serial port
    // and forwards each JSON line over this WebSocket.
    const ws = new WebSocket(`ws://${window.location.hostname}:8080`);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const trimmed = event.data.trim();
      if (!trimmed) return;

      setLastRawLine(trimmed);

      // Primary format: {"speed":12,"battery":99,"left":false,"right":true,"highBeam":false}
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed) as Partial<{
            speed: number;
            battery: number;
            left: boolean;
            right: boolean;
            highBeam: boolean;
          }>;

          if (typeof parsed.speed === 'number' && Number.isFinite(parsed.speed)) {
            setSpeed(Math.min(Math.max(parsed.speed, 0), MAX_SPEED));
          }
          if (typeof parsed.battery === 'number' && Number.isFinite(parsed.battery)) {
            setBatteryLevel(Math.min(Math.max(parsed.battery, 0), 100));
          }
          if (typeof parsed.left === 'boolean') setIsBlinkingLeft(parsed.left);
          if (typeof parsed.right === 'boolean') setIsBlinkingRight(parsed.right);
          if (typeof parsed.highBeam === 'boolean') setIsHighBeam(parsed.highBeam);
        } catch {
          // Ignore malformed JSON lines
        }
        return;
      }

      // Fallback format: plain number speed per line
      const speedValue = Number(trimmed);
      if (!Number.isNaN(speedValue)) {
        setSpeed(Math.min(Math.max(speedValue, 0), MAX_SPEED));
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black text-white flex flex-col items-center justify-center select-none">

      <div className="scale-75 md:scale-100">
        <Speedometer
          speed={speed}
          maxSpeed={MAX_SPEED}
          batteryLevel={batteryLevel}
          isBlinkingLeft={isBlinkingLeft}
          isBlinkingRight={isBlinkingRight}
          isHighBeam={isHighBeam}
        />
      </div>

      <div className="absolute bottom-4 text-gray-600 text-xs tracking-widest uppercase opacity-70">
        {isConnected ? 'Raspberry Pi Serial Bridge Connected' : 'Waiting for Raspberry Pi Serial Bridge'}
      </div>

      {isConnected && lastRawLine && (
        <div className="absolute bottom-10 text-gray-700 text-[10px] font-mono max-w-[90vw] truncate">
          {lastRawLine}
        </div>
      )}
    </div>
  );
}