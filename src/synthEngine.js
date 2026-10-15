// LocalSynth High-Performance Web Audio Synthesizer Engine
// Polyphonic Dual-Oscillator Virtual Analog Synthesizer + FL Step Sequencer

export class SynthEngine {
  constructor() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Master Output Bus
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 512;

    // Master Delay, Chorus & Distortion Bus
    this.initMasterEffects();

    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    // Active Polyphonic Voices
    this.activeVoices = new Map();

    // Synth Parameters State
    this.params = {
      // Osc 1
      osc1Wave: 'sawtooth',
      osc1Octave: 0,
      osc1Semi: 0,
      osc1Gain: 0.7,

      // Osc 2
      osc2Wave: 'square',
      osc2Octave: -1,
      osc2Semi: 7, // 5th interval
      osc2Detune: 8,
      osc2Gain: 0.5,

      // Sub Osc & Noise
      subGain: 0.4,
      noiseGain: 0.05,

      // Filter (24dB/oct Ladder-style 4-pole approximation)
      filterCutoff: 1800,
      filterResonance: 4.5,
      filterDrive: 1.5,
      filterEnvAmount: 2400,

      // Amp Envelope (ADSR)
      ampAttack: 0.01,
      ampDecay: 0.25,
      ampSustain: 0.6,
      ampRelease: 0.35,

      // Filter Envelope (ADSR)
      filterAttack: 0.02,
      filterDecay: 0.35,
      filterSustain: 0.2,
      filterRelease: 0.4,

      // LFO
      lfoWave: 'sine',
      lfoRate: 3.5,
      lfoToPitch: 0,
      lfoToFilter: 600,

      // Effects
      delayTime: 0.25,
      delayFeedback: 0.35,
      delayMix: 0.25,
      distDrive: 0.0,
      reverbMix: 0.2,

      // Arpeggiator
      arpMode: 'off', // 'off', 'up', 'down', 'updown', 'random'
      arpRate: '1/16',
      arpOctaves: 2
    };

    // Arpeggiator State
    this.arpHeldNotes = [];
    this.arpTimer = null;
    this.arpStep = 0;

    // Global LFO Node
    this.lfo = this.ctx.createOscillator();
    this.lfo.frequency.value = this.params.lfoRate;
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = this.params.lfoToFilter;
    this.lfo.connect(this.lfoGain);
    this.lfo.start();

    // Step Sequencer State (FL Studio style 16-step grid)
    this.bpm = 128;
    this.isPlaying = false;
    this.currentStep = 0;
    this.sequencerTimer = null;
    this.channels = [
      { id: 'synth_lead', name: 'Synth Lead (Osc 1+2)', type: 'synth', note: 'C4', volume: 0.85, mute: false, solo: false, steps: [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,1,0,0] },
      { id: 'acid_bass', name: 'Acid Bass (TB-303)', type: 'bass', note: 'C2', volume: 0.9, mute: false, solo: false, steps: [1,0,1,0, 1,0,1,0, 1,0,1,1, 1,0,1,0] },
      { id: 'drum_kick', name: 'Punch 909 Kick', type: 'drum', sample: 'kick', volume: 1.0, mute: false, solo: false, steps: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0] },
      { id: 'drum_snare', name: 'Studio Snare / Clap', type: 'drum', sample: 'snare', volume: 0.85, mute: false, solo: false, steps: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },
      { id: 'drum_hihat', name: 'Open 909 Hi-Hat', type: 'drum', sample: 'hihat', volume: 0.65, mute: false, solo: false, steps: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0] }
    ];

    // Procedural Drum Sample Buffers
    this.drumBuffers = this.createProceduralDrums();

    // Sound Presets Library
    this.presets = this.createPresetLibrary();
  }

  ensureContext() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  initMasterEffects() {
    // Delay Effect
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.25;
    this.delayFeedbackNode = this.ctx.createGain();
    this.delayFeedbackNode.gain.value = 0.35;
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = 0.25;

    this.delayNode.connect(this.delayFeedbackNode);
    this.delayFeedbackNode.connect(this.delayNode);
    this.delayNode.connect(this.delayGain);
    this.delayGain.connect(this.masterGain);

    // Distortion Waveshaper
    this.distNode = this.ctx.createWaveShaper();
    this.distNode.curve = this.makeDistortionCurve(0);
    this.distNode.oversample = '4x';
  }

  makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      if (k === 0) curve[i] = x;
      else curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  setDistortion(driveAmount) {
    this.params.distDrive = driveAmount;
    this.distNode.curve = this.makeDistortionCurve(driveAmount * 100);
  }

  // Presets Library
  createPresetLibrary() {
    return [
      {
        id: 'init_saw',
        name: 'Classic Dual Saw Lead',
        category: 'Lead',
        params: {
          osc1Wave: 'sawtooth', osc1Octave: 0, osc1Semi: 0, osc1Gain: 0.7,
          osc2Wave: 'sawtooth', osc2Octave: 0, osc2Semi: 0, osc2Detune: 12, osc2Gain: 0.6,
          subGain: 0.3, filterCutoff: 2800, filterResonance: 3.5, filterEnvAmount: 3200,
          ampAttack: 0.01, ampDecay: 0.3, ampSustain: 0.7, ampRelease: 0.25,
          delayTime: 0.25, delayFeedback: 0.4, delayMix: 0.3
        }
      },
      {
        id: 'acid_303',
        name: 'TB-303 Acid Squelch',
        category: 'Bass',
        params: {
          osc1Wave: 'sawtooth', osc1Octave: -1, osc1Semi: 0, osc1Gain: 0.85,
          osc2Wave: 'square', osc2Octave: -1, osc2Semi: 0, osc2Detune: 0, osc2Gain: 0.0,
          subGain: 0.5, filterCutoff: 650, filterResonance: 9.5, filterEnvAmount: 4800,
          ampAttack: 0.01, ampDecay: 0.2, ampSustain: 0.05, ampRelease: 0.15,
          delayTime: 0.3, delayFeedback: 0.45, delayMix: 0.2
        }
      },
      {
        id: 'blade_runner_brass',
        name: 'Blade Runner CS-80 Brass',
        category: 'Synth Brass',
        params: {
          osc1Wave: 'sawtooth', osc1Octave: 0, osc1Semi: 0, osc1Gain: 0.75,
          osc2Wave: 'sawtooth', osc2Octave: 0, osc2Semi: 0, osc2Detune: 18, osc2Gain: 0.75,
          subGain: 0.2, filterCutoff: 1200, filterResonance: 2.0, filterEnvAmount: 3500,
          ampAttack: 0.18, ampDecay: 0.6, ampSustain: 0.85, ampRelease: 0.75,
          delayTime: 0.4, delayFeedback: 0.5, delayMix: 0.4
        }
      },
      {
        id: 'juno_pad',
        name: 'Juno-106 Ambient Pad',
        category: 'Pad',
        params: {
          osc1Wave: 'sawtooth', osc1Octave: 0, osc1Semi: 0, osc1Gain: 0.6,
          osc2Wave: 'square', osc2Octave: 0, osc2Semi: 7, osc2Detune: 15, osc2Gain: 0.5,
          subGain: 0.4, filterCutoff: 950, filterResonance: 1.8, filterEnvAmount: 1800,
          ampAttack: 0.45, ampDecay: 0.8, ampSustain: 0.9, ampRelease: 0.95,
          delayTime: 0.35, delayFeedback: 0.55, delayMix: 0.45
        }
      },
      {
        id: 'fm_pluck',
        name: 'Retro 80s FM Pluck',
        category: 'Pluck',
        params: {
          osc1Wave: 'triangle', osc1Octave: 1, osc1Semi: 0, osc1Gain: 0.8,
          osc2Wave: 'sine', osc2Octave: 2, osc2Semi: 7, osc2Detune: 5, osc2Gain: 0.6,
          subGain: 0.1, filterCutoff: 3800, filterResonance: 4.0, filterEnvAmount: 2200,
          ampAttack: 0.005, ampDecay: 0.18, ampSustain: 0.0, ampRelease: 0.15,
          delayTime: 0.2, delayFeedback: 0.3, delayMix: 0.25
        }
      }
    ];
  }

  loadPreset(presetId) {
    const p = this.presets.find(x => x.id === presetId);
    if (!p) return;
    Object.assign(this.params, p.params);
    if (this.delayNode) {
      this.delayNode.delayTime.value = this.params.delayTime;
      this.delayFeedbackNode.gain.value = this.params.delayFeedback;
      this.delayGain.gain.value = this.params.delayMix;
    }
    return p;
  }

  // Arpeggiator Handling
  startArpeggiator() {
    if (this.arpTimer) clearInterval(this.arpTimer);
    if (this.params.arpMode === 'off') return;

    const rateMap = { '1/8': 30000 / this.bpm, '1/16': 15000 / this.bpm, '1/32': 7500 / this.bpm };
    const stepMs = rateMap[this.params.arpRate] || (15000 / this.bpm);

    this.arpTimer = setInterval(() => {
      if (this.arpHeldNotes.length === 0) return;

      let notes = [...this.arpHeldNotes].sort((a, b) => a - b);
      if (this.params.arpOctaves > 1) {
        const expanded = [];
        for (let oct = 0; oct < this.params.arpOctaves; oct++) {
          notes.forEach(n => expanded.push(n + (oct * 12)));
        }
        notes = expanded;
      }

      let noteToPlay = notes[0];
      if (this.params.arpMode === 'up') {
        noteToPlay = notes[this.arpStep % notes.length];
      } else if (this.params.arpMode === 'down') {
        noteToPlay = notes[(notes.length - 1) - (this.arpStep % notes.length)];
      } else if (this.params.arpMode === 'updown') {
        const cycle = notes.concat([...notes].reverse().slice(1, -1));
        noteToPlay = cycle[this.arpStep % cycle.length];
      } else if (this.params.arpMode === 'random') {
        noteToPlay = notes[Math.floor(Math.random() * notes.length)];
      }

      this.noteOn(noteToPlay, 0.95);
      setTimeout(() => this.noteOff(noteToPlay), stepMs * 0.7);
      this.arpStep++;
    }, stepMs);
  }

  stopArpeggiator() {
    if (this.arpTimer) {
      clearInterval(this.arpTimer);
      this.arpTimer = null;
    }
    this.arpStep = 0;
  }

  noteToFreq(noteStr) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = noteStr.match(/([A-G]#?)([0-8])/);
    if (!match) return 440;
    const note = match[1];
    const octave = parseInt(match[2], 10);
    const semitone = notes.indexOf(note);
    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  midiToFreq(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  // Play Polyphonic Note (Piano keyboard or MIDI)
  noteOn(midiNote, velocity = 1.0) {
    this.ensureContext();
    if (this.activeVoices.has(midiNote)) {
      this.noteOff(midiNote);
    }

    // Add to arpeggiator pool
    if (!this.arpHeldNotes.includes(midiNote)) {
      this.arpHeldNotes.push(midiNote);
      if (this.params.arpMode !== 'off' && !this.arpTimer) {
        this.startArpeggiator();
      }
    }

    if (this.params.arpMode !== 'off') return; // Handled by arpeggiator clock

    const freq = this.midiToFreq(midiNote);
    const now = this.ctx.currentTime;

    // Osc 1
    const osc1 = this.ctx.createOscillator();
    osc1.type = this.params.osc1Wave;
    const osc1Freq = freq * Math.pow(2, this.params.osc1Octave + (this.params.osc1Semi / 12));
    osc1.frequency.setValueAtTime(osc1Freq, now);

    const osc1Gain = this.ctx.createGain();
    osc1Gain.gain.value = this.params.osc1Gain;
    osc1.connect(osc1Gain);

    // Osc 2
    const osc2 = this.ctx.createOscillator();
    osc2.type = this.params.osc2Wave;
    const osc2Freq = freq * Math.pow(2, this.params.osc2Octave + (this.params.osc2Semi / 12));
    osc2.frequency.setValueAtTime(osc2Freq, now);
    osc2.detune.setValueAtTime(this.params.osc2Detune, now);

    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.value = this.params.osc2Gain;
    osc2.connect(osc2Gain);

    // Sub Oscillator (Sine 1 octave down)
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq * 0.5, now);
    const subGain = this.ctx.createGain();
    subGain.gain.value = this.params.subGain;
    subOsc.connect(subGain);

    // 4-Pole Cascade Filter (2 x BiquadFilter in series for 24dB roll-off)
    const filter1 = this.ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.Q.value = this.params.filterResonance;

    const filter2 = this.ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.Q.value = this.params.filterResonance * 0.7;

    // Sum oscillators into filter
    osc1Gain.connect(filter1);
    osc2Gain.connect(filter1);
    subGain.connect(filter1);
    filter1.connect(filter2);

    // Filter Envelope Modulation
    const baseCutoff = Math.max(20, Math.min(20000, this.params.filterCutoff));
    const peakCutoff = Math.max(20, Math.min(20000, baseCutoff + this.params.filterEnvAmount * velocity));
    const susCutoff = Math.max(20, Math.min(20000, baseCutoff + (this.params.filterEnvAmount * this.params.filterSustain * velocity)));

    filter1.frequency.setValueAtTime(baseCutoff, now);
    filter1.frequency.linearRampToValueAtTime(peakCutoff, now + this.params.filterAttack);
    filter1.frequency.exponentialRampToValueAtTime(Math.max(20, susCutoff), now + this.params.filterAttack + this.params.filterDecay);

    filter2.frequency.setValueAtTime(baseCutoff, now);
    filter2.frequency.linearRampToValueAtTime(peakCutoff, now + this.params.filterAttack);
    filter2.frequency.exponentialRampToValueAtTime(Math.max(20, susCutoff), now + this.params.filterAttack + this.params.filterDecay);

    // Route LFO to filter frequency
    this.lfoGain.connect(filter1.frequency);

    // VCA Amp Envelope
    const ampGain = this.ctx.createGain();
    ampGain.gain.setValueAtTime(0, now);
    ampGain.gain.linearRampToValueAtTime(velocity * 0.7, now + this.params.ampAttack);
    ampGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, velocity * 0.7 * this.params.ampSustain), now + this.params.ampAttack + this.params.ampDecay);

    filter2.connect(ampGain);
    ampGain.connect(this.masterGain);
    ampGain.connect(this.delayNode);

    osc1.start(now);
    osc2.start(now);
    subOsc.start(now);

    this.activeVoices.set(midiNote, {
      osc1, osc2, subOsc,
      filter1, filter2,
      ampGain,
      velocity
    });
  }

  noteOff(midiNote) {
    this.arpHeldNotes = this.arpHeldNotes.filter(n => n !== midiNote);
    if (this.arpHeldNotes.length === 0 && this.params.arpMode !== 'off') {
      this.stopArpeggiator();
    }

    const voice = this.activeVoices.get(midiNote);
    if (!voice) return;

    const now = this.ctx.currentTime;
    const releaseTime = Math.max(0.05, this.params.ampRelease);

    voice.ampGain.gain.cancelScheduledValues(now);
    voice.ampGain.gain.setValueAtTime(voice.ampGain.gain.value, now);
    voice.ampGain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

    voice.filter1.frequency.cancelScheduledValues(now);
    voice.filter1.frequency.exponentialRampToValueAtTime(Math.max(20, this.params.filterCutoff), now + this.params.filterRelease);

    setTimeout(() => {
      try {
        voice.osc1.stop();
        voice.osc2.stop();
        voice.subOsc.stop();
        voice.osc1.disconnect();
        voice.osc2.disconnect();
        voice.subOsc.disconnect();
        voice.ampGain.disconnect();
      } catch (e) {}
    }, (releaseTime + 0.1) * 1000);

    this.activeVoices.delete(midiNote);
  }

  // Step Sequencer Playback Engine
  startSequencer(onStepCallback) {
    this.ensureContext();
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentStep = 0;
    const stepDurationMs = (60000 / this.bpm) / 4;

    this.sequencerTimer = setInterval(() => {
      this.triggerStep(this.currentStep);
      if (onStepCallback) onStepCallback(this.currentStep);
      this.currentStep = (this.currentStep + 1) % 16;
    }, stepDurationMs);
  }

  stopSequencer() {
    if (this.sequencerTimer) {
      clearInterval(this.sequencerTimer);
      this.sequencerTimer = null;
    }
    this.isPlaying = false;
    this.currentStep = 0;
  }

  triggerStep(stepIndex) {
    const hasSolo = this.channels.some(c => c.solo);

    this.channels.forEach(ch => {
      if (ch.mute) return;
      if (hasSolo && !ch.solo) return;

      if (ch.steps[stepIndex] === 1) {
        if (ch.type === 'synth') {
          const midi = this.noteToMidi(ch.note);
          this.noteOn(midi, ch.volume || 0.9);
          setTimeout(() => this.noteOff(midi), 120);
        } else if (ch.type === 'bass') {
          const midi = this.noteToMidi(ch.note);
          this.noteOn(midi, ch.volume || 1.0);
          setTimeout(() => this.noteOff(midi), 140);
        } else if (ch.type === 'drum') {
          this.playDrumSample(ch.sample, ch.volume);
        }
      }
    });
  }

  playDrumSample(sampleName, volume = 1.0) {
    const buf = this.drumBuffers[sampleName];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.masterGain);
    src.start();
  }

  noteToMidi(noteStr) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = noteStr.match(/([A-G]#?)([0-8])/);
    if (!match) return 60;
    return (parseInt(match[2], 10) + 1) * 12 + notes.indexOf(match[1]);
  }

  createProceduralDrums() {
    const sr = this.ctx.sampleRate;
    const kickBuf = (() => {
      const len = Math.floor(0.35 * sr);
      const b = this.ctx.createBuffer(1, len, sr);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const f = 45 + 130 * Math.exp(-t * 30);
        const env = Math.exp(-t * 10);
        d[i] = Math.sin(2 * Math.PI * f * t) * env;
      }
      return b;
    })();

    const snareBuf = (() => {
      const len = Math.floor(0.28 * sr);
      const b = this.ctx.createBuffer(1, len, sr);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const tone = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 22) * 0.4;
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 15) * 0.7;
        d[i] = tone + noise;
      }
      return b;
    })();

    const hihatBuf = (() => {
      const len = Math.floor(0.18 * sr);
      const b = this.ctx.createBuffer(1, len, sr);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const metallic = (Math.sin(2 * Math.PI * 8000 * t) + Math.sin(2 * Math.PI * 9800 * t)) * 0.4;
        const noise = (Math.random() * 2 - 1) * 0.6;
        d[i] = (metallic + noise) * Math.exp(-t * 25);
      }
      return b;
    })();

    return { kick: kickBuf, snare: snareBuf, hihat: hihatBuf };
  }
}
