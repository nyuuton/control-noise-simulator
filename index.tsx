
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AppState, ComponentConfig } from './types';
import { simulateFrame, SimulationResult } from './physics/engine';
import Oscilloscope from './components/Oscilloscope';
import Spectrum from './components/Spectrum';
import ControlPanel from './components/ControlPanel';
import SourceVisualizer from './components/SourceVisualizer';

// Initial State
const INITIAL_STATE: AppState = {
  source: {
    targetFreq: 6.2,
    envelopeType: 'rectangular',
    pulseWidth: 50,
    riseTime: 5,     // 5ns ramp
    sigma: 10,       // Default sigma for Gaussian
    libraryWindow: 'hanning'
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
    noiseType: 'thermal',
    noiseIntensity: 1.0,
    components: [
      { id: 'att1', type: 'attenuator', value: 3 }, // Initial 3dB loss
    ] 
  },
  cable_cryo: { 
    temp: 0.02, 
    flickerNoise: 0.5,
    components: [
      { id: 'att2', type: 'attenuator', value: 20 }, // Initial 20dB loss
      { id: 'lp1', type: 'lowpass', value: 8.0 }, // 8 GHz Cutoff
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
  
  // Throttle updates to React state for UI numbers
  const [metrics, setMetrics] = useState({ t2: 0, power: -100, temp: 0 });
  
  // --- REFS FOR PHYSICS ENGINE ---
  // These allow the loop to run without triggering React renders
  const paramsRef = useRef(INITIAL_STATE);
  const activeStageRef = useRef(activeStage);
  const timeRef = useRef(0);
  const simResultRef = useRef<SimulationResult | null>(null);

  // Sync State to Refs
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    activeStageRef.current = activeStage;
  }, [activeStage]);

  // Main Simulation Loop (Runs via requestAnimationFrame)
  useEffect(() => {
    let animationFrameId: number;
    let frameCount = 0;

    const loop = () => {
      // Only advance time and calculate physics if playing
      if (isPlaying) {
        // 1. Advance Physics Time
        timeRef.current += 5 * animationSpeed; 
        
        // 2. Run Physics Engine (Writes to SharedBuffer)
        simResultRef.current = simulateFrame(
            paramsRef.current, 
            timeRef.current, 
            activeStageRef.current
        );

        // 3. Update UI (Throttled)
        // Only update React state for T2/Power every 10 frames to avoid DOM thrashing
        if (frameCount++ % 10 === 0 && simResultRef.current) {
           setMetrics({
               t2: simResultRef.current.estimatedT2,
               power: simResultRef.current.signalPowerdBm,
               temp: simResultRef.current.effectiveNoiseTemp
           });
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, animationSpeed]); 

  // Secondary Effect: Update Simulation when Paused if Parameters Change
  // This ensures the visualizer updates when dragging sliders even if time is stopped.
  useEffect(() => {
    if (!isPlaying) {
      simResultRef.current = simulateFrame(
          params, 
          timeRef.current, 
          activeStage
      );
      if (simResultRef.current) {
           setMetrics({
               t2: simResultRef.current.estimatedT2,
               power: simResultRef.current.signalPowerdBm,
               temp: simResultRef.current.effectiveNoiseTemp
           });
      }
    }
  }, [params, activeStage, isPlaying]);

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
          ) : (
            <>
              {/* Components now consume the REF, not state. No React re-renders for physics! */}
              <Oscilloscope simRef={simResultRef} />
              <Spectrum 
                simRef={simResultRef} 
                centerFreq={params.mixer.loFreq + params.awg.ncoFreq}
              />
            </>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: Controls */}
      <ControlPanel 
        activeStage={activeStage} 
        params={params}
        estimatedT2={metrics.t2} 
        signalPowerdBm={metrics.power}
        effectiveNoiseTemp={metrics.temp}
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
