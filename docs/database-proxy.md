---
title: "データベースプロキシ — PgBouncer, ProxySQL, RDS Proxy"
date: 2026-03-05
tags: ["databases", "database-proxy", "connection-pooling", "pgbouncer", "intermediate"]
---

# データベースプロキシ — PgBouncer, ProxySQL, RDS Proxy

## 1. データベースプロキシの必要性

### なぜアプリケーションとデータベースの間に「もう一層」が必要なのか

現代のWebアプリケーションは、数百から数万の同時接続を受け付ける。しかし、データベースサーバーはその全てに直接対応できるわけではない。PostgreSQL や MySQL といったリレーショナルデータベースでは、1つのクライアント接続ごとにプロセスやスレッドを確保する設計が一般的であり、接続数が増えるとメモリ消費やコンテキストスイッチのコストが急激に増大する。

例えば PostgreSQL では、1接続あたり約 5〜10 MB のメモリを消費する。1,000 接続を直接張れば、それだけで 5〜10 GB がコネクション管理に費やされることになる。これはクエリ処理やバッファキャッシュに使えるはずのリソースを圧迫する。

```
# Without proxy: each app instance opens many connections directly
App Instance 1 ──── 20 connections ────┐
App Instance 2 ──── 20 connections ────┤
App Instance 3 ──── 20 connections ────├──► Database (60 connections)
...                                    │
App Instance N ──── 20 connections ────┘
```

データベースプロキシは、アプリケーションとデータベースの間に配置される中間層であり、以下の課題を解決する。

| 課題 | プロキシによる解決策 |
|------|---------------------|
| 接続数の爆発 | コネクションプーリングによる接続の多重化 |
| フェイルオーバーの複雑さ | 自動的なヘルスチェックと接続先切り替え |
| 読み書き分離の実装コスト | クエリルーティングによる透過的な振り分け |
| 接続確立のレイテンシ | 事前に確立済みの接続を再利用 |
| セキュリティ管理 | TLS 終端や認証の一元管理 |

### アーキテクチャ上の位置づけ

データベースプロキシはOSI参照モデルでいうレイヤー7（アプリケーション層）で動作する。データベースのワイヤープロトコル（PostgreSQL の場合は libpq プロトコル、MySQL の場合は MySQL Client/Server プロトコル）を理解し、SQL クエリの内容を解析できる点が、一般的な TCP プロキシ（レイヤー4）との大きな違いである。

```mermaid
graph TB
    subgraph Application Tier
        A1[App Instance 1]
        A2[App Instance 2]
        A3[App Instance 3]
    end

    subgraph Proxy Tier
        P[Database Proxy]
    end

    subgraph Database Tier
        Primary[(Primary DB)]
        Replica1[(Replica 1)]
        Replica2[(Replica 2)]
    end

    A1 --> P
    A2 --> P
    A3 --> P
    P -->|Write| Primary
    P -->|Read| Replica1
    P -->|Read| Replica2
    Primary -.->|Replication| Replica1
    Primary -.->|Replication| Replica2
```

## 2. コネクションプーリング

### コネクションプーリングの基本概念

コネクションプーリングは、データベースプロキシが提供する最も基本的かつ重要な機能である。その本質は「少数のデータベース接続を多数のクライアント接続で共有する」ことにある。

アプリケーションから見ると、プロキシに接続している間はデータベースに直接接続しているように見える。しかし実際には、プロキシがデータベースへの接続プールを管理し、クライアントのリクエストに応じて接続を割り当て・回収している。

```mermaid
sequenceDiagram
    participant C1 as Client 1
    participant C2 as Client 2
    participant C3 as Client 3
    participant P as Proxy (Pool)
    participant DB as Database

    Note over P,DB: Pool has 2 server connections

    C1->>P: Connect
    P->>P: Assign server conn #1
    C1->>P: SELECT * FROM users
    P->>DB: Forward query (conn #1)
    DB->>P: Result
    P->>C1: Forward result
    C1->>P: Transaction complete
    P->>P: Return conn #1 to pool

    C2->>P: Connect
    P->>P: Assign server conn #1 (reused!)
    C2->>P: INSERT INTO orders ...
    P->>DB: Forward query (conn #1)
    DB->>P: Result
    P->>C2: Forward result

    C3->>P: Connect
    P->>P: Assign server conn #2
    C3->>P: SELECT * FROM products
    P->>DB: Forward query (conn #2)
    DB->>P: Result
    P->>C3: Forward result
```

### プーリングモード

コネクションプーリングには、接続の共有粒度に応じていくつかのモードがある。

#### セッションプーリング（Session Pooling）

クライアントがプロキシに接続している間、サーバー接続が専有される。クライアントが切断するとサーバー接続がプールに返却される。最も安全だが、プーリングの恩恵が最も小さいモードである。

- **利点**: アプリケーション側の変更が不要。セッション変数、PREPARE 文、LISTEN/NOTIFY など全ての機能がそのまま使える。
- **欠点**: 長時間接続を保持するアプリケーションでは効果が薄い。

#### トランザクションプーリング（Transaction Pooling）

トランザクションの開始から終了までの間だけサーバー接続を割り当てる。トランザクション外では接続がプールに返却されるため、最も効率的なモードである。

- **利点**: 少ないサーバー接続で多数のクライアントを捌ける。一般的な Web アプリケーションに最適。
- **欠点**: トランザクションをまたぐセッション状態（PREPARE 文、SET コマンド、LISTEN/NOTIFY、カーソルなど）が使えない。

#### ステートメントプーリング（Statement Pooling）

1つの SQL 文の実行が完了するたびにサーバー接続を返却する。最も積極的な共有だが、マルチステートメントトランザクションが使えないため、実用的にはほとんど使われない。

- **利点**: 理論上最大のプーリング効率。
- **欠点**: トランザクションが事実上使えない（AUTOCOMMIT のみ）。

```mermaid
graph LR
    subgraph Session Pooling
        SC1[Client 1 connected] -->|"1:1 mapping<br>during session"| SS1[Server Conn 1]
        SC2[Client 2 connected] -->|"1:1 mapping<br>during session"| SS2[Server Conn 2]
    end

    subgraph Transaction Pooling
        TC1[Client 1 in TX] -->|"1:1 mapping<br>during TX only"| TS1[Server Conn 1]
        TC2[Client 2 idle] -.->|"no server conn<br>assigned"| TS1
    end

    subgraph Statement Pooling
        StC1[Client 1 query] -->|"1:1 mapping<br>per statement"| StS1[Server Conn 1]
    end
```

### プーリングの数学的効果

コネクションプーリングの効果は、クライアントのアクティブ率（実際にクエリを発行している時間の割合）に大きく依存する。

典型的な Web アプリケーションでは、1つのリクエスト処理にかかる時間のうち、データベースと実際に通信している時間は全体の 10〜30% 程度であることが多い。残りはアプリケーションロジックの実行、外部 API の呼び出し、レスポンスの構築などに費やされる。

仮にアクティブ率が 20% であれば、トランザクションプーリングを使うことで、理論上は 5 倍のクライアントを同じ数のサーバー接続で処理できる。つまり、100 本のサーバー接続で 500 クライアントを捌ける計算になる。

$$
\text{必要サーバー接続数} \approx \text{同時クライアント数} \times \text{アクティブ率}
$$

ただし実際には、バースト的なアクセスや長時間トランザクションを考慮して、理論値よりも余裕を持たせる必要がある。

## 3. PgBouncer

### 概要

PgBouncer は PostgreSQL 専用の軽量なコネクションプーラーで、PostgreSQL コミュニティで最も広く使われているデータベースプロキシである。C 言語で書かれており、メモリフットプリントが非常に小さい（数千接続を管理しても数十 MB 程度）。シングルスレッドの イベント駆動アーキテクチャで動作する。

### アーキテクチャ

PgBouncer はシンプルな設計思想を持つ。libev（もしくは libevent）を使ったイベントループで、全ての接続を1つのスレッドで処理する。これにより、ロック競合やスレッド間同期のオーバーヘッドがなく、非常に低レイテンシの転送を実現している。

```mermaid
graph TB
    subgraph PgBouncer Process
        EL[Event Loop<br>single-threaded]
        CP[Connection Pool Manager]
        AUTH[Authentication Module]
        QR[Query Router]
    end

    C1[Client 1] --> AUTH
    C2[Client 2] --> AUTH
    C3[Client N] --> AUTH
    AUTH --> EL
    EL --> CP
    CP --> QR
    QR --> PG1[(PostgreSQL Primary)]
    QR --> PG2[(PostgreSQL Replica)]
```

### 設定例

PgBouncer の設定は `pgbouncer.ini` ファイルで行う。基本的な設定例を以下に示す。

```ini
;; pgbouncer.ini

[databases]
; database_name = connection_string
mydb = host=db-primary.example.com port=5432 dbname=mydb
mydb_ro = host=db-replica.example.com port=5432 dbname=mydb

[pgbouncer]
; Listening address and port
listen_addr = 0.0.0.0
listen_port = 6432

; Authentication
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Pool mode: session, transaction, or statement
pool_mode = transaction

; Pool size settings
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3

; Connection limits
max_client_conn = 1000
max_db_connections = 50

; Timeouts
server_idle_timeout = 600
client_idle_timeout = 0
client_login_timeout = 60
query_timeout = 0
query_wait_timeout = 120

; Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1

; TLS settings
client_tls_sslmode = prefer
client_tls_key_file = /etc/pgbouncer/server.key
client_tls_cert_file = /etc/pgbouncer/server.crt
```

### 主要なパラメータの解説

| パラメータ | 説明 | 推奨値 |
|-----------|------|--------|
| `pool_mode` | プーリングモード | `transaction`（Webアプリ向け） |
| `default_pool_size` | データベースごとのデフォルトプールサイズ | CPU コア数 × 2〜4 |
| `max_client_conn` | 最大クライアント接続数 | アプリの同時接続数に合わせる |
| `max_db_connections` | データベースへの最大接続数 | PostgreSQL の `max_connections` 以下 |
| `reserve_pool_size` | 負荷急増時の予備接続数 | `default_pool_size` の 25% 程度 |
| `query_wait_timeout` | プール枯渇時の待機上限 | 30〜120 秒 |

### トランザクションプーリング利用時の注意点

トランザクションプーリングモードでは、以下の PostgreSQL 機能が正しく動作しない。これらはセッション状態に依存しており、トランザクション間でサーバー接続が切り替わると状態が失われるためである。

::: warning トランザクションプーリングで使えない機能
- **PREPARE / DEALLOCATE**: プリペアドステートメントはセッションに紐づく
- **SET / RESET**: セッション変数の変更
- **LISTEN / NOTIFY**: 非同期通知はセッション単位
- **LOAD**: サーバーサイド拡張のロード
- **WITH HOLD カーソル**: トランザクション外で有効なカーソル
- **一時テーブル**: セッション終了まで存在するため、トランザクション間で消える可能性がある
:::

::: tip 回避策
PostgreSQL 14 以降では `PREPARE` の代わりにプロトコルレベルの Extended Query を使うことで、一部のフレームワーク（例: JDBC）がトランザクションプーリングと互換性を持てるようになった。PgBouncer 1.21 以降では `prepared_statement` パラメータにより、プリペアドステートメントのトラッキングと再作成をプロキシ側で処理できる機能が追加されている。
:::

### 管理コンソール

PgBouncer は管理用の仮想データベース（`pgbouncer`）を提供しており、`psql` などの PostgreSQL クライアントで接続して状態を確認できる。

```sql
-- Connect to PgBouncer admin console
-- psql -p 6432 -U admin pgbouncer

-- Show pool statistics
SHOW POOLS;

-- Show active connections
SHOW CLIENTS;
SHOW SERVERS;

-- Show configuration
SHOW CONFIG;

-- Show statistics
SHOW STATS;

-- Reload configuration without restart
RELOAD;

-- Gracefully disconnect all clients and servers
PAUSE mydb;
RESUME mydb;
```

`SHOW POOLS` の出力例:

```
 database |   user    | cl_active | cl_waiting | sv_active | sv_idle | sv_used | sv_tested | sv_login | maxwait | pool_mode
----------+-----------+-----------+------------+-----------+---------+---------+-----------+----------+---------+-----------
 mydb     | appuser   |        45 |          3 |        18 |       2 |       0 |         0 |        0 |     0.2 | transaction
```

ここで重要な指標は以下のとおりである。

- **cl_active**: アクティブなクライアント接続数
- **cl_waiting**: サーバー接続の割り当てを待っているクライアント数（これが恒常的に 0 より大きい場合、プールサイズの拡大を検討すべき）
- **sv_active**: 実際にクエリを処理しているサーバー接続数
- **sv_idle**: アイドル状態のサーバー接続数
- **maxwait**: 最大待機時間（秒）

## 4. ProxySQL

### 概要

ProxySQL は MySQL / MariaDB / Percona Server 向けの高機能データベースプロキシである。PgBouncer がシンプルさを追求しているのに対し、ProxySQL はクエリルーティング、クエリキャッシュ、クエリリライト、フェイルオーバーなど、豊富な機能を備えている。C++ で書かれ、マルチスレッドアーキテクチャで動作する。

### アーキテクチャ

ProxySQL は複数のレイヤーで構成されている。

```mermaid
graph TB
    subgraph ProxySQL
        direction TB
        NET[Network Layer<br>Multi-threaded]
        QP[Query Processor]
        QC[Query Cache]
        QRW[Query Rewrite Engine]
        HG[Hostgroup Manager]
        MON[Monitor Module]
        ADMIN[Admin Interface<br>port 6032]
    end

    C[Clients] --> NET
    NET --> QP
    QP --> QC
    QP --> QRW
    QRW --> HG
    HG --> M1[(MySQL Primary<br>hostgroup 0)]
    HG --> M2[(MySQL Replica 1<br>hostgroup 1)]
    HG --> M3[(MySQL Replica 2<br>hostgroup 1)]
    MON -->|Health Check| M1
    MON -->|Health Check| M2
    MON -->|Health Check| M3
```

### ホストグループとクエリルール

ProxySQL の最大の特徴は、ホストグループ（hostgroup）とクエリルール（query rules）による柔軟なルーティングである。

ホストグループは、同じ役割を持つデータベースサーバーの論理的なグループである。典型的には、書き込み用のプライマリ（hostgroup 0）と読み取り用のレプリカ群（hostgroup 1）に分ける。

```sql
-- Add backend servers
INSERT INTO mysql_servers (hostgroup_id, hostname, port, weight)
VALUES
    (0, 'mysql-primary.example.com', 3306, 1),    -- Writer
    (1, 'mysql-replica1.example.com', 3306, 100),  -- Reader
    (1, 'mysql-replica2.example.com', 3306, 100);  -- Reader

-- Define query rules for read/write splitting
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup, apply)
VALUES
    (1, 1, '^SELECT .* FOR UPDATE$', 0, 1),        -- SELECT FOR UPDATE -> Writer
    (2, 1, '^SELECT', 1, 1),                        -- Other SELECTs -> Reader
    (3, 1, '.*', 0, 1);                             -- Everything else -> Writer

-- Apply changes
LOAD MYSQL SERVERS TO RUNTIME;
LOAD MYSQL QUERY RULES TO RUNTIME;
SAVE MYSQL SERVERS TO DISK;
SAVE MYSQL QUERY RULES TO DISK;
```

### クエリキャッシュ

ProxySQL はプロキシ内でクエリ結果をキャッシュできる。頻繁に実行される参照系クエリの結果をプロキシ層でキャッシュすることで、データベースへの負荷を大幅に削減できる。

```sql
-- Enable query cache for specific queries
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, cache_ttl, destination_hostgroup, apply)
VALUES
    -- Cache product catalog queries for 60 seconds
    (10, 1, '^SELECT .* FROM products WHERE category', 60000, 1, 1),
    -- Cache user profile queries for 30 seconds
    (11, 1, '^SELECT .* FROM user_profiles WHERE user_id', 30000, 1, 1);

LOAD MYSQL QUERY RULES TO RUNTIME;
```

::: warning クエリキャッシュの注意点
ProxySQL のクエリキャッシュはクエリ文字列の完全一致でキャッシュキーを生成する。パラメータが異なるクエリは別のキャッシュエントリとなる。また、キャッシュされたデータは古くなる可能性があるため、TTL の設定は慎重に行う必要がある。データの一貫性が重要なクエリにはキャッシュを適用しないこと。
:::

### 設定の動的変更

ProxySQL の大きな利点は、設定の変更を再起動なしに適用できることである。設定は3つのレイヤーで管理される。

```mermaid
graph TB
    RUNTIME[RUNTIME<br>現在稼働中の設定]
    MEMORY[MEMORY<br>管理インターフェースで編集中の設定]
    DISK[DISK<br>永続化された設定<br>SQLite DB]

    MEMORY -->|"LOAD ... TO RUNTIME"| RUNTIME
    RUNTIME -->|"SAVE ... TO MEMORY"| MEMORY
    MEMORY -->|"SAVE ... TO DISK"| DISK
    DISK -->|"LOAD ... FROM DISK"| MEMORY
```

この3層構造により、設定変更を安全にテストしてから本番適用できる。MEMORY 層で変更を行い、問題がなければ RUNTIME に適用し、最後に DISK に永続化する。問題があれば RUNTIME から MEMORY にロードし直すことで、即座にロールバックできる。

### モニタリングモジュール

ProxySQL は内蔵のモニタリングモジュールにより、バックエンドサーバーのヘルスチェックを自動的に行う。

```sql
-- Configure monitoring
UPDATE global_variables SET variable_value='monitor_user'
    WHERE variable_name='mysql-monitor_username';
UPDATE global_variables SET variable_value='monitor_pass'
    WHERE variable_name='mysql-monitor_password';

-- Health check intervals (milliseconds)
UPDATE global_variables SET variable_value='2000'
    WHERE variable_name='mysql-monitor_ping_interval';
UPDATE global_variables SET variable_value='1000'
    WHERE variable_name='mysql-monitor_ping_timeout';

-- Replication lag monitoring
UPDATE global_variables SET variable_value='2000'
    WHERE variable_name='mysql-monitor_replication_lag_interval';
UPDATE global_variables SET variable_value='10'
    WHERE variable_name='mysql-monitor_replication_lag_timeout';

LOAD MYSQL VARIABLES TO RUNTIME;
```

レプリケーション遅延が閾値を超えたレプリカを自動的にルーティング対象から除外する機能も備えている。これにより、古いデータを読み取るリスクを軽減できる。

## 5. RDS Proxy / Cloud SQL Auth Proxy

### クラウドマネージドプロキシの登場

クラウドプロバイダーは、自社のマネージドデータベースサービスに最適化されたプロキシを提供している。これらは自前でプロキシを運用する手間を省きつつ、クラウド固有の利点（IAM 統合、自動スケーリング、高可用性）を提供する。

### AWS RDS Proxy

RDS Proxy は AWS が提供するフルマネージドのデータベースプロキシで、Amazon RDS および Amazon Aurora（MySQL / PostgreSQL）に対応している。

```mermaid
graph LR
    subgraph VPC
        Lambda[Lambda Function]
        ECS[ECS Task]
        EC2[EC2 Instance]

        subgraph RDS Proxy
            EP[Endpoint]
            CP2[Connection Pool]
            PM[Pin Management]
        end

        subgraph RDS
            Primary[(Aurora Primary)]
            Reader1[(Aurora Reader 1)]
            Reader2[(Aurora Reader 2)]
        end
    end

    SM[AWS Secrets Manager]

    Lambda --> EP
    ECS --> EP
    EC2 --> EP
    EP --> CP2
    CP2 --> Primary
    CP2 --> Reader1
    CP2 --> Reader2
    SM -.->|"Credentials"| CP2
```

#### RDS Proxy の特徴

**IAM 認証との統合**: データベースのパスワードを AWS Secrets Manager で管理し、アプリケーションは IAM 認証でプロキシに接続できる。これにより、データベースパスワードをアプリケーションコードや環境変数に直接埋め込む必要がなくなる。

**Lambda との親和性**: AWS Lambda はリクエストごとに実行環境が作られ、短時間で破棄される。この特性上、Lambda から直接 RDS に接続すると、接続の確立と切断が頻繁に発生し、データベースに大きな負荷がかかる。RDS Proxy を間に置くことで、Lambda の実行環境が変わっても接続プールを共有でき、この問題を解消できる。

**ピニング（Pinning）の概念**: RDS Proxy では、特定の条件下でクライアント接続がサーバー接続に「固定」される。これをピニングと呼ぶ。ピニングが発生すると、その接続はプーリングの恩恵を受けられなくなる。

ピニングが発生する条件の例:
- セッション変数の変更（`SET` 文）
- 一時テーブルの作成
- ユーザー定義変数の使用
- カーソルの使用
- PREPARE 文の実行（MySQL の場合）

```sql
-- This causes pinning in RDS Proxy
SET SESSION wait_timeout = 28800;

-- Workaround: use init_query in the proxy configuration
-- or application-level connection parameters
```

::: tip ピニングの回避
RDS Proxy のピニングを最小化するには、セッション変数の変更を避け、コネクションの初期化パラメータをプロキシ側の `init_query` で設定する。また、CloudWatch メトリクスの `DatabaseConnectionsCurrentlySessionPinned` を監視し、ピニング率が高い場合はアプリケーションコードの見直しを検討する。
:::

#### RDS Proxy の設定（Terraform 例）

```hcl
resource "aws_db_proxy" "app_proxy" {
  name                   = "app-db-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.proxy_role.arn
  vpc_subnet_ids         = var.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.proxy_sg.id]

  # Idle client connection timeout (seconds)
  idle_client_timeout = 1800

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "REQUIRED"
    secret_arn  = aws_secretsmanager_secret.db_credentials.arn
  }

  tags = {
    Environment = "production"
  }
}

resource "aws_db_proxy_default_target_group" "app_proxy_tg" {
  db_proxy_name = aws_db_proxy.app_proxy.name

  connection_pool_config {
    # Maximum percentage of available connections the proxy can use
    max_connections_percent      = 80
    # Percentage of connections kept open even when idle
    max_idle_connections_percent = 50
    # Seconds a connection can be borrowed before being returned
    connection_borrow_timeout    = 120
    # SQL to run on each new connection
    init_query                   = "SET timezone='UTC'"
  }
}

resource "aws_db_proxy_target" "app_proxy_target" {
  db_proxy_name          = aws_db_proxy.app_proxy.name
  target_group_name      = aws_db_proxy_default_target_group.app_proxy_tg.name
  db_cluster_identifier  = aws_rds_cluster.app_cluster.id
}
```

### Cloud SQL Auth Proxy（Google Cloud）

Google Cloud の Cloud SQL Auth Proxy は、RDS Proxy とは設計思想が異なる。Cloud SQL Auth Proxy はコネクションプーリング機能を持たず、主に以下の2つの機能を提供する。

1. **セキュアな接続**: Cloud SQL インスタンスへの接続を自動的に TLS で暗号化する
2. **IAM 認証**: Google Cloud IAM を使った認証を提供する

```mermaid
graph LR
    subgraph Application Host
        App[Application]
        Proxy[Cloud SQL Auth Proxy<br>localhost:5432]
    end

    subgraph Google Cloud
        CSQL[(Cloud SQL Instance)]
        IAM[Cloud IAM]
    end

    App -->|"localhost:5432"| Proxy
    Proxy -->|"Encrypted tunnel"| CSQL
    Proxy -.->|"Auth"| IAM
```

Cloud SQL Auth Proxy はサイドカーとして動作し、アプリケーションからは `localhost` へのデータベース接続に見える。コネクションプーリングが必要な場合は、別途 PgBouncer や ProxySQL を組み合わせる必要がある。

なお、Google Cloud は Cloud SQL 向けの組み込みコネクションプーリング機能として「AlloyDB Omni」のプロキシ機能や、Cloud SQL のコネクションプーリング（プレビュー機能）も提供し始めている。

### クラウドプロキシの比較

| 特性 | RDS Proxy | Cloud SQL Auth Proxy |
|------|-----------|---------------------|
| コネクションプーリング | あり | なし |
| 対応DB | MySQL, PostgreSQL | MySQL, PostgreSQL, SQL Server |
| 読み書き分離 | エンドポイント分離で対応 | なし |
| IAM 認証 | あり | あり |
| デプロイ方式 | マネージドサービス | サイドカープロセス |
| 料金 | vCPU 時間課金 | 無料 |
| フェイルオーバー | 自動（30秒以内） | 自動再接続 |

## 6. クエリルーティング

### 読み書き分離（Read/Write Splitting）

クエリルーティングの最も一般的なユースケースは、読み書き分離である。書き込みクエリをプライマリに、読み取りクエリをレプリカに振り分けることで、データベースの負荷を分散する。

```mermaid
flowchart TD
    Q[Incoming Query] --> Parse[Parse Query]
    Parse --> IsSelect{SELECT?}
    IsSelect -->|Yes| ForUpdate{"FOR UPDATE<br>or FOR SHARE?"}
    IsSelect -->|No| IsTx{"In explicit<br>transaction?"}

    ForUpdate -->|Yes| Writer[Route to Primary]
    ForUpdate -->|No| InTx2{"In explicit<br>transaction?"}
    InTx2 -->|Yes| Writer
    InTx2 -->|No| CheckLag{"Replication lag<br>acceptable?"}

    CheckLag -->|Yes| Reader[Route to Replica]
    CheckLag -->|No| Writer

    IsTx -->|Yes| Writer
    IsTx -->|No| Writer
```

#### ルーティングの判定基準

1. **SQL文のタイプ**: `SELECT` は読み取り、それ以外（`INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER` など）は書き込み
2. **ロック取得の有無**: `SELECT ... FOR UPDATE` や `SELECT ... FOR SHARE` は書き込み側にルーティング
3. **トランザクションコンテキスト**: 明示的トランザクション（`BEGIN` 〜 `COMMIT`）内のクエリは全てプライマリに送る
4. **レプリケーション遅延**: レプリカの遅延が閾値を超えている場合はプライマリにフォールバック

### レプリケーション遅延と一貫性の課題

読み書き分離を導入する際に最も注意すべきは、レプリケーション遅延（replication lag）による読み取り一貫性の問題である。

書き込み直後の読み取りが別のレプリカにルーティングされると、まだレプリケーションが完了していないため、書き込んだはずのデータが読めないという問題が発生する。いわゆる「read-your-writes 一貫性」の問題である。

```mermaid
sequenceDiagram
    participant App as Application
    participant Proxy as DB Proxy
    participant Primary as Primary
    participant Replica as Replica

    App->>Proxy: INSERT INTO orders (user_id, ...) VALUES (42, ...)
    Proxy->>Primary: Forward INSERT
    Primary->>Proxy: OK
    Proxy->>App: OK

    Note over Primary,Replica: Replication in progress...<br>(lag: ~100ms)

    App->>Proxy: SELECT * FROM orders WHERE user_id = 42
    Proxy->>Replica: Forward SELECT (read query)
    Replica->>Proxy: Empty result (not yet replicated!)
    Proxy->>App: Empty result

    Note over App: User sees "order not found" 😱
```

#### 対策

1. **ヒントベースのルーティング**: SQL コメントにヒントを埋め込み、特定のクエリを強制的にプライマリに送る

```sql
/* route:primary */ SELECT * FROM orders WHERE user_id = 42;
```

2. **セッション内の書き込み追跡**: 書き込みが発生したセッションでは、一定時間（例: 数秒間）全ての読み取りもプライマリに送る

3. **GTID / LSN ベースのルーティング**: 書き込み時の GTID（MySQL）や LSN（PostgreSQL）を記録し、レプリカがその位置まで追いついているかを確認してからルーティングする

4. **因果的一貫性（Causal Consistency）**: アプリケーションレベルで「この読み取りは直前の書き込みの後でなければならない」という因果関係を表現し、プロキシがそれを考慮してルーティングする

### マルチテナントルーティング

データベースプロキシはマルチテナントアーキテクチャでも活用できる。テナントごとに異なるデータベースサーバーやスキーマにルーティングすることで、テナント間の分離を実現する。

```sql
-- ProxySQL: route by schema name in query
INSERT INTO mysql_query_rules (rule_id, active, schemaname, destination_hostgroup, apply)
VALUES
    (100, 1, 'tenant_a', 10, 1),
    (101, 1, 'tenant_b', 11, 1),
    (102, 1, 'tenant_c', 12, 1);
```

## 7. フェイルオーバーとヘルスチェック

### ヘルスチェックの仕組み

データベースプロキシは、バックエンドサーバーの状態を継続的に監視し、障害を検知した場合は自動的にトラフィックを切り替える。

```mermaid
stateDiagram-v2
    [*] --> Healthy: Initial check passed
    Healthy --> Suspicious: Health check failed
    Suspicious --> Healthy: Next check passed
    Suspicious --> Down: Consecutive failures<br>exceed threshold
    Down --> Checking: Recovery interval elapsed
    Checking --> Healthy: Check passed
    Checking --> Down: Check failed
```

#### ヘルスチェックの種類

| チェック種別 | 方法 | 検知できる障害 |
|-------------|------|---------------|
| TCP 接続チェック | TCP ハンドシェイクの成否 | サーバーダウン、ネットワーク障害 |
| MySQL/PostgreSQL ping | プロトコルレベルの ping | プロセスハング、認証失敗 |
| クエリ実行チェック | 簡単な SQL の実行 | データベースの応答不能 |
| レプリケーション遅延チェック | `SHOW SLAVE STATUS` や `pg_last_wal_receive_lsn()` | レプリカの遅延 |
| リードオンリーチェック | `SELECT @@read_only` | プライマリ/レプリカの役割判定 |

### フェイルオーバーのパターン

#### パターン1: レプリカ障害

レプリカの1台が障害を起こした場合、プロキシは自動的に残りのレプリカにトラフィックを振り分ける。アプリケーションからは透過的であり、対応は不要である。

```mermaid
graph LR
    P[Proxy]
    R1[(Replica 1<br>✓ Healthy)]
    R2[(Replica 2<br>✗ Down)]
    R3[(Replica 3<br>✓ Healthy)]

    P -->|"50%"| R1
    P -.->|"Removed"| R2
    P -->|"50%"| R3

    style R2 fill:#ff6b6b,color:#fff
```

#### パターン2: プライマリ障害とフェイルオーバー

プライマリの障害は最も複雑なシナリオである。プロキシ単体ではプライマリの昇格を行えないため、通常はレプリケーション管理ツール（Patroni、orchestrator、MHA など）と連携する。

```mermaid
sequenceDiagram
    participant Proxy as DB Proxy
    participant Mon as Failover Manager<br>(Patroni / orchestrator)
    participant P as Primary (Down)
    participant R1 as Replica 1 (New Primary)
    participant R2 as Replica 2

    Note over P: Primary crashes!
    Proxy->>P: Health check fails
    Proxy->>Proxy: Mark Primary as DOWN
    Proxy->>Proxy: Queue write queries

    Mon->>P: Detect failure
    Mon->>R1: Promote to Primary
    R1->>R1: Promoted!
    Mon->>R2: Repoint to new Primary
    Mon->>Proxy: Update configuration

    Proxy->>R1: Route writes to new Primary
    Proxy->>Proxy: Replay queued queries
    Note over Proxy,R1: Service restored
```

#### RDS Proxy のフェイルオーバー処理

RDS Proxy は Aurora のフェイルオーバーと密接に統合されている。Aurora のフェイルオーバーが発生すると、RDS Proxy は自動的に新しいプライマリインスタンスを検知し、接続を切り替える。アプリケーションに対しては、既存の接続を維持したまま（短時間の中断はある）新しいプライマリに透過的にリダイレクトする。

通常の Aurora フェイルオーバーでは DNS の伝播を待つ必要があるが（最大 30 秒程度）、RDS Proxy を経由している場合は DNS に依存しないため、より高速にフェイルオーバーが完了する。

## 8. 監視とトラブルシューティング

### 監視すべきメトリクス

データベースプロキシを運用する際に監視すべき主要なメトリクスを以下にまとめる。

```mermaid
graph TB
    subgraph Client Side Metrics
        CCnt[Client Connection Count]
        CWait[Client Wait Time]
        CErr[Client Error Rate]
    end

    subgraph Pool Metrics
        PActive[Active Pool Connections]
        PIdle[Idle Pool Connections]
        PExhaust[Pool Exhaustion Events]
        PPin[Pinned Connections<br>RDS Proxy]
    end

    subgraph Server Side Metrics
        SConn[Server Connection Count]
        SLatency[Query Latency via Proxy]
        SErr[Server Error Rate]
        SLag[Replication Lag]
    end

    subgraph Proxy Process Metrics
        CPU[Proxy CPU Usage]
        Mem[Proxy Memory Usage]
        Net[Network Throughput]
    end
```

| カテゴリ | メトリクス | 閾値の目安 | アラート条件 |
|---------|-----------|-----------|-------------|
| クライアント | 接続待機数 | 0 が理想 | 5分間の平均 > 0 |
| クライアント | 待機時間 | < 100ms | p99 > 1s |
| プール | プール使用率 | < 80% | > 90% が5分以上持続 |
| プール | 枯渇イベント | 0 | 1回でも発生 |
| サーバー | 接続数 | < max_connections の 80% | > 90% |
| サーバー | レプリケーション遅延 | < 1s | > 5s |
| プロキシプロセス | CPU 使用率 | < 70% | > 85% |

### よくある問題と対処法

#### 問題1: コネクションプール枯渇

**症状**: クライアントの接続が遅延する、タイムアウトが発生する。`cl_waiting`（PgBouncer）や待機クエリが増加する。

**原因**:
- プールサイズが不足している
- 長時間実行のトランザクションがサーバー接続を専有している
- アプリケーション側のコネクションリークがある

**対処法**:

```sql
-- PgBouncer: Check for long-running transactions
SHOW CLIENTS;
-- Look for clients with long 'link_age' in transaction state

-- PostgreSQL: Find long transactions directly
SELECT pid, now() - xact_start AS duration, query, state
FROM pg_stat_activity
WHERE state != 'idle'
AND xact_start < now() - interval '5 minutes'
ORDER BY duration DESC;
```

::: tip プール枯渇の根本対策
1. 長時間トランザクションの排除（バッチ処理はプール外の専用接続を使う）
2. `statement_timeout` の設定（暴走クエリの防止）
3. `query_wait_timeout` の適切な設定（無限待機の防止）
4. アプリケーションの接続管理の見直し（`try-finally` での確実な返却）
:::

#### 問題2: 「Too many connections」エラー

**症状**: データベースから「too many connections」エラーが返される。

**根本原因の分析**: プロキシを使っているにもかかわらずこのエラーが発生する場合、以下を確認する。

```bash
# Check PgBouncer's max_db_connections vs PostgreSQL's max_connections
# PgBouncer side
psql -p 6432 pgbouncer -c "SHOW CONFIG" | grep max_db_connections

# PostgreSQL side
psql -p 5432 mydb -c "SHOW max_connections"
psql -p 5432 mydb -c "SELECT count(*) FROM pg_stat_activity"
```

プロキシ経由でない直接接続（監視ツール、マイグレーションスクリプトなど）がデータベースの接続を消費していないかも確認する。

#### 問題3: ピニング率の増加（RDS Proxy）

**症状**: CloudWatch の `DatabaseConnectionsCurrentlySessionPinned` が増加し、プーリング効率が低下する。

**調査方法**:

```sql
-- Check which session features cause pinning
-- Enable enhanced logging in RDS Proxy configuration
-- Then check CloudWatch Logs for pinning reasons
```

**対策**:
- `SET` 文の使用を最小化する
- プリペアドステートメントの使い方をフレームワークに合わせて調整する
- `init_query` を活用してセッション初期化をプロキシ側で行う

#### 問題4: レプリケーション遅延による不整合

**症状**: 書き込み直後の読み取りで、書き込んだデータが返されない。

**調査方法**:

```sql
-- PostgreSQL: Check replication lag
SELECT
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    now() - pg_last_xact_replay_timestamp() AS replay_lag
FROM pg_stat_replication;

-- MySQL: Check replication lag
SHOW SLAVE STATUS\G
-- Check Seconds_Behind_Master
```

### ログの活用

プロキシのログは、トラブルシューティングにおいて非常に重要な情報源である。

```ini
;; PgBouncer logging settings
[pgbouncer]
; Log all connections and disconnections
log_connections = 1
log_disconnections = 1

; Log DNS resolution
log_dns = 0

; Verbose logging for debugging (disable in production)
verbose = 0

; Syslog integration
syslog = 1
syslog_ident = pgbouncer
syslog_facility = daemon
```

ProxySQL の場合は、管理コンソールからクエリ統計を確認できる。

```sql
-- ProxySQL: Query digest statistics
SELECT
    hostgroup,
    schemaname,
    digest_text,
    count_star,
    sum_time,
    sum_time / count_star AS avg_time_us,
    min_time,
    max_time
FROM stats_mysql_query_digest
ORDER BY sum_time DESC
LIMIT 20;
```

## 9. 導入パターンと注意点

### デプロイメントパターン

データベースプロキシの配置方法にはいくつかのパターンがあり、それぞれにトレードオフがある。

#### パターン1: サイドカー型

各アプリケーションインスタンスと同じホスト（またはコンテナのサイドカー）としてプロキシを配置する。

```mermaid
graph TB
    subgraph Pod 1
        A1[App Container]
        P1[Proxy Sidecar]
    end
    subgraph Pod 2
        A2[App Container]
        P2[Proxy Sidecar]
    end
    subgraph Pod 3
        A3[App Container]
        P3[Proxy Sidecar]
    end

    A1 -->|localhost| P1
    A2 -->|localhost| P2
    A3 -->|localhost| P3

    P1 --> DB[(Database)]
    P2 --> DB
    P3 --> DB
```

- **利点**: アプリケーションとプロキシ間のネットワークレイテンシがゼロに近い。プロキシの障害が影響する範囲が1つのアプリケーションインスタンスに限定される。
- **欠点**: プロキシインスタンスが多数になり、管理が複雑化する。各プロキシが個別にデータベース接続を確保するため、全体としての接続数削減効果が薄れる。

#### パターン2: 集中型（スタンドアロン）

専用のプロキシ層を設け、全てのアプリケーションからのトラフィックを集約する。

```mermaid
graph TB
    A1[App Instance 1]
    A2[App Instance 2]
    A3[App Instance 3]

    subgraph Proxy Tier
        P1[Proxy Node 1]
        P2[Proxy Node 2]
    end

    LB[Load Balancer]

    A1 --> LB
    A2 --> LB
    A3 --> LB
    LB --> P1
    LB --> P2

    P1 --> DB[(Database)]
    P2 --> DB
```

- **利点**: コネクションプーリングの効果が最大化される（全アプリケーションの接続を統合できる）。設定の一元管理が容易。
- **欠点**: プロキシ層自体が SPOF になりうる（冗長化が必須）。プロキシとアプリケーション間にネットワークホップが追加される。

#### パターン3: ハイブリッド型

サイドカー型と集中型を組み合わせる。ローカルのサイドカーで接続の管理を行い、バックエンドの集中プロキシでクエリルーティングを行う。

```mermaid
graph TB
    subgraph App Tier
        subgraph Pod 1
            A1[App]
            LP1[Local PgBouncer]
        end
        subgraph Pod 2
            A2[App]
            LP2[Local PgBouncer]
        end
    end

    subgraph Proxy Tier
        CP[Central ProxySQL<br>Query Routing]
    end

    subgraph DB Tier
        Primary[(Primary)]
        Replica[(Replica)]
    end

    A1 -->|localhost| LP1
    A2 -->|localhost| LP2
    LP1 --> CP
    LP2 --> CP
    CP -->|Write| Primary
    CP -->|Read| Replica
```

- **利点**: 接続管理とクエリルーティングを分離できる。各層で最適なツールを使える。
- **欠点**: アーキテクチャの複雑性が増す。レイテンシが積み重なる。

### Kubernetes 環境での導入例

Kubernetes 環境では、サイドカーパターンが特に一般的である。以下は PgBouncer をサイドカーとして配置する Deployment の例である。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        # Application container
        - name: app
          image: myapp:latest
          env:
            - name: DATABASE_URL
              # Connect to PgBouncer sidecar via localhost
              value: "postgresql://appuser:$(DB_PASSWORD)@localhost:6432/mydb"
          ports:
            - containerPort: 8080

        # PgBouncer sidecar
        - name: pgbouncer
          image: bitnami/pgbouncer:latest
          ports:
            - containerPort: 6432
          env:
            - name: PGBOUNCER_DATABASE
              value: "mydb"
            - name: PGBOUNCER_POOL_MODE
              value: "transaction"
            - name: PGBOUNCER_DEFAULT_POOL_SIZE
              value: "10"
            - name: PGBOUNCER_MAX_CLIENT_CONN
              value: "100"
            - name: POSTGRESQL_HOST
              value: "db-primary.database.svc.cluster.local"
            - name: POSTGRESQL_PORT
              value: "5432"
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          livenessProbe:
            tcpSocket:
              port: 6432
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            tcpSocket:
              port: 6432
            initialDelaySeconds: 5
            periodSeconds: 5
```

### 導入時の注意点

#### 1. プロキシ自体がボトルネックにならないか

プロキシは全てのデータベーストラフィックが通過する地点であるため、プロキシ自体の性能がボトルネックになりうる。特に以下の点に注意する。

- **PgBouncer のシングルスレッド制限**: PgBouncer はシングルスレッドで動作するため、1コアの性能が上限になる。高スループット環境では複数の PgBouncer インスタンスを並列に配置する必要がある。
- **ProxySQL のクエリ解析コスト**: 複雑なクエリルールを大量に設定すると、クエリの正規表現マッチングに CPU コストがかかる。
- **ネットワーク帯域**: 大量の結果セットを返すクエリでは、プロキシを経由することでネットワークホップが増え、スループットに影響する可能性がある。

#### 2. トランザクション管理への影響

トランザクションプーリングモードでは、アプリケーションの接続管理パターンに注意が必要である。

```python
# BAD: Long-held connection with intermittent transactions
conn = pool.getconn()
try:
    # ... some application logic (no DB activity) ...
    time.sleep(10)  # Server connection is held idle!

    with conn.cursor() as cur:
        cur.execute("SELECT * FROM users")
finally:
    pool.putconn(conn)

# GOOD: Short-lived connection borrowing
with pool.getconn() as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM users")
# Connection returned immediately after use
```

#### 3. プリペアドステートメントの取り扱い

多くの ORM やデータベースドライバーはプリペアドステートメントを暗黙的に使用する。トランザクションプーリングモードでは、プリペアドステートメントがセッションをまたいで保持されないため、問題が発生する可能性がある。

| ドライバー / ORM | デフォルト動作 | 対策 |
|-----------------|--------------|------|
| JDBC (PostgreSQL) | Extended Query Protocol 使用 | `prepareThreshold=0` で無効化 |
| psycopg2 | サーバーサイド prepare なし | 通常は問題なし |
| psycopg3 | クライアントサイドにフォールバック可 | `prepare_threshold=None` |
| SQLAlchemy | ドライバー依存 | ドライバーの設定に従う |
| Django | psycopg2 経由 | 通常は問題なし |
| ActiveRecord | pg gem 経由 | `prepared_statements: false` |

#### 4. TLS/SSL の終端位置

プロキシを導入すると、TLS 接続の終端位置を決める必要がある。

```
パターン A: クライアント → [TLS] → プロキシ → [TLS] → DB
パターン B: クライアント → [TLS] → プロキシ → [平文] → DB
パターン C: クライアント → [平文] → プロキシ(同一ホスト) → [TLS] → DB
```

- **パターン A**: 最も安全だが、プロキシでの TLS 終端と再暗号化のオーバーヘッドがある
- **パターン B**: プロキシとデータベース間が信頼できるネットワーク（VPC 内など）の場合に採用される
- **パターン C**: サイドカーパターンで、アプリケーションとプロキシが同一ホストの場合

#### 5. 段階的な導入戦略

データベースプロキシの導入は、段階的に行うことを推奨する。

```mermaid
graph LR
    S1["Phase 1<br>読み取り専用ルーティング<br>のみ導入"] --> S2["Phase 2<br>コネクション<br>プーリング有効化"]
    S2 --> S3["Phase 3<br>読み書き分離<br>の導入"]
    S3 --> S4["Phase 4<br>フェイルオーバー<br>自動化"]
```

1. **Phase 1**: まずプロキシを透過的に配置し、全トラフィックをプライマリに転送する。この段階ではプーリングもルーティングも行わない。プロキシ経由でも問題が発生しないことを確認する。
2. **Phase 2**: コネクションプーリングを有効化する。セッションプーリングから始め、問題がなければトランザクションプーリングに移行する。
3. **Phase 3**: 読み書き分離を導入する。まず限定的なクエリ（明らかに安全な参照クエリ）のみをレプリカに振り分け、徐々に範囲を拡大する。
4. **Phase 4**: 自動フェイルオーバーを有効化する。フェイルオーバーのテストを本番環境で実施し（カオスエンジニアリング）、切り替え時間やアプリケーションの挙動を確認する。

### ツール選定ガイド

最後に、代表的なデータベースプロキシの選定基準をまとめる。

| 要件 | 推奨ツール | 理由 |
|------|-----------|------|
| PostgreSQL のコネクションプーリングだけ欲しい | PgBouncer | 軽量・安定・実績豊富 |
| MySQL の読み書き分離が必要 | ProxySQL | クエリルーティング機能が充実 |
| MySQL のクエリキャッシュが必要 | ProxySQL | 組み込みクエリキャッシュ機能 |
| AWS Lambda + RDS/Aurora | RDS Proxy | Lambda との統合が最適化済み |
| Google Cloud SQL への安全な接続 | Cloud SQL Auth Proxy | IAM 統合、無料 |
| Kubernetes 環境 | PgBouncer（サイドカー） | 軽量で Pod のリソース消費が少ない |
| 高度なクエリ制御が必要 | ProxySQL | クエリリライト、ファイアウォール機能 |
| 運用負荷を最小化したい | RDS Proxy / マネージドサービス | フルマネージドで運用不要 |

## まとめ

データベースプロキシは、現代のアプリケーションアーキテクチャにおいて、データベースの性能と可用性を向上させる重要な構成要素である。コネクションプーリングによる接続管理の効率化、クエリルーティングによる負荷分散、フェイルオーバーの自動化など、多くの課題を透過的に解決する。

しかし、プロキシの導入は「銀の弾丸」ではない。プーリングモードの選択がアプリケーションの動作に影響を与えること、プロキシ自体がボトルネックや障害点になりうること、レプリケーション遅延による一貫性の問題が読み書き分離では不可避であることなど、トレードオフを理解した上で導入する必要がある。

まずは自分たちのアプリケーションが抱えている具体的な課題（接続数の爆発、フェイルオーバーの遅さ、読み取り負荷の偏りなど）を明確にし、その課題に最適なツールとデプロイメントパターンを選択することが、成功の鍵である。
