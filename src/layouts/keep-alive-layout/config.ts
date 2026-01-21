/**
 * KeepAlive 配置
 */

/** 需要 keep-alive 的路由列表 */
export const keepAliveRoutes: string[] = [
	"/page1",
	"/page2",
	"/page3",
];

/** 首页路径，关闭所有标签后跳转到此路径 */
export const homePath = "/page1";

/**
 * 标签数量上限
 * 超过上限时，会自动关闭最早打开的标签
 * 设置为 0 或负数表示不限制
 */
export const maxTabs = 2;

/**
 * 检查路由是否需要 keep-alive
 */
export function shouldKeepAlive(path: string): boolean {
	return keepAliveRoutes.includes(path);
}
