const fs = require("fs");
const path = require("path");
const os = require("os");

const dataDir = path.join(
  os.homedir(),
  ".deepseek-codex-gui"
);

const dataFile = path.join(
  dataDir,
  "thread-history.json"
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

    return Array.isArray(data)
      ? data
      : [];
  } catch {
    return [];
  }
}

function save(items) {
  ensureDataDir();

  fs.writeFileSync(
    dataFile,
    JSON.stringify(items, null, 2),
    "utf8"
  );
}

function summarizeLegacyTitle(value) {
  let title = String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(请|帮我|麻烦你|能否|可以|我想|我需要|请帮我)\s*/i, "")
    .split(/[。！？!?；;]/)[0]
    .trim();

  if (!title) return "新任务";
  return title.length > 16
    ? `${title.slice(0, 16).trim()}…`
    : title;
}

function migrateLegacyTitles(items) {
  let changed = false;
  const next = items.map(item => {
    if (
      item?.titleSource === "manual" ||
      !item?.title ||
      item.title === "新任务" ||
      item.title.length <= 16
    ) {
      return item;
    }

    changed = true;
    return {
      ...item,
      title: summarizeLegacyTitle(item.title),
      titleSource: "auto"
    };
  });

  if (changed) save(next);
  return next;
}

function upsert(record) {
  const items = load();

  const old = items.find(
    item => item.threadId === record.threadId
  );

  const merged = {
    threadId: record.threadId,
    projectPath:
      record.projectPath ||
      old?.projectPath ||
      "",
    title:
      record.title ||
      old?.title ||
      "新任务",
    titleSource:
      record.titleSource ||
      old?.titleSource ||
      "auto",
    createdAt:
      old?.createdAt ||
      record.createdAt ||
      Date.now(),
    updatedAt:
      Date.now()
  };

  const next = items.filter(
    item =>
      item.threadId !==
      record.threadId
  );

  next.unshift(merged);

  save(next.slice(0, 100));

  return merged;
}

function list(projectPath = null) {
  let items = migrateLegacyTitles(load());

  if (projectPath) {
    items = items.filter(
      item =>
        item.projectPath &&
        item.projectPath.toLowerCase() ===
        projectPath.toLowerCase()
    );
  }

  return items.sort(
    (a, b) =>
      b.updatedAt - a.updatedAt
  );
}

function get(threadId) {
  return load().find(
    item => item.threadId === threadId
  ) || null;
}

function rename(threadId, newTitle) {
  const title =
    String(newTitle || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

  if (!title) {
    throw new Error("任务名称不能为空");
  }

  const items = load();

  const index = items.findIndex(
    item => item.threadId === threadId
  );

  if (index === -1) {
    throw new Error("找不到这条历史任务");
  }

  items[index].title = title;
  items[index].titleSource = "manual";
  items[index].updatedAt = Date.now();

  save(items);

  return items[index];
}

function remove(threadId) {
  const items = load();

  const exists = items.some(
    item => item.threadId === threadId
  );

  if (!exists) {
    return false;
  }

  const next = items.filter(
    item => item.threadId !== threadId
  );

  save(next);

  return true;
}

module.exports = {
  load,
  save,
  upsert,
  list,
  get,
  rename,
  remove
};
