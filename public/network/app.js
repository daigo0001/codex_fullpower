import { initFlowPlayer } from "../flow/player.js";
import { actors, scenarios, getTimeline } from "./scenarios.js";
import { renderTopology } from "./diagram.js";

const presentation = {
  https: { icon: "lock", caption: "TCP + TLS 1.3" },
  cache: { icon: "layers", caption: "エッジで応答" },
  http3: { icon: "bolt", caption: "QUIC + TLS 1.3" },
  "dns-error": { icon: "alert", caption: "接続前に停止" },
};

initFlowPlayer({ actors, scenarios, getTimeline, renderTopology, presentation });
