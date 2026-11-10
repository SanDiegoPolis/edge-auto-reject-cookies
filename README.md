# Auto Reject Cookies for Edge

自动处理 Microsoft Edge 网页里的 Cookie 同意弹窗。识别到明确选项后，扩展会隐藏弹窗，优先选择「拒绝全部」，其次选择「仅必要」。网站处理后，页面右下角会显示约 3 秒的小提示。

## 安装

1. 下载并解压项目，找到包含 `manifest.json` 的文件夹。
2. 在 Edge 地址栏打开 `edge://extensions`，打开「开发人员模式」。
3. 点击「加载解压缩的扩展」，选择上面的文件夹。
4. 刷新已打开的网页。想暂停时，可在扩展管理页关闭 Auto Reject Cookies。

更新已解压安装的版本时，将新版文件解压到原目录，在扩展管理页点击「重新加载」，再刷新网页。

参见 [Microsoft 的本地扩展安装说明](https://learn.microsoft.com/zh-cn/microsoft-edge/extensions/getting-started/extension-sideloading)。

## 工作方式

- 扩展在本地识别网页上的 Cookie 提示，以及明确表达「拒绝全部」或「仅必要」的按钮。它也会检测网页加载后出现的提示。
- 扩展尽早隐藏可处理的弹窗。有些网页在按钮可用前就已经画出了弹窗，因此可能短暂闪现。网站若未响应选择，扩展会恢复弹窗，方便手动处理。
- 它使用网站提供的按钮提交选择，不会点「接受全部」，也不会猜测「确定」「继续」「保存设置」的含义。只有设置入口、提示文字无法识别，或按钮不可操作时，保留提示让你手动处理。
- 扩展需要在 HTTP 和 HTTPS 网页上运行，才能检测各站点的弹窗。它不向外发送数据、不收集浏览记录，也不直接读写 Cookie。网站可能会自行保存你做出的选择。
- 如果网站已经保存了你的旧选择、没有显示弹窗，或在网站显示弹窗前就写入 Cookie，扩展不会更改这些 Cookie。网站是否遵守拒绝选择取决于网站本身。

## 开发

项目无需构建，也没有第三方运行依赖。使用 Node.js 20 或更新版本运行 `node --test`，或执行 `npm test`。

---

Auto Reject Cookies handles cookie consent banners in Microsoft Edge. It hides supported banners while choosing **Reject all** or **Necessary only**, then shows a small notification for about three seconds. If the choice cannot be safely made or the site does not respond, the banner stays available. All detection runs locally; the extension does not send data or access the browser's cookie store.

To install, unzip the project, open `edge://extensions`, enable **Developer mode**, and select **Load unpacked**. Choose the folder containing `manifest.json` and refresh existing tabs.
