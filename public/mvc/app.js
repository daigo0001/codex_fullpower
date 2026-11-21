import { initFlowPlayer } from "../flow/player.js";
import { actors, scenarios, getTimeline } from "./scenarios.js";
import { renderTopology } from "./diagram.js";

const presentation = {
  get: { icon: "route", caption: "ミドルウェアから Razor へ" },
  auth: { icon: "lock", caption: "認可で短絡" },
  invalid: { icon: "form", caption: "ModelState を確認" },
  "action-error": { icon: "bolt", caption: "例外フィルター" },
  "view-error": { icon: "screen", caption: "例外処理ミドルウェア" },
};

initFlowPlayer({ actors, scenarios, getTimeline, renderTopology, presentation, actionLabel: "処理内容" });
