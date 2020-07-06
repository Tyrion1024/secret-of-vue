## 详解data依赖收集
  + data再初始化的阶段Observer类，initData简化如下。
  ````js
  // initData 
  function initData(data) {
    ···
    observe(data, true)
  }
  // observe
  function observe(value, asRootData) {
    ···
    ob = new Observer(value);
    return ob
  }

  // 观察者类，对象只要设置成拥有观察属性，则对象下的所有属性都会重写getter和setter方法，而getter，setting方法会进行依赖的收集和派发更新
  var Observer = function Observer (value) {
      ···
      // 将__ob__属性设置成不可枚举属性。外部无法通过遍历获取。
      def(value, '__ob__', this);
      // 数组处理
      if (Array.isArray(value)) {
          ···
      } else {
        // 对象处理
        this.walk(value);
      }
    };

  function def (obj, key, val, enumerable) {
    Object.defineProperty(obj, key, {
      value: val,
      enumerable: !!enumerable, // 是否可枚举
      writable: true,
      configurable: true
    });
  }
  ````

  + Observer会为data添加一个__ob__属性， __ob__属性是作为响应式对象的标志，同时def方法确保了该属性是不可枚举属性，即外界无法通过遍历获取该属性值。除了标志响应式对象外，Observer类还调用了原型上的walk方法，遍历对象上每个属性进行getter,setter的改写。
  ````js
  Observer.prototype.walk = function walk (obj) {
      // 获取对象所有属性，遍历调用defineReactive###1进行改写
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
          defineReactive###1(obj, keys[i]);
      }
  };
  ````

  + defineReactive###1是响应式构建的核心，它会先实例化一个Dep类，即为每个数据都创建一个依赖的管理，之后利用Object.defineProperty重写getter,setter方法。
  ````js
  function defineReactive###1 (obj,key,val,customSetter,shallow) {
    // 每个数据实例化一个Dep类，创建一个依赖的管理
    var dep = new Dep();

    var property = Object.getOwnPropertyDescriptor(obj, key);
    // 属性必须满足可配置
    if (property && property.configurable === false) {
      return
    }
    // cater for pre-defined getter/setters
    var getter = property && property.get;
    var setter = property && property.set;
    // 这一部分的逻辑是针对深层次的对象，如果对象的属性是一个对象，则会递归调用实例化Observe类，让其属性值也转换为响应式对象
    var childOb = !shallow && observe(val);
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get: function reactiveGetter () {
        var value = getter ? getter.call(obj) : val;
        if (Dep.target) {
          // 为当前watcher添加dep数据
          dep.depend();
          if (childOb) {
            childOb.dep.depend();
            if (Array.isArray(value)) {
              dependArray(value);
            }
          }
        }
        return value
      },
      set: function reactiveSetter (newVal) {}
    });
  }
  ````