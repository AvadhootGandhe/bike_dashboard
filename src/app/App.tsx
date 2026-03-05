import React, { useState } from 'react';
import { Speedometer } from '@/app/components/Speedometer';

export default function App() {
  const [speed, setSpeed] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState(0);
  const [isBlinkingLeft, setIsBlinkingLeft] = useState(false);
  const [isBlinkingRight, setIsBlinkingRight] = useState(false);
  const [isHighBeam, setIsHighBeam] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const MAX_SPEED = 150;

  async function connectArduino() {
    let reader;
    let port;

    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      setIsConnected(true);

      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      reader = decoder.readable.getReader();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        const speedValue = Number(value.trim());

        if (!isNaN(speedValue)) {
          setSpeed(Math.min(speedValue, MAX_SPEED));

          // Force other values to zero / false
          setBatteryLevel(0);
          setIsBlinkingLeft(false);
          setIsBlinkingRight(false);
          setIsHighBeam(false);
        }
      }
    } catch (err) {
      console.error('Arduino connection failed:', err);
      setIsConnected(false);
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
    </div>
  );
}