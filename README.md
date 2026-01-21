# React 19 KeepAlive 标签页实现详解

## 项目概述

这是一个基于 **React 19** 和 **UmiJS 4** 的浏览器标签页式 KeepAlive 实现，支持：

- 🏷️ 动态标签页管理（打开、关闭、切换）
- 💾 页面状态保持（表单数据、滚动位置等）
- ⚙️ 可配置的 keep-alive 路由白名单
- 🎯 生命周期感知（激活/失活回调）

---

## 为什么使用 React 19 的 `<Activity>` 组件？

### 传统方案的问题

在 React 18 及之前，实现 keep-alive 通常有两种方式：

#### 方式 1：纯 CSS `display: none`

```jsx
<div style={{ display: isActive ? "block" : "none" }}>
  <HeavyComponent />
</div>
```

**问题：**
- ❌ 隐藏的组件仍在 React 树中，每次父组件渲染都会触发重新 render
- ❌ 副作用继续运行（定时器、事件监听、轮询请求等）
- ❌ 多个隐藏页面累积性能开销

#### 方式 2：第三方库（react-activation 等）

需要引入额外依赖，可能存在与 React 新版本的兼容性问题。

---

### React 19 `<Activity>` 的优势

```jsx
import { Activity } from "react";

<Activity mode={isActive ? "visible" : "hidden"}>
  <HeavyComponent />
</Activity>
```

**优势：**

| 特性 | CSS display:none | React 19 Activity |
|------|------------------|-------------------|
| 组件参与 reconciliation | ✅ 是 | ❌ 否（暂停） |
| 副作用继续运行 | ✅ 是 | ⚠️ 可控 |
| 更新优先级 | 正常 | 降低（空闲处理） |
| 状态保留 | ✅ 是 | ✅ 是 |
| DOM 保留 | ✅ 是 | ✅ 是 |
| CPU 开销 | 高 | 低 |

> **核心价值**：`Activity` 让隐藏的组件"休眠"，不再参与 React 的 reconciliation 过程，大幅降低多标签页场景下的性能开销。

---

## 文件结构

```
src/layouts/keep-alive-layout/
├── config.ts      # 配置文件（路由白名单、首页路径）
├── context.ts     # Context 定义和生命周期 Hooks
├── index.tsx      # 主组件
└── index.less     # 样式文件
```

---

## 核心代码解析

### 1. 配置文件 `config.ts`

```typescript
/** 需要 keep-alive 的路由列表 */
export const keepAliveRoutes: string[] = [
  "/page1",
  // "/page2",  // 注释掉的路由不会缓存
  "/page3",
];

/** 首页路径，关闭所有标签后跳转到此路径 */
export const homePath = "/page1";

/**
 * 标签数量上限
 * 超过上限时，会自动关闭最早打开的标签
 * 设置为 0 或负数表示不限制
 */
export const maxTabs = 10;

/** 检查路由是否需要 keep-alive */
export function shouldKeepAlive(path: string): boolean {
  return keepAliveRoutes.includes(path);
}
```

**配置说明：**

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `keepAliveRoutes` | `string[]` | 需要缓存的路由列表 |
| `homePath` | `string` | 首页路径，关闭全部标签后跳转到此 |
| `maxTabs` | `number` | 标签数量上限，超过时自动关闭最早的标签 |

**使用方式：**
- `keepAliveRoutes` 中的路由会被缓存，切换后保留状态
- 不在列表中的路由每次切换都会重新渲染
- 当标签数量超过 `maxTabs` 时，自动关闭最早打开的标签

---

### 2. Context 和生命周期 Hooks `context.ts`

#### KeepAlive Context

提供标签页操作方法：

```typescript
interface KeepAliveContextValue {
  closeTab: (path: string) => void;      // 关闭指定标签
  closeOtherTabs: () => void;            // 关闭其他标签
  closeAllTabs: () => void;              // 关闭全部标签
  getTabs: () => string[];               // 获取标签列表
  currentPath: string;                   // 当前路径
}
```

#### 生命周期 Hooks

```typescript
// 页面激活时触发
useActivate(() => {
  console.log("页面被激活了");
  // 适合：刷新数据、恢复定时器
});

// 页面失活时触发
useDeactivate(() => {
  console.log("页面被隐藏了");
  // 适合：保存草稿、暂停定时器、取消请求
});
```

**实现原理：**

```typescript
export function useActivate(callback: () => void) {
  const { isActive } = useKeepAliveLifecycle();
  const isFirstRender = useRef(true);
  const callbackRef = useRef(callback);

  useEffect(() => {
    // 首次渲染时触发
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (isActive) callbackRef.current();
      return;
    }
    // 后续变为激活状态时触发
    if (isActive) callbackRef.current();
  }, [isActive]);
}
```

---

### 3. 主组件 `index.tsx`

#### 核心状态

```typescript
// 缓存的页面内容 { "/page1": <Page1 />, "/page2": <Page2 /> }
const [cache, setCache] = useState<Record<string, React.ReactNode>>({});

// 标签页历史记录（按访问顺序）
const [tabHistory, setTabHistory] = useState<string[]>([]);

// 滚动位置记录
const scrollMap = useRef<Record<string, number>>({});
```

#### 缓存更新逻辑

```typescript
useEffect(() => {
  // 只缓存 keep-alive 路由
  if (!shouldKeepAlive(pathname) || !outlet) return;

  // 使用 ref 检查避免无限循环
  if (!cacheRef.current[pathname]) {
    setCache((prev) => ({
      ...prev,
      [pathname]: outlet,
    }));
  }
}, [pathname, outlet]);
```

#### 渲染逻辑

```tsx
<div className={styles.container}>
  {/* 1. 渲染缓存的 keep-alive 页面 */}
  {Object.entries(cache).map(([path, element]) => (
    <Activity key={path} mode={pathname === path ? "visible" : "hidden"}>
      <LifecycleContext.Provider value={{ isActive: pathname === path }}>
        <div className={styles.pageWrapper}>
          {element}
        </div>
      </LifecycleContext.Provider>
    </Activity>
  ))}

  {/* 2. 渲染非 keep-alive 的当前页面 */}
  {!shouldKeepAlive(pathname) && outlet && (
    <div className={styles.pageWrapper}>{outlet}</div>
  )}
</div>
```

**关键点：**
- 缓存页面用 `<Activity>` 包裹，根据当前路径切换 `mode`
- 非缓存页面直接渲染 `outlet`，每次切换重新创建

---

### 4. 标签页操作

#### 关闭标签

```typescript
const closeTab = useCallback((path: string) => {
  // 1. 从缓存和历史记录中移除
  setCache((prev) => { delete newCache[path]; return newCache; });
  setTabHistory(prev => prev.filter(p => p !== path));

  // 2. 如果关闭当前页，导航到前一个页面
  if (path === currentPath) {
    if (newHistory.length > 0) {
      history.push(newHistory[newHistory.length - 1]);
    } else {
      history.push(homePath);
    }
  }
}, []);
```

#### 关闭全部

```typescript
const closeAllTabs = useCallback(() => {
  setCache({});
  setTabHistory([]);

  // 导航到首页
  if (currentPath !== homePath) {
    history.replace(homePath);
  } else {
    // 已在首页，手动恢复首页标签
    setTabHistory([homePath]);
    if (shouldKeepAlive(homePath)) {
      setCache({ [homePath]: currentOutlet });
    }
  }
}, []);
```

---

## 使用示例

### 页面中使用

```tsx
import {
  useActivate,
  useDeactivate,
  useKeepAliveContext
} from "@/layouts/keep-alive-layout";

export default function Page1() {
  const [value, setValue] = useState("");
  const { closeTab, closeOtherTabs, closeAllTabs } = useKeepAliveContext();

  useActivate(() => {
    console.log("Page1 激活了");
  });

  useDeactivate(() => {
    console.log("Page1 隐藏了");
  });

  return (
    <div>
      <input value={value} onChange={e => setValue(e.target.value)} />
      <button onClick={() => closeTab("/page2")}>关闭 Page2</button>
      <button onClick={() => closeOtherTabs()}>关闭其他</button>
      <button onClick={() => closeAllTabs()}>关闭全部</button>
    </div>
  );
}
```

---

## 注意事项

### 1. React 版本要求

`<Activity>` 是 React 19 的实验性 API，需要 React 19.2+ 版本。

```bash
# 安装 React 19 Canary
pnpm add react@canary react-dom@canary
```

### 2. UmiJS 配置

UmiJS 4.x 默认使用 React 18，需要配置升级。

### 3. 性能考量

虽然 `<Activity>` 降低了隐藏页面的 CPU 开销，但：
- 内存占用仍然存在（DOM 保留在内存中）
- 建议对标签数量设置上限
- 复杂页面可以在 `useDeactivate` 中清理资源

---

## 总结

| 功能 | 实现方式 |
|------|----------|
| 页面缓存 | `cache` 状态存储 outlet |
| 性能优化 | React 19 `<Activity>` 暂停渲染 |
| 生命周期 | `LifecycleContext` + `useActivate/useDeactivate` |
| 标签管理 | `tabHistory` 状态 + `closeTab` 等方法 |
| 滚动恢复 | `scrollMap` ref 记录位置 |
| 路由白名单 | `keepAliveRoutes` 配置 |
| 标签上限 | `maxTabs` 配置，超出自动关闭旧标签 |

这套实现充分利用了 React 19 的新特性，在保证功能完整的同时，显著降低了多标签页场景的性能开销。
