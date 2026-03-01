---
title: "PKI（公開鍵基盤）と証明書 — X.509、認証局、Certificate Transparency"
date: 2026-03-01
tags: ["security", "cryptography", "pki", "x509", "certificate-authority", "certificate-transparency", "intermediate"]
---

# PKI（公開鍵基盤）と証明書 — X.509、認証局、Certificate Transparency

## 1. はじめに：公開鍵の信頼問題

公開鍵暗号やDiffie-Hellman鍵交換は強力な技術だが、根本的な問題がある。「この公開鍵は本当に通信相手のものか？」という**認証の問題**である。

中間者攻撃（MITM）では、攻撃者が自分の公開鍵を通信相手のものとして提示する。公開鍵そのものには所有者の情報が含まれておらず、正しい相手の鍵かどうかを判断する手段がない。

**PKI（Public Key Infrastructure、公開鍵基盤）**は、この問題を解決するための信頼のフレームワークである。信頼できる第三者（**認証局、CA: Certificate Authority**）が公開鍵と所有者の結びつきを証明する**デジタル証明書**を発行することで、公開鍵の真正性を保証する。

## 2. X.509証明書

### 2.1 概要

**X.509**は、ITU-Tが定義したデジタル証明書の標準フォーマットであり、TLS/HTTPS、コード署名、電子メール（S/MIME）など、インターネットにおける証明書の事実上の標準である。

### 2.2 証明書の構造

X.509 v3証明書は以下のフィールドで構成される：

```
Certificate ::= SEQUENCE {
    tbsCertificate       TBSCertificate,        -- 署名対象のデータ
    signatureAlgorithm   AlgorithmIdentifier,   -- 署名アルゴリズム
    signatureValue       BIT STRING             -- CAの署名
}

TBSCertificate ::= SEQUENCE {
    version              [0] EXPLICIT INTEGER,  -- v3 (2)
    serialNumber         INTEGER,               -- 一意なシリアル番号
    signature            AlgorithmIdentifier,   -- 署名アルゴリズム
    issuer               Name,                  -- 発行者（CA）のDN
    validity             Validity,              -- 有効期間
    subject              Name,                  -- 主体者のDN
    subjectPublicKeyInfo SubjectPublicKeyInfo,  -- 公開鍵
    extensions           [3] EXPLICIT Extensions -- 拡張フィールド
}
```

### 2.3 重要な拡張フィールド

| 拡張 | 用途 |
|---|---|
| **Subject Alternative Name (SAN)** | 証明書が有効なドメイン名（複数指定可能） |
| **Basic Constraints** | CA証明書かエンドエンティティ証明書かの区別 |
| **Key Usage** | 鍵の用途（署名、暗号化、鍵共有など） |
| **Extended Key Usage** | 拡張用途（サーバー認証、クライアント認証など） |
| **Authority Key Identifier** | 発行者の鍵の識別子 |
| **CRL Distribution Points** | 証明書失効リストの配布先 |
| **Authority Information Access** | OCSPレスポンダのURLなど |
| **SCT (Signed Certificate Timestamp)** | Certificate Transparencyのタイムスタンプ |

### 2.4 証明書の有効期間

かつてはSSL証明書の有効期間は数年間であったが、セキュリティ上の理由から短縮が進んでいる：

- 2018年まで：最大3年
- 2018〜2020年：最大2年
- 2020年以降：最大**398日**（約13ヶ月）
- 将来：90日（Let's Encryptが先導）への移行が議論されている

有効期間の短縮は、鍵の危殆化リスクの低減と、失効メカニズムの限界（後述）を補完する目的がある。

## 3. 認証局（CA）の信頼モデル

### 3.1 階層的信頼モデル

PKIの信頼は**ルートCA**を頂点とする階層構造で構成される。

```
Root CA（自己署名証明書）
    │
    ├── Intermediate CA 1
    │       │
    │       ├── End-Entity Certificate (example.com)
    │       └── End-Entity Certificate (example.org)
    │
    └── Intermediate CA 2
            │
            └── End-Entity Certificate (test.com)
```

- **ルートCA**：自己署名証明書を持つ最上位のCA。OSやブラウザに**トラストストア**として事前にインストールされている
- **中間CA**：ルートCAから証明書を発行された下位のCA。実際のサーバー証明書発行はほとんどが中間CAが行う
- **エンドエンティティ証明書**：サーバーやクライアントに発行される証明書

### 3.2 証明書チェーンの検証

TLSハンドシェイクでサーバーから受け取った証明書を検証する手順：

1. サーバー証明書のSANにアクセス先のドメイン名が含まれていることを確認
2. 証明書の有効期間内であることを確認
3. サーバー証明書の発行者（中間CA）の署名を検証
4. 中間CA証明書の発行者（ルートCAまたは別の中間CA）の署名を検証
5. チェーンがトラストストア内のルートCA証明書に到達することを確認
6. 各証明書が失効していないことを確認

```
[Server Certificate] → signed by → [Intermediate CA] → signed by → [Root CA]
        ↑                                                                ↑
   送信される                                                    トラストストアに
                                                                 事前インストール
```

### 3.3 トラストストア

各OS/ブラウザは独自のトラストストアを管理している：

- **Mozilla NSS**：Firefox、Thunderbird（約150のルートCA）
- **Apple Root Certificate Program**：macOS、iOS
- **Microsoft Trusted Root Certificate Program**：Windows
- **Google Chrome Root Store**：Chrome（2023年から独立のルートストア）

CAがトラストストアに含まれるためには、厳格な監査要件を満たす必要がある。

### 3.4 ドメイン検証（DV）、組織検証（OV）、拡張検証（EV）

| 検証レベル | 検証内容 | 用途 |
|---|---|---|
| **DV (Domain Validation)** | ドメインの所有権のみ | 個人サイト、一般的なWebサイト |
| **OV (Organization Validation)** | ドメイン所有権 + 組織の実在性 | 企業サイト |
| **EV (Extended Validation)** | ドメイン所有権 + 組織の厳格な審査 | 金融機関など |

かつてEV証明書はブラウザのアドレスバーに組織名が表示されていたが、ユーザーがこの表示を理解していないことが判明し、Chrome/Firefoxでは表示が廃止された。現在は技術的にはDV証明書で十分とする見方が主流である。

## 4. Let's Encryptと自動化

### 4.1 ACMEプロトコル

**Let's Encrypt**は2015年に開始された無料のDV証明書を提供するCAであり、**ACME（Automatic Certificate Management Environment）プロトコル**（RFC 8555）による証明書の自動発行・更新を実現した。

ACMEプロトコルの流れ：

```
Client                                    ACME Server (Let's Encrypt)
──────                                    ──────────────────────────
1. アカウント作成
2. 証明書発行要求              ──────────→
3.                             ←──────────  チャレンジの提示
4. チャレンジの応答（ドメイン所有の証明）
   - HTTP-01: /.well-known/acme-challenge/ にトークンを配置
   - DNS-01: _acme-challenge TXTレコードを設定
5. 検証完了                    ←──────────  検証成功
6. CSR（証明書署名要求）送信   ──────────→
7.                             ←──────────  証明書の発行
```

### 4.2 影響

Let's Encryptの登場により：

- HTTPS の普及率が急速に向上（2015年の約40%から2025年の約95%以上へ）
- 証明書の管理が自動化され、有効期限切れによるインシデントが減少
- 90日という短い有効期間が標準となり、鍵のローテーションが促進された
- 暗号化のコスト障壁が事実上排除された

## 5. 証明書の失効

### 5.1 失効が必要な場面

- 秘密鍵の漏洩
- 証明書の誤発行
- ドメインの所有権変更
- CAの信頼喪失

### 5.2 CRL（Certificate Revocation List）

**CRL**はCAが発行する失効した証明書のシリアル番号のリストである。

問題点：
- CRLのサイズが大きくなり、ダウンロードに時間がかかる
- 更新頻度の制約（通常数時間〜1日ごと）
- ネットワークエラーでCRLを取得できない場合の処理（ソフトフェイル vs ハードフェイル）

### 5.3 OCSP（Online Certificate Status Protocol）

**OCSP**は個々の証明書の失効状態をリアルタイムで問い合わせるプロトコルである。

```
Client ──→ OCSP Responder: "この証明書は有効ですか？"
Client ←── OCSP Responder: "有効です" (署名付き応答)
```

問題点：
- **プライバシー**：OCSPレスポンダにクライアントのアクセス先が漏洩する
- **レイテンシ**：TLSハンドシェイクにOCSP問い合わせの遅延が加わる
- **可用性**：OCSPレスポンダがダウンした場合の処理

### 5.4 OCSP Stapling

**OCSP Stapling**は、サーバーがOCSP応答を事前に取得し、TLSハンドシェイクに含める（ステープルする）仕組みである。

```
Server → OCSP Responder: "私の証明書の状態をください"
Server ← OCSP Responder: 署名付きOCSP応答

Client ←→ Server: TLSハンドシェイク中にOCSP応答を含めて送信
```

これによりプライバシーとレイテンシの問題が解消される。TLS 1.3ではOCSP Staplingがほぼ標準的に使われている。

### 5.5 失効メカニズムの限界

実際には、失効メカニズムは**信頼性が低い**。多くのブラウザは「ソフトフェイル」ポリシーを採用しており、CRL/OCSPの確認に失敗した場合でも接続を許可する。これは可用性を優先した決定だが、失効の実効性を大きく損なっている。

このため、証明書の有効期間を短くすることが重要視されている。有効期間が短ければ、失効メカニズムが機能しなくても、妥協された証明書の影響期間が限定される。

## 6. Certificate Transparency（CT）

### 6.1 背景：CA の不正行為

PKIの最大の弱点は、トラストストアに含まれる**任意のCAが任意のドメインの証明書を発行できる**ことである。過去にCAの不正行為や侵害により、不正な証明書が発行される事件が複数発生した：

- **2011年 DigiNotar事件**：オランダのCAが侵害され、google.comを含む不正な証明書が発行された。イラン政府によるGmail盗聴に使用されたと推定
- **2015年 CNNIC事件**：中国の認証局傘下の中間CAがGoogleドメインの不正な証明書を発行
- **2017年 Symantec事件**：Symantecが監査要件を遵守しておらず、Chrome/Firefoxから信頼を取り消された

### 6.2 CTの仕組み

**Certificate Transparency（CT）**は、発行されたすべての証明書を**公開ログ**に記録し、ドメイン所有者が不正な証明書の発行を検出できるようにする仕組みである（RFC 6962）。

```
    CA ──→ CT Log ──→ 公開・検証可能
    │         │
    │         ↓
    │     SCT (Signed Certificate Timestamp)
    │         │
    ↓         ↓
Certificate + SCT ──→ Server ──→ Client
                                    │
                                    ↓
                              SCTを検証
```

1. CAが証明書を発行する前（または発行時）にCTログに証明書を提出する
2. CTログは**SCT（Signed Certificate Timestamp）**を返す
3. SCTは証明書に埋め込まれる（X.509拡張、OCSP Stapling、またはTLS拡張として）
4. ブラウザはSCTを検証し、証明書がCTログに記録されていることを確認する

### 6.3 Merkle Tree

CTログは**追記専用のMerkle Tree**として実装される。

```
        Root Hash
       /         \
    H(01)       H(23)
   /     \     /     \
 H(0)   H(1) H(2)   H(3)
  |      |    |      |
Cert₀ Cert₁ Cert₂  Cert₃
```

Merkle Treeの特性：
- **追記専用**：ログへの追記は可能だが、既存のエントリを変更・削除できない
- **包含証明**：特定の証明書がログに含まれていることを $O(\log n)$ のデータで証明できる
- **一貫性証明**：ログが過去の状態と整合していることを $O(\log n)$ のデータで証明できる

### 6.4 CTの効果

2018年4月以降、Chromeはすべての新規発行証明書に対してCTを要求している。これにより：

- ドメイン所有者は自分のドメインに対して発行されたすべての証明書を監視できる
- 不正な証明書の発行が迅速に検出される
- CAの透明性と説明責任が向上した

## 7. CAA（Certification Authority Authorization）

**CAA（DNS Certification Authority Authorization）**レコードは、ドメイン所有者がどのCAからの証明書発行を許可するかをDNSで宣言する仕組みである（RFC 8659）。

```
example.com. IN CAA 0 issue "letsencrypt.org"
example.com. IN CAA 0 issuewild ";"
example.com. IN CAA 0 iodef "mailto:security@example.com"
```

CAは証明書を発行する前にCAAレコードを確認し、許可されていない場合は発行を拒否する義務がある（2017年以降、CA/Browser Forumの義務要件）。

## 8. 証明書のピン留め（Certificate Pinning）

### 8.1 概要

**Certificate Pinning**は、特定のサーバーに対して期待される証明書（または公開鍵）をクライアントに事前に設定し、不正な証明書を検出する手法である。

### 8.2 HPKP（HTTP Public Key Pinning）の失敗

HPKPはHTTPヘッダでピンを配布する仕組みであったが、以下の問題から非推奨となり、Chromeから削除された：

- 設定ミスによる**自己DoS**のリスク（証明書をローテーションした際にピンが一致しなくなる）
- 悪用の可能性（攻撃者がHPKPヘッダを挿入して被害者をサイトから締め出す**ランサムピン攻撃**）

### 8.3 現在の推奨

Certificate Transparencyの普及により、CTが事実上のピン留めの代替となっている。モバイルアプリでは引き続きコード内でのピン留めが使われることがあるが、証明書のローテーション時の運用に注意が必要である。

## 9. Web PKIの今後

### 9.1 証明書の短寿命化

有効期間の短縮（90日、さらには短期間）により、失効メカニズムへの依存を減らし、鍵の定期的なローテーションを促進する方向に進んでいる。

### 9.2 ポスト量子証明書

ポスト量子暗号への移行に伴い、X.509証明書にML-DSAなどのPQC署名が使用されるようになる。PQC署名は既存の署名より大幅にサイズが大きいため、証明書チェーン全体のサイズ増大が課題となる。

### 9.3 ECH（Encrypted Client Hello）との連携

ECHの普及により、証明書の送信が暗号化される範囲がさらに拡大する。

## 10. まとめ

PKIは、インターネットの信頼基盤として不可欠な仕組みである。しかし、その信頼モデルには根本的な課題がある——トラストストア内の任意のCAが任意のドメインの証明書を発行できるという点である。

この課題に対して、以下の多層的な防御が構築されている：

- **Certificate Transparency**：すべての証明書を公開ログに記録し、監視可能にする
- **CAA**：ドメイン所有者が許可するCAを明示的に宣言する
- **OCSP Stapling**：効率的な失効状態の伝達
- **短寿命証明書**：失効メカニズムの限界を補完する
- **Let's Encrypt / ACME**：証明書管理の自動化と無料化

PKIの運用は複雑だが、理解すべき核心は以下の通りである：

- 証明書は公開鍵と所有者を結びつけるデジタル文書である
- CAの信頼は階層的であり、ルートCAがトラストストアに事前インストールされる
- Certificate Transparencyは不正な証明書発行を検出する重要な安全装置である
- 証明書の有効期間は短くし、自動更新を設定する

インターネットの安全な通信は、この信頼の基盤の上に成り立っている。
