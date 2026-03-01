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
          text: "記事一覧",
          items: [
            { text: "共通鍵暗号（AES）", link: "/aes" },
            { text: "Diffie-Hellman鍵交換", link: "/diffie-hellman" },
            { text: "楕円曲線暗号（ECC）", link: "/elliptic-curve-cryptography" },
            { text: "暗号学的ハッシュ関数（SHA-2/SHA-3）", link: "/hash-functions" },
            { text: "HMAC", link: "/hmac" },
            { text: "JWT（JSON Web Token）", link: "/jwt" },
            { text: "鍵導出関数（PBKDF2, bcrypt, Argon2）", link: "/key-derivation-functions" },
            { text: "パスキー（Passkeys）", link: "/passkeys" },
            { text: "PKIと証明書", link: "/pki-certificates" },
            { text: "ポスト量子暗号", link: "/post-quantum-cryptography" },
            { text: "公開鍵暗号（RSA）", link: "/rsa" },
            { text: "TLS 1.3ハンドシェイク", link: "/tls-1-3" },
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
