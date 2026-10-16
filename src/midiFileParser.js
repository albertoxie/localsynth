// LocalSynth Native Binary Standard MIDI File (.mid / .midi) Parser & Song Importer
// Supports SMF Format 0 and Format 1, variable-length delta times, running status, tempo meta events (0x51),
// polyphonic melody/bass extraction, and General MIDI Channel 10 (index 9) drum mapping.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiNumberToName(midiNum) {
  const clamped = Math.max(12, Math.min(108, Math.round(midiNum)));
  const octave = Math.floor(clamped / 12) - 1;
  const note = NOTE_NAMES[clamped % 12];
  return `${note}${octave}`;
}

export function parseStandardMidiFile(arrayBuffer) {
  const data = new DataView(arrayBuffer);
  let pos = 0;

  const readString = (len) => {
    let str = '';
    for (let i = 0; i < len; i++) {
      str += String.fromCharCode(data.getUint8(pos++));
    }
    return str;
  };

  const readVarLen = () => {
    let value = 0;
    while (pos < data.byteLength) {
      const b = data.getUint8(pos++);
      value = (value << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
    return value;
  };

  // 1. Validate MThd header
  const headerId = readString(4);
  if (headerId !== 'MThd') {
    throw new Error('Invalid MIDI file: Missing MThd header');
  }

  const headerLen = data.getUint32(pos, false);
  pos += 4;
  const format = data.getUint16(pos, false);
  const numTracks = data.getUint16(pos + 2, false);
  const timeDivision = data.getUint16(pos + 4, false);
  pos += headerLen;

  // Ticks per quarter note
  let ticksPerBeat = 480;
  if ((timeDivision & 0x8000) === 0) {
    ticksPerBeat = timeDivision || 480;
  }

  let detectedBpm = 128;
  let foundTempo = false;
  const rawNotes = []; // { tick, midi, velocity, channel, durationTicks, trackIndex, trackName }

  // 2. Parse each MTrk chunk
  for (let t = 0; t < numTracks && pos < data.byteLength; t++) {
    if (pos + 8 > data.byteLength) break;
    const chunkId = readString(4);
    const chunkLen = data.getUint32(pos, false);
    pos += 4;

    if (chunkId !== 'MTrk') {
      pos += chunkLen;
      continue;
    }

    const trackEnd = Math.min(data.byteLength, pos + chunkLen);
    let currentTick = 0;
    let runningStatus = 0;
    let trackName = `Track ${t + 1}`;
    const openNotes = new Map(); // key: `${channel}_${midi}` -> { tick, velocity }

    while (pos < trackEnd) {
      const delta = readVarLen();
      currentTick += delta;
      if (pos >= trackEnd) break;

      let statusByte = data.getUint8(pos);
      if (statusByte >= 0x80) {
        pos++;
        // Do not overwrite runningStatus for System Common / Real-Time messages
        if (statusByte < 0xf0) {
          runningStatus = statusByte;
        }
      } else {
        statusByte = runningStatus;
      }

      if (statusByte === 0xff) {
        // Meta Event
        if (pos >= trackEnd) break;
        const metaType = data.getUint8(pos++);
        const metaLen = readVarLen();
        if (metaType === 0x51 && metaLen === 3 && !foundTempo && pos + 3 <= trackEnd) {
          const mpqn = (data.getUint8(pos) << 16) | (data.getUint8(pos + 1) << 8) | data.getUint8(pos + 2);
          if (mpqn > 0) {
            const bpm = Math.round(60000000 / mpqn);
            if (bpm >= 45 && bpm <= 240) {
              detectedBpm = bpm;
              foundTempo = true;
            }
          }
        } else if (metaType === 0x03 && metaLen > 0 && pos + metaLen <= trackEnd) {
          let nameStr = '';
          for (let i = 0; i < metaLen; i++) {
            const chCode = data.getUint8(pos + i);
            if (chCode >= 32 && chCode <= 126) nameStr += String.fromCharCode(chCode);
          }
          if (nameStr.trim()) trackName = nameStr.trim();
        }
        pos += metaLen;
      } else if (statusByte === 0xf0 || statusByte === 0xf7) {
        // SysEx Event
        const sysexLen = readVarLen();
        pos += sysexLen;
      } else {
        const cmd = statusByte & 0xf0;
        const ch = statusByte & 0x0f;

        if (cmd === 0x90) {
          const note = data.getUint8(pos++);
          const vel = data.getUint8(pos++);
          const key = `${ch}_${note}`;
          if (vel > 0) {
            openNotes.set(key, { tick: currentTick, velocity: vel });
          } else {
            const startObj = openNotes.get(key);
            if (startObj) {
              rawNotes.push({
                tick: startObj.tick,
                midi: note,
                velocity: startObj.velocity,
                channel: ch,
                durationTicks: Math.max(1, currentTick - startObj.tick),
                trackIndex: t,
                trackName
              });
              openNotes.delete(key);
            }
          }
        } else if (cmd === 0x80) {
          const note = data.getUint8(pos++);
          const _vel = data.getUint8(pos++);
          const key = `${ch}_${note}`;
          const startObj = openNotes.get(key);
          if (startObj) {
            rawNotes.push({
              tick: startObj.tick,
              midi: note,
              velocity: startObj.velocity,
              channel: ch,
              durationTicks: Math.max(1, currentTick - startObj.tick),
              trackIndex: t,
              trackName
            });
            openNotes.delete(key);
          }
        } else if (cmd === 0xc0 || cmd === 0xd0) {
          pos += 1;
        } else if (cmd === 0xa0 || cmd === 0xb0 || cmd === 0xe0) {
          pos += 2;
        } else {
          // Unknown byte safety advance
          pos += 1;
        }
      }
    }

    // Close any lingering notes at track end
    openNotes.forEach((startObj, key) => {
      const [chStr, noteStr] = key.split('_');
      rawNotes.push({
        tick: startObj.tick,
        midi: parseInt(noteStr, 10),
        velocity: startObj.velocity,
        channel: parseInt(chStr, 10),
        durationTicks: Math.max(ticksPerBeat / 4, currentTick - startObj.tick),
        trackIndex: t,
        trackName
      });
    });

    pos = trackEnd;
  }

  return {
    format,
    numTracks,
    ticksPerBeat,
    bpm: detectedBpm,
    notes: rawNotes.sort((a, b) => a.tick - b.tick)
  };
}

// Convert parsed MIDI notes into up to 4 FL Studio 16-step Patterns + 16-Bar Playlist Arrangement
export function mapMidiToSynthPatterns(parsedMidi, synth, fileName = 'MIDI Track') {
  const { ticksPerBeat, bpm, notes } = parsedMidi;
  if (!notes || notes.length === 0) {
    throw new Error('No playable MIDI notes found in this file.');
  }

  // Normalize start offset so the first active note begins cleanly at Bar 1
  const minTick = notes[0].tick;
  const ticksPer16th = ticksPerBeat / 4;
  const ticksPerBar = ticksPer16th * 16;

  // Snap minTick down to the nearest bar boundary so pickup/groove alignment stays intact
  const startBarOffsetTick = Math.floor(minTick / ticksPerBar) * ticksPerBar;

  // Group events into 16-step bars (up to 16 bars total)
  const barData = Array.from({ length: 16 }, () => ({
    leadSteps: new Array(16).fill(0),
    leadNotes: new Array(16).fill('C4'),
    bassSteps: new Array(16).fill(0),
    bassNotes: new Array(16).fill('C2'),
    kickSteps: new Array(16).fill(0),
    snareSteps: new Array(16).fill(0),
    hihatSteps: new Array(16).fill(0),
    sub808Steps: new Array(16).fill(0),
    clapSteps: new Array(16).fill(0),
    crashSteps: new Array(16).fill(0),
    eventCount: 0
  }));

  notes.forEach((n) => {
    const relTick = Math.max(0, n.tick - startBarOffsetTick);
    const totalStepIndex = Math.round(relTick / ticksPer16th);
    const barIdx = Math.floor(totalStepIndex / 16);
    const stepIdx = totalStepIndex % 16;

    if (barIdx < 0 || barIdx >= 16) return;
    const bar = barData[barIdx];
    bar.eventCount++;

    // General MIDI Channel 10 (0-indexed channel 9) is Percussion/Drums
    if (n.channel === 9) {
      if (n.midi === 35 || n.midi === 36) {
        bar.kickSteps[stepIdx] = 1;
      } else if (n.midi === 38 || n.midi === 40 || n.midi === 37) {
        bar.snareSteps[stepIdx] = 1;
      } else if (n.midi === 39) {
        bar.clapSteps[stepIdx] = 1;
      } else if (n.midi === 42 || n.midi === 44 || n.midi === 46) {
        bar.hihatSteps[stepIdx] = 1;
      } else if (n.midi === 49 || n.midi === 51 || n.midi === 55 || n.midi === 57) {
        bar.crashSteps[stepIdx] = 1;
      } else if (n.midi <= 45) {
        bar.sub808Steps[stepIdx] = 1;
      } else {
        bar.hihatSteps[stepIdx] = 1;
      }
    } else {
      // Melodic note: split into Bass (< 55 / G3) vs Synth Lead (>= 55)
      const noteName = midiNumberToName(n.midi);
      if (n.midi < 55) {
        bar.bassSteps[stepIdx] = 1;
        bar.bassNotes[stepIdx] = noteName;
      } else {
        bar.leadSteps[stepIdx] = 1;
        bar.leadNotes[stepIdx] = noteName;
      }
    }
  });

  // Find active bars with notes
  const activeBars = barData
    .map((b, idx) => ({ ...b, barIdx: idx }))
    .filter((b) => b.eventCount > 0);

  if (activeBars.length === 0) {
    throw new Error('MIDI notes fell outside playable range.');
  }

  // If the MIDI file didn't include drum tracks, generate a tasteful backing groove on Kick & HiHat so it's immediately fun
  const hasAnyDrums = activeBars.some((b) =>
    b.kickSteps.some(Boolean) || b.snareSteps.some(Boolean) || b.hihatSteps.some(Boolean)
  );

  // Build up to 3 distinct patterns from the active bars of the MIDI file
  const cleanTitle = fileName.replace(/\.(mid|midi)$/i, '').substring(0, 18);
  const patternColors = ['#f97316', '#06b6d4', '#a855f7'];
  const selectedBars = [
    activeBars[0],
    activeBars[Math.min(1, activeBars.length - 1)],
    activeBars[Math.min(2, activeBars.length - 1)]
  ];

  // If all melodic notes ended up in Lead and Bass is empty, mirror root bass notes an octave down on beat steps
  selectedBars.forEach((b) => {
    const hasBass = b.bassSteps.some(Boolean);
    const hasLead = b.leadSteps.some(Boolean);
    if (!hasBass && hasLead) {
      for (let s = 0; s < 16; s += 2) {
        if (b.leadSteps[s]) {
          b.bassSteps[s] = 1;
          const m = synth.noteToMidi(b.leadNotes[s]);
          b.bassNotes[s] = midiNumberToName(Math.max(36, m - 24));
        }
      }
    } else if (hasBass && !hasLead) {
      for (let s = 0; s < 16; s++) {
        if (b.bassSteps[s]) {
          b.leadSteps[s] = 1;
          const m = synth.noteToMidi(b.bassNotes[s]);
          b.leadNotes[s] = midiNumberToName(Math.min(84, m + 12));
        }
      }
    }

    if (!hasAnyDrums) {
      b.kickSteps = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
      b.hihatSteps = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
    }
  });

  // Update synth patterns
  selectedBars.forEach((barSource, idx) => {
    const patId = `pat_${idx + 1}`;
    const existingPat = synth.patterns.find((p) => p.id === patId);
    if (existingPat) {
      existingPat.name = `Pattern ${idx + 1}: ${cleanTitle} (Bar ${barSource.barIdx + 1})`;
      existingPat.color = patternColors[idx % patternColors.length];
      existingPat.channels = synth.createDefaultChannels([
        [...barSource.leadSteps],
        [...barSource.bassSteps],
        [...barSource.kickSteps],
        [...barSource.snareSteps],
        [...barSource.hihatSteps],
        [...barSource.sub808Steps],
        [...barSource.clapSteps],
        [...barSource.crashSteps]
      ]);
      // Populate per-step note pitches
      existingPat.channels[0].stepNotes = [...barSource.leadNotes];
      existingPat.channels[1].stepNotes = [...barSource.bassNotes];
    }
  });

  // Populate the 16-Bar Song Playlist Arranger to cycle through the imported MIDI bars
  synth.playlistTracks[0].bars = Array.from({ length: 16 }, (_, i) => `pat_${(i % Math.min(3, activeBars.length)) + 1}`);
  synth.playlistTracks[1].bars = Array.from({ length: 16 }, (_, i) => `pat_${(i % Math.min(3, activeBars.length)) + 1}`);
  synth.playlistTracks[2].bars = Array.from({ length: 16 }, (_, i) => `pat_${(i % Math.min(3, activeBars.length)) + 1}`);
  synth.playlistTracks[3].bars = Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? 'pat_1' : null));

  synth.bpm = bpm;
  synth.activePatternId = 'pat_1';

  return {
    bpm,
    noteCount: notes.length,
    activeBarCount: activeBars.length,
    cleanTitle
  };
}

// Export current LocalSynth Pattern or 16-Bar Song Arrangement to a binary Standard MIDI File (.mid)
export function exportSynthToMidiBlob(synth) {
  const ticksPerBeat = 480;
  const ticksPer16th = ticksPerBeat / 4; // 120 ticks per step
  const events = []; // { tick, bytes }

  // 1. Add Tempo Meta Event (FF 51 03 tt tt tt) at tick 0
  const mpqn = Math.round(60000000 / (synth.bpm || 128));
  events.push({
    tick: 0,
    bytes: [0xff, 0x51, 0x03, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff]
  });

  const drumSampleToGM = {
    kick: 36,
    snare: 38,
    hihat: 42,
    sub808: 35,
    clap: 39,
    crash: 49
  };

  const totalBarsToExport = synth.playMode === 'SONG' ? synth.totalBars : 2;

  for (let bar = 0; bar < totalBarsToExport; bar++) {
    let patternsAtBar = [];
    if (synth.playMode === 'PAT') {
      patternsAtBar = [synth.getActivePattern()];
    } else {
      const ids = new Set();
      synth.playlistTracks.forEach((tr) => {
        if (tr.bars[bar]) ids.add(tr.bars[bar]);
      });
      ids.forEach((id) => {
        const p = synth.patterns.find((pat) => pat.id === id);
        if (p) patternsAtBar.push(p);
      });
    }

    for (let step = 0; step < 16; step++) {
      const stepStartTick = (bar * 16 + step) * ticksPer16th;
      const stepEndTick = stepStartTick + Math.floor(ticksPer16th * 0.85);

      patternsAtBar.forEach((pat) => {
        pat.channels.forEach((ch) => {
          if (ch.mute || ch.steps[step] !== 1) return;
          const vel = Math.max(1, Math.min(127, Math.round((ch.volume || 0.85) * 115)));

          if (ch.type === 'synth' || ch.type === 'bass') {
            const noteStr = (ch.stepNotes && ch.stepNotes[step]) ? ch.stepNotes[step] : ch.note;
            const midiNote = synth.noteToMidi(noteStr);
            const midiChannel = ch.type === 'bass' ? 1 : 0;
            events.push({ tick: stepStartTick, bytes: [0x90 | midiChannel, midiNote, vel] });
            events.push({ tick: stepEndTick, bytes: [0x80 | midiChannel, midiNote, 0] });
          } else if (ch.type === 'drum') {
            const gmNote = drumSampleToGM[ch.sample] || 42;
            events.push({ tick: stepStartTick, bytes: [0x99, gmNote, vel] });
            events.push({ tick: stepEndTick, bytes: [0x89, gmNote, 0] });
          }
        });
      });
    }
  }

  // Sort events chronologically
  events.sort((a, b) => a.tick - b.tick);

  // Encode variable-length quantity
  const encodeVarLen = (val) => {
    let buffer = val & 0x7f;
    const out = [];
    while ((val >>= 7)) {
      buffer <<= 8;
      buffer |= (val & 0x7f) | 0x80;
    }
    while (true) {
      out.push(buffer & 0xff);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
    return out;
  };

  const trackBytes = [];
  let lastTick = 0;
  events.forEach((ev) => {
    const delta = Math.max(0, ev.tick - lastTick);
    lastTick = ev.tick;
    trackBytes.push(...encodeVarLen(delta), ...ev.bytes);
  });

  // End of Track Meta Event (FF 2F 00)
  trackBytes.push(0x00, 0xff, 0x2f, 0x00);

  // Build MThd (14 bytes) + MTrk header (8 bytes) + trackBytes
  const totalLength = 14 + 8 + trackBytes.length;
  const outBuf = new Uint8Array(totalLength);
  const view = new DataView(outBuf.buffer);

  // MThd
  outBuf.set([0x4d, 0x54, 0x68, 0x64], 0);
  view.setUint32(4, 6, false);
  view.setUint16(8, 0, false); // Format 0
  view.setUint16(10, 1, false); // 1 Track
  view.setUint16(12, ticksPerBeat, false);

  // MTrk
  outBuf.set([0x4d, 0x54, 0x72, 0x6b], 14);
  view.setUint32(18, trackBytes.length, false);
  outBuf.set(trackBytes, 22);

  return new Blob([outBuf], { type: 'audio/midi' });
}

