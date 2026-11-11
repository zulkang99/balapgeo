        /********************************************************************
         * 1. WEB AUDIO API SYNTHESIZER (RACING SFX + UPBEAT ARCADE BACKSOUND)
         ********************************************************************/
        class SoundSystem {
            constructor() {
                this.ctx = null;
                this.enabled = true;      // SFX (Mesin, Ban, Bel Kuis)
                this.bgmEnabled = true;   // Backsound Musik Latar Balapan
                this.engineOsc1 = null;
                this.engineOsc2 = null;
                this.engineGain = null;
                this.screechNode = null;
                this.screechGain = null;
                this.screechFilter = null;
                this.bgmTimer = null;
                this.bgmStep = 0;
                this.lastGear = [1, 1];
            }

            init() {
                if (!this.ctx) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    this.ctx = new AudioContext();
                }
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
                this.startEngineAndTireLoop();
                this.startBgmLoop();
            }

            startBgmLoop() {
                if (this.bgmTimer) return;
                // Melodi Arpeggio Arcade Ceria (C Major / A Minor Pentatonic Upbeat)
                const bassNotes = [130.81, 130.81, 164.81, 196.00, 146.83, 146.83, 174.61, 196.00];
                const leadNotes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880.00, 783.99,
                                   523.25, 659.25, 1046.50, 783.99, 698.46, 659.25, 587.33, 523.25];

                this.bgmTimer = setInterval(() => {
                    if (!this.ctx || !this.bgmEnabled) return;
                    if (gameState !== 'RACING' && gameState !== 'COUNTDOWN') return;
                    if (this.ctx.state === 'suspended') return;

                    const now = this.ctx.currentTime;
                    const step = this.bgmStep++;

                    // Synth Bassline pulse
                    const bassFreq = bassNotes[step % bassNotes.length];
                    const bOsc = this.ctx.createOscillator();
                    const bGain = this.ctx.createGain();
                    bOsc.type = 'triangle';
                    bOsc.frequency.setValueAtTime(bassFreq, now);
                    bGain.gain.setValueAtTime(0.035, now);
                    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
                    bOsc.connect(bGain);
                    bGain.connect(this.ctx.destination);
                    bOsc.start(now);
                    bOsc.stop(now + 0.2);

                    // Upbeat Chiptune Lead every step
                    const leadFreq = leadNotes[step % leadNotes.length];
                    const lOsc = this.ctx.createOscillator();
                    const lGain = this.ctx.createGain();
                    lOsc.type = 'sine';
                    lOsc.frequency.setValueAtTime(leadFreq, now);
                    lGain.gain.setValueAtTime(0.024, now);
                    lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
                    lOsc.connect(lGain);
                    lGain.connect(this.ctx.destination);
                    lOsc.start(now);
                    lOsc.stop(now + 0.17);
                }, 210);
            }

            startEngineAndTireLoop() {
                if (!this.ctx || this.engineOsc1) return;

                // Dual-oscillator racing engine (Sawtooth + Sub-harmonic Triangle for throaty race car growl)
                this.engineOsc1 = this.ctx.createOscillator();
                this.engineOsc2 = this.ctx.createOscillator();
                this.engineGain = this.ctx.createGain();

                this.engineOsc1.type = 'sawtooth';
                this.engineOsc2.type = 'triangle';
                this.engineOsc1.frequency.value = 60;
                this.engineOsc2.frequency.value = 30;

                const engineFilter = this.ctx.createBiquadFilter();
                engineFilter.type = 'lowpass';
                engineFilter.frequency.value = 380;
                engineFilter.Q.value = 3.5;
                this.engineFilter = engineFilter;

                this.engineGain.gain.value = 0.0;
                this.engineOsc1.connect(engineFilter);
                this.engineOsc2.connect(engineFilter);
                engineFilter.connect(this.engineGain);
                this.engineGain.connect(this.ctx.destination);

                this.engineOsc1.start();
                this.engineOsc2.start();

                // White noise buffer for tire drift screech & turbo blow-off air
                const bufferSize = this.ctx.sampleRate * 2;
                const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const output = noiseBuffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 2 - 1;
                }
                this.noiseBuffer = noiseBuffer;

                this.screechNode = this.ctx.createBufferSource();
                this.screechNode.buffer = noiseBuffer;
                this.screechNode.loop = true;

                this.screechFilter = this.ctx.createBiquadFilter();
                this.screechFilter.type = 'bandpass';
                this.screechFilter.frequency.value = 1350;
                this.screechFilter.Q.value = 6.0;

                this.screechGain = this.ctx.createGain();
                this.screechGain.gain.value = 0.0;

                this.screechNode.connect(this.screechFilter);
                this.screechFilter.connect(this.screechGain);
                this.screechGain.connect(this.ctx.destination);
                this.screechNode.start();
            }

            updateEngine(speedRatio, isPaused, isDrifting = false, isBraking = false) {
                if (!this.ctx || !this.engineGain || !this.engineOsc1) return;
                if (!this.enabled || isPaused) {
                    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
                    if (this.screechGain) this.screechGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
                    return;
                }

                // Simulate 5-speed racing gearbox RPM sawtooth curve
                const clampedRatio = Math.max(0, Math.min(1.4, speedRatio));
                const gear = Math.min(5, Math.max(1, Math.floor(clampedRatio * 4.2) + 1));
                const gearLocalRPM = (clampedRatio * 4.2) % 1;

                const baseFreq = 58 + gear * 18 + gearLocalRPM * 95;
                this.engineOsc1.frequency.setTargetAtTime(baseFreq, this.ctx.currentTime, 0.05);
                this.engineOsc2.frequency.setTargetAtTime(baseFreq * 0.5, this.ctx.currentTime, 0.05);
                this.engineFilter.frequency.setTargetAtTime(280 + clampedRatio * 520, this.ctx.currentTime, 0.06);
                this.engineGain.gain.setTargetAtTime(0.055, this.ctx.currentTime, 0.08);

                // Tire screech sound when drifting or hard braking at speed
                if (this.screechGain) {
                    const shouldScreech = (isDrifting || isBraking) && clampedRatio > 0.35;
                    const targetScreech = shouldScreech ? 0.045 : 0.0;
                    const screechPitch = isBraking ? 950 : 1450 + Math.sin(this.ctx.currentTime * 18) * 180;
                    this.screechFilter.frequency.setTargetAtTime(screechPitch, this.ctx.currentTime, 0.04);
                    this.screechGain.gain.setTargetAtTime(targetScreech, this.ctx.currentTime, 0.06);
                }
            }

            playGearShift() {
                if (!this.enabled || !this.ctx) return;
                // Quick exhaust pop on upshift
                this.playTone(95, 'sawtooth', 0.08, 0.12, 65);
            }

            playTone(freq, type = 'sine', duration = 0.2, volume = 0.15, slideFreq = null) {
                if (!this.enabled || !this.ctx) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, now);
                if (slideFreq) {
                    osc.frequency.exponentialRampToValueAtTime(slideFreq, now + duration);
                }
                gain.gain.setValueAtTime(volume, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + duration);
            }

            playCountdown(go = false) {
                if (go) {
                    // Race starting horn + engine rev burst
                    this.playTone(880, 'triangle', 0.45, 0.25);
                    this.playTone(440, 'sawtooth', 0.45, 0.15, 660);
                } else {
                    this.playTone(440, 'sine', 0.22, 0.2);
                }
            }

            playCorrect() {
                this.playTone(523.25, 'triangle', 0.14, 0.22);
                setTimeout(() => this.playTone(659.25, 'triangle', 0.14, 0.22), 90);
                setTimeout(() => this.playTone(783.99, 'triangle', 0.16, 0.22), 180);
                setTimeout(() => this.playTone(1046.5, 'sine', 0.35, 0.26), 270);
            }

            playWrong() {
                // Engine sputter / downshift brake buzz
                this.playTone(170, 'sawtooth', 0.25, 0.2, 110);
                setTimeout(() => this.playTone(130, 'sawtooth', 0.35, 0.22, 85), 180);
            }

            playPickup() {
                this.playTone(587.33, 'sine', 0.12, 0.18, 1174.66);
            }

            playTurbo() {
                if (!this.enabled || !this.ctx) return;
                // High-pressure turbocharger turbine whine + blow-off whoosh
                this.playTone(210, 'sawtooth', 0.65, 0.20, 780);
                if (this.noiseBuffer) {
                    const now = this.ctx.currentTime;
                    const noise = this.ctx.createBufferSource();
                    noise.buffer = this.noiseBuffer;
                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.setValueAtTime(600, now);
                    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.55);
                    const gain = this.ctx.createGain();
                    gain.gain.setValueAtTime(0.16, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.ctx.destination);
                    noise.start(now);
                    noise.stop(now + 0.6);
                }
            }

            playCurbRumble() {
                if (!this.enabled || !this.ctx) return;
                this.playTone(75, 'square', 0.06, 0.09, 55);
            }
        }

        const sound = new SoundSystem();

        function updateSoundButtonsUI() {
            const sfxBtn = document.getElementById('btn-toggle-sfx');
            const bgmBtn = document.getElementById('btn-toggle-bgm');
            if (sfxBtn) {
                sfxBtn.textContent = sound.enabled ? 'AKTIF' : 'MATI';
                sfxBtn.className = sound.enabled
                    ? 'btn-game bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs sm:text-sm min-w-[95px] text-center'
                    : 'btn-game bg-slate-700 hover:bg-slate-600 text-slate-300 font-extrabold px-4 py-2.5 rounded-xl text-xs sm:text-sm min-w-[95px] text-center';
            }
            if (bgmBtn) {
                bgmBtn.textContent = sound.bgmEnabled ? 'AKTIF' : 'MATI';
                bgmBtn.className = sound.bgmEnabled
                    ? 'btn-game bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs sm:text-sm min-w-[95px] text-center'
                    : 'btn-game bg-slate-700 hover:bg-slate-600 text-slate-300 font-extrabold px-4 py-2.5 rounded-xl text-xs sm:text-sm min-w-[95px] text-center';
            }
        }

        function toggleSfx() {
            sound.init();
            sound.enabled = !sound.enabled;
            if (!sound.enabled) sound.updateEngine(0, true);
            updateSoundButtonsUI();
        }

        function toggleBgm() {
            sound.init();
            sound.bgmEnabled = !sound.bgmEnabled;
            updateSoundButtonsUI();
        }

        function toggleFullScreen() {
            const docEl = document.documentElement;
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (docEl.requestFullscreen) {
                    docEl.requestFullscreen().catch(() => {});
                } else if (docEl.webkitRequestFullscreen) {
                    docEl.webkitRequestFullscreen();
                }
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(() => {});
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
            }
            setTimeout(handleWindowResize, 200);
        }

        /********************************************************************
         * 2. PROCEDURAL GEOMETRY QUESTION GENERATOR (MENTAL MATH + SVG)
         ********************************************************************/
        const SHAPE_TYPES = [
            'PERSEGI',
            'PERSEGI_PANJANG',
            'SEGITIGA',
            'JAJAR_GENJANG',
            'TRAPESIUM',
            'BELAH_KETUPAT',
            'LAYANG_LAYANG'
        ];

        function randInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        function generateGeometryQuestion() {
            const type = SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
            let shapeName = '';
            let prompt = '';
            let dimsText = '';
            let formulaText = '';
            let stepsText = '';
            let answer = 0;
            let svg = '';
            let distractions = [];

            if (type === 'PERSEGI') {
                const s = randInt(4, 13);
                answer = s * s;
                shapeName = 'Persegi';
                dimsText = `s = ${s} cm`;
                prompt = `Persegi dengan panjang sisi s = ${s} cm. Berapa Luasnya?`;
                formulaText = `L = s × s`;
                stepsText = `L = ${s} × ${s} = ${answer} cm²`;
                distractions = [s * 4, answer + s, Math.max(4, answer - s), (s + 1) * (s + 1)];
                svg = `
                    <svg viewBox="0 0 100 100" class="w-full h-full">
                        <rect x="22" y="18" width="56" height="56" fill="rgba(56,189,248,0.28)" stroke="#38bdf8" stroke-width="3.5" rx="2"/>
                        <text x="50" y="92" fill="#fbbf24" font-size="14" font-weight="bold" text-anchor="middle">s = ${s} cm</text>
                        <text x="50" y="50" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle">L = ?</text>
                    </svg>`;
            } 
            else if (type === 'PERSEGI_PANJANG') {
                const p = randInt(6, 14);
                const l = randInt(3, p - 1);
                answer = p * l;
                shapeName = 'Persegi Panjang';
                dimsText = `p = ${p} cm, l = ${l} cm`;
                prompt = `Persegi Panjang: panjang = ${p} cm, lebar = ${l} cm. Berapa Luasnya?`;
                formulaText = `L = p × l`;
                stepsText = `L = ${p} × ${l} = ${answer} cm²`;
                distractions = [2 * (p + l), (p * l) / 2, answer + p, answer - l];
                svg = `
                    <svg viewBox="0 0 100 100" class="w-full h-full">
                        <rect x="10" y="24" width="68" height="44" fill="rgba(52,211,153,0.28)" stroke="#34d399" stroke-width="3.5" rx="2"/>
                        <text x="44" y="86" fill="#fbbf24" font-size="13" font-weight="bold" text-anchor="middle">p = ${p}</text>
                        <text x="89" y="50" fill="#38bdf8" font-size="12" font-weight="bold" text-anchor="middle">l=${l}</text>
                        <text x="44" y="50" fill="#ffffff" font-size="12" font-weight="bold" text-anchor="middle">L = ?</text>
                    </svg>`;
            }
            else if (type === 'SEGITIGA') {
                // Ensure (a * t) is even for clean mental math integer
                const a = randInt(3, 7) * 2;
                const t = randInt(4, 11);
                answer = 0.5 * a * t;
                shapeName = 'Segitiga';
                dimsText = `a = ${a} cm, t = ${t} cm`;
                prompt = `Segitiga: alas = ${a} cm, tinggi = ${t} cm. Berapa Luasnya?`;
                formulaText = `L = ½ × a × t`;
                stepsText = `L = ½ × ${a} × ${t} = ${answer} cm²`;
                distractions = [a * t, answer + a, Math.max(6, answer - t), a + t];
                svg = `
                    <svg viewBox="0 0 100 100" class="w-full h-full">
                        <polygon points="48,14 14,74 84,74" fill="rgba(251,191,36,0.28)" stroke="#fbbf24" stroke-width="3.5"/>
                        <line x1="48" y1="14" x2="48" y2="74" stroke="#f87171" stroke-width="2.5" stroke-dasharray="4"/>
                        <text x="49" y="91" fill="#fbbf24" font-size="13" font-weight="bold" text-anchor="middle">a = ${a} cm</text>
                        <text x="64" y="52" fill="#fca5a5" font-size="12" font-weight="bold">t=${t}</text>
                    </svg>`;
            }
            else if (type === 'JAJAR_GENJANG') {
                const a = randInt(5, 12);
                const t = randInt(4, 9);
                answer = a * t;
                shapeName = 'Jajar Genjang';
                dimsText = `a = ${a} cm, t = ${t} cm`;
                prompt = `Jajar Genjang: alas = ${a} cm, tinggi = ${t} cm. Berapa Luasnya?`;
                formulaText = `L = a × t`;
                stepsText = `L = ${a} × ${t} = ${answer} cm²`;
                distractions = [Math.floor((a * t) / 2), 2 * (a + t), answer + a, answer + 10];
                svg = `
                    <svg viewBox="0 0 100 100" class="w-full h-full">
                        <polygon points="28,22 88,22 72,72 12,72" fill="rgba(167,139,250,0.28)" stroke="#a78bfa" stroke-width="3.5"/>
                        <line x1="28" y1="22" x2="28" y2="72" stroke="#f87171" stroke-width="2.5" stroke-dasharray="4"/>
                        <text x="45" y="90" fill="#fbbf24" font-size="13" font-weight="bold" text-anchor="middle">a = ${a} cm</text>
                        <text x="45" y="52" fill="#fca5a5" font-size="12" font-weight="bold">t=${t}</text>
                    </svg>`;
            }
            else if (type === 'TRAPESIUM') {
                // Make (a + b) even so 1/2 * (a+b) is a clean integer
                const a = randInt(2, 5) * 2;
                const b = randInt(a / 2 + 1, 8) * 2;
                const t = randInt(3, 8);
                answer = 0.5 * (a + b) * t;
                shapeName = 'Trapesium';
                dimsText = `a = ${a}, b = ${b}, t = ${t} cm`;
                prompt = `Trapesium: sisi sejajar a = ${a} cm & b = ${b} cm, tinggi = ${t} cm. Luasnya?`;
                formulaText = `L = ½ × (a + b) × t`;
                stepsText = `L = ½ × (${a}+${b}) × ${t} = ${answer} cm²`;
                distractions = [(a + b) * t, a * b, answer + t * 2, Math.max(8, answer - t * 2)];
                svg = `
                    <svg viewBox="0 0 100 100" class="w-full h-full">
                        <polygon points="28,26 72,26 88,74 12,74" fill="rgba(244,114,182,0.28)" stroke="#f472b6" stroke-width="3.5"/>
                        <line x1="28" y1="26" x2="28" y2="74" stroke="#f87171" stroke-width="2.5" stroke-dasharray="4"/>
                        <text x="50" y="19" fill="#38bdf8" font-size="12" font-weight="bold" text-anchor="middle">a = ${a}</text>
                        <text x="50" y="91" fill="#fbbf24" font-size="12" font-weight="bold" text-anchor="middle">b = ${b}</text>
                        <text x="44" y="54" fill="#fca5a5" font-size="12" font-weight="bold">t=${t}</text>
                    </svg>`;
            }
            else {
                // BELAH KETUPAT or LAYANG-LAYANG
                const isRhombus = type === 'BELAH_KETUPAT';
                const d1 = randInt(3, 7) * 2;
                const d2 = randInt(3, 6) * 2;
                answer = 0.5 * d1 * d2;
                shapeName = isRhombus ? 'Belah Ketupat' : 'Layang-Layang';
                dimsText = `d₁ = ${d1} cm, d₂ = ${d2} cm`;
                prompt = `${shapeName}: diagonal d₁ = ${d1} cm, d₂ = ${d2} cm. Berapa Luasnya?`;
                formulaText = `L = ½ × d₁ × d₂`;
                stepsText = `L = ½ × ${d1} × ${d2} = ${answer} cm²`;
                distractions = [d1 * d2, d1 + d2, answer + d1, Math.max(6, answer - d2)];
                const pts = isRhombus ? "50,12 86,50 50,88 14,50" : "50,10 84,38 50,88 16,38";
                const hLineY = isRhombus ? 50 : 38;
                svg = `
                    <svg viewBox="0 0 100 100" class="w-full h-full">
                        <polygon points="${pts}" fill="rgba(45,212,191,0.28)" stroke="#2dd4bf" stroke-width="3.5"/>
                        <line x1="15" y1="${hLineY}" x2="85" y2="${hLineY}" stroke="#fbbf24" stroke-width="2" stroke-dasharray="3"/>
                        <line x1="50" y1="12" x2="50" y2="88" stroke="#f87171" stroke-width="2" stroke-dasharray="3"/>
                        <text x="50" y="97" fill="#fbbf24" font-size="11.5" font-weight="bold" text-anchor="middle">d₁=${d1}, d₂=${d2}</text>
                    </svg>`;
            }

            // Pick 2 unique integer wrong answers
            const wrongSet = new Set();
            for (let d of distractions) {
                const val = Math.round(d);
                if (val > 0 && val !== answer) wrongSet.add(val);
            }
            while (wrongSet.size < 2) {
                const offset = randInt(2, 6) * 2;
                const candidate = Math.random() > 0.5 ? answer + offset : Math.max(4, answer - offset);
                if (candidate !== answer) wrongSet.add(candidate);
            }
            const wrongs = Array.from(wrongSet).slice(0, 2);
            const options = [answer, wrongs[0], wrongs[1]].sort(() => Math.random() - 0.5);

            return {
                shapeName,
                dimsText,
                prompt,
                formulaText,
                stepsText,
                answer,
                options,
                svg
            };
        }

        /********************************************************************
         * 3. THREE.JS SCENE, PROCEDURAL TRACK, BILLBOARDS & KART MODELS
         ********************************************************************/
        const canvas = document.getElementById('game-canvas');
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;

        const scene = new THREE.Scene();
        // ===== Realistic PNG asset loader =====
        const ASSET = 'assets/images/';
        const loadMgr = new THREE.LoadingManager();
        let assetsReady = false, pendingStart = false;
        const ALL_ASSETS = ['kart-red','kart-blue','kart-green','kart-white','tree','bush','cloud','balloon','mystery-box','grass'];
        function setLoad(p){ const b=document.getElementById('load-bar'), t=document.getElementById('load-pct'); if(b) b.style.width=p+'%'; if(t) t.textContent=p+'%'; }
        loadMgr.onProgress = (u, l, tot) => setLoad(Math.round(l / ALL_ASSETS.length * 100));
        loadMgr.onLoad = () => { setLoad(100); assetsReady = true; setTimeout(() => { document.getElementById('loading-screen').classList.add('hidden'); if (pendingStart) { pendingStart = false; _startRaceNow(); } }, 300); };
        const texLoader = new THREE.TextureLoader(loadMgr);
        const texCache = {};
        function loadTex(name) {
            if (!texCache[name]) { const t = texLoader.load((window.GAME_IMAGES && window.GAME_IMAGES[name.replace('.png','')]) || (ASSET + name.replace('.png','.webp'))); t.encoding = THREE.sRGBEncoding; texCache[name] = t; }
            return texCache[name];
        }
        ALL_ASSETS.forEach(n => loadTex(n + '.png'));
        function makeSprite(name, w, h, opts = {}) {
            const mat = new THREE.SpriteMaterial({ map: loadTex(name), transparent: true, alphaTest: opts.alphaTest ?? 0.15, fog: true, depthWrite: opts.depthWrite ?? true });
            const sp = new THREE.Sprite(mat);
            sp.scale.set(w, h, 1);
            if (opts.bottom !== false) sp.center.set(0.5, 0.02);
            return sp;
        }
        // ===== Student identity (passed in from login page, never stored) =====
        const _qs = new URLSearchParams(location.search);
        const STUDENT_NAME = (_qs.get('nama') || '').slice(0, 40);
        const STUDENT_SCHOOL = (_qs.get('sekolah') || '').slice(0, 60);
        const P1_LABEL = STUDENT_NAME ? STUDENT_NAME : 'Pemain 1 (Merah)';
        (function(){ const c=document.createElement('canvas'); c.width=4; c.height=256; const g=c.getContext('2d'); const gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,'#3d9bff'); gr.addColorStop(0.55,'#8fd3ff'); gr.addColorStop(1,'#ffe3b8'); g.fillStyle=gr; g.fillRect(0,0,4,256); const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; scene.background=t; })();
        scene.fog = new THREE.FogExp2(0xffe7c7, 0.0016);

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 1200);
        const cameraP2 = new THREE.PerspectiveCamera(60, (window.innerWidth * 0.5) / window.innerHeight, 0.5, 1200);

        // Lights
        const ambientLight = new THREE.HemisphereLight(0xcfe8ff, 0x7a5a2a, 0.85);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffd9a0, 1.25);
        dirLight.position.set(120, 220, 100);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 10;
        dirLight.shadow.camera.far = 600;
        const d = 240;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        scene.add(dirLight);

        // Ground Plane
        const groundGeo = new THREE.PlaneGeometry(2400, 2400);
        const grassTex = loadTex('grass.png'); grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(120, 120);
        const groundMat = new THREE.MeshLambertMaterial({ map: grassTex });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        scene.add(ground);

        // Track Closed Spline Definition
        const TRACK_WIDTH = 22;
        const trackControlPoints = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -150),
            new THREE.Vector3(70, 0, -270),
            new THREE.Vector3(210, 0, -290),
            new THREE.Vector3(310, 0, -180),
            new THREE.Vector3(280, 0, -30),
            new THREE.Vector3(170, 0, 50),
            new THREE.Vector3(240, 0, 180),
            new THREE.Vector3(140, 0, 280),
            new THREE.Vector3(20, 0, 250),
            new THREE.Vector3(-40, 0, 130)
        ];
        const trackCurve = new THREE.CatmullRomCurve3(trackControlPoints, true, 'catmullrom', 0.5);
        const TRACK_LENGTH = trackCurve.getLength();

        // Precompute dense lookup table for fast closest-point projection
        const TRACK_SAMPLES = 700;
        const trackSampleTable = [];
        for (let i = 0; i < TRACK_SAMPLES; i++) {
            const t = i / TRACK_SAMPLES;
            const pt = trackCurve.getPointAt(t);
            const tangent = trackCurve.getTangentAt(t).normalize();
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            trackSampleTable.push({ t, pt, tangent, normal });
        }

        function getTrackFrame(t) {
            const normT = ((t % 1) + 1) % 1;
            const pt = trackCurve.getPointAt(normT);
            const tangent = trackCurve.getTangentAt(normT).normalize();
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            return { pt, tangent, normal };
        }

        // Build Procedural Road Surface & Alternating Red-White Curbs
        function buildTrackGeometry() {
            const segments = 480;
            const roadPositions = [];
            const roadUVs = [];
            const roadIndices = [];

            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const { pt, normal } = getTrackFrame(t);
                const left = pt.clone().addScaledVector(normal, -TRACK_WIDTH * 0.5);
                const right = pt.clone().addScaledVector(normal, TRACK_WIDTH * 0.5);

                roadPositions.push(left.x, 0.05, left.z);
                roadPositions.push(right.x, 0.05, right.z);

                roadUVs.push(0, t * 40);
                roadUVs.push(1, t * 40);

                if (i < segments) {
                    const base = i * 2;
                    roadIndices.push(base, base + 1, base + 2);
                    roadIndices.push(base + 1, base + 3, base + 2);
                }
            }

            // Road Asphalt Texture with Dashed Center Line
            const roadCanvas = document.createElement('canvas');
            roadCanvas.width = 256;
            roadCanvas.height = 256;
            const rCtx = roadCanvas.getContext('2d');
            rCtx.fillStyle = '#334155';
            rCtx.fillRect(0, 0, 256, 256);
            // Subtle asphalt noise
            rCtx.fillStyle = '#3b495e';
            for (let i = 0; i < 200; i++) {
                rCtx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
            }
            // Side white lines
            rCtx.fillStyle = '#e2e8f0';
            rCtx.fillRect(10, 0, 6, 256);
            rCtx.fillRect(240, 0, 6, 256);
            // Center dashed line
            rCtx.fillStyle = '#fbbf24';
            rCtx.fillRect(125, 20, 6, 95);
            rCtx.fillRect(125, 145, 6, 95);

            const roadTex = new THREE.CanvasTexture(roadCanvas);
            roadTex.wrapS = THREE.RepeatWrapping;
            roadTex.wrapT = THREE.RepeatWrapping;

            const roadGeo = new THREE.BufferGeometry();
            roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
            roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUVs, 2));
            roadGeo.setIndex(roadIndices);
            roadGeo.computeVertexNormals();

            const roadMesh = new THREE.Mesh(roadGeo, new THREE.MeshLambertMaterial({ map: roadTex }));
            roadMesh.receiveShadow = true;
            scene.add(roadMesh);

            // Alternating Red & White Block Curbs along both edges
            const curbGeo = new THREE.BoxGeometry(1.3, 0.55, 2.8);
            const redMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
            const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc });

            const curbCount = 320;
            for (let i = 0; i < curbCount; i++) {
                const t = i / curbCount;
                const { pt, tangent, normal } = getTrackFrame(t);
                const angle = Math.atan2(tangent.x, tangent.z);
                const mat = i % 2 === 0 ? redMat : whiteMat;

                // Left curb
                const leftCurb = new THREE.Mesh(curbGeo, mat);
                leftCurb.position.copy(pt).addScaledVector(normal, -(TRACK_WIDTH * 0.5 + 0.65));
                leftCurb.position.y = 0.28;
                leftCurb.rotation.y = angle;
                scene.add(leftCurb);

                // Right curb
                const rightCurb = new THREE.Mesh(curbGeo, mat);
                rightCurb.position.copy(pt).addScaledVector(normal, (TRACK_WIDTH * 0.5 + 0.65));
                rightCurb.position.y = 0.28;
                rightCurb.rotation.y = angle;
                scene.add(rightCurb);
            }
        }

        // Build Grand Start/Finish Arch & Checkerboard Strip
        function buildStartFinishArch() {
            const { pt, tangent, normal } = getTrackFrame(0);
            const angle = Math.atan2(tangent.x, tangent.z);

            const group = new THREE.Group();
            group.position.copy(pt);
            group.rotation.y = angle;

            // Checkerboard road strip
            const chkCanvas = document.createElement('canvas');
            chkCanvas.width = 256;
            chkCanvas.height = 64;
            const cCtx = chkCanvas.getContext('2d');
            const sq = 16;
            for (let y = 0; y < 4; y++) {
                for (let x = 0; x < 16; x++) {
                    cCtx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#0f172a';
                    cCtx.fillRect(x * sq, y * sq, sq, sq);
                }
            }
            const chkTex = new THREE.CanvasTexture(chkCanvas);
            const stripMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(TRACK_WIDTH, 4.5),
                new THREE.MeshBasicMaterial({ map: chkTex })
            );
            stripMesh.rotation.x = -Math.PI / 2;
            stripMesh.position.y = 0.09;
            group.add(stripMesh);

            // Pillars
            const pillarGeo = new THREE.CylinderGeometry(0.9, 1.1, 13, 12);
            const redMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
            const goldMat = new THREE.MeshLambertMaterial({ color: 0xfbbf24 });

            const leftPillar = new THREE.Mesh(pillarGeo, redMat);
            leftPillar.position.set(-TRACK_WIDTH * 0.5 - 1.2, 6.5, 0);
            group.add(leftPillar);

            const rightPillar = new THREE.Mesh(pillarGeo, redMat);
            rightPillar.position.set(TRACK_WIDTH * 0.5 + 1.2, 6.5, 0);
            group.add(rightPillar);

            // Gold rings on pillars
            const ringGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.8, 12);
            [-TRACK_WIDTH * 0.5 - 1.2, TRACK_WIDTH * 0.5 + 1.2].forEach(xPos => {
                [3, 9, 12.5].forEach(yPos => {
                    const ring = new THREE.Mesh(ringGeo, goldMat);
                    ring.position.set(xPos, yPos, 0);
                    group.add(ring);
                });
            });

            // Overhead Banner with Canvas Texture
            const bannerCanvas = document.createElement('canvas');
            bannerCanvas.width = 1024;
            bannerCanvas.height = 256;
            const bCtx = bannerCanvas.getContext('2d');

            const grad = bCtx.createLinearGradient(0, 0, 1024, 0);
            grad.addColorStop(0, '#991b1b');
            grad.addColorStop(0.5, '#dc2626');
            grad.addColorStop(1, '#991b1b');
            bCtx.fillStyle = grad;
            bCtx.fillRect(0, 0, 1024, 256);

            bCtx.strokeStyle = '#fbbf24';
            bCtx.lineWidth = 14;
            bCtx.strokeRect(7, 7, 1010, 242);

            bCtx.fillStyle = '#fef08a';
            bCtx.font = 'bold 68px Fredoka, sans-serif';
            bCtx.textAlign = 'center';
            bCtx.fillText('🏁 BALAP GEOMETRI 3D 🏁', 512, 115);

            bCtx.fillStyle = '#ffffff';
            bCtx.font = 'bold 40px Nunito, sans-serif';
            bCtx.fillText('GARIS START / FINISH - MISI LUAS BANGUN DATAR', 512, 190);

            const bannerTex = new THREE.CanvasTexture(bannerCanvas);
            const bannerGeo = new THREE.BoxGeometry(TRACK_WIDTH + 4, 4.2, 1.2);
            const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex });
            const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
            bannerMesh.position.set(0, 11.5, 0);
            group.add(bannerMesh);

            scene.add(group);
        }

        // Build 3D Formula Billboards, Hills, Trees, Clouds & Hot Air Balloons
        const balloons = [];
        const clouds = [];

        function createFormulaBillboardTexture(title, formula, subtext, bgColor) {
            const c = document.createElement('canvas');
            c.width = 512;
            c.height = 256;
            const ctx = c.getContext('2d');

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 512, 256);

            ctx.strokeStyle = bgColor;
            ctx.lineWidth = 12;
            ctx.strokeRect(6, 6, 500, 244);

            ctx.fillStyle = bgColor;
            ctx.fillRect(16, 16, 480, 58);

            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 34px Fredoka, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(title, 256, 57);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 46px Nunito, sans-serif';
            ctx.fillText(formula, 256, 145);

            ctx.fillStyle = '#cbd5e1';
            ctx.font = 'bold 26px Nunito, sans-serif';
            ctx.fillText(subtext, 256, 208);

            return new THREE.CanvasTexture(c);
        }

        function buildEnvironmentScenery() {
            // 1. 6 Formula Billboards along the track
            const billboardData = [
                { t: 0.08, side: -1, title: 'LUAS PERSEGI', formula: 'L = s × s', sub: 'sisi × sisi', color: '#38bdf8' },
                { t: 0.24, side: 1, title: 'PERSEGI PANJANG', formula: 'L = p × l', sub: 'panjang × lebar', color: '#34d399' },
                { t: 0.40, side: -1, title: 'LUAS SEGITIGA', formula: 'L = ½ × a × t', sub: '½ × alas × tinggi', color: '#fbbf24' },
                { t: 0.56, side: 1, title: 'JAJAR GENJANG', formula: 'L = a × t', sub: 'alas × tinggi', color: '#a78bfa' },
                { t: 0.72, side: -1, title: 'LUAS TRAPESIUM', formula: 'L = ½ × (a+b) × t', sub: '½ × jumlah sisi sejajar × t', color: '#f472b6' },
                { t: 0.88, side: 1, title: 'BELAH KETUPAT', formula: 'L = ½ × d₁ × d₂', sub: '½ × diagonal 1 × diagonal 2', color: '#2dd4bf' }
            ];

            billboardData.forEach(b => {
                const { pt, tangent, normal } = getTrackFrame(b.t);
                const group = new THREE.Group();
                const pos = pt.clone().addScaledVector(normal, b.side * (TRACK_WIDTH * 0.5 + 8.5));
                group.position.copy(pos);

                // Face toward oncoming racers
                const lookTarget = pt.clone().addScaledVector(tangent, -15);
                group.lookAt(lookTarget.x, 4, lookTarget.z);

                const postMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
                const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7, 8), postMat);
                postL.position.set(-3.5, 3.5, 0);
                const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7, 8), postMat);
                postR.position.set(3.5, 3.5, 0);
                group.add(postL, postR);

                const tex = createFormulaBillboardTexture(b.title, b.formula, b.sub, b.color);
                const board = new THREE.Mesh(
                    new THREE.BoxGeometry(11, 5.5, 0.5),
                    new THREE.MeshBasicMaterial({ map: tex })
                );
                board.position.set(0, 6.2, 0);
                group.add(board);

                scene.add(group);
            });

            // 2. Low-Poly Trees & Rounded Hills (Avoid placing on track)
            const trunkMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
            const leavesMat1 = new THREE.MeshLambertMaterial({ color: 0x15803d });
            const leavesMat2 = new THREE.MeshLambertMaterial({ color: 0x16a34a });
            const hillTex = loadTex('grass.png').clone(); hillTex.needsUpdate = true; hillTex.wrapS = hillTex.wrapT = THREE.RepeatWrapping; hillTex.repeat.set(8, 4);
            const hillMat = new THREE.MeshLambertMaterial({ map: hillTex });

            function isTooCloseToTrack(x, z, minDist) {
                for (let i = 0; i < trackSampleTable.length; i++) {
                    const dx = trackSampleTable[i].pt.x - x;
                    const dz = trackSampleTable[i].pt.z - z;
                    if (dx * dx + dz * dz < minDist * minDist) return true;
                }
                return false;
            }

            // Spawn Trees with a safe buffer from road, curbs, and billboards
            for (let i = 0; i < 120; i++) {
                const x = randInt(-220, 480);
                const z = randInt(-420, 400);
                if (isTooCloseToTrack(x, z, TRACK_WIDTH * 0.5 + 16)) continue;

                const tree = new THREE.Group();
                const scale = 0.8 + Math.random() * 0.7;
                if (Math.random() < 0.3) tree.add(makeSprite('bush.png', 5, 3.1));
                else tree.add(makeSprite('tree.png', 9, 9));
                tree.position.set(x, 0, z);
                tree.scale.setScalar(scale);
                scene.add(tree);
            }

            // Spawn Rounded Green Hills (Ensure full scaled radius + safety margin never touches the circuit)
            let hillsPlaced = 0;
            let hillAttempts = 0;
            while (hillsPlaced < 28 && hillAttempts < 250) {
                hillAttempts++;
                const x = randInt(-420, 680);
                const z = randInt(-580, 560);
                const radius = randInt(24, 50);
                const hillFootprintRadius = radius * 1.25; // Account for 1.2x horizontal scale
                const safeClearance = TRACK_WIDTH * 0.5 + hillFootprintRadius + 24;

                if (isTooCloseToTrack(x, z, safeClearance)) continue;

                const hill = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), hillMat);
                hill.scale.set(1.2, 0.42, 1.2);
                hill.position.set(x, -3.5, z);
                scene.add(hill);
                hillsPlaced++;
            }

            // 3. Hot Air Balloons
            const balloonColors = [0xef4444, 0xf59e0b, 0x3b82f6, 0xa855f7, 0xec4899, 0x10b981];
            for (let i = 0; i < 7; i++) {
                const bGroup = new THREE.Group();
                const color = balloonColors[i % balloonColors.length];
                bGroup.add(makeSprite('balloon.png', 12, 16));
                bGroup.position.set(randInt(-120, 380), randInt(32, 65), randInt(-340, 320));
                scene.add(bGroup);
                balloons.push({ mesh: bGroup, baseY: bGroup.position.y, phase: Math.random() * Math.PI * 2 });
            }

            // 4. Low-Poly White Clouds
            const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
            for (let i = 0; i < 22; i++) {
                const cGroup = new THREE.Group();
                const cw = randInt(30, 46);
                cGroup.add(makeSprite('cloud.png', cw, cw * 0.62, { bottom: false, alphaTest: 0.02, depthWrite: false }));
                cGroup.position.set(randInt(-350, 550), randInt(68, 105), randInt(-450, 450));
                scene.add(cGroup);
                clouds.push(cGroup);
            }
        }

        // Build Detailed 3D Kart Model (Player + 3 AI Opponents)
        function createKartMesh(primaryColor, accentColor) {
            const kart = new THREE.Group();

            // Main Chassis
            const bodyMat = new THREE.MeshLambertMaterial({ color: primaryColor });
            const accentMat = new THREE.MeshLambertMaterial({ color: accentColor });
            const darkMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
            const chromeMat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });

            const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 3.8), bodyMat);
            base.position.y = 0.55;
            base.castShadow = true;
            kart.add(base);

            // Sloped Nose Cone
            const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 1.3), accentMat);
            nose.position.set(0, 0.62, -1.5);
            kart.add(nose);

            // Side Pods
            const podL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 2.2), accentMat);
            podL.position.set(-1.25, 0.52, 0.1);
            const podR = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 2.2), accentMat);
            podR.position.set(1.25, 0.52, 0.1);
            kart.add(podL, podR);

            // Driver Seat & Steering Wheel
            const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.9), darkMat);
            seat.position.set(0, 1.0, 0.35);
            kart.add(seat);

            // Driver Body & White Helmet with Visor
            const driverTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.7, 10), accentMat);
            driverTorso.position.set(0, 1.25, 0.25);
            kart.add(driverTorso);

            const helmet = new THREE.Mesh(
                new THREE.SphereGeometry(0.46, 14, 14),
                new THREE.MeshLambertMaterial({ color: 0xffffff })
            );
            helmet.position.set(0, 1.85, 0.22);
            kart.add(helmet);

            const visor = new THREE.Mesh(
                new THREE.BoxGeometry(0.55, 0.22, 0.35),
                new THREE.MeshLambertMaterial({ color: 0x0f172a })
            );
            visor.position.set(0, 1.87, -0.12);
            kart.add(visor);

            // Rear Spoiler Wing
            const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.85, 0.2), darkMat);
            strutL.position.set(-0.7, 1.15, 1.65);
            const strutR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.85, 0.2), darkMat);
            strutR.position.set(0.7, 1.15, 1.65);
            const wing = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 0.65), accentMat);
            wing.position.set(0, 1.55, 1.72);
            kart.add(strutL, strutR, wing);

            // Twin Exhaust Pipes + Turbo Flame Cones
            const pipeGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.7, 8);
            pipeGeo.rotateX(Math.PI / 2);
            const pipeL = new THREE.Mesh(pipeGeo, chromeMat);
            pipeL.position.set(-0.5, 0.7, 1.95);
            const pipeR = new THREE.Mesh(pipeGeo, chromeMat);
            pipeR.position.set(0.5, 0.7, 1.95);
            kart.add(pipeL, pipeR);

            const flameGeo = new THREE.ConeGeometry(0.28, 1.4, 8);
            flameGeo.rotateX(Math.PI / 2);
            const flameMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
            const flameL = new THREE.Mesh(flameGeo, flameMat);
            flameL.position.set(-0.5, 0.7, 2.75);
            flameL.visible = false;
            const flameR = new THREE.Mesh(flameGeo, flameMat);
            flameR.position.set(0.5, 0.7, 2.75);
            flameR.visible = false;
            kart.add(flameL, flameR);

            // 4 Wheels
            const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.48, 14);
            wheelGeo.rotateZ(Math.PI / 2);
            const hubGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.5, 10);
            hubGeo.rotateZ(Math.PI / 2);

            const wheelPositions = [
                [-1.35, 0.52, -1.25],
                [1.35, 0.52, -1.25],
                [-1.35, 0.52, 1.25],
                [1.35, 0.52, 1.25]
            ];
            const wheels = [];
            wheelPositions.forEach(([wx, wy, wz]) => {
                const wGroup = new THREE.Group();
                wGroup.position.set(wx, wy, wz);
                const tire = new THREE.Mesh(wheelGeo, darkMat);
                const rim = new THREE.Mesh(hubGeo, accentMat);
                wGroup.add(tire, rim);
                kart.add(wGroup);
                wheels.push(wGroup);
            });

            // Replace primitive body with realistic PNG kart render
            kart.children.forEach(ch => { if (ch !== flameL && ch !== flameR) ch.visible = false; });
            const kartImg = { 0xef4444: 'kart-red.png', 0x2563eb: 'kart-blue.png', 0x16a34a: 'kart-green.png' }[primaryColor] || 'kart-white.png';
            const kartSprite = makeSprite(kartImg, 3.6, 3.6);
            kartSprite.position.y = -0.05;
            kart.add(kartSprite);
            return { mesh: kart, wheels, flameL, flameR };
        }

        /********************************************************************
         * 4. MATH GATES & EDUCATIONAL MYSTERY BOXES ON THE TRACK
         ********************************************************************/
        const GATE_T_LOCATIONS = [0.16, 0.38, 0.62, 0.85];
        const mathGates = [];
        const mysteryBoxes = [];

        function createGateAnswerTexture(text, colorHex) {
            const c = document.createElement('canvas');
            c.width = 256;
            c.height = 160;
            const ctx = c.getContext('2d');

            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.fillRect(0, 0, 256, 160);

            ctx.strokeStyle = colorHex;
            ctx.lineWidth = 12;
            ctx.strokeRect(6, 6, 244, 148);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 54px Fredoka, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${text} cm²`, 128, 82);

            return new THREE.CanvasTexture(c);
        }

        function buildMathGates() {
            const laneOffsets = [-TRACK_WIDTH * 0.31, 0, TRACK_WIDTH * 0.31];
            const gateColors = ['#38bdf8', '#fbbf24', '#c084fc'];

            GATE_T_LOCATIONS.forEach((tPos, idx) => {
                const { pt, tangent, normal } = getTrackFrame(tPos);
                const angle = Math.atan2(tangent.x, tangent.z);

                const gateGroup = new THREE.Group();
                gateGroup.position.copy(pt);
                gateGroup.rotation.y = angle;

                const question = generateGeometryQuestion();
                const subGates = [];

                laneOffsets.forEach((offset, laneIdx) => {
                    const sub = new THREE.Group();
                    sub.position.set(offset, 0, 0);

                    const frameMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05, color: new THREE.Color(gateColors[laneIdx]) });
                    const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 6.2, 20), frameMat);
                    pL.position.set(-2.6, 3.1, 0);
                    const pR = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 6.2, 20), frameMat);
                    pR.position.set(2.6, 3.1, 0);
                    sub.add(pL, pR);

                    // Glowing translucent portal field
                    const portalMat = new THREE.MeshBasicMaterial({
                        color: new THREE.Color(gateColors[laneIdx]),
                        transparent: true,
                        opacity: 0.25,
                        side: THREE.DoubleSide
                    });
                    const portal = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 4.4), portalMat);
                    portal.position.set(0, 2.2, 0);
                    sub.add(portal);

                    // Top Answer Display Board (Double-sided via BoxGeometry, raised slightly for crisp visibility)
                    const tex = createGateAnswerTexture(question.options[laneIdx], gateColors[laneIdx]);
                    const signMat = new THREE.MeshBasicMaterial({ map: tex });
                    const signMesh = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.3, 0.4), signMat);
                    signMesh.position.set(0, 5.8, 0);
                    sub.add(signMesh);

                    gateGroup.add(sub);
                    subGates.push({ offset, signMesh, color: gateColors[laneIdx] });
                });

                scene.add(gateGroup);
                mathGates.push({
                    index: idx,
                    t: tPos,
                    pt,
                    group: gateGroup,
                    subGates,
                    question,
                    triggeredLapByRacer: {}
                });
            });
        }

        function refreshGateQuestion(gate) {
            gate.question = generateGeometryQuestion();
            gate.subGates.forEach((sg, idx) => {
                const newTex = createGateAnswerTexture(gate.question.options[idx], sg.color);
                sg.signMesh.material.map = newTex;
                sg.signMesh.material.needsUpdate = true;
            });
        }

        function buildMysteryBoxes() {
            const boxTPositions = [0.06, 0.27, 0.50, 0.74];
            const boxGeo = new THREE.OctahedronGeometry(1.35, 0);

            boxTPositions.forEach(tPos => {
                const { pt, normal } = getTrackFrame(tPos);
                [-4.5, 4.5].forEach(offset => {
                    const mesh = makeSprite('mystery-box.png', 3, 3, { bottom: false });
                    const pos = pt.clone().addScaledVector(normal, offset);
                    pos.y = 1.8;
                    mesh.position.copy(pos);
                    scene.add(mesh);
                    mysteryBoxes.push({ mesh, basePos: pos.clone(), active: true, respawnTimer: 0 });
                });
            });
        }

        /********************************************************************
         * 5. RACER ENTITIES (PLAYER 1, PLAYER 2 / AI + 2 AI KARTS) & GAME STATE
         ********************************************************************/
        const racers = [];
        const TOTAL_LAPS = 3;

        let numPlayers = 1; // 1 = Single Player, 2 = Vertical Split-Screen (2 Players)
        let gameState = 'START'; // START, COUNTDOWN, RACING, PAUSED, FINISHED
        let difficulty = 'normal';
        let raceTime = 0;
        let geometryScore = 0;
        let geometryScoreP2 = 0;
        let questionsAnswered = 0;
        let questionsCorrect = 0;
        const questionHistory = [];

        // Per-player independent Power-Up & Quiz state so P1 and P2 never freeze/slow each other!
        let playerPowerUpReady = [false, false];
        let playerQuizActive = [false, false];
        let activePowerUpQuestions = [null, null];
        let rumbleCooldown = [0, 0];

        const difficultyConfig = {
            easy: { playerMax: 68, aiBase: 55 },
            normal: { playerMax: 76, aiBase: 67 },
            hard: { playerMax: 84, aiBase: 76 }
        };

        function selectPlayerCount(count) {
            numPlayers = count;
            const btn1 = document.getElementById('mode-1p');
            const btn2 = document.getElementById('mode-2p');
            const splitInfo = document.getElementById('split-controls-info');
            const splitDivider = document.getElementById('split-divider');
            const p1Zone = document.getElementById('p1-viewport-zone');
            const p2Zone = document.getElementById('p2-viewport-zone');
            const modeBadge = document.getElementById('mode-indicator-badge');
            const centerCluster = document.getElementById('shared-center-cluster');
            const p1HeaderLabel = document.getElementById('p1-header-label');

            if (count === 2) {
                btn2.className = 'px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm border-2 border-sky-400 bg-sky-500 text-slate-950 flex items-center justify-center gap-2 transition-all shadow-lg';
                btn1.className = 'px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm border-2 border-slate-600 bg-slate-800 text-slate-200 flex items-center justify-center gap-2 transition-all';
                splitInfo.classList.remove('hidden');
                splitDivider.classList.remove('hidden');
                p1Zone.className = 'w-1/2 h-full flex flex-col justify-between p-1.5 sm:p-2.5 relative border-r border-rose-500/30';
                p2Zone.classList.remove('hidden');
                p2Zone.classList.add('flex');
                if (modeBadge) modeBadge.textContent = 'DUEL 2P';
                if (p1HeaderLabel) p1HeaderLabel.textContent = 'PEMAIN 1 (SENTUH / WASD)';
                // Place radar & race timer at vertical center of the split line so bottom RPM/Speedometers are 100% clear!
                if (centerCluster) {
                    centerCluster.className = 'pointer-events-auto fixed left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 transition-all duration-200';
                }
            } else {
                btn1.className = 'px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm border-2 border-amber-400 bg-amber-500 text-slate-950 flex items-center justify-center gap-2 transition-all shadow-lg';
                btn2.className = 'px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm border-2 border-slate-600 bg-slate-800 text-slate-200 flex items-center justify-center gap-2 transition-all';
                splitInfo.classList.add('hidden');
                splitDivider.classList.add('hidden');
                p1Zone.className = 'w-full h-full flex flex-col justify-between p-1.5 sm:p-3 relative';
                p2Zone.classList.add('hidden');
                p2Zone.classList.remove('flex');
                if (modeBadge) modeBadge.textContent = '1 PEMAIN';
                if (p1HeaderLabel) p1HeaderLabel.textContent = 'PEMAIN 1 (SENTUH / KEYBOARD)';
                // Dock radar & timer at middle-right in 1P mode so bottom-right RPM/Speedometer is 100% clear!
                if (centerCluster) {
                    centerCluster.className = 'pointer-events-auto fixed right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 transition-all duration-200';
                }
            }

            if (racers.length > 1) {
                racers[1].isPlayer = (numPlayers === 2);
                racers[1].name = numPlayers === 2 ? 'Pemain 2 (Biru)' : 'Bima (Biru)';
            }
            handleWindowResize();
        }

        function initRacers() {
            const configs = [
                { name: P1_LABEL, isPlayer: true, primary: 0xef4444, accent: 0xfbbf24, startT: 0.992, lane: -3.2 },
                { name: 'Bima (Biru)', isPlayer: false, primary: 0x2563eb, accent: 0x38bdf8, startT: 0.992, lane: 3.2 },
                { name: 'Citra (Hijau)', isPlayer: false, primary: 0x16a34a, accent: 0xfacc15, startT: 0.986, lane: -3.2 },
                { name: 'Dito (Putih)', isPlayer: false, primary: 0xe11d48, accent: 0xffffff, startT: 0.986, lane: 3.2 }
            ];

            configs.forEach((cfg, idx) => {
                const kartObj = createKartMesh(cfg.primary, cfg.accent);
                scene.add(kartObj.mesh);

                const { pt, tangent, normal } = getTrackFrame(cfg.startT);
                const startPos = pt.clone().addScaledVector(normal, cfg.lane);
                const heading = Math.atan2(-tangent.x, -tangent.z);

                racers.push({
                    id: idx,
                    name: cfg.name,
                    isPlayer: cfg.isPlayer,
                    colorHex: '#' + cfg.primary.toString(16).padStart(6, '0'),
                    kart: kartObj,
                    pos: startPos,
                    heading: heading,
                    speed: 0,
                    t: cfg.startT,
                    lap: 1,
                    totalProgress: cfg.startT - 1,
                    laneOffset: cfg.lane,
                    targetLane: cfg.lane,
                    boostTimer: 0,
                    slowTimer: 0,
                    driftCharge: 0,
                    isDrifting: false,
                    finished: false,
                    aiSpeedFactor: 0.96 + idx * 0.025
                });
            });
            updateRacerTransforms();
        }

        function resetRacersForNewRace() {
            const startTs = [0.992, 0.992, 0.986, 0.986];
            const lanes = [-3.2, 3.2, -3.2, 3.2];
            racers.forEach((r, idx) => {
                r.isPlayer = (idx === 0) || (idx === 1 && numPlayers === 2);
                r.name = idx === 0 ? P1_LABEL : (idx === 1 && numPlayers === 2 ? 'Pemain 2 (Biru)' : r.name);
                r.t = startTs[idx];
                r.lap = 1;
                r.totalProgress = startTs[idx] - 1;
                r.speed = 0;
                r.laneOffset = lanes[idx];
                r.targetLane = lanes[idx];
                r.boostTimer = 0;
                r.slowTimer = 0;
                r.driftCharge = 0;
                r.isDrifting = false;
                r.finished = false;

                const { pt, tangent, normal } = getTrackFrame(r.t);
                r.pos.copy(pt).addScaledVector(normal, r.laneOffset);
                r.heading = Math.atan2(-tangent.x, -tangent.z);
            });
            mathGates.forEach(g => {
                g.triggeredLapByRacer = {};
                refreshGateQuestion(g);
            });
            updateRacerTransforms();
        }

        function updateRacerTransforms() {
            racers.forEach(r => {
                r.kart.mesh.position.copy(r.pos);
                r.kart.mesh.rotation.y = r.heading + Math.PI;
            });
        }

        /********************************************************************
         * 6. INPUT CONTROLS (1P & 2P KEYBOARD + MULTI-TOUCH SCREEN BUTTONS)
         ********************************************************************/
        const keysP1 = { left: false, right: false, down: false, drift: false };
        const keysP2 = { left: false, right: false, down: false, drift: false };

        window.addEventListener('keydown', (e) => {
            // Quick keyboard answer shortcuts (1/2/3 for P1 Quiz, 8/9/0 for P2 Quiz)
            if (playerQuizActive[0] && activePowerUpQuestions[0]) {
                if (e.code === 'Digit1') submitPowerUpAnswer(0, activePowerUpQuestions[0].options[0]);
                if (e.code === 'Digit2') submitPowerUpAnswer(0, activePowerUpQuestions[0].options[1]);
                if (e.code === 'Digit3') submitPowerUpAnswer(0, activePowerUpQuestions[0].options[2]);
            }
            if (playerQuizActive[1] && activePowerUpQuestions[1]) {
                if (e.code === 'Digit8' || e.code === 'Numpad1') submitPowerUpAnswer(1, activePowerUpQuestions[1].options[0]);
                if (e.code === 'Digit9' || e.code === 'Numpad2') submitPowerUpAnswer(1, activePowerUpQuestions[1].options[1]);
                if (e.code === 'Digit0' || e.code === 'Numpad3') submitPowerUpAnswer(1, activePowerUpQuestions[1].options[2]);
            }

            if (numPlayers === 1) {
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') keysP1.left = true;
                if (e.code === 'ArrowRight' || e.code === 'KeyD') keysP1.right = true;
                if (e.code === 'ArrowDown' || e.code === 'KeyS') keysP1.down = true;
                if (e.code === 'Space' || e.code === 'KeyC') keysP1.drift = true;
                if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') {
                    triggerPowerUpQuiz(0);
                }
            } else {
                // Player 1 (Left Split): WASD + Space/C + LeftShift/E
                if (e.code === 'KeyA') keysP1.left = true;
                if (e.code === 'KeyD') keysP1.right = true;
                if (e.code === 'KeyS') keysP1.down = true;
                if (e.code === 'Space' || e.code === 'KeyC') keysP1.drift = true;
                if (e.code === 'ShiftLeft' || e.code === 'KeyE') {
                    triggerPowerUpQuiz(0);
                }

                // Player 2 (Right Split): Arrow Keys + RightShift/M/Slash + Enter
                if (e.code === 'ArrowLeft') keysP2.left = true;
                if (e.code === 'ArrowRight') keysP2.right = true;
                if (e.code === 'ArrowDown') keysP2.down = true;
                if (e.code === 'ShiftRight' || e.code === 'KeyM' || e.code === 'Slash') keysP2.drift = true;
                if (e.code === 'Enter' || e.code === 'NumpadEnter') {
                    triggerPowerUpQuiz(1);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (numPlayers === 1) {
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') keysP1.left = false;
                if (e.code === 'ArrowRight' || e.code === 'KeyD') keysP1.right = false;
                if (e.code === 'ArrowDown' || e.code === 'KeyS') keysP1.down = false;
                if (e.code === 'Space' || e.code === 'KeyC') {
                    releaseDrift(0);
                    keysP1.drift = false;
                }
            } else {
                if (e.code === 'KeyA') keysP1.left = false;
                if (e.code === 'KeyD') keysP1.right = false;
                if (e.code === 'KeyS') keysP1.down = false;
                if (e.code === 'Space' || e.code === 'KeyC') {
                    releaseDrift(0);
                    keysP1.drift = false;
                }

                if (e.code === 'ArrowLeft') keysP2.left = false;
                if (e.code === 'ArrowRight') keysP2.right = false;
                if (e.code === 'ArrowDown') keysP2.down = false;
                if (e.code === 'ShiftRight' || e.code === 'KeyM' || e.code === 'Slash') {
                    releaseDrift(1);
                    keysP2.drift = false;
                }
            }
        });

        function bindTouchButton(id, targetKeyObj, keyProp, onRelease = null) {
            const btn = document.getElementById(id);
            if (!btn) return;
            const start = (e) => {
                if (e.cancelable) e.preventDefault();
                sound.init();
                targetKeyObj[keyProp] = true;
                btn.classList.add('active');
            };
            const end = (e) => {
                if (e.cancelable) e.preventDefault();
                targetKeyObj[keyProp] = false;
                btn.classList.remove('active');
                if (onRelease) onRelease();
            };
            // Pointer events + Touch events ensure smooth simultaneous multi-touch on Interactive Flat Panels (Smartboards)
            btn.addEventListener('pointerdown', start);
            btn.addEventListener('pointerup', end);
            btn.addEventListener('pointerleave', end);
            btn.addEventListener('pointercancel', end);
            btn.addEventListener('touchstart', start, { passive: false });
            btn.addEventListener('touchend', end, { passive: false });
            btn.addEventListener('touchcancel', end, { passive: false });
        }

        // Player 1 Touch Controls
        bindTouchButton('touch-left', keysP1, 'left');
        bindTouchButton('touch-right', keysP1, 'right');
        bindTouchButton('touch-brake', keysP1, 'down');
        bindTouchButton('touch-drift', keysP1, 'drift', () => releaseDrift(0));

        // Player 2 Touch Controls
        bindTouchButton('touch-left-p2', keysP2, 'left');
        bindTouchButton('touch-right-p2', keysP2, 'right');
        bindTouchButton('touch-brake-p2', keysP2, 'down');
        bindTouchButton('touch-drift-p2', keysP2, 'drift', () => releaseDrift(1));

        function releaseDrift(playerIdx = 0) {
            const p = racers[playerIdx];
            if (!p || !p.isPlayer) return;
            if (p.driftCharge >= 100) {
                p.boostTimer = Math.max(p.boostTimer, 1.6);
                sound.playTurbo();
                showFeedbackToast('🔥 MINI-TURBO DRIFT AKTIF!', true, playerIdx);
            }
            p.driftCharge = 0;
            p.isDrifting = false;
        }

        /********************************************************************
         * 7. GAMEPLAY PHYSICS, GATE COLLISIONS & EDUCATIONAL QUIZZES
         ********************************************************************/
        function projectPositionToTrack(pos, currentT) {
            // Search neighborhood around currentT in sample table
            const centerIdx = Math.floor((((currentT % 1) + 1) % 1) * TRACK_SAMPLES);
            let bestIdx = centerIdx;
            let bestDistSq = Infinity;

            for (let offset = -35; offset <= 35; offset++) {
                const idx = (centerIdx + offset + TRACK_SAMPLES) % TRACK_SAMPLES;
                const sample = trackSampleTable[idx];
                const dx = pos.x - sample.pt.x;
                const dz = pos.z - sample.pt.z;
                const dSq = dx * dx + dz * dz;
                if (dSq < bestDistSq) {
                    bestDistSq = dSq;
                    bestIdx = idx;
                }
            }
            return trackSampleTable[bestIdx];
        }

        function showBigFeedback(ok, title, sub, playerIdx = 0) {
            let el = document.getElementById('big-fb-' + playerIdx);
            if (!el) {
                el = document.createElement('div'); el.id = 'big-fb-' + playerIdx; el.className = 'big-fb';
                document.body.appendChild(el);
            }
            el.style.left = numPlayers === 2 ? (playerIdx === 0 ? '25%' : '75%') : '50%';
            el.className = 'big-fb ' + (ok ? 'ok' : 'bad');
            el.innerHTML = `<div class="big-fb-icon">${ok ? '✔' : '✖'}</div><div class="big-fb-title">${title}</div><div class="big-fb-sub">${sub}</div>`;
            void el.offsetWidth; el.classList.add('show');
            const fl = document.getElementById('screen-flash') || (() => { const f = document.createElement('div'); f.id = 'screen-flash'; document.body.appendChild(f); return f; })();
            fl.className = ok ? 'ok' : 'bad'; void fl.offsetWidth; fl.classList.add('show');
            clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1700);
        }
        function flashGate(gate, idx, ok) {
            const sg = gate.subGates[idx]; if (!sg) return;
            const m = sg.signMesh; const s0 = 1;
            let t = 0; const iv = setInterval(() => { t += 0.05; m.scale.setScalar(s0 + Math.sin(t * Math.PI) * 0.35); if (t >= 1) { clearInterval(iv); m.scale.setScalar(1); } }, 30);
            gate.group.children[idx].children.forEach(c => { if (c.material && c.material.color && c !== m) { const old = c.material.color.getHex(); c.material.color.set(ok ? 0x22c55e : 0xef4444); setTimeout(() => c.material.color.setHex(old), 900); } });
        }

        function showFeedbackToast(msg, isPositive, playerIdx = 0) {
            const toastId = playerIdx === 1 ? 'feedback-toast-p2' : 'feedback-toast';
            const toast = document.getElementById(toastId);
            if (!toast) return;
            toast.textContent = msg;
            toast.className = `px-2.5 py-1 rounded-lg font-bold text-[11px] shadow-md border transition-all duration-300 text-center ${
                isPositive
                    ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                    : 'bg-rose-950/90 border-rose-400 text-rose-200'
            }`;
            toast.classList.remove('hidden');
            clearTimeout(toast.hideTimeout);
            toast.hideTimeout = setTimeout(() => toast.classList.add('hidden'), 3400);
        }

        function updateActiveQuestionBanner(racer, isP2 = false) {
            let closestGate = null;
            let minDeltaT = 999;

            for (const gate of mathGates) {
                let dT = gate.t - racer.t;
                if (dT < -0.02) dT += 1.0;
                if (dT < minDeltaT) {
                    minDeltaT = dT;
                    closestGate = gate;
                }
            }

            if (!closestGate) return;
            const distMeters = Math.max(0, Math.round(minDeltaT * TRACK_LENGTH));
            const suffix = isP2 ? '-p2' : '';
            const distEl = document.getElementById(`hud-gate-dist${suffix}`);
            if (distEl) distEl.textContent = `Gerbang: ${distMeters}m`;

            const q = closestGate.question;
            const svgBox = document.getElementById(`question-svg-box${suffix}`);
            if (svgBox && svgBox.dataset.prompt !== q.prompt) {
                svgBox.innerHTML = q.svg;
                svgBox.dataset.prompt = q.prompt;
                document.getElementById(`question-shape-badge${suffix}`).textContent = `${isP2 ? 'P2' : 'P1'}: ${q.shapeName.toUpperCase()}`;
                document.getElementById(`question-text${suffix}`).textContent = q.prompt;
                document.getElementById(`question-hint${suffix}`).innerHTML = `Rumus: <span class="underline text-amber-300">${q.formulaText}</span>`;
            }
        }

        function evaluateGatePass(racer, gate, playerIdx) {
            // Pick the answer gate physically closest to the kart (in gate-local space)
            const local = gate.group.worldToLocal(racer.pos.clone());
            let chosenIdx = 1, best = Infinity;
            gate.subGates.forEach((sg, i) => { const dd = Math.abs(local.x - sg.offset); if (dd < best) { best = dd; chosenIdx = i; } });

            const chosenAnswer = gate.question.options[chosenIdx];
            const isCorrect = chosenAnswer === gate.question.answer;
            const pLabel = numPlayers === 2 ? (playerIdx === 0 ? '[P1] ' : '[P2] ') : '';

            questionsAnswered++;
            questionHistory.push({
                shapeName: `${pLabel}${gate.question.shapeName}`,
                dimsText: gate.question.dimsText,
                stepsText: gate.question.stepsText,
                chosen: `${chosenAnswer} cm²`,
                correctAnswer: `${gate.question.answer} cm²`,
                isCorrect
            });

            if (isCorrect) {
                questionsCorrect++;
                if (playerIdx === 0) geometryScore += 100;
                else geometryScoreP2 += 100;
                racer.boostTimer = 3.0; racer.slowTimer = 0;
                racer.speed *= 1.3;
                sound.playCorrect();
                sound.playTurbo();
                showFeedbackToast(`✅ BENAR! ${gate.question.stepsText} (+100 & TURBO!)`, true, playerIdx);
                showBigFeedback(true, `${chosenAnswer} cm² — BENAR!`, '⚡ Kecepatan naik! +100', playerIdx);
                flashGate(gate, chosenIdx, true);
            } else {
                racer.slowTimer = 2.5; racer.boostTimer = 0;
                racer.speed *= 0.5;
                sound.playWrong();
                showFeedbackToast(`❌ SALAH (${chosenAnswer} cm²). Rumus: ${gate.question.stepsText}`, false, playerIdx);
                showBigFeedback(false, `${chosenAnswer} cm² — SALAH`, `🐢 Melambat! Jawaban: ${gate.question.answer} cm²`, playerIdx);
                flashGate(gate, chosenIdx, false);
            }
        }

        function updatePowerUpUI() {
            [0, 1].forEach(idx => {
                const suffix = idx === 1 ? '-p2' : '';
                const btn = document.getElementById(`btn-powerup${suffix}`);
                const icon = document.getElementById(`powerup-icon${suffix}`);
                const status = document.getElementById(`powerup-status${suffix}`);
                if (!btn || !icon || !status) return;

                if (playerPowerUpReady[idx]) {
                    btn.className = 'btn-game hud-panel-gold rounded-xl p-1 sm:p-1.5 flex items-center gap-1.5 text-left w-40 sm:w-52 animate-pulse-fast';
                    icon.textContent = '🚀';
                    icon.className = 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center text-sm sm:text-base shrink-0 font-bold';
                    status.textContent = idx === 0 ? 'SIAP! Tekan E / Shift!' : 'SIAP! Tekan ENTER!';
                    status.className = 'text-[10px] sm:text-[11px] font-extrabold text-amber-300 truncate';
                } else {
                    btn.className = 'btn-game hud-panel rounded-xl p-1 sm:p-1.5 flex items-center gap-1.5 text-left border border-slate-600/60 w-40 sm:w-52';
                    icon.textContent = '🎁';
                    icon.className = 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center text-sm sm:text-base shrink-0';
                    status.textContent = 'Ambil Kotak Misteri!';
                    status.className = 'text-[10px] sm:text-[11px] font-bold text-slate-300 truncate';
                }
            });
        }

        // Independent per-player Power-Up Quiz (Only slows the player taking the quiz!)
        function triggerPowerUpQuiz(playerIdx = 0) {
            if (gameState !== 'RACING' || !playerPowerUpReady[playerIdx] || playerQuizActive[playerIdx]) return;
            playerPowerUpReady[playerIdx] = false;
            playerQuizActive[playerIdx] = true;
            updatePowerUpUI();

            const q = generateGeometryQuestion();
            activePowerUpQuestions[playerIdx] = q;

            const pPrefix = playerIdx === 0 ? 'quiz-p1' : 'quiz-p2';
            const keyHints = playerIdx === 0 ? ['[1]', '[2]', '[3]'] : ['[8]', '[9]', '[0]'];

            document.getElementById(`${pPrefix}-svg`).innerHTML = q.svg;
            document.getElementById(`${pPrefix}-title`).textContent = `KUIS KILAT P${playerIdx + 1}: ${q.shapeName.toUpperCase()}`;
            document.getElementById(`${pPrefix}-question`).textContent = q.prompt;
            document.getElementById(`${pPrefix}-formula`).textContent = `Rumus: ${q.formulaText}`;

            const optionsDiv = document.getElementById(`${pPrefix}-options`);
            optionsDiv.innerHTML = '';
            q.options.forEach((opt, optIdx) => {
                const b = document.createElement('button');
                b.className = 'btn-game bg-gradient-to-b from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-display font-bold text-xs sm:text-sm py-2 px-1 rounded-xl border border-sky-200 flex flex-col items-center';
                b.innerHTML = `<span class="text-[9px] text-amber-200 font-sans">${keyHints[optIdx]}</span><span>${opt} cm²</span>`;
                b.onclick = () => submitPowerUpAnswer(playerIdx, opt);
                optionsDiv.appendChild(b);
            });

            const overlay = document.getElementById(`quiz-overlay-p${playerIdx + 1}`);
            overlay.classList.remove('hidden');
        }

        function submitPowerUpAnswer(playerIdx, chosenVal) {
            if (!playerQuizActive[playerIdx]) return;
            playerQuizActive[playerIdx] = false;

            const overlay = document.getElementById(`quiz-overlay-p${playerIdx + 1}`);
            overlay.classList.add('hidden');

            const q = activePowerUpQuestions[playerIdx];
            if (!q) return;
            const isCorrect = chosenVal === q.answer;
            const pLabel = numPlayers === 2 ? `[P${playerIdx + 1}] ` : '';

            questionsAnswered++;
            questionHistory.push({
                shapeName: `${pLabel}${q.shapeName} (Power-Up)`,
                dimsText: q.dimsText,
                stepsText: q.stepsText,
                chosen: `${chosenVal} cm²`,
                correctAnswer: `${q.answer} cm²`,
                isCorrect
            });

            const activeRacer = racers[playerIdx];
            if (isCorrect) {
                questionsCorrect++;
                if (playerIdx === 0) geometryScore += 150;
                else geometryScoreP2 += 150;
                activeRacer.boostTimer = 3.5; activeRacer.slowTimer = 0;
                activeRacer.speed *= 1.3;
                showBigFeedback(true, 'POWER-UP BENAR!', '🚀 Super Nitro! +150', playerIdx);
                // Slow down opponents with Geometry Missile!
                racers.forEach((other, idx) => {
                    if (idx !== playerIdx) other.slowTimer = 2.2;
                });
                sound.playCorrect();
                sound.playTurbo();
                showFeedbackToast(`🚀 RUDAL GEOMETRI & SUPER NITRO! (${q.stepsText})`, true, playerIdx);
            } else {
                activeRacer.slowTimer = 2.5; activeRacer.boostTimer = 0;
                activeRacer.speed *= 0.5;
                showBigFeedback(false, 'POWER-UP SALAH', `🐢 Melambat! Jawaban: ${q.answer} cm²`, playerIdx);
                sound.playWrong();
                showFeedbackToast(`❌ Power-Up Gagal! Jawaban benar: ${q.stepsText}`, false, playerIdx);
            }
        }

        /********************************************************************
         * 8. MAIN SIMULATION UPDATE LOOP (INDEPENDENT SLOW-MO PER PLAYER)
         ********************************************************************/
        function updateHumanRacer(racer, inputKeys, playerIdx, dt, cfg) {
            // Only the player who opened their Power-Up Quiz gets personal slow-motion (0.22x)!
            // The other player continues racing at 100% full normal speed!
            const personalScale = playerQuizActive[playerIdx] ? 0.22 : 1.0;
            const stepDt = dt * personalScale;

            let maxSpd = cfg.playerMax;
            if (racer.boostTimer > 0) {
                racer.boostTimer -= stepDt;
                maxSpd *= 1.42;
            }
            if (racer.slowTimer > 0) {
                racer.slowTimer -= stepDt;
                maxSpd *= 0.58;
            }

            if (inputKeys.down) {
                racer.speed = THREE.MathUtils.lerp(racer.speed, maxSpd * 0.3, stepDt * 4);
            } else {
                racer.speed = THREE.MathUtils.lerp(racer.speed, maxSpd, stepDt * 2.6);
            }

            // Play gear shift sound when crossing gear thresholds
            const currentGear = Math.min(5, Math.max(1, Math.floor((racer.speed / cfg.playerMax) * 4.2) + 1));
            if (currentGear > sound.lastGear[playerIdx] && racer.speed > 25) {
                sound.playGearShift();
            }
            sound.lastGear[playerIdx] = currentGear;

            const steerInput = (inputKeys.left ? 1 : 0) - (inputKeys.right ? 1 : 0);
            const turnRate = inputKeys.drift ? 2.15 : 1.65;
            if (steerInput !== 0) {
                racer.heading += steerInput * turnRate * stepDt;
                if (inputKeys.drift && racer.speed > 35) {
                    racer.isDrifting = true;
                    racer.driftCharge = Math.min(100, racer.driftCharge + stepDt * 68);
                } else {
                    racer.isDrifting = false;
                }
            } else {
                racer.isDrifting = false;
            }

            const forwardX = -Math.sin(racer.heading);
            const forwardZ = -Math.cos(racer.heading);
            racer.pos.x += forwardX * racer.speed * 0.42 * stepDt;
            racer.pos.z += forwardZ * racer.speed * 0.42 * stepDt;

            const prevT = racer.t;
            const sample = projectPositionToTrack(racer.pos, racer.t);
            racer.t = sample.t;

            if (prevT > 0.85 && racer.t < 0.15) {
                racer.lap++;
                if (racer.lap > TOTAL_LAPS) {
                    racer.finished = true;
                    finishRace();
                    return;
                } else {
                    sound.playPickup();
                    showFeedbackToast(`🏁 PUTARAN ${racer.lap} / ${TOTAL_LAPS} DIMULAI!`, true, playerIdx);
                }
            } else if (prevT < 0.15 && racer.t > 0.85) {
                racer.lap = Math.max(1, racer.lap - 1);
            }
            racer.totalProgress = (racer.lap - 1) + racer.t;

            const relVec = racer.pos.clone().sub(sample.pt);
            racer.laneOffset = relVec.dot(sample.normal);
            const maxOffset = TRACK_WIDTH * 0.46;
            if (Math.abs(racer.laneOffset) > maxOffset) {
                racer.laneOffset = Math.sign(racer.laneOffset) * maxOffset;
                racer.pos.copy(sample.pt).addScaledVector(sample.normal, racer.laneOffset);
                const trackHeading = Math.atan2(-sample.tangent.x, -sample.tangent.z);
                let diff = trackHeading - racer.heading;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                racer.heading += diff * 0.22;
                racer.speed *= 0.96;

                // Curb rumble tactile sound effect
                rumbleCooldown[playerIdx] -= stepDt;
                if (rumbleCooldown[playerIdx] <= 0) {
                    sound.playCurbRumble();
                    rumbleCooldown[playerIdx] = 0.11;
                }
            }

            // Check Math Gate Collisions for this Player
            mathGates.forEach(gate => {
                const lp = gate.group.worldToLocal(racer.pos.clone());
                if (Math.abs(lp.z) < 2.2 && Math.abs(lp.x) < TRACK_WIDTH * 0.7 && gate.triggeredLapByRacer[racer.id] !== racer.lap) {
                    gate.triggeredLapByRacer[racer.id] = racer.lap;
                    evaluateGatePass(racer, gate, playerIdx);
                }
            });

            // Check Mystery Box Collisions for this Player
            mysteryBoxes.forEach(box => {
                if (!box.active) return;
                if (racer.pos.distanceTo(box.mesh.position) < 3.6) {
                    box.active = false;
                    box.mesh.visible = false;
                    box.respawnTimer = 7.0;
                    if (!playerPowerUpReady[playerIdx] && !playerQuizActive[playerIdx]) {
                        playerPowerUpReady[playerIdx] = true;
                        sound.playPickup();
                        updatePowerUpUI();
                        showFeedbackToast('🎁 KOTAK MISTERI DIAMBIL! Aktifkan Kuis Power-Up!', true, playerIdx);
                    }
                }
            });
        }

        function updatePhysics(dt) {
            if (gameState !== 'RACING') return;

            // Global race clock runs normally unless single-player is in quiz mode
            const globalTimeScale = (numPlayers === 1 && playerQuizActive[0]) ? 0.22 : 1.0;
            const stepDt = dt * globalTimeScale;
            raceTime += stepDt;

            const cfg = difficultyConfig[difficulty];

            // Rotate & Respawn Mystery Boxes
            mysteryBoxes.forEach(box => {
                if (!box.active) {
                    box.respawnTimer -= stepDt;
                    if (box.respawnTimer <= 0) {
                        box.active = true;
                        box.mesh.visible = true;
                    }
                    return;
                }
                box.mesh.rotation.y += stepDt * 2.5;
                box.mesh.position.y = box.basePos.y + Math.sin(raceTime * 4) * 0.35;
            });

            // --- 1. UPDATE PLAYER 1 & PLAYER 2 INDEPENDENTLY ---
            updateHumanRacer(racers[0], keysP1, 0, dt, cfg);
            if (gameState === 'FINISHED') return;

            if (numPlayers === 2) {
                updateHumanRacer(racers[1], keysP2, 1, dt, cfg);
                if (gameState === 'FINISHED') return;
            }

            // --- 2. UPDATE AI OPPONENT KARTS ---
            const aiStartIdx = numPlayers === 2 ? 2 : 1;
            const leadProgress = numPlayers === 2
                ? Math.max(racers[0].totalProgress, racers[1].totalProgress)
                : racers[0].totalProgress;

            for (let i = aiStartIdx; i < racers.length; i++) {
                const ai = racers[i];
                let aiTargetSpeed = cfg.aiBase * ai.aiSpeedFactor;

                const progressGap = leadProgress - ai.totalProgress;
                if (progressGap > 0.12) aiTargetSpeed *= 1.12;
                else if (progressGap < -0.12) aiTargetSpeed *= 0.90;

                if (ai.slowTimer > 0) {
                    ai.slowTimer -= stepDt;
                    aiTargetSpeed *= 0.55;
                }

                ai.speed = THREE.MathUtils.lerp(ai.speed, aiTargetSpeed, stepDt * 3);
                const prevAiT = ai.t;
                ai.t = (ai.t + (ai.speed * 0.42 * stepDt) / TRACK_LENGTH) % 1;
                if (prevAiT > 0.85 && ai.t < 0.15) ai.lap++;
                ai.totalProgress = (ai.lap - 1) + ai.t;

                if (Math.random() < 0.015) {
                    const lanes = [-5.5, 0, 5.5];
                    ai.targetLane = lanes[Math.floor(Math.random() * lanes.length)];
                }
                ai.laneOffset = THREE.MathUtils.lerp(ai.laneOffset, ai.targetLane, stepDt * 2.0);

                const frame = getTrackFrame(ai.t);
                ai.pos.copy(frame.pt).addScaledVector(frame.normal, ai.laneOffset);
                ai.heading = Math.atan2(-frame.tangent.x, -frame.tangent.z);
            }

            // --- 3. UPDATE KART WHEELS & TURBO FLAMES ---
            racers.forEach(r => {
                r.kart.wheels.forEach(w => { w.rotation.x -= r.speed * stepDt * 0.35; });
                const hasFlame = r.boostTimer > 0;
                r.kart.flameL.visible = hasFlame;
                r.kart.flameR.visible = hasFlame;
                if (hasFlame) {
                    const flicker = 0.8 + Math.random() * 0.5;
                    r.kart.flameL.scale.set(1, flicker, 1);
                    r.kart.flameR.scale.set(1, flicker, 1);
                }
            });

            updateRacerTransforms();
            updateActiveQuestionBanner(racers[0], false);
            if (numPlayers === 2) updateActiveQuestionBanner(racers[1], true);
            updateHUD();

            const maxPlayerSpeed = numPlayers === 2 ? Math.max(racers[0].speed, racers[1].speed) : racers[0].speed;
            const anyDrifting = racers[0].isDrifting || (numPlayers === 2 && racers[1].isDrifting);
            const anyBraking = keysP1.down || (numPlayers === 2 && keysP2.down);
            sound.updateEngine(maxPlayerSpeed / cfg.playerMax, false, anyDrifting, anyBraking);
        }

        /********************************************************************
         * 9. CAMERA CHASE SYSTEM (FIXED FAR CAMERA) & HUD UPDATES
         ********************************************************************/
        const FIXED_FAR_CAMERA = { dist: 16.5, height: 6.2, lookAhead: 12.0, lookY: 3.0 };

        function snapCameraToFar(cam, targetRacer) {
            if (!targetRacer) return;
            const backX = Math.sin(targetRacer.heading);
            const backZ = Math.cos(targetRacer.heading);
            cam.position.set(
                targetRacer.pos.x + backX * FIXED_FAR_CAMERA.dist,
                targetRacer.pos.y + FIXED_FAR_CAMERA.height,
                targetRacer.pos.z + backZ * FIXED_FAR_CAMERA.dist
            );
            cam.lookAt(
                targetRacer.pos.x - backX * FIXED_FAR_CAMERA.lookAhead,
                targetRacer.pos.y + FIXED_FAR_CAMERA.lookY,
                targetRacer.pos.z - backZ * FIXED_FAR_CAMERA.lookAhead
            );
        }

        function updateSingleChaseCamera(cam, targetRacer, dt) {
            if (!targetRacer) return;

            const backX = Math.sin(targetRacer.heading);
            const backZ = Math.cos(targetRacer.heading);

            const desiredPos = new THREE.Vector3(
                targetRacer.pos.x + backX * FIXED_FAR_CAMERA.dist,
                targetRacer.pos.y + FIXED_FAR_CAMERA.height,
                targetRacer.pos.z + backZ * FIXED_FAR_CAMERA.dist
            );

            cam.position.lerp(desiredPos, Math.min(1, dt * 8.5));

            const lookTarget = new THREE.Vector3(
                targetRacer.pos.x - backX * FIXED_FAR_CAMERA.lookAhead,
                targetRacer.pos.y + FIXED_FAR_CAMERA.lookY,
                targetRacer.pos.z - backZ * FIXED_FAR_CAMERA.lookAhead
            );
            cam.lookAt(lookTarget);
        }

        function updateCamera(dt) {
            updateSingleChaseCamera(camera, racers[0], dt);
            if (numPlayers === 2) {
                updateSingleChaseCamera(cameraP2, racers[1], dt);
            }

            const turboOverlay = document.getElementById('turbo-overlay');
            const anyBoost = racers[0]?.boostTimer > 0 || (numPlayers === 2 && racers[1]?.boostTimer > 0);
            turboOverlay.style.opacity = anyBoost ? '1' : '0';
        }

        function formatTime(sec) {
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            const ms = Math.floor((sec % 1) * 100);
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
        }

        const minimapCanvas = document.getElementById('minimap-canvas');
        const mmCtx = minimapCanvas.getContext('2d');

        function drawMinimap() {
            const w = minimapCanvas.width;
            const h = minimapCanvas.height;
            mmCtx.clearRect(0, 0, w, h);

            const mapX = (x) => 8 + ((x + 80) / 430) * (w - 16);
            const mapY = (z) => 8 + ((z + 320) / 630) * (h - 16);

            mmCtx.beginPath();
            for (let i = 0; i < trackSampleTable.length; i += 6) {
                const pt = trackSampleTable[i].pt;
                const mx = mapX(pt.x);
                const my = mapY(pt.z);
                if (i === 0) mmCtx.moveTo(mx, my);
                else mmCtx.lineTo(mx, my);
            }
            mmCtx.closePath();
            mmCtx.strokeStyle = '#64748b';
            mmCtx.lineWidth = 4;
            mmCtx.stroke();

            mathGates.forEach(g => {
                mmCtx.fillStyle = '#fbbf24';
                mmCtx.fillRect(mapX(g.pt.x) - 2.5, mapY(g.pt.z) - 2.5, 5, 5);
            });

            racers.slice().reverse().forEach((r, idx) => {
                mmCtx.beginPath();
                mmCtx.arc(mapX(r.pos.x), mapY(r.pos.z), r.isPlayer ? 4.2 : 3.0, 0, Math.PI * 2);
                mmCtx.fillStyle = r.id === 0 ? '#ef4444' : (r.id === 1 && numPlayers === 2 ? '#38bdf8' : r.colorHex);
                mmCtx.fill();
                mmCtx.strokeStyle = '#ffffff';
                mmCtx.lineWidth = 1.2;
                mmCtx.stroke();
            });
        }

        function updateHUD() {
            const player1 = racers[0];
            if (!player1) return;

            const sorted = [...racers].sort((a, b) => b.totalProgress - a.totalProgress);
            const rankP1 = sorted.findIndex(r => r.id === 0) + 1;
            const posLabels = ['Pemimpin! 🏆', 'Posisi 2 🔥', 'Posisi 3 ⚡', 'Posisi 4 💪'];

            document.getElementById('hud-pos').innerHTML = `${rankP1}<span class="text-[10px] font-normal">/4</span>`;
            document.getElementById('hud-pos-label').textContent = posLabels[rankP1 - 1];
            document.getElementById('hud-score').textContent = geometryScore;

            const acc = questionsAnswered > 0 ? Math.round((questionsCorrect / questionsAnswered) * 100) : 100;
            document.getElementById('hud-accuracy').textContent = `${acc}%`;
            document.getElementById('hud-lap').textContent = `${Math.min(TOTAL_LAPS, player1.lap)}/${TOTAL_LAPS}`;
            document.getElementById('hud-time').textContent = formatTime(raceTime);

            document.getElementById('hud-speed').textContent = Math.round(player1.speed * 1.65);
            document.getElementById('drift-bar').style.width = `${player1.driftCharge}%`;
            document.getElementById('drift-status-text').textContent =
                player1.driftCharge >= 100 ? 'TURBO!' : `${Math.round(player1.driftCharge)}%`;

            const gearP1 = document.getElementById('gear-badge-p1');
            if (gearP1) gearP1.textContent = `⚙️ GIGI ${sound.lastGear[0] || 1}`;

            const boostBadge = document.getElementById('boost-badge');
            if (player1.boostTimer > 0) boostBadge.classList.remove('hidden');
            else boostBadge.classList.add('hidden');

            // Update Player 2 HUD in 2P Split-Screen Mode
            if (numPlayers === 2 && racers[1]) {
                const player2 = racers[1];
                const rankP2 = sorted.findIndex(r => r.id === 1) + 1;
                document.getElementById('hud-pos-p2').innerHTML = `${rankP2}<span class="text-[9px] font-normal">/4</span>`;
                document.getElementById('hud-pos-label-p2').textContent = posLabels[rankP2 - 1];
                document.getElementById('hud-score-p2').textContent = geometryScoreP2;
                document.getElementById('hud-lap-p2').textContent = `${Math.min(TOTAL_LAPS, player2.lap)}/${TOTAL_LAPS}`;

                document.getElementById('hud-speed-p2').textContent = Math.round(player2.speed * 1.65);
                document.getElementById('drift-bar-p2').style.width = `${player2.driftCharge}%`;
                document.getElementById('drift-status-text-p2').textContent =
                    player2.driftCharge >= 100 ? 'TURBO!' : `${Math.round(player2.driftCharge)}%`;

                const gearP2 = document.getElementById('gear-badge-p2');
                if (gearP2) gearP2.textContent = `⚙️ GIGI ${sound.lastGear[1] || 1}`;

                const boostBadgeP2 = document.getElementById('boost-badge-p2');
                if (player2.boostTimer > 0) boostBadgeP2.classList.remove('hidden');
                else boostBadgeP2.classList.add('hidden');
            }

            drawMinimap();
        }

        /********************************************************************
         * 10. UI MODALS, COUNTDOWN & RACE LIFECYCLE
         ********************************************************************/
        function selectDifficulty(level) {
            difficulty = level;
            ['easy', 'normal', 'hard'].forEach(l => {
                const btn = document.getElementById(`diff-${l}`);
                if (l === level) {
                    btn.className = 'diff-btn px-4 py-2 rounded-xl font-bold text-xs sm:text-sm border-2 border-amber-400 bg-amber-500 text-slate-950';
                } else {
                    btn.className = 'diff-btn px-4 py-2 rounded-xl font-bold text-xs sm:text-sm border-2 border-slate-600 bg-slate-800 text-slate-300';
                }
            });
        }

        let previousStateBeforeModal = 'START';

        function openFormulaModal() {
            if (gameState === 'RACING') {
                previousStateBeforeModal = 'RACING';
                gameState = 'PAUSED';
                sound.updateEngine(0, true);
            } else {
                previousStateBeforeModal = gameState;
            }
            const modal = document.getElementById('formula-modal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeFormulaModal() {
            const modal = document.getElementById('formula-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            if (previousStateBeforeModal === 'RACING') {
                gameState = 'RACING';
            }
        }

        function openSettingsModal() {
            sound.init();
            updateSoundButtonsUI();
            if (gameState === 'RACING') {
                previousStateBeforeModal = 'RACING';
                gameState = 'PAUSED';
                sound.updateEngine(0, true);
            } else {
                previousStateBeforeModal = gameState;
            }
            const modal = document.getElementById('settings-modal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        function closeSettingsModal() {
            const modal = document.getElementById('settings-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            if (previousStateBeforeModal === 'RACING') {
                gameState = 'RACING';
            }
        }

        function restartRaceFromSettings() {
            const modal = document.getElementById('settings-modal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            startRace();
        }

        function returnToMainMenu() {
            gameState = 'START';
            sound.updateEngine(0, true);
            document.getElementById('settings-modal').classList.add('hidden');
            document.getElementById('settings-modal').classList.remove('flex');
            document.getElementById('formula-modal').classList.add('hidden');
            document.getElementById('formula-modal').classList.remove('flex');
            document.getElementById('end-modal').classList.add('hidden');
            document.getElementById('end-modal').classList.remove('flex');
            document.getElementById('quiz-overlay-p1').classList.add('hidden');
            document.getElementById('quiz-overlay-p2').classList.add('hidden');
            document.getElementById('center-announcement').classList.add('hidden');
            document.getElementById('start-modal').classList.remove('hidden');
            resetRacersForNewRace();
            snapCameraToFar(camera, racers[0]);
            if (racers[1]) snapCameraToFar(cameraP2, racers[1]);
        }

        function startRace() {
            if (!assetsReady) { pendingStart = true; document.getElementById('loading-screen').classList.remove('hidden'); return; }
            _startRaceNow();
        }
        function _startRaceNow() {
            sound.init();
            document.getElementById('start-modal').classList.add('hidden');
            document.getElementById('end-modal').classList.add('hidden');
            document.getElementById('end-modal').classList.remove('flex');
            document.getElementById('quiz-overlay-p1').classList.add('hidden');
            document.getElementById('quiz-overlay-p2').classList.add('hidden');

            raceTime = 0;
            geometryScore = 0;
            geometryScoreP2 = 0;
            questionsAnswered = 0;
            questionsCorrect = 0;
            questionHistory.length = 0;
            playerPowerUpReady = [false, false];
            playerQuizActive = [false, false];
            activePowerUpQuestions = [null, null];
            updatePowerUpUI();
            resetRacersForNewRace();
            snapCameraToFar(camera, racers[0]);
            if (racers[1]) snapCameraToFar(cameraP2, racers[1]);
            handleWindowResize();
            updateHUD();
            updateActiveQuestionBanner(racers[0], false);
            if (numPlayers === 2) updateActiveQuestionBanner(racers[1], true);

            gameState = 'COUNTDOWN';
            const centerAnnounce = document.getElementById('center-announcement');
            const cdText = document.getElementById('countdown-text');
            centerAnnounce.classList.remove('hidden');

            let count = 3;
            cdText.textContent = count;
            sound.playCountdown(false);

            const interval = setInterval(() => {
                count--;
                if (count > 0) {
                    cdText.textContent = count;
                    sound.playCountdown(false);
                } else if (count === 0) {
                    cdText.textContent = 'GAS!! 🏎️';
                    sound.playCountdown(true);
                    gameState = 'RACING';
                } else {
                    centerAnnounce.classList.add('hidden');
                    clearInterval(interval);
                }
            }, 900);
        }

        function finishRace() {
            gameState = 'FINISHED';
            sound.updateEngine(0, true);
            sound.playCorrect();

            const sorted = [...racers].sort((a, b) => b.totalProgress - a.totalProgress);
            const rankP1 = sorted.findIndex(r => r.id === 0) + 1;
            const rankP2 = sorted.findIndex(r => r.id === 1) + 1;
            const acc = questionsAnswered > 0 ? Math.round((questionsCorrect / questionsAnswered) * 100) : 100;

            if (numPlayers === 2) {
                const winnerText = rankP1 < rankP2
                    ? `🏆 PEMAIN 1 MENANG BALAPAN! (P1 Juara ${rankP1} | P2 Juara ${rankP2})`
                    : `🏆 PEMAIN 2 MENANG BALAPAN! (P2 Juara ${rankP2} | P1 Juara ${rankP1})`;
                document.getElementById('end-title').textContent = winnerText;
                document.getElementById('end-rank').textContent = `P1: #${rankP1} | P2: #${rankP2}`;
                document.getElementById('end-score').textContent = `P1: ${geometryScore} | P2: ${geometryScoreP2}`;
            } else {
                const rankTitles = [
                    '🏆 JUARA 1 PODIUM GEOMETRI!',
                    '🥈 JUARA 2 PODIUM GEOMETRI!',
                    '🥉 JUARA 3 PODIUM GEOMETRI!',
                    '🏁 SELESAI BALAPAN (POSISI 4)!'
                ];
                document.getElementById('end-title').textContent = rankTitles[rankP1 - 1];
                document.getElementById('end-rank').textContent = `Juara ${rankP1}`;
                document.getElementById('end-score').textContent = geometryScore;
            }

            document.getElementById('end-time').textContent = formatTime(raceTime);
            document.getElementById('end-accuracy').textContent = `${acc}%`;

            const tbody = document.getElementById('end-log-body');
            tbody.innerHTML = '';

            if (questionHistory.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400">Belum ada gerbang soal yang dilewati.</td></tr>`;
            } else {
                questionHistory.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="py-2.5 px-3 font-bold text-amber-300">${item.shapeName}</td>
                        <td class="py-2.5 px-3 text-slate-200">${item.dimsText}</td>
                        <td class="py-2.5 px-3 text-sky-300 font-semibold">${item.stepsText}</td>
                        <td class="py-2.5 px-3 font-bold ${item.isCorrect ? 'text-emerald-400' : 'text-rose-400'}">${item.chosen}</td>
                        <td class="py-2.5 px-3 text-center">
                            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${
                                item.isCorrect ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }">
                                ${item.isCorrect ? '✓ BENAR' : '✕ SALAH'}
                            </span>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            const endModal = document.getElementById('end-modal');
            endModal.classList.remove('hidden');
            endModal.classList.add('flex');
        }

        function restartRace() {
            startRace();
        }

        /********************************************************************
         * 11. ANIMATION LOOP, VERTICAL SPLIT-SCREEN RENDER & WINDOW RESIZE
         ********************************************************************/
        let lastTime = performance.now();

        function renderScene() {
            const w = window.innerWidth;
            const h = window.innerHeight;

            if (numPlayers === 2) {
                renderer.setScissorTest(true);
                const halfW = Math.floor(w / 2);

                // Left Viewport: Player 1
                renderer.setViewport(0, 0, halfW, h);
                renderer.setScissor(0, 0, halfW, h);
                renderer.render(scene, camera);

                // Right Viewport: Player 2
                renderer.setViewport(halfW, 0, w - halfW, h);
                renderer.setScissor(halfW, 0, w - halfW, h);
                renderer.render(scene, cameraP2);
            } else {
                renderer.setScissorTest(false);
                renderer.setViewport(0, 0, w, h);
                renderer.render(scene, camera);
            }
        }

        function animate(now) {
            requestAnimationFrame(animate);
            const dt = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;

            balloons.forEach(b => {
                b.mesh.position.y = b.baseY + Math.sin(now * 0.0015 + b.phase) * 2.5;
                b.mesh.rotation.y += dt * 0.2;
            });
            clouds.forEach(c => {
                c.position.x += dt * 2.2;
                if (c.position.x > 600) c.position.x = -380;
            });

            updatePhysics(dt);
            updateCamera(dt);
            renderScene();
        }

        function handleWindowResize() {
            const w = window.innerWidth;
            const h = window.innerHeight;
            renderer.setSize(w, h);

            if (numPlayers === 2) {
                camera.aspect = (w * 0.5) / h;
                camera.updateProjectionMatrix();
                cameraP2.aspect = (w * 0.5) / h;
                cameraP2.updateProjectionMatrix();
            } else {
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
            }
        }

        window.addEventListener('resize', handleWindowResize);
        window.addEventListener('orientationchange', () => setTimeout(handleWindowResize, 250));

        // Prevent accidental pinch-zoom or double-tap zoom on Interactive Flat Panels & Mobile Touch
        document.addEventListener('gesturestart', (e) => e.preventDefault());
        document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

        window.addEventListener('DOMContentLoaded', () => {
            const g = document.getElementById('student-greeting');
            if (g && STUDENT_NAME) { g.textContent = '👋 Halo, ' + STUDENT_NAME + (STUDENT_SCHOOL ? ' dari ' + STUDENT_SCHOOL : '') + '! Siap balapan?'; g.classList.remove('hidden'); }
        });
        window.onload = function () {
            buildTrackGeometry();
            buildStartFinishArch();
            buildEnvironmentScenery();
            buildMathGates();
            buildMysteryBoxes();
            initRacers();
            snapCameraToFar(camera, racers[0]);
            if (racers[1]) snapCameraToFar(cameraP2, racers[1]);
            selectPlayerCount(1);
            updateActiveQuestionBanner(racers[0], false);
            drawMinimap();
            animate(performance.now());
        };
