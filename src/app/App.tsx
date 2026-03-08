import React, { useRef, useState } from 'react';
import { Speedometer } from '@/app/components/Speedometer';

export default function App() {
  const [speed, setSpeed] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState(0);
  const [isBlinkingLeft, setIsBlinkingLeft] = useState(false);
  const [isBlinkingRight, setIsBlinkingRight] = useState(false);
  const [isHighBeam, setIsHighBeam] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastRawLine, setLastRawLine] = useState<string>('');

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const isReadingRef = useRef(false);

  const MAX_SPEED = 150;

  async function connectArduino() {
    try {
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API not supported in this browser.');
      }

      if (isReadingRef.current) return;

      const port = await navigator.serial.requestPort();
      portRef.current = port;

      // Must match Arduino Serial.begin(...)
      await port.open({ baudRate: 115200 });
      setIsConnected(true);

      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      readerRef.current = reader;
      isReadingRef.current = true;

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        buffer += value;

        // Arduino sends one JSON object per line via Serial.println(...)
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          setLastRawLine(trimmed);

          // Primary format: {"speed":12,"battery":99}
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
            continue;
          }

          // Fallback format: plain number speed per line
          const speedValue = Number(trimmed);
          if (!Number.isNaN(speedValue)) {
            setSpeed(Math.min(Math.max(speedValue, 0), MAX_SPEED));
          }
        }
      }
    } catch (err) {
      console.error('Arduino connection failed:', err);
      setIsConnected(false);
    } finally {
      isReadingRef.current = false;
    }
  }

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

      {!isConnected && (
        <button
          onClick={connectArduino}
          className="absolute bottom-20 px-8 py-4 rounded-full border-2 border-[#adff2f] text-[#adff2f] font-bold tracking-widest hover:bg-[#adff2f]/10 transition"
        >
          CONNECT ARDUINO
        </button>
      )}

      <div className="absolute bottom-4 text-gray-600 text-xs tracking-widest uppercase opacity-70">
        {isConnected ? 'Arduino Connected • Speed Only' : 'Waiting for Arduino'}
      </div>

      {isConnected && lastRawLine && (
        <div className="absolute bottom-10 text-gray-700 text-[10px] font-mono max-w-[90vw] truncate">
          {lastRawLine}
        </div>
      )}
    </div>
  );
}