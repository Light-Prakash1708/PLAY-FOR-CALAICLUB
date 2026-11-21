/**
 * Fixed-capacity object pool. Objects carry an `alive` flag; call sweep()
 * once per frame to recycle dead ones. No allocations happen during play.
 */
export class ObjectPool {
  constructor(factory, capacity) {
    this.capacity = capacity;
    this.free = [];
    this.active = [];
    for (let i = 0; i < capacity; i++) { const o = factory(); o.alive = false; this.free.push(o); }
  }
  obtain() {
    const o = this.free.pop();
    if (!o) return null;           // pool exhausted: caller skips the spawn
    o.alive = true;
    this.active.push(o);
    return o;
  }
  sweep() {
    const a = this.active;
    for (let i = a.length - 1; i >= 0; i--) {
      if (!a[i].alive) {
        const o = a[i];
        a[i] = a[a.length - 1];
        a.pop();
        this.free.push(o);
      }
    }
  }
  clear() {
    for (const o of this.active) { o.alive = false; this.free.push(o); }
    this.active.length = 0;
  }
}
