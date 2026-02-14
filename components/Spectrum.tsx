
import React, { useRef, useEffect, useState } from 'react';
import { SimulationResult } from '../physics/engine';

interface Props {
  simRef: React.MutableRefObject<SimulationResult | null>;
  centerFreq: number;
}

// Precompute Blackman-Harris Window for FFT Analysis
const WINDOW_SIZE = 1024;
const windowTable = new Float32Array(WINDOW_SIZE);
const a0 = 0.35875, a1 = 0.48829, a2 = 0.14128, a3 = 0.01168;
for (let i = 0; i < WINDOW_SIZE; i++) {
  windowTable[i] = a0 
    - a1 * Math.cos((2 * Math.PI * i) / (WINDOW_SIZE - 1)) 
    + a2 * Math.cos((4 * Math.PI * i) / (WINDOW_SIZE - 1)) 
    - a3 * Math.cos((6 * Math.PI * i) / (WINDOW_SIZE - 1));
}

// FFT Implementation
function computeMagnitudes(signal: Float32Array): Float32Array {
  const n = signal.length;
  // Apply Analysis Window to signal to reduce spectral leakage of the buffer edges
  // (Note: This is the analysis window, distinct from the pulse shaping window)
  const real = new Float32Array(n);
  const imag = new Float32Array(n).fill(0);
  
  for(let i=0; i<n; i++) {
      real[i] = signal[i] * windowTable[i];
  }

  // Bit reversal
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

  // Butterfly
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
    // Normalize magnitude
    mids[i] = Math.sqrt(real[i]*real[i] + imag[i]*imag[i]) / n;
  }
  return mids;
}

const Spectrum: React.FC<Props> = ({ simRef, centerFreq }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number>(0);
  const [cursorPos, setCursorPos] = useState<{x: number, freq: number, db: number} | null>(null);

  // Constants
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const plotWidth = width - padding.left - padding.right;

    if (x >= padding.left && x <= width - padding.right) {
        const relativeX = x - padding.left;
        const pct = relativeX / plotWidth;
        const binIndex = pct * (WINDOW_SIZE / 2);
        const f_vis = binIndex * (4000/WINDOW_SIZE);
        const ghz = 4 + (f_vis - 20) / 20;
        setCursorPos({ x, freq: Math.max(0, ghz), db: 0 }); // dB updated in render loop if needed, but simple hover is enough
    } else {
        setCursorPos(null);
    }
  };

  useEffect(() => {
    const render = () => {
        const canvas = canvasRef.current;
        const sim = simRef.current;
        if (!canvas || !sim) {
            animationIdRef.current = requestAnimationFrame(render);
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
             canvas.width = rect.width * dpr;
             canvas.height = rect.height * dpr;
             ctx.scale(dpr, dpr);
        }

        const width = rect.width;
        const height = rect.height;
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        // Clear
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, width, height);

        // Compute FFT
        const mags = computeMagnitudes(sim.noisyBuffer);
        const numBins = mags.length; // 512

        // Create Gradient
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
        gradient.addColorStop(0, '#f472b6'); // Pink at top (High power)
        gradient.addColorStop(1, '#3b82f6'); // Blue at bottom (Noise floor)

        // Draw Line Path
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#60a5fa';
        
        // Min/Max dB for plotting
        const minDb = -100;
        const maxDb = 10;
        const dbRange = maxDb - minDb;

        for (let i = 0; i < numBins; i++) {
            const mag = mags[i];
            // Convert to dB. Add epsilon to avoid log(0).
            let db = 20 * Math.log10(mag + 1e-9);
            
            // Scale to canvas
            // y = 0 at maxDb, y = height at minDb
            let yNorm = (db - minDb) / dbRange; 
            yNorm = Math.max(0, Math.min(1, yNorm)); // Clamp
            
            const x = padding.left + (i / numBins) * plotWidth;
            const y = padding.top + plotHeight - (yNorm * plotHeight);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Fill area under curve
        ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight);
        ctx.lineTo(padding.left, padding.top + plotHeight);
        ctx.closePath();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fill();


        // --- Axes & Grid ---
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(padding.left, padding.top, plotWidth, plotHeight);

        // Grid Lines (dB)
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        [0, -20, -40, -60, -80, -100].forEach(db => {
             const yNorm = (db - minDb) / dbRange;
             const y = padding.top + plotHeight - (yNorm * plotHeight);
             
             ctx.beginPath();
             ctx.moveTo(padding.left, y);
             ctx.lineTo(padding.left + plotWidth, y);
             ctx.strokeStyle = '#1e293b';
             ctx.stroke();

             ctx.fillText(`${db} dB`, padding.left - 8, y);
        });

        // X-Axis Labels
        const binToGHz = (i: number) => {
            const f_vis = i * (4000/WINDOW_SIZE);
            return 4 + (f_vis - 20) / 20;
        };

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${Math.max(4, binToGHz(0)).toFixed(1)} GHz`, padding.left, height - padding.bottom + 8);
        ctx.fillText(`${binToGHz(numBins/2).toFixed(1)} GHz`, padding.left + plotWidth/2, height - padding.bottom + 8);
        ctx.fillText(`${binToGHz(numBins).toFixed(1)} GHz`, padding.left + plotWidth, height - padding.bottom + 8);

        // Titles
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 10px monospace';
        ctx.save();
        ctx.translate(15, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('MAGNITUDE (dB)', 0, 0);
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.fillText('FREQUENCY (GHz)', padding.left + plotWidth / 2, height - 10);
        
        // Carrier Marker
        const carrierBin = (20 + (centerFreq - 4) * 20) / (4000/WINDOW_SIZE);
        if (carrierBin < numBins) {
            const cx = padding.left + (carrierBin/numBins) * plotWidth;
            ctx.strokeStyle = '#ef4444';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(cx, padding.top);
            ctx.lineTo(cx, padding.top + plotHeight);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#ef4444';
            ctx.fillText('fc', cx, padding.top - 10);
        }

        animationIdRef.current = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationIdRef.current);
  }, [centerFreq, simRef]);

  return (
    <div className="h-64 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden mt-4">
      <canvas 
        ref={canvasRef} 
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCursorPos(null)}
        className="w-full h-full cursor-crosshair" 
        style={{ width: '100%', height: '100%' }} 
      />
      <div className="absolute top-2 right-2 text-[10px] text-blue-400 font-mono bg-slate-900/80 px-2 py-1 rounded border border-blue-400/20 pointer-events-none">
        SPECTRUM ANALYZER
      </div>
      
       {cursorPos && (
          <div 
             className="absolute bg-slate-800/90 border border-slate-600 px-2 py-1 rounded text-xs text-white pointer-events-none shadow-lg backdrop-blur"
             style={{ 
                 left: Math.min(cursorPos.x + 10, canvasRef.current ? canvasRef.current.clientWidth - 80 : 0), 
                 top: 30 
             }}
          >
             <div className="text-slate-400 text-[10px]">FREQ</div>
             <div className="font-mono">{cursorPos.freq.toFixed(4)} GHz</div>
          </div>
       )}
    </div>
  );
};

export default Spectrum;
