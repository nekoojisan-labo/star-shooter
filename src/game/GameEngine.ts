import { audio } from '../audio/AudioEngine';
import { processSprite } from '../utils/ImageUtils';
import { WeaponType, POWERUP_SLOTS } from './WeaponSystem';
import { Entity, Player, Bullet, Enemy, PowerUp, Particle } from './Entities';
import { PatternEnemy, Boss, type TEnemyMotionType } from './EnemyTypes';

export const GameState = {
    Title: 0,
    Playing: 1,
    GameOver: 2,
    StageClear: 3,
    Config: 4
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

export class GameEngine {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    keys: { [key: string]: boolean } = {};
    keysPressed: { [key: string]: boolean } = {}; // edge detection
    audioInitialized = false;

    // Assets
    playerImage = new Image();
    enemyImage = new Image();
    bossImage = new Image();
    bgImages: HTMLImageElement[] = [];

    // State
    gameState: GameState = GameState.Title;
    score: number = 0;
    lives: number = 3;
    stage: number = 1;
    powerupGauge: number = 0; // 0 = empty, 1~7 = slot
    continues: number = 2; // user requested 2 continues
    nextExtendScore: number = 20000;

    // Config
    configSelection: number = 0; // 0: BGM, 1: SFX, 2: Return

    // Entities
    player: Player;
    bullets: Bullet[] = [];
    enemyBullets: Bullet[] = [];
    enemies: Enemy[] = [];
    particles: Particle[] = [];
    powerups: PowerUp[] = [];

    bgY: number = 0;
    enemySpawnTimer: number = 0;
    bossActive: boolean = false;
    bombFlashTimer: number = 0;

    cleanup: () => void;

    async loadAssets() {
        for (let i = 1; i <= 3; i++) {
            this.bgImages[i] = await processSprite({
                src: `/assets/bg_stage${i}.png`,
            });
        }
        this.bgImages[0] = this.bgImages[1]; // fallback

        this.playerImage = await processSprite({
            src: '/assets/player.png',
            crop: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 },
            removeBg: true
        });
        this.enemyImage = await processSprite({
            src: '/assets/enemies.png',
            removeBg: true
        });
        this.bossImage = await processSprite({
            src: '/assets/boss.png',
            crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
            removeBg: true,
            rotate180: true
        });
    }

    constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;

        this.loadAssets();

        this.player = new Player(this, width / 2 - 24, height - 100);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!this.keys[e.key]) this.keysPressed[e.key] = true;
            this.keys[e.key] = true;
            if (!this.audioInitialized) {
                audio.init();
                this.audioInitialized = true;
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => { this.keys[e.key] = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        this.cleanup = () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
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
            if (e.active) e.hit(100); // Massive damage
        });

        this.bombFlashTimer = 0.5;
        if (this.audioInitialized) audio.playExplosion();
    }

    addScore(s: number) {
        this.score += s;
        if (this.score >= this.nextExtendScore) {
            this.lives++;
            this.nextExtendScore += 20000;
            if (this.audioInitialized) audio.playPowerup(); // Play sound for extra life

            // Show a floating text for extend (if existed) or just particles to indicate
            for (let i = 0; i < 20; i++) {
                const p = new Particle(this, this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
                p.color = '#00FF00';
                this.addParticle(p);
            }
        }
    }

    update(dt: number) {
        if (this.gameState === GameState.Title) {
            if (this.keysPressed['Enter'] || this.keysPressed[' ']) {
                this.resetGame();
                this.gameState = GameState.Playing;
            } else if (this.keysPressed['Shift']) {
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

            if ((this.keysPressed['Enter'] || this.keysPressed[' ']) && this.configSelection === 2) {
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
                    this.resetGame(true); // Continue
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
            this.player.update(dt); // allow player to move during result

            if (this.keysPressed['Enter']) {
                if (this.stage >= 3) {
                    this.resetToTitle();
                } else {
                    this.stage++;
                    this.resetGame(true);
                    this.gameState = GameState.Playing;
                }
            }
            this.keysPressed = {};
            return;
        }

        if (this.bombFlashTimer > 0) {
            this.bombFlashTimer -= dt;
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

        this.enemySpawnTimer -= dt;
        if (this.enemySpawnTimer <= 0 && !this.bossActive) {
            this.enemySpawnTimer = Math.max(0.5, 1.5 - (this.stage * 0.15));
            const x = Math.random() * (this.width - 40);

            // Random motion type from 0 to 19
            const motionType = Math.floor(Math.random() * 20) as TEnemyMotionType;
            this.addEnemy(new PatternEnemy(this, x, -50, motionType));

            // Stage boss trigger
            if (this.score > this.stage * 5000 && !this.bossActive) {
                this.bossActive = true;
                this.addEnemy(new Boss(this, this.width / 2 - 64, -150, this.stage));
            }
        }

        this.player.update(dt);
        this.bullets.forEach(b => b.update(dt));
        this.enemyBullets.forEach(b => b.update(dt));
        this.enemies.forEach(e => e.update(dt));
        this.particles.forEach(p => p.update(dt));
        this.powerups.forEach(p => p.update(dt));

        this.bullets = this.bullets.filter(b => b.active);
        this.enemyBullets = this.enemyBullets.filter(b => b.active);
        this.enemies = this.enemies.filter(e => e.active);
        this.particles = this.particles.filter(p => p.active);
        this.powerups = this.powerups.filter(p => p.active);

        this.checkCollisions();

        // edge keys clear at end of frame
        this.keysPressed = {};
    }

    checkCollisions() {
        // Bullet hits Enemy
        for (const b of this.bullets) {
            for (const e of this.enemies) {
                if (b.active && e.active && this.isAABB(b, e)) {
                    b.active = false;
                    e.hit(1);
                }
            }
        }

        // Player hits Enemy
        for (const e of this.enemies) {
            if (e.active && this.isAABB(this.player, e)) {
                e.hit(100);
                if (this.player.barrierHp > 0) {
                    this.player.barrierHp--;
                    if (this.audioInitialized) audio.playExplosion();
                } else {
                    this.playerHit();
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
    }

    playerHit() {
        if (this.player.invincibleTimer > 0) return;

        if (this.audioInitialized) audio.playExplosion();
        // particles
        for (let i = 0; i < 30; i++) {
            this.addParticle(new Particle(this, this.player.x + this.player.width / 2, this.player.y + this.player.height / 2));
        }

        this.lives -= 1;
        this.player.weapon.level = 1;

        if (this.lives <= 0) {
            this.gameState = GameState.GameOver;
            audio.stopBGM();
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
        this.resetGame();
    }

    resetGame(isContinue: boolean = false) {
        if (isContinue) {
            this.score = 0; // Or retain half score, but reset to 0 is standard for continue
            this.nextExtendScore = 20000;
        } else {
            this.score = 0;
            this.stage = 1;
            this.nextExtendScore = 20000;
            this.continues = 2;
        }

        this.lives = 3;
        this.player.x = this.width / 2 - 24;
        this.player.y = this.height - 100;
        this.player.weapon.level = 1;
        this.player.invincibleTimer = 0;
        this.powerupGauge = 0;
        this.enemies = [];
        this.bullets = [];
        this.enemyBullets = [];
        this.powerups = [];
        this.bossActive = false;
        if (this.audioInitialized) audio.playBGM(this.stage);
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

            // 背景上に暗いオーバーレイを重ねてキャラクターの視認性を上げる
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else {
            this.ctx.fillStyle = '#050510';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        this.powerups.forEach(p => p.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.bullets.forEach(b => b.draw(this.ctx));
        this.enemyBullets.forEach(b => b.draw(this.ctx));
        if (this.gameState === GameState.Playing) {
            this.player.draw(this.ctx);
        }
        this.particles.forEach(p => p.draw(this.ctx));

        // Bomb Flash
        if (this.bombFlashTimer > 0) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.bombFlashTimer * 2})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        // UI
        if (this.gameState === GameState.Playing || this.gameState === GameState.GameOver || this.gameState === GameState.StageClear) {
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 20px "Courier New"';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`SCORE: ${this.score}`, 10, 30);
            this.ctx.fillText(`LIVES: ${'❤'.repeat(Math.max(0, this.lives))}`, 10, 60);
            this.ctx.fillText(`BOMBS: ${'B'.repeat(Math.max(0, this.player.bombCount))}`, 10, 90);
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`STAGE: ${this.stage}`, this.width - 10, 30);

            if (this.player.weapon.level > 1 || this.player.weapon.type !== WeaponType.Normal) {
                this.ctx.fillStyle = '#00FFFF';
                const weaponName = Object.keys(WeaponType).find(k => (WeaponType as any)[k] === this.player.weapon.type)?.toUpperCase() || "WEAPON";
                this.ctx.fillText(`MAIN: ${weaponName} Lv.${this.player.weapon.level}`, this.width - 10, 60);
            }
            if (this.player.weapon.subType !== 0) { // SubWeaponType.None is 0
                this.ctx.fillStyle = '#FFAA00';
                let subName = this.player.weapon.subType === 1 ? 'HOMING' : 'BIT';
                this.ctx.fillText(`SUB: ${subName} Lv.${this.player.weapon.subLevel}`, this.width - 10, 90);
            }

            // Draw Gradius Powerup Gauge
            const slotWidth = (this.width - 20) / POWERUP_SLOTS.length;
            this.ctx.font = 'bold 12px "Courier New"';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            for (let i = 0; i < POWERUP_SLOTS.length; i++) {
                const slot = POWERUP_SLOTS[i];
                const x = 10 + i * slotWidth;
                const y = this.height - 20;
                const isSelected = (this.powerupGauge - 1 === i);

                this.ctx.fillStyle = isSelected ? '#FF4400' : '#112244';
                this.ctx.fillRect(x + 1, y - 10, slotWidth - 2, 20);

                this.ctx.strokeStyle = isSelected ? '#FFFF00' : '#336699';
                this.ctx.strokeRect(x + 1, y - 10, slotWidth - 2, 20);

                this.ctx.fillStyle = isSelected ? '#FFFFFF' : '#88AADD';
                this.ctx.fillText(slot.name, x + slotWidth / 2, y);
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
            this.ctx.fillText('PRESS ENTER TO START', this.width / 2, this.height / 2 + 50);

            this.ctx.fillStyle = '#AAAAAA';
            this.ctx.font = '16px "Courier New"';
            this.ctx.fillText('PRESS SHIFT FOR CONFIG', this.width / 2, this.height / 2 + 90);

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
            if (this.stage >= 3) {
                this.ctx.fillText(`ALL STAGES CLEAR!`, this.width / 2, this.height / 3);
            } else {
                this.ctx.fillText(`STAGE ${this.stage} CLEAR!`, this.width / 2, this.height / 3);
            }

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '20px "Courier New"';
            if (this.stage >= 3) {
                this.ctx.fillText('PRESS ENTER TO RETURN TO TITLE', this.width / 2, this.height / 2 + 50);
            } else {
                this.ctx.fillText('PRESS ENTER FOR NEXT STAGE', this.width / 2, this.height / 2 + 50);
            }
        }
    }
}
