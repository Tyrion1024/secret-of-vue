# 实例挂载dom的过程
  + 挂载的过程是调用Vue实例上$mount方法，而$mount的核心是mountComponent函数
  + 如果我们传递的是template模板，模板会先经过编译器的解析，并最终根据不同平台生成对应代码，此时对应的就是将with语句封装好的render函数;我们先把模板编译过程叫做第一阶段。
  + 如果传递的是render函数，则跳过模板编译过程，即省略第一阶段直接进入第二阶段。
  + 第二阶段是拿到render函数，调用vm._render()方法将render函数转化为Virtual DOM，然后进入第三阶段。
  + 第三阶段是通过vm._update()方法将Virtual DOM渲染为真实的DOM节点。

## virtual dom是什么  以及它的作用
  + 当浏览器接收到一个Html文件时，JS引擎和浏览器的渲染引擎便开始工作了。从渲染引擎的角度，它首先会将html文件解析成一个DOM树，与此同时，浏览器将识别并加载CSS样式，并和DOM树一起合并为一个渲染树。有了渲染树后，渲染引擎将计算所有元素的位置信息，最后通过绘制，在屏幕上打印最终的内容。JS引擎和渲染引擎虽然是两个独立的线程，但是JS引擎却可以触发渲染引擎工作，当我们通过脚本去修改元素位置或外观时，JS引擎会利用DOM相关的API方法去操作DOM对象,此时渲染引擎变开始工作，渲染引擎会触发回流或者重绘。下面是回流重绘的两个概念：
    - 回流： 当我们对DOM的修改引发了元素尺寸的变化时，浏览器需要重新计算元素的大小和位置，最后将重新计算的结果绘制出来，这个过程称为回流。
    - 重绘： 当我们对DOM的修改只单纯改变元素的颜色时，浏览器此时并不需要重新计算元素的大小和位置，而只要重新绘制新样式。这个过程称为重绘。

  + 虚拟DOM是为了解决频繁操作DOM引发性能问题的产物。虚拟DOM(下面称为Virtual DOM)是将页面的状态抽象为JS对象的形式，本质上是JS和真实DOM的中间层，当我们想用JS脚本大批量进行DOM操作时，会优先作用于Virtual DOM这个JS对象，最后通过对比将要改动的部分通知并更新到真实的DOM。尽管最终还是操作真实的DOM，但Virtual DOM可以将多个改动合并成一个批量的操作，从而减少 DOM 重排的次数，进而缩短了生成渲染树和绘制所花的时间。
## Vnode是什么  以及它的作用
  + Vnode其实就是一个构造函数，它用来描述一个DOM节点。 这个就是Vue在渲染机制的优化上，virtual dom的概念。
  + 特殊结点
    - 创建Vnode注释节点
      ````js
      // 创建Vnode注释节点
      var createEmptyVNode = function (text) {
          if ( text === void 0 ) text = '';

          var node = new VNode();
          node.text = text;
          node.isComment = true; // 标记注释节点
          return node
      };
      ````
    - 创建文本节点
      ````js
      // 创建文本vnode节点
      function createTextVNode (val) {
          return new VNode(undefined, undefined, undefined, String(val))
      }
      ````
  + 克隆Vnode（cloneVnode对Vnode的克隆只是一层浅拷贝，它不会对子节点进行深度克隆。）
    ````js
    function cloneVNode (vnode) {
      var cloned = new VNode(
        vnode.tag,
        vnode.data,
        vnode.children && vnode.children.slice(),
        vnode.text,
        vnode.elm,
        vnode.context,
        vnode.componentOptions,
        vnode.asyncFactory
      );
      cloned.ns = vnode.ns;
      cloned.isStatic = vnode.isStatic;
      cloned.key = vnode.key;
      cloned.isComment = vnode.isComment;
      cloned.fnContext = vnode.fnContext;
      cloned.fnOptions = vnode.fnOptions;
      cloned.fnScopeId = vnode.fnScopeId;
      cloned.asyncMeta = vnode.asyncMeta;
      cloned.isCloned = true;
      return cloned
    }
    ````

# 第一阶段模板编译
  + Virtual DOM tree是由每个Vnode以树状形式拼成的虚拟DOM树，我们在转换真实节点时需要的就是这样一个完整的Virtual DOM tree，因此我们需要保证每一个子节点都是Vnode类型,这里分两种场景分析。
    - 模板编译render函数，理论上template模板通过编译生成的render函数都是Vnode类型，但是有一个例外，函数式组件返回的是一个数组(这个特殊例子，可以看函数式组件的文章分析),这个时候Vue的处理是将整个children拍平成一维数组。
    - 用户定义render函数，这个时候又分为两种情况，一个是当chidren为文本节点时，这时候通过前面介绍的createTextVNode 创建一个文本节点的 VNode; 另一种相对复杂，当children中有v-for的时候会出现嵌套数组，这时候的处理逻辑是，遍历children，对每个节点进行判断，如果依旧是数组，则继续递归调用，直到类型为基础类型时，调用createTextVnode方法转化为Vnode。这样经过递归，children也变成了一个类型为Vnode的数组。
    ````js
    function _createElement() {
        ···
        if (normalizationType === ALWAYS_NORMALIZE) {
          // 用户定义render函数
          children = normalizeChildren(children);
        } else if (normalizationType === SIMPLE_NORMALIZE) {
          // 模板编译生成的的render函数
          children = simpleNormalizeChildren(children);
        }
    }

    // 处理编译生成的render 函数
    function simpleNormalizeChildren (children) {
        for (var i = 0; i < children.length; i++) {
            // 子节点为数组时，进行开平操作，压成一维数组。
            if (Array.isArray(children[i])) {
            return Array.prototype.concat.apply([], children)
            }
        }
        return children
    }

    // 处理用户定义的render函数
    function normalizeChildren (children) {
        // 递归调用，直到子节点是基础类型，则调用创建文本节点Vnode
        return isPrimitive(children)
          ? [createTextVNode(children)]
          : Array.isArray(children)
            ? normalizeArrayChildren(children)
            : undefined
      }

    // 判断是否基础类型
    function isPrimitive (value) {
        return (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'symbol' ||
          typeof value === 'boolean'
        )
      }

    ````

# 第二阶段vm._render()方法如何将render函数转化为Virtual DOM?
## vm._render()
  + vm._render()方法定义在renderMixin()函数内，_render函数的核心是render.call(vm._renderProxy, vm.$createElement)部分，vm._renderProxy本质上是为了做数据过滤检测，它也绑定了render函数执行时的this指向。

## vm.$createElement()
  + vm.$createElement()方法定义在initRender()函数内，在initRender()时除了定义vm.$createElement()这个方法还有一个vm.$_c(),两者区别在于调用createElement函数的最后一个参数不同，通过模板生成的render方法可以保证子节点全部是Vnode，而用户手写的render函数则需要一些转换和检验。简易代码如下
    ````js
    function initRender(vm) {
      vm._c = function(a, b, c, d) { return createElement(vm, a, b, c, d, false) }
      vm.$createElement = function (a, b, c, d) { return createElement(vm, a, b, c, d, true)}
    }
    ````

## createElement
  + createElement方法实际上是对 _createElement 方法的封装，在调用_createElement前，它会先对传入的参数进行处理，毕竟用户手写的render函数参数规格不统一（需要检验数据格式是最后一个参数传true，否则传false）
  + 常见的数据规范错误比如1.用响应式对象做data属性2.特殊属性key的值为非字符串，非数字类型；这些规范性检测保证了后续Virtual DOM tree的完整生成。（源码如下）
    ````js
    function _createElement (context,tag,data,children,normalizationType) {
      // 1. 数据对象不能是定义在Vue data属性中的响应式数据。
      if (isDef(data) && isDef((data).__ob__)) {
        warn(
          "Avoid using observed data object as vnode data: " + (JSON.stringify(data)) + "\n" +
          'Always create fresh vnode data objects in each render!',
          context
        );
        return createEmptyVNode() // 返回注释节点
      }
      if (isDef(data) && isDef(data.is)) {
        tag = data.is;
      }
      if (!tag) {
        // 防止动态组件 :is 属性设置为false时，需要做特殊处理
        return createEmptyVNode()
      }
      // 2. key值只能为string，number这些原始数据类型
      if (isDef(data) && isDef(data.key) && !isPrimitive(data.key)) {
        warn(
          'Avoid using non-primitive value as key, ' +
          'use string/number value instead.',
          context
        );
      }
      ···
    }
    ````

# 第三阶段vm._update()方法将Virtual DOM渲染为真实的DOM节点
## vm._update()
  + vm._update方法的定义在lifecycleMixin中。它的调用时机有两个，一个是发生在初次渲染阶段，另一个发生数据更新阶段。
    ````js
    function lifecycleMixin() {
      Vue.prototype._update = function (vnode, hydrating) {
        var vm = this;
        var prevEl = vm.$el;
        var prevVnode = vm._vnode; // prevVnode为旧vnode节点
        // 通过是否有旧节点判断是初次渲染还是数据更新
        if (!prevVnode) {
            // 初次渲染
            vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false)
        } else {
            // 数据更新
            vm.$el = vm.__patch__(prevVnode, vnode);
        }
      }
    }
    ````
  + _update的核心是__patch__方法，如果是服务端渲染，由于没有DOM，_patch方法是一个空函数，在有DOM对象的浏览器环境下，__patch__是patch函数的引用。而patch方法又是createPatchFunction方法的返回值，createPatchFunction方法传递一个对象作为参数，对象拥有两个属性，nodeOps和modules，nodeOps封装了一系列操作原生DOM对象的方法，而modules定义了模块的钩子函数。
## createPatchFunction函数
createPatchFunction核心是通过调用createElm方法进行dom操作，创建节点，插入子节点，递归创建一个完整的DOM树并插入到Body中。并且在产生真实dom阶段，会有diff算法来判断前后Vnode的差异，createPatchFunction函数内部会调用封装好的DOM api，根据Virtual DOM的结果去生成真实的节点。其中如果遇到组件Vnode时，会递归调用子组件的挂载过程。
 ````js
  var patch = createPatchFunction({ nodeOps: nodeOps, modules: modules });

  // 将操作dom对象的方法合集做冻结操作
  var nodeOps = /*#__PURE__*/Object.freeze({
      createElement: createElement$1,
      createElementNS: createElementNS,
      createTextNode: createTextNode,
      createComment: createComment,
      insertBefore: insertBefore,
      removeChild: removeChild,
      appendChild: appendChild,
      parentNode: parentNode,
      nextSibling: nextSibling,
      tagName: tagName,
      setTextContent: setTextContent,
      setStyleScope: setStyleScope
    });

  // 定义了模块的钩子函数
    var platformModules = [
      attrs,
      klass,
      events,
      domProps,
      style,
      transition
    ];

  var modules = platformModules.concat(baseModules);

 ````