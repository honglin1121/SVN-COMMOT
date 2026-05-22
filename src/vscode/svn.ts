import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as util from 'node:util';
import * as vscode from 'vscode';

const execFileRaw = util.promisify(cp.execFile);

/** GBK 解码器（中文 Windows 的 SVN 输出编码） */
const gbkDecoder = new TextDecoder('gbk');

/**
 * 已解析的 svn 可执行文件绝对路径（缓存）
 */
let resolvedSvnPath: string | undefined;

/**
 * svn 可执行文件的常见安装路径（Windows）
 */
const SVN_CANDIDATE_PATHS = [
  'C:\\Program Files\\SlikSvn\\bin\\svn.exe',
  'C:\\Program Files (x86)\\SlikSvn\\bin\\svn.exe',
  'C:\\Program Files\\TortoiseSVN\\bin\\svn.exe',
  'C:\\Program Files (x86)\\TortoiseSVN\\bin\\svn.exe',
  'C:\\Program Files\\CollabNet\\Subversion Client\\svn.exe'
];

/**
 * 探测 svn 可执行文件的绝对路径
 * 优先通过 PATH 查找，失败后尝试常见安装路径
 */
async function resolveSvnPath(): Promise<string> {
  if (resolvedSvnPath) {
    return resolvedSvnPath;
  }

  // 尝试通过系统 PATH 执行 svn
  try {
    await execFileRaw('svn', ['--version', '--quiet'], { shell: true, timeout: 5000, encoding: 'utf8' });
    resolvedSvnPath = 'svn';
    return resolvedSvnPath;
  } catch {
    // PATH 中没有 svn，继续尝试常见路径
  }

  // 尝试常见安装路径
  for (const candidate of SVN_CANDIDATE_PATHS) {
    try {
      await fs.promises.access(candidate, fs.constants.X_OK);
      resolvedSvnPath = candidate;
      return resolvedSvnPath;
    } catch {
      // 此路径不存在，跳过
    }
  }

  throw new Error(
    '找不到 svn 命令。请确保已安装 SlikSVN 或 TortoiseSVN 并将其 bin 目录加入系统 PATH。\n' +
    '常见安装路径：C:\\Program Files\\SlikSvn\\bin\\svn.exe'
  );
}

/**
 * 使用已解析的 svn 路径执行命令，自动处理中文 Windows 下的 GBK 编码
 */
async function svnExec(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  const svn = await resolveSvnPath();
  const needShell = svn === 'svn';
  // 使用 buffer 编码读取原始字节，再按 GBK 解码以解决中文乱码
  const result = await execFileRaw(svn, args, { cwd, shell: needShell, encoding: 'buffer' });
  return {
    stdout: gbkDecoder.decode(result.stdout as unknown as Uint8Array),
    stderr: gbkDecoder.decode(result.stderr as unknown as Uint8Array)
  };
}

/**
 * SVN 工作副本信息
 */
export interface SvnInfo {
  /** 工作副本根路径 */
  rootPath: string;
  /** 仓库 URL */
  url: string;
  /** 当前版本号 */
  revision: string;
}

/**
 * 检查指定目录是否为 SVN 工作副本
 */
export async function isSvnWorkingCopy(cwd: string): Promise<boolean> {
  try {
    await svnExec(['info'], cwd);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取 SVN 工作副本信息
 */
export async function getSvnInfo(cwd: string): Promise<SvnInfo> {
  const { stdout } = await svnExec(['info'], cwd);
  return parseSvnInfo(stdout);
}

/**
 * SVN 文件状态项
 */
export interface SvnStatusItem {
  /** 状态标记：M=修改 A=新增 D=删除 R=替换 C=冲突 ?=未版本控制 */
  status: string;
  /** 文件相对路径 */
  path: string;
}

/**
 * 获取所有改动文件列表
 */
export async function getChangedFiles(cwd: string): Promise<SvnStatusItem[]> {
  const { stdout } = await svnExec(['status'], cwd);
  return parseStatusLines(stdout);
}

/**
 * 可提交的 SVN 状态标记（包含未版本控制，提交前需 svn add）
 * M=修改, A=新增, D=删除, R=替换, ?=未版本控制
 */
const COMMITTABLE_STATUSES = new Set(['M', 'A', 'D', 'R', '?']);

/**
 * 未版本控制的文件状态
 */
const UNVERSIONED_STATUS = '?';

/**
 * 冲突相关的 SVN 状态标记
 * C=冲突, ~=版本切换
 */
const CONFLICT_STATUSES = new Set(['C', '~']);

/** 状态标记的中文说明 */
const STATUS_LABELS: Record<string, string> = {
  M: '修改',
  A: '新增',
  D: '删除',
  R: '替换',
  C: '冲突',
  '~': '切换',
  '?': '未版本控制',
  '!': '缺失',
  X: '外部定义'
};

/**
 * 检查是否有可提交的改动
 */
export async function hasCommittableChanges(cwd: string): Promise<boolean> {
  const { stdout } = await svnExec(['status'], cwd);
  return parseStatusLines(stdout).some(item => COMMITTABLE_STATUSES.has(item.status));
}

/**
 * 解析 svn status 输出行
 */
function parseStatusLines(output: string): SvnStatusItem[] {
  return output.split('\n')
    .map(line => ({
      status: (line[0] ?? '').trim(),
      path: line.substring(8).trim()
    }))
    .filter(item => item.status && item.path);
}

/**
 * 判断指定状态的文件是否可提交
 */
export function isCommittable(status: string): boolean {
  return COMMITTABLE_STATUSES.has(status);
}

/**
 * 判断指定状态是否为未版本控制的文件
 */
export function isUnversioned(status: string): boolean {
  return status === UNVERSIONED_STATUS;
}

/**
 * 获取状态标记的中文说明
 */
export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * 将未版本控制的文件加入 SVN 版本控制（svn add）
 */
export async function svnAdd(cwd: string, files: string[]): Promise<void> {
  if (files.length === 0) {
    return;
  }
  await svnExec(['add', ...files], cwd);
}

/**
 * 执行 SVN 提交，只提交指定的文件
 * @param files 要提交的文件路径列表，为空则提交所有可提交的文件
 * @param unversionedFiles 需要先 svn add 的未版本控制文件列表
 */
export async function svnCommit(cwd: string, message: string, files?: string[], unversionedFiles?: string[]): Promise<string> {
  // 先将未版本控制的文件加入版本控制
  if (unversionedFiles && unversionedFiles.length > 0) {
    await svnAdd(cwd, unversionedFiles);
  }

  let targets = files;

  // 未指定文件时，自动筛选可提交的文件
  if (!targets || targets.length === 0) {
    const { stdout } = await svnExec(['status'], cwd);
    const items = parseStatusLines(stdout);
    const toCommit = items.filter(item => COMMITTABLE_STATUSES.has(item.status));
    const conflicts = items.filter(item => CONFLICT_STATUSES.has(item.status));

    if (toCommit.length === 0) {
      if (conflicts.length > 0) {
        const conflictPaths = conflicts.map(c => c.path).join('\n  ');
        throw new Error(
          `没有可提交的改动。以下文件处于冲突状态，请先解决冲突：\n  ${conflictPaths}`
        );
      }
      throw new Error('没有可提交的改动。');
    }

    targets = toCommit.map(item => item.path);
  }

  const { stdout: commitOutput } = await svnExec(
    ['commit', '-m', message, ...targets],
    cwd
  );
  return commitOutput.trim();
}

/**
 * 从工作区中查找 SVN 工作副本目录，如果有多个则让用户选择
 */
export async function pickWorkingCopy(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  if (workspaceFolders.length === 1) {
    const cwd = workspaceFolders[0].uri.fsPath;
    if (await isSvnWorkingCopy(cwd)) {
      return cwd;
    }
    return undefined;
  }

  // 多个工作区时，过滤出 SVN 工作副本
  const candidates: { label: string; cwd: string }[] = [];
  for (const folder of workspaceFolders) {
    const cwd = folder.uri.fsPath;
    if (await isSvnWorkingCopy(cwd)) {
      candidates.push({
        label: vscode.workspace.asRelativePath(folder.uri),
        cwd
      });
    }
  }

  if (candidates.length === 0) {
    return undefined;
  }

  if (candidates.length === 1) {
    return candidates[0].cwd;
  }

  const picked = await vscode.window.showQuickPick(
    candidates.map((c) => ({ label: c.label, cwd: c.cwd })),
    { placeHolder: '选择要提交的 SVN 工作副本' }
  );

  return picked?.cwd;
}

/**
 * 校验提交信息格式
 */
export function validateCommitMessage(message: string): void {
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

/**
 * 格式化 SVN 错误信息（已是 GBK 解码后的正确中文）
 */
export function formatSvnError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * 解析 svn info 文本输出（兼容中英文）
 */
function parseSvnInfo(output: string): SvnInfo {
  let rootPath = '';
  let url = '';
  let revision = '';

  for (const line of output.split('\n')) {
    if (line.startsWith('Working Copy Root Path:') || line.startsWith('工作副本根目录：')) {
      const sep = line.indexOf('：') >= 0 ? '：' : ':';
      rootPath = line.substring(line.indexOf(sep) + 1).trim();
    } else if (line.startsWith('URL:') || line.startsWith('URL：')) {
      const sep = line.indexOf('：') >= 0 ? '：' : ':';
      url = line.substring(line.indexOf(sep) + 1).trim();
    } else if (line.startsWith('Revision:') || line.startsWith('版本：')) {
      const sep = line.indexOf('：') >= 0 ? '：' : ':';
      revision = line.substring(line.indexOf(sep) + 1).trim();
    }
  }

  return { rootPath, url, revision };
}
