## 数组方法重写
+ 数组无法通过Object.defaineProperty来监听，继而不能利用重写getter和setter来做数据的劫持。 因此Vue在保留原数组功能的前提下，对数组进行额外的操作处理。也就是重新定义了数组方法。
````js
//	数组拥有的方法
var methodsToPatch = [
'push',
'pop',
'shift',
'unshift',
'splice',
'sort',
'reverse'
];

var arrayProto = Array.prototype;
//	新建一个继承于Array的对象
var arrayMethods = Object.create(arrayProto);
//	arrayMethods是基于原始Array类为原型继承的一个对象类，由于原型链的继承，arrayMethod拥有数组的所有方法，接下来对这个新的数组类的方法进行改写
methodsToPatch.forEach(function (method) {
  // 缓冲原始数组的方法
  var original = arrayProto[method];
  // 利用Object.defineProperty对方法的执行进行改写
  def(arrayMethods, method, function mutator () {}); // mutator方法详见下文“派发更新”
});

function def (obj, key, val, enumerable) {
    Object.defineProperty(obj, key, {
      value: val,
      enumerable: !!enumerable,
      writable: true,
      configurable: true
    });
  }
````

+ 仅仅创建一个新的数组方法合集是不够的，我们在访问数组时，如何不调用原生的数组方法，而是将过程指向这个新的类，这是下一步的重点。先看回到初始化data时实例化Observer类。
````js
var Observer = function Observer (value) {
  this.value = value;
  this.dep = new Dep();
  this.vmCount = 0;
  // 将__ob__属性设置成不可枚举属性。外部无法通过遍历获取。
  def(value, '__ob__', this);
  // 数组处理
  if (Array.isArray(value)) {
    // hasProto用来判断当前环境下是否支持__proto__属性。而数组的处理会根据是否支持这一属性来决定执行protoAugment, copyAugment过程。
    const hasProto = '__proto__' in {}
    if (hasProto) {
      protoAugment(value, arrayMethods);
    } else {
      copyAugment(value, arrayMethods, arrayKeys);
    }
    this.observeArray(value);
  } else {
  // 对象处理
    this.walk(value);
  }
}

````

+ 当支持__proto__时，执行protoAugment会将当前数组的原型指向新的数组类arrayMethods,如果不支持__proto__，则通过代理设置，在访问数组方法时代理访问新数组类中的数组方法。有了这两步的处理，接下来我们在实例内部调用push, unshift等数组的方法时，会执行arrayMethods类的方法。
````js
//直接通过原型指向的方式

function protoAugment (target, src) {
  target.__proto__ = src;
}

// 通过数据代理的方式
function copyAugment (target, src, keys) {
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    def(target, key, src[key]);
  }
}
````

## 依赖收集
+ 在《vue响应式（2）》中说到defineReactive###1函数，对应着看数组是如何处理的。childOb是标志属性值是否为基础类型的标志，observe如果遇到基本类型数据，则直接返回，不做任何处理，如果遇到对象或者数组则会递归实例化Observer，会为每个子属性设置响应式数据，最终返回Observer实例。而实例化Observer又回到之前的老流程： 添加__ob__属性，如果遇到数组则进行原型重指向，遇到对象则定义getter,setter。
````js
function defineReactive###1() {
  ···
  var childOb = !shallow && observe(val);

  Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function reactiveGetter () {
          var value = getter ? getter.call(obj) : val;
          if (Dep.target) {
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
        set() {}
}
````

+ dependArray保证了如果数组元素是数组或者对象，需要递归去为内部的元素收集相关的依赖。
````js
function dependArray (value) {
  for (var e = (void 0), i = 0, l = value.length; i < l; i++) {
    e = value[i];
    e && e.__ob__ && e.__ob__.dep.depend();
    if (Array.isArray(e)) {
      dependArray(e);
    }
  }
}
````

## 派发更新
+ <p>当调用数组的方法去添加或者删除数据时，数据的setter方法是无法拦截的，所以我们唯一可以拦截的过程就是调用数组方法的时候，前面介绍 过，数组方法的调用会代理到新类arrayMethods的方法中,而arrayMethods的数组方法是进行重写过的。记录“数组方法重写”的时候留下了一个坑，那就是mutator方法，现在就来详细说说这个。<p>
  <p>mutator是重写的数组方法，首先会调用原始的数组方法进行运算，这保证了与原始数组类型的方法一致性，args保存了数组方法调用传递的参数。之后取出数组的__ob__也就是之前保存的Observer实例，调用ob.dep.notify();进行依赖的派发更新，前面知道了。Observer实例的dep是Dep的实例，他收集了需要监听的watcher依赖，而notify会对依赖进行重新计算并更新</p>
````js
methodsToPatch.forEach(function (method) {
  var original = arrayProto[method];
  def(arrayMethods, method, function mutator () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];
    // 执行原数组方法
    var result = original.apply(this, args);
    var ob = this.__ob__;
    var inserted;
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args;
        break
      case 'splice':
        inserted = args.slice(2);
        break
    }
    if (inserted) { ob.observeArray(inserted); }
    // notify change
    ob.dep.notify();
    return result
  });
});
````

+ 上面代码中inserted变量用来标志数组是否是增加了元素，如果增加的元素不是原始类型，而是数组对象类型，则需要触发observeArray方法，对每个元素进行依赖收集。
````js
Observer.prototype.observeArray = function observeArray (items) {
  for (var i = 0, l = items.length; i < l; i++) {
    observe(items[i]);
  }
};
````

+ 总的来说。数组的改变不会触发setter进行依赖更新，所以Vue创建了一个新的数组类，重写了数组的方法，将数组方法指向了新的数组类。同时在访问到数组时依旧触发getter进行依赖收集，在更改数组时，触发数组新方法运算，并进行依赖的派发