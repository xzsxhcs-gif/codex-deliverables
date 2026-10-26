# Codex 成果交付仓库

用于保存本对话任务的源工程、交付文档和下载入口。

## 交付方式

- 源码和文档按项目保存在 `projects/`。
- 视频、音频与大型压缩包优先作为 [Release 附件](https://github.com/xzsxhcs-gif/codex-deliverables/releases) 提供下载。
- 每次上传后核验实际文件，并在对话中提供具体文件或版本链接。
- 本仓库为公开仓库，公开内容无需登录即可访问。

## 已完成项目

### NextClass

原生Kotlin / Jetpack Compose离线课表工具。打开即同屏显示当前／即将开始与下一门课程的名称、完整时间、日期及教室；支持教学周、单双周、课程增改删、本地原子保存和JSON备份。首次安装为空课表，无互联网权限。

- [下载签名APK与源工程](deliverables/nextclass-android-v1/)
- [源码与构建说明](projects/nextclass/)
- [实际构建和签名记录](deliverables/nextclass-android-v1/BUILD-RECORD.json)

按本次要求未运行自动化测试或设备实测。

### 一音成境 / A Note, A World

93.73秒原创音乐可视化短片。一个折翼小助手放下首音，协作者把九个声部织成乐谱；乐谱连续展开为旋律山脉、和声河湖与微光，再折回完整总谱。原创音乐《微光归途》，所有画面由Canvas、Three.js与音符数据确定性生成。

- [1080p成片、手机版本、音乐与完整工程](deliverables/a-note-a-world-v1/)
- [源码、分镜及Windows重渲染说明](projects/a-note-a-world/)
- [最终影片40项验收](projects/a-note-a-world/QA.json) · [编码画面复核](projects/a-note-a-world/VISUAL-REVIEW.md)

### 微光归途 / Where Light Returns

约90秒原创电影感纯音乐。钢琴主题经过大提琴、弦乐、木管与圆号逐渐展开，再回归宁静。实际输出48kHz立体声WAV、MP3试听、完整MIDI和音符时间数据，工程含可重新运行的Python总谱与原项目SoundFont。

- [试听、成品与完整工程下载](deliverables/where-light-returns-v1/)
- [源码、音乐设计与重建说明](projects/where-light-returns/)
- [84项成品检查与实际测量](projects/where-light-returns/QA.md)

### 昨日的我

本地优先的时间胶囊 PWA：今天封存，次日零点起解封；阅读辩护、轻松宣判，再把结果留在档案里。Vue 3 / TypeScript / IndexedDB，支持离线、深浅主题、真实统计与 JSON 备份。

- [完整源代码与安装说明](projects/yesterday-me/)
- [可运行构建、源工程与验证资料下载](deliverables/yesterday-me-v1/)
- [验收记录](projects/yesterday-me/QA.md)

静态生产文件已准备在 `docs/yesterday-me/`。当前连接无权开启 GitHub Pages，在线网址尚未发布；仓库所有者可按项目 README 中的三个步骤启用。记录始终保存在使用者自己的浏览器。

### SNICKERS：文明的底层代码

50 秒、1080×1920 竖屏、30 FPS 的程序化实验剪辑。包装与八个字母从零绘制，展开为八阶段文明符号，再收束成一根普通士力架；配有原创程序音轨。

- [完整视频与工程下载](deliverables/snickers-civilization-v1/)
- [源代码与运行说明](projects/snickers-civilization/)
- [成片检查记录](projects/snickers-civilization/REVIEW.md)

## 待恢复项目

此前《欢迎回家》的成片与源工程在当前恢复后的工作区未找到，需要恢复实际文件后才能交付。历史记录为 270 秒、1920×1080、30 FPS；这些记录不代表仓库中已有成片。
