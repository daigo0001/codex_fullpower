import { initFlowPlayer } from "../flow/player.js";
import { actors, scenarios, getTimeline } from "./scenarios.js";
import { renderTopology } from "./diagram.js";
import { mountAzureGuide } from "./guide.js";
import { getOsiFocus, osiLayers } from "./osi.js";

const presentation = {
  ingress: { icon: "route", caption: "外部から Web VM へ" },
  egress: { icon: "bolt", caption: "VM から外部 API へ" },
  private: { icon: "lock", caption: "Blob のプライベート IP" },
  "dns-missing": { icon: "alert", caption: "パブリック IP への解決" },
  hub: { icon: "layers", caption: "ピアリング + Azure Firewall" },
};

const osiList = document.getElementById("osi-layer-list");
const osiReason = document.getElementById("osi-reason");
const tiles = osiLayers.map(({ number, name, shortName }) => {
  const tile = document.createElement("li");
  tile.title = `L${number} ${name}`;
  const layer = document.createElement("strong");
  layer.textContent = `L${number}`;
  const label = document.createElement("span");
  label.textContent = shortName;
  tile.append(layer, label);
  return { number, name, tile };
});
osiList.replaceChildren(...tiles.map(({ tile }) => tile));

function getAzureTimeline(scenario) {
  return getTimeline(scenario).map((step) => {
    const osi = getOsiFocus(step);
    const annotation = osi.layers.map((layer) => `L${layer}`).join(" / ");
    return { ...step, osi, annotation };
  });
}

function renderOsiFocus({ osi }) {
  for (const { number, name, tile } of tiles) {
    const focused = osi.layers.includes(number);
    tile.toggleAttribute("data-focused", focused);
    tile.setAttribute("aria-label", focused ? `L${number} ${name}（注目する層）` : `L${number} ${name}`);
  }
  osiReason.textContent = osi.reason;
}

initFlowPlayer({ actors, scenarios, getTimeline: getAzureTimeline, renderTopology, presentation, onStep: renderOsiFocus });
mountAzureGuide(document.getElementById("azure-guide"));
