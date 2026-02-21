export async function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

export async function processSprite({
    src,
    crop = null,
    removeBg = false,
    rotate180 = false
}: {
    src: string,
    crop?: { x: number, y: number, w: number, h: number } | null,
    removeBg?: boolean,
    rotate180?: boolean
}): Promise<HTMLImageElement> {
    const img = await loadImage(src);
    const canvas = document.createElement('canvas');
    const cw = crop ? img.width * crop.w : img.width;
    const ch = crop ? img.height * crop.h : img.height;
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext('2d');
    if (!ctx) return img;

    // 回転
    if (rotate180) {
        ctx.translate(cw / 2, ch / 2);
        ctx.rotate(Math.PI);
        ctx.translate(-cw / 2, -ch / 2);
    }

    // クロップして描画
    const sx = crop ? img.width * crop.x : 0;
    const sy = crop ? img.height * crop.y : 0;
    const sw = crop ? img.width * crop.w : img.width;
    const sh = crop ? img.height * crop.h : img.height;

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);

    // 透過処理（左上のピクセルを背景色として抜く）
    if (removeBg) {
        const imageData = ctx.getImageData(0, 0, cw, ch);
        const data = imageData.data;
        // 左上の端の色を取得（アンチエイリアスを避けるため完全に角）
        const bgR = data[0], bgG = data[1], bgB = data[2];

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // 背景色との距離を計算（許容誤差を持たせる）
            const dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);

            // AI生成画像特有の圧縮ノイズを吸収するため閾値を大幅に上げる
            let tolerance = 120;
            if (bgR < 40 && bgG < 40 && bgB < 40) tolerance = 180; // 黒背景
            if (bgR > 200 && bgG > 200 && bgB > 200) tolerance = 180; // 白背景
            if (bgR < 50 && bgG > 200 && bgB < 50) tolerance = 180; // 緑背景(クロマキー)

            if (dist < tolerance) {
                // 完全透過
                data[i + 3] = 0;
            } else if (dist < tolerance + 80) {
                // 境界の半透明化（アンチエイリアスのジャギを減らす）
                data[i + 3] = Math.max(0, Math.min(255, (dist - tolerance) * 3));
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    const finalImg = new Image();
    return new Promise((resolve) => {
        finalImg.onload = () => resolve(finalImg);
        finalImg.src = canvas.toDataURL();
    });
}
