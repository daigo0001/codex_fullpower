export const MAX_INPUT_LENGTH = 65_536;

const fieldName = /^[!#$%&'*+.^_`|~0-9a-z-]+$/i;
const fieldLine = /^([!#$%&'*+.^_`|~0-9a-z-]+):[ \t]*(.*)$/i;
const invalidValue = /[\0-\x08\x0a-\x1f\x7f]/;
const statusLine = /^HTTP\/(?:1\.\d|[23](?:\.0)?)\s+([1-5]\d{2})(?:[ \t]+.*)?$/i;
const httpPseudoStatus = /^:status(?:[ \t]*:[ \t]*|[ \t]+)([1-5]\d{2})$/i;
const pseudoStatusValue = /^[1-5]\d{2}$/;
const absoluteUrl = /^[a-z][a-z0-9+.-]*:\/\//i;
const sectionTitle = /^(?:response headers|レスポンス\s*ヘッダー|応答ヘッダー)\s*:?$/i;
const skippedSectionTitle = /^(?:request headers|リクエスト\s*ヘッダー|要求ヘッダー|general|全般)\s*:?$/i;

function parseResponses(input) {
  const lines = input.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  const responses = [];
  let status = null;
  let headers = new Map();
  let invalid = 0;
  let ended = false;
  let skippedSection = false;
  let count = 0;
  function flush() {
    if (status !== null || headers.size > 0) responses.push({ status, headers, count });
    status = null;
    headers = new Map();
    ended = false;
    count = 0;
  }
  function saveHeader(name, value) {
    if (invalidValue.test(value)) {
      invalid += 1;
      return;
    }
    const key = name.toLowerCase();
    if (!headers.has(key)) headers.set(key, []);
    headers.get(key).push(value.trim());
    count += 1;
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (sectionTitle.test(line)) {
      skippedSection = false;
      continue;
    }
    if (skippedSectionTitle.test(line)) {
      skippedSection = true;
      continue;
    }
    if (skippedSection) continue;
    const statusMatch = statusLine.exec(line) ?? httpPseudoStatus.exec(line);
    if (statusMatch || (line.toLowerCase() === ":status" && pseudoStatusValue.test(lines[i + 1]?.trim() ?? ""))) {
      const statusCode = statusMatch?.[1] ?? lines[++i].trim();
      flush();
      status = Number(statusCode);
      continue;
    }
    if (!line) {
      if (status !== null) ended = true;
      continue;
    }
    if (ended) {
      invalid += 1;
      continue;
    }
    const match = fieldLine.exec(line);
    if (match) {
      saveHeader(match[1], match[2]);
      continue;
    }
    // DevTools can copy each header as a name line followed by a value line.
    const nextLine = lines[i + 1];
    const next = nextLine?.trim() ?? "";
    if (fieldName.test(line) && nextLine !== undefined && next &&
        !statusLine.test(next) && !httpPseudoStatus.test(next) &&
        !sectionTitle.test(next) && !skippedSectionTitle.test(next) &&
        (!fieldLine.test(next) || absoluteUrl.test(next))) {
      saveHeader(line, nextLine);
      i += 1;
      continue;
    }
    invalid += 1;
  }
  flush();
  return { responses, invalid };
}

function item(id, title, status, detail, recommendation = "", evidence = "") {
  return { id, title, status, detail, recommendation, evidence };
}

function reviewHsts(values) {
  const id = "hsts";
  const title = "Strict-Transport-Security";
  const recommendation = "HTTPS の提供が安定してから max-age を設定し、影響を確認しながら延長します。サブドメインへの適用は個別に確認してください。";
  if (!values.length) return item(id, title, "fail", "HTTPS への接続を維持する HSTS ヘッダーが見つかりません。", recommendation);
  const directives = values[0].split(";").map((part) => part.trim().toLowerCase());
  const lifetimes = directives.filter((part) => /^max-age(?:\s*=|$)/.test(part));
  const maxAge = lifetimes.length === 1 && /^max-age\s*=\s*(?:"[0-9]+"|[0-9]+)$/.test(lifetimes[0])
    ? Number(lifetimes[0].split("=")[1].trim().replaceAll('"', ""))
    : NaN;
  if (!Number.isSafeInteger(maxAge) || maxAge <= 0) {
    return item(id, title, "fail", "最初のヘッダーに正の max-age をひとつ設定する必要があります。0 は HSTS を解除します。", recommendation);
  }
  if (values.length > 1) return item(id, title, "warn", "同名ヘッダーが複数あります。ブラウザーは最初のフィールドを処理します。", "配信経路の設定を整理し、有効なヘッダーに統一します。", `${values.length} 件`);
  const duration = `max-age 約 ${Math.floor(maxAge / 86_400)} 日`;
  if (maxAge < 31_536_000) return item(id, title, "warn", "HSTS の保持期間が 1 年未満です。段階的な導入中か確認してください。", recommendation, duration);
  return item(id, title, "pass", "HSTS の保持期間が 1 年以上に設定されています。HTTPS での配信が前提です。", "", duration);
}

function parsePolicies(values) {
  return values.flatMap((value) => value.split(",")).map((value) => {
    const directives = new Map();
    for (const clause of value.split(";")) {
      const [name, ...sources] = clause.trim().split(/\s+/);
      const key = name.toLowerCase();
      if (/^[a-z][a-z0-9-]*$/.test(key) && !directives.has(key)) directives.set(key, sources);
    }
    return directives;
  }).filter((policy) => policy.size > 0);
}

const noneOrSelf = (sources) => Boolean(sources?.length) && sources.every((source) =>
  ["'none'", "'self'"].includes(source.toLowerCase()));
const hasNonceOrHash = (source) => /^'(?:nonce-[a-z0-9+/_-]+={0,2}|sha(?:256|384|512)-[a-z0-9+/_-]+={0,2})'$/i.test(source);
const overlyBroad = (source) => source === "*" || source.includes("*.") ||
  /^[a-z][a-z0-9+.-]*:$/i.test(source) || /^[a-z][a-z0-9+.-]*:\/\/\*/i.test(source);
const disabled = (sources) => sources?.length === 1 && sources[0].toLowerCase() === "'none'";

function boundedScript(sources) {
  if (!sources?.length) return false;
  const dynamicTrust = sources.some(hasNonceOrHash);
  for (const source of sources) {
    const token = source.toLowerCase();
    if (token === "'unsafe-eval'" || token === "'wasm-unsafe-eval'") return false;
    if (token === "'unsafe-inline'" && !dynamicTrust) return false;
    if (overlyBroad(source)) return false;
  }
  return true;
}

function reviewCsp(policies, reports) {
  const id = "csp";
  const title = "Content-Security-Policy";
  const recommendation = "Report-Only で影響を調べ、適用できるポリシーを Content-Security-Policy に設定します。スクリプトの許可は必要なソースだけに絞ります。";
  if (!policies.length) {
    return reports.length
      ? item(id, title, "warn", "Report-Only の指定があります。ブラウザーでの強制適用は確認できません。", recommendation, "強制ポリシー 0 件")
      : item(id, title, "fail", "有効な CSP ディレクティブが見つかりません。", recommendation);
  }
  const controls = [
    [(policy) => policy.get("script-src-elem") ?? policy.get("script-src") ?? policy.get("default-src"), boundedScript, "スクリプト要素"],
    [(policy) => policy.get("script-src-attr") ?? policy.get("script-src") ?? policy.get("default-src"), boundedScript, "インラインハンドラー"],
    [(policy) => policy.get("script-src") ?? policy.get("default-src"), (sources) => Boolean(sources) && !sources.some((source) =>
      ["'unsafe-eval'", "'wasm-unsafe-eval'"].includes(source.toLowerCase())), "動的なコード評価"],
    [(policy) => policy.get("object-src") ?? policy.get("default-src"), disabled, "object-src"],
    [(policy) => policy.get("base-uri"), noneOrSelf, "base-uri"],
  ];
  const missing = controls.filter(([select, accept]) => !policies.some((policy) =>
    accept(select(policy)))).map(([, , label]) => label);
  const evidence = `強制ポリシー ${policies.length} 件`;
  if (missing.length) {
    return item(id, title, "warn", `強制ポリシーがあります。次の項目の制限を見直してください。 ${missing.join("、")}`,
      "スクリプトの許可を必要最小限にし、不要な object-src と base-uri を制限します。", evidence);
  }
  return item(id, title, "pass", "強制ポリシーのスクリプト、プラグイン、base 要素の制限が点検基準を満たしています。", "", evidence);
}

function boundedFrame(sources) {
  return Boolean(sources?.length) && sources.every((source) =>
    !overlyBroad(source) && (/^'(?:none|self)'$/i.test(source) ||
      /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*[a-z0-9-]+(?::\d+)?\/?$/i.test(source)));
}

function reviewFraming(policies, frameValues) {
  const id = "frame";
  const title = "フレーム埋め込み制御";
  const recommendation = "埋め込みが不要なら CSP の frame-ancestors に 'none' を設定します。必要な場合は許可するオリジンに限定します。";
  const directives = policies.map((policy) => policy.get("frame-ancestors")).filter(Boolean);
  if (directives.some(boundedFrame)) {
    return item(id, title, "pass", "強制 CSP の frame-ancestors が埋め込み元を制限しています。", "", "CSP frame-ancestors");
  }
  if (directives.some((sources) => sources.some(overlyBroad))) {
    return item(id, title, "warn", "強制 CSP の frame-ancestors に広い許可があります。X-Frame-Options より CSP が優先されます。", recommendation, "CSP frame-ancestors");
  }
  const values = frameValues.map((value) => value.toLowerCase());
  if (directives.length) {
    return item(id, title, "warn", "frame-ancestors の形式または許可範囲を確認してください。", recommendation, "CSP frame-ancestors");
  }
  if (values.length === 1 && /^(deny|sameorigin)$/.test(values[0])) {
    return item(id, title, "pass", "X-Frame-Options が埋め込み元を制限しています。", "", values[0].toUpperCase());
  }
  if (values.length) return item(id, title, "warn", "X-Frame-Options の値が不明か、指定が重複しています。", recommendation);
  return item(id, title, "fail", "frame-ancestors または X-Frame-Options による制限を確認できません。", recommendation);
}

function reviewNosniff(values) {
  const id = "nosniff";
  const title = "X-Content-Type-Options";
  const recommendation = "正しい Content-Type を配信し、X-Content-Type-Options に nosniff をひとつ設定します。";
  if (values[0]?.toLowerCase() !== "nosniff") return item(id, title, "fail", "nosniff の指定が見つからないか、形式が一致しません。", recommendation);
  if (values.length > 1) return item(id, title, "warn", "nosniff のフィールドが複数あります。", recommendation, `${values.length} 件`);
  return item(id, title, "pass", "ブラウザーの MIME タイプ推測を nosniff で抑制します。", "", "nosniff");
}

function reviewReferrer(values) {
  const id = "referrer";
  const title = "Referrer-Policy";
  const known = new Set(["no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin",
    "same-origin", "strict-origin", "strict-origin-when-cross-origin", "unsafe-url"]);
  const effective = values.join(",").toLowerCase().split(",").map((value) => value.trim()).findLast((token) => known.has(token));
  const recommendation = "外部サイトへの情報共有を見直し、strict-origin-when-cross-origin や no-referrer などを選びます。";
  if (!effective) return item(id, title, "warn", "ブラウザーが認識する明示的なポリシーが見つかりません。", recommendation);
  if (effective === "unsafe-url") return item(id, title, "fail", "外部への遷移時にも URL のパスやクエリが送られる設定です。", recommendation, effective);
  if (["no-referrer-when-downgrade", "origin", "origin-when-cross-origin"].includes(effective)) {
    return item(id, title, "warn", "外部サイトへの送信範囲や、HTTPS から HTTP へ遷移するときの挙動を見直してください。", recommendation, effective);
  }
  return item(id, title, "pass", "外部へのリファラー送信を制限するポリシーです。", "", effective);
}

function reviewPermissions(values) {
  const id = "permissions";
  const title = "Permissions-Policy";
  const recommendation = "使っていない機能を Permissions-Policy で無効化します。例として camera=(), microphone=(), geolocation=() を検討してください。";
  if (!values.length) return item(id, title, "warn", "カメラや位置情報などの機能に対する明示的なポリシーが見つかりません。", recommendation);
  const features = new Set(["accelerometer", "autoplay", "camera", "clipboard-read", "clipboard-write", "display-capture",
    "encrypted-media", "fullscreen", "geolocation", "gyroscope", "magnetometer", "microphone", "midi", "payment",
    "publickey-credentials-get", "screen-wake-lock", "usb", "web-share", "xr-spatial-tracking"]);
  const restricted = new Set();
  for (const clause of values.join(",").split(",")) {
    const match = /^\s*([a-z][a-z0-9-]*)\s*=\s*(.*?)\s*$/.exec(clause);
    if (!match || !features.has(match[1])) continue;
    if (/^\(\s*(?:self\s*)?\)$/.test(match[2])) restricted.add(match[1]);
    else restricted.delete(match[1]);
  }
  if (!restricted.size) return item(id, title, "warn", "点検対象の機能で、無効化または同一オリジンに限定する指定を確認できません。", recommendation);
  return item(id, title, "pass", "無効化または同一オリジンに限定するディレクティブが見つかりました。",
    "サイトと埋め込みで使う機能に合わせて、許可する範囲を確認してください。", `${restricted.size} 件`);
}

function reviewCookies(values) {
  const id = "cookies";
  const title = "Set-Cookie";
  if (!values.length) return item(id, title, "info", "このレスポンスに Set-Cookie はありません。ログインなど別のレスポンスも確認できます。");
  let malformed = 0;
  let noSecure = 0;
  let noHttpOnly = 0;
  let noSameSite = 0;
  let crossSiteWithoutSecure = 0;
  for (const value of values) {
    const [pair, ...parts] = value.split(";");
    if (!/^[^=\s]+\s*=/.test(pair)) {
      malformed += 1;
      continue;
    }
    const fields = new Map();
    for (const part of parts) {
      const name = part.split("=", 1)[0];
      fields.set(name.trim().toLowerCase(), part.slice(name.length + 1).trim().toLowerCase());
    }
    const sameSite = fields.get("samesite");
    if (!fields.has("secure")) noSecure += 1;
    if (!fields.has("httponly")) noHttpOnly += 1;
    if (!["strict", "lax", "none"].includes(sameSite)) noSameSite += 1;
    if (sameSite === "none" && !fields.has("secure")) crossSiteWithoutSecure += 1;
  }
  const evidence = [`Set-Cookie ${values.length} 件`, `Secure 未指定 ${noSecure} 件`, `HttpOnly 未指定 ${noHttpOnly} 件`, `有効な SameSite 未指定 ${noSameSite} 件`];
  if (malformed) evidence.push(`形式要確認 ${malformed} 件`);
  const metrics = evidence.join(" · ");
  const recommendation = "HTTPS で使うセッション Cookie には Secure を設定します。JavaScript からのアクセスが不要なら HttpOnly を付け、用途に合う SameSite を明示します。";
  if (crossSiteWithoutSecure) return item(id, title, "fail", "SameSite=None と Secure が揃っていない Cookie があります。", recommendation, metrics);
  if (malformed || noSecure || noHttpOnly || noSameSite) return item(id, title, "warn", "用途を確認したうえで、Cookie 属性や形式を見直してください。", recommendation, metrics);
  return item(id, title, "pass", "すべての Set-Cookie に Secure、HttpOnly、有効な SameSite を確認しました。", "", metrics);
}

function reviewCache(values) {
  const id = "cache";
  const title = "Cache-Control";
  const directives = values.join(",").split(",").map((part) => part.trim().toLowerCase());
  const sensitive = directives.includes("no-store");
  const protectsShared = sensitive || directives.includes("private");
  const detail = sensitive ? "no-store の指定があります。" : protectsShared
    ? "private の指定があり、通常は共有キャッシュに保存されません。"
    : "共有キャッシュへの格納を制限する明示的な指示は見つかりません。";
  return item(id, title, "info", detail,
    "ログイン後の個人情報など、キャッシュに残したくないレスポンスには no-store を検討します。");
}

export function analyzeHeaders(input) {
  if (typeof input !== "string") throw new TypeError("ヘッダーをテキストで入力してください。");
  if (input.length > MAX_INPUT_LENGTH) throw new RangeError("入力は 65,536 文字までです。レスポンスヘッダーだけを貼り付けてください。");
  const { responses, invalid } = parseResponses(input);
  const final = responses.at(-1);
  const notes = [];
  if (responses.length > 1) notes.push(`${responses.length} 件のレスポンスから、最後のブロックを点検しました。`);
  if (invalid) notes.push(`ヘッダーの形式に合わない行を ${invalid} 行読み飛ばしました。`);
  if (final?.status >= 300 && final.status < 400) {
    notes.push("最後のレスポンスは 3xx です。直接表示するページのレスポンスも確認してください。");
  }
  const result = { score: null, responses: responses.length, httpStatus: final?.status ?? null, headerCount: final?.count ?? 0, issues: [], notes };
  if (!final?.count) {
    notes.push("最後のレスポンスにヘッダーが見つかりません。名前と値を含むレスポンスヘッダーを貼り付けてください。");
    return result;
  }
  const values = (name) => final.headers.get(name) ?? [];
  const policies = parsePolicies(values("content-security-policy"));
  const reports = parsePolicies(values("content-security-policy-report-only"));
  const baseline = [
    reviewHsts(values("strict-transport-security")),
    reviewCsp(policies, reports),
    reviewFraming(policies, values("x-frame-options")),
    reviewNosniff(values("x-content-type-options")),
    reviewReferrer(values("referrer-policy")),
    reviewPermissions(values("permissions-policy")),
  ];
  result.score = Math.round(100 * baseline.reduce((score, check) => score + (check.status === "pass" ? 1 : check.status === "warn" ? 0.5 : 0), 0) / baseline.length);
  result.issues = [...baseline, reviewCookies(values("set-cookie")), reviewCache(values("cache-control"))];
  notes.push("スコアは主要 6 項目の簡易指標です。適合を 1 点、要確認を 0.5 点とし、100 点に換算します。");
  notes.push("ブラウザーやレスポンスの種類によって挙動が異なります。HTTPS や証明書の状態は貼り付けたヘッダーから確認できません。");
  return result;
}
