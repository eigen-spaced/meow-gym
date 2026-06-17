import "./style.css";
import { LESSONS } from "./lessons/lessons";
import { LessonView } from "./lessons/LessonView";
import { GROUPS } from "./puzzles/puzzles";
import { GroupView } from "./puzzles/GroupView";
import { GauntletView } from "./puzzles/GauntletView";
import { keymapView } from "./app/KeymapView";
import { getRelativeNumbers, setRelativeNumbers } from "./app/settings";
import { loadJson, saveJson } from "./app/storage";

type Route = "tutor" | "puzzles" | "keymap";

const PROGRESS_KEY = "meow-gym.completed";
const PUZZLE_PROGRESS_KEY = "meow-gym.puzzles.completed";
const NAV_KEY = "meow-gym.nav";

const loadSet = (key: string) => new Set(loadJson<string[]>(key, []));
const saveSet = (key: string, s: Set<string>) => saveJson(key, [...s]);

const loadProgress = () => loadSet(PROGRESS_KEY);
const saveProgress = (done: Set<string>) => saveSet(PROGRESS_KEY, done);

interface Nav {
  route: Route;
  lessonIndex: number;
  groupIndex: number;
}
const DEFAULT_NAV: Nav = { route: "tutor", lessonIndex: 0, groupIndex: 0 };
const loadNav = (): Nav => ({ ...DEFAULT_NAV, ...loadJson(NAV_KEY, {}) });
const saveNav = (n: Nav) => saveJson(NAV_KEY, n);

class App {
  private root: HTMLElement;
  private nav = loadNav();
  private route: Route = this.nav.route;
  private lessonIndex = Math.min(this.nav.lessonIndex, LESSONS.length - 1);
  private groupIndex = Math.min(this.nav.groupIndex, GROUPS.length - 1);
  private completed = loadProgress();
  private puzzlesDone = loadSet(PUZZLE_PROGRESS_KEY);
  private activeLessonView?: LessonView;
  private activeGroupView?: GroupView | GauntletView;

  constructor(root: HTMLElement) {
    this.root = root;
    this.render();
  }

  private persistNav(): void {
    saveNav({
      route: this.route,
      lessonIndex: this.lessonIndex,
      groupIndex: this.groupIndex,
    });
  }

  private setRoute(route: Route): void {
    this.route = route;
    this.render();
  }

  private render(): void {
    this.persistNav();
    this.activeLessonView?.destroy();
    this.activeGroupView?.destroy();
    this.activeLessonView = undefined;
    this.activeGroupView = undefined;
    this.root.replaceChildren(this.header(), this.body());
  }

  private header(): HTMLElement {
    const header = document.createElement("header");
    header.className = "topbar";

    const brand = document.createElement("div");
    brand.className = "brand";
    brand.innerHTML = `<span class="brand-cat">🐱</span> meow gym <span class="brand-sub">for vimmers</span>`;

    const nav = document.createElement("nav");
    const tabs: [Route, string][] = [
      ["tutor", "Tutor"],
      ["puzzles", "Puzzles"],
      ["keymap", "Keymap"],
    ];
    for (const [route, label] of tabs) {
      const a = document.createElement("button");
      a.className = "tab" + (this.route === route ? " active" : "");
      a.textContent = label;
      a.addEventListener("click", () => this.setRoute(route));
      nav.append(a);
    }

    // Relative line-number toggle (vim-style hybrid numbers).
    const rel = document.createElement("button");
    const relOn = getRelativeNumbers();
    rel.className = "tab rel-toggle" + (relOn ? " active" : "");
    rel.textContent = relOn ? "rel# ✓" : "rel#";
    rel.title = "Toggle relative line numbers";
    rel.addEventListener("click", () => {
      setRelativeNumbers(!getRelativeNumbers());
      this.render();
    });
    nav.append(rel);

    header.append(brand, nav);
    return header;
  }

  private body(): HTMLElement {
    switch (this.route) {
      case "tutor":
        return this.tutorBody();
      case "puzzles":
        return this.puzzlesBody();
      case "keymap":
        return this.keymapBody();
    }
  }

  // --- Tutor ---------------------------------------------------------------

  private tutorBody(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "tutor-layout";
    wrap.append(this.lessonSidebar(), this.lessonMain());
    return wrap;
  }

  private lessonSidebar(): HTMLElement {
    const aside = document.createElement("aside");
    aside.className = "sidebar";

    const count = this.completed.size;
    const head = document.createElement("div");
    head.className = "sidebar-head";
    head.innerHTML = `Lessons <span class="progress-pill">${count}/${LESSONS.length}</span>`;
    aside.append(head);

    const list = document.createElement("ul");
    list.className = "lesson-list";
    LESSONS.forEach((lesson, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className =
        "lesson-link" + (i === this.lessonIndex ? " active" : "");
      const done = this.completed.has(lesson.id);
      btn.innerHTML =
        `<span class="check">${done ? "✓" : "○"}</span> ` +
        `<span>${lesson.title}</span>`;
      btn.addEventListener("click", () => {
        this.lessonIndex = i;
        this.render();
      });
      li.append(btn);
      list.append(li);
    });
    aside.append(list);
    return aside;
  }

  private lessonMain(): HTMLElement {
    const main = document.createElement("main");
    main.className = "content";

    const lesson = LESSONS[this.lessonIndex];
    const hasNext = this.lessonIndex < LESSONS.length - 1;

    const view = new LessonView(lesson, {
      hasNext,
      onComplete: (id) => {
        this.completed.add(id);
        saveProgress(this.completed);
        // Refresh just the sidebar to show the new checkmark.
        const old = this.root.querySelector(".sidebar");
        old?.replaceWith(this.lessonSidebar());
      },
      onNext: () => {
        if (hasNext) {
          this.lessonIndex += 1;
          this.render();
        }
      },
    });
    this.activeLessonView = view;
    main.append(view.el);
    return main;
  }

  // --- Puzzles -------------------------------------------------------------

  private puzzlesBody(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "tutor-layout";
    wrap.append(this.puzzleSidebar(), this.puzzleMain());
    return wrap;
  }

  private puzzleSidebar(): HTMLElement {
    const aside = document.createElement("aside");
    aside.className = "sidebar";
    const head = document.createElement("div");
    head.className = "sidebar-head";
    head.textContent = "Groups";
    aside.append(head);

    const list = document.createElement("ul");
    list.className = "lesson-list";
    GROUPS.forEach((group, i) => {
      const generated = !!group.generate;
      const done = group.puzzles.filter((p) =>
        this.puzzlesDone.has(p.id),
      ).length;
      const total = group.puzzles.length;
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.className =
        "lesson-link" + (i === this.groupIndex ? " active" : "");
      const mark = group.gauntlet
        ? (group.icon ?? "🥋")
        : generated
          ? "↻"
          : done === total
            ? "✓"
            : "○";
      const count = group.gauntlet || generated ? "" : `${done}/${total}`;
      btn.innerHTML =
        `<span class="check">${mark}</span> ` +
        `<span>${group.title}</span>` +
        `<span class="group-count">${count}</span>`;
      btn.addEventListener("click", () => {
        this.groupIndex = i;
        this.render();
      });
      li.append(btn);
      list.append(li);
    });
    aside.append(list);
    return aside;
  }

  private puzzleMain(): HTMLElement {
    const main = document.createElement("main");
    main.className = "content";
    const group = GROUPS[this.groupIndex];

    if (group.gauntlet) {
      const view = new GauntletView(group);
      this.activeGroupView = view;
      main.append(view.el);
      return main;
    }

    const view = new GroupView(group, this.puzzlesDone, {
      onComplete: (id) => {
        this.puzzlesDone.add(id);
        saveSet(PUZZLE_PROGRESS_KEY, this.puzzlesDone);
        // Refresh the sidebar counts.
        const old = this.root.querySelector(".sidebar");
        old?.replaceWith(this.puzzleSidebar());
      },
    });
    this.activeGroupView = view;
    main.append(view.el);
    return main;
  }

  // --- Keymap reference ----------------------------------------------------

  private keymapBody(): HTMLElement {
    return keymapView();
  }
}

const root = document.getElementById("app");
if (root) new App(root);
