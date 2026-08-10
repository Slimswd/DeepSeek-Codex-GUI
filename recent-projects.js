const fs = require("fs");
const path = require("path");
const os = require("os");

const dataDir = path.join(
  os.homedir(),
  ".deepseek-codex-gui"
);

const dataFile = path.join(
  dataDir,
  "recent-projects.json"
);

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, {
      recursive: true
    });
  }
}

function load() {
  try {
    ensureDataDir();

    if (!fs.existsSync(dataFile)) {
      return [];
    }

    const raw = fs.readFileSync(
      dataFile,
      "utf8"
    );

    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      return [];
    }

    return data.filter(
      item =>
        typeof item === "string" &&
        fs.existsSync(item)
    );

  } catch {
    return [];
  }
}

function save(projects) {
  ensureDataDir();

  fs.writeFileSync(
    dataFile,
    JSON.stringify(projects, null, 2),
    "utf8"
  );
}

function add(projectPath) {
  let projects = load();

  projects = projects.filter(
    item =>
      item.toLowerCase() !==
      projectPath.toLowerCase()
  );

  projects.unshift(projectPath);

  projects = projects.slice(0, 10);

  save(projects);

  return projects;
}

function remove(projectPath) {
  const target =
    String(projectPath || "")
      .toLowerCase();

  let projects = load();

  projects = projects.filter(
    item =>
      item.toLowerCase() !== target
  );

  save(projects);

  return projects;
}

module.exports = {
  load,
  add,
  remove
};
