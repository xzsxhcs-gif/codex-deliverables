# 短波夜班 · Shortwave Night Shift

38 秒，124 BPM，9∶16 竖屏。原创器乐拆轨短片。一个深夜短波台的操作员在调音台上敲出第一拍，五条声部沿同一条时间线展开。

| 入点 | 编曲 |
| --- | --- |
| 0.00 秒 | 鼓和 FX 开场。短促的电台提示音与切分底鼓问答，军鼓守住反拍。 |
| 7.74 秒 | 有滑音的合成贝斯进入，给底鼓收出空间。 |
| 15.48 秒 | 加入玻璃质感的扩展和弦，第一组和弦落在弱拍。 |
| 23.23 秒 | 簧片音色主奏唱出四小节主题，替代人声。 |
| 30.97 秒 | 全轨合流，主奏加倍、加花踩镲与高声部回应进入。最后落回 A 小调主和弦。 |

## 制作

角色、背景、设备、动作、旋律和音色均为本片原创。音乐由振荡器、滤波器、噪声合成和逐事件编排完成。每个波形列来自对应声轨的实际 PCM 峰值。声部先通过相同的总线增益曲线，再单独量化输出，五个文件从零点对齐，即可重新叠回混音。参考视频的分轨顺序来自委托描述。[参考链接](https://b23.tv/mT3TbrL)

- `art/operator.svg` 包含手绘路径与关节的占位变换令牌，由插画脚本在渲染时写入姿势。
- `source/score.py` 生成五条立体声 WAV、混音、事件表和峰值缓存。
- `source/illustration.py` 和 `source/svg_raster.py` 绘制角色、背景及调音台。`source/film.py` 负责镜头、中文排版、两小节滚动波形和最终编码。
- `source/verify.py` 检查编码、时长、解码音频与原混音的相关性、逐轨入点及关键帧。`qa/` 保存检验结果和关键帧。

## 重新渲染

在工程根目录执行。使用 Python 3、NumPy、SciPy、Pillow、系统 FFmpeg（含 libx264）、Cairo 和 librsvg。字体使用 Debian 的 DejaVu Sans Mono、Nimbus Sans Narrow 和 Noto Sans CJK SC，其他系统可以调整 `source/film.py` 中的路径。

```sh
python source/score.py
python source/film.py --scale 1 --stills
python source/film.py
python source/verify.py
```

默认输出 `render/shortwave.mp4`，1080 × 1920、30 FPS、H.264、48 kHz AAC 立体声。分轨下载包采用无损 FLAC，均为 38 秒、48 kHz、双声道。若需 WAV，可直接运行作曲脚本。
