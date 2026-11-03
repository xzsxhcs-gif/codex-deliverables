# GLSL Hills

可交互的实时生成山丘：以 Three.js 与 GLSL 绘制连续变化的地形，提供三套配色、相机探索、参数调节与沉浸视图。页面不需要 API 密钥、账户或后端服务。

使用 React 19、严格模式 TypeScript 7、Vite 8、Tailwind CSS 4，以及 shadcn/ui 4 CLI 生成的 `radix-nova` 组件。Geist 可变字体随应用本地打包，不依赖在线字体服务。

## 本地运行

需要 Node.js 22.12+（或 20.19+）及 npm，在项目目录执行：

```sh
npm ci
npm run dev
```

生产构建与预览：

```sh
npm run build
npm run preview
```

`dist/` 是常规静态网站产物，部署到静态 HTTP 服务即可；本地请通过预览服务器访问。

## 单文件交付

```sh
npm run build:standalone
```

此命令先生成正式构建，再运行 `scripts/make-standalone.mjs`，输出 `standalone/GLSL-Hills.html`。该文件将同一应用的 JavaScript、CSS 与字体内联，运行时无需外部资源。允许本地脚本的浏览器可直接打开；若浏览器策略限制本地文件，请通过静态 HTTP 服务访问。本次环境的 `file://` 导航被管理员策略禁止，单文件运行通过 HTTP 另行核验，不把它写成本地文件导航实测。

## 操作

| 操作 | 效果 |
| --- | --- |
| 鼠标拖动／单指拖动 | 调整观察方向 |
| 鼠标移动 | 轻微视差 |
| 滚轮／双指缩放 | 拉近或推远视角 |
| `Space` | 暂停或继续地形动画 |
| `R`／Reset view | 恢复初始视角 |
| `F`／右上角展开按钮 | 进入或退出沉浸视图 |
| `Escape`／双击／触屏双击 | 退出沉浸视图 |
| 聚焦画布后的方向键、`+` / `-` | 调整视角与距离 |

沉浸视图使用可用的 Fullscreen API；浏览器不支持或拒绝时保留 CSS 沉浸视图。进入后显示约 2.6 秒的退出提示；键盘用户也可聚焦隐藏的退出按钮。设置面板可用 `Escape` 关闭。

设置包含 Monochrome、Glacier、Dusk 三套配色，以及速度 `0–1.5`、地形高度 `0.35–1.7`、细节 `0–1.5`。暂停或速度归零会冻结 `uTime`，仍可探索相机、切换主题和调节地形。Reset settings 恢复参数与视角。

系统启用 `prefers-reduced-motion` 时初始暂停并关闭鼠标悬停视差；用户仍可明确点击播放。按钮、滑块、主题选择与画布支持键盘操作，WebGL 不可用时显示静态提示。

## 复用组件

公开组件位于 `@/components/ui/glsl-hills`，使用 `forwardRef`，无需依赖页面控制面板：

```tsx
import { GLSLHills } from '@/components/ui/glsl-hills'

<GLSLHills width="100%" height="100dvh" theme="glacier" speed={0.5} />
```

| 属性 | 类型／默认值 |
| --- | --- |
| `width`、`height` | CSS 尺寸；`'100%'`、`'100dvh'` |
| `cameraZ`、`planeSize` | 数字；`125`、`256` |
| `speed`、`terrainHeight`、`detail` | 数字；`0.5`、`1`、`0.55` |
| `theme` | `'monochrome' \| 'glacier' \| 'dusk'`；`'monochrome'` |
| `paused` | 可选布尔值；省略时跟随减少动态效果偏好 |
| `quality` | `'auto' \| 'high' \| 'medium' \| 'low'`；`'auto'` |
| `className` | 可选容器类名 |
| `onReady`、`onError` | 可选就绪回调、错误回调 |

`GLSLHillsHandle` 提供 `resetView()` 与 `getDiagnostics()`。`height` 控制组件尺寸，`terrainHeight` 控制地形振幅。页面容器高为 `100dvh`，嵌入时可给出固定高度；`ResizeObserver` 会同步实际容器尺寸与相机比例。

## 渲染与资源管理

顶点着色器组合三层相干 3D simplex noise（频率 `0.08 / 0.06 / 0.40`，空间域缩放 `0.32`）、正弦包络和平方正弦山脊，并使用解析梯度生成平滑法线。片元着色器包含主光、补光、高光与距离雾；雾在色调映射后混合，再转换输出色彩空间，使远景与背景自然衔接。

高／中／低画质分别使用 `192 / 128 / 96` 网格细分，像素比上限分别为 `1.75 / 1.5 / 1.25`；触屏高画质上限为 `1.5`。自动模式在粗指针设备从中画质起步，持续慢帧时降低细分。后台标签页、屏幕外和零尺寸容器停止绘制；暂停且状态稳定时不持续申请动画帧。

组件卸载会取消动画帧，断开观察器，移除事件监听器，并释放几何体、材质与渲染器。开发模式适配 React StrictMode 的挂载与卸载检查。

## 检查与适用范围

浏览器检查需先在另一个终端保持 `npm run dev` 运行，默认连接 `http://127.0.0.1:5173`：

```sh
npm run typecheck
npm run lint
npm run build
npm run test:browser
```

浏览器检查使用 Python 3、Playwright 与 Pillow。缺少依赖时安装：

```sh
python3 -m pip install playwright Pillow
python3 -m playwright install chromium
```

已安装兼容 Chromium 时可用 `BROWSER_PATH` 指定可执行文件，无需重复下载。脚本依次采用该设置、现有的 `/usr/bin/chromium`、Playwright 自带浏览器。

可通过 `BASE_URL` 修改开发服务器地址，通过 `OUTPUT_DIR` 修改报告与截图目录（默认 `/workspace/output/glsl-hills/qa`）。检查脚本见 `qa/browser_check.py`；交付时的检查记录见 `verification/browser-report.json`。

浏览器自动化的执行范围为 Chromium 与软件渲染 SwiftShader；移动视口和触屏模拟不能代替真机测试。实体 Android、iPhone 与 Safari 尚未验证，实际流畅度取决于浏览器、GPU、分辨率和电源状态，未作未经硬件测量的 60 FPS 保证。

第三方来源、许可证及保留的版权说明见 [THIRD-PARTY.md](./THIRD-PARTY.md)。
