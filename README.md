# Codex Lab

ポータルから、3つのブラウザーアプリを開けます。

- **Flow Atlas** (`/network/`) は、DNS から HTTP 応答までの通信経路と順序を可視化します。
- **Header Guard** (`/security/`) は、HTTP レスポンスヘッダーの防御設定を点検します。
- **YOSORA / 夜空** (`/yosora/`) は、観測地と日時から星空を描き、天体の観測計画と記録を作れます。

## Docker で起動

Docker と Docker Compose が使える環境で、リポジトリのルートから実行します。

```sh
docker compose up --build
```

ブラウザーで [localhost:8080](http://localhost:8080) を開きます。終了するときは `Ctrl+C` を押して `docker compose down` を実行します。8080 番ポートをほかで使用している場合は、`YOSORA_PORT=8081 docker compose up --build` で公開ポートを変更できます。

## GitHub Pages で公開

1. リポジトリの **Settings → Pages** で、**Build and deployment → Source** を **GitHub Actions** に設定します。
2. **Actions → Deploy Codex Lab to GitHub Pages → Run workflow** から、`main` を選んで実行します。以降は `public/` の変更を `main` に push すると自動更新されます。

公開先の URL は **Settings → Pages** で確認できます。このリポジトリの標準 URL は `https://daigo0001.github.io/codex_fullpower/` です。Docker 版と GitHub Pages 版では、お気に入りと観測ノートの保存領域が別になります。

## Flow Atlas の使い方

1. HTTPS 初回アクセス、CDN キャッシュヒット、HTTP/3、DNS 解決失敗からシナリオを選びます。
2. 再生ボタン、スライダー、または「リクエストの流れ」の各行で移動します。経路図は通信の向きを示し、詳細欄ではプロトコルと送受信するデータの例を確認できます。
3. 「ステップを共有」で、選んだシナリオとステップを直接開けるリンクをコピーできます。

たとえば初回アクセスと CDN キャッシュヒットを比べると、キャッシュがある場合は CDN エッジから応答が返り、オリジンへの通信が省けます。図のアドレス、通信内容、所要時間は説明用の例です。アプリはリクエストの送信やパケットの取得を行いません。

## Header Guard の使い方

1. 自分のサイトを開き、ブラウザーの開発者ツールの **Network** タブで確認したいレスポンスのヘッダーをコピーします。画面のサンプルでも試せます。
2. Header Guard に貼り付けて点検します。CSP、HSTS、フレーム埋め込み制御、Cookie の属性などを確認し、確認結果や見直し箇所を Markdown で保存できます。

入力は端末のブラウザー内で処理します。レポートにはヘッダーの元の値や Cookie の値を含めません。判定はコピーしたレスポンスを対象にした設定の目安です。サイト全体の脆弱性評価や TLS 設定の検査は対象外です。

## YOSORA の使い方

1. 観測地と日時を指定します。星図は中心が天頂、外周が地平線で、上が北、左が東です。
2. 星図や天体一覧で天体を選ぶと、高度や方位、時間による高度の変化を確認できます。
3. 気になる天体を「お気に入り」に保存し、観測した内容を「観測ノート」に残せます。

東京で 2026 年 11 月 21 日の 21:00 を選ぶと、アンドロメダ銀河が高度約 81° にあります。天体を選んで再生ボタンを押すと、星図と高度グラフで夜間の動きを追えます。

観測リストと日誌はブラウザーのローカルストレージに保存されます。ブラウザーや公開ポートを変えると、別の保存領域が使われます。

観測しやすい時間帯は、天体の高度が 20° 以上で、太陽の高度が −12° 以下の区間です。天体の位置と時刻は目安です。大気差や恒星の固有運動は計算に含まれません。実際の見え方は、天気、光害、月明かり、その場所の地形や建物にも左右されます。

## 開発とテスト

Node.js 24 以上があれば、Docker を使わずに起動できます。追加の npm パッケージは不要です。

```sh
npm test
npm start
```

サーバーの稼働確認には `curl --fail http://localhost:8080/healthz` を使えます。

## データと画像

- 恒星の座標、等級、色の区分は David Nash（AstroNexus）の [HYG Database v4.1](https://github.com/astronexus/HYG-Database) に基づきます。星図とカタログ用に恒星を選別し、座標の桁数や色を表示用に変換しました。
- 星雲や星団などの座標と等級は Mattia Verga の [OpenNGC](https://github.com/mattiaverga/OpenNGC)（M45 を含む補遺も使用）から選んだものです。
- `public/js/faint-stars.js` と `public/js/catalog.js` の上記データベース由来のデータは [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) で提供します。
- 惑星の位置は、1800 年から 2050 年までの [NASA/JPL の近似軌道要素](https://ssd.jpl.nasa.gov/planets/approx_pos.html) を使って計算します。月の位置には Jean Meeus『Astronomical Algorithms』第 47 章の主要な周期項を使い、観測地点からの視差を補正します。
- アプリカードと YOSORA の背景画像は生成画像です。
