
# Quantum Control Noise Simulation Models

This document outlines the physical and mathematical models used to simulate the superconducting quantum control stack. The simulation operates in the time domain, calculating voltage signals $V(t)$ sample-by-sample.

## 1. Fundamental Noise Models

### 1.1. Thermal (White) Noise
Thermal noise is modeled as Additive White Gaussian Noise (AWGN). We use the **Box-Muller Transform** to generate normally distributed random numbers from uniform distributions.

Given $u_1, u_2 \sim U(0,1)$:
$$ Z_0 = \sqrt{-2 \ln(u_1)} \cos(2\pi u_2) $$

In the simulation, thermal noise voltage is scaled by the square root of temperature:
$$ V_{thermal}(t) = \alpha \sqrt{T_{Kelvin}} \cdot Z_0(t) $$
*(Where $\alpha$ is a scaling constant ensuring realistic relative amplitudes).*

### 1.2. 1/f (Pink) Noise
Low-frequency flux noise is modeled using the **Paul Kellet method**, which sums outputs from multiple first-order IIR filters to approximate a $1/f$ spectral density.
$$ V_{pink}(t) = \sum_{k=0}^{6} b_k(t) $$
Where each $b_k$ represents a specific frequency pole updated recursively.

---

## 2. Signal Chain Stages

### 2.1. Source & Pulse Shaping (Envelope Generation)
The ideal pulse envelope $E(t)$ is generated based on the user's shape selection.

**Gaussian Pulse:**
$$ E(t) = e^{-\frac{(t - \mu)^2}{2\sigma^2}} $$
Where $\sigma = \text{width} / 6$.

**Square / Trapezoidal Pulse (Tukey-like Window):**
The square wave includes configurable rise/fall times, creating a trapezoidal shape. The transition regions use a cosine ramp:
$$ E(t) = \begin{cases} 
1 & \text{if in flat region} \\
0.5 \left(1 - \cos\left(\pi \frac{d}{t_{rise}}\right)\right) & \text{if in ramp region} \\
0 & \text{otherwise}
\end{cases} $$

**Window Functions:**
If applied, standard window functions modulate the envelope:
*   **Hanning:** $w(t) = 0.5 - 0.5 \cos(2\pi t)$
*   **Hamming:** $w(t) = 0.54 - 0.46 \cos(2\pi t)$
*   **Blackman:** $w(t) = 0.42 - 0.5 \cos(2\pi t) + 0.08 \cos(4\pi t)$

---

### 2.2. AWG (Digital Synthesis)
The Arbitrary Waveform Generator creates the Intermediate Frequency (IF) using a Numerically Controlled Oscillator (NCO).

**Phase Noise (Jitter):**
$$ \phi_{jitter}(t) \sim N(0, \sigma_{phase}^2) $$

**NCO Outputs:**
$$ I_{nco}(t) = A \cdot E(t) \cdot \cos(\omega_{nco}t + \phi_0 + \phi_{jitter}) $$
$$ Q_{nco}(t) = A \cdot E(t) \cdot \sin(\omega_{nco}t + \phi_0 + \phi_{jitter}) $$

---

### 2.3. DAC (Quantization)
The continuous signal is discretized into $2^N$ levels based on resolution $N$ (bits).

$$ V_{out} = \frac{\text{round}(V_{in} \cdot 2^N)}{2^N} $$

---

### 2.4. IQ Mixer (Upconversion)
The mixer combines the I and Q signals with the Local Oscillator (LO) to produce the RF signal. This stage includes hardware imperfections.

**Ideal Mixing Equation:**
$$ V_{RF}(t) = I(t)\cos(\omega_{LO}t) - Q(t)\sin(\omega_{LO}t) $$

**With Impairments:**
1.  **LO Leakage:** A constant DC offset voltage leaking through to RF.
2.  **IQ Amplitude Imbalance ($\gamma$):** Scaling difference between I and Q paths.
3.  **IQ Phase Imbalance ($\theta$):** Non-orthogonality in the LO.

$$ V_{RF}(t) = \underbrace{(\gamma I_{nco})\cos(\omega_{LO}t)}_{\text{I-Path}} - \underbrace{Q_{nco}\sin(\omega_{LO}t + \theta)}_{\text{Q-Path}} + V_{leakage} $$

---

### 2.5. Transmission Lines (Filters & Attenuation)
Components in the signal chain (Room Temp & Cryo) are processed serially.

**Attenuation / Amplification:**
Linear gain is calculated from Decibels:
$$ V_{out} = V_{in} \cdot 10^{\frac{dB}{20}} $$

**IIR Filters:**
Frequency responses are approximated using first-order Infinite Impulse Response (IIR) difference equations. Given input $x$ and state $y$:

*   **Low Pass:** $y[n] = y[n-1] + \alpha (x[n] - y[n-1])$
*   **High Pass:** $y[n] = (1-\alpha)(y[n-1] + x[n] - x[n-1])$
*   **Notch (Bandstop):** $y[n] = (1-\alpha)x[n] + \alpha(x[n] - \text{avg}(x))$

---

### 2.6. Qubit & Coherence Estimation
The final signal reaches the qubit chip. We compare the **Noisy Signal** ($S_{noisy}$) against the **Ideal Reference** ($S_{ideal}$) to estimate decoherence rates.

**Noise Power:**
$$ P_{noise} = \frac{1}{N} \sum (S_{noisy}(t) - S_{ideal}(t))^2 $$
$$ V_{RMS} = \sqrt{P_{noise}} $$

**Dephasing Rate ($\Gamma_{\phi}$):**
Modeled as proportional to the RMS noise voltage affecting the qubit drive line.
$$ \Gamma_{\phi} \propto V_{RMS} $$

**Total Decoherence Rate ($\Gamma_2$):**
$$ \Gamma_2 = \frac{1}{2 T_1} + \Gamma_{\phi} $$
$$ T_2^* \approx \frac{1}{\Gamma_2} $$

---

## 3. Visualization Mapping
To visualize GHz-scale signals on a browser canvas running at 60fps (sampled at ~4kHz in simulation), we map frequencies to a visual domain:

$$ f_{visual} = 20 + (f_{real\_GHz} - 4.0) \times 20 $$

This linear mapping ensures that 6.0 GHz and 6.2 GHz appear visually distinct in the time-domain graphs while keeping the mathematical relationships (beat frequencies, envelopes) accurate relative to the simulation window.
