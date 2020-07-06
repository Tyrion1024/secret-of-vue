let uid = 0;
export default class Dep {
  constructor() {
    this.id = uid++;
    this.subs = []
  }
  // 依赖收集
  depend() {
    if(Dep.target) {
      // Dep.target是当前的watcher,将当前的依赖推到subs中
      this.subs.push(Dep.target)
    }
  }
  // 派发更新
  notify() {
    const subs = this.subs.slice();
    for (var i = 0, l = subs.length; i < l; i++) { 
      // 遍历dep中的依赖，对每个依赖执行更新操作
      subs[i].update();
    }
  }
}

Dep.target = null;