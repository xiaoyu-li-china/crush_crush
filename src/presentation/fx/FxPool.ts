import { ObjectPool } from '../../core/pool/ObjectPool';
import { MatchClearFx } from './MatchClearFx';

/**
 * 特效对象池。切场景前必须 drain，防止微信环境节点泄漏。
 */
export class FxPool {
  public readonly matchClear: ObjectPool<MatchClearFx>;

  public constructor() {
    this.matchClear = new ObjectPool<MatchClearFx>(
      {
        create: () => new MatchClearFx(),
        reset: (fx) => {
          fx.reset();
        },
      },
      8,
      64,
    );
  }

  public drain(): void {
    this.matchClear.drain();
  }
}
