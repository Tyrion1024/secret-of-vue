import Dep from './dep.js'
export default class Observer {
  constructor(data) {
    // 实例化时执行walk方法对每个数据属性重写getter，setter方法
    this.walk(data)
  }

  walk(obj) {
    const keys = Object.keys(obj);
    for(let i = 0;i< keys.length; i++) {
      // Object.defineProperty的处理逻辑
      defineReactive(obj, keys[i])
    }
  }
}


const defineReactive = (obj, key) => {
  const dep = new Dep();
  const property = Object.getOwnPropertyDescriptor(obj);
  let val = obj[key]
  if(property && property.configurable === false) return;
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: true,
    get() {
      // 做依赖的收集
      if(Dep.target) {
        dep.depend()
      }
      return val
    },
    set(nval) {
      if(nval === val) return
      // 派发更新
      val = nval
      dep.notify();
    }
  })
}