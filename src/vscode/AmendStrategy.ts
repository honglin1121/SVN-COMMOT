import * as cp from 'node:child_process';
import * as util from 'node:util';
import { formatDevOpsCommitMetadata } from '../core/DevOpsCommitFormatter';
import { DevOpsCommitMetadata } from '../core/DevOpsProvider';
import { Repository } from './git';

const execFile = util.promisify(cp.execFile);

export class AmendStrategy {
  constructor(private readonly repository: Repository) {}

  async apply(metadata: DevOpsCommitMetadata, template: string): Promise<void> {
    const cwd = this.repository.rootUri.fsPath;
    await ensureHasUnpushedCommit(cwd);

    const nextMessage = formatDevOpsCommitMetadata(template, metadata);
    validateCommitMessage(nextMessage);
    await execFile('git', ['commit', '--amend', '--only', '-m', nextMessage], { cwd });
  }
}

async function ensureHasUnpushedCommit(cwd: string): Promise<void> {
  const upstream = await execFile('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd })
    .then((result) => result.stdout.trim())
    .catch(() => undefined);

  if (!upstream) {
    throw new Error('当前分支没有 upstream。请先设置远端分支后再关联 DevOps 信息。');
  }

  const { stdout } = await execFile('git', ['rev-list', '--count', `${upstream}..HEAD`], { cwd });
  const count = Number(stdout.trim());
  if (!Number.isFinite(count) || count <= 0) {
    throw new Error('当前没有未推送的 commit 可修改。');
  }
}

function validateCommitMessage(message: string): void {
  if (message.length < 10) {
    throw new Error('commit message 不能少于 10 个字符。');
  }
  if (message.length > 500) {
    throw new Error('commit message 不能超过 500 个字符。');
  }
  if (!/\sscrum -e\s+\S+/.test(message)) {
    throw new Error('commit message 必须包含小写指令 scrum -e。');
  }
  if (!/^(feat|fix|perf|refactor|test|style|build|chore|upd|doc):/i.test(message) && !/^Merge\s/.test(message)) {
    throw new Error('commit message 必须以合法 type 开头，Merge 操作必须以 “Merge ” 开头。');
  }
}
