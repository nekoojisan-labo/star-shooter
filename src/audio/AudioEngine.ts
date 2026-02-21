class AudioEngine {
    private ctx: AudioContext | null = null;
    private bgmGainNode: GainNode | null = null;
    private sfxGainNode: GainNode | null = null;
    private bgmBuffers: { [key: string]: AudioBuffer } = {};
    private bgmSource: AudioBufferSourceNode | null = null;

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
            this.sfxGainNode.gain.value = this.sfxVolume;
            this.sfxGainNode.connect(this.ctx.destination);

            // プレロード
            this.loadBGM('stage1');
            this.loadBGM('stage2');
            this.loadBGM('stage3');
            this.loadBGM('boss');
        }
    }

    async loadBGM(name: string) {
        if (!this.ctx) return;
        try {
            const response = await fetch(`/assets/${name}.wav`);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                this.bgmBuffers[name] = await this.ctx.decodeAudioData(arrayBuffer);
            }
        } catch (e) {
            console.error("Error loading BGM:", name, e);
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
            this.sfxGainNode.gain.value = this.sfxVolume;
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

    // 用意したBGM(.wav)のループ再生
    playBGM(stage: number | string) {
        if (!this.ctx || !this.bgmGainNode) return;
        this.stopBGM();

        const name = typeof stage === 'number' ? `stage${stage}` : stage;
        const buffer = this.bgmBuffers[name] || this.bgmBuffers['stage1'];

        if (!buffer) return; // まだロードされていなければ何もしない

        this.bgmSource = this.ctx.createBufferSource();
        this.bgmSource.buffer = buffer;
        this.bgmSource.loop = true;

        // ステージが進むごとに少しずつ再生速度(ピッチ)を上げて焦燥感を煽る
        const pitchStage = typeof stage === 'number' ? stage : 1;
        this.bgmSource.playbackRate.value = 1.0 + (pitchStage - 1) * 0.05;

        // Adjust this track's relative volume if needed, otherwise connect directly to BGM gain
        this.bgmSource.connect(this.bgmGainNode);

        this.bgmSource.start(0);
    }

    stopBGM() {
        if (this.bgmSource) {
            try {
                this.bgmSource.stop();
            } catch (e) {
                // ignoring error if already stopped
            }
            this.bgmSource.disconnect();
            this.bgmSource = null;
        }
    }
}

export const audio = new AudioEngine();
