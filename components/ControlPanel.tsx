
import React, { useState } from 'react';
import { AppState, ComponentConfig, ComponentType, WaveformShape, WindowFunction } from '../types';
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
}

const ControlPanel: React.FC<Props> = ({ 
  activeStage, 
  params, 
  estimatedT2, 
  animationSpeed,
  setAnimationSpeed,
  onUpdate, 
  onUpdateComponents, 
  onSelectStage 
}) => {
  const [showModels, setShowModels] = useState(false);
  const currentParams = params[activeStage];
  
  // Helpers for component management
  const addComponent = (type: ComponentType) => {
    if (!['cable_room', 'cable_cryo'].includes(activeStage)) return;
    const comps = (currentParams as any).components as ComponentConfig[];
    const newComp: ComponentConfig = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      value: type.includes('pass') || type === 'notch' ? 0.5 : type === 'attenuator' ? 3 : 20
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
     onUpdateComponents(activeStage, comps.map(c => c.id === id ? { ...c, type } : c));
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
    
    // Calculate Output Frequency
    const actualFreq = params.mixer.loFreq + params.awg.ncoFreq;
    const detuning = actualFreq - src.targetFreq;
    const isMatched = Math.abs(detuning) < 0.001;

    const optimizeLO = () => {
       // Set LO to Target, NCO to 0 (Simple default optimization)
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
               <div className="flex justify-between text-[10px] text-slate-500 px-1">
                 <span>4G</span>
                 <span>7G</span>
                 <span>10G</span>
               </div>
             </div>
             
             <div className="bg-slate-900 p-2 rounded space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">ACTUAL OUTPUT</span>
                    <span className={`text-xs font-mono font-bold ${isMatched ? 'text-green-400' : 'text-yellow-400'}`}>
                        {actualFreq.toFixed(3)} GHz
                    </span>
                </div>
                
                {!isMatched && (
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">OFFSET (NCO)</span>
                        <span className="text-[10px] font-mono text-red-300">
                            {detuning > 0 ? '+' : ''}{detuning.toFixed(3)} GHz
                        </span>
                    </div>
                )}
                
                <div className="pt-1 flex justify-end">
                    <button 
                    onClick={optimizeLO}
                    className="w-full px-2 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded shadow-sm transition-colors"
                    >
                    AUTO-SET (LO=Target, NCO=0)
                    </button>
                </div>
             </div>
           </div>
        </div>

        {/* Pulse Shaping */}
        <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
           <div className="text-[10px] text-slate-400 font-bold mb-2 uppercase">Source Waveform</div>
           <div className="grid grid-cols-2 gap-2 mb-3">
             <div>
               <label className="text-[10px] text-slate-500 block mb-1">SHAPE</label>
               <select 
                 value={src.waveformShape}
                 onChange={(e) => onUpdate('source', 'waveformShape', e.target.value)}
                 className="w-full bg-slate-700 text-xs text-slate-200 rounded p-1 border border-slate-600"
               >
                 <option value="sine">Sine (CW)</option>
                 <option value="gaussian">Gaussian</option>
                 <option value="square">Square/Flat</option>
               </select>
             </div>
             <div>
               <label className="text-[10px] text-slate-500 block mb-1">WINDOW</label>
               <select 
                 value={src.windowFunction}
                 onChange={(e) => onUpdate('source', 'windowFunction', e.target.value)}
                 className="w-full bg-slate-700 text-xs text-slate-200 rounded p-1 border border-slate-600"
               >
                 <option value="none">None</option>
                 <option value="hanning">Hanning</option>
                 <option value="hamming">Hamming</option>
                 <option value="blackman">Blackman</option>
               </select>
             </div>
           </div>
           
           {src.waveformShape !== 'sine' && (
             <div className="space-y-3">
               <div>
                 <div className="flex justify-between text-xs mb-1">
                   <span className="text-slate-300">Total Width</span>
                   <span className="font-mono text-slate-400">{src.pulseWidth} ns</span>
                 </div>
                 <input 
                   type="range" min={10} max={200} step={1} value={src.pulseWidth}
                   onChange={(e) => onUpdate('source', 'pulseWidth', parseFloat(e.target.value))}
                   className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                 />
               </div>

               {src.waveformShape === 'square' && (
                <div>
                   <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-300">Ramp Time (Rise/Fall)</span>
                     <span className="font-mono text-slate-400">{src.riseTime} ns</span>
                   </div>
                   <input 
                     type="range" min={0} max={src.pulseWidth / 2} step={0.5} value={src.riseTime}
                     onChange={(e) => onUpdate('source', 'riseTime', parseFloat(e.target.value))}
                     className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                   />
                   <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                      <span>Flat Top: {(src.pulseWidth - 2 * src.riseTime).toFixed(1)} ns</span>
                   </div>
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
          {comps.map((c) => (
            <div key={c.id} className="bg-slate-800 p-2 rounded border border-slate-700">
              <div className="flex justify-between items-center mb-1">
                 {renderFilterSelector(c)}
                 <button onClick={() => removeComponent(c.id)} className="text-slate-500 hover:text-red-400">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                 </button>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  className="flex-1 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  min={c.type.includes('pass') || c.type === 'notch' ? 0.01 : 0}
                  max={c.type === 'attenuator' ? 40 : c.type === 'amplifier' ? 40 : 1}
                  step={c.type.includes('pass') || c.type === 'notch' ? 0.01 : 1}
                  value={c.value}
                  onChange={(e) => updateComponentValue(c.id, parseFloat(e.target.value))}
                />
                <span className="text-[10px] w-12 text-right font-mono text-slate-400">
                  {c.value.toFixed(1)}{c.type.includes('pass') || c.type === 'notch' ? '' : 'dB'}
                </span>
              </div>
            </div>
          ))}
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
          *Calculated based on T1 and cumulative system noise.
        </div>
      </div>
    );
  };

  // Config for sliders
  const getRanges = (key: string) => {
    switch (key) {
      case 'targetFreq': return { min: 4.0, max: 10.0, step: 0.1, label: 'Target (GHz)' };
      case 'loFreq': return { min: 4.0, max: 10.0, step: 0.1, label: 'LO Freq (GHz)' };
      case 'ncoFreq': return { min: -1.0, max: 1.0, step: 0.01, label: 'NCO Freq (GHz)' };
      
      case 'amp': return { min: 0, max: 2, step: 0.1, label: 'Amplitude (V)' };
      case 'phase': return { min: 0, max: 6.28, step: 0.1, label: 'Phase (Rad)' };
      case 'phaseNoise': return { min: 0, max: 0.1, step: 0.001, label: 'Jitter' };
      case 'resolution': return { min: 1, max: 16, step: 1, label: 'Resolution (Bits)' };
      case 'loLeakage': return { min: 0, max: 0.5, step: 0.01, label: 'LO Leakage (V)' };
      case 'iqAmpImbalance': return { min: 0.5, max: 1.5, step: 0.01, label: 'IQ Amp Ratio' };
      case 'temp': return { min: 0, max: 350, step: 0.1, label: 'Temperature (K)' };
      case 'flickerNoise': return { min: 0, max: 2, step: 0.1, label: '1/f Intensity' };
      case 'coupling': return { min: 0, max: 1, step: 0.01, label: 'Coupling Efficiency' };
      case 'riseTime': return { min: 0, max: 50, step: 1, label: 'Ramp Time (ns)' };
      default: return null;
    }
  };

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden relative">
      <ModelsModal isOpen={showModels} onClose={() => setShowModels(false)} />
      
      {/* Utility Bar */}
      <div className="p-2 border-b border-slate-800 flex justify-center bg-slate-950">
        <button 
          onClick={() => setShowModels(true)}
          className="w-full py-1.5 rounded bg-blue-900/30 border border-blue-800 text-blue-300 text-[10px] font-bold uppercase hover:bg-blue-900/50 transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          View Physics Models
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

        {/* Generic Sliders */}
        <div className="space-y-6">
          {Object.entries(currentParams).map(([key, val]) => {
            // Ignore specialized fields
            if (['components', 'targetFreq', 'waveformShape', 'windowFunction', 'pulseWidth', 't1_us', 'riseTime'].includes(key)) return null;
            
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
