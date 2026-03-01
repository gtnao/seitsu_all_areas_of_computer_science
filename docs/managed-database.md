---
title: "マネージドデータベースサービス（RDS, Cloud SQL, Aurora）"
date: 2026-03-01
tags: ["cloud-services", "databases", "rds", "cloud-sql", "aurora", "managed-services", "intermediate"]
---

# マネージドデータベースサービス（RDS, Cloud SQL, Aurora）

## 1. 歴史的背景：自前運用からマネージドへ

### 1.1 データベース運用の苦労

2000年代のWebサービスの急成長期、多くの企業がMySQLやPostgreSQLなどのオープンソースRDBMSを自社サーバー上で運用していた。データベースはアプリケーションの心臓部であり、ダウンすればサービス全体が停止する。しかし、その運用には膨大な労力が必要であった。

自前でデータベースを運用する際に直面する典型的な課題は以下の通りである。

**バックアップと復元**

定期的なフルバックアップとインクリメンタルバックアップを設計し、バックアップの整合性を検証し、リストア手順を定期的にテストする必要がある。「バックアップは取っていたがリストアしたことがない」という状況は、実質的にバックアップが存在しないのと同じである。Point-in-Time Recovery（PITR）を実現するにはバイナリログやWALの管理も求められ、運用の複雑さは増すばかりであった。

**パッチ適用とアップグレード**

セキュリティパッチやマイナーバージョンアップは定期的に必要だが、本番環境への適用は常にリスクを伴う。パッチ適用前にステージング環境でテストし、メンテナンスウィンドウを設定し、ロールバック計画を準備し、適用後の動作確認を行う。メジャーバージョンアップグレードともなれば、数週間から数ヶ月のプロジェクトになることも珍しくなかった。

**高可用性（HA）構成**

単一サーバーでの運用はSPOF（Single Point of Failure）となるため、レプリケーションを構成して冗長化する必要がある。MySQLであればsemi-synchronous replicationの設定、フェイルオーバーの自動化（MHA, Orchestratorなど）、仮想IPやDNSの切り替え、スプリットブレインの防止策など、考慮すべき事項は山のようにあった。

**容量計画とスケーリング**

ディスク容量の監視、テーブルスペースの管理、IOPSの見積もり、メモリの割り当てなど、ハードウェアリソースの管理は継続的な作業であった。特にストレージの拡張はオンラインで行えないケースも多く、計画的なダウンタイムが必要となることもあった。

### 1.2 Amazon RDSの登場

2009年、AWSはAmazon Relational Database Service（RDS）をリリースした。これは、上記のような運用負荷を大幅に軽減する画期的なサービスであった。

RDSの基本的な発想は明快である。「データベースエンジンの管理はAWSに任せ、開発者はスキーマ設計とクエリの最適化に集中せよ」というものだ。バックアップの自動化、パッチの自動適用、Multi-AZによる高可用性、Read Replicaによる読み取りスケーリングなどが、APIコール一つで利用可能になった。

> [!NOTE]
> RDSは最初はMySQL 5.1のみをサポートしていた。その後、PostgreSQL、Oracle、SQL Server、MariaDB、そしてAWS独自開発のAmazon Auroraへとサポートを拡大した。

### 1.3 Google Cloud SQLとその他のサービス

AWSのRDSの成功を受けて、他のクラウドプロバイダも同様のサービスを展開した。Google Cloudは2011年にCloud SQLをリリースし、Microsoftは Azure Database for MySQL/PostgreSQLを提供した。

各社のサービスは基本的なコンセプトは同じだが、アーキテクチャ的な差異がある。特にAmazon Auroraは、既存のRDBMSのストレージ層を独自に再設計するという野心的なアプローチを取り、業界に大きなインパクトを与えた。

### 1.4 マネージドサービスの責任共有モデル

マネージドデータベースを利用する場合、クラウドプロバイダと利用者の間で責任が分担される。この責任の分界点を理解することは極めて重要である。

```mermaid
graph TB
    subgraph user["利用者の責任"]
        A["スキーマ設計"]
        B["クエリ最適化"]
        C["アプリケーションの接続管理"]
        D["データの論理的バックアップ"]
        E["アクセス制御（DB内のユーザー/権限）"]
    end
    subgraph provider["クラウドプロバイダの責任"]
        F["OSのパッチ適用"]
        G["DBエンジンのパッチ適用"]
        H["自動バックアップとPITR"]
        I["HA構成とフェイルオーバー"]
        J["ストレージの自動拡張"]
        K["物理的なセキュリティ"]
    end

    style user fill:#e8f4fd,stroke:#1976d2
    style provider fill:#e8f5e9,stroke:#388e3c
```

::: warning
マネージドだからといって、すべてがプロバイダ任せになるわけではない。クエリの性能問題、インデックス設計の不備、コネクション管理の誤りなどは、依然として利用者側の責任である。マネージドサービスは「運用を楽にする」が「運用をなくす」わけではない。
:::

## 2. アーキテクチャ

### 2.1 Amazon RDS

Amazon RDSは、EC2インスタンス上にデータベースエンジンをホストし、EBS（Elastic Block Store）をストレージとして使用する構成を基盤としている。利用者から見えるのはデータベースのエンドポイント（DNS名）であり、インスタンスの管理はAWSが行う。

#### 2.1.1 Single-AZとMulti-AZ

RDSのもっとも基本的な構成はSingle-AZデプロイメントである。1つのアベイラビリティゾーン（AZ）に1台のデータベースインスタンスが配置される。開発環境やコスト重視の環境ではこの構成で十分であるが、AZ障害時にはデータベースが利用不能になる。

本番環境では、Multi-AZデプロイメントが推奨される。Multi-AZでは、プライマリインスタンスと同期レプリケーションされるスタンバイインスタンスが別のAZに配置される。

```mermaid
graph TB
    App["アプリケーション"]
    EP["RDS エンドポイント（DNS）"]

    subgraph az1["アベイラビリティゾーン A"]
        Primary["プライマリ DB"]
        EBS1["EBS ボリューム"]
    end

    subgraph az2["アベイラビリティゾーン B"]
        Standby["スタンバイ DB"]
        EBS2["EBS ボリューム"]
    end

    App --> EP
    EP --> Primary
    Primary --> EBS1
    Primary -- "同期レプリケーション" --> Standby
    Standby --> EBS2

    style az1 fill:#fff3e0,stroke:#ef6c00
    style az2 fill:#e3f2fd,stroke:#1565c0
```

プライマリインスタンスに障害が発生した場合、RDSは自動的にDNSレコードをスタンバイインスタンスに切り替える。このフェイルオーバーは通常60〜120秒程度で完了するが、その間はデータベースへの接続が一時的に切断される。

::: tip
Multi-AZのスタンバイインスタンスは**読み取りトラフィックの処理には使用できない**。あくまでフェイルオーバー用のスタンバイであり、Read Replicaとは役割が異なる。読み取りのスケーリングにはRead Replicaを別途作成する必要がある。
:::

#### 2.1.2 Read Replica

RDSのRead Replicaは、非同期レプリケーションにより作成されるプライマリインスタンスの読み取り専用コピーである。読み取り負荷の分散に使用され、プライマリとは別のエンドポイントを持つ。

```mermaid
graph TB
    App["アプリケーション"]

    subgraph write["書き込みパス"]
        WEP["Writer エンドポイント"]
        Primary["プライマリ DB"]
    end

    subgraph read["読み取りパス"]
        REP["Reader エンドポイント"]
        RR1["Read Replica 1"]
        RR2["Read Replica 2"]
        RR3["Read Replica 3"]
    end

    App -- "INSERT/UPDATE/DELETE" --> WEP --> Primary
    App -- "SELECT" --> REP
    REP --> RR1
    REP --> RR2
    REP --> RR3
    Primary -- "非同期レプリケーション" --> RR1
    Primary -- "非同期レプリケーション" --> RR2
    Primary -- "非同期レプリケーション" --> RR3

    style write fill:#fce4ec,stroke:#c62828
    style read fill:#e8f5e9,stroke:#2e7d32
```

Read Replicaの特徴は以下の通りである。

- **最大5台**（RDS MySQL/PostgreSQLの場合）まで作成可能
- **非同期**レプリケーションのため、プライマリとの間にわずかなレプリケーションラグが生じる
- リージョンをまたいだ**クロスリージョンRead Replica**も作成可能
- Read Replicaをプライマリに**昇格（promote）**させることも可能（ただし手動操作）

> [!WARNING]
> 非同期レプリケーションであるため、Read Replicaから読み取ったデータはプライマリの最新状態を反映していない可能性がある。厳密な一貫性が必要な読み取りはプライマリに対して行う必要がある。

### 2.2 Google Cloud SQL

Cloud SQLはGoogle Cloudが提供するマネージドRDBMSサービスであり、MySQL、PostgreSQL、SQL Serverをサポートする。RDSと同様の機能を提供するが、アーキテクチャにいくつかの特徴がある。

#### 2.2.1 HAプロキシとリージョナルPD

Cloud SQLの高可用性構成は、Regional Persistent Disk（リージョナルPD）を利用する。リージョナルPDは同一リージョン内の2つのゾーン間でストレージを同期レプリケーションする仕組みである。

```mermaid
graph TB
    App["アプリケーション"]
    EP["Cloud SQL IP / プライベートIP"]

    subgraph zone1["ゾーン A"]
        Primary["プライマリ インスタンス"]
    end

    subgraph zone2["ゾーン B"]
        Standby["スタンバイ インスタンス"]
    end

    subgraph storage["リージョナル Persistent Disk"]
        PD1["PD レプリカ（ゾーンA）"]
        PD2["PD レプリカ（ゾーンB）"]
    end

    App --> EP --> Primary
    Primary --> PD1
    PD1 <-- "同期レプリケーション" --> PD2
    Standby -.-> PD2
    Primary -- "HA フェイルオーバー" -.-> Standby

    style zone1 fill:#fff3e0,stroke:#ef6c00
    style zone2 fill:#e3f2fd,stroke:#1565c0
    style storage fill:#f3e5f5,stroke:#7b1fa2
```

RDSのMulti-AZがデータベースエンジンレベルのレプリケーションを使用するのに対し、Cloud SQLはストレージ層（リージョナルPD）での同期を基盤としている。フェイルオーバー時にはスタンバイインスタンスが既にレプリケートされたPDにアタッチしてデータベースプロセスを起動する。

#### 2.2.2 Cloud SQL Auth Proxy

Cloud SQLへの接続で特徴的なのが**Cloud SQL Auth Proxy**（旧Cloud SQL Proxy）の存在である。これはアプリケーションとCloud SQLの間に配置されるローカルプロキシプロセスであり、以下の機能を提供する。

- **IAMベースの認証**：データベースパスワードではなく、Google CloudのIAMを使った認証
- **自動TLS暗号化**：証明書の管理なしに暗号化された接続を確立
- **プライベートIP不要**：パブリックIPのCloud SQLインスタンスに対しても安全に接続

```mermaid
sequenceDiagram
    participant App as アプリケーション
    participant Proxy as Cloud SQL Auth Proxy
    participant IAM as Google Cloud IAM
    participant DB as Cloud SQL インスタンス

    App->>Proxy: localhost:5432 へ接続
    Proxy->>IAM: サービスアカウントで認証
    IAM-->>Proxy: トークン発行
    Proxy->>DB: TLS暗号化接続を確立
    DB-->>Proxy: 接続承認
    Proxy-->>App: 接続確立
    App->>Proxy: SQLクエリ送信
    Proxy->>DB: クエリ転送
    DB-->>Proxy: 結果返却
    Proxy-->>App: 結果転送
```

::: tip
Cloud SQL Auth Proxyは、特にGoogle Kubernetes Engine（GKE）やCloud Runからの接続で威力を発揮する。サイドカーコンテナとしてデプロイすることで、アプリケーションコードに変更を加えることなくセキュアな接続を実現できる。
:::

### 2.3 Amazon Aurora

Amazon Auroraは、2014年にAWSが発表したMySQL/PostgreSQL互換のマネージドデータベースサービスである。RDSの上位に位置づけられるが、そのアーキテクチャは根本的に異なる。Auroraは「クラウドのために設計されたリレーショナルデータベース」を標榜し、コンピュート層とストレージ層を完全に分離するというアーキテクチャ上の革新をもたらした。

#### 2.3.1 ストレージ分離アーキテクチャ

従来のRDBMS（RDS含む）では、データベースプロセスがローカルディスクまたはネットワークアタッチトストレージにデータを書き込む。この構成では、レプリケーションはSQLレイヤーまたはストレージエンジンレイヤーで行われ、データが複数回ネットワークを通過する。

Auroraは、ログ（Redo Log）のみをストレージ層に送信するという設計を採用した。データベースインスタンスはデータページの書き出しを行わず、代わりにRedoログレコードをストレージノードに送信する。ストレージノードがRedoログを受け取り、バックグラウンドでデータページを生成する。

```mermaid
graph TB
    subgraph compute["コンピュート層"]
        Writer["Writer インスタンス"]
        Reader1["Reader インスタンス 1"]
        Reader2["Reader インスタンス 2"]
    end

    subgraph storage["Aurora ストレージ層（共有分散ストレージ）"]
        subgraph az_a["AZ A"]
            S1["ストレージノード 1"]
            S2["ストレージノード 2"]
        end
        subgraph az_b["AZ B"]
            S3["ストレージノード 3"]
            S4["ストレージノード 4"]
        end
        subgraph az_c["AZ C"]
            S5["ストレージノード 5"]
            S6["ストレージノード 6"]
        end
    end

    Writer -- "Redo Log" --> S1
    Writer -- "Redo Log" --> S2
    Writer -- "Redo Log" --> S3
    Writer -- "Redo Log" --> S4
    Writer -- "Redo Log" --> S5
    Writer -- "Redo Log" --> S6

    Reader1 -. "読み取り" .-> storage
    Reader2 -. "読み取り" .-> storage

    style compute fill:#e3f2fd,stroke:#1565c0
    style storage fill:#fff3e0,stroke:#ef6c00
    style az_a fill:#fce4ec,stroke:#c62828
    style az_b fill:#e8f5e9,stroke:#2e7d32
    style az_c fill:#f3e5f5,stroke:#7b1fa2
```

この設計には以下の利点がある。

- **ネットワークI/Oの削減**：従来のMySQLではデータページ、binlog、Redoログなど複数のデータがネットワーク上を流れるが、Auroraではログストリームのみ
- **レプリケーションラグの短縮**：Readerインスタンスはストレージ層から直接データを読み取るため、通常20ms以下のラグ
- **書き込み性能の向上**：ストレージノードがバックグラウンドでページ再構成を行うため、Writerの負荷が軽減される
- **高速なクラッシュリカバリ**：ストレージ層で常にログが適用されるため、再起動時のリカバリが高速

#### 2.3.2 6コピー/3AZとクォーラムプロトコル

Auroraのストレージ層は、データを10GBのセグメント（Protection Group）に分割し、各セグメントを3つのAZにまたがって6つのコピーを保持する。書き込みと読み取りにはクォーラム（Quorum）プロトコルが適用される。

| 操作 | 必要なコピー数 | 合計コピー数 |
|---|---|---|
| 書き込み（Write Quorum） | 4/6 | 6 |
| 読み取り（Read Quorum） | 3/6 | 6 |

```mermaid
graph LR
    subgraph quorum["クォーラムプロトコル（6コピー中）"]
        subgraph write_q["書き込みクォーラム: 4/6"]
            W1["コピー1 ✓"]
            W2["コピー2 ✓"]
            W3["コピー3 ✓"]
            W4["コピー4 ✓"]
            W5["コピー5 ✗"]
            W6["コピー6 ✗"]
        end
    end

    style W1 fill:#c8e6c9,stroke:#2e7d32
    style W2 fill:#c8e6c9,stroke:#2e7d32
    style W3 fill:#c8e6c9,stroke:#2e7d32
    style W4 fill:#c8e6c9,stroke:#2e7d32
    style W5 fill:#ffcdd2,stroke:#c62828
    style W6 fill:#ffcdd2,stroke:#c62828
```

このクォーラム設計により、以下の耐障害性が実現される。

- **1つのAZ全体が障害**（2コピー喪失）：書き込みは4/6のクォーラムを満たすため、**読み書き両方が継続可能**
- **1つのAZ障害＋別AZの1ノード障害**（3コピー喪失）：書き込みは不可だが、**読み取りは3/6のクォーラムで継続可能**
- **任意の2コピー喪失**：データ損失なく**読み書き継続可能**

::: details Write Quorum = 4、Read Quorum = 3 の数学的根拠
クォーラムシステムが正しく動作するためには、Write Quorum（Vw）とRead Quorum（Vr）が以下の条件を満たす必要がある。

1. **Vw + Vr > V**（書き込みと読み取りのクォーラムが必ず重なる）
2. **Vw > V/2**（2つの書き込みが同時に成功しない）

Auroraの場合：
- V = 6（合計コピー数）
- Vw = 4、Vr = 3
- 4 + 3 = 7 > 6 ... 条件1を満たす
- 4 > 3 ... 条件2を満たす

これにより、どのRead Quorumにも最新の書き込みが含まれることが保証される。
:::

#### 2.3.3 Auroraのフェイルオーバー

Auroraのフェイルオーバーは、ストレージ分離アーキテクチャの恩恵により非常に高速である。ストレージ層はコンピュートインスタンスとは独立に動作しているため、フェイルオーバー時に必要なのはコンピュートインスタンスの切り替えのみである。

- **Readerインスタンスが存在する場合**：30秒以下でフェイルオーバー完了（Readerの1つがWriterに昇格）
- **Readerインスタンスが存在しない場合**：新しいインスタンスを起動する必要があるため、10分程度

::: tip
Auroraではフェイルオーバーの優先順位（Priority Tier）を設定できる。Tier 0が最高優先度であり、同一Tierの中ではインスタンスサイズが大きいものが優先される。本番環境では、Writerと同等のインスタンスサイズを持つReaderをTier 0に設定しておくことが推奨される。
:::

### 2.4 アーキテクチャ比較

3つのサービスのアーキテクチャ上の主要な違いを整理する。

| 観点 | Amazon RDS | Google Cloud SQL | Amazon Aurora |
|---|---|---|---|
| ストレージ | EBS（インスタンスに紐付く） | Persistent Disk（リージョナルPD可） | 共有分散ストレージ（6コピー/3AZ） |
| HAの実現方式 | 同期レプリケーション（エンジンレベル） | リージョナルPD + スタンバイ | クォーラムベースのストレージ |
| フェイルオーバー時間 | 60〜120秒 | 60〜120秒 | 30秒以下（Reader存在時） |
| Read Replicaの上限 | 5台（MySQLの場合） | アカウントのクォータに依存 | 15台 |
| レプリケーションラグ | 秒〜分単位 | 秒〜分単位 | 通常20ms以下 |
| ストレージの自動拡張 | 可能（設定必要） | 可能（設定必要） | 自動（最大128TBまで自動拡張） |
| 対応エンジン | MySQL, PostgreSQL, MariaDB, Oracle, SQL Server | MySQL, PostgreSQL, SQL Server | MySQL互換, PostgreSQL互換 |

## 3. 実装手法

### 3.1 パラメータグループとデータベースフラグ

マネージドデータベースでは、データベースエンジンの設定パラメータをコンソールやAPIから変更できる。RDSでは**パラメータグループ**、Cloud SQLでは**データベースフラグ**と呼ばれる。

パラメータの種類は大きく2つに分かれる。

- **動的パラメータ**：変更が即座に反映される。再起動不要
- **静的パラメータ**：変更後にインスタンスの再起動が必要

::: warning
デフォルトのパラメータグループは変更できない。カスタムパラメータグループを作成してインスタンスに関連付ける必要がある。本番環境では必ずカスタムパラメータグループを使用すべきである。
:::

本番環境で特に検討すべき代表的なパラメータを以下に示す。

**MySQL系の場合：**

```sql
-- slow query log (capture queries over 1 second)
slow_query_log = 1
long_query_time = 1

-- InnoDB buffer pool size (typically 75% of available memory)
innodb_buffer_pool_size = {available_memory * 0.75}

-- connection management
max_connections = 150

-- binary logging for replication and PITR
binlog_format = ROW
```

**PostgreSQL系の場合：**

```sql
-- shared buffer (typically 25% of available memory)
shared_buffers = {available_memory * 0.25}

-- work memory per operation
work_mem = 64MB

-- WAL settings for durability
wal_level = replica

-- slow query logging
log_min_duration_statement = 1000
```

### 3.2 バックアップとリストア

#### 3.2.1 自動バックアップ

マネージドデータベースの大きな利点の一つが、自動バックアップとPoint-in-Time Recovery（PITR）である。

```mermaid
graph LR
    subgraph backup["バックアップの仕組み"]
        Daily["日次スナップショット"]
        TxLog["トランザクションログ<br/>（継続的に保存）"]

        Daily --> Restore["任意の時点に<br/>リストア可能"]
        TxLog --> Restore
    end

    subgraph timeline["時間軸"]
        T1["Day 1<br/>スナップショット"]
        T2["Day 2<br/>スナップショット"]
        T3["Day 3<br/>スナップショット"]
        PITR["← この間の任意の時点に復元可能 →"]
    end

    style backup fill:#e3f2fd,stroke:#1565c0
    style timeline fill:#fff3e0,stroke:#ef6c00
```

| 機能 | Amazon RDS | Google Cloud SQL | Amazon Aurora |
|---|---|---|---|
| 自動バックアップ | 有効（デフォルト） | 有効（デフォルト） | 有効（常時） |
| 保持期間 | 1〜35日（デフォルト7日） | 1〜365日（デフォルト7日） | 1〜35日（デフォルト1日） |
| PITR | 対応（5分粒度） | 対応 | 対応（5分粒度） |
| バックアップウィンドウ | 設定可能 | 設定可能 | 不要（継続的） |
| バックアップの影響 | わずかなI/O負荷 | わずかなI/O負荷 | ストレージ層で処理のため影響なし |

::: danger
RDSのバックアップ保持期間を0に設定すると、自動バックアップが無効になり、PITRも使用不能になる。本番環境では絶対に保持期間を0にしてはならない。
:::

#### 3.2.2 スナップショットとクローン

手動スナップショットは保持期間に関係なく保存され、別リージョンへのコピーやアカウント間での共有が可能である。

Auroraにはさらに**クローン**機能がある。クローンはCopy-on-Write方式で作成されるため、テラバイト規模のデータベースでも数分で作成が完了する。元のデータベースと同じストレージを共有し、変更が発生した部分のみ新しいストレージに書き込まれる。

```mermaid
graph TB
    subgraph original["本番 Aurora クラスター"]
        OW["Writer"]
        OS["共有ストレージ<br/>（10TB）"]
        OW --> OS
    end

    subgraph clone["クローン"]
        CW["Writer"]
        CS["変更分のみ<br/>新ストレージ"]
        CW --> CS
        CW -.-> OS
    end

    OS -. "Copy-on-Write" .-> CS

    style original fill:#e3f2fd,stroke:#1565c0
    style clone fill:#e8f5e9,stroke:#2e7d32
```

::: tip
Auroraクローンは、本番データを使ったステージング環境の構築や、大規模なデータ分析のための読み取り環境の作成に最適である。テラバイト規模のデータベースでもストレージコストは変更分のみであり、作成時間も数分で済む。
:::

### 3.3 接続管理

#### 3.3.1 RDS Proxy

データベース接続の管理は、マネージドデータベースを利用する際の重要な設計ポイントの一つである。特にサーバーレスアーキテクチャ（AWS Lambda等）では、関数の呼び出しごとに新しい接続が作成されるため、接続数が爆発的に増加するリスクがある。

RDS Proxyは、アプリケーションとRDS/Auroraの間に配置されるフルマネージドなコネクションプーリングサービスである。

```mermaid
graph LR
    subgraph lambdas["AWS Lambda 関数群"]
        L1["Lambda 1"]
        L2["Lambda 2"]
        L3["Lambda 3"]
        L4["Lambda ..."]
        L5["Lambda N"]
    end

    subgraph proxy["RDS Proxy"]
        Pool["コネクションプール<br/>（例: 50接続）"]
    end

    subgraph db["RDS / Aurora"]
        Primary["プライマリ DB"]
    end

    L1 --> Pool
    L2 --> Pool
    L3 --> Pool
    L4 --> Pool
    L5 --> Pool
    Pool -- "多重化された接続" --> Primary

    style lambdas fill:#fff3e0,stroke:#ef6c00
    style proxy fill:#e3f2fd,stroke:#1565c0
    style db fill:#e8f5e9,stroke:#2e7d32
```

RDS Proxyの主な機能は以下の通りである。

- **コネクションプーリング**：アプリケーションからの大量の接続を、少数のデータベース接続に多重化
- **フェイルオーバー対応**：プライマリの障害時に自動的に新しいプライマリに接続を切り替え。アプリケーションからは透過的
- **IAM認証**：データベースパスワードの代わりにIAMロールによる認証をサポート
- **Secrets Manager統合**：データベース認証情報をSecrets Managerで管理し、自動ローテーション

#### 3.3.2 Cloud SQL Auth Proxy

前述のCloud SQL Auth Proxyに加えて、Cloud SQLはPrivate Service Connect（PSC）やVPCピアリングによるプライベート接続もサポートしている。

接続方式の選択は以下のように考える。

| 接続元 | 推奨方式 |
|---|---|
| GKE / Cloud Run | Cloud SQL Auth Proxy（サイドカー） |
| Compute Engine（同一VPC） | プライベートIP |
| オンプレミス / 他クラウド | Cloud VPN / Cloud Interconnect + プライベートIP |
| ローカル開発 | Cloud SQL Auth Proxy（ローカル実行） |

### 3.4 暗号化

マネージドデータベースでは、保存時暗号化（Encryption at Rest）と転送時暗号化（Encryption in Transit）の両方をサポートしている。

**保存時暗号化：**

| サービス | 暗号化方式 | 鍵管理 |
|---|---|---|
| RDS / Aurora | AES-256 | AWS KMS（デフォルトキーまたはCMK） |
| Cloud SQL | AES-256 | Cloud KMS（デフォルトまたはCMEK） |

- RDS/Auroraでは、インスタンス作成時に暗号化を有効にする。**作成後に暗号化を有効化することはできない**。暗号化されていないインスタンスを暗号化するには、スナップショットを取得し、暗号化を有効にしてスナップショットをコピーし、そのスナップショットからリストアする必要がある
- Cloud SQLでは、デフォルトですべてのインスタンスが暗号化される

**転送時暗号化：**

- RDSはSSL/TLS接続をサポートし、`rds-ca` 証明書バンドルを提供する。`require_secure_transport`（MySQL）や`rds.force_ssl`（PostgreSQL）パラメータで強制可能
- Cloud SQLはCloud SQL Auth Proxyを使用することで自動的にTLS暗号化される

::: warning
暗号化はパフォーマンスへの影響がごくわずかであるため、本番環境では保存時暗号化と転送時暗号化の両方を必ず有効にすべきである。特に規制要件（PCI DSS、HIPAA等）がある場合は必須である。
:::

### 3.5 モニタリング

マネージドデータベースの効果的な運用には、適切なモニタリングが不可欠である。各サービスが提供するモニタリング機能を整理する。

#### 3.5.1 メトリクス

RDS/AuroraはCloudWatch、Cloud SQLはCloud Monitoringを通じて以下のようなメトリクスを提供する。

```mermaid
graph TB
    subgraph metrics["主要モニタリングメトリクス"]
        subgraph compute_m["コンピュートメトリクス"]
            CPU["CPU使用率"]
            Mem["空きメモリ"]
            Conn["アクティブ接続数"]
        end
        subgraph storage_m["ストレージメトリクス"]
            IOPS["Read/Write IOPS"]
            Throughput["I/Oスループット"]
            FreeStorage["空きストレージ"]
        end
        subgraph repl_m["レプリケーションメトリクス"]
            Lag["レプリケーションラグ"]
            BinLog["バイナリログ位置"]
        end
        subgraph db_m["DBメトリクス"]
            SlowQ["スロークエリ数"]
            Deadlock["デッドロック数"]
            TempTable["一時テーブル作成数"]
        end
    end

    style compute_m fill:#e3f2fd,stroke:#1565c0
    style storage_m fill:#fff3e0,stroke:#ef6c00
    style repl_m fill:#e8f5e9,stroke:#2e7d32
    style db_m fill:#fce4ec,stroke:#c62828
```

#### 3.5.2 Performance Insights と Query Insights

**RDS Performance Insights**（RDS/Aurora対応）は、データベースの負荷をSQL文、ユーザー、ホスト、Wait Eventなどの軸で分析できるダッシュボードである。特にDB Load（Average Active Sessions）メトリクスは、データベースの負荷状況を直感的に把握するのに極めて有用である。

**Cloud SQL Query Insights**は同様の機能をCloud SQLに提供し、タグベースのクエリ集約やクエリプランの確認が可能である。

> [!TIP]
> Performance Insightsの「DB Load」メトリクスがvCPU数を超えている場合、データベースは過負荷の状態にある。Wait Eventの内訳を確認し、I/O待ちなのかロック待ちなのかCPU不足なのかを特定することが、トラブルシューティングの第一歩である。

### 3.6 インフラストラクチャ・アズ・コードによる管理

マネージドデータベースの構成管理にはTerraformやCloudFormationなどのIaCツールを使用することが推奨される。以下はTerraformでAurora PostgreSQLクラスターを定義する例である。

```hcl
resource "aws_rds_cluster" "main" {
  cluster_identifier     = "myapp-aurora-cluster"
  engine                 = "aurora-postgresql"
  engine_version         = "15.4"
  database_name          = "myapp"
  master_username        = "admin"
  master_password        = var.db_master_password

  # Storage encryption
  storage_encrypted      = true
  kms_key_id             = aws_kms_key.db.arn

  # Backup
  backup_retention_period = 14
  preferred_backup_window = "03:00-04:00"

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  # Maintenance
  preferred_maintenance_window = "sun:04:00-sun:05:00"

  # Deletion protection
  deletion_protection    = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "myapp-final-snapshot"
}

resource "aws_rds_cluster_instance" "writer" {
  identifier         = "myapp-aurora-writer"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = "db.r6g.xlarge"
  engine             = aws_rds_cluster.main.engine

  # Enhanced Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn

  # Performance Insights
  performance_insights_enabled    = true
  performance_insights_retention_period = 7
}

resource "aws_rds_cluster_instance" "reader" {
  count              = 2
  identifier         = "myapp-aurora-reader-${count.index}"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = "db.r6g.xlarge"
  engine             = aws_rds_cluster.main.engine

  # Failover priority
  promotion_tier     = 1
}
```

## 4. 運用の実際

### 4.1 パフォーマンスチューニング

マネージドデータベースにおけるパフォーマンスチューニングは、インフラストラクチャレベルとデータベースレベルの両方で行う必要がある。

#### 4.1.1 インスタンスサイズの選定

適切なインスタンスサイズの選定は、パフォーマンスとコストのバランスにおいて最も重要な判断の一つである。

```mermaid
graph TB
    subgraph decision["インスタンスサイズ選定のフロー"]
        Start["ワークロードの特性を分析"]
        Start --> Q1{"CPU集約型？<br/>（複雑なクエリ, 集計）"}
        Q1 -- "Yes" --> Compute["コンピュート最適化<br/>（db.r系, db.m系の高CPU）"]
        Q1 -- "No" --> Q2{"メモリ集約型？<br/>（大きなバッファプール）"}
        Q2 -- "Yes" --> Memory["メモリ最適化<br/>（db.r系）"]
        Q2 -- "No" --> Q3{"I/O集約型？<br/>（大量のランダムI/O）"}
        Q3 -- "Yes" --> IO["I/O最適化<br/>（Provisioned IOPS + db.r系）"]
        Q3 -- "No" --> General["汎用<br/>（db.m系）"]
    end

    style decision fill:#f5f5f5,stroke:#616161
```

一般的な経験則として、以下が参考になる。

- **バッファプール/共有バッファ**：データベースのワーキングセット（頻繁にアクセスされるデータとインデックス）がバッファプールに収まるだけのメモリを確保する
- **vCPU数**：同時実行クエリの数に対して十分なvCPUを確保する。CPU使用率が持続的に70%を超える場合はスケールアップを検討
- **ネットワーク帯域**：インスタンスサイズが大きいほどネットワーク帯域も広い。大量のデータ転送が発生するワークロードでは考慮が必要

#### 4.1.2 クエリレベルのチューニング

インフラストラクチャの最適化だけでは根本的な性能問題は解決しない。多くの場合、性能問題の本質はクエリやインデックス設計にある。

Performance InsightsやQuery Insightsで特定されたスロークエリに対しては、以下のアプローチを取る。

1. **EXPLAINによる実行計画の確認**：Full Table Scanが発生していないか、適切なインデックスが使われているか
2. **インデックスの追加・見直し**：WHERE句やJOIN条件に対するインデックスの有無を確認
3. **クエリの書き換え**：N+1問題の解消、サブクエリからJOINへの書き換え、不要なカラムの除外
4. **パーティショニングの検討**：大規模テーブルに対する範囲パーティショニング

> [!CAUTION]
> 「インスタンスをスケールアップすれば解決する」という安易な判断は避けるべきである。Full Table Scanを行うクエリは、インスタンスサイズを2倍にしてもデータ量が2倍になれば再び問題になる。根本的な解決はクエリとインデックスの最適化にある。

### 4.2 スケーリング戦略

#### 4.2.1 垂直スケーリング（スケールアップ）

インスタンスサイズの変更により、CPU、メモリ、ネットワーク帯域を増加させる。

- **RDS**：インスタンスクラスの変更は数分のダウンタイムを伴う（Multi-AZの場合、スタンバイを先に変更し、フェイルオーバー後にプライマリを変更）
- **Cloud SQL**：同様に短時間のダウンタイムが発生
- **Aurora**：Readerインスタンスを先にスケールアップし、フェイルオーバーさせることでダウンタイムを最小化できる

#### 4.2.2 水平スケーリング（スケールアウト）

Read Replicaの追加により読み取り負荷を分散する。ただし、書き込みのスケーリングには直接寄与しない。

```mermaid
graph TB
    subgraph scaling["スケーリング戦略の使い分け"]
        subgraph vertical["垂直スケーリング"]
            V1["CPU/メモリの増加"]
            V2["書き込み性能の向上"]
            V3["適用: 書き込みが集中するワークロード"]
        end

        subgraph horizontal["水平スケーリング（Read Replica）"]
            H1["読み取り能力の分散"]
            H2["レポーティング負荷のオフロード"]
            H3["適用: 読み取りが多いワークロード"]
        end

        subgraph app_level["アプリケーションレベル"]
            A1["キャッシュ層の導入（Redis/Memcached）"]
            A2["読み書き分離の実装"]
            A3["シャーディング（最後の手段）"]
        end
    end

    style vertical fill:#e3f2fd,stroke:#1565c0
    style horizontal fill:#e8f5e9,stroke:#2e7d32
    style app_level fill:#fff3e0,stroke:#ef6c00
```

#### 4.2.3 Aurora Auto Scaling

AuroraはReaderインスタンスの自動スケーリングをサポートしている。CloudWatchメトリクス（CPU使用率や接続数など）に基づいて、Readerインスタンスの数を自動的に増減させることができる。

```hcl
resource "aws_appautoscaling_target" "aurora_reader" {
  service_namespace  = "rds"
  scalable_dimension = "rds:cluster:ReadReplicaCount"
  resource_id        = "cluster:${aws_rds_cluster.main.cluster_identifier}"
  min_capacity       = 1
  max_capacity       = 5
}

resource "aws_appautoscaling_policy" "aurora_reader_cpu" {
  name               = "aurora-reader-cpu-scaling"
  service_namespace  = aws_appautoscaling_target.aurora_reader.service_namespace
  scalable_dimension = aws_appautoscaling_target.aurora_reader.scalable_dimension
  resource_id        = aws_appautoscaling_target.aurora_reader.resource_id
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "RDSReaderAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
  }
}
```

### 4.3 フェイルオーバーの挙動

フェイルオーバーの挙動を正しく理解し、アプリケーション側で適切に対処することは運用上非常に重要である。

#### 4.3.1 フェイルオーバー時に起こること

```mermaid
sequenceDiagram
    participant App as アプリケーション
    participant DNS as DNS エンドポイント
    participant Old as 旧プライマリ
    participant New as 新プライマリ（旧スタンバイ）

    Note over Old: 障害発生
    App->>DNS: 接続試行
    DNS-->>App: 旧プライマリのIPを返す
    App->>Old: 接続失敗（タイムアウト）

    Note over DNS: DNSレコード更新
    Note over New: スタンバイが昇格

    App->>DNS: 再接続試行
    DNS-->>App: 新プライマリのIPを返す
    App->>New: 接続成功
    Note over App: サービス復旧
```

フェイルオーバー時にアプリケーション側で発生する影響は以下の通りである。

1. **既存の接続が切断される**：アクティブなクエリは失敗する
2. **DNSキャッシュによる遅延**：DNSのTTLが切れるまで古いIPが参照される可能性
3. **コミットされていないトランザクションの喪失**：フェイルオーバー時にコミット途中のトランザクションは失われる

#### 4.3.2 アプリケーション側の対策

フェイルオーバーに耐えるアプリケーション設計のポイントは以下の通りである。

- **リトライロジックの実装**：接続エラーやタイムアウト時に自動的にリトライする仕組みを組み込む
- **DNSキャッシュの短縮**：JVMのDNSキャッシュTTLを短く設定する（`networkaddress.cache.ttl=5`など）
- **コネクションプールの設定**：接続の有効性チェック（validation query）を有効にし、無効な接続をプールから除去する
- **冪等なAPI設計**：リトライが安全に行えるように、APIを冪等に設計する

::: tip
RDS ProxyやPgBouncerなどのコネクションプーリングツールを使用すると、フェイルオーバー時の接続切り替えがアプリケーションからは透過的に行われるため、アプリケーション側の対策が大幅に簡素化される。
:::

### 4.4 コスト管理

マネージドデータベースのコストは、多くの場合クラウド利用料の中で上位を占める。コストの内訳を理解し、最適化することは運用上の重要課題である。

#### 4.4.1 コスト構造

```mermaid
pie title マネージドDBの典型的なコスト内訳
    "インスタンス時間" : 55
    "ストレージ" : 20
    "I/O" : 10
    "バックアップストレージ" : 5
    "データ転送" : 5
    "その他（スナップショット等）" : 5
```

コスト最適化の主なアプローチは以下の通りである。

**リザーブドインスタンス / Committed Use Discounts：**

| 購入方式 | 割引率（目安） | 適用サービス |
|---|---|---|
| RDS Reserved Instance（1年、全前払い） | 約40% | RDS, Aurora |
| RDS Reserved Instance（3年、全前払い） | 約60% | RDS, Aurora |
| Cloud SQL Committed Use Discount（1年） | 約25% | Cloud SQL |
| Cloud SQL Committed Use Discount（3年） | 約52% | Cloud SQL |

**その他のコスト最適化手法：**

- **非本番環境の停止**：開発・ステージング環境のインスタンスを営業時間外に停止する（RDSは最大7日間停止可能）
- **Graviton / Arm系インスタンス**：RDSでは`db.r7g`（Graviton3）インスタンスが同等のx86インスタンスより約20%安価
- **Aurora I/O-Optimized**：I/O料金が多い場合、I/O-Optimizedストレージ設定によりI/O料金を無料にできる（ストレージ単価は上昇）
- **不要なRead Replicaの削除**：使用されていないRead Replicaは即座に削除する
- **ストレージタイプの見直し**：Provisioned IOPSが不要なワークロードではgp3ストレージ（RDS）を使用する

> [!WARNING]
> リザーブドインスタンスの購入は、ワークロードが安定してから行うべきである。インスタンスサイズの変更が頻繁に見込まれる段階では、柔軟性を維持するためにオンデマンドで運用する方が適切な場合もある。

### 4.5 マイグレーション

既存のデータベースをマネージドサービスに移行する際には、いくつかの手法が選択肢として存在する。

#### 4.5.1 マイグレーション手法の比較

```mermaid
graph TB
    subgraph methods["マイグレーション手法"]
        subgraph dump["論理ダンプ/リストア"]
            D1["mysqldump / pg_dump"]
            D2["メリット: シンプル, エンジン間移行可能"]
            D3["デメリット: 大規模DBでは時間がかかる"]
        end

        subgraph dms["AWS DMS"]
            DMS1["Database Migration Service"]
            DMS2["メリット: 継続的レプリケーション, 異種DB間対応"]
            DMS3["デメリット: 設定の複雑さ, 一部制約あり"]
        end

        subgraph native["ネイティブレプリケーション"]
            N1["MySQL/PostgreSQL の<br/>ネイティブレプリケーション"]
            N2["メリット: 低レイテンシ, 信頼性"]
            N3["デメリット: 同一エンジン間のみ"]
        end
    end

    style dump fill:#e3f2fd,stroke:#1565c0
    style dms fill:#e8f5e9,stroke:#2e7d32
    style native fill:#fff3e0,stroke:#ef6c00
```

#### 4.5.2 AWS Database Migration Service（DMS）

AWS DMSは、データベースマイグレーションのためのマネージドサービスである。ソースデータベースを稼働させたまま、ターゲットデータベースへの移行を行うことができる。

DMSの特徴は以下の通りである。

- **フルロード＋CDC**：初期データのフルコピー後、Change Data Capture（CDC）により差分を継続的にレプリケーション
- **異種DB間の移行**：Oracle → PostgreSQL、SQL Server → MySQLなど、異なるエンジン間の移行に対応（Schema Conversion Toolと併用）
- **最小ダウンタイム**：CDCによりソースとターゲットが同期されるため、カットオーバー時のダウンタイムを最小化

#### 4.5.3 pgloaderとその他のツール

PostgreSQLへの移行では、**pgloader**が広く使われている。MySQLからPostgreSQLへのスキーマ変換とデータロードを一括で行える点が特徴である。

```
LOAD DATABASE
     FROM mysql://user:password@source-host/sourcedb
     INTO postgresql://user:password@target-rds/targetdb

 WITH include drop, create tables, create indexes,
      reset sequences, downcase identifiers

  SET work_mem to '128MB',
      maintenance_work_mem to '512MB'

 CAST type int with extra auto_increment to serial;
```

::: details マイグレーション計画のチェックリスト
1. **現状分析**：ソースデータベースのサイズ、スキーマの複雑さ、ストアドプロシージャの有無を確認
2. **互換性の確認**：ターゲットエンジンでサポートされていない機能（特定のデータ型、関数、構文）を洗い出す
3. **テスト環境での検証**：マイグレーション手順を開発環境で繰り返しテストする
4. **性能テスト**：移行後のデータベースで本番相当のワークロードをテストする
5. **ロールバック計画**：移行が失敗した場合の切り戻し手順を準備する
6. **カットオーバー手順**：アプリケーションの接続先切り替え、DNS変更、キャッシュクリアなどの手順を文書化する
7. **監視強化**：移行直後は通常より監視の閾値を厳しくし、異常の早期検知を行う
:::

## 5. 将来展望

### 5.1 Aurora Serverless v2

Aurora Serverless v2は、ワークロードに応じてコンピュートキャパシティを自動的にスケーリングするAuroraの構成オプションである。v1からの大幅な改良により、秒単位でのスケーリングが可能になった。

```mermaid
graph TB
    subgraph serverless["Aurora Serverless v2 のスケーリング"]
        subgraph config["設定"]
            Min["最小ACU: 0.5"]
            Max["最大ACU: 128"]
        end

        subgraph scaling["スケーリング動作"]
            Low["低負荷時<br/>0.5 ACU<br/>（約1GB RAM）"]
            Mid["中負荷時<br/>16 ACU<br/>（約32GB RAM）"]
            High["高負荷時<br/>128 ACU<br/>（約256GB RAM）"]
        end

        Low -- "負荷増加" --> Mid
        Mid -- "負荷増加" --> High
        High -- "負荷減少" --> Mid
        Mid -- "負荷減少" --> Low
    end

    style config fill:#f5f5f5,stroke:#616161
    style scaling fill:#e3f2fd,stroke:#1565c0
```

> [!NOTE]
> ACU（Aurora Capacity Unit）は、約2GBのメモリと対応するCPU・ネットワークリソースを表す単位である。0.5 ACU刻みでスケーリングされる。

Aurora Serverless v2の主な利点は以下の通りである。

- **細粒度のスケーリング**：0.5 ACU単位で秒単位のスケーリング
- **プロビジョンドインスタンスとの混在**：同一クラスター内でプロビジョンドWriterとServerless v2 Readerを混在可能
- **コスト効率**：使用したACU時間に対してのみ課金されるため、負荷が変動するワークロードに最適
- **完全なAurora機能互換**：Global Database、Blue/Green Deploymentなど、Auroraの機能をフル活用可能

ただし、注意点もある。

- 最小ACUを0にすることはできない（v1では0スケーリングが可能だった）。完全な停止にはクラスター自体の停止が必要
- 急激な負荷増加時にはスケーリングが追いつかない場合がある
- 安定した高負荷ワークロードでは、プロビジョンドインスタンスの方がコスト効率が良い場合がある

### 5.2 新興データベースサービス

従来のRDS/Cloud SQL/Auroraに対して、新しいアーキテクチャを持つデータベースサービスが台頭している。

#### 5.2.1 Neon

NeonはPostgreSQLのストレージ層を再設計し、「サーバーレスPostgreSQL」を実現するサービスである。Auroraと同様のコンピュート・ストレージ分離アーキテクチャを採用しているが、さらに進んだ特徴を持つ。

- **ブランチ機能**：Gitのブランチのように、データベースの任意の時点からブランチを作成できる。Copy-on-Write方式であり、テラバイト規模のデータベースでも瞬時にブランチが作成される
- **スケールトゥゼロ**：接続がない場合にコンピュートを完全に停止し、料金を0にできる
- **Pageserver**：PostgreSQLのページをオンデマンドでコンピュートノードにストリーミングするカスタムストレージバックエンド

```mermaid
graph TB
    subgraph neon["Neon のアーキテクチャ"]
        subgraph compute_n["コンピュート層"]
            C1["Compute (main)"]
            C2["Compute (feature-branch)"]
            C3["Compute (staging)"]
        end

        subgraph storage_n["ストレージ層"]
            PS["Pageserver"]
            Safekeep["Safekeeper<br/>（WAL受信）"]
            S3["オブジェクトストレージ<br/>（S3互換）"]
        end

        C1 --> Safekeep
        C2 -.-> PS
        C3 -.-> PS
        Safekeep --> PS
        PS --> S3
    end

    style compute_n fill:#e3f2fd,stroke:#1565c0
    style storage_n fill:#fff3e0,stroke:#ef6c00
```

#### 5.2.2 PlanetScale

PlanetScaleはMySQLの分散データベースシステムであるVitessをベースとしたマネージドサービスである。YouTubeのデータベース基盤として開発されたVitessの技術を、セルフサービスのデータベースプラットフォームとして提供している。

PlanetScaleの特徴は以下の通りである。

- **ノンブロッキングスキーマ変更**：`gh-ost`相当のオンラインスキーマ変更が組み込まれており、本番テーブルへの変更がロックなしで適用される
- **ブランチベースのワークフロー**：Gitのようにデータベーススキーマのブランチを作成し、Pull Requestを通じてマージできる
- **水平シャーディング**：Vitessのシャーディング機能により、単一のMySQL互換インターフェースの背後で水平スケーリングが可能

#### 5.2.3 Supabase

SupabaseはPostgreSQLをベースとしたBaaS（Backend as a Service）であり、マネージドPostgreSQLに加えて、認証、リアルタイムサブスクリプション、ストレージ、Edge Functionsなどを統合的に提供する。Firebase（Google）のオープンソースな代替として位置づけられている。

### 5.3 マルチリージョン展開

グローバルなサービスを提供する場合、単一リージョンのデータベースでは地理的に遠いユーザーへのレイテンシが問題になる。各サービスはマルチリージョン展開のための機能を提供している。

#### 5.3.1 Aurora Global Database

Aurora Global Databaseは、1つのプライマリリージョンから最大5つのセカンダリリージョンにデータをレプリケーションする機能である。

```mermaid
graph TB
    subgraph primary["プライマリリージョン（東京）"]
        PW["Writer"]
        PR1["Reader"]
        PS["ストレージ"]
        PW --> PS
        PR1 -.-> PS
    end

    subgraph secondary1["セカンダリリージョン（US East）"]
        SR1["Reader"]
        SS1["ストレージ"]
        SR1 -.-> SS1
    end

    subgraph secondary2["セカンダリリージョン（EU West）"]
        SR2["Reader"]
        SS2["ストレージ"]
        SR2 -.-> SS2
    end

    PS -- "ストレージレベル<br/>レプリケーション<br/>（通常1秒以下）" --> SS1
    PS -- "ストレージレベル<br/>レプリケーション<br/>（通常1秒以下）" --> SS2

    style primary fill:#fce4ec,stroke:#c62828
    style secondary1 fill:#e3f2fd,stroke:#1565c0
    style secondary2 fill:#e8f5e9,stroke:#2e7d32
```

Aurora Global Databaseの特徴は以下の通りである。

- **低レイテンシのレプリケーション**：ストレージ層でのレプリケーションにより、通常1秒以下のレプリケーションラグ
- **Managed Planned Failover**：計画的なリージョン切り替えを最小ダウンタイムで実行（RPO = 0）
- **Unplanned Failover**：災害復旧時にセカンダリリージョンをプライマリに昇格（RPO = 通常1秒以下、RTO = 1分以下）
- **Write Forwarding**：セカンダリリージョンのReaderからの書き込みをプライマリに転送する機能

#### 5.3.2 Cloud SQL Cross-Region Replica

Cloud SQLでもクロスリージョンRead Replicaを作成できるが、フェイルオーバーは自動ではなく、手動でのプロモーションが必要である。

#### 5.3.3 NewSQLの可能性

真のマルチリージョン書き込みを実現するには、Google Cloud SpannerやCockroachDBなどのNewSQLデータベースが選択肢となる。これらはコンセンサスプロトコルにより、複数リージョンでの強整合性のある書き込みを実現するが、レイテンシの増加やコストの上昇というトレードオフがある。

### 5.4 今後のトレンド

マネージドデータベースの分野は急速に進化を続けている。今後注目されるトレンドを挙げる。

**サーバーレスの深化：** Aurora Serverless v2やNeonに見られるように、データベースのプロビジョニングという概念自体がなくなりつつある。将来的には、データベースの利用がクエリ単位の課金に近づいていく可能性がある。

**AI統合：** Amazon Aurora ML、Cloud SQL for Vertex AIなど、データベースとMLモデルの統合が進んでいる。SQL文から直接ML推論を呼び出すことが可能になりつつあり、データの移動を最小化したリアルタイム推論の需要は今後さらに高まるだろう。

**コンピュートとストレージの完全分離：** Auroraが先駆けとなったこのアーキテクチャは、Neon、AlloyDB（Google）、Aurora DSQL（AWS）など、多くの新サービスで採用されている。コンピュートの瞬時スケーリング、ストレージの独立したスケーリング、効率的なクローン・ブランチ機能など、このアーキテクチャの利点は計り知れない。

**エッジデータベース：** Cloudflare D1やTursoのようなエッジで動作するデータベースも登場している。SQLiteベースのこれらのサービスは、CDNのエッジロケーションでの超低レイテンシなデータアクセスを実現する。

```mermaid
graph LR
    subgraph evolution["マネージドDBの進化の方向性"]
        Gen1["第1世代<br/>RDS, Cloud SQL<br/>（EC2上のDB管理を自動化）"]
        Gen2["第2世代<br/>Aurora, AlloyDB<br/>（ストレージ分離）"]
        Gen3["第3世代<br/>Aurora Serverless v2, Neon<br/>（サーバーレス）"]
        Gen4["第4世代<br/>Aurora DSQL, Edge DB<br/>（分散・エッジ）"]

        Gen1 --> Gen2 --> Gen3 --> Gen4
    end

    style Gen1 fill:#e3f2fd,stroke:#1565c0
    style Gen2 fill:#e8f5e9,stroke:#2e7d32
    style Gen3 fill:#fff3e0,stroke:#ef6c00
    style Gen4 fill:#f3e5f5,stroke:#7b1fa2
```

## 6. まとめ

マネージドデータベースサービスは、データベース運用の複雑さを大幅に軽減し、開発者がアプリケーションのロジックに集中できる環境を提供する。しかし、「マネージド」は「運用不要」を意味しない。適切なインスタンスサイズの選定、クエリの最適化、バックアップ戦略の設計、フェイルオーバーへの備え、コスト管理など、利用者側の責任は依然として大きい。

サービスの選択においては、以下のような判断基準が参考になる。

- **RDS**：成熟した運用実績、Oracle/SQL Serverサポートが必要な場合、コスト重視の場合
- **Cloud SQL**：Google Cloudエコシステムとの統合、Cloud SQL Auth Proxyによる接続管理
- **Aurora**：高い可用性・耐久性の要件、低レプリケーションラグ、高速フェイルオーバーが必要な場合

技術の進化は速く、サーバーレス化、コンピュート・ストレージ分離、マルチリージョン展開といったトレンドは、データベースの運用モデルをさらに変革していくだろう。重要なのは、これらのサービスの内部アーキテクチャを理解し、ワークロードの特性に合った適切な選択を行うことである。
