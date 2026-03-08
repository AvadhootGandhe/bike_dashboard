import React, { useEffect, useRef, useState } from 'react';
import { Speedometer } from '@/app/components/Speedometer';

export default function App() {
  const [speed, setSpeed] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState(0);
  const [isBlinkingLeft, setIsBlinkingLeft] = useState(false);
  const [isBlinkingRight, setIsBlinkingRight] = useState(false);
  const [isHighBeam, setIsHighBeam] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionText, setConnectionText] = useState('Connecting to Pi service...');
  const [lastRawLine, setLastRawLine] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const MAX_SPEED = 150;

  function applyParsed(parsed: unknown) {
    if (!parsed || typeof parsed !== 'object') return;
    const obj = parsed as Partial<{
      speed: number;
      battery: number;
      left: boolean;
      right: boolean;
      highBeam: boolean;
    }>;

    if (typeof obj.speed === 'number' && Number.isFinite(obj.speed)) {
      setSpeed(Math.min(Math.max(obj.speed, 0), MAX_SPEED));
    }
    if (typeof obj.battery === 'number' && Number.isFinite(obj.battery)) {
      setBatteryLevel(Math.min(Math.max(obj.battery, 0), 100));
    }
    if (typeof obj.left === 'boolean') setIsBlinkingLeft(obj.left);
    if (typeof obj.right === 'boolean') setIsBlinkingRight(obj.right);
    if (typeof obj.highBeam === 'boolean') setIsHighBeam(obj.highBeam);
  }

  function connectWs() {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const configured = (import.meta as any).env?.VITE_WS_URL as string | undefined;
    const wsUrl =
      configured && configured.trim().length > 0
        ? configured
        : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

    setConnectionText(`Connecting to ${wsUrl}...`);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionText('Connected to Pi service.');
      };

      ws.onclose = () => {
        setIsConnected(false);
        setConnectionText('Disconnected. Reconnecting...');
        reconnectTimerRef.current = window.setTimeout(connectWs, 1000);
      };

      ws.onerror = () => {
        // onclose will handle reconnection
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(String(evt.data)) as
            | { type: 'status'; connected?: boolean; reason?: string; path?: string }
            | { type: 'data'; raw: string; parsed: unknown };

          if (msg.type === 'status') {
            setIsConnected(Boolean(msg.connected));
            const suffix =
              msg.connected
                ? msg.path
                  ? `Serial: ${msg.path}`
                  : 'Serial connected'
                : msg.reason
                  ? msg.reason
                  : 'Serial disconnected';
            setConnectionText(suffix);
            return;
          }

          if (msg.type === 'data') {
            setLastRawLine(msg.raw);
            if (msg.parsed) {
              applyParsed(msg.parsed);
              return;
            }

            // Fallback: plain number speed per line
            const speedValue = Number(msg.raw.trim());
            if (!Number.isNaN(speedValue)) {
              setSpeed(Math.min(Math.max(speedValue, 0), MAX_SPEED));
            }
          }
        } catch {
          // ignore
        }
      };
    } catch (err) {
      setIsConnected(false);
      setConnectionText(`WebSocket failed: ${String(err)}`);
      reconnectTimerRef.current = window.setTimeout(connectWs, 1500);
    }
  }

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {isConnected ? `Live Data • ${connectionText}` : connectionText}
      </div>

      {isConnected && lastRawLine && (
        <div className="absolute bottom-10 text-gray-700 text-[10px] font-mono max-w-[90vw] truncate">
          {lastRawLine}
        </div>
      )}
    </div>
  );
}