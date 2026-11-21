# YOSORA / 夜空

観測する場所と時刻を選んで、その夜に見える星や惑星を探す天体観測プランナーです。気になる天体の高度と観測しやすい時間帯を確認し、観測リストや日誌に記録できます。

## Docker で起動

Docker と Docker Compose が使える環境で、リポジトリのルートから実行します。

```sh
docker compose up --build
```

ブラウザーで [localhost:8080](http://localhost:8080) を開きます。終了するときは `Ctrl+C` を押して `docker compose down` を実行します。8080 番ポートをほかで使用している場合は、`YOSORA_PORT=8081 docker compose up --build` で公開ポートを変更できます。

## 夜空の使い方

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
- 背景の風景画像は生成画像です。
