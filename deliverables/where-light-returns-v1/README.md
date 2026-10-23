# 微光归途 / Where Light Returns · v1

90 秒原创电影感纯音乐。D 大调与关系 B 小调，90 BPM，结尾渐慢至70 BPM；钢琴主题经大提琴、弦乐、长笛、圆号与竖琴逐步展开，再回到安静钢琴。打击乐仅用于少数结构点。

- [试听／下载 MP3（2.2 MB）](https://github.com/xzsxhcs-gif/codex-deliverables/raw/refs/heads/main/deliverables/where-light-returns-v1/song.mp3)
- [下载最终 WAV（17.3 MB，48kHz 立体声）](https://github.com/xzsxhcs-gif/codex-deliverables/raw/refs/heads/main/deliverables/where-light-returns-v1/song.wav)
- [下载完整工程 ZIP（48.3 MB，含音色库、源码与成品）](https://github.com/xzsxhcs-gif/codex-deliverables/raw/refs/heads/main/deliverables/where-light-returns-v1/Where-Light-Returns-Project.zip)
- [MIDI 总谱](https://github.com/xzsxhcs-gif/codex-deliverables/raw/refs/heads/main/deliverables/where-light-returns-v1/song.mid) · [音符／时间数据 JSON](https://github.com/xzsxhcs-gif/codex-deliverables/raw/refs/heads/main/deliverables/where-light-returns-v1/notes.json)

[查看源码与重建说明](../../projects/where-light-returns/) · [实际验收记录](./QA.md) · [校验值](./SHA256SUMS.txt)

实际生成文件，不是乐谱文本或音乐提示词。643个明确音符、9条合成分轨、32小节；使用所参考 AI_MUSIC_CREATOR 的作曲引擎、GeneralUser GS v2.0.3 SoundFont、TinySoundFont 和混音流程。旋律与和声重新编写，没有复制仓库示例曲。原作者为 reaesteve；其引擎／Skill 按 CC BY-NC-SA 4.0 免费分享，全部声明及第三方许可随工程保留。

最终WAV为16-bit PCM，90.02975秒；无削波或异常静音。84项实际成品检查和3项导出回归测试通过；−17.6 LUFS，10.9 LU响度范围，真峰值约−2.7 dBTP。MIDI音符时间与JSON最大偏差0.866毫秒。没有真人主观听审。

本次实际环境为Debian Linux；源码提供Windows Python与C编译器重建方法，但未完成Windows实机测试。MIDI播放器的默认音色与效果可能不同，请以WAV混音为准。

大型文件直接存放在本目录，Release 用作下载索引；不依赖聊天附件服务。
