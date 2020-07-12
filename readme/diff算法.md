## diff算法
+ 更新组件的过程首先是响应式数据发生了变化,数据频繁的修改如果直接渲染到真实DOM上会引起整个DOM树的重绘和重排，频繁的重绘和重排是极其消耗性能的。如何优化这一渲染过程，Vue源码中给出了两个具体的思路，其中一个是在介绍响应式系统时提到的将多次修改推到一个队列中，在下一个tick去执行视图更新，另一个就是接下来要着重介绍的diff算法，将需要修改的数据进行比较，并只渲染必要的DOM。

+ 数据的改变最终会导致节点的改变，所以diff算法的核心在于在尽可能小变动的前提下找到需要更新的节点，直接调用原生相关DOM方法修改视图。不管是真实DOM还是前面创建的Virtual DOM,都可以理解为一颗DOM树，算法比较节点不同时，只会进行同层节点的比较，不会跨层进行比较，这也大大减少了算法复杂度。

## 新旧Vnode的对比（patchVnode）

1. 节点相同，且节点除了拥有文本节点外没有其他子节点。这种情况下直接替换文本内容。
2. 新节点没有子节点，旧节点有子节点，则删除旧节点所有子节点。
3. 旧节点没有子节点，新节点有子节点，则用新的所有子节点去更新旧节点。
4. 新旧都存在子节点。则对比子节点内容做操作。


## 对比子节点（updateChildren）
+ 子节点对比的逻辑
	1. 旧节点的起始位置为oldStartIndex,截至位置为oldEndIndex,新节点的起始位置为newStartIndex,截至位置为newEndIndex。
	2。 新旧children的起始位置的元素两两对比，顺序是newStartVnode, oldStartVnode; newEndVnode, oldEndVnode;newEndVnode, oldStartVnode;newStartIndex, oldEndIndex
	3. newStartVnode, oldStartVnode节点相同，执行一次patchVnode过程，也就是递归对比相应子节点，并替换节点的过程。oldStartIndex，newStartIndex都像右移动一位。
	4. newEndVnode, oldEndVnode节点相同，执行一次patchVnode过程，递归对比相应子节点，并替换节点。oldEndIndex， newEndIndex都像左移动一位。
	5. newEndVnode, oldStartVnode节点相同，执行一次patchVnode过程，并将旧的oldStartVnode移动到尾部,oldStartIndex右移一味，newEndIndex左移一位。
	6. newStartIndex, oldEndIndex节点相同，执行一次patchVnode过程，并将旧的oldEndVnode移动到头部,oldEndIndex左移一味，newStartIndex右移一位。
	7. 四种组合都不相同，则会搜索旧节点所有子节点，找到将这个旧节点和newStartVnode执行patchVnode过程。
	8. 不断对比的过程使得oldStartIndex不断逼近oldEndIndex，newStartIndex不断逼近newEndIndex。当oldEndIndex <= oldStartIndex说明旧节点已经遍历完了，此时只要批量增加新节点即可。当newEndIndex <= newStartIndex说明旧节点还有剩下，此时只要批量删除旧节点即可。

+ 步骤图解
	1. 第一步
	<img src="https://ocean1509.github.io/In-depth-analysis-of-Vue/src/img/8.3.png" style="width: 400px;display: block;margin-top:10px"><img>
	2. 第二步
	<img src="https://ocean1509.github.io/In-depth-analysis-of-Vue/src/img/8.4.png" style="width: 400px;display: block;margin-top:10px"><img>
	3. 第三步
	<img src="https://ocean1509.github.io/In-depth-analysis-of-Vue/src/img/8.5.png" style="width: 400px;display: block;margin-top:10px"><img>
	4. 第四步
	<img src="https://ocean1509.github.io/In-depth-analysis-of-Vue/src/img/8.6.png" style="width: 400px;display: block;margin-top:10px"><img>

+ 实现代码如下
````js
class Vn {
  updateChildren(el, newCh, oldCh) {
    // 新children开始标志
    let newStartIndex = 0;
    // 旧children开始标志
    let oldStartIndex = 0;
    // 新children结束标志
    let newEndIndex = newCh.length - 1;
    // 旧children结束标志
    let oldEndIndex = oldCh.length - 1;
    let oldKeyToId;
    let idxInOld;
    let newStartVnode = newCh[newStartIndex];
    let oldStartVnode = oldCh[oldStartIndex];
    let newEndVnode = newCh[newEndIndex];
    let oldEndVnode = oldCh[oldEndIndex];
    // 遍历结束条件
    while (newStartIndex <= newEndIndex && oldStartIndex <= oldEndIndex) {
      // 新children开始节点和旧开始节点相同
      if (this._sameVnode(newStartVnode, oldStartVnode)) {
        this.patchVnode(newCh[newStartIndex], oldCh[oldStartIndex]);
        newStartVnode = newCh[++newStartIndex];
        oldStartVnode = oldCh[++oldStartIndex]
      } else if (this._sameVnode(newEndVnode, oldEndVnode)) {
      // 新childre结束节点和旧结束节点相同
        this.patchVnode(newCh[newEndIndex], oldCh[oldEndIndex])
        oldEndVnode = oldCh[--oldEndIndex];
        newEndVnode = newCh[--newEndIndex]
      } else if (this._sameVnode(newEndVnode, oldStartVnode)) {
      // 新childre结束节点和旧开始节点相同
        this.patchVnode(newCh[newEndIndex], oldCh[oldStartIndex])
        // 旧的oldStartVnode移动到尾部
        el.insertBefore(oldCh[oldStartIndex].elm, null);
        oldStartVnode = oldCh[++oldStartIndex];
        newEndVnode = newCh[--newEndIndex];
      } else if (this._sameVnode(newStartVnode, oldEndVnode)) {
        // 新children开始节点和旧结束节点相同
        this.patchVnode(newCh[newStartIndex], oldCh[oldEndIndex]);
        el.insertBefore(oldCh[oldEndIndex].elm, oldCh[oldStartIndex].elm);
        oldEndVnode = oldCh[--oldEndIndex];
        newStartVnode = newCh[++newStartIndex];
      } else {
        // 都不符合的处理，查找新节点中与对比旧节点相同的vnode
        this.findIdxInOld(newStartVnode, oldCh, oldStartIdx, oldEndIdx);
      }
    }
    // 新节点比旧节点多，批量增加节点
    if(oldEndIndex <= oldStartIndex) {
      for (let i = newStartIndex; i <= newEndIndex; i++) {
        // 批量增加节点
        this.createElm(oldCh[oldEndIndex].elm, newCh[i])
      }
    }
  }

  createElm(el, vnode) {
    let tag = vnode.tag;
    const ele = document.createElement(tag);
    this._setAttrs(ele, vnode.data);
    const testEle = document.createTextNode(vnode.children);
    ele.appendChild(testEle)
    el.parentNode.insertBefore(ele, el.nextSibling)
  }

  // 查找匹配值
  findIdxInOld(newStartVnode, oldCh, start, end) {
    for (var i = start; i < end; i++) {
      var c = oldCh[i];
      if (util.isDef(c) && this.sameVnode(newStartVnode, c)) { return i }
    }
  }
}
````