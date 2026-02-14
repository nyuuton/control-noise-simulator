
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AppState, ComponentConfig } from './types';
import { simulateFrame } from './physics/engine';
import Oscilloscope from './components/Oscilloscope';
import Spectrum from './components/Spectrum';
import ControlPanel from './components/ControlPanel';
import SourceVisualizer from './components/SourceVisualizer';

// Initial State
const INITIAL_STATE: AppState = {
  source: {
    targetFreq: 6.2,
    waveformShape: 'square', // Default to square to show ramps better
    windowFunction: 'none',
    pulseWidth: 50,
    riseTime: 5, // 5ns ramp
  },
  awg: { 
    ncoFreq: 0.2, 
    amp: 1.0, 
    phase: 0.0, 
    phaseNoise: 0.005 
  },
  dac: { resolution: 12, sampleJitter: 0.01 },
  mixer: { 
    loFreq: 6.0, 
    loLeakage: 0.02, 
    iqAmpImbalance: 1.0, 
    iqPhaseImbalance: 0.0 
  },
  cable_room: { 
    temp: 300, 
    components: [
      { id: 'att1', type: 'attenuator', value: 3 }, // Initial 3dB loss
    ] 
  },
  cable_cryo: { 
    temp: 0.02, 
    flickerNoise: 0.5,
    components: [
      { id: 'att2', type: 'attenuator', value: 20 }, // Initial 20dB loss
      { id: 'lp1', type: 'lowpass', value: 0.8 },
    ]
  },
  qubit: { 
    coupling: 0.9, 
    t1_us: 30.0,
  },
};

const STAGES = [
  { id: 'source', label: '0. Source', desc: 'Pulse & Planning' },
  { id: 'awg', label: '1. AWG / NCO', desc: 'Digital Synthesis' },
  { id: 'dac', label: '2. DAC', desc: 'Quantization & Sampling' },
  { id: 'mixer', label: '3. Mixer & Balun', desc: 'Upconversion (IQ)' },
  { id: 'cable_room', label: '4. Room Temp Lines', desc: '300K Attenuation' },
  { id: 'cable_cryo', label: '5. Cryo Lines', desc: '10mK & 1/f Noise' },
  { id: 'qubit', label: '6. Qubit Chip', desc: 'Coupling & Control' },
];

const App = () => {
  const [activeStage, setActiveStage] = useState<keyof AppState>('qubit');
  const [params, setParams] = useState<AppState>(INITIAL_STATE);
  const [isPlaying, setIsPlaying] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(1.0);
  const [estimatedT2, setEstimatedT2] = useState<number>(0);
  
  // Real-time buffers
  const [simData, setSimData] = useState<{
    noisy: Float32Array, 
    ideal: Float32Array,
    maxAmp: number
  } | null>(null);

  // Animation Loop
  const timeRef = useRef(0);

  // Main Simulation Loop
  useEffect(() => {
    let animationFrameId: number;

    const runSimulation = () => {
      // Only advance time if playing
      if (isPlaying) {
        timeRef.current += 5 * animationSpeed; 
      }
      
      const result = simulateFrame(params, timeRef.current, activeStage);
      setSimData({
        noisy: result.noisyBuffer,
        ideal: result.idealBuffer,
        maxAmp: result.maxAmplitude
      });
      
      // Update T2 Estimate if qubit (decoupled from params to avoid infinite loops)
      if (activeStage === 'qubit') {
         setEstimatedT2(result.estimatedT2);
      }
    };

    if (isPlaying) {
      const loop = () => {
        runSimulation();
        animationFrameId = requestAnimationFrame(loop);
      };
      loop();
    } else {
      // If paused, run once to update view with new params/stage, then stop.
      runSimulation();
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [params, activeStage, isPlaying, animationSpeed]);

  const updateParam = (section: keyof AppState, key: string, val: number | string | boolean) => {
    setParams(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: val
      }
    }));
  };

  const updateComponents = (section: keyof AppState, components: ComponentConfig[]) => {
    setParams(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        components
      }
    }));
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
      
      {/* LEFT SIDEBAR: Pipeline */}
      <div className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col z-20">
        <div className="p-4 border-b border-slate-800 bg-slate-950">
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Q-Noise Sim
          </h1>
          <p className="text-[10px] text-slate-500 mt-1">Superconducting Noise Model</p>
        </div>
        
        <div className="flex-1 p-2 space-y-1 overflow-y-auto relative">
           {/* Connecting Line */}
           <div className="absolute left-[29px] top-4 bottom-4 w-px bg-slate-800 z-0"></div>

           {STAGES.map((s) => {
             const active = activeStage === s.id;
             return (
               <button
                 key={s.id}
                 onClick={() => setActiveStage(s.id as keyof AppState)}
                 className={`relative z-10 w-full text-left p-3 rounded-lg border transition-all duration-200 group
                   ${active 
                     ? 'bg-slate-800 border-blue-500/50 shadow-lg shadow-blue-500/5' 
                     : 'bg-slate-900 border-transparent hover:bg-slate-800/50'}`}
               >
                 <div className="flex items-center gap-3">
                   <div className={`w-3 h-3 rounded-full border-2 transition-colors
                     ${active ? 'bg-blue-500 border-blue-500' : 'bg-slate-900 border-slate-600 group-hover:border-slate-500'}`}>
                   </div>
                   <div>
                     <div className={`text-sm font-semibold ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                       {s.label}
                     </div>
                     <div className="text-[10px] text-slate-600 font-mono mt-0.5 uppercase tracking-tight">
                       {s.desc}
                     </div>
                   </div>
                 </div>
               </button>
             );
           })}
        </div>
      </div>

      {/* CENTER: Visualization */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
        <header className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-start pointer-events-none">
          <div className="pointer-events-auto">
             <div className="text-xs text-slate-500 font-mono mb-1">MEASUREMENT POINT</div>
             <div className="text-xl font-bold text-slate-200">
               {STAGES.find(s => s.id === activeStage)?.label}
             </div>
          </div>
          <div className="flex items-center gap-3 pointer-events-auto">
            {activeStage !== 'source' && (
              <>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`px-3 py-1 rounded border text-[10px] font-mono font-bold uppercase transition-all
                    ${isPlaying 
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white' 
                      : 'bg-green-500/10 border-green-500/50 text-green-400 hover:bg-green-500/20'
                    }`}
                >
                  {isPlaying ? 'Stop' : 'Resume'}
                </button>
                <div className={`bg-slate-900/80 backdrop-blur px-3 py-1 rounded border border-slate-800 text-[10px] font-mono transition-colors
                  ${isPlaying ? 'text-green-400 animate-pulse' : 'text-yellow-500'}`}>
                  {isPlaying ? 'LIVE' : 'PAUSED'}
                </div>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 p-6 flex flex-col pt-20 gap-4">
          {activeStage === 'source' ? (
             <SourceVisualizer params={params.source} />
          ) : simData ? (
            <>
              <Oscilloscope 
                data={simData.noisy} 
                idealData={simData.ideal} 
                maxAmp={simData.maxAmp} 
              />
              <Spectrum 
                data={simData.noisy} 
                centerFreq={params.mixer.loFreq + params.awg.ncoFreq}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600 font-mono animate-pulse">
              Initializing Physics Engine...
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: Controls */}
      <ControlPanel 
        activeStage={activeStage} 
        params={params}
        estimatedT2={estimatedT2}
        animationSpeed={animationSpeed}
        setAnimationSpeed={setAnimationSpeed}
        onUpdate={updateParam}
        onUpdateComponents={updateComponents}
        onSelectStage={setActiveStage}
      />
      
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
