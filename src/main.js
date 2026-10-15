import { SynthEngine } from './synthEngine.js';

const synth = new SynthEngine();

// Render Step Sequencer Channels with Mute/Solo & Volume
function initSequencerUI() {
  const container = document.getElementById('step-channels-container');
  container.innerHTML = '';

  synth.channels.forEach((ch, chIdx) => {
    const row = document.createElement('div');
    row.className = 'channel-row';

    const info = document.createElement('div');
    info.className = 'channel-info';
    info.innerHTML = `
      <button class="channel-btn-mute ${ch.mute ? 'active' : ''}" data-ch="${chIdx}" title="Mute Channel">M</button>
      <button class="channel-btn-solo ${ch.solo ? 'active' : ''}" data-ch="${chIdx}" title="Solo Channel">S</button>
      <input type="range" class="channel-vol-slider" min="0" max="1" step="0.05" value="${ch.volume}" data-ch="${chIdx}" title="Channel Volume">
      <span class="channel-name">${ch.name}</span>
    `;

    // Mute listener
    info.querySelector('.channel-btn-mute').addEventListener('click', (e) => {
      ch.mute = !ch.mute;
      e.target.classList.toggle('active', ch.mute);
    });

    // Solo listener
    info.querySelector('.channel-btn-solo').addEventListener('click', (e) => {
      ch.solo = !ch.solo;
      e.target.classList.toggle('active', ch.solo);
    });

    // Volume slider listener
    info.querySelector('.channel-vol-slider').addEventListener('input', (e) => {
      ch.volume = parseFloat(e.target.value);
    });

    row.appendChild(info);

    const stepsGrid = document.createElement('div');
    stepsGrid.className = 'steps-grid';

    ch.steps.forEach((stepVal, stepIdx) => {
      const stepBtn = document.createElement('button');
      stepBtn.className = `step-btn ${stepVal === 1 ? 'active' : ''}`;
      stepBtn.dataset.ch = chIdx;
      stepBtn.dataset.step = stepIdx;

      stepBtn.addEventListener('click', () => {
        ch.steps[stepIdx] = ch.steps[stepIdx] === 1 ? 0 : 1;
        stepBtn.classList.toggle('active');
      });

      stepsGrid.appendChild(stepBtn);
    });

    row.appendChild(stepsGrid);
    container.appendChild(row);
  });
}

// Render 2-Octave Piano Keyboard (C3 to C5)
function initKeyboardUI() {
  const container = document.getElementById('keyboard-container');
  container.innerHTML = '';

  const startMidi = 48;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const whiteKeys = [];
  const blackKeys = [];

  for (let midi = startMidi; midi <= 72; midi++) {
    const note = noteNames[midi % 12];
    const isBlack = note.includes('#');
    if (!isBlack) {
      whiteKeys.push({ midi, note });
    } else {
      blackKeys.push({ midi, note, prevWhiteIndex: whiteKeys.length - 1 });
    }
  }

  // White Keys
  whiteKeys.forEach((k) => {
    const key = document.createElement('div');
    key.className = 'key-white';
    key.dataset.midi = k.midi;

    key.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      key.classList.add('active');
      synth.noteOn(k.midi, 0.9);
    });

    const stop = () => {
      key.classList.remove('active');
      synth.noteOff(k.midi);
    };

    key.addEventListener('pointerup', stop);
    key.addEventListener('pointerleave', stop);
    key.addEventListener('pointercancel', stop);

    container.appendChild(key);
  });

  // Black Keys
  const whiteKeyWidthPercent = 100 / whiteKeys.length;
  blackKeys.forEach((k) => {
    const key = document.createElement('div');
    key.className = 'key-black';
    key.dataset.midi = k.midi;
    const leftPercent = (k.prevWhiteIndex + 1) * whiteKeyWidthPercent - 1.6;
    key.style.left = `${leftPercent}%`;

    key.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      key.classList.add('active');
      synth.noteOn(k.midi, 0.9);
    });

    const stop = () => {
      key.classList.remove('active');
      synth.noteOff(k.midi);
    };

    key.addEventListener('pointerup', stop);
    key.addEventListener('pointerleave', stop);
    key.addEventListener('pointercancel', stop);

    container.appendChild(key);
  });

  // Computer Keyboard mapping
  const keyMap = {
    'a': 48, 'w': 49, 's': 50, 'e': 51, 'd': 52, 'f': 53, 't': 54,
    'g': 55, 'y': 56, 'h': 57, 'u': 58, 'j': 59, 'k': 60, 'o': 61, 'l': 62
  };

  const activeKeyMap = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const midi = keyMap[e.key.toLowerCase()];
    if (midi && !activeKeyMap.has(midi)) {
      activeKeyMap.add(midi);
      synth.noteOn(midi, 0.9);
      const elem = container.querySelector(`[data-midi="${midi}"]`);
      if (elem) elem.classList.add('active');
    }
  });

  window.addEventListener('keyup', (e) => {
    const midi = keyMap[e.key.toLowerCase()];
    if (midi && activeKeyMap.has(midi)) {
      activeKeyMap.delete(midi);
      synth.noteOff(midi);
      const elem = container.querySelector(`[data-midi="${midi}"]`);
      if (elem) elem.classList.remove('active');
    }
  });
}

// Rotary Knobs & Parameter Binding
function initKnobs() {
  const knobs = document.querySelectorAll('.rotary-knob');
  knobs.forEach((knob) => {
    let startY = 0;
    const param = knob.dataset.param;
    let currentVal = synth.params[param] || 0;

    const onPointerMove = (e) => {
      const deltaY = startY - e.clientY;
      startY = e.clientY;

      if (param === 'filterCutoff') {
        currentVal = Math.max(40, Math.min(18000, currentVal + deltaY * 45));
        synth.params.filterCutoff = currentVal;
      } else if (param === 'filterResonance') {
        currentVal = Math.max(0.1, Math.min(15, currentVal + deltaY * 0.1));
        synth.params.filterResonance = currentVal;
      } else if (param === 'filterEnvAmount') {
        currentVal = Math.max(0, Math.min(8000, currentVal + deltaY * 25));
        synth.params.filterEnvAmount = currentVal;
      } else if (param === 'osc2Detune') {
        currentVal = Math.max(-50, Math.min(50, currentVal + deltaY * 0.5));
        synth.params.osc2Detune = currentVal;
      } else if (param === 'delayTime') {
        currentVal = Math.max(0.05, Math.min(1.0, currentVal + deltaY * 0.01));
        synth.delayNode.delayTime.value = currentVal;
      } else if (param === 'delayFeedback') {
        currentVal = Math.max(0, Math.min(0.85, currentVal + deltaY * 0.01));
        synth.delayFeedbackNode.gain.value = currentVal;
      } else if (param === 'distDrive') {
        currentVal = Math.max(0, Math.min(1.0, currentVal + deltaY * 0.01));
        synth.setDistortion(currentVal);
      } else {
        currentVal = Math.max(0.01, Math.min(2.0, currentVal + deltaY * 0.01));
        synth.params[param] = currentVal;
      }

      knob.style.transform = `rotate(${deltaY * 3}deg)`;
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    knob.addEventListener('pointerdown', (e) => {
      startY = e.clientY;
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  });

  document.getElementById('osc1-wave').addEventListener('change', (e) => {
    synth.params.osc1Wave = e.target.value;
  });

  document.getElementById('osc2-wave').addEventListener('change', (e) => {
    synth.params.osc2Wave = e.target.value;
  });

  // Presets Dropdown
  document.getElementById('synth-preset-dropdown').addEventListener('change', (e) => {
    const p = synth.loadPreset(e.target.value);
    if (p) {
      document.getElementById('osc1-wave').value = p.params.osc1Wave;
      document.getElementById('osc2-wave').value = p.params.osc2Wave;
    }
  });

  // Arpeggiator Dropdown
  document.getElementById('arp-mode-select').addEventListener('change', (e) => {
    synth.params.arpMode = e.target.value;
    if (e.target.value === 'off') {
      synth.stopArpeggiator();
    }
  });
}

// Transport & Sequencer Loop
function initTransport() {
  const playBtn = document.getElementById('btn-seq-play');
  const playText = document.getElementById('play-text');
  const bpmInput = document.getElementById('seq-bpm');

  bpmInput.addEventListener('change', (e) => {
    synth.bpm = parseInt(e.target.value, 10) || 128;
    if (synth.isPlaying) {
      synth.stopSequencer();
      synth.startSequencer(handleStepTick);
    }
  });

  const handleStepTick = (stepIdx) => {
    document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('current-step-tick'));
    document.querySelectorAll(`.step-btn[data-step="${stepIdx}"]`).forEach(b => b.classList.add('current-step-tick'));
  };

  playBtn.addEventListener('click', () => {
    if (synth.isPlaying) {
      synth.stopSequencer();
      playBtn.classList.remove('playing');
      playText.textContent = 'PLAY PATTERN';
      document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('current-step-tick'));
    } else {
      synth.startSequencer(handleStepTick);
      playBtn.classList.add('playing');
      playText.textContent = 'STOP';
    }
  });

  // Random Acid Bassline Generator
  document.getElementById('btn-randomize-acid').addEventListener('click', () => {
    const bassCh = synth.channels.find(c => c.id === 'acid_bass');
    if (bassCh) {
      const notes = ['C2', 'D#2', 'F2', 'G2', 'A#2', 'C3'];
      bassCh.note = notes[Math.floor(Math.random() * notes.length)];
      for (let i = 0; i < 16; i++) {
        bassCh.steps[i] = Math.random() > 0.4 ? 1 : 0;
      }
      initSequencerUI();
    }
  });
}

// Oscilloscope Canvas Loop
function startOscilloscope() {
  const canvas = document.getElementById('oscilloscope');
  const ctx = canvas.getContext('2d');
  const buffer = new Uint8Array(synth.masterAnalyser.frequencyBinCount);

  function draw() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    synth.masterAnalyser.getByteTimeDomainData(buffer);

    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#f97316';
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 10;
    ctx.beginPath();

    const sliceWidth = canvas.width / buffer.length;
    let x = 0;

    for (let i = 0; i < buffer.length; i++) {
      const v = buffer[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

// Boot System
window.addEventListener('DOMContentLoaded', () => {
  initSequencerUI();
  initKeyboardUI();
  initKnobs();
  initTransport();
  startOscilloscope();
});
