# 来源、署名与许可

本工程保留每个依赖的原始许可。下列说明不能替代随附的完整许可文件；不得把包含上游引擎的完整工程重新标成无限制商业软件。

## 本片新增内容

《一音成境》的原创助手、场景代码、音乐映射、镜头与新增制作文档，由本项目独立实现。本说明不为这些新增成果另行指定公开使用许可，也不把参考作者的引擎许可自动扩展到原创音乐或原创画面。

完整工程中随附的上游引擎、Skill和相关文件仍按其 **CC BY-NC-SA 4.0** 原始条款免费分享，不得出售或设置收费门槛。该要求与作品输出的权利应分开理解。

本片复用本任务此前原创的《微光归途》，未使用参考作者原曲。上游声明明确区分“引擎／Skill的许可”与“使用它创作的音乐”；不能仅因使用引擎，就推断音乐的权利归上游作者所有。音乐来源、原创设计与实际生成记录见 `source/music/README.md`、`COMPOSITION-PLAN.md` 和 `MUSIC-REVIEW.md`。

## AI_MUSIC_CREATOR

- 仓库：<https://github.com/maxtinnate/AI_MUSIC_CREATOR>
- 固定参考提交：`9604264dc134df72eda7e8b51eb2b8341b783635`。
- 原作者：**reaesteve**；制作拆解标注 **@txul16Et**，2026-10-22。
- 上游引擎、Skill、示例与制作资料按 **CC BY-NC-SA 4.0** 免费分享。
- 保留文件：`source/music/LICENSE_许可.txt`、`source/music/免费分享声明_FREE_SHARING_NOTICE.txt`、`source/music/SKILL.md`、`source/music/UPSTREAM-README.txt` 和引擎源码中的双语声明。

仅复用已验证的作曲／合成流程与本项目原创音乐；视频渲染器另行实现。没有假设文档提到的未公开 `video.html`、`journey.js`、`world3d.js` 已可取得，也没有复制原作角色、旋律、动画或完整视觉设计。原始参考仓库未修改。

## GeneralUser GS v2.0.3

- 作者：**S. Christian Collins**。
- 官网：<https://www.schristiancollins.com/generaluser>。
- 音色与完整原始许可：`source/music/sound_library/GeneralUser-GS/GeneralUser-GS.sf2`、同目录 `LICENSE.txt` 与 `README.md`。
- 该独立许可允许用于个人或商业音乐创作；其原文说明及所含样本的来源说明完整保留。不能将工程引擎的非商业许可误套为该音色库的许可，也不能删除音色库自身条款。

## TinySoundFont

- 用于本地SoundFont合成，按 **MIT** 许可使用。
- 原始源码与许可：`source/music/engine/tsf.h`、`source/music/engine/TinySoundFont-LICENSE.txt`。
- 复制或分发时保留原版权与MIT许可文本。

## Three.js 0.180.0

- 项目：<https://threejs.org/>，three.js authors，Copyright 2010–2025。
- 按 **MIT** 许可使用；随工程提供的浏览器模块位于 `source/vendor/`。
- 完整许可：`source/vendor/THREE-LICENSE.txt`。
- npm版本与完整性记录在 `source/package.json`、`source/package-lock.json`；常规重渲染使用随附模块，不必重新联网获取。

## Noto Sans CJK SC

- 来源：<https://github.com/notofonts/noto-cjk>，Google与Noto字体贡献者。
- 按 **SIL Open Font License 1.1** 使用；中文子集仅包含本片所需字符，保存为 `source/fonts/FilmSans.otf`。
- 保留的原始版权／完整许可：`source/fonts/NOTO-LICENSE.txt`，其中包含Debian发行包的版权说明与OFL文本。
- 字体不是本项目原创图形，不应单独改用本工程文档许可。

## 运行工具

Python、NumPy、SciPy、Pillow、Playwright／Chromium和FFmpeg分别保留自身许可，通过其正常安装渠道取得。本工程无需账号或付费API；首次配置可能需要下载免费依赖和浏览器。最终画面没有下载的风景图片、现成角色素材或第三方视频片段。
