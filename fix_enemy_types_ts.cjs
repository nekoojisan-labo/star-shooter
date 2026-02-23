const fs = require('fs');
const filePath = 'src/game/EnemyTypes.ts';
let content = fs.readFileSync(filePath, 'utf-8');

content = content.replace(/boss[1-5]Phase[1-3]\(\s*boss:\s*Boss\s*,\s*dt:\s*number\s*\)/g, function (match) {
    return match.replace(/dt:\s*number/, '_dt: number');
});

content = content.replace(/fireAngle\(angle:\s*number,\s*speed:\s*number,\s*color:\s*string\s*=\s*'#FF0055'\)/g, "fireAngle(angle: number, speed: number, _color: string = '#FF0055')");

fs.writeFileSync(filePath, content);
console.log('Fixed TypeScript errors in EnemyTypes.ts');
