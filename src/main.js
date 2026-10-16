import { SynthEngine } from './synthEngine.js';
import { parseStandardMidiFile, mapMidiToSynthPatterns, exportSynthToMidiBlob, INSTRUMENT_CATALOG } from './midiFileParser.js';

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

    // Determine active program from INSTRUMENT_CATALOG
    const currentProgId = ch.programId || (ch.type === 'drum' ? `drum_${ch.sample || 'kick'}` : (ch.type === 'bass' ? 'prog_38_acid' : 'prog_81_saw'));
    const matchedSpec = INSTRUMENT_CATALOG.find(item => item.programId === currentProgId) || INSTRUMENT_CATALOG[0];
    const badgeText = ch.gmBadge || matchedSpec.gmBadge || 'PROG 081';

    const info = document.createElement('div');
    info.className = 'channel-info';

    const optionsHtml = INSTRUMENT_CATALOG.map(inst =>
      `<option value="${inst.programId}" ${inst.programId === currentProgId ? 'selected' : ''}>${inst.label}</option>`
    ).join('');

    info.innerHTML = `
      <button class="channel-btn-mute ${ch.mute ? 'active' : ''}" data-ch="${chIdx}" title="Mute Channel">M</button>
      <button class="channel-btn-solo ${ch.solo ? 'active' : ''}" data-ch="${chIdx}" title="Solo Channel">S</button>
      <input type="range" class="channel-vol-slider" min="0" max="1" step="0.05" value="${ch.volume}" data-ch="${chIdx}" title="Channel Volume (Double-Click to Reset)">
      <div class="channel-program-stack">
        <div class="channel-program-top">
          <span class="gm-prog-badge" title="Active MIDI Program / Instrument Channel">${badgeText}</span>
          <span class="channel-track-title" title="${ch.name}">${ch.name}</span>
        </div>
        <select class="channel-instrument-select" data-ch="${chIdx}" title="Pick Instrument / Synth Program for this Track">
          ${optionsHtml}
        </select>
      </div>
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

    // Instrument / Program Selector listener (updates this channel across all patterns in the song)
    const instSelect = info.querySelector('.channel-instrument-select');
    instSelect.addEventListener('change', (e) => {
      const chosenId = e.target.value;
      const spec = INSTRUMENT_CATALOG.find(item => item.programId === chosenId);
      if (!spec) return;

      // Apply chosen instrument program across all patterns for this channel index so the whole song stays consistent
      synth.patterns.forEach(pat => {
        const targetCh = pat.channels[chIdx];
        if (targetCh) {
          targetCh.programId = spec.programId;
          targetCh.gmBadge = spec.gmBadge;
          targetCh.name = spec.label;
          targetCh.type = spec.type;
          if (spec.type === 'drum') {
            targetCh.sample = spec.sample || 'kick';
            targetCh.timbre = null;
          } else {
            targetCh.timbre = { ...spec.timbre };
            if (!targetCh.stepNotes) {
              targetCh.stepNotes = new Array(16).fill(spec.type === 'bass' ? 'C2' : 'C4');
            }
          }
        }
      });

      // Audition the newly selected instrument immediately
      if (spec.type === 'drum') {
        synth.playDrumSample(spec.sample || 'kick', ch.volume);
      } else {
        const previewMidi = spec.type === 'bass' ? 36 : 60;
        synth.playInstrumentVoice(previewMidi, 0.9, 220, spec.timbre);
      }

      initSequencerUI();
      showSynthToast(`🎛️ Track ${chIdx + 1} switched to ${spec.label} (${spec.gmBadge})`);
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
      stepBtn.addEventListener('click', () => {
        ch.steps[stepIdx] = ch.steps[stepIdx] === 1 ? 0 : 1;
        stepBtn.classList.toggle('active');
        if (ch.steps[stepIdx] === 1) {
          const noteToTest = (ch.stepNotes && ch.stepNotes[stepIdx]) ? ch.stepNotes[stepIdx] : ch.note;
          if (ch.type === 'synth' || ch.type === 'bass') {
            const midi = synth.noteToMidi(noteToTest);
            synth.playInstrumentVoice(midi, 0.85, 160, ch.timbre || null);
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
          synth.playInstrumentVoice(midi, 0.85, 180, ch.timbre || null);
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

      const applySlotPatternStyle = (el, patId) => {
        if (!patId) {
          el.className = 'track-bar-slot';
          el.style.background = '';
          el.style.borderColor = '';
          el.style.color = '';
          el.style.boxShadow = '';
          el.textContent = '';
          return;
        }
        el.className = `track-bar-slot filled-${patId}`;
        const patObj = synth.patterns.find(p => p.id === patId);
        const col = patObj?.color || '#f97316';
        el.style.background = `linear-gradient(135deg, ${col}cc 0%, ${col}99 100%)`;
        el.style.borderColor = col;
        el.style.color = '#fff';
        el.style.boxShadow = `0 0 8px ${col}66`;
        el.textContent = patObj ? patObj.name.split(':')[0] : patId;
      };

      if (assignedPatId) {
        applySlotPatternStyle(slot, assignedPatId);
      }

      // Click to paint or remove pattern
      slot.addEventListener('click', () => {
        if (track.bars[barIdx] === synth.activePatternId) {
          track.bars[barIdx] = null;
          applySlotPatternStyle(slot, null);
        } else {
          track.bars[barIdx] = synth.activePatternId;
          applySlotPatternStyle(slot, synth.activePatternId);
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
    // Song mode playlist highlights & live Channel Rack sync
    if (tickInfo.mode === 'SONG') {
      if (tickInfo.step === 0) {
        // Find which pattern is playing at this bar so the Channel Rack shows the live notes
        let barPatId = null;
        for (const tr of synth.playlistTracks) {
          if (tr.bars[tickInfo.bar]) {
            barPatId = tr.bars[tickInfo.bar];
            break;
          }
        }
        if (barPatId && synth.activePatternId !== barPatId) {
          synth.activePatternId = barPatId;
          if (patDropdown) patDropdown.value = barPatId;
          initSequencerUI();
        }
      }

      document.querySelectorAll('.ruler-bar-tick').forEach(t => t.classList.remove('current-bar-tick'));
      const activeRuler = document.querySelector(`.ruler-bar-tick[data-bar="${tickInfo.bar}"]`);
      if (activeRuler) activeRuler.classList.add('current-bar-tick');

      document.querySelectorAll('.track-bar-slot').forEach(s => s.classList.remove('current-bar-active'));
      document.querySelectorAll(`.track-bar-slot[data-bar="${tickInfo.bar}"]`).forEach(s => s.classList.add('current-bar-active'));
    }

    // Sequencer step highlights
    document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('current-step-tick'));
    document.querySelectorAll(`.step-btn[data-step="${tickInfo.step}"]`).forEach(b => b.classList.add('current-step-tick'));
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

      // 4. If no active live recording was captured, synthesize a high-quality bounce of the active Song or Pattern
      if (!audioBase64) {
        sendDawBtn.textContent = 'RENDERING STEM...';
        try {
          const barsToRender = synth.playMode === 'SONG' ? Math.min(8, synth.songLoopBars || 4) : 2;
          const stepSec = (60 / synth.bpm) / 4;
          const totalDurSec = Math.max(2, barsToRender * 16 * stepSec + 0.5);
          const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
            2,
            Math.ceil(44100 * totalDurSec),
            44100
          );

          for (let bar = 0; bar < barsToRender; bar++) {
            const patForBar = synth.playMode === 'SONG'
              ? (synth.patterns[bar % synth.patterns.length] || synth.getActivePattern())
              : synth.getActivePattern();

            for (let stepIdx = 0; stepIdx < 16; stepIdx++) {
              const t = (bar * 16 + stepIdx) * stepSec;
              patForBar.channels.forEach(ch => {
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
                    osc.type = ch.timbre?.osc1Wave || (ch.type === 'bass' ? 'sawtooth' : 'square');
                    const note = (ch.stepNotes && ch.stepNotes[stepIdx]) ? ch.stepNotes[stepIdx] : ch.note;
                    const gateSteps = (ch.stepDurations && ch.stepDurations[stepIdx]) ? ch.stepDurations[stepIdx] : 1;
                    const noteDur = Math.max(0.12, gateSteps * stepSec * 0.88);
                    osc.frequency.setValueAtTime(synth.midiToFreq(synth.noteToMidi(note)), t);

                    const filter = offlineCtx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(ch.timbre?.cutoff || 2400, t);

                    const env = offlineCtx.createGain();
                    env.gain.setValueAtTime(0.0001, t);
                    env.gain.linearRampToValueAtTime(0.55 * (ch.volume || 0.85), t + 0.01);
                    env.gain.exponentialRampToValueAtTime(0.001, t + noteDur);

                    osc.connect(filter);
                    filter.connect(env);
                    env.connect(offlineCtx.destination);
                    osc.start(t);
                    osc.stop(t + noteDur + 0.03);
                  }
                }
              });
            }
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
              const vel = Math.max(0.2, data2 / 127);
              synth.noteOn(data1, vel);
              const keyEl = document.querySelector(`[data-midi="${data1}"]`);
              if (keyEl) keyEl.classList.add('active');
            }
            // Note Off (or Note On with 0 velocity)
            else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
              synth.noteOff(data1);
              const keyEl = document.querySelector(`[data-midi="${data1}"]`);
              if (keyEl) keyEl.classList.remove('active');
            }
            // Control Change (CC) -> Filter Cutoff (CC 1 Mod Wheel or CC 74 Cutoff) & Resonance (CC 71)
            else if (command === 0xB0) {
              const norm = data2 / 127;
              if (data1 === 1 || data1 === 74 || data1 === 16) {
                const freq = 40 * Math.pow(18000 / 40, norm);
                synth.params.filterCutoff = freq;
                const knob = document.getElementById('knob-filter-cutoff');
                if (knob) {
                  const deg = (norm * 270) - 135;
                  knob.dataset.deg = deg;
                  knob.style.transform = `rotate(${deg}deg)`;
                }
              } else if (data1 === 71 || data1 === 17) {
                const res = norm * 22;
                synth.params.filterResonance = res;
                const knob = document.getElementById('knob-filter-res');
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

// Show Studio Toast Notification
function showSynthToast(message) {
  let toast = document.getElementById('synth-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'synth-toast';
    toast.className = 'synth-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 4200);
}

// Standard MIDI File (.mid / .midi) Loader & Drag-and-Drop Engine
function initMidiFileLoader() {
  const loadBtn = document.getElementById('btn-load-midi');
  const fileInput = document.getElementById('midi-file-input');

  // Create drag-and-drop overlay
  const dropOverlay = document.createElement('div');
  dropOverlay.className = 'midi-drop-overlay';
  dropOverlay.innerHTML = `
    <div style="font-size: 40px;">🎹</div>
    <div>DROP .MID OR .MIDI FILE TO IMPORT INTO LOCALSYNTH</div>
    <div style="font-size: 12px; color: var(--accent-cyan);">AUTO-MAPS MELODY, BASSLINE, DRUMS, BPM & 16-BAR SONG PLAYLIST</div>
  `;
  document.body.appendChild(dropOverlay);

  const handleMidiFile = async (file) => {
    if (!file) return;
    try {
      // Stop any existing playback first for a completely clean slate
      if (synth.isPlaying) {
        const playBtn = document.getElementById('btn-seq-play');
        if (playBtn) playBtn.click();
      }

      const arrayBuffer = await file.arrayBuffer();
      const parsed = parseStandardMidiFile(arrayBuffer);
      const summary = mapMidiToSynthPatterns(parsed, synth, file.name);

      // Rebuild Pattern Selector dropdown completely to show all clean MIDI bars (Bar 1 .. Bar N)
      const patDropdown = document.getElementById('pattern-select-dropdown');
      if (patDropdown) {
        patDropdown.innerHTML = '';
        synth.patterns.forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name;
          patDropdown.appendChild(opt);
        });
        patDropdown.value = 'pat_1';
      }

      // Sync Preset Dropdown to the auto-detected primary MIDI instrument patch
      const presetDropdown = document.getElementById('synth-preset-dropdown');
      if (presetDropdown && summary.primaryPresetId) {
        presetDropdown.value = summary.primaryPresetId;
        const p = synth.presets.find((pr) => pr.id === summary.primaryPresetId);
        if (p) {
          const osc1El = document.getElementById('osc1-wave');
          const osc2El = document.getElementById('osc2-wave');
          if (osc1El) osc1El.value = p.params.osc1Wave;
          if (osc2El) osc2El.value = p.params.osc2Wave;
        }
      }

      // Update BPM input automatically
      const bpmInput = document.getElementById('seq-bpm');
      if (bpmInput) bpmInput.value = summary.bpm;

      // Update Brush badge
      const brushBadge = document.getElementById('brush-badge');
      if (brushBadge && synth.patterns[0]) {
        brushBadge.textContent = synth.patterns[0].name.split(':')[0];
        brushBadge.style.color = synth.patterns[0].color;
        brushBadge.style.borderColor = synth.patterns[0].color;
      }

      // Refresh Sequencer & Playlist UI with the clean separated instruments
      initSequencerUI();
      initPlaylistUI();

      // Switch to SONG mode if multiple bars were imported, or PAT mode for 1-bar loop
      const btnPat = document.getElementById('btn-mode-pat');
      const btnSong = document.getElementById('btn-mode-song');
      if (summary.activeBarCount > 1) {
        synth.playMode = 'SONG';
        if (btnPat && btnSong) {
          btnPat.classList.remove('active');
          btnSong.classList.add('active');
        }
      } else {
        synth.playMode = 'PAT';
        if (btnPat && btnSong) {
          btnPat.classList.add('active');
          btnSong.classList.remove('active');
        }
      }

      showSynthToast(
        `🎹 Clean MIDI Loaded: "${summary.cleanTitle}" · ${summary.instrumentCount} Instruments · ${summary.bpm} BPM · ${summary.activeBarCount} Bars`
      );

      // Start playing the fresh MIDI song immediately
      const playBtn = document.getElementById('btn-seq-play');
      if (playBtn && !synth.isPlaying) {
        playBtn.click();
      }
    } catch (err) {
      console.error('[MIDI Import Error]', err);
      showSynthToast(`⚠️ MIDI Load Error: ${err.message || 'Invalid .mid file'}`);
    }
  };

  if (loadBtn && fileInput) {
    loadBtn.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleMidiFile(file);
    });
  }

  const exportMidiBtn = document.getElementById('btn-export-midi');
  if (exportMidiBtn) {
    exportMidiBtn.addEventListener('click', () => {
      try {
        const blob = exportSynthToMidiBlob(synth);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LocalSynth_${synth.playMode}_${synth.bpm}BPM.mid`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showSynthToast(`💾 Exported LocalSynth_${synth.playMode}_${synth.bpm}BPM.mid`);
      } catch (e) {
        console.error('[MIDI Export Error]', e);
        showSynthToast('⚠️ Failed to export MIDI file');
      }
    });
  }

  // Global window drag-and-drop support for .mid / .midi files
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    dropOverlay.classList.add('active');
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      dropOverlay.classList.remove('active');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    dropOverlay.classList.remove('active');
    const file = e.dataTransfer?.files?.[0];
    if (file && /\.(mid|midi)$/i.test(file.name)) {
      handleMidiFile(file);
    } else if (file && /\.json$/i.test(file.name)) {
      window.dispatchEvent(new CustomEvent('localsynth-load-song-file', { detail: file }));
    } else if (file) {
      showSynthToast('⚠️ Drop a .mid / .midi file or a .localsynth.json Song file');
    }
  });
}

// 8-Pad Live MPC Drum Pad Section (Mouse Click, Touch, and Number Keys 1–8)
function initDrumPadsUI() {
  const container = document.getElementById('drum-pads-container');
  if (!container) return;

  const pads = [
    { key: '1', label: 'PUNCH 909 KICK', sample: 'kick', gm: 'NOTE 36', color: '#f97316' },
    { key: '2', label: 'STUDIO SNARE', sample: 'snare', gm: 'NOTE 38', color: '#38bdf8' },
    { key: '3', label: 'OPEN 909 HI-HAT', sample: 'hihat', gm: 'NOTE 42', color: '#06b6d4' },
    { key: '4', label: '808 SUB BOOM', sample: 'sub808', gm: 'NOTE 35', color: '#10b981' },
    { key: '5', label: 'ANALOG CLAP', sample: 'clap', gm: 'NOTE 39', color: '#a855f7' },
    { key: '6', label: 'CYMBAL CRASH', sample: 'crash', gm: 'NOTE 49', color: '#f59e0b' },
    { key: '7', label: '909 SYNTH TOM', sample: 'tom', gm: 'NOTE 45', color: '#ec4899' },
    { key: '8', label: '808 COWBELL / RIM', sample: 'rim', gm: 'NOTE 56', color: '#eab308' }
  ];

  container.innerHTML = '';

  const triggerPad = (pad, padEl, recordStep = false) => {
    synth.ensureContext();
    synth.playDrumSample(pad.sample, 0.95);
    padEl.classList.add('pad-active');
    clearTimeout(padEl._flashTimer);
    padEl._flashTimer = setTimeout(() => padEl.classList.remove('pad-active'), 140);

    // If Shift+Click or if recording/playing, optionally punch into the active pattern's matching drum channel
    if (recordStep) {
      const pat = synth.getActivePattern();
      let drumCh = pat.channels.find(c => c.type === 'drum' && c.sample === pad.sample);
      if (!drumCh) {
        drumCh = {
          id: `drum_${pad.sample}_${Date.now()}`,
          name: `🥁 ${pad.label}`,
          programId: `drum_${pad.sample}`,
          gmBadge: `GM CH 10 · ${pad.gm}`,
          type: 'drum',
          sample: pad.sample,
          volume: 0.9,
          defaultVolume: 0.9,
          mute: false,
          solo: false,
          steps: new Array(16).fill(0)
        };
        pat.channels.push(drumCh);
      }
      const stepToPunch = synth.isPlaying ? synth.currentStep : 0;
      drumCh.steps[stepToPunch] = 1;
      initSequencerUI();
      showSynthToast(`🥁 Punched ${pad.label} at Step ${stepToPunch + 1}`);
    }
  };

  pads.forEach((pad) => {
    const padBtn = document.createElement('button');
    padBtn.className = 'mpc-drum-pad';
    padBtn.dataset.sample = pad.sample;
    padBtn.dataset.key = pad.key;
    padBtn.style.setProperty('--pad-color', pad.color);
    padBtn.innerHTML = `
      <div class="mpc-pad-top">
        <span class="mpc-pad-key">[${pad.key}]</span>
        <span class="mpc-pad-gm">${pad.gm}</span>
      </div>
      <div class="mpc-pad-name">${pad.label}</div>
      <div class="mpc-pad-led"></div>
    `;

    padBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      triggerPad(pad, padBtn, e.shiftKey);
    });

    container.appendChild(padBtn);
  });

  // Keyboard shortcuts [1 - 8] for live finger drumming
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const matchedPad = pads.find(p => p.key === e.key);
    if (matchedPad) {
      const padEl = container.querySelector(`.mpc-drum-pad[data-key="${matchedPad.key}"]`);
      if (padEl) triggerPad(matchedPad, padEl, e.shiftKey);
    }
  });
}

// Add Instrument / Add Drum / Clear Pattern / Add Playlist Track Row Actions
function initRackAndPlaylistActions() {
  const addSynthBtn = document.getElementById('btn-add-synth-ch');
  const addDrumBtn = document.getElementById('btn-add-drum-ch');
  const clearPatBtn = document.getElementById('btn-clear-pattern');
  const addPlaylistTrackBtn = document.getElementById('btn-add-playlist-track');

  if (addSynthBtn) {
    addSynthBtn.addEventListener('click', () => {
      const defaultSpec = INSTRUMENT_CATALOG.find(i => i.programId === 'prog_81_saw') || INSTRUMENT_CATALOG[0];
      synth.patterns.forEach((pat) => {
        pat.channels.push({
          id: `custom_synth_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: defaultSpec.label,
          programId: defaultSpec.programId,
          gmBadge: defaultSpec.gmBadge,
          type: 'synth',
          note: 'C4',
          stepNotes: new Array(16).fill('C4'),
          stepDurations: new Array(16).fill(1),
          timbre: { ...defaultSpec.timbre },
          volume: 0.85,
          defaultVolume: 0.85,
          mute: false,
          solo: false,
          steps: new Array(16).fill(0)
        });
      });
      initSequencerUI();
      const rack = document.getElementById('step-channels-container');
      if (rack) rack.scrollTop = rack.scrollHeight;
      showSynthToast('🎹 Added new Instrument Track (use dropdown on row to switch Program)');
    });
  }

  if (addDrumBtn) {
    addDrumBtn.addEventListener('click', () => {
      const drumSpec = INSTRUMENT_CATALOG.find(i => i.programId === 'drum_tom') || INSTRUMENT_CATALOG[11];
      synth.patterns.forEach((pat) => {
        pat.channels.push({
          id: `custom_drum_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: drumSpec.label,
          programId: drumSpec.programId,
          gmBadge: drumSpec.gmBadge,
          type: 'drum',
          sample: drumSpec.sample || 'tom',
          volume: 0.85,
          defaultVolume: 0.85,
          mute: false,
          solo: false,
          steps: new Array(16).fill(0)
        });
      });
      initSequencerUI();
      const rack = document.getElementById('step-channels-container');
      if (rack) rack.scrollTop = rack.scrollHeight;
      showSynthToast('🥁 Added new Drum Track to Channel Rack');
    });
  }

  if (clearPatBtn) {
    clearPatBtn.addEventListener('click', () => {
      const pat = synth.getActivePattern();
      pat.channels.forEach(ch => {
        ch.steps = new Array(16).fill(0);
      });
      initSequencerUI();
      showSynthToast(`🧹 Cleared all steps in ${pat.name}`);
    });
  }

  if (addPlaylistTrackBtn) {
    addPlaylistTrackBtn.addEventListener('click', () => {
      const nextNum = synth.playlistTracks.length + 1;
      synth.playlistTracks.push({
        id: `track_${nextNum}_${Date.now()}`,
        name: `Track ${nextNum} (Custom Layer)`,
        bars: new Array(16).fill(null)
      });
      initPlaylistUI();
      const plBody = document.getElementById('playlist-container');
      if (plBody) plBody.scrollTop = plBody.scrollHeight;
      showSynthToast(`➕ Added Track ${nextNum} to Song Playlist Arranger`);
    });
  }
}

// Complete Platform Song Project Save & Load Engine (.localsynth.json + Browser LocalStorage Song Library)
function initSongSaveLoadSystem() {
  const saveSongBtn = document.getElementById('btn-save-song');
  const loadSongBtn = document.getElementById('btn-load-song');
  const songFileInput = document.getElementById('song-file-input');
  const savedSongsDropdown = document.getElementById('saved-songs-dropdown');
  const STORAGE_KEY = 'localsynth_saved_songs_v1';

  const getSavedSongsBank = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const refreshSavedSongsDropdown = () => {
    if (!savedSongsDropdown) return;
    const bank = getSavedSongsBank();
    savedSongsDropdown.innerHTML = '<option value="">💿 SAVED SONGS...</option>';
    bank.forEach((song, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `🎵 ${song.title} (${song.bpm} BPM)`;
      savedSongsDropdown.appendChild(opt);
    });
  };

  const buildSongProjectData = (title) => ({
    format: 'LOCALSYNTH_SONG_V2',
    title: title || 'LocalSynth Studio Song',
    savedAt: new Date().toISOString(),
    bpm: synth.bpm,
    playMode: synth.playMode,
    songLoopBars: synth.songLoopBars || synth.totalBars,
    activePatternId: synth.activePatternId,
    params: { ...synth.params },
    patterns: JSON.parse(JSON.stringify(synth.patterns)),
    playlistTracks: JSON.parse(JSON.stringify(synth.playlistTracks))
  });

  const applySongProjectData = (project) => {
    if (!project || !Array.isArray(project.patterns)) {
      throw new Error('Invalid LocalSynth Song file');
    }

    if (synth.isPlaying) {
      const playBtn = document.getElementById('btn-seq-play');
      if (playBtn) playBtn.click();
    }

    synth.bpm = parseInt(project.bpm, 10) || 128;
    synth.playMode = project.playMode || 'SONG';
    synth.songLoopBars = project.songLoopBars || 16;
    synth.patterns = project.patterns;
    synth.activePatternId = project.activePatternId || (synth.patterns[0]?.id || 'pat_1');

    if (Array.isArray(project.playlistTracks)) {
      synth.playlistTracks = project.playlistTracks;
    }
    if (project.params) {
      Object.assign(synth.params, project.params);
    }

    // Sync Pattern Dropdown
    const patDropdown = document.getElementById('pattern-select-dropdown');
    if (patDropdown) {
      patDropdown.innerHTML = '';
      synth.patterns.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        patDropdown.appendChild(opt);
      });
      patDropdown.value = synth.activePatternId;
    }

    // Sync BPM Input
    const bpmInput = document.getElementById('seq-bpm');
    if (bpmInput) bpmInput.value = synth.bpm;

    // Sync Mode Buttons
    const btnPat = document.getElementById('btn-mode-pat');
    const btnSong = document.getElementById('btn-mode-song');
    if (btnPat && btnSong) {
      btnPat.classList.toggle('active', synth.playMode === 'PAT');
      btnSong.classList.toggle('active', synth.playMode === 'SONG');
    }

    // Sync Brush Badge
    const brushBadge = document.getElementById('brush-badge');
    const activePat = synth.getActivePattern();
    if (brushBadge && activePat) {
      brushBadge.textContent = activePat.name.split(':')[0];
      brushBadge.style.color = activePat.color;
      brushBadge.style.borderColor = activePat.color;
    }

    initSequencerUI();
    initPlaylistUI();
    showSynthToast(`💿 Loaded Song "${project.title || 'Project'}" (${synth.bpm} BPM)`);
  };

  if (saveSongBtn) {
    saveSongBtn.addEventListener('click', () => {
      const defaultName = synth.patterns[0]?.name?.split(':')[1]?.trim() || 'My LocalSynth Track';
      const songTitle = prompt('Enter a title to save your Song Project:', defaultName);
      if (!songTitle || !songTitle.trim()) return;

      const project = buildSongProjectData(songTitle.trim());

      // 1. Save to Browser LocalStorage Song Bank
      try {
        const bank = getSavedSongsBank().filter(s => s.title !== project.title);
        bank.unshift(project);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bank.slice(0, 25)));
        refreshSavedSongsDropdown();
      } catch (e) {}

      // 2. Also download portable .localsynth.json file to computer
      const jsonStr = JSON.stringify(project, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = project.title.replace(/[^a-z0-9_-]/gi, '_');
      a.download = `${safeName}.localsynth.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showSynthToast(`💾 Saved Song "${project.title}" to Browser Bank & downloaded .localsynth.json`);
    });
  }

  if (loadSongBtn && songFileInput) {
    loadSongBtn.addEventListener('click', () => {
      songFileInput.value = '';
      songFileInput.click();
    });

    songFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const project = JSON.parse(text);
        applySongProjectData(project);
      } catch (err) {
        showSynthToast(`⚠️ Could not load song file: ${err.message}`);
      }
    });
  }

  window.addEventListener('localsynth-load-song-file', async (e) => {
    const file = e.detail;
    if (!file) return;
    try {
      const text = await file.text();
      const project = JSON.parse(text);
      applySongProjectData(project);
    } catch (err) {
      showSynthToast(`⚠️ Could not load song file: ${err.message}`);
    }
  });

  if (savedSongsDropdown) {
    savedSongsDropdown.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value, 10);
      if (isNaN(idx)) return;
      const bank = getSavedSongsBank();
      if (bank[idx]) {
        applySongProjectData(bank[idx]);
      }
    });
  }

  refreshSavedSongsDropdown();
}

// Boot System
window.addEventListener('DOMContentLoaded', () => {
  initSplashScreen();
  initSequencerUI();
  initPlaylistUI();
  initDrumPadsUI();
  initKeyboardUI();
  initKnobs();
  initTransport();
  initRackAndPlaylistActions();
  initSongSaveLoadSystem();
  initMIDI();
  initMidiFileLoader();
  startOscilloscope();
});



