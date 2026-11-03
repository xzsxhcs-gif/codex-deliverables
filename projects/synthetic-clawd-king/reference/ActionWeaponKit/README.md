# Action & Weapon Kit（纯动作 + 枪械模块）

这是一个可移植的 **Unity C# 代码模块包**，不含任何场景、模型、贴图、地图、任务、敌人、分数系统、联机服务或可执行游戏。

## 重要说明：不是原版无损提取

所提供的原始 ZIP 是 **Unity 已编译的 Windows 构建产物**，不是 Unity 项目源码。原始动作、枪械和其他玩法逻辑混合编译在 `Assembly-CSharp.dll` 中；随附的 PDB 记录了源码文件路径，但没有内嵌这些动作/枪械文件的完整源码。因此本包中的 `.cs` 是**参照原包可识别的系统划分独立重写的精简实现**，不是原始动作手感或武器行为的逐字恢复。

未包含原版 `Assembly-CSharp.dll`，因为它还包含大量地图/游戏玩法等逻辑，和本次“只保留动作、枪械”的要求冲突。

## 文件

- `Assets/ActionWeaponKit/Scripts/Movement/FirstPersonLook.cs`：第一人称鼠标视角、视角后坐力。
- `Assets/ActionWeaponKit/Scripts/Movement/ParkourMotor.cs`：步行、冲刺、跳跃、空中加速、蹲伏、滑铲、墙跑、蹬墙跳、简单翻越及抓边攀爬。
- `Assets/ActionWeaponKit/Scripts/Weapons/GunDefinition.cs`：枪械数据（射速、弹匣、后备弹药、换弹、散布、后坐力等）。
- `Assets/ActionWeaponKit/Scripts/Weapons/GunController.cs`：开火、连发、点射、换弹、切枪、第一人称射线命中与事件。
- `Assets/ActionWeaponKit/Scripts/Weapons/GunMotion.cs`：可选的枪械 sway / 检视动作，等待你绑定自己的武器模型。
- `ORIGINAL_MODULE_INDEX.md`：从原压缩包的 PDB 路径中核实的原版动作/武器组件名称，供后续迁移参考；不包含关卡/玩法源代码。

## 如何导入

1. 在你的 Unity 项目中复制 `Assets/ActionWeaponKit` 文件夹。使用 Unity 的 **Input Manager（旧输入系统）**；若项目只开启了新 Input System，请先启用 Both，或自行改输入层。
2. 在你自己的 Player 根物体上挂 `CharacterController`、`ParkourMotor`、`GunController`。`CharacterController` 建议高度 1.8、中心 Y=0.9、半径 0.3，Player 原点位于脚底。
3. 在 Player 子对象挂一台 Camera，并在相机对象添加 `FirstPersonLook`，将 `yawBody` 绑定到 Player 根物体。
4. 给 `GunController` 绑定相机及 `FirstPersonLook`。通过 Project 右键 → Create → Action Weapon Kit → Gun Definition 新建枪械配置，填入 `guns` 数组。
5. 如果之后有自己的枪械模型，可将它挂在相机的武器 Pivot 下，然后加 `GunMotion` 实现程序化 sway 与检视动画；**本包没有模型**。
6. 在自己的项目环境中提供地面及障碍物 Collider；否则运动物理没有碰撞目标。墙跑、翻越和抓边只是基础原型算法，建议按新游戏的关卡几何进行测试和调参。

## 默认按键

- WASD：移动
- 鼠标：视角
- 左 Shift：冲刺；空中靠墙时墙跑
- Space：跳跃 / 蹬墙跳 / 翻越 / 攀上抓住的边缘
- 左 Ctrl：蹲伏 / 冲刺滑铲 / 放开抓边
- 鼠标左键：射击
- R：换弹
- 1 / 2：上一把 / 下一把枪
- I：检视武器

## 枪械事件 API

`GunController` 公开 `Fired`, `RayHit`, `ReloadStarted`, `ReloadCompleted`, `Inspected`, `GunChanged`, `AmmoChanged` 事件，供你连接音效、UI、特效或其他项目中的逻辑。**没有**伤害计算、敌人、场景交互或任务玩法。

## 兼容性及限制

- C# 代码采用 Unity 内置 `CharacterController`、`Physics`、`MonoBehaviour`、`ScriptableObject`、旧输入接口；无第三方依赖。
- 本环境无法运行 Unity 编辑器，尚未完成 Unity 项目中的实际编译和运动测试。
- 不含原版枪械 mesh、原版动作动画 Clip 或 Prefab，因为这些未以独立素材的形式出现在可直接复用的游戏构建包中。
- 这是面向后续开发的源码包，**不是双击即可运行的游戏**。
