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
          text: "セキュリティの実装と運用",
          items: [
            { text: "Webアプリケーションの認証実装パターン", link: "/web-auth-implementation" },
            { text: "APIセキュリティの実践", link: "/api-security" },
            { text: "Let's Encrypt と ACMEプロトコル", link: "/lets-encrypt-acme" },
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
          text: "高レイヤーネットワーク",
          items: [
            { text: "SSH の仕組みと応用", link: "/ssh" },
          ],
        },
        {
          text: "ストレージエンジン",
          items: [
            { text: "B-Treeインデックス", link: "/b-tree" },
            { text: "LSM-Tree と Write-Optimized ストレージ", link: "/lsm-tree" },
            { text: "Write-Ahead Logging（WAL）", link: "/wal" },
            { text: "バッファプール", link: "/buffer-pool" },
            { text: "カラムナストア（列指向DB）", link: "/columnar-store" },
          ],
        },
        {
          text: "トランザクションと同時実行制御",
          items: [
            { text: "ACID特性とトランザクション", link: "/acid-transactions" },
            { text: "MVCC（Multi-Version Concurrency Control）", link: "/mvcc" },
            { text: "トランザクション分離レベル", link: "/isolation-levels" },
          ],
        },
        {
          text: "クエリ処理",
          items: [
            { text: "クエリオプティマイザ", link: "/query-optimizer" },
            { text: "インデックス設計戦略", link: "/index-design" },
          ],
        },
        {
          text: "レプリケーションと可用性",
          items: [
            { text: "レプリケーション（同期/非同期/半同期）", link: "/replication" },
            { text: "シャーディングとパーティショニング", link: "/sharding" },
          ],
        },
        {
          text: "NoSQLとNewSQL",
          items: [
            { text: "キーバリューストア（Redis, DynamoDB）", link: "/key-value-store" },
          ],
        },
        {
          text: "ミドルウェア内部",
          items: [
            { text: "Redis の内部設計", link: "/redis-internals" },
            { text: "Nginx のアーキテクチャ", link: "/nginx-architecture" },
          ],
        },
        {
          text: "データベースの運用と最適化",
          items: [
            { text: "PostgreSQL の実践的機能", link: "/postgresql-practical" },
            { text: "スロークエリ分析と最適化の実践", link: "/slow-query-optimization" },
            { text: "データベースのバックアップとリカバリ戦略", link: "/database-backup-recovery" },
            { text: "Read Replica のルーティング設計", link: "/read-replica-routing" },
            { text: "楽観的ロック vs 悲観的ロック", link: "/optimistic-pessimistic-locking" },
            { text: "マルチテナントデータベース設計", link: "/multi-tenant-db" },
            { text: "全文検索の実装戦略", link: "/full-text-search-implementation" },
          ],
        },
        {
          text: "分散システムの理論的基盤",
          items: [
            { text: "CAP定理とPACELC", link: "/cap-theorem" },
            { text: "FLP不可能性定理", link: "/flp-impossibility" },
            { text: "一貫性モデル（Linearizability, Sequential, Causal, Eventual）", link: "/consistency-models" },
            { text: "論理時計（Lamport Clock, Vector Clock）", link: "/logical-clocks" },
            { text: "分散システムにおける時刻と順序", link: "/distributed-time" },
          ],
        },
        {
          text: "コンセンサスアルゴリズム",
          items: [
            { text: "Paxos", link: "/paxos" },
            { text: "Raftコンセンサス", link: "/raft-consensus" },
          ],
        },
        {
          text: "分散データ管理",
          items: [
            { text: "分散トランザクション（2PC, 3PC, Saga）", link: "/distributed-transactions" },
            { text: "結果整合性とCRDTs", link: "/eventual-consistency-crdt" },
            { text: "Consistent Hashing", link: "/consistent-hashing" },
            { text: "Gossipプロトコル", link: "/gossip-protocol" },
          ],
        },
        {
          text: "分散メッセージングとストリーミング",
          items: [
            { text: "メッセージキュー（Kafka, RabbitMQ, Pulsar）", link: "/message-queue" },
            { text: "イベントソーシングとCQRS", link: "/event-sourcing-cqrs" },
            { text: "Kafka の内部設計", link: "/kafka-internals" },
          ],
        },
        {
          text: "分散システムの実践",
          items: [
            { text: "分散システムにおける障害モデル", link: "/failure-models" },
            { text: "サーキットブレーカーとリトライ戦略", link: "/circuit-breaker" },
            { text: "分散ロック", link: "/distributed-lock" },
            { text: "分散ID生成", link: "/distributed-id-generation" },
            { text: "Outbox パターン", link: "/outbox-pattern" },
          ],
        },
        {
          text: "型システム",
          items: [
            { text: "型システム入門 — 静的型付けと動的型付け", link: "/type-systems" },
            { text: "ジェネリクスとパラメトリック多相", link: "/generics" },
            { text: "依存型", link: "/dependent-types" },
          ],
        },
        {
          text: "メモリ管理と所有権",
          items: [
            { text: "ガベージコレクション（Mark-Sweep, 世代別GC, ZGC）", link: "/garbage-collection" },
            { text: "所有権と借用（Rustの所有権モデル）", link: "/ownership-borrowing" },
            { text: "リージョンベースメモリ管理", link: "/region-based-memory" },
          ],
        },
        {
          text: "言語の実行モデル",
          items: [
            { text: "クロージャとファーストクラス関数", link: "/closures" },
            { text: "コルーチンとasync/await", link: "/coroutines-async-await" },
            { text: "継続（Continuation）と call/cc", link: "/continuations" },
          ],
        },
        {
          text: "言語ランタイムの内部",
          items: [
            { text: "Go のランタイム内部", link: "/go-runtime-internals" },
            { text: "JVM の内部構造", link: "/jvm-internals" },
            { text: "CPython の内部", link: "/cpython-internals" },
          ],
        },
        {
          text: "同期プリミティブ",
          items: [
            { text: "Mutex, セマフォ, 条件変数", link: "/sync-primitives" },
            { text: "Read-Writeロック", link: "/rw-lock" },
            { text: "Futex — ユーザー空間の高速同期", link: "/futex" },
            { text: "スピンロックとバックオフ", link: "/spinlock" },
            { text: "メモリオーダリングとメモリモデル", link: "/memory-ordering" },
          ],
        },
        {
          text: "ロックフリーと並行データ構造",
          items: [
            { text: "ロックフリーデータ構造（キュー, スタック, リスト）", link: "/lock-free-data-structures" },
          ],
        },
        {
          text: "並行プログラミングモデル",
          items: [
            { text: "アクターモデル（Erlang/OTP, Akka）", link: "/actor-model" },
            { text: "Fork-Joinモデルとワークスティーリング", link: "/fork-join" },
          ],
        },
        {
          text: "並行処理の課題",
          items: [
            { text: "デッドロック, ライブロック, 優先度逆転", link: "/concurrency-hazards" },
            { text: "データ競合と ThreadSanitizer", link: "/data-race" },
          ],
        },
        {
          text: "プログラミング言語の理論的基盤",
          items: [
            { text: "ラムダ計算", link: "/lambda-calculus" },
            { text: "形式的意味論（操作的意味論, 表示的意味論）", link: "/formal-semantics" },
          ],
        },
        {
          text: "オートマトンと形式言語",
          items: [
            { text: "有限オートマトンと正規言語", link: "/finite-automata" },
          ],
        },
        {
          text: "計算量理論",
          items: [
            { text: "P, NP, NP完全", link: "/p-np" },
            { text: "NP困難問題と代表例（TSP, SAT, Graph Coloring）", link: "/np-hard-problems" },
          ],
        },
        {
          text: "決定不能性と限界",
          items: [
            { text: "ゲーデルの不完全性定理", link: "/godel-incompleteness" },
          ],
        },
        {
          text: "情報理論",
          items: [
            { text: "エントロピーと情報量（Shannon）", link: "/information-entropy" },
            { text: "誤り訂正符号（Hamming, Reed-Solomon, LDPC）", link: "/error-correcting-codes" },
          ],
        },
        {
          text: "基本データ構造",
          items: [
            { text: "ハッシュテーブル — 衝突解決とリサイズ戦略", link: "/hash-table" },
            { text: "B-Tree / B+Tree — ディスク指向のデータ構造", link: "/b-tree-data-structure" },
            { text: "赤黒木とAVL木 — 平衡二分探索木", link: "/balanced-bst" },
            { text: "Bloom Filter と確率的データ構造", link: "/bloom-filter" },
          ],
        },
        {
          text: "ソートと探索",
          items: [
            { text: "比較ソートの理論と実践（QuickSort, MergeSort, TimSort）", link: "/sorting" },
            { text: "非比較ソート（Radix Sort, Counting Sort）", link: "/non-comparison-sort" },
          ],
        },
        {
          text: "グラフアルゴリズム",
          items: [
            { text: "グラフ探索（BFS, DFS）と応用", link: "/graph-traversal" },
            { text: "最短経路（Dijkstra, Bellman-Ford, A*）", link: "/shortest-path" },
          ],
        },
        {
          text: "アルゴリズム設計手法",
          items: [
            { text: "動的計画法", link: "/dynamic-programming" },
            { text: "分割統治法", link: "/divide-and-conquer" },
          ],
        },
        {
          text: "数値計算と確率的データ構造",
          items: [
            { text: "浮動小数点数の落とし穴", link: "/floating-point" },
            { text: "HyperLogLog — 基数推定の仕組み", link: "/hyperloglog" },
            { text: "Count-Min Sketch と頻度推定", link: "/count-min-sketch" },
            { text: "空間インデックスの設計", link: "/spatial-index" },
          ],
        },
        {
          text: "設計とアーキテクチャ",
          items: [
            { text: "Twelve-Factor App の設計原則", link: "/twelve-factor-app" },
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
            { text: "ファジング", link: "/fuzzing" },
            { text: "負荷テストの設計と実施", link: "/load-testing" },
          ],
        },
        {
          text: "デプロイと運用",
          items: [
            { text: "CI/CDパイプライン", link: "/ci-cd" },
            { text: "SRE と SLI/SLO/SLA", link: "/sre" },
            { text: "フィーチャーフラグとカナリアリリース", link: "/feature-flags" },
            { text: "カオスエンジニアリング", link: "/chaos-engineering" },
            { text: "構造化ログ設計", link: "/structured-logging" },
            { text: "ゼロダウンタイムデプロイメント", link: "/zero-downtime-deployment" },
            { text: "秘密情報管理", link: "/secret-management" },
            { text: "インシデント管理とポストモーテム", link: "/incident-management" },
            { text: "オンコール設計とアラート戦略", link: "/oncall-alerting" },
            { text: "メトリクス設計", link: "/metrics-design" },
            { text: "トランクベース開発", link: "/trunk-based-development" },
          ],
        },
        {
          text: "API設計",
          items: [
            { text: "REST API設計原則", link: "/rest-api-design" },
            { text: "API バージョニング戦略", link: "/api-versioning" },
            { text: "冪等性の設計", link: "/idempotency" },
            { text: "スキーマエボリューション", link: "/schema-evolution" },
          ],
        },
        {
          text: "リクエスト処理モデル",
          items: [
            { text: "ミドルウェアパイプライン設計", link: "/middleware-pipeline" },
            { text: "グレースフルシャットダウンとヘルスチェック", link: "/graceful-shutdown" },
            { text: "タイムアウトとデッドライン伝播", link: "/timeout-deadline-propagation" },
            { text: "バックプレッシャー制御", link: "/backpressure" },
            { text: "イベントループの内部設計", link: "/event-loop-internals" },
          ],
        },
        {
          text: "API実装パターン",
          items: [
            { text: "Rate Limiting の設計と実装", link: "/rate-limiting" },
            { text: "ページネーション設計", link: "/pagination-design" },
            { text: "Webhook の設計と信頼性", link: "/webhook-design" },
            { text: "バルク処理・バッチAPI設計", link: "/bulk-api-design" },
            { text: "APIエラーレスポンス設計", link: "/api-error-response" },
            { text: "APIゲートウェイパターン", link: "/api-gateway" },
            { text: "OpenAPI とスキーマ駆動開発", link: "/openapi-schema-driven" },
            { text: "非同期リクエスト処理", link: "/async-request-processing" },
            { text: "BFF（Backend for Frontend）", link: "/bff" },
          ],
        },
        {
          text: "キャッシュ戦略",
          items: [
            { text: "キャッシュパターン（Cache-Aside, Write-Through, Write-Behind）", link: "/caching-patterns" },
            { text: "キャッシュとDBの一貫性問題", link: "/cache-db-consistency" },
          ],
        },
        {
          text: "ORMとデータアクセス",
          items: [
            { text: "ORMの仕組みと限界（Active Record, Data Mapper, N+1問題）", link: "/orm" },
            { text: "マイグレーション戦略（ゼロダウンタイムスキーマ変更）", link: "/schema-migration" },
          ],
        },
        {
          text: "認証・認可の実装",
          items: [
            { text: "RBAC, ABAC, ReBAC — アクセス制御モデル", link: "/access-control-models" },
          ],
        },
        {
          text: "システム設計パターン",
          items: [
            { text: "ファイルアップロード設計", link: "/file-upload-design" },
            { text: "通知システムの設計", link: "/notification-system" },
            { text: "メール配信の仕組み", link: "/email-delivery" },
            { text: "決済システムの設計", link: "/payment-system-design" },
            { text: "タイムライン・フィード設計", link: "/timeline-feed-design" },
            { text: "URL短縮サービスの設計", link: "/url-shortener-design" },
            { text: "リーダーボード設計", link: "/leaderboard-design" },
            { text: "ファイル変換パイプライン設計", link: "/file-conversion-pipeline" },
          ],
        },
        {
          text: "ストレージデバイス",
          items: [
            { text: "SSD内部（FTL, ウェアレベリング, TRIM）", link: "/ssd-internals" },
          ],
        },
        {
          text: "I/Oスタックとキャッシュ",
          items: [
            { text: "Linux I/O スタック", link: "/linux-io-stack" },
          ],
        },
        {
          text: "分散ストレージ",
          items: [
            { text: "分散ファイルシステム（HDFS, Ceph, GlusterFS）", link: "/distributed-filesystem" },
          ],
        },
        {
          text: "I/Oとネットワークスタック",
          items: [
            { text: "I/O多重化（epoll, kqueue, io_uring）", link: "/io-multiplexing" },
          ],
        },
        {
          text: "カーネルと割り込み",
          items: [
            { text: "カーネルモジュールとデバイスドライバ", link: "/kernel-modules" },
            { text: "eBPF", link: "/ebpf" },
          ],
        },
        {
          text: "プロセスとスレッド",
          items: [
            { text: "プロセスの概念とライフサイクル", link: "/process" },
            { text: "スレッドとユーザースレッド（グリーンスレッド）", link: "/thread" },
            { text: "プロセススケジューリング（CFS, リアルタイム）", link: "/process-scheduling" },
            { text: "コンテキストスイッチ", link: "/context-switch" },
          ],
        },
        {
          text: "リソース制御",
          items: [
            { text: "Linux の cgroups v2 とリソース制御", link: "/cgroups" },
            { text: "OOM Killer の仕組みとメモリオーバーコミット", link: "/oom-killer" },
            { text: "ファイルディスクリプタの仕組みと上限設計", link: "/file-descriptors" },
          ],
        },
        {
          text: "メモリ管理",
          items: [
            { text: "仮想メモリとページング", link: "/virtual-memory" },
            { text: "TLB（Translation Lookaside Buffer）", link: "/tlb" },
            { text: "ページ置換アルゴリズム", link: "/page-replacement" },
          ],
        },
        {
          text: "ファイルシステム",
          items: [
            { text: "VFS（仮想ファイルシステム）", link: "/vfs" },
            { text: "コピーオンライトファイルシステム（ZFS, Btrfs）", link: "/cow-filesystem" },
            { text: "ジャーナリング", link: "/journaling" },
          ],
        },
        {
          text: "CPUパイプライン",
          items: [
            { text: "命令パイプラインとハザード", link: "/cpu-pipeline" },
          ],
        },
        {
          text: "メモリ階層",
          items: [
            { text: "CPUキャッシュ（L1/L2/L3、キャッシュコヒーレンス）", link: "/cpu-cache" },
            { text: "NUMAアーキテクチャ", link: "/numa" },
          ],
        },
        {
          text: "並列処理ハードウェア",
          items: [
            { text: "GPUアーキテクチャ（CUDA, 計算モデル）", link: "/gpu-architecture" },
            { text: "FPGA と再構成可能コンピューティング", link: "/fpga" },
          ],
        },
        {
          text: "ハードウェア仮想化",
          items: [
            { text: "ハイパーバイザ（Type 1/Type 2, KVM, Xen）", link: "/hypervisor" },
            { text: "ハードウェア支援仮想化（VT-x, AMD-V）", link: "/hardware-virtualization" },
          ],
        },
        {
          text: "コンテナ技術",
          items: [
            { text: "Linuxコンテナの基盤（Namespace, cgroups）", link: "/linux-containers" },
            { text: "コンテナランタイム（runc, crun, containerd, CRI-O）", link: "/container-runtime" },
          ],
        },
        {
          text: "コンテナオーケストレーション",
          items: [
            { text: "Kubernetesアーキテクチャ", link: "/kubernetes-architecture" },
            { text: "Kubernetes スケジューリング", link: "/kubernetes-scheduling" },
            { text: "Kubernetes Networking", link: "/kubernetes-networking" },
            { text: "コンテナリソース管理", link: "/container-resource-management" },
          ],
        },
        {
          text: "軽量仮想化",
          items: [
            { text: "マイクロVM（Firecracker, Cloud Hypervisor）", link: "/microvm" },
          ],
        },
        {
          text: "サーバーレスとFaaS",
          items: [
            { text: "サーバーレスアーキテクチャ（Lambda, Cloud Functions）", link: "/serverless" },
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
          text: "クラウドインフラ運用",
          items: [
            { text: "イミュータブルインフラストラクチャ", link: "/immutable-infrastructure" },
          ],
        },
        {
          text: "データエンジニアリング",
          items: [
            { text: "MapReduce — 大規模データ処理の設計思想", link: "/mapreduce" },
            { text: "ストリーム処理の基礎（ウィンドウ, ウォーターマーク, Exactly-Once）", link: "/stream-processing" },
            { text: "データパイプラインとDAG（Airflow, Dagster, Prefect）", link: "/workflow-orchestration" },
            { text: "dbt — データ変換のソフトウェアエンジニアリング化", link: "/dbt" },
          ],
        },
        {
          text: "データ統合とフォーマット",
          items: [
            { text: "CDC（Change Data Capture）の設計と実装", link: "/change-data-capture" },
            { text: "シリアライゼーション形式の設計思想", link: "/serialization-formats" },
            { text: "データ品質とデータ契約", link: "/data-quality-contracts" },
            { text: "Apache Arrow と列指向インメモリフォーマット", link: "/apache-arrow" },
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
        {
          text: "エディタ・IDE",
          items: [
            { text: "Language Server Protocol（LSP）の仕組み", link: "/language-server-protocol" },
            { text: "デバッガの仕組み", link: "/debugger-internals" },
            { text: "プロファイラの仕組み", link: "/profiler-internals" },
          ],
        },
        {
          text: "コンパイラとランタイム",
          items: [
            { text: "字句解析と構文解析", link: "/lexing-parsing" },
            { text: "WebAssembly", link: "/webassembly" },
          ],
        },
        {
          text: "構文解析",
          items: [
            { text: "文脈自由文法とパーサ（LL法, LR法, PEG）", link: "/parsing-techniques" },
            { text: "抽象構文木（AST）の設計と応用", link: "/abstract-syntax-tree" },
          ],
        },
        {
          text: "意味解析・型システム",
          items: [
            { text: "型推論と型検査のアルゴリズム", link: "/type-inference-and-checking" },
          ],
        },
        {
          text: "処理系の実例と設計思想",
          items: [
            { text: "LLVMアーキテクチャ", link: "/llvm-architecture" },
          ],
        },
        {
          text: "基礎理論",
          items: [
            { text: "勾配降下法と最適化（SGD, Adam, 学習率スケジューリング）", link: "/gradient-descent" },
            { text: "過学習と正則化（L1/L2, Dropout, Early Stopping）", link: "/regularization" },
            { text: "バイアス-バリアンストレードオフ", link: "/bias-variance" },
            { text: "損失関数の設計", link: "/loss-functions" },
          ],
        },
        {
          text: "ニューラルネットワークアーキテクチャ",
          items: [
            { text: "ニューラルネットワーク基礎（パーセプトロンから多層NNへ）", link: "/neural-network-basics" },
            { text: "CNN（畳み込みニューラルネットワーク）", link: "/cnn" },
            { text: "RNN, LSTM, GRU — 系列モデリング", link: "/rnn-lstm" },
            { text: "Transformer と Self-Attention", link: "/transformer" },
            { text: "GAN（敵対的生成ネットワーク）", link: "/gan" },
            { text: "拡散モデル（Diffusion Models）", link: "/diffusion-models" },
          ],
        },
        {
          text: "大規模言語モデル",
          items: [
            { text: "大規模言語モデル（LLM）のアーキテクチャと学習", link: "/llm-architecture" },
          ],
        },
        {
          text: "MLの最適化手法",
          items: [
            { text: "Attention の最適化", link: "/attention-optimization" },
          ],
        },
        {
          text: "MLシステム",
          items: [
            { text: "分散学習（データ並列, モデル並列, パイプライン並列）", link: "/distributed-training" },
            { text: "特徴量エンジニアリングと特徴量ストア", link: "/feature-engineering" },
          ],
        },
        {
          text: "MLエンジニアリング",
          items: [
            { text: "MLOps（実験管理, モデルサービング, A/Bテスト）", link: "/mlops" },
          ],
        },
        {
          text: "情報検索",
          items: [
            { text: "転置インデックス", link: "/inverted-index" },
            { text: "TF-IDF と BM25", link: "/tf-idf-bm25" },
            { text: "ベクトル検索と近似最近傍探索（HNSW, IVF）", link: "/vector-search" },
            { text: "PageRank とリンク解析", link: "/pagerank" },
            { text: "Embedding とセマンティック検索", link: "/semantic-search" },
            { text: "RAG（Retrieval-Augmented Generation）", link: "/rag" },
          ],
        },
        {
          text: "検索エンジンアーキテクチャ",
          items: [
            { text: "検索エンジンの全体像（クロール、インデックス、ランキング）", link: "/search-engine-architecture" },
          ],
        },
        {
          text: "ブラウザとレンダリング",
          items: [
            { text: "ブラウザレンダリングパイプライン（DOM, CSSOM, Layout, Paint, Composite）", link: "/browser-rendering" },
            { text: "V8エンジンの内部（Hidden Class, Inline Cache）", link: "/v8-internals" },
          ],
        },
        {
          text: "Web API とブラウザ機能",
          items: [
            { text: "WebRTC — ブラウザ間のリアルタイム通信", link: "/webrtc" },
            { text: "Web Storage, IndexedDB, Cache API", link: "/browser-storage" },
          ],
        },
        {
          text: "Webの基盤技術",
          items: [
            { text: "動画ストリーミング配信の仕組み", link: "/video-streaming" },
            { text: "Same-Origin Policy の全体像", link: "/same-origin-policy" },
            { text: "画像・ファイル配信の最適化", link: "/image-file-delivery" },
            { text: "Server-Sent Events（SSE）", link: "/server-sent-events" },
          ],
        },
        {
          text: "HTML/CSSの設計原理",
          items: [
            { text: "HTMLのセマンティクスとアクセシビリティ", link: "/html-semantics-a11y" },
            { text: "CSSレイアウトモデル（Box Model, Flexbox, Grid）", link: "/css-layout" },
            { text: "CSSのカスケードと詳細度", link: "/css-cascade" },
          ],
        },
        {
          text: "UIフレームワークの設計原理",
          items: [
            { text: "仮想DOMと差分アルゴリズム（React Fiber, Reconciliation）", link: "/virtual-dom" },
            { text: "リアクティビティシステム（Signals, Fine-Grained Reactivity）", link: "/reactivity" },
          ],
        },
        {
          text: "状態管理",
          items: [
            { text: "フロントエンドの状態管理パターン（Flux, Atomic, Proxy）", link: "/state-management" },
            { text: "サーバー状態管理（React Query, SWR — Stale-While-Revalidate）", link: "/server-state" },
          ],
        },
        {
          text: "レンダリング戦略",
          items: [
            { text: "SSR, SSG, ISR, Streaming SSR — レンダリング手法の比較", link: "/rendering-strategies" },
            { text: "Hydration とその課題（Partial Hydration, Resumability）", link: "/hydration" },
          ],
        },
        {
          text: "ビルドツールチェーン",
          items: [
            { text: "JavaScriptバンドラーの進化（webpack → Vite → Turbopack）", link: "/js-bundlers" },
            { text: "モジュールシステム（CommonJS, ESM, Import Maps）", link: "/module-systems" },
            { text: "Tree Shaking とデッドコード除去", link: "/tree-shaking" },
          ],
        },
        {
          text: "フロントエンドの実践",
          items: [
            { text: "Micro Frontends", link: "/micro-frontends" },
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
