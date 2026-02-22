export const WeaponType = {
    Normal: 1, // Default weak shot
    Laser: 2,
    Wide: 3
} as const;
export type TWeaponType = typeof WeaponType[keyof typeof WeaponType];

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
    bitLevel: number = 0; // 0 to 3
}
