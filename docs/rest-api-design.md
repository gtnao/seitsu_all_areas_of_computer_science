---
title: "REST API設計原則"
date: 2026-03-01
tags: ["web", "backend", "api", "rest", "intermediate"]
---

# REST API設計原則

## はじめに

Web API はシステム間の連携を実現する要であり、その設計品質がサービスの保守性・拡張性・開発者体験を左右する。現在、多くの Web サービスが「REST API」を標榜しているが、実際には REST の本来の制約を十分に理解せず、単に HTTP を用いた API を REST と呼んでいるケースも少なくない。

本記事では、REST（Representational State Transfer）の歴史的背景と理論的基盤から出発し、実践的な API 設計原則を体系的に解説する。URI 設計、HTTP メソッドの使い分け、ステータスコードの選択、ページネーション、バージョニング、エラーハンドリング、HATEOAS、認証・認可に至るまで、プロダクション環境で求められる知識を網羅する。

## RESTの歴史的背景

### Roy Fielding の博士論文

REST は 2000 年に Roy Fielding が UC Irvine で提出した博士論文 "Architectural Styles and the Design of Network-based Software Architectures" で提唱されたアーキテクチャスタイルである。Fielding は HTTP/1.0 および HTTP/1.1 の仕様策定に深く関与した人物であり、REST は既存の Web アーキテクチャの原則を事後的に体系化したものである。

論文において Fielding は、ネットワークベースのソフトウェアアーキテクチャを評価するための枠組みとして複数のアーキテクチャスタイルを分析し、Web が成功した理由を 6 つの制約（Constraints）で説明した。REST は特定の技術やプロトコルに依存しない抽象的なアーキテクチャスタイルであり、HTTP はその代表的な実装例にすぎない。

### Web の成功とアーキテクチャスタイル

1990 年代の Web は爆発的に成長した。この成功を支えた要因は、疎結合な設計、段階的な拡張性、中間者（プロキシ、キャッシュ）の介在可能性にあった。Fielding は Web がなぜスケールできたのかを分析し、その本質を REST という形で抽出した。

```mermaid
timeline
    title REST と Web API の歴史
    1991 : World Wide Web の誕生
    1996 : HTTP/1.0 (RFC 1945)
    1999 : HTTP/1.1 (RFC 2616)
    2000 : Roy Fielding の博士論文で REST を提唱
    2005 : Web 2.0 と Ajax による REST API の普及
    2010 : スマートフォン時代、モバイル API の需要急増
    2013 : Richardson Maturity Model の普及
    2015 : OpenAPI (Swagger) 仕様の標準化
    2020 : GraphQL, gRPC との共存時代
```

## RESTの6つの制約

REST は以下の 6 つのアーキテクチャ制約で定義される。これらの制約を満たすことで、スケーラビリティ、単純性、可視性、可搬性、信頼性が実現される。

### 1. Client-Server（クライアント-サーバー）

ユーザーインターフェース（クライアント）とデータストレージ（サーバー）の関心事を分離する。この分離により、クライアントの可搬性が向上し、サーバー側のスケーラビリティが改善される。

```mermaid
graph LR
    C1[Web ブラウザ] --> S[REST API サーバー]
    C2[モバイルアプリ] --> S
    C3[他サービス] --> S
    S --> DB[(データストア)]
```

この分離があるからこそ、同一の API に対して Web フロントエンド、モバイルアプリ、他のマイクロサービスなど、異なるクライアントが独立して進化できる。

### 2. Stateless（ステートレス）

サーバーはクライアントのセッション状態を保持しない。各リクエストは、処理に必要なすべての情報を自己完結的に含まなければならない。

**メリット:**
- サーバー間の負荷分散が容易になる（どのサーバーに振り分けても同じ結果を返せる）
- 障害時のリカバリが簡素化される
- スケールアウトが容易である

**トレードオフ:**
- リクエストごとに認証情報等を送信する必要があり、ネットワーク帯域を余分に消費する
- セッションベースの機能（ショッピングカートなど）は、クライアント側または外部ストア（Redis など）で状態を管理する必要がある

```mermaid
sequenceDiagram
    participant Client
    participant LB as ロードバランサー
    participant S1 as サーバー A
    participant S2 as サーバー B

    Client->>LB: GET /orders (+ Authorization: Bearer token)
    LB->>S1: forward request
    S1-->>Client: 200 OK (orders list)

    Client->>LB: GET /orders/123 (+ Authorization: Bearer token)
    LB->>S2: forward request (different server)
    S2-->>Client: 200 OK (order detail)

    Note over S1,S2: Both servers can handle any request<br/>without shared session state
```

### 3. Cacheable（キャッシュ可能）

レスポンスは明示的または暗黙的にキャッシュ可能かどうかを示さなければならない。適切なキャッシュ制御により、クライアントは不要なリクエストを削減でき、サーバーの負荷を軽減し、レイテンシを改善できる。

HTTP の `Cache-Control`、`ETag`、`Last-Modified` などのヘッダーがこの制約の実装を担う。

### 4. Uniform Interface（統一インターフェース）

REST の最も重要な制約であり、REST を他のアーキテクチャスタイルと区別する中核要素である。統一インターフェースは以下の 4 つの下位制約から構成される。

| 下位制約 | 説明 |
|---------|------|
| リソースの識別 | URI によってリソースを一意に識別する |
| 表現によるリソース操作 | リソースの表現（JSON、XML など）を通じて操作を行う |
| 自己記述的メッセージ | 各メッセージはその処理方法を理解するための十分な情報を含む |
| HATEOAS | ハイパーメディアによってアプリケーション状態を遷移させる |

この制約により、クライアントとサーバーの実装が疎結合になり、中間者（プロキシ、ゲートウェイ）がメッセージを理解・処理できるようになる。

### 5. Layered System（階層化システム）

クライアントは直接サーバーに接続しているか、中間者（ロードバランサー、CDN、API ゲートウェイ）を経由しているかを区別できない。各層は隣接する層とのみ通信し、全体のアーキテクチャを知る必要がない。

```mermaid
graph TD
    Client[クライアント]
    CDN[CDN / キャッシュ]
    GW[API ゲートウェイ]
    Auth[認証サービス]
    App[アプリケーションサーバー]
    DB[(データベース)]

    Client --> CDN
    CDN --> GW
    GW --> Auth
    GW --> App
    App --> DB
```

### 6. Code-on-Demand（コードオンデマンド）- オプション

唯一のオプショナルな制約。サーバーがクライアントにコード（JavaScript など）を送信して実行させることを許可する。これによりクライアントの機能を動的に拡張できる。Web ブラウザが JavaScript を実行する仕組みがまさにこの制約の実例である。

## リソース設計とURI設計

### リソースとは何か

REST において最も基本的な概念が「リソース」である。リソースとは、名前を付けられるあらゆる情報のことであり、ドキュメント、画像、コレクション、サービスなどが含まれる。リソースはデータベースのテーブルと 1:1 対応する必要はない。ドメインの概念に基づいてリソースを設計することが重要である。

### URI設計の原則

URI（Uniform Resource Identifier）はリソースを一意に識別するアドレスである。良い URI 設計はAPI の使いやすさを大きく向上させる。

**基本原則:**

1. **名詞を使う（動詞は使わない）**: リソースは「もの」であり、操作は HTTP メソッドで表現する
2. **複数形を使う**: コレクションリソースは複数形で統一する
3. **階層構造を反映する**: スラッシュ（`/`）でリソースの親子関係を表現する
4. **小文字を使う**: URI は大文字小文字を区別するため、小文字で統一する
5. **ハイフンで単語を区切る**: アンダースコアよりハイフンが好まれる

```
# Good examples
GET /users
GET /users/123
GET /users/123/orders
GET /users/123/orders/456

# Bad examples
GET /getUsers          # Verb in URI
GET /user/123          # Singular for collection
GET /Users/123         # Uppercase
GET /user_orders/123   # Underscore
```

### リソースの種類

```mermaid
graph TD
    A[リソースの種類] --> B[コレクション<br>/users]
    A --> C[ドキュメント<br>/users/123]
    A --> D[コントローラー<br>/users/123/activate]
    A --> E[ストア<br>/users/123/favorites]

    B --> B1["GET: 一覧取得"]
    B --> B2["POST: 新規作成"]

    C --> C1["GET: 詳細取得"]
    C --> C2["PUT: 更新"]
    C --> C3["PATCH: 部分更新"]
    C --> C4["DELETE: 削除"]

    D --> D1["POST: アクション実行"]

    E --> E1["GET: 一覧取得"]
    E --> E2["PUT: 追加/更新"]
    E --> E3["DELETE: 削除"]
```

| 種類 | 説明 | 例 |
|------|------|----|
| コレクション | リソースの集合 | `/users`、`/orders` |
| ドキュメント | 単一のリソース | `/users/123` |
| コントローラー | 手続き的な操作（CRUD に収まらないアクション） | `/users/123/activate` |
| ストア | クライアント管理のリソースコレクション | `/users/123/favorites` |

### サブリソースとネストの深さ

リソース間の関係をURIの階層で表現できるが、ネストが深くなりすぎるとURLが長くなり扱いにくくなる。一般的に2階層程度に留めるのがよい。

```
# 2 levels deep (recommended)
GET /users/123/orders

# Deeply nested (avoid)
GET /users/123/orders/456/items/789/reviews

# Better: use top-level resource with query parameter
GET /reviews?order_item_id=789
```

## HTTPメソッドの正しい使い方

HTTP メソッドはリソースに対する操作の意図を表現する。REST API では、メソッドのセマンティクスを正しく使い分けることが重要である。

### 主要メソッドの特性

| メソッド | 用途 | 安全性 | 冪等性 | リクエストボディ |
|---------|------|--------|--------|----------------|
| GET | リソースの取得 | Yes | Yes | なし |
| POST | リソースの作成、アクションの実行 | No | No | あり |
| PUT | リソースの完全な置換 | No | Yes | あり |
| PATCH | リソースの部分更新 | No | No (*) | あり |
| DELETE | リソースの削除 | No | Yes | なし（通常） |
| HEAD | ヘッダー情報の取得（GET のボディなし版） | Yes | Yes | なし |
| OPTIONS | 通信オプションの確認（CORS preflight） | Yes | Yes | なし |

(*) PATCH は仕様上は冪等でないが、実装によっては冪等に設計できる。

**安全性（Safe）**: リソースの状態を変更しない。何度呼んでも副作用がない。

**冪等性（Idempotent）**: 同じリクエストを何度実行しても結果が同じになる。ネットワーク障害時のリトライを安全に行えるかどうかの指標となる。

### GET

リソースの取得に使用する。副作用を持ってはならない。

```http
GET /api/v1/users/123 HTTP/1.1
Host: api.example.com
Accept: application/json
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: max-age=60
ETag: "a1b2c3d4"

{
  "id": 123,
  "name": "Taro Yamada",
  "email": "taro@example.com",
  "created_at": "2025-01-15T10:30:00Z"
}
```

### POST

リソースの新規作成や、CRUD に収まらないアクションの実行に使用する。

```http
POST /api/v1/users HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...

{
  "name": "Hanako Suzuki",
  "email": "hanako@example.com"
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/v1/users/124

{
  "id": 124,
  "name": "Hanako Suzuki",
  "email": "hanako@example.com",
  "created_at": "2026-03-01T09:00:00Z"
}
```

### PUT vs PATCH

PUT はリソース全体を置換する。送信しなかったフィールドはデフォルト値にリセットされるか、エラーとなる。PATCH は部分的な更新を行う。

```http
# PUT: replace the entire resource
PUT /api/v1/users/123 HTTP/1.1
Content-Type: application/json

{
  "name": "Taro Yamada",
  "email": "taro.new@example.com",
  "role": "admin"
}
```

```http
# PATCH: update only specified fields
PATCH /api/v1/users/123 HTTP/1.1
Content-Type: application/json

{
  "email": "taro.new@example.com"
}
```

PUT と PATCH の使い分けに迷った場合、多くの実用的な API では PATCH による部分更新が主に使われる。PUT は「全フィールドを必ず送信する」というルールを守る必要があり、クライアントにとっての負担が大きい。

### DELETE

リソースの削除に使用する。冪等であるため、既に削除されたリソースに対する DELETE は 404 または 204 を返す。

```http
DELETE /api/v1/users/123 HTTP/1.1
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

```http
HTTP/1.1 204 No Content
```

## ステータスコードの選び方

HTTP ステータスコードは、リクエストの処理結果をクライアントに伝える標準化された仕組みである。適切なステータスコードを返すことで、クライアントはプログラム的にレスポンスを処理できる。

### ステータスコードの分類

```mermaid
graph TB
    S[HTTP ステータスコード] --> S1[1xx: 情報]
    S --> S2[2xx: 成功]
    S --> S3[3xx: リダイレクト]
    S --> S4[4xx: クライアントエラー]
    S --> S5[5xx: サーバーエラー]

    S2 --> S200["200 OK"]
    S2 --> S201["201 Created"]
    S2 --> S204["204 No Content"]

    S4 --> S400["400 Bad Request"]
    S4 --> S401["401 Unauthorized"]
    S4 --> S403["403 Forbidden"]
    S4 --> S404["404 Not Found"]
    S4 --> S409["409 Conflict"]
    S4 --> S422["422 Unprocessable Entity"]
    S4 --> S429["429 Too Many Requests"]

    S5 --> S500["500 Internal Server Error"]
    S5 --> S502["502 Bad Gateway"]
    S5 --> S503["503 Service Unavailable"]
```

### API設計でよく使うステータスコード

| コード | 名前 | 使用場面 |
|-------|------|---------|
| **200** | OK | GET の成功、PUT/PATCH の成功（レスポンスボディあり） |
| **201** | Created | POST によるリソース作成の成功。`Location` ヘッダーで新リソースの URI を返す |
| **204** | No Content | DELETE の成功、PUT/PATCH の成功（レスポンスボディなし） |
| **400** | Bad Request | リクエストの構文が不正（JSON パースエラーなど） |
| **401** | Unauthorized | 認証が必要、または認証情報が無効 |
| **403** | Forbidden | 認証済みだが、操作の権限がない |
| **404** | Not Found | リソースが存在しない |
| **405** | Method Not Allowed | 該当 URI でそのメソッドはサポートされていない |
| **409** | Conflict | リソースの現在の状態と矛盾する操作（楽観的ロックの競合など） |
| **422** | Unprocessable Entity | リクエストの構文は正しいが、バリデーションエラー |
| **429** | Too Many Requests | レートリミットを超過。`Retry-After` ヘッダーで再試行可能時刻を通知 |
| **500** | Internal Server Error | サーバー内部のエラー（バグ、未処理例外） |
| **502** | Bad Gateway | 上流サーバーから不正なレスポンスを受信 |
| **503** | Service Unavailable | サーバーが一時的に利用不可（メンテナンス、過負荷） |

### 400 vs 422 の使い分け

この二つは混乱しやすいが、以下のように整理できる。

- **400 Bad Request**: リクエストの形式が不正である。JSON のパースに失敗した、必須パラメータが欠けている、型が間違っているなど。
- **422 Unprocessable Entity**: リクエストの形式は正しいが、ビジネスルール上のバリデーションに失敗した。例えば、メールアドレスの形式が不正、値が範囲外、一意性制約に違反しているなど。

実務では多くの API が 400 に統一しているケースも多い。チーム内で一貫した使い分けを定めることが重要である。

### 401 vs 403 の使い分け

- **401 Unauthorized**: 認証されていない（トークンなし、トークン期限切れ、トークンが無効）。クライアントは認証をやり直す必要がある。
- **403 Forbidden**: 認証は成功したが、その操作を行う権限がない。再認証しても結果は変わらない。

## ページネーション、フィルタリング、ソート

大量のデータを扱う API では、クライアントが必要なデータだけを効率的に取得できる仕組みが不可欠である。

### ページネーション

代表的なページネーション方式を 3 つ紹介する。

#### オフセットベース

最も直感的だが、大量データでの性能に問題がある。

```http
GET /api/v1/users?offset=20&limit=10
```

```json
{
  "data": [...],
  "pagination": {
    "offset": 20,
    "limit": 10,
    "total": 253
  }
}
```

**メリット**: 任意のページに直接ジャンプできる。実装が容易。

**デメリット**: データの追加・削除が起きると、ページの境界がずれて同じアイテムが重複したり欠落する。`OFFSET` 値が大きいとデータベースのパフォーマンスが低下する（スキップする行をすべてスキャンする必要がある）。

#### カーソルベース

パフォーマンスに優れ、データの一貫性も高い。

```http
GET /api/v1/users?cursor=eyJpZCI6MjB9&limit=10
```

```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6MzB9",
    "has_more": true
  }
}
```

カーソルは通常、最後に取得したレコードの識別子（ID やタイムスタンプなど）を Base64 エンコードしたものである。データベース上では `WHERE id > :cursor ORDER BY id LIMIT :limit` のようなクエリとなり、インデックスを効率的に利用できる。

**メリット**: 大量データでも高速。データの追加・削除による不整合が起きにくい。

**デメリット**: 任意のページにジャンプできない。前のページに戻る操作が複雑。

#### ページ番号ベース

ユーザー向けの UI で直感的に使われる。

```http
GET /api/v1/users?page=3&per_page=10
```

内部的にはオフセットベースと同様の問題を抱えるが、UI の要件に合致する場合に使われる。

```mermaid
graph LR
    subgraph "オフセットベース"
        A1["offset=0, limit=10"] --> A2["offset=10, limit=10"] --> A3["offset=20, limit=10"]
    end

    subgraph "カーソルベース"
        B1["cursor=null"] --> B2["cursor=id_10"] --> B3["cursor=id_20"]
    end

    subgraph "ページ番号ベース"
        C1["page=1"] --> C2["page=2"] --> C3["page=3"]
    end
```

### フィルタリング

クエリパラメータを使ってリソースをフィルタリングする。

```http
# Simple equality filter
GET /api/v1/users?status=active&role=admin

# Range filter
GET /api/v1/orders?created_after=2026-01-01&created_before=2026-02-01

# Search / partial match
GET /api/v1/users?q=yamada

# Multiple values (OR condition)
GET /api/v1/products?category=electronics,books
```

より高度なフィルタリングが必要な場合は、フィルタ構文を導入するアプローチもある（例: `filter[status]=active&filter[age][gte]=18`）。

### ソート

```http
# Sort by single field (ascending by default)
GET /api/v1/users?sort=created_at

# Descending order (prefix with -)
GET /api/v1/users?sort=-created_at

# Multiple sort criteria
GET /api/v1/users?sort=-created_at,name
```

### フィールド選択（Sparse Fieldsets）

必要なフィールドのみを返すことで、レスポンスサイズを削減できる。

```http
GET /api/v1/users?fields=id,name,email
```

## バージョニング戦略

API は進化する。後方互換性のない変更（Breaking Change）を導入する際に、既存のクライアントを壊さないためにバージョニングが必要になる。

### 主要なバージョニング手法

```mermaid
graph TD
    V[API バージョニング] --> V1[URI パスに含める<br>/api/v1/users]
    V --> V2[クエリパラメータ<br>/api/users?version=1]
    V --> V3[カスタムヘッダー<br>X-API-Version: 1]
    V --> V4[Accept ヘッダー<br>Accept: application/vnd.example.v1+json]

    V1 --> P1["+ 直感的で分かりやすい<br>+ キャッシュしやすい<br>- URI がリソースの識別から離れる"]
    V2 --> P2["+ 実装が容易<br>- デフォルトバージョンの管理が複雑"]
    V3 --> P3["+ URI がクリーン<br>- ブラウザで直接テストしにくい"]
    V4 --> P4["+ REST の理念に最も合致<br>- Content Negotiation の複雑さ"]
```

| 手法 | 例 | 採用例 |
|------|----|----|
| URI パス | `/api/v1/users` | GitHub, Twitter(X), Stripe |
| クエリパラメータ | `/api/users?version=1` | Google (一部) |
| カスタムヘッダー | `X-API-Version: 1` | Azure |
| Accept ヘッダー | `Accept: application/vnd.github.v3+json` | GitHub (併用) |

実務的には **URI パス方式** が最も広く採用されている。直感的でわかりやすく、ドキュメント化しやすく、キャッシュとの相性もよい。

### バージョニングのベストプラクティス

- **破壊的変更を最小限にする**: フィールドの追加は非破壊的、フィールドの削除や型の変更は破壊的
- **非推奨化の猶予期間を設ける**: 旧バージョンの廃止前に十分な移行期間を提供する
- **変更履歴を明示する**: API の変更を Changelog として公開する
- **セマンティックバージョニングの考え方を取り入れる**: メジャーバージョンの変更のみ URI に反映する

## エラーハンドリングの設計

エラーレスポンスの品質は API の開発者体験に直結する。統一されたエラーフォーマットにより、クライアント側のエラー処理が簡素化される。

### エラーレスポンスのフォーマット

RFC 9457 (Problem Details for HTTP APIs) は、HTTP API のエラーレスポンスの標準フォーマットを定義している。

```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "One or more fields failed validation.",
  "instance": "/api/v1/users",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "code": "INVALID_FORMAT"
    },
    {
      "field": "age",
      "message": "Must be between 0 and 150",
      "code": "OUT_OF_RANGE"
    }
  ]
}
```

| フィールド | 説明 |
|-----------|------|
| `type` | エラーの種別を識別する URI（ドキュメントへのリンクでもある） |
| `title` | エラーの概要（人間可読） |
| `status` | HTTP ステータスコード |
| `detail` | このリクエスト固有のエラーの詳細説明 |
| `instance` | 問題が発生したリソースの URI |
| `errors` | バリデーションエラーの場合のフィールド別詳細（拡張フィールド） |

### エラー設計の原則

1. **一貫したフォーマット**: すべてのエラーレスポンスで同じ構造を使う
2. **マシンリーダブル**: エラーコードをプログラムで判定できるようにする
3. **ヒューマンリーダブル**: 開発者が読んで理解できるメッセージを含める
4. **セキュリティの考慮**: スタックトレースや内部実装の詳細を公開しない
5. **デバッグ支援**: リクエスト ID を含めることでログとの紐付けを容易にする

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json
X-Request-Id: req_abc123

{
  "type": "https://api.example.com/errors/internal-error",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred. Please contact support with the request ID.",
  "instance": "/api/v1/orders/789",
  "request_id": "req_abc123"
}
```

## HATEOASとRichardson Maturity Model

### Richardson Maturity Model

Leonard Richardson が提唱した REST の成熟度モデルは、API がどの程度 REST の原則に従っているかを 4 段階で評価する。

```mermaid
graph BT
    L0["Level 0: The Swamp of POX<br/>単一 URI + 単一メソッド（XML-RPC, SOAP）"]
    L1["Level 1: Resources<br/>リソースごとに個別の URI"]
    L2["Level 2: HTTP Verbs<br/>HTTP メソッドを正しく使い分け"]
    L3["Level 3: Hypermedia Controls<br/>HATEOAS による状態遷移"]

    L0 --> L1
    L1 --> L2
    L2 --> L3

    style L0 fill:#ff6b6b,color:#fff
    style L1 fill:#ffa726,color:#fff
    style L2 fill:#66bb6a,color:#fff
    style L3 fill:#42a5f5,color:#fff
```

#### Level 0: The Swamp of POX

すべてのリクエストが単一のエンドポイントに POST で送信される。SOAP や XML-RPC が典型例。

```http
POST /api HTTP/1.1

{
  "action": "getUser",
  "userId": 123
}
```

#### Level 1: Resources

リソースごとに個別の URI が割り当てられるが、HTTP メソッドの使い分けは行われない。

```http
POST /api/users/123
POST /api/users/123/delete
```

#### Level 2: HTTP Verbs

HTTP メソッドを正しく使い分ける。多くの「REST API」はこのレベルである。

```http
GET    /api/users/123
POST   /api/users
PUT    /api/users/123
DELETE /api/users/123
```

#### Level 3: Hypermedia Controls (HATEOAS)

レスポンスにハイパーメディアリンクが含まれ、クライアントはリンクを辿ってアプリケーションの状態を遷移する。

### HATEOAS

HATEOAS（Hypermedia as the Engine of Application State）は REST の統一インターフェース制約の一部であり、Fielding の論文における REST の核心的な要素である。

レスポンスに次に取りうるアクションへのリンクを含めることで、クライアントは API のドキュメントを事前に知らなくても、レスポンスを辿ることで機能を発見できる。

```json
{
  "id": 123,
  "status": "pending",
  "total": 5000,
  "items": [...],
  "_links": {
    "self": {
      "href": "/api/v1/orders/123"
    },
    "cancel": {
      "href": "/api/v1/orders/123/cancel",
      "method": "POST"
    },
    "payment": {
      "href": "/api/v1/orders/123/payment",
      "method": "POST"
    },
    "customer": {
      "href": "/api/v1/users/456"
    }
  }
}
```

注文が「発送済み」の場合、`cancel` や `payment` のリンクは含まれず、代わりに `track` のリンクが含まれるかもしれない。このように、リソースの現在の状態に応じて利用可能な操作が動的に変化する。

```mermaid
stateDiagram-v2
    [*] --> pending: POST /orders
    pending --> paid: POST /orders/{id}/payment
    pending --> cancelled: POST /orders/{id}/cancel
    paid --> shipped: (internal process)
    shipped --> delivered: (internal process)
    delivered --> [*]
    cancelled --> [*]

    note right of pending
        _links: cancel, payment
    end note
    note right of paid
        _links: self (read-only)
    end note
    note right of shipped
        _links: track
    end note
```

### HATEOASの現実

HATEOAS は REST の理論上は重要な概念だが、実務で完全に実装されている API は少ない。多くの API は Level 2（HTTP メソッドの正しい使い分け）に留まっている。

**採用が進まない理由:**
- クライアントの実装が複雑になる（リンクをパースして辿るロジックが必要）
- OpenAPI（Swagger）などの仕様記述ツールとの統合が難しい
- 型安全なクライアントコード生成との相性が悪い
- パフォーマンスへの影響（レスポンスサイズの増加）

**一方で有効な場面:**
- ワークフロー型の API（状態遷移が複雑で、次に取れるアクションが状態によって異なる）
- 長期的に進化する公開 API（クライアントがハードコーディングした URI に依存しない）
- API ゲートウェイやオーケストレーションレイヤーの設計

## 認証・認可

API を保護するには、認証（Authentication: 誰であるかの確認）と認可（Authorization: 何ができるかの制御）の仕組みが必要である。

### 認証方式の比較

```mermaid
graph TD
    A[API 認証方式] --> B[API Key]
    A --> C[OAuth 2.0]
    A --> D[JWT Bearer Token]

    B --> B1["+ 実装が最もシンプル<br>- セキュリティが低い<br>- 権限の細分化が困難"]
    C --> C1["+ 標準化された委譲認可<br>+ スコープによる権限制御<br>- 実装が複雑"]
    D --> D1["+ ステートレス検証<br>+ クレーム（属性）を含められる<br>- トークン失効が困難"]
```

### API Key

最もシンプルな認証方式。ヘッダーまたはクエリパラメータで API キーを送信する。

```http
GET /api/v1/data HTTP/1.1
X-API-Key: sk_live_abc123def456
```

主にサーバー間通信や公開 API の利用量管理に使われる。ユーザーの認証ではなく、アプリケーション（クライアント）の識別に適している。

### OAuth 2.0

ユーザーがサードパーティアプリケーションに対して、自分のリソースへの限定的なアクセスを許可するための標準的なフレームワーク。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Client as クライアントアプリ
    participant AuthServer as 認可サーバー
    participant API as リソースサーバー (API)

    User->>Client: 1. サービスを利用
    Client->>AuthServer: 2. 認可リクエスト（redirect）
    AuthServer->>User: 3. ログイン・同意画面
    User->>AuthServer: 4. 承認
    AuthServer->>Client: 5. 認可コード
    Client->>AuthServer: 6. 認可コードでアクセストークンを取得
    AuthServer->>Client: 7. アクセストークン（+ リフレッシュトークン）
    Client->>API: 8. API 呼び出し（Bearer token）
    API->>Client: 9. レスポンス
```

OAuth 2.0 はいくつかのグラントタイプ（認可フロー）を定義している。

| グラントタイプ | 用途 |
|--------------|------|
| Authorization Code | Web アプリ、モバイルアプリ（最も安全） |
| Authorization Code + PKCE | パブリッククライアント向け（SPA、モバイル） |
| Client Credentials | サーバー間通信（ユーザーが介在しない） |
| ~~Implicit~~ | **非推奨**（OAuth 2.1 で廃止） |
| ~~Resource Owner Password~~ | **非推奨**（OAuth 2.1 で廃止） |

### JWT（JSON Web Token）

JWT は認証トークンのフォーマットとして広く使われる。ヘッダー、ペイロード、署名の 3 つの部分を Base64URL エンコードし、ドット（`.`）で連結した文字列である。

```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiIxMjMiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3MDk0MDI4MDB9.
<signature>
```

```json
// Header
{
  "alg": "RS256",
  "typ": "JWT"
}

// Payload (claims)
{
  "sub": "123",
  "role": "admin",
  "exp": 1709402800,
  "iss": "https://auth.example.com"
}
```

**JWT のメリット:**
- サーバー側でセッションストアを参照せずにトークンを検証できる（ステートレス）
- ペイロードに任意の属性（クレーム）を含められる

**JWT の注意点:**
- トークンが失効前に漏洩した場合、サーバー側から無効化するのが難しい（ブラックリスト方式が必要）
- トークンサイズが大きくなりがちである
- 署名アルゴリズムの選択に注意が必要（`none` アルゴリズム攻撃、RS256 と HS256 の混同攻撃など）

### レートリミット

API の過剰利用を防ぐためにレートリミットを実装する。クライアントに残りの利用可能回数を通知するために標準的なヘッダーを使う。

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1709406400
```

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/rate-limit-exceeded",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "You have exceeded the rate limit of 1000 requests per hour."
}
```

代表的なレートリミットアルゴリズムとして、Token Bucket、Sliding Window、Fixed Window がある。

## 実践的な設計パターン

### 冪等性キー

POST リクエストは冪等でないため、ネットワーク障害時にリトライすると重複が発生する可能性がある。冪等性キー（Idempotency Key）パターンを使うことで、安全にリトライできる。

```http
POST /api/v1/payments HTTP/1.1
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "amount": 5000,
  "currency": "JPY",
  "source": "card_abc123"
}
```

サーバーは `Idempotency-Key` をキャッシュし、同じキーのリクエストが再度送られた場合は以前の結果を返す。Stripe API がこのパターンを広く普及させた。

```mermaid
sequenceDiagram
    participant C as クライアント
    participant S as サーバー
    participant DB as データベース
    participant Cache as 冪等性キャッシュ

    C->>S: POST /payments (Idempotency-Key: abc)
    S->>Cache: abc は存在するか?
    Cache-->>S: 存在しない
    S->>DB: 決済処理を実行
    DB-->>S: 成功
    S->>Cache: abc => レスポンスを保存
    S-->>C: 201 Created

    Note over C,S: Network timeout occurs...<br/>Client retries

    C->>S: POST /payments (Idempotency-Key: abc)
    S->>Cache: abc は存在するか?
    Cache-->>S: 存在する (cached response)
    S-->>C: 201 Created (same response, no duplicate charge)
```

### バルク操作

複数のリソースを一度に操作する場合のパターン。

```http
# Batch create
POST /api/v1/users/bulk HTTP/1.1
Content-Type: application/json

{
  "users": [
    {"name": "User A", "email": "a@example.com"},
    {"name": "User B", "email": "b@example.com"},
    {"name": "User C", "email": "c@example.com"}
  ]
}
```

```json
{
  "results": [
    {"status": "created", "id": 101},
    {"status": "created", "id": 102},
    {"status": "error", "error": {"field": "email", "message": "Already exists"}}
  ],
  "summary": {
    "total": 3,
    "succeeded": 2,
    "failed": 1
  }
}
```

バルク操作では、個々の操作の成功・失敗を個別に報告し、部分的な成功を許容するかどうかを設計で明確にすべきである。

### 長時間処理の非同期パターン

処理に時間がかかるリクエストには、非同期パターンを使用する。

```mermaid
sequenceDiagram
    participant C as クライアント
    participant S as サーバー

    C->>S: POST /api/v1/reports/generate
    S-->>C: 202 Accepted<br/>Location: /api/v1/jobs/job-789

    loop Polling
        C->>S: GET /api/v1/jobs/job-789
        S-->>C: 200 OK {"status": "processing", "progress": 60}
    end

    C->>S: GET /api/v1/jobs/job-789
    S-->>C: 200 OK {"status": "completed", "result_url": "/api/v1/reports/123"}

    C->>S: GET /api/v1/reports/123
    S-->>C: 200 OK (report data)
```

1. クライアントがリクエストを送信
2. サーバーは `202 Accepted` を返し、ジョブの状態を確認するための URL を `Location` ヘッダーで通知
3. クライアントは状態確認 URL をポーリングして進捗を確認
4. 処理完了後、結果のリソース URL を取得

### Content Negotiation

クライアントが `Accept` ヘッダーで希望するレスポンス形式を指定する。

```http
GET /api/v1/users/123 HTTP/1.1
Accept: application/json
```

```http
GET /api/v1/users/123 HTTP/1.1
Accept: application/xml
```

```http
GET /api/v1/users/123 HTTP/1.1
Accept: text/csv
```

サーバーがリクエストされた形式をサポートしていない場合は `406 Not Acceptable` を返す。

## API ドキュメンテーション

### OpenAPI (Swagger)

OpenAPI Specification（旧 Swagger Specification）は、REST API を記述するための標準的な仕様である。YAML または JSON 形式で API の構造を定義し、自動的にドキュメント、クライアントコード、サーバースタブを生成できる。

```yaml
openapi: 3.0.3
info:
  title: User API
  version: 1.0.0
paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: A list of users
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
  /users/{id}:
    get:
      summary: Get a user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: A single user
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        email:
          type: string
          format: email
      required:
        - id
        - name
        - email
```

### コード優先 vs 仕様優先

| アプローチ | 説明 | メリット | デメリット |
|-----------|------|---------|-----------|
| コード優先（Code-First） | コードからAPIドキュメントを生成 | 実装との乖離が少ない | API設計がコードに引きずられる |
| 仕様優先（Spec-First / Design-First） | 仕様を先に書き、コードを生成 | API設計をレビューしてから実装できる | 仕様と実装の同期を維持する必要がある |

大規模なチームや公開 API では仕様優先のアプローチが推奨される。API の設計を関係者がレビューしてから実装に着手することで、手戻りを減らせる。

## RESTの限界と代替技術

REST はあらゆるユースケースに最適というわけではない。問題領域に応じて適切な技術を選択することが重要である。

### RESTの弱点

1. **オーバーフェッチ / アンダーフェッチ**: 固定されたリソース構造のため、クライアントが必要とするデータと API が返すデータにギャップが生じやすい
2. **リアルタイム通信への不適合**: HTTP のリクエスト-レスポンスモデルはプッシュ型の通信に向かない
3. **型安全性の欠如**: JSON ベースの通信はスキーマが緩く、型安全なクライアントの生成が限定的
4. **N+1 リクエスト問題**: 関連リソースを取得するために複数回の API 呼び出しが必要になる場合がある

### 代替技術との比較

```mermaid
graph LR
    subgraph "API 技術の選択肢"
        REST["REST<br/>汎用的な Web API"]
        GraphQL["GraphQL<br/>柔軟なデータ取得"]
        gRPC["gRPC<br/>高性能なサービス間通信"]
        WebSocket["WebSocket<br/>リアルタイム双方向通信"]
    end

    REST --- R1["標準的な CRUD 操作<br/>公開 API<br/>キャッシュが重要"]
    GraphQL --- G1["多様なクライアント<br/>複雑なデータ取得<br/>フロントエンド主導"]
    gRPC --- GR1["マイクロサービス間通信<br/>低レイテンシ<br/>ストリーミング"]
    WebSocket --- W1["チャット<br/>通知<br/>リアルタイムダッシュボード"]
```

| 特性 | REST | GraphQL | gRPC |
|------|------|---------|------|
| プロトコル | HTTP/1.1, HTTP/2 | HTTP | HTTP/2 |
| データ形式 | JSON (主に) | JSON | Protocol Buffers |
| 型安全性 | 低 (OpenAPI で補完) | 中 (スキーマ) | 高 (proto 定義) |
| キャッシュ | HTTP キャッシュが活用可能 | 困難 (POST のみ) | 困難 |
| リアルタイム | 非対応 (SSE で部分対応) | Subscription | ストリーミング |
| 学習コスト | 低 | 中 | 高 |
| ブラウザサポート | ネイティブ | ライブラリ必要 | gRPC-Web が必要 |

### 使い分けの指針

- **REST**: 公開 API、一般的な CRUD 操作、HTTP キャッシュが有効な場面
- **GraphQL**: フロントエンドの多様なデータ要件、モバイルアプリ（帯域幅の節約）
- **gRPC**: マイクロサービス間の内部通信、高パフォーマンスが要求される場面
- **WebSocket**: リアルタイム双方向通信が必要な場面

これらは排他的ではなく、同一システム内で組み合わせて使うことが一般的である。例えば、公開 API は REST、内部サービス間は gRPC、フロントエンド向けは GraphQL の BFF（Backend for Frontend）を用意する、といったアーキテクチャが現実的である。

## 実例に学ぶAPI設計

### GitHub API

GitHub REST API（v3）は REST API 設計の優れた実例として広く参照される。

```http
# List repositories for a user
GET /users/octocat/repos?sort=updated&per_page=10

# Create a repository
POST /user/repos
{
  "name": "hello-world",
  "description": "My first repository",
  "private": false
}

# Get a specific issue
GET /repos/octocat/hello-world/issues/42

# Add a label to an issue
POST /repos/octocat/hello-world/issues/42/labels
["bug", "priority-high"]
```

GitHub API の特徴:
- リソース指向の URI 設計
- リンクヘッダー（`Link`）を用いたページネーション
- `Accept` ヘッダーによるバージョン指定
- レートリミットヘッダーの付与
- Conditional Request（`If-None-Match`、`If-Modified-Since`）のサポート

### Stripe API

Stripe API は決済 API のデファクトスタンダードであり、開発者体験の高さで知られる。

**特徴的な設計:**
- 冪等性キーのサポート
- Expand パラメータによる関連リソースの展開（N+1 リクエストの回避）
- Cursor-based ページネーション
- 豊富なフィルタリングオプション
- Webhook によるイベント通知

```http
# Expand related objects to avoid N+1
GET /v1/charges/ch_123?expand[]=customer&expand[]=invoice
```

## セキュリティのベストプラクティス

REST API のセキュリティは認証・認可だけに留まらない。以下の対策を総合的に実施する。

1. **HTTPS の強制**: すべての API 通信を TLS で暗号化する
2. **入力値の検証**: すべてのリクエストパラメータをサーバー側で検証する（クライアント側の検証だけに頼らない）
3. **レートリミット**: DoS 攻撃や API の乱用を防止する
4. **CORS の適切な設定**: ブラウザからの API 呼び出しを想定する場合、許可するオリジンを最小限に制限する
5. **セキュリティヘッダーの付与**: `X-Content-Type-Options: nosniff`、`Strict-Transport-Security` など
6. **ログと監査**: API の呼び出しログを記録し、不審なアクセスパターンを検知する
7. **秘密情報の漏洩防止**: レスポンスにパスワードハッシュ、内部 ID、スタックトレースなどを含めない
8. **適切なトークン有効期限**: アクセストークンの有効期限を短く設定し、リフレッシュトークンで更新する

## まとめと将来展望

### 設計原則の要約

REST API の設計において押さえるべき要点を整理する。

| 原則 | 要点 |
|------|------|
| リソース指向 | URI は名詞で設計し、操作は HTTP メソッドで表現する |
| 適切なステータスコード | 処理結果を正確に伝えるステータスコードを返す |
| 一貫したエラーフォーマット | RFC 9457 に準拠した構造化されたエラーレスポンスを返す |
| ページネーション | 大量データにはカーソルベースを優先し、パフォーマンスと一貫性を確保する |
| バージョニング | URI パス方式が最も実用的。破壊的変更は最小限に抑える |
| 認証・認可 | OAuth 2.0 + JWT がモダンな標準。適切なスコープと有効期限を設定する |
| セキュリティ | HTTPS、入力検証、レートリミット、適切な CORS 設定を徹底する |
| ドキュメント | OpenAPI 仕様で API を記述し、開発者体験を向上させる |

### 将来展望

REST は 20 年以上にわたり Web API の主要なアーキテクチャスタイルであり続けているが、技術の進化とともに API の世界も変化している。

**進化の方向性:**

1. **API ゲートウェイの高度化**: 認証、レートリミット、キャッシュ、変換などの横断的関心事が API ゲートウェイに集約される傾向が加速している
2. **API ファーストの設計文化**: API を製品として設計する「API-as-a-Product」の考え方が浸透し、開発者体験（DX）の重要性が増している
3. **型安全な API クライアント**: OpenAPI からの型安全なクライアントコード生成が一般化し、REST の型安全性の弱点が補完されつつある
4. **マルチプロトコルの共存**: REST、GraphQL、gRPC を使い分ける「適材適所」のアプローチが主流になりつつある
5. **AI/LLM 時代の API**: LLM がツールとして API を呼び出す時代において、機械可読性の高い API 設計（明確なスキーマ、自己記述的なレスポンス）の重要性が増している

REST の本質は特定の技術ではなく、分散システムにおけるインターフェース設計の原則である。HTTP/3 や QUIC といった新しいトランスポート層の進化、エッジコンピューティングの普及、AI エージェントによる API 呼び出しの増加など、技術環境の変化に対しても REST の根底にある設計哲学は有効であり続けるだろう。

重要なのは、REST のラベルに囚われることではなく、API の利用者（人間の開発者であれ機械であれ）にとって予測可能で一貫性のある、使いやすいインターフェースを設計することである。
