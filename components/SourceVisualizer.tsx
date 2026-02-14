
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
    
    // Config
    const points = 800; // High resolution for sine
    const padding = 50; 
    const vGap = 20;
    const graphHeight = (h - vGap * 4) / 3;
    
    // Time Window for Visualization: +/- 1.5 * pulseWidth or fixed to 100ns
    const timeWindow = Math.max(100, params.pulseWidth * 1.5);
    const dt = timeWindow / (points - 1);

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    const drawPlot = (data: number[] | Float32Array, yOffset: number, color: string, label: string, subLabel: string, showZero: boolean = true) => {
        const bottomY = yOffset + graphHeight;
        const midY = yOffset + graphHeight/2;
        
        // Axis Lines
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, bottomY);
        ctx.lineTo(w - 20, bottomY); 
        ctx.moveTo(padding, yOffset);
        ctx.lineTo(padding, bottomY); 
        ctx.stroke();

        if (showZero) {
            ctx.strokeStyle = '#1e293b';
            ctx.beginPath();
            ctx.moveTo(padding, midY);
            ctx.lineTo(w-20, midY);
            ctx.stroke();
        }

        // Data Path
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for(let i=0; i<points; i++) {
            const x = padding + (i / (points-1)) * (w - padding - 20);
            const val = data[i]; 
            // Scale -1 to 1 => 0 to height if showZero, else 0 to 1 => 0 to height
            let y;
            if (showZero) {
               y = midY - (val * graphHeight * 0.5 * 0.9);
            } else {
               y = bottomY - (val * graphHeight * 0.9);
            }
            
            if(i===0) ctx.moveTo(x,y);
            else ctx.lineTo(x,y);
        }
        ctx.stroke();

        // Label
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(label, padding - 10, yOffset + graphHeight/2 - 5);
        
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.fillText(subLabel, padding - 10, yOffset + graphHeight/2 + 8);
    };

    // Generate Data
    const rawShape = new Float32Array(points);
    const windowShape = new Float32Array(points);
    const finalShape = new Float32Array(points);

    // Visual Frequency scaling: 
    // Real 6GHz is too fast to see 600 cycles in 600 pixels.
    // We map 4-10GHz to a visual range of roughly 20-80 cycles per window to show "sine-ness".
    // Or we just draw the actual carrier math. Let's draw actual math.
    // To prevent aliasing on canvas with 6GHz, we might need more points, but let's just do accurate math.
    // NOTE: 6GHz period is 0.16ns. 100ns window = 600 cycles. Canvas 600px width = 1 pixel per cycle. Alias city.
    // We must slow it down visually to communicate the concept, as per "user can understand intuitively".
    // Let's map targetFreq to a "Visual Carrier" that looks high frequency but readable.
    // Say, 20 + (targetFreq - 4) * 10 Hz visual frequency relative to timeWindow 1.0
    
    // Actually, let's use the engine's Viz mapping logic but scaled for this time window.
    // Engine uses: loFreqViz = 20 + (freq - 4) * 20;
    const vizFreq = 20 + (params.targetFreq - 4) * 20; 

    for(let i=0; i<points; i++) {
        // t_norm from -0.5 to 0.5
        const t_norm = (i / (points - 1)) - 0.5; 
        const t_abs = t_norm * timeWindow; // centered at 0

        // 1. BASE: Carrier Sine Wave
        // Amplitude vs Time
        rawShape[i] = Math.cos(2 * Math.PI * vizFreq * t_norm);

        // 2. WINDOW: Envelope Shape (Square/Trapezoid/Gaussian)
        // defined by pulseWidth and riseTime
        let env = 0;
        const halfWidth = params.pulseWidth / 2;
        
        if (params.waveformShape === 'gaussian') {
            const sigma = params.pulseWidth / 6; 
            env = Math.exp(-(t_abs * t_abs) / (2 * sigma * sigma));
        } else if (params.waveformShape === 'square') {
             // Trapezoidal / Flat Top
             // Width defined as full width at half max or total width?
             // Let's assume params.pulseWidth is the total base width approx.
             // Actually engine assumes PulseWidth is the main duration.
             
             // Logic:
             // Flat region: [-halfWidth + rise, halfWidth - rise]
             // Rise region: [-halfWidth, -halfWidth + rise]
             // Fall region: [halfWidth - rise, halfWidth]
             
             const rise = params.riseTime;
             const flatHalf = halfWidth - rise;
             
             if (Math.abs(t_abs) <= flatHalf) {
                 env = 1.0;
             } else if (Math.abs(t_abs) <= halfWidth) {
                 // In ramp
                 if (rise > 0) {
                    const distFromEdge = halfWidth - Math.abs(t_abs);
                    // Cosine ramp (Hanning-like edge)
                    // 0 at dist=0, 1 at dist=rise
                    const phase = (distFromEdge / rise) * Math.PI; // 0 to PI
                    // We want 0 to 1. 
                    // cos(PI) = -1, cos(0) = 1. 
                    // 0.5 * (1 - cos(x)) -> 0 at 0, 1 at PI.
                    // We need 0 at edge (dist=0) -> phase=0.
                    // dist=rise -> phase=PI.
                    // Value = 0.5 * (1 - Math.cos(phase))
                    env = 0.5 * (1 - Math.cos((distFromEdge / rise) * Math.PI));
                 } else {
                     env = 1.0; // Should be covered by flatHalf, but strictly ideal square
                 }
             } else {
                 env = 0.0;
             }
        } else if (params.waveformShape === 'sine') {
             env = 1.0; 
        }

        // Apply extra window function if any
        let win = 1.0;
        // Map t_norm (-0.5 to 0.5) to 0..1 for windowing
        // But window applies to the PULSE, not the infinite time.
        // Assuming window applies over the defined pulseWidth.
        if (params.windowFunction !== 'none' && Math.abs(t_abs) <= halfWidth) {
             const w_t = (t_abs + halfWidth) / params.pulseWidth; // 0 to 1
             if (params.windowFunction === 'hanning') {
                win = 0.5 - 0.5 * Math.cos(2 * Math.PI * w_t);
             } else if (params.windowFunction === 'hamming') {
                win = 0.54 - 0.46 * Math.cos(2 * Math.PI * w_t);
             } else if (params.windowFunction === 'blackman') {
                win = 0.42 - 0.5 * Math.cos(2 * Math.PI * w_t) + 0.08 * Math.cos(4 * Math.PI * w_t);
             }
             env *= win;
        }

        windowShape[i] = env;

        // 3. RESULT
        finalShape[i] = rawShape[i] * env;
    }

    drawPlot(rawShape, vGap, '#60a5fa', 'CARRIER', `${params.targetFreq.toFixed(2)} GHz`, true);
    drawPlot(windowShape, vGap + graphHeight + vGap, '#f59e0b', 'ENVELOPE', 'Pulse Shape', false);
    drawPlot(finalShape, vGap + (graphHeight + vGap)*2, '#22c55e', 'OUTPUT', 'Modulated Pulse', true);

    // Time Axis Labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0 ns', w/2, h - 5);
    ctx.fillText(`-${(timeWindow/2).toFixed(0)}ns`, padding, h - 5);
    ctx.fillText(`+${(timeWindow/2).toFixed(0)}ns`, w - 20, h - 5);

  }, [params]);

  return (
    <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 relative overflow-hidden flex flex-col items-center justify-center p-4">
       <div className="absolute top-2 left-4 text-xs font-bold text-slate-500 tracking-widest">SOURCE GENERATION</div>
       <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default SourceVisualizer;
