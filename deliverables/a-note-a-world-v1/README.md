# 一音成境 / A Note, A World

**完整成片已完成。** 93.733333秒、1920×1080、30 FPS、2,812帧，H.264/yuv420p + AAC 48kHz立体声。

一个音符创造一个世界：提问与首音、助手协作、乐谱进入三维、山川河湖、世界折回乐谱。原创音乐《微光归途》保留原有旋律与混音，增加3.7秒安静引子。角色、场景与音乐可视化均独立实现。

## 下载

点击下列链接可直接访问GitHub保存的实际文件，无需通过聊天附件服务。

| 文件 | 下载 |
|---|---|
| 1080p正式MP4，52.9 MB | [下载 final_video.mp4](https://github.com/xzsxhcs-gif/codex-deliverables/raw/5402b93a0e33b5544fe0960d9395f50a45824ba1/deliverables/a-note-a-world-v1/final_video.mp4) |
| 720p手机MP4，10.9 MB | [下载 final-video-720p.mp4](https://github.com/xzsxhcs-gif/codex-deliverables/raw/5402b93a0e33b5544fe0960d9395f50a45824ba1/deliverables/a-note-a-world-v1/final-video-720p.mp4) |
| 360p完整轻量版，3.5 MB | [下载 preview-360p.mp4](https://github.com/xzsxhcs-gif/codex-deliverables/raw/5402b93a0e33b5544fe0960d9395f50a45824ba1/deliverables/a-note-a-world-v1/preview-360p.mp4) |
| 完整源工程与音色库，75.6 MB | [下载 A-Note-A-World-Project.zip](https://github.com/xzsxhcs-gif/codex-deliverables/raw/5402b93a0e33b5544fe0960d9395f50a45824ba1/deliverables/a-note-a-world-v1/A-Note-A-World-Project.zip) |
| 影片WAV母带，18.0 MB | [下载 final_music.wav](https://github.com/xzsxhcs-gif/codex-deliverables/raw/5402b93a0e33b5544fe0960d9395f50a45824ba1/deliverables/a-note-a-world-v1/final_music.wav) |
| MIDI总谱 | [下载 final_music.mid](https://github.com/xzsxhcs-gif/codex-deliverables/raw/5402b93a0e33b5544fe0960d9395f50a45824ba1/deliverables/a-note-a-world-v1/final_music.mid) |
| 音符事件数据 | [notes.json](notes.json) |

三个视频均为完整时间线，音轨相同，MP4的`moov`索引前置，便于直接播放。360p已经替换为最终高清成片生成的版本，先前制作中的预览不再作为交付。

源工程ZIP包含原曲WAV、GeneralUser GS SoundFont、完整作曲代码、三维场景、中文字体、MIDI、事件数据、Windows脚本与检查报告。为避免重复，不把最终MP4和根目录影片WAV再塞进工程ZIP；两者由上面的链接单独下载。解压后执行`python source/prepare_music.py`即可由保留的原曲恢复影片WAV。全部运行步骤见[工程README](../../projects/a-note-a-world/README.md)。

## 验收与重建

- 正式1080p、720p和360p各自通过40项技术检查：[HD](QA.json)、[720p](720p-QA.json)、[360p](360p-QA.json)。包含完整视频和AAC解码、帧数、音画时长、PCM保留、MIDI时间和字体覆盖。
- [12项场景检查](scene-QA.json)：全部相机帧、全部音符开始时刻、活动音符和任意顺序寻帧确定性。
- 已直接检查最终编码的19个关键帧，并独立复查世界回归乐谱的连续过程；[画面复核记录](VISUAL-REVIEW.md)、[关键帧联系表](final-contact-sheet.jpg)。
- 已从源ZIP独立解压并执行音乐重建，WAV、MIDI与事件数据均逐字节一致：[还原报告](../../projects/a-note-a-world/PORTABLE-CHECK.json)。
- [编码与faststart记录](compatibility.json)、[文件清单](delivery-manifest.json)、[SHA-256](SHA256SUMS.txt)。[14项实际公开文件下载核验](remote-verification.json)均已通过：大小／SHA-256一致，三个远端视频重新完整解码成功，源ZIP的140个成员和清单校验通过。
- 实际在Linux/Chromium软件WebGL完成渲染。提供了`render.bat`，未声称Windows实机测试或真人主观听审。

源代码可直接[浏览仓库](../../projects/a-note-a-world/)。本版本使用公开仓库文件存放实际二进制，Release作为下载索引；没有把链接索引冒充Release二进制附件。原始第三方音色、字体与引擎的署名和条款均保留在工程中。
