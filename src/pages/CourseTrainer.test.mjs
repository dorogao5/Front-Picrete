import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

// Exercise the real component and handlers with deterministic hook state and
// inert UI primitives. No browser, server, or generation service is contacted.
const require = createRequire(import.meta.url);
function compile(file, imports) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  new Function("require", "exports", outputText.replaceAll("import.meta.env", "({})"))((name) => imports[name] ?? require(name), exports);
  return exports;
}
const primitive = () => null;
const Button = () => null;
const TooltipContent = () => null;
function render({ unlocked = false, source = "studio_fizicheskaya_himiya", level = "easy", busy = "", generation, bankLevels = ["easy", "medium", "hard"] } = {}) {
  const calls = [];
  const navigations = [];
  const trainer = {
    source,
    generation_unlock: source === "studio_fizicheskaya_himiya" ? { selected: unlocked, other: false } : {},
    definition: { title: "Тема", sections: ["selected", "other"].map((id) => ({
      id, title: id, target: 3,
      items: bankLevels.map((difficulty) => ({ task_id: difficulty, difficulty })),
    })) },
    // Current-release progress can be empty even when generation is unlocked.
    progress: [],
  };
  const states = [trainer, "", busy, { selected: level }];
  const practice = compile("../lib/practice.ts", { "./api": { api: {} } });
  const component = compile("./CourseTrainer.tsx", {
    react: { ...require("react"), useState: () => [states.shift(), () => {}], useRef: (current) => ({ current }), useEffect: () => {}, useCallback: (fn) => fn },
    "react-router-dom": { useParams: () => ({ courseId: "course", trainerId: "trainer" }), useNavigate: () => (path) => navigations.push(path) },
    "lucide-react": { Check: primitive, Play: primitive, ArrowRight: primitive },
    "@/components/PageShell": { PageShell: primitive, PageLoader: primitive },
    "@/components/ui/card": { Card: primitive },
    "@/components/ui/button": { Button },
    "@/components/ui/tooltip": { Tooltip: primitive, TooltipTrigger: primitive, TooltipContent },
    "@/components/InlineError": { InlineError: primitive },
    "@/lib/practice": practice,
    "@/lib/api": { getApiErrorMessage: String, trainerAPI: { generateSet: async (...args) => { calls.push(args); return generation ? await generation() : { data: { id: "generated" } }; } } },
  }).default;
  const elements = [];
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    elements.push(node);
    walk(node.props?.children);
  }
  walk(component());
  const buttons = elements.filter((el) => el.type === Button && Array.isArray(el.props.children) && ["Генерировать", "Формируем…", "Новый набор задач", "Сформировать набор"].includes(el.props.children[0]));
  return { elements, buttons, calls, navigations };
}

test("locked subtopic disables generation at every level and exposes tooltip on a focusable wrapper", async () => {
  for (const level of ["easy", "medium", "hard"]) {
    const view = render({ level });
    assert.equal(view.buttons[0].props.disabled, true);
    assert.ok(view.elements.some((el) => el.type === TooltipContent && el.props.children === "решите 3 задачи"));
    assert.ok(view.elements.some((el) => el.type === "span" && el.props.tabIndex === 0 && el.props.children === view.buttons[0]));
    view.buttons[0].props.onClick();
    await new Promise(setImmediate);
    assert.equal(view.calls.length, 0, "handler also blocks direct invocation");
  }
});
test("server unlock applies across levels and survives empty republished progress; request carries selected IDs", async () => {
  for (const level of ["easy", "medium", "hard"]) {
    const view = render({ unlocked: true, level });
    assert.equal(view.buttons[0].props.disabled, false);
    assert.equal(view.buttons[1].props.disabled, true, "another subtopic stays locked");
    view.buttons[0].props.onClick();
    await new Promise(setImmediate);
    assert.equal(view.calls.length, 1);
    assert.equal(view.calls[0][0].trainer_id, "trainer");
    assert.equal(view.calls[0][0].section_id, "selected");
    assert.equal(view.calls[0][0].filters.difficulty, level);
    assert.equal(view.calls[0][0].filters.topic, "selected");
    assert.equal(view.calls[0][1], "course");
    assert.deepEqual(view.navigations, ["/c/course/trainer/generated"]);
  }
});
test("other subjects retain generation and busy state still disables buttons", () => {
  assert.equal(render({ source: "other-subject" }).buttons[0].props.disabled, false);
  assert.equal(render({ source: "other-subject" }).buttons[0].props.children[0], "Сформировать набор");
  assert.equal(render({ unlocked: undefined }).buttons[0].props.disabled, true);
  assert.equal(render({ unlocked: true, busy: "generate:selected" }).buttons[0].props.disabled, true);
  assert.equal(render({ source: "" }).buttons[0].props.disabled, true);
});
test("unlocked physical subtopic allows generation at levels with no preloaded tasks, but cannot start bank practice", async () => {
  for (const level of ["medium", "hard"]) {
    const view = render({ unlocked: true, level, bankLevels: ["easy"] });
    const levels = view.elements.filter((el) => el.type === Button && el.props.size === "sm");
    assert.deepEqual(levels.slice(0, 3).map((el) => el.props.disabled), [false, false, false]);
    assert.deepEqual(levels.slice(3, 6).map((el) => el.props.disabled), [false, true, true], "another locked subtopic stays restricted");
    const start = view.elements.find((el) => el.type === Button && el.props.children?.[0] === "Начать");
    assert.equal(start.props.disabled, true);
    assert.ok(view.elements.some((el) => el.type === "p" && el.props.children === "В банке пока нет задач этого уровня — сгенерируйте новый набор"));
    assert.equal(view.buttons[0].props.disabled, false);
    view.buttons[0].props.onClick();
    await new Promise(setImmediate);
    assert.equal(view.calls.length, 1);
    assert.equal(view.calls[0][0].filters.difficulty, level);
  }
  for (const options of [{ unlocked: false }, { source: "other-subject", unlocked: true }]) {
    const view = render({ ...options, bankLevels: ["easy"] });
    const levels = view.elements.filter((el) => el.type === Button && el.props.size === "sm");
    assert.deepEqual(levels.slice(0, 3).map((el) => el.props.disabled), [false, true, true]);
    const start = view.elements.find((el) => el.type === Button && el.props.children?.[0] === "Начать");
    assert.equal(start.props.disabled, false, "existing easy bank tasks remain playable");
  }
});
test("pending generation rejects repeat clicks and releases guard after success or failure", async () => {
  for (const fail of [false, true]) {
    let finish;
    const view = render({ unlocked: true, generation: () => new Promise((resolve, reject) => {
      finish = () => fail ? reject(new Error("timeout")) : resolve({ data: { id: "generated" } });
    }) });
    view.buttons[0].props.onClick();
    view.buttons[0].props.onClick();
    assert.equal(view.calls.length, 1);
    finish();
    await new Promise(setImmediate);
    assert.equal(view.calls.length, 1, "no automatic retry after failure");
    view.buttons[0].props.onClick();
    assert.equal(view.calls.length, 2, "next deliberate generation is allowed");
    finish();
    await new Promise(setImmediate);
  }
});
test("generation alone overrides Axios timeout and a failed request is not retried", async () => {
  const { api, trainerAPI } = compile("../lib/api.ts", {
    "./auth": { getAuthToken: () => null, getActiveCourseId: () => "course" },
  });
  const requests = [];
  api.defaults.adapter = async (config) => {
    requests.push(config);
    return { data: {}, status: 200, statusText: "OK", headers: {}, config };
  };
  await trainerAPI.generateSet({ source: "studio_fizicheskaya_himiya", count: 5 }, "course");
  await trainerAPI.getSet("set", "course");
  assert.equal(requests[0].timeout, 1320_000);
  assert.equal(requests[1].timeout, 0, "global Axios default stays unchanged");
  assert.equal(requests[0].url, "/courses/course/trainer/sets/generate");
  let failures = 0;
  api.defaults.adapter = async () => { failures++; throw new Error("timeout"); };
  await assert.rejects(trainerAPI.generateSet({ source: "studio_fizicheskaya_himiya", count: 5 }, "course"), /timeout/);
  assert.equal(failures, 1);
});
test("generated set returns to canonical section after reload and opens the selected task in the solver", async () => {
  for (const filters of [
    { trainer_id: "origin", section_id: "section" },
    {},
    { trainer_id: "origin", section_id: "section", mode: "studio_generated", count: 3, requested_count: 5, pending_count: 2 },
    { trainer_id: "origin", section_id: "section", mode: "studio_generated", count: 5, requested_count: 5, pending_count: 0 },
  ]) {
    const navigations = [], starts = [];
    const itemCount = filters.count ?? 1;
    const states = [{ title: "Set", source_title: "Physical", filters, items: Array.from({ length: itemCount }, (_, i) => ({ id: i ? `task-${i}` : "task", number: String(i + 1), text: "Solve" })) }, "", "", false];
    const PageShell = () => null;
    const component = compile("./TrainerSetView.tsx", {
      react: { ...require("react"), useState: () => [states.shift(), () => {}], useEffect: () => {}, useCallback: (fn) => fn },
      "react-router-dom": { useParams: () => ({ courseId: "course", setId: "set" }), useNavigate: () => (path) => navigations.push(path) },
      "lucide-react": { Play: primitive, Trash2: primitive },
      "@/components/PageShell": { PageShell, PageLoader: primitive },
      "@/components/ui/card": { Card: primitive },
      "@/components/ui/button": { Button },
      "@/components/RichText": { RichText: primitive },
      "@/components/InlineError": { InlineError: primitive },
      "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription", "DialogFooter"].map((name) => [name, primitive])),
      "@/lib/api": { trainerAPI: {}, getApiErrorMessage: String },
      "@/lib/practice": { practice: { start: async (...args) => { starts.push(args); return "attempt"; } } },
    }).default;
    const tree = component();
    const partial = filters.pending_count > 0;
    assert.equal(tree.props.subtitle, `Задач в наборе: ${itemCount}${partial ? " из 5" : ""} · Physical`);
    const notice = tree.props.children.find((node) => node?.props?.role === "status");
    assert.equal(Boolean(notice), partial);
    if (partial) {
      assert.match(notice.props.children.join(""), /только проверенные задачи/);
      assert.match(notice.props.children.join(""), /Ожидают проверки: 2/);
      assert.match(notice.props.children.join(""), /Они не входят в этот набор/);
    }
    tree.props.onBack();
    assert.equal(navigations[0], filters.trainer_id ? "/c/course/trainer/course/origin#section-section" : "/c/course/trainer");
    function findSolve(node) {
      if (Array.isArray(node)) return node.map(findSolve).find(Boolean);
      if (!node || typeof node !== "object") return;
      if (node.type === Button && node.props.variant === "accent") return node;
      return findSolve(node.props?.children);
    }
    await findSolve(tree).props.onClick();
    assert.deepEqual(starts, [["course", { set_id: "set", task_id: "task" }]]);
    assert.equal(navigations[1], "/c/course/trainer/practice/attempt");
  }
});
