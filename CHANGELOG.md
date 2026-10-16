# LocalSynth Changelog & Black Box

All notable changes and architectural decisions for **LocalSynth** (in-browser Virtual Analog Synthesizer & FL Studio-style Sequencer/Song Arranger) are documented in this file.

---

## [1.9.0] - 2026-10-16
### Added
- **Standard MIDI File (`.mid` / `.midi`) Importer & Drag-and-Drop Engine (`src/midiFileParser.js`)**:
  - Added `📂 LOAD .MID` button in the top transport bar plus full-window drag-and-drop overlay support for any `.mid` or `.midi` file.
  - Built zero-dependency binary SMF Format 0 & Format 1 parser (`parseStandardMidiFile`) decoding variable-length delta ticks, running status bytes, tempo meta events (`0x51`), and multi-track note events.
  - Intelligent FL Studio Pattern & Playlist Mapper (`mapMidiToSynthPatterns`): automatically splits melodic MIDI voices into **Synth Lead** (`>= G3`) and **TB-303 Acid Bass** (`< G3`), maps General MIDI Channel 10 percussion notes (`35/36` Kick, `38/40` Snare, `39` Handclap, `42/44/46` Hi-Hat, `49/51` Crash) onto the 8-channel drum rack, updates project BPM, populates Patterns 1–3 and the 16-Bar Song Playlist Arranger, and starts playback automatically.
- **Standard MIDI File Exporter (`💾 SAVE .MID`)**:
  - Added 1-click `.mid` binary file export (`exportSynthToMidiBlob`) allowing users to save their current Pattern or 16-Bar Song Arrangement as a standard `.mid` file for use in any external DAW or hardware sequencer.

---

## [1.8.0] - 2026-10-16
### Added & Fixed
- **Horizontal Left/Right Rotary Knob Physics**:
  - Updated all 11 studio rotary knobs (`initKnobs`) to respond naturally to horizontal mouse dragging (`deltaX * 2.2`, `cursor: ew-resize`) and mouse wheel scrolling.
  - Added single-click left/right half stepping: clicking the left half of a knob steps it counter-clockwise (`-15°`), while clicking the right half steps it clockwise (`+15°`).
- **Universal Double-Click Recenter / Reset**:
  - Double-clicking (`dblclick`) any rotary knob immediately recenters it to `0°` and restores its default studio parameter value.
  - Double-clicking (`dblclick`) any channel volume slider in the FL Channel Rack immediately resets it to its default factory gain level.
- **PLAY / STOP Transport Toggle**:
  - Replaced the `PAUSE` state with a dedicated **STOP** button (`STOP` label + solid square SVG `<rect>` icon) when the sequencer is running.
- **Web MIDI API Hardware Controller Support (`initMIDI`)**:
  - Added plug-and-play USB MIDI keyboard and controller support via `navigator.requestMIDIAccess()`.
  - Supports polyphonic MIDI Note On (`0x90`), Note Off (`0x80`), and MIDI CC (`0xB0`) hardware knob mapping for Filter Cutoff (`CC 1` / `CC 74` / `CC 16`) and Resonance (`CC 71` / `CC 17`), complete with a live `#midi-status-pill` activity LED in the top transport bar.
- **Cross-Origin Popup-Safe `🎛️ TO LOCALDAW` Stem Bridge**:
  - Opens `localdaw.com` synchronously on the user click stack (`window.open` prior to async audio rendering) so browser popup blockers never intercept the launch.
  - Streams the rendered 16-bit 44.1kHz stereo WAV stem (`audioBase64`), BPM, and patch metadata directly across domains (`localsynth.com` -> `localdaw.com`) via `window.postMessage` (`LOCALSYNTH_STEM_EXPORT`), automatically creating a `🎹 LocalSynth Groove` track at `0:00` in LocalDAW.

---

## [1.7.0] - 2026-10-16
### Fixed & Improved
- **Distinct Play / Pause Icons**:
  - Replaced duplicate icons on the transport button with dynamic SVG toggling: displaying a sleek triangle `PLAY` icon when stopped, and switching to two parallel studio bars `PAUSE` when running.
- **Flashing Studio Recording Indicator**:
  - Clicking `RECORD AUDIO` now switches into an animated, flashing red studio banner (`rec-banner-flash` keyframe) with a pulsing white record indicator dot (`dot-blink` keyframe) and label `RECORDING...`.
  - Clicking it again immediately stops recording, restores the normal button state, and triggers the audio download.
- **Deep LocalDAW Multitrack Integration (`🎛️ TO LOCALDAW`)**:
  - Clicking `TO LOCALDAW` now halts any active synth playback and stops active recording automatically.
  - Automatically packages the audio (either live recording or high-definition offline stem render) along with BPM and patch name into a cross-origin storage payload.
  - Deployed matching listener to `LocalDAW` (`localdaw.com` / `localfilm-studio.pages.dev`) that immediately decodes the stem, creates a dedicated `🎹 LocalSynth Master` audio track with waveform peaks, and inserts the clip at 0:00.

---

## [1.6.0] - 2026-10-15
### Added
- **New Intro Splash Artwork**:
  - Replaced loading screen logo with official user artwork featuring custom synth hardware typography and neon spectrum display.
- **Master Space FX: Convolution Reverb & Juno Chorus**:
  - Algorithmic/convolution stereo hall reverb node with wet/dry rotary control.
  - Roland Juno-style analog bucket-brigade chorus with LFO modulation and stereo widening.
- **Master Audio Recorder**:
  - Added live audio stream recording (`RECORD AUDIO`) using `createMediaStreamDestination` + `MediaRecorder`.
  - Captures master mixdown in real-time and triggers automatic audio download on stop.
- **Send to LocalDAW Integration**:
  - Added dedicated `TO LOCALDAW` transport button passing BPM and synth metadata to `localdaw.com` for mixing/mastering.
- **Piano Roll Pitch Picker (Right-Click per Step)**:
  - Each step on melodic channels (Synth Lead & TB-303 Acid Bass) displays its active musical note tag (e.g. `C4`, `D#4`, `G4`).
  - Right-clicking any step cycles through musical scales, allowing melodically sequenced basslines and synth leads.
- **Expanded 10 Signature Presets & Custom Patch Memory**:
  - Added Moog Taurus Analog Sub, Stranger Things Rolling Synth, Cyberpunk 2077 Reese Bass, Daft Punk 909 Funk Lead, and Ambient Glass Shimmer Chimes.
  - Added `SAVE` patch button storing custom knob parameters to `localStorage`.
  - Added `EXPORT` patch button downloading JSON patch presets for sharing.

### Deployment
- Live Cloudflare Pages: `https://localsynth.pages.dev` (Edge deployed).
- GitHub Repo: `https://github.com/albertoxie/localsynth`.

---

## [1.4.0] - 2026-10-15
### Added
- **Multi-Pattern Architecture (FL Studio Pattern Engine)**:
  - Added support for independent patterns (`Pattern 1: Intro Groove`, `Pattern 2: Acid Drop & 808`, `Pattern 3: Ambient Melodic Build`).
  - Switching patterns updates the 16-step channel rack immediately while preserving other patterns in memory.
- **16-Bar Song Playlist Arranger**:
  - Added visual 16-bar playlist arranger with 4 tracks (Drums & Beat, Acid Bassline, Synth Lead Melody, Drops & FX).
  - Interactive clickable timeline slots: paint active pattern brush onto bar slots or click to remove.
  - Multi-colored pattern blocks matching FL Studio's visual style (`#f97316` for Pat 1, `#06b6d4` for Pat 2, `#a855f7` for Pat 3).
- **Dual Playback Modes (`PAT` vs `SONG`)**:
  - `PAT` Mode: Loops the currently selected 16-step pattern endlessly for sound design and beat programming.
  - `SONG` Mode: Traverses the 16-bar playlist arranger sequentially, evaluating all tracks active at that bar, triggering pattern layers synchronously with active ruler bar highlights.
- **Expanded 8-Channel Drum Machine**:
  - Punch 909 Kick, Studio Snare, Open 909 Hi-Hat, Boom 808 Sub-Bass, Analog Handclap, and Cymbal Crash / Splash.
- **Precision Rotary Knobs**:
  - Smooth pointer-capture drag physics, mouse-wheel fine adjustment, and double-click reset to default center.

---

## [1.2.0] - 2026-10-15
### Added
- Cinema splash loading screen featuring user's custom artwork with progressive boot loader.
- 64-bit polyphonic dual-oscillator virtual analog synthesizer engine.
- 24dB resonant ladder lowpass filter with envelope modulation.
- Full ADSR envelope, delay space bus, and overdrive distortion.
- Arpeggiator (Up, Down, Up/Down, Random).
- Interactive 2-octave polyphonic piano keyboard with computer keyboard bindings (A, W, S, E, D, F, G...).
- Real-time oscilloscope visualizer with orange cathode glow.
- TB-303 Acid bassline randomizer button.
