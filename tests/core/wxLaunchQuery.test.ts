import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  normalizeWxQuery,
  readWxLaunchQuery,
} from '../../src/core/utils/wxLaunchQuery';

describe('wxLaunchQuery', () => {
  it('规范化 query，进入参数覆盖冷启动', () => {
    assert.deepEqual(normalizeWxQuery({ inviter: 'ABC', from: 'lobby' }), {
      inviter: 'ABC',
      from: 'lobby',
    });
    assert.deepEqual(normalizeWxQuery(null), {});
    (globalThis as unknown as { wx: Wx }).wx = {
      createCanvas: () => ({}) as WxCanvas,
      createImage: () => ({}) as WxImage,
      onTouchStart() {},
      onTouchMove() {},
      onTouchEnd() {},
      onTouchCancel() {},
      offTouchStart() {},
      offTouchMove() {},
      offTouchEnd() {},
      offTouchCancel() {},
      getLaunchOptionsSync: () => ({ query: { inviter: 'OLDCODE1', from: 'lobby' } }),
      getEnterOptionsSync: () => ({ query: { inviter: 'NEWCODE2' } }),
    } as Wx;
    assert.deepEqual(readWxLaunchQuery(), {
      inviter: 'NEWCODE2',
      from: 'lobby',
    });
  });
});
