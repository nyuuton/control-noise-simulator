
# Quantum Control Noise Simulation Models

This document outlines the physical and mathematical models used to simulate the superconducting quantum control stack. The simulation operates in the time domain, calculating voltage signals $V(t)$ sample-by-sample.

## 1. Fundamental Noise Models

### 1.1. Thermal (White) Noise
Thermal noise is modeled as Additive White Gaussian Noise (AWGN). We use the **Box-Muller Transform** to generate normally distributed random numbers.

**Engineering Realism:**
The simulation calculates an **Effective Noise Temperature ($T_{eff}$)**.
When a signal passes through an attenuator (gain $G < 1$) at physical temperature $T_{phys}$, the noise is not just attenuated; the attenuator itself adds noise.
$$ T_{out} = T_{in} \cdot G + T_{phys} (1 - G) $$
This demonstrates why we place heavy attenuation at the 20mK (Cryo) stage: to attenuate the 300K thermal noise from the room while adding minimal noise from the cold attenuator itself.

### 1.2. 1/f (Pink) Noise
Low-frequency flux noise is modeled using the **Paul Kellet method**.
$$ V_{pink}(t) = \sum_{k=0}^{6} b_k(t) $$

---

## 2. Signal Chain Stages

### 2.1. Source & Pulse Shaping
Standard Gaussian or Trapezoidal envelopes modulated by window functions (Hanning, Hamming, Blackman).

### 2.2. IQ Mixer (Upconversion)
Simulates hardware impairments:
$$ V_{RF}(t) = (\gamma I_{nco})\cos(\omega_{LO}t) - Q_{nco}\sin(\omega_{LO}t + \theta) + V_{leakage} $$

### 2.3. Power Calculation (dBm)
The simulator estimates the signal power assuming a $50\Omega$ impedance system.
$$ P_{watts} = \frac{V_{RMS}^2}{50} $$
$$ P_{dBm} = 10 \log_{10}(P_{watts}) + 30 $$
This allows users to see how the "1.0 Amplitude" AWG signal (approx +4 dBm) is attenuated down to the single-photon regime ($\approx -100$ dBm) at the qubit.

---

## 3. Qubit & Coherence Estimation

We estimate the decoherence time $T_2$ using the **Bloch-Redfield** approximation for broadband noise.

**Noise Power:**
Instead of simple voltage subtraction (which creates artifacts due to filter delays), we track the accumulated **variance** ($\sigma^2$) of all noise sources in the chain.

**Dephasing Rate ($\Gamma_{\phi}$):**
For broadband (white) noise, the dephasing rate is proportional to the noise power spectral density at low frequencies, which scales with variance.
$$ \Gamma_{\phi} \propto \sigma_{noise}^2 $$

**Total Decoherence Rate ($\Gamma_2$):**
$$ \Gamma_2 = \frac{1}{2 T_1} + \Gamma_{\phi} $$
$$ T_2^* \approx \frac{1}{\Gamma_2} $$

This ensures that adding attenuation reduces $\sigma^2$ (and thus $\Gamma_\phi$), increasing $T_2$, as observed in real dilution refrigerator setups.
