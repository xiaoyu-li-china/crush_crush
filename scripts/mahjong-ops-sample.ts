/**
 * 运维 / CI：按运营配置抽检关卡可解性（默认每 50 关 + 第 1 关）。
 * 用法：npm run mahjong:ops-sample
 */
import { MAHJONG_BASE_SLOTS } from '../src/logic/mahjong/MahjongConfig';
import { generateMahjongLevel, verifySolvablePile } from '../src/logic/mahjong/MahjongGenerator';
import { getMahjongOpsVersion, shouldMahjongOpsSampleLevel } from '../src/logic/mahjong/MahjongOpsConfig';

const maxLevel = Number(process.env.MAHJONG_MAX_LEVEL ?? 3000);
const playerKey = process.env.MAHJONG_PLAYER_KEY ?? 'ops-audit';

let checked = 0;
let failed = 0;
const failures: { level: number; seed: number; typeCount: number }[] = [];

for (let level = 1; level <= maxLevel; level += 1) {
  if (!shouldMahjongOpsSampleLevel(level)) {
    continue;
  }
  checked += 1;
  const gen = generateMahjongLevel(level, playerKey);
  const ok = verifySolvablePile(gen.pile, MAHJONG_BASE_SLOTS);
  if (!ok) {
    failed += 1;
    failures.push({ level, seed: gen.seed, typeCount: gen.typeCount });
  }
}

console.info(
  `[mahjong-ops-sample] opsVersion=${getMahjongOpsVersion()} levels=1..${maxLevel} checked=${checked} failed=${failed}`,
);
if (failures.length > 0) {
  console.error(JSON.stringify(failures.slice(0, 20), null, 2));
  process.exit(1);
}
