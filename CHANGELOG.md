# LocalSynth Changelog & Black Box

All notable changes and architectural decisions for **LocalSynth** (in-browser Virtual Analog Synthesizer & FL Studio-style Sequencer/Song Arranger) are documented in this file.

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
