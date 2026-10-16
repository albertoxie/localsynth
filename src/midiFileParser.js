// LocalSynth Native Binary Standard MIDI File (.mid / .midi) Parser, General MIDI Instrument Detector & Multi-Track Song Mapper
// Supports SMF Format 0 & Format 1, Program Change (0xC0) GM Instrument Recognition, Tempo Meta (0x51),
// Clean Multi-Track Instrument Separation, and 16-Bar Song Arrangement.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Complete Selectable Instrument & Program Catalog for per-channel dropdown selector
export const INSTRUMENT_CATALOG = [
  {
    programId: 'prog_00_piano',
    gmNumber: 0,
    gmBadge: 'PROG 000 · GRAND PIANO',
    label: '🎹 Grand Piano / Rhodes',
    type: 'synth',
    color: '#38bdf8',
    presetId: 'fm_pluck',
    timbre: {
      osc1Wave: 'triangle', osc1Octave: 0, osc1Gain: 0.75,
      osc2Wave: 'sine', osc2Octave: 1, osc2Gain: 0.4, detune: 6,
      cutoff: 3400, resonance: 2.2, envMod: 2600,
      attack: 0.008, decay: 0.35, release: 0.25
    }
  },
  {
    programId: 'prog_11_bells',
    gmNumber: 11,
    gmBadge: 'PROG 011 · VIBES / BELLS',
    label: '🔔 Vibraphone & Chimes',
    type: 'synth',
    color: '#e879f9',
    presetId: 'glass_chimes',
    timbre: {
      osc1Wave: 'sine', osc1Octave: 0, osc1Gain: 0.8,
      osc2Wave: 'triangle', osc2Octave: 1, osc2Gain: 0.5, detune: 12,
      cutoff: 5200, resonance: 3.5, envMod: 3200,
      attack: 0.005, decay: 0.28, release: 0.35
    }
  },
  {
    programId: 'prog_16_organ',
    gmNumber: 16,
    gmBadge: 'PROG 016 · DRAWBAR ORGAN',
    label: '🎹 Hammond Drawbar Organ',
    type: 'synth',
    color: '#fbbf24',
    presetId: 'juno_pad',
    timbre: {
      osc1Wave: 'sine', osc1Octave: 0, osc1Gain: 0.75,
      osc2Wave: 'square', osc2Octave: 1, osc2Gain: 0.35, detune: 5,
      cutoff: 2800, resonance: 1.8, envMod: 900,
      attack: 0.015, decay: 0.3, release: 0.2
    }
  },
  {
    programId: 'prog_27_guitar',
    gmNumber: 27,
    gmBadge: 'PROG 027 · SYNTH GUITAR',
    label: '🎸 Pluck / Lead Guitar',
    type: 'synth',
    color: '#f97316',
    presetId: 'daft_funk_lead',
    timbre: {
      osc1Wave: 'sawtooth', osc1Octave: 0, osc1Gain: 0.75,
      osc2Wave: 'square', osc2Octave: 0, osc2Gain: 0.55, detune: 10,
      cutoff: 3200, resonance: 4.5, envMod: 2800,
      attack: 0.008, decay: 0.25, release: 0.2
    }
  },
  {
    programId: 'prog_38_acid',
    gmNumber: 38,
    gmBadge: 'PROG 038 · 303 ACID BASS',
    label: '🎸 TB-303 Acid / Sub Bass',
    type: 'bass',
    color: '#10b981',
    presetId: 'acid_303',
    timbre: {
      osc1Wave: 'sawtooth', osc1Octave: 0, osc1Gain: 0.85,
      osc2Wave: 'square', osc2Octave: -1, osc2Gain: 0.55, detune: 4,
      cutoff: 850, resonance: 7.5, envMod: 3400,
      attack: 0.008, decay: 0.22, release: 0.14
    }
  },
  {
    programId: 'prog_39_reese',
    gmNumber: 39,
    gmBadge: 'PROG 039 · REESE SUB BASS',
    label: '🎸 Cyberpunk Reese Bass',
    type: 'bass',
    color: '#10b981',
    presetId: 'cyberpunk_reese',
    timbre: {
      osc1Wave: 'sawtooth', osc1Octave: -1, osc1Gain: 0.85,
      osc2Wave: 'sawtooth', osc2Octave: -1, osc2Gain: 0.8, detune: 22,
      cutoff: 920, resonance: 4.0, envMod: 2200,
      attack: 0.02, decay: 0.35, release: 0.25
    }
  },
  {
    programId: 'prog_48_strings',
    gmNumber: 48,
    gmBadge: 'PROG 048 · STRING ENSEMBLE',
    label: '🎻 Analog String Ensemble',
    type: 'synth',
    color: '#a855f7',
    presetId: 'juno_pad',
    timbre: {
      osc1Wave: 'sawtooth', osc1Octave: 0, osc1Gain: 0.65,
      osc2Wave: 'sawtooth', osc2Octave: 0, osc2Gain: 0.65, detune: 18,
      cutoff: 2400, resonance: 2.0, envMod: 1600,
      attack: 0.06, decay: 0.45, release: 0.4
    }
  },
  {
    programId: 'prog_62_brass',
    gmNumber: 62,
    gmBadge: 'PROG 062 · CS-80 BRASS',
    label: '🎺 CS-80 Synth Brass',
    type: 'synth',
    color: '#f59e0b',
    presetId: 'blade_runner_brass',
    timbre: {
      osc1Wave: 'sawtooth', osc1Octave: 0, osc1Gain: 0.75,
      osc2Wave: 'sawtooth', osc2Octave: 0, osc2Gain: 0.7, detune: 15,
      cutoff: 1800, resonance: 3.2, envMod: 3600,
      attack: 0.035, decay: 0.4, release: 0.3
    }
  },
  {
    programId: 'prog_80_square',
    gmNumber: 80,
    gmBadge: 'PROG 080 · SQUARE LEAD',
    label: '⚡ 8-Bit / Square Lead',
    type: 'synth',
    color: '#f97316',
    presetId: 'daft_funk_lead',
    timbre: {
      osc1Wave: 'square', osc1Octave: 0, osc1Gain: 0.8,
      osc2Wave: 'sawtooth', osc2Octave: 0, osc2Gain: 0.5, detune: 8,
      cutoff: 3400, resonance: 4.5, envMod: 3200,
      attack: 0.008, decay: 0.25, release: 0.2
    }
  },
  {
    programId: 'prog_81_saw',
    gmNumber: 81,
    gmBadge: 'PROG 081 · SAWTOOTH LEAD',
    label: '⚡ Dual Sawtooth Lead',
    type: 'synth',
    color: '#f97316',
    presetId: 'init_saw',
    timbre: {
      osc1Wave: 'sawtooth', osc1Octave: 0, osc1Gain: 0.8,
      osc2Wave: 'sawtooth', osc2Octave: 0, osc2Gain: 0.65, detune: 12,
      cutoff: 3200, resonance: 4.2, envMod: 3400,
      attack: 0.01, decay: 0.28, release: 0.22
    }
  },
  {
    programId: 'prog_89_pad',
    gmNumber: 89,
    gmBadge: 'PROG 089 · WARM JUNO PAD',
    label: '🌌 Warm Juno-106 Pad',
    type: 'synth',
    color: '#06b6d4',
    presetId: 'juno_pad',
    timbre: {
      osc1Wave: 'sawtooth', osc1Octave: 0, osc1Gain: 0.6,
      osc2Wave: 'triangle', osc2Octave: 1, osc2Gain: 0.55, detune: 16,
      cutoff: 1900, resonance: 2.5, envMod: 1800,
      attack: 0.05, decay: 0.5, release: 0.45
    }
  },
  // Drum Kit Programs
  { programId: 'drum_kick', gmNumber: 36, gmBadge: 'GM CH 10 · NOTE 36', label: '🥁 909 Punch Kick', type: 'drum', sample: 'kick', color: '#f97316' },
  { programId: 'drum_snare', gmNumber: 38, gmBadge: 'GM CH 10 · NOTE 38', label: '🥁 Studio Snare', type: 'drum', sample: 'snare', color: '#38bdf8' },
  { programId: 'drum_hihat', gmNumber: 42, gmBadge: 'GM CH 10 · NOTE 42', label: '🥁 Open 909 Hi-Hat', type: 'drum', sample: 'hihat', color: '#06b6d4' },
  { programId: 'drum_808', gmNumber: 35, gmBadge: 'GM CH 10 · NOTE 35', label: '🥁 Boom 808 Sub-Bass', type: 'drum', sample: 'sub808', color: '#10b981' },
  { programId: 'drum_clap', gmNumber: 39, gmBadge: 'GM CH 10 · NOTE 39', label: '🥁 Analog Handclap', type: 'drum', sample: 'clap', color: '#a855f7' },
  { programId: 'drum_crash', gmNumber: 49, gmBadge: 'GM CH 10 · NOTE 49', label: '🥁 Cymbal Crash', type: 'drum', sample: 'crash', color: '#f59e0b' },
  { programId: 'drum_tom', gmNumber: 45, gmBadge: 'GM CH 10 · NOTE 45', label: '🥁 909 Synth Tom', type: 'drum', sample: 'tom', color: '#ec4899' },
  { programId: 'drum_rim', gmNumber: 56, gmBadge: 'GM CH 10 · NOTE 56', label: '🥁 808 Cowbell / Rim', type: 'drum', sample: 'rim', color: '#eab308' }
];

// General MIDI 128 Instrument Families & Dedicated Synth Timbres
export function getGmInstrumentSpec(programNumber = 0, channel = 0, avgPitch = 60, trackTitle = '') {
  const prog = Math.max(0, Math.min(127, programNumber || 0));
  const progStr = String(prog).padStart(3, '0');
  const lowerTitle = (trackTitle || '').toLowerCase();

  if (channel === 9) {
    return {
      ...INSTRUMENT_CATALOG.find(i => i.programId === 'drum_kick'),
      gmBadge: `GM CH 10 · DRUM KIT`
    };
  }

  if ((prog >= 32 && prog <= 39) || lowerTitle.includes('bass') || avgPitch < 48) {
    const spec = INSTRUMENT_CATALOG.find(i => i.programId === (prog === 39 ? 'prog_39_reese' : 'prog_38_acid'));
    return { ...spec, gmBadge: `PROG ${progStr} · BASS` };
  }
  if (prog >= 0 && prog <= 7) {
    const spec = INSTRUMENT_CATALOG.find(i => i.programId === 'prog_00_piano');
    return { ...spec, gmBadge: `PROG ${progStr} · KEYS` };
  }
  if (prog >= 8 && prog <= 15) {
    const spec = INSTRUMENT_CATALOG.find(i => i.programId === 'prog_11_bells');
    return { ...spec, gmBadge: `PROG ${progStr} · BELLS` };
  }
  if (prog >= 16 && prog <= 23) {
    const spec = INSTRUMENT_CATALOG.find(i => i.programId === 'prog_16_organ');
    return { ...spec, gmBadge: `PROG ${progStr} · ORGAN` };
  }
  if (prog >= 24 && prog <= 31) {
    const spec = INSTRUMENT_CATALOG.find(i => i.programId === 'prog_27_guitar');
    return { ...spec, gmBadge: `PROG ${progStr} · GUITAR` };
  }
  if (prog >= 40 && prog <= 55) {
    const spec = INSTRUMENT_CATALOG.find(i => i.programId === 'prog_48_strings');
    return { ...spec, gmBadge: `PROG ${progStr} · STRINGS` };
  }
  if (prog >= 56 && prog <= 63) {
    const spec = INSTRUMENT_CATALOG.find(i => i.programId === 'prog_62_brass');
    return { ...spec, gmBadge: `PROG ${progStr} · BRASS` };
  }
  if (prog === 80) {
    const spec = INSTRUMENT_CATALOG.find(i => i.programId === 'prog_80_square');
    return { ...spec, gmBadge: `PROG ${progStr} · SQ LEAD` };
  }
  if (prog >= 81 && prog <= 87) {
    const spec = INSTRUMENT_CATALOG.find(i => i.programId === 'prog_81_saw');
    return { ...spec, gmBadge: `PROG ${progStr} · SAW LEAD` };
  }
  if (prog >= 88 && prog <= 95) {
    const spec = INSTRUMENT_CATALOG.find(i => i.programId === 'prog_89_pad');
    return { ...spec, gmBadge: `PROG ${progStr} · PAD` };
  }

  const fallback = INSTRUMENT_CATALOG.find(i => i.programId === 'prog_81_saw');
  return {
    ...fallback,
    gmBadge: `PROG ${progStr} · CH ${channel + 1}`
  };
}

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

  let ticksPerBeat = 480;
  if ((timeDivision & 0x8000) === 0) {
    ticksPerBeat = timeDivision || 480;
  }

  let detectedBpm = 128;
  const tempoEvents = []; // { tick, bpm }
  const channelPrograms = new Map(); // channel -> programNumber
  const rawNotes = []; // { tick, midi, velocity, channel, program, durationTicks, trackIndex, trackName }

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
    let trackName = '';
    const openNotes = new Map();

    while (pos < trackEnd) {
      const delta = readVarLen();
      currentTick += delta;
      if (pos >= trackEnd) break;

      let statusByte = data.getUint8(pos);
      if (statusByte >= 0x80) {
        pos++;
        if (statusByte < 0xf0) {
          runningStatus = statusByte;
        }
      } else {
        statusByte = runningStatus;
      }

      if (statusByte === 0xff) {
        if (pos >= trackEnd) break;
        const metaType = data.getUint8(pos++);
        const metaLen = readVarLen();
        if (metaType === 0x51 && metaLen === 3 && pos + 3 <= trackEnd) {
          const mpqn = (data.getUint8(pos) << 16) | (data.getUint8(pos + 1) << 8) | data.getUint8(pos + 2);
          if (mpqn > 0) {
            const bpm = Math.round(60000000 / mpqn);
            if (bpm >= 40 && bpm <= 240) {
              tempoEvents.push({ tick: currentTick, bpm });
            }
          }
        } else if ((metaType === 0x03 || metaType === 0x04) && metaLen > 0 && pos + metaLen <= trackEnd) {
          let nameStr = '';
          for (let i = 0; i < metaLen; i++) {
            const chCode = data.getUint8(pos + i);
            if (chCode >= 32 && chCode <= 126) nameStr += String.fromCharCode(chCode);
          }
          if (nameStr.trim() && !trackName) trackName = nameStr.trim();
        }
        pos += metaLen;
      } else if (statusByte === 0xf0 || statusByte === 0xf7) {
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
            openNotes.set(key, { tick: currentTick, velocity: vel, program: channelPrograms.get(ch) ?? 0 });
          } else {
            const startObj = openNotes.get(key);
            if (startObj) {
              rawNotes.push({
                tick: startObj.tick,
                midi: note,
                velocity: startObj.velocity,
                channel: ch,
                program: startObj.program,
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
              program: startObj.program,
              durationTicks: Math.max(1, currentTick - startObj.tick),
              trackIndex: t,
              trackName
            });
            openNotes.delete(key);
          }
        } else if (cmd === 0xc0) {
          // Program Change (0xC0): sets instrument patch for this MIDI channel!
          const progNum = data.getUint8(pos++);
          channelPrograms.set(ch, progNum);
        } else if (cmd === 0xd0) {
          pos += 1;
        } else if (cmd === 0xa0 || cmd === 0xb0 || cmd === 0xe0) {
          pos += 2;
        } else {
          pos += 1;
        }
      }
    }

    openNotes.forEach((startObj, key) => {
      const [chStr, noteStr] = key.split('_');
      rawNotes.push({
        tick: startObj.tick,
        midi: parseInt(noteStr, 10),
        velocity: startObj.velocity,
        channel: parseInt(chStr, 10),
        program: startObj.program,
        durationTicks: Math.max(ticksPerBeat / 4, currentTick - startObj.tick),
        trackIndex: t,
        trackName
      });
    });

    pos = trackEnd;
  }

  // Pick dominant / initial tempo from tempoEvents
  if (tempoEvents.length > 0) {
    detectedBpm = tempoEvents[0].bpm;
  }

  return {
    format,
    numTracks,
    ticksPerBeat,
    bpm: detectedBpm,
    channelPrograms: Object.fromEntries(channelPrograms),
    notes: rawNotes.sort((a, b) => a.tick - b.tick)
  };
}

// Build a 100% FRESH, CLEAN multi-instrument track & 16-bar song arrangement from the parsed MIDI file
export function mapMidiToSynthPatterns(parsedMidi, synth, fileName = 'MIDI Song') {
  const { ticksPerBeat, bpm, notes } = parsedMidi;
  if (!notes || notes.length === 0) {
    throw new Error('No playable MIDI notes found in this file.');
  }

  const cleanTitle = fileName.replace(/\.(mid|midi)$/i, '').substring(0, 20);
  const ticksPer16th = ticksPerBeat / 4;
  const ticksPerBar = ticksPer16th * 16;

  // Snap first note to Bar 1 while preserving pickup position inside the bar
  const minTick = notes[0].tick;
  const startBarOffsetTick = Math.floor(minTick / ticksPerBar) * ticksPerBar;

  // 1. Separate MIDI notes into distinct Instrument Streams (by Track + Channel + Program)
  const melodicGroups = new Map();
  const drumNotes = [];

  notes.forEach((n) => {
    if (n.channel === 9) {
      drumNotes.push(n);
    } else {
      const groupKey = `ch${n.channel}_prog${n.program}_tr${n.trackIndex}`;
      if (!melodicGroups.has(groupKey)) {
        melodicGroups.set(groupKey, {
          key: groupKey,
          channel: n.channel,
          program: n.program,
          trackIndex: n.trackIndex,
          trackName: n.trackName || '',
          notes: []
        });
      }
      melodicGroups.get(groupKey).notes.push(n);
    }
  });

  // Sort melodic instrument streams by note activity & register so main Lead, Bass, Chords, Arp are prioritized
  let sortedMelodic = Array.from(melodicGroups.values()).sort((a, b) => b.notes.length - a.notes.length);

  // If the MIDI file put everything on a single track/channel (e.g. piano roll with bass + treble together),
  // automatically split it into a High Melody Instrument (>= C4 / 60) and a Low Bass/Harmony Instrument (< 60)
  if (sortedMelodic.length === 1 && sortedMelodic[0].notes.length > 8) {
    const single = sortedMelodic[0];
    const highNotes = single.notes.filter((n) => n.midi >= 58);
    const lowNotes = single.notes.filter((n) => n.midi < 58);
    if (highNotes.length > 0 && lowNotes.length > 0) {
      sortedMelodic = [
        { ...single, key: 'split_high', notes: highNotes, trackName: single.trackName ? `${single.trackName} (Lead)` : 'Lead Melody' },
        { ...single, key: 'split_low', program: 38, notes: lowNotes, trackName: single.trackName ? `${single.trackName} (Bass)` : 'Synth Bass' }
      ];
    }
  }

  // Take up to 6 distinct melodic instruments from the MIDI file
  const activeInstruments = sortedMelodic.slice(0, 6).map((grp) => {
    const avgPitch = grp.notes.reduce((acc, x) => acc + x.midi, 0) / grp.notes.length;
    const spec = getGmInstrumentSpec(grp.program, grp.channel, avgPitch, grp.trackName);
    const customLabel = grp.trackName && !grp.trackName.toLowerCase().startsWith('track')
      ? `${spec.label.split(' ')[0]} ${grp.trackName.substring(0, 16)}`
      : spec.label;
    return {
      ...grp,
      avgPitch,
      spec,
      displayName: customLabel
    };
  });

  // Auto-select the best master synth preset to match the primary lead instrument of the MIDI file
  if (activeInstruments.length > 0 && activeInstruments[0].spec.presetId) {
    const primaryPreset = synth.presets.find((p) => p.id === activeInstruments[0].spec.presetId);
    if (primaryPreset) {
      Object.assign(synth.params, primaryPreset.params);
    }
  }

  // Separate any GM Channel 10 Drum hits by drum type (ONLY if present in the MIDI file — never add fake drums!)
  const drumStreams = [
    { id: 'drum_kick', name: '🥁 MIDI Kick Drum', sample: 'kick', volume: 1.0, filter: (m) => m === 35 || m === 36 },
    { id: 'drum_snare', name: '🥁 MIDI Snare / Rim', sample: 'snare', volume: 0.85, filter: (m) => m === 38 || m === 40 || m === 37 },
    { id: 'drum_hihat', name: '🥁 MIDI Hi-Hat', sample: 'hihat', volume: 0.65, filter: (m) => m === 42 || m === 44 || m === 46 },
    { id: 'drum_clap', name: '🥁 MIDI Clap / Perc', sample: 'clap', volume: 0.8, filter: (m) => m === 39 || (m >= 60 && m <= 70) },
    { id: 'drum_crash', name: '🥁 MIDI Cymbal / Crash', sample: 'crash', volume: 0.7, filter: (m) => m === 49 || m === 51 || m === 55 || m === 57 }
  ].map((ds) => ({
    ...ds,
    notes: drumNotes.filter((n) => ds.filter(n.midi))
  })).filter((ds) => ds.notes.length > 0);

  // Determine how many bars (up to 16) exist in the MIDI file
  let maxBarFound = 0;
  notes.forEach((n) => {
    const relTick = Math.max(0, n.tick - startBarOffsetTick);
    const step = Math.round(relTick / ticksPer16th);
    const barIdx = Math.floor(step / 16);
    if (barIdx < 16 && barIdx > maxBarFound) maxBarFound = barIdx;
  });
  const totalSongBars = Math.max(1, Math.min(16, maxBarFound + 1));

  const patternColors = [
    '#f97316', '#06b6d4', '#a855f7', '#10b981',
    '#38bdf8', '#f59e0b', '#ec4899', '#84cc16',
    '#f97316', '#06b6d4', '#a855f7', '#10b981',
    '#38bdf8', '#f59e0b', '#ec4899', '#84cc16'
  ];

  // 2. Build a completely FRESH array of Patterns (Pat 1 .. Pat N) — wiping all default factory patterns!
  const newPatterns = [];

  for (let barIdx = 0; barIdx < totalSongBars; barIdx++) {
    const patId = `pat_${barIdx + 1}`;
    const channelsForBar = [];

    // Add each separated Melodic Instrument channel
    activeInstruments.forEach((inst, instIdx) => {
      const steps = new Array(16).fill(0);
      const stepNotes = new Array(16).fill(midiNumberToName(Math.round(inst.avgPitch)));
      const stepDurations = new Array(16).fill(1);

      inst.notes.forEach((n) => {
        const relTick = Math.max(0, n.tick - startBarOffsetTick);
        const totalStep = Math.round(relTick / ticksPer16th);
        const b = Math.floor(totalStep / 16);
        const s = totalStep % 16;
        if (b === barIdx && s >= 0 && s < 16) {
          steps[s] = 1;
          stepNotes[s] = midiNumberToName(n.midi);
          stepDurations[s] = Math.max(1, Math.min(8, Math.round(n.durationTicks / ticksPer16th)));
        }
      });

      channelsForBar.push({
        id: `midi_inst_${instIdx}`,
        name: inst.displayName,
        programId: inst.spec.programId || 'prog_81_saw',
        gmBadge: inst.spec.gmBadge || 'PROG 081 · SYNTH',
        type: inst.spec.type,
        note: midiNumberToName(Math.round(inst.avgPitch)),
        stepNotes,
        stepDurations,
        timbre: inst.spec.timbre,
        volume: inst.spec.type === 'bass' ? 0.92 : 0.85,
        defaultVolume: inst.spec.type === 'bass' ? 0.92 : 0.85,
        mute: false,
        solo: false,
        steps
      });
    });

    // Add only the Drum channels that actually exist in the MIDI file
    drumStreams.forEach((ds) => {
      const steps = new Array(16).fill(0);
      ds.notes.forEach((n) => {
        const relTick = Math.max(0, n.tick - startBarOffsetTick);
        const totalStep = Math.round(relTick / ticksPer16th);
        const b = Math.floor(totalStep / 16);
        const s = totalStep % 16;
        if (b === barIdx && s >= 0 && s < 16) {
          steps[s] = 1;
        }
      });

      channelsForBar.push({
        id: ds.id,
        name: ds.name,
        programId: ds.id,
        gmBadge: 'GM CH 10 · DRUM',
        type: 'drum',
        sample: ds.sample,
        volume: ds.volume,
        defaultVolume: ds.volume,
        mute: false,
        solo: false,
        steps
      });
    });

    newPatterns.push({
      id: patId,
      name: `Bar ${barIdx + 1}: ${cleanTitle}`,
      color: patternColors[barIdx % patternColors.length],
      channels: channelsForBar
    });
  }

  // Replace synth.patterns with ONLY the clean MIDI patterns
  synth.patterns = newPatterns;
  synth.activePatternId = 'pat_1';
  synth.bpm = bpm;
  synth.songLoopBars = totalSongBars;

  // 3. Build a clean, separated 16-Bar Song Playlist Arranger matching the MIDI instruments
  const numPlaylistRows = Math.max(1, Math.min(4, activeInstruments.length + (drumStreams.length > 0 ? 1 : 0)));
  const cleanPlaylistTracks = [];

  for (let tIdx = 0; tIdx < 4; tIdx++) {
    let rowLabel = `Track ${tIdx + 1} (Empty)`;
    let isActiveRow = false;

    if (tIdx < activeInstruments.length) {
      rowLabel = activeInstruments[tIdx].displayName;
      isActiveRow = true;
    } else if (tIdx === activeInstruments.length && drumStreams.length > 0) {
      rowLabel = '🥁 MIDI Drums & Percussion';
      isActiveRow = true;
    }

    const bars = new Array(16).fill(null);
    if (isActiveRow) {
      for (let b = 0; b < totalSongBars; b++) {
        bars[b] = `pat_${b + 1}`;
      }
    }

    cleanPlaylistTracks.push({
      id: `track_${tIdx + 1}`,
      name: rowLabel,
      bars
    });
  }

  synth.playlistTracks = cleanPlaylistTracks;

  return {
    bpm,
    noteCount: notes.length,
    activeBarCount: totalSongBars,
    instrumentCount: activeInstruments.length + drumStreams.length,
    primaryInstrument: activeInstruments[0]?.displayName || 'GM Percussion',
    primaryPresetId: activeInstruments[0]?.spec?.presetId || 'init_saw',
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

  const totalBarsToExport = synth.playMode === 'SONG' ? (synth.songLoopBars || synth.totalBars) : 1;

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

      patternsAtBar.forEach((pat) => {
        pat.channels.forEach((ch, chIdx) => {
          if (ch.mute || ch.steps[step] !== 1) return;
          const gateSteps = (ch.stepDurations && ch.stepDurations[step]) ? ch.stepDurations[step] : 1;
          const stepEndTick = stepStartTick + Math.floor(ticksPer16th * gateSteps * 0.85);
          const vel = Math.max(1, Math.min(127, Math.round((ch.volume || 0.85) * 115)));

          if (ch.type === 'synth' || ch.type === 'bass') {
            const noteStr = (ch.stepNotes && ch.stepNotes[step]) ? ch.stepNotes[step] : ch.note;
            const midiNote = synth.noteToMidi(noteStr);
            const midiChannel = Math.min(8, chIdx);
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

  events.sort((a, b) => a.tick - b.tick);

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

  trackBytes.push(0x00, 0xff, 0x2f, 0x00);

  const totalLength = 14 + 8 + trackBytes.length;
  const outBuf = new Uint8Array(totalLength);
  const view = new DataView(outBuf.buffer);

  outBuf.set([0x4d, 0x54, 0x68, 0x64], 0);
  view.setUint32(4, 6, false);
  view.setUint16(8, 0, false);
  view.setUint16(10, 1, false);
  view.setUint16(12, ticksPerBeat, false);

  outBuf.set([0x4d, 0x54, 0x72, 0x6b], 14);
  view.setUint32(18, trackBytes.length, false);
  outBuf.set(trackBytes, 22);

  return new Blob([outBuf], { type: 'audio/midi' });
}
