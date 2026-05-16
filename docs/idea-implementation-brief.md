# Issue Link Push IDEA 实现说明

## 1. 目标

实现一个 IntelliJ IDEA 插件，用于在 push 前规范化最新未推送 commit message，并关联公司 DevOps 工作项。

用户流程：

1. 安装插件后，执行“初始化 DevOps 账号”。
2. 输入 DevOps 用户名和 login 接口中的 password 字段值（密文），安全保存。
3. 开发者先正常本地 commit。
4. 准备 push 时，执行“关联 DevOps 任务并推送”。
5. 插件拉取 DevOps 产品列表，用户选择产品。
6. 用户选择工作项类型：`task` 或 `bug`。
7. 插件查询当前产品下未完成工作项，用户选择一个。
8. 插件展示该工作项参考信息：预计工时、已发生工时、当前完成度。
9. 用户选择 commit type，填写 subject、工时、完成度。
10. 插件将最新未推送 commit message 重写为公司规范格式。
11. 插件执行 git push。
12. **git push 成功后**，插件自动弹出“工时类型”选择框。
    - 若为 `bug`，则自动默认为 `13` (Bug修复)。
    - 若为 `task`，则请求字典接口获取所有可用类型供用户选择。
13. 插件调用 DevOps 接口，将工时数据（createTime, spendTaskTime, dayCompletion, workContent 等）登记到系统。

## 2. IDEA 与 VS Code 差异

IDEA 版建议重写平台层，不建议直接迁移 VS Code 代码。

需要重写：

- UI：VS Code QuickPick/InputBox -> IDEA `DialogWrapper`、Swing 表单、`JBList` 或 `JBTable`。
- 命令入口：VS Code command -> IDEA `AnAction`。
- 安全存储：VS Code SecretStorage -> IDEA `PasswordSafe`。
- Git 操作：VS Code Git API -> Git4Idea 或命令行 git。
- 通知：VS Code `showInformationMessage` -> IDEA `Notifications`。

可以照搬/复刻：

- DevOps API 调用流程。
- DevOps 响应解析规则。
- 工作项字段映射。
- commit message 生成规则。
- amend 前的未推送 commit 检查规则。

## 3. 插件入口

建议提供两个 Action：

- `InitializeDevOpsAccountAction`
  - 菜单位置：`Tools > Issue Link Push > 初始化 DevOps 账号`
  - 功能：录入并保存 DevOps 用户名、password 字段值。

- `PushWithDevOpsTaskAction`
  - 菜单位置：`VCS > Issue Link Push > 关联 DevOps 任务并推送`
  - 可选：也放到 Git 工具栏或右键菜单。
  - 功能：完整执行选择工作项、生成 commit message、amend、push。

## 4. 安全存储

使用 IDEA `PasswordSafe`。

需要保存：

- `issue-link-push.devops.username`
- `issue-link-push.devops.password`

- password 不是普通明文密码，而是浏览器登录 DevOps 平台 F12，在 `/login` 接口负载中获取的 `password` 字段值（加密后的密文）。
- 当前版本不要求用户录入 `userId`，登录成功后从响应中递归提取 `userId`。

## 5. DevOps API

基础域名：

```text
https://devops.ctjsoft.com
```

### 5.1 登录

接口：

```http
POST /login
Content-Type: multipart/form-data
```

表单字段：

```text
version=3.0
loginType=password
username=<stored username>
password=<stored password field value>
region=
year=<current year>
```

请求头建议包含：

```text
Accept: application/json, text/plain, */*
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Cache-Control: no-cache
Origin: https://devops.ctjsoft.com
Pragma: no-cache
User-Agent: Mozilla/5.0 ...
user-context: {"userId":"","userCode":"","userName":"undefined","appId":"","appCode":"","busiYear":"","tenantId":"","pageId":""}
```

登录成功后：

- 从 `Set-Cookie` 提取 cookie，例如：
  - `X-SESSION-ID`
  - `X-SESSION-ID-8875`
  - `ctjTokenId`
- 从响应体中递归查找 `userId`。
- 响应体可能不是标准 JSON，需要兼容 JavaScript 对象表达式。

### 5.2 产品列表

接口：

```http
GET /devops-server/config/commonQuery/query/product/listByUserRight?userId=<userId>&pageId=AbY8d4R
```

请求头：

```text
Cookie: <login cookies>
user-context: {"userId":"<userId>","pageId":"AbY8d4R"}
```

字段映射：

- 产品 ID：优先 `prodId`，其次 `productId`、`prodCode`、`code`、`id`。
- 产品名称：只显示 `prodCname`；如果没有则降级显示产品 ID。

### 5.3 未完成 task/bug 列表

接口：

```http
POST /devops-server/config/v3/task/query/loadTaskListWithGroup
Content-Type: application/json
```

请求头：

```text
Cookie: <login cookies>
Origin: https://devops.ctjsoft.com
user-context: {"userId":"<userId>","pageId":"AbY8d4R"}
```

请求体：

```json
{
  "simpleFieldCondition": {
    "topMenuId": "DevPro",
    "pageId": "AbY8d4R",
    "currentUser": "<userId>",
    "currentProductId": "undefined",
    "configFlag": "Task",
    "parentId": "createTime6259$0",
    "taskTypeQueryRule": "0",
    "progressStatus": "incomplete",
    "prodId": ["<selected product id>"]
  },
  "groupId": "1",
  "groupField": "createTime",
  "groupFieldValue": "createTime6259$0",
  "parentGroupInfos": [],
  "groupTaskCount": 1
}
```

`configFlag` 规则：

- 用户选择 `task` -> `Task`
- 用户选择 `bug` -> `Bug`

响应体形态：

```json
{
  "status_code": "0000",
  "reason": "查询成功",
  "data": (function(){ ... return rs; })(),
  "runtime": 1071
}
```

注意：

- `data` 可能是 JavaScript 表达式，不是严格 JSON。实现时要先读文本，再兼容解析。
- **解析优化**：提取 `planTaskTime`、`completion` 等数值时，如果字符串末尾带有 `%`，应先剔除再保存为纯数字字符串，防止 UI 展示出现双百分号 (如 `20%%`)。

字段映射：

- 工作项编号：优先 `taskNo`，其次 `problemNo`、`code`、`taskCode`、`bugCode`、`taskId`、`id`。
- 标题：优先 `taskName`，其次 `bugName`、`title`、`name`。
- 状态：优先 `status`，其次 `progressStatus`。
- 预计工时：`planTaskTime`。
- 已发生工时：优先 `devWorkload`，其次 `proWorkload`、`executeTaskTime`。
- 当前完成度：优先 `completion`，其次 `groupTaskSumCompletion`。

### 5.4 工时类型字典 (Task)

接口：

```http
GET /platform-server/run/dictValue/query/queryDictValueByCode?eleCatalogCode=taskCatalog
```

请求头：

```text
Cookie: <login cookies>
user-context: {"userId":"<userId>","pageId":"AbY8d4R"}
```

字段映射：

- 类型名称：优先 `valueName`，其次 `dictLabel`、`name`。
- 类型 ID：优先 `value`，其次 `dictValue`、`code`、`id`。

### 5.5 登记工时

接口：

```http
POST /devops-server/config/v3/task/add/addWorkHour
Content-Type: application/json
```

请求头：

```text
Cookie: <login cookies>
Origin: https://devops.ctjsoft.com
user-context: {"userId":"<userId>","pageId":"AbY8d4R"}
```

请求体：

```json
{
  "createTime": "YYYY-MM-DD",
  "taskWorkhourType": "<selected type id>",
  "spendTaskTime": <hours number>,
  "dayCompletion": "<progress>%",
  "workContent": "<subject>",
  "taskId": "<task primary key id>",
  "createUser": "<userId>"
}
```

注意：

- `taskWorkhourType`：如果是 Bug，固定传 `"13"`；如果是 Task，传用户选择的字典 ID。
- `dayCompletion`：必须带 `%` 后缀字符串。
- `taskId`：必须传工作项的数据库主键 ID（通常是长整型数字字符串）。
- `createTime`：取当前日期。
- `workContent`：取提交信息的 subject 部分。

## 6. UI 设计

建议用一个多步骤 `DialogWrapper` 或多个顺序弹窗。

步骤：

1. 产品选择
   - 列表只显示 `prodCname`。
   - 内部保存产品 ID。

2. 工作项类型选择
   - `task`
   - `bug`

3. 工作项选择
   - 显示编号、标题、状态。
   - 同时显示参考信息：
     - 预计工时
     - 已发生工时
     - 当前完成度

4. commit type 选择
   - `feat`
   - `fix`
   - `perf`
   - `refactor`
   - `test`
   - `style`
   - `build`
   - `chore`
   - `upd`
   - `Merge`
   - `doc`

5. subject 输入
   - 校验不为空。
   - 不少于 5 个中文字符或 10 个字符。
   - 不超过 250 个中文字符或 500 个字符。
   - 不允许用户手动输入 `scrum -e`。

6. 工时输入
   - 数字，必须大于 0。
   - 输入框旁展示参考：
     - 预计工时
     - 已发生工时

7. 完成度输入
   - 整数，范围 `0-100`。
   - 输入框旁展示当前完成度。
   - 提示：填 `100` 后 DevOps 可能自动置为已解决。

9. 预览确认
   - 展示最终 commit message。
   - 用户确认后执行 amend + push。

10. 工时类型确认 (Push 成功后)
    - 展示工时类型列表（Task）或自动确认（Bug）。
    - 确认后发送工时登记请求。

## 7. Commit Message 规则

普通提交格式：

```text
<type>:<subject> scrum -e <issueId> -h:<hours> -s:<progress>
```

示例：

```text
fix:修复xxxx缺陷 scrum -e 675580 -h:1.5 -s:90
```

Merge 格式：

```text
Merge <subject> scrum -e <issueId> -h:<hours> -s:<progress>
```

注意：

- 必须包含小写 `scrum -e`。
- `-h`、`-s` 参数也必须小写。
- 普通 type 不区分大小写，但建议统一使用小写。
- `Merge` 区分大小写，且后面是空格，不是冒号。
- 最终 message 不少于 10 个字符，不超过 500 个字符。

模板逻辑：

```text
${COMMIT_TYPE}:${SUBJECT} scrum -e ${CODE} -h:${HOURS} -s:${PROGRESS}
```

当 `${COMMIT_TYPE}` 为 `Merge` 时，将开头 `Merge:` 替换为 `Merge `。

## 8. Git Amend 与 Push

当前设计保留 VS Code 版的行为：

- 开发者先本地 commit。
- 插件推送前只修改最新未推送 commit 的 message。
- 原本地 commit message 不自动携带。
- 以插件弹窗填写并预览的信息为最终 message。

理由：

- 公司服务端检查非常严格。
- 保留原本地 message 容易混入不合规内容。
- 插件统一生成规范 message，更稳定。

执行前检查：

```bash
git rev-parse --abbrev-ref --symbolic-full-name @{u}
git rev-list --count @{u}..HEAD
```

如果没有 upstream 或没有未推送 commit，则提示用户并停止。

执行 amend：

```bash
git commit --amend --only -m "<generated message>"
```

使用 `--only`，避免把当前暂存区内容意外并入 commit。

推送：

```bash
git push
```

IDEA 里可以优先使用 Git4Idea API；如果复杂，可以先用命令行 git 实现。

## 9. 推荐 Kotlin 模块划分

```text
idea-plugin/
├── src/main/kotlin/
│   ├── action/
│   │   ├── InitializeDevOpsAccountAction.kt
│   │   └── PushWithDevOpsTaskAction.kt
│   ├── devops/
│   │   ├── CompanyDevOpsClient.kt
│   │   ├── DevOpsModels.kt
│   │   └── DevOpsResponseParser.kt
│   ├── git/
│   │   └── AmendAndPushService.kt
│   ├── settings/
│   │   └── DevOpsCredentialStore.kt
│   └── ui/
│       └── DevOpsTaskDialog.kt
└── src/main/resources/META-INF/plugin.xml
```

## 10. 最小验收标准

1. 能初始化并保存 DevOps 用户名/password 字段值。
2. 能登录并提取 cookie 与 userId。
3. 能拉取产品列表，产品下拉只显示 `prodCname`。
4. 能按产品和类型拉取未完成 task/bug。
5. 任务列表能展示编号、标题、预计工时、已发生工时、当前完成度。
6. 能生成如下格式的 commit message：

```text
fix:修复xxxx缺陷 scrum -e 26037689 -h:1.5 -s:90
```

9. 能推送并自动触发工时登记。
10. 工时登记时能正确处理 task (需选择类型) 和 bug (自动传 13) 的差异。
11. 工时登记成功后有明确通知。
