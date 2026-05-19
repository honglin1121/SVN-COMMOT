# Issue Link Push

VS Code 插件，用于关联 DevOps 任务、自动生成规范化提交信息并推送代码，同时将工时登记到 DevOps 平台。

## 功能

1. **关联 DevOps 任务** — 推送代码时选择工作项（task/bug），自动按产品线分组展示任务列表。
2. **规范化提交信息** — 按固定模板生成 commit message，统一团队提交格式。
3. **工时自动登记** — 推送完成后自动将本次投入工时和完成度登记到 DevOps 对应任务下。
4. **缓存加速** — 本地缓存产品线和任务列表，避免重复请求。

## 使用教程

### 1. 初始化 DevOps 账号

打开命令面板（`Ctrl+Shift+P`），搜索并执行 **Issue Link Push: 初始化 DevOps 账号**。

依次输入：
- **用户名** — DevOps 登录账号。
- **密码** — DevOps 登录密码。

初始化后凭据会存储在 VS Code SecretStorage 中，后续无需重复输入。

### 2. 关联任务并推送

在 Git 仓库中，打开命令面板或点击源代码管理标题栏的 ✓ 图标，执行 **Issue Link Push: 关联 DevOps 任务并推送**。

按引导依次选择/输入：

| 步骤 | 说明 |
|------|------|
| 选择工作项类型 | task（开发任务）或 bug（缺陷修复） |
| 选择具体工作项 | 按产品线分组展示，支持搜索编号或标题 |
| 选择 commit type | feat / fix / perf / refactor / test / style / build / chore / upd / Merge / doc |
| 输入提交说明 | 本次提交的简短描述，5-250 字 |
| 输入投入工时 | 本次投入的小时数，支持小数（如 1.5） |
| 输入完成度 | 任务完成百分比 0-100，填 100 会自动将任务置为已解决 |

确认后插件会自动：
1. 将提交信息写入最近一次未推送的 commit。
2. 推送代码到远程仓库。
3. 将工时和完成度登记到 DevOps 任务。

### 3. 清除缓存

执行命令 **Issue Link Push: 清除 DevOps 缓存** 可清空本地缓存的产品线和任务数据，下次会重新从服务器拉取。

## 配置项

在 VS Code 设置中搜索 `issueLinkPush` 可自定义以下配置：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `issueLinkPush.commitTemplate` | `${COMMIT_TYPE}:${SUBJECT} scrum -e ${CODE} -h:${HOURS} -s:${PROGRESS}` | 提交信息模板 |
| `issueLinkPush.requestTimeoutMs` | `10000` | API 请求超时，单位毫秒 |
| `issueLinkPush.cacheTtlMs` | `300000` | 缓存有效期，单位毫秒，设为 0 禁用缓存 |

模板变量：`${COMMIT_TYPE}` `${SUBJECT}` `${CODE}` `${HOURS}` `${PROGRESS}` `${TYPE}` `${PROJECT}`。

## 提交格式

默认生成的提交信息格式：

```text
<type>:<subject> scrum -e <issueId> -h:<hours> -s:<progress>
```

示例：

```text
fix:修复xxxx缺陷 scrum -e 675580 -h:1.5 -s:90
```

Merge 场景：

```text
Merge <subject> scrum -e <issueId> -h:<hours> -s:<progress>
```
