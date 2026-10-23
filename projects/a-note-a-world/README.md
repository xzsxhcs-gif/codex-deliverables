# 一音成境 / A Note, A World

一部由原创音乐《微光归途》生长出来的程序化音乐短片：小助手放下第一个音符，乐曲逐渐成为山脉、河流与星空，最后重新折回完整乐谱。

成片规格：**1920×1080、30 FPS、2,812帧、93.733333秒，H.264 / yuv420p + AAC 48kHz立体声，MP4**。原曲的旋律、配器、速度与混音保持不变；片头增加3.7秒静音，留给提问与首音动作。

## 文件与故事

| 文件／目录 | 内容 |
|---|---|
| `final_video.mp4` | 可直接播放的完整高清视频 |
| `final_music.wav` | 影片音乐母带，48kHz、16-bit PCM、立体声；独立下载或由源音乐重建 |
| `final_music.mid` | 与影片共用时间原点的完整MIDI总谱 |
| `notes.json` | 643个音符、九个声部、拍线、分段与准确影片时间 |
| `source/` | 原创场景、离线渲染程序、完整作曲工程、音色、字体和依赖许可 |
| `previews/` | 低清完整预览、关键帧、性能记录及检查报告 |
| `render.bat` | Windows依赖检查与一键重渲染入口 |
| `music-preparation.json` | PCM保留、统一偏移与MIDI时序核验记录 |
| `QA.json` / `VISUAL-REVIEW.md` | 正式成片技术验收及画面审查；以实际交付报告为准 |

五幕共用同一条连续镜头：

1. **诞生，0:00–0:14.67。** 黑底提问，原创折翼陶瓷助手入场；影片4.00327秒的钢琴首音与放置动作相遇。
2. **创造，0:14.67–0:36。** 大提琴、弦乐等声部加入，助手分出协作者，音符按真实时刻写入共享时间轴。
3. **突破，0:36–0:57.33。** 乐轨进入纵深，音符脱离谱面；同一组坐标连续变为三维路径。
4. **世界，0:57.33–1:18.67。** F♯–A–D主题控制三座主峰，低声部与和声塑造河道／湖泊，竖琴等声部的音符成为微光；最初的种子长成远处的光树。
5. **回归，1:18.67–1:33.73。** 镜头升高后退，山川与星点重新成为线条，完整乐谱和最初的助手留下，随尾音淡黑。

助手、动画和世界造型均为本片原创。没有使用参考原作的角色、原曲、现成风景视频或未公开的视频渲染源码。

## 下载与源工程包

高清视频与影片WAV母带分别交付。源工程ZIP为避免重复，不包含 `final_video.mp4` 与根目录 `final_music.wav`；它保留完整 `source/music/song.wav`、SoundFont、MIDI、音符事件、场景代码与重建脚本。解压后，在工程根目录运行以下命令即可重建影片音乐并启动浏览器预览，无需重新合成管弦乐：

```bash
python -m pip install -r source/requirements.txt
python source/prepare_music.py
python -m http.server 8090
```

正式成片另提供720p及360p完整兼容副本，便于手机或低带宽下载；故事、帧率和时长与1080p一致。交付目录中的文件清单及SHA-256用于核对下载完整性。

## 本地预览

若工程根目录已有 `final_music.wav`、`notes.json` 和 `music_features.json`，直接启动静态服务器：

```bash
python -m http.server 8090
```

打开 <http://localhost:8090/source/index.html>。点击“播放”可同步试听；拖动时间条可检查任意位置。`?t=66` 定位到影片66秒。浏览器需要支持WebGL2；预览速度取决于设备。

播放器使用实时音频时钟，**正式导出不录屏**。离线渲染逐帧调用 `renderAt(n / 30)`，使用明确时间，不依赖机器跑得多快。

## 重新渲染

需要Python 3.10+与完整FFmpeg（`ffmpeg`、`ffprobe`均在PATH）。Three.js和中文字体已随工程保存，不需要Node、账号或付费API。

Windows可直接双击 `render.bat`。它会创建本工程的 `.venv`，在缺少依赖时安装免费Python包，并检查／下载Playwright Chromium，再生成影片音乐并逐帧渲染。首次安装需要联网；场景本身只读取本地资源。可用 `render.bat --preview` 输出低清预览。

手动执行（Linux/macOS激活方式如下；Windows使用 `.venv\Scripts\activate`）：

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r source/requirements.txt
python -m playwright install chromium
python source/prepare_music.py
python source/render_film.py --preview
python source/render_film.py
python source/verify_film.py --video final_video.mp4
```

本次实际运行环境是Linux、Chromium与SwiftShader软件WebGL；未声称完成Windows实机测试。Windows默认使用浏览器GPU后端；兼容性排查时可传入 `--softwaregl`。现有Linux系统Chromium会优先使用，也可用 `--browser` 指定路径。

常用检查命令：

```bash
python source/render_film.py --stills --times 4.05 36 49 64 78.7 87 90.3
python source/render_film.py --benchmark --times 4.1 24 48 66 82
python source/verify_film.py --video previews/preview.mp4 --width 640 --height 360 --report previews/preview-QA.json
```

正式输出默认CRF18，预览为640×360、CRF22；两者都是完整时间线。中间画面分为180帧一段，保存在 `.render-cache/`。重复相同命令会校验并复用完整分段；源码、音乐、浏览器或输出设置改变时采用新的内容指纹，不会把旧版本分段混进新片，也不会删除旧缓存。未完成的单个分段会重做。

## 共用时钟与音乐重建

`final_music.wav` 前177,600个采样帧为3.7秒静音，其后是原曲4,321,428个采样帧，逐字节保留；末尾补172个零采样帧，使总长恰好等于2,812个视频帧。这里的172是**音频采样帧**，不是172个视频帧。

根目录 `notes.json` 的音符、控制器、拍线和分段均已平移3.7秒，MIDI同步平移2,664 ticks；渲染器直接使用影片秒数，不能再加一次片头偏移。源数据留在 `source/music/`，最终数据另保留 `source_t0` 等溯源字段。详见 [source/PIPELINE.md](source/PIPELINE.md)。

音乐是D大调／关系B小调、32小节，90 BPM，最后四小节渐慢至70 BPM。钢琴、大提琴、小提琴、弦乐合奏、长笛、圆号、竖琴、定音鼓和轻钹由GeneralUser GS合成。重新渲染画面不需要重新作曲，也不需要C编译器。

若需要从音符重新合成原曲，另安装GCC/MinGW或MSVC等C编译器，并按 [作曲工程说明](source/music/README.md) 准备NumPy/SciPy：

```bash
cd source/music
python score.py
cd ../..
python source/prepare_music.py
python source/render_film.py
```

## 场景源文件

- `source/workspace.js`：中文文字、原创助手、协作动作和共享时间轴。
- `source/landscape.js`：音乐派生的地形、河湖、光树、云与表面细节。
- `source/main.js`：二维／三维连续变形、确定性镜头、音符星点与画面收尾。
- `source/prepare_music.py`：保留原音乐、统一时钟与帧边界。
- `source/render_film.py`：Playwright逐帧捕获、分段恢复、FFmpeg编码和音频合成。
- `source/verify_film.py`：文件格式、完整解码、帧数、音画互相关、MIDI与PCM检查。

关键帧和连续运动需要直接审查；运行成功或数值检查通过不能证明构图没有问题。正式验收以 `QA.json`、`VISUAL-REVIEW.md` 与实际MP4为准，不把代码分析等同于真人主观听审。

参考与许可详见 [REFERENCE-RESEARCH.md](REFERENCE-RESEARCH.md) 和 [LICENSES.md](LICENSES.md)。原始作曲参考仓库及上一任务的原创音乐目录均未修改。约定的GitHub交付位置为 `xzsxhcs-gif/codex-deliverables` 的 `projects/a-note-a-world/` 与 `deliverables/a-note-a-world-v1/`；实际上传及远端文件核验由交付记录说明。

源工程打包时省略 `.render-cache/`、依赖安装目录和历史失败测试；保留终版360p完整预览、实际编码关键帧及画面复核证据。`SOURCE-MANIFEST.json`逐项记录源包内容，`PORTABLE-CHECK.json`记录独立解压与真实音乐重建。公开下载校验由交付目录单独记录，避免把网络发布结果写进需要先生成的源码快照。
