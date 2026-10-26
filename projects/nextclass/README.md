# NextClass

极简、完全离线的原生 Android 课程提示工具。打开后同屏显示手机日期、星期、时间，以及当前／即将开始的课程与下一节课；每门课都显示名称、完整上下课时段和教室。

**1.1.0为本学期预置版。** 按用户确认的信息内置15条排课规则、11门不同课程，安装后即可自动查看。支持 Android 8.0（API 26）及以上，应用包名仍为 `dev.nextclass.app`，`versionCode` 为2。

本版沿用已交付1.0.0的包名和签名，可直接覆盖安装，**无需卸载旧版**。构建完成情况与APK校验值以实际交付记录为准。

## 使用

1. 首次安装，或从1.0.0的空课表升级后，首次读取会自动载入本学期课表；首页立即显示当前／即将开始及下一门课程。
2. 已有非空课表会保留，不覆盖自己修改过的课程。需要重新载入时，进入「课表设置」→「载入本学期课表」，确认后替换。
3. 仍可在设置中修改学期、新增、编辑或删除课程，填写名称、教室、星期、时间、有效周和单双周。
4. 平时只需打开首页，无需选择日期、翻页或查看整周网格；学期过后再更新新课表即可。

管理页支持编辑和删除课程；删除需要确认。修改学期不会静默裁掉已有课程，现有课程的周次必须仍落在新学期范围内。

预置课表只自动初始化一次。主动删除全部课程或导入空课表后，不会在下次打开时擅自恢复；可以通过「载入本学期课表」手动恢复。

## 本学期数据来源与范围

- 来源是用户提供的第8–19周截图及随后确认的课程名称和教室，灰色卡片也按课程计入；不是示例数据。
- 附件说明标注2026年秋季学期。第8周周一为2026年10月26日，由此推算第1周周一为 **2026年9月7日**。
- 预置数据只覆盖第8–19周，即 **2026年10月26日至2027年1月17日**。`totalWeeks: 19` 表示本次已知数据的结束周，**不代表学校实际学期一定只有19周**。
- 第1–7周没有提供，不补造课程；第19周之后也不推断考试、停课或新学期安排。
- 用户确认的补全项：足球在操场；心理健康教育在教二109；军事理论与训练在教二104；电子信息工程专业导论与学业规划在教三101。
- 保留单双周及结束周差异：英语单周教三105、双周西四308；周一高数仅双周；足球至16周，电子CAD至15周，C语言至16周（包含灰色课程）。

原始预置JSON保存在 `app/src/main/assets/semester-2026-autumn.json`。完整课程字段仍可通过导出备份查看或后续更新。

## 时间规则

- 使用手机当前时区和本地日历计算教学周。第1周从配置的周一开始，单双周依据教学周编号。
- `上课时间 ≤ 当前时间 < 下课时间` 视为正在上课；到下课时刻即移出当前课程。
- 课间或当天尚未上课，主区域显示最早的未结束课程，次区域显示其后的课程。
- 当天结束后继续寻找后面的有课日期；不同日期的课程明确显示日期和星期。
- 查询限于已配置的学期与课程有效周。没有未来课程时显示空状态。
- 下课时间早于上课时间时，按**次日结束**处理，并在画面中标注；上下课时间相同不允许保存。
- 时钟在前台按手机时间更新；返回前台或手机日期／时区变化时重新同步。课程选择在分钟边界或数据变化时刷新，后台不持续运行刷新计时器。

主屏为近黑背景、白色文字和细分隔线。课程管理仅通过一个「课表设置」入口访问，不在主屏增加整周导航。

## 本地保存和备份

课表位于应用私有目录的 `timetable-v1.json`，通过 `AtomicFile` 保存。只有写入成功才更新界面中的已保存数据；读取失败会显示错误并保留原文件。卸载应用通常会删除这些本地数据，建议先导出备份。

管理页提供 JSON 导入／导出，使用 Android 系统文件选择器。导入前会校验文件并要求确认替换；取消选择不会改变课表。导入会替换整份当前课表，建议先导出。

应用没有互联网权限，无服务器、账号、广告或追踪。系统文件选择器列出的云盘等位置由手机系统或相应提供方管理；本应用本身不通过网络传输课表。

### JSON 格式

`empty-timetable.json` 是合法的空课表文档，不会自动导入。用户主动导入并确认替换后可清空课表；初始化已完成的App不会因此重新自动载入预置数据。

| 字段 | 格式／含义 |
|---|---|
| `version` | 固定为整数 `1` |
| `semester.startDate` | 第1周周一，`YYYY-MM-DD`；仅空课表可为 `null` |
| `semester.totalWeeks` | 1–60之间的整数 |
| `courses` | 课程对象数组，最多1,000条 |
| `courses[].id` | 唯一、非空字符串；新增课程由App生成UUID，修改时保留原ID |
| `courses[].name` | 课程名，最多100字符 |
| `courses[].room` | 教室／地点，最多120字符 |
| `courses[].dayOfWeek` | ISO星期编号：周一为1，周日为7 |
| `courses[].startTime` / `endTime` | 24小时制 `HH:mm`，分钟精度 |
| `courses[].startWeek` / `endWeek` | 学期内的有效起止教学周，均包含在内 |
| `courses[].weekPattern` | `ALL`、`ODD`、`EVEN`，分别为每周、单周、双周 |

导入需要完整且受支持的字段，禁止重复ID、无效时间或没有符合单双周条件的周范围。文件使用UTF-8，大小上限2 MiB。星期或时间不同的多次上课，应各存一条课程记录。

## 工程

| 位置 | 内容 |
|---|---|
| `app/src/main/java/dev/nextclass/app/MainActivity.kt` | 页面入口、手机时钟与文件选择器 |
| `app/src/main/java/dev/nextclass/app/NextClassViewModel.kt` | 状态、保存、导入与导出 |
| `app/src/main/java/dev/nextclass/app/domain/` | 数据模型、校验和纯时间判断 |
| `app/src/main/java/dev/nextclass/app/data/` | 原子文件存储和JSON编码 |
| `app/src/main/java/dev/nextclass/app/ui/` | Compose首页与课程／学期编辑界面 |
| `app/src/main/assets/semester-2026-autumn.json` | 用户确认的本学期15条排课规则 |

采用 Kotlin 1.9.25、Jetpack Compose、Android Gradle Plugin 8.7.2、Gradle 8.11.1；编译／目标SDK为35。第三方来源见 [THIRD-PARTY.md](THIRD-PARTY.md)。

## 本地构建

需要**完整JDK 17或以上（包含javac）**、Android SDK Platform 35和相应构建工具。可用Android Studio打开工程，设置本机SDK路径并构建。首次解析Gradle依赖需要联网，安装后的App不需要联网。

命令行构建可安装的debug APK：

```bash
./gradlew :app:assembleDebug
```

Windows使用：

```bat
gradlew.bat :app:assembleDebug
```

输出为 `app/build/outputs/apk/debug/app-debug.apk`。`local.properties` 为本机配置，不随源工程交付；可通过Android Studio生成，或设置 `sdk.dir` 指向本机SDK。

### 签名release

使用自己的签名密钥，在**工程外**创建私有properties文件，包含 `storeFile`、`storePassword`、`keyAlias`、`keyPassword` 四项。`storeFile` 推荐使用密钥库绝对路径。通过环境变量指定该文件，再构建：

```bash
export NEXTCLASS_SIGNING_PROPERTIES=/absolute/private/path/signing.properties
./gradlew :app:assembleRelease
```

Windows PowerShell对应设置为 `$env:NEXTCLASS_SIGNING_PROPERTIES = "C:\private\signing.properties"`，然后运行 `./gradlew.bat :app:assembleRelease`。

签名成功的release位于 `app/build/outputs/apk/release/`。未配置签名时release可能为未签名产物，不能将其当作可安装的正式交付。交付用私钥、密码和本机构建缓存不包含在源码中；用自己的密钥构建，不能覆盖安装由另一把密钥签名的同包名App。请保留密钥以便后续更新。

## 构建和验证边界

遵照用户最后的要求「无需测试，直接产出APK」，本版**未编写或运行自动化测试，也未进行手机／模拟器实测**。编译、APK签名或压缩包元数据检查不等同于设备功能验收。实际APK生成情况、大小和校验值以交付目录的构建记录为准，不凭源码存在宣称构建成功。

本版已按用户授权内置确认后的本学期课表；后续学期可继续手工修改或导入JSON。当前工程没有自动识别新截图、提醒通知或后台常驻服务。
