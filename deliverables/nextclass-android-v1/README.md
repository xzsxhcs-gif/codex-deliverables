# NextClass 1.0.0

原生Android离线课表工具，黑白极简主屏。当前／即将开始及下一门课程同屏显示，包含课程名称、完整上下课时间、日期和教室。首页有手机日期、星期与秒时钟。

- **[下载安装包 NextClass-1.0.0.apk（1.04 MB）](https://github.com/xzsxhcs-gif/codex-deliverables/raw/refs/heads/main/deliverables/nextclass-android-v1/NextClass-1.0.0.apk)**
- [下载完整源工程 NextClass-source.zip](https://github.com/xzsxhcs-gif/codex-deliverables/raw/refs/heads/main/deliverables/nextclass-android-v1/NextClass-source.zip)
- [在线浏览源码及使用说明](../../projects/nextclass/)

支持Android 8.0及以上，包名`dev.nextclass.app`。这是实际编译并签名的release APK，可以安装；没有通过WebView包装网页。

## 开始使用

首次安装为空课表，不包含之前聊天中的课程数据。进入首页唯一的“课表设置”入口，填写第1教学周的周一日期和学期周数，再录入课程，或导入整理好的JSON课表。之后打开App无需选择日期即可看到课程。

支持课程新增、编辑、删除；有效周范围和单双周；跨天／跨午夜；本地保存；JSON导入导出。导入替换需确认，删除课程需确认。数据只存本机，无账号、服务器、广告或互联网权限。卸载前建议导出备份。

## 实际构建记录

- Kotlin + Jetpack Compose；完整JDK21、Android SDK35、Gradle8.11.1。
- 最终`assembleRelease`成功，APK签名、ZIP和对齐核验通过。
- [构建记录](BUILD-RECORD.json) · [构建日志](build-log.txt) · [权限](apk-permissions.txt) · [APK元数据](apk-metadata.txt) · [签名](apk-signature.txt) · [SHA-256](SHA256SUMS.txt)。
- 遵照用户最后“无需测试，直接产出APK”的要求，**未运行自动化测试，也未做手机／模拟器实测**；安装包核验不等同于设备功能验收。
- 发布后的真实下载核验单独记录在`remote-verification.json`。

私有签名密钥、密码、SDK和构建缓存没有上传。源码可用Android Studio或Gradle重建，使用自己的签名密钥时需遵循Android的签名更新规则。
