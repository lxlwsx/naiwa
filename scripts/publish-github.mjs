/**
 * Publish local commits through the GitHub Git Data API.
 *
 * Why this exists: on some machines `github.com` cannot be resolved from the
 * shell (browser traffic goes through a system proxy that git/curl do not use),
 * so `git push` is impossible while `api.github.com` stays reachable. This tool
 * rebuilds the requested local commit range as real GitHub commits (blobs ->
 * trees -> commits) on top of a remote base branch and creates the remote
 * branch, which is exactly what a push would have produced content-wise.
 *
 * Usage:
 *   node scripts/publish-github.mjs --repo owner/name --branch feat/tooling \
 *     --from <localBaseSha> [--to HEAD] [--remote-base main] [--dry]
 *
 * The resulting branch is always a side branch: main/master are refused so the
 * protected branch can only advance through a reviewed pull request.
 *
 * Authentication: GH_TOKEN, or the token `gh auth token` returns. It is never
 * printed, and every request goes to https://api.github.com.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const PROTECTED_BRANCHES = new Set(['main', 'master']);

function gitBuffer(...gitArgs) {
  return execFileSync('git', gitArgs, { maxBuffer: 256 * 1024 * 1024 });
}

function gitText(...gitArgs) {
  return gitBuffer(...gitArgs)
    .toString('utf8')
    .trim();
}

export function parseTree(buffer) {
  return buffer
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((record) => {
      const [meta, path] = record.split('\t');
      const [mode, type, sha] = meta.split(' ');
      return { mode, type, sha, path };
    });
}

export function parseDiff(buffer) {
  const parts = buffer
    .toString('utf8')
    .split('\0')
    .filter((value) => value.length > 0);
  const changes = [];
  for (let index = 0; index < parts.length; index += 2) {
    const status = parts[index];
    const path = parts[index + 1];
    if (!path) throw new Error('unexpected diff output near status ' + status);
    if (!/^[AMD]$/.test(status)) throw new Error('unsupported diff status "' + status + '" for ' + path);
    changes.push({ status, path });
  }
  return changes;
}

export function parseCommitMeta(raw) {
  const lines = raw.split('\n');
  if (lines.length < 6) throw new Error('unexpected git show output');
  return {
    author: { name: lines[0], email: lines[1], date: lines[2] },
    committer: { name: lines[3], email: lines[4], date: lines[5] },
    message: lines.slice(6).join('\n').trimEnd(),
  };
}

export function assertBranchName(branch) {
  if (!branch || branch.startsWith('-') || branch.includes('..')) {
    throw new Error('invalid branch name: ' + String(branch));
  }
  const short = branch.replace(/^refs\/heads\//, '');
  if (PROTECTED_BRANCHES.has(short)) {
    throw new Error('refusing to publish directly to protected branch "' + short + '"; open a pull request instead');
  }
  return short;
}

function parseArgs(argv) {
  const options = { remoteBase: 'main', to: 'HEAD', dry: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry') {
      options.dry = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      options[key] = argv[index + 1];
      index += 1;
    } else {
      throw new Error('unexpected argument: ' + arg);
    }
  }
  return options;
}

function resolveToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  if (!token) throw new Error('no token: set GH_TOKEN or run gh auth login');
  return token;
}

function makeApi(token) {
  return async function api(method, path, body) {
    const response = await fetch('https://api.github.com' + path, {
      method,
      headers: {
        authorization: 'Bearer ' + token,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'naiwa-publish-github',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(method + ' ' + path + ' -> ' + response.status + ' ' + text.slice(0, 500));
    return text ? JSON.parse(text) : null;
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const repo = options.repo;
  if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) throw new Error('usage: --repo owner/name is required');
  if (!options.from) throw new Error('usage: --from <local base sha> is required');
  const branch = assertBranchName(options.branch || gitText('rev-parse', '--abbrev-ref', 'HEAD'));

  execFileSync('git', ['merge-base', '--is-ancestor', options.from, options.to]);
  const commits = gitText('rev-list', '--reverse', options.from + '..' + options.to)
    .split('\n')
    .filter(Boolean);
  if (commits.length === 0) throw new Error('nothing to publish: ' + options.from + '..' + options.to + ' is empty');

  console.log('[publish] repo=' + repo + ' branch=' + branch + ' remote-base=' + options.remoteBase);
  console.log(
    '[publish] local range ' + options.from.slice(0, 7) + '..' + options.to + ' -> ' + commits.length + ' commit(s)',
  );

  if (options.dry) {
    let previous = options.from;
    for (const sha of commits) {
      const changes = parseDiff(gitBuffer('diff-tree', '-r', '--no-commit-id', '--name-status', '-z', previous, sha));
      console.log(
        '[publish] ' + sha.slice(0, 7) + ' ' + changes.map((change) => change.status + ' ' + change.path).join(', '),
      );
      previous = sha;
    }
    console.log('[publish] dry run OK; target branch refs/heads/' + branch + ' would be created');
    return;
  }

  const token = resolveToken();
  const api = makeApi(token);
  const repoInfo = await api('GET', '/repos/' + repo);
  console.log('[publish] target: ' + repoInfo.full_name + ' (' + repoInfo.visibility + ')');

  const baseRef = await api('GET', '/repos/' + repo + '/git/ref/heads/' + options.remoteBase);
  let remoteCommit = baseRef.object.sha;
  let remoteTree = (await api('GET', '/repos/' + repo + '/git/commits/' + remoteCommit)).tree.sha;
  console.log('[publish] remote base ' + options.remoteBase + '=' + remoteCommit.slice(0, 7));

  let localParent = options.from;
  for (const sha of commits) {
    const changes = parseDiff(gitBuffer('diff-tree', '-r', '--no-commit-id', '--name-status', '-z', localParent, sha));
    const treeEntries = [];
    for (const change of changes) {
      if (change.status === 'D') {
        treeEntries.push({ path: change.path, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      const content = gitBuffer('show', sha + ':' + change.path).toString('base64');
      const blob = await api('POST', '/repos/' + repo + '/git/blobs', { content, encoding: 'base64' });
      const mode = gitText('ls-tree', sha, '--', change.path).split(' ')[0];
      treeEntries.push({ path: change.path, mode, type: 'blob', sha: blob.sha });
    }
    const tree = await api('POST', '/repos/' + repo + '/git/trees', { base_tree: remoteTree, tree: treeEntries });
    const meta = parseCommitMeta(
      execFileSync('git', ['show', '-s', '--format=%an%n%ae%n%aI%n%cn%n%ce%n%cI%n%B', sha], {
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      }),
    );
    const commit = await api('POST', '/repos/' + repo + '/git/commits', {
      message: meta.message,
      tree: tree.sha,
      parents: [remoteCommit],
      author: meta.author,
      committer: meta.committer,
    });
    console.log(
      '[publish] ' + sha.slice(0, 7) + ' -> ' + commit.sha.slice(0, 7) + ' (' + treeEntries.length + ' file change(s))',
    );
    remoteCommit = commit.sha;
    remoteTree = tree.sha;
    localParent = sha;
  }

  await api('POST', '/repos/' + repo + '/git/refs', { ref: 'refs/heads/' + branch, sha: remoteCommit });
  console.log('[publish] DONE refs/heads/' + branch + '=' + remoteCommit);
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error('[publish] FAIL ' + error.message);
    process.exit(1);
  });
}
