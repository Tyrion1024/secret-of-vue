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

  +  getter如果遇到属性值为对象时，会为该对象的每个值收集依赖。这句话也很好理解，如果我们将一个值为基本类型的响应式数据改变成一个对象(比如由null改为Object)，此时新增对象里的属性，也需要设置成响应式数据。遇到属性值为数组时，进行其他特殊处理。通俗的总结一下依赖收集的过程，每个数据就是一个依赖管理器，而每个使用数据的地方就是一个依赖。当访问到数据时，会将当前访问的场景作为一个依赖收集到依赖管理器中，同时也会为这个场景的依赖收集拥有的数据。


## computed依赖收集
  + computed的初始化过程，会遍历computed的每一个属性值，并为每一个属性实例化一个computed watcher，其中{ lazy: true}是computed watcher的标志，最终会调用defineComputed将数据设置为响应式数据，对应源码如下：
  ````js
  function initComputed() {
    ···
    for(var key in computed) {
      watchers[key] = new Watcher(
          vm,
          getter || noop,
          noop,
          computedWatcherOptions
        );
    }
    if (!(key in vm)) {
      defineComputed(vm, key, userDef);
    }
  }

  // computed watcher的标志，lazy属性为true
  var computedWatcherOptions = { lazy: true };
  ````

  + defineComputed的逻辑和分析data的逻辑相似，最终调用Object.defineProperty进行数据拦截。具体的定义如下：
  ````js
  function defineComputed (target,key,userDef) {
    var shouldCache = !isServerRendering(); // 非服务端渲染会对getter进行缓存，意义在于   只有在相关响应式数据发生变化时，computed才会重新求值，其余情况多次访问计算属性的值都会返回之前计算的结果。
    if (typeof userDef === 'function') {   // computed属性为函数的情况
      if (shouldCache) {
        sharedPropertyDefinition.get = createComputedGetter(key)
      } else {
        sharedPropertyDefinition.get = createGetterInvoker(userDef)
      }
      sharedPropertyDefinition.set = noop;
    } else {  // computed属性为对象的情况，需要用户自己写出get和set方法
      if (userDef.get) {
        if (shouldCache && userDef.cache) {
          sharedPropertyDefinition.get = createComputedGetter(key)
        } else {
          sharedPropertyDefinition.get = createGetterInvoker(userDef.get)
        }
      } else {
        sharedPropertyDefinition.get = noop
      }
      sharedPropertyDefinition.set = userDef.set || noop;
    }
    if (sharedPropertyDefinition.set === noop) {
      sharedPropertyDefinition.set = function () {
        warn(
          ("Computed property \"" + key + "\" was assigned to but it has no setter."),
          this
        );
      };
    }
    Object.defineProperty(target, key, sharedPropertyDefinition);
  }
  ````

  + 在非服务端渲染的情形，计算属性的计算结果会被缓存，缓存的意义在于，只有在相关响应式数据发生变化时，computed才会重新求值，其余情况多次访问计算属性的值都会返回之前计算的结果，这就是缓存的优化，computed属性有两种写法，一种是函数，另一种是对象，其中对象的写法需要提供getter和setter方法。当访问到computed属性时，会触发getter方法进行依赖收集，看看createComputedGetter的实现。
  ````js
  function createComputedGetter (key) {
      return function computedGetter () {
        var watcher = this._computedWatchers && this._computedWatchers[key];
        if (watcher) {
          if (watcher.dirty) {
            watcher.evaluate();
          }
          if (Dep.target) {
            watcher.depend();
          }
          return watcher.value
        }
      }
    }
  ````

  + createComputedGetter返回的函数在执行过程中会先拿到属性的computed watcher,dirty是标志是否已经执行过计算结果，如果执行过则不会执行watcher.evaluate重复计算，这也是缓存的原理。
  ````js
  Watcher.prototype.evaluate = function evaluate () {
    // 对于计算属性而言 evaluate的作用是执行计算回调
    this.value = this.get();
    this.dirty = false;
  };
  ````

  + get方法前面介绍过，会调用实例化watcher时传递的执行函数，在computer watcher的场景下，执行函数是计算属性的计算函数，他可以是一个函数，也可以是对象的getter方法。
    - 列举一个场景避免和data的处理脱节，computed在计算阶段，如果访问到data数据的属性值，会触发data数据的getter方法进行依赖收集，根据前面分析，data的Dep收集器会将当前watcher作为依赖进行收集，而这个watcher就是computed watcher，并且会为当前的watcher添加访问的数据Dep。

  + 回到计算执行函数的this.get()方法，getter执行完成后同样会进行依赖的清除，原理和目的参考data阶段的分析。get执行完毕后会进入watcher.depend进行依赖的收集。收集过程和data一致,将当前的computed watcher作为依赖收集到数据的依赖收集器Dep中。这就是computed依赖收集的完整过程，对比data的依赖收集，computed会对运算的结果进行缓存，避免重复执行运算过程。

## 派发更新
  + 在数据发生改变时，会执行定义好的setter方法，先看源码。
  ````js
  Object.defineProperty(obj,key, {
    ···
    set: function reactiveSetter (newVal) {
        var value = getter ? getter.call(obj) : val;
        // 新值和旧值相等时，跳出操作
        if (newVal === value || (newVal !== newVal && value !== value)) {
          return
        }
        ···
        // 新值为对象时，会为新对象进行依赖收集过程
        childOb = !shallow && observe(newVal);
        dep.notify();
      }
  })
  ````

  + 派发更新阶段会做以下几件事(代码如上)：
    1. 判断数据更改前后是否一致，如果数据相等则不进行任何派发更新操作。
    2. 新值为对象时，会对该值的属性进行依赖收集过程。
    3. 通知该数据收集的watcher依赖,遍历每个watcher进行数据更新,这个阶段是调用该数据依赖收集器的dep.notify方法进行更新的派发。
  ````js
  Dep.prototype.notify = function notify () {
    var subs = this.subs.slice();
    if (!config.async) {
      // 根据依赖的id进行排序
      subs.sort(function (a, b) { return a.id - b.id; });
    }
    for (var i = 0, l = subs.length; i < l; i++) {
      // 遍历每个依赖，进行更新数据操作。
      subs[i].update();
    }
  };
  ````

  + 更新时会将每个watcher推到队列中，等待下一个tick到来时取出每个watcher进行run操作(非计算属性的更新)
  ````js
  Watcher.prototype.update = function update () {
    if (this.lazy) {
      this.dirty = true;  // 计算属性分支  
    } else {
      queueWatcher(this);
    }
  };
  ````

  + queueWatcher方法的调用，会将数据所收集的依赖依次推到queue数组中,数组会在下一个事件循环'tick'中根据缓冲结果进行视图更新。而在执行视图更新过程中，难免会因为数据的改变而在渲染模板上添加新的依赖，这样又会执行queueWatcher的过程。所以需要有一个标志位来记录是否处于异步更新过程的队列中。这个标志位为flushing,当处于异步更新过程时，新增的watcher会替换队列中未执行的同id的watcher或者插入到queue中。
  ````js
  function queueWatcher (watcher) {
    var id = watcher.id;
    // 保证同一个watcher只执行一次
    if (has[id] == null) {
      has[id] = true;
      if (!flushing) {
        queue.push(watcher);
      } else {
        var i = queue.length - 1;
        while (i > index && queue[i].id > watcher.id) {
          i--;
        }
        queue.splice(i + 1, 0, watcher);
      }
      ···
      nextTick(flushSchedulerQueue);
    }
  }
  ````

  + nextTick会缓冲多个数据处理过程，等到下一个事件循环tick中再去执行DOM操作，它的原理，本质是利用事件循环的微任务队列实现异步更新。当下一个tick到来时，会执行flushSchedulerQueue方法，它会拿到收集的queue数组(这是一个watcher的集合),并对数组依赖进行排序。为什么进行排序呢？源码中解释了三点：
    1. 组件创建是先父后子，所以组件的更新也是先父后子，因此需要保证父的渲染watcher优先于子的渲染watcher更新。
    2. 用户自定义的watcher,称为user watcher。 user watcher和render watcher执行也有先后，由于user watchers比render watcher要先创建，所以user watcher要优先执行。
    3. 如果一个组件在父组件的 watcher 执行阶段被销毁，那么它对应的 watcher 执行都可以被跳过。
  + flushSchedulerQueue阶段，重要的过程可以总结为四点：
    1. 对queue中的watcher进行排序，原因上面已经总结。
    2. 遍历watcher,如果当前watcher有before配置，则执行before方法，对应前面的渲染watcher:在渲染watcher实例化时，我们传递了before函数，即在下个tick更新视图前，会调用beforeUpdate生命周期钩子。
    3. 执行watcher.run进行修改的操作。
    4. 重置恢复状态，这个阶段会将一些流程控制的状态变量恢复为初始值，并清空记录watcher的队列。
  ````js
  function flushSchedulerQueue () {
    currentFlushTimestamp = getNow();
    flushing = true;
    var watcher, id;
    // 对queue的watcher进行排序
    queue.sort(function (a, b) { return a.id - b.id; });
    // 循环执行queue.length，为了确保由于渲染时添加新的依赖导致queue的长度不断改变。
    for (index = 0; index < queue.length; index++) {
      watcher = queue[index];
      // 如果watcher定义了before的配置，则优先执行before方法，即该watcher的beforeUpdate
      if (watcher.before) {
        watcher.before();
      }
      id = watcher.id;
      has[id] = null;
      watcher.run();
      // in dev build, check and stop circular updates.
      if (has[id] != null) {
        circular[id] = (circular[id] || 0) + 1;
        if (circular[id] > MAX_UPDATE_COUNT) {
          warn(
            'You may have an infinite update loop ' + (
              watcher.user
                ? ("in watcher with expression \"" + (watcher.expression) + "\"")
                : "in a component render function."
            ),
            watcher.vm
          );
          break
        }
      }
    }

    // keep copies of post queues before resetting state
    var activatedQueue = activatedChildren.slice();
    var updatedQueue = queue.slice();
    // 重置恢复状态，清空队列
    resetSchedulerState();

    // 视图改变后，调用其他钩子
    callActivatedHooks(activatedQueue);
    callUpdatedHooks(updatedQueue);

    // devtool hook
    /* istanbul ignore if */
    if (devtools && config.devtools) {
      devtools.emit('flush');
    }
  }
  ````

  + watcher.run() 首先会执行watcher.prototype.get的方法，得到数据变化后的当前值，之后会对新值做判断，如果判断满足条件，则执行cb,cb为实例化watcher时传入的回调。
  ````js
  Watcher.prototype.run = function run () {
    if (this.active) {
      var value = this.get();
      if ( value !== this.value || isObject(value) || this.deep ) {
        // 设置新值
        var oldValue = this.value;
        this.value = value;
        // 针对user watcher，暂时不分析
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue);
          } catch (e) {
            handleError(e, this.vm, ("callback for watcher \"" + (this.expression) + "\""));
          }
        } else {
          this.cb.call(this.vm, value, oldValue);
        }
      }
    }
  };
  ````

  + 在分析get方法前，回头看看watcher构造函数的几个属性定义
  ````js
  var watcher = function Watcher(
    vm, // 组件实例
    expOrFn, // 执行函数
    cb, // 回调
    options, // 配置
    isRenderWatcher // 是否为渲染watcher
  ) {
    this.vm = vm;
      if (isRenderWatcher) {
        vm._watcher = this;
      }
      vm._watchers.push(this);
      // options
      if (options) {
        this.deep = !!options.deep;
        this.user = !!options.user;
        this.lazy = !!options.lazy;
        this.sync = !!options.sync;
        this.before = options.before;
      } else {
        this.deep = this.user = this.lazy = this.sync = false;
      }
      this.cb = cb;
      this.id = ++uid$2; // uid for batching
      this.active = true;
      this.dirty = this.lazy; // for lazy watchers
      this.deps = [];
      this.newDeps = [];
      this.depIds = new _Set();
      this.newDepIds = new _Set();
      this.expression = expOrFn.toString();
      // parse expression for getter
      if (typeof expOrFn === 'function') {
        this.getter = expOrFn;
      } else {
        this.getter = parsePath(expOrFn);
        if (!this.getter) {
          this.getter = noop;
          warn(
            "Failed watching path: \"" + expOrFn + "\" " +
            'Watcher only accepts simple dot-delimited paths. ' +
            'For full control, use a function instead.',
            vm
          );
        }
      }
      // lazy为计算属性标志，当watcher为计算watcher时，不会理解执行get方法进行求值
      this.value = this.lazy
        ? undefined
        : this.get();
  }
  ````

  + get方法会执行this.getter进行求值，在当前渲染watcher的条件下,getter会执行视图更新的操作。这一阶段会重新渲染页面组件。get的定义如下：
  ````js
  Watcher.prototype.get = function get () {
    pushTarget(this);
    var value;
    var vm = this.vm;
    try {
      value = this.getter.call(vm, vm);
    } catch (e) {
     ···
    } finally {
      ···
      // 把Dep.target恢复到上一个状态，依赖收集过程完成
      popTarget();
      this.cleanupDeps();
    }
    return value
  };
  ````

  + 执行完getter方法后，最后一步会进行依赖的清除，也就是cleanupDeps的过程。关于依赖清除的作用，我们列举一个场景： 我们经常会使用v-if来进行模板的切换，切换过程中会执行不同的模板渲染，如果A模板监听a数据，B模板监听b数据，当渲染模板B时，如果不进行旧依赖的清除，在B模板的场景下，a数据的变化同样会引起依赖的重新渲染更新，这会造成性能的浪费。因此旧依赖的清除在优化阶段是有必要。
  ````js
  // 依赖清除的过程
  Watcher.prototype.cleanupDeps = function cleanupDeps () {
    var i = this.deps.length;
    while (i--) {
      var dep = this.deps[i];
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this);
      }
    }
    var tmp = this.depIds;
    this.depIds = this.newDepIds;
    this.newDepIds = tmp;
    this.newDepIds.clear();
    tmp = this.deps;
    this.deps = this.newDeps;
    this.newDeps = tmp;
    this.newDeps.length = 0;
  };
  ````

  + 把上面分析的总结成依赖派发更新的最后两个点
    1. 执行run操作会执行getter方法,也就是重新计算新值，针对渲染watcher而言，会重新执行updateComponent进行视图更新
    2. 重新计算getter后，会进行依赖的清除