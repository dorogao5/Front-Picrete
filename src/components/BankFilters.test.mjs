import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function compile(file, imports = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  new Function("require", "exports", outputText)((name) => imports[name] ?? require(name), exports);
  return exports;
}
const filters = compile("../lib/bankFilters.ts");
const primitive = () => null;
function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object") return [];
  return [node, ...elements(node.props?.children)];
}
async function renderFilters(facets, sourceLabels = true) {
  const states = [null, false, 0], effects = [], requests = [], changes = [];
  let index = 0;
  const { BankAdvancedFilters } = compile("./BankAdvancedFilters.tsx", {
    react: {
      useId: () => "filters",
      useState: () => { const slot = index++; return [states[slot], (value) => { states[slot] = value; }]; },
      useEffect: (effect) => effects.push(effect),
    },
    "@/components/ui/input": { Input: primitive },
    "@/components/ui/label": { Label: primitive },
    "@/lib/bankFilters": filters,
    "@/lib/api": { taskBankAPI: { facets: async (...args) => { requests.push(args); return { data: facets }; } } },
  });
  const props = { value: filters.emptyBankFilters, onChange: (value) => changes.push(value), courseId: "course", source: "physical", listPrefix: "bank", sourceLabels };
  const initial = BankAdvancedFilters(props);
  effects[0]();
  await new Promise(setImmediate);
  index = 0;
  const tree = BankAdvancedFilters(props);
  const select = (field) => elements(tree).find((el) => el.type === "select" && el.props.id === `filters-${field}`);
  const options = (field) => elements(select(field)).filter((el) => el.type === "option").map((el) => [el.props.value, el.props.children]);
  return { initial, select, options, requests, changes };
}
const facets = { paragraphs: [], topics: [], task_types: ["calculation"], difficulties: ["hard", "easy", "medium"], volumes: ["medium"] };

test("physical source facets render Russian options and retain raw API filter values", async () => {
  const view = await renderFilters(facets);
  assert.deepEqual(view.requests, [["course", "physical"]]);
  assert.deepEqual(view.options("difficulty"), [["", "Все"], ["easy", "Базовый"], ["medium", "Средний"], ["hard", "Сложный"]]);
  assert.deepEqual(view.options("volume"), [["", "Все"], ["medium", "Средний"]]);
  assert.deepEqual(view.options("task_type"), [["", "Все"], ["calculation", "Расчётное"]]);
  for (const difficulty of ["easy", "medium", "hard"]) {
    view.select("difficulty").props.onChange({ target: { value: difficulty } });
    assert.equal(filters.bankFilterParams(view.changes.at(-1)).difficulty, difficulty);
  }
});

test("Russian and unfamiliar source levels remain selectable without inventing absent levels", async () => {
  const view = await renderFilters({ ...facets, difficulties: ["сложная", "легкая", "custom", "легкая"], volumes: ["длинное", "короткое"] });
  assert.deepEqual(view.options("difficulty"), [["", "Все"], ["легкая", "Лёгкая"], ["сложная", "Сложная"], ["custom", "custom"]]);
  assert.deepEqual(view.options("volume").map(([value]) => value), ["", "короткое", "длинное"]);
  const empty = await renderFilters({ ...facets, difficulties: [], volumes: [] });
  assert.deepEqual(empty.options("difficulty"), [["", "Все"]]);
});

test("bank badges distinguish medium difficulty from medium volume; other callers retain their presentation", () => {
  const { BankTaskBadges } = compile("./BankTaskDetails.tsx", {
    "@/components/RichText": { RichText: primitive },
    "@/components/ui/badge": { Badge: primitive },
    "@/lib/bankFilters": filters,
  });
  const item = { task_type: "calculation", difficulty: "medium", volume: "medium", has_solution: true };
  const labels = (props) => elements(BankTaskBadges(props)).filter((el) => el.type === primitive).map((el) => el.props.children);
  assert.deepEqual(labels({ item, sourceLabels: true }), ["Расчётное", "Сложность: Средний", "Объём: Средний", "С решением"]);
  assert.deepEqual(labels({ item }), ["calculation", "medium", "medium", "С решением"]);
});

test("legacy shared filter caller is unchanged without the bank-page opt-in", async () => {
  const view = await renderFilters(facets, false);
  assert.deepEqual(view.options("difficulty"), [["", "Все"]]);
});
