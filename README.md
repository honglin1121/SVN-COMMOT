# Issue Link Push

VS Code extension prototype for the company DevOps workflow.

## Flow

1. Initialize the DevOps account after installing the extension.
2. Open the submit command when code is ready to push.
3. Select product, work item type (`task` or `bug`), and one unfinished item.
4. Select commit type and input subject.
5. Input work hours and completion percentage.
6. The extension rewrites the latest unpushed commit message to the company scrum format, then runs `git push`.

## Commands

- `Issue Link Push: 初始化 DevOps 账号`
- `Issue Link Push: 关联 DevOps 任务并推送`

## Commit Format

Default generated format:

```text
<type>:<subject> scrum -e <issueId> -h:<hours> -s:<progress>
```

Example:

```text
fix:修复xxxx缺陷 scrum -e 675580 -h:1.5 -s:90
```

`Merge` is handled as:

```text
Merge <subject> scrum -e <issueId> -h:<hours> -s:<progress>
```

## DevOps API

The DevOps base URL is compiled into `src/core/providers/CompanyDevOpsAdapter.ts`:

```ts
const DEVOPS_BASE_URL = 'https://devops.ctjsoft.com';
```

Products are loaded from:

```text
GET /devops-server/config/commonQuery/query/product/listByUserRight?userId=<userId>&pageId=AbY8d4R
```

Unfinished tasks or bugs are loaded from:

```text
POST /devops-server/config/v3/task/query/loadTaskListWithGroup
```
1
