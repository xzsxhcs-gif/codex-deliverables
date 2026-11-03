# Synthetic Clawd — The King Awakens

保留原版可爱合成游戏，在**正常合成出最终形态蟹王**时，接入一场真正的第一人称 3D 隐藏 Boss 战。击败蟹王后，原来的棋盘、分数和图鉴继续保留；失败可以直接重试，不必重新合成。

## 启动

需要 Node.js 20.19+ 或 22.12+ 的受支持版本，推荐当前 Node.js LTS。首次安装依赖需要网络或已有 npm 缓存；游戏不使用账号、API 密钥或付费服务。

```sh
npm ci
npm run dev
```

打开终端显示的 Local 地址。Windows 可在解压后的工程目录打开 PowerShell，执行相同命令。请通过这个 HTTP 地址运行，避免浏览器对直接打开本地文件的限制。

```sh
npm run typecheck       # 严格 TypeScript 检查
npm test                # 控制器与 Boss 规则测试
npm run build           # 生成 dist/ 标准静态网站
npm run preview         # 本地查看生产构建
npm run build:standalone # 同时生成 dist/Synthetic-Clawd-King.html 单文件版
```

`dist/` 可部署到普通静态网站服务。单文件版嵌入所需脚本和样式，无需 CDN；若浏览器限制本地文件、鼠标锁定或音频，请使用 HTTP 服务。仓库源代码无需 Unity 编辑器。

## 玩法

- **合成**：原版拖动瞄准、松手投放。相同等级碰撞合成，连续合成加分；交换、图鉴、原有四项成就、中英切换和静音保留。
- **觉醒**：生成蟹王后冻结棋盘，聚焦并拉近蟹王，经过短转场进入皇家庭院。点击进入按钮开始战斗并请求鼠标锁定。
- **战斗**：用泡泡权杖瞄准粉色蟹壳，躲避有预警的冲锋、巨钳重击和泡泡弹幕。半血后进入更快的组合攻击阶段。
- **失败**：在失败界面直接重试，也可返回原棋盘。
- **胜利**：蟹王认输后自动返回合成，解锁持久保存的 **KINGSLAYER / 弑王者** 成就和蟹王冠旁的星辉装饰。
- **重战**：遭遇解锁后，图鉴内会出现再次挑战入口。重战不会清空当前合成局。

| 操作 | 桌面 | 触屏 |
| --- | --- | --- |
| 移动 / 瞄准 | WASD / 鼠标 | 左摇杆 / 右侧拖动 |
| 冲刺 | Shift | 摇杆推至外圈 |
| 跳跃 | Space | 向上按钮 |
| 蹲伏 / 滑铲 | Ctrl；跑动时触发滑铲 | 向下按钮 |
| 发射泡泡 | 按住鼠标左键 | 按住泡泡按钮 |
| 暂停 | Esc 或暂停按钮 | 暂停按钮 |

滑铲中跳跃会保留惯性；靠近竞技场边界或立柱时可以蹬墙跳。鼠标锁定被拒绝时仍可按住画面拖动瞄准。窗口失焦或切换标签页会暂停战斗，恢复后需主动继续。

## 保存与原版保留

原版的最高分、图鉴、四项成就和语言继续使用原来的 `localStorage` 键；新增遭遇解锁和弑王者记录使用独立键，不覆写旧记录。当前合成棋盘仍与原版一样仅保存在内存中；战斗返回保留本局，但**刷新网页或关闭页面不会保存正在进行的对局**。

浏览器存储按来源隔离。同一浏览器、相同协议/主机/端口下的旧记录会继续使用；换网址、端口、浏览器或从文件版切换到 HTTP 版，不会自动迁移旧记录。无服务器、跨设备同步或隐私追踪。详见 [保留清单](docs/PRESERVATION.md)。

## 工程结构

```text
index.html                 原版布局、样式与 2D Canvas
src/legacy/merging.js       原合成游戏，增加窄范围模式桥接
src/main.ts                觉醒、战斗、胜利返回与存档协调
src/battle/player.ts       120Hz 第一人称运动与碰撞
src/battle/boss.ts         独立于渲染的 Boss 状态、预警与伤害
src/battle/runtime.ts      Three.js 场景、泡泡命中与资源生命周期
src/battle/arena.ts         程序化皇家庭院
src/battle/king-model.ts    程序化蟹王模型与动画
src/battle/ui.ts, ui.css    双语 HUD、暂停/失败界面及触屏输入
src/battle/audio.ts        原创 Web Audio 战斗音效
reference/                 两个附件中的原始参考文件
tests/                    时间步进、运动和攻击规则测试
qa/                        浏览器端流程检查与关键帧
```

原 2D 帧循环统一驱动两个模式；3D 不另建动画循环。竞技场与蟹王通过 Three.js 几何体建模，音效由代码合成，没有下载图片、模型或音频。战斗退出时释放渲染器、几何体、材质、输入监听和观察器。

## 移植来源与验证范围

可用的第二个附件是 **Action & Weapon Kit 的五份 Unity C# 模块**，没有完整 `SIGN HERE!` 工程。附件自身说明其实现为独立重写，并非原版源码无损恢复。本工程实际阅读并移植了 `ParkourMotor.cs` 和 `FirstPersonLook.cs` 中适用的算法，再为浏览器竞技场补充碰撞与惯性处理；没有声称复原原游戏手感。具体对应关系见 [移动移植说明](docs/MOVEMENT-PORT.md)。

已通过严格 TypeScript、生产构建、24 项规则测试及 44 项浏览器流程检查。完整战斗的验收使用实际移动、瞄准和泡泡碰撞，未通过改血取胜。

规则测试和实际浏览器流程测试分开记录。浏览器检查脚本位于 `qa/browser_check.py`，需要 Python Playwright 与可用 Chromium；检查截图和报告以交付包内实际生成的文件为准。开发模式提供测试夹具，通过真实碰撞合成触发蟹王；生产构建不提供该测试入口。

3D 需要支持 WebGL 的现代浏览器。实际帧率取决于设备；不能据软件渲染或桌面浏览器模拟推断实体手机性能。第三方说明见 [THIRD-PARTY.md](THIRD-PARTY.md)。

Windows 可运行 `start.bat` 启动开发环境，或运行 `build.bat` 重新生成成品。完整成品和源工程压缩包见 [仓库交付目录](https://github.com/xzsxhcs-gif/codex-deliverables/tree/main/deliverables/synthetic-clawd-king-v1)。

详细验收方法与明确限制见 [实际验证记录](docs/VERIFICATION.md)。
