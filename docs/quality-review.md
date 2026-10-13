# Pixel Mirror 质量评审记录

> 最后更新：2026-10-13
> 评审基线：`72e0760`；依赖升级：`1b4c862`、`3a03936`
> 本文档持续维护：问题修复后更新「状态」列，不删除条目。

## 目录

1. [结论摘要](#1-结论摘要)
2. [问题清单与验证结果](#2-问题清单与验证结果)
3. [根本原因](#3-根本原因)
4. [命名与文件结构](#4-命名与文件结构)
5. [目标架构与重构方法](#5-目标架构与重构方法)
6. [依赖升级记录与新方案](#6-依赖升级记录与新方案)
7. [样式 Redesign 方案](#7-样式-redesign-方案)
8. [迁移路线](#8-迁移路线)
9. [附录：验证方法](#9-附录验证方法)

---

## 1. 结论摘要

- **基础良好**：TypeScript 严格模式，`svelte-check` 0 错误，656 个测试全部通过，覆盖率约 85%，产物 138 KB（gzip 43 KB）。
- **主要问题集中在三处**：
  1. 一批真实 bug，已全部复现。
  2. 作为注入宿主页面的工具，对宿主干扰过多（键盘、拖放、错误处理、样式）。
  3. `mockupOverlayStore` 承担了状态、持久化、状态机、DOM 监听、桌面端与移动端手势的全部职责。
- **这些 bug 多数不是孤立的**，背后是 5 个结构性原因（[第 3 节](#3-根本原因)）。只修表面，下一个功能还会长出同类问题。
- **依赖**：已全部升级到最新版（TypeScript 停在 6.0.3），检查和测试全部通过，产物视觉零差异；升级带来的新解法见[第 6 节](#6-依赖升级记录与新方案)。
- **建议**：渐进式重构，分 6 个 PR，先修 bug 并配回归测试，再逐层重构（[第 8 节](#8-迁移路线)）；不建议推倒重写。

---

## 2. 问题清单与验证结果

状态：⬜ 未修复 · ✅ 已修复（注明提交）· 🟨 需要产品决策

### 2.1 功能 Bug

| ID  | 问题                                                                                                                | 位置                                                    | 严重度 | 证据                                                                                                                  | 状态         |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- | ------------ |
| B1  | 没有 mockup 时也劫持键盘：方向键、空格无法滚动宿主页面，此时「隐藏」按钮是禁用的，用户无法关闭                      | `stores/keyboardStore.svelte.ts:48`                     | 高     | 真实浏览器：5 次 ↓ 加空格，`scrollY` 始终为 0（对照页为 200 和 900）                                                  | ✅ `1ca8b47` |
| B2  | 加载或切换 mockup 后，对齐不生效：标签显示 `top·center`，图片却在 x=0                                               | `stores/mockupOverlayStore.svelte.ts:130`               | 高     | 1280 视口、800 宽图：`left=0`（应为 240），刷新后仍为 0，窗口宽度改 1px 才变为 240；再换 1200 宽图停在 240（应为 40） | ✅ `1ca8b47` |
| B3  | 全局 drop 无条件 `preventDefault`：文字无法拖进宿主 input；宿主自己的上传区接收文件时，也会被当作 mockup 上传并激活 | `App.svelte:100`                                        | 高     | 单元测试：`defaultPrevented=true`；宿主已处理后 `uploadAndActivate` 仍被调用                                          | ✅ `1ca8b47` |
| B4  | 在宿主 window 上监听 `unhandledrejection` 并 `preventDefault`，吞掉宿主应用的错误，并显示为本工具的 toast           | `stores/toastStore.svelte.ts:21`                        | 高     | 宿主 rejection 被拦截，toast 显示 "host app bug"                                                                      | ✅ `1ca8b47` |
| B5  | 快速切换 mockup 时出现竞态：较早的读取较晚返回，覆盖了新图                                                          | `stores/mockupOverlayStore.svelte.ts:108-150`           | 中     | `activeId=b`，显示的是 a 的图                                                                                         | ✅ `1ca8b47` |
| B6  | `pnpm lint` 在干净安装下无法运行（缺少 `eslint` 依赖）                                                              | `package.json`                                          | 中     | `ERR_MODULE_NOT_FOUND: 'eslint'`                                                                                      | ✅ `1b4c862` |
| B7  | 卸载后再挂载状态损坏：图片地址已被释放但仍在使用；网格设置的订阅被永久取消                                          | `mockupOverlayStore.cleanup()`、`GridOverlay.svelte:14` | 中     | 重新 `init()` 后 URL 仍是已释放的那个；事件不再生效                                                                   | ✅ `1ca8b47` |
| B8  | 使用了未定义的 `--btn-hover`，滑动调节透明度时没有视觉反馈                                                          | `components/Dock.svelte:483`                            | 低     | 静态检查：全项目唯一未定义的变量                                                                                      | ✅ `1ca8b47` |
| B9  | 添加网格校验失败时也会清空表单                                                                                      | `components/GridManager.svelte:67`                      | 低     | 出现 "Invalid Width format" toast 后输入框被清空                                                                      | ✅ `1ca8b47` |
| B10 | 间距高度和两个颜色字段完全不校验（`validateColor` 已写好但未调用）                                                  | `stores/gridManagerStore.svelte.ts`                     | 中     | 高度填 `"banana"` 也被接受                                                                                            | ✅ `1ca8b47` |
| B11 | 没有 mockup 时按 Escape 会切换锁定状态并写入数据库                                                                  | `keyboardStore.svelte.ts:157`                           | 中     | 锁定状态 false → true                                                                                                 | ✅ `1ca8b47` |
| B12 | 没有 mockup 时方向键会改写已保存的位置，导致首张 mockup 偏移；按住空格整个 dock 消失                                | 同 B1                                                   | 高     | 浏览器：首张图落在 `x:3, y:1`                                                                                         | ✅ `1ca8b47` |
| B13 | GridManager 保存一个字段，会清掉另外两个字段里未保存的输入                                                          | `GridManager.svelte` 的同步 `$effect`                   | 低     | 未保存的颜色输入被重置                                                                                                | ✅ `1ca8b47` |
| B14 | 多个文件上传出错时，toast 只显示最后一条                                                                            | `toastStore`（只有一个消息槽）                          | 低     | 连续两条错误，只显示 "second"                                                                                         | ✅ `1ca8b47` |
| B15 | 移动端 solid 模式下 `toggleVisibility` 用错快照，scale 被恢复成错误值（UI 目前触发不到）                            | `mockupOverlayStore.svelte.ts:387`                      | 低     | scale 0.5 → 1                                                                                                         | ✅ `1ca8b47` |
| B16 | `openDB` 失败一次后，失败的 promise 被永久缓存，不再重试                                                            | `stores/database.ts:53`                                 | 中     | 第二次调用仍失败，`openDB` 只被调用 1 次                                                                              | ✅ `1ca8b47` |

### 2.2 对宿主页面的侵入性

| ID  | 问题                                                                                                                                                                                                                                     | 严重度 | 证据                                                                                     | 状态         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- | ------------ |
| H1  | 键盘处理不过滤修饰键、输入法组合（`isComposing`）和 `defaultPrevented`；锁定状态下也拦截空格；Escape 与宿主弹窗冲突                                                                                                                      | 高     | Cmd/Alt/Ctrl + ← 均被拦截；Shift+空格（向上翻页）失效：2000 → 2000（对照页 2000 → 1300） | ✅ `51733c2` |
| H2  | 宿主页面的可继承样式（`font-size`、`line-height`、`letter-spacing`、`text-transform`、`color`）穿透 Shadow DOM，没有 `:host` 重置                                                                                                        | 高     | 截图：Grid Manager 表格被撑开，Position 列和 Add 按钮被挤出可视区                        | ✅ `51733c2` |
| H3  | 锁定后 mockup 仍是 `pointer-events: auto`，点不到下面的宿主页面                                                                                                                                                                          | 中     | 宿主按钮的点击计数不变，`elementFromPoint` 命中 `pixel-mirror`                           | 🟨           |
| H4  | `main.ts` 直接调用 `document.body.appendChild`：同步脚本，以及 Astro 集成（动态插入的脚本 `defer` 无效）在 `<head>` 里有慢脚本时都会崩溃                                                                                                 | 中     | `TypeError: Cannot read properties of null (reading 'appendChild')`                      | ✅ `51733c2` |
| H5  | Vite 插件把路径写死为 `/node_modules/pixel-mirror/...`，依赖提升到根目录的 monorepo 中返回 SPA 兜底页                                                                                                                                    | 中     | 返回 `Content-Type: text/html`；对照组返回 `text/javascript`                             | ✅ `51733c2` |
| H6  | 修改宿主的 `html { position: relative }`，mockup 可见时修改 `touch-action`                                                                                                                                                               | 低     | 设计取舍，已写入 README                                                                  | 🟨           |
| H7  | 没有防重复注册：脚本被加载两次时，`customElements.define` 抛错                                                                                                                                                                           | 低     | 读代码：产物中 `define` 前没有 `get` 检查                                                | ✅ `51733c2` |
| H8  | 不支持启用了 Trusted Types 的宿主页面：`{@html}` 渲染图标时直接赋值 `innerHTML`，升级前后都无法渲染。Svelte 5.51 起会在加载时创建 `svelte-trusted-html` 策略，名称不在白名单内或宿主自己的 Svelte 已创建同名策略时，报错会提前到加载阶段 | 低     | 浏览器：5 种 CSP 配置下，新旧版本的 dock 均无法渲染                                      | ✅ `51733c2` |

### 2.3 工程化与测试

| ID  | 问题                                                                                                                                                                                                                                                              | 状态         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| E1  | `App.test.ts` 的 28 个测试测的是复制到测试文件里的逻辑，`App.svelte` 覆盖率 0%                                                                                                                                                                                    | ⬜           |
| E2  | `src/stores/__mocks__/database.ts` 是死代码（所有 `vi.mock` 都传了工厂函数）                                                                                                                                                                                      | ⬜           |
| E3  | CLAUDE.md（558 行）与代码脱节：`resetTouchState`、`addTouchListeners`、`removeTouchListeners`、`exitZoomedMode`、`setMode`、`handleMouseDown`、`hasActiveGrid` 在代码中不存在                                                                                     | ⬜           |
| E4  | 没有 CI                                                                                                                                                                                                                                                           | ⬜           |
| E5  | `prettier --check .` 在 `tsconfig.json`、`pnpm-lock.yaml` 上不通过（缺少 `.prettierignore`）                                                                                                                                                                      | ⬜           |
| E6  | `svelte.config.js` 全局开启 `customElement: true`，每个组件都被包装成 custom element（同一组件产物 936 → 1242 字节）。Svelte 5.54 起可以按文件开启，方案见 6.4                                                                                                    | ⬜           |
| E7  | 全局关闭 svgo 的 `cleanupIds`，只为了用 CSS 选中一个图标内部的 `#toggle-trigger`                                                                                                                                                                                  | ⬜           |
| E8  | 未使用的代码：`RESIZE_DEBOUNCE_MS`（实际写死 100）、`GRID_COLUMNS_MIN/MAX`（实际写死 1/100）、`validateNumberRange`、`keyboardStore` 暴露的 `isShiftPressed`/`isSpacePressed`、`device.ts` 的 3 个导出、`FileError` 别名、图标 `folder-upload-stroke-rounded.svg` | ⬜           |
| E9  | 组件测试用手写的普通对象 mock store：不是响应式的，形状会漂移（mock 的 `DOCK_TRANSITION_DURATION` 是 200，实际是 250）；每个测试文件要手动 mock 17 个图标                                                                                                         | ⬜           |
| E10 | 未使用的依赖 `happy-dom`                                                                                                                                                                                                                                          | ✅ `1b4c862` |

### 2.4 无障碍与交互

| ID  | 问题                                                                                                              | 状态 |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---- |
| A1  | 网格开关按钮的名称来自 CSS `::after` 的 "Enabled/Disabled"：只说明状态，不说明用途；所有开关都没有 `aria-pressed` | ⬜   |
| A2  | 对齐 popover 没有 `aria-expanded`；管理面板不能用 Escape 关闭；打开面板后没有焦点管理                             | ⬜   |
| A3  | `<tr role="button">` 里又嵌套了 `<button>`                                                                        | ⬜   |
| A4  | Toast 没有 `role="alert"`，不会自动消失，新消息会直接覆盖旧消息                                                   | ⬜   |
| A5  | 焦点环颜色 `#d9daff` 在白底上的对比度为 1.36:1，几乎看不见                                                        | ⬜   |
| A6  | 文本对比度不足：placeholder 2.85:1（亮色）/ 2.50:1（暗色）；toast 白字红底 4.02:1；网格表格激活行的绿字 2.41:1    | ⬜   |
| A7  | "Clear Mockups"、"Reset All Settings" 是不可撤销的操作，却没有二次确认                                            | ⬜   |
| A8  | 触控目标约 36px，低于 44px 建议值；没有适配 `prefers-reduced-motion`                                              | ⬜   |

### 2.5 API 命名问题（详见第 4 节）

例如 `adjustOpacity(+1)` 反而降低透明度（实测 0.5 → 0.45）。

---

## 3. 根本原因

| 根本原因                                                                                                                                                        | 导致的问题                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **R1 该派生的值靠手动同步**：`position` 被存下来，再由 `updateAlignedPosition()` 在特定时机刷新                                                                 | B2、B12、B15                                                  |
| **R2 没有宿主边界层**：改动宿主页面的代码分散在 App、keyboardStore、toastStore、Dock、MockupOverlay、device.ts 六处，过滤规则各不相同                           | B1、B3、B4、B11、H1–H4                                        |
| **R3 状态机是隐式的**：同时存在 `mode`、`isLocked`、`modeBeforeSolid`、`preZoomScale`、`preSolidScale`、`bufferedPosition`/`persistedPosition`、`isZoomPanning` | B15，以及零散的守卫判断和 `isSolidOrZoomed` 这类组合式 getter |
| **R4 生命周期绑在叶子组件上**：单例 store 在 `onMount` 中初始化，在 `onDestroy` 中做不可逆的清理                                                                | B7                                                            |
| **R5 异步操作没有取消机制**                                                                                                                                     | B5                                                            |
| **R6 输入处理有三套**：Pointer、Touch、Safari Gesture，外加 window 上的 mousemove                                                                               | MockupOverlay 加 store 中约 250 行可删的代码                  |

---

## 4. 命名与文件结构

### 4.1 目录与文件

- `stores/` 下放着不是 store 的模块：`database.ts`（持久化）、`eventBus.ts`、`utils.ts`。项目里同时存在 `src/utils/` 和 `src/stores/utils.ts`。
- 文件命名风格混用：`generate-mockup-buffers.ts` 用 kebab-case，其他 TS 模块用 camelCase。
- 图标文件沿用供应商命名（`idea-01-stroke-rounded.svg` 被当作「透明度」图标），语义映射分散在每个 import 里。
- store 按 UI 面板命名而不是按业务领域：`mockupManagerStore` 对 `mockupOverlayStore`；`gridManagerStore` 会修改 `gridOverlayStore` 的设置，两者边界模糊。
- `types.d.ts` 把 `Position`、`Size`、`Mockup` 等声明为全局 ambient 类型，依赖关系是隐式的。

### 4.2 API 命名

| 现状                                                                              | 问题                                                | 建议                                                      |
| --------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| `adjustOpacity(direction)`                                                        | 传正数反而降低透明度                                | `stepOpacity(+1 \| -1)`，符号与方向一致                   |
| `toggleMobileSolidMode`                                                           | 平台名进了 store 的 API                             | `toggleInspect`，由输入层判断平台                         |
| store 中的 `handleTouchDrag`、`handleSolidPan`、`handleGesturePinch`              | `handle*` 是事件处理函数的命名，不该出现在 store 中 | `dragTo(point)`、`panBy(delta)`、`pinchTo(scale, center)` |
| `startDrag(e: MouseEvent)`、`startTouchDrag(e: TouchEvent)`                       | store 直接依赖 DOM 事件                             | `beginDrag(point)`                                        |
| `bufferedPosition` 与 `persistedPosition`，而 getter `position` 返回的是 buffered | 读的人不知道该用哪一个                              | 位置改为派生值，另设一个临时 `view`（见 5.2）             |
| `isSolidOrZoomed`、`isVisibleOrLocked`                                            | 组合式 getter，说明缺少状态机抽象                   | `isInspecting`、`canDrag`                                 |
| `MockupAlignmentX` 类型里包含 `null`                                              | 可空性写进了类型别名                                | 每个轴一个 union：`{ align } \| { offset }`               |
| `Grid`、`LayoutGrid`、`GridInput`、`LayoutGridConfig` 混用                        | 同一概念四种叫法                                    | 统一为 `LayoutGrid`                                       |
| 2.0 版本中的 `FileError`「向后兼容」别名                                          | 没有存在的必要                                      | 删除                                                      |

### 4.3 注释与文档

- 到处是 `// ====` 分隔横幅，很多 JSDoc 只是复述函数名。
- CLAUDE.md 大段复述代码，已经与代码脱节（E3）。建议精简到约 100 行，只写约定和不变量，行为规格交给测试表达。

---

## 5. 目标架构与重构方法

### 5.1 目录结构：按功能纵向切分，每层职责有硬性规定

```
src/
├── main.ts                  # 等 DOM 就绪、防止重复注册、挂载元素
├── app/
│   ├── App.svelte           # 组合根：只负责布局和启动
│   └── bootstrap.ts         # 统一初始化与 dispose，支持重复挂载
├── features/
│   ├── overlay/
│   │   ├── model.ts         # 纯 TS：状态、状态转换、守卫判断
│   │   ├── geometry.ts      # 纯 TS：对齐、围绕中心缩放、捏合不动点、zoom 计算
│   │   ├── overlay.svelte.ts# 薄响应式层：持有 $state，调用 model 和 repository
│   │   ├── gestures.ts      # Pointer Events 手势识别（Svelte attachment）
│   │   └── MockupOverlay.svelte
│   ├── mockups/   (repository.ts, library.svelte.ts, thumbnail.ts, MockupManager.svelte, MockupCard.svelte)
│   ├── grids/     (repository.ts, schema.ts, grids.svelte.ts, GridOverlay.svelte, GridManager/…)
│   ├── dock/      (dock.svelte.ts, Dock.svelte, Toolbar.svelte, AlignmentPopover.svelte, OpacityControl.svelte)
│   └── notifications/ (notifications.svelte.ts, Toast.svelte)
├── platform/                # 只有这一层可以接触 window、document、indexedDB
│   ├── host.ts              # 宿主边界：所有监听器和宿主改动在此登记，并能还原
│   ├── keyboard.ts          # 快捷键表加统一过滤
│   ├── fileDrop.ts
│   ├── db.ts                # openDB、版本迁移、blocking 处理、失败后允许重试
│   └── settings.svelte.ts   # 持久化设置：防抖写入整组快照，读取时校验
└── shared/                  # math.ts、errors.ts、icons.ts（语义化导出）、styles/
```

**依赖规则**：`ui → state → (model | platform)`。`model.ts` 和 `geometry.ts` 不得 import svelte 或 platform，用 ESLint 的 `no-restricted-imports` 强制。

### 5.2 Overlay 模型：派生代替同步，拆分正交的状态（解决 R1、R3）

```ts
// features/overlay/model.ts
type AxisX = { align: "left" | "center" | "right" } | { offset: number };
type AxisY = { align: "top" | "bottom" } | { offset: number };

interface Placement {
  x: AxisX;
  y: AxisY;
  scale: number;
} // 持久化
interface Appearance {
  opacity: number;
  hidden: boolean;
  locked: boolean;
} // 持久化
type Interaction =
  // 临时状态，永不持久化
  | { kind: "idle" }
  | { kind: "dragging"; pointerStart: Point; origin: Point }
  | { kind: "inspecting"; view: { x: number; y: number; scale: number } | null };

export const can = {
  drag: (s: State) => s.hasImage && !s.appearance.hidden && !s.appearance.locked && s.interaction.kind === "idle",
  inspect: (s: State) => s.hasImage && !s.appearance.hidden && s.interaction.kind === "idle"
};
```

```ts
// overlay.svelte.ts
const position = $derived(resolvePosition(placement, imageSize, page)); // page 尺寸由 ResizeObserver 更新
const transform = $derived(
  interaction.kind === "inspecting" && interaction.view ? interaction.view : { ...position, scale: placement.scale }
);
```

- **B2、B12 从结构上消失**：图片尺寸、视口宽度、文档高度任一变化，位置自动重算；`updateAlignedPosition` 和 resize 防抖可以删除。
- **solid、zoomed 和移动端捏合统一为 `inspecting` 加一个可选的 `view`**：退出时只需 `interaction = idle`。`preZoomScale`、`preSolidScale`、`modeBeforeSolid`、`persistedPosition` 全部删除，B15 也随之消失。
- **锁定和隐藏是外观属性，不再是状态**：5 个状态缩减为 3 种交互状态，守卫集中在 `can.*`，可以写表驱动的穷举测试。

### 5.3 宿主边界层（解决 R2）

```ts
// platform/host.ts
export function createHostScope() {
  const undo: (() => void)[] = [];
  return {
    listen(t: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) {
      t.addEventListener(type, fn, opts);
      undo.push(() => t.removeEventListener(type, fn, opts));
    },
    setStyle(el: HTMLElement, prop: string, value: string) {
      const prev = el.style.getPropertyValue(prop);
      el.style.setProperty(prop, value);
      undo.push(() => el.style.setProperty(prop, prev));
    },
    dispose: () =>
      undo
        .splice(0)
        .reverse()
        .forEach((f) => f())
  };
}

// platform/keyboard.ts：一处过滤，覆盖所有快捷键
const shouldIgnore = (e: KeyboardEvent) =>
  e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || isEditable(e.composedPath()[0]);
// 快捷键写成声明式表：{ key, when: () => can.inspect(s), down, up }
```

规则：

- 全局监听只在有 mockup 时挂载。
- 一律先检查 `defaultPrevented`，尊重宿主已经做过的处理。
- 删除 `unhandledrejection` 监听。

**样式隔离**：

- 加 `:host { all: initial; font: 14px/1.4 system-ui, sans-serif; color-scheme: light dark; }`。
- 字体只在这里声明一次，组件里重复的 `font-family: Arial` 删除。

**注入方式**：

- `main.ts`：等到 `DOMContentLoaded` 再挂载，并用 `customElements.get` 检查，防止重复注册。
- 可以考虑挂载到 `document.documentElement`，不怕框架替换 `<body>`。
- Vite 插件：`apply: "serve"` 加注入模块 `import "pixel-mirror"`。
- Astro 集成：`injectScript("page", 'import "pixel-mirror"')`。
- README 提供通用写法：`if (import.meta.env.DEV) import("pixel-mirror")`。

**锁定语义（H3）**：建议锁定后改为 `pointer-events: none`，即可以点穿到宿主页面；双击检测本来挂在 document 上，不受影响。这是交互决策，需要产品确认。

### 5.4 输入统一为 Pointer Events（解决 R6）

一个 attachment 维护 `Map<pointerId, Point>`：

- 1 个指针：拖动或平移。
- 2 个指针：按距离比例和中点做捏合缩放。
- 双击：根据 `pointerup` 的时间和位移判断。
- 配合 `setPointerCapture` 和 `touch-action: none`，不再需要 window 级监听。

Touch Events、Safari Gesture Events、空的 `handlePointerMove`、`captureImgElement` 加 `$effect` 的双重管理，全部删除。**必须在 iOS Safari 真机上回归捏合手感。**

### 5.5 持久化与生命周期（解决 R4、R5）

- **设置**：每组设置是一个 `$state` 对象，修改后防抖 200ms，写入整组快照；读取时用 schema 解析，补默认值、校验范围。删除逐字段写入和事件总线；如需多标签页同步，用 `BroadcastChannel`。
- **图片**：IndexedDB 中直接存 `Blob`（File 本身就是 Blob）。数据库版本 3 的迁移中把旧的 ArrayBuffer 转为 Blob。state 里只存 id。
- **数据库连接**：`db.ts` 按 `oldVersion` 做迁移，处理 `blocking`，失败后清除缓存的 promise，允许重试（B16）。
- **图片地址**：在组件里用 `$effect` 从 Blob 创建 object URL，变化或卸载时释放，重复挂载天然安全（B7）。
- **竞态（B5）**：用递增 token 或 `AbortController`，过期的结果直接丢弃。
- **启动**：`bootstrap.ts` 统一加载并返回 `dispose`；store 不再提供会破坏重新初始化的 `cleanup`。

### 5.6 UI 层

- **拆分大组件**：Dock（596 行）拆为 Toolbar、AlignmentPopover、OpacityControl；GridManager（546 行）拆为 SpacingGridForm、LayoutGridTable、AddGridRow。每个字段自己持有草稿状态，B13 随之消失。
- **基础组件**：`IconButton`、`ToggleButton` 把 `label` 设为必填，用类型强制可访问名称；`ToggleButton` 自带 `aria-pressed`。
- **动画编排**：用 Svelte transition 代替 `managerVisible`/`toolbarVisible` 标志位和 `setTimeout(DOCK_TRANSITION_DURATION)`。
- **图标**：`shared/icons.ts` 做语义化导出；恢复 svgo 的 `cleanupIds`，开关图标拆成两个 SVG（E7）。
- **颜色和长度校验**：改用 `CSS.supports()`。
- **缩略图**：改为从顶部裁剪，整页设计稿更容易辨认。

### 5.7 测试与工程化

- **测试分层**：
  - 纯模型：表驱动的穷举测试。
  - state 层：注入内存 repository，取代 `vi.mock` 整个模块。
  - 组件测试：用真实 state 加 `fake-indexeddb`。
- **删除**：E1 中测副本的测试、E2 的死 mock；SVG 改由 vitest alias 统一替换为桩。
- **端到端测试**：用 Playwright 做一个「恶意宿主」测试页：激进的全局 CSS、宿主自己的拖放上传区和快捷键、textarea 与输入法、很高的页面。
- **工程化**：
  - 加 CI（check、lint、test、build）。
  - 加 `.prettierignore`。
  - 设置覆盖率门槛。
  - 只对 `App.svelte` 开启 `customElement`。

---

## 6. 依赖升级记录与新方案

### 6.1 升级记录

所有依赖都已升级到最新版，只有 TypeScript 例外，原因见 6.2。

| 包                                                                                             | 升级前        | 升级后           | 本仓库需要做的适配                                                                                |
| ---------------------------------------------------------------------------------------------- | ------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| vite                                                                                           | 7.3.1         | 8.3.4            | 无。底层改为 Rolldown/Oxc；IIFE 库模式、postcss/cssnano 流程不变                                  |
| @sveltejs/vite-plugin-svelte                                                                   | 6.2.4         | 7.3.1            | 删除已移除的 `hot` 选项（vitest 配置）                                                            |
| svelte                                                                                         | 5.49.1        | 5.57.2           | 无                                                                                                |
| vitest、@vitest/coverage-v8                                                                    | 4.0.18        | 5.0.4            | 无                                                                                                |
| typescript                                                                                     | 5.9.3         | 6.0.3            | 删除已废弃的 `baseUrl`，`paths` 改为相对于 tsconfig 的路径                                        |
| @testing-library/jest-dom                                                                      | 6.9.1         | 7.0.1            | 类型改从 `@testing-library/jest-dom/vitest` 加载；显式声明必需的 peer 依赖 `@testing-library/dom` |
| eslint、@eslint/js                                                                             | 未声明 / 9.39 | 10.12.0 / 10.0.1 | 补上 `eslint` 依赖（B6）；改用 `eslint/config` 自带的 `includeIgnoreFile`，删除 `@eslint/compat`  |
| typescript-eslint、eslint-plugin-svelte                                                        | 8.54 / 3.14   | 8.71.2 / 3.23.1  | 无                                                                                                |
| svelte-check、prettier-plugin-svelte                                                           | 4.3 / 3.4     | 4.7.6 / 4.1.1    | 无，`.svelte` 文件格式没有变化                                                                    |
| jsdom、cssnano、postcss-html、stylelint-config-html、lint-staged、@poppanator/sveltekit-svg 等 | —             | 最新版           | 无                                                                                                |
| happy-dom                                                                                      | 20.5.0        | 已删除           | 从未被使用（E10）                                                                                 |

**验证**：

- `pnpm check`、`pnpm lint`、656 个测试、构建全部通过。
- 升级前后的产物在 5 个 UI 场景下逐像素对比：0 差异，控制台无错误。
- 产物 135.2 KB → 138.0 KB，gzip 42.25 KB → 42.77 KB。

### 6.2 未升级到最新版的依赖

- **TypeScript 停在 6.0.3，没有升到 7.0.2。**
  - typescript-eslint 8.71.2 的 peer 范围是 `<6.1.0`；TS 7 支持还在开发中（[typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)），没有发布日期。
  - svelte-check 只能通过 `--tsgo` 等实验性参数使用 TS 7，而且需要同时安装 TS 6 和 TS 7。
  - 建议等 typescript-eslint 正式支持后再升级。TS 6 已经会对 TS 7 中移除的配置项报警，本仓库已全部处理。

### 6.3 Node 版本要求

升级后，多个开发依赖的 `engines` 声明了更高的 Node 版本：

| 依赖           | Node 要求                        |
| -------------- | -------------------------------- |
| cssnano 9      | `^22.22.3 \|\| ^24.15 \|\| >=26` |
| jsdom 30       | `^22.22.2 \|\| ^24.15 \|\| >=26` |
| lint-staged 17 | `>=22.22.1`                      |
| vitest 5       | `>=22.12`                        |

本次验证环境是 Node 22.22.0，所有命令都能正常运行，但版本略低于声明的范围。**建议开发环境和 CI 统一使用 Node 24 LTS。** 不要在 `package.json` 里加 `engines` 字段：它会约束安装 `pixel-mirror` 的使用者，而这些要求只针对开发依赖。

### 6.4 升级带来的新能力

以下能力只有升级后才可用，括号内为引入的版本。

| 能力                                                                                                           | 解决的问题          | 在本项目中的用法                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Svelte 编译选项 `customElement` 可以写成函数 `({ filename }) => boolean`（5.54）                               | E6                  | `customElement: ({ filename }) => filename.endsWith("/src/App.svelte")`。**必须同时设置 `css: "injected"`**：vite-plugin-svelte 7 在开启 `emitCss` 时默认 `css: "external"`（已在源码中核实），否则子组件的 CSS 会变成单独的文件，到不了 shadow root |
| 修复：较晚挂载的子组件样式被插入 `document.head`，而不是 shadow root（5.56.10）                                | H2 相关             | 升级即生效。逐像素对比显示目前的 UI 没有受到影响，但后续拆分组件、按需挂载时能避免这个坑                                                                                                                                                             |
| 事件委托改用 symbol，同一页面上不同 Svelte 实例之间不再互相干扰（5.51.1、5.51.3）                              | 注入场景的健壮性    | 宿主应用自己也用 Svelte（版本不同）时，避免 "delegate.call is not a function" 错误。升级即生效（未在本项目场景中复现）                                                                                                                               |
| 组件销毁时，`on()` 延迟注册的 pointer/touch/wheel 监听器会被取消（5.57.1）                                     | R2、R6              | `on()` 可以放心用在生命周期很短的 attachment 和 effect 中，是统一手势层的前提                                                                                                                                                                        |
| 过期的异步分支会被中止，派生值断开时其 AbortSignal 也会中止（5.55.6、5.56.5、5.56.6）                          | B5                  | 让 `getAbortSignal()` 的用法变得可靠（见 6.5）                                                                                                                                                                                                       |
| `createContext` 在程序化 `mount` 时也能使用，并新增 `has`（5.50、5.57）                                        | R4、E9              | App 创建 store 实例并通过 context 下发；测试时通过 wrapper 注入真实 store                                                                                                                                                                            |
| Vite `resolve.tsconfigPaths: true`（8.0）                                                                      | 配置重复            | 让 Vite 直接读取 tsconfig 的 `paths`，`vite.config.ts` 和 `vitest.config.ts` 里重复的 `~` 别名可以删掉。SCSS `additionalData` 中的 `~` 尚未验证，先保留 alias                                                                                        |
| Vite 允许访问 pnpm 全局虚拟 store（8.1）                                                                       | H5                  | 插件可以改为注入 `/@fs/<插件所在包的绝对路径>/dist/index.js`，无论依赖被提升到哪里都能找到正确位置                                                                                                                                                   |
| Vitest `vi.when(fn).calledWith(x).thenResolve(...)`（5.0）                                                     | E9                  | 按参数返回不同的数据库 mock，比如 `getMockup("a")` 和 `getMockup("b")`，竞态测试更好写                                                                                                                                                               |
| Vitest 5 中对 `window.innerWidth` 等属性的写入会同步到 jsdom 的 window（5.0）                                  | B2                  | 可以在 jsdom 里测试 resize 和对齐逻辑                                                                                                                                                                                                                |
| `@testing-library/svelte` 的 `wrapper` / `wrapperProps` 渲染选项（5.4）                                        | E9                  | 用一个 provider 组件包裹，注入真实的响应式 store，替换现在不响应变化的普通对象 mock                                                                                                                                                                  |
| jsdom 29/30 重写了 CSSOM，`getComputedStyle` 支持继承                                                          | H2                  | 可以在单元测试中断言宿主样式不会穿透进 shadow root（有效程度待验证）                                                                                                                                                                                 |
| ESLint `includeIgnoreFile` 从 `eslint/config` 导出（10.4）                                                     | 依赖精简            | ✅ 已采用（`3a03936`）                                                                                                                                                                                                                               |
| ESLint `preserve-caught-error` 支持 `errorClassNames`（10.7）                                                  | 错误链              | 配置 `DatabaseError` 后，lint 会强制带上原始错误，配合 `Error.cause` 解决根因丢失的问题                                                                                                                                                              |
| eslint-plugin-svelte 新规则：`no-conflicting-module-names`（3.22）、`prefer-derived-over-derived-by`（3.18）等 | 第 4 节的命名与结构 | 重构目录时防止出现 `Foo.svelte` 与 `Foo.svelte.ts` 同名冲突                                                                                                                                                                                          |

### 6.5 升级前就已可用、但项目没用上的能力

这些能力不需要升级也能用，但都直接对应评审中发现的问题，应该在重构中采用。

| 能力（引入版本）                                                | 解决的问题   | 用法                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getAbortSignal()`（Svelte 5.35）                               | B5           | 在读取 `activeId` 的 `$effect` 中，await 之前先取得 signal，await 之后检查 `if (signal.aborted) return`，过期的结果直接丢弃                                                                                                                          |
| `createSubscriber`（5.7）                                       | R1、B2、R4   | 用 `ResizeObserver` 监听 `documentElement`，通过 getter 返回 `clientWidth`、`scrollHeight`，对齐位置就成了普通的 `$derived`。它按引用计数自动启停：第一次被响应式读取时开始监听，最后一个 effect 销毁时停止，不需要手动 init/cleanup，重复挂载也安全 |
| `svelte/reactivity/window`（5.11）                              | R1           | 提供 `innerWidth`、`scrollY` 等，但**没有** `clientWidth` 和 `scrollHeight`，所以对齐计算仍需用 `createSubscriber`                                                                                                                                   |
| `MediaQuery`（5.7）                                             | 第 7 节      | `new MediaQuery("prefers-color-scheme: dark")` 实现「跟随系统」主题；`pointer: coarse` 用于控件尺寸                                                                                                                                                  |
| `on()`（`svelte/events`，5.0）                                  | R2           | 统一注册监听器并返回解绑函数。注意：模板中的 `ontouchstart`/`ontouchmove` 是 passive 的，在里面调用 `preventDefault()` 无效，手势必须用 `on(el, "touchmove", h, { passive: false })`                                                                 |
| `{@attach}`（5.29）                                             | R6           | 把统一的 Pointer Events 手势层写成 attachment                                                                                                                                                                                                        |
| `$state.snapshot`（5.0）                                        | 5.5 节持久化 | IndexedDB 不能直接存 `$state` 代理对象。用 `$effect` 读取快照并防抖写入；在 `pagehide` 时立即写入未保存的修改                                                                                                                                        |
| `$host()`（5.0）                                                | H1           | 用 `$host().shadowRoot.activeElement` 取代手写的 shadow DOM 遍历来判断焦点                                                                                                                                                                           |
| 实验性的组件内 `await`（5.36）                                  | B5           | `$derived(await getMockup(id))` 天然丢弃过期结果。目前仍是实验特性，暂不建议采用                                                                                                                                                                     |
| Vitest 浏览器模式（4.0）+ `vitest-browser-svelte`               | E1、手势测试 | 浏览器中有真实布局、shadow DOM、`DataTransfer` 和 pointer capture。jsdom 测 store，浏览器测 App 和 MockupOverlay，可以补上 App.svelte 0% 的覆盖率                                                                                                    |
| `svelte/no-add-event-listener` 规则（eslint-plugin-svelte 3.6） | R2           | 开启后，lint 会要求使用 `on()`，防止监听器再次散落各处                                                                                                                                                                                               |

### 6.6 升级带来的风险

- **Trusted Types（H8）**：Svelte 5.51 起会在加载时创建 `svelte-trusted-html` 策略。实测在 5 种 CSP 配置下，升级前后的版本都无法渲染，根本原因是图标组件通过 `{@html}` 直接赋值 `innerHTML`。所以这不是升级造成的回退，只是报错时机变成了加载阶段。如需支持：
  1. 把图标改成普通 Svelte 标记，不再走 `{@html}`；
  2. 在文档中说明宿主的 CSP 需要允许 `svelte-trusted-html`；宿主自己也用 Svelte 时，还需要加上 `'allow-duplicates'`。
- **构建目标提高**：Vite 8 的默认构建目标提高到 Safari 16.4、Chrome 111、Firefox 114。对开发工具来说可以接受。
- **测试中的事件时序**：`on()` 会把 pointer/touch/wheel 监听器延迟一个微任务再注册。将来迁移到 `on()` 后，测试在派发这些事件之前需要先 `await` 一个微任务。

---

## 7. 样式 Redesign 方案

### 7.1 现状诊断

依据：真实浏览器中截取了 27 张截图（亮色和暗色主题、桌面 1280 和移动端 390、各种 UI 状态），并对样式代码做了 token 盘点。

**视觉与布局问题**

| ID  | 问题                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | 管理面板的底部按钮（Clear/Reset、Close）骑在面板边框上，一半露在面板外，遮住宿主内容；移动端更明显                                           |
| V2  | 网格开关的「开」和「关」用的是同一个黑色胶囊，只靠文字和一个小圆点区分                                                                       |
| V3  | 移动端网格表格内容宽 553px、容器只有 334px，横向滚动但没有任何提示："Outer Gutter" 被截断，Position 列和 Add 按钮完全看不到                  |
| V4  | Toast 在两种主题下都是纯红底白字（`#fe0200`），刺眼，对比度只有 4.02:1                                                                       |
| V5  | 对齐标签和输入框的值用等宽字体，其余界面用 Arial，字体混用；数字没有用 tabular-nums                                                          |
| V6  | dock 的 2px 黑边加半透明白色 outline，叠在 mockup 上时出现一圈光晕；在任何宿主页面上都过于抢眼                                               |
| V7  | 9 个工具栏按钮没有分组，视觉权重完全相同；禁用状态与正常状态几乎分不出来                                                                     |
| V8  | 暗色主题下，对齐 popover 的激活色（暗红、深蓝）在深色底上对比度很低                                                                          |
| V9  | dock 在底部时距边缘 24px，在顶部时距边缘 40px，因为上方的坐标标签被挤到顶边                                                                  |
| V10 | Mockup Manager 只显示居中裁剪的方形缩略图，没有文件名、尺寸，两张相同的图分不出来；单行时下面是大片空白                                      |
| V11 | 拖放卡片在亮色主题下是半透明的，后面模糊的页面文字会透出来；暗色主题下虚线边框几乎看不见                                                     |
| V12 | 管理面板是通过对 dock 的 `width`/`height` 做动画「变形」出来的，会触发布局计算；切换时序还依赖 `setTimeout(DOCK_TRANSITION_DURATION)` 来编排 |

**token 盘点**

- **字号**：7 种（8、11.5、12、14、15、16、18px），没有字号层级；15px 用了 8 次。
- **字体**：`font-family: Arial` 重复声明 3 次，monospace 2 次，没有放在 `:host` 统一声明。
- **硬编码颜色**：DropZone 遮罩、Toast 的白字和 outline 都是写死的颜色值。
- **间距**：`rhythm()` 以 8px 为单位，但大量用到 0.125、0.5、0.75、1.5、2.25 这样的分数倍。说明真正的基准单位是 4px。
- **圆角**：8 种取值。
- **阴影**：没有阴影体系，层级全靠 2px 边框表达。
- **动效**：4 套几乎相同的 keyframes（`fadeIn`、`fade-in`、`scale-in`、`toast-in`）；没有适配 `prefers-reduced-motion`。
- **主题**：只能手动切换，不跟随系统；没有设置 `color-scheme`，原生控件（select、滚动条、color input）不会跟着主题变。
- **对比度**：问题见 A5、A6。

### 7.2 设计目标

1. **克制**：工具界面要能叠在任何设计稿上，不和宿主页面抢注意力。
2. **状态清晰**：可见、锁定、对齐、solid/zoom 等当前状态一眼就能看出。
3. **一套 token 贯穿到底**：组件里不出现任何硬编码的颜色、字号、间距。
4. **无障碍达标**：文字对比度 ≥ 4.5:1，控件边界和焦点 ≥ 3:1；触控目标 ≥ 44px。

### 7.3 Design Tokens

所有 token 定义在 `:host` 上（配合 `all: initial` 重置），主题通过 `:host([data-theme="dark"])` 切换。默认值为 `system`，跟随 `prefers-color-scheme`。

**颜色**（右侧对比度均已计算验证）

| Token                 | 亮色                                                  | 暗色                     | 用途 / 对比度                                                       |
| --------------------- | ----------------------------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| `--pm-surface`        | `#ffffff`                                             | `#18181b`                | 工具栏、面板底色                                                    |
| `--pm-surface-sunken` | `#f4f4f5`                                             | `#27272a`                | 输入框、分组底色                                                    |
| `--pm-border`         | `rgb(0 0 0 / .12)`                                    | `rgb(255 255 255 / .12)` | 分隔线、容器描边                                                    |
| `--pm-border-strong`  | `#8a8a92`                                             | `#71717a`                | 输入框边界 3.43:1 / 3.67:1                                          |
| `--pm-text`           | `#18181b`                                             | `#fafafa`                | 17.7:1 / 17.0:1                                                     |
| `--pm-text-muted`     | `#52525b`                                             | `#a1a1aa`                | 7.7:1 / 6.9:1                                                       |
| `--pm-text-subtle`    | `#6b6b73`                                             | `#a1a1aa`                | placeholder，在 sunken 底色上 4.81:1 / 5.81:1（现状为 2.85 / 2.50） |
| `--pm-accent`         | `#4f46e5`                                             | `#818cf8`                | 选中、激活、焦点环，6.3:1 / 5.9:1（现状焦点环 1.36:1）              |
| `--pm-accent-soft`    | `rgb(79 70 229 / .12)`                                | `rgb(129 140 248 / .16)` | 选中项背景                                                          |
| `--pm-danger`         | `#dc2626`                                             | `#f87171`                | 错误、破坏性操作，4.8:1 / 6.4:1                                     |
| `--pm-axis-x`         | `#2563eb`                                             | `#60a5fa`                | X 轴、列网格（沿用现在「蓝=列」的语义）                             |
| `--pm-axis-y`         | `#dc2626`                                             | `#f87171`                | Y 轴、行网格（沿用「红=行」）                                       |
| `--pm-shadow-md`      | `0 1px 2px rgb(0 0 0/.06), 0 8px 24px rgb(0 0 0/.12)` | 透明度提高到 .4 / .5     | 用阴影代替 2px 黑边                                                 |

**字体排版**

| Token  | 值                                                                                                               |
| ------ | ---------------------------------------------------------------------------------------------------------------- |
| 字体族 | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`，只在 `:host` 声明一次                                |
| 字号   | `--pm-text-xs: 11px`、`sm: 12px`、`md: 13px`、`lg: 15px`；`pointer: coarse` 时输入框为 16px（防止 iOS 自动缩放） |
| 字重   | 400 / 500 / 600                                                                                                  |
| 数字   | 坐标、透明度、尺寸一律使用 `font-variant-numeric: tabular-nums`，不再切换到等宽字体（V5）                        |

**间距、圆角、尺寸、动效、层级**

| 类别     | 值                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 间距     | 4px 基准：`--pm-space-1` 到 `--pm-space-8`，对应 4 到 32px                                                                       |
| 圆角     | `sm 6px`、`md 10px`、`lg 14px`、`full 999px`（工具栏保留胶囊形，作为品牌识别）                                                   |
| 控件尺寸 | 精确指针 32px，`@media (pointer: coarse)` 下 44px；图标 20px                                                                     |
| 动效     | `--pm-duration-fast: 120ms`、`--pm-duration: 200ms`；缓动 `cubic-bezier(.2, 0, 0, 1)`；`prefers-reduced-motion` 时只保留淡入淡出 |
| 层级     | overlay < grid < toolbar < popover < toast，统一由 `$max-z-index` 向下偏移，集中在一处定义                                       |

### 7.4 组件方案

**工具栏**

- **分组**：`[可见 · 锁定] | [透明度 · 缩放 · 对齐] | [Mockups · Grids] | [⋯]`。主题和 dock 位置这类低频操作收进 `⋯` 菜单（V7）。
- **状态区**：左侧加一个状态区，显示 `Top · Center` 或 `x 123 · y 456`（tabular-nums）；锁定时显示锁图标。坐标标签不再悬浮在 dock 上方（V9）。
- **按钮状态**：开关类按钮（隐藏、锁定）开启时填充 `--pm-accent-soft` 背景，并设置 `aria-pressed`；禁用时透明度 38%、无 hover 效果。
- **提示**：用自定义 Tooltip 代替 `title`，悬停或聚焦 400ms 后出现，并带快捷键提示，例如「锁定 · Esc」「透明度 · Ctrl+滚轮」。
- **solid / zoom 状态 HUD**：dock 隐藏时，在原位置显示一个小胶囊：「Solid · 2× · 松开空格退出」。现在用户进入这些状态后没有任何反馈。
- **外观**：1px 描边加阴影，取代 2px 黑边和白色 outline 光晕（V6）。

**弹出层（透明度、缩放、对齐）**

- **定位**：统一的 `Popover` 组件，锚定到触发按钮上（现在是写死的 `left: 74px`）；支持 Escape 和点击外部关闭；设置 `aria-expanded` 和 `aria-controls`。
- **透明度**：弹出一个 range 滑块（10–90，步长 5），旁边显示数值和重置按钮。Ctrl+滚轮、触摸横滑保留为快捷操作。现在这两种操作都无法被用户发现，也不支持辅助技术。
- **缩放**：0.5× / 1× 的分段控件。
- **对齐**：一个 2×3 的位置选择器（上左、上中、上右 / 下左、下中、下右），点击一格同时设置两个轴，比现在两组分别着色的图标更直观；另加一个「取消对齐」按钮。激活格使用 `--pm-accent`，暗色下对比度达标（V8）。

**面板（Mockups / Grids）**

- **打开方式**：不再把 dock「变形」成面板，改为从工具栏上方弹出的独立面板，工具栏保持可见（V12）。宽度 `min(720px, 100vw - 32px)`，最大高度 70vh，只有内容区滚动。
- **移动端**：全宽底部抽屉，适配 safe-area。
- **结构**：顶部是标题加 × 关闭按钮（支持 Escape，关闭后焦点回到触发按钮）；底部操作栏在面板内部右对齐（V1）。
- **破坏性操作**：改为二次确认，或者执行后提供「撤销」toast。

**Mockup Manager**

- **卡片**：缩略图从顶部裁剪（`object-position: top`），比例 3:4；下方显示文件名（超长省略）、尺寸（如 `1440 × 6000`）和文件大小（V10）。
- **激活状态**：accent 描边加「Active」角标，取代现在压在图片角上的绿点。
- **操作**：删除按钮在悬停或聚焦时出现（触屏设备上常显）；整张卡片是一个单选项，方向键移动、Enter 选择。
- **上传**：上传卡片改为「拖入图片或点击选择」的放置区。空状态给出说明：可以拖到页面任意位置、支持哪些格式、大小上限 10MB。

**Grid Manager**

- **分组**：分为「Columns（布局网格）」和「Baseline（间距网格）」两组，每组用真正的开关（`role="switch"`、`aria-checked`）。关闭状态是灰色轨道，开启是 accent 色（V2）。
- **字段**：标签放在输入框上方，不再用黑色胶囊；在回车或失焦时校验，错误信息显示在字段下方，不再弹 toast；去掉每个字段各自的 Update 按钮。
- **颜色字段**：色块按钮（打开原生 color input）、透明度滑块、文本输入框三者联动。
- **网格列表**：用单选列表代替表格，每行显示一句摘要：`12 列 · 1140px · 24px 间距 · 居中`。移动端自然折行，不再横向截断（V3）；激活行用 accent 单选标记，替换低对比度的绿色文字（A6）。
- **新建网格**：表单加预设（Bootstrap 1140/12/24、Tailwind 1280/12/32、移动端 4 列等）。

**反馈**

- **Toast**：中性底色加危险色图标和文字，跟随主题（V4）；最多叠放 3 条；普通消息 5 秒、错误 8 秒后自动消失，悬停时暂停计时；设置 `role="alert"`。位置改到 dock 上方，避免遮挡宿主页面的头部导航。
- **拖放区**：卡片不透明，虚线边框改用 `--pm-accent`（≥3:1）；页面只做压暗不做模糊（全页模糊在长页面上开销较大）；不遮住 dock（V11）。

### 7.5 实施方法

1. **Token 层**：新建 `shared/styles/tokens.scss`，在 `:host` 上输出 CSS 变量。`App.svelte` 里 `.theme-root` 的变量迁到这里；SCSS 只保留 mixin 和函数。
2. **约束**：用 stylelint 禁止组件中出现硬编码颜色和字号，只允许 `var(--pm-*)`。可用 `color-no-hex` 和 `declaration-property-value-allowed-list`。
3. **基础组件**：放在 `shared/ui/`：`Button`、`IconButton`、`ToggleButton`、`Switch`、`Segmented`、`Popover`、`Panel`、`Field`、`Tooltip`、`Toast`。无障碍属性由组件内置，并通过类型强制。
4. **替换顺序**：token + `:host` 重置（随 P1）→ 基础组件 → 工具栏 → 三个弹出层 → 面板框架 → 两个管理面板 → toast 和拖放区。
5. **视觉回归**：把这次截图用的脚本改造成 Playwright 截图测试，覆盖每个状态的亮色、暗色和移动端；再配一张「恶意宿主」页面的截图，防止样式隔离退化。
6. **原型先行**：动代码之前，先用静态原型确认工具栏、对齐选择器、两个面板这 4 个关键界面的视觉方向。

---

## 8. 迁移路线

渐进式重构，每个阶段一个 PR，保持行为不变、测试全绿。

| 阶段 | 内容                                                                                               | 关联问题                 | 估计工时 | 进度                                                                       |
| ---- | -------------------------------------------------------------------------------------------------- | ------------------------ | -------- | -------------------------------------------------------------------------- |
| P0   | 修复第 2.1 节的 bug，每条配一个回归测试，作为后续重构的安全网                                      | B1–B5、B7–B16            | 0.5–1 天 | ✅ `1ca8b47`：15 条全部修复，25 个回归测试在修复前的代码上失败、修复后通过 |
| P1   | 宿主边界层：键盘过滤、drop 守卫、`:host` 样式隔离、删除 `unhandledrejection`、`main.ts` 与两个插件 | H1–H8                    | 1–2 天   | ✅ `51733c2`：H3 待产品决策，H6 保留为设计取舍                             |
| P2   | 抽出 `model.ts`、`geometry.ts`，overlay store 变薄，位置改为派生值                                 | R1、R3                   | 2–3 天   | ✅ `ee501f6`：对外 API 不变；16 步交互脚本在新旧产物上结果一致             |
| P3   | 输入统一为 Pointer Events，加 iOS 真机回归                                                         | R6                       | 2 天     | ⬜                                                                         |
| P4   | 持久化：settings repository、Blob 存储、数据库版本 3 迁移、bootstrap                               | R4、R5、B16              | 1–2 天   | ⬜                                                                         |
| P5   | 目录与命名、拆分 UI 组件、无障碍、样式 redesign、精简 CLAUDE.md、CI                                | 第 4、7 节，A1–A8，E1–E9 | 3–4 天   | ⬜                                                                         |

P0 必须排第一，它的回归测试会守住后面的重构；P2 要在 P3 之前，因为手势层调用的就是 model 的 API。

**P2 中有意保留的行为**：切换缩放时仍会清除对齐（派生模型下可以保留对齐、只缩放自由轴，属于行为变化，作为后续可选改进）。

---

## 9. 附录：验证方法

- **单元验证**：临时测试接入真实的 store 和组件，只 mock 数据库，跑完即删除。
- **真实浏览器验证**：Playwright 加 Chromium，加载构建产物 `dist/index.js`，用无痕 context（IndexedDB 为空），并与不加载工具的对照页比较。
- **Vite 插件验证**：在临时目录模拟依赖提升的 monorepo 和本地 `node_modules` 两种布局，分别请求脚本地址并比较 `Content-Type`。
- **依赖升级验证**：升级前后的产物在 5 个 UI 场景下逐像素对比，结果为 0 差异，控制台无错误。
- **Trusted Types 验证**：用带 CSP 响应头的本地服务器，在 5 种配置下（不启用、启用但不限策略名、只允许宿主策略、允许 svelte 策略、宿主已创建同名策略）对比新旧产物。
- **依赖调研**：查阅各依赖的官方 CHANGELOG、迁移指南和发布说明，关键结论在已安装包的源码和类型定义中复核（如 `customElement` 函数类型、vite-plugin-svelte 的 `css` 默认值、`eslint/config` 的导出、bundle 中的 `createPolicy` 调用）。
