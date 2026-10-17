# SNICKERS：文明的底层代码

一根由代码绘制的士力架，被拆成八个字母，再展开成一部没有必要的文明史。

作品为 50 秒、9:16 竖屏、1080×1920、30 FPS。包装及字样使用手工编写的矢量轮廓和投影几何；所有文明符号、粒子及转场都由这些轮廓派生。未下载或导入任何士力架图片、包装照片、现成视频或音乐。章节字体使用随工程提供的 Noto 字体子集，许可证见 `public/fonts/LICENSE.txt`。SNICKERS 字样本身不使用字体。

## 运行预览

需要 Node.js 22.12 以上、Python 3.10 以上与 FFmpeg。

```bash
npm ci
python -m pip install -r requirements.txt
npm run audio
npm run dev
```

打开终端显示的 Vite 地址，点击播放。可以拖动时间轴，或通过 `?t=23.2` 查看精确时刻。源工程压缩包含已生成音轨，可跳过音频生成；从 GitHub 克隆时先执行 `npm run audio`。

## 输出视频与帧

```bash
npm run build
npm run render
npm run verify
npm run stills
npm run render -- --frame 23.2 --output output/frame-23.2.png
```

默认视频位于 `output/snickers-civilization.mp4`。原生 Canvas 将逐帧 RGBA 数据流式交给 FFmpeg，输出 H.264 / yuv420p、BT.709、AAC 48 kHz 双声道及 faststart MP4。无需保存 1,500 张中间 PNG。导出过程中写入进度、源文件哈希与最终文件校验值。

```bash
# 小尺寸审片，保留完整时间线和声音
npm run render -- --width 540 --height 960 --output output/preview.mp4
```

## 时间与视觉结构

| 时间 | 镜头 |
| --- | --- |
| 0–6.4 秒 | 色块、轮廓与包装的生成 |
| 6.4–16 秒 | 识别、拆解、漫画分格、切片与字母基因 |
| 16–32 秒 | 图腾、纹样、几何、星轨、徽章、公式、电路、信息文明 |
| 32–44.8 秒 | 文明档案折叠、字形特写、轮廓粒子收束与完整包装重组 |
| 44.8–50 秒 | 音乐骤停；普通包装、冷淡收尾；最后半秒纯黑静音 |

150 BPM，每拍 0.4 秒。主要剪辑点与合成音轨共享绝对时间。`renderFilm(ctx,t)` 不依赖上一帧、真实时间或未固定种子的随机值；浏览器和离线导出直接调用同一实现。画布内部始终采用 1080×1920 设计坐标，可按比例输出其他分辨率。

## 文件结构

- `src/visuals/brand.ts`：八个手绘字母路径、包装投影、共享字形采样。
- `src/scenes/origin.ts`：生成、识别与最后的静置镜头。
- `src/scenes/civilization.ts`：从同一组字形顶点派生的八阶段演化。
- `src/scenes/reassembly.ts`：折叠、采样点汇聚与准确的字样复位。
- `src/film.ts`：完整时间线、卡点与最终画面处理。
- `src/main.ts`：响应式预览、音画播放和精确时间捕获。
- `scripts/audio.py`：原创鼓组、低音、和声、旋律和声音设计。
- `scripts/render.mjs`、`stills.mjs`、`verify.py`：导出、审片及验证。

音轨由固定种子和振荡器、噪声、滤波及包络合成，细节和实际响度记录见 `audio-notes.md`。字体子集已经打包；如新增汉字，可在安装 Noto CJK 的环境中执行 `python scripts/fonts.py` 重建。

## 交付

[v1 完整交付与下载](https://github.com/xzsxhcs-gif/codex-deliverables/releases/tag/snickers-civilization-v1)：MP4、包含已生成音轨的完整源工程、24-bit WAV、审片材料与 SHA-256 校验文件。

最终 MP4 为 22,225,924 字节；50 秒、1,500 帧。通过 21 项媒体检查与 13 项 Chromium 预览／播放检查。已从成片抽取 33 个关键时刻进行视觉检查；完整结果见 [REVIEW.md](REVIEW.md)。

浏览器检查需安装 Chromium；预览服务器运行时执行 `node scripts/browser-verify.mjs`。可以通过 `CHROMIUM` 环境变量指定浏览器可执行文件。
