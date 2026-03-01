---
title: "CSRF（Cross-Site Request Forgery）— Webにおける意図しないリクエストの脅威と防御"
date: 2026-03-01
tags: ["security", "web-security", "csrf", "cross-site-request-forgery", "intermediate"]
---

# CSRF（Cross-Site Request Forgery）— Webにおける意図しないリクエストの脅威と防御

## 1. 背景と動機

### 1.1 Webの信頼モデルが生んだ構造的脆弱性

Webは本質的に「ユーザーがリンクをクリックし、別のサイトに遷移する」ことを前提として設計されたプラットフォームである。あるページから別のドメインのリソースを参照すること——画像の埋め込み、フォームの送信、スクリプトの読み込み——はWebの基本的な機能であり、これなくしてWebは成立しない。

しかし、この「サイト横断的なリクエスト」という仕組みと、ブラウザが自動的にCookieを送信するという動作が組み合わさったとき、深刻なセキュリティ上の問題が発生する。それがCSRF（Cross-Site Request Forgery、クロスサイトリクエストフォージェリ）である。日本語では「リクエスト強要」とも呼ばれる。

CSRFは、攻撃者が被害者のブラウザを「踏み台」として利用し、被害者が認証済みのWebアプリケーションに対して、被害者の意図しないリクエストを送信させる攻撃である。被害者は自分がそのリクエストを送ったことすら気づかない。

### 1.2 なぜCSRFは可能なのか

CSRFが成立する根本的な原因は、ブラウザのCookie送信メカニズムにある。ブラウザは、あるドメインに対するHTTPリクエストを送信する際、そのドメインに紐づくCookieを**リクエストの発信元がどこであるかに関係なく**自動的に付与する。

つまり、`evil.example.com`上のページから`bank.example.com`に対してリクエストが発行された場合でも、ブラウザは`bank.example.com`のCookie（セッションCookieを含む）を自動的にそのリクエストに付与する。`bank.example.com`のサーバーから見ると、このリクエストは正規のセッションCookieを伴っており、正当なユーザーからのリクエストと区別がつかない。

この問題の核心は、**Webアプリケーションが「リクエストがどこから来たか」ではなく「リクエストに正しい認証情報が含まれているか」だけで認可判断を行っている**ことにある。Cookieベースのセッション管理を採用しているほぼすべてのWebアプリケーションが、対策を講じなければCSRFに対して脆弱となる。

### 1.3 歴史的経緯

CSRFの概念自体は2000年代初頭から知られていたが、当初は「セッションライディング」や「ワンクリック攻撃」など様々な名称で呼ばれていた。2004年頃からセキュリティ研究者たちの間で体系的な議論が始まり、2007年にはOWASP（Open Worldwide Application Security Project）のTop 10にランクインした。

CSRFが特に注目を集めたのは、2008年前後に複数の大規模なWebサービスでCSRF脆弱性が発見・悪用された時期である。その後、Webフレームワークの多くがCSRF対策を標準機能として組み込むようになり、2020年代に入るとSameSite Cookieのデフォルト化により、ブラウザレベルでの防御が進んだ。しかし、CSRFは依然としてOWASP Top 10の関連項目に含まれており、完全に過去の脅威となったわけではない。

## 2. CSRFの仕組み

### 2.1 攻撃の前提条件

CSRFが成立するためには、以下の条件が揃う必要がある。

1. **被害者が対象サイトにログイン済みである**: ブラウザに有効なセッションCookieが保存されている状態。
2. **対象サイトがCookieのみで認証を行っている**: リクエストの正当性をセッションCookieだけで判断し、追加の検証を行っていない。
3. **攻撃者が被害者に悪意のあるページを閲覧させることができる**: メール内のリンク、SNSへの投稿、広告など、様々な手段が考えられる。
4. **リクエストのパラメータが攻撃者にとって予測可能である**: 対象となる操作のHTTPリクエストの形式（URL、パラメータ名、値）を攻撃者が事前に知ることができる。

### 2.2 攻撃の流れ

CSRFの攻撃フローを具体的に示す。

```mermaid
sequenceDiagram
    participant Victim as 被害者のブラウザ
    participant Bank as bank.example.com<br/>(正規サイト)
    participant Evil as evil.example.com<br/>(攻撃者のサイト)

    Note over Victim, Bank: ステップ1: 被害者が正規サイトにログイン
    Victim->>Bank: POST /login (ID/Password)
    Bank-->>Victim: Set-Cookie: session_id=abc123

    Note over Victim, Evil: ステップ2: 被害者が攻撃者のサイトを訪問
    Victim->>Evil: GET /interesting-page.html
    Evil-->>Victim: 悪意のあるHTML（自動送信フォーム含む）

    Note over Victim, Bank: ステップ3: ブラウザが自動的にリクエストを送信
    Victim->>Bank: POST /transfer?to=attacker&amount=1000000<br/>Cookie: session_id=abc123
    Note right of Bank: サーバーは正規のリクエストと<br/>区別できない
    Bank-->>Victim: 200 OK（送金完了）
```

### 2.3 攻撃の具体例

#### GETリクエストによるCSRF

最も単純な形態は、画像タグを利用したものである。

```html
<!-- evil.example.com 上の悪意のあるページ -->
<html>
<body>
  <h1>素敵な猫の写真集</h1>
  <p>かわいい猫たちをお楽しみください！</p>

  <!-- This image tag triggers a GET request to the bank -->
  <img src="https://bank.example.com/transfer?to=attacker&amount=1000000"
       width="0" height="0" style="display:none" />
</body>
</html>
```

被害者がこのページを開いた瞬間、ブラウザは画像を読み込むために`bank.example.com`にGETリクエストを送信する。このとき、`bank.example.com`のセッションCookieが自動的に付与される。もし`bank.example.com`がGETリクエストで送金処理を受け付けていた場合、被害者の口座から攻撃者の口座に送金が実行される。

**注意**: 状態を変更する操作をGETリクエストで実行すること自体がHTTPの仕様（RFC 7231）に反する設計であり、CSRFの有無に関わらず避けるべきである。しかし、GETをPOSTに変えるだけではCSRFは防げない。

#### POSTリクエストによるCSRF

POSTリクエストを使ったCSRFも、隠しフォームとJavaScriptの自動送信で容易に実現できる。

```html
<!-- evil.example.com 上の悪意のあるページ -->
<html>
<body>
  <h1>おめでとうございます！抽選に当選しました！</h1>

  <!-- Hidden form that auto-submits -->
  <form id="csrf-form" action="https://bank.example.com/transfer" method="POST"
        style="display:none">
    <input type="hidden" name="to" value="attacker" />
    <input type="hidden" name="amount" value="1000000" />
  </form>

  <script>
    // Auto-submit the form as soon as the page loads
    document.getElementById('csrf-form').submit();
  </script>
</body>
</html>
```

この場合も、ブラウザは`bank.example.com`に対するPOSTリクエストにセッションCookieを自動付与する。サーバー側から見れば、正規のフォームから送信されたリクエストと見分けがつかない。

#### JSONベースのAPIに対するCSRF

モダンなWebアプリケーションでは、`Content-Type: application/json`のリクエストを使うことが多い。一見すると、HTMLフォームからはJSONを送信できないため安全に思えるかもしれない。しかし、`fetch`APIを使えばJSONリクエストも送信可能であり、単純リクエストの条件を満たさない場合はCORSのプリフライトチェックが行われるが、サーバー側のCORS設定が緩い場合には攻撃が成立する可能性がある。

また、`Content-Type: text/plain`で送信したリクエストボディに有効なJSONを含め、サーバー側がContent-Typeを厳密に検証していない場合にも攻撃が成立する場合がある。

```html
<!-- Attempt to send JSON via form with text/plain encoding -->
<form action="https://api.example.com/user/email" method="POST"
      enctype="text/plain">
  <input name='{"email":"attacker@evil.com","dummy":"' value='"}' type="hidden" />
  <input type="submit" value="Click me" />
</form>
<!--
  The above form submits a body like:
  {"email":"attacker@evil.com","dummy":"="}
  which may be parsed as valid JSON by some servers
-->
```

### 2.4 CSRFの影響範囲

CSRFによって引き起こされる被害は、対象アプリケーションの機能に依存する。代表的な被害例を以下に示す。

| 対象操作 | 攻撃例 | 影響度 |
|---------|--------|-------|
| 送金・決済 | 攻撃者の口座への不正送金 | 極めて高い |
| パスワード変更 | アカウントの完全な乗っ取り | 極めて高い |
| メールアドレス変更 | パスワードリセットを経由したアカウント乗っ取り | 極めて高い |
| 管理者操作 | 新規管理者アカウントの作成、設定変更 | 極めて高い |
| SNS投稿 | 被害者名義での不正投稿 | 高い |
| プロフィール変更 | 個人情報の書き換え | 中程度 |
| 設定変更 | 通知設定やプライバシー設定の変更 | 中程度 |

重要な点は、CSRFは**被害者のセッションの権限で実行可能なあらゆる操作**が攻撃対象となり得るということである。管理者ユーザーが被害者であれば、管理者権限での操作が可能となり、被害は甚大なものとなる。

## 3. 防御メカニズム

### 3.1 SameSite Cookie属性

#### 概要

SameSite Cookie属性は、ブラウザレベルでCSRFを防御する最も効果的な方法の一つである。2016年にChrome 51で初めて実装され、2020年にChrome 80でデフォルト値が`Lax`に変更された。現在では主要ブラウザすべてでサポートされている。

SameSite属性は、Cookie送信時の「コンテキスト」を制御する。具体的には、異なるサイトからのリクエスト（クロスサイトリクエスト）にCookieを付与するかどうかを指定できる。

#### 三つの値

```
Set-Cookie: session_id=abc123; SameSite=Strict; Secure; HttpOnly
Set-Cookie: session_id=abc123; SameSite=Lax; Secure; HttpOnly
Set-Cookie: session_id=abc123; SameSite=None; Secure; HttpOnly
```

**`Strict`**: クロスサイトリクエストには一切Cookieを付与しない。最も厳格な設定であるが、外部サイトからのリンク経由でアクセスした際にもCookieが送信されないため、ユーザーは再ログインが必要になる場合がある。

**`Lax`（現在のデフォルト）**: トップレベルナビゲーション（リンクのクリックやアドレスバーへの入力）で、かつGETメソッドの場合のみCookieを付与する。POSTリクエストやiframe内のリクエスト、画像・スクリプトの読み込みなどにはCookieを付与しない。

**`None`**: 従来の動作と同じく、すべてのクロスサイトリクエストにCookieを付与する。`Secure`属性（HTTPS必須）と併用する必要がある。

```mermaid
graph TD
    A["クロスサイトリクエスト発生"] --> B{"SameSite属性の値は？"}
    B -->|Strict| C["Cookie送信しない"]
    B -->|Lax| D{"リクエストの種類は？"}
    B -->|None| E["Cookie送信する<br/>(Secure必須)"]
    D -->|"トップレベルナビゲーション<br/>+ GETメソッド"| F["Cookie送信する"]
    D -->|"POST / iframe /<br/>img / script 等"| G["Cookie送信しない"]

    style C fill:#4CAF50,color:#fff
    style G fill:#4CAF50,color:#fff
    style F fill:#FFC107,color:#000
    style E fill:#F44336,color:#fff
```

#### SameSite=Laxの限界

`SameSite=Lax`は多くのCSRF攻撃を防ぐが、万能ではない。以下のケースでは追加の対策が必要である。

1. **GETリクエストで状態を変更するエンドポイント**: `Lax`はトップレベルGETナビゲーションでCookieを送信するため、GETで状態変更を行うエンドポイントはCSRFに対して脆弱なままである。
2. **サブドメイン間の攻撃**: SameSiteの「サイト」はeTLD+1（effective Top Level Domain + 1）で判定される。`evil.example.com`から`bank.example.com`へのリクエストは「同一サイト」とみなされ、SameSiteの保護は効かない。
3. **古いブラウザ**: SameSite属性を理解しないブラウザでは、属性が無視され従来どおりCookieが送信される。

### 3.2 CSRFトークン（Synchronizer Token Pattern）

#### 概要

CSRFトークンは、最も広く採用されている防御手法であり、長年にわたってCSRF対策の標準とされてきた。SameSite Cookieが普及した現在でも、多層防御（Defense in Depth）の観点から引き続き推奨されている。

#### 原理

CSRFが成立する理由は、攻撃者がリクエストの全パラメータを予測できることにある。この前提を崩すために、リクエストごとに**攻撃者が予測不可能な秘密の値（トークン）**を含めることを要求する。

具体的には以下の手順で動作する。

1. サーバーは暗号学的に安全な乱数を生成し、セッションに紐づけて保存する。
2. フォームを含むHTMLレスポンスを返す際に、このトークンを隠しフィールドとして埋め込む。
3. クライアントがフォームを送信する際に、トークンがリクエストに含まれる。
4. サーバーはリクエスト内のトークンとセッションに保存されたトークンを照合し、一致しなければリクエストを拒否する。

攻撃者のサイトからはこのトークンの値を取得できない（同一オリジンポリシーにより、攻撃者のサイトから正規サイトのDOM内容を読み取ることはできない）。したがって、攻撃者は正しいトークンを含むリクエストを偽造できない。

```mermaid
sequenceDiagram
    participant Browser as ブラウザ
    participant Server as 正規サーバー
    participant Evil as 攻撃者サイト

    Note over Browser, Server: 正規の操作フロー
    Browser->>Server: GET /transfer（フォーム表示）
    Server-->>Browser: HTML + hidden field:<br/>csrf_token=x8Kj2mNp

    Browser->>Server: POST /transfer<br/>csrf_token=x8Kj2mNp&to=friend&amount=1000<br/>Cookie: session_id=abc123
    Note right of Server: トークン検証: OK
    Server-->>Browser: 200 OK

    Note over Browser, Evil: CSRF攻撃の試行
    Browser->>Evil: GET /malicious-page
    Evil-->>Browser: 悪意のあるフォーム<br/>（csrf_tokenを知らない）

    Browser->>Server: POST /transfer<br/>to=attacker&amount=1000000<br/>Cookie: session_id=abc123
    Note right of Server: トークンなし: 拒否
    Server-->>Browser: 403 Forbidden
```

#### 脆弱なコード vs 安全なコード

**脆弱な実装（Python/Flask）:**

```python
# VULNERABLE: No CSRF protection
from flask import Flask, request, session

app = Flask(__name__)
app.secret_key = 'secret'

@app.route('/transfer', methods=['GET'])
def transfer_form():
    return '''
        <form method="POST" action="/transfer">
            <input name="to" placeholder="Recipient" />
            <input name="amount" placeholder="Amount" />
            <button type="submit">Transfer</button>
        </form>
    '''

@app.route('/transfer', methods=['POST'])
def transfer():
    # Only checks session cookie — no CSRF token validation
    if 'user_id' not in session:
        return 'Unauthorized', 401

    to = request.form['to']
    amount = request.form['amount']
    # execute_transfer(session['user_id'], to, amount)
    return f'Transferred {amount} to {to}'
```

**安全な実装（Python/Flask）:**

```python
# SECURE: CSRF token validation implemented
import os
import hmac
from flask import Flask, request, session, abort

app = Flask(__name__)
app.secret_key = 'secret'

def generate_csrf_token():
    """Generate a cryptographically secure CSRF token."""
    if '_csrf_token' not in session:
        session['_csrf_token'] = os.urandom(32).hex()
    return session['_csrf_token']

def validate_csrf_token():
    """Validate the CSRF token from the request against the session."""
    token = session.get('_csrf_token')
    request_token = request.form.get('_csrf_token')
    if not token or not request_token:
        abort(403)
    if not hmac.compare_digest(token, request_token):
        abort(403)

@app.route('/transfer', methods=['GET'])
def transfer_form():
    token = generate_csrf_token()
    return f'''
        <form method="POST" action="/transfer">
            <input type="hidden" name="_csrf_token" value="{token}" />
            <input name="to" placeholder="Recipient" />
            <input name="amount" placeholder="Amount" />
            <button type="submit">Transfer</button>
        </form>
    '''

@app.route('/transfer', methods=['POST'])
def transfer():
    if 'user_id' not in session:
        return 'Unauthorized', 401

    # Validate CSRF token before processing
    validate_csrf_token()

    to = request.form['to']
    amount = request.form['amount']
    # execute_transfer(session['user_id'], to, amount)
    return f'Transferred {amount} to {to}'
```

#### SPAにおけるCSRFトークンの実装

シングルページアプリケーション（SPA）では、HTMLフォームの隠しフィールドではなく、カスタムHTTPヘッダーにCSRFトークンを含める方法が一般的である。

```javascript
// Frontend: Fetch CSRF token from a dedicated endpoint or meta tag
async function getCSRFToken() {
  const response = await fetch('/api/csrf-token', {
    credentials: 'include'
  });
  const data = await response.json();
  return data.token;
}

// Include CSRF token in all state-changing requests
async function transferFunds(to, amount) {
  const csrfToken = await getCSRFToken();

  const response = await fetch('/api/transfer', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken  // Custom header with CSRF token
    },
    body: JSON.stringify({ to, amount })
  });

  return response.json();
}
```

カスタムヘッダーを使う方法には追加の利点がある。ブラウザの同一オリジンポリシーにより、クロスオリジンのリクエストにカスタムヘッダーを付与するにはCORSのプリフライトチェックが必要となる。サーバーがCORSを適切に設定していれば、プリフライトの段階で攻撃リクエストがブロックされる。

### 3.3 Double Submit Cookie パターン

#### 概要

Double Submit Cookieは、サーバー側にCSRFトークンの状態を保持する必要がないというメリットを持つ手法である。ステートレスなアーキテクチャとの相性が良い。

#### 原理

1. サーバーはランダムなトークンを生成し、Cookieとしてクライアントに送信する。
2. クライアントはフォーム送信時に、このCookieの値を読み取り、リクエストパラメータ（またはカスタムヘッダー）としても送信する。
3. サーバーはCookie内のトークンとリクエストパラメータ内のトークンが一致するかを検証する。

攻撃者のサイトからはCookieの値を読み取れない（同一オリジンポリシーによる制約）ため、攻撃者はリクエストパラメータにトークンの正しい値を含めることができない。

```python
# Server-side: Double Submit Cookie implementation
import os
import hmac
import hashlib
from flask import Flask, request, make_response, abort

app = Flask(__name__)
SECRET_KEY = 'server-secret-key'

def generate_double_submit_token():
    """Generate a signed token for Double Submit Cookie."""
    random_value = os.urandom(32).hex()
    # Sign the token to prevent subdomain cookie injection
    signature = hmac.new(
        SECRET_KEY.encode(),
        random_value.encode(),
        hashlib.sha256
    ).hexdigest()
    return f'{random_value}.{signature}'

def validate_double_submit(cookie_token, request_token):
    """Validate Double Submit Cookie tokens."""
    if not cookie_token or not request_token:
        return False
    if not hmac.compare_digest(cookie_token, request_token):
        return False
    # Verify signature
    parts = cookie_token.split('.')
    if len(parts) != 2:
        return False
    random_value, signature = parts
    expected_sig = hmac.new(
        SECRET_KEY.encode(),
        random_value.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected_sig)

@app.route('/form', methods=['GET'])
def show_form():
    token = generate_double_submit_token()
    resp = make_response(f'''
        <form method="POST" action="/submit">
            <input type="hidden" name="csrf_token" value="{token}" />
            <input name="data" />
            <button type="submit">Submit</button>
        </form>
    ''')
    resp.set_cookie('csrf_token', token, httponly=False, samesite='Lax', secure=True)
    return resp

@app.route('/submit', methods=['POST'])
def handle_submit():
    cookie_token = request.cookies.get('csrf_token')
    form_token = request.form.get('csrf_token')

    if not validate_double_submit(cookie_token, form_token):
        abort(403)

    return 'Success'
```

#### Double Submit Cookieの注意点

素朴なDouble Submit Cookieパターンにはいくつかの脆弱性が知られている。

**サブドメインからのCookie注入**: 攻撃者がサブドメイン（例: `evil.sub.example.com`）を制御できる場合、親ドメインに対するCookieを設定できる可能性がある。これにより、攻撃者が自ら生成したトークンをCookieに注入し、同じ値をリクエストパラメータにも含めることでDouble Submitの検証を突破できる。

この問題を緩和するために、上記のコード例で示したように、トークンにサーバー側の秘密鍵による署名を含める（Signed Double Submit Cookie）ことが推奨される。署名されたトークンであれば、攻撃者は有効なトークンを自力で生成できない。

### 3.4 Origin / Referer ヘッダーの検証

#### 概要

ブラウザは、リクエスト送信時に`Origin`ヘッダーまたは`Referer`ヘッダーを付与する。これらのヘッダーにはリクエストの発信元情報が含まれるため、サーバー側でこれを検証することでCSRFを検出できる。

#### Originヘッダー

`Origin`ヘッダーは、POSTリクエストなど状態を変更するリクエストにブラウザが自動的に付与するヘッダーで、リクエストの発信元のスキーム、ホスト、ポートを示す。

```
Origin: https://bank.example.com
```

サーバー側では、このヘッダーの値が自サイトのオリジンと一致するかを検証する。

```python
# Origin header validation
ALLOWED_ORIGINS = {'https://bank.example.com', 'https://www.bank.example.com'}

def validate_origin(request):
    """Validate the Origin header of the request."""
    origin = request.headers.get('Origin')

    # If Origin header is missing, fall back to Referer
    if not origin:
        referer = request.headers.get('Referer')
        if referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            origin = f'{parsed.scheme}://{parsed.netloc}'

    if not origin:
        # No Origin or Referer — reject the request
        return False

    return origin in ALLOWED_ORIGINS
```

#### 限界

- `Origin`ヘッダーは、プライバシー保護のためにブラウザが送信しないケースがある（例: HTTPSからHTTPへのダウングレード時、一部のリダイレクト時）。
- `Referer`ヘッダーは、`Referrer-Policy`の設定やブラウザの設定によって省略される場合がある。
- したがって、Origin/Refererの検証は主要な防御手法としてではなく、補助的な多層防御の一つとして位置づけるべきである。

### 3.5 カスタムリクエストヘッダーによる防御

Ajax/fetch APIを使ったリクエストにカスタムヘッダー（例: `X-Requested-With: XMLHttpRequest`）を付与し、サーバー側でこのヘッダーの存在を検証する方法もある。

HTMLフォームからはカスタムヘッダーを送信できないため、フォームベースのCSRFを防ぐことができる。また、クロスオリジンのfetchリクエストにカスタムヘッダーを付与するとCORSプリフライトが発生するため、サーバーが適切にCORSを設定していれば、クロスオリジンからのリクエストも防げる。

```javascript
// Frontend: Always include a custom header
fetch('/api/action', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'  // Custom header
  },
  body: JSON.stringify(data)
});
```

```python
# Server-side: Verify custom header presence
@app.before_request
def check_custom_header():
    """Verify that state-changing requests include the custom header."""
    if request.method in ('POST', 'PUT', 'DELETE', 'PATCH'):
        if request.headers.get('X-Requested-With') != 'XMLHttpRequest':
            abort(403)
```

ただし、この方法はAjaxリクエストのみに適用でき、従来のフォーム送信には使えない。また、Flashなどのプラグインを通じてカスタムヘッダーを付与できた歴史的な脆弱性もあったため、単独での使用ではなく他の防御手法との併用が推奨される。

### 3.6 防御手法の比較

```mermaid
graph TB
    subgraph "ブラウザレベルの防御"
        A["SameSite Cookie<br/>（Lax / Strict）"]
    end

    subgraph "アプリケーションレベルの防御"
        B["CSRFトークン<br/>（Synchronizer Token）"]
        C["Double Submit Cookie"]
        D["Origin/Referer検証"]
        E["カスタムヘッダー検証"]
    end

    F["推奨: 多層防御<br/>複数手法の組み合わせ"]

    A --> F
    B --> F
    C --> F
    D --> F
    E --> F
```

| 手法 | サーバー側状態 | SPA対応 | サブドメイン攻撃耐性 | 古いブラウザ対応 |
|------|-------------|--------|-------------------|--------------|
| SameSite Cookie (Lax) | 不要 | 対応 | 弱い（eTLD+1判定） | 非対応 |
| CSRFトークン | 必要 | 対応（要工夫） | 強い | 対応 |
| Double Submit Cookie (署名付き) | 不要 | 対応 | 強い（署名時） | 対応 |
| Origin/Referer検証 | 不要 | 対応 | 強い | 部分対応 |
| カスタムヘッダー | 不要 | 対応 | 強い（CORS依存） | 対応 |

## 4. Login CSRF

### 4.1 概要

Login CSRF（ログインCSRF）は、通常のCSRFとは異なる方向性の攻撃である。通常のCSRFでは被害者の認証済みセッションを悪用するが、Login CSRFでは**攻撃者のアカウントで被害者をログインさせる**。

### 4.2 攻撃の流れ

```mermaid
sequenceDiagram
    participant Victim as 被害者
    participant Site as Webサイト
    participant Attacker as 攻撃者

    Note over Attacker: 攻撃者はサイトにアカウントを持っている
    Attacker->>Victim: 悪意のあるリンクを送信

    Note over Victim, Site: 被害者が攻撃者の認証情報でログインさせられる
    Victim->>Site: POST /login<br/>username=attacker&password=attacker_pass
    Site-->>Victim: Set-Cookie: session_id=xyz<br/>（攻撃者のセッション）

    Note over Victim: 被害者は自分のアカウントだと思って操作
    Victim->>Site: クレジットカード情報の登録
    Victim->>Site: 検索履歴の蓄積
    Victim->>Site: 個人情報の入力

    Note over Attacker: 攻撃者が自分のアカウントにログインして<br/>被害者の入力した情報を閲覧
```

### 4.3 被害の例

- **決済情報の窃取**: 被害者が攻撃者のアカウントにクレジットカード情報を登録すると、攻撃者がその情報を使用できる。
- **プライバシーの侵害**: 被害者の検索履歴、閲覧履歴が攻撃者のアカウントに蓄積される。
- **行動の監視**: 攻撃者のアカウントでログインさせることで、被害者のサイト上での行動を追跡できる。

### 4.4 防御

Login CSRFの防御には、ログインフォームにもCSRFトークンを適用することが基本となる。ログインフォームの場合、ユーザーはまだ認証されていないため、セッションに紐づかない「プレセッション」にCSRFトークンを保存する必要がある。

```python
@app.route('/login', methods=['GET'])
def login_form():
    # Generate pre-session CSRF token
    token = os.urandom(32).hex()
    session['_pre_login_csrf'] = token
    return f'''
        <form method="POST" action="/login">
            <input type="hidden" name="_csrf_token" value="{token}" />
            <input name="username" placeholder="Username" />
            <input name="password" type="password" placeholder="Password" />
            <button type="submit">Login</button>
        </form>
    '''

@app.route('/login', methods=['POST'])
def login():
    # Validate CSRF token even for login
    token = session.get('_pre_login_csrf')
    request_token = request.form.get('_csrf_token')
    if not token or not request_token or not hmac.compare_digest(token, request_token):
        abort(403)

    username = request.form['username']
    password = request.form['password']
    # ... authenticate user ...

    # IMPORTANT: Regenerate session after login to prevent session fixation
    session.clear()
    session['user_id'] = user.id
    return redirect('/dashboard')
```

## 5. CSRFとCORSの関係

### 5.1 よくある誤解

CSRFとCORS（Cross-Origin Resource Sharing）は混同されやすいが、根本的に異なるメカニズムである。

**CORS**は、クロスオリジンのリクエストに対する**レスポンスの読み取り**を制御する仕組みである。CORSがリクエストの送信自体を防ぐのは、プリフライトチェック（`OPTIONS`リクエスト）が必要な場合に限られる。

**CSRF**の問題は、リクエストが**送信されること自体**にある。攻撃者はレスポンスを読む必要がない——リクエストが送信され、サーバー側で処理されること自体が攻撃の成功である。

### 5.2 CORSがCSRFを防がないケース

HTMLフォームからのPOSTリクエスト（`Content-Type`が`application/x-www-form-urlencoded`、`multipart/form-data`、`text/plain`のいずれか）は「単純リクエスト」に分類され、**プリフライトチェックなしに送信される**。CORSはレスポンスの読み取りをブロックするだけで、リクエストの送信自体は阻止しない。

```mermaid
graph TD
    A["クロスオリジンリクエスト"] --> B{"プリフライトが<br/>必要か？"}
    B -->|"単純リクエスト<br/>(GET, POST + form content types)"| C["リクエスト送信される<br/>→ サーバーで処理される"]
    B -->|"プリフライト必要<br/>(カスタムヘッダー, JSON等)"| D["OPTIONSリクエスト送信"]
    C --> E{"CORSヘッダー<br/>確認"}
    D --> F{"サーバーが<br/>許可するか？"}
    E -->|"許可あり"| G["レスポンス読み取り可能"]
    E -->|"許可なし"| H["レスポンス読み取り不可<br/>（しかしリクエストは<br/>既に処理済み！）"]
    F -->|"許可"| I["実際のリクエスト送信"]
    F -->|"拒否"| J["リクエスト送信されない<br/>→ CSRF防止"]

    style H fill:#F44336,color:#fff
    style J fill:#4CAF50,color:#fff
```

この図が示すように、単純リクエストの場合、CORSはCSRFを防げない。サーバー側で処理が完了した後にレスポンスがブロックされるだけである。

### 5.3 CORSが防御に寄与するケース

`Content-Type: application/json`のPOSTリクエストはプリフライトチェックの対象となる。サーバーが適切にCORSを設定（信頼するオリジンのみを許可）していれば、プリフライトの段階でクロスオリジンからのJSONリクエストがブロックされる。

ただし、**CORSの設定ミス**は新たな脆弱性を生む。`Access-Control-Allow-Origin: *`やリクエストのOriginヘッダーをそのまま反映するような設定は、CSRF防御を無効化する。

```python
# DANGEROUS: Reflecting any origin — defeats CORS protection
@app.after_request
def add_cors_headers(response):
    # DO NOT DO THIS — this allows any origin
    origin = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response
```

```python
# SECURE: Whitelist of allowed origins
ALLOWED_ORIGINS = {'https://www.example.com', 'https://app.example.com'}

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response
```

## 6. 実際のCSRFインシデント

### 6.1 主要な事例

#### Gmail（2007年）

2007年に発見されたGmailのCSRF脆弱性は、CSRFの深刻さを世界に知らしめた代表的な事例である。攻撃者は、被害者がGmailにログインした状態で悪意のあるWebページを訪問させることにより、メールのフィルター設定を変更できた。具体的には、すべての受信メールを攻撃者のアドレスに転送するフィルターを作成することが可能であった。これにより、パスワードリセットメールを含む被害者のすべてのメールが攻撃者に転送され、他のサービスのアカウント乗っ取りにつながる深刻な脅威となった。

#### Netflix（2006年）

Netflixでは、ユーザーのDVDレンタルキューの操作やアカウント情報の変更がCSRFで可能であることが報告された。攻撃者は被害者のレンタルキューにDVDを追加したり、配送先住所を変更したりすることができた。

#### ING Direct（2008年）

オンラインバンキングサービスのING Directでは、CSRFを利用して被害者の口座から攻撃者の口座への送金が可能であることが発見された。金融サービスにおけるCSRF脆弱性の深刻さを示す事例として広く知られている。

#### YouTube（2008年）

2008年にYouTubeで発見されたCSRF脆弱性では、被害者のアカウントで動画をお気に入りに追加したり、チャンネルを購読したり、さらには連絡先リストにユーザーを追加したりすることが可能であった。

### 6.2 日本における事例

日本においては、2005年に大手SNS「mixi」で発生した「ぼくはまちちゃん」事件が著名である。これは厳密にはCSRFの変種ともいえる攻撃で、被害者が特定のURLをクリックすると、mixi上の日記に「ぼくはまちちゃん！」という内容の投稿が自動的に行われた。この投稿がさらに同じURLを含んでおり、連鎖的に拡散するワーム的な動作を示した。この事件はCSRF脆弱性の脅威を日本のWeb開発者コミュニティに広く認知させるきっかけとなった。

また、2012年に日本で大きな社会問題となった「パソコン遠隔操作事件」（いわゆる「PC遠隔操作ウイルス事件」）では、CSRFを利用して第三者のPCから脅迫文が投稿された事例が含まれており、無関係の利用者が誤認逮捕される事態に発展した。この事件は技術的な問題にとどまらず、CSRFが社会的に深刻な影響を及ぼし得ることを示した。

## 7. フレームワークレベルの保護

### 7.1 Django

DjangoはCSRF対策を標準で組み込んでおり、デフォルトで有効になっている。

```python
# Django: CSRF protection is enabled by default via middleware
# settings.py
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',  # CSRF protection
    # ...
]

# In templates, use the {% csrf_token %} tag
# templates/transfer.html
"""
<form method="POST" action="{% url 'transfer' %}">
    {% csrf_token %}
    <input name="to" />
    <input name="amount" />
    <button type="submit">Transfer</button>
</form>
"""

# For AJAX requests, Django provides a helper
# to read the CSRF token from the cookie
"""
// JavaScript: Read CSRF token from cookie
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(
                    cookie.substring(name.length + 1)
                );
                break;
            }
        }
    }
    return cookieValue;
}
const csrftoken = getCookie('csrftoken');

fetch('/api/transfer', {
    method: 'POST',
    headers: {
        'X-CSRFToken': csrftoken,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({to: 'friend', amount: 1000}),
});
"""
```

Djangoの実装は、Double Submit Cookieの署名付き変種を採用している。CSRFトークンはCookieに格納され、フォームのhiddenフィールドまたは`X-CSRFToken`ヘッダーとして送信される値と照合される。Django 4.0以降では、トークンにHMAC署名が付与されており、サブドメインからのCookie注入攻撃にも耐性がある。

### 7.2 Ruby on Rails

Railsも同様にCSRF対策が標準装備されている。

```ruby
# Rails: CSRF protection is included in ApplicationController
class ApplicationController < ActionController::Base
  # This is included by default — it enables CSRF protection
  protect_from_forgery with: :exception
end

# In views, the form helper automatically includes the CSRF token
# app/views/transfers/new.html.erb
# <%= form_with url: transfers_path do |form| %>
#   <!-- Rails automatically inserts a hidden authenticity_token field -->
#   <%= form.text_field :to %>
#   <%= form.number_field :amount %>
#   <%= form.submit "Transfer" %>
# <% end %>

# For API endpoints that don't use sessions:
class ApiController < ActionController::Base
  # Skip CSRF for stateless API endpoints using token auth
  skip_forgery_protection
  before_action :authenticate_with_token

  private

  def authenticate_with_token
    # Authenticate via Authorization header (not cookies)
    token = request.headers['Authorization']&.split(' ')&.last
    @current_user = User.find_by_api_token(token)
    head :unauthorized unless @current_user
  end
end
```

RailsではSynchronizer Token Patternを採用しており、CSRFトークンはセッションに紐づけて管理される。`form_with`や`form_for`ヘルパーを使うと、自動的に`authenticity_token`フィールドが挿入される。

Rails 5.2以降では、各フォームに固有の暗号化されたトークンを使用する「per-form CSRF tokens」がサポートされており、トークンの漏洩リスクをさらに低減している。

### 7.3 Spring Security

JavaのSpring Frameworkでは、Spring SecurityがCSRF対策を提供する。

```java
// Spring Security: CSRF protection is enabled by default
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // CSRF protection is ON by default
            // Explicit configuration shown for clarity
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()
            );
        return http.build();
    }
}

// In Thymeleaf templates, the CSRF token is automatically included
// <form th:action="@{/transfer}" method="post">
//     <!-- Thymeleaf automatically adds the CSRF token -->
//     <input type="text" name="to" />
//     <input type="number" name="amount" />
//     <button type="submit">Transfer</button>
// </form>
```

Spring Security 6では、CSRFトークンの遅延読み込み（lazy loading）がデフォルトとなり、BREACH攻撃への耐性を持つトークンのマスキング機能も組み込まれている。`CookieCsrfTokenRepository`を使用する場合はDouble Submit Cookieパターンで動作し、デフォルトの`HttpSessionCsrfTokenRepository`を使用する場合はSynchronizer Token Patternで動作する。

### 7.4 フレームワーク保護の注意点

フレームワークの組み込みCSRF対策は非常に有効であるが、以下の点に注意が必要である。

1. **保護の無効化**: 開発中の利便性のためにCSRF保護を無効化し、そのまま本番に反映してしまうケースは少なくない。APIエンドポイントのためにCSRF保護を無効化する場合は、代替の認証メカニズム（BearerトークンやAPIキーなど、Cookieに依存しない認証）が存在することを確認すべきである。

2. **対象外のメソッド**: 多くのフレームワークはGET、HEAD、OPTIONSなどの「安全な」HTTPメソッドをCSRF検証の対象外としている。これらのメソッドで状態変更を行わないことが前提である。

3. **ファイルアップロード**: マルチパートフォームでのファイルアップロードとCSRFトークンの組み合わせには、フレームワークによって実装上の注意点がある場合がある。

## 8. 現代のWebにおけるCSRFの位置づけ

### 8.1 SameSite Cookieのデフォルト化による変化

2020年のChrome 80以降、`SameSite`属性が指定されていないCookieは`SameSite=Lax`として扱われるようになった。Firefox、Edgeも同様のポリシーを採用しており、これによりCSRF攻撃の難易度は大幅に上昇した。

しかし、これでCSRFが完全に消滅したわけではない。以下の理由から、引き続きアプリケーションレベルの対策が推奨される。

- `SameSite=None`を明示的に設定しているCookieは保護されない（サードパーティCookieが必要なユースケース）。
- サブドメイン間の攻撃は依然として有効である。
- `SameSite=Lax`はGETリクエストのトップレベルナビゲーションを許可するため、GETで状態変更を行うアプリケーションは脆弱なままである。
- 一部のブラウザ（特に古いバージョンや特殊な環境）ではSameSiteの挙動が異なる可能性がある。

### 8.2 Token認証とCSRF

JWT（JSON Web Token）やOAuthのアクセストークンをAuthorizationヘッダーで送信する方式では、Cookie自動送信の問題が発生しないため、CSRFの影響を受けない。

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

`Authorization`ヘッダーはブラウザが自動的に付与するものではなく、JavaScriptで明示的に設定する必要がある。攻撃者のサイトからは、被害者のローカルストレージやメモリに保存されたトークンにアクセスできないため、攻撃者がこのヘッダーを含むリクエストを偽造することは不可能である。

ただし、トークンをCookieに格納して送信する実装（例: JWTをCookieに保存するケース）では、通常のCookieベース認証と同様にCSRFの脅威が存在する点に注意が必要である。

### 8.3 多層防御のベストプラクティス

現代のWebアプリケーションでは、以下の組み合わせが推奨される。

```mermaid
graph LR
    subgraph "第1層: ブラウザ"
        A["SameSite=Lax Cookie"]
    end
    subgraph "第2層: アプリケーション"
        B["CSRFトークン"]
    end
    subgraph "第3層: 検証"
        C["Origin/Referer検証"]
    end
    subgraph "第4層: 設計"
        D["適切なHTTPメソッド設計<br/>GETで状態変更しない"]
    end

    A --> E["堅牢なCSRF防御"]
    B --> E
    C --> E
    D --> E
```

1. **SameSite Cookie**: セッションCookieに`SameSite=Lax`（または適切な場面で`Strict`）を設定する。
2. **CSRFトークン**: フレームワークの組み込み機能を活用し、状態変更リクエストにはCSRFトークンを要求する。
3. **Origin検証**: 補助的な対策として、Origin/Refererヘッダーの検証を行う。
4. **適切なHTTPメソッド設計**: 状態変更操作にはPOST/PUT/DELETE/PATCHを使用し、GETリクエストは副作用のない操作に限定する。
5. **重要操作の再認証**: 送金やパスワード変更などの重要な操作には、追加の認証（パスワードの再入力、多要素認証など）を要求する。

## 9. まとめ

CSRFは、Webの基本的な設計——サイト横断的なリクエストとCookieの自動送信——から生じる構造的な脆弱性である。攻撃の原理は単純であり、被害者のブラウザを踏み台として、認証済みセッションの権限で意図しない操作を実行させる。

長年にわたり、Synchronizer Token PatternをはじめとするCSRFトークンがこの問題に対する主要な防御策であった。2020年代に入り、SameSite Cookieのデフォルト化によってブラウザレベルでの防御が大きく前進したが、CSRFが完全に過去の脅威となったわけではない。サブドメイン攻撃、GETリクエストでの状態変更、SameSite=Noneを必要とするユースケースなど、依然として注意を要する領域は存在する。

現代のWeb開発者に求められるのは、CSRFの原理を正しく理解した上で、SameSite Cookie、CSRFトークン、Origin検証、適切なHTTPメソッド設計といった多層防御を組み合わせ、フレームワークの提供する保護機能を正しく活用することである。セキュリティとは単一の技術で解決するものではなく、複数の防御層を重ねることで初めて堅牢な保護が実現される。
