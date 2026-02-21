import { GameEngine, GameState } from './GameEngine';
import { Enemy, Bullet, Particle } from './Entities';
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

        const bullet = new Bullet(this.engine, this.x + this.width / 2 - 4, this.y + this.height, vx, vy);
        bullet.color = '#FFAA55'; // Enemy bullet color
        // Add to enemy bullets (need to separate collision logic for enemy bullets!)
        // Actually, we must add an `isEnemy` flag to Bullet to hurt player.
        this.engine.addEnemyBullet(bullet);
    }
}

export class Boss extends Enemy {
    phases: BossPhase[] = [];
    currentPhase: number = 0;
    timer: number = 0;
    lastFireTimer: number = -1;
    bossType: number;

    constructor(engine: GameEngine, x: number, y: number, bossType: number) {
        super(engine, x, y);
        this.bossType = bossType;
        this.width = 192;
        this.height = 192;
        this.scoreValue = bossType * 5000;

        switch (bossType) {
            case 1:
                this.phases = [{ hp: 50, update: this.boss1Phase1 }, { hp: 50, update: this.boss1Phase2 }];
                break;
            case 2:
                this.phases = [{ hp: 100, update: this.boss2Phase1 }, { hp: 100, update: this.boss2Phase2 }];
                break;
            case 3:
                this.phases = [{ hp: 150, update: this.boss3Phase1 }, { hp: 150, update: this.boss3Phase2 }];
                break;
            case 4:
                this.phases = [{ hp: 200, update: this.boss4Phase1 }, { hp: 200, update: this.boss4Phase2 }];
                break;
            case 5:
                this.phases = [{ hp: 300, update: this.boss5Phase1 }, { hp: 300, update: this.boss5Phase2 }, { hp: 500, update: this.boss5Phase3 }];
                break;
            default:
                this.phases = [{ hp: 100, update: this.genericPhase }];
                break;
        }

        this.hp = this.phases[0].hp;
        this.speedY = 50;
    }

    update(dt: number) {
        this.x += this.speedX * dt;
        this.y += this.speedY * dt;
        this.timer += dt;

        if (this.y > 50 && this.speedY > 0) {
            this.speedY = 0;
        }

        if (this.phases[this.currentPhase]) {
            this.phases[this.currentPhase].update(this, dt);
        }
    }

    hit(damage: number) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.currentPhase++;
            if (this.currentPhase >= this.phases.length) {
                this.active = false;
                this.engine.bossActive = false;
                this.engine.addScore(this.scoreValue);
                this.engine.enemyBullets = []; // clear danger
                this.engine.gameState = GameState.StageClear;
                if (this.engine.audioInitialized) audio.playExplosion();
                for (let i = 0; i < 50; i++) {
                    this.engine.addParticle(new Particle(this.engine, this.x + this.width / 2, this.y + this.height / 2));
                }
            } else {
                this.hp = this.phases[this.currentPhase].hp;
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.engine.bossImage.complete && this.engine.bossImage.naturalWidth > 0) {
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.drawImage(this.engine.bossImage, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
        } else {
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    // Boss 1
    boss1Phase1(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 2) * 100;
        if (boss.timer % 1.0 < 0.1) boss.fireAtPlayer(200);
    }
    boss1Phase2(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 3) * 150;
        if (boss.timer % 0.5 < 0.1) boss.fireAtPlayer(300);
    }

    // Boss 2
    boss2Phase1(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer) * 150;
        boss.y = 50 + Math.sin(boss.timer * 2) * 50;
        if (boss.timer % 1.5 < 0.1) {
            for (let i = 0; i < 5; i++) {
                const angle = Math.PI / 2 + (i - 2) * 0.2;
                boss.fireAngle(angle, 250);
            }
        }
    }
    boss2Phase2(boss: Boss, dt: number) {
        boss.x += (Math.random() - 0.5) * 200 * dt;
        boss.x = Math.max(0, Math.min(boss.engine.width - boss.width, boss.x));
        if (boss.timer % 0.5 < 0.1) boss.fireAtPlayer(400);
    }

    // Boss 3
    boss3Phase1(boss: Boss, _dt: number) {
        if (boss.timer > 2.0) {
            boss.x = Math.random() * (boss.engine.width - boss.width);
            boss.y = Math.random() * 150;
            boss.timer = 0;
            for (let i = 0; i < 8; i++) boss.fireAngle(i * Math.PI / 4, 200);
        }
    }
    boss3Phase2(boss: Boss, _dt: number) {
        boss.speedY = 200 * Math.sin(boss.timer * 5);
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 2) * 100;
        if (boss.timer % 0.2 < 0.05) boss.fireAtPlayer(350);
    }

    // Boss 4
    boss4Phase1(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2);
        if (boss.timer % 3.0 < 0.1) {
            boss.engine.addEnemy(new PatternEnemy(boss.engine, boss.x, boss.y + boss.height, EnemyMotionType.Homing));
            boss.engine.addEnemy(new PatternEnemy(boss.engine, boss.x + boss.width, boss.y + boss.height, EnemyMotionType.Homing));
        }
    }
    boss4Phase2(boss: Boss, dt: number) {
        boss.x += Math.sin(boss.timer) * 100 * dt;
        if (boss.timer % 1.0 < 0.1) {
            for (let i = 0; i < 12; i++) boss.fireAngle(boss.timer + i * Math.PI / 6, 150);
        }
    }

    // Boss 5 (Final)
    boss5Phase1(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.cos(boss.timer) * 120;
        if (boss.timer % 0.3 < 0.1) {
            boss.fireAngle(Math.PI / 2 + Math.sin(boss.timer * 5) * 0.5, 400);
        }
    }
    boss5Phase2(boss: Boss, _dt: number) {
        boss.y = 50 + Math.sin(boss.timer) * 40;
        if (boss.timer % 0.5 < 0.1) {
            for (let i = 0; i < 20; i++) boss.fireAngle(i * (Math.PI * 2) / 20, 200);
        }
    }
    boss5Phase3(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 4) * 150;
        boss.y = 50 + Math.abs(Math.sin(boss.timer * 2) * 100);
        boss.fireAngle(Math.random() * Math.PI * 2, 300);
        if (Math.random() < 0.05) boss.fireAtPlayer(500);
    }

    genericPhase(boss: Boss, _dt: number) {
        if (Math.random() < 0.05) boss.fireAtPlayer(200);
    }

    fireAngle(angle: number, speed: number) {
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const bullet = new Bullet(this.engine, this.x + this.width / 2, this.y + this.height / 2, vx, vy);
        bullet.color = '#FF2222';
        this.engine.addEnemyBullet(bullet);
    }

    fireAtPlayer(speed: number) {
        const dx = (this.engine.player.x + this.engine.player.width / 2) - (this.x + this.width / 2);
        const dy = (this.engine.player.y + this.engine.player.height / 2) - (this.y + this.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;

        const bullet = new Bullet(this.engine, this.x + this.width / 2, this.y + this.height, vx, vy);
        bullet.color = '#FF0000';
        this.engine.addEnemyBullet(bullet);
    }
}
