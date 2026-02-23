class AudioEngine {
    private ctx: AudioContext | null = null;
    private bgmGainNode: GainNode | null = null;
    private sfxGainNode: GainNode | null = null;
    private bgmBuffers: { [key: string]: AudioBuffer } = {};
    private voiceBuffers: AudioBuffer[] = [];
    private currentBgmTrack: { source: AudioBufferSourceNode, gain: GainNode, name: string } | null = null;
    private requestedBGM: string | null = null;

    // Default volumes (0.0 to 1.0)
    bgmVolume: number = Number(localStorage.getItem('bgmVolume') || 0.5);
    sfxVolume: number = Number(localStorage.getItem('sfxVolume') || 0.5);

    async init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

            this.bgmGainNode = this.ctx.createGain();
            this.bgmGainNode.gain.value = this.bgmVolume;
            this.bgmGainNode.connect(this.ctx.destination);

            this.sfxGainNode = this.ctx.createGain();
            this.sfxGainNode.gain.value = this.sfxVolume * 0.8;
            this.sfxGainNode.connect(this.ctx.destination);

            // プレロード
            const bgms = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'clear1', 'clear2', 'boss_normal', 'boss_final', 'scenario', 'ending'];
            bgms.forEach(bgm => this.loadBGM(bgm));
            for (let i = 0; i <= 5; i++) this.loadVoice(i);
        }

        // ブラウザの自動再生ポリシーで suspended になっている場合は resume する
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    async loadBGM(name: string) {
        if (!this.ctx) return;
        try {
            // Updated to load MP3 files based on the newly mapped assets
            const path = name.startsWith('bgm_') ? `${name}.mp3` : `bgm_${name}.mp3`;
            const response = await fetch(`${import.meta.env.BASE_URL}assets/${path}`);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                this.bgmBuffers[name] = await this.ctx.decodeAudioData(arrayBuffer);
                if (this.requestedBGM === name) {
                    this.playBGM(name);
                }
            }
        } catch (e) {
            console.error("Error loading BGM:", name, e);
        }
    }

    async loadVoice(index: number) {
        if (!this.ctx) return;
        try {
            const response = await fetch(`${import.meta.env.BASE_URL}assets/voice_${index}.m4a`);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                this.voiceBuffers[index] = await this.ctx.decodeAudioData(arrayBuffer);
            }
        } catch (e) {
            console.error("Error loading Voice:", index, e);
        }
    }

    setBGMVolume(vol: number) {
        this.bgmVolume = Math.max(0, Math.min(1, vol));
        localStorage.setItem('bgmVolume', this.bgmVolume.toString());
        if (this.bgmGainNode) {
            this.bgmGainNode.gain.value = this.bgmVolume;
        }
    }

    setSFXVolume(vol: number) {
        this.sfxVolume = Math.max(0, Math.min(1, vol));
        localStorage.setItem('sfxVolume', this.sfxVolume.toString());
        if (this.sfxGainNode) {
            this.sfxGainNode.gain.value = this.sfxVolume * 0.8;
        }
    }

    // ピコピコ音風ショット音 (短形波のピッチダウン)
    playShot() {
        if (!this.ctx || !this.sfxGainNode) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.connect(gain);
        gain.connect(this.sfxGainNode);

        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    // 爆発音 (ノイズ風：周波数低めの矩形波モジュレーション)
    playExplosion() {
        if (!this.ctx || !this.sfxGainNode) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(this.sfxGainNode);

        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(10, now + 0.3);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    // パワーアップ音 (アルペジオ上昇)
    playPowerup() {
        if (!this.ctx || !this.sfxGainNode) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.connect(gain);
        gain.connect(this.sfxGainNode);

        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554, now + 0.05); // C#
        osc.frequency.setValueAtTime(659, now + 0.1);  // E
        osc.frequency.setValueAtTime(880, now + 0.15); // A

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    // 敵撃破音
    playEnemyDefeat() {
        if (!this.ctx || !this.sfxGainNode) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.connect(gain);
        gain.connect(this.sfxGainNode);

        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    // ボス被弾音 (金属音から爆発音風に変更)
    playBossHit() {
        if (!this.ctx || !this.sfxGainNode) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // 爆発音と同じくノイズ風の低い周波数の変調
        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(this.sfxGainNode);

        const now = this.ctx.currentTime;
        // 低めの音から素早く落とす
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.15);
    }

    // ナレーション音声再生（再生中はBGMをダッキングする）
    playVoice(index: number) {
        if (!this.ctx || !this.sfxGainNode || !this.bgmGainNode) return;
        const buffer = this.voiceBuffers[index];
        if (!buffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.sfxGainNode);

        const now = this.ctx.currentTime;
        this.bgmGainNode.gain.cancelScheduledValues(now);
        this.bgmGainNode.gain.setValueAtTime(this.bgmGainNode.gain.value, now);
        this.bgmGainNode.gain.linearRampToValueAtTime(this.bgmVolume * 0.2, now + 0.5);

        source.onended = () => {
            if (!this.ctx || !this.bgmGainNode) return;
            const endNow = this.ctx.currentTime;
            this.bgmGainNode.gain.cancelScheduledValues(endNow);
            this.bgmGainNode.gain.setValueAtTime(this.bgmGainNode.gain.value, endNow);
            this.bgmGainNode.gain.linearRampToValueAtTime(this.bgmVolume, endNow + 1.0);
        };

        source.start(0);
    }

    // 用意したBGM(.mp3)のクロスフェードループ再生
    playBGM(name: string, crossfadeDuration: number = 2.0) {
        if (!this.ctx || !this.bgmGainNode) return;

        // AudioContext が suspend されている場合は resume して再生を保証する
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => this.playBGM(name, crossfadeDuration));
            return;
        }

        const buffer = this.bgmBuffers[name];
        if (!buffer) {
            this.requestedBGM = name;
            return;
        }

        if (this.currentBgmTrack && this.currentBgmTrack.name === name) return; // Already playing

        const now = this.ctx.currentTime;

        // Fade out current track
        if (this.currentBgmTrack) {
            const oldTrack = this.currentBgmTrack;
            oldTrack.gain.gain.cancelScheduledValues(now);
            oldTrack.gain.gain.setValueAtTime(oldTrack.gain.gain.value, now);
            oldTrack.gain.gain.linearRampToValueAtTime(0, now + crossfadeDuration);
            setTimeout(() => {
                try { oldTrack.source.stop(); } catch (e) { }
                oldTrack.source.disconnect();
                oldTrack.gain.disconnect();
            }, crossfadeDuration * 1000 + 100);
        }

        // Setup new track
        const newSource = this.ctx.createBufferSource();
        newSource.buffer = buffer;
        newSource.loop = true;

        const newGain = this.ctx.createGain();
        newGain.gain.setValueAtTime(0, now);
        newGain.gain.linearRampToValueAtTime(1.0, now + crossfadeDuration);

        newSource.connect(newGain);
        newGain.connect(this.bgmGainNode);

        newSource.start(0);

        this.currentBgmTrack = { source: newSource, gain: newGain, name };
        this.requestedBGM = name;
    }

    // ステージクリア時のファンファーレ
    playVictoryJingle() {
        if (!this.ctx || !this.bgmGainNode) return;
        this.stopBGM(); // Stop current BGM
        this.requestedBGM = 'victory';

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.connect(gain);
        gain.connect(this.bgmGainNode); // Route to BGM line for volume matching

        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(523.25, now);     // C5
        osc.frequency.setValueAtTime(659.25, now + 0.15);// E5
        osc.frequency.setValueAtTime(783.99, now + 0.3); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.45);// C6

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.setValueAtTime(0.3, now + 0.45);
        gain.gain.linearRampToValueAtTime(0, now + 2.0);

        osc.start(now);
        osc.stop(now + 2.0);
    }

    stopBGM(fadeOutDuration: number = 1.0) {
        if (!this.ctx || !this.currentBgmTrack) return;
        const now = this.ctx.currentTime;
        const track = this.currentBgmTrack;

        track.gain.gain.cancelScheduledValues(now);
        track.gain.gain.setValueAtTime(track.gain.gain.value, now);
        track.gain.gain.linearRampToValueAtTime(0, now + fadeOutDuration);

        setTimeout(() => {
            try { track.source.stop(); } catch (e) { }
            track.source.disconnect();
            track.gain.disconnect();
        }, fadeOutDuration * 1000 + 100);

        this.currentBgmTrack = null;
    }
}

export const audio = new AudioEngine();
