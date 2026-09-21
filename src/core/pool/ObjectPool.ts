/**
 * 与引擎无关的通用对象池，避免热点路径频繁 new。
 */
export interface PoolFactory<T> {
  create: () => T;
  reset: (item: T) => void;
}

export class ObjectPool<T> {
  private readonly free: T[] = [];
  private readonly factory: PoolFactory<T>;
  private readonly maxSize: number;

  public constructor(factory: PoolFactory<T>, initialSize = 0, maxSize = 256) {
    this.factory = factory;
    this.maxSize = maxSize;
    for (let i = 0; i < initialSize; i += 1) {
      this.free.push(factory.create());
    }
  }

  public acquire(): T {
    const item = this.free.pop();
    if (item !== undefined) {
      return item;
    }
    return this.factory.create();
  }

  public release(item: T): void {
    this.factory.reset(item);
    if (this.free.length < this.maxSize) {
      this.free.push(item);
    }
  }

  /** 切场景 / 回大厅时调用，释放池内引用。 */
  public drain(): void {
    this.free.length = 0;
  }

  public size(): number {
    return this.free.length;
  }
}
