---
title: "OAuth 2.0 — 権限委譲の設計思想と実践"
date: 2026-03-01
tags: ["security", "oauth2", "authorization", "authentication", "web", "intermediate"]
---

# OAuth 2.0 — 権限委譲の設計思想と実践

## 1. 背景と動機

### 1.1 パスワード共有という原罪

Webサービスが相互に連携する世界において、ある根本的な問題が長く存在した。「サービスAがサービスBのデータにアクセスしたい場合、ユーザーはサービスAにサービスBのパスワードを教えなければならない」という問題である。

具体的な例を挙げよう。2000年代後半、あるサードパーティのTwitterクライアントアプリケーションがユーザーのツイートを取得・投稿するためには、ユーザーのTwitterのIDとパスワードを直接受け取り、そのクレデンシャルを使ってTwitter APIにアクセスするしかなかった。この方式には、致命的な問題が複数存在する。

**過剰な権限**: パスワードを渡すということは、アカウントの全権限を渡すことに等しい。ツイートの閲覧だけを許可したくても、パスワードを渡せばアカウント設定の変更やアカウントの削除すら可能になってしまう。

**取り消しの困難さ**: 一度パスワードを渡してしまうと、そのアプリケーションのアクセスだけを取り消すにはパスワード自体を変更するしかない。しかしパスワードを変更すると、他のすべてのアプリケーション連携も同時に壊れてしまう。

**信頼の連鎖の崩壊**: サードパーティアプリケーションがパスワードを安全に保管している保証はない。平文でデータベースに保存されているかもしれないし、そのサービスがハッキングされればパスワードが流出する。

**監査の不可能性**: サービスB側から見て、正規のユーザーによるアクセスなのか、パスワードを渡されたサードパーティによるアクセスなのかを区別する方法がない。

### 1.2 OAuthの誕生

この「パスワード共有アンチパターン」を解決するために、2007年頃からOAuthの議論が始まった。Blaine Cook（当時Twitterのリードエンジニア）やChris Messina、Larry Halversonらが中心となり、各社が独自に実装していたAPI認可の仕組みを標準化する動きが生まれた。

2010年にOAuth 1.0がRFC 5849として標準化されたが、実装の複雑さ（リクエストへの暗号学的署名が必要）やモバイル・Webアプリケーションへの適用の難しさが問題となった。そこで、よりシンプルで拡張性のある仕様としてOAuth 2.0が設計され、2012年にRFC 6749およびRFC 6750として策定された。

OAuth 2.0の核心的なアイデアはこうである。「ユーザーのパスワードを第三者に渡す代わりに、限定的な権限を持つアクセストークンを発行する仕組みを標準化する」。これにより、パスワード共有の問題をすべて解決できる。

### 1.3 OAuth 1.0からOAuth 2.0への進化

OAuth 1.0とOAuth 2.0は名前こそ似ているが、設計思想がかなり異なる。

| 比較項目 | OAuth 1.0 | OAuth 2.0 |
|---------|-----------|-----------|
| リクエスト署名 | 必須（HMAC-SHA1等） | 不要（TLSに依存） |
| トークン種別 | 1種類 | アクセストークン + リフレッシュトークン |
| スコープ | 仕様外 | 仕様に含まれる |
| クライアント種別 | 区別なし | Confidential / Public |
| トランスポート | HTTP/HTTPS | HTTPS必須 |
| 拡張性 | 低い | グラントタイプで拡張可能 |

OAuth 2.0は暗号学的署名の要件を排除し、セキュリティをTLS（Transport Layer Security）に委ねることで、実装のハードルを大幅に下げた。これは当時、論争を呼んだ設計判断であった。OAuth 1.0の主要設計者の一人であるEran Hammer-Lahavは、OAuth 2.0の設計プロセスに対する不満から仕様策定チームを離脱している。しかし結果的には、OAuth 2.0の簡潔さがその普及を後押しし、現在のWebにおける認可の事実上の標準となった。

## 2. 認可と認証の根本的な違い

### 2.1 OAuth 2.0は認可のプロトコルである

OAuth 2.0を正しく理解するために最も重要な概念上の区別がある。それは「認証（Authentication）」と「認可（Authorization）」の違いである。

- **認証（Authentication）**: 「あなたは誰ですか？」に答えること。ユーザーの身元を確認するプロセスである。パスポートの確認、指紋照合、パスワードの検証などが認証にあたる。
- **認可（Authorization）**: 「あなたは何をしてよいですか？」に答えること。身元が確認された主体に対して、特定のリソースへのアクセス権限を付与するプロセスである。入館証、アクセス権限リスト、切符などが認可にあたる。

```mermaid
graph LR
    A[ユーザー] -->|認証<br/>Authentication| B[あなたは誰？]
    B -->|ID確認済み| C[認可<br/>Authorization]
    C -->|何を許可？| D[アクセストークン発行]

    style B fill:#e1f5fe
    style C fill:#fff3e0
```

OAuth 2.0は**認可のプロトコル**であり、認証のプロトコルではない。OAuth 2.0のフロー自体は「このクライアントにこのリソースへのアクセスを許可するか」を決定するものであり、「このリクエストを送っている人が本当にそのユーザーであるか」を直接的に保証するものではない。

### 2.2 よくある誤解

「Googleでログイン」や「GitHubでログイン」のような機能を見て、OAuth 2.0を「ソーシャルログインのためのプロトコル」と捉えている人が多い。しかし実際には、これらのログイン機能はOAuth 2.0の上にOpenID Connect（OIDC）という認証レイヤーを構築することで実現されている。

OAuth 2.0単体では、「ユーザーがGoogleにログインして、このアプリにGoogleカレンダーへのアクセスを許可した」という情報は得られるが、「このアクセストークンを持っているのが本当にそのユーザーである」という保証は得られない。OIDCはこのギャップを埋めるために、OAuth 2.0の認可フローの中でIDトークン（JWT形式のユーザー情報）を発行する仕組みを追加した。

この区別は学術的な細かい話ではなく、セキュリティ上の実質的な意味を持つ。OAuth 2.0のアクセストークンを認証の証拠として扱うと、トークンの横取り（token substitution attack）などの脆弱性が生じうる。

## 3. OAuth 2.0のアーキテクチャ

### 3.1 登場人物（ロール）

OAuth 2.0のフローには4つの主要なロールが登場する。

```mermaid
graph TD
    RO[リソースオーナー<br/>Resource Owner<br/>ユーザー] -->|認可を与える| Client[クライアント<br/>Client<br/>サードパーティアプリ]
    Client -->|アクセストークンで<br/>リソースを要求| RS[リソースサーバー<br/>Resource Server<br/>API]
    Client -->|認可グラントを提示して<br/>トークンを要求| AS[認可サーバー<br/>Authorization Server<br/>IdP]
    RO -->|認証・認可の確認| AS

    style RO fill:#e8f5e9
    style Client fill:#fff3e0
    style RS fill:#e1f5fe
    style AS fill:#fce4ec
```

**リソースオーナー（Resource Owner）**: 保護されたリソースの所有者。通常はエンドユーザーである。「自分のGoogleカレンダーのデータに、このアプリがアクセスしてよいか」を判断する主体。

**クライアント（Client）**: リソースオーナーの代わりに保護されたリソースにアクセスしようとするアプリケーション。サードパーティのカレンダーアプリ、業務効率化ツールなどが該当する。

**リソースサーバー（Resource Server）**: 保護されたリソースをホストし、アクセストークンを受け入れてリソースを提供するサーバー。Google Calendar API、GitHub APIなどが該当する。

**認可サーバー（Authorization Server）**: リソースオーナーの認証を行い、認可を取得したうえでアクセストークンを発行するサーバー。Google Accounts、GitHub OAuthなどが該当する。実運用では、リソースサーバーと認可サーバーが同一のサービスに属していることが多い。

### 3.2 クライアントの種別

OAuth 2.0はクライアントを2つのタイプに分類する。この分類はセキュリティモデルに直結するため、極めて重要である。

**Confidentialクライアント**: クライアントシークレット（秘密鍵に相当する値）を安全に保管できるクライアント。サーバーサイドのWebアプリケーションが典型例である。サーバー上にシークレットを環境変数やシークレット管理サービスで保管し、エンドユーザーには決して露出しない。

**Publicクライアント**: クライアントシークレットを安全に保管できないクライアント。シングルページアプリケーション（SPA）、モバイルアプリ、デスクトップアプリが該当する。これらのアプリケーションではソースコードやバイナリにシークレットを埋め込んでも、リバースエンジニアリングや通信の傍受により容易に抽出されてしまう。

この区別が後述するグラントタイプの選択やPKCEの必要性に直結する。

### 3.3 スコープ（Scope）

スコープはアクセストークンに付与する権限の範囲を定義する仕組みである。リソースオーナーが認可する際に、クライアントに与えるアクセス範囲を細かく制御できる。

```
scope=read:calendar write:calendar read:profile
```

スコープの設計はリソースサーバーの責務であり、OAuth 2.0の仕様はスコープの具体的な形式を規定しない。実際のサービスでは以下のようなスコープが使われている。

| サービス | スコープ例 | 意味 |
|---------|-----------|------|
| Google | `https://www.googleapis.com/auth/calendar.readonly` | Googleカレンダーの読み取り |
| GitHub | `repo` | リポジトリへのフルアクセス |
| GitHub | `read:user` | ユーザープロフィールの読み取り |
| Slack | `chat:write` | メッセージの送信 |
| Spotify | `playlist-modify-public` | 公開プレイリストの編集 |

スコープの設計は「最小権限の原則」に基づくべきである。クライアントは必要最小限のスコープのみを要求し、リソースオーナーはその範囲を確認した上で認可を与える。

### 3.4 クライアント登録

OAuth 2.0のフローを開始する前に、クライアントは認可サーバーに事前登録する必要がある。登録時に以下の情報が設定される。

- **クライアントID（client_id）**: クライアントを一意に識別する公開値
- **クライアントシークレット（client_secret）**: Confidentialクライアントに発行される秘密の値
- **リダイレクトURI（redirect_uri）**: 認可コードやトークンの送信先URL。事前登録により、認可コードが攻撃者のサーバーに送信されることを防ぐ
- **許可するスコープ**: クライアントが要求可能なスコープの範囲

リダイレクトURIの事前登録は重要なセキュリティ機構である。認可サーバーは、認可リクエストで指定された `redirect_uri` が事前登録されたものと完全一致するかを検証しなければならない。

## 4. グラントタイプ（認可フロー）

OAuth 2.0は、異なるユースケースに対応するために複数のグラントタイプ（Grant Type）を定義している。それぞれのグラントタイプは、アクセストークンを取得するための異なるフローを規定する。

### 4.1 認可コードグラント（Authorization Code Grant）

認可コードグラントは、最も一般的かつ最も安全なグラントタイプである。サーバーサイドのWebアプリケーションにおいて推奨されるフローであり、SPAやモバイルアプリでもPKCE（後述）と組み合わせて使用される。

```mermaid
sequenceDiagram
    participant RO as リソースオーナー<br/>（ブラウザ）
    participant Client as クライアント<br/>（Webアプリ）
    participant AS as 認可サーバー
    participant RS as リソースサーバー

    Client->>RO: 1. 認可サーバーへリダイレクト
    RO->>AS: 2. 認可リクエスト<br/>(client_id, redirect_uri,<br/>scope, state)
    AS->>RO: 3. ログイン画面を表示
    RO->>AS: 4. 認証情報を入力
    AS->>RO: 5. 認可画面を表示<br/>「このアプリにXXの権限を<br/>許可しますか？」
    RO->>AS: 6. 認可を承認
    AS->>RO: 7. redirect_uriへリダイレクト<br/>(code, state)
    RO->>Client: 8. 認可コードがクライアントに到達
    Client->>AS: 9. トークンリクエスト<br/>(code, client_id,<br/>client_secret, redirect_uri)
    AS->>Client: 10. アクセストークン<br/>(+ リフレッシュトークン)
    Client->>RS: 11. APIリクエスト<br/>Authorization: Bearer <token>
    RS->>Client: 12. リソース返却
```

このフローの重要な特徴は、**アクセストークンがリソースオーナーのブラウザを経由しない**という点である。認可コードはブラウザ経由でクライアントに渡されるが、その認可コードをアクセストークンに交換するリクエスト（ステップ9）は、クライアントから認可サーバーへの直接のバックチャネル通信で行われる。これにより、アクセストークンがブラウザの履歴やログに残るリスクを排除できる。

各ステップをより詳細に見てみよう。

**認可リクエスト（ステップ2）**:

```
GET /authorize?
  response_type=code
  &client_id=CLIENT_ID
  &redirect_uri=https://client.example.com/callback
  &scope=read:calendar
  &state=xyz123
```

`state` パラメータはCSRF（Cross-Site Request Forgery）攻撃を防ぐためのランダムな値である。クライアントはこの値を生成してセッションに紐づけ、コールバック時に一致するかを検証する。

**トークンリクエスト（ステップ9）**:

```
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTHORIZATION_CODE
&redirect_uri=https://client.example.com/callback
&client_id=CLIENT_ID
&client_secret=CLIENT_SECRET
```

**トークンレスポンス（ステップ10）**:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcyBhIHJlZnJl...",
  "scope": "read:calendar"
}
```

認可コードは一回限りの使い捨てであり、通常10分以内に使用しなければ失効する。また、同一の認可コードが二度目に使用された場合、認可サーバーはそのコードで発行されたすべてのトークンを無効化すべきである（RFC 6749, Section 4.1.2）。

### 4.2 クライアントクレデンシャルグラント（Client Credentials Grant）

クライアントクレデンシャルグラントは、ユーザーが介在しないサービス間通信（Machine-to-Machine, M2M）のためのフローである。クライアント自身の認証情報のみでアクセストークンを取得する。

```mermaid
sequenceDiagram
    participant Client as クライアント<br/>（バックエンドサービス）
    participant AS as 認可サーバー
    participant RS as リソースサーバー

    Client->>AS: 1. トークンリクエスト<br/>(client_id, client_secret,<br/>scope)
    AS->>AS: 2. クライアント認証
    AS->>Client: 3. アクセストークン
    Client->>RS: 4. APIリクエスト<br/>Authorization: Bearer <token>
    RS->>Client: 5. リソース返却
```

**トークンリクエスト**:

```
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=CLIENT_ID
&client_secret=CLIENT_SECRET
&scope=analytics:read
```

このフローにはリソースオーナー（ユーザー）が登場しない。クライアント自身が「リソースオーナー」でもある。典型的なユースケースは以下の通りである。

- マイクロサービス間のAPI呼び出し
- バッチ処理からのAPI利用
- インフラ監視ツールからの管理API呼び出し
- CI/CDパイプラインからのデプロイAPI呼び出し

リフレッシュトークンは通常発行されない。クライアントは `client_secret` を保持しているため、いつでも新しいアクセストークンを取得できるからである。

### 4.3 デバイスコードグラント（Device Authorization Grant）

デバイスコードグラント（RFC 8628）は、入力機能が限られたデバイス（スマートTV、ゲーム機、CLIツール、IoTデバイスなど）のためのフローである。デバイス自身ではブラウザベースの認可フローを完了できないため、ユーザーに別のデバイス（スマートフォンやPC）で認可を行ってもらう。

```mermaid
sequenceDiagram
    participant Device as デバイス<br/>（スマートTV等）
    participant AS as 認可サーバー
    participant User as ユーザー<br/>（スマートフォン）

    Device->>AS: 1. デバイス認可リクエスト<br/>(client_id, scope)
    AS->>Device: 2. device_code, user_code,<br/>verification_uri
    Device->>Device: 3. 画面に表示<br/>「https://example.com/device に<br/>アクセスして WXYZ-1234 を入力」

    User->>AS: 4. verification_uriにアクセス
    AS->>User: 5. user_code入力画面
    User->>AS: 6. user_codeを入力
    AS->>User: 7. ログイン・認可画面
    User->>AS: 8. 認可を承認

    loop ポーリング（interval秒ごと）
        Device->>AS: 9. トークンリクエスト<br/>(device_code, client_id)
        AS->>Device: 10. "authorization_pending"<br/>or アクセストークン
    end
```

**デバイス認可リクエスト（ステップ1）**:

```
POST /device/code
Content-Type: application/x-www-form-urlencoded

client_id=CLIENT_ID
&scope=profile
```

**デバイス認可レスポンス（ステップ2）**:

```json
{
  "device_code": "GmRh...long_random_string",
  "user_code": "WXYZ-1234",
  "verification_uri": "https://example.com/device",
  "verification_uri_complete": "https://example.com/device?user_code=WXYZ-1234",
  "expires_in": 1800,
  "interval": 5
}
```

`user_code` は人間が読みやすく入力しやすい形式（通常8文字程度、ハイフン区切り）で設計される。`verification_uri_complete` はQRコードとして表示することで、ユーザーがスマートフォンのカメラでスキャンするだけで認可ページに遷移できるようにする工夫である。

デバイスは `interval` で指定された間隔（秒）でトークンエンドポイントをポーリングする。ユーザーがまだ認可を完了していない場合は `authorization_pending` エラーが返り、認可が完了すればアクセストークンが返る。

このフローは以下のサービスで実際に使われている。

- **YouTube**（スマートTV）: テレビ画面に表示されたコードをスマートフォンで入力してログイン
- **GitHub CLI**（`gh auth login`）: ターミナルに表示されたコードをブラウザで入力して認証
- **Microsoft Azure CLI**（`az login`）: 同様のフロー

### 4.4 廃止・非推奨のグラントタイプ

OAuth 2.0の初期仕様（RFC 6749）には、現在では非推奨とされているグラントタイプも含まれていた。OAuth 2.1の草案では、これらは正式に削除される予定である。

**インプリシットグラント（Implicit Grant）**: 認可コードを介さず、認可エンドポイントから直接アクセストークンを返すフローである。SPAのために設計されたが、アクセストークンがフラグメント（URL の `#` 以降）経由でブラウザに露出するため、トークン漏洩のリスクが高い。現在はPKCE付き認可コードグラントに置き換えられるべきである。

**リソースオーナーパスワードクレデンシャルグラント（Resource Owner Password Credentials Grant, ROPC）**: ユーザーのIDとパスワードをクライアントが直接受け取り、認可サーバーに送信してトークンを取得するフローである。これはOAuth 2.0が解決しようとした「パスワード共有問題」そのものであり、レガシーシステムからの移行用として存在していたに過ぎない。新規実装では使用すべきではない。

## 5. PKCE（Proof Key for Code Exchange）

### 5.1 認可コード横取り攻撃

認可コードグラントには、Publicクライアントにおいて重大なセキュリティ上の脆弱性が存在する。それは「認可コード横取り攻撃（Authorization Code Interception Attack）」である。

モバイルアプリケーションでは、カスタムURLスキーム（例: `myapp://callback`）をリダイレクトURIとして使用することが多い。しかし、同じカスタムURLスキームを登録した悪意あるアプリがデバイスにインストールされていた場合、認可コードがその悪意あるアプリに横取りされる可能性がある。

```mermaid
sequenceDiagram
    participant App as 正規アプリ
    participant Browser as ブラウザ
    participant AS as 認可サーバー
    participant Malicious as 悪意あるアプリ

    App->>Browser: 1. 認可リクエスト
    Browser->>AS: 2. ユーザーが認可
    AS->>Browser: 3. リダイレクト<br/>myapp://callback?code=AUTH_CODE
    Browser->>Malicious: 4. 悪意あるアプリが<br/>同じURLスキームで横取り!
    Malicious->>AS: 5. 横取りした認可コードで<br/>トークン取得
    AS->>Malicious: 6. アクセストークン発行
```

Publicクライアントは `client_secret` を持たないため、認可コードさえ手に入れれば誰でもトークンに交換できてしまう。

### 5.2 PKCEの仕組み

PKCE（Proof Key for Code Exchange、「ピクシー」と発音する）は、RFC 7636で定義された認可コード横取り攻撃への対策である。クライアントが認可リクエストごとに一時的な秘密（コードベリファイア）を生成し、認可コードとトークンリクエストを暗号学的に紐づける。

```mermaid
sequenceDiagram
    participant Client as クライアント
    participant AS as 認可サーバー

    Note over Client: code_verifier を生成<br/>（43-128文字のランダム文字列）
    Note over Client: code_challenge = <br/>BASE64URL(SHA256(code_verifier))

    Client->>AS: 1. 認可リクエスト<br/>(code_challenge,<br/>code_challenge_method=S256)
    AS->>AS: 2. code_challengeを保存
    AS->>Client: 3. 認可コード返却

    Client->>AS: 4. トークンリクエスト<br/>(code, code_verifier)
    AS->>AS: 5. SHA256(code_verifier)を計算し<br/>保存したcode_challengeと比較
    AS->>Client: 6. 一致すればトークン発行
```

**ステップの詳細**:

1. クライアントは暗号論的にランダムな文字列 `code_verifier` を生成する（43〜128文字、英数字と `-._~` のみ）
2. `code_verifier` のSHA-256ハッシュをBase64URLエンコードして `code_challenge` を計算する
3. 認可リクエストに `code_challenge` と `code_challenge_method=S256` を含める
4. 認可サーバーは `code_challenge` を認可コードと紐づけて保存する
5. トークンリクエスト時に `code_verifier`（ハッシュ前の原文）を送信する
6. 認可サーバーは受け取った `code_verifier` のSHA-256ハッシュを計算し、保存していた `code_challenge` と一致するかを検証する

この仕組みにより、たとえ認可コードが横取りされても、`code_verifier` を知らない攻撃者はトークンを取得できない。`code_challenge` はハッシュ値であるため、`code_verifier` を逆算することは計算上不可能（SHA-256の一方向性による）である。

**認可リクエスト**:

```
GET /authorize?
  response_type=code
  &client_id=CLIENT_ID
  &redirect_uri=https://client.example.com/callback
  &scope=read:calendar
  &state=xyz123
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
```

**トークンリクエスト**:

```
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTHORIZATION_CODE
&redirect_uri=https://client.example.com/callback
&client_id=CLIENT_ID
&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

### 5.3 PKCEの普遍化

当初PKCEはPublicクライアント（モバイルアプリ、SPA）向けの拡張として策定された。しかし、OAuth 2.1の草案では**すべてのクライアント（Confidentialクライアントを含む）でPKCEの使用が必須**とされている。これは、認可コードの横取りリスクがPublicクライアントに限定されないこと（TLSの終端やログからの漏洩など）が認識されたためである。

## 6. トークンの種類と管理

### 6.1 アクセストークン（Access Token）

アクセストークンは、保護されたリソースにアクセスするための認証情報である。クライアントはこのトークンをリソースサーバーへのリクエストに含めてアクセス権を証明する。

**Bearer Token**: OAuth 2.0で最も一般的なトークンの使用方法はBearer Token（RFC 6750）である。HTTPリクエストの `Authorization` ヘッダーに含めて送信する。

```
GET /api/calendar/events
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

「Bearer」とは「持参人」を意味する。つまり、このトークンを持っている者は誰でもリソースにアクセスできる。これは利便性が高い反面、トークンが漏洩した場合に不正アクセスを受けるリスクがある（後述のDPoPはこの問題を解決する）。

**トークンの形式**: OAuth 2.0の仕様はアクセストークンの形式を規定していない。実装としては以下の2種類が一般的である。

| 形式 | 説明 | 利点 | 欠点 |
|------|------|------|------|
| Opaque Token | ランダムな文字列。トークンの内容はリソースサーバーから認可サーバーに問い合わせて確認する | シンプル。即時無効化が容易 | 毎回の問い合わせが必要 |
| JWT | 自己完結型トークン。トークン自体にスコープ・有効期限等の情報を含む | リソースサーバーが単独で検証可能。スケーラブル | 即時無効化が困難。サイズが大きい |

大規模なシステムではJWT形式のアクセストークンが採用されることが多い。一方、セキュリティ要件が厳しく即時無効化が必須の場合はOpaque Tokenが適している。

**有効期限**: アクセストークンの有効期限は短く設定すべきである。一般的には15分〜1時間程度が推奨される。これにより、トークンが漏洩した場合の被害を時間的に限定できる。

### 6.2 リフレッシュトークン（Refresh Token）

リフレッシュトークンは、アクセストークンの有効期限が切れた際に、新しいアクセストークンを取得するためのトークンである。ユーザーに再度認可フローを実行させることなく、バックグラウンドでトークンを更新できる。

```mermaid
sequenceDiagram
    participant Client as クライアント
    participant AS as 認可サーバー
    participant RS as リソースサーバー

    Note over Client: アクセストークン期限切れ

    Client->>RS: 1. APIリクエスト（期限切れトークン）
    RS->>Client: 2. 401 Unauthorized

    Client->>AS: 3. トークンリフレッシュ<br/>(grant_type=refresh_token,<br/>refresh_token=xxx)
    AS->>AS: 4. リフレッシュトークンの<br/>有効性を検証（DB確認）
    AS->>Client: 5. 新アクセストークン<br/>(+ 新リフレッシュトークン)

    Client->>RS: 6. APIリクエスト（新トークン）
    RS->>Client: 7. リソース返却
```

**トークンリフレッシュリクエスト**:

```
POST /token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=dGhpcyBpcyBhIHJlZnJl...
&client_id=CLIENT_ID
&client_secret=CLIENT_SECRET
```

**リフレッシュトークンのセキュリティ特性**:

- リフレッシュトークンは**認可サーバーのデータベースに保存**され、サーバー側で無効化できる
- アクセストークンと異なり、リフレッシュトークンはリソースサーバーには送信されない（攻撃面が限定される）
- 有効期限は長く設定される（日単位〜月単位）が、無期限にすべきではない

**リフレッシュトークンローテーション**: セキュリティ強化のために、リフレッシュトークンを使用するたびに新しいリフレッシュトークンを発行し、古いものを無効化するパターンが推奨される。これにより、リフレッシュトークンが漏洩した場合でも、正規のクライアントがリフレッシュを行った時点で漏洩したトークンは無効化される。さらに、同一のリフレッシュトークンが二度使用された場合は、漏洩の可能性が高いと判断し、そのリフレッシュトークン系列に属するすべてのトークンを無効化すべきである。

### 6.3 トークンのライフサイクル

```mermaid
graph TD
    A[認可フロー完了] -->|発行| B[アクセストークン<br/>有効期限: 15分-1時間]
    A -->|発行| C[リフレッシュトークン<br/>有効期限: 7日-90日]

    B -->|期限切れ| D[アクセストークン失効]
    D -->|リフレッシュ| E{リフレッシュトークン<br/>有効？}
    E -->|Yes| F[新アクセストークン発行<br/>+ 新リフレッシュトークン]
    E -->|No| G[再認可が必要]

    C -->|使用| H[リフレッシュトークン<br/>ローテーション]
    H -->|旧トークン| I[無効化]
    H -->|新トークン| C

    B -->|明示的な取り消し| J[トークン失効<br/>RFC 7009]
    C -->|明示的な取り消し| J
```

### 6.4 トークンの取り消し（Token Revocation）

RFC 7009はトークンの明示的な取り消し（Revocation）のためのエンドポイントを定義している。ユーザーがログアウトする際や、アプリケーション連携を解除する際に使用される。

```
POST /revoke
Content-Type: application/x-www-form-urlencoded

token=eyJhbGciOiJSUzI1NiIs...
&token_type_hint=access_token
&client_id=CLIENT_ID
&client_secret=CLIENT_SECRET
```

リフレッシュトークンを取り消した場合、認可サーバーはそのリフレッシュトークンに紐づくアクセストークンも無効化すべきである。ただし、JWT形式のアクセストークンの場合、即時無効化は構造上困難であるため、短い有効期限で自然失効を待つか、ブラックリスト方式を併用する必要がある。

## 7. セキュリティ上の考慮事項

### 7.1 CSRF攻撃への対策

認可コードグラントにおけるCSRF攻撃は、攻撃者自身の認可コードを被害者のセッションに紐づけることで、被害者のアカウントに攻撃者のリソースを紐づける攻撃である。

**対策**: `state` パラメータを使用する。クライアントは認可リクエスト時にランダムな値を生成してセッションに保存し、コールバック時にその値が一致するかを検証する。PKCEを使用している場合、`code_verifier` が事実上のCSRF対策としても機能するが、`state` パラメータの使用も依然として推奨される。

### 7.2 リダイレクトURIの検証

認可サーバーは、認可リクエストの `redirect_uri` を事前登録されたURIと**完全一致**で検証しなければならない。部分一致やパターンマッチでの検証は、オープンリダイレクト攻撃のリスクを生む。

```
# 登録済み: https://client.example.com/callback

# OK（完全一致）
redirect_uri=https://client.example.com/callback

# NG（パスが異なる）
redirect_uri=https://client.example.com/callback/../evil

# NG（サブドメインが異なる）
redirect_uri=https://evil.client.example.com/callback
```

### 7.3 トークン漏洩への対策

アクセストークンが漏洩した場合の被害を最小化するために、以下の対策が重要である。

**最小スコープの原則**: クライアントは必要最小限のスコープのみを要求する。`read:calendar` で十分なのに `calendar` （読み書き両方）を要求してはならない。

**短い有効期限**: アクセストークンの有効期限を短く設定し、漏洩時の影響範囲を時間的に限定する。

**トークンバインディング（DPoP）**: DPoP（Demonstration of Proof-of-Possession, RFC 9449）は、Bearer Tokenの「持っていれば使える」問題を解決する仕組みである。クライアントは公開鍵/秘密鍵ペアを生成し、トークンリクエスト時に公開鍵をバインドする。リソースアクセス時には秘密鍵で署名したプルーフを添付する。これにより、トークンが漏洩しても秘密鍵を持たない攻撃者は使用できない。

### 7.4 クライアント認証の強化

Confidentialクライアントの認証方法として、`client_secret` をリクエストボディに含める方式（`client_secret_post`）は最もシンプルだが、最も安全とは言えない。より安全な方式として以下がある。

| 方式 | 説明 | セキュリティ |
|------|------|-------------|
| `client_secret_post` | リクエストボディに `client_secret` を含める | 基本 |
| `client_secret_basic` | HTTP Basic認証ヘッダーに含める | 基本 |
| `client_secret_jwt` | `client_secret` を使って署名したJWTで認証 | 高い |
| `private_key_jwt` | 秘密鍵で署名したJWTで認証 | 最も高い |
| mTLS | クライアント証明書による相互TLS認証 | 最も高い |

### 7.5 認可サーバーのメタデータ

RFC 8414は認可サーバーのメタデータを公開するための標準を定義している。 `.well-known/oauth-authorization-server` エンドポイントでサーバーの機能や各エンドポイントのURLをJSON形式で公開する。

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "revocation_endpoint": "https://auth.example.com/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": [
    "authorization_code",
    "client_credentials",
    "refresh_token"
  ],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": [
    "client_secret_basic",
    "client_secret_post",
    "private_key_jwt"
  ]
}
```

## 8. OAuth 2.0とAPIキーの比較

### 8.1 APIキー方式の特徴

APIキーは最もシンプルなAPI認証方式である。サービス提供者がランダムな文字列（APIキー）を発行し、クライアントはリクエストにそのキーを含めてアクセスする。

```
GET /api/data
X-API-Key: sk_live_abc123def456...
```

APIキーは理解しやすく実装が容易であるが、OAuth 2.0と比較すると以下の限界がある。

| 比較項目 | APIキー | OAuth 2.0 |
|---------|---------|-----------|
| ユーザー委任 | 不可（キーはサービス単位） | 可能（ユーザーが権限を委任） |
| 権限の粒度 | キー単位（粗い） | スコープで細かく制御可能 |
| 有効期限 | 通常は無期限 | アクセストークンは短命 |
| 取り消し | キーの再発行（影響が大きい） | トークン単位で取り消し可能 |
| ユーザー同意 | なし | 認可画面で明示的同意 |
| 標準化 | なし（サービスごとに異なる） | RFC標準 |
| 複雑さ | 非常にシンプル | 比較的複雑 |

### 8.2 使い分けの指針

**APIキーが適切な場面**:
- サービス間のシンプルなAPI連携（ユーザー委任不要）
- 内部システム間の通信
- 開発者向けAPIの基本的なアクセス制御
- 利用量の追跡・課金が主目的

**OAuth 2.0が適切な場面**:
- ユーザーが第三者にアクセス権限を委任する必要がある
- 細かい権限制御（スコープ）が必要
- ユーザーの明示的な同意が必要
- 短命なトークンによるセキュリティ強化が必要
- 標準化されたプロトコルによる相互運用性が必要

実際には両者を組み合わせて使用することも多い。例えばStripeは、基本的なAPI認証にAPIキーを使用しつつ、プラットフォーム連携（Connect）にはOAuth 2.0を使用している。

## 9. 実世界での採用と実践

### 9.1 主要サービスのOAuth 2.0実装

**Google**: OAuth 2.0の最も大規模な実装の一つ。Google APIs全体（Gmail, Calendar, Drive, YouTube等）へのアクセスにOAuth 2.0を使用している。OIDCにも対応し、「Googleでログイン」機能の基盤となっている。スコープは `https://www.googleapis.com/auth/` 形式の細かいURL形式で管理されている。

**GitHub**: OAuth AppsとGitHub Appsの2つのOAuth実装を提供している。GitHub Appsはより新しい方式で、リポジトリ単位のインストールと細かい権限管理が可能である。GitHub CLIの `gh auth login` ではデバイスコードグラントが使用されている。

**Microsoft（Azure AD / Entra ID）**: エンタープライズ環境における最大規模のOAuth 2.0 / OIDC実装である。Microsoft 365、Azure、Dynamics 365など全サービスの認証基盤として機能している。テナント（組織）ごとの認可サーバーを持ち、組織のポリシーに基づいたアクセス制御が可能である。

### 9.2 認可サーバーの実装選択肢

自社でOAuth 2.0の認可サーバーを実装する場合、以下の選択肢がある。

| 種別 | 代表例 | 特徴 |
|------|--------|------|
| IDaaS | Auth0, Okta, AWS Cognito, Firebase Auth | マネージドサービス。運用負荷が低い |
| OSS | Keycloak, Hydra (Ory), Dex | 自社インフラで運用。カスタマイズ性が高い |
| フレームワーク内蔵 | Spring Security (Java), Passport.js (Node.js) | アプリケーションに組み込む |
| フルスクラッチ | — | 推奨されない。セキュリティリスクが高い |

自前のOAuth 2.0認可サーバーをフルスクラッチで実装することは、よほどの理由がない限り推奨されない。仕様の細部に準拠することが難しく、セキュリティ上の見落としが致命的な脆弱性につながるためである。

### 9.3 実装時のチェックリスト

```
[クライアント側]
□ PKCEを使用している（Publicクライアントでは必須）
□ stateパラメータでCSRFを防いでいる
□ リダイレクトURIを固定値にしている
□ アクセストークンを安全に保管している
□ トークンの有効期限切れを適切に処理している
□ リフレッシュトークンを安全に保管している
□ 最小限のスコープのみを要求している

[認可サーバー側]
□ redirect_uriを完全一致で検証している
□ 認可コードを一回限りで使い捨てにしている
□ 認可コードの有効期限を短く設定している（10分以内）
□ PKCEのcode_challengeを検証している
□ リフレッシュトークンローテーションを実装している
□ トークン取り消しエンドポイントを提供している
□ HTTPSを強制している

[リソースサーバー側]
□ アクセストークンの署名を検証している
□ スコープに基づいたアクセス制御を実装している
□ トークンの有効期限を検証している
□ issuerとaudienceを検証している
```

## 10. OAuth 2.1と今後の方向性

### 10.1 OAuth 2.1の概要

OAuth 2.1は、OAuth 2.0とその後の拡張仕様（PKCE, Bearer Token Usage等）のベストプラクティスを統合し、非推奨の機能を削除した新しい仕様のドラフトである。RFC化に向けて策定が進められている。

**OAuth 2.1での主な変更点**:

| 変更点 | 説明 |
|--------|------|
| PKCEの必須化 | すべてのクライアントでPKCEを使用 |
| インプリシットグラントの削除 | セキュリティ上の問題から廃止 |
| ROPCグラントの削除 | パスワード共有アンチパターンの排除 |
| リフレッシュトークンの送信者制約 | Confidentialクライアントの認証、またはPKCEベースの制約を要求 |
| リダイレクトURIの完全一致 | パターンマッチの禁止を明文化 |

OAuth 2.1は新しい機能を追加するものではなく、既存のベストプラクティスを一つの仕様に統合するものである。すでにOAuth 2.0をベストプラクティスに従って実装しているシステムにとっては、実質的な変更はほとんどない。

### 10.2 GNAP（Grant Negotiation and Authorization Protocol）

GNAPはOAuth 2.0の後継として検討されている新しい認可プロトコルである。OAuth 2.0の設計時には存在しなかったユースケース（IoT、分散型アイデンティティ等）を見据え、より柔軟で拡張性の高い設計を目指している。

GNAPの主な特徴:
- リダイレクトに依存しないフロー設計
- より柔軟なクライアント認証
- リクエスト・レスポンスのJSON化
- 複数のリソースへの同時アクセス要求

ただし、GNAPはまだ標準化の初期段階であり、OAuth 2.0のエコシステムの規模と成熟度を考えると、当面はOAuth 2.0 / 2.1が主流であり続けると考えられる。

### 10.3 セキュリティの進化

OAuth 2.0のセキュリティは、Bearer Tokenモデルからの進化が重要なテーマである。

**DPoP（Demonstration of Proof-of-Possession）**: 前述の通り、トークンの所有証明を実現する仕組みである。Bearer Tokenの「持っていれば使える」モデルから、「持っていて、かつ秘密鍵で証明できなければ使えない」モデルへの移行を可能にする。

**RAR（Rich Authorization Requests, RFC 9396）**: 従来のスコープ（文字列のリスト）では表現できない複雑な認可要求を、JSON構造で記述できるようにする拡張である。例えば「口座Aから口座Bへ1000円の送金」のような、具体的な操作の認可を表現できる。

```json
{
  "type": "payment_initiation",
  "actions": ["initiate"],
  "locations": ["https://bank.example.com/payments"],
  "instructedAmount": {
    "currency": "JPY",
    "amount": "1000"
  },
  "creditorAccount": {
    "iban": "JP1234567890"
  }
}
```

## 11. まとめ

OAuth 2.0は「パスワードを第三者に渡すことなく、限定的なアクセス権限を委任する」という問題を解決するために設計された認可フレームワークである。その核心的な価値は以下の3点に集約される。

**権限の分離**: ユーザーのクレデンシャル（パスワード）とアクセス権限（トークン）を分離し、必要最小限の権限のみを第三者に委任できる。

**標準化**: 認可フローをRFC標準として定義することで、サービス間の相互運用性を実現した。Google、GitHub、Microsoft、Salesforceなど、あらゆる大規模サービスが同じプロトコルで認可を行える。

**拡張性**: グラントタイプによる柔軟なフロー選択、スコープによる細かい権限制御、PKCEやDPoPなどのセキュリティ拡張により、多様なユースケースに対応できる。

一方で、OAuth 2.0は「フレームワーク」であり「プロトコル」ではないという批判もある。仕様の柔軟性が高すぎるため、実装ごとの差異が大きく、真の相互運用性が確保されているとは言い難い面もある。OAuth 2.1はこの問題に対して、ベストプラクティスの標準化という形でアプローチしている。

実務においては、以下の原則を守ることが重要である。

1. **認可コードグラント + PKCEを基本とする**。インプリシットグラントやROPCは使わない
2. **認可と認証を区別する**。認証が必要ならOIDCを使う
3. **アクセストークンは短命に、リフレッシュトークンはローテーションする**
4. **認可サーバーの自前実装は避ける**。検証済みのIDaaSまたはOSSを使う
5. **最小スコープの原則を守る**。必要以上の権限を要求しない

OAuth 2.0は決して完璧な仕様ではないが、現実のWebにおける権限委譲の問題を実用的に解決する、十分に成熟したフレームワークである。その仕組みとセキュリティ特性を正しく理解した上で採用すれば、安全で柔軟なAPI連携基盤を構築できる。
