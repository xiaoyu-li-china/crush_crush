import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ObjectPool } from '../../src/core/pool/ObjectPool';
import { assertNever, clamp, createSeededRandom } from '../../src/core/utils/math';

describe('clamp / seeded random / assertNever', () => {
  it('clamp 下界、上界、区间内', () => {
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(11, 0, 10), 10);
    assert.equal(clamp(4, 0, 10), 4);
  });

  it('相同 seed 随机序列可复现', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    assert.deepEqual(seqA, seqB);
    assert.ok(seqA.every((n) => n >= 0 && n < 1));
  });

  it('assertNever 抛出', () => {
    assert.throws(() => assertNever('x' as never), /Unexpected value: x/);
  });
});

describe('ObjectPool', () => {
  it('acquire 空池 create；release 超过 max 丢弃；drain 清空', () => {
    let created = 0;
    const pool = new ObjectPool(
      {
        create: () => {
          created += 1;
          return { n: created };
        },
        reset: (item) => {
          item.n = 0;
        },
      },
      1,
      1,
    );
    assert.equal(pool.size(), 1);
    const first = pool.acquire();
    assert.equal(pool.size(), 0);
    const second = pool.acquire();
    assert.equal(created, 2);
    pool.release(first);
    pool.release(second);
    assert.equal(pool.size(), 1);
    assert.equal(first.n, 0);
    pool.drain();
    assert.equal(pool.size(), 0);
  });
});
