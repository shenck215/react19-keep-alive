import { createContext, useContext, useEffect, useRef } from "react";

// KeepAlive Context 类型定义
export interface KeepAliveContextValue {
	/** 关闭指定标签页（包括当前页），关闭后自动导航到前一个页面 */
	closeTab: (path: string) => void;
	/** 关闭其他标签页（保留当前页） */
	closeOtherTabs: () => void;
	/** 关闭全部标签页，导航到首页 */
	closeAllTabs: () => void;
	/** 获取当前打开的标签页列表（按打开顺序） */
	getTabs: () => string[];
	/** 当前激活的路径 */
	currentPath: string;
}

// 创建 Context
export const KeepAliveContext = createContext<KeepAliveContextValue | null>(
	null
);

/**
 * 获取 KeepAlive 标签页控制方法
 * @example
 * const { closeTab, closeOtherTabs, closeAllTabs, getTabs, currentPath } = useKeepAliveContext();
 * // 关闭指定标签页
 * closeTab('/page2');
 * // 关闭其他标签页
 * closeOtherTabs();
 * // 关闭全部标签页
 * closeAllTabs();
 */
export function useKeepAliveContext() {
	const context = useContext(KeepAliveContext);
	if (!context) {
		throw new Error(
			"useKeepAliveContext must be used within KeepAliveLayout"
		);
	}
	return context;
}

// 生命周期 Context
interface LifecycleContextValue {
	/** 当前页面是否激活 */
	isActive: boolean;
}

export const LifecycleContext = createContext<LifecycleContextValue>({
	isActive: true,
});

/**
 * 获取当前页面的激活状态
 * @example
 * const { isActive } = useKeepAliveLifecycle();
 */
export function useKeepAliveLifecycle() {
	return useContext(LifecycleContext);
}

/**
 * 页面激活时的回调 Hook
 * @param callback 激活时执行的回调函数
 * @example
 * useActivate(() => {
 *   console.log('页面被激活了');
 *   // 重新请求数据等操作
 * });
 */
export function useActivate(callback: () => void) {
	const { isActive } = useKeepAliveLifecycle();
	const isFirstRender = useRef(true);
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		// 首次渲染时也触发激活回调
		if (isFirstRender.current) {
			isFirstRender.current = false;
			if (isActive) {
				callbackRef.current();
			}
			return;
		}

		// 后续变为激活状态时触发
		if (isActive) {
			callbackRef.current();
		}
	}, [isActive]);
}

/**
 * 页面失活时的回调 Hook
 * @param callback 失活时执行的回调函数
 * @example
 * useDeactivate(() => {
 *   console.log('页面被隐藏了');
 *   // 暂停定时器、保存草稿等操作
 * });
 */
export function useDeactivate(callback: () => void) {
	const { isActive } = useKeepAliveLifecycle();
	const prevActiveRef = useRef(isActive);
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		// 从激活变为失活时触发
		if (prevActiveRef.current && !isActive) {
			callbackRef.current();
		}
		prevActiveRef.current = isActive;
	}, [isActive]);
}
