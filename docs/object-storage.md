---
title: "オブジェクトストレージ（S3, MinIO）"
date: 2026-03-05
tags: ["storage", "object-storage", "s3", "minio", "intermediate"]
---

# オブジェクトストレージ（S3, MinIO）

## 1. オブジェクトストレージとは

### 1.1 基本概念

オブジェクトストレージとは、データを「オブジェクト」という単位で管理するストレージアーキテクチャである。各オブジェクトは以下の3つの要素で構成される。

- **データ本体（Payload）**：任意のバイナリデータ。画像、動画、ログファイル、バックアップアーカイブなど、あらゆる種類のデータを格納できる
- **メタデータ（Metadata）**：オブジェクトに付随する属性情報。システムメタデータ（サイズ、作成日時、ETag など）とユーザー定義メタデータ（カスタムヘッダ）がある
- **一意な識別子（Key）**：バケット内でオブジェクトを一意に特定する文字列。ファイルシステムにおけるパスに相当するが、実際には階層構造を持たないフラットな名前空間である

オブジェクトストレージが従来のストレージ方式と根本的に異なるのは、**POSIX ファイルシステムの意味論を放棄した**という設計判断にある。ディレクトリのトラバーサル、ファイルロック、部分更新（seek + write）、ハードリンクといった機能を犠牲にする代わりに、事実上無制限のスケーラビリティとシンプルな HTTP ベースの API を獲得した。

### 1.2 バケットとオブジェクトの関係

オブジェクトストレージでは、オブジェクトは必ず**バケット（Bucket）**というコンテナに属する。バケットはグローバルに一意な名前を持ち、オブジェクトの名前空間を区切る論理的な単位である。

```mermaid
graph TB
    subgraph "バケット: my-app-images"
        O1["photos/2026/01/sunset.jpg"]
        O2["photos/2026/02/mountain.png"]
        O3["thumbnails/sunset_thumb.jpg"]
    end
    subgraph "バケット: my-app-logs"
        O4["access/2026-03-01.log.gz"]
        O5["error/2026-03-01.log.gz"]
    end
```

上の図では `/` がパス区切りのように見えるが、オブジェクトストレージにとっては `photos/2026/01/sunset.jpg` という文字列全体が1つのキーに過ぎない。`/` は単なる慣習的なデリミタであり、ディレクトリは実在しない。ただし、S3 API の `ListObjectsV2` では `Delimiter` パラメータと `Prefix` パラメータを組み合わせることで、擬似的な階層表示を実現できる。

### 1.3 なぜオブジェクトストレージが必要なのか

2000年代以降、インターネットの普及に伴いデータ量は爆発的に増加した。ユーザーが生成する画像、動画、IoT デバイスのセンサーデータ、アプリケーションログなど、非構造化データの割合が全データの80%を超えるとも言われている。

こうした大量の非構造化データを扱うにあたって、従来のファイルシステムやブロックストレージには以下の限界があった。

1. **スケールの壁**：単一サーバーのディスク容量に制約される
2. **メタデータのボトルネック**：数十億ファイルのディレクトリエントリ管理が困難
3. **運用コスト**：RAID構成、ファイルシステム拡張、バックアップなどの運用負荷が大きい
4. **地理的分散の困難さ**：複数リージョンにまたがるデータ配置の実現が複雑

オブジェクトストレージは、これらの課題を**フラットな名前空間**、**HTTP API によるアクセス**、**自動レプリケーション**、**従量課金モデル**によって解決する。2006年に Amazon S3 がリリースされて以来、オブジェクトストレージはクラウドストレージの事実上の標準となった。

## 2. ファイルシステム・ブロックストレージとの比較

ストレージ技術を正しく選択するためには、3種類のストレージモデル――ブロックストレージ、ファイルシステム（ファイルストレージ）、オブジェクトストレージ――の特性を理解する必要がある。

### 2.1 ブロックストレージ

ブロックストレージはデータを固定長の**ブロック**（通常512バイトまたは4KiB）に分割し、各ブロックにアドレスを割り当てて管理する。物理ディスク（HDD/SSD）やSAN（Storage Area Network）がこれに該当する。

- **アクセス粒度**：ブロック単位（極めて細かい）
- **プロトコル**：iSCSI、Fibre Channel、NVMe-oF
- **特徴**：低レイテンシ、高IOPS。データベースのトランザクション処理、仮想マシンのディスクイメージなど、ランダム I/O が頻繁に発生するワークロードに最適
- **制約**：単一サーバーにアタッチされるのが基本であり、複数クライアントからの同時アクセスにはクラスタファイルシステムなどの追加レイヤが必要

クラウド環境では、AWS の EBS（Elastic Block Store）、Google Cloud の Persistent Disk、Azure の Managed Disk がブロックストレージに相当する。

### 2.2 ファイルストレージ（ファイルシステム）

ファイルストレージはデータを**ファイル**と**ディレクトリ**の階層構造で管理する。POSIX 準拠のインタフェースを提供し、`open()`、`read()`、`write()`、`seek()` といったシステムコールでアクセスする。

- **アクセス粒度**：ファイル単位（部分読み書きも可能）
- **プロトコル**：NFS、SMB/CIFS
- **特徴**：POSIX セマンティクスによる豊富な操作（ロック、リネーム、シンボリックリンクなど）。複数クライアントからの同時アクセスが標準的にサポートされる
- **制約**：メタデータサーバがボトルネックになりやすく、ファイル数がスケールの壁になる

クラウド環境では、AWS の EFS（Elastic File System）、Google Cloud の Filestore、Azure Files がこれに該当する。

### 2.3 オブジェクトストレージ

先述の通り、フラットな名前空間で HTTP API を介してアクセスする。

- **アクセス粒度**：オブジェクト全体（部分更新不可、上書きは全置換）
- **プロトコル**：HTTP/HTTPS（RESTful API）
- **特徴**：事実上無制限のスケーラビリティ、豊富なメタデータ管理、組み込みのデータ冗長化
- **制約**：レイテンシがファイルシステムやブロックストレージより高い、部分更新ができない、POSIX 互換性がない

### 2.4 比較表

| 特性 | ブロックストレージ | ファイルストレージ | オブジェクトストレージ |
|---|---|---|---|
| データ単位 | ブロック（4KiB 等） | ファイル | オブジェクト |
| 名前空間 | LBA（論理ブロックアドレス） | 階層ディレクトリ | フラット（バケット＋キー） |
| プロトコル | iSCSI, NVMe | NFS, SMB | HTTP REST API |
| レイテンシ | 極低（< 1ms） | 低（1-10ms） | 中（10-100ms） |
| スケーラビリティ | TB 級 | PB 級（制約あり） | EB（エクサバイト）級 |
| 部分更新 | 可能 | 可能 | 不可（全置換） |
| メタデータ | 最小限 | POSIX 属性 | 豊富（カスタム可） |
| 同時アクセス | 制限的 | 複数クライアント可 | 大規模並列アクセス可 |
| 主な用途 | DB, VM ディスク | 共有ファイル, ホームディレクトリ | 静的コンテンツ, バックアップ, データレイク |

```mermaid
graph LR
    subgraph "ストレージの抽象化レベル"
        direction TB
        Block["ブロックストレージ<br/>（最も低レベル）"]
        File["ファイルストレージ<br/>（POSIX 抽象化）"]
        Object["オブジェクトストレージ<br/>（HTTP API 抽象化）"]
    end
    Block -->|"ファイルシステムが<br/>ブロック上に構築"| File
    File -->|"POSIX を放棄し<br/>スケーラビリティを優先"| Object
```

### 2.5 選択の指針

ワークロードの特性に応じて適切なストレージを選択することが重要である。

- **データベースやトランザクション処理**：ブロックストレージ（低レイテンシ、ランダム I/O が必要）
- **複数サーバーからの共有ファイルアクセス**：ファイルストレージ（POSIX セマンティクスが必要）
- **大量の非構造化データ、静的コンテンツ配信、バックアップ**：オブジェクトストレージ（スケーラビリティとコスト効率を優先）

実際のアーキテクチャでは、これら3種を組み合わせて使うことが一般的である。たとえば、Web アプリケーションでは PostgreSQL のデータファイルを EBS（ブロック）に配置し、ユーザーがアップロードした画像は S3（オブジェクト）に保存し、機械学習モデルの学習データは EFS（ファイル）で共有するといった構成が典型的である。

## 3. S3 API

### 3.1 S3 API の歴史と影響

Amazon S3（Simple Storage Service）は2006年3月にリリースされ、クラウドコンピューティングの黎明期を象徴するサービスとなった。S3 が提供する RESTful API は事実上のオブジェクトストレージ API の標準となり、Google Cloud Storage、Azure Blob Storage、MinIO、Ceph、Wasabi など多くのストレージサービスやソフトウェアがS3互換 API を実装している。

S3 API がデファクトスタンダードとなった理由は、そのシンプルさにある。基本操作はわずか数種類であり、HTTP メソッドとの対応が直感的である。

### 3.2 基本操作

S3 API の主要なオペレーションは以下の通りである。

| 操作 | HTTP メソッド | 説明 |
|---|---|---|
| `PutObject` | `PUT` | オブジェクトの作成・更新 |
| `GetObject` | `GET` | オブジェクトの取得 |
| `DeleteObject` | `DELETE` | オブジェクトの削除 |
| `HeadObject` | `HEAD` | メタデータのみ取得 |
| `ListObjectsV2` | `GET` (バケットに対して) | オブジェクト一覧の取得 |
| `CopyObject` | `PUT` + `x-amz-copy-source` ヘッダ | オブジェクトのコピー |
| `CreateMultipartUpload` | `POST` | マルチパートアップロード開始 |

#### PutObject の例

```http
PUT /my-bucket/photos/sunset.jpg HTTP/1.1
Host: s3.amazonaws.com
Content-Type: image/jpeg
Content-Length: 2048576
x-amz-meta-photographer: tanaka
x-amz-storage-class: STANDARD
Authorization: AWS4-HMAC-SHA256 Credential=...

<binary data>
```

`x-amz-meta-` プレフィックスを付けたヘッダでカスタムメタデータを設定できる。これはオブジェクトに紐づけて保存され、後から `HeadObject` や `GetObject` で取得できる。

#### GetObject の例

```http
GET /my-bucket/photos/sunset.jpg HTTP/1.1
Host: s3.amazonaws.com
Authorization: AWS4-HMAC-SHA256 Credential=...
Range: bytes=0-1023
```

`Range` ヘッダを用いることで、オブジェクトの一部分のみを取得できる。これは大容量ファイルの部分取得や、レジューム可能なダウンロードに活用される。

### 3.3 マルチパートアップロード

S3 では5GBを超えるオブジェクトはマルチパートアップロードを使用する必要があり、5MBから5GBまでのオブジェクトにも推奨される。マルチパートアップロードは大容量ファイルを複数のパートに分割して並列にアップロードし、最後にそれらを結合する仕組みである。

```mermaid
sequenceDiagram
    participant Client as クライアント
    participant S3 as S3

    Client->>S3: CreateMultipartUpload
    S3-->>Client: UploadId

    par 並列アップロード
        Client->>S3: UploadPart (Part 1)
        S3-->>Client: ETag-1
    and
        Client->>S3: UploadPart (Part 2)
        S3-->>Client: ETag-2
    and
        Client->>S3: UploadPart (Part 3)
        S3-->>Client: ETag-3
    end

    Client->>S3: CompleteMultipartUpload<br/>(UploadId, [ETag-1, ETag-2, ETag-3])
    S3-->>Client: 200 OK (ETag)
```

マルチパートアップロードの利点は以下の通りである。

1. **並列化によるスループット向上**：複数のパートを同時にアップロードすることで、帯域幅を最大限に活用できる
2. **障害耐性**：一部のパートのアップロードが失敗しても、そのパートだけを再送すればよい。全体をやり直す必要がない
3. **ストリーミングアップロード**：データの総サイズが事前に分からない場合でも、生成されたデータを逐次アップロードできる

なお、中断されたマルチパートアップロード（不完全なアップロード）はストレージ料金が発生し続けるため、ライフサイクルポリシーで自動的にアボートする設定が推奨される。

### 3.4 バージョニング

S3 バケットではバージョニングを有効にすることで、同一キーに対する複数のバージョンを保持できる。オブジェクトが上書きされても過去のバージョンが保存され、誤削除からの復旧が可能になる。

```mermaid
graph TB
    subgraph "キー: photos/sunset.jpg"
        V3["Version 3 (最新)<br/>VersionId: abc789<br/>2026-03-05"]
        V2["Version 2<br/>VersionId: def456<br/>2026-03-03"]
        V1["Version 1<br/>VersionId: ghi123<br/>2026-03-01"]
    end
    V3 --> V2 --> V1
```

バージョニング有効時に `DeleteObject` を実行すると、オブジェクトは物理的に削除されるのではなく、**削除マーカー（Delete Marker）**が最新バージョンとして挿入される。これにより、通常の `GetObject` ではオブジェクトが存在しないように見えるが、特定の `VersionId` を指定すれば過去のバージョンにアクセスできる。

### 3.5 リクエストのアドレッシングスタイル

S3 API では、バケットとオブジェクトを指定する方式として2つのスタイルが存在する。

- **パススタイル**：`https://s3.amazonaws.com/my-bucket/my-key`
- **仮想ホスト型スタイル**：`https://my-bucket.s3.amazonaws.com/my-key`

AWS は2023年以降、仮想ホスト型スタイルを標準とし、パススタイルの新規バケットでの利用を非推奨としている。仮想ホスト型スタイルでは、バケット名がDNSホスト名の一部になるため、バケット名はDNSラベルとして有効な文字列でなければならない（小文字英数字、ハイフン、ピリオド、3〜63文字）。

## 4. Amazon S3 のアーキテクチャ

### 4.1 全体像

Amazon S3 は AWS の中でも最も初期から存在するサービスであり、極めて大規模な分散システムである。S3 は2024年時点で400兆を超えるオブジェクトを保存し、ピーク時には毎秒数千万リクエストを処理している。この規模を支えるアーキテクチャの概要を解説する。

```mermaid
graph TB
    Client["クライアント"] --> FE["フロントエンド<br/>(リクエストルーティング)"]
    FE --> Index["インデックスサブシステム<br/>(メタデータ管理)"]
    FE --> Storage["ストレージサブシステム<br/>(データ永続化)"]
    Index --> Placement["配置サブシステム<br/>(データ配置決定)"]
    Storage --> Disk1["物理ストレージ<br/>AZ-1"]
    Storage --> Disk2["物理ストレージ<br/>AZ-2"]
    Storage --> Disk3["物理ストレージ<br/>AZ-3"]
```

### 4.2 フロントエンド層

クライアントからの HTTP リクエストを受け付けるのがフロントエンド層である。この層は以下の責務を担う。

1. **認証・認可**：AWS Signature Version 4 による署名の検証、IAM ポリシーやバケットポリシーに基づくアクセス制御
2. **リクエストルーティング**：バケット名とキーに基づいて、適切なバックエンドパーティションにリクエストを振り分ける
3. **レート制限**：バケットごとのリクエストレートを管理し、過負荷を防止する
4. **TLS 終端**：HTTPS 通信の暗号化・復号を処理する

S3 はバケットのキー空間を自動的にパーティション分割し、リクエスト負荷を分散させる。特定のプレフィックスにリクエストが集中した場合、S3 はそのプレフィックスをさらに細かいパーティションに分割してスケーリングする。2018年7月のアップデートにより、S3 はプレフィックスあたり毎秒3,500回の PUT/COPY/POST/DELETE リクエストと5,500回の GET/HEAD リクエストをサポートするようになり、キー命名戦略（ランダムプレフィックスの付与など）を意識する必要がほぼなくなった。

### 4.3 インデックスサブシステム

インデックスサブシステムはオブジェクトのメタデータを管理する。キーからオブジェクトの物理的な保存場所を解決するのがこの層の役割である。

各バケットは内部的に複数のパーティションに分割されており、各パーティションのメタデータは独立した分散データベースに保存される。このメタデータには以下の情報が含まれる。

- オブジェクトキー
- バージョン情報
- オブジェクトサイズ
- ETag（通常はMD5ハッシュ）
- ストレージクラス
- 暗号化情報
- データの物理的保存場所へのポインタ

### 4.4 ストレージサブシステムとデータ永続性

S3 は **99.999999999%（イレブンナイン）** のデータ耐久性を設計目標として掲げている。この驚異的な耐久性は、以下のメカニズムによって実現されている。

1. **複数AZへのレプリケーション**：標準ストレージクラス（S3 Standard）では、データは最低3つのアベイラビリティゾーン（AZ）に自動的にレプリケートされる
2. **イレイジャーコーディング**：単純な3重コピーではなく、Reed-Solomon符号などのイレイジャーコーディング技術を用いてストレージ効率を高めながら冗長性を確保している
3. **整合性チェック**：保存時と読み取り時にチェックサム（CRC、MD5）を検証し、ビット腐敗（Silent Data Corruption）を検出・修復する
4. **自動修復**：破損や消失が検出されたデータフラグメントは、残存するフラグメントから自動的に再構築される

```mermaid
graph TB
    subgraph "イレイジャーコーディングの概念"
        Original["元データ<br/>（例: 6 データフラグメント）"]
        Original --> EC["イレイジャーコーディング<br/>エンコーダ"]
        EC --> D1["Data 1"]
        EC --> D2["Data 2"]
        EC --> D3["Data 3"]
        EC --> D4["Data 4"]
        EC --> D5["Data 5"]
        EC --> D6["Data 6"]
        EC --> P1["Parity 1"]
        EC --> P2["Parity 2"]
        EC --> P3["Parity 3"]
    end
```

イレイジャーコーディング（例: 6+3 構成）では、元データを6つのフラグメントに分割し、3つのパリティフラグメントを生成する。9つのフラグメントのうち任意の6つが残っていれば元データを完全に復元できる。3重コピーでは3倍のストレージ容量が必要だが、6+3イレイジャーコーディングでは1.5倍で済み、同等以上の冗長性を実現できる。

### 4.5 ストレージクラス

S3 はアクセス頻度とコスト要件に応じた複数のストレージクラスを提供している。

| ストレージクラス | 用途 | AZ 数 | 取り出しコスト | 備考 |
|---|---|---|---|---|
| S3 Standard | 頻繁にアクセスするデータ | ≥ 3 | なし | 最も高いストレージ単価 |
| S3 Intelligent-Tiering | アクセスパターン不明 | ≥ 3 | なし | 自動的にティア移動 |
| S3 Standard-IA | 低頻度アクセス | ≥ 3 | あり | 最小課金サイズ 128KB |
| S3 One Zone-IA | 再作成可能な低頻度データ | 1 | あり | 単一AZ |
| S3 Glacier Instant Retrieval | アーカイブ（即座に取得） | ≥ 3 | あり | ミリ秒での取り出し |
| S3 Glacier Flexible Retrieval | アーカイブ | ≥ 3 | あり | 数分〜数時間 |
| S3 Glacier Deep Archive | 長期保管 | ≥ 3 | あり | 12〜48時間 |

ストレージクラス間の移行はライフサイクルポリシー（後述）で自動化できる。Intelligent-Tiering は監視料金（月額オブジェクトあたり約$0.0025/1,000件）がかかるが、アクセスパターンを自動分析して最適なティアに移動してくれるため、アクセスパターンが予測困難なワークロードに適している。

## 5. 結果整合性と強い一貫性

### 5.1 分散システムにおける一貫性モデル

分散ストレージシステムの設計において、一貫性（Consistency）モデルの選択は根幹的な設計判断である。CAP定理が示す通り、ネットワーク分断が起こりうる分散システムでは、一貫性と可用性のトレードオフが避けられない。

**強い一貫性（Strong Consistency）** は、書き込み操作が完了した後、すべての読み取り操作が最新の値を返すことを保証する。一方、**結果整合性（Eventual Consistency）** は、書き込み後しばらくの間は古い値が返る可能性があるが、十分な時間が経過すればすべてのレプリカが最新の値に収束することを保証する。

### 5.2 S3 の一貫性モデルの変遷

S3 の一貫性モデルは、サービスの歴史において大きな転換点を迎えた。

**2020年12月以前：結果整合性モデル**

初期のS3は以下のような一貫性モデルを採用していた。

- **新規オブジェクトの PUT**：read-after-write consistency（書き込み直後の読み取りで最新値が返る）
- **既存オブジェクトの上書き PUT / DELETE**：結果整合性（更新直後に GET すると古いバージョンが返る可能性がある）
- **LIST操作**：結果整合性（PUT 直後にLISTしてもオブジェクトが表示されない可能性がある）

この結果整合性モデルは多くの開発者を悩ませた。典型的な問題として、ETL パイプラインでデータを S3 に書き込んだ直後に LIST でファイル一覧を取得すると、書き込んだばかりのファイルが表示されず、処理が不完全になるというケースがあった。

```mermaid
sequenceDiagram
    participant App as アプリケーション
    participant S3 as S3
    participant R1 as レプリカ 1
    participant R2 as レプリカ 2

    Note over App, R2: 結果整合性時代の問題
    App->>S3: PUT object (version 2)
    S3->>R1: レプリケーション完了
    S3->>R2: レプリケーション中...
    App->>S3: GET object
    S3->>R2: 読み取り（R2にルーティング）
    R2-->>S3: version 1 (古いデータ)
    S3-->>App: version 1 を返却
    Note over App: 古いデータを受け取ってしまう
```

**2020年12月以降：強い一貫性モデル**

2020年12月、AWS は S3 の一貫性モデルを**強い read-after-write consistency** に変更した。これにより、すべての操作――PUT、DELETE、LIST――において、操作完了後の読み取りは必ず最新の状態を反映するようになった。

この変更の重要な点は、追加のコストやパフォーマンス低下なしに実現されたことである。AWS のエンジニアリングチームは、インデックスサブシステムに**「at least as recent as」のセマンティクス**を導入し、読み取りリクエストが到達した時点で、そのリクエスト以前に完了したすべての書き込みが反映されていることを保証するメカニズムを実装した。

### 5.3 強い一貫性がもたらした変化

強い一貫性の導入により、以下のようなユースケースでの開発が大幅に簡素化された。

1. **ETL パイプライン**：書き込み直後のLISTが正確になり、「書き込み後にスリープを入れる」といったワークアラウンドが不要になった
2. **分散ロック**：S3 をシンプルな分散ロックの実装基盤として使うことが現実的になった
3. **イベント駆動処理**：S3 イベント通知（Lambda トリガーなど）でオブジェクトを取得する際、通知時点のバージョンが確実に取得できるようになった
4. **Hadoop/Spark**：`S3Guard`（DynamoDB を使ったメタデータキャッシュ）などの一貫性補助レイヤが不要になった

ただし注意が必要なのは、S3 の強い一貫性は**単一リージョン内**での保証であり、クロスリージョンレプリケーション（CRR）を使用している場合、レプリカ先リージョンへの反映は依然として非同期（結果整合性）であるという点だ。

## 6. MinIO

### 6.1 MinIO とは

MinIO は、S3 互換の API を提供する高性能なオープンソースオブジェクトストレージである。Go言語で実装されており、シングルバイナリで動作する軽量さが特徴である。Apache License 2.0（Enterprise版は商用ライセンス）のもとで公開されている。

MinIO が注目される理由は以下の通りである。

1. **完全な S3 互換性**：S3 の API をほぼ完全に実装しており、既存の S3 クライアントツール（AWS CLI、boto3、aws-sdk など）がそのまま使える
2. **高性能**：ベアメタルサーバー上でGET 325 GiB/s、PUT 165 GiB/sという極めて高いスループットを実現している（公式ベンチマーク値）
3. **シンプルなデプロイ**：単一バイナリで起動でき、Docker コンテナ、Kubernetes（MinIO Operator）での展開も容易
4. **クラウド非依存**：オンプレミス、エッジ、プライベートクラウドなど、あらゆる環境で動作する

### 6.2 アーキテクチャ

MinIO の分散モードでは、複数のノードにまたがってデータを分散・冗長化する。

```mermaid
graph TB
    Client["クライアント"] --> LB["ロードバランサ"]
    LB --> N1["MinIO Node 1<br/>Drive 1-4"]
    LB --> N2["MinIO Node 2<br/>Drive 5-8"]
    LB --> N3["MinIO Node 3<br/>Drive 9-12"]
    LB --> N4["MinIO Node 4<br/>Drive 13-16"]

    N1 <--> N2
    N2 <--> N3
    N3 <--> N4
    N4 <--> N1
```

MinIO はイレイジャーコーディングを用いてデータを保護する。デフォルト設定では、16ドライブ構成の場合、データブロック8個とパリティブロック8個（8+8）に分割する。これにより、16ドライブ中8ドライブが同時に故障してもデータを失わない。

パリティの割合は `MINIO_STORAGE_CLASS_STANDARD` 環境変数で調整可能であり、耐久性とストレージ効率のバランスを制御できる。

### 6.3 ローカル開発での活用

MinIO は開発環境で S3 の代替として非常に便利である。以下は Docker Compose を使ったMinIO の起動例である。

```yaml
# docker-compose.yml
services:
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"   # S3 API
      - "9001:9001"   # Web console
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio-data:/data

volumes:
  minio-data:
```

起動後、AWS CLI で MinIO にアクセスできる。

```bash
# Configure AWS CLI for MinIO
aws configure set aws_access_key_id minioadmin
aws configure set aws_secret_access_key minioadmin

# Create a bucket
aws --endpoint-url http://localhost:9000 s3 mb s3://my-bucket

# Upload a file
aws --endpoint-url http://localhost:9000 s3 cp ./image.jpg s3://my-bucket/

# List objects
aws --endpoint-url http://localhost:9000 s3 ls s3://my-bucket/
```

Python（boto3）からの利用例は以下の通りである。

```python
import boto3

# Create S3 client pointing to MinIO
client = boto3.client(
    "s3",
    endpoint_url="http://localhost:9000",
    aws_access_key_id="minioadmin",
    aws_secret_access_key="minioadmin",
)

# Upload an object
client.put_object(
    Bucket="my-bucket",
    Key="data/report.json",
    Body=b'{"status": "ok"}',
    ContentType="application/json",
)

# Download an object
response = client.get_object(Bucket="my-bucket", Key="data/report.json")
data = response["Body"].read()
```

このように、エンドポイント URL を切り替えるだけでアプリケーションコードを変更せずに S3 と MinIO を切り替えられることが、S3互換APIの大きな利点である。

### 6.4 MinIO の本番運用

MinIO を本番環境で運用する際には、以下の点を考慮する必要がある。

- **分散モードの構成**：耐障害性を確保するために、最低4ノード・4ドライブ以上の分散構成が推奨される
- **ネットワーク帯域**：ノード間のイレイジャーコーディング処理のため、25GbE以上のネットワークが望ましい
- **ディスク選択**：NVMe SSDを使用することで最大のパフォーマンスが得られるが、HDD構成でも大容量アーカイブ用途では十分実用的である
- **TLS設定**：本番環境では必ずTLSを有効にすべきである。MinIO は Let's Encrypt との自動統合もサポートしている
- **監視**：Prometheus メトリクスのエンドポイント `/minio/v2/metrics/cluster` を提供しており、Grafana ダッシュボードとの連携が容易である

### 6.5 MinIO と AWS S3 の使い分け

| 観点 | AWS S3 | MinIO |
|---|---|---|
| 運用負荷 | マネージド（AWSが管理） | セルフマネージド |
| コスト構造 | 従量課金 | インフラコスト＋運用人件費 |
| レイテンシ | リージョンに依存（通常10-100ms） | オンプレミスなら数ms |
| データ主権 | AWS のデータセンター | 自社管理下のハードウェア |
| スケーラビリティ | 実質無制限 | ハードウェア増設で対応 |
| エコシステム | AWS サービスとの深い統合 | S3互換ツールが利用可能 |

データの主権（Data Sovereignty）やレイテンシ要件が厳しい場合、あるいは既存のオンプレミスインフラを活用したい場合にMinIOは有力な選択肢となる。一方、運用コストを最小化したい場合やAWSの他サービスとの統合が重要な場合はS3が適している。

## 7. 署名付きURL（Presigned URL）

### 7.1 署名付きURLとは

署名付きURL（Presigned URL）は、S3 オブジェクトへの一時的なアクセスを許可するためのメカニズムである。通常、S3 のオブジェクトにアクセスするには AWS の認証情報（Access Key と Secret Key）が必要だが、署名付きURLを使えば、認証情報を持たないユーザーに対して期限付きのアクセス権を安全に付与できる。

### 7.2 仕組み

署名付きURLは、S3 のリクエストに必要な認証情報（署名）をURLのクエリパラメータに埋め込んだものである。

```
https://my-bucket.s3.ap-northeast-1.amazonaws.com/photos/sunset.jpg
  ?X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Credential=AKIAIOSFODNN7EXAMPLE/20260305/ap-northeast-1/s3/aws4_request
  &X-Amz-Date=20260305T120000Z
  &X-Amz-Expires=3600
  &X-Amz-SignedHeaders=host
  &X-Amz-Signature=fe5f80f77d5fa3beca038a248ff027d0445342fe2855ddc963176630326f1024
```

各パラメータの意味は以下の通りである。

- `X-Amz-Algorithm`：署名アルゴリズム（AWS Signature Version 4）
- `X-Amz-Credential`：署名に使用した認証情報のスコープ
- `X-Amz-Date`：署名の作成日時
- `X-Amz-Expires`：URLの有効期限（秒）。最大604,800秒（7日間）
- `X-Amz-SignedHeaders`：署名に含まれるHTTPヘッダ
- `X-Amz-Signature`：計算された署名値

### 7.3 ユースケース

署名付きURLは以下のようなシナリオで広く活用される。

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant App as アプリケーション<br/>サーバー
    participant S3 as S3

    Note over User, S3: ダウンロード用の署名付きURL
    User->>App: 画像ダウンロードリクエスト
    App->>App: 権限チェック
    App->>App: 署名付きURL生成<br/>(有効期限: 1時間)
    App-->>User: 署名付きURLを返却
    User->>S3: 署名付きURLで直接GET
    S3-->>User: オブジェクトデータ

    Note over User, S3: アップロード用の署名付きURL
    User->>App: アップロード許可リクエスト
    App->>App: 権限チェック
    App->>App: PUT用の署名付きURL生成<br/>(有効期限: 15分)
    App-->>User: 署名付きURLを返却
    User->>S3: 署名付きURLで直接PUT
    S3-->>User: 200 OK
```

**ダウンロード（GET）の署名付きURL**

非公開の画像やドキュメントを一時的に共有する場合に使われる。CDN（CloudFront）を経由する場合は、CloudFront の署名付きURLまたは署名付きCookieを使うことが多い。

**アップロード（PUT）の署名付きURL**

ユーザーがクライアント（ブラウザ、モバイルアプリ）からS3に直接ファイルをアップロードする場合に有用である。これにより、アプリケーションサーバーを経由せずにファイルをアップロードでき、サーバーの帯域幅とCPUリソースを節約できる。

### 7.4 署名付きURLの生成例

```python
import boto3

s3_client = boto3.client("s3", region_name="ap-northeast-1")

# Generate a presigned URL for downloading
download_url = s3_client.generate_presigned_url(
    "get_object",
    Params={"Bucket": "my-bucket", "Key": "photos/sunset.jpg"},
    ExpiresIn=3600,  # 1 hour
)

# Generate a presigned URL for uploading
upload_url = s3_client.generate_presigned_url(
    "put_object",
    Params={
        "Bucket": "my-bucket",
        "Key": "uploads/user123/document.pdf",
        "ContentType": "application/pdf",
    },
    ExpiresIn=900,  # 15 minutes
)
```

### 7.5 セキュリティ上の考慮事項

署名付きURLを使用する際には、以下のセキュリティ上の注意点がある。

1. **有効期限は最小限に**：ダウンロード用は数分〜数時間、アップロード用は数分程度に設定すべきである。有効期限が長いほど、URLが漏洩した場合のリスクが高まる
2. **IAMロールの権限最小化**：署名付きURLを生成するIAMロールの権限は、対象のバケット・キーに限定すべきである
3. **HTTPSの強制**：バケットポリシーで `aws:SecureTransport` 条件を設定し、HTTP経由のアクセスを禁止すべきである
4. **URLの漏洩対策**：署名付きURLをログに記録しない、キャッシュに保存しないなどの運用ルールが重要である
5. **ContentType の指定**：アップロード用の署名付きURLでは、`ContentType` を署名に含めることで、意図しないファイルタイプのアップロードを防止できる

## 8. ライフサイクルポリシー

### 8.1 ライフサイクルポリシーとは

S3 のライフサイクルポリシーは、オブジェクトの保存期間やストレージクラスの遷移を自動化するルールセットである。手動でのデータ管理は大規模なバケットでは現実的でなく、ライフサイクルポリシーによる自動化が不可欠となる。

### 8.2 主な機能

ライフサイクルポリシーでは、以下の2種類のアクションを定義できる。

**遷移アクション（Transition）**：指定した日数が経過した後、オブジェクトを別のストレージクラスに移行する。

**有効期限アクション（Expiration）**：指定した日数が経過した後、オブジェクトを自動的に削除する。

```mermaid
graph LR
    Standard["S3 Standard<br/>(0-30日)"] --> IA["S3 Standard-IA<br/>(30-90日)"]
    IA --> GIR["S3 Glacier<br/>Instant Retrieval<br/>(90-365日)"]
    GIR --> GFR["S3 Glacier<br/>Flexible Retrieval<br/>(365-730日)"]
    GFR --> GDA["S3 Glacier<br/>Deep Archive<br/>(730日-2555日)"]
    GDA --> Delete["自動削除<br/>(2555日後)"]

    style Standard fill:#4CAF50,color:white
    style IA fill:#8BC34A,color:white
    style GIR fill:#FFC107,color:black
    style GFR fill:#FF9800,color:white
    style GDA fill:#F44336,color:white
    style Delete fill:#9E9E9E,color:white
```

### 8.3 ライフサイクルポリシーの設定例

以下は、典型的なアプリケーションログのライフサイクルポリシーを JSON で定義した例である。

```json
{
  "Rules": [
    {
      "ID": "LogRetentionPolicy",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "logs/"
      },
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER_IR"
        },
        {
          "Days": 365,
          "StorageClass": "DEEP_ARCHIVE"
        }
      ],
      "Expiration": {
        "Days": 2555
      }
    },
    {
      "ID": "CleanupIncompleteUploads",
      "Status": "Enabled",
      "Filter": {
        "Prefix": ""
      },
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 7
      }
    }
  ]
}
```

このポリシーは以下の動作を行う。

1. `logs/` プレフィックスのオブジェクトを30日後に Standard-IA に移行
2. 90日後に Glacier Instant Retrieval に移行
3. 365日後に Deep Archive に移行
4. 2555日（約7年）後に自動削除
5. 7日以上経過した不完全なマルチパートアップロードを自動アボート

### 8.4 コスト最適化の実践

ライフサイクルポリシーを適切に設計することで、ストレージコストを大幅に削減できる。以下に、月間100TBのデータを保存する場合のコスト比較を示す（東京リージョン、概算値）。

| 戦略 | 月額コスト（概算） | 備考 |
|---|---|---|
| 全データ S3 Standard | 約 $2,500 | コスト最大 |
| ライフサイクルで Standard-IA に移行 | 約 $1,300 | 約48%削減 |
| ライフサイクルで Glacier に段階的移行 | 約 $500 | 約80%削減 |

ただし、Glacier クラスへの移行にはいくつかの注意点がある。

- **取り出しコスト**：Glacier からのデータ取得には別途料金が発生する。頻繁にアクセスするデータを Glacier に置くと、かえってコストが増大する場合がある
- **最小保存期間**：Glacier Flexible Retrieval は90日、Deep Archive は180日の最小保存期間があり、それ以前に削除すると日割りの早期削除料金が発生する
- **遷移の制約**：Standard から直接 Deep Archive に移行することは可能だが、One Zone-IA から Standard-IA への「逆方向」の遷移はライフサイクルポリシーでは定義できない
- **最小オブジェクトサイズ**：Standard-IA、One Zone-IA は128KB未満のオブジェクトに対しても128KBとして課金される。小さなオブジェクトが大量にある場合はコスト効果が低い

### 8.5 S3 Intelligent-Tiering との比較

ライフサイクルポリシーが「アクセスパターンを事前に予測してルールを定義する」アプローチであるのに対し、S3 Intelligent-Tiering は「実際のアクセスパターンを監視して自動的に最適なティアに配置する」アプローチである。

Intelligent-Tiering は以下のティアを自動的に管理する。

- **Frequent Access ティア**：デフォルト。30日間アクセスがないと次のティアへ
- **Infrequent Access ティア**：30日後
- **Archive Instant Access ティア**：90日後（オプション）
- **Archive Access ティア**：90〜730日後（オプション）
- **Deep Archive Access ティア**：180〜730日後（オプション）

アクセスパターンが不規則で予測困難な場合は Intelligent-Tiering が、パターンが明確な場合はライフサイクルポリシーが適している。両者を組み合わせることも可能であり、たとえばライフサイクルポリシーで「90日後にIntelligent-Tieringに移行」といったルールを定義することもできる。

## 9. データレイクとしての活用

### 9.1 データレイクとは

データレイクとは、構造化データ（RDB のテーブルなど）、半構造化データ（JSON、XML、CSV）、非構造化データ（画像、動画、テキスト）をすべて元の形式のまま一元的に格納する大規模なデータリポジトリである。データウェアハウスが「スキーマオンライト（Schema-on-Write）」――格納時にスキーマを定義する――であるのに対し、データレイクは「スキーマオンリード（Schema-on-Read）」――読み取り時にスキーマを適用する――というアプローチを取る。

### 9.2 なぜ S3 がデータレイクの基盤になるのか

S3（およびS3互換ストレージ）がデータレイクの事実上の標準基盤となった理由は以下の通りである。

1. **スケーラビリティ**：ペタバイト〜エクサバイト規模のデータを格納できる
2. **コスト効率**：ストレージクラスとライフサイクルポリシーによりコストを最適化できる
3. **耐久性**：イレブンナインの耐久性により、データの損失リスクが極めて低い
4. **オープンなアクセス**：HTTP ベースの API により、あらゆるツールやフレームワークからアクセス可能
5. **計算とストレージの分離**：データの保存場所と処理エンジンを独立にスケールできる

```mermaid
graph TB
    subgraph "データソース"
        DB["RDB / NoSQL"]
        App["アプリケーション<br/>ログ"]
        IoT["IoT デバイス"]
        SaaS["SaaS API"]
    end

    subgraph "取り込み層"
        Kinesis["Kinesis /<br/>Kafka"]
        DMS["Database<br/>Migration Service"]
        Transfer["Transfer<br/>Family"]
    end

    subgraph "S3 データレイク"
        Raw["Raw Zone<br/>(生データ)<br/>s3://datalake/raw/"]
        Curated["Curated Zone<br/>(クレンジング済み)<br/>s3://datalake/curated/"]
        Analytics["Analytics Zone<br/>(集計済み)<br/>s3://datalake/analytics/"]
    end

    subgraph "処理・分析層"
        Glue["AWS Glue /<br/>Spark"]
        Athena["Athena /<br/>Presto"]
        ML["SageMaker /<br/>ML"]
    end

    DB --> DMS --> Raw
    App --> Kinesis --> Raw
    IoT --> Kinesis
    SaaS --> Transfer --> Raw

    Raw --> Glue --> Curated
    Curated --> Glue --> Analytics
    Curated --> Athena
    Curated --> ML
    Analytics --> Athena
```

### 9.3 データレイクのゾーン設計

データレイクでは、データの品質と加工段階に応じてゾーン（レイヤ）を分けるのが一般的である。

| ゾーン | 別名 | 説明 | データ形式の例 |
|---|---|---|---|
| Raw Zone | Landing / Bronze | データソースからの生データをそのまま保存 | JSON, CSV, Avro, DB ダンプ |
| Curated Zone | Cleaned / Silver | クレンジング、型変換、重複排除を施したデータ | Parquet, ORC |
| Analytics Zone | Aggregated / Gold | ビジネスロジックに基づいて集計・変換したデータ | Parquet, Delta Lake |

各ゾーンは S3 のプレフィックスまたは別バケットとして物理的に分離し、IAM ポリシーで適切なアクセス制御を施す。

### 9.4 列指向フォーマットとの組み合わせ

データレイク上での分析クエリのパフォーマンスは、データフォーマットの選択に大きく依存する。CSV や JSON といった行指向フォーマットは人間にとって読みやすいが、分析ワークロードには**列指向フォーマット**が圧倒的に有利である。

**Apache Parquet** は最も広く使われている列指向フォーマットであり、以下の特徴を持つ。

- **列単位の圧縮**：同一列のデータは型と値の分布が似ているため、高い圧縮率を実現できる
- **列の射影（Column Pruning）**：必要な列だけを読み込めるため、不要な列のI/Oを回避できる
- **述語プッシュダウン（Predicate Pushdown）**：行グループごとのメタデータ（最小値、最大値）を利用して、条件に合わない行グループの読み飛ばしができる
- **ネストした構造のサポート**：Protocol Buffers のようなネストした構造を効率的にエンコードできる

```mermaid
graph TB
    subgraph "行指向（CSV）"
        direction LR
        R1["Alice, 28, Tokyo"]
        R2["Bob, 35, Osaka"]
        R3["Carol, 22, Nagoya"]
    end

    subgraph "列指向（Parquet）"
        direction LR
        C1["Name: Alice, Bob, Carol"]
        C2["Age: 28, 35, 22"]
        C3["City: Tokyo, Osaka, Nagoya"]
    end
```

たとえば「全ユーザーの平均年齢を計算する」というクエリの場合、行指向では全行の全列を読み込む必要があるが、列指向では `Age` 列だけを読み込めばよい。100列のテーブルで1列だけが必要な場合、理論上は読み取りデータ量を1/100に削減できる。

### 9.5 S3 Select と Amazon Athena

S3 上のデータに対して SQL クエリを実行する方法として、以下の選択肢がある。

**S3 Select**：S3 側でフィルタリングを行い、必要なデータだけをクライアントに返す機能。CSV、JSON、Parquet 形式のオブジェクトに対して簡単な SQL を実行できる。大容量のオブジェクトから少量のデータを抽出する場合にデータ転送量を削減できる。

```python
import boto3

s3_client = boto3.client("s3")

# Execute S3 Select query
response = s3_client.select_object_content(
    Bucket="my-datalake",
    Key="curated/users/data.parquet",
    Expression="SELECT name, age FROM s3object WHERE age > 30",
    ExpressionType="SQL",
    InputSerialization={"Parquet": {}},
    OutputSerialization={"JSON": {}},
)

# Process the results
for event in response["Payload"]:
    if "Records" in event:
        print(event["Records"]["Payload"].decode("utf-8"))
```

> [!NOTE]
> S3 Select は2024年にAWSが新規利用を非推奨とし、既存ユーザーにもAthena等への移行を推奨している。新規のデータレイク設計ではAthenaの利用を検討すべきである。

**Amazon Athena**：S3 上のデータに対してインタラクティブな SQL クエリを実行するサーバーレスサービス。内部的には Trino（旧 Presto）ベースのクエリエンジンを使用している。AWS Glue Data Catalog と統合してスキーマを管理し、Parquet や ORC 形式のデータに対して高速なクエリを実行できる。課金は実際にスキャンしたデータ量に基づく（1TBあたり$5）。

### 9.6 テーブルフォーマットの進化

従来のデータレイクには以下の課題があった。

1. **ACID トランザクションの欠如**：複数ファイルの同時更新がアトミックに行えない
2. **スキーマ進化の困難**：列の追加や型の変更を安全に行う仕組みがない
3. **タイムトラベルの不在**：過去のある時点のデータスナップショットにアクセスできない
4. **小さなファイルの問題**：ストリーミング取り込みにより小さなファイルが大量に生成され、クエリパフォーマンスが低下する

これらの課題を解決するために、**オープンテーブルフォーマット**が登場した。

- **Delta Lake**：Databricks が開発。トランザクションログ（`_delta_log/`）をS3上のJSONファイルとして管理し、ACIDトランザクション、タイムトラベル、スキーマ進化を実現する
- **Apache Iceberg**：Netflix が開発。マニフェストファイルによるメタデータ管理、パーティション進化、隠しパーティショニングなどの高度な機能を提供する
- **Apache Hudi**：Uber が開発。増分処理に強みがあり、Upsert（Insert or Update）操作を効率的にサポートする

```mermaid
graph TB
    subgraph "従来のデータレイク"
        S3_old["S3<br/>(Parquet ファイル群)"]
        Engine_old["クエリエンジン"]
        Engine_old --> S3_old
    end

    subgraph "テーブルフォーマット導入後"
        S3_new["S3<br/>(Parquet ファイル群)"]
        Meta["メタデータ層<br/>(Delta Log / Iceberg Manifest)"]
        Engine_new["クエリエンジン"]
        Engine_new --> Meta
        Meta --> S3_new
    end
```

テーブルフォーマットの導入により、データレイクは「データレイクハウス（Lakehouse）」とも呼ばれるようになった。これは、データレイクのスケーラビリティとコスト効率を維持しつつ、データウェアハウスのACIDトランザクションやスキーマ管理といった信頼性を兼ね備えたアーキテクチャである。

### 9.7 データレイクの実運用における課題

データレイクをS3上に構築・運用する際には、以下の課題に注意が必要である。

**データガバナンス**：データの品質管理、リネージ（来歴）の追跡、個人情報の管理が複雑になる。AWS Lake Formation はこれらの課題に対処するためのサービスであり、きめ細かいアクセス制御（列レベル、行レベル）やデータカタログの管理機能を提供する。

**コスト管理**：データレイクは「データを溜め続ける」性質上、ストレージコストが継続的に増加する。ライフサイクルポリシーの適用、不要データの定期的な棚卸し、圧縮フォーマットの採用がコスト管理の基本となる。

**パフォーマンスチューニング**：適切なパーティショニング戦略（日付ベース、リージョンベースなど）、ファイルサイズの最適化（128MB〜1GBが推奨）、列指向フォーマットの採用がクエリパフォーマンスの鍵となる。

**セキュリティ**：バケットポリシー、IAM ポリシー、VPC エンドポイント、暗号化（SSE-S3、SSE-KMS、CSE）を組み合わせた多層防御が必要である。特に、S3 バケットのパブリックアクセスブロック設定は、データ漏洩を防ぐために必ず有効にすべきである。

## 10. まとめ

本記事では、オブジェクトストレージの基本概念から実践的な活用方法までを幅広く解説した。主要なポイントを振り返る。

**オブジェクトストレージの本質**は、POSIXファイルシステムの意味論を放棄し、フラットな名前空間とHTTP APIを採用することで、事実上無制限のスケーラビリティを実現したことにある。この設計判断は、ブロックストレージやファイルストレージとは異なるトレードオフを生み出し、大量の非構造化データの保存・配信に最適化されたストレージモデルを確立した。

**S3 API** はそのシンプルさゆえにデファクトスタンダードとなり、クラウドプロバイダ間やオンプレミス環境における互換性の基盤を形成している。マルチパートアップロード、バージョニング、署名付きURLといった機能は、実際のアプリケーション開発において不可欠なビルディングブロックである。

**一貫性モデルの進化**――S3 が結果整合性から強い一貫性に移行した事例――は、分散システムにおいてもユーザー体験を妥協なく改善できることを示す重要な技術的成果である。

**MinIO** に代表されるS3互換のオープンソースソフトウェアは、開発環境からオンプレミスの本番環境まで、S3エコシステムの適用範囲を大幅に広げている。

そして**データレイク**としてのS3の活用は、現代のデータ基盤設計における中核的なパターンとなっている。列指向フォーマット、テーブルフォーマット（Delta Lake、Iceberg、Hudi）、サーバーレスクエリエンジン（Athena）との組み合わせにより、S3は単なるファイル置き場を超えた分析基盤へと進化を遂げている。

オブジェクトストレージは今後も、AI/MLワークロードの学習データ管理、エッジコンピューティングにおけるデータ同期、マルチクラウド環境でのデータポータビリティなど、新たなユースケースにおいて中心的な役割を担い続けるだろう。
