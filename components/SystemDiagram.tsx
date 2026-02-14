
import React, { useState } from 'react';
import { AppState, ComponentConfig } from '../types';

interface Props {
  activeStage: keyof AppState;
  params: AppState;
  onSelectStage: (stage: keyof AppState) => void;
}

const SystemDiagram: React.FC<Props> = ({ activeStage, params, onSelectStage }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStroke = (id: string) => activeStage === id ? '#3b82f6' : '#334155';
  const getFill = (id: string) => activeStage === id ? '#1e3a8a' : '#0f172a';
  const getText = (id: string) => activeStage === id ? '#bfdbfe' : '#64748b';

  // Helper to draw components inside a cable box
  const renderChain = (components: ComponentConfig[], startX: number, startY: number, width: number) => {
    const count = components.length;
    if (count === 0) return null;
    const step = width / (count + 1);
    
    return components.map((comp, idx) => {
      const cx = startX + step * (idx + 1);
      const cy = startY;
      
      let icon;
      if (comp.type === 'attenuator') {
        icon = <rect x={cx-6} y={cy-3} width={12} height={6} fill="#ef4444" opacity="0.8" pointerEvents="none" />;
      } else if (comp.type === 'amplifier') {
        icon = <polygon points={`${cx-6},${cy-5} ${cx-6},${cy+5} ${cx+6},${cy}`} fill="#22c55e" opacity="0.8" pointerEvents="none" />;
      } else if (comp.type === 'lowpass') {
        icon = <path d={`M${cx-5} ${cy-4} Q${cx} ${cy+4} ${cx+5} ${cy-4}`} fill="none" stroke="#eab308" strokeWidth="2" pointerEvents="none"/>;
      } else if (comp.type === 'highpass') {
         icon = <path d={`M${cx-5} ${cy+4} Q${cx} ${cy-4} ${cx+5} ${cy+4}`} fill="none" stroke="#eab308" strokeWidth="2" pointerEvents="none"/>;
      } else if (comp.type === 'notch') {
         icon = <path d={`M${cx-5} ${cy-4} L${cx} ${cy+4} L${cx+5} ${cy-4}`} fill="none" stroke="#a855f7" strokeWidth="2" pointerEvents="none"/>;
      }

      return (
        <g key={comp.id}>
           {icon}
           <text x={cx} y={cy+10} fontSize="6" textAnchor="middle" fill="#94a3b8" fontFamily="monospace" pointerEvents="none">
             {comp.type === 'lowpass' ? 'LPF' : comp.type === 'highpass' ? 'HPF' : comp.type === 'notch' ? 'NOT' : comp.type.slice(0,3).toUpperCase()}
           </text>
        </g>
      );
    });
  };

  const DiagramContent = () => (
    <svg viewBox="0 0 280 380" className="w-full h-full block" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" fill="#475569">
            <path d="M0,0 L0,6 L6,3 z" />
          </marker>
        </defs>

        <line x1="140" y1="20" x2="140" y2="340" stroke="#1e293b" strokeWidth="2" />

        {/* 0. Source */}
        <g transform="translate(140, 30)" 
           onClick={() => onSelectStage('source')} 
           className="cursor-pointer hover:opacity-80 transition-opacity">
           <path d="M-30,-15 L30,-15 L35,0 L30,15 L-30,15 L-35,0 Z" 
                 fill={getFill('source')} stroke={getStroke('source')} strokeWidth="2" />
           <text x="0" y="4" textAnchor="middle" fill={getText('source')} fontSize="10" fontWeight="bold" fontFamily="monospace">0.SRC</text>
        </g>
        <line x1="140" y1="45" x2="140" y2="70" stroke="#475569" strokeWidth="1" markerEnd="url(#arrow)" />

        {/* 1. AWG */}
        <g transform="translate(140, 85)" 
           onClick={() => onSelectStage('awg')} 
           className="cursor-pointer hover:opacity-80 transition-opacity">
           <rect x="-40" y="-15" width="80" height="30" rx="4" 
                 fill={getFill('awg')} stroke={getStroke('awg')} strokeWidth="2" />
           <text x="-35" y="5" fill={getText('awg')} fontSize="10" fontWeight="bold" fontFamily="monospace">1.AWG</text>
        </g>
        <line x1="140" y1="100" x2="140" y2="125" stroke="#475569" strokeWidth="1" markerEnd="url(#arrow)" />

        {/* 2. DAC */}
        <g transform="translate(140, 140)"
           onClick={() => onSelectStage('dac')}
           className="cursor-pointer hover:opacity-80 transition-opacity">
           <polygon points="0,-15 -30,15 30,15" fill={getFill('dac')} stroke={getStroke('dac')} strokeWidth="2" />
           <text x="0" y="8" textAnchor="middle" fill={getText('dac')} fontSize="10" fontWeight="bold" fontFamily="monospace">2.DAC</text>
        </g>
        <line x1="140" y1="155" x2="140" y2="180" stroke="#475569" strokeWidth="1" markerEnd="url(#arrow)" />

        {/* 3. Mixer */}
        <g transform="translate(140, 195)"
           onClick={() => onSelectStage('mixer')}
           className="cursor-pointer hover:opacity-80 transition-opacity">
           <circle r="18" fill={getFill('mixer')} stroke={getStroke('mixer')} strokeWidth="2" />
           <text x="0" y="4" textAnchor="middle" fill={getText('mixer')} fontSize="10" fontWeight="bold" fontFamily="monospace">3.MX</text>
        </g>
        <line x1="140" y1="213" x2="140" y2="235" stroke="#475569" strokeWidth="1" markerEnd="url(#arrow)" />

        {/* 4. Room Temp Cable */}
        <g transform="translate(140, 250)"
           onClick={() => onSelectStage('cable_room')}
           className="cursor-pointer hover:opacity-80 transition-opacity">
           <rect x="-60" y="-12" width="120" height="24" rx="2" 
                 fill={getFill('cable_room')} stroke={getStroke('cable_room')} strokeWidth="2" />
           <text x="-55" y="-2" fill={getText('cable_room')} fontSize="8" fontWeight="bold" fontFamily="monospace">4.Room</text>
           {renderChain(params.cable_room.components, -50, 0, 100)}
        </g>
        <line x1="140" y1="262" x2="140" y2="288" stroke="#475569" strokeWidth="1" markerEnd="url(#arrow)" />

        {/* 5. Cryo Cable */}
        <g transform="translate(140, 300)"
           onClick={() => onSelectStage('cable_cryo')}
           className="cursor-pointer hover:opacity-80 transition-opacity">
           <rect x="-60" y="-12" width="120" height="24" rx="2" 
                 fill={getFill('cable_cryo')} stroke={getStroke('cable_cryo')} strokeWidth="2" />
           <text x="-55" y="-2" fill={getText('cable_cryo')} fontSize="8" fontWeight="bold" fontFamily="monospace">5.Cryo</text>
           {renderChain(params.cable_cryo.components, -50, 0, 100)}
        </g>
        <line x1="140" y1="312" x2="140" y2="338" stroke="#475569" strokeWidth="1" markerEnd="url(#arrow)" />

        {/* 6. Qubit */}
        <g transform="translate(140, 350)"
           onClick={() => onSelectStage('qubit')}
           className="cursor-pointer hover:opacity-80 transition-opacity">
           <rect x="-25" y="-12" width="50" height="24" rx="4" 
                 fill={getFill('qubit')} stroke={getStroke('qubit')} strokeWidth="2" />
           <text x="0" y="4" textAnchor="middle" fill={getText('qubit')} fontSize="10" fontWeight="bold" fontFamily="monospace">6.Q</text>
        </g>

        {/* Temp Background */}
        <path d="M210 275 L220 275 L220 360 L210 360" fill="none" stroke="#334155" />
        <text x="225" y="285" fill="#334155" fontSize="8" fontFamily="monospace">300K</text>
        <text x="225" y="355" fill="#3b82f6" fontSize="8" fontFamily="monospace">10mK</text>
    </svg>
  );

  return (
    <>
      <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 mb-4 select-none relative group">
        <div className="h-80 w-full">
            <DiagramContent />
        </div>
        <button 
          onClick={() => setIsExpanded(true)}
          className="absolute top-2 right-2 bg-slate-800 p-1.5 rounded hover:bg-slate-700 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Expand Diagram"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
        </button>
      </div>

      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="bg-slate-900 w-full max-w-4xl h-full max-h-[90vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-slate-800 flex-shrink-0">
              <h3 className="text-xl font-bold text-slate-200">System Wiring Diagram</h3>
              <button onClick={() => setIsExpanded(false)} className="text-slate-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 p-8 flex items-center justify-center overflow-hidden">
               <DiagramContent />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SystemDiagram;
