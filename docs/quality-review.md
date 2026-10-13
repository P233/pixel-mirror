# Pixel Mirror 质量评审记录

> 最后更新：2026-10-13
> 评审基线：`72e0760`；依赖升级：`1b4c862`
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
- **建议**：渐进式重构，分 6 个 PR，先修 bug 并配回归测试，再逐层重构（[第 8 节](#8-迁移路线)）；不建议推倒重写。

---

## 2. 问题清单与验证结果

状态：⬜ 未修复 · ✅ 已修复（注明提交）· 🟨 需要产品决策

### 2.1 功能 Bug

| ID  | 问题                                                                                                                | 位置                                                    | 严重度 | 证据                                                                                                                  | 状态         |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- | ------------ |
| B1  | 没有 mockup 时也劫持键盘：方向键、空格无法滚动宿主页面，此时「隐藏」按钮是禁用的，用户无法关闭                      | `stores/keyboardStore.svelte.ts:48`                     | 高     | 真实浏览器：5 次 ↓ 加空格，`scrollY` 始终为 0（对照页为 200 和 900）                                                  | ⬜           |
| B2  | 加载或切换 mockup 后，对齐不生效：标签显示 `top·center`，图片却在 x=0                                               | `stores/mockupOverlayStore.svelte.ts:130`               | 高     | 1280 视口、800 宽图：`left=0`（应为 240），刷新后仍为 0，窗口宽度改 1px 才变为 240；再换 1200 宽图停在 240（应为 40） | ⬜           |
| B3  | 全局 drop 无条件 `preventDefault`：文字无法拖进宿主 input；宿主自己的上传区接收文件时，也会被当作 mockup 上传并激活 | `App.svelte:100`                                        | 高     | 单元测试：`defaultPrevented=true`；宿主已处理后 `uploadAndActivate` 仍被调用                                          | ⬜           |
| B4  | 在宿主 window 上监听 `unhandledrejection` 并 `preventDefault`，吞掉宿主应用的错误，并显示为本工具的 toast           | `stores/toastStore.svelte.ts:21`                        | 高     | 宿主 rejection 被拦截，toast 显示 "host app bug"                                                                      | ⬜           |
| B5  | 快速切换 mockup 时出现竞态：较早的读取较晚返回，覆盖了新图                                                          | `stores/mockupOverlayStore.svelte.ts:108-150`           | 中     | `activeId=b`，显示的是 a 的图                                                                                         | ⬜           |
| B6  | `pnpm lint` 在干净安装下无法运行（缺少 `eslint` 依赖）                                                              | `package.json`                                          | 中     | `ERR_MODULE_NOT_FOUND: 'eslint'`                                                                                      | ✅ `1b4c862` |
| B7  | 卸载后再挂载状态损坏：图片地址已被释放但仍在使用；网格设置的订阅被永久取消                                          | `mockupOverlayStore.cleanup()`、`GridOverlay.svelte:14` | 中     | 重新 `init()` 后 URL 仍是已释放的那个；事件不再生效                                                                   | ⬜           |
| B8  | 使用了未定义的 `--btn-hover`，滑动调节透明度时没有视觉反馈                                                          | `components/Dock.svelte:483`                            | 低     | 静态检查：全项目唯一未定义的变量                                                                                      | ⬜           |
| B9  | 添加网格校验失败时也会清空表单                                                                                      | `components/GridManager.svelte:67`                      | 低     | 出现 "Invalid Width format" toast 后输入框被清空                                                                      | ⬜           |
| B10 | 间距高度和两个颜色字段完全不校验（`validateColor` 已写好但未调用）                                                  | `stores/gridManagerStore.svelte.ts`                     | 中     | 高度填 `"banana"` 也被接受                                                                                            | ⬜           |
| B11 | 没有 mockup 时按 Escape 会切换锁定状态并写入数据库                                                                  | `keyboardStore.svelte.ts:157`                           | 中     | 锁定状态 false → true                                                                                                 | ⬜           |
| B12 | 没有 mockup 时方向键会改写已保存的位置，导致首张 mockup 偏移；按住空格整个 dock 消失                                | 同 B1                                                   | 高     | 浏览器：首张图落在 `x:3, y:1`                                                                                         | ⬜           |
| B13 | GridManager 保存一个字段，会清掉另外两个字段里未保存的输入                                                          | `GridManager.svelte` 的同步 `$effect`                   | 低     | 未保存的颜色输入被重置                                                                                                | ⬜           |
| B14 | 多个文件上传出错时，toast 只显示最后一条                                                                            | `toastStore`（只有一个消息槽）                          | 低     | 连续两条错误，只显示 "second"                                                                                         | ⬜           |
| B15 | 移动端 solid 模式下 `toggleVisibility` 用错快照，scale 被恢复成错误值（UI 目前触发不到）                            | `mockupOverlayStore.svelte.ts:387`                      | 低     | scale 0.5 → 1                                                                                                         | ⬜           |
| B16 | `openDB` 失败一次后，失败的 promise 被永久缓存，不再重试                                                            | `stores/database.ts:53`                                 | 中     | 第二次调用仍失败，`openDB` 只被调用 1 次                                                                              | ⬜           |

### 2.2 对宿主页面的侵入性

| ID  | 问题                                                                                                                                     | 严重度 | 证据                                                                                     | 状态 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- | ---- |
| H1  | 键盘处理不过滤修饰键、输入法组合（`isComposing`）和 `defaultPrevented`；锁定状态下也拦截空格；Escape 与宿主弹窗冲突                      | 高     | Cmd/Alt/Ctrl + ← 均被拦截；Shift+空格（向上翻页）失效：2000 → 2000（对照页 2000 → 1300） | ⬜   |
| H2  | 宿主页面的可继承样式（`font-size`、`line-height`、`letter-spacing`、`text-transform`、`color`）穿透 Shadow DOM，没有 `:host` 重置        | 高     | 截图：Grid Manager 表格被撑开，Position 列和 Add 按钮被挤出可视区                        | ⬜   |
| H3  | 锁定后 mockup 仍是 `pointer-events: auto`，点不到下面的宿主页面                                                                          | 中     | 宿主按钮的点击计数不变，`elementFromPoint` 命中 `pixel-mirror`                           | 🟨   |
| H4  | `main.ts` 直接调用 `document.body.appendChild`：同步脚本，以及 Astro 集成（动态插入的脚本 `defer` 无效）在 `<head>` 里有慢脚本时都会崩溃 | 中     | `TypeError: Cannot read properties of null (reading 'appendChild')`                      | ⬜   |
| H5  | Vite 插件把路径写死为 `/node_modules/pixel-mirror/...`，依赖提升到根目录的 monorepo 中返回 SPA 兜底页                                    | 中     | 返回 `Content-Type: text/html`；对照组返回 `text/javascript`                             | ⬜   |
| H6  | 修改宿主的 `html { position: relative }`，mockup 可见时修改 `touch-action`                                                               | 低     | 设计取舍，已写入 README                                                                  | 🟨   |
| H7  | 没有防重复注册：脚本被加载两次时，`customElements.define` 抛错                                                                           | 低     | 读代码：产物中 `define` 前没有 `get` 检查                                                | ⬜   |

### 2.3 工程化与测试

| ID  | 问题                                                                                                                                                                                                                                                              | 状态         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| E1  | `App.test.ts` 的 28 个测试测的是复制到测试文件里的逻辑，`App.svelte` 覆盖率 0%                                                                                                                                                                                    | ⬜           |
| E2  | `src/stores/__mocks__/database.ts` 是死代码（所有 `vi.mock` 都传了工厂函数）                                                                                                                                                                                      | ⬜           |
| E3  | CLAUDE.md（558 行）与代码脱节：`resetTouchState`、`addTouchListeners`、`removeTouchListeners`、`exitZoomedMode`、`setMode`、`handleMouseDown`、`hasActiveGrid` 在代码中不存在                                                                                     | ⬜           |
| E4  | 没有 CI                                                                                                                                                                                                                                                           | ⬜           |
| E5  | `prettier --check .` 在 `tsconfig.json`、`pnpm-lock.yaml` 上不通过（缺少 `.prettierignore`）                                                                                                                                                                      | ⬜           |
| E6  | `svelte.config.js` 全局开启 `customElement: true`，每个组件都被包装成 custom element（同一组件产物 936 → 1242 字节）                                                                                                                                              | ⬜           |
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

> 待补充：依赖已全部升级（`1b4c862`），各依赖新能力与评审问题的对照正在整理。

---

## 7. 样式 Redesign 方案

> 待补充：现有 UI 截图与样式盘点正在整理。

---

## 8. 迁移路线

渐进式重构，每个阶段一个 PR，保持行为不变、测试全绿。

| 阶段 | 内容                                                                                               | 关联问题                 | 估计工时 |
| ---- | -------------------------------------------------------------------------------------------------- | ------------------------ | -------- |
| P0   | 修复第 2.1 节的 bug，每条配一个回归测试，作为后续重构的安全网                                      | B1–B5、B7–B16            | 0.5–1 天 |
| P1   | 宿主边界层：键盘过滤、drop 守卫、`:host` 样式隔离、删除 `unhandledrejection`、`main.ts` 与两个插件 | H1–H7                    | 1–2 天   |
| P2   | 抽出 `model.ts`、`geometry.ts`，overlay store 变薄，位置改为派生值                                 | R1、R3                   | 2–3 天   |
| P3   | 输入统一为 Pointer Events，加 iOS 真机回归                                                         | R6                       | 2 天     |
| P4   | 持久化：settings repository、Blob 存储、数据库版本 3 迁移、bootstrap                               | R4、R5、B16              | 1–2 天   |
| P5   | 目录与命名、拆分 UI 组件、无障碍、样式 redesign、精简 CLAUDE.md、CI                                | 第 4、7 节，A1–A8，E1–E9 | 3–4 天   |

P0 必须排第一，它的回归测试会守住后面的重构；P2 要在 P3 之前，因为手势层调用的就是 model 的 API。

---

## 9. 附录：验证方法

- **单元验证**：临时测试接入真实的 store 和组件，只 mock 数据库，跑完即删除。
- **真实浏览器验证**：Playwright 加 Chromium，加载构建产物 `dist/index.js`，用无痕 context（IndexedDB 为空），并与不加载工具的对照页比较。
- **Vite 插件验证**：在临时目录模拟依赖提升的 monorepo 和本地 `node_modules` 两种布局，分别请求脚本地址并比较 `Content-Type`。
- **依赖升级验证**：升级前后的产物在 5 个 UI 场景下逐像素对比，结果为 0 差异，控制台无错误。
