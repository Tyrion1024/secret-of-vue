import Dep from './dep.js'
export default class Watcher {
  constructor(expOrFn, isRenderWatcher) {
    this.getter = expOrFn;
    // Watcher.prototype.get的调用会进行状态的更新。
    this.get();
  }

  get() {
    // 当前执行的watcher
    Dep.target = this
    this.getter()
    Dep.target = null;
  }
  update() {
    this.get()
  }
}