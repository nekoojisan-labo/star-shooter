import { GameEngine, GameState } from './GameEngine';
import { Enemy, Bullet, Particle, EnemyBullet } from './Entities';
import { audio } from '../audio/AudioEngine';

export const EnemyMotionType = {
    Straight: 0,
    SineWave: 1,
    Homing: 2,
    Dive: 3,
    UTurn: 4,
    StopAndShoot: 5,
    Sniper: 6,
    VFormation: 7,
    Splitter: 8,
    Shielded: 9,
    Warper: 10,
    Bomber: 11,
    Orbit: 12,
    ZigZag: 13,
    Hover: 14,
    Kamikaze: 15,
    Sweeper: 16,
    Burster: 17,
    Drifter: 18,
    Tank: 19
} as const;
export type TEnemyMotionType = typeof EnemyMotionType[keyof typeof EnemyMotionType];

// Boss phases interface
export interface BossPhase {
    hp: number;
    update: (boss: Boss, dt: number) => void;
}

export class PatternEnemy extends Enemy {
    motionType: TEnemyMotionType;
    timer: number = 0;
    lastFireTimer: number = -1;
    originX: number;
    originY: number;

    constructor(engine: GameEngine, x: number, y: number, type: TEnemyMotionType) {
        super(engine, x, y);
        this.originX = x;
        this.originY = y;
        this.motionType = type;
        this.spriteIndex = type; // Pull from 0-19 sprite grid

        // Customize stats based on type
        switch (type) {
            case EnemyMotionType.Tank: this.hp = 15; this.speedY = 40; break;
            case EnemyMotionType.Kamikaze: this.hp = 1; this.speedY = 400; break;
            case EnemyMotionType.Warper: this.hp = 3; this.speedY = 0; break;
            default: this.hp = 2; this.speedY = 150; break;
        }
    }

    update(dt: number) {
        super.update(dt);
        this.timer += dt;

        switch (this.motionType) {
            case EnemyMotionType.Straight:
                break;
            case EnemyMotionType.SineWave:
                this.x = this.originX + Math.sin(this.timer * 3) * 100;
                break;
            case EnemyMotionType.Homing:
                const dx = this.engine.player.x - this.x;
                if (dx > 0) this.x += 50 * dt;
                else this.x -= 50 * dt;
                break;
            case EnemyMotionType.Dive:
                if (this.timer > 1.0) {
                    this.y += 300 * dt;
                } else {
                    this.y += 50 * dt;
                }
                break;
            case EnemyMotionType.UTurn:
                if (this.y > this.engine.height / 2 && this.speedY > 0) {
                    this.speedY = -150;
                }
                break;
            case EnemyMotionType.StopAndShoot:
                if (this.timer < 1.0) {
                    // move down
                } else if (this.timer < 2.0) {
                    this.speedY = 0;
                    if (Math.random() < 0.12) this.fireAtPlayer(); // Stage 2+: more aggressive
                } else {
                    this.speedY = 150;
                }
                break;
            case EnemyMotionType.Sniper:
                if (this.timer > 1.0 && this.timer < 1.1) {
                    // Double burst with slight angle spread
                    this.fireAtPlayer(520);
                    this.fireAtPlayer(480);
                    this.timer = 2.0;
                }
                break;
            case EnemyMotionType.VFormation:
                this.x += (this.originX < this.engine.width / 2 ? -50 : 50) * dt;
                break;
            case EnemyMotionType.Splitter:
                if (this.timer > 2.0 && this.timer < 2.1) {
                    this.timer = 3.0;
                    this.fireAtPlayer(150);
                }
                break;
            case EnemyMotionType.Shielded:
                this.speedY = 50;
                break;
            case EnemyMotionType.Warper:
                if (this.timer > 2.0) {
                    this.x = Math.random() * (this.engine.width - 40);
                    this.y = Math.random() * (this.engine.height / 2);
                    this.timer = 0;
                    this.fireAtPlayer();
                }
                break;
            case EnemyMotionType.Bomber:
                if (this.timer > 1.5 && this.timer < 1.6) {
                    this.timer = 2.0;
                    for (let i = 0; i < 12; i++) {
                        const angle = (Math.PI * 2 / 12) * i;
                        const bx = Math.cos(angle) * 260;
                        const by = Math.sin(angle) * 260;
                        const bullet = new Bullet(this.engine, this.x + this.width / 2 - 4, this.y + this.height / 2, bx, by);
                        bullet.color = '#FF5500';
                        this.engine.addEnemyBullet(bullet);
                    }
                }
                break;
            case EnemyMotionType.Orbit:
                this.x = this.originX + Math.cos(this.timer * 2) * 50;
                this.y = this.originY + this.timer * 100 + Math.sin(this.timer * 2) * 50;
                break;
            case EnemyMotionType.ZigZag:
                if (this.timer % 1.0 < 0.5) this.x += 100 * dt;
                else this.x -= 100 * dt;
                break;
            case EnemyMotionType.Hover:
                if (this.y > 100) {
                    this.speedY = 0;
                    this.x += Math.sin(this.timer) * 50 * dt;
                    if (Math.random() < 0.05) {
                        this.fireAtPlayer();
                        // Occasionally fire 3-way
                        if (Math.random() < 0.3) {
                            const dx = (this.engine.player.x + this.engine.player.width / 2) - (this.x + this.width / 2);
                            const dy = (this.engine.player.y + this.engine.player.height / 2) - (this.y + this.height / 2);
                            const baseAngle = Math.atan2(dy, dx);
                            const spd = 300;
                            for (const offset of [-0.25, 0.25]) {
                                const b = new EnemyBullet(this.engine, this.x + this.width / 2 - 8, this.y + this.height, Math.cos(baseAngle + offset) * spd, Math.sin(baseAngle + offset) * spd);
                                b.color = '#FFAA55';
                                this.engine.addEnemyBullet(b);
                            }
                        }
                    }
                }
                break;
            case EnemyMotionType.Kamikaze:
                this.speedY += 200 * dt;
                break;
            case EnemyMotionType.Sweeper:
                this.x = this.originX + Math.sin(this.timer) * this.engine.width / 2;
                break;
            case EnemyMotionType.Burster:
                if (this.timer % 1.0 < 0.1) {
                    this.fireAtPlayer(360);
                }
                break;
            case EnemyMotionType.Drifter:
                this.x += (Math.random() - 0.5) * 100 * dt;
                this.y += (Math.random() - 0.5) * 20 * dt;
                break;
            case EnemyMotionType.Tank:
                this.speedY = 30;
                if (Math.random() < 0.06) this.fireAtPlayer(120);
                break;
            default:
                break;
        }

        if (this.y < -100 || this.y > this.engine.height + 100 || this.x < -100 || this.x > this.engine.width + 100) {
            this.active = false;
        }
    }

    fireAtPlayer(speed: number = 300, cooldown: number = 1.0) {
        if (this.timer - this.lastFireTimer < cooldown) return;
        this.lastFireTimer = this.timer;

        const dx = (this.engine.player.x + this.engine.player.width / 2) - (this.x + this.width / 2);
        const dy = (this.engine.player.y + this.engine.player.height / 2) - (this.y + this.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;

        const bullet = new EnemyBullet(this.engine, this.x + this.width / 2 - 8, this.y + this.height, vx, vy);
        bullet.color = '#FFAA55';
        this.engine.addEnemyBullet(bullet);
    }
}

export class Boss extends Enemy {
    bossType: number;
    phases: BossPhase[];
    currentPhase: number = 0;
    dyingTimer: number = 0;
    timer: number = 0;
    lastFireTimer: number = -1;  // fire cooldown channel 0
    lastFireTimer2: number = -1; // fire cooldown channel 1
    patternStep: number = -1;    // one-shot step tracker (e.g. warp cycles)
    isMidBoss: boolean = false;
    maxHp: number = 1; // set in initPhases — used for HP-based phase transitions
    introComplete: boolean = false; // once true, no re-entry guard
    startX: number = 0;
    startY: number = 0;
    phaseTimer: number = 0;
    phaseDuration: number = 25;
    bossHitSoundTimer: number = 0; // prevent sound from firing every single frame

    constructor(engine: GameEngine, x: number, y: number, bossType: number) {
        super(engine, x, y);
        this.bossType = bossType;
        this.width = 192;
        this.height = 192;
        this.scoreValue = bossType * 5000;
        this.startX = x;
        this.startY = 50; // default target Y

        // Phases, HP and size are assigned in initPhases(). For a mid-boss the
        // engine sets isMidBoss = true after construction and calls initPhases()
        // again to switch to mid-boss patterns / HP / size.
        this.phases = [];
        this.initPhases();

        this.phaseDuration = 20 + Math.random() * 10;
        this.speedY = 100; // Entry speed
    }

    // Call this AFTER setting isMidBoss to assign correct phases, HP and size.
    // Note: BossPhase.hp is unused — phase transitions are time-based.
    initPhases() {
        const bossType = this.bossType;

        if (this.isMidBoss) {
            // ---- MID-BOSS: patterns & HP keyed to the CURRENT stage so every
            // stage's mid-boss is unique (bossType only selects the sprite) ----
            const stage = Math.min(5, Math.max(1, this.engine.stage));

            // Mid-boss HP: 900 / 1200 / 1500 / 1800 / 2100
            this.hp = 600 + stage * 300;
            this.maxHp = this.hp;

            // Visibly smaller than the stage boss
            this.width = 140;
            this.height = 140;

            switch (stage) {
                case 1:
                    this.phases = [
                        { hp: 0, update: this.midBoss1Phase1 },
                        { hp: 0, update: this.midBoss1Phase2 }
                    ];
                    break;
                case 2:
                    this.phases = [
                        { hp: 0, update: this.midBoss2Phase1 },
                        { hp: 0, update: this.midBoss2Phase2 }
                    ];
                    break;
                case 3:
                    this.phases = [
                        { hp: 0, update: this.midBoss3Phase1 },
                        { hp: 0, update: this.midBoss3Phase2 }
                    ];
                    break;
                case 4:
                    this.phases = [
                        { hp: 0, update: this.midBoss4Phase1 },
                        { hp: 0, update: this.midBoss4Phase2 }
                    ];
                    break;
                default:
                    this.phases = [
                        { hp: 0, update: this.midBoss5Phase1 },
                        { hp: 0, update: this.midBoss5Phase2 }
                    ];
                    break;
            }
        } else {
            // ---- STAGE BOSS ----
            // Boss HP: 1800 / 2400 / 3000 / 3600 / 4200
            this.hp = 1200 + bossType * 600;
            this.maxHp = this.hp;

            switch (bossType) {
                case 1:
                    this.phases = [
                        { hp: 0, update: this.boss1Phase1 },
                        { hp: 0, update: this.boss1Phase2 }
                    ];
                    break;
                case 2:
                    this.phases = [
                        { hp: 0, update: this.boss2Phase1 },
                        { hp: 0, update: this.boss2Phase2 }
                    ];
                    break;
                case 3:
                    this.phases = [
                        { hp: 0, update: this.boss3Phase1 },
                        { hp: 0, update: this.boss3Phase2 }
                    ];
                    break;
                case 4:
                    this.phases = [
                        { hp: 0, update: this.boss4Phase1 },
                        { hp: 0, update: this.boss4Phase2 }
                    ];
                    break;
                case 5:
                    this.phases = [
                        { hp: 0, update: this.boss5Phase1 },
                        { hp: 0, update: this.boss5Phase2 },
                        { hp: 0, update: this.boss5Phase3 }
                    ];
                    break;
                default:
                    this.phases = [
                        { hp: 0, update: this.boss1Phase1 }
                    ];
                    break;
            }
        }
    }

    update(dt: number) {
        if (!this.active) return;

        if (this.dyingTimer > 0) {
            this.dyingTimer -= dt;
            if (Math.random() < 0.3) {
                const px = this.x + Math.random() * this.width;
                const py = this.y + Math.random() * this.height;
                for (let i = 0; i < 5; i++) {
                    const p = new Particle(this.engine, px, py);
                    p.color = Math.random() > 0.5 ? '#FFAA00' : '#FF0000';
                    this.engine.addParticle(p);
                }
            }
            if (this.dyingTimer <= 0) {
                this.active = false;
                this.engine.bossActive = false;
                this.engine.addScore(this.scoreValue);
                if (!this.isMidBoss) {
                    // Sweep leftover popcorn and bullets so nothing lingers
                    // (or kills the player) on the results screen
                    this.engine.enemies = [];
                    this.engine.enemyBullets = [];
                    this.engine.gameState = GameState.StageClear;
                    if (this.engine.audioInitialized) audio.playPowerup();
                }
            }
            return;
        }

        // Intro movement — only runs until boss first reaches startY
        if (!this.introComplete) {
            if (this.y < this.startY) {
                this.y += this.speedY * dt;
                return;
            }
            this.introComplete = true; // lock: never re-trigger intro
        }

        this.timer += dt;
        this.phaseTimer += dt;
        this.bossHitSoundTimer -= dt;

        // Phase transition: by elapsed time OR by HP crossing equal-split
        // boundaries (2 phases → 50%, 3 phases → 66%/33%), whichever comes
        // first — so high-DPS players still see every phase.
        const hpFrac = Math.max(0, this.hp) / this.maxHp;
        const nextHpBoundary = 1 - (this.currentPhase + 1) / this.phases.length;
        if ((this.phaseTimer >= this.phaseDuration || hpFrac <= nextHpBoundary)
            && this.currentPhase < this.phases.length - 1) {
            this.currentPhase++;
            this.phaseTimer = 0;
            this.phaseDuration = 20 + Math.random() * 10;
            this.timer = 0; // reset pattern timer for the new phase
            this.lastFireTimer = -1;
            this.lastFireTimer2 = -1;
            this.patternStep = -1;

            // Visual feedback for phase shift
            for (let i = 0; i < 20; i++) {
                const p = new Particle(this.engine, this.x + this.width / 2, this.y + this.height / 2);
                p.color = '#FFFFFF';
                this.engine.addParticle(p);
            }
            if (this.engine.audioInitialized) audio.playExplosion();
        }

        // Execute current phase
        if (this.currentPhase < this.phases.length) {
            this.phases[this.currentPhase].update.call(this, this, dt);
        }
    }

    hit(damage: number) {
        if (this.y < 0 || this.dyingTimer > 0) return; // Invincible during intro or dying
        this.hp -= damage;
        // Score scales with damage dealt (total chip score is bounded by boss HP)
        // — a flat +10 per call let per-frame contact/laser hits farm extends.
        this.engine.addScore(Math.max(1, Math.round(damage * 5)));

        // Play a distinct metallic boss hit sound (throttled to avoid noise spam)
        if (this.bossHitSoundTimer <= 0 && this.engine.audioInitialized) {
            audio.playBossHit();
            this.bossHitSoundTimer = 0.06; // throttle: max ~16 hits/sec
        }

        if (this.hp <= 0 && this.dyingTimer <= 0) {
            this.dyingTimer = 2.0;
            if (this.engine.audioInitialized) audio.playExplosion();

            // Final death explosions
            for (let i = 0; i < 30; i++) {
                setTimeout(() => {
                    const p = new Particle(this.engine, this.x + Math.random() * this.width, this.y + Math.random() * this.height);
                    p.color = '#FFAA00';
                    this.engine.addParticle(p);
                }, Math.random() * 2000);
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Fallback to bossImages[0] if the specific one is not available
        const img = this.engine.bossImages[this.bossType - 1] || this.engine.bossImages[0];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

            // Stage 4 boss image is oriented left — rotate -90° to face down
            if (this.bossType === 4 && !this.isMidBoss) {
                ctx.rotate(-Math.PI / 2);
            }

            if (this.dyingTimer > 0 && Math.floor(this.dyingTimer * 10) % 2 === 0) {
                ctx.filter = 'brightness(2.0) sepia(1) hue-rotate(-50deg) saturate(5)';
            } else if (this.isMidBoss) {
                // NOTE: scale() is not a valid CSS filter — it silently disabled
                // the whole filter and made mid-bosses look identical to bosses.
                // Size difference is handled via width/height in initPhases().
                ctx.filter = 'hue-rotate(120deg) brightness(1.2)';
            }

            ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        } else {
            ctx.fillStyle = this.isMidBoss ? '#00FFFF' : '#FF0000';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    // --- Helper Methods ---

    /**
     * Frame-rate independent fire gate. Returns true at most once per
     * `interval` seconds on the given cooldown channel (0 or 1).
     * Unlike the `timer % x < 0.1` idiom this fires exactly one volley.
     */
    fireGate(channel: 0 | 1, interval: number): boolean {
        const last = channel === 0 ? this.lastFireTimer : this.lastFireTimer2;
        if (this.timer - last < interval) return false;
        if (channel === 0) this.lastFireTimer = this.timer;
        else this.lastFireTimer2 = this.timer;
        return true;
    }

    fireAngle(angle: number, speed: number, color: string = '#FF0055') {
        // Mid-boss bullets travel 10% slower
        const actualSpeed = this.isMidBoss ? speed * 0.9 : speed;
        const vx = Math.cos(angle) * actualSpeed;
        const vy = Math.sin(angle) * actualSpeed;
        // Adjust start position so it looks like it comes from the center of the boss
        const b = new EnemyBullet(this.engine, this.x + this.width / 2 - 8, this.y + this.height / 2, vx, vy);
        b.color = color;
        this.engine.addEnemyBullet(b);
    }

    fireAtPlayer(speed: number) {
        const dx = (this.engine.player.x + this.engine.player.width / 2) - (this.x + this.width / 2);
        // From center of boss
        const dy = (this.engine.player.y + this.engine.player.height / 2) - (this.y + this.height / 2);
        const angle = Math.atan2(dy, dx);
        this.fireAngle(angle, speed, '#FFAA00');
    }

    // ============================================
    // === STAGE 1 BOSS: MULTI-TURRET CRUISER ===
    // ============================================
    boss1Phase1(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer) * 150;

        // Straight thick laser down the middle & 3-way
        if (boss.timer % 1.5 < 0.1) {
            boss.fireAngle(Math.PI / 2, 350, '#FF0055');
            boss.fireAngle(Math.PI / 2 + 0.15, 350, '#FF0055'); // wider gap
            boss.fireAngle(Math.PI / 2 - 0.15, 350, '#FF0055');
        }
        // Fan bullets from sides
        if (boss.timer % 1.5 < 0.1) {
            for (let i = -1; i <= 1; i++) {
                boss.fireAngle(Math.PI / 2 + i * 0.4, 200, '#FFAA00');
            }
        }
    }
    boss1Phase2(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 2) * 180;
        if (boss.timer % 0.4 < 0.1) {
            boss.fireAtPlayer(300);
        }
        if (boss.timer % 1.2 < 0.1) {
            for (let i = -2; i <= 2; i++) {
                boss.fireAngle(Math.PI / 2 + i * 0.3, 250, '#00FFFF');
            }
        }
    }

    // ============================================
    // === STAGE 2 BOSS: ASTEROID BASE ===
    // ============================================
    boss2Phase1(boss: Boss, dt: number) {
        // Horizontal sway only (NOT overwriting Y - that conflicts with entry guard)
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 0.5) * 120;
        boss.y += Math.sin(boss.timer * 2) * 40 * dt; // Y only nudged, not set directly
        boss.y = Math.max(20, Math.min(150, boss.y)); // clamp to top area

        // Spread of random slow bullets with clear fire-pause gap
        if ((boss.timer % 3.0 < 2.0) && boss.timer % 0.7 < 0.1) {
            for (let i = 0; i < 5; i++) {
                boss.fireAngle(Math.PI / 2 + (Math.random() - 0.5) * 1.6, 140 + Math.random() * 60, '#FFAA55');
            }
        }

        // Aimed shot every 2.5 seconds
        if (boss.timer % 2.5 < 0.1) {
            boss.fireAtPlayer(280);
        }
    }
    boss2Phase2(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 2) * 200;

        // Controlled machine gun - shoots in bursts with gaps
        if ((boss.timer % 2.0 < 1.0) && boss.timer % 0.25 < 0.1) {
            boss.fireAtPlayer(380);
        }
        // Fan spray between bursts
        if (boss.timer % 2.0 > 1.5 && boss.timer % 0.5 < 0.1) {
            for (let i = -2; i <= 2; i++) {
                boss.fireAngle(Math.PI / 2 + i * 0.25, 200, '#FFAA55');
            }
        }
    }

    // ============================================
    // === STAGE 3 BOSS: GROUND FORTRESS CORE ===
    // ============================================
    boss3Phase1(boss: Boss, _dt: number) {
        // Moves very little, heavily armored feel
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.cos(boss.timer * 0.5) * 50;

        // Crossing streams
        const wave1 = Math.PI / 2 + Math.sin(boss.timer * 5) * 0.8;
        const wave2 = Math.PI / 2 - Math.sin(boss.timer * 5) * 0.8;
        if (boss.timer % 0.1 < 0.05) {
            boss.fireAngle(wave1, 250, '#FF0055');
            boss.fireAngle(wave2, 250, '#00FFFF');
        }
    }
    boss3Phase2(boss: Boss, _dt: number) {
        boss.y = 50 + Math.sin(boss.timer * 0.5) * 30;
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 1.5) * 150;

        if (boss.timer % 0.8 < 0.1) {
            // Burst of aimed fast missiles
            for (let i = 0; i < 5; i++) {
                boss.fireAtPlayer(350 + i * 50);
            }
        }
    }

    // ============================================
    // === STAGE 4 BOSS: HIGH-SPEED CARRIER ===
    // ============================================
    boss4Phase1(boss: Boss, _dt: number) {
        // Very fast horizontal sweeping
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 3.5) * 220;
        boss.y = 30 + Math.cos(boss.timer * 4) * 20;

        // Dense rapid fire downwards (rain attack) with gaps
        if ((boss.timer % 2.5 < 1.5) && boss.timer % 0.1 < 0.05) {
            boss.fireAngle(Math.PI / 2 + (Math.random() - 0.5) * 0.3, 400, '#00FFAA');
        }
    }
    boss4Phase2(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 2) * 100;

        // Spiral bullets (4-way rotating)
        if (boss.timer % 0.08 < 0.05) {
            const angle = boss.timer * 5;
            boss.fireAngle(angle, 250, '#FF00FF');
            boss.fireAngle(angle + Math.PI, 250, '#FF00FF');
            boss.fireAngle(angle + Math.PI / 2, 250, '#FF00FF');
            boss.fireAngle(angle - Math.PI / 2, 250, '#FF00FF');
        }

        // Periodically fire directly at player to force movement
        if (boss.timer % 1.5 < 0.1) {
            boss.fireAtPlayer(300);
        }
    }

    // ============================================
    // === STAGE 5 BOSS: MASTER CORE ===
    // ============================================
    boss5Phase1(boss: Boss, _dt: number) {
        // Erratic movement
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 3) * 180;
        boss.y = 50 + Math.cos(boss.timer * 2.2) * 100;

        // Starburst (12-way)
        if (boss.timer % 1.0 < 0.1) {
            for (let i = 0; i < 12; i++) {
                boss.fireAngle((Math.PI * 2 / 12) * i + boss.timer, 220, '#FFFF00');
            }
        }
        if (boss.timer % 0.4 < 0.1) boss.fireAtPlayer(320);
    }
    boss5Phase2(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 6) * 60;
        boss.y = 50; // Locked in top middle

        // Thick lasers + aimed
        if (boss.timer % 0.2 < 0.1) {
            boss.fireAngle(Math.PI / 2 - 0.3, 500, '#FFAA00');
            boss.fireAngle(Math.PI / 2 + 0.3, 500, '#FFAA00');
            boss.fireAngle(Math.PI / 2 - 0.6, 500, '#FFAA00');
            boss.fireAngle(Math.PI / 2 + 0.6, 500, '#FFAA00');
        }
        if (boss.timer % 0.6 < 0.1) {
            for (let i = 0; i < 3; i++) boss.fireAtPlayer(400); // fast burst
        }
    }
    boss5Phase3(boss: Boss, _dt: number) {
        // Desperation move (Insane Spiral + Homing)
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 4) * 200;
        boss.y = 20 + Math.abs(Math.cos(boss.timer * 5) * 150);

        if ((boss.timer % 3.0 < 2.0) && boss.timer % 0.1 < 0.05) {
            boss.fireAngle(Math.PI / 2 + Math.sin(boss.timer * 8) * 1.5, 300, '#FF0000');
            boss.fireAngle(Math.PI / 2 + Math.sin(boss.timer * 8 + Math.PI) * 1.5, 300, '#FF0000');
        }
        if (boss.timer % 1.0 < 0.1) {
            boss.fireAtPlayer(450);
        }
    }

    // ==============================================================
    // === MID-BOSS PATTERNS — movement archetypes intentionally  ===
    // === different from stage bosses (which hover at the top    ===
    // === and sweep side to side). Selected by CURRENT stage.    ===
    // ==============================================================

    // Stage 1 Mid-Boss "LUNGER": tracks the player, telegraphs, then
    // dives down at them and slowly retreats while firing.
    midBoss1Phase1(boss: Boss, dt: number) {
        const topY = 60;
        const diveY = boss.engine.height * 0.45;
        const playerCX = boss.engine.player.x + boss.engine.player.width / 2;
        const cycle = boss.timer % 4.5;

        if (cycle < 1.4) {
            // Hover & slide over the player — telegraph
            boss.y += (topY - boss.y) * Math.min(1, 4 * dt);
            boss.x += (playerCX - boss.width / 2 - boss.x) * Math.min(1, 2.5 * dt);
        } else if (cycle < 2.2) {
            // Lunge straight down
            boss.y += (diveY - boss.y) * Math.min(1, 6 * dt);
        } else {
            // Slow retreat, firing single aimed shots
            boss.y += (topY - boss.y) * Math.min(1, 1.2 * dt);
            if (boss.fireGate(0, 1.4)) {
                boss.fireAtPlayer(210);
            }
        }
    }
    midBoss1Phase2(boss: Boss, dt: number) {
        const topY = 60;
        const diveY = boss.engine.height * 0.55;
        const playerCX = boss.engine.player.x + boss.engine.player.width / 2;
        const cycle = boss.timer % 3.2;

        if (cycle < 0.9) {
            boss.y += (topY - boss.y) * Math.min(1, 5 * dt);
            boss.x += (playerCX - boss.width / 2 - boss.x) * Math.min(1, 3.5 * dt);
        } else if (cycle < 1.6) {
            boss.y += (diveY - boss.y) * Math.min(1, 7 * dt);
        } else {
            boss.y += (topY - boss.y) * Math.min(1, 1.5 * dt);
            // 3-way volley during retreat
            if (boss.fireGate(0, 1.0)) {
                boss.fireAtPlayer(250);
                boss.fireAngle(Math.PI / 2 - 0.4, 210, '#FF6600');
                boss.fireAngle(Math.PI / 2 + 0.4, 210, '#FF6600');
            }
        }
    }

    // Stage 2 Mid-Boss "PATROLLER": slides edge-to-edge dropping a straight
    // bullet curtain behind it, pausing at each edge for an aimed shot.
    midBoss2Phase1(boss: Boss, _dt: number) {
        const range = boss.engine.width - boss.width - 40;
        const period = 6.0;
        const t = (boss.timer % period) / period;
        const tri = t < 0.5 ? t * 2 : (1 - t) * 2;       // 0..1..0 triangle
        const ease = tri * tri * (3 - 2 * tri);           // smoothstep = edge pause
        boss.x = 20 + range * ease;
        boss.y = 55 + Math.sin(boss.timer * 1.2) * 10;

        // Bullet curtain while in transit
        if (tri > 0.08 && tri < 0.92 && boss.fireGate(0, 0.4)) {
            boss.fireAngle(Math.PI / 2, 170, '#00FF88');
        }
        // Aimed shot while paused at the edges
        if ((tri <= 0.08 || tri >= 0.92) && boss.fireGate(1, 1.2)) {
            boss.fireAtPlayer(260);
        }
    }
    midBoss2Phase2(boss: Boss, _dt: number) {
        const range = boss.engine.width - boss.width - 40;
        const period = 4.2; // faster patrol
        const t = (boss.timer % period) / period;
        const tri = t < 0.5 ? t * 2 : (1 - t) * 2;
        const ease = tri * tri * (3 - 2 * tri);
        boss.x = 20 + range * ease;
        boss.y = 55 + Math.sin(boss.timer * 1.8) * 18;

        // Denser curtain: straight + slight diagonals
        if (tri > 0.08 && tri < 0.92 && boss.fireGate(0, 0.35)) {
            boss.fireAngle(Math.PI / 2, 200, '#00FF88');
            boss.fireAngle(Math.PI / 2 + 0.25, 180, '#00FF88');
            boss.fireAngle(Math.PI / 2 - 0.25, 180, '#00FF88');
        }
        if ((tri <= 0.08 || tri >= 0.92) && boss.fireGate(1, 1.0)) {
            boss.fireAtPlayer(310);
        }
    }

    // Stage 3 Mid-Boss "WARPER": teleports around the upper screen with a
    // particle telegraph, firing a ring burst on every arrival.
    midBoss3Phase1(boss: Boss, _dt: number) {
        const period = 3.0;
        const phase = boss.timer % period;
        const cycleIndex = Math.floor(boss.timer / period);

        if (phase < 2.2) {
            // Hold position, aimed double shot
            if (boss.fireGate(0, 1.2)) {
                boss.fireAtPlayer(280);
            }
        } else if (phase < 2.75) {
            // Telegraph: purple charge particles
            if (Math.random() < 0.5) {
                const p = new Particle(boss.engine, boss.x + Math.random() * boss.width, boss.y + Math.random() * boss.height);
                p.color = '#AA00FF';
                boss.engine.addParticle(p);
            }
        } else if (cycleIndex !== boss.patternStep) {
            // Warp once per cycle + arrival ring burst
            boss.patternStep = cycleIndex;
            boss.x = 20 + Math.random() * (boss.engine.width - boss.width - 40);
            boss.y = 30 + Math.random() * 130;
            for (let i = 0; i < 10; i++) {
                boss.fireAngle((Math.PI * 2 / 10) * i, 170, '#AA00FF');
            }
        }
    }
    midBoss3Phase2(boss: Boss, _dt: number) {
        const period = 2.2; // faster warps
        const phase = boss.timer % period;
        const cycleIndex = Math.floor(boss.timer / period);

        if (phase < 1.5) {
            if (boss.fireGate(0, 0.9)) {
                boss.fireAtPlayer(320);
                boss.fireAtPlayer(290);
            }
        } else if (phase < 1.95) {
            if (Math.random() < 0.5) {
                const p = new Particle(boss.engine, boss.x + Math.random() * boss.width, boss.y + Math.random() * boss.height);
                p.color = '#FF00AA';
                boss.engine.addParticle(p);
            }
        } else if (cycleIndex !== boss.patternStep) {
            boss.patternStep = cycleIndex;
            boss.x = 20 + Math.random() * (boss.engine.width - boss.width - 40);
            boss.y = 30 + Math.random() * 150;
            // Double ring on arrival
            for (let i = 0; i < 8; i++) {
                boss.fireAngle((Math.PI * 2 / 8) * i, 200, '#AA00FF');
                boss.fireAngle((Math.PI * 2 / 8) * i + 0.25, 150, '#FF00AA');
            }
        }
    }

    // Stage 4 Mid-Boss "SWOOPER": figure-8 swoops across the whole upper
    // half, leaving trailing diagonal shots.
    midBoss4Phase1(boss: Boss, _dt: number) {
        const cx = boss.engine.width / 2 - boss.width / 2;
        boss.x = cx + Math.sin(boss.timer * 1.6) * (boss.engine.width * 0.35);
        boss.y = 95 + Math.sin(boss.timer * 3.2) * 70;

        // Trailing diagonals while swooping
        if (boss.fireGate(0, 0.5)) {
            boss.fireAngle(Math.PI / 2 + 0.5, 240, '#FFFF00');
            boss.fireAngle(Math.PI / 2 - 0.5, 240, '#FFFF00');
        }
    }
    midBoss4Phase2(boss: Boss, _dt: number) {
        const cx = boss.engine.width / 2 - boss.width / 2;
        boss.x = cx + Math.sin(boss.timer * 2.2) * (boss.engine.width * 0.38);
        boss.y = 95 + Math.sin(boss.timer * 4.4) * 80;

        if (boss.fireGate(0, 0.4)) {
            boss.fireAngle(Math.PI / 2 + 0.5, 280, '#FFFF00');
            boss.fireAngle(Math.PI / 2 - 0.5, 280, '#FFFF00');
        }
        // Cross "X" burst + aimed shot on a slower channel
        if (boss.fireGate(1, 1.6)) {
            boss.fireAngle(Math.PI / 2 + 0.9, 230, '#FF8800');
            boss.fireAngle(Math.PI / 2 - 0.9, 230, '#FF8800');
            boss.fireAtPlayer(330);
        }
    }

    // Stage 5 Mid-Boss "ORBITER": circles the upper-center spraying
    // tangential double-spiral fire.
    midBoss5Phase1(boss: Boss, _dt: number) {
        const ccx = boss.engine.width / 2 - boss.width / 2;
        const r = Math.min(boss.engine.width * 0.3, 150);
        boss.x = ccx + Math.cos(boss.timer * 1.8) * r;
        boss.y = 110 + Math.sin(boss.timer * 1.8) * 75;

        // Tangential double-spiral
        if (boss.fireGate(0, 0.25)) {
            const ang = boss.timer * 1.8 + Math.PI / 2;
            boss.fireAngle(ang, 230, '#FF0088');
            boss.fireAngle(ang + Math.PI, 230, '#0088FF');
        }
        if (boss.fireGate(1, 1.6)) {
            boss.fireAtPlayer(330);
        }
    }
    midBoss5Phase2(boss: Boss, _dt: number) {
        const ccx = boss.engine.width / 2 - boss.width / 2;
        const r = Math.min(boss.engine.width * 0.24, 120);
        // Tighter, faster orbit
        boss.x = ccx + Math.cos(boss.timer * 2.8) * r;
        boss.y = 110 + Math.sin(boss.timer * 2.8) * 60;

        // Triple spiral
        if (boss.fireGate(0, 0.22)) {
            const ang = boss.timer * 2.8 + Math.PI / 2;
            boss.fireAngle(ang, 260, '#FF0088');
            boss.fireAngle(ang + Math.PI * 2 / 3, 260, '#FF0088');
            boss.fireAngle(ang + Math.PI * 4 / 3, 260, '#0088FF');
        }
        // Aimed double burst
        if (boss.fireGate(1, 1.1)) {
            boss.fireAtPlayer(380);
            boss.fireAtPlayer(350);
        }
    }
}
