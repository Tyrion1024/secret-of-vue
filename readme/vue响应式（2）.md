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

  + 我们知道当data中属性值被访问时，会被getter函数拦截，根据我们旧有的知识体系可以知道，实例挂载前会创建一个渲染watcher。updateComponent的逻辑会执行实例的挂载，在这个过程中，模板会被优先解析为render函数，而render函数转换成Vnode时，会访问到定义的data数据，这个时候会触发gettter进行依赖收集。而此时数据收集的依赖就是这个渲染watcher本身。此时代码中依赖收集阶段会做下面几件事：
    1. 为当前的watcher(该场景下是渲染watcher)添加拥有的数据。
    2. 为当前的数据收集需要监听的依赖
  ````js
  // defineReactive###1中的getter函数中会调用dep.depend()函数，它实际上是定义在Dep类的原型上的一个函数。
  Dep.prototype.depend = function depend () {
    if (Dep.target) {
      Dep.target.addDep(this);
    }
  };
  // Dep.target为当前执行的watcher,在渲染阶段，Dep.target为组件挂载时实例化的渲染watcher,因此depend方法又会调用当前watcher的addDep方法为watcher添加依赖的数据，addDep核心代码如下。
  Watcher.prototype.addDep = function addDep (dep) {
    var id = dep.id;
    if (!this.newDepIds.has(id)) {
      // newDepIds和newDeps记录watcher拥有的数据
      this.newDepIds.add(id);
      this.newDeps.push(dep);
      // 避免重复添加同一个data收集器
      if (!this.depIds.has(id)) {
        dep.addSub(this);
      }
    }
  };
  // 其中newDepIds是具有唯一成员是Set数据结构，newDeps是数组，他们用来记录当前watcher所拥有的数据，这一过程会进行逻辑判断，避免同一数据添加多次。 addSub为每个数据依赖收集器添加需要被监听的watcher。
  Dep.prototype.addSub = function addSub (sub) {
    //将当前watcher添加到数据依赖收集器中
    this.subs.push(sub);
  };
  ````

  +  getter如果遇到属性值为对象时，会为该对象的每个值收集依赖。这句话也很好理解，如果我们将一个值为基本类型的响应式数据改变成一个对象，此时新增对象里的属性，也需要设置成响应式数据。遇到属性值为数组时，进行特殊处理。通俗的总结一下依赖收集的过程，每个数据就是一个依赖管理器，而每个使用数据的地方就是一个依赖。当访问到数据时，会将当前访问的场景作为一个依赖收集到依赖管理器中，同时也会为这个场景的依赖收集拥有的数据。
