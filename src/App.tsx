import React, { useEffect, useMemo, useRef, useState } from "react";

// Modern drum machine with Melodics-inspired UI
// No external libraries. Drop into any React environment and it runs.

export default function App() {
  // --------- State ---------
  const [bpm, setBpm] = useState(120);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const stepsPerBeat = 4; // sixteenth notes
  const totalSteps = beatsPerBar * stepsPerBeat;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const instruments = useMemo(
    () => [
      { id: "kick", name: "Kick", color: "#FF6B6B", icon: "🥁" },
      { id: "snare", name: "Snare", color: "#4ECDC4", icon: "🥁" },
      { id: "hihat_c", name: "Hi-hat", color: "#45B7D1", icon: "🥁" },
      { id: "hihat_o", name: "Open Hat", color: "#96CEB4", icon: "🥁" },
      { id: "crash", name: "Crash", color: "#FFEAA7", icon: "🥁" },
      { id: "ride_bow", name: "Ride", color: "#DDA0DD", icon: "🥁" },
      { id: "ride_edge", name: "Ride Edge", color: "#98D8C8", icon: "🥁" },
      { id: "tom_hi", name: "High Tom", color: "#F7DC6F", icon: "🥁" },
      { id: "tom_mid", name: "Mid Tom", color: "#BB8FCE", icon: "🥁" },
      { id: "tom_low", name: "Low Tom", color: "#85C1E9", icon: "🥁" },
    ],
    []
  );

  // pattern[row][col] = boolean
  const [pattern, setPattern] = useState(() => loadPattern(instruments, totalSteps));

  useEffect(() => {
    // whenever grid size changes, adjust stored pattern
    setPattern((prev) => resizePattern(prev, instruments.length, totalSteps));
  }, [instruments.length, totalSteps]);

  useEffect(() => {
    savePattern(pattern);
  }, [pattern]);

  // --------- Audio ---------
  const audioRef = useRef<AudioContext | null>(null);

  function getCtx() {
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioRef.current;
  }

  function playStep(stepIndex: number) {
    const ctx = getCtx();
    const now = ctx.currentTime;

    // If a closed hat is hit, we "choke" the open hat by stopping its tail a bit earlier
    let chokeOpenHat = false;

    instruments.forEach((inst, r) => {
      if (!pattern[r]?.[stepIndex]) return;
      switch (inst.id) {
        case "kick":
          synthKick(ctx, now);
          break;
        case "snare":
          synthSnare(ctx, now);
          break;
        case "hihat_c":
          synthHiHat(ctx, now, 0.03, 8000);
          chokeOpenHat = true;
          break;
        case "hihat_o":
          synthHiHat(ctx, now, chokeOpenHat ? 0.12 : 0.25, 9000);
          break;
        case "crash":
          synthCymbal(ctx, now, 1.8, 7000);
          break;
        case "ride_bow":
          synthCymbal(ctx, now, 0.6, 5000);
          break;
        case "ride_edge":
          synthCymbal(ctx, now, 0.9, 5500);
          break;
        case "tom_hi":
          synthTom(ctx, now, 230);
          break;
        case "tom_mid":
          synthTom(ctx, now, 180);
          break;
        case "tom_low":
          synthTom(ctx, now, 140);
          break;
      }
    });
  }

  // --------- Transport ---------
  const timerRef = useRef<number | null>(null);

  function start() {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    if (timerRef.current) window.clearInterval(timerRef.current);
    const stepMs = (60_000 / bpm) / stepsPerBeat;
    let step = -1;
    timerRef.current = window.setInterval(() => {
      step = (step + 1) % totalSteps;
      setCurrentStep(step);
      playStep(step);
    }, stepMs);
    setIsPlaying(true);
  }

  function stop() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setIsPlaying(false);
    setCurrentStep(-1);
  }

  // Real-time updates for tempo and time signature changes
  useEffect(() => {
    if (isPlaying && timerRef.current) {
      const stepMs = (60_000 / bpm) / stepsPerBeat;
      // Clear the old interval and restart with new timing
      window.clearInterval(timerRef.current);
      let step = currentStep;
      timerRef.current = window.setInterval(() => {
        step = (step + 1) % totalSteps;
        setCurrentStep(step);
        playStep(step);
      }, stepMs);
    }
  }, [bpm, stepsPerBeat, totalSteps]);

  // cleanup
  useEffect(() => () => stop(), []);

  // --------- UI helpers ---------
  function toggleCell(r: number, c: number) {
    setPattern((prev) => {
      const copy = prev.map((row) => row.slice());
      copy[r][c] = !copy[r][c];
      // tiny nicety: if you click closed hat, clear open hat at same step
      const instId = instruments[r].id;
      if (instId === "hihat_c") {
        const openRow = instruments.findIndex((x) => x.id === "hihat_o");
        if (openRow >= 0) copy[openRow][c] = false;
      }
      if (instId === "hihat_o") {
        const closedRow = instruments.findIndex((x) => x.id === "hihat_c");
        if (closedRow >= 0 && copy[r][c]) copy[closedRow][c] = false;
      }
      return copy;
    });
  }

  function clearAll() {
    setPattern(makeEmpty(instruments.length, totalSteps));
  }

  // --------- Render ---------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4 antialiased">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Drum Machine
          </h1>
          <p className="text-slate-300 text-sm">Create your own beats</p>
        </div>

        {/* Controls */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex flex-wrap items-center justify-center gap-8">
            {/* Tempo Control */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <label className="block text-sm font-medium text-slate-300 mb-2">Tempo</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={60}
                    max={180}
                    value={bpm}
                    onChange={(e) => setBpm(parseInt(e.target.value))}
                    className="w-32 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider real-time-control"
                  />
                  <span className="text-2xl font-bold text-white w-16 text-center">{bpm}</span>
                  <span className="text-sm text-slate-400">BPM</span>
                </div>
              </div>
            </div>

            {/* Time Signature */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <label className="block text-sm font-medium text-slate-300 mb-2">Time Signature</label>
                <select
                  className="bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2 text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 real-time-control"
                  value={beatsPerBar}
                  onChange={(e) => setBeatsPerBar(parseInt(e.target.value))}
                >
                  {[2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}/4
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-3">
              {!isPlaying ? (
                <button
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-bold text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                  onClick={start}
                >
                  ▶ Play
                </button>
              ) : (
                <button
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white font-bold text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                  onClick={stop}
                >
                  ⏸ Stop
                </button>
              )}
              <button
                className="px-6 py-3 rounded-2xl bg-slate-700/50 hover:bg-slate-600/50 text-white font-medium border border-slate-600 hover:border-slate-500 transition-all duration-200"
                onClick={clearAll}
              >
                🗑 Clear
              </button>
            </div>
          </div>
        </div>

        {/* Drum Grid */}
        <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10 shadow-2xl">
          <div className="grid-container">
            <div className="grid gap-2" style={{ gridTemplateColumns: `200px repeat(${totalSteps}, 1fr)` }}>
              {/* Header row with beat numbers */}
              <div className="h-12 flex items-center justify-center">
                <div className="text-slate-400 font-medium">Drums</div>
              </div>
              {Array.from({ length: totalSteps }).map((_, c) => {
                const isBeat = c % stepsPerBeat === 0;
                const beatNumber = Math.floor(c / stepsPerBeat) + 1;
                return (
                  <div key={c} className={`h-12 flex items-center justify-center ${isBeat ? 'bg-purple-500/20 rounded-lg' : ''}`}>
                    {isBeat && (
                      <div className="text-lg font-bold text-purple-300">{beatNumber}</div>
                    )}
                  </div>
                );
              })}

              {/* Drum rows */}
              {instruments.map((inst, r) => (
                <React.Fragment key={inst.id}>
                  {/* Instrument label */}
                  <div className="h-16 flex items-center gap-3 p-3 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    <div className="text-2xl">{inst.icon}</div>
                    <div>
                      <div className="font-medium text-white">{inst.name}</div>
                      <div className="text-xs text-slate-400">Drum</div>
                    </div>
                  </div>
                  
                  {/* Grid cells */}
                  {Array.from({ length: totalSteps }).map((_, c) => {
                    const active = pattern[r]?.[c];
                    const isBeat = c % stepsPerBeat === 0;
                    const isNow = c === currentStep;
                    return (
                      <button
                        key={c}
                        onClick={() => toggleCell(r, c)}
                        className={`
                          drum-pad h-16 w-full rounded-xl border-2 transition-all duration-200
                          ${active 
                            ? `bg-gradient-to-br ${inst.color} shadow-lg shadow-${inst.color}/50 border-${inst.color}` 
                            : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50'
                          }
                          ${isNow ? 'ring-4 ring-yellow-400 ring-opacity-50 animate-pulse' : ''}
                          ${isBeat ? 'border-purple-500/30' : 'border-slate-600'}
                        `}
                        style={{
                          '--tw-gradient-from': active ? inst.color : undefined,
                          '--tw-gradient-to': active ? `${inst.color}dd` : undefined,
                        } as React.CSSProperties}
                        title={`${inst.name} at step ${c + 1}`}
                      >
                        {active && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-3 h-3 bg-white rounded-full opacity-80"></div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-center">
          <p className="text-slate-400 text-sm">
            💡 Click on the grid to add or remove drum hits. Each column represents a sixteenth note.
          </p>
        </div>
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(45deg, #a855f7, #ec4899);
          cursor: pointer;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: linear-gradient(45deg, #a855f7, #ec4899);
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
        }

        /* Grid container without scrollbars */
        .grid-container {
          overflow: hidden;
          position: relative;
        }
        .grid-container > div {
          overflow: visible;
        }

        /* Prevent layout shifts from hover effects */
        .drum-pad {
          transform: scale(1);
          transition: all 0.2s ease;
          will-change: transform;
          backface-visibility: hidden;
        }
        .drum-pad:hover {
          transform: scale(1.01);
        }

        /* Real-time control indicators */
        .real-time-control:focus {
          box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.3);
        }
        .real-time-control:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}

// --------- Pattern helpers ---------
function makeEmpty(rows: number, cols: number) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
}

function resizePattern(prev: boolean[][], rows: number, cols: number) {
  const next = makeEmpty(rows, cols);
  for (let r = 0; r < Math.min(rows, prev.length); r++) {
    for (let c = 0; c < Math.min(cols, prev[r].length); c++) {
      next[r][c] = prev[r][c];
    }
  }
  return next;
}

function savePattern(p: boolean[][]) {
  try {
    localStorage.setItem("drumMachine_v1", JSON.stringify(p));
  } catch {}
}

function loadPattern(instruments: { id: string }[], cols: number) {
  try {
    const raw = localStorage.getItem("drumMachine_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      return resizePattern(parsed, instruments.length, cols);
    }
  } catch {}
  return makeEmpty(instruments.length, cols);
}

// --------- Acoustic drum synth engines ---------
function synthKick(ctx: AudioContext, when: number) {
  // More realistic kick with multiple oscillators and better envelope
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  
  // Main kick frequency with pitch envelope
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(80, when);
  osc1.frequency.exponentialRampToValueAtTime(40, when + 0.08);
  
  // Second oscillator for body
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(60, when);
  osc2.frequency.exponentialRampToValueAtTime(30, when + 0.1);
  
  // Low-pass filter for warmth
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(200, when);
  filter.frequency.exponentialRampToValueAtTime(50, when + 0.15);
  
  // Volume envelope
  gain.gain.setValueAtTime(0.8, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
  
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain).connect(ctx.destination);
  
  osc1.start(when);
  osc2.start(when);
  osc1.stop(when + 0.3);
  osc2.stop(when + 0.3);
}

function synthSnare(ctx: AudioContext, when: number) {
  // More acoustic snare with shell resonance and wire buzz
  const noise = whiteNoise(ctx);
  const noiseFilter = ctx.createBiquadFilter();
  const noiseGain = ctx.createGain();
  
  // Shell resonance (wooden shell)
  const shellOsc = ctx.createOscillator();
  const shellGain = ctx.createGain();
  shellOsc.type = "triangle";
  shellOsc.frequency.setValueAtTime(180, when);
  shellOsc.frequency.exponentialRampToValueAtTime(120, when + 0.15);
  
  // Wire buzz (snare wires)
  const wireOsc = ctx.createOscillator();
  const wireGain = ctx.createGain();
  wireOsc.type = "sawtooth";
  wireOsc.frequency.setValueAtTime(800, when);
  wireOsc.frequency.exponentialRampToValueAtTime(400, when + 0.2);
  
  // Noise processing for head
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(2000, when);
  noiseFilter.Q.setValueAtTime(2, when);
  noiseGain.gain.setValueAtTime(0.4, when);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
  
  // Shell envelope
  shellGain.gain.setValueAtTime(0.3, when);
  shellGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
  
  // Wire envelope
  wireGain.gain.setValueAtTime(0.2, when);
  wireGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
  
  noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
  shellOsc.connect(shellGain).connect(ctx.destination);
  wireOsc.connect(wireGain).connect(ctx.destination);
  
  noise.start(when);
  shellOsc.start(when);
  wireOsc.start(when);
  noise.stop(when + 0.31);
  shellOsc.stop(when + 0.26);
  wireOsc.stop(when + 0.21);
}

function synthHiHat(ctx: AudioContext, when: number, decay = 0.08, cutoff = 12000) {
  // More realistic hi-hat with multiple noise layers
  const noise1 = whiteNoise(ctx);
  const noise2 = whiteNoise(ctx);
  const hp1 = ctx.createBiquadFilter();
  const hp2 = ctx.createBiquadFilter();
  const gain1 = ctx.createGain();
  const gain2 = ctx.createGain();
  
  // High frequency content
  hp1.type = "highpass";
  hp1.frequency.value = cutoff;
  gain1.gain.setValueAtTime(0.25, when);
  gain1.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  
  // Lower frequency content for body
  hp2.type = "highpass";
  hp2.frequency.value = cutoff * 0.6;
  gain2.gain.setValueAtTime(0.15, when);
  gain2.gain.exponentialRampToValueAtTime(0.0001, when + decay * 1.5);
  
  noise1.connect(hp1).connect(gain1).connect(ctx.destination);
  noise2.connect(hp2).connect(gain2).connect(ctx.destination);
  
  noise1.start(when);
  noise2.start(when);
  noise1.stop(when + decay + 0.01);
  noise2.stop(when + decay * 1.5 + 0.01);
}

function synthCymbal(ctx: AudioContext, when: number, decay = 2.0, cutoff = 8000) {
  // More realistic cymbal with multiple harmonics
  const noise1 = whiteNoise(ctx);
  const noise2 = whiteNoise(ctx);
  const noise3 = whiteNoise(ctx);
  const hp1 = ctx.createBiquadFilter();
  const hp2 = ctx.createBiquadFilter();
  const hp3 = ctx.createBiquadFilter();
  const gain1 = ctx.createGain();
  const gain2 = ctx.createGain();
  const gain3 = ctx.createGain();
  
  // High frequencies
  hp1.type = "highpass";
  hp1.frequency.value = cutoff;
  gain1.gain.setValueAtTime(0.2, when);
  gain1.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  
  // Mid frequencies
  hp2.type = "highpass";
  hp2.frequency.value = cutoff * 0.7;
  gain2.gain.setValueAtTime(0.15, when);
  gain2.gain.exponentialRampToValueAtTime(0.0001, when + decay * 0.8);
  
  // Low frequencies for body
  hp3.type = "highpass";
  hp3.frequency.value = cutoff * 0.4;
  gain3.gain.setValueAtTime(0.1, when);
  gain3.gain.exponentialRampToValueAtTime(0.0001, when + decay * 0.6);
  
  noise1.connect(hp1).connect(gain1).connect(ctx.destination);
  noise2.connect(hp2).connect(gain2).connect(ctx.destination);
  noise3.connect(hp3).connect(gain3).connect(ctx.destination);
  
  noise1.start(when);
  noise2.start(when);
  noise3.start(when);
  noise1.stop(when + decay + 0.05);
  noise2.stop(when + decay * 0.8 + 0.05);
  noise3.stop(when + decay * 0.6 + 0.05);
}

function synthTom(ctx: AudioContext, when: number, freq: number) {
  // More realistic tom with shell resonance and head tension
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  
  // Main tom frequency
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(freq, when);
  osc1.frequency.exponentialRampToValueAtTime(freq * 0.7, when + 0.2);
  
  // Shell resonance (harmonic)
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(freq * 1.5, when);
  osc2.frequency.exponentialRampToValueAtTime(freq * 1.2, when + 0.25);
  
  // Low-pass filter for warmth
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(freq * 3, when);
  filter.frequency.exponentialRampToValueAtTime(freq * 1.5, when + 0.3);
  
  // Volume envelope
  gain.gain.setValueAtTime(0.6, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.4);
  
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain).connect(ctx.destination);
  
  osc1.start(when);
  osc2.start(when);
  osc1.stop(when + 0.4);
  osc2.stop(when + 0.4);
}

function whiteNoise(ctx: AudioContext) {
  const bufferSize = ctx.sampleRate * 1.5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  return noise;
}