---
title: "秘密情報管理（Vault, SOPS, Secrets Manager）"
date: 2026-03-02
tags: ["software-engineering", "security", "secret-management", "vault", "intermediate"]
---

# 秘密情報管理（Vault, SOPS, Secrets Manager）

## 1. 秘密情報管理の必要性

### 1.1 秘密情報とは何か

ソフトウェアシステムにおける**秘密情報（Secrets）**とは、不正なアクセスから保護されるべきあらゆる認証・認可情報を指す。具体的には以下のようなものが該当する。

| 種類 | 例 |
|------|-----|
| データベース認証情報 | ユーザー名、パスワード、接続文字列 |
| APIキー | サードパーティサービスのアクセスキー |
| 暗号鍵 | TLS証明書の秘密鍵、署名鍵 |
| トークン | OAuth トークン、JWT署名鍵 |
| クラウド認証情報 | AWS Access Key / Secret Key、GCPサービスアカウントキー |
| SSH鍵 | サーバーアクセス用の秘密鍵 |

これらの秘密情報は、システムが外部リソースやサービスと安全に通信するために不可欠な存在であるが、同時にその漏洩は壊滅的な被害をもたらしうる。2023年のGitGuardianのレポートによれば、GitHubのパブリックリポジトリにおいて年間1,000万件以上の秘密情報が検出されている。この事実は、秘密情報管理が解決済みの問題ではなく、現在進行形の課題であることを明確に示している。

### 1.2 ハードコードの問題

秘密情報管理における最も初歩的かつ危険なアンチパターンは、ソースコード内への直接埋め込み（ハードコード）である。

```python
# DANGER: hardcoded credentials
db_connection = psycopg2.connect(
    host="db.example.com",
    user="admin",
    password="SuperSecret123!",  # hardcoded password
    database="production"
)
```

ハードコードが危険である理由は明確である。

1. **バージョン管理への永続化**: 一度Gitにコミットされた秘密情報は、該当コミットを削除しない限り履歴に永続的に残る。`git filter-branch`や`BFG Repo-Cleaner`で履歴を書き換えることは可能だが、既にpushされた情報が他者のローカルリポジトリに残っている可能性があり、完全な除去は困難である
2. **環境間の区別不能**: 開発・ステージング・本番で同じ認証情報が使われることになり、環境分離が破壊される
3. **ローテーション不可**: パスワードを変更するたびにコードの変更・デプロイが必要となり、緊急時の対応が遅れる
4. **アクセス制御の欠如**: ソースコードにアクセスできるすべての人が秘密情報を閲覧可能になる

### 1.3 .envファイルのリスク

ハードコードの次のステップとして広く使われるのが`.env`ファイルによる環境変数管理である。

```bash
# .env file
DB_HOST=db.example.com
DB_USER=admin
DB_PASSWORD=SuperSecret123!
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

`.env`ファイルはハードコードよりは改善されているが、以下の問題が残る。

- **`.gitignore`の設定漏れ**: `.env`ファイルがうっかりコミットされるケースは非常に多い。実際のインシデントの多くはこのパターンで発生している
- **平文保存**: ディスク上に暗号化されずに保存されるため、サーバーへの不正アクセスで容易に窃取される
- **配布の問題**: チームメンバー間で`.env`ファイルをどう安全に共有するかという問題が生じる。Slack やメールで送信されるケースも珍しくない
- **監査証跡の欠如**: 誰がいつ秘密情報にアクセスしたかを追跡できない
- **ローテーション**: 手動でファイルを書き換える必要があり、自動化が困難

### 1.4 秘密情報漏洩の典型的なシナリオ

```mermaid
flowchart TD
    A[開発者がコードに秘密情報を記述] --> B{.gitignore設定あり?}
    B -->|No| C[Git リポジトリにコミット]
    B -->|Yes| D[ローカルファイルに保存]
    C --> E[パブリックリポジトリにPush]
    C --> F[プライベートリポジトリにPush]
    E --> G[自動スキャンボットが検出]
    G --> H[数分以内に悪用]
    F --> I[リポジトリの公開設定変更]
    I --> G
    D --> J[サーバー侵害でファイル窃取]
    D --> K[バックアップから漏洩]
    D --> L[Slack/メールで共有]
    L --> M[第三者が閲覧可能]
    H --> N[不正利用・データ漏洩]
    J --> N
    K --> N
    M --> N
```

AWS のアクセスキーがGitHubのパブリックリポジトリにプッシュされた場合、数分以内に暗号通貨マイニング用のEC2インスタンスが大量に起動されるケースが報告されている。これは自動化されたボットが常にGitHub上のコミットをスキャンしているためである。

## 2. 秘密情報管理の原則

適切な秘密情報管理を実現するためには、いくつかの基本原則を理解し、遵守する必要がある。

### 2.1 最小権限の原則（Principle of Least Privilege）

秘密情報へのアクセスは、業務上必要最小限の範囲に制限されるべきである。この原則は以下のレベルで適用される。

- **人間のアクセス**: 開発者が本番データベースのパスワードを知る必要はない。デプロイパイプラインがアクセスできれば十分
- **サービスのアクセス**: 各マイクロサービスは自身が必要とする秘密情報のみにアクセスできるべき
- **時間的制限**: 秘密情報の有効期限を設定し、必要なときだけ一時的にアクセスを許可する

### 2.2 監査ログ（Audit Logging）

すべての秘密情報へのアクセスは記録されるべきである。

- **誰が**（Which identity）
- **いつ**（When）
- **どの秘密情報に**（Which secret）
- **どのような操作を行ったか**（Read / Write / Delete / Rotate）

これにより、不正アクセスの検知、インシデント対応時の影響範囲の特定、コンプライアンス監査への対応が可能となる。

### 2.3 秘密情報のローテーション（Rotation）

秘密情報は定期的に更新されるべきである。ローテーションにより以下の効果が得られる。

- **漏洩の影響範囲の限定**: 仮に秘密情報が漏洩していたとしても、ローテーションにより無効化される
- **静的認証情報の排除**: 長期間同じ認証情報が使われることのリスクを低減
- **コンプライアンス要件への対応**: PCI DSS やSOC 2 などの規格では定期的なローテーションを要求

### 2.4 暗号化（Encryption）

秘密情報は保存時（At Rest）と転送時（In Transit）の両方で暗号化されるべきである。

- **保存時暗号化**: 秘密情報ストアのバックエンドストレージが暗号化されていること
- **転送時暗号化**: クライアントと秘密情報ストア間の通信がTLSで保護されていること
- **封筒暗号化（Envelope Encryption）**: データ暗号鍵（DEK）でデータを暗号化し、マスター鍵（KEK）でDEKを暗号化する階層構造

### 2.5 集中管理と単一真実源（Single Source of Truth）

秘密情報は一箇所で集中管理されるべきであり、各環境やサービスが同じソースから取得する仕組みを構築する。これにより、ローテーション時に1箇所だけ更新すれば全システムに反映される。

```mermaid
flowchart LR
    subgraph "Secret Store (Single Source of Truth)"
        V[秘密情報ストア]
    end
    subgraph "Consumers"
        A[Web API Server]
        B[Worker Service]
        C[Batch Job]
        D[CI/CD Pipeline]
    end
    V --> A
    V --> B
    V --> C
    V --> D
```

## 3. HashiCorp Vault

### 3.1 Vaultとは

**HashiCorp Vault**は、秘密情報の保存・アクセス制御・監査を一元的に行うためのオープンソースツールである。2015年にリリースされて以来、秘密情報管理の事実上の標準として広く採用されてきた。Vaultが解決する根本的な課題は「**秘密情報の拡散（Secret Sprawl）**」、つまり秘密情報が設定ファイル、環境変数、ソースコードなど様々な場所に散在してしまう問題である。

### 3.2 Vaultのアーキテクチャ

Vaultのアーキテクチャは複数のレイヤーで構成されている。

```mermaid
flowchart TB
    subgraph "Client Layer"
        CLI[Vault CLI]
        API[HTTP API]
        UI[Web UI]
    end
    subgraph "Vault Server"
        direction TB
        AUTH[Auth Methods Layer]
        POLICY[Policy Engine]
        AUDIT[Audit Devices]
        subgraph "Secrets Engines"
            KV[KV Store]
            DB[Database]
            PKI[PKI]
            TRANSIT[Transit]
            AWS_SE[AWS]
        end
        BARRIER[Encryption Barrier]
        STORAGE[Storage Backend]
    end
    CLI --> AUTH
    API --> AUTH
    UI --> AUTH
    AUTH --> POLICY
    POLICY --> KV
    POLICY --> DB
    POLICY --> PKI
    POLICY --> TRANSIT
    POLICY --> AWS_SE
    POLICY --> AUDIT
    KV --> BARRIER
    DB --> BARRIER
    PKI --> BARRIER
    TRANSIT --> BARRIER
    AWS_SE --> BARRIER
    BARRIER --> STORAGE
```

各コンポーネントの役割は以下の通りである。

| コンポーネント | 役割 |
|-------------|------|
| **Auth Methods** | クライアントの認証。Token, LDAP, OIDC, AWS IAM, Kubernetes SA など |
| **Policy Engine** | ACL（Access Control List）に基づくアクセス制御。HCL形式のポリシーで定義 |
| **Secrets Engines** | 秘密情報の生成・保存・管理を行うプラグイン群 |
| **Audit Devices** | 全リクエスト/レスポンスを記録するログ出力先 |
| **Encryption Barrier** | ストレージに書き込む前にすべてのデータを暗号化するレイヤー |
| **Storage Backend** | 暗号化されたデータの永続化先（Consul, Raft, S3 など） |

::: tip Vaultの設計原則
Vaultはストレージバックエンドを**信頼しない**設計を採用している。すべてのデータはEncryption Barrierを通過してから保存されるため、仮にストレージバックエンドが侵害されても、暗号鍵なしにはデータを読み取ることができない。
:::

### 3.3 シール機構（Seal/Unseal Mechanism）

Vaultの最も特徴的な機構の一つが**シール（Seal）**である。Vaultが起動した直後は「シール状態（Sealed）」であり、いかなるデータにもアクセスできない。この設計は、サーバーが起動しただけでは秘密情報が取得できないことを保証するものである。

```mermaid
stateDiagram-v2
    [*] --> Sealed : Vault starts
    Sealed --> Unsealing : Unseal key provided
    Unsealing --> Unsealing : Additional keys provided
    Unsealing --> Unsealed : Threshold reached
    Unsealed --> Sealed : Manual seal / restart
    Sealed --> [*] : Shutdown
```

#### Shamirの秘密分散法

Vaultは初期化時にマスター鍵を生成し、**Shamirの秘密分散法（Shamir's Secret Sharing）**を用いてこのマスター鍵を複数のキーシェアに分割する。例えば、5つのキーシェアに分割し、そのうち3つが揃えばマスター鍵を復元できるように設定する（5-of-3 threshold）。

$$
f(x) = a_0 + a_1 x + a_2 x^2 + \cdots + a_{k-1} x^{k-1} \pmod{p}
$$

ここで $a_0$ がマスター鍵（秘密）であり、$k$ がしきい値である。$n$ 個の異なる点 $(x_i, f(x_i))$ がキーシェアとなる。ラグランジュ補間により、$k$ 個以上のシェアから $a_0$ を復元できるが、$k-1$ 個以下のシェアからは情報理論的に何の情報も得られない。

```bash
# Initialize Vault with 5 key shares and a threshold of 3
vault operator init -key-shares=5 -key-threshold=3

# Unseal with individual key shares
vault operator unseal <key-share-1>
vault operator unseal <key-share-2>
vault operator unseal <key-share-3>
# Vault is now unsealed
```

#### Auto Unseal

手動でのUnsealは運用負荷が高いため、本番環境ではクラウドのKMS（Key Management Service）を利用した**Auto Unseal**が一般的である。

```hcl
# Vault server configuration for Auto Unseal with AWS KMS
seal "awskms" {
  region     = "ap-northeast-1"
  kms_key_id = "alias/vault-unseal-key"
}
```

Auto Unsealでは、マスター鍵がKMSで暗号化されて保存される。Vault起動時にKMSを呼び出してマスター鍵を復号し、自動的にUnsealが完了する。これにより、Shamirのキーシェアを人間が管理する必要がなくなる。

::: warning Auto Unsealの注意点
Auto Unsealを使用する場合、VaultのセキュリティはKMSのセキュリティに依存する。KMSへのアクセス権限を厳格に管理し、IAMポリシーで最小権限を適用する必要がある。
:::

### 3.4 認証メソッド（Auth Methods）

Vaultはクライアントの認証にプラグイン形式の**認証メソッド**を使用する。認証が成功すると、権限を表す**トークン**が発行される。

```bash
# Enable Kubernetes auth method
vault auth enable kubernetes

# Configure Kubernetes auth
vault write auth/kubernetes/config \
    kubernetes_host="https://kubernetes.default.svc:443" \
    kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

# Create a role binding a Kubernetes service account to a Vault policy
vault write auth/kubernetes/role/webapp \
    bound_service_account_names=webapp \
    bound_service_account_namespaces=default \
    policies=webapp-policy \
    ttl=1h
```

主要な認証メソッドは以下の通りである。

| 認証メソッド | ユースケース |
|------------|------------|
| **Token** | 最も基本的な認証。他のメソッドも最終的にはTokenを返す |
| **AppRole** | CI/CDパイプラインやアプリケーションからのアクセス。Role IDとSecret IDの組で認証 |
| **Kubernetes** | PodのService Accountに基づく認証 |
| **AWS IAM / EC2** | AWSのIAMロールやEC2インスタンスプロファイルに基づく認証 |
| **OIDC / JWT** | OpenID Connect / JWT トークンによる認証 |
| **LDAP** | 既存のLDAPディレクトリとの統合 |

### 3.5 ポリシー（Policies）

Vaultのアクセス制御はHCL（HashiCorp Configuration Language）で記述されたポリシーに基づく。ポリシーはパスベースで権限を定義する。

```hcl
# Policy: webapp can read database credentials
path "database/creds/webapp-role" {
  capabilities = ["read"]
}

# Policy: webapp can read KV secrets under its own namespace
path "secret/data/webapp/*" {
  capabilities = ["read", "list"]
}

# Policy: deny access to admin secrets
path "secret/data/admin/*" {
  capabilities = ["deny"]
}
```

ポリシーで使用可能なcapabilityは`create`、`read`、`update`、`delete`、`list`、`sudo`、`deny`である。`deny`は他のすべてのcapabilityに優先する。

### 3.6 動的シークレット（Dynamic Secrets）

Vaultの最も強力な機能の一つが**動的シークレット**である。従来の秘密情報管理では、事前に作成された認証情報をストアに保存し、必要なときに取り出すという静的なモデルであった。Vaultの動的シークレットは、**アクセスの都度、一時的な認証情報をオンデマンドで生成する**というパラダイムシフトを実現する。

```mermaid
sequenceDiagram
    participant App as Application
    participant V as Vault
    participant DB as Database

    App->>V: GET /database/creds/webapp-role
    V->>DB: CREATE USER 'v-webapp-abc123'<br/>WITH PASSWORD 'generated-pw'<br/>GRANT SELECT ON app_db.*
    DB-->>V: User created
    V-->>App: username: v-webapp-abc123<br/>password: generated-pw<br/>lease_duration: 1h
    Note over App: Uses credentials for 1 hour
    V->>DB: DROP USER 'v-webapp-abc123'
    Note over DB: Credentials automatically revoked
```

```bash
# Enable database secrets engine
vault secrets enable database

# Configure PostgreSQL connection
vault write database/config/my-postgresql \
    plugin_name=postgresql-database-plugin \
    allowed_roles="webapp-role" \
    connection_url="postgresql://{{username}}:{{password}}@db.example.com:5432/mydb" \
    username="vault-admin" \
    password="vault-admin-password"

# Create a role that generates dynamic credentials
vault write database/roles/webapp-role \
    db_name=my-postgresql \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"

# Application requests dynamic credentials
vault read database/creds/webapp-role
# Key                Value
# ---                -----
# lease_id           database/creds/webapp-role/abcd1234
# lease_duration     1h
# username           v-webapp-role-xyz789
# password           A1B2-C3D4-E5F6-G7H8
```

動的シークレットの利点は以下の通りである。

- **リスクの時間的限定**: 認証情報にTTL（Time-To-Live）が設定され、期限切れで自動的に無効化される
- **個別の認証情報**: 各リクエストごとに一意の認証情報が生成されるため、漏洩時の影響範囲の特定が容易
- **即時無効化**: `vault lease revoke`コマンドでリース単位で即座に認証情報を無効化可能
- **監査の容易さ**: 誰がいつどのような認証情報を取得したかが完全に記録される

### 3.7 Transit Secrets Engine（暗号化サービス）

VaultのTransit Secrets Engineは、Vaultを**暗号化サービス（Encryption as a Service）**として利用する機能である。アプリケーションは暗号鍵を自ら管理する必要がなく、Vaultに暗号化・復号を委任できる。

```bash
# Enable transit secrets engine
vault secrets enable transit

# Create an encryption key
vault write -f transit/keys/my-app-key

# Encrypt data (plaintext must be base64 encoded)
vault write transit/encrypt/my-app-key \
    plaintext=$(echo -n "sensitive-data" | base64)
# ciphertext: vault:v1:AbCdEf...

# Decrypt data
vault write transit/decrypt/my-app-key \
    ciphertext="vault:v1:AbCdEf..."
# plaintext: c2Vuc2l0aXZlLWRhdGE= (base64 of "sensitive-data")
```

これにより、アプリケーションレイヤーでの暗号鍵管理の複雑さを排除し、鍵のローテーションもVault側で透過的に行える。

## 4. クラウドシークレットマネージャー

### 4.1 AWS Secrets Manager

**AWS Secrets Manager**は、AWSが提供するフルマネージドの秘密情報管理サービスである。2018年にリリースされ、AWS エコシステムとの深い統合が特徴である。

#### 主要機能

- **自動ローテーション**: Lambda関数と連携して秘密情報を自動的にローテーション
- **クロスアカウントアクセス**: Resource-based Policyにより他のAWSアカウントへのアクセス許可が可能
- **VPCエンドポイント**: VPC内からインターネットを経由せずにアクセス可能
- **バージョニング**: 秘密情報のバージョンを管理し、`AWSCURRENT`と`AWSPREVIOUS`のステージングラベルで制御

```python
import boto3
import json

def get_secret(secret_name: str, region: str = "ap-northeast-1") -> dict:
    """Retrieve a secret from AWS Secrets Manager."""
    client = boto3.client("secretsmanager", region_name=region)
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response["SecretString"])

# Usage
db_creds = get_secret("prod/myapp/database")
connection = psycopg2.connect(
    host=db_creds["host"],
    user=db_creds["username"],
    password=db_creds["password"],
    database=db_creds["dbname"],
)
```

#### ローテーション設定

```python
import boto3

client = boto3.client("secretsmanager")

# Enable automatic rotation
client.rotate_secret(
    SecretId="prod/myapp/database",
    RotationLambdaARN="arn:aws:lambda:ap-northeast-1:123456789:function:RotateDBSecret",
    RotationRules={
        "AutomaticallyAfterDays": 30,
        "Duration": "2h",    # rotation window
        "ScheduleExpression": "rate(30 days)"
    }
)
```

::: details AWS Secrets Managerの料金体系
AWS Secrets Managerは秘密情報1つあたり月額$0.40、10,000回のAPIコールあたり$0.05の料金が発生する。大量の秘密情報を管理する場合はコストに注意が必要である。一方、AWS Systems Manager Parameter Store（SecureString型）は無料枠が広く、基本的なユースケースではコスト面で有利である。ただし、Parameter Storeには自動ローテーション機能がない。
:::

### 4.2 GCP Secret Manager

**GCP Secret Manager**は、Google Cloud Platformが提供する秘密情報管理サービスである。シンプルなAPIとIAMとの統合が特徴である。

```bash
# Create a secret
echo -n "my-database-password" | gcloud secrets create db-password \
    --data-file=- \
    --replication-policy="automatic"

# Access a secret
gcloud secrets versions access latest --secret="db-password"

# Add a new version (rotation)
echo -n "new-database-password" | gcloud secrets versions add db-password \
    --data-file=-

# Grant access to a service account
gcloud secrets add-iam-policy-binding db-password \
    --member="serviceAccount:myapp@project-id.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

GCP Secret Managerの特徴的な機能として**シークレットのバージョニング**がある。各バージョンは個別に有効化・無効化・破棄が可能であり、ローテーション時にも安全にバージョンを切り替えられる。

### 4.3 Vaultとクラウドシークレットマネージャーの比較

| 観点 | HashiCorp Vault | AWS Secrets Manager | GCP Secret Manager |
|------|----------------|--------------------|--------------------|
| **デプロイ** | セルフホスト / HCP Vault | フルマネージド | フルマネージド |
| **動的シークレット** | 豊富なプラグインで対応 | Lambda連携で限定的に対応 | 非対応（外部連携が必要） |
| **マルチクラウド** | クラウド非依存 | AWS専用 | GCP専用 |
| **暗号化サービス** | Transit Engine | KMSで別途対応 | Cloud KMSで別途対応 |
| **運用負荷** | 高い（クラスタ管理が必要） | 低い | 低い |
| **コスト** | インフラコスト + ライセンス（Enterprise） | $0.40/secret/月 + API課金 | $0.06/secret version/月 + API課金 |
| **監査** | 詳細なAudit Log | CloudTrail連携 | Cloud Audit Logs連携 |

::: tip 選定の指針
- **マルチクラウド環境**や**動的シークレットが必要な場合**はVaultが適している
- **単一クラウドで運用負荷を最小化したい場合**はクラウドネイティブのサービスが適している
- 両者を組み合わせ、Vaultのバックエンドとしてクラウドのシークレットマネージャーを利用するハイブリッド構成も実用的である
:::

## 5. SOPS（Secrets OPerationS）

### 5.1 SOPSの概要

**SOPS**（Secrets OPerationS）は、Mozillaが開発した暗号化ファイルエディタである。現在はCNCF（Cloud Native Computing Foundation）のプロジェクトとしてメンテナンスされている。SOPSの基本的なコンセプトは、**設定ファイルの値のみを暗号化し、キー（フィールド名）は平文のまま残す**ことである。

```yaml
# Before encryption (plaintext)
database:
    host: db.example.com
    username: admin
    password: SuperSecret123!
api_key: sk-abcdef123456

# After SOPS encryption
database:
    host: ENC[AES256_GCM,data:abc123...,iv:...,tag:...,type:str]
    username: ENC[AES256_GCM,data:def456...,iv:...,tag:...,type:str]
    password: ENC[AES256_GCM,data:ghi789...,iv:...,tag:...,type:str]
api_key: ENC[AES256_GCM,data:jkl012...,iv:...,tag:...,type:str]
sops:
    kms:
        - arn: arn:aws:kms:ap-northeast-1:123456789:key/abcd-1234
          created_at: "2026-01-15T10:30:00Z"
          enc: AQICAHh...
    lastmodified: "2026-01-15T10:30:00Z"
    mac: ENC[AES256_GCM,data:...,iv:...,tag:...,type:str]
    version: 3.9.0
```

キーが平文で残ることの利点は非常に大きい。

- **diffが読める**: Git上で変更差分を見たときに、どのフィールドが変更されたかが分かる
- **コードレビュー可能**: 暗号化されたファイルでも構造の変更をレビューできる
- **mergeが可能**: Gitのマージ競合時にフィールド単位で解決できる

### 5.2 SOPSの暗号化バックエンド

SOPSは複数の暗号化バックエンドをサポートしている。

| バックエンド | 特徴 |
|------------|------|
| **AWS KMS** | AWSの鍵管理サービスとの統合 |
| **GCP Cloud KMS** | GCPの鍵管理サービスとの統合 |
| **Azure Key Vault** | Azureの鍵管理サービスとの統合 |
| **age** | モダンなファイル暗号化ツール。ローカル開発に適する |
| **PGP** | レガシーだが広くサポートされている |

#### .sops.yaml設定ファイル

プロジェクトルートに`.sops.yaml`を配置することで、パスパターンごとに暗号化設定を定義できる。

```yaml
# .sops.yaml
creation_rules:
  # Production secrets: encrypted with AWS KMS
  - path_regex: environments/production/.*\.yaml$
    kms: "arn:aws:kms:ap-northeast-1:123456789:key/prod-key-id"

  # Staging secrets: encrypted with a different KMS key
  - path_regex: environments/staging/.*\.yaml$
    kms: "arn:aws:kms:ap-northeast-1:123456789:key/staging-key-id"

  # Development secrets: encrypted with age for local dev
  - path_regex: environments/development/.*\.yaml$
    age: "age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p"
```

### 5.3 SOPSの操作

```bash
# Encrypt a file
sops --encrypt secrets.yaml > secrets.enc.yaml

# Decrypt a file
sops --decrypt secrets.enc.yaml > secrets.yaml

# Edit an encrypted file in-place (decrypts, opens editor, re-encrypts)
sops secrets.enc.yaml

# Rotate the encryption key
sops --rotate --in-place secrets.enc.yaml

# Extract a specific value
sops --decrypt --extract '["database"]["password"]' secrets.enc.yaml
```

### 5.4 GitOpsとの統合

SOPSの真価は**GitOps**ワークフローとの統合で発揮される。GitOpsでは「Gitリポジトリを唯一の真実源とする」という原則に基づき、すべてのインフラ・アプリケーション設定をGitで管理する。しかし、秘密情報をGitに保存することはセキュリティ上の問題がある。SOPSはこのジレンマを解決する。

```mermaid
flowchart LR
    DEV[開発者] -->|sops edit| GIT[Git Repository]
    GIT -->|暗号化された状態で保存| REPO[(Encrypted Secrets<br/>in Git)]
    REPO -->|ArgoCD / Flux が検知| CD[GitOps Controller]
    CD -->|sops decrypt| PLAIN[平文の秘密情報]
    PLAIN -->|Kubernetes Secret作成| K8S[Kubernetes Cluster]
```

#### Argo CDとの統合

Argo CDは**kustomize-sops**プラグインや**KSOPS（Kustomize Secret Generator Plugin）**を通じてSOPSを直接サポートしている。

```yaml
# ksops generator configuration
apiVersion: viaduct.ai/v1
kind: ksops
metadata:
  name: secret-generator
files:
  - ./secrets.enc.yaml
```

#### Fluxとの統合

Flux v2はSOPSを**ネイティブにサポート**しており、追加プラグインなしで暗号化された秘密情報をデコードできる。

```yaml
# Flux Kustomization with SOPS decryption
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 10m
  path: ./environments/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: my-repo
  decryption:
    provider: sops
    secretRef:
      name: sops-age-key  # age private key stored as K8s Secret
```

## 6. Kubernetesでのシークレット管理

### 6.1 Kubernetes Secretの基本と限界

KubernetesにはネイティブのSecret リソースが存在するが、これは秘密情報管理ツールとしては不十分である。

```yaml
# Kubernetes Secret (base64 encoded, NOT encrypted)
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
data:
  username: YWRtaW4=        # base64 of "admin"
  password: U3VwZXJTZWNyZXQ=  # base64 of "SuperSecret"
```

::: danger Kubernetes Secretの誤解
Kubernetes Secretのデータはbase64エンコードされているだけであり、**暗号化ではない**。etcd上のデータはデフォルトでは平文で保存される。`EncryptionConfiguration`を設定することでetcd上の暗号化は可能だが、RBAC設定が不適切な場合、`kubectl get secret -o yaml`で誰でも内容を読み取れてしまう。
:::

Kubernetes Secretの主な課題は以下の通りである。

- **Gitリポジトリへの保存不可**: 平文（base64エンコード）のため、Gitに保存するとセキュリティリスクとなる
- **外部ストアとの同期不足**: Vault やクラウドシークレットマネージャーとの自動同期機構がない
- **ローテーション**: Secret を更新してもPodが自動的に新しい値を取得するわけではない

### 6.2 External Secrets Operator（ESO）

**External Secrets Operator（ESO）**は、外部の秘密情報ストアとKubernetes Secret を同期するKubernetesオペレーターである。CNCFのサンドボックスプロジェクトとして管理されている。

```mermaid
flowchart LR
    subgraph "External Secret Stores"
        VAULT[HashiCorp Vault]
        AWS_SM[AWS Secrets Manager]
        GCP_SM[GCP Secret Manager]
    end
    subgraph "Kubernetes Cluster"
        ESO[External Secrets Operator]
        ES[ExternalSecret CR]
        K8S_SEC[Kubernetes Secret]
        POD[Pod]
    end
    ES -->|定義| ESO
    ESO -->|取得| VAULT
    ESO -->|取得| AWS_SM
    ESO -->|取得| GCP_SM
    ESO -->|作成・更新| K8S_SEC
    POD -->|マウント / 環境変数| K8S_SEC
```

#### SecretStoreの設定

まず、外部シークレットストアへの接続情報を`SecretStore`（または`ClusterSecretStore`）で定義する。

```yaml
# ClusterSecretStore for AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
            namespace: external-secrets
```

#### ExternalSecretの定義

次に、`ExternalSecret`リソースで外部ストアからどの秘密情報を取得し、どのようなKubernetes Secretを作成するかを定義する。

```yaml
# ExternalSecret that syncs from AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: default
spec:
  refreshInterval: 1h          # sync interval
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: db-credentials       # resulting K8s Secret name
    creationPolicy: Owner
  data:
    - secretKey: username       # key in the K8s Secret
      remoteRef:
        key: prod/myapp/database  # secret name in AWS SM
        property: username        # JSON key within the secret
    - secretKey: password
      remoteRef:
        key: prod/myapp/database
        property: password
```

ESOの利点は以下の通りである。

- **宣言的管理**: Kubernetes のマニフェストとしてシークレット同期を定義可能
- **自動同期**: `refreshInterval`で定期的に外部ストアと同期
- **マルチバックエンド**: Vault, AWS, GCP, Azure など多数のプロバイダーをサポート
- **テンプレート機能**: 取得した値を加工してKubernetes Secretを生成可能

### 6.3 Sealed Secrets

**Sealed Secrets**（Bitnami）は、SOPSとは異なるアプローチでKubernetes上の秘密情報をGitに安全に保存する仕組みである。

```mermaid
flowchart LR
    DEV[開発者] -->|kubeseal encrypt| SS[SealedSecret<br/>暗号化されたCR]
    SS -->|Git Push| GIT[(Git Repository)]
    GIT -->|GitOps同期| CD[ArgoCD / Flux]
    CD -->|Apply| CLUSTER[Kubernetes Cluster]
    CLUSTER -->|Sealed Secrets Controller<br/>が復号| K8S_SEC[Kubernetes Secret]
```

```bash
# Encrypt a Secret into a SealedSecret
kubeseal --format=yaml < my-secret.yaml > my-sealed-secret.yaml
```

Sealed Secretsの特徴は、暗号化がクラスタ固有の公開鍵で行われる点である。つまり、暗号化されたSealedSecretは特定のクラスタ・特定のNamespaceでしか復号できない。

### 6.4 Vault Agent / Vault CSI Provider

HashiCorp Vaultを使用している場合、**Vault Agent Injector**または**Vault CSI Provider**を通じてPodに秘密情報を注入できる。

```yaml
# Pod with Vault Agent sidecar injection
apiVersion: v1
kind: Pod
metadata:
  name: webapp
  annotations:
    vault.hashicorp.com/agent-inject: "true"
    vault.hashicorp.com/role: "webapp"
    vault.hashicorp.com/agent-inject-secret-db-creds: "database/creds/webapp-role"
    vault.hashicorp.com/agent-inject-template-db-creds: |
      {{- with secret "database/creds/webapp-role" -}}
      postgresql://{{ .Data.username }}:{{ .Data.password }}@db:5432/mydb
      {{- end -}}
spec:
  serviceAccountName: webapp
  containers:
    - name: webapp
      image: myapp:latest
      # Vault Agent writes secrets to /vault/secrets/db-creds
```

::: tip Vault Agent の仕組み
Vault Agent Injectorは**Kubernetes Admission Webhook**として動作する。Podに`vault.hashicorp.com/agent-inject: "true"`アノテーションが付与されていると、init containerとsidecar containerを自動的に注入する。init containerがVaultから秘密情報を取得してshared volumeに書き込み、アプリケーションコンテナはそのファイルを読み取る。sidecar containerはTTLに応じて秘密情報を自動的にリフレッシュする。
:::

## 7. シークレットローテーションの自動化

### 7.1 ローテーションの必要性

秘密情報のローテーションは、セキュリティの基本的な衛生管理（Security Hygiene）である。しかし、手動ローテーションは以下の問題を抱える。

- **ヒューマンエラー**: 手動での更新はミスが起きやすく、サービス停止のリスクがある
- **作業の抜け漏れ**: ローテーション対象が多い場合、一部を更新し忘れることがある
- **ダウンタイム**: 古い認証情報の無効化と新しい認証情報の反映の間にギャップが生じる

### 7.2 ゼロダウンタイムローテーションのパターン

秘密情報のローテーションにおいて最も重要なのは、ローテーション中にサービスが中断しないことである。以下に代表的なパターンを示す。

#### デュアルシークレットパターン

```mermaid
sequenceDiagram
    participant RM as Rotation Manager
    participant SS as Secret Store
    participant DB as Database
    participant APP as Application

    Note over RM: Step 1: Create new credentials
    RM->>DB: CREATE new user/password
    DB-->>RM: Success

    Note over RM: Step 2: Update secret store
    RM->>SS: Store new credentials<br/>(set as AWSPENDING)
    SS-->>RM: Success

    Note over RM: Step 3: Verify new credentials
    RM->>DB: Test connection with<br/>new credentials
    DB-->>RM: Connection OK

    Note over RM: Step 4: Promote new credentials
    RM->>SS: Promote AWSPENDING<br/>to AWSCURRENT
    SS-->>RM: Success

    Note over APP: Next credential fetch<br/>gets new credentials
    APP->>SS: Get current credentials
    SS-->>APP: New credentials

    Note over RM: Step 5: Cleanup old credentials
    RM->>DB: REVOKE old user
    DB-->>RM: Success
```

このパターンでは、新しい認証情報が検証されるまで古い認証情報は有効なままである。AWS Secrets Managerの自動ローテーションはこのパターンに基づいている。

#### Lambda関数によるローテーション実装

AWS Secrets Managerのローテーション用Lambda関数は、4つのステップで構成される。

```python
import boto3
import json
import string
import secrets

def lambda_handler(event, context):
    """Secrets Manager rotation handler with 4 steps."""
    secret_arn = event["SecretId"]
    token = event["ClientRequestToken"]
    step = event["Step"]

    sm_client = boto3.client("secretsmanager")

    if step == "createSecret":
        create_secret(sm_client, secret_arn, token)
    elif step == "setSecret":
        set_secret(sm_client, secret_arn, token)
    elif step == "testSecret":
        test_secret(sm_client, secret_arn, token)
    elif step == "finishSecret":
        finish_secret(sm_client, secret_arn, token)
    else:
        raise ValueError(f"Invalid step: {step}")


def create_secret(sm_client, secret_arn, token):
    """Step 1: Generate new credentials and store as AWSPENDING."""
    current = sm_client.get_secret_value(
        SecretId=secret_arn, VersionStage="AWSCURRENT"
    )
    current_secret = json.loads(current["SecretString"])

    # Generate new password
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()"
    new_password = "".join(secrets.choice(alphabet) for _ in range(32))

    new_secret = {**current_secret, "password": new_password}
    sm_client.put_secret_value(
        SecretId=secret_arn,
        ClientRequestToken=token,
        SecretString=json.dumps(new_secret),
        VersionStages=["AWSPENDING"],
    )


def set_secret(sm_client, secret_arn, token):
    """Step 2: Apply the new credentials to the database."""
    pending = sm_client.get_secret_value(
        SecretId=secret_arn, VersionId=token, VersionStage="AWSPENDING"
    )
    pending_secret = json.loads(pending["SecretString"])

    # Update database password using admin connection
    # (implementation depends on the database type)
    update_database_password(pending_secret)


def test_secret(sm_client, secret_arn, token):
    """Step 3: Verify the new credentials work."""
    pending = sm_client.get_secret_value(
        SecretId=secret_arn, VersionId=token, VersionStage="AWSPENDING"
    )
    pending_secret = json.loads(pending["SecretString"])

    # Test database connection with new credentials
    test_database_connection(pending_secret)


def finish_secret(sm_client, secret_arn, token):
    """Step 4: Promote AWSPENDING to AWSCURRENT."""
    metadata = sm_client.describe_secret(SecretId=secret_arn)

    # Find the current version
    current_version = None
    for version_id, stages in metadata["VersionIdsToStages"].items():
        if "AWSCURRENT" in stages:
            current_version = version_id
            break

    # Move labels
    sm_client.update_secret_version_stage(
        SecretId=secret_arn,
        VersionStage="AWSCURRENT",
        MoveToVersionId=token,
        RemoveFromVersionId=current_version,
    )
```

### 7.3 Vaultの動的シークレットによるローテーション不要化

Vaultの動的シークレットを利用すれば、従来のローテーションの概念自体が不要になる。各リクエストごとに一時的な認証情報が生成されるため、「静的な秘密情報をローテーションする」という行為そのものが存在しない。

```mermaid
flowchart TB
    subgraph "従来のローテーションモデル"
        A1[静的パスワード作成] --> A2[秘密情報ストアに保存]
        A2 --> A3[アプリケーションが取得して使用]
        A3 --> A4[30日後にローテーション]
        A4 --> A1
    end
    subgraph "Vault動的シークレットモデル"
        B1[アプリケーションがVaultにリクエスト]
        B1 --> B2[Vaultが一時的な認証情報を生成<br/>TTL: 1h]
        B2 --> B3[アプリケーションが使用]
        B3 --> B4[TTL期限切れで自動無効化]
        B4 --> B1
    end
```

この動的シークレットモデルでは、認証情報の有効期間が数時間に限定されるため、仮に漏洩が発生しても被害の時間窓（Window of Exposure）が大幅に短縮される。

## 8. ベストプラクティス

### 8.1 秘密情報のライフサイクル管理

秘密情報にはライフサイクルがあり、各フェーズで適切な管理が求められる。

```mermaid
flowchart LR
    CREATE[生成] --> STORE[保存]
    STORE --> DISTRIBUTE[配布]
    DISTRIBUTE --> USE[使用]
    USE --> ROTATE[ローテーション]
    ROTATE --> STORE
    USE --> REVOKE[無効化]
    REVOKE --> DESTROY[破棄]
```

| フェーズ | ベストプラクティス |
|---------|-----------------|
| **生成** | 暗号学的に安全な乱数生成器を使用。人間が推測可能なパスワードは避ける |
| **保存** | 暗号化された秘密情報ストアに保存。平文での保存は一切禁止 |
| **配布** | TLSで暗号化された経路で配布。秘密情報は最小限のコンシューマにのみ配布 |
| **使用** | メモリ上での保持時間を最小化。ログに秘密情報を出力しない |
| **ローテーション** | 定期的に自動ローテーション。手動プロセスは排除 |
| **無効化** | インシデント発生時に即座に無効化できる手順を準備 |
| **破棄** | 不要になった秘密情報は確実に削除。バックアップ上の残存にも注意 |

### 8.2 秘密情報の漏洩検知

#### 静的スキャン（Pre-commit）

コミット前に秘密情報の混入を検知するための静的スキャンツールを導入する。

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks

  - repo: https://github.com/trufflesecurity/trufflehog
    rev: v3.63.0
    hooks:
      - id: trufflehog
```

主要なスキャンツールは以下の通りである。

| ツール | 特徴 |
|-------|------|
| **Gitleaks** | 高速で設定が容易。正規表現ベースの検出 |
| **TruffleHog** | エントロピーベースの検出が可能。Git履歴の遡及スキャンに対応 |
| **GitGuardian** | SaaS型。リアルタイムモニタリングとアラート機能 |
| **detect-secrets（Yelp）** | プラグインベースのアーキテクチャ。ベースラインファイルによる差分検出 |

#### CI/CDパイプラインでの検査

```yaml
# GitHub Actions workflow for secret scanning
name: Secret Scan
on:
  pull_request:
    branches: [main]

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 8.3 秘密情報をログに出力しない

アプリケーションログに秘密情報が含まれることは、頻繁に起こるセキュリティ問題である。以下の対策を講じる。

```python
import logging
import re

class SecretFilter(logging.Filter):
    """Logging filter that redacts potential secrets."""

    PATTERNS = [
        re.compile(r"(password|passwd|secret|token|key|api_key)\s*[:=]\s*\S+", re.I),
        re.compile(r"(AKIA[0-9A-Z]{16})"),  # AWS access key
        re.compile(r"(eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+)"),  # JWT
    ]

    def filter(self, record):
        message = record.getMessage()
        for pattern in self.PATTERNS:
            message = pattern.sub("[REDACTED]", message)
        record.msg = message
        record.args = ()
        return True

# Apply filter to logger
logger = logging.getLogger("myapp")
logger.addFilter(SecretFilter())
```

::: warning 環境変数の取り扱い
コンテナのクラッシュダンプやデバッグ出力に環境変数が含まれることがある。秘密情報を環境変数で渡す場合は、クラッシュダンプの出力先と保護に注意が必要である。可能であれば、環境変数よりもファイルマウント（`/vault/secrets/`など）を使用する方が安全である。
:::

### 8.4 ゼロトラストアプローチ

秘密情報管理においてもゼロトラスト（Zero Trust）の原則を適用する。

1. **常に検証**: すべてのアクセスリクエストに対して認証・認可を行う。ネットワーク境界による信頼は行わない
2. **最小権限**: 必要最小限のアクセス権のみを付与する
3. **侵害を前提とする**: 秘密情報が漏洩した場合の影響を最小化する設計を行う（TTLの短縮、動的シークレットの使用）

### 8.5 管理方式の選定フローチャート

プロジェクトの要件に基づいて適切な秘密情報管理の方式を選定するためのフローチャートを以下に示す。

```mermaid
flowchart TD
    START[秘密情報管理方式の選定] --> Q1{マルチクラウド環境?}
    Q1 -->|Yes| Q2{動的シークレットが必要?}
    Q1 -->|No| Q3{どのクラウド?}
    Q2 -->|Yes| VAULT[HashiCorp Vault]
    Q2 -->|No| Q4{GitOpsワークフロー?}
    Q4 -->|Yes| SOPS_VAULT[SOPS + Vault]
    Q4 -->|No| VAULT
    Q3 -->|AWS| AWS_SM[AWS Secrets Manager]
    Q3 -->|GCP| GCP_SM[GCP Secret Manager]
    Q3 -->|Azure| AZ_KV[Azure Key Vault]
    AWS_SM --> Q5{Kubernetesを使用?}
    GCP_SM --> Q5
    AZ_KV --> Q5
    VAULT --> Q5
    Q5 -->|Yes| ESO[External Secrets Operator<br/>で同期]
    Q5 -->|No| DIRECT[SDKで直接取得]
```

### 8.6 まとめ：秘密情報管理のチェックリスト

最後に、秘密情報管理における主要なチェック項目を整理する。

| カテゴリ | チェック項目 |
|---------|------------|
| **基本** | ソースコードに秘密情報がハードコードされていない |
| **基本** | `.gitignore`に`.env`ファイルが含まれている |
| **基本** | 秘密情報管理ツール（Vault / Secrets Manager等）が導入されている |
| **アクセス制御** | 最小権限の原則が適用されている |
| **アクセス制御** | 秘密情報へのアクセスに認証が必要 |
| **監査** | すべての秘密情報アクセスが監査ログに記録される |
| **監査** | アラートルールが設定されている |
| **暗号化** | 保存時暗号化（At Rest）が有効 |
| **暗号化** | 転送時暗号化（In Transit、TLS）が有効 |
| **ローテーション** | 自動ローテーションが設定されている |
| **ローテーション** | ゼロダウンタイムローテーションが実現されている |
| **検知** | Pre-commitフックで秘密情報の混入をスキャン |
| **検知** | CI/CDパイプラインでの秘密情報スキャン |
| **インシデント対応** | 秘密情報漏洩時の対応手順が文書化されている |
| **インシデント対応** | 即時無効化の手順がテスト済み |

秘密情報管理は一度導入すれば終わりではなく、継続的に改善すべき運用上の課題である。組織の規模やシステムの複雑さに応じて、適切なツールとプロセスを選択し、定期的に見直すことが重要である。
