# 音乐与影片共用的时钟

`prepare_music.py` 读取 `source/music/` 中已经完成的《微光归途》，不重新安排音符、不改变速度与混音、不拉伸音频。

```bash
python source/prepare_music.py
python source/verify_film.py --music-only --report previews/music-QA.json
python source/verify_film.py --video previews/preview.mp4 --width 640 --height 360 --report previews/preview-QA.json
python source/verify_film.py --video final_video.mp4
```

首个命令会生成项目根目录的 `final_music.wav`、`final_music.mid`、`notes.json`、`music_features.json`、`music-preparation.json`。源音乐保留在 `source/music/`，可通过 `--music-source` 指定另一个完整源目录。

## 精确时间关系

- 原曲音频：48,000 Hz、16-bit PCM、立体声，4,321,428个采样帧。
- 片头：177,600个零采样帧，恰好3.7秒。提问和助手入场只使用这一段静音，不挤压音乐。
- 原曲的每一个PCM样本原封不动置于其后；校验报告包含原曲与嵌入片段的SHA-256，二者必须相等。
- 末端追加172个零采样帧，使最终音频4,499,200个采样帧，恰好对应 **2,812帧、30 FPS、93.733333秒**。
- `notes.json` 的 `t0`、`t1`、`start_seconds`、`end_seconds`、控制器、拍线、小节线和分段都已加3.7秒。渲染器直接使用这些**影片秒数**，不要再加一次偏移。
- `source_t0`、`source_t1` 等只用于溯源。`start_beat`、`end_beat` 保留音乐拍坐标；`timing.beat_zero_film_seconds=4.0` 说明拍坐标的时钟锚点。
- 首个音符在影片 **4.00327秒**。30 FPS画面在该时刻之后第一个采样帧亮起，量化误差小于一帧，不使用录屏墙钟。

## MIDI

MIDI保留原有10条轨道（指挥轨+9乐器轨）、音高、力度、程序选择、音色库、声像、音量、表情控制与渐慢图。90 BPM、480 PPQ下3.7秒对应2,664 ticks。初始化事件保留在tick0；音乐事件与后续速度事件统一平移，EOT只补齐影片长度，不添加假音符。

最终1,286个音符边界与影片JSON最大误差约0.868毫秒；结束长度误差小于0.5毫秒。MIDI是有精度限制的节拍文件，不宣称与PCM采样完全同一精度。

## 音乐驱动参数

`music_features.json` 每0.1秒提供一次真实混音RMS与归一化能量，时钟同样是影片秒数。音符出现、持续和颜色来自 `notes.json`，环境的缓慢亮度可使用该能量包络；不要把能量峰误当音符触发事件。

## 验收范围

`verify_film.py` 会独立解析最终MIDI，比较全部音符与初始化／表情事件；核对原始PCM不变、统一偏移、帧边界、首音与削波。完整视频检查另外包括H.264/yuv420p、AAC/48kHz立体声、分辨率、30FPS、2,812帧、流起点／时长、所有帧和声音完整解码、首音与前后两段音频互相关，以及极端整帧亮度跳变。

关键帧PNG会记录尺寸、颜色统计与SHA-256；有FontTools时检查打包字体是否覆盖片头中文。这些是技术检查，不能替代导演对构图、穿模、镜头和审美的图像审查，也不声称完成真人听审。
