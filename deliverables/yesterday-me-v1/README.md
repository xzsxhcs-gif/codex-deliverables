# 昨日的我 · v1

跨时空自我审判系统。今天封存，明天开庭。

- [下载可运行版本（无需安装 npm 依赖）](https://github.com/xzsxhcs-gif/codex-deliverables/raw/refs/heads/main/deliverables/yesterday-me-v1/yesterday-me-app.zip)
- [下载完整源工程](https://github.com/xzsxhcs-gif/codex-deliverables/raw/refs/heads/main/deliverables/yesterday-me-v1/yesterday-me-source.zip)
- [下载自动化验证记录](https://github.com/xzsxhcs-gif/codex-deliverables/raw/refs/heads/main/deliverables/yesterday-me-v1/yesterday-me-verification.zip)
- [下载文件校验值](https://github.com/xzsxhcs-gif/codex-deliverables/raw/refs/heads/main/deliverables/yesterday-me-v1/SHA256SUMS.txt)

[源代码与使用说明](../../projects/yesterday-me/) · [验收记录](../../projects/yesterday-me/QA.md)

## 本地直接使用

解压可运行版，安装 Node.js 22.12+ 后，在其目录执行：

```bash
node scripts/serve.mjs
```

打开 http://localhost:4173 。源码版则执行 `npm ci`、`npm run dev`。

## 手机安装入口

静态网页已上传到 `docs/yesterday-me/`，但当前 GitHub 连接开启 Pages 时被拒绝（HTTP 403），**尚无已发布的在线应用地址**。仓库所有者在 [Settings → Pages](https://github.com/xzsxhcs-gif/codex-deliverables/settings/pages) 选择 **Deploy from a branch → main → /docs → Save**，部署成功后即可通过网页进入应用并安装到手机。

所有留言留在各自浏览器中，仓库与静态托管不接收日记。封存不是加密保险箱，JSON 备份包含未解封内容；请自行妥善保管。

生产构建、71 项单元／集成测试、8 项浏览器流程和 10 项 PWA 检查通过。
