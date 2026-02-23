const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/game/EnemyTypes.ts');
const fileContent = fs.readFileSync(filePath, 'utf-8');

const newBossCode = `export class Boss extends Enemy {
    bossType: number;
    phases: BossPhase[];
    currentPhase: number = 0;
    dyingTimer: number = 0;
    timer: number = 0;
    lastFireTimer: number = -1;
    isMidBoss: boolean = false;
    startX: number = 0;
    startY: number = 0;

    constructor(engine: GameEngine, x: number, y: number, bossType: number) {
        super(engine, x, y);
        this.bossType = bossType;
        this.width = 192;
        this.height = 192;
        this.scoreValue = bossType * 5000;
        this.startX = x;
        this.startY = 50; // default target Y

        const baseHp = 150 + bossType * 100;
        
        switch(bossType) {
            case 1:
                this.phases = [
                    { hp: baseHp, update: this.boss1Phase1 },
                    { hp: baseHp * 1.5, update: this.boss1Phase2 }
                ];
                break;
            case 2:
                this.phases = [
                    { hp: baseHp * 1.5, update: this.boss2Phase1 },
                    { hp: baseHp * 2.0, update: this.boss2Phase2 }
                ];
                break;
            case 3:
                this.phases = [
                    { hp: baseHp * 1.8, update: this.boss3Phase1 },
                    { hp: baseHp * 2.2, update: this.boss3Phase2 }
                ];
                break;
            case 4:
                this.phases = [
                    { hp: baseHp * 2.0, update: this.boss4Phase1 },
                    { hp: baseHp * 2.5, update: this.boss4Phase2 }
                ];
                break;
            case 5:
                this.phases = [
                    { hp: baseHp * 2.5, update: this.boss5Phase1 },
                    { hp: baseHp * 3.0, update: this.boss5Phase2 },
                    { hp: baseHp * 3.5, update: this.boss5Phase3 }
                ];
                break;
            default:
                this.phases = [
                    { hp: baseHp, update: this.boss1Phase1 }
                ];
                break;
        }

        this.hp = this.phases[0].hp;
        this.speedY = 100; // Entry speed
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
                    this.engine.gameState = GameState.StageClear;
                    if (this.engine.audioInitialized) audio.playPowerup();
                }
            }
            return;
        }

        // Intro movement
        if (this.y < this.startY) {
            this.y += this.speedY * dt;
            return;
        }

        this.timer += dt;
        
        // Execute current phase
        if (this.currentPhase < this.phases.length) {
            this.phases[this.currentPhase].update.call(this, this, dt);
        }
    }

    hit(damage: number) {
        if (this.y < 0 || this.dyingTimer > 0) return; // Invincible during intro or dying
        this.hp -= damage;
        this.engine.addScore(10);
        
        if (this.hp <= 0 && this.dyingTimer <= 0) {
            this.currentPhase++;
            if (this.currentPhase >= this.phases.length) {
                this.dyingTimer = 2.0;
                if (this.engine.audioInitialized) audio.playExplosion();
            } else {
                this.hp = this.phases[this.currentPhase].hp;
                this.timer = 0; // reset pattern timer
                for (let i = 0; i < 20; i++) {
                    const p = new Particle(this.engine, this.x + this.width/2, this.y + this.height/2);
                    p.color = '#FFFFFF';
                    this.engine.addParticle(p);
                }
                if (this.engine.audioInitialized) audio.playExplosion();
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        const img = this.engine.bossImages[this.bossType] || this.engine.bossImages[1];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

            if (this.dyingTimer > 0 && Math.floor(this.dyingTimer * 10) % 2 === 0) {
                ctx.filter = 'brightness(2.0) sepia(1) hue-rotate(-50deg) saturate(5)';
            } else if (this.isMidBoss) {
                ctx.filter = 'hue-rotate(120deg) brightness(1.2) scale(0.7)';
            }

            ctx.drawImage(img, -this.width / 2, -this.height / 2, this.width, this.height);
            ctx.restore();
        } else {
            ctx.fillStyle = this.isMidBoss ? '#00FFFF' : '#FF0000';
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    }

    // --- Helper Methods ---
    fireAngle(angle: number, speed: number, color: string = '#FF0055') {
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const b = new EnemyBullet(this.engine, this.x + this.width / 2 - 6, this.y + this.height, vx, vy);
        this.engine.addEnemyBullet(b);
    }

    fireAtPlayer(speed: number) {
        const dx = (this.engine.player.x + this.engine.player.width / 2) - (this.x + this.width / 2);
        const dy = (this.engine.player.y + this.engine.player.height / 2) - (this.y + this.height);
        const angle = Math.atan2(dy, dx);
        this.fireAngle(angle, speed, '#FFAA00');
    }

    // ============================================
    // === STAGE 1 BOSS: MULTI-TURRET CRUISER ===
    // ============================================
    boss1Phase1(boss: Boss, _dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer) * 150;
        
        // Straight thick laser down the middle
        if (boss.timer % 0.8 < 0.1) {
            boss.fireAngle(Math.PI / 2, 350);
            boss.fireAngle(Math.PI / 2 + 0.1, 350);
            boss.fireAngle(Math.PI / 2 - 0.1, 350);
        }
        // Fan bullets from sides
        if (boss.timer % 1.5 < 0.1) {
            for (let i = -1; i <= 1; i++) {
                boss.fireAngle(Math.PI / 2 + i * 0.4, 200);
            }
        }
    }
    boss1Phase2(boss: Boss, dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 2) * 180;
        if (boss.timer % 0.4 < 0.1) {
             boss.fireAtPlayer(300);
        }
        if (boss.timer % 1.2 < 0.1) {
            for (let i = -2; i <= 2; i++) {
                boss.fireAngle(Math.PI / 2 + i * 0.3, 250);
            }
        }
    }

    // ============================================
    // === STAGE 2 BOSS: ASTEROID BASE ===
    // ============================================
    boss2Phase1(boss: Boss, dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 0.5) * 100;
        boss.y = 50 + Math.sin(boss.timer * 2) * 80; // Bouncing up and down
        
        // Spread of heavy slow bullets
        if (boss.timer % 0.6 < 0.1) {
            for (let i = 0; i < 5; i++) {
                boss.fireAngle(Math.PI / 2 + (Math.random() - 0.5) * 1.5, 150);
            }
        }
    }
    boss2Phase2(boss: Boss, dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 1.5) * 150;
        boss.y = 20 + Math.abs(Math.sin(boss.timer * 3) * 120);
        
        if (boss.timer % 0.3 < 0.1) {
            boss.fireAtPlayer(250 + Math.random() * 100);
        }
    }

    // ============================================
    // === STAGE 3 BOSS: GROUND FORTRESS CORE ===
    // ============================================
    boss3Phase1(boss: Boss, _dt: number) {
        // Moves very little, heavily armored feel
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.cos(boss.timer * 0.5) * 50;
        
        // Sine wave bullet streams
        const waveAngle = Math.PI / 2 + Math.sin(boss.timer * 5) * 0.8;
        if (boss.timer % 0.1 < 0.05) {
            boss.fireAngle(waveAngle, 200);
        }
        // Occasional aimed missiles
        if (boss.timer % 2.0 < 0.1) {
            for (let i=0; i<3; i++) boss.fireAtPlayer(400); 
        }
    }
    boss3Phase2(boss: Boss, dt: number) {
        boss.y = 50;
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 3) * 200;
        
        // Crossing streams
        if (boss.timer % 0.15 < 0.05) {
            boss.fireAngle(Math.PI / 2 - 0.5, 300);
            boss.fireAngle(Math.PI / 2 + 0.5, 300);
        }
        if (boss.timer % 0.5 < 0.1) {
            boss.fireAtPlayer(300);
        }
    }

    // ============================================
    // === STAGE 4 BOSS: HIGH-SPEED CARRIER ===
    // ============================================
    boss4Phase1(boss: Boss, dt: number) {
        // Very fast horizontal sweeping
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 3) * 220;
        boss.y = 30 + Math.cos(boss.timer * 4) * 20;
        
        // Dense rapid fire downwards
        if (boss.timer % 0.08 < 0.04) {
            boss.fireAngle(Math.PI / 2 + (Math.random()-0.5)*0.2, 400);
        }
    }
    boss4Phase2(boss: Boss, dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 4) * 150;
        
        // Spiral bullets
        if (boss.timer % 0.1 < 0.05) {
            const angle = boss.timer * 5;
            boss.fireAngle(angle, 250);
            boss.fireAngle(angle + Math.PI, 250);
            boss.fireAngle(angle + Math.PI/2, 250);
            boss.fireAngle(angle - Math.PI/2, 250);
        }
    }

    // ============================================
    // === STAGE 5 BOSS: MASTER CORE ===
    // ============================================
    boss5Phase1(boss: Boss, dt: number) {
        // Erratic movement
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 2.5) * 180;
        boss.y = 50 + Math.cos(boss.timer * 1.5) * 100;
        
        // Starburst
        if (boss.timer % 1.0 < 0.1) {
            for (let i=0; i<12; i++) {
                boss.fireAngle((Math.PI * 2 / 12) * i + boss.timer, 200);
            }
        }
        if (boss.timer % 0.5 < 0.1) boss.fireAtPlayer(300);
    }
    boss5Phase2(boss: Boss, dt: number) {
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 5) * 50;
        boss.y = 50; // Locked in top middle
        
        // Thick lasers + aimed
        if (boss.timer % 0.2 < 0.1) {
            boss.fireAngle(Math.PI/2 - 0.3, 400);
            boss.fireAngle(Math.PI/2 + 0.3, 400);
            boss.fireAngle(Math.PI/2 - 0.6, 400);
            boss.fireAngle(Math.PI/2 + 0.6, 400);
        }
        if (boss.timer % 0.8 < 0.1) {
             for (let i=0; i<5; i++) boss.fireAtPlayer(350); // fast burst
        }
    }
    boss5Phase3(boss: Boss, dt: number) {
        // Desperation move
        boss.x = (boss.engine.width / 2 - boss.width / 2) + Math.sin(boss.timer * 6) * 200;
        boss.y = 20 + Math.abs(Math.cos(boss.timer * 5) * 150);
        
        if (boss.timer % 0.05 < 0.05) {
             boss.fireAngle(Math.PI / 2 + Math.sin(boss.timer * 10) * 1.5, 300);
             boss.fireAngle(Math.PI / 2 + Math.sin(boss.timer * 10 + Math.PI) * 1.5, 300);
        }
        if (boss.timer % 0.4 < 0.1) {
             boss.fireAtPlayer(450);
        }
    }
}
`;

const regex = /export class Boss extends Enemy \{[\s\S]*$/;
const updatedContent = fileContent.replace(regex, newBossCode);

fs.writeFileSync(filePath, updatedContent);
console.log('Successfully updated EnemyTypes.ts');
