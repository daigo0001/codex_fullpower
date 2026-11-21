export { getTimeline } from "../flow/timeline.js";

export const actors = [
  { id: "client", name: "ブラウザー", laneLabel: "ブラウザー", detail: "HTTP リクエストを送り、ステータス、ヘッダー、本文を受け取ります。", icon: "browser" },
  { id: "middleware", name: "ミドルウェア", laneLabel: "MW", detail: "HTTP パイプラインで、後続処理を呼ぶ前後に処理を加えます。", icon: "middleware" },
  { id: "routing", name: "ルーティング", laneLabel: "ルート", detail: "HTTP メソッドとパスを照合し、エンドポイントとルート値を選びます。", icon: "routing" },
  { id: "mvc", name: "MVC パイプライン", laneLabel: "MVC", detail: "選ばれたアクションのフィルター、モデルバインディング、結果実行を管理します。", icon: "mvc" },
  { id: "controller", name: "コントローラー", laneLabel: "Action", detail: "アクションで処理を行い、ビューなどの結果を MVC に返します。", icon: "controller" },
  { id: "view", name: "Razor ビュー", laneLabel: "View", detail: "モデルと .cshtml テンプレートを使い、レスポンスの HTML を生成します。", icon: "view" },
];

const stageLabels = {
  middleware: "HTTP パイプライン",
  routing: "エンドポイントルーティング",
  filter: "MVC フィルターパイプライン",
  binding: "MVC の入力処理",
  action: "コントローラー",
  result: "MVC の結果実行",
  error: "例外処理",
};

function step(id, from, to, category, protocol, title, description, details, { phase = "forward", duration = 1 } = {}) {
  return {
    id, from, to, category, protocol, layer: stageLabels[category], title, description, phase, duration,
    data: Object.entries(details).map(([label, value]) => ({ label, value })),
  };
}

const request = (method, path, data) => step(
  "request", "client", "middleware", "middleware", "HTTP",
  "ブラウザーがリクエストを送る",
  "ASP.NET Core がリクエストを HttpContext にまとめ、設定されたミドルウェアを先頭から実行します。",
  { リクエスト: `${method} ${path}`, ...data },
);

const middlewareIn = step(
  "middleware-in", "middleware", "middleware", "middleware", "Middleware",
  "ミドルウェアが後続処理を包む",
  "この例ではログ記録が外側にあり、後続処理を await next(context) で待ちます。その内側に UseExceptionHandler があり、ルーティングや MVC から伝わる未処理例外を受け止められます。",
  { 実行順: "ログ記録 → UseExceptionHandler → UseRouting → UseAuthentication → UseAuthorization → エンドポイント実行", コード例: "await next(context);" },
);

const match = (method, template, action, parameters = "なし", metadata = "アクセス制限なし") => [
  step(
    "route-match", "middleware", "routing", "routing", "Routing",
    "メソッドとパスを照合する",
    "UseRouting がリクエストを候補と照合し、MVC アクションに対応するエンドポイントを選びます。ここではまだアクションを実行しません。",
    { ルート: `${method} ${template}`, 候補: action },
  ),
  step(
    "route-values", "routing", "middleware", "routing", "Routing",
    "エンドポイント情報を記録する",
    "選んだエンドポイントとルート値を HttpContext に記録します。後続の認可ミドルウェアは、エンドポイントのメタデータを参照できます。",
    { エンドポイント: action, ルート値: parameters, メタデータ: metadata },
  ),
];

const authenticate = step(
  "authenticate", "middleware", "middleware", "middleware", "Authentication",
  "認証がユーザーを確認する",
  "UseAuthentication が Cookie を確認します。有効な Cookie があれば HttpContext.User に認証済みのユーザーが設定されます。この例のリクエストには Cookie がなく、ユーザーは未認証です。",
  { スキーム: "Cookie", ユーザー: "未認証" },
);

const authorize = step(
  "authorize", "middleware", "middleware", "middleware", "Authorization",
  "認可がアクセス条件を確認する",
  "UseAuthorization が選ばれたエンドポイントの認可メタデータを確認します。このエンドポイントにはアクセス制限がなく、MVC の実行へ進みます。",
  { エンドポイント: "アクセス制限なし", 結果: "後続へ進む" },
);

const mvcStart = step(
  "mvc-start", "middleware", "mvc", "middleware", "Endpoint",
  "選んだ MVC エンドポイントを実行する",
  "エンドポイントの実行が始まり、ここから MVC 固有のフィルターパイプラインに入ります。ミドルウェアは、この処理が終わるまで待ちます。",
  { 対象: "選択済みの MVC アクション", 開始: "MVC フィルターパイプライン" },
);

const csrfGet = step(
  "csrf-safe-method", "mvc", "mvc", "filter", "Authorization filter",
  "認可フィルターの段階に入る",
  "認可ミドルウェアを通過したあと、MVC の中で最初に実行される種類のフィルターです。この例ではグローバルに登録した AutoValidateAntiforgeryToken が、読み取り用の GET ではトークン検証を省略します。",
  { フィルター: "AutoValidateAntiforgeryToken", リクエスト: "GET · トークン検証を省略" },
);

const csrfPost = step(
  "csrf-validate", "mvc", "mvc", "filter", "Authorization filter",
  "フォームの偽造防止トークンを検証する",
  "POST では AutoValidateAntiforgeryToken が Cookie とフォームのトークンを検証します。この例では両方が有効なので続行します。この確認は、モデルバインディングより先に行われます。",
  { フィルター: "AutoValidateAntiforgeryToken", 検証: "フォームトークンと Cookie が有効" },
);

const resourceIn = step(
  "resource-in", "mvc", "mvc", "filter", "Resource filter",
  "リソースフィルターが実行を包む",
  "OnResourceExecuting はモデルバインディングより先に呼ばれます。この例では開始を記録して続行します。ここで結果を指定するフィルターなら、アクションの実行前に処理を終了できます。",
  { コールバック: "IResourceFilter.OnResourceExecuting", 結果: "モデルバインディングへ進む" },
);

const bindId = step(
  "bind-id", "mvc", "mvc", "binding", "Model binding",
  "URL の値をアクション引数に変換する",
  "モデルバインダーがルート値 id=42 を読み取り、アクションの int パラメーターに変換します。モデルの検証もアクションフィルターより先に行われます。",
  { 入力: 'ルート値 id = "42"', 引数: "[FromRoute] int id", 判定: "ModelState.IsValid = true" },
);

const actionIn = step(
  "action-in", "mvc", "mvc", "filter", "Action filter",
  "アクション実行前のフィルターが動く",
  "OnActionExecuting にはバインディング済みの引数が渡ります。この例のフィルターは開始を記録し、アクションを実行させます。",
  { コールバック: "IActionFilter.OnActionExecuting", 参照できる値: "ActionExecutingContext.ActionArguments" },
);

const callAction = (action, description, data) => step(
  "run-action", "mvc", "controller", "action", "Action",
  "コントローラーのアクションを実行する",
  description, { アクション: action, ...data },
);

const returnView = (view, model, description) => step(
  "action-result", "controller", "mvc", "action", "ViewResult",
  "アクションが ViewResult を返す",
  description,
  { 戻り値: `View("${view}", ${model})`, 結果の型: "ViewResult" },
  { phase: "unwind" },
);

const actionOut = step(
  "action-out", "mvc", "mvc", "filter", "Action filter",
  "アクション実行後のフィルターが動く",
  "OnActionExecuted でアクションが返した結果を確認できます。この時点で ViewResult はまだ実行されていません。",
  { コールバック: "IActionFilter.OnActionExecuted", 結果: "ActionExecutedContext.Result" },
  { phase: "unwind" },
);

const resultIn = step(
  "result-in", "mvc", "mvc", "filter", "Result filter",
  "結果実行前のフィルターが動く",
  "OnResultExecuting は ViewResult の実行直前に呼ばれます。レスポンス開始後はヘッダーを変更できないため、この例では開始前の段階で設定します。",
  { コールバック: "IResultFilter.OnResultExecuting", ヘッダーの例: "Cache-Control: no-store" },
);

const renderView = (view, description) => step(
  "render-view", "mvc", "view", "result", "Razor",
  "ViewResult を実行して Razor の描画を始める",
  description,
  { テンプレート: `Views/Products/${view}.cshtml`, レスポンスタイプ: "text/html; charset=utf-8" },
  { duration: 7 },
);

const viewOut = step(
  "view-out", "view", "mvc", "result", "ViewResult",
  "HTML の書き込みが終わる",
  "結果実行が完了し、実行制御が MVC に戻ります。レスポンスへの書き込みは ViewResult の実行中に行われるため、外側のミドルウェアの後処理より先に送信が始まる場合があります。",
  { 本文: "Razor が生成した HTML", 状態: "結果実行が完了" },
  { phase: "unwind" },
);

const resultOut = step(
  "result-out", "mvc", "mvc", "filter", "Result filter",
  "結果実行後のフィルターが動く",
  "OnResultExecuted が実行結果を確認します。レスポンスの送信が始まっている場合は、ステータスやヘッダーを変更できません。",
  { コールバック: "IResultFilter.OnResultExecuted", 確認: "HttpResponse.HasStarted" },
  { phase: "unwind" },
);

const resourceOut = step(
  "resource-out", "mvc", "mvc", "filter", "Resource filter",
  "リソースフィルターに戻る",
  "OnResourceExecuted が MVC 内の内側の処理を終えたあとに呼ばれます。モデルバインディングから結果実行までを、このフィルターが外側で包んでいます。",
  { コールバック: "IResourceFilter.OnResourceExecuted", 処理例: "MVC 内の経過時間を記録" },
  { phase: "unwind" },
);

const mvcOut = step(
  "mvc-out", "mvc", "middleware", "middleware", "Endpoint",
  "MVC からミドルウェアへ戻る",
  "エンドポイントの実行が終わり、呼び出しはミドルウェアへ戻ります。新しいリクエストが逆向きに送られるのではなく、待っていた処理が順に再開します。",
  { 状態: "エンドポイント実行完了", 処理: "外側のミドルウェアへ戻る" },
  { phase: "unwind" },
);

const middlewareOut = (status) => step(
  "middleware-out", "middleware", "middleware", "middleware", "Middleware",
  "外側のミドルウェアの後処理が動く",
  "外側のミドルウェアでは await next(context) の後ろに実行制御が戻ります。この例ではログに最終ステータスを記録します。レスポンス開始後はヘッダーを変更できません。",
  { ログの例: `HTTP ${status}`, 確認: "送信済みヘッダーは変更不可" },
  { phase: "unwind" },
);

const response = (status, description, data) => step(
  "response", "middleware", "client", "middleware", "HTTP",
  "ブラウザーがレスポンスを受け取る",
  description, { ステータス: status, ...data },
  { phase: "unwind" },
);

const getDetails = "ProductsController.Details";
const editProduct = "ProductsController.Edit";
const detailPath = "/products/42";
const detailTemplate = "/products/{id:int}";
const detailView = renderView("Details", "MVC がビューを選び、商品モデルを Razor テンプレートに渡します。ViewResult の実行によって HTML がレスポンスへ書き込まれます。");
const loginLocation = "https://shop.example.test/account/login?ReturnUrl=%2Faccount";

function startMvc(method, path, template, action, data) {
  return [
    request(method, path, data), middlewareIn, ...match(method, template, action, "id = 42"),
    authenticate, authorize, mvcStart, method === "POST" ? csrfPost : csrfGet, resourceIn,
  ];
}

function finishMvc(status, description, data) {
  return [resourceOut, mvcOut, middlewareOut(status), response(status, description, data)];
}

export const scenarios = [
  {
    id: "get",
    name: "GET と Razor ビュー",
    summary: "ルートが選ばれ、フィルターがアクションと結果実行を包む流れを確認します。",
    initialCondition: "ASP.NET Core MVC の例。インラインのログ／例外ハンドラー、Cookie 認証、グローバルな偽造防止フィルターと記録用フィルターを構成しています。",
    outcome: "200 OK · 商品の HTML",
    outcomeKind: "success",
    steps: [
      ...startMvc("GET", detailPath, detailTemplate, getDetails),
      bindId, actionIn,
      callAction(getDetails, "アクションが ID 42 の商品を読み込み、ビューへ渡すモデルを用意します。", { 引数: "id = 42" }),
      returnView("Details", "product", "商品モデルを ViewResult に載せて返します。この戻り値は、どのビューを描画するかを MVC に伝えます。"),
      actionOut, resultIn, detailView, viewOut, resultOut,
      ...finishMvc("200 OK", "ブラウザーが商品詳細ページの HTML を受け取り、画面に表示します。", { 本文: "商品詳細ページの HTML" }),
    ],
  },
  {
    id: "auth",
    name: "未ログインのアクセス",
    summary: "認可ミドルウェアがログインへ誘導し、MVC のアクションに到達しない例です。",
    initialCondition: "通常の MVC HTML ページに [Authorize] を指定しています。Cookie 認証の LoginPath は /account/login、ブラウザーには認証 Cookie がありません。",
    outcome: "302 Found · ログインへ",
    outcomeKind: "redirect",
    steps: [
      request("GET", "/account", { Cookie: "認証 Cookie なし" }),
      middlewareIn,
      ...match("GET", "/account", "AccountController.Index", "なし", "[Authorize]"),
      authenticate,
      step(
        "auth-challenge", "middleware", "middleware", "middleware", "Authorization",
        "認可ミドルウェアが処理を止める",
        "未認証なので [Authorize] の条件を満たしません。認可ミドルウェアは後続を呼ばず、Cookie 認証にチャレンジを依頼します。MVC フィルターとアクションは実行されません。",
        { 判定: "認証が必要", 処理: "ChallengeAsync()", 実行されない処理: "MVC フィルター・アクション・ビュー" },
        { phase: "short-circuit" },
      ),
      step(
        "cookie-redirect", "middleware", "middleware", "middleware", "Cookie auth",
        "Cookie ハンドラーがリダイレクトを作る",
        "このシナリオの HTML ページでは、Cookie 認証のチャレンジ結果はログインページへの 302 です。",
        { ステータス: "302 Found", Location: loginLocation },
        { phase: "short-circuit" },
      ),
      middlewareOut("302 Found"),
      response("302 Found", "ブラウザーが Location ヘッダーを受け取ります。ログインページの取得は、次の別のリクエストです。", { Location: loginLocation }),
    ],
  },
  {
    id: "invalid",
    name: "POST の入力エラー",
    summary: "偽造防止トークンを検証し、ModelState のエラーをコントローラーからフォームへ返します。",
    initialCondition: "通常のビュー付き MVC コントローラーです。フォームの偽造防止トークンは有効で、必須の Name だけが空欄です。",
    outcome: "200 OK · フォーム再表示",
    outcomeKind: "success",
    steps: [
      ...startMvc("POST", "/products/edit/42", "/products/edit/{id:int}", editProduct, {
        "Content-Type": "application/x-www-form-urlencoded", フォーム: "Name=（空欄）と有効な偽造防止トークン",
      }),
      step(
        "bind-invalid", "mvc", "mvc", "binding", "ModelState",
        "入力値を取り込み、必須エラーを記録する",
        "モデルバインダーがルート値とフォーム値を引数に割り当てたあと、モデル検証が [Required] の違反を ModelState に追加します。",
        { 引数: "[FromRoute] int id, [FromForm] EditProductInput input", 必須項目: "[Required] Name", 判定: "ModelState.IsValid = false" },
      ),
      actionIn,
      callAction(editProduct, "この例は通常の MVC コントローラーなのでアクションが実行され、コードで ModelState.IsValid を確認します。無効なら保存処理へ進まず、フォームを返します。[ApiController] 付き API には自動の 400 応答があります。", {
        判定: "if (!ModelState.IsValid)", 保存: "スキップ",
      }),
      returnView("Edit", "input", "入力モデルを返します。フォームの検証メッセージは ModelState を使って表示できます。ステータスは明示的に変更していないため、この ViewResult は 200 です。"),
      actionOut, resultIn,
      renderView("Edit", "Razor がフォームを再表示します。asp-validation-for で Name の検証エラーを表示し、ユーザーが入力を修正できるようにします。"),
      viewOut, resultOut,
      ...finishMvc("200 OK", "ブラウザーに検証エラー付きのフォームが表示されます。商品の変更は保存されていません。", { 本文: "検証エラー付きの HTML" }),
    ],
  },
  {
    id: "action-error",
    name: "アクションで例外",
    summary: "アクションの例外が MVC の例外フィルターに届き、フィルターが 500 を返します。",
    initialCondition: "商品詳細アクションに対応する例外フィルターを登録しています。アクションから未処理の InvalidOperationException が発生します。",
    outcome: "500 · MVC フィルターが処理",
    outcomeKind: "server-error",
    steps: [
      ...startMvc("GET", detailPath, detailTemplate, getDetails),
      bindId, actionIn,
      callAction(getDetails, "商品を取得する処理で例外が発生し、アクションは ViewResult を返せません。", {
        例外: "InvalidOperationException",
      }),
      step(
        "action-throws", "controller", "mvc", "error", "Action exception",
        "未処理の例外が MVC に戻る",
        "OnActionExecuted は例外情報を受け取ります。この記録用フィルターは処理済みとして扱わないため、MVC の例外フィルターに伝わります。",
        { コールバック: "IActionFilter.OnActionExecuted", 状態: "ActionExecutedContext.ExceptionHandled = false" },
        { phase: "unwind" },
      ),
      step(
        "exception-filter", "mvc", "mvc", "filter", "Exception filter",
        "例外フィルターが 500 の結果を選ぶ",
        "例外フィルターはコントローラー生成、モデルバインディング、アクションフィルター、アクションなどから伝わる未処理の例外を扱えます。この例では 500 の結果を設定して伝播を止めます。",
        { コールバック: "IExceptionFilter.OnException", コード例: "context.Result = new StatusCodeResult(500);" },
        { phase: "short-circuit" },
      ),
      step(
        "filtered-result", "mvc", "mvc", "result", "StatusCodeResult",
        "例外フィルターが選んだ結果を実行する",
        "例外フィルターが作った結果には、通常の結果フィルターは実行されません。この段階に適用するなら IAlwaysRunResultFilter を使います。この例では本文なしでステータス 500 を設定します。",
        { 結果: "StatusCodeResult(500)", 通常の結果フィルター: "実行されない" },
        { phase: "unwind" },
      ),
      ...finishMvc("500 Internal Server Error", "MVC が例外を処理済みにしたので、外側の UseExceptionHandler はこの例外によるエラー応答を作りません。ブラウザーには MVC の 500 が届きます。", { 本文: "なし" }),
    ],
  },
  {
    id: "view-error",
    name: "Razor 描画で例外",
    summary: "結果実行中の例外は MVC の例外フィルターの対象外で、外側のミドルウェアまで伝わります。",
    initialCondition: "同じ例外フィルターと UseExceptionHandler を登録した例です。レスポンスの送信が始まる前に、商品詳細ビューで例外が発生します。",
    outcome: "500 · ミドルウェアが処理",
    outcomeKind: "server-error",
    steps: [
      ...startMvc("GET", detailPath, detailTemplate, getDetails),
      bindId, actionIn,
      callAction(getDetails, "商品を取得する処理は成功し、アクションが商品モデルを用意します。", { 引数: "id = 42" }),
      returnView("Details", "product", "アクションが商品モデルを含む ViewResult を返します。ビュー描画は、このあとの結果実行に含まれます。"),
      actionOut, resultIn,
      renderView("Details", "MVC が商品モデルを Razor テンプレートに渡します。この例では、レスポンスの送信が始まる前に描画が失敗します。"),
      step(
        "view-throws", "view", "mvc", "error", "Result exception",
        "ビュー描画中の例外が MVC に戻る",
        "Razor の描画中に例外が発生します。OnResultExecuted に例外情報が届きますが、この記録用フィルターは処理しません。結果実行は MVC の例外フィルターの対象外です。",
        { 例外: "InvalidOperationException", コールバック: "IResultFilter.OnResultExecuted", 送信状態: "HttpResponse.HasStarted = false" },
        { phase: "unwind" },
      ),
      step(
        "exception-propagates", "mvc", "middleware", "error", "Propagation",
        "未処理の例外がミドルウェアへ伝わる",
        "MVC の結果実行を包むリソースフィルターも例外を処理しないため、呼び出し元をたどって、先に登録した UseExceptionHandler まで例外が伝わります。",
        { 例外フィルター: "結果実行中の例外は対象外", 到達先: "UseExceptionHandler" },
        { phase: "unwind" },
      ),
      step(
        "exception-middleware", "middleware", "middleware", "error", "Exception handler",
        "例外ハンドラーがレスポンスを作り直す",
        "この例ではレスポンスの送信が始まっていないため、インラインのエラーハンドラーがステータスを 500 に設定し、共通エラーメッセージを返せます。送信が始まっていた場合は、既存のレスポンスを差し替えられません。",
        { 条件: "HttpResponse.HasStarted = false", ハンドラー: "UseExceptionHandler のエラー処理用の分岐", ステータス: "500 Internal Server Error" },
        { phase: "short-circuit" },
      ),
      middlewareOut("500 Internal Server Error"),
      response("500 Internal Server Error", "ブラウザーが共通エラーメッセージを受け取ります。Razor の途中結果や内部例外の詳細は、この応答に含めません。", { 本文: "共通エラーメッセージ" }),
    ],
  },
];
