// Captured with PostgreSQL 17.12 using test/fixtures/database-index-demo.sql.
export const indexSetup = {
  title: "PostgreSQL 17.12 の実行計画",
  description: "備品貸出の架空データ。200テナントに分かれる60,000件のうち、1,000件が貸出中です。",
  rows: 60000,
  source: "PostgreSQL 17.12 · EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY OFF)",
  notes: [
    "各比較では主キーのインデックスを残し、表示した追加インデックスだけを用意して計測しています。",
    "ブロック数は実行計画の最上位ノードにある shared hit と read です。hit は共有バッファにあった回数、read は共有バッファへ読み込んだ回数です。OS のキャッシュもあるため、そのまま物理ディスク I/O の回数にはなりません。",
    "下位ノードのブロック数は上位ノードに含まれます。表示の合計にはプランニング時のブロック数を含めません。",
    "実行計画はデータ分布、統計、設定、バージョンで変わります。cost はオプティマイザの見積もりで、ミリ秒の実測時間ではありません。",
  ],
};

export const indexQueries = [
  {
    id: "recent",
    title: "利用者の貸出履歴を直近5件表示する",
    goal: "テナントと利用者を一致で絞り、日付を範囲で絞ります。日付の降順から5件だけ返す場合に、インデックスのキー順が走査と並べ替えにどう効くかを見ます。",
    sql: `SELECT id, asset_id, borrowed_at
FROM loans
WHERE tenant_id = 42
  AND borrower_id = 7
  AND borrowed_at >= TIMESTAMPTZ '2026-03-01 00:00:00+00'
ORDER BY borrowed_at DESC
LIMIT 5;`,
    variants: [
      {
        id: "baseline",
        label: "追加インデックスなし",
        ddl: `-- 追加のインデックスなし。主キーは維持します。`,
        rows: 5,
        buffers: { hit: 563, read: 0 },
        nodes: ["Limit", "Sort", "Seq Scan on loans"],
        summary: "テーブルを順に読み、条件に合う13行から上位5件を並べ替えます。",
        tradeoff: "この検索用の更新コストは増えません。行数が増えると走査する範囲も増えます。",
        plan: `Limit  (cost=1610.22..1610.23 rows=5 width=20) (actual rows=5 loops=1)
  Buffers: shared hit=563
  ->  Sort  (cost=1610.22..1610.25 rows=13 width=20) (actual rows=5 loops=1)
        Sort Key: borrowed_at DESC
        Sort Method: top-N heapsort  Memory: 25kB
        Buffers: shared hit=563
        ->  Seq Scan on loans  (cost=0.00..1610.00 rows=13 width=20) (actual rows=13 loops=1)
              Filter: ((borrowed_at >= '2026-03-01 00:00:00+00'::timestamp with time zone) AND (tenant_id = 42) AND (borrower_id = 7))
              Rows Removed by Filter: 59987
              Buffers: shared hit=560
Planning:
  Buffers: shared hit=136`,
      },
      {
        id: "tenant",
        label: "テナント単列",
        ddl: `CREATE INDEX loans_tenant_idx ON loans (tenant_id);`,
        rows: 5,
        buffers: { hit: 303, read: 2 },
        nodes: ["Limit", "Sort", "Bitmap Heap Scan on loans", "Bitmap Index Scan on loans_tenant_idx"],
        summary: "テナント42の300行まで絞れます。利用者と日付の判定はテーブルを読んで行い、並べ替えも残ります。",
        tradeoff: "テナントだけを指定する別の検索で使える可能性があります。テナント内の件数や行が散らばる度合いも確認します。",
        plan: `Limit  (cost=497.47..497.48 rows=5 width=20) (actual rows=5 loops=1)
  Buffers: shared hit=303 read=2
  ->  Sort  (cost=497.47..497.50 rows=13 width=20) (actual rows=5 loops=1)
        Sort Key: borrowed_at DESC
        Sort Method: top-N heapsort  Memory: 25kB
        Buffers: shared hit=303 read=2
        ->  Bitmap Heap Scan on loans  (cost=6.54..497.25 rows=13 width=20) (actual rows=13 loops=1)
              Recheck Cond: (tenant_id = 42)
              Filter: ((borrowed_at >= '2026-03-01 00:00:00+00'::timestamp with time zone) AND (borrower_id = 7))
              Rows Removed by Filter: 287
              Heap Blocks: exact=300
              Buffers: shared hit=300 read=2
              ->  Bitmap Index Scan on loans_tenant_idx  (cost=0.00..6.54 rows=300 width=0) (actual rows=300 loops=1)
                    Index Cond: (tenant_id = 42)
                    Buffers: shared read=2
Planning:
  Buffers: shared hit=110 read=1`,
      },
      {
        id: "composite",
        label: "テナント・利用者・日付の複合",
        ddl: `CREATE INDEX loans_tenant_borrower_date_idx
    ON loans (tenant_id, borrower_id, borrowed_at DESC);`,
        rows: 5,
        buffers: { hit: 5, read: 3 },
        nodes: ["Limit", "Index Scan using loans_tenant_borrower_date_idx on loans"],
        summary: "先頭2列の一致で範囲を絞り、インデックス内の日付降順から先頭5件を取ります。この計画では独立した Sort が消えます。",
        tradeoff: "キー列が多い分、更新と保管の負担が増えます。利用者を指定せずにテナント全体の日付順を出す用途には同じ並び順が使いにくくなります。",
        plan: `Limit  (cost=0.41..22.07 rows=5 width=20) (actual rows=5 loops=1)
  Buffers: shared hit=5 read=3
  ->  Index Scan using loans_tenant_borrower_date_idx on loans  (cost=0.41..56.71 rows=13 width=20) (actual rows=5 loops=1)
        Index Cond: ((tenant_id = 42) AND (borrower_id = 7) AND (borrowed_at >= '2026-03-01 00:00:00+00'::timestamp with time zone))
        Buffers: shared hit=5 read=3
Planning:
  Buffers: shared hit=112 read=1`,
      },
    ],
  },
  {
    id: "period",
    title: "期間内の貸出件数をテナント別に集計する",
    goal: "60,000行のうち53,280行が条件に合う月またぎ集計です。期間が広いときに、日付インデックスの有無で実行計画が変わるかを見ます。",
    sql: `SELECT tenant_id, count(*) AS loan_count
FROM loans
WHERE borrowed_at >= TIMESTAMPTZ '2026-01-15 00:00:00+00'
GROUP BY tenant_id
ORDER BY tenant_id;`,
    variants: [
      {
        id: "baseline",
        label: "追加インデックスなし",
        ddl: `-- 追加のインデックスなし。主キーは維持します。`,
        rows: 200,
        buffers: { hit: 563, read: 0 },
        nodes: ["Sort", "HashAggregate", "Seq Scan on loans"],
        summary: "Sequential Scan で60,000行を読み、期間内の53,280行をテナントごとに集計します。200行は集計結果の件数です。",
        tradeoff: "読み取り対象が大半なら、テーブルを順に走査するのは合理的です。集計の頻度や許容時間に合わせ、バッチや集計済みデータも検討できます。",
        plan: `Sort  (cost=1586.04..1586.54 rows=200 width=12) (actual rows=200 loops=1)
  Sort Key: tenant_id
  Sort Method: quicksort  Memory: 31kB
  Buffers: shared hit=563
  ->  HashAggregate  (cost=1576.40..1578.40 rows=200 width=12) (actual rows=200 loops=1)
        Group Key: tenant_id
        Batches: 1  Memory Usage: 48kB
        Buffers: shared hit=560
        ->  Seq Scan on loans  (cost=0.00..1310.00 rows=53280 width=4) (actual rows=53280 loops=1)
              Filter: (borrowed_at >= '2026-01-15 00:00:00+00'::timestamp with time zone)
              Rows Removed by Filter: 6720
              Buffers: shared hit=560
Planning:
  Buffers: shared hit=117`,
      },
      {
        id: "date",
        label: "貸出日時の単列",
        ddl: `CREATE INDEX loans_borrowed_at_idx ON loans (borrowed_at);`,
        rows: 200,
        buffers: { hit: 563, read: 0 },
        nodes: ["Sort", "HashAggregate", "Seq Scan on loans"],
        summary: "日付インデックスを加えても、今回の実行計画は Sequential Scan を選びました。対象範囲が広く、集計にはテナント列も必要です。",
        tradeoff: "日付の範囲を狭めると選ばれる計画は変わり得ます。この集計だけを根拠に採用すると、インデックスの維持負担が増えます。",
        plan: `Sort  (cost=1586.04..1586.54 rows=200 width=12) (actual rows=200 loops=1)
  Sort Key: tenant_id
  Sort Method: quicksort  Memory: 31kB
  Buffers: shared hit=563
  ->  HashAggregate  (cost=1576.40..1578.40 rows=200 width=12) (actual rows=200 loops=1)
        Group Key: tenant_id
        Batches: 1  Memory Usage: 48kB
        Buffers: shared hit=560
        ->  Seq Scan on loans  (cost=0.00..1310.00 rows=53280 width=4) (actual rows=53280 loops=1)
              Filter: (borrowed_at >= '2026-01-15 00:00:00+00'::timestamp with time zone)
              Rows Removed by Filter: 6720
              Buffers: shared hit=560
Planning:
  Buffers: shared hit=97 read=1`,
      },
    ],
  },
  {
    id: "active",
    title: "テナントの貸出中の一覧を表示する",
    goal: "返却日時が NULL の行だけが貸出中です。検索を速める部分インデックスと、二重貸出を防ぐ部分ユニークインデックスを比べます。",
    sql: `SELECT id, asset_id, borrowed_at
FROM loans
WHERE tenant_id = 42
  AND returned_at IS NULL
ORDER BY borrowed_at DESC
LIMIT 3;`,
    variants: [
      {
        id: "baseline",
        label: "追加インデックスなし",
        ddl: `-- 追加のインデックスなし。主キーは維持します。`,
        rows: 3,
        buffers: { hit: 563, read: 0 },
        nodes: ["Limit", "Sort", "Seq Scan on loans"],
        summary: "貸出中の条件とテナントをテーブル上で確認します。該当する5行から最新の3件を並べ替えます。",
        tradeoff: "貸出中が少数でも全行を確認します。この検索と二重貸出防止は要件を別々に評価します。",
        plan: `Limit  (cost=1310.06..1310.07 rows=3 width=20) (actual rows=3 loops=1)
  Buffers: shared hit=563
  ->  Sort  (cost=1310.06..1310.07 rows=5 width=20) (actual rows=3 loops=1)
        Sort Key: borrowed_at DESC
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=563
        ->  Seq Scan on loans  (cost=0.00..1310.00 rows=5 width=20) (actual rows=5 loops=1)
              Filter: ((returned_at IS NULL) AND (tenant_id = 42))
              Rows Removed by Filter: 59995
              Buffers: shared hit=560
Planning:
  Buffers: shared hit=131`,
      },
      {
        id: "full",
        label: "貸出履歴全体の複合",
        ddl: `CREATE INDEX loans_tenant_date_idx
    ON loans (tenant_id, borrowed_at DESC);`,
        rows: 3,
        buffers: { hit: 300, read: 4 },
        nodes: ["Limit", "Sort", "Bitmap Heap Scan on loans", "Bitmap Index Scan on loans_tenant_date_idx"],
        summary: "テナント42の300行から返却済み295行を除外します。今回の Bitmap Heap Scan はインデックスの日付順を保たないため、Sort が残ります。",
        tradeoff: "全履歴のテナント別一覧でも使える可能性があります。返却済みの行も登録されるので、保存と更新の対象は全件です。",
        plan: `Limit  (cost=499.93..499.94 rows=3 width=20) (actual rows=3 loops=1)
  Buffers: shared hit=300 read=4
  ->  Sort  (cost=499.93..499.95 rows=5 width=20) (actual rows=3 loops=1)
        Sort Key: borrowed_at DESC
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=300 read=4
        ->  Bitmap Heap Scan on loans  (cost=10.67..499.88 rows=5 width=20) (actual rows=5 loops=1)
              Recheck Cond: (tenant_id = 42)
              Filter: (returned_at IS NULL)
              Rows Removed by Filter: 295
              Heap Blocks: exact=300
              Buffers: shared hit=300 read=4
              ->  Bitmap Index Scan on loans_tenant_date_idx  (cost=0.00..10.66 rows=300 width=0) (actual rows=300 loops=1)
                    Index Cond: (tenant_id = 42)
                    Buffers: shared read=4
Planning:
  Buffers: shared hit=105 read=1`,
      },
      {
        id: "partial",
        label: "貸出中だけの複合",
        ddl: `CREATE INDEX loans_active_tenant_date_idx
    ON loans (tenant_id, borrowed_at DESC)
    WHERE returned_at IS NULL;`,
        rows: 3,
        buffers: { hit: 3, read: 2 },
        nodes: ["Limit", "Index Scan using loans_active_tenant_date_idx on loans"],
        summary: "返却日時が NULL の行だけを持つインデックスを使い、テナントの日付降順から3件を取得します。この計画では Sort がありません。",
        tradeoff: "返却済みの履歴には使えません。貸出登録でインデックスに追加され、返却で対象から外れます。",
        plan: `Limit  (cost=0.28..14.73 rows=3 width=20) (actual rows=3 loops=1)
  Buffers: shared hit=3 read=2
  ->  Index Scan using loans_active_tenant_date_idx on loans  (cost=0.28..24.36 rows=5 width=20) (actual rows=3 loops=1)
        Index Cond: (tenant_id = 42)
        Buffers: shared hit=3 read=2
Planning:
  Buffers: shared hit=106 read=1`,
      },
      {
        id: "unique",
        label: "貸出中だけのユニーク",
        ddl: `CREATE UNIQUE INDEX loans_one_active_per_asset
    ON loans (tenant_id, asset_id)
    WHERE returned_at IS NULL;`,
        rows: 3,
        buffers: { hit: 8, read: 2 },
        nodes: ["Limit", "Sort", "Bitmap Heap Scan on loans", "Bitmap Index Scan on loans_one_active_per_asset"],
        summary: "テナント内の同じ備品に貸出中の行を2件作れないようにします。テナントで候補を絞れますが、日付のキーがないので Sort が残ります。",
        tradeoff: "二重貸出防止を優先したキーです。この制約を保ちながら一覧も高速化したい場合は、読取用インデックスを持つ費用を計測します。",
        plan: `Limit  (cost=23.02..23.02 rows=3 width=20) (actual rows=3 loops=1)
  Buffers: shared hit=8 read=2
  ->  Sort  (cost=23.02..23.03 rows=5 width=20) (actual rows=3 loops=1)
        Sort Key: borrowed_at DESC
        Sort Method: quicksort  Memory: 25kB
        Buffers: shared hit=8 read=2
        ->  Bitmap Heap Scan on loans  (cost=4.31..22.96 rows=5 width=20) (actual rows=5 loops=1)
              Recheck Cond: ((tenant_id = 42) AND (returned_at IS NULL))
              Heap Blocks: exact=5
              Buffers: shared hit=5 read=2
              ->  Bitmap Index Scan on loans_one_active_per_asset  (cost=0.00..4.31 rows=5 width=0) (actual rows=5 loops=1)
                    Index Cond: (tenant_id = 42)
                    Buffers: shared read=2
Planning:
  Buffers: shared hit=107 read=1`,
      },
    ],
  },
];
