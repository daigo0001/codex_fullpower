export { getTimeline } from "../flow/timeline.js";

export const actors = [
  { id: "client", name: "ブラウザー", laneLabel: "利用者", detail: "Azure の外にいる Web アプリの利用者です。", icon: "browser" },
  { id: "app-gateway", name: "Application Gateway", laneLabel: "App Gateway", detail: "HTTPS の入口です。HTTP のルーティング規則を使い、正常なバックエンドへ中継できます。", icon: "gateway" },
  { id: "web-vm", name: "Web VM", laneLabel: "Web VM", detail: "VNet 内のプライベート IP だけでアプリを提供します。", icon: "vm" },
  { id: "vm", name: "アプリ VM", laneLabel: "アプリ VM", detail: "VNet のワークロードです。プライベート IP を持ち、外部接続はサブネットの設定に従います。", icon: "vm" },
  { id: "dns", name: "Azure 提供 DNS", laneLabel: "DNS", detail: "問い合わせ元の VNet にリンクされたプライベート DNS ゾーンを参照できます。", icon: "dns" },
  { id: "nat-gateway", name: "NAT Gateway", laneLabel: "NAT", detail: "関連付けたサブネットのインターネット向け通信の送信元を変換します。", icon: "nat" },
  { id: "public-service", name: "外部 Web API", laneLabel: "外部 API", detail: "インターネット上の HTTPS サービスです。", icon: "globe" },
  { id: "private-endpoint", name: "Private Endpoint", laneLabel: "PE", detail: "対象サービスへの Private Link 接続を VNet のプライベート IP として提供します。", icon: "endpoint" },
  { id: "storage", name: "Blob Storage", laneLabel: "Storage", detail: "Blob サービスです。この例ではパブリック ネットワークからのアクセスを無効にしています。", icon: "storage" },
  { id: "spoke-a", name: "Spoke A · アプリ", laneLabel: "Spoke A", detail: "ハブにピアリングした送信元の VNet です。", icon: "vm" },
  { id: "firewall", name: "Azure Firewall", laneLabel: "Firewall", detail: "ハブに配置され、両 Spoke 間で許可した通信を検査して転送します。", icon: "firewall" },
  { id: "spoke-b", name: "Spoke B · API", laneLabel: "Spoke B", detail: "ハブにピアリングした宛先の VNet です。", icon: "vm" },
];

const layers = {
  http: "アプリケーション層",
  dns: "名前解決",
  route: "経路選択",
  nsg: "ネットワークフィルター",
  snat: "送信元アドレス変換",
  "private-link": "プライベート接続",
  fw: "ファイアウォール",
  error: "アクセス制御",
};

function step(id, from, to, category, protocol, title, description, fields, {
  duration = 1,
  phase = "forward",
} = {}) {
  const data = Object.entries(fields).map(([label, value]) => ({ label, value }));
  return { id, from, to, category, protocol, layer: layers[category], title, description, data, duration, phase };
}

const vmIp = "10.10.1.4";
const natIp = "203.0.113.24";
const publicBlobIp = "198.51.100.25";
const privateEndpointIp = "10.10.2.5";
const blobHost = "atlasexample2026.blob.core.windows.net";
const privateAlias = "atlasexample2026.privatelink.blob.core.windows.net";

const askBlobAddress = step(
  "blob-dns-query", "vm", "dns", "dns", "DNS", "Blob の通常の名前を問い合わせる",
  "アプリは、いつもと同じ Blob のホスト名で接続します。Private Endpoint を利用する場合でも、アプリの URL を privatelink の名前に変える必要はありません。",
  { ホスト名: blobHost, 問い合わせ先: "Azure 提供 DNS（168.63.129.16）" },
  { duration: 2 },
);

const chooseInternet = (destination) => step(
  "internet-route", "vm", "vm", "route", "システムルート", "有効なルートから Internet を選ぶ",
  "Azure は宛先に最も長く一致するプレフィックスを選びます。この例では宛先への具体的なルートがなく、既定ルートの次ホップが Internet になります。",
  { 宛先: destination, 選択されたプレフィックス: "0.0.0.0/0", 次ホップ: "Internet" },
);

const natOutbound = (sourcePort) => step(
  "nat-outbound", "vm", "nat-gateway", "snat", "SNAT", "サブネットの NAT Gateway で送信元を変換する",
  "NAT Gateway は、サブネットに関連付けて Internet 向け送信を処理します。有効なルートの次ホップは Internet のままです。NAT Gateway の IP を UDR の次ホップに手入力する構成ではありません。",
  { 変換前: `${vmIp}:${sourcePort}`, 変換後: `${natIp}:62102` },
);

export const scenarios = [
  {
    id: "ingress",
    name: "Application Gateway",
    summary: "パブリックな HTTPS 入口から、パブリック IP を持たない Web VM に処理を中継します。",
    initialCondition: "ブラウザーは公開名を解決済みです。Gateway と Web VM は別のサブネットに置き、バックエンドは HTTPS と正常なヘルスプローブを構成しています。",
    outcome: "200 OK · Web VM の応答",
    outcomeKind: "success",
    actorIds: ["client", "app-gateway", "web-vm"],
    steps: [
      step(
        "public-https", "client", "app-gateway", "http", "HTTPS", "公開リスナーへリクエストを送る",
        "ブラウザーは Gateway のフロントエンド パブリック IP の 443 番へ接続します。リスナーがクライアントとの TLS 接続を受けます。",
        { ホスト名: "shop.example.com", 宛先: "203.0.113.10:443" },
        { duration: 15 },
      ),
      step(
        "gateway-select-backend", "app-gateway", "app-gateway", "http", "L7 ルーティング", "HTTP ルールでバックエンドを選ぶ",
        "Gateway は TLS を終端し、ホスト名やパスなど、設定した規則に従って転送先を選びます。この例では、プローブで正常と判定された Web VM を選びます。",
        { リクエスト: "GET /products", バックエンド: "Web VM（10.10.1.4）", プローブ: "正常" },
      ),
      step(
        "backend-https", "app-gateway", "web-vm", "http", "HTTPS", "プライベート IP に新しい HTTPS 接続を作る",
        "Gateway は Web VM へ別の TLS 接続を張ります。VM へ届く接続のネットワーク上の送信元は Gateway 側です。ここでは HTTPS を選んで、バックエンド区間も暗号化しています。",
        { 送信元サブネット: "10.10.0.0/24（Gateway）", 宛先: `${vmIp}:443` },
        { duration: 4 },
      ),
      step(
        "backend-nsg", "web-vm", "web-vm", "nsg", "NSG", "バックエンドの受信ルールで許可する",
        "Web サブネットの NSG は、Gateway サブネットからの TCP 443 を許可します。例の優先度 100 は後続の拒否ルールより先に評価されます。",
        { 優先度: "100", 方向: "受信", 許可する通信: "10.10.0.0/24 → TCP 443" },
      ),
      step(
        "backend-response", "web-vm", "app-gateway", "http", "HTTPS", "Web VM が応答を返す",
        "許可済み接続への応答です。NSG は接続状態を追跡するため、この戻り通信専用の反対方向のルールは不要です。",
        { バックエンドの応答: "200 OK" },
        { duration: 7, phase: "unwind" },
      ),
      step(
        "gateway-response", "app-gateway", "client", "http", "HTTPS", "Gateway がブラウザーに応答を中継する",
        "Gateway はブラウザー側の HTTPS 接続で結果を返します。ブラウザーが Web VM のプライベート IP に直接接続することはありません。",
        { ブラウザーから見た接続先: "203.0.113.10:443", 結果: "200 OK" },
        { duration: 8, phase: "unwind" },
      ),
    ],
  },
  {
    id: "egress",
    name: "NAT Gateway",
    summary: "プライベート IP だけの VM が、送信用のパブリック IP を使って外部 API に接続します。",
    initialCondition: "VM のサブネットに NAT Gateway を関連付けています。外部 API の名前は解決済みで、NSG の送信ルールが TCP 443 を許可しています。",
    outcome: "200 OK · 送信した接続の応答",
    outcomeKind: "success",
    actorIds: ["vm", "nat-gateway", "public-service"],
    steps: [
      chooseInternet("198.51.100.42"),
      natOutbound("51511"),
      step(
        "external-request", "nat-gateway", "public-service", "http", "HTTPS", "外部サービスにパブリック IP で届く",
        "外部 API が見る送信元は NAT Gateway のパブリック IP です。NAT は接続のアドレスやポートを変換する機能で、HTTPS の本文を中継・読み取りする L7 プロキシではありません。",
        { 送信元: `${natIp}:62102`, 宛先: "198.51.100.42:443" },
        { duration: 14 },
      ),
      step(
        "external-response", "public-service", "nat-gateway", "snat", "戻り通信", "外部 API が変換後のアドレスへ応答する",
        "外部 API は接続してきたパブリック IP とポートに応答を送ります。先に VM が開始した接続の応答だけが通り、外部からの新しい接続は受け付けません。",
        { 応答の宛先: `${natIp}:62102`, 条件: "送信済み接続に対応する通信" },
        { duration: 20, phase: "unwind" },
      ),
      step(
        "nat-return", "nat-gateway", "vm", "snat", "逆変換", "接続の対応表で元の VM に戻す",
        "NAT Gateway は接続の対応表に基づき、戻りパケットの宛先を VM のプライベート IP と元のポートに戻します。",
        { 変換前の宛先: `${natIp}:62102`, 変換後の宛先: `${vmIp}:51511` },
        { phase: "unwind" },
      ),
    ],
  },
  {
    id: "private",
    name: "Private Endpoint",
    summary: "通常の Blob の名前からプライベート IP を得て、Azure Private Link 経由でアクセスします。",
    initialCondition: "VM と承認済みの Private Endpoint は同じリージョン、Blob Storage は別リージョンです。DNS ゾーンと VNet のリンク、VM の読み取り権限も設定済みです。",
    outcome: "200 OK · プライベート接続",
    outcomeKind: "success",
    actorIds: ["vm", "dns", "private-endpoint", "storage"],
    steps: [
      askBlobAddress,
      step(
        "private-dns-answer", "dns", "vm", "dns", "DNS", "リンク済みの DNS ゾーンからプライベート IP が返る",
        "Blob の公開 DNS 名は privatelink の名前を指す CNAME です。Azure 提供 DNS は VM の VNet にリンクされたプライベート ゾーンを使い、対応する A レコードを解決します。",
        { CNAME: privateAlias, ゾーン: "privatelink.blob.core.windows.net", A: privateEndpointIp },
        { duration: 3, phase: "unwind" },
      ),
      step(
        "connect-private-endpoint", "vm", "private-endpoint", "private-link", "HTTPS", "プライベート IP の Private Endpoint に接続する",
        "VM が HTTPS の接続先に使う IP は VNet 内の Private Endpoint です。TLS や HTTP で使うホスト名は、最初に問い合わせた通常の Blob の名前のままです。",
        { ホスト名: blobHost, 宛先: `${privateEndpointIp}:443` },
        { duration: 3 },
      ),
      step(
        "storage-private-link", "private-endpoint", "storage", "private-link", "Azure Private Link", "Private Link が対象の Blob サービスに接続する",
        "Private Endpoint は Blob の対象サブリソースに結び付けられています。プライベート経路を使っても、データに対する認証と権限の確認は必要です。",
        { サブリソース: "blob", 認証の例: "Microsoft Entra ID のマネージド ID", 認可の例: "Storage Blob Data Reader" },
        { duration: 5 },
      ),
      step(
        "private-storage-response", "storage", "private-endpoint", "private-link", "Azure Private Link", "Blob サービスが読み取り結果を返す",
        "この VM はアクセス許可を持つので、Storage は Private Link 接続に応答します。パブリック ネットワーク アクセスの無効化は、このプライベート経路を遮断しません。",
        { 応答: "200 OK", パブリックネットワークアクセス: "無効" },
        { duration: 6, phase: "unwind" },
      ),
      step(
        "private-response", "private-endpoint", "vm", "private-link", "HTTPS", "VM がプライベート接続の応答を受け取る",
        "VM は VNet 内の IP 宛てに確立した HTTPS 接続で結果を受け取ります。DNS の解決先、Private Endpoint の接続状態、データの権限を順に見ると、問題の箇所を切り分けやすくなります。",
        { "接続先として使った IP": privateEndpointIp, 結果: "200 OK" },
        { phase: "unwind" },
      ),
    ],
  },
  {
    id: "dns-missing",
    name: "Private DNS 未リンク",
    summary: "Private Endpoint はあっても、名前がパブリック IP に解決されると意図した経路を通りません。",
    initialCondition: "Blob Storage は VM と別リージョンです。Private Endpoint の DNS ゾーンは VNet 未リンクで、Storage の Service Endpoint も未設定です。NAT は設定済みで、Storage のパブリック ネットワーク アクセスは無効です。",
    outcome: "403 Forbidden · パブリック経路を拒否",
    outcomeKind: "client-error",
    actorIds: ["vm", "dns", "nat-gateway", "storage"],
    steps: [
      askBlobAddress,
      step(
        "public-dns-answer", "dns", "vm", "dns", "DNS", "リンクがないためパブリック IP が返る",
        "問い合わせ元の VNet からプライベート ゾーンは参照できません。この例では公開 DNS の回答にたどり着き、パブリック IP を得ます。DNS 応答そのものは成功しています。",
        { CNAME: privateAlias, "公開 DNS の解決結果": publicBlobIp, "DNS 応答": "NOERROR" },
        { duration: 3, phase: "unwind" },
      ),
      chooseInternet(publicBlobIp),
      natOutbound("51512"),
      step(
        "request-public-storage", "nat-gateway", "storage", "http", "HTTPS", "Storage のパブリック エンドポイントに届く",
        "VM は DNS が返したパブリック IP に向けて接続します。この通信は Private Endpoint を通っていません。",
        { ホスト名: blobHost, 宛先: `${publicBlobIp}:443` },
        { duration: 13 },
      ),
      step(
        "reject-public-access", "storage", "storage", "error", "HTTP 403", "Storage がパブリック経路のアクセスを拒否する",
        "この例では Storage のパブリック ネットワーク アクセスが無効なので、公開側のデータ要求が拒否されます。DNS の解決結果と VNet リンクを比べると、経路の違いを発見できます。",
        { 方針: "パブリック ネットワーク アクセスを無効化", 結果: "403 Forbidden" },
        { phase: "short-circuit" },
      ),
      step(
        "public-error-return", "storage", "nat-gateway", "http", "HTTPS", "公開エンドポイントが拒否を返す",
        "公開エンドポイントに届いた接続に 403 が返ります。この例では権限を持っていても、接続元のネットワーク条件を満たさないため失敗します。",
        { ステータス: "403 Forbidden", 応答先: `${natIp}:62102` },
        { duration: 12, phase: "unwind" },
      ),
      step(
        "public-error-vm", "nat-gateway", "vm", "snat", "逆変換", "VM がエラーを受け取る",
        "NAT Gateway は応答を元の接続へ戻します。Private Endpoint の IP と VM からの DNS 解決結果を照合し、VM 側の VNet から正しいゾーンが見えるようにするのが確認点です。",
        { 期待する接続先: privateEndpointIp, 実際に接続した先: publicBlobIp },
        { phase: "unwind" },
      ),
    ],
  },
  {
    id: "hub",
    name: "Hub & Spoke",
    summary: "Spoke A と Spoke B 間の HTTPS を、ハブの Azure Firewall に経由させます。",
    initialCondition: "両 Spoke はハブにピアリングし、転送トラフィックを許可済みです。両方のワークロード サブネットに対向プレフィックスの UDR を設定しています。",
    outcome: "200 OK · 往復とも Firewall を経由",
    outcomeKind: "success",
    actorIds: ["spoke-a", "firewall", "spoke-b"],
    steps: [
      step(
        "spoke-a-udr", "spoke-a", "spoke-a", "route", "UDR", "Spoke A が対向ネットワークへの UDR を選ぶ",
        "ハブに両 Spoke をピアリングしただけでは、Spoke 間は自動的につながりません。この例では、Spoke B のアドレス範囲への UDR が Firewall のプライベート IP を次ホップにします。",
        { 宛先プレフィックス: "10.20.0.0/16", 次ホップの種類: "仮想アプライアンス", "次ホップの IP": "10.0.0.4" },
      ),
      step(
        "spoke-a-to-firewall", "spoke-a", "firewall", "route", "VNet Peering", "往路をハブの Firewall へ転送する",
        "送信先 IP は Spoke B のままです。Spoke A からピアリングを通り、指定した次ホップの Firewall に届きます。",
        { 送信元: `${vmIp}:51513`, 最終宛先: "10.20.1.4:443", 次ホップ: "10.0.0.4" },
        { duration: 2 },
      ),
      step(
        "firewall-network-rule", "firewall", "firewall", "fw", "Network rule", "Firewall がネットワークルールを評価する",
        "送信元、宛先、ポートなどを照合し、この例の許可ルールに一致します。RFC 1918 のプライベート IP が宛先のため、既定動作ではネットワークルールで送信元を変換しません。",
        { 送信元: "10.10.0.0/16", 宛先: "10.20.1.4", 許可: "TCP 443" },
      ),
      step(
        "firewall-to-spoke-b", "firewall", "spoke-b", "route", "VNet Peering", "ハブから Spoke B の API に届く",
        "Firewall から、ハブと Spoke B のピアリングを通って API に届きます。宛先に NSG がある場合は、その受信ルールでも許可が必要です。",
        { 最終宛先: "10.20.1.4:443", 到達に必要な設定: "Firewall の許可と転送トラフィックの許可" },
        { duration: 2 },
      ),
      step(
        "spoke-b-udr", "spoke-b", "spoke-b", "route", "UDR", "Spoke B の戻りルートにも Firewall を指定する",
        "戻りパケットの宛先は Spoke A です。Spoke B 側でも Spoke A 宛ての UDR を設定し、戻りが同じ Firewall を通るようにします。",
        { 宛先プレフィックス: "10.10.0.0/16", "次ホップの IP": "10.0.0.4" },
        { duration: 4, phase: "unwind" },
      ),
      step(
        "spoke-b-to-firewall", "spoke-b", "firewall", "fw", "戻り通信", "Firewall が既存の接続への応答を処理する",
        "Firewall は接続状態を追跡します。往路で許可した接続への応答として確認できるよう、往復の経路を対称にします。",
        { 送信元: "10.20.1.4:443", 宛先: `${vmIp}:51513` },
        { duration: 2, phase: "unwind" },
      ),
      step(
        "firewall-return", "firewall", "spoke-a", "http", "HTTPS", "Spoke A が API の応答を受け取る",
        "Firewall はピアリングを通じて応答を Spoke A に転送します。ルートが存在すること、ルールが許可すること、戻り経路が通ることを分けて考えます。",
        { 結果: "200 OK", 経路: "Spoke A ↔ Hub ↔ Spoke B" },
        { duration: 2, phase: "unwind" },
      ),
    ],
  },
];
