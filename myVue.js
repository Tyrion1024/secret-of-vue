import Observer from './observer.js'
import Watcher from './watcher.js'
export default class MyVue {
  constructor(options) {
    this.options = options;
    // 数据的初始化
    this.initData(options);
    let el = this.options.id;
    // 实例的挂载
    this.$mount(el);
  }
  initData(options) {
    if(!options.data) return;
    this.data = options.data;
    // 将数据重置getter，setter方法
    new Observer(options.data);
  }
  $mount(el) {
    // 直接改写innerHTML
    const updateView = _ => {
      let innerHtml = document.querySelector(el).innerHTML;
      let key = innerHtml.match(/{(\w+)}/)[1];
      document.querySelector(el).innerHTML = this.options.data[key]
    }
    // 创建一个渲染的依赖。
    new Watcher(updateView, true)
  }
}
