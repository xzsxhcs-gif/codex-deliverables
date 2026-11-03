# 移动算法移植说明

## 可用的实际来源

本项目读取了用户提供的 `ParkourPrototype-Action-Weapon-Kit.zip`。其内容为两个说明文档和五个 Unity C# 文件，完整保存在 `reference/ActionWeaponKit/`。没有收到可运行的 Unity 工程、场景、Prefab、原游戏 DLL 或完整 `SIGN HERE!` 源码。

附件 README 明确写明：这些 `.cs` 是参照可识别系统划分独立重写的精简实现，而非原构建产物源码的逐字恢复。`ORIGINAL_MODULE_INDEX.md` 仅为 PDB 中的脚本路径索引，不能把该索引视为可用源码。

## 实际复用 / 移植

| 附件来源 | 本项目对应 | 处理方式 |
| --- | --- | --- |
| `ParkourMotor.Accelerate` | `PlayerController.accelerate` | 以 `MoveTowards` 等价的向量限幅靠近目标速度，保留地面/空中加速度区分 |
| 地面移动参数 | `player.ts` | 步行 5.8、冲刺 9.5、蹲伏 3.2；地面加速度 34、普通空中加速度 12 |
| 跳跃与重力 | `player.ts` | 使用 `sqrt(2 × gravity × jumpHeight)`，重力 24、跳高 1.4 |
| `coyoteTime` / `jumpBuffer` | `player.ts` | 保留离地后 0.1 秒可跳与按键 0.12 秒缓存的意图与时间逻辑 |
| 蹲伏 / 滑铲 | `player.ts` 与镜头高度插值 | 速度达到 6 后以 Ctrl 触发，持续约 0.85 秒，阻力 3.5；蹲伏切换降低镜头 |
| 墙跳 | `player.ts` | 保留向外 6.5、向上 7 与短冷却的方向分解；用本地边界/立柱法线代替 Unity Raycast |
| 墙面移动 | `player.ts` | 按住冲刺且满足速度/邻墙条件时减轻下落并保留沿墙运动，有限时长 |
| `FirstPersonLook` | `player.ts`、`input.ts`、`runtime.ts` | 第一人称 yaw/pitch 分离与俯仰限制，转换到 Three.js 的 -Z 前向约定；鼠标灵敏度按浏览器像素重新标定 |

这属于**算法移植**，不是把不兼容的 `MonoBehaviour` 原样粘贴进网页。Unity 的 `CharacterController`、`Physics`、`Input Manager` 均不在浏览器中运行。

## 新增与重新实现

- 120Hz 固定物理步进；长帧钳制，避免从后台恢复时一次补算过多时间。
- 圆形竞技场边界、立柱 AABB 与玩家圆柱的碰撞处理；位移微步进抑制穿墙。
- 滑铲跳保留水平动量，空中仍可低强度转向。附件原实现没有单独保证这一行为，本项目补充实现。
- 底部落地、低平台落地、玩家与蟹王动态身体的分离处理。
- Pointer Lock、锁定失败时的拖动视角、窗口失焦暂停、触屏摇杆与多指动作。
- Three.js 镜头高度平滑、克制的移动起伏、泡泡权杖与发射动作。
- 泡泡实体飞行、命中、Boss 预警、伤害、无敌时间、阶段推进和胜负逻辑均为本次新写。

附件的 `GunController`、`GunDefinition`、`GunMotion` 已阅读并保留供查阅。本次采用无限泡泡的幻想攻击，没有移植弹匣、换弹、切枪或真实枪械数据，也不声称使用了这些模块的完整枪械实现。

## 未移植的动作

翻越、抓边悬挂、抓边攀爬没有纳入这场紧凑 Boss 战。竞技场无需这些额外动作；本项目没有把它们列为可玩的能力。

## 验证

`tests/player.test.ts` 通过真实事件和时间步进检查方向、加速度、跳跃、缓存、土狼时间、滑铲动量、立柱与边界碰撞等行为。`tests/boss.test.ts` 独立检查攻击与阶段规则。浏览器验证则检查 DOM 输入到实际场景的完整链路；查看交付的实际报告，不以源码存在替代运行验证。
