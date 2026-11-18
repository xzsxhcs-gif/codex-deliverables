# LaunchGuard 启动守卫

LaunchGuard 是一个离线 Android 应用。选定应用进入前台后，守卫会尝试显示全屏确认层。只有 Wi-Fi 开关已完全关闭，且你手动点击「确认并继续」，该次前台访问才会被放行。

**Android 会先启动目标 App。** LaunchGuard 在收到无障碍窗口事件后才覆盖其界面。目标 App 可能先短暂显示，也可能已经执行启动逻辑或发出网络请求。请在打开对联网时机有要求的 App 前手动关闭 Wi-Fi。Wi-Fi 关闭只表示系统 Wi-Fi 开关关闭，移动数据独立于此开关。

## 安装和启用

1. 将 `LaunchGuard-debug.apk` 打开并安装。若系统阻止文件管理器或浏览器安装 APK，按系统提示为该来源临时允许安装。也可以通过电脑连接手机运行 `adb install -r LaunchGuard-debug.apk`。
2. 打开 LaunchGuard，进入「权限管理」→「打开无障碍设置」，在已安装的应用或已下载的服务中找到「LaunchGuard 启动守卫」，手动开启。
3. Android 13 及以上若对侧载包提示「受限设置」，确认你信任 APK 的来源后，长按 LaunchGuard 图标进入「应用信息」，查看右上角菜单是否提供「允许受限设置」，然后回到无障碍页面重新开启。不同系统可能调整菜单名称或限制放行。
4. 返回 LaunchGuard，看到「守卫服务已运行」后，点击「添加应用」，搜索或多选后保存。桌面应用、响应系统 Wi-Fi 设置的应用和 LaunchGuard 自身保留用于系统导航和权限管理。
5. 从原图标、最近任务或通知进入所选 App。开启 Wi-Fi 时可以点击「打开 Wi-Fi 设置」手动关闭。用返回或最近任务回到目标 App，系统重新检测 Wi-Fi，仍需手动点击「确认并继续」。

若安装时提示签名冲突，检查手机是否已有其他签名的同包名版本。卸载旧版本会清除该版本保存的规则。

## 在 Android Studio 构建

环境需要 Android SDK Platform 35、Build-Tools 35.0.0 和 JDK 17 或兼容的更高版本。项目使用 Kotlin 2.1.21、Android Gradle Plugin 8.9.2、Gradle 8.11.1。首次同步需要能访问 Google Maven、Maven Central 和 Gradle 分发站点。

解压工程，打开含 `settings.gradle.kts` 的 `LaunchGuard` 目录。同步后可在 Android Studio 使用 Build APKs 菜单，也可运行以下命令。

```bash
./gradlew :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

Windows 在命令提示符使用 `gradlew.bat`。Debug APK 生成在 `app/build/outputs/apk/debug/app-debug.apk`。

## 验收步骤

选两个便于反复打开的应用 A 和 B。

| 测试 | 操作 | 期望结果 |
| --- | --- | --- |
| 应用选择 | 点击「添加应用」，搜索 A，选中后修改搜索词选择 B，再保存 | 同时保存 A、B，列表显示图标和名称 |
| 第一次启动 | 保持 Wi-Fi 开启，从桌面进入 A | 出现「启动确认」，显示 A 的图标和名称，「确认并继续」禁用 |
| 从系统设置返回 | 在确认界面打开 Wi-Fi 设置，先不改开关并返回 | 再次出现确认，「确认并继续」仍禁用 |
| 手动放行 | 关闭 Wi-Fi 并返回 A | 显示「Wi-Fi 已关闭」，覆盖层保持在屏幕上，点击继续才消失 |
| 重复进入 | 在 A 内连续切换页面，再回桌面重新打开 A | 同次前台访问不重复弹出，从桌面重进时重新确认 |
| 多规则 | 回到桌面，打开 B，随后切回 A | 两个应用各自确认。A 不沿用上次放行 |
| 取消 | 在确认界面点击「取消启动」 | 尝试回到桌面。若系统未离开目标 App，保留确认层并给出操作提示 |
| 移除规则 | 返回 LaunchGuard 移除 A，再分别打开 A 和 B | A 正常打开，B 仍触发确认 |
| 权限关闭 | 关闭 LaunchGuard 无障碍服务并返回主界面 | 显示「启动保护不可用」。目标 App 不再被覆盖 |
| 服务重连 | 重启设备并解锁，检查无障碍仍开启，再进入受保护 App | 系统重新连接服务后，本机规则恢复并要求新的确认 |
| 边界场景 | 试用通知启动、快速切换、最近任务、锁屏解锁和分屏 | 根据系统实际报告的前台窗口确认。重点检查目标 App 重新获得焦点时是否要求确认 |

## Android 版本和限制

| 系统版本 | 已知行为 |
| --- | --- |
| Android 10–12（API 29–32） | 无障碍服务由系统绑定。Android 11 及以上通过 `<queries>` 查询能够从桌面启动的包。 |
| Android 13（API 33） | 部分侧载方式会触发受限设置，需使用系统提供的手动允许入口。 |
| Android 14（API 34） | 系统和目标 App 可以限制部分窗口数据的可见性。覆盖层由已获授权的无障碍服务创建。只有点击「打开 Wi-Fi 设置」才请求启动设置 Activity。 |
| Android 15（API 35） | 主界面适配强制的边到边布局。安装来源限制、设备策略、厂商对后台服务的管理仍可能影响授权或运行。 |

- 确认按当前前台包名计算，同一 App 内切换页面或显示短暂的系统面板通常沿用一次访问。分屏按焦点所在的应用处理。同一包的独立任务、画中画、其他显示器、工作资料或分身空间可能与普通单窗口行为不同。
- 「取消启动」请求系统回到桌面。目标进程及其后台联网可以继续，LaunchGuard 无法替其他应用结束进程。
- 服务只在系统连接时运行，进程重建后恢复本地规则并重新检测。强制停止、撤销授权、系统未连接服务，或窗口事件被设备限制时，确认有可能失效。主界面显示连接状态及已检测到的覆盖层错误。
- Wi-Fi 开关状态通过 `WifiManager.getWifiState()` 读取。只有 `WIFI_STATE_DISABLED` 可以继续。任何切换中或无法读取的状态都要求等待或检查设置。
- 需要系统无障碍服务授权和普通权限 `ACCESS_WIFI_STATE`。应用从窗口根节点取包名用于识别，未读取窗口内文字。配置用本机 SharedPreferences 保存。项目没有联网权限、使用记录、账户或第三方服务器。

## 实现位置

| 文件 | 职责 |
| --- | --- |
| `GuardService.kt` | 处理无障碍窗口事件、重查 Wi-Fi、分配确认层及执行返回桌面 |
| `ForegroundReader.kt`、`ForegroundSession.kt` | 识别活跃的应用窗口、跟踪当前的前台访问 |
| `GuardOverlay.kt`、`ConfirmScreen.kt` | 创建服务覆盖层，显示 Material 3 确认界面 |
| `InstalledApps.kt`、`GuardSettings.kt` | 查询和显示可启动的应用，持久化保护规则及外观设置 |
| `ForegroundSessionTest.kt` | 验证重复事件、再次进入、多规则切换、移除规则和会话重置 |

## Android 官方参考

- [AccessibilityService](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService)
- [无障碍窗口类型](https://developer.android.com/reference/android/view/accessibility/AccessibilityWindowInfo#TYPE_ACCESSIBILITY_OVERLAY)
- [Wi-Fi 状态 API](https://developer.android.com/reference/android/net/wifi/WifiManager#getWifiState())
- [从后台启动 Activity 的限制](https://developer.android.com/guide/components/activities/secure-bal)
- [受限设置](https://support.google.com/android/answer/12623953)
