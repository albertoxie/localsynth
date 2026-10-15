# LocalSynth Changelog & Black Box

All notable changes and architectural decisions for **LocalSynth** (in-browser Virtual Analog Synthesizer & FL Studio-style Sequencer/Song Arranger) are documented in this file.

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

### Deployment
- Live Cloudflare Pages: `https://localsynth.pages.dev` (Edge deployed).
- GitHub Repo: `https://github.com/albertoxie/localsynth`.

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
