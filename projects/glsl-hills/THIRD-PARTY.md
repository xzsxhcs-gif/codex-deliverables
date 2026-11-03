# 第三方来源与许可证

本项目保留以下第三方代码、组件、图标与字体的来源信息。依赖的具体版本由 `package-lock.json` 锁定；以下清单不改变各依赖原有许可证。已随附的依赖许可文本位于 [`licenses/`](./licenses/)，噪声许可保留于着色器源码。

| 项目 | 用途 | 许可证 | 来源 |
| --- | --- | --- | --- |
| Ashima Arts / Ian McEwan、Stefan Gustavson，webgl-noise | 3D simplex noise；项目增加解析梯度与地形组合 | MIT | [源码与版权说明](https://github.com/ashima/webgl-noise) |
| Three.js | WebGL 渲染、相机、几何体与资源管理 | MIT | [仓库](https://github.com/mrdoob/three.js) · [许可证](https://github.com/mrdoob/three.js/blob/dev/LICENSE) |
| React、React DOM | UI 与组件生命周期 | MIT | [仓库](https://github.com/facebook/react) · [许可证](https://github.com/facebook/react/blob/main/LICENSE) |
| shadcn/ui | `radix-nova` 按钮与滑块组件基础 | MIT | [仓库](https://github.com/shadcn-ui/ui) · [许可证](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md) |
| Radix UI Primitives | 可访问滑块与组件基础 | MIT | [仓库](https://github.com/radix-ui/primitives) · [许可证](https://github.com/radix-ui/primitives/blob/main/LICENSE) |
| Lucide | 界面图标 | ISC | [仓库](https://github.com/lucide-icons/lucide) · [许可证](https://github.com/lucide-icons/lucide/blob/main/LICENSE) |
| Tailwind CSS | 样式与 Vite 集成 | MIT | [仓库](https://github.com/tailwindlabs/tailwindcss) · [许可证](https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE) |
| Geist | 本地打包的 Geist 可变字体 | SIL Open Font License 1.1 | [字体仓库](https://github.com/vercel/geist-font) · [许可证](https://github.com/vercel/geist-font/blob/main/OFL.txt) |
| Fontsource Variable Geist | Geist 字体的 npm 分发 | 字体为 SIL OFL 1.1 | [分发包](https://www.npmjs.com/package/@fontsource-variable/geist) · [Fontsource](https://github.com/fontsource/fontsource) |
| Vite | 开发服务器与生产打包 | MIT | [仓库与许可证](https://github.com/vitejs/vite) |
| TypeScript | 严格类型检查 | Apache-2.0 | [仓库与许可证](https://github.com/microsoft/TypeScript) |

`src/lib/shaders/terrain-vertex.glsl` 保留 webgl-noise 的版权与完整 MIT 许可文本。其原始作者为 Ashima Arts / Ian McEwan 和 Stefan Gustavson；本项目的改动包括解析导数、噪声层组合、地形位移与法线计算。

Geist 随构建输出提供，不从远程字体服务请求。其字体软件受 SIL OFL 1.1 约束，应用代码的许可不会替代字体许可。

其他传递依赖请同时参阅对应 npm 包内的 LICENSE、NOTICE 与 `package-lock.json`。
