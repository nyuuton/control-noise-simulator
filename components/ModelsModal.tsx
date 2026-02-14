
import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const ModelsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8">
      <div className="bg-slate-900 w-full max-w-3xl h-full max-h-[90vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col relative animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-900 rounded-t-xl shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span className="text-blue-400">ƒ(x)</span> Physics & Math Models
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-1">SIMULATION ENGINE INTERNALS</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 text-slate-300 space-y-8 font-light">
          
          <section>
            <h3 className="text-lg font-bold text-slate-100 mb-3 border-b border-slate-800 pb-2">1. Fundamental Noise Models</h3>
            
            <div className="mb-6">
              <h4 className="text-sm font-bold text-blue-300 mb-2">1.1. Thermal (White) Noise</h4>
              <p className="text-sm leading-relaxed mb-2">
                Modeled as Additive White Gaussian Noise (AWGN) using the <strong className="text-slate-200">Box-Muller Transform</strong>.
              </p>
              <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-xs text-emerald-400 my-2">
                Z₀ = √(-2 ln(u₁)) · cos(2π u₂)
              </div>
              <p className="text-sm leading-relaxed">
                Scaled by temperature: <span className="font-mono text-xs bg-slate-800 px-1 rounded">V(t) = α · √(T_kelvin) · Z₀(t)</span>
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-pink-300 mb-2">1.2. 1/f (Pink) Noise</h4>
              <p className="text-sm leading-relaxed mb-2">
                Generated using the <strong className="text-slate-200">Paul Kellet method</strong>, summing outputs from multiple first-order IIR filters to approximate 1/f spectral density.
              </p>
              <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-xs text-emerald-400 my-2">
                V_pink(t) = Σ b_k(t)  (for k=0..6)
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-100 mb-3 border-b border-slate-800 pb-2">2. Signal Chain Stages</h3>

            <div className="mb-6">
              <h4 className="text-sm font-bold text-slate-200 mb-2">2.1. Source & Pulse Shaping</h4>
              <p className="text-sm leading-relaxed mb-2">
                The envelope <span className="font-mono text-xs">E(t)</span> is generated based on user selection.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li>
                  <span className="text-slate-200 font-semibold">Gaussian:</span> <span className="font-mono text-xs">E(t) = exp(-(t - μ)² / 2σ²)</span>
                </li>
                <li>
                  <span className="text-slate-200 font-semibold">Square/Trapezoid:</span> Uses a cosine ramp (Tukey window style) for rise/fall times.
                </li>
              </ul>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-bold text-slate-200 mb-2">2.4. IQ Mixer (Upconversion)</h4>
              <p className="text-sm leading-relaxed mb-2">
                Simulates hardware impairments including LO leakage and IQ imbalance.
              </p>
              <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-xs text-emerald-400 my-2 overflow-x-auto">
                V_RF(t) = (γ · I_nco)cos(ω_lo t) - Q_nco sin(ω_lo t + θ) + V_leakage
              </div>
              <ul className="grid grid-cols-2 gap-2 text-xs text-slate-400 mt-2">
                <li>γ: Amplitude Imbalance</li>
                <li>θ: Phase Imbalance</li>
              </ul>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-bold text-slate-200 mb-2">2.6. Qubit Decoherence</h4>
              <p className="text-sm leading-relaxed mb-2">
                We estimate the dephasing rate <span className="font-mono text-xs">Γ_φ</span> based on the Noise RMS power compared to the ideal signal.
              </p>
              <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-xs text-emerald-400 my-2">
                Γ₂ = 1/(2·T₁) + Γ_φ
              </div>
            </div>

             <div className="mb-6">
              <h4 className="text-sm font-bold text-slate-200 mb-2">3. Visualization Mapping</h4>
               <p className="text-sm leading-relaxed mb-2">
                To visualize GHz-scale signals on a 60fps canvas, we map real frequencies to a visual domain while preserving relative dynamics.
              </p>
              <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-xs text-emerald-400 my-2">
                f_visual = 20 + (f_GHz - 4.0) × 20
              </div>
            </div>

          </section>

        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-xl flex justify-end">
           <button 
             onClick={onClose}
             className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded transition-colors"
           >
             Close Documentation
           </button>
        </div>
      </div>
    </div>
  );
};

export default ModelsModal;
