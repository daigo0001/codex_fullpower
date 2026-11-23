import { initFlowPlayer } from "../flow/player.js";
import { actors, scenarios, getTimeline } from "./scenarios.js";
import { renderTopology } from "./diagram.js";
import { mountAzureGuide } from "./guide.js";

const presentation = {
  ingress: { icon: "route", caption: "外部から Web VM へ" },
  egress: { icon: "bolt", caption: "VM から外部 API へ" },
  private: { icon: "lock", caption: "Blob のプライベート IP" },
  "dns-missing": { icon: "alert", caption: "パブリック IP への解決" },
  hub: { icon: "layers", caption: "ピアリング + Azure Firewall" },
};

initFlowPlayer({ actors, scenarios, getTimeline, renderTopology, presentation });
mountAzureGuide(document.getElementById("azure-guide"));
