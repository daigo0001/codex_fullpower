const tabs = [
  { id: "basics", label: "VNet と NSG" },
  { id: "routes", label: "ルートを試す" },
  { id: "services", label: "サービスを比較" },
  { id: "diagnose", label: "通信を切り分ける" },
];

const docs = {
  vnet: ["VNet の概要", "https://learn.microsoft.com/ja-jp/azure/virtual-network/virtual-networks-overview"],
  reserved: ["予約済み IP", "https://learn.microsoft.com/ja-jp/azure/virtual-network/virtual-networks-faq#are-there-any-restrictions-on-using-ip-addresses-within-these-subnets"],
  nsg: ["NSG のルール", "https://learn.microsoft.com/ja-jp/azure/virtual-network/network-security-groups-overview"],
  filtering: ["NSG の適用順序", "https://learn.microsoft.com/ja-jp/azure/virtual-network/network-security-group-how-it-works"],
  routing: ["Azure のルート選択", "https://learn.microsoft.com/ja-jp/azure/virtual-network/virtual-networks-udr-overview#how-azure-selects-a-route"],
  load: ["負荷分散の選び方", "https://learn.microsoft.com/ja-jp/azure/architecture/guide/technology-choices/load-balancing-overview"],
  nat: ["NAT Gateway", "https://learn.microsoft.com/ja-jp/azure/nat-gateway/nat-overview"],
  firewall: ["Azure Firewall", "https://learn.microsoft.com/ja-jp/azure/firewall/overview"],
  privateLink: ["Private Endpoint", "https://learn.microsoft.com/ja-jp/azure/private-link/private-endpoint-overview"],
  privateDns: ["Private Endpoint の DNS", "https://learn.microsoft.com/ja-jp/azure/private-link/private-endpoint-dns"],
  serviceEndpoint: ["Service Endpoint", "https://learn.microsoft.com/ja-jp/azure/virtual-network/virtual-network-service-endpoints-overview"],
  peering: ["VNet ピアリング", "https://learn.microsoft.com/ja-jp/azure/virtual-network/virtual-network-peering-overview"],
  vpn: ["VPN Gateway", "https://learn.microsoft.com/ja-jp/azure/vpn-gateway/vpn-gateway-about-vpngateways"],
  expressRoute: ["ExpressRoute", "https://learn.microsoft.com/ja-jp/azure/expressroute/expressroute-introduction"],
  watcher: ["Network Watcher", "https://learn.microsoft.com/ja-jp/azure/network-watcher/network-watcher-overview"],
  bicep: ["Bicep の概要", "https://learn.microsoft.com/ja-jp/azure/azure-resource-manager/bicep/overview"],
};

function references(...ids) {
  return `<p class="azg-links">${ids.map((id) => {
    const [label, url] = docs[id];
    return `<a href="${url}">${label} ↗</a>`;
  }).join("")}</p>`;
}

const basics = `
  <h3>IP アドレスを区切り、通信の許可を決める</h3>
  <div class="azg-basics">
    <div class="azg-subnet">
      <div class="azg-subnet-title"><strong>VNet</strong><code>10.20.0.0/16</code></div>
      <div class="azg-subnets">
        <div><strong>App サブネット</strong><code>10.20.1.0/24</code></div>
        <div><strong>Data サブネット</strong><code>10.20.2.0/24</code></div>
      </div>
    </div>
    <div>
      <p>Azure Virtual Network（VNet）は Azure 上の論理ネットワークです。サブネットには VNet のアドレス範囲の一部を割り当てます。IPv4 の <code>/24</code> は先頭24ビットを固定する範囲で、256アドレスを含みます。</p>
      <p>Azure が IPv4 サブネットの先頭4つと末尾1つを予約するため、App の例では <code>10.20.1.4</code> から <code>10.20.1.254</code> が割り当て可能です。</p>
      ${references("vnet", "reserved")}
    </div>
  </div>
  <div class="azg-note">
    <strong>NSG は通信を許可するか決める</strong>
    <p>Network Security Group は受信・送信ごとにルールを評価します。数字の小さい優先度から順に最初の一致を採用します。接続が許可されると、その接続の応答は状態を追跡して通します。</p>
    <p>VM にサブネットと NIC の両方の NSG がある場合は、両方で許可される必要があります。受信はサブネットから NIC、送信は NIC からサブネットの順です。</p>
    ${references("nsg", "filtering")}
  </div>
`;

const routes = [
  { prefix: "10.60.4.0/24", source: "UDR", next: "仮想アプライアンス", detail: "Firewall 10.20.10.4" },
  { prefix: "10.60.4.0/24", source: "BGP", next: "仮想ネットワーク ゲートウェイ", detail: "拠点から学習" },
  { prefix: "10.60.0.0/16", source: "BGP", next: "仮想ネットワーク ゲートウェイ", detail: "拠点から学習" },
  { prefix: "0.0.0.0/0", source: "システム", next: "Internet", detail: "既定ルート" },
];

const examples = [
  { ip: "10.60.4.21", chosen: 0, matches: [0, 1, 2, 3], reason: "/24 が /16 と /0 より具体的です。同じ /24 の UDR と BGP が一致するため、UDR を選びます。" },
  { ip: "10.60.20.5", chosen: 2, matches: [2, 3], reason: "/24 の範囲から外れます。残る一致の中で /16 が /0 より具体的なので、BGP ルートを選びます。" },
  { ip: "198.51.100.40", chosen: 3, matches: [3], reason: "ここに示した個別ルートには一致しないため、既定の Internet ルートを選びます。外向き接続には送信元アドレスや送信許可の構成も必要です。" },
];

const routing = `
  <h3>宛先 IP を手がかりに、次の経由先を選ぶ</h3>
  <p>Azure はサブネットにシステムルートを作ります。経由先を変えたいときは、ルート テーブルを関連付けてユーザー定義ルート（UDR）を設定します。VPN や ExpressRoute のゲートウェイなどから BGP ルートが伝わる場合もあります。</p>
  <p>候補に宛先を含むルートが複数あれば、原則として最長プレフィックスを採用します。同じ長さで同じ範囲なら、原則は <strong>UDR → BGP → システム</strong> の順です。</p>
  <div class="azg-workshop">
    <div class="azg-workshop-heading">
      <h4>例題の宛先を変える</h4>
      <span>ルート候補の抜粋</span>
    </div>
    <div class="azg-addresses" role="group" aria-label="ルートの宛先 IP">
      ${examples.map(({ ip }, index) => `<button type="button" data-address="${index}" aria-pressed="false">${ip}</button>`).join("")}
    </div>
    <div class="azg-table-scroller" role="region" aria-label="例題のルート候補" tabindex="0">
      <table>
        <thead><tr><th scope="col">宛先範囲</th><th scope="col">ルートの種類</th><th scope="col">次の経由先</th><th scope="col">判定</th></tr></thead>
        <tbody>
          ${routes.map(({ prefix, source, next, detail }, index) => `<tr data-route="${index}"><th scope="row"><code>${prefix}</code></th><td>${source}</td><td>${next}<small>${detail}</small></td><td data-route-state></td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    <p class="azg-route-answer" role="status" data-answer></p>
  </div>
  <p class="azg-footnote">VNet、VNet ピアリング、Service Endpoint に関連するシステムルートが BGP より優先される場合があります。Service Endpoint 宛ての経由先は UDR で上書きできません。実環境では NIC の有効なルートを確認します。</p>
  ${references("routing", "watcher")}
`;

const services = `
  <h3>守りたい境界からサービスを選ぶ</h3>
  <div class="azg-table-scroller" role="region" aria-label="サービスの比較" tabindex="0">
    <table>
      <thead><tr><th scope="col">サービス</th><th scope="col">向いている場面</th><th scope="col">設計で確認すること</th></tr></thead>
      <tbody>
        <tr><th scope="row">Application Gateway</th><td>HTTP(S) をホスト名やパスで振り分ける</td><td>リスナーとバックエンドの TLS、正常性プローブ。WAF が必要なら対応 SKU を選ぶ。</td></tr>
        <tr><th scope="row">Azure Load Balancer</th><td>TCP・UDP の通信を L4 で振り分ける</td><td>公開か内部向けか、ポート・正常性プローブを決める。</td></tr>
        <tr><th scope="row">NAT Gateway</th><td>サブネットからの外向き接続に共通の公開 IP を使う</td><td>サブネットに関連付ける。接続元の変換（SNAT）を担当し、起点が外部の接続は受け付けない。</td></tr>
        <tr><th scope="row">Azure Firewall</th><td>複数のネットワークが通る経路で、通信ポリシーを管理する</td><td>UDR で通す経路を決め、送信元・宛先・プロトコルに合うルールと戻り経路を確認する。</td></tr>
        <tr><th scope="row">Private Endpoint</th><td>VNet 内のプライベート IP で対応する PaaS に到達する</td><td>対象サブリソースと DNS 解決先を確認し、PaaS の認証と公開アクセス設定も決める。</td></tr>
        <tr><th scope="row">Service Endpoint</th><td>対応する PaaS の公開エンドポイントを、許可したサブネットから利用する</td><td>サブネットで有効にし、サービス側でサブネットを許可する。接続先はサービスの公開 IP で、通信は Azure バックボーンを通る。</td></tr>
      </tbody>
    </table>
  </div>
  ${references("load", "nat", "firewall", "privateLink", "serviceEndpoint")}
  <div class="azg-note">
    <strong>VNet 同士をつなぐ</strong>
    <p>VNet ピアリングは、アドレス範囲が重ならない VNet 同士を Azure バックボーンで接続します。A と Hub、Hub と B をピアリングしても A から B に自動で中継されません。中継が必要なら、Hub 側の Firewall などを経由する往復のルート、ピアリングの転送設定、ファイアウォールルールを整えます。</p>
    <p>オンプレミスを接続するときは、インターネット上に IPsec トンネルを作る Site-to-Site VPN と、接続事業者経由のプライベート接続を提供する ExpressRoute を比較します。接続方式に加え、暗号化、冗長性、帯域、運用費を確認します。</p>
    ${references("peering", "vpn", "expressRoute")}
  </div>
`;

const diagnose = `
  <h3>つながらないときは名前、経路、許可を順に見る</h3>
  <ol class="azg-checklist">
    <li><strong>どの IP に名前解決しているか</strong><p>接続元から名前を解決します。たとえば Storage の通常の Blob ホスト名が Private Endpoint のプライベート IP に解決されるか、DNS ゾーンと VNet のリンクを確認します。独自 DNS を使う場合は、問い合わせの転送先も点検します。</p></li>
    <li><strong>宛先に向かうルートと戻りのルートは何か</strong><p>送信元 NIC の有効なルートで次ホップを確認します。ハブ経由なら、両側のルート テーブルとピアリング設定を突き合わせます。</p></li>
    <li><strong>通信を許可するルールがあるか</strong><p>方向、送信元・宛先 IP、ポート、プロトコルを特定します。NSG の有効なセキュリティ ルールや Network Watcher の IP フロー検証、Firewall のルールを確認します。</p></li>
    <li><strong>接続先の設定は合っているか</strong><p>アプリが期待するポートで待ち受け、HTTPS のホスト名と証明書が合っているかを確認します。PaaS ならネットワーク ACL とアプリの認証をそれぞれ点検します。</p></li>
  </ol>
  <p class="azg-footnote">構成を Bicep や Terraform に記録すると、サブネットへの NSG やルート テーブルの関連付け、Private DNS の VNet リンクをレビューできます。図では、リソースの名前と往復の通信経路を構成コードにそろえておくと照合しやすくなります。</p>
  ${references("privateDns", "watcher", "bicep")}
`;

function mountRoutingWorkshop(panel) {
  const buttons = [...panel.querySelectorAll("[data-address]")];
  const rows = [...panel.querySelectorAll("[data-route]")];
  const answer = panel.querySelector("[data-answer]");

  function select(index) {
    const { chosen, matches, reason } = examples[index];
    for (const [position, button] of buttons.entries()) {
      button.setAttribute("aria-pressed", String(position === index));
    }
    for (const [position, row] of rows.entries()) {
      const match = matches.includes(position);
      row.classList.toggle("azg-selected-route", position === chosen);
      row.querySelector("[data-route-state]").textContent = position === chosen ? "選択" : match ? "一致" : "範囲外";
    }
    answer.textContent = reason;
  }

  for (const [index, button] of buttons.entries()) {
    button.addEventListener("click", () => select(index));
  }
  select(0);
}

export function mountAzureGuide(container) {
  const panels = { basics, routes: routing, services, diagnose };
  container.classList.add("azure-guide");
  container.innerHTML = `
    <div class="azg-heading">
      <h2>Azure ネットワークの要点</h2>
      <p>通信を見るときは、IP の範囲、次の経由先、許可ルールを分けて確認します。</p>
    </div>
    <div class="azg-nav" role="group" aria-label="Azure ネットワークのテーマ">
      ${tabs.map(({ id, label }) => `<button type="button" data-guide-topic="${id}" aria-pressed="false">${label}</button>`).join("")}
    </div>
    ${tabs.map(({ id }) => `<section class="azg-panel" data-guide-panel="${id}" hidden>${panels[id]}</section>`).join("")}
  `;
  const buttons = [...container.querySelectorAll("[data-guide-topic]")];
  const sections = [...container.querySelectorAll("[data-guide-panel]")];

  function select(id) {
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.dataset.guideTopic === id));
    }
    for (const section of sections) section.hidden = section.dataset.guidePanel !== id;
  }

  for (const button of buttons) {
    button.addEventListener("click", () => select(button.dataset.guideTopic));
  }
  mountRoutingWorkshop(sections.find((panel) => panel.dataset.guidePanel === "routes"));
  select(tabs[0].id);
}
