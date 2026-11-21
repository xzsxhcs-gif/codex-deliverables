# MS–17 · 暴风雨山顶气象站

一座海拔设定为 2850 米的虚构值班站。夜班员从观测桌起身，穿过通往宿舍的走廊，在应急架找到手电筒。外门之后是迎风的钢栈道，一端通向风速塔，另一端通向备用发电机房。

## 在 Unity 中打开

1. 解压整个工程，在 Unity Hub 选择 **Add → Add project from disk**，选中同时含有 `Assets`、`Packages`、`ProjectSettings` 的目录。
2. 使用 **Unity 2022.3.62f1 LTS** 和内置渲染管线。首次导入后，在 Project 窗口双击 **Assets/SummitStation/Scenes/StormWatch.unity**。同一场景也是 Build Settings 中的首个场景。网格、材质和预制体已写入工程，打开场景无需运行生成器。
3. 按 Play，单击 Game 窗口锁定鼠标，WASD 行走，Shift 快走，Esc 释放鼠标。出生位置在控制室，面向观测桌。这个键鼠访客专供走查。
4. 可在编辑器菜单 **Summit 17 → Check open station** 检查 Unity 导入后的模型、材质、脚本和音效绑定。批处理入口为 `-batchmode -quit -projectPath <工程路径> -executeMethod Summit17.Editor.StationAcceptance.Batch -logFile <日志路径>`。

## 空间与动线

| 区域 | 空间设计与资产 | 与下一空间的关系 |
| --- | --- | --- |
| 主控制室 | 北、西侧带窗框和玻璃的连续观测窗，三席气象台，雷达、气压曲线和遥测屏，设备柜、线束、值班记录、无线电、杯子与转椅 | 南侧门进入值班走廊 |
| 生活区 | 两层固定铺位、床品、攀梯、厨房操作面、水龙头、橱柜、餐桌和凳子 | 独立房门通向同一走廊 |
| 值班走廊 | 约 2.8 米进深，储物柜、散热器、顶置管线、暖灯、门牌、应急灯架和抽屉 | 东端外门通往栈道 |
| 室外平台 | 约 15.4 米长的钢栈道，设踏板接缝、止滑纹、双层护栏、立柱、斜撑和低位导向灯 | 北侧支路通往观测风塔，东端进入独立机房 |
| 备用发电机房 | 架在减震座上的机组，散热格栅、排气管、铜管与电缆，维修柜内的隔离开关和两个可独立选取的部件 | 入口内侧可抵达维修柜，机组南侧留有巡检空间 |

主楼和机房均设有楼板、屋面、墙板及结构基座。远景由山脊与岩屑构成，屋顶雷达罩用于室外辨位。自由探索范围为房间、走廊、栈道和观测平台；山体属于景观背景。

[楼层示意图](Verification/FloorPlan.png) · [场景几何预览](Verification/Overview.jpg)

## 夜班环境

控制室冷色工作灯、走廊暖灯和室外低位灯构成沿线照明。运行时风驱雨线围绕观察者生成，轨迹避开建筑占地；玻璃着色器用世界坐标绘制细小水滴与水痕。低云缓慢移动，雾密度随阵风变化，短暂天光之后响起延迟雷声。`SummitWeather` 的 Lightning Strength 可调至 0。室内外雨、风音量渐变，机柜风扇和机房低频声分别定位到各自声源。

## 工程目录

| 目录 | 内容 |
| --- | --- |
| Assets/SummitStation/Scenes | 主场景与保存的预制体实例、环境设置、出生点及桌面访客 |
| Prefabs、Meshes | 区域几何、支撑结构、家具、道具及各自的 Unity 原生 Mesh |
| Materials、Textures、Shaders | 表面颜色与法线、仪表画面和标牌、夜空、玻璃雨痕及粒子着色器 |
| Audio、Scripts、Editor | 原创风雨雷与设备循环，天气、走查、交互锚点和编辑器检查工具 |
| Packages、ProjectSettings | Unity 模块声明、版本、构建入口和桌面输入设置 |
| Tools、Verification | 离线美术生成脚本、场景文件检查工具、检查记录与预览 |

上述资产子目录均位于 `Assets/SummitStation/`。Unity 游戏运行无需 Python 或 Blender。离线重制顺序为 `Tools/media.py`、`Tools/instruments.py`、`Tools/serialize.py`，之后运行 `python Tools/check_scene.py` 和 `python Tools/check_bindings.py`。离线制图工具使用 Python、NumPy、SciPy、Pillow、PyYAML 和 DejaVu 字体。运行 `python Tools/check_scene.py --preview-data` 后，可从工程根目录执行 `blender -b -P Tools/preview_blender.py` 重新渲染预览。重制会覆盖同名资产，应在副本内进行。

## 当前完成度与资源来源

本阶段细化资产包括控制台与显示内容、床铺与生活设施、带法线的工业表面、发电机及排气管、护栏栈道、雷达罩和桁架塔。它们均用本工程内几何和纹理程序原创生成。材质采用平铺色图与法线，金属度和光滑度按材质设定；这是工业环境原型的美术精度。仪表显示虚构数据。远山使用适合远观的网格，布料使用成型网格，机器内部结构仅用于场景表现。

门、把手、按钮、旋钮、抽屉、柜门、手电筒与两个维修件已建模并定位。可动部件带局部轴、行程提示和扳动／抓取触发体。通行门初始处于开启位置。实际 VR 抓握、门铰约束、手电开关、取件判定、停电及恢复供电属于下一阶段。设备音景表达待命时的室内机械声。

没有外部模型、扫描资产或音效包。位图仪表标签在制图时使用 DejaVu Sans Mono。运行时直接读取标签纹理。可选的 Blender 和 Intel Open Image Denoise 只用于离线预览；制图与预览工具的二进制不随工程分发。[DejaVu Fonts](https://dejavu-fonts.github.io/) · [Blender](https://www.blender.org/) · [Open Image Denoise](https://www.openimagedenoise.org/)

## 后续接入 SteamVR / OpenXR

1. 在目标工程备份现有场景和 XR 配置。将 `Assets/SummitStation` 连同所有 `.meta` 文件一起导入；保留目标工程的 Packages 和 ProjectSettings。本版使用内置 Standard 材质，目标若是 URP/HDRP，需要先转换材质并适配三个着色器。
2. 关闭 **Desktop Visitor - disable for XR** 整个对象。把现有玩家预制体的地面原点放在 **XR Origin placement - floor datum**，令头显相机使用 MainCamera 标签；仅保留一套玩家控制和 AudioListener。空间单位为米。
3. 将手部交互射线或抓取组件接到带 `StationSocket` 的预制体。Trigger 子节点作为选取区，根节点提供转轴、抓取原点或滑动基准。按照项目现有输入绑定接线，先用手电筒握持、门把手高度和维修件可达距离做真机校准。
4. 按“控制室断电 → 应急架取灯 → 出门到机房 → 维修柜复位 → 工作灯与设备恢复”接入任务逻辑。供电分组应保留电池导向灯，让断电时仍能辨别路线。
5. 用目标头显走完整条路线，检查单通道立体渲染下的玻璃、雨线、近裁剪与指示灯；测量最坏视角 GPU 帧时后再决定烘焙、分级和视距。当前只有主方向光投射实时阴影，普通工作灯无实时阴影。网格按空间与材质合组，雨粒子上限 950。

## 验证范围

[结构、网格和可达性检查](Verification/SceneChecks.json) 直接读取交付的场景和 Prefab 文件。碰撞检查使用直径 0.54 米的行走体积、约 1.8 米的净空和 0.10 米采样网格。出生点通往控制台、铺位区、走廊、手电架、栈道、观测支路、维修柜和机组巡检位。该检查覆盖门扇初始开启的布局。

验证还包括外部 GUID、预制体覆写目标、网格顶点／索引缓冲与包围盒、贴图解码及五份 WAV 格式。预览图由 Blender 读取这些已保存的网格并按场景位置渲染，灯光和玻璃属于离线近似。它们用于看布局与美术，不能代替 Unity Game 视图。此环境没有 Unity 编辑器和 VR 设备，Unity 首次导入、Play Mode、实际雨雾和声场、SteamVR／OpenXR 双眼显示、控制器输入及头显帧时均待实测。
