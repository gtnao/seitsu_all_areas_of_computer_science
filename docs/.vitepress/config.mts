import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    lang: "ja",
    title: "Seitsu",
    description: "コンピュータサイエンスのすべての分野に精通していること",
    base: "/seitsu_all_areas_of_computer_science/",

    lastUpdated: true,

    markdown: {
      math: true,
    },

    themeConfig: {
      search: {
        provider: "local",
      },

      lastUpdated: {
        text: "最終更新日",
      },

      sidebar: [
        {
          text: "暗号技術の基礎",
          items: [
            { text: "共通鍵暗号（AES）", link: "/aes" },
            { text: "公開鍵暗号（RSA）", link: "/rsa" },
            { text: "楕円曲線暗号（ECC）", link: "/elliptic-curve-cryptography" },
            { text: "暗号学的ハッシュ関数（SHA-2/SHA-3）", link: "/hash-functions" },
            { text: "HMAC", link: "/hmac" },
            { text: "鍵導出関数（PBKDF2, bcrypt, Argon2）", link: "/key-derivation-functions" },
            { text: "Diffie-Hellman鍵交換", link: "/diffie-hellman" },
            { text: "ポスト量子暗号", link: "/post-quantum-cryptography" },
          ],
        },
        {
          text: "プロトコル・通信セキュリティ",
          items: [
            { text: "TLS 1.3ハンドシェイク", link: "/tls-1-3" },
            { text: "PKIと証明書", link: "/pki-certificates" },
            { text: "OAuth 2.0", link: "/oauth2" },
            { text: "OpenID Connect（OIDC）", link: "/openid-connect" },
            { text: "SAML", link: "/saml" },
            { text: "Kerberos", link: "/kerberos" },
            { text: "DNSSEC", link: "/dnssec" },
            { text: "JWT（JSON Web Token）", link: "/jwt" },
            { text: "パスキー（Passkeys）", link: "/passkeys" },
          ],
        },
        {
          text: "Webセキュリティ",
          items: [
            { text: "XSS（クロスサイトスクリプティング）", link: "/xss" },
            { text: "CSRF（クロスサイトリクエストフォージェリ）", link: "/csrf" },
            { text: "SQLインジェクション", link: "/sql-injection" },
            { text: "Content Security Policy（CSP）", link: "/content-security-policy" },
            { text: "CORS", link: "/cors" },
          ],
        },
        {
          text: "システム・インフラセキュリティ",
          items: [
            { text: "ゼロトラストアーキテクチャ", link: "/zero-trust-architecture" },
            { text: "サンドボックス", link: "/sandbox" },
            { text: "強制アクセス制御（SELinux/AppArmor）", link: "/mandatory-access-control" },
            { text: "コンテナセキュリティ", link: "/container-security" },
          ],
        },
        {
          text: "攻撃手法と防御",
          items: [
            { text: "バッファオーバーフロー", link: "/buffer-overflow" },
            { text: "サイドチャネル攻撃（Spectre/Meltdown）", link: "/side-channel-attacks" },
            { text: "サプライチェーン攻撃", link: "/supply-chain-attacks" },
            { text: "中間者攻撃（MITM）", link: "/mitm-attacks" },
          ],
        },
        {
          text: "応用・先端トピック",
          items: [
            { text: "秘密計算（準同型暗号・MPC）", link: "/secure-computation" },
            { text: "ブロックチェーンのセキュリティ", link: "/blockchain-security" },
          ],
        },
        {
          text: "インターネットプロトコル基盤",
          items: [
            { text: "TCP — 信頼性のある通信の仕組み", link: "/tcp" },
            { text: "TCP輻輳制御（Reno, CUBIC, BBR）", link: "/tcp-congestion-control" },
            { text: "UDP とリアルタイム通信", link: "/udp" },
            { text: "IPとルーティング（BGP, OSPF）", link: "/ip-routing" },
            { text: "DNS — 名前解決の仕組み", link: "/dns" },
            { text: "NAT とポートフォワーディング", link: "/nat" },
          ],
        },
        {
          text: "アプリケーション層プロトコル",
          items: [
            { text: "HTTP/1.1 から HTTP/2 への進化", link: "/http-evolution" },
            { text: "HTTP/3 と QUIC", link: "/http3-quic" },
            { text: "WebSocket", link: "/websocket" },
            { text: "gRPC と Protocol Buffers", link: "/grpc" },
            { text: "GraphQL", link: "/graphql" },
          ],
        },
        {
          text: "ネットワーク設計とインフラ",
          items: [
            { text: "CDN（Content Delivery Network）", link: "/cdn" },
            { text: "ロードバランシング（L4/L7）", link: "/load-balancing" },
            { text: "リバースプロキシ（Nginx, Envoy）", link: "/reverse-proxy" },
            { text: "サービスメッシュ（Istio, Linkerd）", link: "/service-mesh" },
          ],
        },
        {
          text: "低レイヤーネットワーク",
          items: [
            { text: "Ethernet と ARP", link: "/ethernet-arp" },
            { text: "VLAN と ネットワークセグメンテーション", link: "/vlan" },
            { text: "SDN（Software-Defined Networking）", link: "/sdn" },
          ],
        },
        {
          text: "ストレージエンジン",
          items: [
            { text: "B-Treeインデックス", link: "/b-tree" },
            { text: "LSM-Tree と Write-Optimized ストレージ", link: "/lsm-tree" },
          ],
        },
        {
          text: "トランザクションと同時実行制御",
          items: [
            { text: "MVCC（Multi-Version Concurrency Control）", link: "/mvcc" },
          ],
        },
        {
          text: "コンセンサスアルゴリズム",
          items: [
            { text: "Paxos", link: "/paxos" },
          ],
        },
        {
          text: "分散メッセージングとストリーミング",
          items: [
            { text: "メッセージキュー（Kafka, RabbitMQ, Pulsar）", link: "/message-queue" },
          ],
        },
        {
          text: "型システム",
          items: [
            { text: "型システム入門 — 静的型付けと動的型付け", link: "/type-systems" },
            { text: "依存型", link: "/dependent-types" },
          ],
        },
        {
          text: "設計とアーキテクチャ",
          items: [
            { text: "クリーンアーキテクチャ", link: "/clean-architecture" },
            { text: "ドメイン駆動設計（DDD）", link: "/ddd" },
            { text: "デザインパターン（GoF）", link: "/design-patterns" },
            { text: "SOLID原則", link: "/solid-principles" },
            { text: "イベント駆動アーキテクチャ", link: "/event-driven-architecture" },
            { text: "マイクロサービスアーキテクチャ", link: "/microservices" },
          ],
        },
        {
          text: "テストと品質",
          items: [
            { text: "テスト戦略（ユニット, インテグレーション, E2E）", link: "/testing-strategy" },
            { text: "プロパティベーステスト", link: "/property-based-testing" },
            { text: "形式手法と TLA+", link: "/formal-methods-tla" },
          ],
        },
        {
          text: "デプロイと運用",
          items: [
            { text: "SRE と SLI/SLO/SLA", link: "/sre" },
            { text: "フィーチャーフラグとカナリアリリース", link: "/feature-flags" },
          ],
        },
        {
          text: "API設計",
          items: [
            { text: "API バージョニング戦略", link: "/api-versioning" },
          ],
        },
        {
          text: "メモリ階層",
          items: [
            { text: "NUMAアーキテクチャ", link: "/numa" },
          ],
        },
        {
          text: "コンテナオーケストレーション",
          items: [
            { text: "Kubernetes スケジューリング", link: "/kubernetes-scheduling" },
          ],
        },
        {
          text: "クラウドインフラサービス",
          items: [
            { text: "IaaSコンピュートの設計（EC2, GCE）", link: "/iaas-compute" },
            { text: "マネージドコンテナサービス（ECS, Cloud Run, Fargate）", link: "/managed-containers" },
            { text: "マネージドデータベースサービス（RDS, Cloud SQL, Aurora）", link: "/managed-database" },
            { text: "オブジェクトストレージの設計（S3）", link: "/object-storage-design" },
            { text: "マネージドメッセージング（SQS, SNS, EventBridge, Pub/Sub）", link: "/managed-messaging" },
            { text: "クラウドネットワーク設計（VPC, サブネット, Security Group, PrivateLink）", link: "/cloud-networking" },
            { text: "エッジコンピューティング（CloudFront Functions, Cloudflare Workers）", link: "/edge-computing" },
            { text: "クラウドIAMの設計原則（ポリシー, ロール, 最小権限）", link: "/cloud-iam" },
            { text: "マルチアカウント戦略（AWS Organizations, Landing Zone）", link: "/multi-account" },
          ],
        },
        {
          text: "データエンジニアリング",
          items: [
            { text: "dbt — データ変換のソフトウェアエンジニアリング化", link: "/dbt" },
          ],
        },
        {
          text: "バージョン管理",
          items: [
            { text: "Gitの内部構造（オブジェクトモデル, Packfile, Reflog）", link: "/git-internals" },
            { text: "マージ戦略（3-way merge, rebase, squash）", link: "/merge-strategies" },
            { text: "モノレポ管理（Nx, Turborepo, Bazel）", link: "/monorepo" },
          ],
        },
        {
          text: "ビルドとパッケージ",
          items: [
            { text: "ビルドシステムの設計（Make, Bazel, Gradle）", link: "/build-systems" },
            { text: "パッケージマネージャの仕組み（依存解決, ロックファイル, レジストリ）", link: "/package-manager" },
            { text: "コンテナイメージのビルド最適化（マルチステージ, レイヤーキャッシュ）", link: "/container-image-build" },
          ],
        },
        {
          text: "コード品質",
          items: [
            { text: "Linter / Formatter の設計思想（AST変換, ルールエンジン）", link: "/linter-formatter" },
            { text: "静的解析と型チェッカーの仕組み", link: "/static-analysis" },
          ],
        },
      ],

      outline: {
        label: "目次",
      },

      docFooter: {
        prev: "前のページ",
        next: "次のページ",
      },

      darkModeSwitchLabel: "テーマ",
      returnToTopLabel: "ページ上部へ",
      sidebarMenuLabel: "メニュー",
    },
  }),
);
