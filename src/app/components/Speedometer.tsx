import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Battery, Zap, TriangleAlert, Info } from 'lucide-react';

interface SpeedometerProps {
  speed: number;
  maxSpeed?: number;
  batteryLevel?: number; // 0-100
  odo?: number;
  isBlinkingLeft?: boolean;
  isBlinkingRight?: boolean;
  isHighBeam?: boolean;
}

const SevenSegmentDigit = ({ value, h = 100, x = 0, y = 0, color = "#adff2f" }: { value: number | string, h?: number, x?: number, y?: number, color?: string }) => {
  // Simple 7-segment representation using polygon paths
  const w = h * 0.6;
  const t = h * 0.1; // thickness
  
  // Segment definitions relative to 0,0 with width w and height h
  //   A
  // F   B
  //   G
  // E   C
  //   D
  
  const segments: Record<string, string> = {
    a: `${t},0 ${w-t},0 ${w-t*2},${t} ${t*2},${t}`,
    b: `${w},${t} ${w},${h/2-t/2} ${w-t},${h/2-t/2} ${w-t},${t*2}`,
    c: `${w},${h/2+t/2} ${w},${h-t} ${w-t},${h-t*2} ${w-t},${h/2+t/2}`,
    d: `${t},${h} ${w-t},${h} ${w-t*2},${h-t} ${t*2},${h-t}`,
    e: `${0},${h/2+t/2} ${0},${h-t} ${t},${h-t*2} ${t},${h/2+t/2}`,
    f: `${0},${t} ${0},${h/2-t/2} ${t},${h/2-t/2} ${t},${t*2}`,
    g: `${t},${h/2} ${w-t},${h/2} ${w-t*2},${h/2+t/2} ${t*2},${h/2+t/2} ${t},${h/2} ${t*2},${h/2-t/2} ${w-t*2},${h/2-t/2}`,
  };

  const digitMap: Record<string, string[]> = {
    '0': ['a','b','c','d','e','f'],
    '1': ['b','c'],
    '2': ['a','b','d','e','g'],
    '3': ['a','b','c','d','g'],
    '4': ['b','c','f','g'],
    '5': ['a','c','d','f','g'],
    '6': ['a','c','d','e','f','g'],
    '7': ['a','b','c'],
    '8': ['a','b','c','d','e','f','g'],
    '9': ['a','b','c','d','f','g'],
    ' ': [], // Empty
  };

  const activeSegments = digitMap[value.toString()] || [];
  const allSegments = ['a','b','c','d','e','f','g'];

  return (
    <g transform={`translate(${x},${y})`}>
      {allSegments.map(seg => (
        <polygon
          key={seg}
          points={segments[seg]}
          fill={activeSegments.includes(seg) ? color : "#1a1a1a"}
          opacity={activeSegments.includes(seg) ? 1 : 0.2}
        />
      ))}
    </g>
  );
};

export const Speedometer: React.FC<SpeedometerProps> = ({ 
    speed, 
    maxSpeed = 150, 
    batteryLevel = 85, 
    odo = 28814,
    isBlinkingLeft = false,
    isBlinkingRight = false,
    isHighBeam = false
}) => {
  
  // Format speed to 3 digits
  const speedStr = Math.floor(speed).toString().padStart(3, ' ');
  const digits = speedStr.split('');

  // Battery Bars
  const totalBars = 10;
  const activeBars = Math.ceil((batteryLevel / 100) * totalBars);

  // Log Curve Gauge Segments
  const gaugeSegments = useMemo(() => {
    const count = 50; // More segments for wider span
    const width = 700; // Full width of container
    const height = 350; // Full height
    return Array.from({ length: count }).map((_, i) => {
       const t = i / (count - 1); // 0 to 1
       const x = t * width; // Span full width
       
       // Logarithmic incline across the whole screen
       const k = 15; 
       const normalizedY = Math.log(t * k + 1) / Math.log(k + 1);
       
       // Map to a curve that starts bottom-left and goes to top-right
       // Start at y=250 (lower) and end at y=50 (higher)
       const y = 280 - (normalizedY * 200);

       const isActive = speed >= (t * maxSpeed);
       
       // Color logic
       let color = "#333";
       if (isActive) {
           if (t < 0.3) color = "#00f0ff"; // Cyan
           else if (t < 0.6) color = "#00ff00"; // Green
           else if (t < 0.8) color = "#ffff00"; // Yellow
           else color = "#ff0000"; // Red
       }

       return { x, y, color, isActive };
    });
  }, [speed, maxSpeed]);

  return (
    <div className="relative w-[700px] h-[400px] bg-black rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-gray-900 flex flex-col items-center justify-center font-mono select-none overflow-hidden">
        
        
        {/* LCD Glass Reflection Effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none rounded-3xl z-50" />
        
        {/* Main Display Area */}
        <div className="relative w-full h-full bg-[#080808] rounded-xl flex flex-col justify-between p-4 relative overflow-hidden">
            {/* Subtle LCD Grid Texture */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                 style={{ backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)', backgroundSize: '10px 10px' }} 
            />

            {/* Top Row: Indicators */}
            <div className="flex justify-between items-start w-full px-8 pt-2 mb-4">
                 {/* Left Turn */}
                 <div className={`transition-opacity duration-100 ${isBlinkingLeft ? 'opacity-100' : 'opacity-10'}`}>
                    <svg width="40" height="30" viewBox="0 0 24 24" fill="#0f0">
                        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                    </svg>
                 </div>

                 {/* High Beam */}
                 <div className={`transition-opacity duration-300 ${isHighBeam ? 'opacity-100 shadow-[0_0_15px_blue]' : 'opacity-20'}`}>
                    <div className="bg-blue-600 w-12 h-8 rounded-full flex items-center justify-center shadow-[0_0_10px_blue]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                             <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM7 12h10" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2"/>
                             <path d="M6 12C6 12 9 9 12 9C15 9 18 12 18 12" stroke="white" strokeWidth="2" fill="none" />
                             <path d="M6 15C6 15 9 12 12 12C15 12 18 15 18 15" stroke="white" strokeWidth="2" fill="none" />
                        </svg>
                    </div>
                 </div>

                 {/* Right Turn */}
                 <div className={`transition-opacity duration-100 ${isBlinkingRight ? 'opacity-100' : 'opacity-10'}`}>
                    <svg width="40" height="30" viewBox="0 0 24 24" fill="#0f0">
                        <path d="M4 11h12.17l-5.59-5.59L12 4l8 8-8 8-1.41-1.41L16.17 13H4v-2z"/>
                    </svg>
                 </div>
            </div>

            {/* Center Area: Speed and Info */}
            <div className="flex flex-1 flex-col items-center justify-end w-full relative pb-4 z-10">
                
                {/* Left Side: Status Icons (Replacing Gears) */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 text-gray-800">
                    <div className={`flex items-center gap-2 ${batteryLevel < 20 ? "text-red-500 animate-pulse" : "text-gray-800"}`}>
                        <TriangleAlert size={24} fill="currentColor" />
                    </div>
                    <div className="text-gray-800">
                        <Zap size={24} fill="currentColor" />
                    </div>
                     {/* "READY" indicator for EV */}
                    <div className="text-green-500 font-bold border border-green-900 rounded px-1 bg-green-900/20 text-xs text-center tracking-widest mt-4 opacity-80">
                        READY
                    </div>
                </div>

                {/* Center: Digital Speed */}
                <div className="flex items-baseline gap-2 ml-10 mt-12 z-10 relative">
                    <svg width="340" height="150" viewBox="0 0 340 150">
                        {/* 7-Segment Digits */}
                        <SevenSegmentDigit value={digits[0]} x={0} y={0} h={140} />
                        <SevenSegmentDigit value={digits[1]} x={110} y={0} h={140} />
                        <SevenSegmentDigit value={digits[2]} x={220} y={0} h={140} />
                    </svg>
                    <span className="text-4xl text-[#adff2f] font-bold mt-8 font-sans italic tracking-tighter opacity-80">km/h</span>
                </div>

            {/* Right Side: Battery Gauge */}
<div className="absolute right-8 top-1/2 -translate-y-1/2 h-full flex flex-col items-end justify-center py-4">
  <div className="text-gray-400 text-xs mb-1 font-bold">F</div>

  <div className="flex flex-col-reverse gap-1 w-8 h-[140px] bg-[#111] p-1 rounded border border-[#333]">
    {Array.from({ length: totalBars }).map((_, i) => {
      const active = i < activeBars;
      const isCritical = batteryLevel < 20 && i < activeBars;

      return (
        <div
          key={i}
          className={`flex-1 w-full rounded-sm transition-all duration-300
            ${active ? 'bg-[#adff2f] shadow-[0_0_5px_#adff2f]' : 'bg-[#1a1a1a]'}
            ${isCritical ? '!bg-red-500 !shadow-[0_0_5px_red]' : ''}
          `}
          style={{ opacity: active ? 1 : 0.25 }}
        />
      );
    })}
  </div>

  <div className="text-gray-400 text-xs mt-1 font-bold">E</div>

  <div className="mt-2">
    <Battery
      size={20}
      className={batteryLevel < 20 ? "text-red-500 animate-pulse" : "text-gray-500"}
    />
  </div>
</div>
</div>  {/* ← ADD THIS LINE */}
            {/* Bottom Row: Odometer and Clock */}
            <div className="flex justify-between items-end w-full px-4 mb-2">
                {/* Odometer Box */}
                <div className="border border-[#333] bg-[#0a0a0a] px-3 py-1 rounded flex items-center gap-2 shadow-inner">
                    <span className="text-gray-500 text-xs font-bold">ODO</span>
                    <span className="text-[#adff2f] font-mono text-lg tracking-widest opacity-90">{odo.toLocaleString()}</span>
                    <span className="text-gray-500 text-xs">km</span>
                </div>

                {/* Clock Box */}
                <div className="border border-[#333] bg-[#0a0a0a] px-3 py-1 rounded flex items-center gap-2 shadow-inner">
                    <span className="text-gray-500 text-xs font-bold">PM</span>
                    <span className="text-[#adff2f] font-mono text-xl tracking-widest opacity-90">12:00</span>
                </div>
            </div>
            
        </div>
    </div>
  );
}; 