const topics = {
  overview: `
    <h2>目的に合う方式を選ぶ</h2>
    <p class="cg-lead">読み取られないようにする、入力が合っているか照合する、誰が作ったか確かめる。目的が変わると、使う仕組みも変わります。</p>
    <div class="cg-choices">
      <div><span class="cg-tag">暗号化</span><h3>内容を隠す</h3><p>鍵を持つ相手だけが、データを元に戻せます。</p></div>
      <div><span class="cg-tag">パスワードハッシュ</span><h3>入力を照合する</h3><p>入力を同じ条件で変換し、保存済みの値と比べます。</p></div>
      <div><span class="cg-tag">電子署名</span><h3>作成元を確かめる</h3><p>信頼できる公開鍵で、署名とデータが対応するか確かめます。</p></div>
    </div>
    <div class="cg-table-scroll" tabindex="0" role="region" aria-label="方式の比較表">
      <table class="cg-table">
        <caption>よく使う方式の比較</caption>
        <thead><tr><th scope="col">方式</th><th scope="col">必要なもの</th><th scope="col">使いどころ</th><th scope="col">代表例</th></tr></thead>
        <tbody>
          <tr><th scope="row">エンコード</th><td>変換ルール</td><td>バイナリを文字列として運ぶ</td><td>Base64</td></tr>
          <tr><th scope="row">ハッシュ</th><td>元データ</td><td>信頼できるハッシュ値と照合し、内容の一致を確認する</td><td>SHA-256</td></tr>
          <tr><th scope="row">パスワードハッシュ</th><td>パスワード、ソルト、コスト設定</td><td>ログイン時に、保存した検証用の値と照合する</td><td>Argon2id、PBKDF2</td></tr>
          <tr><th scope="row">認証付き暗号</th><td>共通鍵、nonce</td><td>内容を隠し、復号時に改変を検出する</td><td>AES-GCM、ChaCha20-Poly1305</td></tr>
          <tr><th scope="row">メッセージ認証</th><td>共有している秘密鍵</td><td>鍵を共有する相手と、データの改変を検証する</td><td>HMAC-SHA-256</td></tr>
          <tr><th scope="row">電子署名</th><td>署名用の秘密鍵、検証用の公開鍵</td><td>公開鍵を信頼する人が、第三者として署名を検証する</td><td>Ed25519、ECDSA、RSA-PSS</td></tr>
        </tbody>
      </table>
    </div>
    <p class="cg-note">Base64 は表現形式です。Base64 にしただけの文字列は、鍵なしでデコードできます。ZIP は複数ファイルをまとめる形式で、圧縮と暗号化を個別に選べます。</p>
    <p class="cg-links"><a href="https://developer.mozilla.org/ja/docs/Web/API/SubtleCrypto">MDN · SubtleCrypto</a> <a href="https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html">OWASP · パスワードの保存</a></p>
  `,
  password: `
    <h2>保存するのは、照合に使う値</h2>
    <p class="cg-lead">登録時にパスワードから検証用の値を計算します。次のログインでは、入力と保存済みのソルトに同じ方式とパラメーターを適用し、計算結果を比べます。</p>
    <ol class="cg-flow" aria-label="登録とログインでの照合">
      <li><span>登録</span><strong>新しいソルトを作る</strong><p>アカウントごとに十分な長さのランダムな値を用意します。</p></li>
      <li><span>保存</span><strong>方式・設定と一緒に記録</strong><p>計算されたハッシュ値、ソルト、コスト設定を保存します。</p></li>
      <li><span>ログイン</span><strong>同じ条件で照合</strong><p>入力した値から再計算し、保存済みのハッシュ値と比べます。</p></li>
    </ol>
    <p class="cg-note">ソルトはハッシュ値と一緒に保存できます。ソルトが違うと、同じパスワードからも異なる値が得られます。SHA-256 単体は高速なので、パスワードの保存には計算コストを調整できる専用の方式を使います。</p>
    <div class="cg-table-scroll" tabindex="0" role="region" aria-label="パスワードハッシュ方式の比較表">
      <table class="cg-table">
        <caption>パスワード用の代表的な方式</caption>
        <thead><tr><th scope="col">方式</th><th scope="col">特徴</th><th scope="col">採用の目安</th></tr></thead>
        <tbody>
          <tr><th scope="row">Argon2id</th><td>時間やメモリ使用量を調整する</td><td>新規実装での OWASP の第一候補</td></tr>
          <tr><th scope="row">scrypt</th><td>計算とメモリの両方を使う</td><td>Argon2id が利用できない場合の候補</td></tr>
          <tr><th scope="row">bcrypt</th><td>コストを設定できる。入力は一般に 72 バイトまで</td><td>既存環境で利用される方式</td></tr>
          <tr><th scope="row">PBKDF2</th><td>反復回数で計算コストを調整する</td><td>FIPS-140 準拠が必要な環境など。デモでは HMAC-SHA-256 を 600,000 回使う</td></tr>
        </tbody>
      </table>
    </div>
    <p class="cg-links"><a href="https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html">OWASP · パスワードの保存</a> <a href="https://www.rfc-editor.org/rfc/rfc9106.html">RFC 9106 · Argon2</a></p>
  `,
  encryption: `
    <h2>共通鍵で本文を暗号化する</h2>
    <p class="cg-lead">共通鍵暗号では、同じ鍵を暗号化と復号に使います。AES-GCM や ChaCha20-Poly1305 は、本文を隠しながら改変も検出する認証付き暗号（AEAD）です。</p>
    <ol class="cg-flow" aria-label="認証付き暗号の処理">
      <li><span>入力</span><strong>平文と鍵、nonce</strong><p>この方式の nonce（IV）は、同じ鍵で再利用しない値です。秘密にするのは鍵です。</p></li>
      <li><span>暗号化</span><strong>暗号文と認証タグ</strong><p>タグは、復号時に暗号文などが改変されていないかを検証するために使います。</p></li>
      <li><span>復号</span><strong>認証に通れば平文を返す</strong><p>受け取った nonce とタグを使い、検証に失敗した場合は復号を拒否します。</p></li>
    </ol>
    <h3 class="cg-subheading">公開鍵暗号は、鍵を届けたり合意したりするために使う</h3>
    <p>公開鍵を使う仕組みには、RSA-OAEP のように公開鍵で暗号化し秘密鍵で復号する方式と、楕円曲線を使う X25519 のようにそれぞれの鍵から共通の秘密を得る鍵合意があります。公開鍵の持ち主を確かめる仕組みも必要です。</p>
    <div class="cg-combination"><span>相手の公開鍵を確認</span><span>共通鍵を渡す・合意する</span><span>共通鍵で本文を暗号化</span></div>
    <p>鍵を扱う部分と本文の暗号化を組み合わせる方法をハイブリッド暗号といいます。たとえば TLS 1.3 の証明書を使う接続では、一時的な鍵合意と相手の認証を経て、通信データを共通鍵で保護します。</p>
    <p class="cg-links"><a href="https://csrc.nist.gov/pubs/sp/800/38/d/final">NIST · AES-GCM</a> <a href="https://www.rfc-editor.org/rfc/rfc8439.html">RFC 8439 · ChaCha20-Poly1305</a> <a href="https://www.rfc-editor.org/rfc/rfc8446.html">RFC 8446 · TLS 1.3</a></p>
  `,
  zip: `
    <h2>ZIP の圧縮と暗号化を分けて考える</h2>
    <p class="cg-lead">ZIP はファイルをひとまとめにする形式です。圧縮はサイズを小さくし、暗号化は内容を保護します。パスワード付き ZIP でも、選んだ暗号方式によって保護と互換性が変わります。</p>
    <div class="cg-table-scroll" tabindex="0" role="region" aria-label="アーカイブ暗号化の比較表">
      <table class="cg-table">
        <caption>アーカイブ形式・暗号化オプションの比較</caption>
        <thead><tr><th scope="col">方式</th><th scope="col">保護の範囲</th><th scope="col">受け取り側で確認すること</th></tr></thead>
        <tbody>
          <tr><th scope="row">圧縮だけの ZIP</th><td>ファイル名と内容を閲覧できる</td><td>標準的な ZIP を開けるか</td></tr>
          <tr><th scope="row">ZipCrypto</th><td>従来の ZIP 暗号化。機密性を求める用途には弱い</td><td>古いツールとの互換性が中心</td></tr>
          <tr><th scope="row">AES-256 ZIP<br><small>WinZip AES 仕様</small></th><td>ファイルの中身を AES-CTR で暗号化し、HMAC で改変を検出する。通常はファイル名や一部のメタデータを閲覧できる</td><td>展開するアプリが AES 暗号化 ZIP に対応しているか</td></tr>
          <tr><th scope="row">暗号化した 7z<br><small>ヘッダー暗号化を有効化</small></th><td>本文に加え、アーカイブ内のファイル名も保護する</td><td>暗号化した 7z を開けるアプリがあるか</td></tr>
        </tbody>
      </table>
    </div>
    <p class="cg-note">機密資料を渡すときは、相手が開ける方式とファイル名を伏せる必要性を先に確認します。パスワードで開く方式では、十分に長い固有のパスワードを使い、アーカイブと別の経路で共有します。</p>
    <p class="cg-links"><a href="https://www.winzip.com/en/support/aes-encryption/">WinZip · AES 暗号化の仕様</a> <a href="https://7-zip.org/7z.html">7-Zip · 7z 形式</a></p>
  `,
  signatures: `
    <h2>電子署名で、内容と鍵の対応を確かめる</h2>
    <p class="cg-lead">作成者は秘密鍵で署名を作り、受け取る側はデータと署名を公開鍵で検証します。公開鍵が本当に作成者のものか、証明書などの信頼できる方法で確認することが前提です。</p>
    <ol class="cg-flow" aria-label="電子署名を検証する流れ">
      <li><span>作成者</span><strong>秘密鍵で署名</strong><p>文書やソフトウェア配布物に対応する署名を作ります。</p></li>
      <li><span>受け渡し</span><strong>データと署名を受け取る</strong><p>検証には公開鍵も必要です。本文の秘匿が必要な場合は暗号化も使います。</p></li>
      <li><span>検証者</span><strong>信頼した公開鍵で検証</strong><p>データが改変されていないかと、その鍵に対応する署名かを確かめます。</p></li>
    </ol>
    <div class="cg-table-scroll" tabindex="0" role="region" aria-label="改変を確認する方式の比較表">
      <table class="cg-table">
        <caption>改変を確認する3つの仕組み</caption>
        <thead><tr><th scope="col">方式</th><th scope="col">照合に必要なもの</th><th scope="col">使い方の例</th></tr></thead>
        <tbody>
          <tr><th scope="row">SHA-256</th><td>信頼できる経路から得たハッシュ値</td><td>ダウンロードしたファイルとの一致確認</td></tr>
          <tr><th scope="row">HMAC</th><td>作成側と検証側が共有する秘密鍵</td><td>共有鍵を使った通知メッセージの認証</td></tr>
          <tr><th scope="row">電子署名</th><td>署名者の信頼できる公開鍵</td><td>ソフトウェア更新の検証、TLS でのサーバー認証</td></tr>
        </tbody>
      </table>
    </div>
    <p class="cg-note">HTTPS では、通常、ブラウザーが証明書と接続先の名前を検証し、サーバーが対応する秘密鍵を持つことを署名で確かめます。その後の通信は、接続ごとの共通鍵で保護されます。</p>
    <p class="cg-links"><a href="https://www.rfc-editor.org/rfc/rfc2104.html">RFC 2104 · HMAC</a> <a href="https://csrc.nist.gov/pubs/fips/186-5/final">NIST · 電子署名の標準</a> <a href="https://www.rfc-editor.org/rfc/rfc8446.html">RFC 8446 · TLS 1.3</a></p>
  `,
};

export function renderGuide(container, topic) {
  container.classList.add("crypto-guide");
  container.innerHTML = Object.hasOwn(topics, topic) ? topics[topic] : topics.overview;
}
