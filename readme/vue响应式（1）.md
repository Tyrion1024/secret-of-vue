## 数据的初始化 initState(vm)
  + initState的过程，是对数据进行响应式设计的过程，过程会针对<strong>props</strong>，<strong>methods</strong>，<strong>data</strong>，<strong>computed</strong>和<strong>watch</strong>做数据的初始化处理，并将他们转换为响应式对象
    ````js
    function initState (vm) {
      vm._watchers = [];
      var opts = vm.$options;
      // 初始化props
      if (opts.props) { initProps(vm, opts.props); }
      // 初始化methods
      if (opts.methods) { initMethods(vm, opts.methods); }
      // 初始化data
      if (opts.data) {
        initData(vm);
      } else {
        // 如果没有定义data，则创建一个空对象，并设置为响应式
        observe(vm._data = {}, true /* asRootData */);
      }
      // 初始化computed
      if (opts.computed) { initComputed(vm, opts.computed); }
      // 初始化watch
      if (opts.watch && opts.watch !== nativeWatch) {
        initWatch(vm, opts.watch);
      }
    }
    ````
## 1. initProps
  + render解析Vnode的过程遇到child这个子占位符节点，因此会进入创建子组件Vnode的过程，创建子Vnode过程是调用createComponent,这个阶段我们在组件章节有分析过，在组件的高级用法也有分析过，最终会调用new Vnode去创建子Vnode。而对于props的处理，extractPropsFromVNodeData会对attrs属性进行规范校验后，最后会把校验后的结果以propsData属性的形式传入Vnode构造器中。总结来说，props传递给占位符组件的写法，会以propsData的形式作为子组件Vnode的属性存在。
  + extractPropsFromVNodeData: HTML对大小写是不敏感的，所有的浏览器会把大写字符解释为小写字符，因此我们在使用DOM中的模板时，cameCase(驼峰命名法)的props名需要使用其等价的 kebab-case (短横线分隔命名) 命代替。
  + 子组件处理props的过程，是发生在父组件_update阶段，这个阶段是Vnode生成真实节点的过程，期间会遇到子Vnode,这时会调用createComponent去实例化子组件。而实例化子组件的过程又回到了_init初始化，此时又会经历选项的合并，针对props选项，最终会统一成{props: { test: { type: null }}}的写法。接着会调用initProps, initProps做的事情，简单概括一句话就是，将组件的props数据设置为响应式数据。
## 2. initMethods
  + 主要是保证methods方法定义必须是函数，且命名不能和props重复，最终会将定义的方法都挂载到根实例上。
## 3. initData
  + data在初始化选项合并时会生成一个函数，只有在执行函数时才会返回真正的数据，所以initData方法会先执行拿到组件的data数据，并且会对对象每个属性的命名进行校验，保证不能和props，methods重复。最后的核心方法是observe,observe方法是将数据对象标记为响应式对象，并对对象的每个属性进行响应式处理。与此同时，和props的代理处理方式一样，proxy会对data做一层代理，直接通过vm.XXX可以代理访问到vm._data上挂载的对象属性。
## 4. initComputed
  + initComputed是computed数据的初始化,不同之处在于以下几点：
    - computed可以是对象，也可以是函数，但是对象必须有getter方法,因此如果computed中的属性值是对象时需要进行验证。
    - 针对computed的每个属性，要创建一个监听的依赖，也就是实例化一个watcher,watcher的定义，可以暂时理解为数据使用的依赖本身，一个watcher实例代表多了一个需要被监听的数据依赖。
  + 除了不同点，initComputed也会将每个属性设置成响应式的数据，同样的，也会对computed的命名做检测，防止与props,data冲突。
## 在构建简易式响应式系统（demo1）小结
  在构建简易式响应式系统的时候，我们引出了几个重要的概念，他们都是响应式原理设计的核心，我们简单小结一下：
  + Observer类，实例化一个Observer类会通过Object.defineProperty对数据的getter,setter方法进行改写，在getter阶段进行依赖的收集,在数据发生更新阶段，触发setter方法进行依赖的更新
  + watcher类，实例化watcher类相当于创建一个依赖，简单的理解是数据在哪里被使用就需要产生了一个依赖。当数据发生改变时，会通知到每个依赖进行更新，前面提到的渲染wathcer便是渲染dom时使用数据产生的依赖。
  + Dep类，既然watcher理解为每个数据需要监听的依赖，那么对这些依赖的收集和通知则需要另一个类来管理，这个类便是Dep,Dep需要做的只有两件事，收集依赖和派发更新依赖。