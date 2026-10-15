// LocalSynth High-Performance Web Audio Synthesizer Engine
// Polyphonic Dual-Oscillator Virtual Analog Synthesizer + FL Step Sequencer & Song Playlist

export class SynthEngine {
  constructor() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Master Output Bus & Destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 512;

    // Master Delay, Chorus, Reverb & Distortion Bus
    this.initMasterEffects();

    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    // Audio Recording Stream & Destination
    this.mediaStreamDest = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.mediaStreamDest);
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;

    // Active Polyphonic Voices
    this.activeVoices = new Map();

    // Synth Parameters State
    this.params = {
      osc1Wave: 'sawtooth',
      osc1Octave: 0,
      osc1Semi: 0,
      osc1Gain: 0.7,

      osc2Wave: 'square',
      osc2Octave: -1,
      osc2Semi: 7,
      osc2Detune: 8,
      osc2Gain: 0.5,

      subGain: 0.4,
      noiseGain: 0.05,

      filterCutoff: 1800,
      filterResonance: 4.5,
      filterDrive: 1.5,
      filterEnvAmount: 2400,

      ampAttack: 0.01,
      ampDecay: 0.25,
      ampSustain: 0.6,
      ampRelease: 0.35,

      filterAttack: 0.02,
      filterDecay: 0.35,
      filterSustain: 0.2,
      filterRelease: 0.4,

      lfoWave: 'sine',
      lfoRate: 3.5,
      lfoToPitch: 0,
      lfoToFilter: 600,

      delayTime: 0.25,
      delayFeedback: 0.35,
      delayMix: 0.25,
      distDrive: 0.0,
      reverbMix: 0.25,
      chorusMix: 0.3,

      arpMode: 'off',
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

    // Playback Mode: 'PAT' (Pattern loop) or 'SONG' (Playlist Timeline)
    this.playMode = 'PAT';
    this.bpm = 128;
    this.isPlaying = false;
    this.currentStep = 0;
    this.currentSongBar = 0;
    this.sequencerTimer = null;

    // Procedural Drum Sample Buffers
    this.drumBuffers = this.createProceduralDrums();

    // Multi-Pattern Architecture (FL Studio Channel Racks)
    this.activePatternId = 'pat_1';
    this.patterns = [
      {
        id: 'pat_1',
        name: 'Pattern 1: Intro Groove',
        color: '#f97316',
        channels: this.createDefaultChannels([
          [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,1,0,0], // Synth Lead
          [1,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,0,0], // Acid Bass
          [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], // 909 Kick
          [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], // Snare
          [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], // HiHat
          [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // 808 Sub
          [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], // Clap
          [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]  // Crash
        ])
      },
      {
        id: 'pat_2',
        name: 'Pattern 2: Acid Drop & 808',
        color: '#06b6d4',
        channels: this.createDefaultChannels([
          [0,0,1,0, 0,1,0,0, 1,0,0,1, 0,0,1,0], // Synth Lead
          [1,0,1,0, 1,0,1,0, 1,0,1,1, 1,0,1,0], // Acid Bass (Fast 303)
          [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], // 909 Kick
          [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], // Snare
          [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], // HiHat Roll
          [1,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0], // 808 Sub Bass
          [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], // Clap
          [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]  // Crash
        ])
      },
      {
        id: 'pat_3',
        name: 'Pattern 3: Ambient Melodic Build',
        color: '#a855f7',
        channels: this.createDefaultChannels([
          [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0], // Synth Lead
          [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // Acid Bass (Muted)
          [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // Kick (Muted)
          [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // Snare
          [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], // HiHat
          [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // 808
          [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // Clap
          [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]  // Crash
        ])
      }
    ];

    // FL Studio Playlist Timeline Grid (16 Bars across 4 Playlist Tracks)
    this.totalBars = 16;
    this.playlistTracks = [
      { id: 'track_1', name: 'Track 1 (Drums & Beat)', bars: ['pat_1', 'pat_1', 'pat_1', 'pat_1', 'pat_2', 'pat_2', 'pat_2', 'pat_2', 'pat_3', 'pat_3', 'pat_2', 'pat_2', 'pat_2', 'pat_2', 'pat_1', 'pat_1'] },
      { id: 'track_2', name: 'Track 2 (Acid Bassline)', bars: [null, null, 'pat_1', 'pat_1', 'pat_2', 'pat_2', 'pat_2', 'pat_2', null, null, 'pat_2', 'pat_2', 'pat_2', 'pat_2', 'pat_1', null] },
      { id: 'track_3', name: 'Track 3 (Synth Lead Melody)', bars: [null, null, null, null, 'pat_2', 'pat_2', 'pat_2', 'pat_2', 'pat_3', 'pat_3', 'pat_2', 'pat_2', null, null, null, null] },
      { id: 'track_4', name: 'Track 4 (Drops & FX)', bars: ['pat_1', null, null, null, 'pat_2', null, null, null, null, null, 'pat_2', null, null, null, null, null] }
    ];

    // Sound Presets Library & User Patches
    this.presets = this.createPresetLibrary();
    this.loadUserPatches();
  }

  createDefaultChannels(stepGrids) {
    const defaultLeadPitches = ['C4','D#4','F4','G4','A#4','C5','D#4','F4','G4','C4','D#4','F4','G4','A#4','C4','C4'];
    const defaultBassPitches = ['C2','C2','D#2','F2','G2','C2','A#1','C2','C2','D#2','F2','G2','A#2','C2','C2','C2'];

    return [
      { id: 'synth_lead', name: 'Synth Lead (Osc 1+2)', type: 'synth', note: 'C4', stepNotes: [...defaultLeadPitches], volume: 0.85, mute: false, solo: false, steps: stepGrids[0] || new Array(16).fill(0) },
      { id: 'acid_bass', name: 'Acid Bass (TB-303)', type: 'bass', note: 'C2', stepNotes: [...defaultBassPitches], volume: 0.95, mute: false, solo: false, steps: stepGrids[1] || new Array(16).fill(0) },
      { id: 'drum_kick', name: 'Punch 909 Kick', type: 'drum', sample: 'kick', volume: 1.0, mute: false, solo: false, steps: stepGrids[2] || new Array(16).fill(0) },
      { id: 'drum_snare', name: 'Studio Snare / Rim', type: 'drum', sample: 'snare', volume: 0.85, mute: false, solo: false, steps: stepGrids[3] || new Array(16).fill(0) },
      { id: 'drum_hihat', name: 'Open 909 Hi-Hat', type: 'drum', sample: 'hihat', volume: 0.65, mute: false, solo: false, steps: stepGrids[4] || new Array(16).fill(0) },
      { id: 'drum_808', name: 'Boom 808 Sub-Bass', type: 'drum', sample: 'sub808', volume: 0.9, mute: false, solo: false, steps: stepGrids[5] || new Array(16).fill(0) },
      { id: 'drum_clap', name: 'Analog Handclap', type: 'drum', sample: 'clap', volume: 0.8, mute: false, solo: false, steps: stepGrids[6] || new Array(16).fill(0) },
      { id: 'drum_crash', name: 'Cymbal Crash / Splash', type: 'drum', sample: 'crash', volume: 0.7, mute: false, solo: false, steps: stepGrids[7] || new Array(16).fill(0) }
    ];
  }

  getActivePattern() {
    return this.patterns.find(p => p.id === this.activePatternId) || this.patterns[0];
  }

  ensureContext() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  initMasterEffects() {
    // 1. Stereo Ping-Pong / Sync Delay
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

    // 2. Convolution / Algorithmic Hall Reverb
    this.reverbConvolver = this.ctx.createConvolver();
    this.reverbConvolver.buffer = this.createImpulseResponse(2.4, 2.0);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.25;

    this.reverbConvolver.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);

    // 3. Stereo Juno-Style Analog Chorus
    this.chorusDelay = this.ctx.createDelay(0.1);
    this.chorusDelay.delayTime.value = 0.025;
    this.chorusLfo = this.ctx.createOscillator();
    this.chorusLfo.frequency.value = 1.2;
    this.chorusLfoGain = this.ctx.createGain();
    this.chorusLfoGain.gain.value = 0.003;
    this.chorusLfo.connect(this.chorusLfoGain);
    this.chorusLfoGain.connect(this.chorusDelay.delayTime);
    this.chorusLfo.start();

    this.chorusGain = this.ctx.createGain();
    this.chorusGain.gain.value = 0.3;
    this.chorusDelay.connect(this.chorusGain);
    this.chorusGain.connect(this.masterGain);

    // 4. Overdrive & Distortion Waveshaper
    this.distNode = this.ctx.createWaveShaper();
    this.distNode.curve = this.makeDistortionCurve(0);
    this.distNode.oversample = '4x';
  }

  createImpulseResponse(durationSec, decay) {
    const sr = this.ctx.sampleRate;
    const length = Math.floor(sr * durationSec);
    const impulse = this.ctx.createBuffer(2, length, sr);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const env = Math.pow(1 - n, decay);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }
    return impulse;
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
          delayTime: 0.25, delayFeedback: 0.4, delayMix: 0.3, reverbMix: 0.25, chorusMix: 0.2
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
          delayTime: 0.3, delayFeedback: 0.45, delayMix: 0.25, reverbMix: 0.1, chorusMix: 0.0
        }
      },
      {
        id: 'moog_taurus',
        name: 'Moog Taurus Analog Sub',
        category: 'Bass',
        params: {
          osc1Wave: 'sawtooth', osc1Octave: -2, osc1Semi: 0, osc1Gain: 0.9,
          osc2Wave: 'square', osc2Octave: -2, osc2Semi: 0, osc2Detune: 6, osc2Gain: 0.85,
          subGain: 0.8, filterCutoff: 420, filterResonance: 4.8, filterEnvAmount: 1200,
          ampAttack: 0.02, ampDecay: 0.4, ampSustain: 0.8, ampRelease: 0.3,
          delayTime: 0.2, delayFeedback: 0.1, delayMix: 0.05, reverbMix: 0.1, chorusMix: 0.0
        }
      },
      {
        id: 'stranger_arp',
        name: 'Stranger Things Rolling Synth',
        category: 'Arp',
        params: {
          osc1Wave: 'sawtooth', osc1Octave: 0, osc1Semi: 0, osc1Gain: 0.8,
          osc2Wave: 'square', osc2Octave: 1, osc2Semi: 0, osc2Detune: 9, osc2Gain: 0.7,
          subGain: 0.3, filterCutoff: 1900, filterResonance: 6.2, filterEnvAmount: 3800,
          ampAttack: 0.01, ampDecay: 0.22, ampSustain: 0.3, ampRelease: 0.28,
          delayTime: 0.375, delayFeedback: 0.5, delayMix: 0.4, reverbMix: 0.45, chorusMix: 0.35
        }
      },
      {
        id: 'cyberpunk_reese',
        name: 'Cyberpunk 2077 Reese Bass',
        category: 'Bass',
        params: {
          osc1Wave: 'sawtooth', osc1Octave: -1, osc1Semi: 0, osc1Gain: 0.85,
          osc2Wave: 'sawtooth', osc2Octave: -1, osc2Semi: 0, osc2Detune: 26, osc2Gain: 0.85,
          subGain: 0.6, filterCutoff: 900, filterResonance: 3.5, filterEnvAmount: 2200,
          ampAttack: 0.04, ampDecay: 0.5, ampSustain: 0.9, ampRelease: 0.4,
          delayTime: 0.2, delayFeedback: 0.2, delayMix: 0.15, reverbMix: 0.15, chorusMix: 0.4
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
          delayTime: 0.4, delayFeedback: 0.5, delayMix: 0.4, reverbMix: 0.55, chorusMix: 0.45
        }
      },
      {
        id: 'daft_funk_lead',
        name: 'Daft Punk 909 Funk Lead',
        category: 'Lead',
        params: {
          osc1Wave: 'square', osc1Octave: 0, osc1Semi: 0, osc1Gain: 0.8,
          osc2Wave: 'sawtooth', osc2Octave: 0, osc2Semi: 7, osc2Detune: 10, osc2Gain: 0.6,
          subGain: 0.1, filterCutoff: 4200, filterResonance: 5.5, filterEnvAmount: 2600,
          ampAttack: 0.005, ampDecay: 0.15, ampSustain: 0.4, ampRelease: 0.12,
          delayTime: 0.25, delayFeedback: 0.35, delayMix: 0.2, reverbMix: 0.2, chorusMix: 0.25
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
          delayTime: 0.35, delayFeedback: 0.55, delayMix: 0.45, reverbMix: 0.65, chorusMix: 0.7
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
          delayTime: 0.2, delayFeedback: 0.3, delayMix: 0.25, reverbMix: 0.3, chorusMix: 0.2
        }
      },
      {
        id: 'glass_chimes',
        name: 'Ambient Glass Shimmer Chimes',
        category: 'Ambient',
        params: {
          osc1Wave: 'sine', osc1Octave: 2, osc1Semi: 0, osc1Gain: 0.7,
          osc2Wave: 'triangle', osc2Octave: 3, osc2Semi: 7, osc2Detune: 14, osc2Gain: 0.6,
          subGain: 0.0, filterCutoff: 6500, filterResonance: 2.5, filterEnvAmount: 1500,
          ampAttack: 0.08, ampDecay: 0.9, ampSustain: 0.5, ampRelease: 1.2,
          delayTime: 0.45, delayFeedback: 0.65, delayMix: 0.55, reverbMix: 0.8, chorusMix: 0.5
        }
      }
    ];
  }

  loadUserPatches() {
    try {
      const saved = localStorage.getItem('localsynth_user_patches');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach(p => {
            if (!this.presets.find(existing => existing.id === p.id)) {
              this.presets.push(p);
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load user patches:', e);
    }
  }

  saveUserPatch(name) {
    const id = 'user_' + Date.now();
    const patch = {
      id,
      name: `User: ${name}`,
      category: 'Custom',
      params: { ...this.params }
    };
    this.presets.push(patch);
    try {
      const userOnly = this.presets.filter(p => p.id.startsWith('user_'));
      localStorage.setItem('localsynth_user_patches', JSON.stringify(userOnly));
    } catch (e) {}
    return patch;
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
    if (this.reverbGain) {
      this.reverbGain.gain.value = this.params.reverbMix;
    }
    if (this.chorusGain) {
      this.chorusGain.gain.value = this.params.chorusMix;
    }
    return p;
  }

  // Audio Recording (Master WAV & Stems)
  startRecording() {
    this.ensureContext();
    this.recordedChunks = [];
    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStreamDest.stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };
      this.mediaRecorder.start(100);
      this.isRecording = true;
    } catch (err) {
      console.error('MediaRecorder error:', err);
    }
  }

  stopRecordingAndDownload(filename = 'LocalSynth_Song.webm') {
    if (!this.mediaRecorder || !this.isRecording) return;
    this.isRecording = false;

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  // Arpeggiator
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

  midiToFreq(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  // Play Polyphonic Note
  noteOn(midiNote, velocity = 1.0) {
    this.ensureContext();
    if (this.activeVoices.has(midiNote)) {
      this.noteOff(midiNote);
    }

    if (!this.arpHeldNotes.includes(midiNote)) {
      this.arpHeldNotes.push(midiNote);
      if (this.params.arpMode !== 'off' && !this.arpTimer) {
        this.startArpeggiator();
      }
    }

    if (this.params.arpMode !== 'off') return;

    const freq = this.midiToFreq(midiNote);
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    osc1.type = this.params.osc1Wave;
    const osc1Freq = freq * Math.pow(2, this.params.osc1Octave + (this.params.osc1Semi / 12));
    osc1.frequency.setValueAtTime(osc1Freq, now);

    const osc1Gain = this.ctx.createGain();
    osc1Gain.gain.value = this.params.osc1Gain;
    osc1.connect(osc1Gain);

    const osc2 = this.ctx.createOscillator();
    osc2.type = this.params.osc2Wave;
    const osc2Freq = freq * Math.pow(2, this.params.osc2Octave + (this.params.osc2Semi / 12));
    osc2.frequency.setValueAtTime(osc2Freq, now);
    osc2.detune.setValueAtTime(this.params.osc2Detune, now);

    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.value = this.params.osc2Gain;
    osc2.connect(osc2Gain);

    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq * 0.5, now);
    const subGain = this.ctx.createGain();
    subGain.gain.value = this.params.subGain;
    subOsc.connect(subGain);

    const filter1 = this.ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.Q.value = this.params.filterResonance;

    const filter2 = this.ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.Q.value = this.params.filterResonance * 0.7;

    osc1Gain.connect(filter1);
    osc2Gain.connect(filter1);
    subGain.connect(filter1);
    filter1.connect(filter2);

    const baseCutoff = Math.max(20, Math.min(20000, this.params.filterCutoff));
    const peakCutoff = Math.max(20, Math.min(20000, baseCutoff + this.params.filterEnvAmount * velocity));
    const susCutoff = Math.max(20, Math.min(20000, baseCutoff + (this.params.filterEnvAmount * this.params.filterSustain * velocity)));

    filter1.frequency.setValueAtTime(baseCutoff, now);
    filter1.frequency.linearRampToValueAtTime(peakCutoff, now + this.params.filterAttack);
    filter1.frequency.exponentialRampToValueAtTime(Math.max(20, susCutoff), now + this.params.filterAttack + this.params.filterDecay);

    filter2.frequency.setValueAtTime(baseCutoff, now);
    filter2.frequency.linearRampToValueAtTime(peakCutoff, now + this.params.filterAttack);
    filter2.frequency.exponentialRampToValueAtTime(Math.max(20, susCutoff), now + this.params.filterAttack + this.params.filterDecay);

    this.lfoGain.connect(filter1.frequency);

    const ampGain = this.ctx.createGain();
    ampGain.gain.setValueAtTime(0, now);
    ampGain.gain.linearRampToValueAtTime(velocity * 0.7, now + this.params.ampAttack);
    ampGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, velocity * 0.7 * this.params.ampSustain), now + this.params.ampAttack + this.params.ampDecay);

    filter2.connect(ampGain);
    ampGain.connect(this.masterGain);
    ampGain.connect(this.delayNode);
    ampGain.connect(this.reverbConvolver);
    ampGain.connect(this.chorusDelay);

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

  // Playback Control: Supports PAT (Pattern Loop) & SONG (16-Bar Playlist)
  startPlayback(onTickCallback) {
    this.ensureContext();
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.currentStep = 0;
    this.currentSongBar = 0;
    const stepDurationMs = (60000 / this.bpm) / 4; // 16th note steps

    this.sequencerTimer = setInterval(() => {
      if (this.playMode === 'PAT') {
        // Pattern Loop Mode
        const pat = this.getActivePattern();
        this.triggerPatternStep(pat, this.currentStep);
        if (onTickCallback) onTickCallback({ mode: 'PAT', step: this.currentStep });
        this.currentStep = (this.currentStep + 1) % 16;
      } else {
        // Song Playlist Mode
        this.triggerSongStep(this.currentSongBar, this.currentStep);
        if (onTickCallback) onTickCallback({ mode: 'SONG', bar: this.currentSongBar, step: this.currentStep });

        this.currentStep++;
        if (this.currentStep >= 16) {
          this.currentStep = 0;
          this.currentSongBar = (this.currentSongBar + 1) % this.totalBars;
        }
      }
    }, stepDurationMs);
  }

  stopPlayback() {
    if (this.sequencerTimer) {
      clearInterval(this.sequencerTimer);
      this.sequencerTimer = null;
    }
    this.isPlaying = false;
    this.currentStep = 0;
    this.currentSongBar = 0;
  }

  triggerPatternStep(pattern, stepIndex) {
    const hasSolo = pattern.channels.some(c => c.solo);

    pattern.channels.forEach(ch => {
      if (ch.mute) return;
      if (hasSolo && !ch.solo) return;

      if (ch.steps[stepIndex] === 1) {
        // Read step-specific note or fallback to channel note
        const noteToPlay = (ch.stepNotes && ch.stepNotes[stepIndex]) ? ch.stepNotes[stepIndex] : ch.note;
        if (ch.type === 'synth') {
          const midi = this.noteToMidi(noteToPlay);
          this.noteOn(midi, ch.volume || 0.9);
          setTimeout(() => this.noteOff(midi), 120);
        } else if (ch.type === 'bass') {
          const midi = this.noteToMidi(noteToPlay);
          this.noteOn(midi, ch.volume || 1.0);
          setTimeout(() => this.noteOff(midi), 140);
        } else if (ch.type === 'drum') {
          this.playDrumSample(ch.sample, ch.volume);
        }
      }
    });
  }

  // Song Mode Trigger: Evaluates active patterns placed on each Playlist Track for the current bar
  triggerSongStep(barIndex, stepIndex) {
    const activePatternIdsAtBar = new Set();
    this.playlistTracks.forEach(track => {
      const patId = track.bars[barIndex];
      if (patId) activePatternIdsAtBar.add(patId);
    });

    activePatternIdsAtBar.forEach(patId => {
      const pattern = this.patterns.find(p => p.id === patId);
      if (pattern) {
        this.triggerPatternStep(pattern, stepIndex);
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

  // Expanded High-Definition Procedural Drum Synthesis
  createProceduralDrums() {
    const sr = this.ctx.sampleRate;

    // 1. 909 Punch Kick
    const kickBuf = (() => {
      const len = Math.floor(0.35 * sr);
      const b = this.ctx.createBuffer(1, len, sr);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const f = 45 + 140 * Math.exp(-t * 30);
        d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 10);
      }
      return b;
    })();

    // 2. 909 Studio Snare
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

    // 3. Open 909 Hi-Hat
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

    // 4. 808 Sub-Bass Boom (Long resonant 38Hz decay)
    const sub808Buf = (() => {
      const len = Math.floor(0.85 * sr);
      const b = this.ctx.createBuffer(1, len, sr);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const f = 38 + 60 * Math.exp(-t * 20);
        d[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 3.2);
      }
      return b;
    })();

    // 5. Analog Handclap
    const clapBuf = (() => {
      const len = Math.floor(0.24 * sr);
      const b = this.ctx.createBuffer(1, len, sr);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        let burst = 0;
        if (t < 0.012) burst = (Math.random() * 2 - 1) * 0.5;
        else if (t < 0.024) burst = (Math.random() * 2 - 1) * 0.7;
        else burst = (Math.random() * 2 - 1) * Math.exp(-(t - 0.024) * 18);
        d[i] = burst * 0.8;
      }
      return b;
    })();

    // 6. Cymbal Crash
    const crashBuf = (() => {
      const len = Math.floor(1.2 * sr);
      const b = this.ctx.createBuffer(1, len, sr);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const noise = (Math.random() * 2 - 1);
        const metal = (Math.sin(2 * Math.PI * 5200 * t) + Math.sin(2 * Math.PI * 7300 * t)) * 0.25;
        d[i] = (noise * 0.75 + metal) * Math.exp(-t * 3.5);
      }
      return b;
    })();

    return { kick: kickBuf, snare: snareBuf, hihat: hihatBuf, sub808: sub808Buf, clap: clapBuf, crash: crashBuf };
  }
}
