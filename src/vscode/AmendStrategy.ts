import * as cp from 'node:child_process';
import * as util from 'node:util';
import { formatDevOpsCommitMetadata } from '../core/DevOpsCommitFormatter';
import { DevOpsCommitMetadata } from '../core/DevOpsProvider';

const execFile = util.promisify(cp.execFile);

// @AI-Begin A3B5D 20260520 @@cc
export interface BranchPushState {
  hasUpstream: boolean;
  upstream?: string;
  hasUnpushedCommits: boolean;
}
// @AI-End A3B5D 20260520 @@cc

export class AmendStrategy {
  constructor(private readonly cwd: string) {}

  async apply(metadata: DevOpsCommitMetadata, template: string): Promise<void> {
    const state = await checkBranchState(this.cwd);
    if (!state.hasUnpushedCommits) {
      throw new Error('当前没有未推送的 commit 可修改。');
    }

    const nextMessage = formatDevOpsCommitMetadata(template, metadata);
    validateCommitMessage(nextMessage);
    await execFile('git', ['commit', '--amend', '--only', '-m', nextMessage], { cwd: this.cwd });
  }
}

// @AI-Begin R7S2T 20260520 @@cc
export async function checkBranchState(cwd: string): Promise<BranchPushState> {
  const upstream = await execFile('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd })
    .then((result) => result.stdout.trim())
    .catch(() => undefined);

  let hasUnpushedCommits = false;
  if (upstream) {
    const { stdout } = await execFile('git', ['rev-list', '--count', `${upstream}..HEAD`], { cwd });
    const count = Number(stdout.trim());
    hasUnpushedCommits = Number.isFinite(count) && count > 0;
  } else {
    try {
      await execFile('git', ['rev-parse', 'HEAD'], { cwd });
      hasUnpushedCommits = true;
    } catch {
      hasUnpushedCommits = false;
    }
  }

  return {
    hasUpstream: !!upstream,
    upstream,
    hasUnpushedCommits
  };
}
// @AI-End R7S2T 20260520 @@cc

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
    throw new Error('commit message 必须以合法 type 开头，Merge 操作必须以 "Merge " 开头。');
  }
}
