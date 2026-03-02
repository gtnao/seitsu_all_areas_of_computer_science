---
title: "Twelve-Factor App の設計原則"
date: 2026-03-02
tags: ["software-engineering", "twelve-factor", "cloud-native", "architecture", "intermediate"]
---

# Twelve-Factor App の設計原則

## 背景と目的 — なぜ Twelve-Factor App が生まれたか

### PaaS 時代の幕開けと Heroku

2000年代後半、クラウドコンピューティングの台頭とともに、アプリケーションの開発・運用のあり方は根本的な転換を迎えた。2007年に設立された Heroku は、Ruby on Rails アプリケーションをデプロイするだけで自動的にスケールする Platform as a Service（PaaS）を提供し、開発者がインフラを意識せずにアプリケーションを運用できる世界を切り開いた。

しかし、Heroku の運用チームは数万のアプリケーションをホスティングする中で、ある種のパターンに気づいた。うまく動くアプリケーションと、そうでないアプリケーションの間には、明確な設計上の差異が存在していたのである。環境変数を使わずに設定をハードコードするアプリケーション、ローカルファイルシステムにセッション情報を保存するアプリケーション、データベース接続を前提としたプロセスの起動順序を要求するアプリケーション——これらはすべて、クラウド環境でのスケーリングやデプロイに深刻な問題を引き起こしていた。

### Twelve-Factor App の誕生

2012年、Heroku の共同創設者である Adam Wiggins は、これらの観察と経験を体系化し、「The Twelve-Factor App」というドキュメントを公開した。このドキュメントは、モダンな Web アプリケーション（当時は主に SaaS）を構築するための12の設計原則を定めたものである。

::: tip Twelve-Factor App の目標
Twelve-Factor App は、以下の特性を持つアプリケーションの構築を目指す。
- **宣言的な**セットアップの自動化により、新しい開発者の参入コストを最小化する
- 実行環境間の**移植性**を最大化するために、OS との間に**クリーンな契約**を持つ
- クラウドプラットフォームへの**デプロイ**に適しており、サーバーやシステム管理の必要性を排除する
- 開発環境と本番環境の**乖離を最小化**し、継続的デプロイを可能にする
- ツール、アーキテクチャ、開発プラクティスに大きな変更を加えることなく**スケールアウト**できる
:::

この12の原則は、特定のプログラミング言語やフレームワークに依存しない。Python の Django であれ、Ruby の Rails であれ、Java の Spring Boot であれ、Go のネイティブ HTTP サーバーであれ、等しく適用可能な普遍的な設計指針である。

### なぜ今でも重要なのか

Twelve-Factor App が提唱されてから10年以上が経過したが、その重要性はむしろ増している。Docker によるコンテナ化、Kubernetes によるオーケストレーション、マイクロサービスアーキテクチャの普及——これらの現代的な技術スタックは、Twelve-Factor App の原則を暗黙の前提としている。Twelve-Factor に反するアプリケーションは、コンテナ化が困難であり、Kubernetes 上での運用に支障をきたし、CI/CD パイプラインとの統合に問題を生じさせる。

```mermaid
timeline
    title Twelve-Factor App と関連技術の系譜
    2007 : Heroku 設立
    2011 : Cloud Foundry 登場
    2012 : Twelve-Factor App 公開
    2013 : Docker 登場
    2014 : Kubernetes 登場
    2015 : Cloud Native Computing Foundation 設立
    2017 : Beyond Twelve-Factor App
```

## 12の要素 — 詳細解説

以下では、Twelve-Factor App の12の要素それぞれについて、その原則の内容、背景にある問題意識、そして現代的な解釈を詳しく解説する。

```mermaid
graph TB
    subgraph "Twelve-Factor App"
        direction TB
        subgraph "コードベースと依存関係"
            I["I. Codebase<br/>コードベース"]
            II["II. Dependencies<br/>依存関係"]
        end
        subgraph "設定と外部サービス"
            III["III. Config<br/>設定"]
            IV["IV. Backing Services<br/>バックエンドサービス"]
        end
        subgraph "ビルド・リリース・実行"
            V["V. Build, Release, Run<br/>ビルド・リリース・実行"]
            VI["VI. Processes<br/>プロセス"]
        end
        subgraph "外部との接点"
            VII["VII. Port Binding<br/>ポートバインディング"]
            VIII["VIII. Concurrency<br/>並行性"]
        end
        subgraph "運用特性"
            IX["IX. Disposability<br/>廃棄容易性"]
            X["X. Dev/Prod Parity<br/>開発・本番一致"]
        end
        subgraph "可観測性と管理"
            XI["XI. Logs<br/>ログ"]
            XII["XII. Admin Processes<br/>管理プロセス"]
        end
    end

    style I fill:#e3f2fd,stroke:#1565c0
    style II fill:#e3f2fd,stroke:#1565c0
    style III fill:#fff3e0,stroke:#e65100
    style IV fill:#fff3e0,stroke:#e65100
    style V fill:#e8f5e9,stroke:#2e7d32
    style VI fill:#e8f5e9,stroke:#2e7d32
    style VII fill:#fce4ec,stroke:#c62828
    style VIII fill:#fce4ec,stroke:#c62828
    style IX fill:#f3e5f5,stroke:#6a1b9a
    style X fill:#f3e5f5,stroke:#6a1b9a
    style XI fill:#fff9c4,stroke:#f9a825
    style XII fill:#fff9c4,stroke:#f9a825
```

---

### I. Codebase — コードベース

> **"One codebase tracked in revision control, many deploys"**
> 一つのコードベースをバージョン管理で追跡し、多数のデプロイを行う

#### 原則の内容

一つのアプリケーションには、一つのコードベース（リポジトリ）が対応する。そのコードベースから、開発環境、ステージング環境、本番環境など、複数の環境にデプロイが行われる。

```mermaid
graph LR
    subgraph "1つのコードベース"
        Repo["Git リポジトリ"]
    end

    Repo -->|deploy| Dev["開発環境"]
    Repo -->|deploy| Staging["ステージング環境"]
    Repo -->|deploy| Prod["本番環境"]

    style Repo fill:#e3f2fd,stroke:#1565c0
    style Dev fill:#e8f5e9,stroke:#2e7d32
    style Staging fill:#fff3e0,stroke:#e65100
    style Prod fill:#fce4ec,stroke:#c62828
```

この原則が意味するのは以下の2点である。

1. **一つのアプリケーションに複数のコードベースがあってはならない**：複数のリポジトリからなるものは「分散システム」であり、個々のコンポーネントがそれぞれ Twelve-Factor に準拠すべきである
2. **複数のアプリケーションが同じコードベースを共有してはならない**：共有コードはライブラリとして切り出し、依存関係マネージャで管理する

#### 背景にある問題

Twelve-Factor App 以前の時代には、同じアプリケーションの異なるバージョンが異なる環境で動作し、それぞれが独自のコード変更を抱えているという状況が珍しくなかった。「本番環境にだけあるホットフィックス」「ステージング環境でしかテストされていない機能」といった状態が、デプロイの混乱と障害の原因になっていた。

#### 現代的解釈

コンテナ時代において、この原則は **1リポジトリ = 1コンテナイメージ** という形でさらに明確になっている。モノレポ（monorepo）構成を採用する組織も多いが、その場合でもビルドの単位（＝デプロイの単位）は一つのアプリケーションに対応させるのが一般的である。

::: warning モノレポと Twelve-Factor
モノレポ自体は Twelve-Factor に反するわけではない。重要なのは、各アプリケーションが独立してビルド・デプロイできることであり、リポジトリの物理的な構成ではない。Bazel や Nx のようなモノレポツールは、この独立性を維持する仕組みを提供する。
:::

---

### II. Dependencies — 依存関係

> **"Explicitly declare and isolate dependencies"**
> 依存関係を明示的に宣言し、分離する

#### 原則の内容

アプリケーションは、システム全体にインストールされたパッケージの暗黙的な存在に依存してはならない。すべての依存関係を**明示的に宣言**し、依存関係の**分離**ツールを使用してシステムワイドのパッケージが漏れ込まないようにする。

```bash
# Bad: system-wide package に暗黙的に依存
$ python app.py  # What version of requests? Is it even installed?

# Good: dependency declaration and isolation
$ cat requirements.txt
Flask==3.0.0
requests==2.31.0
psycopg2-binary==2.9.9

$ python -m venv .venv        # isolation
$ pip install -r requirements.txt  # explicit declaration
```

#### 背景にある問題

「私のマシンでは動くのに...」という古典的な問題は、多くの場合、暗黙的な依存関係に起因する。開発者のマシンにはたまたまインストールされている `curl` コマンドや `ImageMagick` ライブラリが本番サーバーには存在せず、デプロイ後に初めて問題が発覚するという状況である。

#### 現代的解釈

各言語のエコシステムは、この原則を実現するためのツールを成熟させてきた。

| 言語 | 依存宣言 | 分離ツール |
|------|----------|-----------|
| Python | `requirements.txt` / `pyproject.toml` | `venv` / `virtualenv` |
| Node.js | `package.json` + `package-lock.json` | `node_modules`（プロジェクトローカル） |
| Ruby | `Gemfile` + `Gemfile.lock` | `Bundler` |
| Go | `go.mod` + `go.sum` | Go Modules（言語レベルで分離） |
| Rust | `Cargo.toml` + `Cargo.lock` | Cargo（言語レベルで分離） |
| Java | `pom.xml` / `build.gradle` | Maven / Gradle |

コンテナ化の普及により、依存関係の分離はさらに強力になった。Dockerfile の中で依存関係をインストールすることで、OS レベルのライブラリを含むすべての依存関係が明示的かつ再現可能な形で管理される。

```dockerfile
# Dockerfile: all dependencies are explicit
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt  # explicit declaration

COPY . .
CMD ["python", "app.py"]
```

---

### III. Config — 設定

> **"Store config in the environment"**
> 設定を環境変数に格納する

#### 原則の内容

アプリケーションの**設定**——デプロイごとに異なる可能性のある値——は、コードから厳密に分離し、**環境変数**に格納する。ここでいう「設定」とは、データベースの接続情報、外部サービスの API キー、デプロイ先の URL（ステージング、本番）などを指す。

::: danger やってはいけない例
設定をコードにハードコードすることは、セキュリティリスクと運用上のリスクの両方を生む。
```python
# Bad: credentials hardcoded in source
DATABASE_URL = "postgres://user:password@prod-db:5432/myapp"
API_KEY = "sk-1234567890abcdef"
```
:::

正しいアプローチは、環境変数から設定を読み取ることである。

```python
import os

# Good: read config from environment variables
DATABASE_URL = os.environ["DATABASE_URL"]
API_KEY = os.environ["API_KEY"]
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
```

#### 背景にある問題

設定をコードに埋め込むことの問題は多岐にわたる。

1. **セキュリティ**: データベースパスワードや API キーがバージョン管理に記録され、漏洩のリスクが高まる
2. **柔軟性の欠如**: 環境ごとに異なるバイナリをビルドする必要が生じ、「同じコードを複数環境にデプロイ」という原則が破壊される
3. **運用の硬直化**: 設定変更のたびにコードの変更とデプロイが必要になる

#### 現代的解釈

Twelve-Factor App では環境変数を推奨しているが、現代のクラウドネイティブ環境では、より洗練された設定管理の仕組みが利用できる。

**Kubernetes の ConfigMap と Secret**

```yaml
# ConfigMap: non-sensitive configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  LOG_LEVEL: "info"
  MAX_CONNECTIONS: "100"

---
# Secret: sensitive configuration
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgres://user:password@db:5432/myapp"
  API_KEY: "sk-1234567890abcdef"
```

```yaml
# Pod spec: inject as environment variables
spec:
  containers:
    - name: app
      envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
```

Kubernetes の Secret は Base64 エンコードに過ぎず、暗号化されているわけではない点に注意が必要である。本番環境では、HashiCorp Vault、AWS Secrets Manager、Azure Key Vault などのシークレット管理サービスと組み合わせて使用するのが一般的である。

::: tip 設定の3層構造
現代的なアプリケーションでは、設定を以下の3層で管理するのが良いプラクティスである。
1. **デフォルト値**: コードに埋め込む（機密情報以外）
2. **設定ファイル**: 環境固有のデフォルト値（`.env.example` として追跡）
3. **環境変数**: 実行時に注入する（機密情報やデプロイ固有の値）

優先順位は 環境変数 > 設定ファイル > デフォルト値 とし、上位が下位を上書きする。
:::

---

### IV. Backing Services — バックエンドサービス

> **"Treat backing services as attached resources"**
> バックエンドサービスをアタッチされたリソースとして扱う

#### 原則の内容

バックエンドサービス（データベース、メッセージキュー、SMTP サービス、キャッシュシステムなど）は、アプリケーションにとって**アタッチされたリソース**として扱う。ローカルに管理されるサービス（同じマシン上の MySQL）とサードパーティサービス（Amazon RDS、Mailgun）を区別なく扱えるようにする。

```mermaid
graph LR
    App["アプリケーション"]

    App --> DB["PostgreSQL<br/>(ローカル or RDS)"]
    App --> Cache["Redis<br/>(ローカル or ElastiCache)"]
    App --> Queue["RabbitMQ<br/>(ローカル or CloudAMQP)"]
    App --> Mail["SMTP<br/>(ローカル or SendGrid)"]
    App --> Storage["S3<br/>(ローカル MinIO or AWS S3)"]

    style App fill:#e3f2fd,stroke:#1565c0
    style DB fill:#e8f5e9,stroke:#2e7d32
    style Cache fill:#fff3e0,stroke:#e65100
    style Queue fill:#fce4ec,stroke:#c62828
    style Mail fill:#f3e5f5,stroke:#6a1b9a
    style Storage fill:#fff9c4,stroke:#f9a825
```

アプリケーションのコードは、ローカルの PostgreSQL とクラウド上の Amazon RDS を切り替える際に、一切のコード変更を必要としないように設計する。切り替えに必要なのは、環境変数（接続文字列）の変更だけである。

#### 背景にある問題

データベースやキャッシュへの接続情報がコードにハードコードされていたり、ローカルのファイルパスに依存していたりすると、環境間の移行が困難になる。また、障害時にバックエンドサービスを別のインスタンスに切り替える際にも、コード変更とデプロイが必要になってしまう。

#### 現代的解釈

Kubernetes のエコシステムでは、この原則はサービスディスカバリと組み合わせて実現される。Kubernetes Service、Consul、etcd などのサービスディスカバリ機構により、バックエンドサービスの場所を動的に解決できる。また、Kubernetes Operator パターンにより、データベースやメッセージキューの生成・管理自体もコードとして宣言的に定義できるようになっている。

---

### V. Build, Release, Run — ビルド、リリース、実行

> **"Strictly separate build and run stages"**
> ビルドステージと実行ステージを厳密に分離する

#### 原則の内容

コードベースからデプロイ可能な状態に至るまでのプロセスを、3つの明確なステージに分離する。

```mermaid
graph LR
    Code["コードベース"] -->|Build| Build["ビルド<br/>(コンパイル・アセット構築)"]
    Build -->|+ Config| Release["リリース<br/>(ビルド + 設定)"]
    Release -->|Run| Run["実行<br/>(プロセスの起動)"]

    style Code fill:#e3f2fd,stroke:#1565c0
    style Build fill:#e8f5e9,stroke:#2e7d32
    style Release fill:#fff3e0,stroke:#e65100
    style Run fill:#fce4ec,stroke:#c62828
```

1. **ビルドステージ**: コードを実行可能なバンドルに変換する。依存関係の解決、コンパイル、アセットの構築などが含まれる
2. **リリースステージ**: ビルドと設定を組み合わせる。リリースには一意の識別子（タイムスタンプやバージョン番号）が付与される
3. **実行ステージ**: リリースを実行環境で起動する

重要なのは、**実行時にコードを変更してはならない**ということである。本番環境で直接コードを編集するという行為は、この原則に真っ向から反する。

#### 背景にある問題

ビルドとリリースと実行が混在していると、以下の問題が発生する。

- 本番環境での緊急パッチが追跡されず、次のデプロイで上書きされる
- どのコードがどの環境で動作しているかが不明確になる
- ロールバックが困難になる（何に戻せばいいのかが分からない）

#### 現代的解釈

コンテナ技術は、この3ステージの分離を自然に実現する。

```bash
# Build stage: create an immutable container image
docker build -t myapp:v1.2.3 .

# Release stage: combine image with config (e.g., Kubernetes manifest)
# The image (build) + ConfigMap/Secret (config) = Release

# Run stage: execute the release
kubectl apply -f deployment.yaml
```

CI/CD パイプラインは、この3ステージを自動化したものに他ならない。GitHub Actions、GitLab CI、CircleCI などのツールが、コードのプッシュをトリガーとしてビルド、テスト、リリース、デプロイを自動的に実行する。

リリースに一意の識別子を付与するという原則は、コンテナイメージのタグ（`myapp:v1.2.3` や `myapp:abc1234`）として実現される。Git のコミットハッシュをイメージタグに使用することで、「どのコードがどの環境で動作しているか」を常に追跡可能にする組織は多い。

---

### VI. Processes — プロセス

> **"Execute the app as one or more stateless processes"**
> アプリケーションを一つまたは複数のステートレスプロセスとして実行する

#### 原則の内容

アプリケーションプロセスは**ステートレス**かつ**シェアードナッシング**であるべきである。永続化が必要なデータはすべて、ステートフルなバックエンドサービス（データベースなど）に格納する。

::: danger アンチパターン: スティッキーセッション
スティッキーセッション（特定のユーザーを常に同じプロセスにルーティングする仕組み）は、この原則に反する。セッションデータはプロセスのメモリ内に保持するのではなく、Redis や Memcached のような有効期限付きデータストアに格納すべきである。
:::

```python
# Bad: in-memory session store
sessions = {}  # lost when process restarts

@app.route("/login", methods=["POST"])
def login():
    session_id = create_session()
    sessions[session_id] = {"user_id": request.form["user_id"]}
    return jsonify({"session_id": session_id})

# Good: external session store
import redis
r = redis.Redis.from_url(os.environ["REDIS_URL"])

@app.route("/login", methods=["POST"])
def login():
    session_id = create_session()
    r.setex(
        f"session:{session_id}",
        3600,  # expires in 1 hour
        json.dumps({"user_id": request.form["user_id"]})
    )
    return jsonify({"session_id": session_id})
```

#### 背景にある問題

プロセスが状態を持つと、スケーリングの柔軟性が大幅に制限される。プロセスを追加・削除するたびにセッションが失われたり、特定のプロセスに負荷が集中したりする。また、プロセスの再起動やクラッシュによってデータが消失するリスクもある。

#### 現代的解釈

コンテナ環境では、この原則はさらに厳格に適用される。Kubernetes の Pod はいつでも再スケジュール、再起動、削除される可能性がある。Pod 内のファイルシステムはエフェメラル（一時的）であり、Pod の終了とともに消失する。ステートレスなアプリケーション設計は、Kubernetes 上での運用の前提条件と言ってよい。

ただし、すべてのワークロードが完全にステートレスにできるわけではない。Kubernetes の StatefulSet は、ステートフルなワークロード（データベース、メッセージブローカーなど）を管理するための仕組みを提供する。重要なのは、**アプリケーション層**はステートレスに保ち、**データ層**にステートを集約するという責務の分離である。

---

### VII. Port Binding — ポートバインディング

> **"Export services via port binding"**
> ポートバインディングを通じてサービスを公開する

#### 原則の内容

アプリケーションは、**自己完結的**であり、Webサーバーのランタイムにインジェクションされることに依存しない。つまり、Apache や Tomcat のようなWebサーバーコンテナにデプロイするのではなく、アプリケーション自身がHTTPサーバーとしてポートをバインドし、リクエストを受け付ける。

```python
# The app itself binds to a port and serves HTTP
from flask import Flask

app = Flask(__name__)

@app.route("/")
def index():
    return "Hello, World!"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)  # self-contained HTTP server
```

#### 背景にある問題

Java EE の WAR ファイルを Tomcat にデプロイする、PHP アプリケーションを Apache の mod_php で実行する——これらの伝統的なデプロイモデルでは、アプリケーションがWebサーバーの設定と密結合し、環境の移植性が低下していた。また、同一のWebサーバー上で複数のアプリケーションを動作させる際に、設定の競合や干渉が発生していた。

#### 現代的解釈

コンテナ化されたアプリケーションは、この原則を自然に満たす。コンテナは一つのプロセスとして自身のポートをバインドし、Kubernetes の Service や Ingress がトラフィックをルーティングする。

```yaml
# Kubernetes Service: route traffic to the app's port
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
  ports:
    - port: 80         # external port
      targetPort: 5000  # app's bound port
```

さらに、ポートバインディングの原則は HTTP に限らない。gRPC、WebSocket、カスタムの TCP プロトコルなど、あらゆるネットワークサービスにこの原則は適用される。あるアプリケーションが別のアプリケーションのバックエンドサービスになることも可能であり、これがマイクロサービスアーキテクチャの基盤となっている。

---

### VIII. Concurrency — 並行性

> **"Scale out via the process model"**
> プロセスモデルによってスケールアウトする

#### 原則の内容

アプリケーションは、Unix のプロセスモデルに倣い、異なる種類のワークロードを異なるプロセスタイプに割り当て、各プロセスタイプを独立してスケールアウトする。

```mermaid
graph TB
    subgraph "プロセスモデルによるスケーリング"
        direction LR
        subgraph "Web プロセス"
            W1["web.1"]
            W2["web.2"]
            W3["web.3"]
        end
        subgraph "Worker プロセス"
            WK1["worker.1"]
            WK2["worker.2"]
        end
        subgraph "Clock プロセス"
            C1["clock.1"]
        end
    end

    LB["ロードバランサー"] --> W1
    LB --> W2
    LB --> W3
    Queue["ジョブキュー"] --> WK1
    Queue --> WK2

    style W1 fill:#e3f2fd,stroke:#1565c0
    style W2 fill:#e3f2fd,stroke:#1565c0
    style W3 fill:#e3f2fd,stroke:#1565c0
    style WK1 fill:#e8f5e9,stroke:#2e7d32
    style WK2 fill:#e8f5e9,stroke:#2e7d32
    style C1 fill:#fff3e0,stroke:#e65100
```

Heroku では、`Procfile` というファイルでプロセスタイプとその起動コマンドを宣言的に定義する。

```
web: gunicorn app:app --bind 0.0.0.0:$PORT --workers 4
worker: celery -A tasks worker --loglevel=info
clock: celery -A tasks beat --loglevel=info
```

#### 背景にある問題

従来のスケーリングアプローチでは、単一のプロセス内でスレッドを増やす「スケールアップ」に依存することが多かった。この方法には物理的な限界（一台のマシンのCPU/メモリ上限）があり、また単一障害点（Single Point of Failure）を生み出す。

#### 現代的解釈

Kubernetes の Deployment と HPA（Horizontal Pod Autoscaler）は、この原則を宣言的に実現する。

```yaml
# Horizontal Pod Autoscaler: automatic process scaling
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-web
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp-web
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

KEDA（Kubernetes Event-Driven Autoscaling）のようなツールを使えば、メッセージキューの深さやカスタムメトリクスに基づくスケーリングも可能であり、Worker プロセスの自動スケーリングもきめ細かく制御できる。

---

### IX. Disposability — 廃棄容易性

> **"Maximize robustness with fast startup and graceful shutdown"**
> 高速な起動とグレースフルなシャットダウンで堅牢性を最大化する

#### 原則の内容

アプリケーションのプロセスは、**使い捨て**（disposable）であるべきである。すなわち、即座に起動でき、グレースフルに（優雅に）シャットダウンでき、突然の停止にも耐えられるように設計する。

**高速な起動**：プロセスは起動シグナルを受けてから数秒以内にリクエストを処理可能な状態になるべきである。これにより、迅速なスケールアウトとデプロイが可能になる。

**グレースフルシャットダウン**：SIGTERM シグナルを受信したら、処理中のリクエストを完了させ、新しいリクエストの受け付けを停止してから終了する。

```python
import signal
import sys

def graceful_shutdown(signum, frame):
    """Handle SIGTERM for graceful shutdown."""
    print("Received SIGTERM, shutting down gracefully...")
    # Stop accepting new requests
    server.stop_accepting()
    # Wait for in-flight requests to complete
    server.wait_for_pending(timeout=30)
    # Clean up resources
    db_pool.close()
    sys.exit(0)

signal.signal(signal.SIGTERM, graceful_shutdown)
```

**クラッシュ耐性**：プロセスが突然停止した場合でも、データの損失や整合性の破壊が発生しないようにする。これは、ジョブの冪等性（idempotency）やトランザクションの適切な使用によって実現される。

#### 背景にある問題

起動に数分を要するアプリケーション（Java EE アプリケーションサーバーに WAR をデプロイする場合など）は、スケールアウトの応答性が悪く、デプロイ時のダウンタイムも長くなる。また、シャットダウン処理が不適切なアプリケーションは、デプロイ時にリクエストが中断される。

#### 現代的解釈

Kubernetes では、Pod のライフサイクル管理がこの原則を強制する。

```yaml
spec:
  containers:
    - name: app
      lifecycle:
        preStop:
          exec:
            command: ["/bin/sh", "-c", "sleep 5"]  # allow LB to deregister
      # Kubernetes sends SIGTERM, then waits terminationGracePeriodSeconds
      terminationGracePeriodSeconds: 30
      # Readiness probe: only receive traffic when ready
      readinessProbe:
        httpGet:
          path: /healthz
          port: 5000
        initialDelaySeconds: 5
        periodSeconds: 10
      # Liveness probe: restart if unhealthy
      livenessProbe:
        httpGet:
          path: /healthz
          port: 5000
        initialDelaySeconds: 15
        periodSeconds: 20
```

起動時間の短縮は、コンテナ環境では特に重要である。GraalVM のネイティブイメージ、Go のシングルバイナリ、Rust の高速起動といった技術が注目される背景には、この原則がある。Java の世界では、Quarkus や Micronaut のようなフレームワークが、ビルド時の最適化によって起動時間を大幅に短縮している。

---

### X. Dev/Prod Parity — 開発・本番一致

> **"Keep development, staging, and production as similar as possible"**
> 開発、ステージング、本番環境をできるだけ一致させる

#### 原則の内容

開発環境と本番環境の間に存在する3つのギャップを最小化する。

| ギャップ | 従来の開発 | Twelve-Factor App |
|---------|-----------|------------------|
| **時間のギャップ**: コード変更からデプロイまでの時間 | 数週間〜数ヶ月 | 数時間〜数日 |
| **人のギャップ**: コードを書く人とデプロイする人が異なる | 開発者が書き、運用者がデプロイ | 開発者がデプロイにも関与 |
| **ツールのギャップ**: 開発と本番で異なるツールスタックを使用 | SQLite（開発）/ PostgreSQL（本番） | 両方とも PostgreSQL |

::: warning 開発環境の「軽量な代替」は危険
「開発では SQLite、本番では PostgreSQL」「開発ではインメモリキャッシュ、本番では Redis」といった使い分けは、微妙な互換性の問題を本番で発覚させる原因となる。SQLite と PostgreSQL では NULL の扱い、日付関数、トランザクション分離レベルなどが異なり、開発環境では再現できない本番固有のバグを生む。
:::

#### 背景にある問題

開発環境と本番環境の乖離は、「開発環境では動くが本番環境では動かない」という古典的な問題を引き起こす。この乖離が大きいほど、デプロイのリスクが高まり、デプロイ頻度が下がり、フィードバックループが長くなる。

#### 現代的解釈

Docker Compose は、開発環境でもバックエンドサービスを本番と同等のスタックで起動することを容易にした。

```yaml
# docker-compose.yml: development environment mirrors production
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: "postgres://user:pass@db:5432/myapp"
      REDIS_URL: "redis://cache:6379"
    depends_on:
      - db
      - cache

  db:
    image: postgres:16  # same version as production
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: myapp

  cache:
    image: redis:7      # same version as production
```

さらに、Tilt や Skaffold のようなツールは、ローカルの Kubernetes クラスタ（kind、minikube）上でアプリケーションを開発・デバッグする環境を提供し、開発と本番の乖離を極限まで縮小する。

---

### XI. Logs — ログ

> **"Treat logs as event streams"**
> ログをイベントストリームとして扱う

#### 原則の内容

アプリケーションは、ログファイルの書き込みやローテーションに関与すべきではない。ログは**標準出力（stdout）**にイベントストリームとして出力し、実行環境がそのストリームの収集・ルーティング・保存を担当する。

```python
import logging
import sys

# Good: log to stdout as an event stream
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter(
    '{"timestamp": "%(asctime)s", "level": "%(levelname)s", '
    '"message": "%(message)s", "module": "%(module)s"}'
))

logger = logging.getLogger(__name__)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Application just writes to stdout
logger.info("Order created", extra={"order_id": "12345"})
```

#### 背景にある問題

アプリケーションがログファイルを直接管理すると、以下の問題が発生する。

1. **ファイルパスの依存**: ログの出力先ディレクトリが環境によって異なり、設定が煩雑になる
2. **ディスク枯渇**: ログローテーションの設定が不適切だと、ディスクを使い切ってシステム障害を引き起こす
3. **分散環境での集約困難**: 複数のプロセスやサーバーに分散したログファイルを統合して分析するのは極めて困難である
4. **コンテナとの非互換**: コンテナのファイルシステムはエフェメラルであり、Pod の終了とともにログファイルも消失する

#### 現代的解釈

コンテナ環境では、stdout/stderr に出力されたログはコンテナランタイム（Docker、containerd）が自動的にキャプチャする。Kubernetes 環境では、Fluentd、Fluent Bit、Vector などのログコレクタがノードレベルでログを収集し、Elasticsearch、Loki、CloudWatch Logs などの集約ストレージに送信する。

```mermaid
graph LR
    subgraph "アプリケーション"
        App1["Pod A<br/>stdout"]
        App2["Pod B<br/>stdout"]
        App3["Pod C<br/>stdout"]
    end

    subgraph "ログ収集"
        Agent["Fluent Bit<br/>(DaemonSet)"]
    end

    subgraph "ログ集約・分析"
        Store["Elasticsearch<br/>/ Loki"]
        UI["Kibana<br/>/ Grafana"]
    end

    App1 --> Agent
    App2 --> Agent
    App3 --> Agent
    Agent --> Store
    Store --> UI

    style Agent fill:#e8f5e9,stroke:#2e7d32
    style Store fill:#e3f2fd,stroke:#1565c0
    style UI fill:#fff3e0,stroke:#e65100
```

構造化ログ（JSON 形式）を採用することで、ログの検索・フィルタリング・集計が飛躍的に容易になる。OpenTelemetry の普及により、ログ、メトリクス、トレースを統合的に扱うオブザーバビリティの世界では、ログをイベントストリームとして扱うこの原則がさらに重要性を増している。

---

### XII. Admin Processes — 管理プロセス

> **"Run admin/management tasks as one-off processes"**
> 管理タスクをワンオフプロセスとして実行する

#### 原則の内容

データベースのマイグレーション、REPL コンソールの起動、一回限りのスクリプト実行といった管理タスクは、アプリケーションと**同一の環境**で、**ワンオフプロセス**として実行する。

```bash
# Database migration: run as one-off process
$ heroku run python manage.py migrate

# Interactive console
$ heroku run python manage.py shell

# One-time data fix script
$ heroku run python scripts/fix_duplicate_orders.py
```

#### 背景にある問題

管理タスクを本番サーバーに SSH でログインして手動実行するという従来の方法には、多くの問題がある。

1. **環境の不一致**: 管理タスクがアプリケーションと異なる依存関係やコードバージョンで実行されるリスク
2. **追跡不能**: 誰が、いつ、何を実行したかの記録が残らない
3. **再現不可能**: 手順が属人化し、同じ操作の再現が困難

#### 現代的解釈

Kubernetes では、管理タスクは Job や CronJob として宣言的に定義・実行される。

```yaml
# Database migration as a Kubernetes Job
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: myapp:v1.2.3  # same image as the app
          command: ["python", "manage.py", "migrate"]
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secrets
      restartPolicy: Never
  backoffLimit: 3
```

```yaml
# Periodic cleanup as a CronJob
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-expired-sessions
spec:
  schedule: "0 2 * * *"  # daily at 2:00 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleanup
              image: myapp:v1.2.3
              command: ["python", "scripts/cleanup_sessions.py"]
              envFrom:
                - configMapRef:
                    name: app-config
                - secretRef:
                    name: app-secrets
          restartPolicy: Never
```

CI/CD パイプラインの中にマイグレーションステップを組み込み、デプロイの一環として自動的に実行する方法も広く採用されている。Argo Workflows や Tekton のようなワークフローエンジンを使えば、マイグレーション → スモークテスト → トラフィック切り替えといった複雑なデプロイ手順も宣言的に管理できる。

---

## 12要素の相互関係

12の要素は独立した原則のように見えるが、実際には深く相互に関連している。以下の図は、要素間の主要な関連性を示したものである。

```mermaid
graph TB
    I["I. Codebase"] -->|"コードから設定を分離"| III["III. Config"]
    I -->|"依存関係をコードベースに宣言"| II["II. Dependencies"]
    III -->|"バックエンドサービスの接続情報"| IV["IV. Backing Services"]
    II -->|"ビルド時に依存関係を解決"| V["V. Build, Release, Run"]
    III -->|"リリース時に設定を結合"| V
    V -->|"ステートレスなプロセスとして実行"| VI["VI. Processes"]
    VI -->|"プロセスがポートをバインド"| VII["VII. Port Binding"]
    VI -->|"プロセスモデルでスケーリング"| VIII["VIII. Concurrency"]
    VIII -->|"スケーリングには廃棄容易性が必須"| IX["IX. Disposability"]
    VI -->|"ステートレスだから廃棄容易"| IX
    V -->|"ビルド・リリースの同一性"| X["X. Dev/Prod Parity"]
    VI -->|"ログは stdout へ"| XI["XI. Logs"]
    I -->|"管理スクリプトも同じコードベース"| XII["XII. Admin Processes"]
    VI -->|"管理プロセスも同じ環境で"| XII

    style I fill:#e3f2fd,stroke:#1565c0
    style II fill:#e3f2fd,stroke:#1565c0
    style III fill:#fff3e0,stroke:#e65100
    style IV fill:#fff3e0,stroke:#e65100
    style V fill:#e8f5e9,stroke:#2e7d32
    style VI fill:#e8f5e9,stroke:#2e7d32
    style VII fill:#fce4ec,stroke:#c62828
    style VIII fill:#fce4ec,stroke:#c62828
    style IX fill:#f3e5f5,stroke:#6a1b9a
    style X fill:#f3e5f5,stroke:#6a1b9a
    style XI fill:#fff9c4,stroke:#f9a825
    style XII fill:#fff9c4,stroke:#f9a825
```

たとえば、設定を環境変数で管理する（III. Config）ことは、バックエンドサービスをアタッチされたリソースとして扱う（IV. Backing Services）ための前提条件であり、同時に開発・本番一致（X. Dev/Prod Parity）を容易にする。プロセスをステートレスにする（VI. Processes）ことは、プロセスモデルによるスケーリング（VIII. Concurrency）と廃棄容易性（IX. Disposability）の前提条件である。

この相互関係は、Twelve-Factor App の原則を部分的にだけ適用しても効果が限定的であることを意味する。12の要素はシステムとして機能するのであり、全体を一貫して適用してこそ、その真価を発揮する。

## Beyond Twelve-Factor App — 12を超えて

Twelve-Factor App が公開されてから10年以上が経過し、クラウドネイティブの技術スタックは大きく進化した。2017年に Kevin Hoffman が著した『Beyond the Twelve-Factor App』は、オリジナルの12要素を現代的な視点で再解釈し、さらに3つの要素を追加した。また、クラウドネイティブ・コミュニティでも、12要素では十分にカバーされていない領域が議論されてきた。

### XIII. API First — API ファースト

現代のマイクロサービス環境では、サービス間の通信プロトコルとAPI設計がシステム全体のアーキテクチャを決定する。API を最初にデザインし、その契約（Contract）をサービス間で共有することで、チーム間の独立した開発が可能になる。

```mermaid
graph LR
    subgraph "API First 開発フロー"
        Design["API 設計<br/>(OpenAPI/protobuf)"] --> Mock["モック生成"]
        Design --> Server["サーバー実装"]
        Design --> Client["クライアント実装"]
        Mock --> Test["契約テスト"]
        Server --> Test
        Client --> Test
    end

    style Design fill:#e3f2fd,stroke:#1565c0
    style Mock fill:#e8f5e9,stroke:#2e7d32
    style Server fill:#fff3e0,stroke:#e65100
    style Client fill:#fce4ec,stroke:#c62828
```

OpenAPI（Swagger）、Protocol Buffers（gRPC）、GraphQL スキーマなどの IDL（Interface Definition Language）を使用してAPIを先に定義し、そこからサーバースタブとクライアントライブラリを自動生成するアプローチが広く採用されている。

### XIV. Telemetry — テレメトリ

オリジナルの Twelve-Factor では、ログ（XI）のみがオブザーバビリティの要素として取り上げられていた。しかし、現代の分散システムでは、ログだけでは不十分である。オブザーバビリティの3本柱——**ログ**、**メトリクス**、**分散トレース**——を統合的に扱う必要がある。

```mermaid
graph TB
    subgraph "オブザーバビリティの3本柱"
        Logs["ログ<br/>(何が起きたか)"]
        Metrics["メトリクス<br/>(どのくらいの頻度・量か)"]
        Traces["トレース<br/>(リクエストの経路は)"]
    end

    OTel["OpenTelemetry"] --> Logs
    OTel --> Metrics
    OTel --> Traces

    Logs --> Loki["Loki / Elasticsearch"]
    Metrics --> Prom["Prometheus / Datadog"]
    Traces --> Jaeger["Jaeger / Tempo"]

    style OTel fill:#e3f2fd,stroke:#1565c0
    style Logs fill:#e8f5e9,stroke:#2e7d32
    style Metrics fill:#fff3e0,stroke:#e65100
    style Traces fill:#fce4ec,stroke:#c62828
```

OpenTelemetry は、この3つのシグナルを統一的な SDK とプロトコルで扱うためのオープンスタンダードであり、CNCF のプロジェクトとして急速に普及している。

### XV. Security — セキュリティ

オリジナルの Twelve-Factor では、セキュリティに関する明示的な要素が存在しなかった。現代のクラウドネイティブアプリケーションでは、セキュリティを事後的に適用するのではなく、開発の初期段階から組み込む（Shift Left Security / DevSecOps）必要がある。

具体的には以下の実践が含まれる。

- **依存関係のセキュリティスキャン**: Dependabot、Snyk、Trivy などによる脆弱性の自動検出
- **コンテナイメージのスキャン**: ベースイメージの脆弱性チェック、最小権限の原則に基づくイメージ構築
- **シークレット管理**: ハードコードされた機密情報の検出（git-secrets、gitleaks）と外部シークレットストアの活用
- **ネットワークポリシー**: ゼロトラストに基づくサービス間通信の制御（mTLS、Network Policy）
- **RBAC**: 最小権限の原則に基づくアクセス制御

### その他の議論されている要素

Beyond Twelve-Factor の範囲を超えて、以下のような要素も議論されている。

**Idempotency（冪等性）**: 分散システムにおけるリトライやメッセージの重複配信を安全に扱うために、処理の冪等性を設計原則として組み込む。

**Configuration as Code（設定のコード化）**: Twelve-Factor の III. Config は環境変数を推奨したが、Kubernetes マニフェスト、Terraform、Pulumi などの Infrastructure as Code ツールにより、インフラ設定自体もコードとしてバージョン管理する時代になった。

**Feature Flags（フィーチャーフラグ）**: コードのデプロイとリリース（機能の公開）を分離し、段階的なロールアウトや A/B テストを可能にする。

## 実践チェックリスト

以下は、既存のアプリケーションを Twelve-Factor App の原則に照らして評価するためのチェックリストである。

### コードベースと依存関係

- [ ] 一つのアプリケーションに一つのリポジトリ（またはモノレポ内で独立したビルド単位）が対応しているか
- [ ] すべての依存関係が `package.json`、`go.mod`、`requirements.txt` 等で明示的に宣言されているか
- [ ] ロックファイル（`package-lock.json`、`go.sum`、`Pipfile.lock` 等）がバージョン管理されているか
- [ ] システムに暗黙的にインストールされたツールやライブラリに依存していないか

### 設定と外部サービス

- [ ] データベースの接続情報、API キー、外部サービスの URL が環境変数（または Kubernetes Secret/ConfigMap）で管理されているか
- [ ] コードやリポジトリにパスワード、トークン、秘密鍵が含まれていないか
- [ ] ローカルの PostgreSQL と RDS を設定変更だけで切り替えられるか
- [ ] バックエンドサービスの接続先が変更された場合、コードの変更なしに対応できるか

### ビルドとデプロイ

- [ ] ビルド成果物（コンテナイメージ、JAR ファイル等）が環境固有の設定を含まず、不変（immutable）であるか
- [ ] 各リリースに一意の識別子（Git ハッシュ、セマンティックバージョン）が付与されているか
- [ ] 本番環境で直接コードを編集していないか
- [ ] ロールバックが過去のリリースの再デプロイで実現できるか

### プロセスとスケーリング

- [ ] プロセスがステートレスであり、ローカルファイルシステムやインメモリに永続データを保存していないか
- [ ] セッション情報が外部データストア（Redis 等）に保存されているか
- [ ] アプリケーションが自身でポートをバインドしてHTTPリクエストを処理するか
- [ ] ワークロードの種類ごとにプロセスタイプを分離し、独立してスケーリングできるか

### 運用特性

- [ ] プロセスが SIGTERM を適切にハンドリングし、グレースフルシャットダウンを行うか
- [ ] 起動時間が十分に短い（数秒以内）か
- [ ] 開発環境と本番環境で同じバックエンドサービス（同じ種類のデータベース、キャッシュ等）を使用しているか
- [ ] ログが stdout/stderr に出力され、ファイルに直接書き込んでいないか
- [ ] ログが構造化形式（JSON 等）で出力されているか

### 管理タスク

- [ ] データベースマイグレーションがアプリケーションと同じコードベース、同じイメージから実行されるか
- [ ] 定期タスクが Kubernetes CronJob や同等の仕組みで宣言的に管理されているか
- [ ] ワンオフの管理スクリプトが本番環境と同一の依存関係・設定で実行されるか

## Twelve-Factor App の限界と批判

Twelve-Factor App は広く受け入れられている設計原則であるが、いくつかの限界と批判も存在する。健全な技術的議論のために、これらも理解しておく必要がある。

### 環境変数への過度な依存

III. Config で推奨される環境変数による設定管理は、設定項目が数十〜数百に及ぶ大規模アプリケーションでは管理が困難になる。また、環境変数は構造化されたデータ（ネストされたオブジェクトやリスト）の表現に適しておらず、型の検証もできない。このため、実際には環境変数をベースとしつつも、設定ファイル（YAML、TOML）や設定管理ツール（Consul、Spring Cloud Config）を併用するケースが多い。

### ステートフルワークロードへの適用困難

VI. Processes で要求されるステートレス性は、データベース、メッセージブローカー、機械学習の推論サーバーなど、本質的にステートフルなワークロードには直接適用できない。Kubernetes の StatefulSet はこの課題への一つの解答であるが、Twelve-Factor App の原則自体は、主にステートレスな Web アプリケーション層を前提としている。

### マイクロサービス固有の課題

Twelve-Factor App は個々のサービスの設計原則であり、サービス間の結合、分散トランザクション、サービスメッシュ、API ゲートウェイといったマイクロサービスアーキテクチャ固有の課題には直接的な指針を提供しない。

### モノリスへの適用

Twelve-Factor App は PaaS 環境を前提として誕生したが、その原則の多くはモノリシックアプリケーションにも適用可能であり、適用すべきである。設定の外部化、依存関係の明示、ログのストリーム化——これらは、モノリスであっても運用性を大幅に向上させる。「マイクロサービスだから Twelve-Factor」「モノリスだから不要」という二項対立は誤りである。

## まとめ

Twelve-Factor App は、2012年に Heroku の経験から生まれた設計原則であるが、その本質は特定の技術やプラットフォームに依存しない、普遍的なソフトウェア設計の知恵である。

12の要素を一言で要約すると、**「アプリケーションとその実行環境の間に明確な契約を定め、環境依存を排除することで、移植性・スケーラビリティ・運用容易性を実現する」**ということになる。

Docker、Kubernetes、CI/CD パイプラインといった現代のクラウドネイティブ技術スタックは、Twelve-Factor App の原則を技術的に実現・強制するためのインフラであるとも言える。逆に言えば、Twelve-Factor App の原則を理解せずにこれらの技術を使おうとしても、その恩恵を十分に享受することはできない。

Twelve-Factor App は出発点であり、終着点ではない。Beyond Twelve-Factor で議論された API First、テレメトリ、セキュリティといった追加要素は、クラウドネイティブ時代の要請に応えるものである。技術は進化し続けるが、「関心の分離」「明示的な契約」「不変性」「宣言的な管理」といった根底にある設計哲学は、今後も長く通用する原則であり続けるだろう。
