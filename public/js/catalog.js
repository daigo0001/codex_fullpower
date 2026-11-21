// J2000 coordinates and visual magnitudes are curated from HYG v4.1 by David Nash
// (https://github.com/astronexus/HYG-Database) and OpenNGC by Mattia Verga
// (https://github.com/mattiaverga/OpenNGC). Both catalogs are CC BY-SA 4.0
// (https://creativecommons.org/licenses/by-sa/4.0/). The adapted data in this file
// use that same license. Star colors are approximated from stellar B–V indices.

const stars = [
  {
    id: "sirius", name: "シリウス", english: "Sirius", constellation: "おおいぬ座",
    ra: 6.752481, dec: -16.716116, magnitude: -1.44, color: "#dfebff",
    description: "夜空で最も明るい恒星。オリオン座の三つ星を東南へ延ばすと、青白い輝きが見つかります。",
  },
  {
    id: "alpheratz", name: "アルフェラッツ", english: "Alpheratz", constellation: "アンドロメダ座",
    ra: 0.139791, dec: 29.090432, magnitude: 2.07, color: "#a9c5ff",
    description: "秋の四辺形の北東の頂点。ここから東へ伸びる星の並びがアンドロメダ座です。",
  },
  {
    id: "caph", name: "カフ", english: "Caph", constellation: "カシオペヤ座",
    ra: 0.152887, dec: 59.14978, magnitude: 2.28, color: "#fff1d3",
    description: "カシオペヤ座のW字の西端。隣のシェダルと明るさがよく似ています。",
  },
  {
    id: "algenib", name: "アルゲニブ", english: "Algenib", constellation: "ペガスス座",
    ra: 0.220598, dec: 15.183596, magnitude: 2.83, color: "#a9c5ff",
    description: "秋の四辺形の南東の頂点。南へたどると、うお座の方向です。",
  },
  {
    id: "schedar", name: "シェダル", english: "Schedar", constellation: "カシオペヤ座",
    ra: 0.675116, dec: 56.537331, magnitude: 2.24, color: "#ffc08d",
    description: "W字を形づくる橙色の巨星。色の違いは双眼鏡で見比べると分かりやすくなります。",
  },
  {
    id: "diphda", name: "ディフダ", english: "Diphda", constellation: "くじら座",
    ra: 0.72649, dec: -17.986605, magnitude: 2.04, color: "#ffdcad",
    description: "くじら座の尾にある橙色の巨星。秋の南の空で見つけやすい2等星です。",
  },
  {
    id: "tsih", name: "ツィー", english: "Gamma Cassiopeiae", constellation: "カシオペヤ座",
    ra: 0.945143, dec: 60.71674, magnitude: 2.15, color: "#a9c5ff",
    description: "カシオペヤ座のW字の中央にある変光星。時期によって隣の星との明るさの関係が変わります。",
  },
  {
    id: "mirach", name: "ミラク", english: "Mirach", constellation: "アンドロメダ座",
    ra: 1.162194, dec: 35.620558, magnitude: 2.07, color: "#ffa67c",
    description: "橙色の巨星。北西に向かう星の並びをたどると、アンドロメダ銀河を探せます。",
  },
  {
    id: "ruchbah", name: "ルクバー", english: "Ruchbah", constellation: "カシオペヤ座",
    ra: 1.430216, dec: 60.235283, magnitude: 2.66, color: "#dfebff",
    description: "カシオペヤ座のW字の折れ目にある星。ペルセウス座の二重星団が近くにあります。",
  },
  {
    id: "segin", name: "セギン", english: "Segin", constellation: "カシオペヤ座",
    ra: 1.906584, dec: 63.670101, magnitude: 3.35, color: "#a9c5ff",
    description: "W字の東端にある青白い星。W字をつくる5つの星の中で最も暗く見えます。",
  },
  {
    id: "sheratan", name: "シェラタン", english: "Sheratan", constellation: "おひつじ座",
    ra: 1.910668, dec: 20.808035, magnitude: 2.64, color: "#dfebff",
    description: "ハマルの南西にある星。おひつじ座の短い弧を探す目印になります。",
  },
  {
    id: "almach", name: "アルマク", english: "Almach", constellation: "アンドロメダ座",
    ra: 2.064984, dec: 42.329725, magnitude: 2.1, color: "#ffc08d",
    description: "小型望遠鏡で橙色と青色の星に分かれる二重星。アンドロメダ座の星列の東端にあります。",
  },
  {
    id: "hamal", name: "ハマル", english: "Hamal", constellation: "おひつじ座",
    ra: 2.119555, dec: 23.462423, magnitude: 2.01, color: "#ffc08d",
    description: "おひつじ座で最も明るい星。秋の四辺形とすばるの間で、橙色の輝きを探せます。",
  },
  {
    id: "polaris", name: "ポラリス", english: "Polaris", constellation: "こぐま座",
    ra: 2.52975, dec: 89.264109, magnitude: 1.97, color: "#fff1d3",
    description: "現在の北極星。北斗七星のメラクからドゥーベに向かう線を約5倍延ばすと見つかります。",
  },
  {
    id: "menkar", name: "メンカル", english: "Menkar", constellation: "くじら座",
    ra: 3.037992, dec: 4.089734, magnitude: 2.54, color: "#ffa67c",
    description: "くじら座の頭にある赤い巨星。おうし座のアルデバランより南の空に見えます。",
  },
  {
    id: "algol", name: "アルゴル", english: "Algol", constellation: "ペルセウス座",
    ra: 3.136148, dec: 40.955648, magnitude: 2.09, color: "#a9c5ff",
    description: "伴星が手前を通るたびに暗くなる食変光星。約2.87日周期で明るさが変わります。",
  },
  {
    id: "mirfak", name: "ミルファク", english: "Mirfak", constellation: "ペルセウス座",
    ra: 3.405378, dec: 49.86118, magnitude: 1.79, color: "#fff1d3",
    description: "ペルセウス座で最も明るい星。双眼鏡では周囲に星の集まりが見えます。",
  },
  {
    id: "aldebaran", name: "アルデバラン", english: "Aldebaran", constellation: "おうし座",
    ra: 4.598677, dec: 16.509301, magnitude: 0.87, color: "#ffa67c",
    description: "おうしの目にあたる橙色の星。V字形のヒアデス星団に重なって見えます。",
  },
  {
    id: "rigel", name: "リゲル", english: "Rigel", constellation: "オリオン座",
    ra: 5.242298, dec: -8.20164, magnitude: 0.18, color: "#a9c5ff",
    description: "オリオンの足にある青白い超巨星。ベテルギウスとの色の違いを肉眼で見比べられます。",
  },
  {
    id: "capella", name: "カペラ", english: "Capella", constellation: "ぎょしゃ座",
    ra: 5.27815, dec: 45.997991, magnitude: 0.08, color: "#ffdcad",
    description: "冬の北寄りの空に見える黄白色の星。ぎょしゃ座の五角形の目印です。",
  },
  {
    id: "bellatrix", name: "ベラトリックス", english: "Bellatrix", constellation: "オリオン座",
    ra: 5.418851, dec: 6.349702, magnitude: 1.64, color: "#a9c5ff",
    description: "オリオンの肩にある青白い星。もう一方の肩に赤いベテルギウスが見えます。",
  },
  {
    id: "elnath", name: "エルナト", english: "Elnath", constellation: "おうし座",
    ra: 5.438198, dec: 28.60745, magnitude: 1.65, color: "#a9c5ff",
    description: "おうしの北側の角の先にある星。ぎょしゃ座の五角形を描く際の一角にも使われます。",
  },
  {
    id: "mintaka", name: "ミンタカ", english: "Mintaka", constellation: "オリオン座",
    ra: 5.533445, dec: -0.299092, magnitude: 2.25, color: "#a9c5ff",
    description: "オリオン座の三つ星の西端。天の赤道のすぐ南に位置します。",
  },
  {
    id: "alnilam", name: "アルニラム", english: "Alnilam", constellation: "オリオン座",
    ra: 5.603559, dec: -1.20192, magnitude: 1.69, color: "#a9c5ff",
    description: "オリオン座の三つ星の中央に輝く青白い超巨星。南に小三つ星が並びます。",
  },
  {
    id: "alnitak", name: "アルニタク", english: "Alnitak", constellation: "オリオン座",
    ra: 5.679313, dec: -1.942572, magnitude: 1.74, color: "#a9c5ff",
    description: "オリオン座の三つ星の東端。すぐ近くに馬頭星雲と燃える木星雲があります。",
  },
  {
    id: "saiph", name: "サイフ", english: "Saiph", constellation: "オリオン座",
    ra: 5.795941, dec: -9.669605, magnitude: 2.07, color: "#a9c5ff",
    description: "オリオンの南東の足にある星。三つ星をはさんでベラトリックスと向かい合います。",
  },
  {
    id: "betelgeuse", name: "ベテルギウス", english: "Betelgeuse", constellation: "オリオン座",
    ra: 5.919529, dec: 7.407063, magnitude: 0.45, color: "#ffa67c",
    description: "オリオンの肩に輝く赤色超巨星。シリウスとプロキオンを結ぶ冬の大三角の一角です。",
  },
  {
    id: "menkalinan", name: "メンカリナン", english: "Menkalinan", constellation: "ぎょしゃ座",
    ra: 5.992149, dec: 44.947433, magnitude: 1.9, color: "#dfebff",
    description: "カペラの東にある2等星。ぎょしゃ座の五角形を構成する星のひとつです。",
  },
  {
    id: "mirzam", name: "ミルザム", english: "Mirzam", constellation: "おおいぬ座",
    ra: 6.378329, dec: -17.955918, magnitude: 1.98, color: "#a9c5ff",
    description: "シリウスの西にある青白い星。シリウスより先に東の地平線から昇ります。",
  },
  {
    id: "canopus", name: "カノープス", english: "Canopus", constellation: "りゅうこつ座",
    ra: 6.399195, dec: -52.69566, magnitude: -0.62, color: "#dfebff",
    description: "シリウスに次いで夜空で明るい恒星。日本では南へ行くほど見やすく、見通しのよい南の地平線が目印です。",
  },
  {
    id: "adhara", name: "アダーラ", english: "Adhara", constellation: "おおいぬ座",
    ra: 6.977097, dec: -28.972084, magnitude: 1.5, color: "#a9c5ff",
    description: "シリウスから南へたどると見つかる青白い星。おおいぬの後ろ足にあたります。",
  },
  {
    id: "wezen", name: "ウェズン", english: "Wezen", constellation: "おおいぬ座",
    ra: 7.139857, dec: -26.3932, magnitude: 1.83, color: "#fff1d3",
    description: "おおいぬ座の南側にある黄白色の超巨星。アダーラの北東に見えます。",
  },
  {
    id: "castor", name: "カストル", english: "Castor", constellation: "ふたご座",
    ra: 7.576634, dec: 31.888276, magnitude: 1.58, color: "#dfebff",
    description: "ポルックスと並んで見える白い星。望遠鏡では二重星として観察できます。",
  },
  {
    id: "procyon", name: "プロキオン", english: "Procyon", constellation: "こいぬ座",
    ra: 7.655033, dec: 5.224993, magnitude: 0.4, color: "#fff1d3",
    description: "冬の大三角の東側にある黄白色の星。シリウスの北東に見えます。",
  },
  {
    id: "pollux", name: "ポルックス", english: "Pollux", constellation: "ふたご座",
    ra: 7.755277, dec: 28.026199, magnitude: 1.16, color: "#ffdcad",
    description: "ふたご座で最も明るい橙色の巨星。北西に並ぶ白いカストルと色を見比べられます。",
  },
  {
    id: "algenubi", name: "アルゲヌビ", english: "Algenubi", constellation: "しし座",
    ra: 9.764188, dec: 23.774255, magnitude: 2.97, color: "#ffdcad",
    description: "しし座の頭を描く弧の北西にある黄白色の巨星。レグルスから逆向きの疑問符をたどると見つかります。",
  },
  {
    id: "rasalas", name: "ラサラス", english: "Rasalas", constellation: "しし座",
    ra: 9.879398, dec: 26.006951, magnitude: 3.88, color: "#ffc08d",
    description: "ししの頭を形づくる橙色の巨星。頭の弧の内側を見比べると位置が分かります。",
  },
  {
    id: "regulus", name: "レグルス", english: "Regulus", constellation: "しし座",
    ra: 10.139532, dec: 11.967207, magnitude: 1.36, color: "#a9c5ff",
    description: "ししの胸元にある青白い星。逆向きの疑問符に見える「ししの大鎌」の柄の先です。",
  },
  {
    id: "adhafera", name: "アダフェラ", english: "Adhafera", constellation: "しし座",
    ra: 10.278171, dec: 23.417311, magnitude: 3.43, color: "#fff1d3",
    description: "アルギエバの北にある星。ししの頭を描く弧をたどると見つかります。",
  },
  {
    id: "algieba", name: "アルギエバ", english: "Algieba", constellation: "しし座",
    ra: 10.332873, dec: 19.841489, magnitude: 2.01, color: "#ffc08d",
    description: "ししの首元にある橙色の星。望遠鏡で暖色同士の二重星として観察できます。",
  },
  {
    id: "merak", name: "メラク", english: "Merak", constellation: "おおぐま座",
    ra: 11.030677, dec: 56.382427, magnitude: 2.34, color: "#dfebff",
    description: "北斗七星のひしゃくの底にある星。ドゥーベとともに北極星を探す目印です。",
  },
  {
    id: "dubhe", name: "ドゥーベ", english: "Dubhe", constellation: "おおぐま座",
    ra: 11.062155, dec: 61.751033, magnitude: 1.81, color: "#ffdcad",
    description: "北斗七星のひしゃくの外側にある橙色の星。メラクから延ばした直線の先に北極星があります。",
  },
  {
    id: "zosma", name: "ゾスマ", english: "Zosma", constellation: "しし座",
    ra: 11.235138, dec: 20.523717, magnitude: 2.56, color: "#dfebff",
    description: "ししの背にある白い星。デネボラと結ぶと春の夜空で胴体の形をたどれます。",
  },
  {
    id: "chertan", name: "シェルタン", english: "Chertan", constellation: "しし座",
    ra: 11.237335, dec: 15.42957, magnitude: 3.33, color: "#a9c5ff",
    description: "ししの後ろ足にあたる白い星。ゾスマとデネボラと小さな三角形をつくります。",
  },
  {
    id: "denebola", name: "デネボラ", english: "Denebola", constellation: "しし座",
    ra: 11.817663, dec: 14.57206, magnitude: 2.14, color: "#dfebff",
    description: "ししの尾にある白い星。アークトゥルス、スピカを結ぶ春の大三角の一角です。",
  },
  {
    id: "phecda", name: "フェクダ", english: "Phecda", constellation: "おおぐま座",
    ra: 11.897168, dec: 53.69476, magnitude: 2.41, color: "#dfebff",
    description: "北斗七星のひしゃくの底の星。メラクの東にあって、メグレズと底の側面を結びます。",
  },
  {
    id: "megrez", name: "メグレズ", english: "Megrez", constellation: "おおぐま座",
    ra: 12.257086, dec: 57.032617, magnitude: 3.32, color: "#dfebff",
    description: "北斗七星で最も暗い星。ひしゃくの口と柄がつながる場所にあります。",
  },
  {
    id: "alioth", name: "アリオト", english: "Alioth", constellation: "おおぐま座",
    ra: 12.900472, dec: 55.959821, magnitude: 1.76, color: "#a9c5ff",
    description: "北斗七星のひしゃくから数えて、柄の最初に見える星です。",
  },
  {
    id: "vindemiatrix", name: "ヴィンデミアトリックス", english: "Vindemiatrix", constellation: "おとめ座",
    ra: 13.036278, dec: 10.95915, magnitude: 2.85, color: "#ffdcad",
    description: "おとめ座の北側にある黄白色の巨星。近くのおとめ座銀河団を探す足がかりです。",
  },
  {
    id: "mizar", name: "ミザール", english: "Mizar", constellation: "おおぐま座",
    ra: 13.398747, dec: 54.925362, magnitude: 2.23, color: "#dfebff",
    description: "北斗七星の柄の曲がり角。近くのアルコルは肉眼や双眼鏡で見分けられます。",
  },
  {
    id: "spica", name: "スピカ", english: "Spica", constellation: "おとめ座",
    ra: 13.419883, dec: -11.161322, magnitude: 0.98, color: "#a9c5ff",
    description: "南の空に見える青白い星。北斗七星の柄からアークトゥルスを経由して「春の大曲線」を描くと見つかります。",
  },
  {
    id: "alkaid", name: "アルカイド", english: "Alkaid", constellation: "おおぐま座",
    ra: 13.792354, dec: 49.313265, magnitude: 1.85, color: "#a9c5ff",
    description: "北斗七星のひしゃくの柄の先端。子持ち銀河の位置を探すときの目印です。",
  },
  {
    id: "arcturus", name: "アークトゥルス", english: "Arcturus", constellation: "うしかい座",
    ra: 14.26103, dec: 19.18241, magnitude: -0.05, color: "#ffc08d",
    description: "橙色に輝く春の一等星。北斗七星の柄のカーブを南へ延ばすと見つけやすくなります。",
  },
  {
    id: "izar", name: "イザール", english: "Izar", constellation: "うしかい座",
    ra: 14.749784, dec: 27.074222, magnitude: 2.35, color: "#ffdcad",
    description: "アークトゥルスの北東にある星。望遠鏡で色の異なる二重星として観察できます。",
  },
  {
    id: "kochab", name: "コカブ", english: "Kochab", constellation: "こぐま座",
    ra: 14.845105, dec: 74.155505, magnitude: 2.07, color: "#ffa67c",
    description: "こぐま座のひしゃくの端にある橙色の巨星。北極星と明るさを見比べられます。",
  },
  {
    id: "pherkad", name: "フェルカド", english: "Pherkad", constellation: "こぐま座",
    ra: 15.345483, dec: 71.834016, magnitude: 3.0, color: "#dfebff",
    description: "コカブの隣にある白い星。こぐま座のひしゃくの外側を形づくります。",
  },
  {
    id: "dschubba", name: "ジュバ", english: "Dschubba", constellation: "さそり座",
    ra: 16.005557, dec: -22.62171, magnitude: 2.29, color: "#a9c5ff",
    description: "さそりの頭の中央にある青白い星。アンタレスから北西に向かうと見つかります。",
  },
  {
    id: "acrab", name: "アクラブ", english: "Acrab", constellation: "さそり座",
    ra: 16.09062, dec: -19.805453, magnitude: 2.56, color: "#a9c5ff",
    description: "さそり座の頭の北端にある星。望遠鏡で青白い二重星として観察できます。",
  },
  {
    id: "antares", name: "アンタレス", english: "Antares", constellation: "さそり座",
    ra: 16.490128, dec: -26.432002, magnitude: 1.06, color: "#ffa67c",
    description: "夏の南の空に見える赤色超巨星。さそりの心臓にあたり、火星に似た赤さで知られます。",
  },
  {
    id: "shaula", name: "シャウラ", english: "Shaula", constellation: "さそり座",
    ra: 17.560145, dec: -37.103821, magnitude: 1.62, color: "#a9c5ff",
    description: "さそりの毒針にあたる青白い星。夏の南の空で尾のカーブをたどると見つかります。",
  },
  {
    id: "rasalhague", name: "ラスアルハゲ", english: "Rasalhague", constellation: "へびつかい座",
    ra: 17.582241, dec: 12.560035, magnitude: 2.08, color: "#dfebff",
    description: "へびつかいの頭にある白い星。夏の大三角の西側に見えます。",
  },
  {
    id: "sargas", name: "サルガス", english: "Sargas", constellation: "さそり座",
    ra: 17.62198, dec: -42.997824, magnitude: 1.86, color: "#fff1d3",
    description: "さそり座の尾が深く曲がる位置にある黄白色の巨星。見通しのよい南の空で探します。",
  },
  {
    id: "alnasl", name: "アルナスル", english: "Alnasl", constellation: "いて座",
    ra: 18.096803, dec: -30.424091, magnitude: 2.98, color: "#ffdcad",
    description: "いて座の「ティーポット」の注ぎ口。ここから北に向かうと干潟星雲があります。",
  },
  {
    id: "kaus-media", name: "カウス・メディア", english: "Kaus Media", constellation: "いて座",
    ra: 18.3499, dec: -29.828103, magnitude: 2.72, color: "#ffc08d",
    description: "いて座の弓の中央にある橙色の巨星。ティーポットの注ぎ口と本体の境目に見えます。",
  },
  {
    id: "kaus-australis", name: "カウス・アウストラリス", english: "Kaus Australis", constellation: "いて座",
    ra: 18.402868, dec: -34.384616, magnitude: 1.79, color: "#a9c5ff",
    description: "いて座で最も明るい星。南に低い「ティーポット」の底の目印です。",
  },
  {
    id: "kaus-borealis", name: "カウス・ボレアリス", english: "Kaus Borealis", constellation: "いて座",
    ra: 18.466179, dec: -25.4217, magnitude: 2.82, color: "#ffdcad",
    description: "いて座の弓の北の先にある星。ティーポットのふたの頂点に見えます。",
  },
  {
    id: "vega", name: "ベガ", english: "Vega", constellation: "こと座",
    ra: 18.61564, dec: 38.783692, magnitude: 0.03, color: "#a9c5ff",
    description: "七夕の織姫星。夏の大三角の一角で、夏の日本では夜に天頂近くまで昇ります。",
  },
  {
    id: "sheliak", name: "シェリアク", english: "Sheliak", constellation: "こと座",
    ra: 18.834665, dec: 33.362667, magnitude: 3.52, color: "#dfebff",
    description: "明るさが変わる食連星。隣のスラファトとの間に環状星雲があります。",
  },
  {
    id: "nunki", name: "ヌンキ", english: "Nunki", constellation: "いて座",
    ra: 18.92109, dec: -26.296722, magnitude: 2.05, color: "#a9c5ff",
    description: "ティーポットの取っ手の上にある青白い星。隣のアスケラと対になります。",
  },
  {
    id: "sulafat", name: "スラファト", english: "Sulafat", constellation: "こと座",
    ra: 18.982395, dec: 32.689557, magnitude: 3.25, color: "#a9c5ff",
    description: "こと座の小さな平行四辺形の南東に位置する星。隣のシェリアクとの間が環状星雲の目印です。",
  },
  {
    id: "ascella", name: "アスケラ", english: "Ascella", constellation: "いて座",
    ra: 19.043532, dec: -29.880105, magnitude: 2.6, color: "#dfebff",
    description: "ティーポットの取っ手の下にある白い星。ヌンキと結ぶと星座の輪郭が分かります。",
  },
  {
    id: "albireo", name: "アルビレオ", english: "Albireo", constellation: "はくちょう座",
    ra: 19.512023, dec: 27.959681, magnitude: 3.05, color: "#ffdcad",
    description: "はくちょうのくちばしにある二重星。望遠鏡で橙色と青色の対を見分けられます。",
  },
  {
    id: "fawaris", name: "ファワリス", english: "Fawaris", constellation: "はくちょう座",
    ra: 19.749574, dec: 45.13081, magnitude: 2.86, color: "#a9c5ff",
    description: "はくちょうの北西の翼にある星。サドルをはさんでアルジャナーと翼の線をつくります。",
  },
  {
    id: "tarazed", name: "タラゼド", english: "Tarazed", constellation: "わし座",
    ra: 19.770994, dec: 10.613261, magnitude: 2.72, color: "#ffa67c",
    description: "アルタイルの北西に寄り添う橙色の巨星。夏の天の川の中に見えます。",
  },
  {
    id: "altair", name: "アルタイル", english: "Altair", constellation: "わし座",
    ra: 19.846388, dec: 8.868322, magnitude: 0.76, color: "#dfebff",
    description: "七夕の彦星。夏の大三角の南にあり、タラゼドとアルシャインの間に見えます。",
  },
  {
    id: "alshain", name: "アルシャイン", english: "Alshain", constellation: "わし座",
    ra: 19.921887, dec: 6.406763, magnitude: 3.71, color: "#ffdcad",
    description: "アルタイルの南東にある黄白色の星。タラゼド、アルタイルと短い直線をつくります。",
  },
  {
    id: "sadr", name: "サドル", english: "Sadr", constellation: "はくちょう座",
    ra: 20.370473, dec: 40.256679, magnitude: 2.23, color: "#fff1d3",
    description: "はくちょうの胸にある星。北十字の交点に見え、周囲には淡い散光星雲が広がります。",
  },
  {
    id: "deneb", name: "デネブ", english: "Deneb", constellation: "はくちょう座",
    ra: 20.690532, dec: 45.280338, magnitude: 1.25, color: "#dfebff",
    description: "はくちょうの尾にある白い超巨星。ベガ、アルタイルと夏の大三角をつくります。",
  },
  {
    id: "aljanah", name: "アルジャナー", english: "Aljanah", constellation: "はくちょう座",
    ra: 20.770178, dec: 33.970256, magnitude: 2.48, color: "#ffdcad",
    description: "はくちょうの南東の翼にある橙色の巨星。北十字の端に見えます。",
  },
  {
    id: "enif", name: "エニフ", english: "Enif", constellation: "ペガスス座",
    ra: 21.736433, dec: 9.875011, magnitude: 2.38, color: "#ffa67c",
    description: "ペガススの鼻先にある橙色の超巨星。秋の四辺形より西の空で見つかります。",
  },
  {
    id: "fomalhaut", name: "フォーマルハウト", english: "Fomalhaut", constellation: "みなみのうお座",
    ra: 22.960838, dec: -29.622236, magnitude: 1.17, color: "#dfebff",
    description: "秋の南の空にぽつんと輝く一等星。南の地平線まで見通せると観察しやすくなります。",
  },
  {
    id: "scheat", name: "シェアト", english: "Scheat", constellation: "ペガスス座",
    ra: 23.062901, dec: 28.082789, magnitude: 2.44, color: "#ffa67c",
    description: "秋の四辺形の北西を占める赤い巨星。四辺形の他の星と色を見比べられます。",
  },
  {
    id: "markab", name: "マルカブ", english: "Markab", constellation: "ペガスス座",
    ra: 23.079348, dec: 15.205264, magnitude: 2.49, color: "#a9c5ff",
    description: "秋の四辺形の南西の頂点にある青白い星です。",
  },
];

const deepSky = [
  {
    id: "m31", name: "アンドロメダ銀河", english: "Andromeda Galaxy", constellation: "アンドロメダ座",
    ra: 0.712319, dec: 41.269056, magnitude: 3.44,
    description: "暗い空では肉眼にも淡い光が見える銀河。双眼鏡では細長い形と明るい中心部を探せます。",
  },
  {
    id: "m33", name: "さんかく座銀河", english: "Triangulum Galaxy", constellation: "さんかく座",
    ra: 1.564136, dec: 30.660222, magnitude: 5.79,
    description: "広がりのある淡い渦巻銀河。空が暗く澄んだ夜に、広視野の双眼鏡で探してみましょう。",
  },
  {
    id: "ngc869", name: "ペルセウス座二重星団 h", english: "h Persei Cluster", constellation: "ペルセウス座",
    ra: 2.316267, dec: 57.11725, magnitude: 3.7,
    description: "カシオペヤ座とペルセウス座の間に並ぶ二重星団の西側。双眼鏡で東側の星団も一緒に見えます。",
  },
  {
    id: "ngc884", name: "ペルセウス座二重星団 χ", english: "Chi Persei Cluster", constellation: "ペルセウス座",
    ra: 2.375583, dec: 57.144111, magnitude: 3.8,
    description: "二重星団の東側。双眼鏡や低倍率の望遠鏡で、二つの星団の間や恒星の色を見比べられます。",
  },
  {
    id: "m45", name: "すばる", english: "Pleiades", constellation: "おうし座",
    ra: 3.791278, dec: 24.105278, magnitude: 1.2,
    description: "青白い星が集まるプレアデス星団。双眼鏡なら肉眼より多くの星が見えます。",
  },
  {
    id: "m42", name: "オリオン大星雲", english: "Orion Nebula", constellation: "オリオン座",
    ra: 5.587911, dec: -5.389667, magnitude: 4.0,
    description: "三つ星の南、小三つ星の中央に広がる星雲。望遠鏡では明るい中心部と翼のような淡い広がりが見えます。",
  },
  {
    id: "m44", name: "プレセペ星団", english: "Beehive Cluster", constellation: "かに座",
    ra: 8.672833, dec: 19.672056, magnitude: 3.1,
    description: "ふたご座としし座の間にある散開星団。肉眼では淡い光のかたまりに見え、双眼鏡で星々を見分けられます。",
  },
  {
    id: "m81", name: "ボーデの銀河", english: "Bode's Galaxy", constellation: "おおぐま座",
    ra: 9.925881, dec: 69.065306, magnitude: 6.92,
    description: "北斗七星のドゥーベの北西にある渦巻銀河。低倍率なら近くのM82も同じ視野に入ります。",
  },
  {
    id: "m82", name: "葉巻銀河", english: "Cigar Galaxy", constellation: "おおぐま座",
    ra: 9.931314, dec: 69.679389, magnitude: 8.3,
    description: "M81の北にある細長い銀河。暗い空で望遠鏡を低倍率にすると、同じ視野で二つの銀河の形を見比べられます。",
  },
  {
    id: "m51", name: "子持ち銀河", english: "Whirlpool Galaxy", constellation: "りょうけん座",
    ra: 13.497975, dec: 47.195167, magnitude: 8.36,
    description: "渦巻銀河と伴銀河の組み合わせ。北斗七星の柄の先にあるアルカイドが位置の目印です。",
  },
  {
    id: "m3", name: "球状星団 M3", english: "Messier 3", constellation: "りょうけん座",
    ra: 13.703119, dec: 28.375444, magnitude: 6.39,
    description: "小さな望遠鏡では丸く淡い光に見える球状星団。アークトゥルスとコル・カロリの間にあります。",
  },
  {
    id: "m13", name: "ヘルクレス座球状星団", english: "Hercules Globular Cluster", constellation: "ヘルクレス座",
    ra: 16.694897, dec: 36.461306, magnitude: 5.8,
    description: "ヘルクレス座の胴体にある球状星団。望遠鏡では周辺の星々を見分けられます。",
  },
  {
    id: "m8", name: "干潟星雲", english: "Lagoon Nebula", constellation: "いて座",
    ra: 18.061464, dec: -24.380167, magnitude: 5.8,
    description: "夏の天の川に広がる星雲。いて座のティーポットの注ぎ口を手がかりに、双眼鏡で明るい部分を探せます。",
  },
  {
    id: "m17", name: "オメガ星雲", english: "Omega Nebula", constellation: "いて座",
    ra: 18.346419, dec: -16.171528, magnitude: 7.0,
    description: "天の川にある散光星雲。暗い空で望遠鏡を向けると、白鳥のように曲がった明るい部分が見えます。",
  },
  {
    id: "m11", name: "野鴨星団", english: "Wild Duck Cluster", constellation: "たて座",
    ra: 18.851664, dec: -6.270028, magnitude: 5.8,
    description: "星が密集した散開星団。小型望遠鏡で奥行きを感じる星々の並びを観察できます。",
  },
  {
    id: "m57", name: "環状星雲", english: "Ring Nebula", constellation: "こと座",
    ra: 18.893058, dec: 33.028583, magnitude: 8.8,
    description: "シェリアクとスラファトの間にある惑星状星雲。望遠鏡で倍率を上げると輪の形が分かります。",
  },
  {
    id: "m27", name: "亜鈴状星雲", english: "Dumbbell Nebula", constellation: "こぎつね座",
    ra: 19.993439, dec: 22.721028, magnitude: 7.4,
    description: "夏の大三角の内側にある惑星状星雲。望遠鏡では両端がふくらんだ形に見えます。",
  },
];

const moving = [
  {
    id: "moon", name: "月", english: "Moon", type: "moon", color: "#f3e7ce",
    description: "地球の唯一の自然衛星。満月の前後より、光と影の境目が見える時期のほうがクレーターの起伏が分かります。",
  },
  {
    id: "mercury", name: "水星", english: "Mercury", type: "planet", color: "#dfc8b3",
    description: "太陽に最も近い惑星。太陽から離れて見える時期に、日の入り後の西や日の出前の東の低い空で探せます。",
  },
  {
    id: "venus", name: "金星", english: "Venus", type: "planet", color: "#fff0c9",
    description: "明け方に「明けの明星」、夕方に「宵の明星」として輝く惑星。小型望遠鏡でも月のような満ち欠けを確認できます。",
  },
  {
    id: "mars", name: "火星", english: "Mars", type: "planet", color: "#ff9a72",
    description: "赤みのある橙色が特徴の惑星。地球に近づく時期は明るくなり、望遠鏡で表面模様を観察しやすくなります。",
  },
  {
    id: "jupiter", name: "木星", english: "Jupiter", type: "planet", color: "#ecc7a3",
    description: "太陽系で最も大きな惑星。双眼鏡ではガリレオ衛星が点の列に見え、小型望遠鏡では木星の縞模様も探せます。",
  },
  {
    id: "saturn", name: "土星", english: "Saturn", type: "planet", color: "#f1dbac",
    description: "氷などの粒でできた環が特徴の惑星。小型望遠鏡で、本体から張り出す環の形が分かります。",
  },
  {
    id: "uranus", name: "天王星", english: "Uranus", type: "planet", color: "#a6e1e3",
    description: "青緑色の巨大惑星。肉眼では見つけにくいため、星図で周囲の星と位置を照合しながら双眼鏡や望遠鏡で探します。",
  },
];

export const objects = [
  ...stars.map((star) => ({ ...star, type: "star" })),
  ...deepSky.map((object) => ({ ...object, type: "deep-sky" })),
  ...moving.map((object) => ({ ...object, constellation: "—", magnitude: null })),
];

export const constellationLinks = [
  // カシオペヤ座のW字
  ["caph", "schedar"], ["schedar", "tsih"], ["tsih", "ruchbah"], ["ruchbah", "segin"],
  // ペガススの四辺形とアンドロメダ座の星列
  ["alpheratz", "scheat"], ["scheat", "markab"], ["markab", "algenib"], ["algenib", "alpheratz"],
  ["alpheratz", "mirach"], ["mirach", "almach"], ["markab", "enif"],
  // オリオン座と冬の大三角
  ["betelgeuse", "bellatrix"], ["bellatrix", "mintaka"], ["mintaka", "rigel"],
  ["rigel", "saiph"], ["saiph", "alnitak"], ["alnitak", "betelgeuse"],
  ["mintaka", "alnilam"], ["alnilam", "alnitak"],
  ["betelgeuse", "sirius"], ["sirius", "procyon"], ["procyon", "betelgeuse"],
  ["sirius", "mirzam"], ["sirius", "wezen"], ["wezen", "adhara"],
  ["castor", "pollux"],
  // 北斗七星
  ["dubhe", "merak"], ["merak", "phecda"], ["phecda", "megrez"], ["megrez", "dubhe"],
  ["megrez", "alioth"], ["alioth", "mizar"], ["mizar", "alkaid"],
  // ししの大鎌としし座の胴
  ["regulus", "algieba"], ["algieba", "adhafera"], ["adhafera", "rasalas"],
  ["rasalas", "algenubi"], ["algieba", "zosma"], ["zosma", "denebola"],
  ["denebola", "chertan"], ["chertan", "regulus"], ["chertan", "zosma"],
  // 夏の大三角と北十字
  ["vega", "deneb"], ["deneb", "altair"], ["altair", "vega"],
  ["deneb", "sadr"], ["sadr", "albireo"], ["sadr", "fawaris"], ["sadr", "aljanah"],
  ["tarazed", "altair"], ["altair", "alshain"], ["sheliak", "sulafat"],
  // いて座のティーポット
  ["alnasl", "kaus-media"], ["kaus-media", "kaus-australis"], ["kaus-australis", "alnasl"],
  ["kaus-media", "kaus-borealis"], ["kaus-borealis", "nunki"], ["nunki", "ascella"],
  ["ascella", "kaus-australis"],
];
