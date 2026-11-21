export const actors = [
  { id: "client", laneLabel: "ブラウザー", name: "ブラウザー", detail: "名前解決を依頼し、接続を確立してページを取得します。", icon: "browser" },
  { id: "dns", laneLabel: "DNS", name: "DNS リゾルバー", detail: "名前に対応する IP アドレスを調べます。キャッシュがなければ、必要な DNS サーバーに問い合わせます。", icon: "dns" },
  { id: "edge", laneLabel: "エッジ", name: "CDN エッジ", detail: "ブラウザーとの HTTPS 接続を受けます。保存済みの応答を返すか、オリジンへ処理を中継します。", icon: "edge" },
  { id: "origin", laneLabel: "オリジン", name: "オリジン", detail: "アプリケーションを実行し、ページの内容を生成するサーバーです。", icon: "origin" },
];

const site = "portal.example.test";
const edgeIp = "192.0.2.10";
const originIp = "198.51.100.20";

const dnsQuestion = {
  id: "dns-query", from: "client", to: "dns", protocol: "DNS", layer: "アプリケーション", category: "dns", duration: 7,
  title: "ドメイン名を問い合わせる",
  description: "ブラウザーが OS の名前解決機能を使い、DNS リゾルバーにホスト名のアドレスを尋ねます。この例では IPv4 の A レコードに絞って表示します。",
  data: [
    { label: "名前", value: site },
    { label: "レコード", value: "A (IPv4)" },
  ],
};
const dnsAnswer = {
  id: "dns-answer", from: "dns", to: "client", protocol: "DNS", layer: "アプリケーション", category: "dns", duration: 15,
  title: "CDN エッジの IP が返る",
  description: "リゾルバーが名前に対応するアドレスを返します。ブラウザーは、このアドレスを接続先として使います。リゾルバーから他の DNS サーバーへの問い合わせは省略しています。",
  data: [
    { label: "応答コード", value: "NOERROR" },
    { label: "A レコード", value: edgeIp },
    { label: "TTL", value: "300 秒（例）" },
  ],
};

const tcpHandshake = [
  {
    id: "tcp-syn", from: "client", to: "edge", protocol: "TCP", layer: "トランスポート", category: "transport", duration: 8,
    title: "TCP 接続を開始する",
    description: "ブラウザーがエッジの 443 番ポートへ SYN を送り、接続を要求します。この段階では HTTP の内容は送っていません。",
    data: [{ label: "宛先", value: `${edgeIp}:443` }, { label: "TCP フラグ", value: "SYN" }],
  },
  {
    id: "tcp-synack", from: "edge", to: "client", protocol: "TCP", layer: "トランスポート", category: "transport", duration: 8,
    title: "エッジが接続要求に応じる",
    description: "エッジは SYN と ACK を返し、ブラウザーの接続要求を確認すると同時に、エッジ側の通信を開始します。",
    data: [{ label: "TCP フラグ", value: "SYN, ACK" }],
  },
  {
    id: "tcp-ack", from: "client", to: "edge", protocol: "TCP", layer: "トランスポート", category: "transport", duration: 8,
    title: "TCP の接続が確立する",
    description: "ブラウザーが確認の ACK を送ります。SYN、SYN-ACK、ACK の 3 本で TCP ハンドシェイクが完了します。",
    data: [{ label: "TCP フラグ", value: "ACK" }],
  },
];

const tlsHandshake = [
  {
    id: "tls-clienthello", from: "client", to: "edge", protocol: "TLS 1.3", layer: "暗号化", category: "tls", duration: 8,
    title: "暗号化の条件を提示する",
    description: "TCP 接続上でブラウザーが ClientHello を送り、サーバー名、鍵共有の情報、利用できる HTTP プロトコルを提示します。",
    data: [
      { label: "メッセージ", value: "ClientHello" },
      { label: "SNI", value: site },
      { label: "ALPN の候補", value: "h2, http/1.1" },
    ],
  },
  {
    id: "tls-serverhello", from: "edge", to: "client", protocol: "TLS 1.3", layer: "暗号化", category: "tls", duration: 23,
    title: "証明書と暗号化の条件を受け取る",
    description: "エッジは暗号化の条件と HTTP/2 の利用を確定し、証明書を送ります。ブラウザーは証明書の信頼チェーン、有効期限、接続先の名前を確認します。",
    data: [
      { label: "メッセージ", value: "ServerHello → Certificate → Finished（一部省略）" },
      { label: "ALPN の選択", value: "h2" },
    ],
  },
  {
    id: "tls-finished", from: "client", to: "edge", protocol: "TLS 1.3", layer: "暗号化", category: "tls", duration: 8,
    title: "ブラウザーが TLS の確立を確認する",
    description: "ブラウザーが Finished を送ります。ブラウザーとエッジは、ここで作った鍵を使って HTTP の内容を暗号化します。",
    data: [{ label: "メッセージ", value: "Finished" }],
  },
];

const httpRequest = {
  id: "http-get", from: "client", to: "edge", protocol: "HTTP/2", layer: "アプリケーション", category: "http", duration: 10,
  title: "ページを GET で要求する",
  description: "ブラウザーが暗号化された接続を使い、エッジにトップページを要求します。エッジはこの要求に使える応答が CDN キャッシュにあるか確認します。",
  data: [
    { label: "メソッド", value: "GET" },
    { label: "ホスト", value: site },
    { label: "パス", value: "/" },
  ],
};
const originRequest = {
  id: "origin-request", from: "edge", to: "origin", protocol: "HTTPS", layer: "アプリケーション", category: "http", duration: 12,
  title: "エッジがオリジンに処理を中継する",
  description: "この要求に使えるキャッシュがないため、エッジはオリジンへリクエストを送ります。この例では、ブラウザーとの接続とは別に、エッジとオリジン間の HTTPS 接続がすでにあります。",
  data: [
    { label: "CDN キャッシュ", value: "MISS" },
    { label: "接続先", value: `${originIp}:443` },
    { label: "リクエスト", value: "GET /" },
  ],
};
const originResponse = {
  id: "origin-response", from: "origin", to: "edge", protocol: "HTTPS", layer: "アプリケーション", category: "http", duration: 48,
  title: "オリジンがページを生成して返す",
  description: "オリジンが要求を処理し、ステータス、レスポンスヘッダー、HTML を返します。ここでの所要時間には、アプリケーションが応答を生成する時間も含みます。",
  data: [
    { label: "ステータス", value: "200 OK" },
    { label: "Content-Type", value: "text/html; charset=utf-8" },
    { label: "Cache-Control", value: "public, max-age=60" },
  ],
};
const browserResponse = {
  id: "http-response", from: "edge", to: "client", protocol: "HTTP/2", layer: "アプリケーション", category: "http", duration: 14,
  title: "ブラウザーが HTTPS の応答を受け取る",
  description: "エッジが応答を中継し、ブラウザーがページの HTML を受け取ります。CSS や画像の取得は、この後の別のリクエストです。",
  data: [{ label: "ステータス", value: "200 OK" }, { label: "本文", value: "HTML" }],
};

const quicHandshake = [
  {
    id: "quic-initial", from: "client", to: "edge", protocol: "QUIC・UDP", layer: "トランスポート・暗号化", category: "transport", duration: 8,
    title: "UDP 上で QUIC を開始する",
    description: "ブラウザーが UDP の 443 番ポートに QUIC Initial を送ります。QUIC は接続の確立に TLS 1.3 を組み込んでいるため、同時に TLS の ClientHello を運びます。",
    data: [
      { label: "宛先", value: `${edgeIp}:443 (UDP)` },
      { label: "QUIC パケット", value: "Initial" },
      { label: "TLS メッセージ", value: "ClientHello" },
    ],
  },
  {
    id: "quic-server-handshake", from: "edge", to: "client", protocol: "QUIC・TLS 1.3", layer: "トランスポート・暗号化", category: "tls", duration: 23,
    title: "QUIC と TLS の確立を進める",
    description: "エッジは QUIC パケット内で TLS の応答を返します。ブラウザーはエッジの証明書を確認し、HTTP/3 を使うことを確かめます。",
    data: [
      { label: "QUIC パケット", value: "Initial, Handshake" },
      { label: "TLS メッセージ", value: "ServerHello → Certificate → Finished（一部省略）" },
      { label: "ALPN の選択", value: "h3" },
    ],
  },
  {
    id: "quic-client-handshake", from: "client", to: "edge", protocol: "QUIC・TLS 1.3", layer: "トランスポート・暗号化", category: "tls", duration: 8,
    title: "ブラウザーが QUIC の鍵を確立する",
    description: "ブラウザーが TLS の Finished を QUIC 上で返します。このシナリオは初回接続なので、再接続で使われることのある 0-RTT は使いません。",
    data: [
      { label: "QUIC パケット", value: "Handshake" },
      { label: "TLS メッセージ", value: "Finished" },
    ],
  },
];

export const scenarios = [
  {
    id: "https", name: "HTTPS 初回アクセス",
    summary: "名前解決から TCP、TLS、HTTP/2 へ。エッジ経由でオリジンから HTML を受け取ります。",
    initialCondition: "ブラウザーからエッジへの接続は新規で、エッジに使えるキャッシュはありません。",
    outcome: "200 OK · オリジンが応答",
    steps: [
      dnsQuestion, dnsAnswer, ...tcpHandshake, ...tlsHandshake,
      httpRequest, originRequest, originResponse, browserResponse,
    ],
  },
  {
    id: "cache", name: "CDN キャッシュヒット",
    summary: "新しい HTTPS 接続を作り、エッジに保存済みのページを受け取ります。",
    initialCondition: "ブラウザーからエッジへの接続は新規で、CDN に利用可能な応答が保存されています。",
    outcome: "200 OK · CDN が直接応答",
    steps: [
      dnsQuestion, dnsAnswer, ...tcpHandshake, ...tlsHandshake, httpRequest,
      {
        id: "cache-hit", from: "edge", to: "client", protocol: "HTTP/2", layer: "アプリケーション", category: "cache", duration: 12,
        title: "CDN の保存済み応答が返る",
        description: "エッジは有効なキャッシュを使って応答します。ブラウザーへの HTML の配信がエッジで完結し、オリジンへの通信が省けます。",
        data: [
          { label: "ステータス", value: "200 OK" },
          { label: "CDN キャッシュ", value: "HIT" },
          { label: "Age の例", value: "24 秒" },
        ],
      },
    ],
  },
  {
    id: "http3", name: "HTTP/3",
    summary: "UDP 上の QUIC が TLS 1.3 を組み込み、暗号化された HTTP/3 の要求を運びます。",
    initialCondition: "HTTP/3 に対応していることは事前に判明しています。QUIC 接続は新規で、CDN キャッシュは使いません。",
    outcome: "200 OK · HTTP/3 で受信",
    steps: [
      dnsQuestion, dnsAnswer, ...quicHandshake,
      {
        ...httpRequest, protocol: "HTTP/3",
        description: "ブラウザーが暗号化された QUIC ストリームを使い、エッジにトップページを要求します。",
      },
      originRequest, originResponse,
      {
        ...browserResponse, protocol: "HTTP/3",
        description: "エッジが QUIC ストリームを通じて HTML を返します。エッジとオリジンの間で使うプロトコルは、ブラウザーとの HTTP/3 接続とは独立しています。",
      },
    ],
  },
  {
    id: "dns-error", name: "DNS 解決失敗",
    summary: "DNS が名前の不存在を返し、エッジへの接続を始める前にアクセスが止まります。",
    initialCondition: "指定した名前について、DNS リゾルバーから NXDOMAIN が返るケースです。",
    outcome: "NXDOMAIN · 名前解決で停止",
    steps: [
      dnsQuestion,
      {
        id: "dns-nxdomain", from: "dns", to: "client", protocol: "DNS", layer: "アプリケーション", category: "error", duration: 19,
        title: "ドメイン名が見つからない",
        description: "DNS リゾルバーが NXDOMAIN を返します。接続先のアドレスを得られなかったため、ブラウザーは接続や HTTP リクエストを始める前に処理を停止します。",
        data: [
          { label: "応答コード", value: "NXDOMAIN" },
          { label: "意味", value: "問い合わせた DNS 名が存在しない" },
          { label: "確認すること", value: "URL の綴り、DNS ゾーンとレコードの公開状態" },
        ],
      },
    ],
  },
];

export { getTimeline } from "../flow/timeline.js";
