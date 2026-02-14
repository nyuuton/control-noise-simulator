
import React, { useRef, useEffect } from 'react';

interface Props {
  data: Float32Array;
  idealData: Float32Array;
  maxAmp: number;
}

const Oscilloscope: React.FC<Props> = ({ data, idealData, maxAmp }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Responsive Canvas
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Layout
    const padding = { top: 20, right: 30, bottom: 40, left: 50 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Clear
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // --- Grid & Axes ---
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Vertical Grid lines
    for (let i = 0; i <= 4; i++) {
        const x = padding.left + (plotWidth * i) / 4;
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
    }
    // Horizontal Grid lines
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (plotHeight * i) / 4;
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
    }
    ctx.stroke();

    // Axes Borders
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    // --- Plotting Helpers ---
    // Safe max ensures we don't divide by zero and adds headroom
    const safeMax = maxAmp || 1;
    const scaleY = (val: number) => padding.top + plotHeight / 2 - (val / safeMax) * (plotHeight / 2 * 0.9);
    const scaleX = (idx: number) => padding.left + (idx / data.length) * plotWidth;

    // --- Draw Ideal (Reference) ---
    ctx.beginPath();
    ctx.strokeStyle = '#475569';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < idealData.length; i++) {
      const x = scaleX(i);
      const y = scaleY(idealData[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // --- Draw Noisy (Actual) ---
    ctx.beginPath();
    ctx.strokeStyle = '#22c55e'; // Green-500
    ctx.lineWidth = 2;
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#22c55e';
    for (let i = 0; i < data.length; i++) {
      const x = scaleX(i);
      const y = scaleY(data[i]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // --- Labels ---
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    
    // Y-Axis Labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${safeMax.toFixed(2)} V`, padding.left - 8, padding.top);
    ctx.fillText(`0 V`, padding.left - 8, padding.top + plotHeight / 2);
    ctx.fillText(`-${safeMax.toFixed(2)} V`, padding.left - 8, padding.top + plotHeight);

    // X-Axis Labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('0 ns', padding.left, height - padding.bottom + 8);
    ctx.fillText('1.0 ns', padding.left + plotWidth / 2, height - padding.bottom + 8);
    ctx.fillText('2.0 ns', padding.left + plotWidth, height - padding.bottom + 8);

    // Axis Titles
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px monospace';
    
    // Y Title (Rotated)
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('VOLTAGE (V)', 0, 0);
    ctx.restore();

    // X Title
    ctx.textAlign = 'center';
    ctx.fillText('TIME (ns)', padding.left + plotWidth / 2, height - 10);

  }, [data, idealData, maxAmp]);

  return (
    <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
      <div className="absolute top-2 right-2 text-[10px] text-green-500 font-mono bg-slate-900/80 px-2 py-1 rounded border border-green-500/20">
        TIME DOMAIN
      </div>
    </div>
  );
};

export default Oscilloscope;
