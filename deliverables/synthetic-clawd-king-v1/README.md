# Synthetic Clawd — The King Awakens · v1.0.0

可玩的完整集成版：原版 2D 合成出蟹王后，进入第一人称 3D 王室 Boss 战；失败可直接重试，胜利保留原棋盘并返回，获得弑王者奖励。图鉴内可再次挑战。

## 下载

- [单文件游戏 HTML（约 0.63 MB）](https://github.com/xzsxhcs-gif/codex-deliverables/raw/main/deliverables/synthetic-clawd-king-v1/Synthetic-Clawd-King.html)
- [成品构建 ZIP（约 0.34 MB）](https://github.com/xzsxhcs-gif/codex-deliverables/raw/main/deliverables/synthetic-clawd-king-v1/Synthetic-Clawd-King-Playable.zip)
- [完整源工程 ZIP（约 2.6 MB）](https://github.com/xzsxhcs-gif/codex-deliverables/raw/main/deliverables/synthetic-clawd-king-v1/Synthetic-Clawd-King-Source.zip)
- [浏览源代码与运行说明](../../projects/synthetic-clawd-king/)
- [仓库内单文件备用下载](https://github.com/xzsxhcs-gif/codex-deliverables/raw/main/deliverables/synthetic-clawd-king-v1/Synthetic-Clawd-King.html)

单文件版已嵌入脚本、样式和 Three.js 许可，无需外部图片、模型或音频。用支持 WebGL 的现代浏览器打开；若浏览器限制本地文件，在构建包目录运行 `python -m http.server 8080` 并访问 `http://localhost:8080`。源工程可用 `npm ci`、`npm run dev` 启动，Windows 也提供 start.bat / build.bat。

## 操作

WASD 移动，鼠标瞄准，Space 跳跃，Shift 冲刺，Ctrl 滑铲/蹲伏，按住左键发射泡泡，Esc 暂停。手机提供触控摇杆、瞄准、跳跃、滑铲和发射按钮。鼠标锁定被拒绝时可以按住画面拖动瞄准。

## 检查

- 严格 TypeScript、生产构建通过。
- 规则测试 24/24；实际浏览器流程 44/44；正式构建检查 17/17。
- 实测真实合成 → 进入 3D → 失败重试 → 真实泡泡命中胜利 → 原棋盘恢复 → 再次投放、存档与重赛。
- 原始附件的 8 个参考文件逐字节保留，原版计分与合成物理保留。
- [浏览器记录](browser-report.json) · [生产构建记录](production-report.json) · [构建记录](build-checks.json) · [文件校验值](SHA256SUMS.txt)。

可用的动作来源是用户提供的 Unity 重写模块；没有完整 SIGN HERE! 原工程。移植与新增算法分别见源工程 docs/MOVEMENT-PORT.md。不是声称无损恢复旧游戏。

验证环境为 Chromium 软件 WebGL 和手机模拟；未测试实体手机/Safari或宣称硬件帧率。受管理测试浏览器禁止 file:// 导航，HTTP 单文件运行已验证。当前对局与原版一样仅在页面内存中保存；最高分、图鉴、成就、语言和新增解锁保存于同源 localStorage。

此次 Release 附件接口拒绝上传（HTTP401），因此三个体积较小的成品直接保存在本目录。下载链接均指向实际仓库文件。

上传后的公开下载已逐一核对 HTTP 状态、大小和 SHA256，两个 ZIP 的 CRC 与源工程清单也通过。详见 [远端文件验证](remote-verification.json)。
