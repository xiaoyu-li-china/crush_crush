import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listAllVineNodes, listVineNodesThrough } from '../../src/logic/level/LevelVine';
import {
  isCandyHouseLevel,
  isLobbyNodeExposed,
  isLobbyNodeOnScreen,
  layoutLobbyLevelNodes,
  layoutLobbyMoreLevelsHint,
  lobbyCamFromDrag,
  lobbyCameraMax,
  lobbyCameraTarget,
  lobbyCaptionY,
  lobbyLadderPathPoints,
  lobbyLadderSideTrailPoints,
  lobbyLadderSlot,
  lobbyLadderStep,
  lobbyLayerHeight,
  lobbyLevelHitRect,
  lobbyMaxPageIndex,
  lobbyComingSoonLine,
  lobbyPageCaption,
  lobbyPageIndex,
  lobbyPageOriginY,
  lobbySnapCamY,
  lobbySnapEase,
  lobbySnapTarget,
  lobbyMacaronRadius,
  lobbyHouseRadius,
  lobbySwipeHintOpacity,
  lobbyBrandAnchorY,
  lobbyLevelBandTop,
  lobbyLadderStepForBand,
  lobbyFirstScreenLadderLayout,
  lobbyBarSize,
  LOBBY_BRAND_TITLE,
  LOBBY_BRAND_SUBTITLE,
  LOBBY_FIRST_SCREEN_LEVELS,
  LOBBY_MORE_LEVELS_HINT,
  LOBBY_SUBTITLE_UY,
  LOBBY_SWIPE_HINT_FADE_MS,
  LOBBY_SWIPE_HINT_HOLD_MS,
  LOBBY_TITLE_UY,
  LOBBY_TREE_PROMPT,
  LEVELS_PER_CANDY_HOUSE,
} from '../../src/presentation/ui/LobbyLevelMap';

describe('LobbyLevelMap 糖果梯子', () => {
  it('1-20 沿梯子由低向高排布，左右交替编号圆', () => {
    const height = 800;
    const cover = { dx: 0, dy: 0, dw: 400, dh: height };
    const nodes = layoutLobbyLevelNodes({
      vines: listAllVineNodes(1, 20),
      cover,
      width: 400,
      height,
      camY: 0,
      ladderBottomY: 640,
    });
    assert.equal(nodes.length, 20);
    assert.deepEqual(
      nodes.map((n) => n.levelId),
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    // 低关在下、高关在上
    assert.ok(nodes[0]!.y > nodes[19]!.y);
    for (let i = 1; i < 19; i += 1) {
      assert.ok(nodes[i]!.y < nodes[i - 1]!.y);
      assert.ok(nodes[i]!.y > nodes[i + 1]!.y);
    }
    assert.equal(nodes[0]!.kind, 'ladder');
    assert.equal(nodes[19]!.kind, 'candy-house');
    assert.equal(nodes[0]!.circleSide, 'right');
    assert.equal(nodes[1]!.circleSide, 'left');
    // 之字错位：右糖条偏右，左糖条偏左
    assert.ok(nodes[0]!.barX > nodes[1]!.barX);
    assert.ok(nodes[0]!.barW > 180);
    assert.ok(nodes[0]!.barW < 240);
    assert.ok(nodes[0]!.barH >= 32);
    assert.ok(nodes[0]!.hitR > 16);
    assert.ok(lobbyMacaronRadius(400) < 28);
    assert.ok(lobbyHouseRadius(400) > lobbyMacaronRadius(400));
  });

  it('camY 增大时整列下移，可承接更高关与无限滑动', () => {
    const height = 800;
    const cover = { dx: 0, dy: 0, dw: 400, dh: height };
    const at0 = layoutLobbyLevelNodes({
      vines: listAllVineNodes(1, 22),
      cover,
      width: 400,
      height,
      camY: 0,
      ladderBottomY: 640,
    });
    const atLift = layoutLobbyLevelNodes({
      vines: listAllVineNodes(1, 22),
      cover,
      width: 400,
      height,
      camY: height,
      ladderBottomY: 640,
    });
    assert.equal(at0.length, 22);
    assert.ok(at0.every((n, i) => Math.abs(atLift[i]!.y - (n.y + height)) < 0.5));
    assert.ok(at0.filter((n) => n.y < -40).length >= 5);
    const onScreenHigh = atLift.filter(
      (n) => isLobbyNodeOnScreen(n, height) && n.levelId >= 12,
    );
    assert.ok(onScreenHigh.length >= 3);
    assert.ok(lobbyCameraMax(22, height) > lobbyCameraMax(20, height));
    assert.ok(lobbyCameraMax(40, height) > lobbyCameraMax(22, height));
  });

  it('第 20 关为糖果屋，路径点按关号升序', () => {
    assert.equal(LEVELS_PER_CANDY_HOUSE, 20);
    assert.equal(isCandyHouseLevel(20), true);
    assert.equal(isCandyHouseLevel(40), true);
    assert.equal(isCandyHouseLevel(19), false);
    const height = 800;
    const nodes = layoutLobbyLevelNodes({
      vines: listAllVineNodes(1, 20),
      cover: { dx: 0, dy: 0, dw: 400, dh: height },
      width: 400,
      height,
      camY: height * 1.2,
      ladderBottomY: 640,
    });
    const pts = lobbyLadderPathPoints(nodes, height, 120);
    assert.ok(pts.length >= 2);
    for (let i = 1; i < pts.length; i += 1) {
      assert.ok(pts[i]!.levelId > pts[i - 1]!.levelId);
    }
    const house = nodes.find((n) => n.levelId === 20);
    assert.equal(house?.kind, 'candy-house');
  });

  it('梯子左右摆幅落在安全边距内', () => {
    for (let id = 1; id <= 40; id += 1) {
      const slot = lobbyLadderSlot(id);
      assert.ok(slot.ux >= 0.18 && slot.ux <= 0.82);
      assert.equal(slot.uy, id - 1);
    }
  });

  it('糖点轨分布在列表左右两侧，不再走中轴', () => {
    const height = 800;
    const width = 400;
    const nodes = layoutLobbyLevelNodes({
      vines: listAllVineNodes(1, 10),
      cover: { dx: 0, dy: 0, dw: width, dh: height },
      width,
      height,
      camY: 0,
      ladderBottomY: 640,
    });
    const pts = lobbyLadderSideTrailPoints(nodes, height);
    assert.ok(pts.length >= 8);
    const xs = [...new Set(pts.map((p) => Math.round(p.x * 10) / 10))];
    assert.ok(xs.length >= 2);
    const mid = width * 0.5;
    assert.ok(xs.some((x) => x < mid - 20));
    assert.ok(xs.some((x) => x > mid + 20));
    assert.ok(pts.every((p) => Math.abs(p.x - mid) > 20));
  });

  it('首屏 camY=0 约展示 1–8 关，并与底栏留出间距', () => {
    const height = 800;
    const width = 400;
    const cover = { dx: 0, dy: 0, dw: width, dh: height };
    const statusBar = 47;
    const contentTop = height - 36 - 24;
    const titleBandTop = lobbyLevelBandTop(cover, statusBar);
    const { h: barH } = lobbyBarSize(width, height);
    const { ceiling, step, bandTop: hideAbove } = lobbyFirstScreenLadderLayout({
      bandTop: titleBandTop,
      contentTop,
      barH,
    });
    // 第 1 关条底约在底栏上方 10px
    const barBottom = ceiling + barH * 0.5;
    assert.ok(Math.abs(barBottom - (contentTop - 10)) < 1);
    assert.ok(barBottom <= contentTop - 8);
    const nodes = layoutLobbyLevelNodes({
      vines: listAllVineNodes(1, 20),
      cover,
      width,
      height,
      camY: 0,
      ladderBottomY: ceiling,
      ladderStep: step,
    });
    const exposed = nodes.filter((n) =>
      isLobbyNodeExposed(n, 0, height, contentTop, hideAbove),
    );
    assert.deepEqual(
      exposed.map((n) => n.levelId),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.equal(LOBBY_FIRST_SCREEN_LEVELS, 8);
    assert.ok(step > barH);
    // 上方裁切线相对标题区不变（仅小幅 topInset）
    assert.ok(hideAbove >= titleBandTop);
    assert.ok(hideAbove <= titleBandTop + 12);
  });

  it('未解锁的后续关也能上滑预览', () => {
    const height = 800;
    const vines = listVineNodesThrough(3, 20);
    // listVineNodesThrough 只到当前段；大厅用 listAllVineNodes
    const all = listAllVineNodes(3, 20);
    assert.ok(all.length > vines.length);
    const nodes = layoutLobbyLevelNodes({
      vines: all,
      cover: { dx: 0, dy: 0, dw: 400, dh: height },
      width: 400,
      height,
      camY: 0,
      ladderBottomY: 640,
    });
    assert.equal(nodes.length, 20);
  });

  it('关卡热区覆盖整条含数字圆与云朵', () => {
    const node = {
      levelId: 1,
      nodeIndex: 0,
      slotIndex: 0,
      x: 320,
      y: 400,
      hitR: 24,
      kind: 'ladder' as const,
      barX: 80,
      barY: 372,
      barW: 240,
      barH: 56,
      circleSide: 'right' as const,
      circleR: 28,
    };
    const hit = lobbyLevelHitRect(node);
    assert.ok(hit.x < node.barX);
    assert.ok(hit.x + hit.w > node.barX + node.barW);
    assert.ok(hit.y <= node.barY);
    assert.ok(hit.h >= node.barH);
  });

  it('导航遮挡区以下、标题区以上的关卡不暴露', () => {
    const node = {
      levelId: 1,
      nodeIndex: 0,
      slotIndex: 0,
      x: 200,
      y: 700,
      hitR: 20,
      kind: 'ladder' as const,
      barX: 40,
      barY: 670,
      barW: 320,
      barH: 60,
      circleSide: 'right' as const,
      circleR: 30,
    };
    assert.equal(isLobbyNodeExposed(node, 0, 800), true);
    assert.equal(isLobbyNodeExposed(node, 0, 800, 600), false);
    assert.equal(
      isLobbyNodeExposed({ ...node, barY: 40, y: 70 }, 0, 800, undefined, 120),
      false,
    );
    assert.equal(
      isLobbyNodeExposed({ ...node, barY: 200, y: 230 }, 0, 800, undefined, 120),
      true,
    );
  });

  it('大厅文案改成糖果梯子 / 糖果屋', () => {
    assert.equal(LOBBY_TREE_PROMPT, '沿糖果梯子闯关，冲进糖果屋！');
    assert.equal(LOBBY_MORE_LEVELS_HINT, '上滑闯关');
    assert.equal(LOBBY_BRAND_TITLE, '萌宠粉碎消');
    assert.equal(LOBBY_BRAND_SUBTITLE, '闯关消除 · 可爱小动物');
    assert.ok(lobbyPageCaption(3, 20).includes('糖果屋') || lobbyPageCaption(3, 20).includes('关'));
    assert.equal(lobbyComingSoonLine(lobbyMaxPageIndex(20), 20), '20关后有新玩法，敬请期待');
  });

  it('lobby caption sits below the brand area on the first screen', () => {
    const cover = { dx: 0, dy: 0, dw: 400, dh: 800 };
    assert.ok(lobbyCaptionY(cover, 0, 800, 0) > 800 * 0.55);
    assert.equal(lobbyCaptionY(cover, 800, 800, 1), 800 * 0.16);
  });

  it('树屏品牌文案锚在原标题位置且不随翻页移动', () => {
    const cover = { dx: 0, dy: -20, dw: 400, dh: 1024 };
    assert.equal(lobbyBrandAnchorY(cover, 0, LOBBY_TITLE_UY), -20 + 92);
    assert.equal(lobbyBrandAnchorY(cover, 0, LOBBY_SUBTITLE_UY), -20 + 142);
    assert.equal(
      lobbyBrandAnchorY(cover, 400, LOBBY_TITLE_UY),
      lobbyBrandAnchorY(cover, 0, LOBBY_TITLE_UY),
    );
    assert.ok(LOBBY_TITLE_UY < LOBBY_SUBTITLE_UY);
  });

  it('连续滑动软吸附落在步长网格内', () => {
    const height = 800;
    const step = lobbyLadderStep(height);
    const maxCam = lobbyCameraMax(20, height);
    const target = lobbySnapTarget(0, 200, height, maxCam, 0.8);
    assert.ok(target > 0);
    assert.ok(target <= maxCam);
    assert.ok(Math.abs(target / step - Math.round(target / step)) < 1e-6);
    assert.equal(lobbySnapTarget(0, 40, height, maxCam, 0), 0);
  });

  it('page origins 在梯子模式下恒为 0', () => {
    assert.equal(lobbyPageOriginY(0, 0, 800), 0);
    assert.equal(lobbyPageOriginY(1, 400, 800), 0);
    assert.equal(lobbyPageOriginY(2, 1200, 800), 0);
  });

  it('snap easing finishes in a short duration', () => {
    assert.equal(lobbySnapCamY(0, 800, 0), 0);
    assert.ok(lobbySnapCamY(0, 800, 80) > 400);
    assert.equal(lobbySnapCamY(0, 800, 220), 800);
  });

  it('lobbyCamFromDrag 上滑增加 camY，并限制在范围内', () => {
    assert.equal(lobbyCamFromDrag(0, -100, 0, 800, 0), 100);
    assert.equal(lobbyCamFromDrag(800, 100, 0, 800, 0), 700);
    assert.equal(lobbyCamFromDrag(0, 80, 0, 800, 48), -48);
  });

  it('吸附/可见性边界：时长 0、页 0 文案、屏外节点', () => {
    assert.equal(lobbySnapCamY(0, 800, 10, 0), 800);
    assert.equal(lobbySnapCamY(0, 800, -1), 0);
    assert.equal(lobbySnapEase(-1), 0);
    assert.equal(lobbySnapEase(2), 1);
    assert.equal(lobbyPageCaption(0), '');
    assert.equal(lobbyLayerHeight(800), 800);
    assert.ok(lobbyCameraTarget(12, 800) > 0);
    assert.equal(lobbyPageIndex(0, 800), 0);
    const node = {
      levelId: 6,
      nodeIndex: 1,
      slotIndex: 0,
      x: 100,
      y: -80,
      hitR: 20,
      kind: 'ladder' as const,
      barX: 40,
      barY: -200,
      barW: 320,
      barH: 60,
      circleSide: 'left' as const,
      circleR: 30,
    };
    assert.equal(isLobbyNodeOnScreen(node, 800, 72), false);
    assert.equal(
      isLobbyNodeOnScreen({ ...node, y: 10, barY: -20 }, 800, 72),
      true,
    );
  });

  it('更多关卡把手贴右缘，三秒后淡出，手动关闭立刻为 0', () => {
    const frame = layoutLobbyMoreLevelsHint(390, 44, 0);
    assert.ok(frame.x + frame.w > 390 - 8);
    assert.ok(frame.x > 390 / 2);
    assert.ok(frame.y > 44);
    assert.equal(lobbySwipeHintOpacity(1000, 1500, false), 1);
    assert.ok(
      lobbySwipeHintOpacity(
        1000,
        1000 + LOBBY_SWIPE_HINT_HOLD_MS + LOBBY_SWIPE_HINT_FADE_MS / 2,
        false,
      ) < 1,
    );
    assert.equal(
      lobbySwipeHintOpacity(
        1000,
        1000 + LOBBY_SWIPE_HINT_HOLD_MS + LOBBY_SWIPE_HINT_FADE_MS,
        false,
      ),
      0,
    );
    assert.equal(lobbySwipeHintOpacity(1000, 1200, true), 0);
    assert.equal(lobbySwipeHintOpacity(0, 1200, false), 0);
  });
});
