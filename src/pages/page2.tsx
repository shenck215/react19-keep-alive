import { useState } from "react";
import {
	useActivate,
	useDeactivate,
	useKeepAliveContext,
} from "@/layouts/keep-alive-layout";

export default function Page2() {
	const [value, setValue] = useState("");
	const { closeTab, closeOtherTabs, closeAllTabs, getTabs } =
		useKeepAliveContext();

	useActivate(() => {
		console.log("[Page2] 页面被激活了");
	});

	useDeactivate(() => {
		console.log("[Page2] 页面被隐藏了");
	});

	return (
		<div>
			<h2>页面2</h2>
			<div style={{ marginBottom: "16px" }}>
				<label>输入测试：</label>
				<input
					value={value}
					onChange={(e) => setValue(e.target.value)}
					placeholder="输入内容后切换页面..."
					style={{ marginLeft: "8px", padding: "4px 8px" }}
				/>
			</div>

			<div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
				<button onClick={() => closeTab("/page1")}>关闭 Page1</button>
				<button onClick={() => closeOtherTabs()}>关闭其他标签</button>
				<button onClick={() => closeAllTabs()}>关闭全部标签</button>
			</div>

			<div style={{ marginBottom: "16px", color: "#666" }}>
				当前打开的标签：{getTabs().join(", ") || "无"}
			</div>

			<div
				style={{
					height: "800px",
					background: "linear-gradient(180deg, #54a0ff, #2e86de)",
					borderRadius: "8px",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "#fff",
					fontSize: "24px",
				}}
			>
				Page2 Content - 滚动测试区域
			</div>
		</div>
	);
}
