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
                    if (Math.random() < 0.05) this.fireAtPlayer();
                } else {
                    this.speedY = 150;
                }
                break;
            case EnemyMotionType.Sniper:
                if (this.timer > 1.0 && this.timer < 1.1) {
                    this.fireAtPlayer(500);
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
                    for (let i = 0; i < 8; i++) {
                        const angle = (Math.PI / 4) * i;
                        const bx = Math.cos(angle) * 200;
                        const by = Math.sin(angle) * 200;
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
                    if (Math.random() < 0.02) this.fireAtPlayer();
                }
                break;
            case EnemyMotionType.Kamikaze:
                this.speedY += 200 * dt;
                break;
            case EnemyMotionType.Sweeper:
                this.x = this.originX + Math.sin(this.timer) * this.engine.width / 2;
                break;
            case EnemyMotionType.Burster:
                if (this.timer % 2.0 < 0.1) {
                    this.fireAtPlayer(400);
                }
                break;
            case EnemyMotionType.Drifter:
                this.x += (Math.random() - 0.5) * 100 * dt;
                this.y += (Math.random() - 0.5) * 20 * dt;
                break;
            case EnemyMotionType.Tank:
                this.speedY = 30;
                if (Math.random() < 0.03) this.fireAtPlayer(100);
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
    lastFireTimer: number = -1;
    isMidBoss: boolean = false;

    constructor(engine: GameEngine, x: number, y: number, bossType: number) {
        super(engine, x, y);
        this.bossType = bossType;
        this.width = 192;
        this.height = 192;
        this.scoreValue = bossType * 5000;

        const baseHp = bossType * 100;
        this.phases = [
            { hp: baseHp, update: this.genericPhase1 },
            { hp: baseHp * 1.5, update: this.genericPhase2 },
            { hp: baseHp * 2.5, update: this.genericPhase3 }
        ];

        this.hp = this.phases[0].hp;
        this.speedY = 50;
    }

    update(dt: number) {
        this.x += this.speedX * dt;
        this.y += this.speedY * dt;
        this.timer += dt;

        if (this.dyingTimer > 0) {
            this.dyingTimer -= dt;
            // Spawn explosions over its body during death sequence
            if (Math.random() < 0.4) {
                this.engine.addParticle(new Particle(this.engine, this.x + Math.random() * this.width, this.y + Math.random() * this.height));
                if (this.engine.audioInitialized) {
                    if (Math.random() > 0.5) audio.playExplosion();
                    else audio.playEnemyDefeat();
                }
            }
            if (this.dyingTimer <= 0) {
                this.active = false;
                this.engine.bossActive = false;
                this.engine.addScore(this.scoreValue);
                this.engine.enemyBullets = []; // clear danger
                if (this.isMidBoss) {
                    if (this.engine.audioInitialized) {
                        audio.playExplosion();
                        audio.playBGM(this.engine.stage); // Resume stage BGM
                    }
                } else {
                    this.engine.gameState = GameState.StageClear;
                    if (this.engine.audioInitialized) audio.playVictoryJingle();
                }
            }
            return; // Skip normal AI update
        }

        if (this.y > 50 && this.speedY > 0) {
            this.speedY = 0;
        }

        if (this.phases[this.currentPhase]) {
            this.phases[this.currentPhase].update(this, dt);
        }
    }

    hit(damage: number) {
        if (this.dyingTimer > 0) return; // invincible while dying
        this.hp -= damage;
        if (this.hp <= 0) {
            this.currentPhase++;
            if (this.currentPhase >= this.phases.length) {
                this.dyingTimer = 3.0; // Start 3 second death sequence
                if (this.engine.audioInitialized) audio.playExplosion();
            } else {
                this.hp = this.phases[this.currentPhase].hp;
                this.timer = 0; // reset phase timer
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.engine.bossImage.complete && this.engine.bossImage.naturalWidth > 0) {
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

            // Apply a color shift for the Mid-Boss to distinguish it from the Stage Boss
            if (this.isMidBoss) {
                ctx.filter = 'hue-rotate(120deg) brightness(1.2)';
            }

            ctx.drawImage(this.engine.bossImage, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        } else {
            ctx.fillStyle = this.isMidBoss ? '#00FFFF' : '#FF0000';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    genericPhase1(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * (1 + boss.bossType * 0.2)) * 150;
        if (boss.timer % (Math.max(0.2, 1.0 / boss.bossType)) < 0.1) {
            boss.fireAtPlayer(200 + boss.bossType * 50);
        }
    }

    genericPhase2(boss: Boss, dt: number) {
        boss.x += (Math.random() - 0.5) * 300 * dt;
        boss.x = Math.max(0, Math.min(boss.engine.width - boss.width, boss.x));
        boss.y = 50 + Math.sin(boss.timer * 3) * 50;
        if (boss.timer % (Math.max(0.3, 1.5 / boss.bossType)) < 0.1) {
            for (let i = 0; i < 3 + boss.bossType; i++) {
                const angle = Math.PI / 2 + (i - (1 + boss.bossType / 2)) * 0.2;
                boss.fireAngle(angle, 250);
            }
        }
    }

    genericPhase3(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.cos(boss.timer * 2) * 100;
        boss.y = 50 + Math.abs(Math.sin(boss.timer * 4) * 80);

        if (boss.timer % (Math.max(0.1, 0.5 / boss.bossType)) < 0.1) {
            for (let i = 0; i < 8 + boss.bossType * 2; i++) {
                boss.fireAngle(boss.timer + i * (Math.PI * 2) / (8 + boss.bossType * 2), 200 + boss.bossType * 20);
            }
        }
        if (Math.random() < 0.05 + boss.bossType * 0.01) boss.fireAtPlayer(350);
    }

    fireAngle(angle: number, speed: number) {
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const bullet = new EnemyBullet(this.engine, this.x + this.width / 2 - 8, this.y + this.height / 2 - 8, vx, vy);
        bullet.color = '#FF55FF';
        this.engine.addEnemyBullet(bullet);
    }

    fireAtPlayer(speed: number) {
        const dx = (this.engine.player.x + this.engine.player.width / 2) - (this.x + this.width / 2);
        const dy = (this.engine.player.y + this.engine.player.height / 2) - (this.y + this.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;

        const bullet = new EnemyBullet(this.engine, this.x + this.width / 2 - 8, this.y + this.height - 8, vx, vy);
        bullet.color = '#FFAA55';
        this.engine.addEnemyBullet(bullet);
    }
}
