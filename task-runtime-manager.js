const ACTIVE_STATUSES = new Set([
  "starting",
  "running",
  "waitingApproval",
  "stopping"
]);

const TERMINAL_STATUSES = new Set([
  "completed",
  "interrupted",
  "error"
]);

function now() {
  return new Date().toISOString();
}

function createTaskState(threadId, values = {}) {
  const timestamp = now();

  return {
    threadId,
    currentTurnId: null,
    status: values.status || "idle",
    messages: [],
    streamedOutput: "",
    commandExecutions: [],
    approvals: [],
    diffs: [],
    errors: [],
    tokenUsage: null,
    // 历史恢复得到的 Thread 快照。任务在后台运行时切换回来，
    // 仍需要先显示原有会话，再叠加本次运行时消息与活动。
    historyThread: values.historyThread || null,
    model: values.model || null,
    reasoning: values.reasoning || null,
    projectPath: values.projectPath || null,
    createdAt: values.createdAt || timestamp,
    updatedAt: timestamp,
    queuedTurn: null,
    attachmentPaths: [],
    retryAttachmentPaths: [],
    events: [],
    itemIds: new Set()
  };
}

class TaskRuntimeManager {
  constructor(options = {}) {
    this.maxConcurrent = Math.max(
      1,
      Number(options.maxConcurrent) || 2
    );
    this.tasks = new Map();
    this.turnToThread = new Map();
    this.itemToThread = new Map();
    this.queue = [];
  }

  ensure(threadId, values = {}) {
    if (!threadId) {
      throw new Error("TaskState requires threadId");
    }

    let task = this.tasks.get(threadId);
    if (!task) {
      task = createTaskState(threadId, values);
      this.tasks.set(threadId, task);
    } else if (values.projectPath && !task.projectPath) {
      task.projectPath = values.projectPath;
    } else if (values.historyThread && !task.historyThread) {
      task.historyThread = values.historyThread;
    }

    this.touch(task);
    return task;
  }

  get(threadId) {
    return threadId ? this.tasks.get(threadId) || null : null;
  }

  has(threadId) {
    return this.tasks.has(threadId);
  }

  touch(task) {
    if (task) task.updatedAt = now();
    return task;
  }

  setStatus(threadId, status, patch = {}) {
    const task = this.ensure(threadId, patch);
    Object.assign(task, patch, { status });
    this.touch(task);
    return task;
  }

  bindTurn(threadId, turnId) {
    if (!threadId || !turnId) return null;

    const task = this.ensure(threadId);
    task.currentTurnId = turnId;
    this.turnToThread.set(String(turnId), threadId);
    this.touch(task);
    return task;
  }

  clearTurn(threadId, turnId = null) {
    const task = this.get(threadId);
    if (!task) return null;

    const current = task.currentTurnId;
    if (turnId) {
      this.turnToThread.delete(String(turnId));
    }
    if (current) {
      this.turnToThread.delete(String(current));
    }
    task.currentTurnId = null;
    this.touch(task);
    return task;
  }

  bindItem(threadId, itemId) {
    if (!threadId || !itemId) return;

    const task = this.ensure(threadId);
    task.itemIds.add(String(itemId));
    this.itemToThread.set(String(itemId), threadId);
    this.touch(task);
  }

  resolveContext(params = {}) {
    const item = params.item || {};
    const turn = params.turn || {};
    const candidates = [
      params.threadId,
      params.thread?.id,
      turn.threadId,
      item.threadId,
      params.turnId ? this.turnToThread.get(String(params.turnId)) : null,
      turn.id ? this.turnToThread.get(String(turn.id)) : null,
      params.itemId ? this.itemToThread.get(String(params.itemId)) : null,
      item.id ? this.itemToThread.get(String(item.id)) : null,
      item.turnId ? this.turnToThread.get(String(item.turnId)) : null
    ];

    for (const candidate of candidates) {
      if (candidate && this.tasks.has(candidate)) {
        return {
          threadId: candidate,
          turnId:
            params.turnId ||
            turn.id ||
            item.turnId ||
            this.get(candidate)?.currentTurnId ||
            null,
          itemId: params.itemId || item.id || null
        };
      }
    }

    return null;
  }

  activeCount() {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (ACTIVE_STATUSES.has(task.status)) count += 1;
    }
    return count;
  }

  canStart() {
    return this.activeCount() < this.maxConcurrent;
  }

  enqueue(threadId, payload) {
    const task = this.setStatus(threadId, "queued", {
      queuedTurn: payload
    });
    if (!this.queue.some(entry => entry.threadId === threadId)) {
      this.queue.push({ threadId, payload });
    }
    return task;
  }

  takeNextRunnable() {
    if (!this.canStart()) return null;

    while (this.queue.length) {
      const entry = this.queue.shift();
      const task = this.get(entry.threadId);
      if (!task || task.status !== "queued") continue;
      task.queuedTurn = null;
      this.touch(task);
      return entry;
    }

    return null;
  }

  addMessage(threadId, message) {
    const task = this.ensure(threadId);
    task.messages.push(message);
    this.touch(task);
    return task;
  }

  recordEvent(threadId, event) {
    const task = this.ensure(threadId);
    task.events.push({
      ...event,
      timestamp: event?.timestamp || now()
    });

    if (task.events.length > 500) {
      task.events.splice(0, task.events.length - 500);
    }

    this.touch(task);
    return task;
  }

  queuedCount() {
    return [...this.tasks.values()]
      .filter(task => task.status === "queued")
      .length;
  }

  snapshot(threadId) {
    const task = this.get(threadId);
    if (!task) return null;

    return {
      ...task,
      itemIds: [...task.itemIds],
      queuedTurn: task.queuedTurn
        ? { ...task.queuedTurn }
        : null
    };
  }

  snapshots() {
    return [...this.tasks.values()]
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map(task => this.snapshot(task.threadId));
  }

  isTerminal(threadId) {
    return TERMINAL_STATUSES.has(this.get(threadId)?.status);
  }
}

module.exports = {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  TaskRuntimeManager
};
