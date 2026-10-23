# 微光归途 / Where Light Returns

一首约 **90 秒**的原创纯音乐：从带有 B 小调色彩的钢琴开始，经过大提琴、弦乐与木管的加入，在明亮但克制的管弦主题后，回到渐慢的钢琴。

[GitHub 成品下载入口](https://github.com/xzsxhcs-gif/codex-deliverables/tree/main/deliverables/where-light-returns-v1) 提供 WAV、MP3、MIDI、音符数据与完整工程 ZIP。ZIP 自带音色库和成品；仓库的 `projects/` 目录保留可重建的源码与音色，预渲染 WAV/MP3 放在 `deliverables/`。

## 直接播放与文件

- `song.wav`：最终混音，48,000 Hz、16-bit PCM、双声道；90.02975 秒。
- `song.mp3`：192 kbps 手机试听副本；WAV 是主交付。
- `song.mid`：Standard MIDI Format 1 总谱，含独立乐器轨、速度、4/4 拍号、D 大调调号、程序／音色库选择、声像与表情控制。
- `notes.json`：每个音符的音高、力度、开始／结束秒数与拍数，含分段、配器、速度图和 CC 数据。
- `score.py`：完整原创总谱与合成入口；旋律、节奏、和声都在代码里明确编写。
- `mix.json` / `mix-report.json`：分轨混音设置与合成测量；`validation.json` / `audio-quality.png`：成品检查。

不需要运行程序就能播放 WAV 或 MP3。MIDI 自身不含音频；其他播放器的默认音色和效果可能与最终混音不同。

## 创作设计

**调性：** D 大调／关系 B 小调。**拍号：** 4/4。**速度：** 前 28 小节 90 BPM，最后四小节按拍线性渐慢到 70 BPM。32 小节，起始空间 0.3 秒，尾音窗口 3 秒。

主题的记忆点为 **F♯–A–D** 的上行与「短、短、长」节奏，后接 C♯–B 的回落。高潮只将主题头局部提升八度，随后回到柔和的中高音区；大提琴保持独立慢对位，长笛在旋律空隙回答。音高与节奏没有随机生成；固定种子只用于很小的演奏时差、力度差和混响。

| 时间 | 小节 | 内容 |
|---|---|---|
|0:00–0:11|1–4|安静、稀疏的钢琴呈示|
|0:11–0:32|5–12|完整主题，大提琴、慢弦乐逐步加入|
|0:32–0:54|13–20|小提琴发展动机，钢琴／竖琴轻音型，长笛回答，圆号进入|
|0:54–1:15|21–28|管弦主题展开，大提琴对位，少量定音鼓与轻钹|
|1:15–1:30|29–32 与尾音|撤去铜管／打击，钢琴主题回归，渐慢、渐弱、自然释放|

主题和声：Bm9 → Gmaj9 → D/F♯ → Aadd9/A7 → Bm7 → Gmaj9 → Em7/A7 → Dadd9。高潮：Dadd9 → A/C♯ → Bm7 → Gmaj9 → D/F♯ → Em7/A7 → Gmaj7/A7 → Dadd9。

实际使用九个通道：钢琴、大提琴、小提琴、慢弦乐合奏、长笛、圆号、竖琴、定音鼓、管弦钹。声像采用小幅左右展开，不用 Haas 延迟；各分轨高通后送入轻大厅混响。母线轻压缩与峰值保护保留动态，没有用极限响度替代配器推进。

最终实测：**−17.6 LUFS**，响度范围 **10.9 LU**，真峰值约 **−2.7 dBTP**。84 项成品检查及 3 项导出回归测试全部通过：九个分轨有实际声音，无数字削波或异常内部静音；全部 643 个音符的 MIDI／JSON 时间偏差小于 0.9 ms。检查详情见 `QA.md`。

## 重新生成

本次实际执行环境为 **Debian 13 x86_64、Python 3.12、GCC、NumPy 与 SciPy**，不是 Windows。没有使用付费 API 或额外音色。下面的入口使用跨平台 Python，并支持 GCC / MinGW 或 Visual Studio `cl`，但本次没有实机验证 Windows。

依赖：Python 3.10+、C 编译器、NumPy、SciPy。验证图另外需要 Matplotlib；MP3 与完整音频解码检查另外使用 FFmpeg。

```bash
python -m venv .venv
# Linux / macOS:
source .venv/bin/activate
# Windows PowerShell 使用：.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python score.py
python -m unittest discover -s tests -v
python verify_music.py
```

Windows 使用 MinGW 时请确保 `gcc` 已在 PATH；使用 MSVC 时，在 Visual Studio Developer Command Prompt 中运行。代码会自行编译本地渲染器，无需 FluidSynth 或在线服务。未安装编译器时会明确报错，不会伪造音频。

仅重新导出总谱与事件：`python score.py --score-only`。完整重渲染：`python score.py --workers 2`。中间事件、编译器产物和浮点分轨写入 `work/`，可删除后重建；不会修改参考仓库。`engine/build.sh`、`build.bat` 保留作上游参考，本作品请使用 `score.py`。

试听 MP3 可用 FFmpeg 生成：

```bash
ffmpeg -i song.wav -c:a libmp3lame -b:a 192k -ar 48000 song.mp3
```

相同环境与依赖下演奏数据可重复生成；不同编译器、CPU 或数值库的浮点音频可能存在极小差异。

## 工程结构

```text
score.py                     原创总谱、乐器配置、演奏控制、构建入口
COMPOSITION-PLAN.md          写代码前确定的音乐设计
engine/compose_kit.py         复用并修正的上游作曲／MIDI 引擎
engine/render.c + tsf.h       TinySoundFont 离线合成
engine/mix_kit.py             分轨声像、EQ、混响、动态与 WAV 输出
sound_library/GeneralUser-GS/ 原项目音色库及原始许可
tests/test_engine_midi.py     独立 SMF 解析与速度／控制器回归检查
verify_music.py               对最终文件、分轨、MIDI 和声能的检查
ENGINE-AUDIT.md               上游检查及工作副本修复说明
MUSIC-REVIEW.md               音乐结构复核
PROGRESS.md                   执行记录
```

## 来源、许可与限制

参考并复用 [maxtinnate/AI_MUSIC_CREATOR](https://github.com/maxtinnate/AI_MUSIC_CREATOR)，固定提交 `9604264dc134df72eda7e8b51eb2b8341b783635`；原作者 **reaesteve**。完整阅读并应用其 [code-composer Skill](./SKILL.md)、README 和示例。没有复制示例旋律；修复和改动仅在本工程副本中，原始参考仓库保持不变。

上游引擎、Skill、示例与工程文档按 **CC BY-NC-SA 4.0** 免费分享，禁止出售或设置付费门槛；保留 `LICENSE_许可.txt`、`免费分享声明_FREE_SHARING_NOTICE.txt` 和各文件声明。上游声明明确区分所创作音乐与引擎许可。GeneralUser GS v2.0.3 为 **S. Christian Collins** 的 SoundFont，保留其独立许可，允许用音色创作音乐；TinySoundFont 依其 MIT 许可使用。不要把本工程整体重新标成无限制商业软件。

本地合成、实际文件解码、全通道能量／MIDI 数据检查与波形／频谱检查已纳入验证；这不等同于真人主观听审或真实管弦乐录音。该作品使用 SoundFont，不宣称真实演奏采样之外的物理建模或真人演奏。
