export const WeaponType = {
    Normal: 1, // Default weak shot
    Laser: 2,
    Wide: 3
} as const;
export type TWeaponType = typeof WeaponType[keyof typeof WeaponType];

// =====================================================================
// Weapon damage design — SINGLE SOURCE OF TRUTH
// =====================================================================
// Attack power is decided by each weapon's inherent traits on two axes,
// NOT by ad-hoc numbers. Validate any change with:  node tools/weapon-dps.mjs
//
//   DEPTH   = single-target DPS      (how fast you melt ONE target)
//   BREADTH = distinct enemies/sec   (how many SEPARATE targets you tag)
//
// Scaling rule derived from traits:
//   - Single-projectile / no-spread / no-auto-aim weapons (LASER) can only
//     grow by DAMAGE, so their per-hit damage scales with level. Laser also
//     PIERCES (each enemy hit once, frame-rate independent) → owns vertical
//     column clear and single-target DEPTH.
//   - Multi-projectile / spread / auto-aim weapons (NORMAL/WIDE/HOMING) grow by
//     PROJECTILE COUNT, so per-hit damage stays 1 and coverage/uptime scales.
//     WIDE owns horizontal BREADTH; HOMING is a low-DPS auto-aim convenience
//     bonus layered on top of the main weapon.
//
// Role ranking the numbers below must preserve:
//   DEPTH:   Laser > Normal > Wide,   HOMING is a small additive bonus
//   BREADTH: Wide (horizontal) / Laser (vertical, via pierce) > Normal
//
// Per-level (L1,L2,L3) per-hit damage:
export const WEAPON_DESIGN: Record<TWeaponType, { damage: [number, number, number] }> = {
    [WeaponType.Normal]: { damage: [1, 1, 1] }, // scales via bullet count 1/2/3
    [WeaponType.Laser]:  { damage: [3, 5, 7] }, // single beam scales via damage + width; pierces
    [WeaponType.Wide]:   { damage: [1, 1, 1] }, // scales via spread count 3/5/5 (+ wider angle)
};

// Homing sub-weapon: auto-aim convenience bonus, scales via missile count 2/4/6.
export const HOMING_DAMAGE = 1;

// Per-hit damage for the given main weapon type and level (1..3).
export function getMainDamage(type: TWeaponType, level: number): number {
    const d = WEAPON_DESIGN[type]?.damage;
    if (!d) return 1;
    const i = Math.max(1, Math.min(level, d.length)) - 1;
    return d[i];
}

export const SubWeaponType = {
    None: 0,
    Homing: 1,
    Bit: 2
} as const;
export type TSubWeaponType = typeof SubWeaponType[keyof typeof SubWeaponType];

export const POWERUP_SLOTS = [
    { id: 0, name: "LASER" },    // メイン武器: レーザー
    { id: 1, name: "WIDE" },     // メイン武器: ワイド
    { id: 2, name: "HOMING" },   // サブウェポン: ホーミング
    { id: 3, name: "BIT" },      // サブウェポン: ビット
    { id: 4, name: "SHIELD" },   // シールド追加
    { id: 5, name: "BOMB" },     // ボムストック増加
];

export class WeaponState {
    type: TWeaponType = WeaponType.Normal;
    level: number = 1; // 1 to 3

    // Sub-weapons can now be combined
    hasHoming: boolean = false;
    homingLevel: number = 0; // 0 to 3

    hasBits: boolean = false;
    bitLevel: number = 0; // 0 to 5
}
