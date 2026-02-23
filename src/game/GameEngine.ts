import { audio } from '../audio/AudioEngine';
import { processSprite } from '../utils/ImageUtils';
import { POWERUP_SLOTS, WeaponState } from './WeaponSystem';
import { Entity, Player, Bullet, Enemy, PowerUp, SpeedItem, Particle } from './Entities';
import { PatternEnemy, Boss, EnemyMotionType } from './EnemyTypes';

export const GameState = {
    Title: 0,
    Playing: 1,
    GameOver: 2,
    StageClear: 3,
    Config: 4,
    Scenario: 5,
    Paused: 6
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

interface ParallaxStar {
    x: number;
    y: number;
    speed: number;
    size: number;
    color: string;
}

export class GameEngine {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    keys: { [key: string]: boolean } = {};
    keysPressed: { [key: string]: boolean } = {}; // edge detection
    gamepadConnected: boolean = false;
    debugMode: boolean = false; // invincibility toggle
    audioInitialized = false;
    stageTimer: number = 0;
    gameTimer: number = 0; // Continuous timer for animations like Bits
    stageBossTime: number = 100;
    midBossTime: number = 45;
    midBossSpawned: boolean = false;

    stars: ParallaxStar[] = [];

    // Assets
    playerImage = new Image();
    enemyImage = new Image();
    bossImage = new Image();
    bgImages: HTMLImageElement[] = [];
    bulletBlueImage = new Image();
    bulletPinkImage = new Image();
    bulletOrangeImage = new Image();

    // State
    gameState: GameState = GameState.Title;
    score: number = 0;
    lives: number = 3;
    stage: number = 1;
    powerupGauge: number = 0; // 0 = empty, 1~7 = slot
    continues: number = 2; // user requested 2 continues
    nextExtendScore: number = 60000;

    // Config
    configSelection: number = 0; // 0: BGM, 1: SFX, 2: Return

    // Entities
    player: Player;
    bullets: Bullet[] = [];
    enemyBullets: Bullet[] = [];
    enemies: Enemy[] = [];
    particles: Particle[] = [];
    powerups: PowerUp[] = [];
    speedItems: SpeedItem[] = [];

    bgY: number = 0;
    enemySpawnTimer: number = 0;
    bossActive: boolean = false;

    scenarioTimer: number = 0;
    titleImage: HTMLImageElement | null = null;
    bossImages: HTMLImageElement[] = [];
    scenarioImages: HTMLImageElement[] = [];

    scenarioTexts: string[][] = [
        [
            "西暦、21XX年。人類は未曾有の危機に直面していた。",
            "突如として現れた機械生命体群が、銀河の各宙域を次々と制圧。",
            "残された希望は、最新鋭戦闘機「スターシューター」のみ。",
            "単機による敵中枢部への強襲作戦が、今始まろうとしている。"
        ],
        [
            "前線基地の防衛部隊を突破した。だが、これは敵の大軍勢のほんの一部に過ぎない。",
            "敵の補給線を断つため、アステロイド帯に築かれた採掘基地へと向かう。"
        ],
        [
            "巨大アステロイド基地を沈黙させた。",
            "敵の資源供給は絶たれたが、軌道上にはさらに巨大な要塞が待ち受けている。",
            "これより惑星軌道空間へ突入し、軌道防衛網の突破を図る。"
        ],
        [
            "軌道上の強固な防衛網を突破し、超巨大な敵空母群に接近した。",
            "次々と飛来する迎撃機をかわし、巨大戦艦へと肉薄する。"
        ],
        [
            "敵空母の沈めに成功した。残すは、敵母星の中枢に鎮座するマスターコアのみ。",
            "すべての終わりにして、我々の未来を取り戻すための最後の戦い。",
            "限界を突破し、決戦へ挑め。"
        ]
    ];
    endingTexts: string[] = [
        "マスターコアは沈黙し、機械生命体群は統制を失い活動を停止していく。",
        "あなたの孤独な戦いにより、人類は再び平和な星空を取り戻した。",
        "作戦完了、これより帰還する。",
        "-- THANK YOU FOR PLAYING --"
    ];

    // Touch Support
    touchActive: boolean = false;
    prevTouchX: number = 0;
    prevTouchY: number = 0;
    touchDeltaX: number = 0;
    touchDeltaY: number = 0;
    lastTapTime: number = 0;

    // Mobile detection
    isMobile: boolean = false;

    cleanup: () => void;

    async loadAssets() {
        for (let i = 1; i <= 3; i++) {
            this.bgImages[i] = await processSprite({
                src: `${import.meta.env.BASE_URL}assets/bg_stage${i}.png`,
            });
        }
        this.bgImages[0] = this.bgImages[1]; // fallback

        // Load title background and scenario images
        this.titleImage = new Image();
        this.titleImage.src = `${import.meta.env.BASE_URL}assets/title_bg.png`;
        for (let i = 0; i <= 5; i++) {
            const img = new Image();
            img.src = `${import.meta.env.BASE_URL}assets/scene_${i}.png`;
            this.scenarioImages.push(img);
        }

        this.playerImage = await processSprite({
            src: `${import.meta.env.BASE_URL}assets/player.png`,
            crop: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
            removeBg: true
        });
        this.enemyImage = await processSprite({
            src: `${import.meta.env.BASE_URL}assets/enemies.png`,
            removeBg: true
        });
        for (let i = 1; i <= 5; i++) {
            try {
                const bimg = await processSprite({
                    src: `${import.meta.env.BASE_URL}assets/boss_${i}.png`,
                    crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
                    removeBg: true,
                    rotate180: true
                });
                this.bossImages.push(bimg);
            } catch (e) {
                console.warn(`Could not load boss_${i}.png`);
                this.bossImages.push(new Image()); // fallback placeholder
            }
        }

        this.bulletBlueImage = await processSprite({ src: `${import.meta.env.BASE_URL}assets/bullet_blue.png`, removeBg: true });
        this.bulletPinkImage = await processSprite({ src: `${import.meta.env.BASE_URL}assets/bullet_pink.png`, removeBg: true });
        this.bulletOrangeImage = await processSprite({ src: `${import.meta.env.BASE_URL}assets/bullet_orange.png`, removeBg: true });
    }

    constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;

        this.loadAssets();

        this.player = new Player(this, width / 2 - 24, height - 100);

        // Initialize stars
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                speed: Math.random() * 20 + 10,
                size: Math.random() * 1.5 + 0.5,
                color: `rgba(255, 255, 255, ${Math.random() * 0.8 + 0.2})`
            });
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!this.keys[e.key]) this.keysPressed[e.key] = true;
            this.keys[e.key] = true;
            // F1 toggles debug/invincibility mode
            if (e.key === 'F1') {
                e.preventDefault();
                this.debugMode = !this.debugMode;
            }
            if (!this.audioInitialized) {
                audio.init();
                this.audioInitialized = true;
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => { this.keys[e.key] = false; };

        const handleTouchStart = (e: TouchEvent) => {
            if (e.cancelable) e.preventDefault();
            this.isMobile = true; // Detect mobile on first touch
            if (!this.audioInitialized) {
                audio.init();
                this.audioInitialized = true;
            }
            if (this.gameState === GameState.Title || this.gameState === GameState.GameOver || this.gameState === GameState.StageClear) {
                if (!this.keys['Enter']) this.keysPressed['Enter'] = true;
                this.keys['Enter'] = true;
                return;
            }
            if (this.gameState === GameState.Config) {
                if (!this.keys['Enter']) this.keysPressed['Enter'] = true;
                this.keys['Enter'] = true;
                return;
            }
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                const now = Date.now();

                // Mobile button layout
                const btnSize = 80;
                const margin = 12;
                const gaugeHeight = 36;
                const gaugePadding = 20;
                const btnY = this.height - gaugeHeight - gaugePadding - btnSize - margin;

                const cx = touch.clientX;
                const cy = touch.clientY;

                // Check if touched the Bomb button (bottom left, above gauge)
                const bombX = margin;
                if (cx >= bombX && cx <= bombX + btnSize && cy >= btnY && cy <= btnY + btnSize) {
                    if (this.player.bombCount > 0) {
                        if (!this.keys['c']) this.keysPressed['c'] = true;
                        this.keys['c'] = true;
                    }
                    return; // Handled button, don't move
                }

                // Check if touched the Powerup button (bottom right, above gauge)
                const pwrX = this.width - margin - btnSize;
                if (cx >= pwrX && cx <= pwrX + btnSize && cy >= btnY && cy <= btnY + btnSize) {
                    if (!this.keys['x']) this.keysPressed['x'] = true;
                    this.keys['x'] = true;
                    return; // Handled button, don't move
                }

                // Tapped on gauge area (use same gaugePadding as draw)
                if (touch.clientY > this.height - gaugeHeight - 20) {
                    if (!this.keys['x']) this.keysPressed['x'] = true;
                    this.keys['x'] = true;
                } else {
                    this.touchActive = true;
                    this.prevTouchX = touch.clientX;
                    this.prevTouchY = touch.clientY;
                    if (now - this.lastTapTime < 300) { // Double tap for bomb (legacy backup)
                        if (!this.keys['c']) this.keysPressed['c'] = true;
                        this.keys['c'] = true;
                    }
                }
                this.lastTapTime = now;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.cancelable) e.preventDefault();
            if (e.touches.length > 0 && this.touchActive) {
                const cx = e.touches[0].clientX;
                const cy = e.touches[0].clientY;
                this.touchDeltaX += cx - this.prevTouchX;
                this.touchDeltaY += cy - this.prevTouchY;
                this.prevTouchX = cx;
                this.prevTouchY = cy;
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (e.cancelable) e.preventDefault();
            if (e.touches.length === 0) {
                this.touchActive = false;
            }
            this.keys['Enter'] = false;
            this.keys['c'] = false;
            this.keys['x'] = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd, { passive: false });

        // Gamepad API – works automatically for USB and Bluetooth controllers
        const handleGamepadConnected = (e: GamepadEvent) => {
            console.log(`Gamepad connected: ${e.gamepad.id}`);
            if (!this.audioInitialized) {
                audio.init();
                this.audioInitialized = true;
            }
        };
        const handleGamepadDisconnected = (e: GamepadEvent) => {
            console.log(`Gamepad disconnected: ${e.gamepad.id}`);
        };
        window.addEventListener('gamepadconnected', handleGamepadConnected);
        window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

        this.cleanup = () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('gamepadconnected', handleGamepadConnected);
            window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
            audio.stopBGM();
        };
    }

    resize(w: number, h: number) {
        this.width = w;
        this.height = h;
    }

    addBullet(b: Bullet) { this.bullets.push(b); }
    addEnemyBullet(b: Bullet) { this.enemyBullets.push(b); }
    addEnemy(e: Enemy) { this.enemies.push(e); }
    addParticle(p: Particle) { this.particles.push(p); }

    triggerBomb() {
        this.enemyBullets = [];
        this.enemies.forEach(e => {
            if (e.active && e.y > 0) { // Only affect those on screen
                e.hit(100); // Massive damage

                // Visual explosion effect exactly on the enemy
                for (let i = 0; i < 15; i++) {
                    const p = new Particle(this, e.x + Math.random() * e.width, e.y + Math.random() * e.height);
                    p.color = (Math.random() > 0.5) ? '#FFAA00' : '#FF4400';
                    this.addParticle(p);
                }
            }
        });

        if (this.audioInitialized) audio.playExplosion();
    }

    addScore(s: number) {
        this.score += s;
        if (this.score >= this.nextExtendScore) {
            this.lives = Math.min(this.lives + 1, 5);
            this.nextExtendScore += 60000;
            if (this.audioInitialized) audio.playPowerup(); // Play sound for extra life

            // Show a floating text for extend (if existed) or just particles to indicate
            for (let i = 0; i < 20; i++) {
                const p = new Particle(this, this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
                p.color = '#00FF00';
                this.addParticle(p);
            }
        }
    }

    /**
     * Polls the Web Gamepad API and injects state into this.keys / this.keysPressed
     * so all existing game logic works without any changes.
     * Button mapping (standard layout):
     *   Buttons[0] A -> shoot (z)
     *   Buttons[1] B -> also shoot
     *   Buttons[2] X -> bomb (c)
     *   Buttons[3] Y -> also bomb
     *   Buttons[4/5] L/R shoulder -> powerup (x)
     *   Buttons[8] Select/Back -> config (c on title)
     *   Buttons[9] Start -> Enter
     *   Axes 0/1 (left stick) -> WASD/Arrow keys
     *   D-pad (Buttons 12-15) -> Up/Down/Left/Right
     */
    pollGamepad() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        // Only process the first connected gamepad
        let gp: Gamepad | null = null;
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) { gp = gamepads[i]; break; }
        }
        this.gamepadConnected = !!gp;
        if (!gp) return;

        const DEADZONE = 0.3;
        const axisX = gp.axes[0] ?? 0;
        const axisY = gp.axes[1] ?? 0;

        // ---- Directional: stick + D-pad ----
        const leftPressed = axisX < -DEADZONE || (gp.buttons[14]?.pressed ?? false);
        const rightPressed = axisX > DEADZONE || (gp.buttons[15]?.pressed ?? false);
        const upPressed = axisY < -DEADZONE || (gp.buttons[12]?.pressed ?? false);
        const downPressed = axisY > DEADZONE || (gp.buttons[13]?.pressed ?? false);

        const mapAxis = (key: string, pressed: boolean) => {
            if (pressed && !this.keys[key]) this.keysPressed[key] = true;
            this.keys[key] = pressed;
        };
        mapAxis('ArrowLeft', leftPressed);
        mapAxis('ArrowRight', rightPressed);
        mapAxis('ArrowUp', upPressed);
        mapAxis('ArrowDown', downPressed);

        // ---- Action buttons ----
        const btn = (i: number) => gp!.buttons[i]?.pressed ?? false;

        // Y (btn 3) = Shoot (z key)
        const shootPressed = btn(3);
        if (shootPressed && !this.keys['z']) this.keysPressed['z'] = true;
        this.keys['z'] = shootPressed;

        // B (btn 1) = Bomb (c key)
        const bombPressed = btn(1);
        if (bombPressed && !this.keys['c']) this.keysPressed['c'] = true;
        this.keys['c'] = bombPressed;

        // L/R shoulder (btn 4/5) = Powerup cycle (x key)
        const powerupPressed = btn(4) || btn(5);
        if (powerupPressed && !this.keys['x']) this.keysPressed['x'] = true;
        this.keys['x'] = powerupPressed;

        // Select (btn 8) = Toggle debug/invincibility mode
        const selectNowPressed = btn(8);
        if (selectNowPressed && !this.keys['_select']) {
            this.debugMode = !this.debugMode;
        }
        this.keys['_select'] = selectNowPressed;

        // Start (btn 9) = Enter / Pause
        const startPressed = btn(9);
        if (startPressed && !this.keys['Enter']) this.keysPressed['Enter'] = true;
        this.keys['Enter'] = startPressed;
    }

    update(dt: number) {
        // Poll gamepad every frame before processing game state
        this.pollGamepad();

        // --- Pause toggle on Enter/Start when Playing or Paused ---
        if (this.keysPressed['Enter'] && (this.gameState === GameState.Playing || this.gameState === GameState.Paused)) {
            if (this.gameState === GameState.Playing) {
                this.gameState = GameState.Paused;
            } else {
                this.gameState = GameState.Playing;
            }
            this.keysPressed = {};
            return;
        }

        // When paused: do nothing else
        if (this.gameState === GameState.Paused) {
            this.keysPressed = {};
            return;
        }
        if (this.gameState === GameState.Title) {
            if (this.keysPressed['Enter'] || this.keysPressed['z']) {
                if (!this.audioInitialized) {
                    audio.init();
                    this.audioInitialized = true;
                }
                this.stage = 1;
                this.resetGame('new');
                this.gameState = GameState.Scenario;
                this.scenarioTimer = 0;
                if (this.audioInitialized) {
                    audio.playBGM('scenario');
                    // audio.playVoice(0); // Navigation canceled
                }
            } else if (this.keysPressed['c']) {
                this.gameState = GameState.Config;
                this.configSelection = 0;
            }
            this.keysPressed = {}; // Edge clear
            return;
        }

        if (this.gameState === GameState.Config) {
            if (this.keysPressed['ArrowUp'] || this.keysPressed['w']) {
                this.configSelection = (this.configSelection - 1 + 3) % 3;
            } else if (this.keysPressed['ArrowDown'] || this.keysPressed['s']) {
                this.configSelection = (this.configSelection + 1) % 3;
            }

            const adjustVol = (current: number, delta: number) => Math.max(0, Math.min(1, current + delta));
            if (this.keysPressed['ArrowLeft'] || this.keysPressed['a']) {
                if (this.configSelection === 0) audio.setBGMVolume(adjustVol(audio.bgmVolume, -0.1));
                if (this.configSelection === 1) {
                    audio.setSFXVolume(adjustVol(audio.sfxVolume, -0.1));
                    audio.playShot();
                }
            } else if (this.keysPressed['ArrowRight'] || this.keysPressed['d']) {
                if (this.configSelection === 0) audio.setBGMVolume(adjustVol(audio.bgmVolume, 0.1));
                if (this.configSelection === 1) {
                    audio.setSFXVolume(adjustVol(audio.sfxVolume, 0.1));
                    audio.playShot();
                }
            }

            if ((this.keysPressed['Enter'] || this.keysPressed[' '] || this.keysPressed['z']) && this.configSelection === 2) {
                this.gameState = GameState.Title;
            }
            this.keysPressed = {};
            return;
        }

        if (this.gameState === GameState.GameOver) {
            // Keep particles animating during death
            this.particles.forEach(p => p.update(dt));
            this.particles = this.particles.filter(p => p.active);

            if (this.keysPressed['Enter']) {
                if (this.continues > 0) {
                    this.continues--;
                    this.resetGame('continue'); // Continue
                    this.gameState = GameState.Playing;
                } else {
                    this.resetToTitle();
                }
            }
            this.keysPressed = {};
            return;
        }

        if (this.gameState === GameState.StageClear) {
            this.particles.forEach(p => p.update(dt));
            this.particles = this.particles.filter(p => p.active);

            // Allow player bullets to continue flying off-screen!
            this.bullets.forEach(b => b.update(dt));
            this.bullets = this.bullets.filter(b => b.active);

            this.player.update(dt); // allow player to move during result

            if (this.keysPressed['Enter']) {
                if (this.stage >= 5) {
                    this.stage = 6;
                    this.gameState = GameState.Scenario;
                    this.scenarioTimer = 0;
                    if (this.audioInitialized) {
                        audio.playBGM('ending');
                        // audio.playVoice(5); // Navigation canceled
                    }
                } else {
                    this.stage++;
                    this.resetGame('nextStage');
                    this.gameState = GameState.Scenario;
                    this.scenarioTimer = 0;
                    if (this.audioInitialized) {
                        audio.playBGM('scenario');
                        // audio.playVoice(this.stage - 1); // Navigation canceled
                    }
                }
            }
            this.keysPressed = {};
            return;
        }

        if (this.gameState === GameState.Scenario) {
            this.scenarioTimer += dt;
            const lines = this.stage >= 6 ? this.endingTexts : this.scenarioTexts[this.stage - 1];
            if (lines) {
                if (this.keysPressed['Enter']) {
                    if (this.scenarioTimer > lines.length * 1.5 + 1.0) {
                        if (this.stage >= 6) {
                            this.resetToTitle();
                        } else {
                            this.gameState = GameState.Playing;
                            if (this.audioInitialized) audio.playBGM('stage' + Math.min(this.stage, 5));
                        }
                    } else {
                        // Skip text
                        this.scenarioTimer = lines.length * 1.5 + 1.1;
                    }
                }
            }
            this.keysPressed = {};
            return;
        }

        // bomb flash timer logic removed

        if (this.gameState === GameState.Playing) {
            this.gameTimer += dt;
            if (!this.bossActive) {
                this.stageTimer += dt;
            }
        }

        this.bgY += 50 * dt;
        const currentBg = this.bgImages[this.stage] || this.bgImages[1];
        if (currentBg && currentBg.naturalWidth > 0) {
            const ratio = this.width / currentBg.width;
            const scaledHeight = currentBg.height * ratio;
            if (this.bgY >= scaledHeight) {
                this.bgY -= scaledHeight;
            }
        }

        // Update stars
        for (const star of this.stars) {
            star.y += star.speed * dt * (1 + this.stage * 0.2); // Faster stars in later stages
            if (star.y > this.height) {
                star.y = 0;
                star.x = Math.random() * this.width;
            }
        }

        this.enemySpawnTimer -= dt;
        if (this.enemySpawnTimer <= 0 && !this.bossActive) {
            // Spawn interval shrinks from 2.0s (stage1) to 0.7s (stage5)
            this.enemySpawnTimer = Math.max(0.7, 2.0 - (this.stage * 0.25));

            const stage = this.stage;
            const rand = Math.random();
            // Stage 4+: difficulty scales up 10% per stage beyond 3
            // e.g. stage4=1.1x, stage5=1.2x — applied to formation sizes
            const difficultyMult = stage >= 4 ? 1.0 + (stage - 3) * 0.1 : 1.0;

            if (rand < 0.25) {
                // V-Formation: size and type scaled by stage
                const centerX = Math.random() * (this.width - 120) + 60;
                const type1 = stage >= 4 ? EnemyMotionType.Burster : EnemyMotionType.SineWave;
                const type2 = stage >= 3 ? EnemyMotionType.Sniper : EnemyMotionType.SineWave;
                const baseCount = 3 + Math.floor(stage / 2);
                const count = Math.round(baseCount * difficultyMult); // scaled
                for (let i = 0; i < count; i++) {
                    this.addEnemy(new PatternEnemy(this, centerX + (i - Math.floor(count / 2)) * 40, -50 - i * 30, i === Math.floor(count / 2) ? type1 : type2));
                }
            } else if (rand < 0.50) {
                // Horizontal Line Formation: longer in later stages
                const startX = Math.random() * (this.width - 240) + 40;
                const baseCount = 3 + Math.floor(stage / 2);
                const count = Math.round(baseCount * difficultyMult);
                const type = stage >= 3 ? EnemyMotionType.StopAndShoot : EnemyMotionType.Straight;
                for (let i = 0; i < count; i++) {
                    this.addEnemy(new PatternEnemy(this, startX + i * 40, -50, type));
                }
            } else if (rand < 0.65) {
                // Vertical Column Formation
                const startX = Math.random() * (this.width - 40);
                const type = stage >= 4 ? EnemyMotionType.Tank : EnemyMotionType.Homing;
                this.addEnemy(new PatternEnemy(this, startX, -50, type));
                this.addEnemy(new PatternEnemy(this, startX, -90, type));
                if (stage >= 2) this.addEnemy(new PatternEnemy(this, startX, -130, type));
                if (stage >= 4) this.addEnemy(new PatternEnemy(this, startX, -170, type));
                // Stage 4+: extra enemy scaled by difficulty
                if (stage >= 4 && difficultyMult >= 1.1) this.addEnemy(new PatternEnemy(this, startX, -210, type));
                if (stage >= 5 && difficultyMult >= 1.2) this.addEnemy(new PatternEnemy(this, startX, -250, type));
            } else if (rand < 0.80) {
                // Stage 2+: diagonal flankers
                const type = stage >= 3 ? EnemyMotionType.Dive : EnemyMotionType.ZigZag;
                this.addEnemy(new PatternEnemy(this, 40, -50, type));
                this.addEnemy(new PatternEnemy(this, this.width - 80, -50, type));
                if (stage >= 3) {
                    this.addEnemy(new PatternEnemy(this, 120, -80, type));
                    this.addEnemy(new PatternEnemy(this, this.width - 160, -80, type));
                }
                // Stage 4+: extra flankers
                if (stage >= 4) {
                    this.addEnemy(new PatternEnemy(this, 200, -110, type));
                    this.addEnemy(new PatternEnemy(this, this.width - 240, -110, type));
                }
                if (stage >= 5) {
                    this.addEnemy(new PatternEnemy(this, 80, -140, type));
                    this.addEnemy(new PatternEnemy(this, this.width - 120, -140, type));
                }
            } else {
                // Single Spawn or Pair (varied types based on stage)
                const x = Math.random() * (this.width - 40);
                // Use tougher types in later stages
                const motionPool = stage <= 2
                    ? [EnemyMotionType.Straight, EnemyMotionType.SineWave, EnemyMotionType.Hover]
                    : stage <= 4
                        ? [EnemyMotionType.Warper, EnemyMotionType.Bomber, EnemyMotionType.Burster, EnemyMotionType.Kamikaze]
                        : [EnemyMotionType.Tank, EnemyMotionType.Bomber, EnemyMotionType.Sniper, EnemyMotionType.Sweeper];
                const motionType = motionPool[Math.floor(Math.random() * motionPool.length)];
                this.addEnemy(new PatternEnemy(this, x, -50, motionType));
                if (Math.random() > 0.5) {
                    this.addEnemy(new PatternEnemy(this, this.width - x, -80, motionType));
                }
                if (stage >= 4 && Math.random() > 0.5) {
                    this.addEnemy(new PatternEnemy(this, Math.random() * (this.width - 40), -110, motionType));
                }
                // Stage 5: guaranteed third enemy
                if (stage >= 5) {
                    this.addEnemy(new PatternEnemy(this, Math.random() * (this.width - 40), -150, motionType));
                }
            }

            // Mid boss trigger
            if (this.stageTimer >= this.midBossTime && !this.midBossSpawned && !this.bossActive) {
                this.bossActive = true;
                this.midBossSpawned = true;

                const midBoss = new Boss(this, this.width / 2 - 64, -150, Math.max(1, this.stage - 1));
                midBoss.isMidBoss = true;
                midBoss.scoreValue = 3000;
                midBoss.initPhases(); // Assigns stage-specific mid-boss patterns + recalcs HP
                this.addEnemy(midBoss);
            }

            // Stage boss trigger
            if (this.stageTimer >= this.stageBossTime && !this.bossActive && this.midBossSpawned) {
                this.bossActive = true;
                if (this.audioInitialized) audio.playBGM(this.stage === 5 ? 'boss_final' : 'boss_normal');
                this.addEnemy(new Boss(this, this.width / 2 - 64, -150, this.stage));
            }
        }

        this.player.update(dt);
        this.bullets.forEach(b => b.update(dt));
        this.enemyBullets.forEach(b => b.update(dt));
        this.enemies.forEach(e => e.update(dt));
        this.particles.forEach(p => p.update(dt));
        this.powerups.forEach(p => p.update(dt));
        this.speedItems.forEach(s => s.update(dt));

        this.bullets = this.bullets.filter(b => b.active);
        this.enemyBullets = this.enemyBullets.filter(b => b.active);
        this.enemies = this.enemies.filter(e => e.active);
        this.particles = this.particles.filter(p => p.active);
        this.powerups = this.powerups.filter(p => p.active);
        this.speedItems = this.speedItems.filter(s => s.active);

        this.checkCollisions();

        // edge keys clear at end of frame
        this.keysPressed = {};
    }

    checkCollisions() {
        // Bullet hits Enemy
        for (const b of this.bullets) {
            for (const e of this.enemies) {
                if (b.active && e.active && this.isAABB(b, e)) {
                    if (!b.pierces) {
                        b.active = false;
                    }
                    e.hit(b.damage);
                }
            }
        }

        // Player hits Enemy
        for (const e of this.enemies) {
            if (e.active && this.isAABB(this.player, e)) {
                e.hit(100);
                if (this.gameState === GameState.StageClear) return; // Prevent double-KO game over when hitting boss

                if (this.player.barrierHp > 0) {
                    this.player.barrierHp--;
                    if (this.audioInitialized) audio.playExplosion();
                } else {
                    this.playerHit();
                }
            }
        }

        // Enemy bullet hits Player Bits (Bits block bullets)
        for (const b of this.enemyBullets) {
            if (!b.active) continue;
            for (const bit of this.player.bits) {
                // Expanding the bit collision box slightly to catch fast-moving bullets that might skip frames
                const margin = 10;
                const hitBox = {
                    x: bit.x - margin,
                    y: bit.y - margin,
                    width: bit.width + margin * 2,
                    height: bit.height + margin * 2
                };
                if (this.isAABB(hitBox as any, b)) {
                    b.active = false;
                    for (let i = 0; i < 3; i++) this.addParticle(new Particle(this, b.x + b.width / 2, b.y + b.height / 2));
                    break;
                }
            }
        }

        // Enemy hits Player Bits (Bits damage/destroy enemies)
        for (const e of this.enemies) {
            if (!e.active) continue;
            for (const bit of this.player.bits) {
                if (this.isAABB(bit, e)) {
                    // Massive damage similar to bomb or direct body hit
                    e.hit(100);
                    // Do not destroy the bit here so it acts as a perm shield,
                    // but add visual feedback
                    for (let i = 0; i < 5; i++) this.addParticle(new Particle(this, e.x + e.width / 2, e.y + e.height / 2));
                    break;
                }
            }
        }

        // Enemy bullet hits Player
        for (const b of this.enemyBullets) {
            if (b.active && this.isAABB(this.player, b)) {
                b.active = false;
                if (this.player.barrierHp > 0) {
                    this.player.barrierHp--;
                    if (this.audioInitialized) audio.playExplosion();
                } else {
                    this.playerHit();
                }
            }
        }

        // Player hits Powerup
        for (const p of this.powerups) {
            if (p.active && this.isAABB(this.player, p)) {
                p.active = false;
                if (this.audioInitialized) audio.playPowerup();
                this.powerupGauge = (this.powerupGauge % POWERUP_SLOTS.length) + 1;
                this.addScore(500);
            }
        }

        // Player hits SpeedItem
        for (const s of this.speedItems) {
            if (s.active && this.isAABB(this.player, s)) {
                s.active = false;
                if (this.audioInitialized) audio.playPowerup(); // Or a custom sound if desired
                this.player.speedLevel = Math.min(this.player.speedLevel + 1, 3);
                this.addScore(500);

                // Visual feedback for speed up
                for (let i = 0; i < 5; i++) {
                    const p = new Particle(this, this.player.x + this.player.width / 2, this.player.y + this.player.height);
                    p.color = '#00FFAA';
                    this.addParticle(p);
                }
            }
        }
    }

    playerHit() {
        if (this.player.invincibleTimer > 0) return;
        if (this.debugMode) return; // invincible in debug mode

        if (this.audioInitialized) audio.playExplosion();
        // particles
        for (let i = 0; i < 30; i++) {
            this.addParticle(new Particle(this, this.player.x + this.player.width / 2, this.player.y + this.player.height / 2));
        }

        this.lives -= 1;
        this.player.weapon = new WeaponState();
        this.player.bits = [];
        this.player.barrierHp = 0;
        this.player.speedLevel = 0;

        if (this.lives <= 0) {
            this.gameState = GameState.GameOver;
            if (this.audioInitialized) audio.stopBGM();
        } else {
            // respawn logic with invincibility
            this.player.x = this.width / 2 - 24;
            this.player.y = this.height - 100;
            this.player.invincibleTimer = 3.0; // 3 seconds invincibility
        }
    }

    resetToTitle() {
        this.gameState = GameState.Title;
        this.continues = 2;
        this.resetGame('new');
    }

    resetGame(resetType: 'new' | 'continue' | 'nextStage' = 'new') {
        if (resetType === 'continue') {
            this.score = 0;
            this.nextExtendScore = 60000;
            this.lives = 3;
            this.stageTimer = 0;
            this.gameTimer = 0;
            this.midBossSpawned = false;
        } else if (resetType === 'new') {
            this.score = 0;
            this.stage = 1;
            this.nextExtendScore = 60000;
            this.continues = 2;
            this.lives = 3;
            this.stageTimer = 0;
            this.gameTimer = 0;
            this.midBossSpawned = false;
        } else if (resetType === 'nextStage') {
            this.stageTimer = 0;
            // Note: gameTimer keeps running across stages
            this.midBossSpawned = false;
        }

        this.player.x = this.width / 2 - 24;
        this.player.y = this.height - 100;
        this.player.invincibleTimer = 3.0;

        if (resetType !== 'nextStage') {
            this.player.weapon = new WeaponState();
            this.player.bits = [];
            this.player.barrierHp = 0;
            this.player.bombCount = 2;
            this.player.speedLevel = 0;
        }

        this.powerupGauge = 0;
        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.powerups = [];
        this.speedItems = [];
        this.bossActive = false;
        if (this.audioInitialized) audio.playBGM('stage' + Math.min(this.stage, 5));
    }

    isAABB(a: Entity, b: Entity) {
        const margin = 4; // slight grace area
        return a.x + margin < b.x + b.width - margin &&
            a.x + a.width - margin > b.x + margin &&
            a.y + margin < b.y + b.height - margin &&
            a.y + a.height - margin > b.y + margin;
    }

    draw() {
        const currentBg = this.bgImages[this.stage] || this.bgImages[1];
        if (currentBg && currentBg.complete && currentBg.naturalWidth > 0) {
            const ratio = this.width / currentBg.width;
            const scaledHeight = currentBg.height * ratio;

            let drawY = this.bgY - scaledHeight;
            while (drawY < this.height) {
                this.ctx.drawImage(currentBg, 0, drawY, this.width, scaledHeight);
                drawY += scaledHeight;
            }

            // Draw Parallax Stars
            for (const star of this.stars) {
                this.ctx.fillStyle = star.color;
                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Draw Dynamic Nebula
            const nebulaY = (this.bgY * 0.5) % this.height;
            const nebulaGradient = this.ctx.createRadialGradient(this.width / 2 + Math.sin(this.bgY * 0.01) * 100, nebulaY, 0, this.width / 2, nebulaY, 400);

            const hue = (this.stage * 60 + this.bgY * 0.05) % 360;
            nebulaGradient.addColorStop(0, `hsla(${hue}, 70%, 50%, 0.15)`);
            nebulaGradient.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.fillStyle = nebulaGradient;
            this.ctx.fillRect(0, 0, this.width, this.height);

            // 背景上に暗いオーバーレイを重ねてキャラクターの視認性を上げる
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else {
            this.ctx.fillStyle = '#050510';
            this.ctx.fillRect(0, 0, this.width, this.height);

            // Draw Parallax Stars even without bg
            for (const star of this.stars) {
                this.ctx.fillStyle = star.color;
                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        this.powerups.forEach(p => p.draw(this.ctx));
        this.speedItems.forEach(s => s.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.bullets.forEach(b => b.draw(this.ctx));
        this.enemyBullets.forEach(b => b.draw(this.ctx));
        if (this.gameState === GameState.Playing || this.gameState === GameState.Paused) {
            this.player.draw(this.ctx);
        }
        this.particles.forEach(p => p.draw(this.ctx));

        // bomb flash rendering removed

        // UI
        if (this.gameState === GameState.Playing || this.gameState === GameState.GameOver || this.gameState === GameState.StageClear) {
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 20px "Courier New"';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`SCORE: ${this.score}`, 10, 30);

            if (!this.isMobile) {
                this.ctx.fillText(`LIVES: ${'❤'.repeat(Math.max(0, this.lives))}`, 10, 60);
                this.ctx.fillText(`BOMBS: ${'B'.repeat(Math.max(0, this.player.bombCount))}`, 10, 90);
            }

            this.ctx.textAlign = 'right';
            this.ctx.fillText(`STAGE: ${this.stage}`, this.width - 10, 30);

            if (this.debugMode) {
                this.ctx.fillStyle = '#FF4444';
                this.ctx.font = 'bold 16px "Courier New"';
                this.ctx.textAlign = 'right';
                this.ctx.fillText('🔧 DEBUG [INVINCIBLE]', this.width - 10, 56);
            }

            // Detailed Weapon stats removed as per user request
            // if (this.player.weapon.level > 1 || this.player.weapon.type !== WeaponType.Normal) {
            //     // ...
            // }

            // ---- Draw Mobile Virtual Buttons (mobile only) ----
            if (this.isMobile) {
                const btnSize = 80;
                const margin = 12;
                const gaugeHeight = 36;
                const gaugePadding = 8;
                const safeBottom = 60;
                const btnY = this.height - safeBottom - gaugeHeight - gaugePadding - btnSize - margin;

                // Mobile specific info (Lives / Bombs)
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 16px "Courier New"';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`LIVES: ${'❤'.repeat(Math.max(0, this.lives))}`, margin + btnSize / 2, btnY - 15);
                this.ctx.fillText(`BOMB: ${this.player.bombCount}`, margin + btnSize / 2, btnY + btnSize + 25);

                // Bomb Button (Left)
                const bombX = margin;
                const hasBombs = this.player.bombCount > 0;
                this.ctx.save();
                if (hasBombs) {
                    this.ctx.shadowBlur = 12;
                    this.ctx.shadowColor = 'rgba(255, 80, 50, 0.8)';
                }
                this.ctx.fillStyle = hasBombs ? 'rgba(255, 50, 30, 0.6)' : 'rgba(80, 80, 80, 0.4)';
                this.ctx.strokeStyle = hasBombs ? '#FF8866' : '#666666';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.roundRect(bombX, btnY, btnSize, btnSize, 14);
                this.ctx.fill();
                this.ctx.stroke();
                this.ctx.restore();
                // Bomb icon & label
                this.ctx.fillStyle = hasBombs ? '#FFFFFF' : '#999999';
                this.ctx.font = 'bold 28px "Courier New"';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('\u{1F4A3}', bombX + btnSize / 2, btnY + btnSize / 2 - 8);
                this.ctx.font = 'bold 12px "Courier New"';
                this.ctx.fillText(`BOMB x${this.player.bombCount}`, bombX + btnSize / 2, btnY + btnSize - 12);

                // Powerup Button (Right)
                const pwrX = this.width - margin - btnSize;
                const hasPwr = this.powerupGauge > 0;
                this.ctx.save();
                if (hasPwr) {
                    this.ctx.shadowBlur = 12;
                    this.ctx.shadowColor = 'rgba(50, 200, 255, 0.8)';
                }
                this.ctx.fillStyle = hasPwr ? 'rgba(30, 150, 255, 0.6)' : 'rgba(80, 80, 80, 0.4)';
                this.ctx.strokeStyle = hasPwr ? '#66DDFF' : '#666666';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.roundRect(pwrX, btnY, btnSize, btnSize, 14);
                this.ctx.fill();
                this.ctx.stroke();
                this.ctx.restore();
                // PWR icon & label
                this.ctx.fillStyle = hasPwr ? '#FFFFFF' : '#999999';
                this.ctx.font = 'bold 28px "Courier New"';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('\u26A1', pwrX + btnSize / 2, btnY + btnSize / 2 - 8);
                this.ctx.font = 'bold 12px "Courier New"';
                const pwrLabel = hasPwr ? POWERUP_SLOTS[this.powerupGauge - 1].name : 'PWR UP';
                this.ctx.fillText(pwrLabel, pwrX + btnSize / 2, btnY + btnSize - 12);
            }

            // ---- Draw Gradius Powerup Gauge ----
            const gaugeBottomMargin = this.isMobile ? 20 : 0;
            const gaugeSlotHeight = this.isMobile ? 38 : 28; // Taller slots
            const maxSlotWidth = 100;
            let slotWidth = (this.width - 20) / POWERUP_SLOTS.length;
            if (slotWidth > maxSlotWidth) slotWidth = maxSlotWidth;

            const totalGaugeWidth = slotWidth * POWERUP_SLOTS.length;
            const startX = (this.width - totalGaugeWidth) / 2;

            const gaugeFontSize = this.isMobile
                ? (slotWidth < 50 ? 13 : 16)
                : (slotWidth < 50 ? 12 : 14); // Bigger font
            this.ctx.font = `bold ${gaugeFontSize}px "Courier New"`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';

            for (let i = 0; i < POWERUP_SLOTS.length; i++) {
                const slot = POWERUP_SLOTS[i];
                const x = startX + i * slotWidth;
                const y = this.height - gaugeSlotHeight / 2 - gaugeBottomMargin;
                const isSelected = (this.powerupGauge - 1 === i);

                // Check if this weapon is at max level
                const p = this.player;
                let isMaxed = false;
                if (slot.name === 'LASER' && p.weapon.type === 2 && p.weapon.level >= 3) isMaxed = true;
                if (slot.name === 'WIDE' && p.weapon.type === 3 && p.weapon.level >= 3) isMaxed = true;
                if (slot.name === 'HOMING' && p.weapon.hasHoming && p.weapon.homingLevel >= 3) isMaxed = true;
                if (slot.name === 'BIT' && p.weapon.hasBits && p.weapon.bitLevel >= 5) isMaxed = true;

                // Background
                let bgColor: string;
                if (isMaxed) {
                    bgColor = 'rgba(15, 15, 15, 0.95)'; // Very dark = maxed/inactive
                } else if (this.isMobile) {
                    bgColor = isSelected ? '#FF4400' : 'rgba(10, 20, 50, 0.85)';
                } else {
                    bgColor = isSelected ? '#FF4400' : '#112244';
                }
                this.ctx.fillStyle = bgColor;
                this.ctx.fillRect(x + 1, y - gaugeSlotHeight / 2, slotWidth - 2, gaugeSlotHeight);

                // Border
                this.ctx.strokeStyle = isMaxed ? '#444444' : (isSelected ? '#FFFF00' : '#336699');
                this.ctx.lineWidth = this.isMobile ? 2 : 1;
                this.ctx.strokeRect(x + 1, y - gaugeSlotHeight / 2, slotWidth - 2, gaugeSlotHeight);

                let displayName = slot.name;
                if (slotWidth < 45 && displayName.length > 4) {
                    displayName = displayName.slice(0, 3) + '.';
                }

                if (isMaxed) {
                    // Draw maxed label as dim gray with "MAX" indicator
                    this.ctx.fillStyle = '#555555';
                    this.ctx.fillText(displayName, x + slotWidth / 2, y - 5);
                    this.ctx.font = `bold 9px "Courier New"`;
                    this.ctx.fillStyle = '#996600';
                    this.ctx.fillText('MAX', x + slotWidth / 2, y + 8);
                    this.ctx.font = `bold ${gaugeFontSize}px "Courier New"`;
                } else {
                    this.ctx.fillStyle = isSelected ? '#FFFFFF' : '#88AADD';
                    this.ctx.fillText(displayName, x + slotWidth / 2, y);
                }
            }
            this.ctx.textBaseline = 'alphabetic'; // reset
        }

        if (this.gameState === GameState.Title) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);

            this.ctx.fillStyle = '#00AAFF';
            this.ctx.font = 'bold 50px "Courier New"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('STAR SHOOTER', this.width / 2, this.height / 3);

            this.ctx.fillStyle = '#00FF00';
            this.ctx.font = '20px "Courier New"';
            this.ctx.fillText('PRESS ENTER OR SHOOT(Y) TO START', this.width / 2, this.height / 2 + 50);

            this.ctx.fillStyle = '#AAAAAA';
            this.ctx.font = '16px "Courier New"';
            this.ctx.fillText('PRESS C FOR CONFIG', this.width / 2, this.height / 2 + 90);

            if (this.gamepadConnected) {
                this.ctx.fillStyle = '#00FFFF';
                this.ctx.font = 'bold 16px "Courier New"';
                this.ctx.fillText('🎮 GAMEPAD CONNECTED', this.width / 2, this.height / 2 + 130);
            }

        } else if (this.gameState === GameState.Config) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
            this.ctx.fillRect(0, 0, this.width, this.height);

            this.ctx.fillStyle = '#00AAFF';
            this.ctx.font = 'bold 40px "Courier New"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('CONFIGURATION', this.width / 2, this.height / 4);

            this.ctx.font = '24px "Courier New"';
            const drawOption = (index: number, label: string, yPos: number, valueStr?: string) => {
                this.ctx.fillStyle = this.configSelection === index ? '#FFFF00' : '#FFFFFF';
                this.ctx.textAlign = 'left';
                this.ctx.fillText(this.configSelection === index ? '> ' + label : '  ' + label, this.width / 2 - 150, yPos);
                if (valueStr !== undefined) {
                    this.ctx.textAlign = 'right';
                    this.ctx.fillText(valueStr, this.width / 2 + 150, yPos);
                }
            };

            const bgmVolStr = Math.round(audio.bgmVolume * 100).toString();
            const sfxVolStr = Math.round(audio.sfxVolume * 100).toString();

            drawOption(0, "BGM VOLUME", this.height / 2 - 20, `< ${bgmVolStr.padStart(3, ' ')} >`);
            drawOption(1, "SFX VOLUME", this.height / 2 + 30, `< ${sfxVolStr.padStart(3, ' ')} >`);
            drawOption(2, "RETURN TO TITLE", this.height / 2 + 80);

        } else if (this.gameState === GameState.GameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);

            this.ctx.fillStyle = '#FF0000';
            this.ctx.font = 'bold 50px "Courier New"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.width / 2, this.height / 3);

            if (this.continues > 0) {
                this.ctx.fillStyle = '#FFFF00';
                this.ctx.font = '24px "Courier New"';
                this.ctx.fillText(`CONTINUE? (${this.continues} LEFT)`, this.width / 2, this.height / 2);
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = '20px "Courier New"';
                this.ctx.fillText('PRESS ENTER TO CONTINUE', this.width / 2, this.height / 2 + 40);
            } else {
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = '24px "Courier New"';
                this.ctx.fillText('NO CONTINUES LEFT', this.width / 2, this.height / 2);
                this.ctx.font = '20px "Courier New"';
                this.ctx.fillText('PRESS ENTER TO RETURN TO TITLE', this.width / 2, this.height / 2 + 40);
            }
        } else if (this.gameState === GameState.StageClear) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.fillRect(0, 0, this.width, this.height);

            this.ctx.fillStyle = '#00FF00';
            this.ctx.font = 'bold 50px "Courier New"';
            this.ctx.textAlign = 'center';
            if (this.stage >= 5) {
                this.ctx.fillText(`ALL STAGES CLEAR!`, this.width / 2, this.height / 3);
            } else {
                this.ctx.fillText(`STAGE ${this.stage} CLEAR!`, this.width / 2, this.height / 3);
            }

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '20px "Courier New"';
            if (this.stage >= 5) {
                this.ctx.fillText('PRESS ENTER FOR ENDING', this.width / 2, this.height / 2 + 50);
            } else {
                this.ctx.fillText('PRESS ENTER FOR NEXT SEQUENCE', this.width / 2, this.height / 2 + 50);
            }
        } else if (this.gameState === GameState.Paused) {
            // Semi-transparent dark overlay
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            this.ctx.fillRect(0, 0, this.width, this.height);

            this.ctx.fillStyle = '#00AAFF';
            this.ctx.font = 'bold 50px "Courier New"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.width / 2, this.height / 2 - 30);

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '20px "Courier New"';
            this.ctx.fillText('PRESS START / ENTER TO RESUME', this.width / 2, this.height / 2 + 20);
        } else if (this.gameState === GameState.Scenario) {
            this.drawScenario();
        }
    }

    drawScenario() {
        // Dark background overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        const lines = this.stage > 5 ? this.endingTexts : this.scenarioTexts[this.stage ? this.stage - 1 : 0];
        if (!lines) return;

        // Optional picture bg rendering behind the dark overlay
        const sceneImg = this.stage > 5 ? this.scenarioImages[5] : this.scenarioImages[this.stage ? this.stage - 1 : 0];
        if (sceneImg && sceneImg.naturalWidth > 0 && this.scenarioTimer < lines.length * 1.5 + 1.0) {
            this.ctx.globalAlpha = 0.5; // Let the underlying art show lightly
            this.ctx.drawImage(sceneImg, 0, 0, this.width, this.height);
            this.ctx.globalAlpha = 1.0;
        }

        this.ctx.font = 'bold 20px "Courier New"';
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = 'white';

        const lineSpacing = 35;
        const startY = this.height / 2 - (lines.length * lineSpacing) / 2;

        for (let i = 0; i < lines.length; i++) {
            // Reveal text based on timer (1 line per 1.5 seconds)
            const revealTime = i * 1.5;
            if (this.scenarioTimer > revealTime) {
                const timeInLine = this.scenarioTimer - revealTime;
                const charsToShow = Math.floor(timeInLine * 25); // ~25 chars per sec
                const text = lines[i].substring(0, charsToShow);
                this.ctx.fillText(text, this.width / 2, startY + i * lineSpacing);
            }
        }

        // Blinking skip prompt when all text is finished rendering
        if (this.scenarioTimer > lines.length * 1.5 + 1.0) {
            if (Math.floor(this.scenarioTimer * 2) % 2 === 0) {
                this.ctx.fillStyle = '#AAAAAA';
                this.ctx.fillText('PRESS ENTER TO CONTINUE', this.width / 2, this.height - 50);
            }
        }
    }
}
