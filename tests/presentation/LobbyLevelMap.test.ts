import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listAllVineNodes, listVineNodesThrough } from '../../src/logic/level/LevelVine';
import {
  isLobbyNodeExposed,
  isLobbyNodeOnScreen,
  layoutLobbyLevelNodes,
  lobbyCamFromDrag,
  lobbyCameraMax,
  lobbyCameraTarget,
  lobbyCaptionY,
  lobbyLayerHeight,
  lobbyMaxPageIndex,
  lobbyComingSoonLine,
  lobbyPageCaption,
  lobbyPageIndex,
  lobbyPageOriginY,
  lobbySnapCamY,
  lobbySnapEase,
  lobbySnapTarget,
  lobbyMacaronRadius,
} from '../../src/presentation/ui/LobbyLevelMap';

describe('LobbyLevelMap', () => {
  it('keeps 1-5 on the first screen before clearing the node', () => {
    const vines = listVineNodesThrough(3, 20);
    const nodes = layoutLobbyLevelNodes({
      vines,
      cover: { dx: 0, dy: 0, dw: 400, dh: 800 },
      width: 400,
      height: 800,
      camY: 0,
    });
    assert.deepEqual(
      nodes.map((n) => n.levelId),
      [1, 2, 3, 4, 5],
    );
    assert.equal(nodes.every((n) => n.kind === 'tree'), true);
    assert.equal(lobbyCameraMax(0, 800), 0);
  });

  it('does not expose parked cloud levels while the tree page still covers them', () => {
    const height = 800;
    const nodes = layoutLobbyLevelNodes({
      vines: listVineNodesThrough(6, 20),
      cover: { dx: 0, dy: 0, dw: 400, dh: height },
      width: 400,
      height,
      camY: 0,
    });
    const clouds = nodes.filter((n) => n.kind === 'candy-cloud');
    assert.equal(clouds.length, 5);
    assert.ok(clouds.every((n) => n.y > 40 && n.y < height - 40));
    assert.ok(clouds.every((n) => !isLobbyNodeExposed(n, 0, height)));
    assert.ok(
      nodes.filter((n) => n.kind === 'tree').every((n) => isLobbyNodeExposed(n, 0, height)),
    );
  });

  it('after 5 clears, page 2 is candy clouds 6-10 with the tree off-screen', () => {
    const height = 800;
    const vines = listVineNodesThrough(6, 20);
    const nodes = layoutLobbyLevelNodes({
      vines,
      cover: { dx: 0, dy: 0, dw: 400, dh: height },
      width: 400,
      height,
      camY: height,
    });
    const tree = nodes.filter((n) => n.kind === 'tree');
    const clouds = nodes.filter((n) => n.kind === 'candy-cloud');
    assert.deepEqual(
      tree.map((n) => n.levelId),
      [1, 2, 3, 4, 5],
    );
    assert.deepEqual(
      clouds.map((n) => n.levelId),
      [6, 7, 8, 9, 10],
    );
    assert.equal(
      clouds.every((n) => n.kind === 'candy-cloud'),
      true,
    );
    assert.ok(tree.every((n) => n.y > height - 8));
    assert.ok(clouds.every((n) => n.y > 40 && n.y < height - 40));
    assert.equal(lobbyCameraMax(1, height), height);
    assert.equal(lobbyPageIndex(height, height), 1);
    assert.equal(clouds[0]!.hitR, tree[0]!.hitR);
    assert.equal(tree[0]!.hitR, lobbyMacaronRadius(400));
    assert.notEqual(clouds[0]!.x, tree[0]!.x);
    assert.ok(clouds[0]!.y < tree[0]!.y);
    assert.ok(clouds[4]!.y < height - 80);
  });

  it('cloud macarons sit on page-specific swirls and lift above the nav', () => {
    const height = 800;
    const cover = { dx: 0, dy: 0, dw: 400, dh: height };
    const page1 = layoutLobbyLevelNodes({
      vines: listVineNodesThrough(6, 20),
      cover,
      width: 400,
      height,
      camY: height,
    }).filter((n) => n.kind === 'candy-cloud');
    const page2 = layoutLobbyLevelNodes({
      vines: listVineNodesThrough(11, 20),
      cover,
      width: 400,
      height,
      camY: height * 2,
    }).filter((n) => n.kind === 'candy-cloud' && n.nodeIndex === 2);
    assert.equal(page1.length, 5);
    assert.equal(page1[0]!.x, 400 * 0.33);
    assert.equal(page1[1]!.y, height * 0.23);
    assert.notEqual(page1[0]!.x, page2[0]!.x);
    const lifted = layoutLobbyLevelNodes({
      vines: listVineNodesThrough(6, 20),
      cover,
      width: 400,
      height,
      camY: height,
      maxCloudCenterY: 400,
    }).filter((n) => n.kind === 'candy-cloud');
    assert.ok(lifted.every((n) => n.y <= 400));
  });

  it('scrolling a cloud page keeps macaron spacing instead of stacking on the nav', () => {
    const height = 800;
    const cover = { dx: 0, dy: 0, dw: 400, dh: height };
    const rest = layoutLobbyLevelNodes({
      vines: listAllVineNodes(1, 20),
      cover,
      width: 400,
      height,
      camY: height,
      maxCloudCenterY: 520,
    }).filter((n) => n.nodeIndex === 1);
    const sliding = layoutLobbyLevelNodes({
      vines: listAllVineNodes(1, 20),
      cover,
      width: 400,
      height,
      camY: height + 240,
      maxCloudCenterY: 520,
    }).filter((n) => n.nodeIndex === 1);
    const restYs = rest.map((n) => n.y);
    const slideYs = sliding.map((n) => n.y);
    const restSpread = Math.max(...restYs) - Math.min(...restYs);
    const slideSpread = Math.max(...slideYs) - Math.min(...slideYs);
    assert.ok(restSpread > 80);
    assert.ok(Math.abs(slideSpread - restSpread) < 1);
    assert.equal(new Set(slideYs.map((y) => Math.round(y))).size, slideYs.length);

    const peek = layoutLobbyLevelNodes({
      vines: listAllVineNodes(1, 20),
      cover,
      width: 400,
      height,
      camY: height + 280,
    }).filter((n) => n.nodeIndex === 2);
    const revealed = peek.filter((n) => isLobbyNodeExposed(n, height + 280, height));
    assert.ok(revealed.length >= 1);
    assert.ok(revealed.length < peek.length);
    assert.ok(revealed.every((n) => n.y + n.hitR * 0.55 < 280));
  });

  it('page 3 and 4 host 11-15 and 16-20 even before those nodes unlock', () => {
    const height = 800;
    const vines = listAllVineNodes(1, 20);
    const onPage = (camY: number) =>
      layoutLobbyLevelNodes({
        vines,
        cover: { dx: 0, dy: 0, dw: 400, dh: height },
        width: 400,
        height,
        camY,
      })
        .filter(
          (n) =>
            n.y > 0 &&
            n.y < height &&
            isLobbyNodeExposed(n, camY, height),
        )
        .map((n) => n.levelId);
    assert.deepEqual(
      vines.flatMap((vine) => vine.levelIds),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    );
    assert.deepEqual(onPage(0), [1, 2, 3, 4, 5]);
    assert.deepEqual(onPage(height), [6, 7, 8, 9, 10]);
    assert.deepEqual(onPage(height * 2), [11, 12, 13, 14, 15]);
    assert.deepEqual(onPage(height * 3), [16, 17, 18, 19, 20]);
    assert.equal(lobbyMaxPageIndex(20), 3);
    assert.equal(lobbyCameraMax(lobbyMaxPageIndex(20), height), height * 3);
    assert.equal(lobbyPageCaption(1), '第 6-10 关');
    assert.equal(lobbyPageCaption(2), '第 11-15 关');
    assert.equal(lobbyPageCaption(3), '第 16-20 关');
    assert.equal(lobbyComingSoonLine(2, 20), '');
    assert.equal(lobbyComingSoonLine(3, 20), '20关后有新玩法，敬请期待');
  });

  it('later extra levels get their own cloud page', () => {
    const height = 800;
    const vines = listAllVineNodes(1, 22);
    const nodes = layoutLobbyLevelNodes({
      vines,
      cover: { dx: 0, dy: 0, dw: 400, dh: height },
      width: 400,
      height,
      camY: height * 4,
    });
    assert.deepEqual(
      nodes.filter((n) => isLobbyNodeExposed(n, height * 4, height)).map((n) => n.levelId),
      [21, 22],
    );
    assert.equal(lobbyMaxPageIndex(22), 4);
    assert.equal(lobbyPageCaption(4, 22), '第 21-22 关');
    assert.equal(lobbyPageCaption(4, 21), '第 21 关');
  });

  it('lobby caption sits on the tree trunk below the macarons', () => {
    const cover = { dx: 0, dy: 0, dw: 400, dh: 800 };
    assert.equal(lobbyCaptionY(cover, 0, 800, 0), 800 * 0.645);
    assert.ok(lobbyCaptionY(cover, 0, 800, 0) > 800 * 0.55);
    assert.equal(lobbyCaptionY(cover, 800, 800, 1), 800 * 0.645);
  });

  it('snaps up to the next page after a swipe', () => {
    assert.equal(lobbySnapTarget(0, 200, 800, 1, 0.8), 800);
    assert.equal(lobbySnapTarget(0, 40, 800, 1, 0), 0);
    assert.equal(lobbySnapTarget(800, 700, 800, 1, -0.8), 0);
    assert.equal(lobbySnapTarget(800, 1000, 800, 3, 0.9), 1600);
  });

  it('cover-style page origins reveal the next page from the top', () => {
    assert.equal(lobbyPageOriginY(0, 0, 800), 0);
    assert.equal(lobbyPageOriginY(1, 0, 800), 0);
    assert.equal(lobbyPageOriginY(0, 400, 800), 400);
    assert.equal(lobbyPageOriginY(1, 400, 800), 0);
    assert.equal(lobbyPageOriginY(0, 800, 800), 800);
    assert.equal(lobbyPageOriginY(1, 800, 800), 0);
    assert.equal(lobbyPageOriginY(2, 800, 800), 0);
    assert.equal(lobbyPageOriginY(1, 1200, 800), 400);
    assert.equal(lobbyPageOriginY(2, 1200, 800), 0);
  });

  it('snap easing finishes in a short duration', () => {
    assert.equal(lobbySnapCamY(0, 800, 0), 0);
    assert.ok(lobbySnapCamY(0, 800, 80) > 400);
    assert.equal(lobbySnapCamY(0, 800, 200), 800);
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
    assert.equal(lobbyCameraTarget(2, 800), 1600);
    const node = {
      levelId: 6,
      nodeIndex: 1,
      slotIndex: 0,
      x: 100,
      y: -80,
      hitR: 32,
      kind: 'candy-cloud' as const,
    };
    assert.equal(isLobbyNodeOnScreen(node, 800, 72), false);
    assert.equal(isLobbyNodeOnScreen({ ...node, y: 10 }, 800, 72), true);
    assert.equal(isLobbyNodeExposed({ ...node, y: 400 }, 0, 800), false);
    assert.equal(isLobbyNodeExposed({ ...node, nodeIndex: 3, y: 10 }, 0, 800), false);
    assert.equal(lobbyPageOriginY(3, 0, 800), -2400);
  });
});
