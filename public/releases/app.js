(() => {
  const lab = globalThis.ReleaseLab = {};

  window.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);
    const links = [...document.querySelectorAll("[data-tab]")];
    const sections = new Map(links.map(({ dataset }) => [dataset.tab, $(dataset.tab)]));
    let mountedDrill = false;

    for (const [id, item] of Object.entries(lab.guide)) {
      const section = sections.get(id);
      const heading = section.querySelector("h2");
      heading.textContent = item.title;
      section.querySelector("p").textContent = item.intro;
      const guide = document.createElement("div");
      guide.className = "guide";
      // The guide consists of authored lesson markup. Learner inputs are never interpolated.
      guide.innerHTML = item.html;
      section.append(guide);
    }

    const select = $("kit-select");
    select.replaceChildren(...lab.kit.map(item => new Option(item.title, item.id)));
    const selected = () => lab.kit.find(item => item.id === select.value) ?? lab.kit[0];

    function updatePreview() {
      const item = selected();
      $("kit-filename").textContent = item.filename;
      $("kit-description").textContent = item.description;
      const preview = $("kit-preview");
      preview.textContent = item.markdown;
      preview.scrollTop = 0;
      $("kit-status").textContent = "";
    }

    function saveMarkdown(filename, markdown) {
      const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      $("kit-status").textContent = "Markdown の保存を開始しました。";
    }

    select.addEventListener("change", updatePreview);
    $("save-document").addEventListener("click", () => {
      const item = selected();
      saveMarkdown(item.filename, item.markdown);
    });
    $("save-kit").addEventListener("click", () => {
      const items = lab.kit.map(item => `## ${item.filename}\n\n${item.markdown}`);
      saveMarkdown("github-release-kit.md", ["# GitHub Release Lab 資料一式", ...items].join("\n\n---\n\n"));
    });
    document.querySelector(".kit").hidden = false;
    updatePreview();

    function show({ move = false } = {}) {
      const hash = location.hash.slice(1);
      const active = sections.has(hash) ? hash : "cycle";
      for (const [id, section] of sections) section.hidden = id !== active;
      for (const link of links) {
        if (link.dataset.tab === active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
      if (active === "drill" && !mountedDrill) {
        lab.mountDrill($("drill-workspace"));
        mountedDrill = true;
      }
      if (move) {
        const panel = sections.get(active);
        panel.tabIndex = -1;
        panel.focus({ preventScroll: true });
        $("workbench").scrollIntoView({ block: "start" });
      }
    }

    window.addEventListener("hashchange", () => show({ move: true }));
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (link.hash === location.hash && sections.has(link.hash.slice(1))) {
        event.preventDefault();
        show({ move: true });
      }
    });
    show();
  });
})();
