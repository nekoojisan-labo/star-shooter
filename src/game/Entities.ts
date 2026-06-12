import { GameState } from './GameEngine';
import type { GameEngine } from './GameEngine';
import { audio } from '../audio/AudioEngine';
import { WeaponType, POWERUP_SLOTS, WeaponState } from './WeaponSystem';

export class Entity {
    x: number;
    y: number;
    width: number;
    height: number;
    speedX: number = 0;
    speedY: number = 0;
    active: boolean = true;
    engine: GameEngine;

    constructor(engine: GameEngine, x: number, y: number, width: number, height: number) {
        this.engine = engine;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    update(dt: number) {
        this.x += this.speedX * dt;
        this.y += this.speedY * dt;
    }

    draw(_ctx: CanvasRenderingContext2D) { }
}

export class Player extends Entity {
    baseSpeed: number = 300;
    speedLevel: number = 0; // 0: 300, 1: 350, 2: 400, 3: 450
    get speed(): number { return this.baseSpeed + this.speedLevel * 50; }

    shotTimer: number = 0;
    shotDelay: number = 0.12;
    subShotTimer: number = 0;
    subShotDelay: number = 0.9; // Homing volley interval
    weapon = new WeaponState();
    barrierHp: number = 0;
    invincibleTimer: number = 0;
    bombCount: number = 2; // Initial bombs
    bits: BitEntity[] = [];

    constructor(engine: GameEngine, x: number, y: number) {
        super(engine, x, y, 64, 64);
    }

    update(dt: number) {
        if (this.invincibleTimer > 0) {
            this.invincibleTimer -= dt;
        }

        if (this.engine.keys['ArrowLeft'] || this.engine.keys['a']) this.x -= this.speed * dt;
        if (this.engine.keys['ArrowRight'] || this.engine.keys['d']) this.x += this.speed * dt;
        if (this.engine.keys['ArrowUp'] || this.engine.keys['w']) this.y -= this.speed * dt;
        if (this.engine.keys['ArrowDown'] || this.engine.keys['s']) this.y += this.speed * dt;

        if (this.engine.touchActive) {
            this.x += this.engine.touchDeltaX * 1.5;
            this.y += this.engine.touchDeltaY * 1.5;
            // Consume the deltas
            this.engine.touchDeltaX = 0;
            this.engine.touchDeltaY = 0;
        }

        this.x = Math.max(0, Math.min(this.engine.width - this.width, this.x));
        // On mobile, keep player above the larger button/gauge area
        const bottomUIMargin = this.engine.isMobile ? 155 : 40;
        this.y = Math.max(0, Math.min(this.engine.height - this.height - bottomUIMargin, this.y));

        if (this.engine.gameState === GameState.Playing) {
            if (this.engine.keysPressed['x'] || this.engine.keysPressed['X'] || this.engine.keysPressed['Enter']) {
                if (this.engine.powerupGauge > 0) {
                    this.applyPowerup(this.engine.powerupGauge - 1);
                    this.engine.powerupGauge = 0;
                }
            }

            // Bomb trigger
            if (this.engine.keysPressed['c'] || this.engine.keysPressed['C']) {
                if (this.bombCount > 0) {
                    this.engine.triggerBomb();
                    this.bombCount--;
                }
            }
        }

        this.bits.forEach((b, i) => b.update(dt, i, this.bits.length));

        this.shotTimer -= dt;
        this.subShotTimer -= dt;
        const isShooting = this.engine.keys['Space'] || this.engine.keys['z'] || this.engine.keys[' '] || this.engine.touchActive;
        if (isShooting) {
            if (!this.engine.audioInitialized) {
                audio.init();
                audio.playBGM('stage' + Math.min(this.engine.stage, 4));
                this.engine.audioInitialized = true;
            }
            if (this.shotTimer <= 0) {
                this.shotTimer = this.shotDelay;
                this.shootMain();
            }
            if (this.subShotTimer <= 0) {
                this.subShotTimer = this.subShotDelay;
                this.shootSub();
            }
        }
    }

    applyPowerup(slotIndex: number) {
        audio.playPowerup();
        const slot = POWERUP_SLOTS[slotIndex];

        if (slot.name === "SHIELD") {
            this.barrierHp = 10;
        } else if (slot.name === "BOMB") {
            this.bombCount = Math.min(this.bombCount + 1, 5);
        } else if (slot.name === "LASER" || slot.name === "WIDE") {
            const nextType = slot.name === "LASER" ? WeaponType.Laser : WeaponType.Wide;
            if (this.weapon.type === nextType) {
                this.weapon.level = Math.min(this.weapon.level + 1, 3);
            } else {
                this.weapon.type = nextType;
                this.weapon.level = 1;
            }
        } else if (slot.name === "HOMING") {
            this.weapon.hasHoming = true;
            this.weapon.homingLevel = Math.min(this.weapon.homingLevel + 1, 3);
        } else if (slot.name === "BIT") {
            this.weapon.hasBits = true;
            this.weapon.bitLevel = Math.min(this.weapon.bitLevel + 1, 5); // Max 5 bits

            const targetBits = this.weapon.bitLevel; // 1 bit per level
            while (this.bits.length < targetBits) {
                this.bits.push(new BitEntity(this.engine, this));
            }
        }
    }

    shootMain() {
        audio.playShot();
        const cx = this.x + this.width / 2;
        const cy = this.y;

        this.createMainBullets(cx, cy);

        // Bits also fire the main weapon, at half damage — full copies made
        // max-bit loadouts melt bosses before their later phases could play
        if (this.weapon.hasBits) {
            this.bits.forEach(bit => {
                this.createMainBullets(bit.x + bit.width / 2, bit.y, 0.5);
            });
        }
    }

    createMainBullets(cx: number, cy: number, damageScale: number = 1) {
        // Main Weapon
        let b: Bullet;
        switch (this.weapon.type) {
            case WeaponType.Normal: {
                // Normal shot: 2 dmg per bullet, bullet count scales with level
                const addNormal = (bx: number, by: number) => {
                    const nb = new Bullet(this.engine, bx, by, 0, -600);
                    nb.damage = 2 * damageScale;
                    this.engine.addBullet(nb);
                };
                if (this.weapon.level === 1) {
                    addNormal(cx - 4, cy);
                } else if (this.weapon.level === 2) {
                    addNormal(cx - 12, cy + 10);
                    addNormal(cx + 4, cy + 10);
                } else {
                    addNormal(cx - 16, cy + 16);
                    addNormal(cx - 4, cy);
                    addNormal(cx + 8, cy + 16);
                }
                break;
            }
            case WeaponType.Laser: {
                const laserWidth = this.weapon.level * 8 + 8; // 16, 24, 32 width
                const bLaser = new Bullet(this.engine, cx - laserWidth / 2, cy - 40, 0, -1200);
                bLaser.width = laserWidth;
                bLaser.height = 64;
                bLaser.pierces = true;
                // Laser: best single-target DPS. Piercing damage is applied per frame
                // and dt-normalized (60fps baseline) in GameEngine.checkCollisions.
                // Lv1: 0.45, Lv2: 0.6, Lv3: 0.75 per frame
                bLaser.damage = (0.3 + this.weapon.level * 0.15) * damageScale;
                bLaser.color = '#FFAAFF'; // used as identifier for pink image
                this.engine.addBullet(bLaser);
                break;
            }
            case WeaponType.Wide: {
                const sSpeed = 700;
                // 2.0 / 2.2 / 2.4 per bullet — must clear the hp-2 popcorn
                // breakpoint or picking WIDE would downgrade from Normal (2 dmg)
                const wideDmg = (1.8 + this.weapon.level * 0.2) * damageScale;
                b = new Bullet(this.engine, cx - 4, cy, 0, -sSpeed);
                b.damage = wideDmg;
                this.engine.addBullet(b);

                let spreadAngles = [];
                if (this.weapon.level === 1) {
                    spreadAngles = [-0.15, 0.15];
                } else if (this.weapon.level === 2) {
                    spreadAngles = [-0.25, -0.1, 0.1, 0.25];
                } else {
                    spreadAngles = [-0.4, -0.2, 0.2, 0.4];
                }
                for (let angle of spreadAngles) {
                    const sb = new Bullet(this.engine, cx - 4, cy, Math.sin(angle) * sSpeed, -sSpeed * Math.cos(angle));
                    sb.damage = wideDmg;
                    this.engine.addBullet(sb);
                }
                break;
            }
        }
    }

    shootSub() {
        const cx = this.x + this.width / 2;
        const cy = this.y;
        // Sub Weapon - Homing missiles
        if (this.weapon.hasHoming) {
            const count = this.weapon.homingLevel * 2; // 2, 4, 6 missiles by level
            const level = this.weapon.homingLevel;
            for (let i = 0; i < count; i++) {
                // Natural launch arc: spread outward, start going straight up
                const spread = (i - count / 2 + 0.5);
                const launchAngle = spread * 0.35; // horizontal spread per missile
                const vx = Math.sin(launchAngle) * 200;
                const vy = -350; // strong upward launch velocity
                const hb = new HomingBullet(this.engine, cx - 6, cy + 20, vx, vy);
                hb.level = level;
                // Homing: auto-hit sub weapon. Lv1: 3, Lv2: 4, Lv3: 5 per missile
                hb.damage = 2 + level;
                hb.width = 10 + level * 4;
                hb.height = 10 + level * 4;
                // Each missile in the salvo gets its own index so targets spread out
                hb.salvoIndex = i;
                this.engine.addBullet(hb);
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 10) % 2 === 0) {
            // blinking effect (skip draw frame)
        } else {
            if (this.engine.playerImage.complete && this.engine.playerImage.naturalWidth > 0) {
                ctx.drawImage(this.engine.playerImage, this.x, this.y, this.width, this.height);
            } else {
                ctx.fillStyle = '#00AAFF';
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        }

        if (this.barrierHp > 0) {
            const timePhase = Date.now() / 200;
            const shieldRadius = Math.max(this.width, this.height) / 2 + 15;
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;

            ctx.save();
            ctx.translate(centerX, centerY);

            // Outer glowing aura
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00FFFF';
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.7 + Math.sin(timePhase) * 0.3})`;
            ctx.lineWidth = 3 + (this.barrierHp / 10) * 2;

            ctx.beginPath();
            ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Inner translucent bubble
            ctx.fillStyle = `rgba(0, 200, 255, ${0.15 + (this.barrierHp * 0.02)})`;
            ctx.fill();
            ctx.restore();

            // Draw HP indicator for shield
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 14px "Courier New"';
            ctx.textAlign = 'center';
            ctx.fillText(this.barrierHp.toString(), centerX, this.y - 15);
        }

        this.bits.forEach(b => b.draw(ctx));
    }
}

export class Bullet extends Entity {
    pierces: boolean = false;
    color: string = '#00FFFF';
    damage: number = 1;

    constructor(engine: GameEngine, x: number, y: number, speedX: number, speedY: number) {
        super(engine, x, y, 8, 16);
        this.speedX = speedX;
        this.speedY = speedY;
    }

    update(dt: number) {
        super.update(dt);
        if (this.y < -50 || this.y > this.engine.height + 50 || this.x < -50 || this.x > this.engine.width + 50) {
            this.active = false;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.color === '#FFAAFF' && this.engine.bulletPinkImage.complete) {
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.rotate(-Math.PI / 2);

            if (this.width >= 32) {
                // Level 3 Laser: very thick, glowing with intense white core
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#FFAAFF';
                ctx.drawImage(this.engine.bulletPinkImage, -this.height / 2, -this.width / 2, this.height, this.width);
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(-this.height / 2, -this.width / 6, this.height, this.width / 3);
            } else if (this.width >= 24) {
                // Level 2 Laser: thicker with slight pink glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#FFAAFF';
                ctx.drawImage(this.engine.bulletPinkImage, -this.height / 2, -this.width / 2, this.height, this.width);
                ctx.shadowBlur = 0;
            } else {
                // Level 1 Laser: standard appearance
                ctx.drawImage(this.engine.bulletPinkImage, -this.height / 2, -this.width / 2, this.height, this.width);
            }
            ctx.restore();
        } else if (this.engine.bulletBlueImage.complete) {
            // Additive halo behind the bullet for a brighter energy-shot look
            const img = this.engine.bulletBlueImage;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.35;
            ctx.drawImage(img, this.x - this.width * 0.4, this.y - this.height * 0.25, this.width * 1.8, this.height * 1.5);
            ctx.restore();
            ctx.drawImage(img, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

export class EnemyBullet extends Bullet {
    constructor(engine: GameEngine, x: number, y: number, speedX: number, speedY: number) {
        super(engine, x, y, speedX, speedY);
        this.width = 16;
        this.height = 16;
        this.pierces = false;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class HomingBullet extends Bullet {
    target: Enemy | null = null;
    totalLifespan: number = 0;
    maxLifespan: number = 5.0;
    level: number = 1; // 1-3, drives appearance and damage
    salvoIndex: number = 0; // position within the launch salvo — spreads targets
    trail: { x: number, y: number }[] = []; // exhaust trail history
    launchTimer: number = 0;
    readonly launchDuration: number = 0.25; // seconds of initial launch arc

    constructor(engine: GameEngine, x: number, y: number, speedX: number, speedY: number) {
        super(engine, x, y, speedX, speedY);
        this.width = 12;
        this.height = 12;
        this.color = '#FFAA00'; // Orange (level 1)
    }

    update(dt: number) {
        super.update(dt);
        this.launchTimer += dt;
        this.totalLifespan += dt;

        if (this.totalLifespan >= this.maxLifespan) {
            this.active = false;
            return;
        }

        // Exhaust trail history (rendered in draw)
        this.trail.push({ x: this.x + this.width / 2, y: this.y + this.height / 2 });
        if (this.trail.length > 7) this.trail.shift();

        // Launch arc: for the first launchDuration, fly upward and slightly outward
        // then begin homing. This mimics classic shooter homing missile behavior.
        if (this.launchTimer < this.launchDuration) {
            // Just let the initial velocity carry it (set at birth: upward + slight spread)
            return;
        }

        // Target acquisition: enemies sorted nearest-first, each missile picks
        // the slot matching its salvoIndex — so one volley fans out across
        // different enemies instead of all chasing the same one.
        // Once locked, a missile keeps its target until it dies (re-picking
        // every 0.5s made higher-index missiles abandon the enemy they were
        // about to hit, since that enemy had become their own 0th-nearest).
        if (!this.target || !this.target.active) {
            const candidates: { enemy: Enemy, dist: number }[] = [];
            this.engine.enemies.forEach(e => {
                if (!e.active || e.y < 0) return;
                const dx = (e.x + e.width / 2) - (this.x + this.width / 2);
                const dy = (e.y + e.height / 2) - (this.y + this.height / 2);
                candidates.push({ enemy: e, dist: dx * dx + dy * dy });
            });

            if (candidates.length > 0) {
                candidates.sort((a, b) => a.dist - b.dist);
                this.target = candidates[this.salvoIndex % candidates.length].enemy;
            } else {
                this.target = null;
            }
        }

        if (this.target) {
            const dx = (this.target.x + this.target.width / 2) - (this.x + this.width / 2);
            const dy = (this.target.y + this.target.height / 2) - (this.y + this.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // Speed increases by level
            const speed = 350 + this.level * 50;
            const targetVX = (dx / dist) * speed;
            const targetVY = (dy / dist) * speed;

            // Tracking strength increases slightly by level
            const trackStrength = 2.0 + this.level * 0.5;
            this.speedX += (targetVX - this.speedX) * trackStrength * dt;
            this.speedY += (targetVY - this.speedY) * trackStrength * dt;
        } else {
            // No target: maintain forward momentum (upward)
            this.speedY = Math.min(this.speedY, -200);
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        const angle = Math.atan2(this.speedY, this.speedX) + Math.PI / 2;
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        // Fading exhaust trail (world space, oldest first)
        ctx.save();
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            ctx.globalAlpha = ((i + 1) / this.trail.length) * 0.3;
            ctx.fillStyle = this.level >= 3 ? '#FF6633' : '#FFAA33';
            ctx.beginPath();
            ctx.arc(t.x, t.y, 1.2 + i * 0.45, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Missile body, drawn nose-up then rotated to flight direction
        const scale = 0.85 + this.level * 0.3; // Lv1: 1.15x, Lv2: 1.45x, Lv3: 1.75x
        const bodyCol = this.level >= 3 ? '#FFEEDD' : this.level === 2 ? '#FFE066' : '#DDDDDD';
        const accent = this.level >= 3 ? '#FF3300' : this.level === 2 ? '#FF8800' : '#FF6600';

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.scale(scale, scale);

        ctx.shadowBlur = 4 + this.level * 3;
        ctx.shadowColor = accent;

        // Fuselage (capsule)
        ctx.fillStyle = bodyCol;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.quadraticCurveTo(3.5, -4, 3.5, 0);
        ctx.lineTo(3.5, 6);
        ctx.lineTo(-3.5, 6);
        ctx.lineTo(-3.5, 0);
        ctx.quadraticCurveTo(-3.5, -4, 0, -9);
        ctx.fill();

        // Nose cone
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.quadraticCurveTo(3, -4.5, 3.2, -2);
        ctx.lineTo(-3.2, -2);
        ctx.quadraticCurveTo(-3, -4.5, 0, -9);
        ctx.fill();

        // Tail fins
        ctx.beginPath();
        ctx.moveTo(3.5, 2.5);
        ctx.lineTo(7, 8);
        ctx.lineTo(3.5, 6.5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-3.5, 2.5);
        ctx.lineTo(-7, 8);
        ctx.lineTo(-3.5, 6.5);
        ctx.closePath();
        ctx.fill();

        // Flickering exhaust flame
        const flick = 1 + Math.sin(this.totalLifespan * 60 + this.salvoIndex * 2) * 0.35;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#FFAA00';
        ctx.fillStyle = '#FFCC33';
        ctx.beginPath();
        ctx.moveTo(-2.2, 6);
        ctx.lineTo(0, 6 + 7 * flick);
        ctx.lineTo(2.2, 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-1, 6);
        ctx.lineTo(0, 6 + 3.5 * flick);
        ctx.lineTo(1, 6);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

export class BitEntity extends Entity {
    player: Player;
    angle: number = 0;

    constructor(engine: GameEngine, player: Player) {
        super(engine, player.x, player.y, 20, 20);
        this.player = player;
    }

    update(_dt: number, index?: number, total?: number) {
        if (index === undefined || total === undefined) return;

        // Base angle off a global timer so all bits sync perfectly visually
        this.angle = this.engine.gameTimer * 4.5; // Global orbit speed

        const orbitRadius = 60;
        const offsetAngle = this.angle + (Math.PI * 2 * index) / total;

        // Rigid attachment: bits are locked to the orbit point around the player
        // so they never lag behind when the player moves fast (lerp caused a
        // 30-45px trailing gap that made bullet-blocking unreliable).
        this.x = this.player.x + this.player.width / 2 - this.width / 2 + Math.cos(offsetAngle) * orbitRadius;
        this.y = this.player.y + this.player.height / 2 - this.height / 2 + Math.sin(offsetAngle) * orbitRadius;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#00FFFF';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
    }
}

export class Enemy extends Entity {
    hp: number = 5;
    scoreValue: number = 100;
    spriteIndex: number = -1;

    constructor(engine: GameEngine, x: number, y: number) {
        super(engine, x, y, 64, 64);
        this.speedY = 150;
    }

    update(dt: number) {
        super.update(dt);
        if (this.y > this.engine.height + 50) {
            this.active = false;
        }
    }

    hit(damage: number) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.active = false;
            this.engine.addScore(this.scoreValue);
            if (this.engine.audioInitialized) audio.playEnemyDefeat();
            for (let i = 0; i < 15; i++) {
                this.engine.addParticle(new Particle(this.engine, this.x + this.width / 2, this.y + this.height / 2));
            }
            const rand = Math.random();
            if (rand < 0.25) {
                this.engine.powerups.push(new PowerUp(this.engine, this.x, this.y));
            } else if (rand > 0.85) { // 15% chance to drop SpeedItem
                this.engine.speedItems.push(new SpeedItem(this.engine, this.x, this.y));
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.engine.enemyImage.complete && this.engine.enemyImage.naturalWidth > 0) {
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            if (this.spriteIndex >= 0) {
                const cols = 4;
                const rows = 5;
                const rawW = this.engine.enemyImage.width / cols;
                const rawH = this.engine.enemyImage.height / rows;
                const sx = (this.spriteIndex % cols) * rawW;
                const sy = Math.floor(this.spriteIndex / cols) * rawH;
                ctx.drawImage(this.engine.enemyImage, sx, sy, rawW, rawH, -this.width / 2, -this.height / 2, this.width, this.height);
            } else {
                ctx.drawImage(this.engine.enemyImage, -this.width / 2, -this.height / 2, this.width, this.height);
            }
            ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
        } else {
            ctx.fillStyle = '#FF4444';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }
}

export class PowerUp extends Entity {
    constructor(engine: GameEngine, x: number, y: number) {
        super(engine, x, y, 24, 24);
        this.speedY = 50;
    }

    update(dt: number) {
        super.update(dt);
        if (this.y > this.engine.height + 50) this.active = false;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#FFDD00';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = '12px Courier';
        ctx.fillText('P', this.x + 8, this.y + 16);
    }
}

export class SpeedItem extends Entity {
    constructor(engine: GameEngine, x: number, y: number) {
        super(engine, x, y, 24, 24);
        this.speedY = 80; // slightly faster drop than P item
    }

    update(dt: number) {
        super.update(dt);
        if (this.y > this.engine.height + 50) this.active = false;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#00FFAA'; // Cyan/Greenish to distinguish
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Courier';
        ctx.fillText('S', this.x + 8, this.y + 16);
    }
}

export class Particle extends Entity {
    life: number;
    maxLife: number;
    color: string;

    constructor(engine: GameEngine, x: number, y: number) {
        super(engine, x, y, Math.random() * 4 + 2, Math.random() * 4 + 2);
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 150 + 50;
        this.speedX = Math.cos(angle) * speed;
        this.speedY = Math.sin(angle) * speed;
        this.maxLife = Math.random() * 0.4 + 0.1;
        this.life = this.maxLife;
        this.color = Math.random() > 0.5 ? '#FF5500' : '#FFFF00';
    }

    update(dt: number) {
        super.update(dt);
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.globalAlpha = 1.0;
    }
}
