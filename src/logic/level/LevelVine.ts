/**
 * 藤蔓关卡节点：每 5 关一个节点，通关本节点全部关卡后解锁下一节点。
 */
export const LEVELS_PER_VINE_NODE = 5;

export interface VineNodeInfo {
  /** 从 0 起的节点序号 */
  nodeIndex: number;
  /** 本节点起始关卡 id（含） */
  startLevelId: number;
  /** 本节点结束关卡 id（含） */
  endLevelId: number;
  /** 本节点关卡 id 列表（最多 5 个，受总关卡数截断） */
  levelIds: number[];
  /** 是否已解锁本节点（前一节点 5 关全通，或首节点） */
  unlocked: boolean;
  /** 本节点已通关数 */
  clearedInNode: number;
}

/**
 * 当前应展示的藤蔓节点：进行中的节点；若刚好通关整节点则展示下一节点。
 * @param highestLevelId - 当前可挑战的最高关（已通关 + 1）
 * @param totalLevels - 配置表总关数
 */
export function getActiveVineNode(
  highestLevelId: number,
  totalLevels: number,
): VineNodeInfo {
  const cleared = Math.max(0, Math.min(totalLevels, highestLevelId - 1));
  // 刚通完第 5/10/… 关时，切到下一节点；否则停留在含「下一可玩关」的节点
  const focusLevel = Math.min(totalLevels, Math.max(1, highestLevelId));
  let nodeIndex = Math.floor((focusLevel - 1) / LEVELS_PER_VINE_NODE);
  const maxNode = Math.max(0, Math.ceil(totalLevels / LEVELS_PER_VINE_NODE) - 1);
  nodeIndex = Math.min(nodeIndex, maxNode);

  const startLevelId = nodeIndex * LEVELS_PER_VINE_NODE + 1;
  const endLevelId = Math.min(totalLevels, startLevelId + LEVELS_PER_VINE_NODE - 1);
  const levelIds: number[] = [];
  for (let id = startLevelId; id <= endLevelId; id += 1) {
    levelIds.push(id);
  }

  const clearedInNode = levelIds.filter((id) => id < highestLevelId).length;
  const unlocked = nodeIndex === 0 || cleared >= nodeIndex * LEVELS_PER_VINE_NODE;

  return {
    nodeIndex,
    startLevelId,
    endLevelId,
    levelIds,
    unlocked,
    clearedInNode,
  };
}

/**
 * 指定节点的 5 关（含未到的锁定关）。
 */
export function getVineNodeAt(
  nodeIndex: number,
  highestLevelId: number,
  totalLevels: number,
): VineNodeInfo {
  const maxNode = Math.max(0, Math.ceil(totalLevels / LEVELS_PER_VINE_NODE) - 1);
  const idx = Math.max(0, Math.min(nodeIndex, maxNode));
  const cleared = Math.max(0, Math.min(totalLevels, highestLevelId - 1));
  const startLevelId = idx * LEVELS_PER_VINE_NODE + 1;
  const endLevelId = Math.min(totalLevels, startLevelId + LEVELS_PER_VINE_NODE - 1);
  const levelIds: number[] = [];
  for (let id = startLevelId; id <= endLevelId; id += 1) {
    levelIds.push(id);
  }
  const clearedInNode = levelIds.filter((id) => id < highestLevelId).length;
  const unlocked = idx === 0 || cleared >= idx * LEVELS_PER_VINE_NODE;
  return {
    nodeIndex: idx,
    startLevelId,
    endLevelId,
    levelIds,
    unlocked,
    clearedInNode,
  };
}

/**
 * 总关数对应的段数：每 5 关一页，后续加关自动多一页。
 */
export function vineNodeCount(totalLevels: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalLevels) / LEVELS_PER_VINE_NODE));
}

/**
 * 大厅地图：从第 1 段树到当前段（含）。
 */
export function listVineNodesThrough(
  highestLevelId: number,
  totalLevels: number,
): VineNodeInfo[] {
  const active = getActiveVineNode(highestLevelId, totalLevels);
  const out: VineNodeInfo[] = [];
  for (let i = 0; i <= active.nodeIndex; i += 1) {
    out.push(getVineNodeAt(i, highestLevelId, totalLevels));
  }
  return out;
}

/**
 * 大厅地图：配置表里的每一段都列出来，未解锁也能上滑看到。
 */
export function listAllVineNodes(
  highestLevelId: number,
  totalLevels: number,
): VineNodeInfo[] {
  const count = vineNodeCount(totalLevels);
  const out: VineNodeInfo[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(getVineNodeAt(i, highestLevelId, totalLevels));
  }
  return out;
}

/**
 * 关卡是否可进入。
 */
export function isLevelPlayable(levelId: number, highestLevelId: number): boolean {
  return levelId >= 1 && levelId <= highestLevelId;
}

/** 正式包按进度；预览包（开发/体验）可进配置表内任意关。 */
export function isLevelUnlockedForPlayer(
  levelId: number,
  highestLevelId: number,
  totalLevels: number,
  previewUnlockAll: boolean,
): boolean {
  if (levelId < 1 || levelId > totalLevels) {
    return false;
  }
  if (previewUnlockAll) {
    return true;
  }
  return isLevelPlayable(levelId, highestLevelId);
}
