# Issue Link Push Detailed Design

## Goal

The extension helps developers produce commit messages that pass the company DevOps scrum check. It logs in to DevOps, lets the developer select a product and one unfinished task or bug, collects work hours and progress, rewrites the latest unpushed commit message, then pushes.

## Generated Commit Message

Normal commits:

```text
<type>:<subject> scrum -e <issueId> -h:<hours> -s:<progress>
```

Example:

```text
fix:修复xxxx缺陷 scrum -e 675580 -h:1.5 -s:90
```

Merge commits:

```text
Merge <subject> scrum -e <issueId> -h:<hours> -s:<progress>
```

Allowed normal types:

- `feat`
- `fix`
- `perf`
- `refactor`
- `test`
- `style`
- `build`
- `chore`
- `upd`
- `doc`

The generated message includes lowercase `scrum -e`, `-h:<hours>`, and `-s:<progress>`.

## DevOps API

Login:

```http
POST /login
Content-Type: multipart/form-data
```

Product list:

```http
GET /devops-server/config/commonQuery/query/product/listByUserRight?userId=<userId>&pageId=AbY8d4R
```

Task or bug list:

```http
POST /devops-server/config/v3/task/query/loadTaskListWithGroup
```

Important task request fields:

- `simpleFieldCondition.configFlag`: `Task` or `Bug`
- `simpleFieldCondition.progressStatus`: `incomplete`
- `simpleFieldCondition.prodId`: selected product id
- `groupField`: `createTime`
- `groupFieldValue`: `createTime6259$0`

## Amend Strategy

The extension checks that the current branch has an upstream and at least one unpushed commit, then runs:

```bash
git commit --amend --only -m "<generated message>"
```

`--only` prevents staged local changes from being accidentally included in the amended commit.
