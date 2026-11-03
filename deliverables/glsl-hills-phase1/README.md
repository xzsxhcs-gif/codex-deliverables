# GLSL Hills · Phase 1

**完整产品已完成后上传。** 实时WebGL地形由自定义GLSL绘制，未使用地形图片、视频或CSS动画替代。React、严格TypeScript、Vite、Three.js、Tailwind和shadcn/ui源工程均包含在内。

## 下载与打开

- **[下载成品构建包 GLSL-Hills-Build.zip](https://github.com/xzsxhcs-gif/codex-deliverables/raw/c33e30b062b7a5f641f11213595322a8c2073d66/deliverables/glsl-hills-phase1/GLSL-Hills-Build.zip)**
- [下载完整源工程 GLSL-Hills-Source.zip](https://github.com/xzsxhcs-gif/codex-deliverables/raw/c33e30b062b7a5f641f11213595322a8c2073d66/deliverables/glsl-hills-phase1/GLSL-Hills-Source.zip)
- [单文件 GLSL-Hills.html](https://github.com/xzsxhcs-gif/codex-deliverables/raw/c33e30b062b7a5f641f11213595322a8c2073d66/deliverables/glsl-hills-phase1/GLSL-Hills.html)
- [在线浏览源码和README](../../projects/glsl-hills/)

构建包内包含标准`index.html + assets/`静态站点、已内联代码／样式／字体的`GLSL-Hills.html`、许可和`START-HERE.md`。解压后按说明打开。浏览器允许本地脚本时可使用单文件；有本地文件限制时，在解压目录执行`python -m http.server 8080`，访问`http://localhost:8080/GLSL-Hills.html`。标准静态站点已用子目录部署方式实际检查。

源码运行：`npm ci` → `npm run dev`；生产构建：`npm run build`；单文件构建：`npm run build:standalone`。无需API密钥、外部账户、在线字体或付费服务。详细配置与可复用组件API见源工程README。

## 已实现

三套平滑过渡配色、连续相干噪声与解析梯度法线、速度／高度／细节滑块、暂停继续、视角及设置重置；鼠标视差、拖动、滚轮、单指探索和双指缩放；沉浸／原生全屏及降级方式、Escape与双击返回；减少动态效果、键盘与可访问标签；容器ResizeObserver、移动画质、隐藏时停止绘制、完整资源清理和WebGL降级提示。

## 实际验证

- TypeScript检查通过；lint零警告；正式生产构建成功。
- [实际浏览器验收24/24通过](browser-report.json)，覆盖主题、真实shader uniforms、相机、暂停、触控、沉浸、减少动态效果、容器变化和三轮StrictMode清理。
- [生产包与单文件HTTP运行检查](production-report.json)通过；单文件无额外HTTP资源请求。单文件保留第三方字体和库的完整许可。
- [构建记录](build-checks.json) · [人工画面复核](VISUAL-REVIEW.md) · [实际截图联系表](contact-sheet.jpg) · [文件SHA-256](SHA256SUMS.txt)。
- 完整源码包含可再次运行的QA脚本及实际截图，未留下Vite演示界面或未实现控件。

验证范围为Chromium、SwiftShader软件WebGL与移动触控模拟；未做实体Android／iPhone／Safari测试，也未宣称未经硬件测量的60FPS。当前验收浏览器禁止`file://`导航，因此单文件按HTTP运行结果验收。Three.js的单入口包有大于500KB的构建提示，不影响构建成功。

[实际公开下载核验](remote-verification.json)已通过：所有文件大小与SHA-256一致，两份ZIP及完整源码清单校验通过。本次按用户要求通过仓库交付，不以未发布的在线预览地址代替成品文件。
