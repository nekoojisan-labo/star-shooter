// Weapon balance instrument (mirrors the source-of-truth model).
// Judges damage numbers against each weapon's DESIGN ROLE on two axes:
//   DEPTH  = single-target DPS       (how fast you melt ONE target)
//   BREADTH= distinct enemies/second (how many SEPARATE targets you tag)
// These are different axes on purpose: Laser owns depth, Wide owns breadth.
//
// Run: node tools/weapon-dps.mjs
const MAIN_RATE = 1 / 0.12;   // 8.33 shots/sec (main weapon)
const SUB_RATE  = 1 / 1.2;    // 0.83 shots/sec (homing sub)

// Per-bullet damage reflects the trait trade-off:
//   single projectile / no spread / no auto-aim -> scale by DAMAGE (Laser)
//   many projectiles / spread / auto-aim        -> scale by COUNT, keep dmg=1
const MODEL = {
  Normal: { role: 'balanced starter', pierce: false,
    levels: [ {bullets:1, dmg:1}, {bullets:2, dmg:1}, {bullets:3, dmg:1} ] },
  Laser:  { role: 'single-target / column pierce', pierce: true,
    levels: [ {bullets:1, dmg:3}, {bullets:1, dmg:5}, {bullets:1, dmg:7} ] },
  Wide:   { role: 'crowd control / horizontal area', pierce: false,
    levels: [ {bullets:3, dmg:1}, {bullets:5, dmg:1}, {bullets:5, dmg:1} ] },
  Homing: { role: 'sub: auto-aim convenience bonus', pierce: false, sub: true,
    levels: [ {bullets:2, dmg:1}, {bullets:4, dmg:1}, {bullets:6, dmg:1} ] },
};
const rate = w => MODEL[w].sub ? SUB_RATE : MAIN_RATE;

// DEPTH: single large target. Fraction of projectiles that connect:
//   forward/pierce/homing converge on it; Wide's spread mostly diverges (center + ~1).
const singleHits = (w, L) => w === 'Wide' ? 1 : L.bullets;
function depthDPS(w, lvl){ const L = MODEL[w].levels[lvl]; return singleHits(w,L) * L.dmg * rate(w); }

// BREADTH: how many DISTINCT enemies can be tagged per second.
//   Wide: spread -> up to `bullets` separate lanes. Homing: auto-distributes.
//   Laser: 1 narrow lane (but see vertical pierce). Normal: 1 lane.
function breadthHorizontal(w, lvl){
  const L = MODEL[w].levels[lvl];
  let lanes;
  if (w === 'Wide' || w === 'Homing') lanes = L.bullets;   // spread / auto-spread
  else lanes = 1;                                          // single column
  return lanes * rate(w);                                  // distinct enemies / sec
}
//   Vertical column of stacked enemies: pierce tags the whole column.
function breadthVertical(w, lvl){
  const L = MODEL[w].levels[lvl];
  let stacked;
  if (MODEL[w].pierce) stacked = 99;                       // laser pierces all in line
  else if (w === 'Homing') stacked = L.bullets;
  else stacked = 1;
  return stacked * rate(w);
}

const weapons = Object.keys(MODEL);
const fmt = n => (n>=99? '  ALL' : n.toFixed(1).padStart(6));
console.log('ROLE:');
for (const w of weapons) console.log(`  ${w.padEnd(7)} - ${MODEL[w].role}${MODEL[w].pierce?' [PIERCE]':''}`);
const table = (title, fn) => {
  console.log(`\n${title}`);
  console.log('  weapon   |   L1 |   L2 |   L3');
  for (const w of weapons) console.log(`  ${w.padEnd(8)} |${fmt(fn(w,0))}|${fmt(fn(w,1))}|${fmt(fn(w,2))}`);
};
table('DEPTH  - single-target DPS (Laser should own this):', depthDPS);
table('BREADTH- horizontal spread, distinct enemies/sec (Wide should own):', breadthHorizontal);
table('BREADTH- vertical column, distinct enemies/sec (Laser pierce owns):', (w,l)=>breadthVertical(w,l));

console.log('\nINVARIANT CHECKS:');
let ok = true;
const check = (name, cond) => { console.log(`  [${cond?'PASS':'FAIL'}] ${name}`); ok = ok && cond; };
for (let l=0;l<3;l++) check(`Laser L${l+1} owns DEPTH (top single-target)`,
  ['Normal','Wide'].every(o=>depthDPS('Laser',l) > depthDPS(o,l)));
check('Wide owns BREADTH horizontal at every level',
  [0,1,2].every(l => ['Normal','Laser'].every(o=>breadthHorizontal('Wide',l) >= breadthHorizontal(o,l))));
check('Laser owns BREADTH vertical (pierce) at max level',
  breadthVertical('Laser',2) >= Math.max(...['Normal','Wide'].map(w=>breadthVertical(w,2))));
for (const w of weapons) check(`${w} DEPTH monotonic (no downgrade)`,
  depthDPS(w,0)<=depthDPS(w,1) && depthDPS(w,1)<=depthDPS(w,2));
check('Homing stays a low-DPS bonus (< Normal single-target) at max',
  depthDPS('Homing',2) < depthDPS('Normal',2));
console.log(`\nRESULT: ${ok ? 'ALL INVARIANTS PASS' : 'INVARIANT VIOLATION'}`);
process.exit(ok?0:1);
