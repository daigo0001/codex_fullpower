export const osiLayers = [
  {
    number: 7, name: "アプリケーション層", shortName: "アプリ",
    description: "アプリケーション同士が、リクエストや応答の意味を共有します。",
    example: "HTTP のメソッド・パス・ステータス、DNS の名前解決、Application Gateway の HTTP ルール。",
  },
  {
    number: 6, name: "プレゼンテーション層", shortName: "データ表現",
    description: "通信相手が同じ意味でデータを解釈できるよう、表現や変換を扱います。",
    example: "文字コード、シリアライズ、暗号化などの観点。TLS はセッションの観点も持ち、1層に固定できません。",
  },
  {
    number: 5, name: "セッション層", shortName: "セッション",
    description: "通信相手同士の対話を開始し、管理・終了します。",
    example: "対話の状態や再開を考える観点。TCP 接続そのものは L4 です。",
  },
  {
    number: 4, name: "トランスポート層", shortName: "トランスポート",
    description: "端末上のアプリケーション間で通信を運びます。TCP と UDP はポート番号を使います。",
    example: "TCP 443、DNS を運ぶ UDP や TCP、NAT Gateway のポート変換。",
  },
  {
    number: 3, name: "ネットワーク層", shortName: "ネットワーク",
    description: "IP アドレスに基づき、ネットワークをまたぐパケットの経路を決めます。",
    example: "VNet やサブネットの IP 範囲、Azure のルート テーブル、VNet ピアリング。",
  },
  {
    number: 2, name: "データリンク層", shortName: "データリンク",
    description: "同じリンク上でフレームを届けます。",
    example: "イーサネットのフレームや MAC アドレス。Azure のシナリオでは下位基盤の詳細を省略しています。",
  },
  {
    number: 1, name: "物理層", shortName: "物理",
    description: "ビットを電気・光などの信号として物理媒体で運びます。",
    example: "光ファイバーやケーブル。Azure データセンターの物理設備は Azure が管理します。",
  },
];

// These are the layers the step teaches, rather than the full protocol stack used by its traffic.
const focusByStep = {
  "public-https": {
    layers: [7, 4, 3],
    reason: "公開リスナーの IP（L3）と TCP 443（L4）へ接続し、その上の TLS で HTTP（L7）を保護します。",
  },
  "gateway-select-backend": {
    layers: [7],
    reason: "Application Gateway は HTTP のホスト名やパス（L7）を読み、バックエンドを選びます。",
  },
  "backend-https": {
    layers: [7, 4, 3],
    reason: "Web VM のプライベート IP（L3）と TCP 443（L4）へ別の TLS 接続を張り、HTTP（L7）を中継します。",
  },
  "backend-nsg": {
    layers: [4, 3],
    reason: "送信元・宛先 IP（L3）と TCP のポート（L4）を使い、一致する NSG ルールで許可を判断します。",
  },
  "backend-response": {
    layers: [7],
    reason: "Web VM が返す 200 OK は、アプリケーションが要求を処理した結果を表す HTTP（L7）の応答です。",
  },
  "gateway-response": {
    layers: [7],
    reason: "Application Gateway がブラウザー側の接続へ HTTP（L7）の応答を中継します。",
  },
  "internet-route": {
    layers: [3],
    reason: "宛先 IP（L3）をルート テーブルの範囲と照合し、次ホップを選びます。",
  },
  "nat-outbound": {
    layers: [4, 3],
    reason: "NAT Gateway が送信元 IP（L3）と TCP の送信元ポート（L4）を変換し、その対応を記録します。",
  },
  "external-request": {
    layers: [7],
    reason: "外部 API が HTTP（L7）の要求を受け取ります。接続元 IP とポートの変換は手前の NAT のステップです。",
  },
  "external-response": {
    layers: [4, 3],
    reason: "応答パケットは、変換後のパブリック IP（L3）とポート（L4）を宛先にします。",
  },
  "nat-return": {
    layers: [4, 3],
    reason: "接続の対応表を使い、戻りパケットの宛先 IP（L3）とポート（L4）を元に戻します。",
  },
  "blob-dns-query": {
    layers: [7],
    reason: "ホスト名を問い合わせる DNS は L7 のプロトコルです。DNS メッセージの運搬には UDP や TCP（L4）を使います。",
  },
  "private-dns-answer": {
    layers: [7],
    reason: "DNS（L7）の A レコードがプライベート IP を返します。次のステップで、その IP への経路を使います。",
  },
  "connect-private-endpoint": {
    layers: [7, 4, 3],
    reason: "Private Endpoint の IP（L3）と TCP 443（L4）へ接続し、HTTP（L7）では通常の Blob のホスト名を使います。",
  },
  "storage-private-link": {
    layers: [7, 3],
    reason: "Private Endpoint の IP（L3）への到達と、Blob API（L7）が行うデータの認証・認可を確認します。",
  },
  "private-storage-response": {
    layers: [7],
    reason: "Blob サービスがデータを読み取った結果を、HTTP（L7）の 200 OK で返します。",
  },
  "private-response": {
    layers: [7, 3],
    reason: "VM は Private Endpoint の IP（L3）への接続で、HTTP（L7）の読み取り結果を受け取ります。",
  },
  "public-dns-answer": {
    layers: [7],
    reason: "この DNS（L7）の解決は NOERROR で、A レコードがパブリック IP を返します。",
  },
  "request-public-storage": {
    layers: [7, 3],
    reason: "通常の Blob のホスト名で HTTP（L7）の要求を送り、接続先にはパブリック IP（L3）を使います。",
  },
  "reject-public-access": {
    layers: [7],
    reason: "Storage が公開経路からの要求を拒否した結果は、HTTP（L7）の 403 Forbidden として返ります。",
  },
  "public-error-return": {
    layers: [7],
    reason: "403 Forbidden は、Storage が要求を拒否したことを示す HTTP（L7）の応答です。",
  },
  "public-error-vm": {
    layers: [4, 3],
    reason: "NAT Gateway が戻るパケットの宛先 IP（L3）とポート（L4）を復元し、VM に応答を届けます。",
  },
  "spoke-a-udr": {
    layers: [3],
    reason: "Spoke B の IP 範囲（L3）に一致するルートから、Firewall を次ホップに選びます。",
  },
  "spoke-a-to-firewall": {
    layers: [3],
    reason: "最終宛先の IP（L3）を維持したまま、VNet ピアリングを通って次ホップに転送します。",
  },
  "firewall-network-rule": {
    layers: [4, 3],
    reason: "この Firewall のネットワークルールは送信元・宛先 IP（L3）と TCP 443（L4）を照合します。",
  },
  "firewall-to-spoke-b": {
    layers: [3],
    reason: "Firewall がパケットの宛先 IP（L3）に向けて Spoke B の VNet へ転送します。",
  },
  "spoke-b-udr": {
    layers: [3],
    reason: "戻りパケットの宛先 IP（L3）を照合し、Spoke A 宛てのルートで Firewall を次ホップに選びます。",
  },
  "spoke-b-to-firewall": {
    layers: [4, 3],
    reason: "Firewall は IP（L3）、ポートとプロトコル（L4）を含む接続状態に基づき、応答を処理します。",
  },
  "firewall-return": {
    layers: [7, 3],
    reason: "Firewall が宛先 IP（L3）へ転送し、Spoke A のアプリが HTTP（L7）の応答を受け取ります。",
  },
};

export function getOsiFocus(step) {
  if (Object.hasOwn(focusByStep, step?.id)) return focusByStep[step.id];
  return { layers: [], reason: "このステップに OSI 層の解説はありません。" };
}
