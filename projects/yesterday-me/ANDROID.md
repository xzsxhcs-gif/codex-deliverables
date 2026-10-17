# 《昨日的我》Android 安装版

Android 8.0 及以上；请保持系统 Android System WebView / Chrome 更新。本应用不需要账号、网页托管或服务器，首页与所有界面随 APK 安装，第一次打开也可以离线使用。

## 安装

1. 下载发布页中的 `yesterday-me-v1.0.0.apk`。
2. 在手机文件管理器中打开它；如果系统提示，允许当前浏览器或文件管理器「安装未知应用」，完成安装后可收回这项权限。
3. 打开「昨日的我」。无需开启通知、联网或授予存储权限。

这是独立分发的签名 APK，没有上传应用商店。系统可能提示它来自未知来源；请核对发布页的文件 SHA-256。

## 本地数据与备份

- IndexedDB 保存在 Android 应用自己的 WebView 数据目录，封存和解锁沿用网页版本的当地日历规则。
- 退到后台、正常关闭、重新打开不会主动清空记录。同包名、同签名的覆盖安装会保留应用数据；卸载或清除应用数据会删除记录。
- 浏览器版、PWA 和 APK 的存储相互独立。迁移时先在旧版本导出 JSON，再在 APK 设置中导入，不能自动迁移。
- Android 的「导出 JSON」会打开系统保存文件界面，用户选择文件位置后才写入；取消不会伪装成成功。导入使用系统文件选择器。
- APK 没有申请网络、存储、相机、麦克风或通知权限。Android 自动云备份与设备迁移备份已关闭，备份由用户自己导出。
- 备份是明文，包含尚未解封的内容与预测。时间封存是正常界面的访问规则，不是密码学保护。

返回键先关闭最上层弹窗；在其它页面时回到封存页，再按返回将应用退到后台。未封存草稿只保留在当前运行中的界面，系统回收进程后不能保证恢复；已封存的记录存放在数据库中。

## 从源码构建

需要 Node.js 22.12+、JDK 21、Android SDK Platform 35 与 Build Tools 35。Android Studio 可以管理 SDK；也可使用官方命令行工具。先设置 `JAVA_HOME` 和 `ANDROID_HOME`。

```bash
npm ci
npm run android:sync
cd android
./gradlew assembleRelease
```

Windows 使用 `gradlew.bat assembleRelease`。生成的未签名文件位于 `android/app/build/outputs/apk/release/app-release-unsigned.apk`。使用 Android SDK 的 `zipalign` 和 `apksigner` 及你自己的发布密钥签名后才能分发；也可以用 Android Studio 的 **Generate Signed Bundle / APK**。

应用包名固定为 `io.github.xzsxhcsgif.yesterdayme`；本地网页源固定为 `https://localhost`。后续升级不要改变包名、签名或网页源，否则 Android 不能覆盖安装或无法读取原来的 IndexedDB。升级时需增加 `versionCode`。

本次交付的发布私钥保存在构建环境的私有目录，**未上传公开仓库**。公开源码不包含签名私钥；用新密钥重建的 APK 无法直接覆盖旧签名版本，请先导出备份再迁移。构建环境被清理前，应通过安全渠道单独保管发布密钥，不能把它提交到 GitHub。

## 原生代码位置

- `capacitor.config.ts`：应用标识、本地网页源、WebView 设置。
- `android/`：Android 工程、中文名称、启动图标、权限和备份策略。
- `android/app/src/main/java/`：调用系统文件保存界面的窄范围原生插件。
- `src/native/`：浏览器与 APK 的备份、生命周期、返回键适配。

Vue 页面、日期逻辑、数据库和审判规则共用同一份 TypeScript 源码。浏览器版本仍然可以用 `npm run dev` / `npm run build` 正常开发和部署。
