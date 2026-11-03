# 来源与第三方声明

## 用户提供的参考

- `reference/synthetic-clawd-original.html`：来自用户上传的 `synthetic-clawd-2-bilingual-tumble-full-reset.zip`，作为本次增量开发的原始游戏。
- `reference/ActionWeaponKit/`：来自用户上传的 `ParkourPrototype-Action-Weapon-Kit.zip`。附件文档明确描述其为独立重写的精简 Unity 模块，不是原版游戏源码恢复。

这两份附件没有提供整体开源许可证。本工程不替它们声明未经授予的新许可证。`Clawd` 名称及原游戏角色识别来自用户提供的游戏；本项目不宣称与任何品牌存在官方合作。

## 本次生成的内容

蟹王 3D 模型、竞技场、权杖、泡泡、地面预警、动画与双语战斗界面由本次项目代码生成。战斗音效通过 Web Audio 振荡器与包络合成；原合成游戏音效继续使用附件中的程序。不包含外部下载的模型、图片、视频、字体或录音。界面使用系统字体。

## Three.js

运行时 3D 库为 [Three.js](https://threejs.org/)，包括同包 `RoundedBoxGeometry`。锁定版本以 `package-lock.json` 为准。其 MIT 许可证原文如下：

> The MIT License
>
> Copyright © 2010-2026 three.js authors
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> THE SOFTWARE.

## 开发工具

Vite、TypeScript、tsx、类型声明与它们的依赖用于构建或测试。其准确版本由 `package-lock.json` 记录，安装包内的各自许可证继续适用。可选浏览器检查使用 Python Playwright 与 Chromium，它们不是游戏运行时依赖。
