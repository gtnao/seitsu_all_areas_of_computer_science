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
          text: "型システム",
          items: [
            { text: "型システム入門 — 静的型付けと動的型付け", link: "/type-systems" },
            { text: "型推論（Hindley-Milner）", link: "/type-inference" },
            { text: "ジェネリクスとパラメトリック多相", link: "/generics" },
            { text: "代数的データ型とパターンマッチ", link: "/algebraic-data-types" },
            { text: "依存型", link: "/dependent-types" },
          ],
        },
        {
          text: "メモリ管理と所有権",
          items: [
            { text: "ガベージコレクション（Mark-Sweep, 世代別GC, ZGC）", link: "/garbage-collection" },
            { text: "参照カウント（ARC, Pythonの参照カウント+GC）", link: "/reference-counting" },
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
            { text: "メタプログラミングとマクロ", link: "/metaprogramming" },
          ],
        },
        {
          text: "コンパイラとランタイム",
          items: [
            { text: "字句解析と構文解析", link: "/lexing-parsing" },
            { text: "中間表現とSSA形式", link: "/intermediate-representation" },
            { text: "JITコンパイル（V8, HotSpot, LuaJIT）", link: "/jit-compilation" },
            { text: "LLVM アーキテクチャ", link: "/llvm" },
            { text: "WebAssembly", link: "/webassembly" },
          ],
        },
        {
          text: "理論的基盤（プログラミング言語）",
          items: [
            { text: "ラムダ計算", link: "/lambda-calculus" },
            { text: "形式的意味論（操作的意味論, 表示的意味論）", link: "/formal-semantics" },
          ],
        },
        {
          text: "同期プリミティブ",
          items: [
            { text: "Mutex, セマフォ, 条件変数", link: "/sync-primitives" },
            { text: "Read-Writeロック", link: "/rw-lock" },
            { text: "Futex — ユーザー空間の高速同期", link: "/futex" },
            { text: "スピンロックとバックオフ", link: "/spinlock" },
          ],
        },
        {
          text: "ロックフリーと並行データ構造",
          items: [
            { text: "CASとアトミック操作", link: "/cas-atomics" },
            { text: "ロックフリーデータ構造（キュー, スタック, リスト）", link: "/lock-free-data-structures" },
            { text: "メモリオーダリングとメモリモデル", link: "/memory-ordering" },
            { text: "Hazard Pointer と EBR", link: "/hazard-pointer-ebr" },
          ],
        },
        {
          text: "並行プログラミングモデル",
          items: [
            { text: "アクターモデル（Erlang/OTP, Akka）", link: "/actor-model" },
            { text: "CSP とGoのgoroutine", link: "/csp" },
            { text: "データ並列処理（SIMD, GPU, MapReduce）", link: "/data-parallelism" },
            { text: "Fork-Join モデルとワークスティーリング", link: "/fork-join" },
          ],
        },
        {
          text: "並行処理の課題",
          items: [
            { text: "デッドロック, ライブロック, 優先度逆転", link: "/concurrency-hazards" },
            { text: "データ競合と ThreadSanitizer", link: "/data-race" },
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
