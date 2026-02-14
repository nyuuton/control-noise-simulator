
import React, { useState } from 'react';
import { AppState, ComponentConfig, ComponentType, EnvelopeType, LibraryWindowType } from '../types';
import SystemDiagram from './SystemDiagram';
import ModelsModal from './ModelsModal';

interface Props {
  activeStage: keyof AppState;
  params: AppState;
  estimatedT2: number;
  animationSpeed: number;
  setAnimationSpeed: (s: number) => void;
  onUpdate: (section: keyof AppState, key: string, val: number | string | boolean) => void;
  onUpdateComponents: (section: keyof AppState, components: ComponentConfig[]) => void;
  onSelectStage: (stage: keyof AppState) => void;
  signalPowerdBm?: number;
  effectiveNoiseTemp?: number;
}

const ControlPanel: React.FC<Props> = ({ 
  activeStage, 
  params, 
  estimatedT2, 
  signalPowerdBm,
  effectiveNoiseTemp,
  animationSpeed,
  setAnimationSpeed,
  onUpdate, 
  onUpdateComponents, 
  onSelectStage 
}) => {
  const [showModels, setShowModels] = useState(false);
  const currentParams = params[activeStage];
  
  // PRESETS LOGIC
  const setIdeal = () => {
    onUpdate('awg', 'phaseNoise', 0);
    onUpdate('dac', 'resolution', 16);
    onUpdate('dac', 'sampleJitter', 0);
    onUpdate('mixer', 'loLeakage', 0);
    onUpdate('mixer', 'iqAmpImbalance', 1.0);
    onUpdate('mixer', 'iqPhaseImbalance', 0);
    onUpdate('cable_room', 'temp', 0);
    onUpdate('cable_room', 'noiseType', 'thermal');
    onUpdate('cable_cryo', 'flickerNoise', 0);
  };

  const setTypical = () => {
    onUpdate('awg', 'phaseNoise', 0.005);
    onUpdate('dac', 'resolution', 14);
    onUpdate('dac', 'sampleJitter', 0.01);
    onUpdate('mixer', 'loLeakage', 0.02);
    onUpdate('mixer', 'iqAmpImbalance', 1.02);
    onUpdate('cable_room', 'temp', 300);
    onUpdate('cable_room', 'noiseType', 'thermal');
    onUpdate('cable_room', 'noiseIntensity', 1.0);
    onUpdate('cable_cryo', 'temp', 0.02);
    onUpdate('cable_cryo', 'flickerNoise', 0.5);
    
    const roomComps: ComponentConfig[] = [
       { id: 'att1', type: 'attenuator', value: 3 }
    ];
    onUpdateComponents('cable_room', roomComps);

    const cryoComps: ComponentConfig[] = [
       { id: 'att2', type: 'attenuator', value: 20 },
       { id: 'lp1', type: 'lowpass', value: 8.0 }
    ];
    onUpdateComponents('cable_cryo', cryoComps);
  };

  // Helpers for component management
  const addComponent = (type: ComponentType) => {
    if (!['cable_room', 'cable_cryo'].includes(activeStage)) return;
    const comps = (currentParams as any).components as ComponentConfig[];
    
    let val = 0;
    if (type === 'attenuator') val = 3;
    else if (type === 'amplifier') val = 20;
    else if (type === 'lowpass') val = 8.0; 
    else if (type === 'highpass') val = 4.0;
    else if (type === 'notch') val = 6.0;

    const newComp: ComponentConfig = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      value: val
    };
    onUpdateComponents(activeStage, [...comps, newComp]);
  };

  const removeComponent = (id: string) => {
    if (!['cable_room', 'cable_cryo'].includes(activeStage)) return;
    const comps = (currentParams as any).components as ComponentConfig[];
    onUpdateComponents(activeStage, comps.filter(c => c.id !== id));
  };

  const updateComponentValue = (id: string, val: number) => {
    if (!['cable_room', 'cable_cryo'].includes(activeStage)) return;
    const comps = (currentParams as any).components as ComponentConfig[];
    onUpdateComponents(activeStage, comps.map(c => c.id === id ? { ...c, value: val } : c));
  };

  const updateComponentType = (id: string, type: ComponentType) => {
     if (!['cable_room', 'cable_cryo'].includes(activeStage)) return;
     const comps = (currentParams as any).components as ComponentConfig[];
     let val = 0;
     if (type === 'attenuator') val = 3;
     else if (type === 'amplifier') val = 20;
     else if (type === 'lowpass') val = 8.0;
     else if (type === 'highpass') val = 4.0;
     else if (type === 'notch') val = 6.0;

     onUpdateComponents(activeStage, comps.map(c => c.id === id ? { ...c, type, value: val } : c));
  };

  // --- Specialized Renderers ---

  const renderFilterSelector = (comp: ComponentConfig) => {
    return (
      <select 
        value={comp.type} 
        onChange={(e) => updateComponentType(comp.id, e.target.value as ComponentType)}
        className="bg-slate-700 text-[10px] rounded border-none py-0.5 px-1 text-slate-300 cursor-pointer"
      >
        <option value="attenuator">Attenuator</option>
        <option value="amplifier">Amplifier</option>
        <option value="lowpass">Low Pass</option>
        <option value="highpass">High Pass</option>
        <option value="notch">Notch</option>
      </select>
    );
  };

  const renderSourceControls = () => {
    if (activeStage !== 'source') return null;
    const src = params.source;
    
    // Output calculation
    const actualFreq = params.mixer.loFreq + params.awg.ncoFreq;
    const detuning = actualFreq - src.targetFreq;
    const isMatched = Math.abs(detuning) < 0.001;

    const optimizeLO = () => {
       onUpdate('mixer', 'loFreq', src.targetFreq);
       onUpdate('awg', 'ncoFreq', 0);
    };

    return (
      <div className="space-y-4 mb-4 border-b border-slate-800 pb-4">
        {/* Frequency Planning */}
        <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
           <div className="text-[10px] text-slate-400 font-bold mb-2 uppercase">Frequency Planning</div>
           <div className="space-y-3">
             <div>
               <div className="flex justify-between text-xs mb-1">
                 <span className="text-slate-300">Target Freq</span>
                 <span className="font-mono text-blue-400">{src.targetFreq.toFixed(3)} GHz</span>
               </div>
               <input 
                 type="range" min={4} max={10} step={0.01} value={src.targetFreq}
                 onChange={(e) => onUpdate('source', 'targetFreq', parseFloat(e.target.value))}
                 className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
               />
             </div>
             
             <div className="bg-slate-900 p-2 rounded space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">ACTUAL OUTPUT</span>
                    <span className={`text-xs font-mono font-bold ${isMatched ? 'text-green-400' : 'text-yellow-400'}`}>
                        {actualFreq.toFixed(3)} GHz
                    </span>
                </div>
                <div className="pt-1 flex justify-end">
                    <button onClick={optimizeLO} className="w-full px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded shadow-sm transition-colors">
                    AUTO-SET (LO=Target)
                    </button>
                </div>
             </div>
           </div>
        </div>

        {/* Pulse Shaping - Context Aware */}
        <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
           <div className="text-[10px] text-slate-400 font-bold mb-2 uppercase">Pulse Envelope</div>
           
           <div className="mb-3">
             <label className="text-[10px] text-slate-500 block mb-1">TYPE</label>
             <select 
               value={src.envelopeType}
               onChange={(e) => onUpdate('source', 'envelopeType', e.target.value)}
               className="w-full bg-slate-700 text-xs text-slate-200 rounded p-1.5 border border-slate-600"
             >
               <option value="cw">Continuous Wave (CW)</option>
               <option value="rectangular">Rectangular / Trapezoid</option>
               <option value="gaussian">Gaussian</option>
               <option value="library">Library Window</option>
             </select>
           </div>
           
           {src.envelopeType !== 'cw' && (
             <div className="space-y-3">
               <div>
                 <div className="flex justify-between text-xs mb-1">
                   <span className="text-slate-300">Total Duration</span>
                   <span className="font-mono text-slate-400">{src.pulseWidth} ns</span>
                 </div>
                 <input 
                   type="range" min={5} max={100} step={1} value={src.pulseWidth}
                   onChange={(e) => onUpdate('source', 'pulseWidth', parseFloat(e.target.value))}
                   className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                 />
               </div>
               
               {src.envelopeType === 'rectangular' && (
                <div>
                   <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Edge Smoothing (Rise/Fall)</span>
                     <span className="font-mono text-slate-400">{src.riseTime} ns</span>
                   </div>
                   <input 
                     type="range" min={0} max={src.pulseWidth / 2} step={0.1} value={src.riseTime}
                     onChange={(e) => onUpdate('source', 'riseTime', parseFloat(e.target.value))}
                     className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                   />
                </div>
               )}

               {src.envelopeType === 'gaussian' && (
                <div>
                   <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Sigma (Width)</span>
                     <span className="font-mono text-slate-400">{src.sigma} ns</span>
                   </div>
                   <input 
                     type="range" min={1} max={src.pulseWidth / 3} step={0.5} value={src.sigma}
                     onChange={(e) => onUpdate('source', 'sigma', parseFloat(e.target.value))}
                     className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                   />
                </div>
               )}

               {src.envelopeType === 'library' && (
                 <div>
                   <label className="text-[10px] text-slate-500 block mb-1">WINDOW FUNCTION</label>
                   <select 
                     value={src.libraryWindow}
                     onChange={(e) => onUpdate('source', 'libraryWindow', e.target.value)}
                     className="w-full bg-slate-700 text-xs text-slate-200 rounded p-1 border border-slate-600"
                   >
                     <option value="hanning">Hanning</option>
                     <option value="hamming">Hamming</option>
                     <option value="blackman">Blackman</option>
                   </select>
                 </div>
               )}
             </div>
           )}
        </div>
      </div>
    );
  };

  const renderComponentEditor = () => {
    if (!['cable_room', 'cable_cryo'].includes(activeStage)) return null;
    
    const comps = (currentParams as any).components as ComponentConfig[];

    return (
      <div className="mt-4 border-t border-slate-800 pt-4">
        <label className="text-xs font-bold text-slate-400 mb-2 block uppercase">Chain Components</label>
        
        <div className="space-y-3 mb-4">
          {comps.map((c) => {
            const isFilter = ['lowpass', 'highpass', 'notch'].includes(c.type);
            
            // Range Config
            let min = 0, max = 1, step = 0.1, unit = '';
            if (isFilter) {
              min = 1.0; max = 15.0; step = 0.1; unit = 'GHz';
            } else {
              min = 0; max = 40; step = 0.5; unit = 'dB';
            }
            
            let label = 'Value';
            if (c.type === 'lowpass') label = 'Cutoff';
            if (c.type === 'highpass') label = 'Cutoff';
            if (c.type === 'notch') label = 'Center';
            if (c.type === 'attenuator') label = 'Atten';
            if (c.type === 'amplifier') label = 'Gain';

            return (
              <div key={c.id} className="bg-slate-800 p-2 rounded border border-slate-700">
                <div className="flex justify-between items-center mb-1">
                   {renderFilterSelector(c)}
                   <button onClick={() => removeComponent(c.id)} className="text-slate-500 hover:text-red-400">
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                   </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-500 w-10">{label}</span>
                  <input 
                    type="range" 
                    className="flex-1 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    min={min}
                    max={max}
                    step={step}
                    value={c.value}
                    onChange={(e) => updateComponentValue(c.id, parseFloat(e.target.value))}
                  />
                  <span className="text-[10px] w-12 text-right font-mono text-slate-400">
                    {c.value.toFixed(1)}{unit}
                  </span>
                </div>
              </div>
            );
          })}
          {comps.length === 0 && (
             <div className="text-xs text-slate-600 text-center py-2 italic">No components added</div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
           <button onClick={() => addComponent('attenuator')} className="px-2 py-1 bg-red-900/30 border border-red-800 hover:bg-red-900/50 text-red-200 text-[10px] rounded text-center">+ Atten</button>
           <button onClick={() => addComponent('amplifier')} className="px-2 py-1 bg-green-900/30 border border-green-800 hover:bg-green-900/50 text-green-200 text-[10px] rounded text-center">+ Amp</button>
           <button onClick={() => addComponent('lowpass')} className="px-2 py-1 bg-yellow-900/30 border border-yellow-800 hover:bg-yellow-900/50 text-yellow-200 text-[10px] rounded text-center">+ Filter</button>
        </div>
      </div>
    );
  };

  const renderRoomTempControls = () => {
    if (activeStage !== 'cable_room') return null;
    return (
        <div className="mb-6 space-y-4">
           {/* Extended Temperature Control */}
           <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-400">Temperature (K)</label>
                  <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-1 rounded">
                    {params.cable_room.temp.toFixed(1)} K
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                   <input
                    type="range" min={0} max={350} step={0.1}
                    value={params.cable_room.temp}
                    onChange={(e) => onUpdate('cable_room', 'temp', parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                   />
                </div>
                <div className="flex gap-2 justify-between">
                     {[4, 77, 300].map(t => (
                        <button 
                          key={t}
                          onClick={() => onUpdate('cable_room', 'temp', t)}
                          className="px-2 py-1 text-[9px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-400 font-mono"
                        >
                            {t}K
                        </button>
                     ))}
                </div>
           </div>

           {/* Noise Model Selection */}
           <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                <div className="text-[10px] text-slate-400 font-bold mb-2 uppercase">Noise Model</div>
                <select 
                    value={params.cable_room.noiseType || 'thermal'}
                    onChange={(e) => onUpdate('cable_room', 'noiseType', e.target.value)}
                    className="w-full bg-slate-700 text-xs text-slate-200 rounded p-1.5 border border-slate-600 mb-3"
                >
                    <option value="thermal">Standard Thermal (Gaussian)</option>
                    <option value="interference">Thermal + Interference (EMI)</option>
                </select>

                <div className="flex justify-between mb-1">
                  <label className="text-[10px] text-slate-400">Noise Scale</label>
                  <span className="text-[10px] font-mono text-blue-300">
                     x{(params.cable_room.noiseIntensity ?? 1.0).toFixed(1)}
                  </span>
                </div>
                <input
                    type="range" min={0} max={5} step={0.1}
                    value={params.cable_room.noiseIntensity ?? 1.0}
                    onChange={(e) => onUpdate('cable_room', 'noiseIntensity', parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
           </div>
        </div>
    );
  };

  const renderEngineeringMetrics = () => {
      // Don't show for logic stages
      if (['source', 'awg'].includes(activeStage)) return null;

      return (
        <div className="mb-4 bg-slate-900 border border-slate-700 rounded p-3 grid grid-cols-2 gap-2">
            <div>
                <div className="text-[9px] text-slate-500 font-bold uppercase mb-0.5">Est. Signal Power</div>
                <div className={`font-mono text-sm font-bold ${signalPowerdBm && signalPowerdBm < -50 ? 'text-green-400' : 'text-slate-300'}`}>
                    {signalPowerdBm !== undefined ? signalPowerdBm.toFixed(1) : '--'} <span className="text-[10px] text-slate-500">dBm</span>
                </div>
            </div>
            <div>
                <div className="text-[9px] text-slate-500 font-bold uppercase mb-0.5">Eff. Noise Temp</div>
                 <div className="font-mono text-sm font-bold text-blue-300">
                    {effectiveNoiseTemp !== undefined ? effectiveNoiseTemp.toFixed(3) : '--'} <span className="text-[10px] text-slate-500">K</span>
                </div>
            </div>
        </div>
      );
  };

  const renderQubitT2 = () => {
    if (activeStage !== 'qubit') return null;
    const q = params.qubit;
    return (
      <div className="bg-slate-800/50 p-3 rounded border border-slate-700 mb-4">
        <div className="text-[10px] text-slate-400 font-bold mb-2 uppercase">Coherence Times</div>
        
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
             <span className="text-slate-300">T1 (Relaxation)</span>
             <span className="font-mono text-blue-400">{q.t1_us.toFixed(1)} µs</span>
          </div>
          <input 
             type="range" min={1} max={100} step={0.1} value={q.t1_us}
             onChange={(e) => onUpdate('qubit', 't1_us', parseFloat(e.target.value))}
             className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="flex justify-between items-center bg-slate-900 p-2 rounded">
           <span className="text-xs text-slate-400">Estimated T2*</span>
           <span className={`font-mono font-bold ${estimatedT2 < q.t1_us ? 'text-orange-400' : 'text-green-400'}`}>
             {estimatedT2?.toFixed(2)} µs
           </span>
        </div>
        <div className="text-[9px] text-slate-600 mt-1">
          *Calculated from cascaded noise variance.
        </div>
      </div>
    );
  };

  // Config for sliders (generic fallback)
  const getRanges = (key: string) => {
    switch (key) {
      case 'targetFreq': return { min: 4.0, max: 10.0, step: 0.1, label: 'Target (GHz)' };
      case 'loFreq': return { min: 4.0, max: 10.0, step: 0.1, label: 'LO Freq (GHz)' };
      case 'ncoFreq': return { min: -1.0, max: 1.0, step: 0.01, label: 'NCO Freq (GHz)' };
      
      case 'amp': return { min: 0, max: 2, step: 0.1, label: 'Amplitude (V)' };
      case 'phase': return { min: 0, max: 6.28, step: 0.1, label: 'Phase (Rad)' };
      case 'phaseNoise': return { min: 0, max: 0.1, step: 0.001, label: 'Jitter' };
      case 'resolution': return { min: 1, max: 16, step: 1, label: 'Resolution (Bits)' };
      case 'sampleJitter': return { min: 0, max: 0.2, step: 0.01, label: 'Sample Error' };
      case 'loLeakage': return { min: 0, max: 0.5, step: 0.01, label: 'LO Leakage (V)' };
      case 'iqAmpImbalance': return { min: 0.5, max: 1.5, step: 0.01, label: 'IQ Amp Ratio' };
      
      // Handle generic temp for cryo, but skip room since we have custom renderer
      case 'temp': return { min: 0, max: 1, step: 0.01, label: 'Temperature (K)' };
      
      case 'flickerNoise': return { min: 0, max: 2, step: 0.1, label: '1/f Intensity' };
      case 'coupling': return { min: 0, max: 1, step: 0.01, label: 'Coupling Efficiency' };
      default: return null;
    }
  };

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden relative">
      <ModelsModal isOpen={showModels} onClose={() => setShowModels(false)} />
      
      {/* Utility Bar */}
      <div className="p-2 border-b border-slate-800 bg-slate-950 flex gap-2">
         <button 
           onClick={setIdeal}
           className="flex-1 py-1.5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-yellow-300 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-colors group"
           title="Set Ideal (No Noise)"
         >
           <svg className="w-4 h-4 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
           IDEAL
         </button>
         <button 
           onClick={setTypical}
           className="flex-1 py-1.5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-blue-300 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-colors group"
           title="Set Typical Control System"
         >
            <svg className="w-4 h-4 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
           TYPICAL
         </button>
         <button 
           onClick={() => setShowModels(true)}
           className="flex-1 py-1.5 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-colors group"
           title="View Physics Models"
         >
           <svg className="w-4 h-4 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
           DOCS
         </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col">
        
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-100 mb-1 capitalize">
            {activeStage.replace('cable_', '').replace('_', ' ')} Stage
          </h2>
          <div className="text-xs text-slate-500 font-mono">PARAMETER CONFIGURATION</div>
        </div>

        {/* Engineering Metrics Panel */}
        {renderEngineeringMetrics()}

        {/* Global Animation Speed (Top Control) */}
        <div className="mb-6 bg-slate-800/30 p-3 rounded border border-slate-800">
           <div className="flex justify-between items-center mb-1">
             <span className="text-[10px] font-bold text-slate-400">SIMULATION SPEED</span>
             <span className="text-xs font-mono text-cyan-400">{animationSpeed.toFixed(1)}x</span>
           </div>
           <input 
              type="range" min={0.1} max={5} step={0.1} value={animationSpeed}
              onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
        </div>

        {renderSourceControls()}
        {renderQubitT2()}
        {renderRoomTempControls()}

        {/* Generic Sliders */}
        <div className="space-y-6">
          {Object.entries(currentParams).map(([key, val]) => {
            // Ignore specialized fields
            if (['components', 'targetFreq', 'envelopeType', 'libraryWindow', 'sigma', 'pulseWidth', 't1_us', 'riseTime', 'noiseType', 'noiseIntensity'].includes(key)) return null;
            // Also skip Temp if active stage is Room Temp (handled by custom renderer)
            if (activeStage === 'cable_room' && key === 'temp') return null;

            const conf = getRanges(key);
            if (!conf) return null; // Skip unknown params
            
            return (
              <div key={key}>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-400">{conf.label}</label>
                  <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-1 rounded">
                    {typeof val === 'number' ? val.toFixed(3) : val}
                  </span>
                </div>
                <input
                  type="range"
                  min={conf.min}
                  max={conf.max}
                  step={conf.step}
                  value={val as number}
                  onChange={(e) => onUpdate(activeStage, key, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                />
              </div>
            );
          })}
        </div>

        {renderComponentEditor()}

      </div>

      {/* System Diagram at Bottom */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
         <SystemDiagram activeStage={activeStage} params={params} onSelectStage={onSelectStage} />
      </div>

    </div>
  );
};

export default ControlPanel;
