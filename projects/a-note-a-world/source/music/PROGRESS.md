# 制作进度

- [x] 克隆并完整读取 README、SKILL 与示例；检查作曲、渲染、混音代码。
- [x] 核实实际环境是 Debian Linux；numpy / scipy / C编译器已具备，不需要安装付费服务或新音色。
- [x] 在独立目录合并原项目音色分段，并核对官方 SHA-256。
- [x] 在写音符之前完成 COMPOSITION-PLAN.md。
- [x] 编写原创总谱及演奏控制：643个音符、9个通道、32小节，全部音高与节奏明确指定。
- [x] 使用核验后的GeneralUser GS和TinySoundFont合成9条分轨，再混成48kHz立体声WAV。
- [x] 核对实际WAV、MIDI、音符事件和动态，并完成和声修订后的全量重渲染。84项成品检查和3项回归测试通过；WAV/MP3完整解码通过。
- [x] 打包工程并完成ZIP完整性检查；已将实际成品上传GitHub，下载回WAV/MP3/MIDI/JSON/工程，核对SHA-256及完整音频解码。

上游仓库保持不变。工作副本会修复MIDI漏导控制器等问题，并保留原作者免费分享声明和所有第三方许可。

## 第一轮修订

结构复核发现高潮第22小节一个未解决的D悬留，以及第26–27小节竖琴未跟随半小节和声切换。已将前者解决至C#、使竖琴按当时和弦取音，并重新合成全部分轨。不是仅修改总谱后保留旧音频。

## 最终交付

已发布：https://github.com/xzsxhcs-gif/codex-deliverables/releases/tag/where-light-returns-v1

源码位于仓库 `projects/where-light-returns/`，大文件位于 `deliverables/where-light-returns-v1/`；最终远端核验记录在该交付目录的 `remote-verification.json`。完整工程包含GeneralUser GS与原始许可，不依赖失效的聊天文件路径。所有要求的音乐产物已实际生成；本次未接入Windows，未声称真人主观听审。
