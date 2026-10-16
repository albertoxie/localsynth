import { SynthEngine } from './synthEngine.js';

const synth = new SynthEngine();

// Scale notes for pitch selection
const PITCH_OPTIONS_LEAD = ['C3', 'D3', 'D#3', 'F3', 'G3', 'G#3', 'A#3', 'C4', 'D4', 'D#4', 'F4', 'G4', 'G#4', 'A#4', 'C5', 'D5', 'D#5', 'F5', 'G5', 'A#5', 'C6'];
const PITCH_OPTIONS_BASS = ['C1', 'D1', 'D#1', 'F1', 'G1', 'A#1', 'C2', 'D2', 'D#2', 'F2', 'G2', 'G#2', 'A#2', 'C3', 'D#3', 'F3'];

// Render Step Sequencer Channels for the currently active FL Pattern
function initSequencerUI() {
  const container = document.getElementById('step-channels-container');
  container.innerHTML = '';

  const activePat = synth.getActivePattern();
  const labelElem = document.getElementById('active-pattern-label');
  if (labelElem) {
    labelElem.textContent = activePat.name;
    labelElem.style.color = activePat.color;
  }

  activePat.channels.forEach((ch, chIdx) => {
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

    // Volume slider listener & double-click reset to default
    const volSlider = info.querySelector('.channel-vol-slider');
    if (ch.defaultVolume === undefined) ch.defaultVolume = ch.volume;
    volSlider.addEventListener('input', (e) => {
      ch.volume = parseFloat(e.target.value);
    });
    volSlider.addEventListener('dblclick', () => {
      ch.volume = ch.defaultVolume;
      volSlider.value = ch.defaultVolume;
    });

    row.appendChild(info);

    const stepsGrid = document.createElement('div');
    stepsGrid.className = 'steps-grid';

    ch.steps.forEach((stepVal, stepIdx) => {
      const stepBtn = document.createElement('button');
      stepBtn.className = `step-btn ${stepVal === 1 ? 'active' : ''}`;
      stepBtn.dataset.ch = chIdx;
      stepBtn.dataset.step = stepIdx;

      // Note tag for melodic channels (FL Studio Piano Roll note badge)
      if (ch.type === 'synth' || ch.type === 'bass') {
        const pitchTag = document.createElement('span');
        pitchTag.className = 'step-pitch-tag';
        pitchTag.textContent = (ch.stepNotes && ch.stepNotes[stepIdx]) ? ch.stepNotes[stepIdx] : ch.note;
        stepBtn.appendChild(pitchTag);
      }

      // Left click: toggle step
      stepBtn.addEventListener('click', (e) => {
        ch.steps[stepIdx] = ch.steps[stepIdx] === 1 ? 0 : 1;
        stepBtn.classList.toggle('active');
        if (ch.steps[stepIdx] === 1) {
          const noteToTest = (ch.stepNotes && ch.stepNotes[stepIdx]) ? ch.stepNotes[stepIdx] : ch.note;
          if (ch.type === 'synth' || ch.type === 'bass') {
            const midi = synth.noteToMidi(noteToTest);
            synth.noteOn(midi, 0.8);
            setTimeout(() => synth.noteOff(midi), 150);
          } else if (ch.type === 'drum') {
            synth.playDrumSample(ch.sample, ch.volume);
          }
        }
      });

      // Right-click / Context menu: Quick Piano Roll Pitch Picker
      if (ch.type === 'synth' || ch.type === 'bass') {
        stepBtn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const scale = ch.type === 'bass' ? PITCH_OPTIONS_BASS : PITCH_OPTIONS_LEAD;
          const current = (ch.stepNotes && ch.stepNotes[stepIdx]) ? ch.stepNotes[stepIdx] : ch.note;
          const nextIdx = (scale.indexOf(current) + 1) % scale.length;
          const newPitch = scale[nextIdx >= 0 ? nextIdx : 0];
          if (!ch.stepNotes) ch.stepNotes = new Array(16).fill(ch.note);
          ch.stepNotes[stepIdx] = newPitch;
          const tag = stepBtn.querySelector('.step-pitch-tag');
          if (tag) tag.textContent = newPitch;
          ch.steps[stepIdx] = 1;
          stepBtn.classList.add('active');
          const midi = synth.noteToMidi(newPitch);
          synth.noteOn(midi, 0.85);
          setTimeout(() => synth.noteOff(midi), 180);
        });
      }

      stepsGrid.appendChild(stepBtn);
    });

    row.appendChild(stepsGrid);
    container.appendChild(row);
  });
}

// Render 16-Bar Timeline Playlist Arranger (Tracks 1 to 4)
function initPlaylistUI() {
  const rulerContainer = document.getElementById('playlist-ruler-bars');
  const tracksBody = document.getElementById('playlist-tracks-body');
  if (!rulerContainer || !tracksBody) return;

  // Build Ruler Bar Numbers 1 to 16
  rulerContainer.innerHTML = '';
  for (let bar = 0; bar < synth.totalBars; bar++) {
    const tick = document.createElement('div');
    tick.className = 'ruler-bar-tick';
    tick.dataset.bar = bar;
    tick.textContent = `BAR ${bar + 1}`;
    rulerContainer.appendChild(tick);
  }

  // Build Tracks and Bar Slots
  tracksBody.innerHTML = '';
  synth.playlistTracks.forEach((track, trackIdx) => {
    const row = document.createElement('div');
    row.className = 'playlist-track-row';

    const label = document.createElement('div');
    label.className = 'playlist-track-label';
    label.textContent = track.name;
    row.appendChild(label);

    const slotsGrid = document.createElement('div');
    slotsGrid.className = 'playlist-track-slots';

    track.bars.forEach((assignedPatId, barIdx) => {
      const slot = document.createElement('div');
      slot.className = 'track-bar-slot';
      slot.dataset.track = trackIdx;
      slot.dataset.bar = barIdx;

      if (assignedPatId) {
        slot.classList.add(`filled-${assignedPatId}`);
        const patObj = synth.patterns.find(p => p.id === assignedPatId);
        slot.textContent = patObj ? patObj.name.split(':')[0] : assignedPatId;
      }

      // Click to paint or remove pattern
      slot.addEventListener('click', () => {
        if (track.bars[barIdx] === synth.activePatternId) {
          // Erase
          track.bars[barIdx] = null;
          slot.className = 'track-bar-slot';
          slot.textContent = '';
        } else {
          // Paint active pattern
          track.bars[barIdx] = synth.activePatternId;
          slot.className = `track-bar-slot filled-${synth.activePatternId}`;
          const patObj = synth.patterns.find(p => p.id === synth.activePatternId);
          slot.textContent = patObj ? patObj.name.split(':')[0] : synth.activePatternId;
        }
      });

      slotsGrid.appendChild(slot);
    });

    row.appendChild(slotsGrid);
    tracksBody.appendChild(row);
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

// Precision Smooth Rotary Knobs (Left/Right Drag + Left/Right Click Step + Double-Click Recenter)
function initKnobs() {
  const knobs = document.querySelectorAll('.rotary-knob');
  knobs.forEach((knob) => {
    const param = knob.dataset.param;
    let currentAngle = 0; // Cumulative angle in degrees (-135 to +135)
    let startX = 0;
    let startY = 0;
    let didDrag = false;

    const applyNormalizedParam = (norm) => {
      if (param === 'filterCutoff') {
        const minF = 40;
        const maxF = 18000;
        synth.params.filterCutoff = minF * Math.pow(maxF / minF, norm);
      } else if (param === 'filterResonance') {
        synth.params.filterResonance = 0.1 + norm * 14.9;
      } else if (param === 'filterEnvAmount') {
        synth.params.filterEnvAmount = norm * 7000;
      } else if (param === 'osc2Detune') {
        synth.params.osc2Detune = (norm * 100) - 50;
      } else if (param === 'delayTime') {
        synth.delayNode.delayTime.value = 0.05 + norm * 0.95;
      } else if (param === 'delayFeedback') {
        synth.delayFeedbackNode.gain.value = norm * 0.85;
      } else if (param === 'reverbMix') {
        synth.params.reverbMix = norm * 0.9;
        if (synth.reverbGain) synth.reverbGain.gain.value = synth.params.reverbMix;
      } else if (param === 'chorusMix') {
        synth.params.chorusMix = norm * 0.8;
        if (synth.chorusGain) synth.chorusGain.gain.value = synth.params.chorusMix;
      } else if (param === 'distDrive') {
        synth.setDistortion(norm);
      } else if (param === 'ampAttack') {
        synth.params.ampAttack = 0.005 + Math.pow(norm, 2) * 1.5;
      } else if (param === 'ampDecay') {
        synth.params.ampDecay = 0.05 + norm * 2.0;
      } else if (param === 'ampRelease') {
        synth.params.ampRelease = 0.05 + Math.pow(norm, 2) * 2.5;
      }
    };

    const updateKnobTransform = (angle) => {
      currentAngle = Math.max(-135, Math.min(135, angle));
      knob.style.transform = `rotate(${currentAngle}deg)`;
      const norm = (currentAngle + 135) / 270;
      applyNormalizedParam(norm);
    };

    const onPointerMove = (e) => {
      const deltaX = e.clientX - startX;
      const deltaY = startY - e.clientY;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        didDrag = true;
      }
      startX = e.clientX;
      startY = e.clientY;

      // Twist left and right with horizontal movement (plus slight vertical assist)
      const delta = deltaX * 2.2 + deltaY * 0.6;
      updateKnobTransform(currentAngle + delta);
    };

    const onPointerUp = (e) => {
      try { knob.releasePointerCapture(e.pointerId); } catch (err) {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      // If clicked without dragging, twist left or right depending on which side of the knob was clicked!
      if (!didDrag) {
        const rect = knob.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        if (clickX < rect.width / 2) {
          // Clicked left half -> twist left (-15 deg)
          updateKnobTransform(currentAngle - 15);
        } else {
          // Clicked right half -> twist right (+15 deg)
          updateKnobTransform(currentAngle + 15);
        }
      }
    };

    knob.addEventListener('pointerdown', (e) => {
      startX = e.clientX;
      startY = e.clientY;
      didDrag = false;
      try { knob.setPointerCapture(e.pointerId); } catch (err) {}
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    // Double-click to recenter ANY knob to 0 degrees (12 o'clock center default)
    knob.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentAngle = 0;
      knob.style.transform = `rotate(0deg)`;
      if (param === 'filterCutoff') synth.params.filterCutoff = 1800;
      else if (param === 'filterResonance') synth.params.filterResonance = 4.5;
      else if (param === 'filterEnvAmount') synth.params.filterEnvAmount = 2400;
      else if (param === 'osc2Detune') synth.params.osc2Detune = 0;
      else if (param === 'delayTime') synth.delayNode.delayTime.value = 0.25;
      else if (param === 'delayFeedback') synth.delayFeedbackNode.gain.value = 0.35;
      else if (param === 'reverbMix') { synth.params.reverbMix = 0.25; if (synth.reverbGain) synth.reverbGain.gain.value = 0.25; }
      else if (param === 'chorusMix') { synth.params.chorusMix = 0.3; if (synth.chorusGain) synth.chorusGain.gain.value = 0.3; }
      else if (param === 'distDrive') synth.setDistortion(0);
      else if (param === 'ampAttack') synth.params.ampAttack = 0.01;
      else if (param === 'ampDecay') synth.params.ampDecay = 0.25;
      else if (param === 'ampRelease') synth.params.ampRelease = 0.35;
    });

    // Mouse wheel / trackpad horizontal & vertical support
    knob.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rawDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY;
      const step = rawDelta > 0 ? 10 : -10;
      updateKnobTransform(currentAngle + step);
    }, { passive: false });
  });

  document.getElementById('osc1-wave').addEventListener('change', (e) => {
    synth.params.osc1Wave = e.target.value;
  });

  document.getElementById('osc2-wave').addEventListener('change', (e) => {
    synth.params.osc2Wave = e.target.value;
  });

  // Presets Dropdown
  const presetDropdown = document.getElementById('synth-preset-dropdown');
  presetDropdown.addEventListener('change', (e) => {
    const p = synth.loadPreset(e.target.value);
    if (p) {
      document.getElementById('osc1-wave').value = p.params.osc1Wave;
      document.getElementById('osc2-wave').value = p.params.osc2Wave;
    }
  });

  // Save Custom User Patch
  document.getElementById('btn-save-patch').addEventListener('click', () => {
    const patchName = prompt('Enter a name for your custom patch:', 'Analog Dreamer');
    if (patchName && patchName.trim()) {
      const p = synth.saveUserPatch(patchName.trim());
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      presetDropdown.appendChild(opt);
      presetDropdown.value = p.id;
      alert(`Patch "${patchName}" saved to browser memory!`);
    }
  });

  // Export Patch as JSON
  document.getElementById('btn-export-patch').addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(synth.params, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `LocalSynth_Patch_${Date.now()}.json`;
    a.click();
  });

  // Arpeggiator Dropdown
  document.getElementById('arp-mode-select').addEventListener('change', (e) => {
    synth.params.arpMode = e.target.value;
    if (e.target.value === 'off') {
      synth.stopArpeggiator();
    }
  });
}

// Transport, Mode Toggling, Recording & Sequencer Loop
function initTransport() {
  const playBtn = document.getElementById('btn-seq-play');
  const playText = document.getElementById('play-text');
  const bpmInput = document.getElementById('seq-bpm');
  const btnModePat = document.getElementById('btn-mode-pat');
  const btnModeSong = document.getElementById('btn-mode-song');
  const patDropdown = document.getElementById('pattern-select-dropdown');
  const brushBadge = document.getElementById('brush-badge');
  const recordBtn = document.getElementById('btn-record-audio');
  const recordText = document.getElementById('record-text');
  const sendDawBtn = document.getElementById('btn-send-localdaw');

  // Mode Toggling: PAT vs SONG
  if (btnModePat && btnModeSong) {
    btnModePat.addEventListener('click', () => {
      synth.playMode = 'PAT';
      btnModePat.classList.add('active');
      btnModeSong.classList.remove('active');
    });

    btnModeSong.addEventListener('click', () => {
      synth.playMode = 'SONG';
      btnModeSong.classList.add('active');
      btnModePat.classList.remove('active');
    });
  }

  // Pattern Selector Dropdown
  if (patDropdown) {
    patDropdown.addEventListener('change', (e) => {
      synth.activePatternId = e.target.value;
      const patObj = synth.getActivePattern();
      if (brushBadge) {
        brushBadge.textContent = patObj.name.split(':')[0];
        brushBadge.style.color = patObj.color;
        brushBadge.style.borderColor = patObj.color;
      }
      initSequencerUI();
    });
  }

  bpmInput.addEventListener('change', (e) => {
    synth.bpm = parseInt(e.target.value, 10) || 128;
    if (synth.isPlaying) {
      synth.stopPlayback();
      synth.startPlayback(handlePlaybackTick);
    }
  });

  const handlePlaybackTick = (tickInfo) => {
    // Sequencer step highlights
    document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('current-step-tick'));
    document.querySelectorAll(`.step-btn[data-step="${tickInfo.step}"]`).forEach(b => b.classList.add('current-step-tick'));

    // Song mode playlist highlights
    if (tickInfo.mode === 'SONG') {
      document.querySelectorAll('.ruler-bar-tick').forEach(t => t.classList.remove('current-bar-tick'));
      const activeRuler = document.querySelector(`.ruler-bar-tick[data-bar="${tickInfo.bar}"]`);
      if (activeRuler) activeRuler.classList.add('current-bar-tick');

      document.querySelectorAll('.track-bar-slot').forEach(s => s.classList.remove('current-bar-active'));
      document.querySelectorAll(`.track-bar-slot[data-bar="${tickInfo.bar}"]`).forEach(s => s.classList.add('current-bar-active'));
    }
  };

  const updatePlayBtnUI = (isPlaying) => {
    const iconPlay = playBtn.querySelector('.icon-play');
    const iconStop = playBtn.querySelector('.icon-stop');
    if (isPlaying) {
      playBtn.classList.add('playing');
      playText.textContent = 'STOP';
      if (iconPlay) iconPlay.style.display = 'none';
      if (iconStop) iconStop.style.display = 'inline-block';
    } else {
      playBtn.classList.remove('playing');
      playText.textContent = 'PLAY';
      if (iconPlay) iconPlay.style.display = 'inline-block';
      if (iconStop) iconStop.style.display = 'none';
    }
  };

  playBtn.addEventListener('click', () => {
    if (synth.isPlaying) {
      synth.stopPlayback();
      updatePlayBtnUI(false);
      document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('current-step-tick'));
      document.querySelectorAll('.ruler-bar-tick').forEach(t => t.classList.remove('current-bar-tick'));
      document.querySelectorAll('.track-bar-slot').forEach(s => s.classList.remove('current-bar-active'));
    } else {
      synth.startPlayback(handlePlaybackTick);
      updatePlayBtnUI(true);
    }
  });

  // Audio Recording Toggle
  if (recordBtn) {
    recordBtn.addEventListener('click', async () => {
      if (synth.isRecording) {
        // Stop recording
        recordBtn.classList.remove('recording');
        recordText.textContent = 'SAVING...';
        await synth.stopRecordingAndDownload(`LocalSynth_${synth.playMode}_${Date.now()}.webm`);
        recordText.textContent = 'RECORD AUDIO';
      } else {
        // Start recording
        synth.startRecording();
        recordBtn.classList.add('recording');
        recordText.textContent = 'RECORDING...';
        if (!synth.isPlaying) {
          synth.startPlayback(handlePlaybackTick);
          updatePlayBtnUI(true);
        }
      }
    });
  }

  // Send to LocalDAW Integration: Synchronously opens window (avoids popup blocker), stops playback/recording, and dispatches audio payload via postMessage
  if (sendDawBtn) {
    sendDawBtn.addEventListener('click', async () => {
      // 1. Open LocalDAW window synchronously inside user gesture to guarantee no popup block!
      const dawUrl = `https://localdaw.com/?source=localsynth&bpm=${synth.bpm}`;
      const dawWindow = window.open(dawUrl, '_blank');

      let audioBase64 = null;

      // 2. If currently recording, capture the recorded blob
      if (synth.isRecording) {
        recordBtn.classList.remove('recording');
        recordText.textContent = 'PACKAGING...';
        const blob = await synth.stopRecording();
        recordText.textContent = 'RECORD AUDIO';
        if (blob) {
          audioBase64 = await new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result.split(',')[1];
              res(base64);
            };
            reader.readAsDataURL(blob);
          });
        }
      }

      // 3. Stop synth playback immediately
      if (synth.isPlaying) {
        synth.stopPlayback();
        updatePlayBtnUI(false);
        document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('current-step-tick'));
        document.querySelectorAll('.ruler-bar-tick').forEach(t => t.classList.remove('current-bar-tick'));
        document.querySelectorAll('.track-bar-slot').forEach(s => s.classList.remove('current-bar-active'));
      }

      // 4. If no active live recording was captured, synthesize a high-quality 2-bar bounce of the active pattern
      if (!audioBase64) {
        sendDawBtn.textContent = 'RENDERING STEM...';
        try {
          const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100 * 4, 44100);
          const activePat = synth.getActivePattern();
          const stepSec = (60 / synth.bpm) / 4;
          for (let step = 0; step < 16 * 2; step++) {
            const stepIdx = step % 16;
            const t = step * stepSec;
            activePat.channels.forEach(ch => {
              if (ch.steps[stepIdx] === 1 && !ch.mute) {
                if (ch.type === 'drum' && synth.drumBuffers[ch.sample]) {
                  const s = offlineCtx.createBufferSource();
                  s.buffer = synth.drumBuffers[ch.sample];
                  const g = offlineCtx.createGain();
                  g.gain.value = ch.volume || 1.0;
                  s.connect(g);
                  g.connect(offlineCtx.destination);
                  s.start(t);
                } else if (ch.type === 'synth' || ch.type === 'bass') {
                  const osc = offlineCtx.createOscillator();
                  osc.type = ch.type === 'bass' ? 'sawtooth' : 'square';
                  const note = (ch.stepNotes && ch.stepNotes[stepIdx]) ? ch.stepNotes[stepIdx] : ch.note;
                  osc.frequency.setValueAtTime(synth.midiToFreq(synth.noteToMidi(note)), t);
                  const env = offlineCtx.createGain();
                  env.gain.setValueAtTime(0, t);
                  env.gain.linearRampToValueAtTime(0.7 * (ch.volume || 1.0), t + 0.01);
                  env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                  osc.connect(env);
                  env.connect(offlineCtx.destination);
                  osc.start(t);
                  osc.stop(t + 0.18);
                }
              }
            });
          }

          const renderedBuffer = await offlineCtx.startRendering();
          const numChannels = renderedBuffer.numberOfChannels;
          const length = renderedBuffer.length * numChannels * 2 + 44;
          const wavBuffer = new ArrayBuffer(length);
          const view = new DataView(wavBuffer);
          const writeString = (offset, str) => {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
          };
          writeString(0, 'RIFF');
          view.setUint32(4, 36 + renderedBuffer.length * numChannels * 2, true);
          writeString(8, 'WAVE');
          writeString(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true); // PCM
          view.setUint16(22, numChannels, true);
          view.setUint32(24, 44100, true);
          view.setUint32(28, 44100 * numChannels * 2, true);
          view.setUint16(32, numChannels * 2, true);
          view.setUint16(34, 16, true);
          writeString(36, 'data');
          view.setUint32(40, renderedBuffer.length * numChannels * 2, true);

          let offset = 44;
          for (let i = 0; i < renderedBuffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
              const sample = Math.max(-1, Math.min(1, renderedBuffer.getChannelData(channel)[i]));
              view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
              offset += 2;
            }
          }

          let binary = '';
          const bytes = new Uint8Array(wavBuffer);
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
          }
          audioBase64 = btoa(binary);
        } catch (e) {
          console.warn('[Offline render fallback error]', e);
        }
        sendDawBtn.textContent = '🎛️ TO LOCALDAW';
      }

      // 5. Build export payload
      const payload = {
        type: 'LOCALSYNTH_STEM_EXPORT',
        name: `LocalSynth ${synth.playMode} Groove`,
        patch: synth.getActivePattern().name.split(':')[0],
        bpm: synth.bpm,
        audioBase64: audioBase64
      };

      try {
        localStorage.setItem('localsynth_export_payload', JSON.stringify(payload));
      } catch (err) {}

      // 6. Send via cross-origin postMessage to LocalDAW window repeatedly as it boots up
      if (dawWindow) {
        let attempts = 0;
        const postTimer = setInterval(() => {
          attempts++;
          try {
            dawWindow.postMessage(payload, '*');
          } catch (e) {}
          if (attempts >= 12) clearInterval(postTimer);
        }, 600);
      }
    });
  }

  // Random Acid Bassline Generator
  document.getElementById('btn-randomize-acid').addEventListener('click', () => {
    const activePat = synth.getActivePattern();
    const bassCh = activePat.channels.find(c => c.id === 'acid_bass');
    if (bassCh) {
      const notes = ['C2', 'D#2', 'F2', 'G2', 'A#2', 'C3'];
      if (!bassCh.stepNotes) bassCh.stepNotes = new Array(16).fill('C2');
      for (let i = 0; i < 16; i++) {
        bassCh.steps[i] = Math.random() > 0.4 ? 1 : 0;
        bassCh.stepNotes[i] = notes[Math.floor(Math.random() * notes.length)];
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

// Cinema Splash Screen Boot
function initSplashScreen() {
  const splash = document.getElementById('splash-screen');
  const progressBar = document.querySelector('.splash-loader-progress');
  const statusText = document.getElementById('splash-status-text');
  const startBtn = document.getElementById('splash-start-btn');

  const steps = [
    { pct: 20, text: 'CALIBRATING 64-BIT DUAL OSCILLATORS...' },
    { pct: 40, text: 'WARMING 24dB RESONANT LADDER FILTER...' },
    { pct: 60, text: 'SYNTHESIZING CONVOLUTION REVERB & JUNO CHORUS...' },
    { pct: 80, text: 'INITIALIZING FL MULTI-PATTERN SEQUENCER & RECORDER...' },
    { pct: 100, text: 'LOCALSYNTH PRO STUDIO READY' }
  ];

  let currentStep = 0;
  const interval = setInterval(() => {
    if (currentStep < steps.length) {
      const s = steps[currentStep];
      progressBar.style.width = `${s.pct}%`;
      statusText.textContent = s.text;
      currentStep++;
    } else {
      clearInterval(interval);
      startBtn.classList.add('ready');
    }
  }, 300);

  const dismissSplash = () => {
    synth.ensureContext();
    splash.classList.add('hidden');
    setTimeout(() => {
      splash.remove();
    }, 700);
  };

  startBtn.addEventListener('click', dismissSplash);
  splash.addEventListener('click', (e) => {
    if (e.target === splash || e.target.classList.contains('splash-hero-logo')) {
      dismissSplash();
    }
  });
}

// Web MIDI API Hardware Controller Support
function initMIDI() {
  const midiStatusText = document.getElementById('midi-status-text');
  const midiDot = document.getElementById('midi-dot');
  const midiPill = document.getElementById('midi-status-pill');

  const midiNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midiNumberToNoteName = (midiNum) => {
    const octave = Math.floor(midiNum / 12) - 1;
    const note = midiNames[midiNum % 12];
    return `${note}${octave}`;
  };

  if (!navigator.requestMIDIAccess) {
    if (midiStatusText) midiStatusText.textContent = 'MIDI: UNSUPPORTED';
    return;
  }

  const connectMIDI = () => {
    navigator.requestMIDIAccess().then((midiAccess) => {
      const attachInputs = () => {
        const inputs = Array.from(midiAccess.inputs.values());
        if (inputs.length > 0) {
          const firstName = inputs[0].name || 'USB MIDI';
          if (midiStatusText) midiStatusText.textContent = `MIDI: ${firstName.substring(0, 14).toUpperCase()}`;
          if (midiDot) midiDot.classList.add('connected');
        } else {
          if (midiStatusText) midiStatusText.textContent = 'MIDI: READY';
          if (midiDot) midiDot.classList.remove('connected');
        }

        inputs.forEach((input) => {
          input.onmidimessage = (msg) => {
            const [status, data1, data2] = msg.data;
            const command = status & 0xf0;

            if (midiDot) {
              midiDot.classList.add('active-signal');
              clearTimeout(midiDot._blinkTimer);
              midiDot._blinkTimer = setTimeout(() => midiDot.classList.remove('active-signal'), 120);
            }

            // Note On
            if (command === 0x90 && data2 > 0) {
              const noteName = midiNumberToNoteName(data1);
              synth.noteOn(noteName);
              const keyEl = document.querySelector(`[data-note="${noteName}"]`);
              if (keyEl) keyEl.classList.add('active');
            }
            // Note Off (or Note On with 0 velocity)
            else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
              const noteName = midiNumberToNoteName(data1);
              synth.noteOff(noteName);
              const keyEl = document.querySelector(`[data-note="${noteName}"]`);
              if (keyEl) keyEl.classList.remove('active');
            }
            // Control Change (CC) -> Filter Cutoff (CC 1 Mod Wheel or CC 74 Cutoff) & Resonance (CC 71)
            else if (command === 0xB0) {
              const norm = data2 / 127;
              if (data1 === 1 || data1 === 74 || data1 === 16) {
                const freq = 40 * Math.pow(18000 / 40, norm);
                synth.params.filterCutoff = freq;
                synth.updateFilter();
                const knob = document.getElementById('knob-cutoff');
                if (knob) {
                  const deg = (norm * 270) - 135;
                  knob.dataset.deg = deg;
                  knob.style.transform = `rotate(${deg}deg)`;
                }
              } else if (data1 === 71 || data1 === 17) {
                const res = norm * 22;
                synth.params.filterRes = res;
                synth.updateFilter();
                const knob = document.getElementById('knob-resonance');
                if (knob) {
                  const deg = (norm * 270) - 135;
                  knob.dataset.deg = deg;
                  knob.style.transform = `rotate(${deg}deg)`;
                }
              }
            }
          };
        });
      };

      attachInputs();
      midiAccess.onstatechange = attachInputs;
    }).catch(() => {
      if (midiStatusText) midiStatusText.textContent = 'MIDI: CLICK TO ENABLE';
    });
  };

  connectMIDI();
  if (midiPill) {
    midiPill.addEventListener('click', connectMIDI);
  }
}

// Boot System
window.addEventListener('DOMContentLoaded', () => {
  initSplashScreen();
  initSequencerUI();
  initPlaylistUI();
  initKeyboardUI();
  initKnobs();
  initTransport();
  initMIDI();
  startOscilloscope();
});

