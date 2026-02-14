
import React, { useRef, useEffect, useState } from 'react';

interface Props {
  data: Float32Array;
  centerFreq: number;
}

// Simple FFT helper for visualization
function computeMagnitudes(signal: Float32Array): Float32Array {
  const n = signal.length;
  const real = new Float32Array(signal);
  const imag = new Float32Array(n).fill(0);

  // Bit reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
    let k = n / 2;
    while (k <= j) { j -= k; k /= 2; }
    j += k;
  }

  // Butterfly operations
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wlen_r = Math.cos(angle);
    const wlen_i = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let w_r = 1, w_i = 0;
      for (let j = 0; j < len / 2; j++) {
        const u_r = real[i + j], u_i = imag[i + j];
        const v_r = real[i + j + len / 2] * w_r - imag[i + j + len / 2] * w_i;
        const v_i = real[i + j + len / 2] * w_i + imag[i + j + len / 2] * w_r;
        real[i + j] = u_r + v_r; imag[i + j] = u_i + v_i;
        real[i + j + len / 2] = u_r - v_r; imag[i + j + len / 2] = u_i - v_i;
        const temp = w_r * wlen_r - w_i * wlen_i;
        w_i = w_r * wlen_i + w_i * wlen_r; w_r = temp;
      }
    }
  }

  const mids = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    mids[i] = Math.sqrt(real[i]*real[i] + imag[i]*imag[i]);
  }
  return mids;
}

const Spectrum: React.FC<Props> = ({ data, centerFreq }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cursorPos, setCursorPos] = useState<{x: number, freq: number} | null>(null);

  // Config constants (shared with draw)
  const displayBins = 128; 
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const plotWidth = width - padding.left - padding.right;

    if (x >= padding.left && x <= width - padding.right) {
        // Calculate Frequency from X
        const relativeX = x - padding.left;
        const pct = relativeX / plotWidth;
        const binIndex = pct * displayBins;
        
        // Frequency Mapping Logic
        const f_vis = binIndex * (4000/1024);
        const ghz = 4 + (f_vis - 20) / 20;
        
        setCursorPos({ x, freq: Math.max(0, ghz) });
    } else {
        setCursorPos(null);
    }
  };

  const handleMouseLeave = () => {
    setCursorPos(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Clear
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Compute FFT
    const mags = computeMagnitudes(data);
    const barWidth = plotWidth / displayBins;

    // Draw Bars
    for (let i = 0; i < displayBins; i++) {
       // Log scale for dB-like view
       const mag = mags[i];
       const h = Math.log10(mag + 1) * plotHeight * 0.15 * 5; 
       
       const hue = 200 + (mag > 5 ? 100 : 0); // Blue to Pink
       ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
       
       const x = padding.left + i * barWidth;
       const y = padding.top + plotHeight - h;
       ctx.fillRect(x, y, barWidth + 0.5, h);
    }

    // --- Axes & Grid ---
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';

    // Y-Axis (dB - arbitrary relative)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('0 dB', padding.left - 8, padding.top);
    ctx.fillText('-40 dB', padding.left - 8, padding.top + plotHeight / 2);
    ctx.fillText('-80 dB', padding.left - 8, padding.top + plotHeight);
    
    // X-Axis (Frequency)
    const binToGHz = (i: number) => {
        const f_vis = i * (4000/1024);
        const ghz = 4 + (f_vis - 20) / 20;
        return ghz;
    };

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    const startGHz = binToGHz(0);
    const midGHz = binToGHz(displayBins/2);
    const endGHz = binToGHz(displayBins);

    ctx.fillText(`${Math.max(4, startGHz).toFixed(1)} GHz`, padding.left, height - padding.bottom + 8);
    ctx.fillText(`${midGHz.toFixed(1)} GHz`, padding.left + plotWidth/2, height - padding.bottom + 8);
    ctx.fillText(`${endGHz.toFixed(1)} GHz`, padding.left + plotWidth, height - padding.bottom + 8);

    // Axis Titles
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px monospace';
    
    // Y Title
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('POWER (dBm)', 0, 0);
    ctx.restore();

    // X Title
    ctx.textAlign = 'center';
    ctx.fillText('FREQUENCY (GHz)', padding.left + plotWidth / 2, height - 10);
    
    // Marker for Carrier
    const carrierBin = (20 + (centerFreq - 4) * 20) / (4000/1024);
    if (carrierBin < displayBins) {
        const cx = padding.left + carrierBin * barWidth;
        ctx.strokeStyle = '#ef4444'; // Red marker
        ctx.beginPath();
        ctx.moveTo(cx, padding.top);
        ctx.lineTo(cx, padding.top + plotHeight);
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.fillText('fc', cx, padding.top - 10);
    }

    // --- CURSOR INTERACTION ---
    if (cursorPos) {
        const cx = cursorPos.x;
        ctx.strokeStyle = '#ffffff';
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, padding.top);
        ctx.lineTo(cx, padding.top + plotHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        const label = `${cursorPos.freq.toFixed(3)} GHz`;
        const labelW = ctx.measureText(label).width + 8;
        const labelH = 16;
        let lx = cx - labelW/2;
        // Clamp label to edges
        if (lx < padding.left) lx = padding.left;
        if (lx + labelW > width - padding.right) lx = width - padding.right - labelW;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lx, padding.top + 10, labelW, labelH);
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx + 4, padding.top + 10 + labelH/2);
    }

  }, [data, centerFreq, cursorPos]);

  return (
    <div className="h-48 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden mt-4">
      <canvas 
        ref={canvasRef} 
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full cursor-crosshair" 
        style={{ width: '100%', height: '100%' }} 
      />
      <div className="absolute top-2 right-2 text-[10px] text-blue-400 font-mono bg-slate-900/80 px-2 py-1 rounded border border-blue-400/20 pointer-events-none">
        SPECTRUM
      </div>
    </div>
  );
};

export default Spectrum;
