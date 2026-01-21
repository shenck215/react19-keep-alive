import React, {
	useState,
	useEffect,
	useRef,
	useCallback,
	useMemo,
} from "react";
import { useOutlet, useLocation, Link, history } from "umi";
// 注意：在 React 19.2+ 中直接从 react 导入
import { Activity } from "react";
import styles from "./index.less";
import {
	KeepAliveContext,
	KeepAliveContextValue,
	LifecycleContext,
} from "./context";
import { shouldKeepAlive, homePath, maxTabs } from "./config";

const KeepAliveLayout: React.FC = () => {
	const outlet = useOutlet();
	const { pathname } = useLocation();

	// 1. 存储已访问过的页面元素
	// Key 为路径，Value 为对应的渲染内容
	const [cache, setCache] = useState<Record<string, React.ReactNode>>({});

	// 2. 标签页历史记录（按访问顺序，用于关闭时导航）
	const [tabHistory, setTabHistory] = useState<string[]>([]);

	// 3. 滚动位置记录
	const scrollMap = useRef<Record<string, number>>({});

	// 4. 存储每个页面容器的 ref
	const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});

	// 5. 使用 ref 同步追踪状态，解决闭包问题
	const cacheRef = useRef(cache);
	cacheRef.current = cache;
	const tabHistoryRef = useRef(tabHistory);
	tabHistoryRef.current = tabHistory;
	const pathnameRef = useRef(pathname);
	pathnameRef.current = pathname;
	const outletRef = useRef(outlet);
	outletRef.current = outlet;

	// 6. 关闭标签页
	const closeTab = useCallback((path: string) => {
		const currentPath = pathnameRef.current;
		const currentHistory = tabHistoryRef.current;

		// 从缓存中移除
		setCache((prev) => {
			const newCache = { ...prev };
			delete newCache[path];
			return newCache;
		});

		// 从历史记录中移除
		const newHistory = currentHistory.filter((p) => p !== path);
		setTabHistory(newHistory);

		// 清除滚动位置和容器 ref
		delete scrollMap.current[path];
		delete containerRefs.current[path];

		// 如果关闭的是当前页，需要导航
		if (path === currentPath) {
			if (newHistory.length > 0) {
				// 导航到最后访问的页面
				history.push(newHistory[newHistory.length - 1]);
			} else {
				// 没有标签了，导航到首页
				history.push(homePath);
			}
		}
	}, []);

	// 7. 关闭其他标签页
	const closeOtherTabs = useCallback(() => {
		const currentPath = pathnameRef.current;
		const currentOutlet = cacheRef.current[currentPath];

		// 只保留当前页
		setCache(currentOutlet ? { [currentPath]: currentOutlet } : {});
		setTabHistory(currentPath ? [currentPath] : []);

		// 清除非当前页的滚动位置和容器 ref
		const currentScroll = scrollMap.current[currentPath];
		const currentRef = containerRefs.current[currentPath];

		scrollMap.current = currentScroll !== undefined ? { [currentPath]: currentScroll } : {};
		containerRefs.current = currentRef ? { [currentPath]: currentRef } : {};
	}, []);

	// 8. 关闭全部标签页
	const closeAllTabs = useCallback(() => {
		const currentPath = pathnameRef.current;
		const currentOutlet = outletRef.current;

		// 先清空缓存和历史
		setCache({});
		setTabHistory([]);
		scrollMap.current = {};
		containerRefs.current = {};

		// 同步更新 ref
		cacheRef.current = {};
		tabHistoryRef.current = [];

		// 如果当前不在首页，导航到首页
		// 如果已在首页，需要强制重新添加标签和缓存
		if (currentPath !== homePath) {
			history.replace(homePath);
		} else {
			// 已在首页，手动添加首页标签
			setTabHistory([homePath]);
			// 只有首页需要 keep-alive 时才设置缓存
			if (shouldKeepAlive(homePath) && currentOutlet) {
				setCache({ [homePath]: currentOutlet });
			}
		}
	}, []);

	// 9. 获取当前打开的标签页列表
	const getTabs = useCallback((): string[] => {
		return tabHistoryRef.current;
	}, []);

	// 10. Context 值
	const contextValue = useMemo<KeepAliveContextValue>(
		() => ({
			closeTab,
			closeOtherTabs,
			closeAllTabs,
			getTabs,
			currentPath: pathname,
		}),
		[closeTab, closeOtherTabs, closeAllTabs, getTabs, pathname],
	);

	// 11. 当路径变化时，更新缓存
	useEffect(() => {
		// 检查是否需要 keep-alive
		if (!shouldKeepAlive(pathname) || !outlet) {
			return;
		}

		// 使用 ref 检查，避免 cache 作为依赖导致无限循环
		if (!cacheRef.current[pathname]) {
			setCache((prev) => ({
				...prev,
				[pathname]: outlet,
			}));
		}
	}, [pathname, outlet]);

	// 12. 当路径变化时，更新标签页历史记录
	useEffect(() => {
		// 处理根路径重定向
		if (pathname === "/") {
			history.replace(homePath);
			return;
		}

		// 所有页面都添加标签（不仅仅是 keep-alive 的）
		// 只在标签不存在时才添加（保持原有顺序不变）
		if (!tabHistoryRef.current.includes(pathname)) {
			setTabHistory((prev) => {
				const newHistory = [...prev, pathname];

				// 检查是否超过上限
				if (maxTabs > 0 && newHistory.length > maxTabs) {
					// 关闭最早的标签
					const tabToRemove = newHistory[0];

					// 从缓存中移除
					if (tabToRemove) {
						setCache((prevCache) => {
							const newCache = { ...prevCache };
							delete newCache[tabToRemove];
							return newCache;
						});
						delete scrollMap.current[tabToRemove];
						delete containerRefs.current[tabToRemove];
					}

					// 返回移除后的历史记录
					return newHistory.filter((p) => p !== tabToRemove);
				}

				return newHistory;
			});
		}
	}, [pathname]);

	// 13. 处理恢复滚动位置
	useEffect(() => {
		const container = containerRefs.current[pathname];
		if (container) {
			const savedScroll = scrollMap.current[pathname] || 0;
			requestAnimationFrame(() => {
				container.scrollTop = savedScroll;
			});
		}
	}, [pathname]);

	// 13. 滚动事件处理函数
	const handleScroll = useCallback(
		(path: string) => (e: React.UIEvent<HTMLDivElement>) => {
			scrollMap.current[path] = e.currentTarget.scrollTop;
		},
		[],
	);

	// 14. 设置 ref 的回调函数
	const setContainerRef = useCallback(
		(path: string) => (el: HTMLDivElement | null) => {
			containerRefs.current[path] = el;
		},
		[],
	);

	// 15. 处理关闭标签按钮点击
	const handleCloseTab = useCallback(
		(path: string, e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			closeTab(path);
		},
		[closeTab],
	);

	return (
		<KeepAliveContext.Provider value={contextValue}>
			<div className={styles.keepAliveLayout}>
				<nav className={styles.tabBar}>
					<div className={styles.tabList}>
						{tabHistory.map((path) => {
							const isActive = pathname === path;
							// 从路径中提取标签名称
							const tabName = path.replace("/", "") || "home";
							// 如果只剩最后一个标签且是首页，不显示关闭按钮
							const isLastHomeTab =
								tabHistory.length === 1 && path === homePath;
							return (
								<Link
									key={path}
									to={path}
									className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
								>
									<span className={styles.tabLabel}>{tabName}</span>
									{!isLastHomeTab && (
										<button
											className={styles.tabClose}
											onClick={(e) => handleCloseTab(path, e)}
											title="关闭标签"
										>
											×
										</button>
									)}
								</Link>
							);
						})}
					</div>
					<div className={styles.navLinks}>
						<Link
							to="/page1"
							className={`${styles.navLink} ${pathname === "/page1" ? styles.navLinkActive : ""}`}
						>
							Page1
						</Link>
						<Link
							to="/page2"
							className={`${styles.navLink} ${pathname === "/page2" ? styles.navLinkActive : ""}`}
						>
							Page2
						</Link>
						<Link
							to="/page3"
							className={`${styles.navLink} ${pathname === "/page3" ? styles.navLinkActive : ""}`}
						>
							Page3
						</Link>
					</div>
				</nav>
				<div className={styles.container}>
					{/* 渲染缓存的 keep-alive 页面 */}
					{Object.entries(cache).map(([path, element]) => {
						const isActive = pathname === path;
						return (
							<Activity key={path} mode={isActive ? "visible" : "hidden"}>
								<LifecycleContext.Provider value={{ isActive }}>
									<div
										ref={setContainerRef(path)}
										className={styles.pageWrapper}
										onScroll={handleScroll(path)}
									>
										{element}
									</div>
								</LifecycleContext.Provider>
							</Activity>
						);
					})}
					{/* 渲染非 keep-alive 的当前页面（不缓存，每次切换重新渲染） */}
					{!shouldKeepAlive(pathname) && outlet && (
						<LifecycleContext.Provider value={{ isActive: true }}>
							<div className={styles.pageWrapper}>{outlet}</div>
						</LifecycleContext.Provider>
					)}
				</div>
			</div>
		</KeepAliveContext.Provider>
	);
};

export default KeepAliveLayout;

// 导出 hooks 供页面使用
export {
	useKeepAliveContext,
	useKeepAliveLifecycle,
	useActivate,
	useDeactivate,
} from "./context";
