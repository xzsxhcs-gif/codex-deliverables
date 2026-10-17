# 昨日的我 · Android v1.0.0

[直接下载 APK（约 3.1 MB）](https://github.com/xzsxhcs-gif/codex-deliverables/raw/refs/heads/main/deliverables/yesterday-me-android-v1/yesterday-me-v1.0.0.apk)

Android 8.0 及以上；无需账号或网页托管，首次打开即可离线使用。请保持系统 WebView / Chrome 更新。

下载后在文件管理器中打开 APK，按系统提示允许该来源安装应用。

- [完整 Android 与网页源工程](./yesterday-me-android-source.zip)
- [安装、备份迁移与构建说明](../../projects/yesterday-me/ANDROID.md)
- [验证资料](./android-verification.zip)
- [SHA-256 校验值](./SHA256SUMS.txt)

生产构建、Android Lint（0 错误）、APK v2/v3 签名校验、79 项单元／集成测试与 8 项浏览器流程通过。按用户要求跳过模拟器测试；未完成安卓设备运行验证。

浏览器与 APK 使用独立数据库；迁移时先导出 JSON，再在应用内导入。卸载或清除应用数据会删除记录，请先备份。签名私钥未上传公开仓库。
