# Git 使用指南

本项目目录：`D:\CodexWork\虚拟形象设计`。在 VS Code 中打开这个文件夹，然后选择“终端 → 新建终端”。下列命令均在项目根目录执行。

## 已有版本库

本项目已经有 Git 历史，不要再次 `git init`，也不要删除 `.git` 文件夹。

- 主分支：`main`，跟踪 `origin/main`。
- 远程：`https://github.com/paulwatcegt-ui/S-Virtual-character.git`。
- 当前优化模型和设计过程图片由 Git 直接管理；两个旧模型备份由 Git LFS 管理。
- 源码、配置、锁文件、图片和必要模型都保留在版本库。
- 依赖、构建产物、验证截图、便携工具、环境密钥和临时文件不提交。

Git 用户名和邮箱用于记录“谁做了提交”，不等于 GitHub 登录凭据。项目继续使用已经配置的身份，不在指南中重复记录邮箱。

本地已设置 `pull.ff=only` 和 `push.default=simple`：拉取只接受能直接前进的历史；推送检查当前分支与跟踪分支的对应关系。如果 Git 提示历史分叉，应停下来检查，不要强制覆盖远端。

## 每次开始工作

```powershell
git status -sb
git fetch origin
git log -5 --oneline
```

`fetch` 只更新远端信息，不会覆盖工作文件。若工作区干净、本地仅落后于远端，可以使用：

```powershell
git pull --ff-only
```

如果有未提交修改，先提交或备份；若本地和远端都有新提交，请让 Codex检查差异，确认方案后再整合。

## 修改完成后保存版本

1. 先启动项目并验证本次改动。双击本机的 `启动调试.cmd` 可启动网站；构建使用 `npm run build`，需要 Node.js 已在当前终端 PATH 中。
2. 查看修改，再选择需要提交的文件。

```powershell
git status -sb
git diff --stat
git diff
git add src README.md
git diff --cached --stat
git diff --cached
git commit -m "说明本次完成的改动"
```

`git add src README.md` 只是示例，应替换成这次实际改动的文件或目录。若修改了 `public/models`、依赖配置或其他文档，也要明确加入。可以用 `git add -p` 分段选择代码。提交前再次核对：不要包含 Token、密码、真实 `.env` 文件或私人资料。忽略规则不会自动移除已经被跟踪的敏感文件。

`commit` 只保存到本机；尚未上传 GitHub。若只是选错了暂存文件，可用下面的命令撤出暂存区，它不会删除工作文件：

```powershell
git restore --staged -- 文件路径
```

## 备份到 GitHub

确认提交内容和远端状态后再上传：

```powershell
git fetch origin
git status -sb
git push origin main
```

首次在本机通过命令行推送时，Git Credential Manager 可能要求浏览器登录 GitHub。此前项目曾通过已连接的 GitHub 插件完成同步；读取公开仓库成功，不代表命令行已经获得写入登录权限。不要把登录 Token 写进源码、远端地址或聊天消息。

如果被拒绝，先查看原因，不要使用 `--force`。若命令行提示缺少凭据，可使用正常的 GitHub 登录流程，或明确要求 Codex 通过已连接的 GitHub 插件同步。任何自动同步都应先确认目标仓库和提交范围。

可以这样要求 Codex：

> 完成修改后先验证，检查 Git 差异与敏感文件，创建本地提交；列出提交内容，等待我确认后再上传 GitHub。

## 查看历史

```powershell
git log --oneline --graph --decorate -15
git show 提交编号 --stat
git show 提交编号 -- src/main.tsx
git diff 旧提交编号 新提交编号 -- src
```

VS Code 左侧“源代码管理”可查看文件差异、暂存与提交。确保 VS Code 打开的是本项目文件夹。若 VS Code 找不到 Git，可在命令行执行 `where.exe git`，将结果中的 `git.exe` 完整路径填入 VS Code 的 `git.path` 设置；无需另建仓库。

## 安全查看和恢复旧版本

只查看旧文件内容，不改变项目：

```powershell
git show 提交编号:src/main.tsx
```

如需运行完整旧版本，优先在独立目录查看，保留当前项目：

```powershell
git worktree add --detach "D:\CodexWork\虚拟形象设计-历史预览" 提交编号
```

历史预览目录须尚不存在；依赖需要单独安装，旧 LFS 模型也可能需要拉取。

恢复操作前，先提交或另存当前未提交修改。然后可将某个文件恢复为指定历史版本，再用新提交记录恢复动作：

```powershell
git restore --source 提交编号 -- src/main.tsx
git diff
git add src/main.tsx
git commit -m "恢复 main.tsx 到已验证版本"
```

这会替换指定文件的当前内容，因此必须先保存该文件的未提交工作。若要撤销一个已经上传的提交，可用 `git revert 提交编号` 创建反向提交，不改写历史；遇到冲突请先让 Codex说明影响。不要自行执行 `git reset --hard`、`git clean -fd`、`git push --force` 或删除历史。

Git 主要保护已提交且未被忽略的文件。环境密钥、本机工具和其他被忽略文件需要另行安全备份。
