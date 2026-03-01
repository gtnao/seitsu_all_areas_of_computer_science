import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    lang: "ja",
    title: "Seitsu",
    description: "コンピュータサイエンスのすべての分野に精通していること",
    base: "/seitsu_all_areas_of_computer_science/",

    markdown: {
      math: true,
    },

    themeConfig: {
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
