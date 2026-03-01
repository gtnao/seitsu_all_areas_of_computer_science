import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    lang: "ja",
    title: "Seitsu",
    description: "コンピューターサイエンスの全領域をカバーする技術解説",

    markdown: {
      math: true,
    },

    themeConfig: {
      sidebar: [
        {
          text: "記事一覧",
          items: [
            {
              text: "共通鍵暗号（AES）",
              link: "/aes",
            },
            {
              text: "JWT（JSON Web Token）",
              link: "/jwt",
            },
            {
              text: "パスキー（Passkeys）",
              link: "/passkeys",
            },
            {
              text: "公開鍵暗号（RSA）",
              link: "/rsa",
            },
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
  })
);
