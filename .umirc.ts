import { defineConfig } from "umi";

export default defineConfig({
	routes: [
		{
			path: "/",
			component: "@/layouts/keep-alive-layout/index", // 包裹层
			routes: [
				{ path: "/", redirect: "/page1" },
				{ path: "/page1", component: "page1" },
				{ path: "/page2", component: "page2" },
				{ path: "/page3", component: "page3" },
			],
		},
	],
	npmClient: "pnpm",
});
