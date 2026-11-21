// Preserve links to YOSORA tabs from before the portal existed.
const astronomyTabs = new Set(["#sky", "#favorites", "#journal"]);

function openLegacyTab() {
  if (!astronomyTabs.has(location.hash)) return;
  const destination = new URL("./yosora/", location.href);
  destination.hash = location.hash;
  location.replace(destination);
}

window.addEventListener("hashchange", openLegacyTab);
openLegacyTab();
