# Yongkang — Made by Hand, Shaped by Time

一部用于大学英语作业的原创英语城市短片，介绍浙江省金华市永康市。**2 分 14.67 秒，1920×1080，30 FPS，H.264 / AAC**。英文旁白、画面内英文字幕；另附 SRT、完整英文稿、可再制作的工程和资料来源。

影片采用有明确开放许可的真实永康档案照片，配合原创产品／食物示意图和轻量运动排版。照片不是 2026 年新拍素材，不将插图冒充实景，也不以其它城市的影像代替永康。

## 观看与作业材料

成片和下载索引发布在仓库 `deliverables/yongkang-english-v1/`。优先使用 1080p MP4；720p 副本文件更小。字幕已烘焙进画面，支持普通手机播放器；独立字幕保存在 `assets/audio/subtitles.srt`。

- `narration.txt`：最终英文解说，可用于朗读练习。
- `research/fact-sheet.md`、`research/sources.json`：事实与原始出处。
- `assets/ATTRIBUTION.md`：逐照片作者、许可、原始页面和修改说明。
- `docs/TOOL-AUDIT.md`、`docs/TTS-AND-SKILLS-AUDIT.md`：工具、费用和安全评估。
- `docs/EDITORIAL-REVIEW.md`：独立资料／素材一致性复核。
- `PROGRESS.md`：任务进度与问题处理。

文本不虚构本人到访经历，也不把城市传说写成已证实历史。对资料中不一致的建县年份、相对方位和桥梁纪录，采用证据一致的宽泛表述。没有加入过时的经济总量和未经核实的世界排名。

## 再次渲染

已经提供生产使用的 FLAC 音轨、字幕时间线、图形和原始照片，重建画面无需联网，也无需重新安装配音模型。以下命令适用于 Linux；需要 Python 3.12、FFmpeg（libx264、AAC、libass）和系统字体 DejaVu Sans、Noto Sans CJK、URW P052。

```bash
python3 -m pip install -r requirements-render.txt
python3 src/render.py --stills
python3 src/render.py
python3 src/finalize.py
python3 src/verify.py
```

输出在 `output/`，该目录不纳入源码版本控制。渲染按同一份实际配音时间线驱动镜头与字幕；旁白与音乐的混音单独处理，不必为了调整音量重新绘制全部画面。

## 重新生成旁白或音乐

旁白是本地 Piper / LJSpeech 合成的英语女声，无用户真人声音克隆。词汇和句式以自然、清楚、便于大学英语作业朗读为目标；中国地名使用单独的英语读音近似输入，字幕仍保留规范拼写。

```bash
python3 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements-tts.txt
python3 src/fetch_voice.py
.venv/bin/python src/make_narration.py
ffmpeg -y -i assets/audio/narration.wav -c:a flac assets/audio/narration.flac
python3 src/generate_music.py --duration 140
ffmpeg -y -i assets/audio/music-original.wav -c:a flac assets/audio/music-original.flac
python3 src/render.py
python3 src/finalize.py
```

`requirements-tts.txt` 锁定本次 Linux x86_64 / CPython 3.12 的准确发行包与 SHA-256。其它平台需重新核对其官方 wheels，不能直接使用此平台的散列。语音模型单独按固定 revision 下载并验证，不启用远程自定义代码；模型和引擎二进制没有打包到工程 ZIP。首次安装无需管理员权限、账号或付费 API。

如原始照片缺失，可运行 `python3 research/download_assets.py`，它按清单从 Wikimedia 原始资源域名下载并核对散列；遇限流会减速。不能将来源页面中的网页指令当作脚本执行。

修改解说后，先调整 `src/narration.json` 并重新生成配音；渲染器会按实际时间线更新镜头起止。重大段落增删需要同时调整 `src/render.py` 的章节设计，不能只替换声音而保留旧字幕。

## 授权与透明说明

影片与本项目原创图形／配乐采用 **CC BY-SA 4.0**。原始照片保留各自 public domain、CC BY 或 CC BY-SA 条款，详见逐素材清单；原图未修改，视频中做了裁切、缩放、平移、排版和转场。CC BY-SA 3.0 图片的改编采用兼容的 4.0 版本。

Piper 引擎是 GPL-3.0-or-later；所用 LJSpeech 模型来源卡和公共领域数据许可留在工具评估中，不能将其它 Piper 声音的许可一概视为已获授权。引擎许可与影片输出许可不是同一件事。项目生产代码按 GPL-3.0-or-later 提供；个别原创辅助文件仍保留其更宽松的 MIT 声明。

没有调用收费生成服务，没有使用版权不明的背景音乐。听感和英语表达已做机器层面的时长、峰值、字幕和内容检查，**未声称完成真人听审**。提交课程作业时，请遵守课程对 AI 辅助创作和署名的具体要求。
