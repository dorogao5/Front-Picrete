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
function render({ studioGeneration = false, generationLevels, unlocked = false, source = "studio_fizicheskaya_himiya", level = "easy", busy = "", generation, bankLevels = ["easy", "medium", "hard"], solved = 0, progress = [], target = 3 } = {}) {
  const calls = [];
  const navigations = [];
  const trainer = {
    source,
    studio_generation: studioGeneration,
    generation_levels: generationLevels,
    generation_unlock: (studioGeneration || source === "studio_fizicheskaya_himiya") ? { selected: unlocked, other: false } : {},
    generation_progress: (studioGeneration || source === "studio_fizicheskaya_himiya") && solved !== null ? { selected: { solved, required: 3 } } : {},
    definition: { title: "Тема", sections: ["selected", "other"].map((id) => ({
      id, title: id, target,
      items: bankLevels.map((difficulty) => ({ task_id: difficulty, difficulty })),
    })) },
    // Current-release progress can be empty even when generation is unlocked.
    progress,
  };
  const states = [trainer, "", busy, { selected: level }];
  const practice = compile("../lib/practice.ts", { "./api": { api: {} } });
  const component = compile("./CourseTrainer.tsx", {
    react: { ...require("react"), useState: () => [states.shift(), () => {}], useRef: (current) => ({ current }), useEffect: () => {}, useCallback: (fn) => fn },
    "react-router-dom": { useParams: () => ({ courseId: "course", trainerId: "trainer" }), useNavigate: () => (path) => navigations.push(path) },
    "lucide-react": { Check: primitive, Play: primitive, ArrowRight: primitive, LockKeyhole: primitive, LoaderCircle: primitive },
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

test("locked subtopic explains bank requirement visibly, accessibly and in tooltip at every level", async () => {
  for (const level of ["easy", "medium", "hard"]) {
    const view = render({ level });
    assert.equal(view.buttons[0].props.disabled, true);
    const hint = "Решите 3 разные задачи из банка этой подтемы чтобы генерировать новые задачи. Подойдёт любой уровень сложности.";
    assert.ok(view.elements.some((el) => el.type === TooltipContent && el.props.children === hint));
    assert.ok(view.elements.some((el) => el.type === "p" && el.props.id === "generation-hint-selected" && el.props.children.includes(hint)), "reason is visible without hover");
    assert.equal(view.buttons[0].props["aria-describedby"], "generation-hint-selected");
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
    assert.deepEqual(levels.slice(3, 6).map((el) => el.props.disabled), [false, false, false], "levels are inspectable even before generation unlock");
    const start = view.elements.find((el) => el.type === Button && el.props.children?.[0] === "Начать");
    assert.equal(start.props.disabled, true);
    assert.ok(view.elements.some((el) => el.type === "p" && el.props.children === "Готовых задач этого уровня пока нет — можно сгенерировать новый набор."));
    assert.equal(view.buttons[0].props.disabled, false);
    view.buttons[0].props.onClick();
    await new Promise(setImmediate);
    assert.equal(view.calls.length, 1);
    assert.equal(view.calls[0][0].filters.difficulty, level);
  }
  for (const options of [{ unlocked: false }, { source: "other-subject", unlocked: true }]) {
    const view = render({ ...options, bankLevels: ["easy"] });
    const levels = view.elements.filter((el) => el.type === Button && el.props.size === "sm");
    assert.deepEqual(levels.slice(0, 3).map((el) => el.props.disabled), options.source === "other-subject" ? [false, true, true] : [false, false, false]);
    const start = view.elements.find((el) => el.type === Button && el.props.children?.[0] === "Начать");
    assert.equal(start.props.disabled, false, "existing easy bank tasks remain playable");
  }
});
test("unlock progress uses server count across releases, not current practice progress", () => {
  for (const solved of [0, 1, 2]) {
    const view = render({ solved });
    assert.ok(view.elements.some((el) => el.type === "span" && el.props.children === `Решено ${solved} из 3`));
  }
  for (const options of [{ solved: null }, { unlocked: true, solved: 3 }]) {
    const view = render(options);
    assert.ok(!view.elements.some((el) => el.type === "span" && /^Решено \d из 3$/.test(el.props.children)), "do not invent absent historical progress or show a completed lock");
  }
});
test("empty level and missing source explain disabled actions without offering an impossible action", () => {
  const view = render({ level: "hard", bankLevels: ["easy"] });
  assert.ok(view.elements.some((el) => el.type === "p" && el.props.children === "Готовых задач этого уровня пока нет. Для начала выберите другой уровень."));
  const start = view.elements.find((el) => el.type === Button && el.props.children?.[0] === "Начать");
  assert.equal(start.props.disabled, true);
  assert.equal(start.props["aria-describedby"], "bank-hint-selected");
  const missing = render({ source: "" });
  assert.ok(missing.elements.some((el) => el.type === "p" && el.props.children?.includes("Генерация недоступна: для тренажёра не настроен источник задач. Обратитесь к преподавателю.")));
  assert.ok(render({ busy: "generate:selected" }).elements.some((el) => el.props.role === "status"));
});
test("completed practice target offers repeat practice without conflating historical unlock progress", () => {
  const view = render({
    target: 1,
    solved: 2,
    progress: [{ section_id: "selected", difficulty: "easy", solved: 1, independent: 1 }],
  });
  const repeat = view.elements.find((el) => el.type === Button && el.props.children?.[0] === "Решать ещё");
  assert.ok(repeat, "one solved task completes the configured practice target of one");
  assert.equal(repeat.props.disabled, false);
  assert.ok(view.elements.some((el) => el.type === "p" && el.props.id === "bank-hint-selected" && el.props.children === "Решено 1 из 1 · готовых задач в банке: 1"));
  assert.ok(view.elements.some((el) => el.type === "span" && el.props.children === "Решено 2 из 3"));
  assert.equal(view.buttons[0].props.disabled, true, "completing practice does not override the server generation lock");
});
test("entirely empty bank explains teacher action when locked and allows generation when unlocked", async () => {
  for (const unlocked of [false, true]) {
    const view = render({ bankLevels: [], unlocked, level: "hard" });
    const hint = view.elements.find((el) => el.type === "p" && el.props.id === "bank-hint-selected");
    assert.equal(hint.props.children, unlocked
      ? "Готовых задач этого уровня пока нет — можно сгенерировать новый набор."
      : "В этой подтеме пока нет готовых задач. Преподавателю нужно добавить их в банк.");
    assert.ok(!view.elements.some((el) => el.type === "p" && typeof el.props.children === "string" && el.props.children.includes("выберите другой уровень")));
    const start = view.elements.find((el) => el.type === Button && el.props.children?.[0] === "Начать");
    assert.equal(start.props.disabled, true);
    assert.equal(start.props["aria-describedby"], "bank-hint-selected");
    assert.equal(view.buttons[0].props.disabled, !unlocked);
    view.buttons[0].props.onClick();
    await new Promise(setImmediate);
    assert.equal(view.calls.length, unlocked ? 1 : 0);
    if (unlocked) assert.equal(view.calls[0][0].filters.difficulty, "hard");
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
    { trainer_id: "origin", section_id: "section", mode: "studio_generated", count: 3, requested_count: 5, pending_count: 0 },
    { trainer_id: "origin", section_id: "section", mode: "studio_generated", count: 3, requested_count: 5 },
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
    const partial = filters.mode === "studio_generated" && itemCount < filters.requested_count;
    assert.equal(tree.props.subtitle, `Задач в наборе: ${itemCount}${partial ? " из 5" : ""} · Physical`);
    const notice = tree.props.children.find((node) => node?.props?.role === "status");
    assert.equal(Boolean(notice), partial);
    if (partial) {
      assert.equal(notice.props.children.join(""), "Набор сформирован частично: готово 3 из 5 задач. Можно решать готовые задачи.");
      assert.doesNotMatch(notice.props.children.join(""), /ожида|автомат|повтор|ошиб|проверки/i);
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

test("inorganic course opts in by policy and requires its available blueprint level", async () => {
  const options = { source: "sviridov", studioGeneration: true, generationLevels: {selected:["medium"],other:[]}};
  for (const [unlocked,level,expected] of [[false,"medium",false],[true,"easy",false],[true,"medium",true]]) {
    const view=render({...options,unlocked,level});
    assert.equal(view.buttons[0].props.disabled,!expected);
    await view.buttons[0].props.onClick();
    assert.equal(view.calls.length,expected ? 1 : 0);
    assert.equal(view.buttons[1].props.disabled,true);
  }
});
