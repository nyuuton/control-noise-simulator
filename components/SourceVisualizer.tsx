
import React, { useRef, useEffect } from 'react';
import { SourceParams } from '../types';

interface Props {
  params: SourceParams;
}

const SourceVisualizer: React.FC<Props> = ({ params }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const w = rect.width;
    const h = rect.height;
    
    // Layout
    const padding = 40;
    const topGap = 30;
    const plotHeight = (h - topGap - padding * 2) / 2;
    
    // 1. TIME DOMAIN
    const timeY = topGap;
    const freqY = topGap + plotHeight + padding;
    
    // Config
    const points = 512;
    const timeWindow = Math.max(100, params.pulseWidth * 1.5);

    // Arrays
    const timeData = new Float32Array(points);
    const freqData = new Float32Array(points/2);

    // Generate Single Pulse centered in window
    for(let i=0; i<points; i++) {
        const t_norm = (i / (points - 1)) - 0.5; 
        const t_abs = t_norm * timeWindow; 
        
        let env = 0;
        const halfWidth = params.pulseWidth / 2;
        
        if (params.envelopeType === 'cw') {
            env = 1.0;
        } 
        else if (params.envelopeType === 'rectangular') {
             const rise = params.riseTime;
             const flatHalf = halfWidth - rise;
             if (Math.abs(t_abs) <= flatHalf) env = 1.0;
             else if (Math.abs(t_abs) <= halfWidth) {
                 if (rise > 0) {
                    const distFromEdge = halfWidth - Math.abs(t_abs);
                    env = 0.5 * (1 - Math.cos((distFromEdge / rise) * Math.PI));
                 } else env = 1.0;
             }
        } 
        else if (params.envelopeType === 'gaussian') {
             if (Math.abs(t_abs) <= halfWidth) {
                env = Math.exp(-(t_abs * t_abs) / (2 * params.sigma * params.sigma));
             }
        } 
        else if (params.envelopeType === 'library') {
             if (Math.abs(t_abs) <= halfWidth) {
                const w_t = (t_abs + halfWidth) / params.pulseWidth; // 0 to 1
                const type = params.libraryWindow;
                if (type === 'hanning') env = 0.5 - 0.5 * Math.cos(2 * Math.PI * w_t);
                else if (type === 'hamming') env = 0.54 - 0.46 * Math.cos(2 * Math.PI * w_t);
                else if (type === 'blackman') env = 0.42 - 0.5 * Math.cos(2 * Math.PI * w_t) + 0.08 * Math.cos(4 * Math.PI * w_t);
             }
        }
        timeData[i] = env;
    }

    // Compute FFT (Simple O(N^2) DFT for visualization is fine for 512 points, or reuse FFT)
    // Actually, let's do a simple DFT for the envelope spectrum (baseband)
    for (let k = 0; k < points / 2; k++) {
        let real = 0;
        let imag = 0;
        for (let n = 0; n < points; n++) {
            const angle = -2 * Math.PI * k * n / points;
            real += timeData[n] * Math.cos(angle);
            imag += timeData[n] * Math.sin(angle);
        }
        // Mag
        freqData[k] = Math.sqrt(real*real + imag*imag);
    }
    
    // Normalize Freq Data (Log Scale)
    let maxMag = 0;
    for(let k=1; k<points/2; k++) maxMag = Math.max(maxMag, freqData[k]); // Skip DC
    
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    // DRAW TIME DOMAIN
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for(let i=0; i<points; i++) {
        const x = padding + (i/(points-1)) * (w - padding*2);
        const y = timeY + plotHeight - (timeData[i] * plotHeight * 0.9);
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();

    // Time Axes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, timeY, w - padding*2, plotHeight);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText('TIME DOMAIN (Envelope)', padding, timeY - 5);
    ctx.textAlign = 'right';
    ctx.fillText(`${timeWindow.toFixed(0)}ns Window`, w - padding, timeY - 5);

    // DRAW FREQ DOMAIN
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Plot magnitude in dB relative to max
    for(let i=1; i<points/2; i++) { // Skip DC
        const mag = freqData[i];
        const db = 20 * Math.log10(mag / maxMag + 1e-5); // -100dB floor
        const yNorm = (db + 80) / 80; // Map -80dB..0dB to 0..1
        const val = Math.max(0, Math.min(1, yNorm));
        
        const x = padding + ((i-1)/(points/2 - 1)) * (w - padding*2);
        const y = freqY + plotHeight - (val * plotHeight);
        if(i===1) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
    
    // Freq Axes
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, freqY, w - padding*2, plotHeight);
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('FREQUENCY SPECTRUM (Log Mag)', padding, freqY - 5);
    ctx.textAlign = 'right';
    ctx.fillText('Nyquist', w - padding, freqY - 5);
    
    // Labels for Spectrum
    ctx.fillStyle = '#475569';
    ctx.fillText('0dB', padding - 5, freqY + 10);
    ctx.fillText('-40dB', padding - 5, freqY + plotHeight/2);
    ctx.fillText('-80dB', padding - 5, freqY + plotHeight);

  }, [params]);

  return (
    <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden flex flex-col items-center justify-center p-4">
       <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default SourceVisualizer;
