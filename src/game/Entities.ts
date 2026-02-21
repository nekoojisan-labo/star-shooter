import type { GameEngine } from './GameEngine';
import { audio } from '../audio/AudioEngine';
import { WeaponType, WeaponState, POWERUP_SLOTS, SubWeaponType } from './WeaponSystem';
import type { TWeaponType, TSubWeaponType } from './WeaponSystem';

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
    speed: number = 300;
    shotTimer: number = 0;
    shotDelay: number = 0.12;
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

        this.x = Math.max(0, Math.min(this.engine.width - this.width, this.x));
        this.y = Math.max(0, Math.min(this.engine.height - this.height - 40, this.y));

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

        this.bits.forEach((b, i) => b.update(dt, i, this.bits.length));

        this.shotTimer -= dt;
        const isShooting = this.engine.keys['Space'] || this.engine.keys['z'] || this.engine.keys[' '];
        if (isShooting && this.shotTimer <= 0) {
            if (!this.engine.audioInitialized) {
                audio.init();
                audio.playBGM(this.engine.stage);
                this.engine.audioInitialized = true;
            }
            this.shotTimer = this.shotDelay;
            this.shoot();
        }
    }

    applyPowerup(slotIndex: number) {
        audio.playPowerup();
        const slot = POWERUP_SLOTS[slotIndex];

        if (slot.name === "SHIELD") {
            this.barrierHp = 10;
        } else if (slot.name === "BOMB") {
            this.bombCount++;
        } else if (slot.name === "LASER" || slot.name === "WIDE") {
            const nextType = slot.name === "LASER" ? WeaponType.Laser : WeaponType.Wide;
            if (this.weapon.type === nextType) {
                this.weapon.level = Math.min(this.weapon.level + 1, 3);
            } else {
                this.weapon.type = nextType;
                this.weapon.level = 1;
            }
        } else if (slot.name === "HOMING" || slot.name === "BIT") {
            const nextType = slot.name === "HOMING" ? SubWeaponType.Homing : SubWeaponType.Bit;
            if (this.weapon.subType === nextType) {
                this.weapon.subLevel = Math.min(this.weapon.subLevel + 1, 3);
            } else {
                this.weapon.subType = nextType;
                this.weapon.subLevel = 1;
            }
            if (nextType !== SubWeaponType.Bit) {
                this.bits = [];
            }
        }

        if (this.weapon.subType === SubWeaponType.Bit) {
            const currentBits = this.bits.length;
            const targetBits = this.weapon.subLevel * 2;
            for (let i = currentBits; i < targetBits; i++) {
                this.bits.push(new BitEntity(this.engine, this));
            }
        }
    }

    shoot() {
        audio.playShot();
        const cx = this.x + this.width / 2;
        const cy = this.y;

        // Main Weapon
        switch (this.weapon.type) {
            case WeaponType.Normal:
                if (this.weapon.level === 1) {
                    this.engine.addBullet(new Bullet(this.engine, cx - 4, cy, 0, -600));
                } else if (this.weapon.level === 2) {
                    this.engine.addBullet(new Bullet(this.engine, cx - 12, cy + 10, 0, -600));
                    this.engine.addBullet(new Bullet(this.engine, cx + 4, cy + 10, 0, -600));
                } else {
                    this.engine.addBullet(new Bullet(this.engine, cx - 16, cy + 16, 0, -600));
                    this.engine.addBullet(new Bullet(this.engine, cx - 4, cy, 0, -600));
                    this.engine.addBullet(new Bullet(this.engine, cx + 8, cy + 16, 0, -600));
                }
                break;
            case WeaponType.Laser:
                const laserWidth = this.weapon.level * 8 + 8;
                const bLaser = new Bullet(this.engine, cx - laserWidth / 2, cy - 40, 0, -1200);
                bLaser.width = laserWidth;
                bLaser.height = 64;
                bLaser.pierces = true;
                bLaser.color = '#FFAAFF';
                this.engine.addBullet(bLaser);
                break;
            case WeaponType.Wide:
                const sSpeed = 600;
                this.engine.addBullet(new Bullet(this.engine, cx - 4, cy, 0, -sSpeed));
                let spreadAngles = [];
                if (this.weapon.level === 1) {
                    spreadAngles = [-0.2, 0.2];
                } else if (this.weapon.level === 2) {
                    spreadAngles = [-0.3, -0.15, 0.15, 0.3];
                } else {
                    spreadAngles = [-0.4, -0.2, 0.2, 0.4];
                }
                for (let angle of spreadAngles) {
                    this.engine.addBullet(new Bullet(this.engine, cx - 4, cy, angle * sSpeed, -sSpeed * Math.cos(angle)));
                }
                break;
        }

        // Sub Weapon
        if (this.weapon.subType === SubWeaponType.Homing) {
            const count = this.weapon.subLevel * 2; // e.g., 2, 4, 6 missiles
            for (let i = 0; i < count; i++) {
                const angle = (i - count / 2 + 0.5) * 0.4;
                const hb = new HomingBullet(this.engine, cx - 6, cy + 20, Math.sin(angle) * 300, -300);
                this.engine.addBullet(hb);
            }
        } else if (this.weapon.subType === SubWeaponType.Bit) {
            this.bits.forEach(bit => {
                this.engine.addBullet(new Bullet(this.engine, bit.x + bit.width / 2 - 4, bit.y, 0, -500));
            });
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
            ctx.strokeStyle = '#00FFFF';
            ctx.lineWidth = 2 + (this.barrierHp / 10) * 3;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2 + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = `rgba(0, 255, 255, ${Math.min(0.5, this.barrierHp * 0.05)})`;
            ctx.fill();

            // Draw HP indicator for shield
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px "Courier New"';
            ctx.textAlign = 'center';
            ctx.fillText(this.barrierHp.toString(), this.x + this.width / 2, this.y - 10);
        }

        this.bits.forEach(b => b.draw(ctx));
    }
}

export class Bullet extends Entity {
    pierces: boolean = false;
    color: string = '#00FFFF';

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
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

export class HomingBullet extends Bullet {
    target: Enemy | null = null;
    timer: number = 0;

    constructor(engine: GameEngine, x: number, y: number, speedX: number, speedY: number) {
        super(engine, x, y, speedX, speedY);
        this.width = 12;
        this.height = 12;
        this.color = '#FFAA00'; // Orange
    }

    update(dt: number) {
        super.update(dt);
        this.timer += dt;

        // Find closest target occasionally or if target lost
        if (!this.target || !this.target.active || this.timer > 0.5) {
            this.timer = 0;
            let closest: Enemy | null = null;
            let minDist = 999999;
            this.engine.enemies.forEach(e => {
                if (!e.active) return;
                const dx = (e.x + e.width / 2) - (this.x + this.width / 2);
                const dy = (e.y + e.height / 2) - (this.y + this.height / 2);
                const dist = dx * dx + dy * dy;
                // Only target enemies roughly above it
                if (dy < 100 && dist < minDist) {
                    minDist = dist;
                    closest = e;
                }
            });
            this.target = closest;
        }

        if (this.target) {
            const dx = (this.target.x + this.target.width / 2) - (this.x + this.width / 2);
            const dy = (this.target.y + this.target.height / 2) - (this.y + this.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // Adjust velocity towards target smoothly
            const speed = Math.sqrt(this.speedX * this.speedX + this.speedY * this.speedY) || 400;
            const targetVX = (dx / dist) * speed;
            const targetVY = (dy / dist) * speed;

            this.speedX += (targetVX - this.speedX) * 5 * dt;
            this.speedY += (targetVY - this.speedY) * 5 * dt;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

export class BitEntity extends Entity {
    player: Player;
    angle: number = 0;

    constructor(engine: GameEngine, player: Player) {
        super(engine, player.x, player.y, 20, 20);
        this.player = player;
    }

    update(dt: number, index?: number, total?: number) {
        if (index === undefined || total === undefined) return;

        this.angle += dt * 3; // Orbit speed

        const orbitRadius = 60;
        const offsetAngle = this.angle + (Math.PI * 2 * index) / total;

        // Smoothly follow the orbit point around the player
        const targetX = this.player.x + this.player.width / 2 - this.width / 2 + Math.cos(offsetAngle) * orbitRadius;
        const targetY = this.player.y + this.player.height / 2 - this.height / 2 + Math.sin(offsetAngle) * orbitRadius;

        this.x += (targetX - this.x) * 10 * dt;
        this.y += (targetY - this.y) * 10 * dt;
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
    hp: number = 1;
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
            if (this.engine.audioInitialized) audio.playExplosion();
            for (let i = 0; i < 15; i++) {
                this.engine.addParticle(new Particle(this.engine, this.x + this.width / 2, this.y + this.height / 2));
            }
            if (Math.random() < 0.1) {
                this.engine.powerups.push(new PowerUp(this.engine, this.x, this.y));
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
