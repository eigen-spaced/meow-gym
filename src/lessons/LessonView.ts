import { EditorView } from "../editor/EditorView";
import type { EditorState } from "../editor/types";
import { checkGoal, type Lesson } from "./lessons";
import { renderMarkup } from "../app/markup";
import { escapeHtml } from "../app/html";

export interface LessonViewCallbacks {
  onComplete: (lessonId: string) => void;
  onNext: () => void;
  hasNext: boolean;
}

/** Renders one lesson: prose, a live editor, and goal tracking. */
export class LessonView {
  readonly el: HTMLDivElement;
  private editor: EditorView;
  private statusEl!: HTMLDivElement;
  private nextBtn!: HTMLButtonElement;
  private completed = false;

  constructor(
    private lesson: Lesson,
    private cb: LessonViewCallbacks,
  ) {
    this.el = document.createElement("div");
    this.el.className = "lesson";

    this.editor = new EditorView({
      lines: lesson.buffer,
      bufferName: "*gym*",
      onChange: (s) => this.onChange(s),
    });

    this.build();
    requestAnimationFrame(() => this.editor.focus());
  }

  private build(): void {
    const l = this.lesson;

    const header = document.createElement("div");
    header.className = "lesson-head";
    header.innerHTML = `<h2>${escapeHtml(l.title)}</h2>`;

    const intro = document.createElement("div");
    intro.className = "prose";
    intro.innerHTML = renderMarkup(l.intro);

    this.el.append(header, intro);

    if (l.vimNote) {
      const note = document.createElement("div");
      note.className = "vim-note";
      note.innerHTML = `<span class="vim-badge">for vimmers</span> <span>${renderMarkup(
        l.vimNote,
        true,
      )}</span>`;
      this.el.append(note);
    }

    const keys = document.createElement("div");
    keys.className = "keyref";
    keys.innerHTML = l.keys
      .map(
        (k) =>
          `<span class="keyref-item"><kbd>${escapeHtml(
            k.key,
          )}</kbd> ${escapeHtml(k.desc)}</span>`,
      )
      .join("");
    this.el.append(keys);

    const goal = document.createElement("div");
    goal.className = "goal";
    goal.innerHTML = `<strong>Goal:</strong> ${escapeHtml(l.goalText)}`;
    this.el.append(goal);

    const editorWrap = document.createElement("div");
    editorWrap.className = "editor-wrap";
    editorWrap.append(this.editor.el);
    this.el.append(editorWrap);

    this.statusEl = document.createElement("div");
    this.statusEl.className = "status";
    this.el.append(this.statusEl);

    const controls = document.createElement("div");
    controls.className = "controls";

    const resetBtn = document.createElement("button");
    resetBtn.className = "btn";
    resetBtn.textContent = "Reset buffer";
    resetBtn.addEventListener("click", () => {
      this.completed = false;
      this.editor.reset(l.buffer);
      this.statusEl.textContent = "";
      this.statusEl.className = "status";
      this.updateNextState();
      this.editor.focus();
    });

    this.nextBtn = document.createElement("button");
    this.nextBtn.className = "btn btn-primary";
    this.nextBtn.textContent = this.cb.hasNext ? "Next lesson →" : "Done";
    this.nextBtn.addEventListener("click", () => {
      if (this.cb.hasNext) this.cb.onNext();
    });

    controls.append(resetBtn, this.nextBtn);
    this.el.append(controls);
    this.updateNextState();
  }

  private updateNextState(): void {
    this.nextBtn.disabled = !this.cb.hasNext && !this.completed;
    this.nextBtn.classList.toggle("ready", this.completed);
  }

  private onChange(state: EditorState): void {
    if (this.completed) return;
    if (checkGoal(this.lesson.goal, state)) {
      this.completed = true;
      this.statusEl.className = "status status-ok";
      this.statusEl.textContent = this.cb.hasNext
        ? "✓ Goal reached. Next lesson when you're ready."
        : "✓ Last lesson cleared — you've got the meow basics.";
      this.editor.setEcho(
        '<span class="echo-ok">Goal reached.</span>',
        "info",
      );
      this.cb.onComplete(this.lesson.id);
      this.updateNextState();
    }
  }

  destroy(): void {
    /* nothing to clean up */
  }
}