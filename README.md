# ccmirror2d

for Cocos Creator 3.5+ (只测试过 web 环境, native 未测试)

将目标节点树的渲染结果显示在我们的 Sprite 上。基于此，可以方便实现截图、软遮罩、自定义特效、缓存为位图 等.

可认为是一个简单易用的 2D RenderTexture 替代方案.



<img width="491" alt="a" src="https://user-images.githubusercontent.com/1680733/195519011-3cb37a93-c3b4-40e6-b205-ef90153f79a3.png">
运行:
<img width="253" alt="b" src="https://user-images.githubusercontent.com/1680733/195519022-8591d99c-7171-4cc3-802d-114728a50f5e.png">

## 特点

- 简单易用, 只需添加一个 Mirror2D 组件, 不需要设置 Camera, RenderTexture, Layer & Visibility ... 
- 不受遮挡影响, 不受屏幕范围限制
- 不是专门的 `截图` 方案, 但较容易实现:
```ts
const mirror = this.someProp.getComponent(Mirror2D);
mirror.node.once(Mirror2D.EVENT_RENDERED, ()=> mirror.renderTexture.readPixels(...));
```
- 不是专门的 `缓存为位图` 方案, 但较容易实现:
```ts
//每当需要刷新位图缓存
mirror.target.node.active = mirror.enabled = true;
mirror.node.once(Mirror2D.EVENT_RENDERED, ()=> mirror.target.node.active = mirror.enabled = false)
```

## 如何使用

将仓库中 `mirror2d` 拷贝至你的 `assets/` 中, 然后添加组件的时候搜索 `Mirror2D`.
