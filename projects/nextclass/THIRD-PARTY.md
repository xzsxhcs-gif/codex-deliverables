# 第三方组件与来源

NextClass的课程判断、界面和本地存储代码在本工程中实现。下列工具／依赖来自官方项目；构建时从Google Maven、Maven Central和Gradle官方分发源解析。

| 组件 | 用途 | 许可与官方来源 |
|---|---|---|
| AndroidX Activity、Compose UI/Foundation/Material3、Lifecycle | 原生界面和生命周期 | Apache License 2.0；[AndroidX](https://developer.android.com/jetpack/androidx)、[官方源码](https://android.googlesource.com/platform/frameworks/support/) |
| Kotlin标准库及Kotlin Android Gradle插件 | Kotlin语言支持与编译 | Apache License 2.0；[Kotlin](https://github.com/JetBrains/kotlin)、[许可](https://github.com/JetBrains/kotlin/blob/master/license/LICENSE.txt) |
| kotlinx.coroutines | 协程与本地异步读写 | Apache License 2.0；[官方仓库](https://github.com/Kotlin/kotlinx.coroutines)、[许可](https://github.com/Kotlin/kotlinx.coroutines/blob/master/LICENSE.txt) |
| Android Gradle Plugin | Android资源处理、打包与构建 | Apache License 2.0；[官方文档](https://developer.android.com/build)、[源码](https://android.googlesource.com/platform/tools/base/) |
| Gradle及Gradle Wrapper | 可重复选择构建工具版本 | Apache License 2.0；[Gradle](https://github.com/gradle/gradle)、[许可](https://github.com/gradle/gradle/blob/master/LICENSE) |
| Android SDK平台API | Android系统接口、`AtomicFile`、`org.json`等 | 由Android系统／SDK提供；[AOSP](https://source.android.com/)、[许可说明](https://source.android.com/docs/setup/about/licenses) |

Apache License 2.0完整条款：<https://www.apache.org/licenses/LICENSE-2.0>。各项目原有版权、NOTICE与依赖自带的许可继续适用；本说明不替换上游条款，也不为用户原创课表数据另设许可。

本工程未引入第三方图片、字体下载、广告、统计或联网服务SDK。字体使用手机系统字体。APK中可能包含AndroidX为图形路径等功能提供的原生库，它们不代表应用需要网络权限。
