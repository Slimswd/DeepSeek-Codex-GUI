(function () {
  "use strict";

  const api = window.deepseekCodex;

  function cleanError(error) {
    return String(error?.message || error || "操作失败")
      .replace(
        /^Error invoking remote method '[^']+': Error:\s*/,
        ""
      )
      .replace(/^Error:\s*/, "")
      .trim();
  }

  function formatTime(value) {
    if (!value) return "时间未知";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  function statusLabel(item) {
    if (item.kind === "conflict") return "冲突";
    if (item.isRenamed) return "重命名";
    if (item.kind === "untracked") return "新文件";
    if (item.hasStaged && item.hasWorktree) {
      return "已暂存 + 修改";
    }
    if (item.hasStaged) return "已暂存";
    return "未暂存";
  }

  function createStyle() {
    if (document.getElementById("git-review-center-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "git-review-center-style";
    style.textContent = `
.git-review-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 7px 11px;
  border: 1px solid var(--theme-border-strong, #344456);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-panel, #151c25) 86%, transparent);
  color: var(--theme-muted, #aebdce);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  transition: border-color .16s ease, background .16s ease, color .16s ease;
}

.git-review-trigger:hover {
  border-color: #f47721;
  color: var(--theme-text-strong, #fff);
  background: color-mix(in srgb, var(--theme-surface-alt, #1b2633) 92%, transparent);
}

.git-review-trigger i { color: #f47721; font-size: 15px; }
.git-review-trigger strong {
  min-width: 18px;
  color: var(--theme-text, #e4edf7);
  font-size: 11px;
  font-weight: 750;
  text-align: center;
}
.git-review-trigger[data-tone="warning"] strong { color: var(--theme-warning, #f2cf8c); }

.grc-overlay {
  position: fixed;
  inset: 0;
  z-index: 120000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  background: var(--theme-overlay, rgba(3, 7, 12, .72));
  backdrop-filter: blur(8px);
}

.grc-overlay[hidden] { display: none !important; }

.grc-shell {
  display: flex;
  flex-direction: column;
  width: min(1180px, calc(100vw - 56px));
  height: min(820px, calc(100vh - 56px));
  min-height: 560px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong, #344456) 88%, #f47721 12%);
  border-radius: 18px;
  background: color-mix(in srgb, var(--theme-panel, #111923) 96%, #070b10 4%);
  box-shadow: 0 28px 90px rgba(0, 0, 0, .58), 0 0 0 1px rgba(244, 119, 33, .05) inset;
}

.grc-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 18px 20px 15px;
  border-bottom: 1px solid var(--theme-border, #26323f);
  background: linear-gradient(180deg, color-mix(in srgb, var(--theme-surface, #111820) 95%, #f47721 5%), var(--theme-panel, #151c25));
}

.grc-heading { display: flex; align-items: center; gap: 12px; min-width: 0; }
.grc-heading-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(244, 119, 33, .36);
  border-radius: 12px;
  color: #ff8b38;
  background: rgba(244, 119, 33, .1);
  box-shadow: 0 0 20px rgba(244, 119, 33, .08);
  font-size: 20px;
}

.grc-title { color: var(--theme-text-strong, #f5f8fc); font-size: 16px; font-weight: 760; }
.grc-project {
  display: block;
  max-width: 720px;
  margin-top: 3px;
  overflow: hidden;
  color: var(--theme-subtle, #7f8d9e);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grc-close {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--theme-muted, #9eadbf);
  background: transparent;
  cursor: pointer;
  font-size: 21px;
}
.grc-close:hover { border-color: var(--theme-border-strong, #344456); background: var(--theme-surface-alt, #1b2633); color: var(--theme-text-strong, #fff); }

.grc-repo-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 43px;
  padding: 8px 20px;
  overflow: auto hidden;
  border-bottom: 1px solid var(--theme-border, #26323f);
  background: color-mix(in srgb, var(--theme-surface, #111820) 82%, transparent);
}

.grc-branch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border: 1px solid var(--theme-border-strong, #344456);
  border-radius: 999px;
  color: var(--theme-text, #dce6f1);
  background: var(--theme-input, #0f161e);
  font-size: 11px;
  white-space: nowrap;
}

.grc-chip {
  padding: 5px 8px;
  border-radius: 999px;
  color: var(--theme-muted, #98a7b8);
  background: var(--theme-surface-alt, #18212c);
  font-size: 10px;
  white-space: nowrap;
}
.grc-chip[data-tone="success"] { color: var(--theme-success, #55d39b); }
.grc-chip[data-tone="warning"] { color: var(--theme-warning, #f2cf8c); }
.grc-chip[data-tone="danger"] { color: var(--theme-danger, #ffaaa8); }

.grc-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  border-bottom: 1px solid var(--theme-border, #26323f);
}

.grc-tabs { display: flex; align-items: center; gap: 4px; }
.grc-tab, .grc-icon-button {
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--theme-muted, #93a1b2);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
.grc-tab { padding: 7px 10px; }
.grc-tab.active {
  border-color: rgba(244, 119, 33, .34);
  color: var(--theme-text-strong, #fff);
  background: rgba(244, 119, 33, .1);
}
.grc-icon-button { display: grid; place-items: center; width: 32px; height: 32px; margin-left: auto; padding: 0; font-size: 16px; }
.grc-icon-button:hover { border-color: var(--theme-border-strong, #344456); color: var(--theme-text, #fff); background: var(--theme-surface-alt, #18212c); }
.grc-icon-button.spinning i { animation: grc-spin .8s linear infinite; }
@keyframes grc-spin { to { transform: rotate(360deg); } }

.grc-notice {
  min-height: 0;
  max-height: 0;
  padding: 0 20px;
  overflow: hidden;
  border-bottom: 0 solid transparent;
  color: var(--theme-muted, #aebdce);
  background: var(--theme-surface-alt, #18212c);
  font-size: 11px;
  line-height: 1.45;
  transition: max-height .18s ease, padding .18s ease;
}
.grc-notice.visible { max-height: 66px; padding: 9px 20px; border-bottom-width: 1px; border-bottom-color: var(--theme-border, #26323f); }
.grc-notice[data-tone="success"] { color: var(--theme-success, #55d39b); }
.grc-notice[data-tone="danger"] { color: var(--theme-danger, #ffaaa8); }
.grc-init-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--theme-border, #26323f);
  color: var(--theme-muted, #aebdce);
  background: rgba(244, 119, 33, .06);
  font-size: 12px;
}
.grc-init-notice[hidden] { display: none; }
.grc-init-notice > span { display: inline-flex; align-items: center; gap: 7px; }

.grc-body { flex: 1; min-height: 0; }
.grc-view { height: 100%; min-height: 0; }
.grc-view[hidden] { display: none !important; }

.grc-change-layout {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

.grc-files-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--theme-border, #26323f);
  background: color-mix(in srgb, var(--theme-surface, #111820) 62%, transparent);
}

.grc-files-head {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 42px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--theme-border, #26323f);
  color: var(--theme-muted, #93a1b2);
  font-size: 11px;
}
.grc-files-head label { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }
.grc-files-head span:last-child { margin-left: auto; }

.grc-check {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: #f47721;
  cursor: pointer;
}

.grc-file-list { flex: 1; min-height: 0; overflow: auto; padding: 5px; }
.grc-file-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 7px 8px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: var(--theme-text, #dce6f1);
  cursor: pointer;
  outline: none;
}
.grc-file-row:hover { background: var(--theme-surface-alt, #18212c); }
.grc-file-row.active { border-color: rgba(244, 119, 33, .36); background: rgba(244, 119, 33, .08); }
.grc-file-copy { min-width: 0; }
.grc-file-name, .grc-file-dir { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.grc-file-name { color: var(--theme-text-strong, #f4f7fa); font-size: 11px; font-weight: 650; }
.grc-file-dir { margin-top: 3px; color: var(--theme-subtle, #718298); font-size: 9px; }
.grc-file-badge {
  max-width: 86px;
  padding: 4px 6px;
  overflow: hidden;
  border-radius: 6px;
  color: var(--theme-muted, #98a7b8);
  background: var(--theme-input, #0f161e);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grc-file-row[data-kind="untracked"] .grc-file-badge { color: var(--theme-success, #55d39b); }
.grc-file-row[data-kind="conflict"] .grc-file-badge { color: var(--theme-danger, #ffaaa8); }
.grc-file-row[data-staged="true"] .grc-file-badge { color: #8cb9ff; }

.grc-empty {
  display: grid;
  place-items: center;
  min-height: 170px;
  padding: 26px;
  color: var(--theme-subtle, #718298);
  text-align: center;
  font-size: 12px;
  line-height: 1.65;
}
.grc-empty i { display: block; margin-bottom: 8px; color: #f47721; font-size: 28px; }

.grc-diff-pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--theme-code, #080d12); }
.grc-diff-head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  padding: 8px 13px;
  border-bottom: 1px solid var(--theme-border, #26323f);
  color: var(--theme-muted, #93a1b2);
  background: var(--theme-surface, #111820);
  font-size: 10px;
}
.grc-diff-file { min-width: 0; overflow: hidden; color: var(--theme-text, #e1e9f2); font-size: 11px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.grc-diff-legend { display: flex; gap: 10px; margin-left: auto; white-space: nowrap; }
.grc-diff-legend .add { color: var(--theme-success, #55d39b); }
.grc-diff-legend .del { color: var(--theme-danger, #ff8e91); }
.grc-diff-scroll { flex: 1; min-height: 0; overflow: auto; font: 11px/1.55 Consolas, "Cascadia Mono", monospace; }
.grc-diff-lines { min-width: max-content; padding: 7px 0 18px; }
.grc-diff-line { display: grid; grid-template-columns: 48px 48px minmax(620px, 1fr); min-height: 20px; color: color-mix(in srgb, var(--theme-text, #d6e0eb) 88%, transparent); }
.grc-diff-line:hover { background: rgba(255, 255, 255, .025); }
.grc-line-number { padding: 1px 9px 1px 3px; border-right: 1px solid color-mix(in srgb, var(--theme-border, #26323f) 75%, transparent); color: var(--theme-subtle, #607083); text-align: right; user-select: none; }
.grc-line-code { padding: 1px 14px; white-space: pre; }
.grc-diff-line.add { background: rgba(56, 180, 116, .1); }
.grc-diff-line.add .grc-line-code { color: #9ce1b7; }
.grc-diff-line.del { background: rgba(224, 81, 81, .1); }
.grc-diff-line.del .grc-line-code { color: #ffaaa8; }
.grc-diff-line.hunk { background: rgba(76, 141, 255, .09); }
.grc-diff-line.hunk .grc-line-code { color: #8eb9ff; }
.grc-diff-line.meta .grc-line-code { color: #8c9aac; font-weight: 650; }
.grc-diff-line.section { margin-top: 7px; background: rgba(244, 119, 33, .09); }
.grc-diff-line.section .grc-line-code { color: #f4a56d; font-weight: 700; }

.grc-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border-top: 1px solid var(--theme-border, #26323f);
  background: var(--theme-surface, #111820);
}
.grc-footer-note { margin-right: auto; color: var(--theme-subtle, #718298); font-size: 10px; }
.grc-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 7px 11px;
  border: 1px solid var(--theme-border-strong, #344456);
  border-radius: 8px;
  color: var(--theme-text, #dce6f1);
  background: var(--theme-surface-alt, #18212c);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}
.grc-button:hover:not(:disabled) { border-color: #f47721; color: var(--theme-text-strong, #fff); }
.grc-button.primary { border-color: #d76618; color: #fff; background: linear-gradient(180deg, #f48735, #db681c); }
.grc-button.primary:hover:not(:disabled) { filter: brightness(1.07); }
.grc-button.danger { color: var(--theme-danger, #ffaaa8); }
.grc-button:disabled { opacity: .4; cursor: default; }

.grc-checkpoints { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.grc-checkpoint-intro {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 16px 18px 8px;
  padding: 13px 14px;
  border: 1px solid rgba(244, 119, 33, .24);
  border-radius: 11px;
  color: var(--theme-muted, #aab7c6);
  background: rgba(244, 119, 33, .06);
  font-size: 11px;
  line-height: 1.55;
}
.grc-checkpoint-intro i { flex: 0 0 auto; color: #f47721; font-size: 19px; }
.grc-checkpoint-list { flex: 1; min-height: 0; overflow: auto; padding: 8px 18px 18px; }
.grc-remote-view { height: 100%; overflow: auto; padding: 18px; }
.grc-remote-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.grc-remote-card { padding: 14px; border: 1px solid var(--theme-border, #26323f); border-radius: 12px; background: color-mix(in srgb, var(--theme-surface, #111820) 88%, transparent); }
.grc-remote-card h3 { margin: 0 0 8px; color: var(--theme-text-strong, #f4f7fa); font-size: 13px; }
.grc-remote-muted { color: var(--theme-subtle, #718298); font-size: 11px; line-height: 1.55; }
.grc-remote-value { color: var(--theme-text, #dce6f1); font-size: 12px; word-break: break-word; }
.grc-remote-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.grc-remote-branch { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.grc-remote-branch select { flex: 1; min-height: 34px; padding: 6px 9px; border: 1px solid var(--theme-border-strong, #344456); border-radius: 8px; color: var(--theme-text, #dce6f1); background: var(--theme-input, #0f161e); font: inherit; font-size: 11px; }
.grc-remote-warning { margin-top: 12px; padding: 10px 12px; border-radius: 9px; color: var(--theme-warning, #f2cf8c); background: rgba(244, 180, 65, .08); font-size: 11px; line-height: 1.5; }
@media (max-width: 760px) { .grc-remote-grid { grid-template-columns: 1fr; } }
.grc-checkpoint-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  margin-top: 8px;
  padding: 13px 14px;
  border: 1px solid var(--theme-border, #26323f);
  border-radius: 11px;
  background: color-mix(in srgb, var(--theme-surface, #111820) 86%, transparent);
}
.grc-checkpoint-label { color: var(--theme-text-strong, #f4f7fa); font-size: 12px; font-weight: 680; }
.grc-checkpoint-meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 5px; color: var(--theme-subtle, #718298); font: 9px/1.4 Consolas, monospace; }

.grc-busy-layer {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: none;
  place-items: center;
  border-radius: inherit;
  color: var(--theme-text, #e4edf7);
  background: color-mix(in srgb, var(--theme-panel, #111923) 72%, transparent);
  backdrop-filter: blur(3px);
  font-size: 12px;
}
.grc-shell { position: relative; }
.grc-shell.busy .grc-busy-layer { display: grid; }
.grc-busy-copy { display: flex; align-items: center; gap: 9px; padding: 11px 14px; border: 1px solid var(--theme-border-strong, #344456); border-radius: 10px; background: var(--theme-panel, #151c25); box-shadow: 0 12px 38px rgba(0,0,0,.35); }
.grc-busy-copy i { color: #f47721; font-size: 17px; animation: grc-spin .8s linear infinite; }

.grc-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 130000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(3, 7, 12, .62);
  backdrop-filter: blur(5px);
}
.grc-dialog-card { width: min(440px, calc(100vw - 40px)); padding: 19px; border: 1px solid var(--theme-border-strong, #344456); border-radius: 14px; color: var(--theme-text, #e4edf7); background: var(--theme-panel, #111923); box-shadow: 0 24px 70px rgba(0,0,0,.52); }
.grc-dialog-title { color: var(--theme-text-strong, #fff); font-size: 15px; font-weight: 720; }
.grc-dialog-message { margin-top: 9px; color: var(--theme-muted, #aebdce); font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
.grc-dialog-input { box-sizing: border-box; width: 100%; margin-top: 14px; padding: 10px 11px; border: 1px solid var(--theme-border-strong, #344456); border-radius: 8px; outline: none; color: var(--theme-text-strong, #fff); background: var(--theme-input, #0b1119); font: inherit; font-size: 12px; }
.grc-dialog-input:focus { border-color: #f47721; box-shadow: 0 0 0 3px rgba(244,119,33,.11); }
.grc-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

@media (max-width: 880px) {
  .grc-overlay { padding: 10px; }
  .grc-shell { width: calc(100vw - 20px); height: calc(100vh - 20px); min-height: 0; border-radius: 13px; }
  .grc-change-layout { grid-template-columns: 280px minmax(0, 1fr); }
  .grc-footer { flex-wrap: wrap; }
  .grc-footer-note { flex-basis: 100%; }
}
`;
    document.head.appendChild(style);
  }

  function createDialog(options = {}) {
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "grc-dialog-overlay";
      const card = document.createElement("div");
      card.className = "grc-dialog-card";

      const title = document.createElement("div");
      title.className = "grc-dialog-title";
      title.textContent = options.title || "确认操作";

      const message = document.createElement("div");
      message.className = "grc-dialog-message";
      message.textContent = options.message || "";

      let input = null;
      if (options.input) {
        input = document.createElement("input");
        input.className = "grc-dialog-input";
        input.type = "text";
        input.maxLength = Number(options.maxLength) || 120;
        input.value = options.value || "";
        input.placeholder = options.placeholder || "";
      }

      const actions = document.createElement("div");
      actions.className = "grc-dialog-actions";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "grc-button";
      cancel.textContent = options.cancelText || "取消";
      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className =
        "grc-button " +
        (options.danger ? "danger" : "primary");
      confirm.textContent = options.confirmText || "确认";

      actions.append(cancel, confirm);
      card.append(title, message);
      if (input) card.appendChild(input);
      card.appendChild(actions);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      function finish(value) {
        overlay.remove();
        resolve(value);
      }

      cancel.addEventListener("click", () => finish(null));
      confirm.addEventListener("click", () => {
        if (input && !input.value.trim()) {
          input.focus();
          return;
        }
        finish(input ? input.value.trim() : true);
      });
      overlay.addEventListener("click", event => {
        if (event.target === overlay) finish(null);
      });
      card.addEventListener("keydown", event => {
        if (event.key === "Escape") finish(null);
        if (event.key === "Enter" && input) {
          event.preventDefault();
          confirm.click();
        }
      });

      requestAnimationFrame(() => {
        (input || confirm).focus();
        if (input) input.select();
      });
    });
  }

  function create(options = {}) {
    if (!api) return null;
    createStyle();

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "git-review-trigger";
    trigger.title = "检查代码改动、创建存档点并安全恢复";
    trigger.innerHTML =
      '<i class="ph ph-git-diff"></i><span>审查</span><strong>--</strong>';

    const toolbarParent = options.toolbarParent;
    if (toolbarParent) {
      toolbarParent.insertBefore(
        trigger,
        options.beforeElement || null
      );
    }

    const overlay = document.createElement("div");
    overlay.className = "grc-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="grc-shell" role="dialog" aria-modal="true" aria-label="代码审查与 Git 操作中心">
        <header class="grc-header">
          <div class="grc-heading">
            <span class="grc-heading-icon"><i class="ph ph-git-diff"></i></span>
            <div>
              <div class="grc-title">代码审查与 Git 操作</div>
              <span class="grc-project">请先选择项目文件夹</span>
            </div>
          </div>
          <button type="button" class="grc-close" aria-label="关闭">×</button>
        </header>
        <div class="grc-repo-bar">
          <span class="grc-branch"><i class="ph ph-git-branch"></i><span>--</span></span>
          <span class="grc-chip grc-changed">改动 --</span>
          <span class="grc-chip grc-staged">已暂存 --</span>
          <span class="grc-chip grc-untracked">新文件 --</span>
          <span class="grc-chip grc-conflicts">冲突 --</span>
          <span class="grc-chip grc-sync">未读取远程状态</span>
        </div>
        <div class="grc-toolbar">
          <div class="grc-tabs">
            <button type="button" class="grc-tab" data-tab="remote">远程同步</button>
            <button type="button" class="grc-tab active" data-tab="changes">当前改动</button>
            <button type="button" class="grc-tab" data-tab="checkpoints">安全存档</button>
          </div>
          <button type="button" class="grc-icon-button grc-refresh" title="刷新" aria-label="刷新"><i class="ph ph-arrow-clockwise"></i></button>
        </div>
        <div class="grc-notice"></div>
        <div class="grc-init-notice" hidden>
          <span><i class="ph ph-git-branch"></i>当前项目还没有 Git 仓库</span>
          <button type="button" class="grc-button primary grc-init-git">一键初始化 Git</button>
        </div>
        <div class="grc-body">
          <div class="grc-view grc-changes-view" data-view="changes">
            <div class="grc-change-layout">
              <aside class="grc-files-pane">
                <div class="grc-files-head">
                  <label><input class="grc-check grc-select-all" type="checkbox"> 全选</label>
                  <span class="grc-selection-count">已选 0</span>
                </div>
                <div class="grc-file-list"></div>
              </aside>
              <main class="grc-diff-pane">
                <div class="grc-diff-head">
                  <span class="grc-diff-file">选择左侧文件查看 Diff</span>
                  <span class="grc-diff-legend"><span class="add">+ 新增</span><span class="del">− 删除</span></span>
                </div>
                <div class="grc-diff-scroll"><div class="grc-diff-lines"></div></div>
              </main>
            </div>
          </div>
          <div class="grc-view grc-checkpoints-view" data-view="checkpoints" hidden>
            <div class="grc-checkpoints">
              <div class="grc-checkpoint-intro"><i class="ph ph-shield-check"></i><span>安全存档保存在当前 Git 项目内部，但不会写入正常分支历史，也不会随着普通推送上传到 GitHub。恢复前会自动再创建一份保护存档。</span></div>
              <div class="grc-checkpoint-list"></div>
            </div>
          </div>
          <div class="grc-view grc-remote-view" data-view="remote" hidden>
            <div class="grc-remote-grid">
              <section class="grc-remote-card">
                <h3>远程仓库</h3>
                <div class="grc-remote-value grc-remote-origin">未配置远程仓库</div>
                <div class="grc-remote-muted grc-remote-sync-copy">请先获取远程状态</div>
                <div class="grc-remote-actions">
                  <button type="button" class="grc-button grc-fetch"><i class="ph ph-arrow-clockwise"></i>获取更新</button>
                  <button type="button" class="grc-button grc-pull"><i class="ph ph-download-simple"></i>拉取</button>
                  <button type="button" class="grc-button primary grc-push"><i class="ph ph-upload-simple"></i>推送</button>
                </div>
              </section>
              <section class="grc-remote-card">
                <h3>当前分支</h3>
                <div class="grc-remote-value grc-remote-current-branch">--</div>
                <div class="grc-remote-branch"><select class="grc-branch-select" aria-label="选择 Git 分支"></select><button type="button" class="grc-button grc-switch-branch">切换</button></div>
                <div class="grc-remote-muted">切换分支前会检查未提交修改，避免覆盖当前工作。</div>
              </section>
            </div>
            <div class="grc-remote-warning">推送和拉取都会改变远程或本地文件，操作前会显示确认提示。拉取使用快进合并，检测到冲突时不会自动解决。</div>
          </div>
        </div>
        <footer class="grc-footer">
          <span class="grc-footer-note">高风险操作会先自动创建保护存档</span>
          <button type="button" class="grc-button grc-stage"><i class="ph ph-plus-circle"></i>暂存所选</button>
          <button type="button" class="grc-button grc-unstage"><i class="ph ph-minus-circle"></i>取消暂存</button>
          <button type="button" class="grc-button danger grc-discard"><i class="ph ph-arrow-counter-clockwise"></i>撤销所选</button>
          <button type="button" class="grc-button grc-checkpoint"><i class="ph ph-shield-check"></i>创建存档点</button>
          <button type="button" class="grc-button primary grc-commit"><i class="ph ph-git-commit"></i>提交已暂存</button>
        </footer>
        <div class="grc-busy-layer"><div class="grc-busy-copy"><i class="ph ph-spinner-gap"></i><span>正在处理…</span></div></div>
      </section>
    `;
    document.body.appendChild(overlay);

    const shell = overlay.querySelector(".grc-shell");
    const countNode = trigger.querySelector("strong");
    const projectNode = overlay.querySelector(".grc-project");
    const branchNode = overlay.querySelector(".grc-branch span");
    const changedNode = overlay.querySelector(".grc-changed");
    const stagedNode = overlay.querySelector(".grc-staged");
    const untrackedNode = overlay.querySelector(".grc-untracked");
    const conflictsNode = overlay.querySelector(".grc-conflicts");
    const syncNode = overlay.querySelector(".grc-sync");
    const noticeNode = overlay.querySelector(".grc-notice");
    const initNoticeNode = overlay.querySelector(".grc-init-notice");
    const initGitButton = overlay.querySelector(".grc-init-git");
    const fileListNode = overlay.querySelector(".grc-file-list");
    const selectionCountNode = overlay.querySelector(".grc-selection-count");
    const selectAllNode = overlay.querySelector(".grc-select-all");
    const diffFileNode = overlay.querySelector(".grc-diff-file");
    const diffLinesNode = overlay.querySelector(".grc-diff-lines");
    const checkpointListNode = overlay.querySelector(".grc-checkpoint-list");
    const refreshButton = overlay.querySelector(".grc-refresh");
    const stageButton = overlay.querySelector(".grc-stage");
    const unstageButton = overlay.querySelector(".grc-unstage");
    const discardButton = overlay.querySelector(".grc-discard");
    const checkpointButton = overlay.querySelector(".grc-checkpoint");
    const commitButton = overlay.querySelector(".grc-commit");
    const remoteOriginNode = overlay.querySelector(".grc-remote-origin");
    const remoteSyncCopyNode = overlay.querySelector(".grc-remote-sync-copy");
    const remoteBranchNode = overlay.querySelector(".grc-remote-current-branch");
    const branchSelect = overlay.querySelector(".grc-branch-select");
    const fetchButton = overlay.querySelector(".grc-fetch");
    const pullButton = overlay.querySelector(".grc-pull");
    const pushButton = overlay.querySelector(".grc-push");
    const switchBranchButton = overlay.querySelector(".grc-switch-branch");

    let projectPath = null;
    let snapshot = null;
    let activeTab = "changes";
    let currentFile = null;
    let selectedFiles = new Set();
    let noticeTimer = null;
    let busy = false;
    let refreshVersion = 0;
    let remoteSnapshot = null;

    async function initializeGitAction() {
      if (busy || !projectPath) return;
      const confirmed = await createDialog({
        title: "初始化 Git 仓库",
        message: "将为当前项目创建 .git 文件夹。不会删除或上传任何文件。是否继续？",
        confirmText: "初始化 Git"
      });
      if (!confirmed) return;
      const result = await runAction("正在初始化 Git…", () =>
        api.initializeGitRepository()
      );
      if (result?.ok) {
        notify("Git 仓库已初始化，现在可以开始审查代码。", "success", 8000);
        await refresh();
      }
    }

    function setBusy(value, label = "正在处理…") {
      busy = Boolean(value);
      shell.classList.toggle("busy", busy);
      shell.querySelector(".grc-busy-copy span").textContent = label;
      updateActions();
    }

    function notify(message, tone = "neutral", timeout = 5000) {
      clearTimeout(noticeTimer);
      noticeNode.textContent = message || "";
      noticeNode.dataset.tone = tone;
      noticeNode.classList.toggle("visible", Boolean(message));
      if (message && timeout) {
        noticeTimer = setTimeout(() => {
          noticeNode.classList.remove("visible");
        }, timeout);
      }
    }

    function files() {
      return Array.isArray(snapshot?.files)
        ? snapshot.files
        : [];
    }

    function selectedItems() {
      return files().filter(item => selectedFiles.has(item.path));
    }

    function updateActions() {
      const items = selectedItems();
      const repositoryReady = Boolean(snapshot?.ok && snapshot?.isRepository);
      const selected = items.length > 0;
      stageButton.disabled = busy || !repositoryReady || !selected;
      unstageButton.disabled =
        busy ||
        !repositoryReady ||
        !items.some(item => item.hasStaged);
      discardButton.disabled =
        busy ||
        !repositoryReady ||
        !selected ||
        items.some(item => item.kind === "conflict" || item.isRenamed);
      checkpointButton.disabled = busy || !repositoryReady;
      commitButton.disabled =
        busy ||
        !repositoryReady ||
        !(snapshot?.summary?.staged > 0);
      refreshButton.disabled = busy;
      const remoteReady = Boolean(remoteSnapshot?.ok && remoteSnapshot?.isRepository);
      fetchButton.disabled = busy || !remoteReady;
      pullButton.disabled = busy || !remoteReady || !remoteSnapshot?.upstream;
      pushButton.disabled = busy || !remoteReady || !remoteSnapshot?.upstream || !(remoteSnapshot?.ahead > 0);
      switchBranchButton.disabled = busy || !remoteReady || !branchSelect.value || branchSelect.value === remoteSnapshot?.currentBranch;
      selectionCountNode.textContent = `已选 ${items.length}`;
      selectAllNode.checked = Boolean(files().length && items.length === files().length);
      selectAllNode.indeterminate = Boolean(items.length && items.length < files().length);
    }

    function renderRemote() {
      const value = remoteSnapshot || {};
      const remote = (value.remotes || []).find(item => item.direction === "fetch") || (value.remotes || [])[0];
      remoteOriginNode.textContent = remote?.url || value.remoteError || "未配置远程仓库";
      remoteBranchNode.textContent = value.currentBranch || value.branch || "未命名分支";
      remoteSyncCopyNode.textContent = value.upstream
        ? `跟踪 ${value.upstream} · 领先 ${value.ahead || 0} · 落后 ${value.behind || 0}`
        : "当前分支尚未配置远程跟踪分支";
      branchSelect.innerHTML = "";
      (value.branches || []).forEach(branch => {
        const option = document.createElement("option");
        option.value = branch.name;
        option.textContent = branch.name;
        option.selected = Boolean(branch.current);
        branchSelect.appendChild(option);
      });
      updateActions();
    }

    async function refreshRemote() {
      if (!projectPath) { remoteSnapshot = null; renderRemote(); return; }
      try {
        remoteSnapshot = await api.getGitRemoteStatus();
        renderRemote();
      } catch (error) {
        remoteSnapshot = { ok: false, isRepository: false, remoteError: cleanError(error) };
        renderRemote();
      }
    }

    async function remoteAction(label, action, confirmation) {
      if (busy) return;
      if (confirmation && !(await createDialog(confirmation))) return;
      const result = await runAction(label, action);
      if (result) {
        remoteSnapshot = result.status || remoteSnapshot;
        renderRemote();
        notify(result.action === "push" ? "已推送到远程仓库" : result.action === "pull" ? "已拉取远程更新" : "已获取远程状态", "success", 8000);
      }
    }

    function emptyMarkup(icon, message) {
      const empty = document.createElement("div");
      empty.className = "grc-empty";
      const content = document.createElement("div");
      const iconNode = document.createElement("i");
      iconNode.className = `ph ${icon}`;
      const text = document.createElement("div");
      text.textContent = message;
      content.append(iconNode, text);
      empty.appendChild(content);
      return empty;
    }

    function renderRepoSummary() {
      const summary = snapshot?.summary || {};
      projectNode.textContent =
        snapshot?.repositoryRoot || projectPath || "请先选择项目文件夹";
      projectNode.title = projectNode.textContent;
      branchNode.textContent = snapshot?.branch || "--";
      changedNode.textContent = `改动 ${summary.changed ?? "--"}`;
      stagedNode.textContent = `已暂存 ${summary.staged ?? "--"}`;
      untrackedNode.textContent = `新文件 ${summary.untracked ?? "--"}`;
      conflictsNode.textContent = `冲突 ${summary.conflicts ?? "--"}`;
      conflictsNode.dataset.tone = summary.conflicts ? "danger" : "neutral";
      stagedNode.dataset.tone = summary.staged ? "success" : "neutral";
      untrackedNode.dataset.tone = summary.untracked ? "warning" : "neutral";
      syncNode.textContent = !snapshot?.ok
        ? projectPath
          ? "尚未连接 Git 仓库"
          : "尚未选择项目"
        : snapshot.upstream
          ? `远程：领先 ${snapshot.ahead || 0} · 落后 ${snapshot.behind || 0}`
          : "未配置远程分支";
      countNode.textContent = !projectPath
        ? "—"
        : !snapshot
          ? "…"
          : snapshot.ok
            ? summary.changed ?? 0
            : "!";
      trigger.dataset.tone =
        projectPath && snapshot && !snapshot.ok
          ? "warning"
          : "neutral";
      const needsInit = Boolean(
        projectPath && snapshot && !snapshot.ok && /不是 Git 仓库/i.test(snapshot.message || "")
      );
      initNoticeNode.hidden = !needsInit;
    }

    function renderFiles() {
      fileListNode.innerHTML = "";
      const list = files();
      const validPaths = new Set(list.map(item => item.path));
      selectedFiles = new Set(
        [...selectedFiles].filter(filePath => validPaths.has(filePath))
      );

      if (!projectPath) {
        fileListNode.appendChild(
          emptyMarkup("ph-folder-open", "请先选择项目文件夹")
        );
        currentFile = null;
        renderDiffPlaceholder(
          "选择 Git 项目后可查看文件改动",
          "ph-folder-open"
        );
        updateActions();
        return;
      }

      if (!snapshot?.ok) {
        fileListNode.appendChild(
          emptyMarkup(
            "ph-git-branch",
            snapshot?.message || "当前项目无法读取 Git 状态"
          )
        );
        currentFile = null;
        renderDiffPlaceholder(
          snapshot?.message || "当前项目无法读取 Git 状态",
          "ph-git-branch"
        );
        updateActions();
        return;
      }

      if (!list.length) {
        fileListNode.appendChild(
          emptyMarkup("ph-check-circle", "工作区干净，没有待审查的修改")
        );
        currentFile = null;
        renderDiffPlaceholder("工作区干净，没有待审查的修改");
        updateActions();
        return;
      }

      for (const item of list) {
        const row = document.createElement("div");
        row.className = "grc-file-row";
        row.tabIndex = 0;
        row.dataset.kind = item.kind || "modified";
        row.dataset.staged = String(Boolean(item.hasStaged));
        row.classList.toggle("active", currentFile === item.path);
        row.title = item.path;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "grc-check";
        checkbox.checked = selectedFiles.has(item.path);
        checkbox.setAttribute("aria-label", `选择 ${item.path}`);

        const copy = document.createElement("span");
        copy.className = "grc-file-copy";
        const name = document.createElement("span");
        name.className = "grc-file-name";
        const parts = item.path.split(/[\\/]/);
        name.textContent = parts.pop() || item.path;
        const directory = document.createElement("span");
        directory.className = "grc-file-dir";
        directory.textContent = parts.join("/") || "项目根目录";
        copy.append(name, directory);

        const badge = document.createElement("span");
        badge.className = "grc-file-badge";
        badge.textContent = statusLabel(item);
        badge.title = item.code || "";
        row.append(checkbox, copy, badge);

        checkbox.addEventListener("click", event => {
          event.stopPropagation();
          if (checkbox.checked) selectedFiles.add(item.path);
          else selectedFiles.delete(item.path);
          updateActions();
        });
        row.addEventListener("click", () => selectFile(item.path));
        row.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectFile(item.path);
          }
        });
        fileListNode.appendChild(row);
      }

      if (!currentFile || !validPaths.has(currentFile)) {
        currentFile = list[0].path;
        loadDiff(currentFile);
      }
      updateActions();
    }

    function renderDiffPlaceholder(message, icon = "ph-file-diff") {
      diffLinesNode.innerHTML = "";
      diffLinesNode.style.minWidth = "0";
      diffLinesNode.appendChild(emptyMarkup(icon, message));
    }

    function parseHunk(line) {
      const match = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
      return match
        ? { oldLine: Number(match[1]), newLine: Number(match[2]) }
        : null;
    }

    function renderDiffText(text) {
      diffLinesNode.innerHTML = "";
      diffLinesNode.style.minWidth = "max-content";
      const fragment = document.createDocumentFragment();
      let oldLine = null;
      let newLine = null;

      for (const line of String(text || "").split("\n")) {
        const row = document.createElement("div");
        row.className = "grc-diff-line";
        const oldNumber = document.createElement("span");
        oldNumber.className = "grc-line-number";
        const newNumber = document.createElement("span");
        newNumber.className = "grc-line-number";
        const code = document.createElement("span");
        code.className = "grc-line-code";
        code.textContent = line || " ";

        if (line.startsWith("### ")) {
          row.classList.add("section");
          oldLine = null;
          newLine = null;
        } else if (line.startsWith("@@")) {
          row.classList.add("hunk");
          const hunk = parseHunk(line);
          if (hunk) {
            oldLine = hunk.oldLine;
            newLine = hunk.newLine;
          }
        } else if (
          line.startsWith("diff ") ||
          line.startsWith("index ") ||
          line.startsWith("--- ") ||
          line.startsWith("+++ ") ||
          line.startsWith("new file mode") ||
          line.startsWith("deleted file mode") ||
          line.startsWith("Binary file") ||
          line.startsWith("未跟踪") ||
          line.startsWith("大小：")
        ) {
          row.classList.add("meta");
        } else if (line.startsWith("+") && !line.startsWith("+++")) {
          row.classList.add("add");
          if (newLine !== null) {
            newNumber.textContent = newLine;
            newLine += 1;
          }
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          row.classList.add("del");
          if (oldLine !== null) {
            oldNumber.textContent = oldLine;
            oldLine += 1;
          }
        } else if (oldLine !== null && newLine !== null) {
          oldNumber.textContent = oldLine;
          newNumber.textContent = newLine;
          oldLine += 1;
          newLine += 1;
        }

        row.append(oldNumber, newNumber, code);
        fragment.appendChild(row);
      }
      diffLinesNode.appendChild(fragment);
    }

    async function loadDiff(filePath) {
      if (!filePath || !snapshot?.ok) return;
      currentFile = filePath;
      diffFileNode.textContent = filePath;
      renderDiffPlaceholder("正在读取文件改动…", "ph-spinner-gap");
      renderFilesActiveState();

      try {
        const result = await api.getGitFileDiff(filePath);
        if (currentFile !== filePath) return;
        renderDiffText(result.diff);
        if (result.truncated) {
          notify("这个文件的 Diff 较大，界面已截断显示。", "neutral");
        }
      } catch (error) {
        if (currentFile !== filePath) return;
        renderDiffPlaceholder(cleanError(error), "ph-warning-circle");
      }
    }

    function renderFilesActiveState() {
      for (const row of fileListNode.querySelectorAll(".grc-file-row")) {
        row.classList.toggle("active", row.title === currentFile);
      }
    }

    function selectFile(filePath) {
      if (currentFile === filePath) return;
      currentFile = filePath;
      renderFilesActiveState();
      loadDiff(filePath);
    }

    function applyStatus(value) {
      snapshot = value || null;
      renderRepoSummary();
      renderFiles();
    }

    async function refresh(options = {}) {
      if (!projectPath) {
        applyStatus(null);
        return;
      }
      const requestedProject = projectPath;
      const requestVersion = ++refreshVersion;
      refreshButton.classList.add("spinning");
      try {
        const status = await api.getGitStatus();
        if (
          requestVersion !== refreshVersion ||
          requestedProject !== projectPath
        ) {
          return;
        }
        applyStatus(status);
        if (options.reloadCheckpoints || activeTab === "checkpoints") {
          await loadCheckpoints();
        }
      } catch (error) {
        if (
          requestVersion !== refreshVersion ||
          requestedProject !== projectPath
        ) {
          return;
        }
        applyStatus({
          ok: false,
          projectPath,
          message: cleanError(error)
        });
      } finally {
        if (requestVersion === refreshVersion) {
          refreshButton.classList.remove("spinning");
        }
      }
    }

    async function runAction(label, action) {
      if (busy) return null;
      setBusy(true, label);
      try {
        const result = await action();
        if (result?.status) applyStatus(result.status);
        if (currentFile && files().some(item => item.path === currentFile)) {
          loadDiff(currentFile);
        }
        return result;
      } catch (error) {
        notify(cleanError(error), "danger", 8000);
        return null;
      } finally {
        setBusy(false);
      }
    }

    async function loadCheckpoints() {
      checkpointListNode.innerHTML = "";
      if (!snapshot?.ok) {
        checkpointListNode.appendChild(
          emptyMarkup("ph-shield-warning", "当前项目还不能使用安全存档")
        );
        return;
      }
      checkpointListNode.appendChild(
        emptyMarkup("ph-spinner-gap", "正在读取存档点…")
      );
      try {
        const result = await api.listGitCheckpoints();
        checkpointListNode.innerHTML = "";
        const checkpoints = Array.isArray(result?.checkpoints)
          ? result.checkpoints
          : [];
        if (!checkpoints.length) {
          checkpointListNode.appendChild(
            emptyMarkup(
              "ph-shield-check",
              "还没有安全存档。点击下方“创建存档点”保存当前状态。"
            )
          );
          return;
        }

        for (const checkpoint of checkpoints) {
          const row = document.createElement("div");
          row.className = "grc-checkpoint-row";
          const copy = document.createElement("div");
          const label = document.createElement("div");
          label.className = "grc-checkpoint-label";
          label.textContent = checkpoint.label || "未命名存档";
          const meta = document.createElement("div");
          meta.className = "grc-checkpoint-meta";
          meta.innerHTML = `<span>${formatTime(checkpoint.createdAt)}</span><span>${checkpoint.shortCommit || "--"}</span><span>${checkpoint.fileCount ?? "--"} 个文件</span>`;
          copy.append(label, meta);
          const restore = document.createElement("button");
          restore.type = "button";
          restore.className = "grc-button";
          restore.innerHTML = '<i class="ph ph-clock-counter-clockwise"></i>恢复';
          restore.addEventListener("click", async () => {
            const confirmed = await createDialog({
              title: "恢复这个安全存档？",
              message:
                `将恢复“${checkpoint.label || "未命名存档"}”中的项目文件。\n\n` +
                "当前状态会先自动保存为新的保护存档；较新的未跟踪文件不会被删除。",
              confirmText: "安全恢复",
              danger: true
            });
            if (!confirmed) return;
            const result = await runAction("正在恢复安全存档…", () =>
              api.restoreGitCheckpoint(checkpoint.id)
            );
            if (result) {
              notify(result.note || "存档恢复完成。", "success", 8000);
              await loadCheckpoints();
            }
          });
          row.append(copy, restore);
          checkpointListNode.appendChild(row);
        }
      } catch (error) {
        checkpointListNode.innerHTML = "";
        checkpointListNode.appendChild(
          emptyMarkup("ph-warning-circle", cleanError(error))
        );
      }
    }

    function switchTab(tab) {
      activeTab = tab === "checkpoints" ? "checkpoints" : "changes";
      for (const button of overlay.querySelectorAll(".grc-tab")) {
        button.classList.toggle("active", button.dataset.tab === activeTab);
      }
      for (const view of overlay.querySelectorAll(".grc-view")) {
        view.hidden = view.dataset.view !== activeTab;
      }
      stageButton.hidden = activeTab !== "changes";
      unstageButton.hidden = activeTab !== "changes";
      discardButton.hidden = activeTab !== "changes";
      commitButton.hidden = activeTab !== "changes";
      if (activeTab === "checkpoints") loadCheckpoints();
      if (activeTab === "remote") refreshRemote();
      updateActions();
    }

    async function createCheckpointAction() {
      const value = await createDialog({
        title: "创建安全存档点",
        message:
          "保存当前项目文件状态，不改变正常提交历史，也不会自动上传到 GitHub。",
        input: true,
        value: `手动存档 ${formatTime(new Date().toISOString())}`,
        placeholder: "例如：发送按钮修复前",
        confirmText: "创建存档"
      });
      if (!value) return;
      const result = await runAction("正在创建安全存档…", () =>
        api.createGitCheckpoint(value)
      );
      if (result?.checkpoint) {
        notify(
          `安全存档已创建：${result.checkpoint.label}`,
          "success"
        );
        if (activeTab === "checkpoints") await loadCheckpoints();
      }
    }

    trigger.addEventListener("click", () => {
      overlay.hidden = false;
      switchTab("changes");
      refresh();
      requestAnimationFrame(() => overlay.querySelector(".grc-close").focus());
    });
    initGitButton.addEventListener("click", initializeGitAction);
    overlay.querySelector(".grc-close").addEventListener("click", () => {
      if (!busy) overlay.hidden = true;
    });
    overlay.addEventListener("click", event => {
      if (event.target === overlay && !busy) overlay.hidden = true;
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !overlay.hidden && !busy) {
        overlay.hidden = true;
      }
    });

    for (const tab of overlay.querySelectorAll(".grc-tab")) {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    }
    refreshButton.addEventListener("click", () => refresh({ reloadCheckpoints: true }));
    fetchButton.addEventListener("click", () => remoteAction("正在获取远程更新…", () => api.fetchGitRemote()));
    pullButton.addEventListener("click", () => remoteAction("正在拉取远程更新…", () => api.pullGitRemote(), {
      title: "拉取远程更新",
      message: "将使用快进方式拉取当前分支的远程更新。工作区若有未提交修改，操作可能被 Git 拒绝。是否继续？",
      confirmText: "确认拉取"
    }));
    pushButton.addEventListener("click", () => remoteAction("正在推送到远程仓库…", () => api.pushGitRemote(), {
      title: "推送到远程仓库",
      message: "将把当前分支已提交的内容推送到远程仓库。此操作会让远程仓库产生新的提交，是否继续？",
      confirmText: "确认推送"
    }));
    switchBranchButton.addEventListener("click", () => remoteAction("正在切换 Git 分支…", () => api.switchGitBranch(branchSelect.value), {
      title: "切换 Git 分支",
      message: `将切换到分支“${branchSelect.value}”。当前项目必须没有未提交修改，是否继续？`,
      confirmText: "确认切换"
    }));
    selectAllNode.addEventListener("change", () => {
      selectedFiles = selectAllNode.checked
        ? new Set(files().map(item => item.path))
        : new Set();
      renderFiles();
    });
    stageButton.addEventListener("click", async () => {
      const paths = selectedItems().map(item => item.path);
      const result = await runAction("正在暂存所选文件…", () =>
        api.stageGitFiles(paths)
      );
      if (result) notify(`已暂存 ${paths.length} 个文件。`, "success");
    });
    unstageButton.addEventListener("click", async () => {
      const paths = selectedItems()
        .filter(item => item.hasStaged)
        .map(item => item.path);
      const result = await runAction("正在取消暂存…", () =>
        api.unstageGitFiles(paths)
      );
      if (result) notify(`已取消暂存 ${paths.length} 个文件。`, "success");
    });
    discardButton.addEventListener("click", async () => {
      const items = selectedItems();
      const confirmed = await createDialog({
        title: `撤销所选 ${items.length} 个文件？`,
        message:
          "已修改文件将恢复到最近一次 Git 提交；新文件会移入 Windows 回收站。\n\n撤销前会自动创建安全存档，之后仍可恢复。",
        confirmText: "创建保护存档并撤销",
        danger: true
      });
      if (!confirmed) return;
      const result = await runAction("正在安全撤销所选改动…", () =>
        api.discardGitFiles(items.map(item => item.path))
      );
      if (result) {
        selectedFiles.clear();
        notify(result.message || "所选改动已安全撤销。", "success", 8000);
      }
    });
    checkpointButton.addEventListener("click", createCheckpointAction);
    commitButton.addEventListener("click", async () => {
      const message = await createDialog({
        title: "提交已暂存改动",
        message:
          `将提交当前已暂存的 ${snapshot?.summary?.staged || 0} 个文件。未暂存文件不会包含在本次提交中。`,
        input: true,
        placeholder: "简要说明这次修改，例如：修复发送按钮",
        confirmText: "确认提交"
      });
      if (!message) return;
      const result = await runAction("正在创建 Git 提交…", () =>
        api.commitStagedGitChanges(message)
      );
      if (result) {
        selectedFiles.clear();
        notify(`提交成功：${result.shortCommit} · ${result.message}`, "success", 8000);
      }
    });

    applyStatus(null);
    switchTab("changes");

    return {
      close() {
        if (!busy) overlay.hidden = true;
      },
      open() {
        trigger.click();
      },
      refresh,
      setProjectPath(value) {
        const next = value || null;
        if (next === projectPath) return;
        refreshVersion += 1;
        refreshButton.classList.remove("spinning");
        projectPath = next;
        snapshot = null;
        remoteSnapshot = null;
        currentFile = null;
        selectedFiles.clear();
        applyStatus(null);
        renderRemote();
        if (projectPath) refresh();
      }
    };
  }

  window.DeepSeekGitReview = { create };
})();
