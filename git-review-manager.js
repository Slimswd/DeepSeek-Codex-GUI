const { execFile } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHECKPOINT_REF_PREFIX =
  "refs/deepseek-codex/checkpoints/";
const DEFAULT_DIFF_LIMIT = 900000;

function runGit(projectPath, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-C", projectPath, ...args],
      {
        cwd: projectPath,
        windowsHide: true,
        encoding: "utf8",
        timeout: options.timeout || 30000,
        maxBuffer:
          options.maxBuffer || 4 * 1024 * 1024,
        env: {
          ...process.env,
          LC_ALL: "C.UTF-8",
          LANG: "C.UTF-8",
          ...(options.env || {})
        }
      },
      (error, stdout, stderr) => {
        if (
          error &&
          !(
            Array.isArray(options.allowExitCodes) &&
            options.allowExitCodes.includes(
              Number(error.code)
            )
          )
        ) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }

        resolve({
          stdout: String(stdout || ""),
          stderr: String(stderr || ""),
          exitCode: error ? Number(error.code) : 0
        });
      }
    );
  });
}

async function getRepositoryInfo(projectPath) {
  if (!projectPath || !fs.existsSync(projectPath)) {
    throw new Error("请先选择有效的项目文件夹");
  }

  const rootResult = await runGit(projectPath, [
    "rev-parse",
    "--show-toplevel"
  ]);
  const repositoryRoot = rootResult.stdout.trim();

  if (!repositoryRoot) {
    throw new Error("当前项目不是 Git 仓库");
  }

  const headResult = await runGit(
    repositoryRoot,
    ["rev-parse", "--verify", "HEAD"],
    { allowExitCodes: [128] }
  );
  const branchResult = await runGit(
    repositoryRoot,
    ["symbolic-ref", "--quiet", "--short", "HEAD"],
    { allowExitCodes: [1, 128] }
  );

  return {
    repositoryRoot,
    headExists: headResult.exitCode === 0,
    head:
      headResult.exitCode === 0
        ? headResult.stdout.trim()
        : null,
    branch: branchResult.stdout.trim() || "未命名分支"
  };
}

function normalizeRepositoryPath(repositoryRoot, filePath) {
  const value = String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();

  if (!value || path.isAbsolute(value)) {
    throw new Error("文件路径无效");
  }

  const absolutePath = path.resolve(
    repositoryRoot,
    ...value.split("/")
  );
  const relativePath = path.relative(
    repositoryRoot,
    absolutePath
  );

  if (
    !relativePath ||
    relativePath === "." ||
    relativePath.startsWith(`..${path.sep}`) ||
    relativePath === ".." ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("文件不在当前 Git 项目中");
  }

  return {
    absolutePath,
    relativePath: relativePath
      .split(path.sep)
      .join("/")
  };
}

function normalizeFileList(repositoryRoot, files) {
  const unique = new Map();

  for (const filePath of Array.isArray(files) ? files : []) {
    const normalized = normalizeRepositoryPath(
      repositoryRoot,
      filePath
    );
    unique.set(normalized.relativePath, normalized);
  }

  if (!unique.size) {
    throw new Error("请至少选择一个文件");
  }

  return [...unique.values()];
}

function truncateDiff(text, limit = DEFAULT_DIFF_LIMIT) {
  const value = String(text || "");
  if (value.length <= limit) {
    return { text: value, truncated: false };
  }

  return {
    text:
      value.slice(0, limit) +
      "\n\n... Diff 内容较大，已在界面中截断。",
    truncated: true
  };
}

function isProbablyBinary(buffer) {
  if (!Buffer.isBuffer(buffer)) return false;
  const sample = buffer.subarray(
    0,
    Math.min(buffer.length, 8192)
  );
  return sample.includes(0);
}

function createUntrackedDiff(relativePath, absolutePath) {
  const stat = fs.lstatSync(absolutePath);
  if (stat.isSymbolicLink()) {
    return {
      text:
        `未跟踪符号链接：${relativePath}\n` +
        "为避免读取项目外部内容，界面不展开链接目标。",
      binary: true
    };
  }
  if (!stat.isFile()) {
    return {
      text: `未跟踪目录：${relativePath}`,
      binary: false
    };
  }

  if (stat.size > 600000) {
    return {
      text:
        `未跟踪文件：${relativePath}\n` +
        `大小：${stat.size} 字节\n\n` +
        "文件较大，暂不展开内容。",
      binary: true
    };
  }

  const buffer = fs.readFileSync(absolutePath);
  if (isProbablyBinary(buffer)) {
    return {
      text:
        `未跟踪二进制文件：${relativePath}\n` +
        `大小：${stat.size} 字节`,
      binary: true
    };
  }

  const lines = buffer
    .toString("utf8")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const body = lines.map(line => `+${line}`).join("\n");

  return {
    text: [
      "diff --git a/dev-null b/" + relativePath,
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/" + relativePath,
      `@@ -0,0 +1,${lines.length} @@`,
      body
    ].join("\n"),
    binary: false
  };
}

async function getFileDiff(projectPath, filePath) {
  const info = await getRepositoryInfo(projectPath);
  const normalized = normalizeRepositoryPath(
    info.repositoryRoot,
    filePath
  );
  const gitPath = normalized.relativePath;

  const [stagedResult, workingResult, statusResult] =
    await Promise.all([
      runGit(info.repositoryRoot, [
        "-c",
        "core.quotepath=false",
        "diff",
        "--cached",
        "--no-ext-diff",
        "--no-color",
        "--unified=3",
        "--",
        gitPath
      ]),
      runGit(info.repositoryRoot, [
        "-c",
        "core.quotepath=false",
        "diff",
        "--no-ext-diff",
        "--no-color",
        "--unified=3",
        "--",
        gitPath
      ]),
      runGit(info.repositoryRoot, [
        "-c",
        "core.quotepath=false",
        "status",
        "--porcelain=v1",
        "--",
        gitPath
      ])
    ]);

  let stagedDiff = stagedResult.stdout;
  let workingDiff = workingResult.stdout;
  let binary = /Binary files .* differ/i.test(
    `${stagedDiff}\n${workingDiff}`
  );

  if (
    !stagedDiff &&
    !workingDiff &&
    statusResult.stdout.startsWith("??") &&
    fs.existsSync(normalized.absolutePath)
  ) {
    const untracked = createUntrackedDiff(
      gitPath,
      normalized.absolutePath
    );
    workingDiff = untracked.text;
    binary = untracked.binary;
  }

  const sections = [];
  if (stagedDiff) {
    sections.push(
      "### 已暂存改动\n\n" + stagedDiff.trimEnd()
    );
  }
  if (workingDiff) {
    sections.push(
      "### 工作区改动\n\n" + workingDiff.trimEnd()
    );
  }

  const combined = truncateDiff(
    sections.join("\n\n") ||
      "该文件当前没有可显示的文本 Diff。"
  );

  return {
    ok: true,
    filePath: gitPath,
    stagedDiff,
    workingDiff,
    diff: combined.text,
    truncated: combined.truncated,
    binary,
    repositoryRoot: info.repositoryRoot
  };
}

function checkpointSubject(label) {
  const cleaned = String(label || "手动存档点")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "手动存档点";
}

async function createCheckpoint(projectPath, label) {
  const info = await getRepositoryInfo(projectPath);
  const createdAt = new Date().toISOString();
  const safeLabel = checkpointSubject(label);
  const suffix = crypto.randomBytes(3).toString("hex");
  const refId =
    createdAt.replace(/[-:.TZ]/g, "") + `-${suffix}`;
  const refName = CHECKPOINT_REF_PREFIX + refId;
  const tempIndex = path.join(
    os.tmpdir(),
    `deepseek-codex-checkpoint-${process.pid}-${suffix}.index`
  );
  const checkpointEnv = {
    GIT_INDEX_FILE: tempIndex,
    GIT_AUTHOR_NAME: "DeepSeek Codex",
    GIT_AUTHOR_EMAIL: "checkpoint@deepseek-codex.local",
    GIT_COMMITTER_NAME: "DeepSeek Codex",
    GIT_COMMITTER_EMAIL:
      "checkpoint@deepseek-codex.local"
  };

  try {
    if (info.headExists) {
      await runGit(
        info.repositoryRoot,
        ["read-tree", info.head],
        { env: checkpointEnv }
      );
    } else {
      await runGit(
        info.repositoryRoot,
        ["read-tree", "--empty"],
        { env: checkpointEnv }
      );
    }

    await runGit(
      info.repositoryRoot,
      ["add", "-A", "--", "."],
      { env: checkpointEnv, timeout: 120000 }
    );
    const treeResult = await runGit(
      info.repositoryRoot,
      ["write-tree"],
      { env: checkpointEnv }
    );
    const tree = treeResult.stdout.trim();
    const commitArgs = [
      "commit-tree",
      tree,
      ...(info.headExists ? ["-p", info.head] : []),
      "-m",
      `DeepSeek Codex 存档：${safeLabel}`,
      "-m",
      `创建时间：${createdAt}\n来源分支：${info.branch}`
    ];
    const commitResult = await runGit(
      info.repositoryRoot,
      commitArgs,
      { env: checkpointEnv }
    );
    const commit = commitResult.stdout.trim();

    await runGit(info.repositoryRoot, [
      "update-ref",
      refName,
      commit
    ]);

    return {
      ok: true,
      id: refId,
      refName,
      commit,
      shortCommit: commit.slice(0, 8),
      label: safeLabel,
      createdAt,
      branch: info.branch
    };
  } finally {
    for (const filePath of [tempIndex, `${tempIndex}.lock`]) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // 临时索引清理失败不会影响真实 Git 索引。
      }
    }
  }
}

async function countCheckpointFiles(repositoryRoot, commit) {
  const result = await runGit(repositoryRoot, [
    "diff-tree",
    "--root",
    "--no-commit-id",
    "--name-only",
    "-r",
    commit
  ]);
  return result.stdout.split(/\r?\n/).filter(Boolean).length;
}

async function listCheckpoints(projectPath) {
  const info = await getRepositoryInfo(projectPath);
  const result = await runGit(info.repositoryRoot, [
    "for-each-ref",
    "--count=50",
    "--sort=-creatordate",
    "--format=%(refname)%09%(objectname)%09%(creatordate:iso8601-strict)%09%(subject)",
    CHECKPOINT_REF_PREFIX
  ]);
  const rows = result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => {
      const [refName, commit, createdAt, ...subjectParts] =
        line.split("\t");
      const subject = subjectParts.join("\t");
      return {
        id: refName.slice(CHECKPOINT_REF_PREFIX.length),
        refName,
        commit,
        shortCommit: commit.slice(0, 8),
        createdAt,
        label: subject.replace(
          /^DeepSeek Codex 存档：/,
          ""
        )
      };
    });

  await Promise.all(
    rows.slice(0, 20).map(async row => {
      row.fileCount = await countCheckpointFiles(
        info.repositoryRoot,
        row.commit
      );
    })
  );

  return {
    ok: true,
    repositoryRoot: info.repositoryRoot,
    checkpoints: rows
  };
}

async function stageFiles(projectPath, files) {
  const info = await getRepositoryInfo(projectPath);
  const normalized = normalizeFileList(
    info.repositoryRoot,
    files
  );
  await runGit(
    info.repositoryRoot,
    [
      "add",
      "-A",
      "--",
      ...normalized.map(item => item.relativePath)
    ],
    { timeout: 120000 }
  );

  return {
    ok: true,
    files: normalized.map(item => item.relativePath)
  };
}

async function unstageFiles(projectPath, files) {
  const info = await getRepositoryInfo(projectPath);
  const normalized = normalizeFileList(
    info.repositoryRoot,
    files
  );
  const gitPaths = normalized.map(item => item.relativePath);

  if (info.headExists) {
    await runGit(info.repositoryRoot, [
      "restore",
      "--staged",
      "--",
      ...gitPaths
    ]);
  } else {
    await runGit(
      info.repositoryRoot,
      [
        "rm",
        "--cached",
        "-r",
        "--ignore-unmatch",
        "--",
        ...gitPaths
      ],
      { allowExitCodes: [1] }
    );
  }

  return { ok: true, files: gitPaths };
}

async function restoreFilesToHead(
  projectPath,
  files,
  options = {}
) {
  const info = await getRepositoryInfo(projectPath);
  if (!info.headExists) {
    throw new Error("项目还没有首次提交，无法恢复到上一版本");
  }

  const normalized = normalizeFileList(
    info.repositoryRoot,
    files
  );
  const safetyCheckpoint =
    options.createSafety === false
      ? null
      : await createCheckpoint(
          info.repositoryRoot,
          options.safetyLabel || "撤销文件前自动保护"
        );

  await runGit(
    info.repositoryRoot,
    [
      "restore",
      "--source=HEAD",
      "--staged",
      "--worktree",
      "--",
      ...normalized.map(item => item.relativePath)
    ],
    { timeout: 120000 }
  );

  return {
    ok: true,
    files: normalized.map(item => item.relativePath),
    safetyCheckpoint
  };
}

async function resolveCheckpoint(projectPath, checkpointId) {
  const listed = await listCheckpoints(projectPath);
  const checkpoint = listed.checkpoints.find(
    item =>
      item.id === checkpointId ||
      item.refName === checkpointId ||
      item.commit === checkpointId
  );

  if (!checkpoint) {
    throw new Error("没有找到这个存档点");
  }

  return {
    ...checkpoint,
    repositoryRoot: listed.repositoryRoot
  };
}

async function restoreCheckpoint(projectPath, checkpointId) {
  const checkpoint = await resolveCheckpoint(
    projectPath,
    checkpointId
  );
  const safetyCheckpoint = await createCheckpoint(
    checkpoint.repositoryRoot,
    "恢复存档前自动保护"
  );
  const info = await getRepositoryInfo(
    checkpoint.repositoryRoot
  );

  await runGit(
    checkpoint.repositoryRoot,
    [
      "restore",
      `--source=${checkpoint.commit}`,
      "--staged",
      "--worktree",
      "--",
      "."
    ],
    { timeout: 120000 }
  );

  if (info.headExists) {
    await runGit(checkpoint.repositoryRoot, [
      "reset",
      "--mixed",
      "--quiet",
      "HEAD"
    ]);
  }

  return {
    ok: true,
    checkpoint,
    safetyCheckpoint,
    note:
      "已恢复存档内容；恢复前的状态已自动保存为新的保护存档。较新的未跟踪文件不会被自动删除。"
  };
}

async function commitStaged(projectPath, message) {
  const info = await getRepositoryInfo(projectPath);
  const safeMessage = String(message || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  if (!safeMessage) {
    throw new Error("请输入本次提交说明");
  }

  const stagedCheck = await runGit(
    info.repositoryRoot,
    ["diff", "--cached", "--quiet"],
    { allowExitCodes: [1] }
  );
  if (stagedCheck.exitCode === 0) {
    throw new Error("当前没有已暂存的修改");
  }

  try {
    await runGit(
      info.repositoryRoot,
      ["commit", "--no-gpg-sign", "-m", safeMessage],
      { timeout: 120000, maxBuffer: 8 * 1024 * 1024 }
    );
  } catch (error) {
    const detail = String(
      error.stderr || error.stdout || error.message || ""
    ).trim();
    if (/user\.email|user\.name|identity unknown/i.test(detail)) {
      throw new Error(
        "Git 还没有配置提交者姓名和邮箱，请先在 GitHub Desktop 中完成 Git 身份设置。"
      );
    }
    throw new Error(detail || "Git 提交失败");
  }

  const commitResult = await runGit(info.repositoryRoot, [
    "rev-parse",
    "HEAD"
  ]);

  return {
    ok: true,
    commit: commitResult.stdout.trim(),
    shortCommit: commitResult.stdout.trim().slice(0, 8),
    message: safeMessage
  };
}

module.exports = {
  CHECKPOINT_REF_PREFIX,
  commitStaged,
  createCheckpoint,
  getFileDiff,
  getRepositoryInfo,
  listCheckpoints,
  normalizeRepositoryPath,
  restoreCheckpoint,
  restoreFilesToHead,
  runGit,
  stageFiles,
  unstageFiles
};
