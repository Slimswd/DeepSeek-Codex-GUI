const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const {
  commitStaged,
  createCheckpoint,
  getFileDiff,
  listCheckpoints,
  restoreCheckpoint,
  restoreFilesToHead,
  stageFiles,
  unstageFiles
} = require("./git-review-manager");

function git(folder, args) {
  return execFileSync("git", ["-C", folder, ...args], {
    encoding: "utf8",
    windowsHide: true
  }).trim();
}

function loadGitStatusParser() {
  const source = fs.readFileSync(
    path.join(__dirname, "main.js"),
    "utf8"
  );
  const start = source.indexOf(
    "function parseGitStatusOutput"
  );
  const end = source.indexOf(
    "\nasync function getGitStatus",
    start
  );
  assert.ok(start >= 0 && end > start);

  const context = {};
  vm.runInNewContext(
    `${source.slice(start, end)}\nthis.parse = parseGitStatusOutput;`,
    context
  );
  return context.parse;
}

async function main() {
  const testRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "deepseek-codex-git-review-")
  );

  try {
    git(testRoot, ["init"]);
    git(testRoot, ["config", "user.name", "Git Review Test"]);
    git(testRoot, [
      "config",
      "user.email",
      "git-review@test.local"
    ]);

    const trackedPath = path.join(testRoot, "tracked.txt");
    const untrackedPath = path.join(testRoot, "draft.txt");
    fs.writeFileSync(trackedPath, "initial\n", "utf8");
    git(testRoot, ["add", "tracked.txt"]);
    git(testRoot, ["commit", "-m", "Initial commit"]);

    fs.writeFileSync(
      trackedPath,
      "checkpoint content\n",
      "utf8"
    );
    fs.writeFileSync(untrackedPath, "draft\n", "utf8");

    const spacedPath = path.join(testRoot, "space name.txt");
    const chinesePath = path.join(testRoot, "中文 文件.txt");
    fs.writeFileSync(spacedPath, "space\n", "utf8");
    fs.writeFileSync(chinesePath, "中文\n", "utf8");
    const porcelainOutput = execFileSync(
      "git",
      [
        "-C",
        testRoot,
        "-c",
        "core.quotepath=false",
        "status",
        "--porcelain=v1",
        "-z",
        "--branch",
        "--untracked-files=all"
      ],
      { encoding: "utf8", windowsHide: true }
    );
    const parsedStatus = loadGitStatusParser()(porcelainOutput);
    assert.ok(
      parsedStatus.files.some(
        item => item.path === "space name.txt"
      )
    );
    assert.ok(
      parsedStatus.files.some(
        item => item.path === "中文 文件.txt"
      )
    );
    fs.unlinkSync(spacedPath);
    fs.unlinkSync(chinesePath);

    const trackedDiff = await getFileDiff(
      testRoot,
      "tracked.txt"
    );
    assert.match(trackedDiff.diff, /checkpoint content/);

    const untrackedDiff = await getFileDiff(
      testRoot,
      "draft.txt"
    );
    assert.match(untrackedDiff.diff, /^\+draft/m);

    const checkpoint = await createCheckpoint(
      testRoot,
      "测试存档"
    );
    assert.ok(checkpoint.commit);

    const checkpointList = await listCheckpoints(testRoot);
    assert.equal(checkpointList.checkpoints.length, 1);
    assert.equal(
      checkpointList.checkpoints[0].label,
      "测试存档"
    );

    await stageFiles(testRoot, ["tracked.txt", "draft.txt"]);
    assert.match(git(testRoot, ["status", "--short"]), /A  draft/);

    await unstageFiles(testRoot, ["tracked.txt", "draft.txt"]);
    assert.match(git(testRoot, ["status", "--short"]), /\?\? draft/);

    fs.writeFileSync(trackedPath, "later change\n", "utf8");
    fs.unlinkSync(untrackedPath);
    await restoreCheckpoint(testRoot, checkpoint.id);
    assert.equal(
      fs.readFileSync(trackedPath, "utf8").replace(/\r\n/g, "\n"),
      "checkpoint content\n"
    );
    assert.equal(
      fs.readFileSync(untrackedPath, "utf8").replace(/\r\n/g, "\n"),
      "draft\n"
    );

    await restoreFilesToHead(testRoot, ["tracked.txt"]);
    assert.equal(
      fs.readFileSync(trackedPath, "utf8").replace(/\r\n/g, "\n"),
      "initial\n"
    );

    fs.writeFileSync(trackedPath, "committed\n", "utf8");
    await stageFiles(testRoot, ["tracked.txt"]);
    const committed = await commitStaged(
      testRoot,
      "Commit from review center"
    );
    assert.ok(committed.commit);
    assert.equal(
      git(testRoot, ["log", "-1", "--pretty=%s"]),
      "Commit from review center"
    );

    console.log("Git review manager smoke test passed.");
  } finally {
    const resolved = path.resolve(testRoot);
    const tempRoot = path.resolve(os.tmpdir());
    if (
      resolved.startsWith(tempRoot + path.sep) &&
      path.basename(resolved).startsWith(
        "deepseek-codex-git-review-"
      )
    ) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
