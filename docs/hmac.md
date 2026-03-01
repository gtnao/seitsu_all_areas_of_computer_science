---
title: "HMAC — ハッシュベースのメッセージ認証コード"
date: 2026-03-01
tags: ["security", "cryptography", "hmac", "mac", "message-authentication", "intermediate"]
---

# HMAC — ハッシュベースのメッセージ認証コード

## 1. はじめに：メッセージ認証の必要性

暗号化はデータの**機密性**を守るが、**完全性**（データが改ざんされていないこと）と**認証**（データが正当な送信者から来たこと）は保証しない。例えば、CTRモードで暗号化されたデータは、暗号文のビットを反転させるだけで平文の対応するビットが反転する。攻撃者は暗号を解読せずにデータを改ざんできてしまう。

**MAC（Message Authentication Code）**は、秘密鍵を使ってメッセージに対する認証タグを生成する仕組みである。受信者は同じ秘密鍵を使ってタグを再計算し、送られてきたタグと比較することで、メッセージの完全性と認証を検証できる。

**HMAC（Hash-based Message Authentication Code）**は、暗号学的ハッシュ関数を使ってMACを構成する最も広く使われている方式であり、1996年にMihir BellareとRan CanettiとHugo Krawczykによって提案された。RFC 2104で標準化されている。

## 2. なぜ単純な構成ではダメなのか

### 2.1 $H(\text{key} \| \text{message})$ の問題

最も直感的なMAC構成は、鍵とメッセージを連結してハッシュを取ることである：

$$
\text{MAC}(K, M) = H(K \| M)
$$

しかし、Merkle-Damgård構造のハッシュ関数（SHA-256など）では**長さ拡張攻撃**により、$H(K \| M)$ と $|K \| M|$ から、$K$ を知らなくても $H(K \| M \| \text{padding} \| M')$ を計算できてしまう。

つまり、攻撃者は有効なMACタグを持つメッセージの末尾に追加データを付加し、新たな有効なMACタグを生成できる。

### 2.2 $H(\text{message} \| \text{key})$ の問題

鍵を後ろに置く構成にも問題がある：

$$
\text{MAC}(K, M) = H(M \| K)
$$

ハッシュ関数に衝突が見つかった場合（$H(M_1) = H(M_2)$）、$H(M_1 \| K) = H(M_2 \| K)$ となり、MACの偽造が可能になる。MACの安全性がハッシュ関数の衝突耐性に完全に依存してしまう。

### 2.3 $H(\text{key} \| \text{message} \| \text{key})$ の問題

鍵を前後に置く構成（エンベロープ方式）にもいくつかの理論的な弱点が知られている。

HMACは、これらの問題を回避するために、より慎重に設計された構成を採用している。

## 3. HMACの構成

### 3.1 定義

HMACは以下のように定義される：

$$
\text{HMAC}(K, M) = H\bigl((K' \oplus \text{opad}) \| H((K' \oplus \text{ipad}) \| M)\bigr)
$$

ここで：
- $H$：暗号学的ハッシュ関数（SHA-256など）
- $K$：秘密鍵
- $K'$：鍵の前処理結果（後述）
- $\text{ipad}$：`0x36` を繰り返したブロック長のバイト列（inner padding）
- $\text{opad}$：`0x5c` を繰り返したブロック長のバイト列（outer padding）
- $\|$：連結

### 3.2 鍵の前処理

$K'$ は以下のルールで導出される：

- $K$ の長さがハッシュ関数のブロック長と等しい場合：$K' = K$
- $K$ の長さがブロック長より長い場合：$K' = H(K)$ をゼロパディングしてブロック長にする
- $K$ の長さがブロック長より短い場合：$K' = K$ をゼロパディングしてブロック長にする

SHA-256の場合、ブロック長は512ビット（64バイト）である。

### 3.3 処理の流れ

```
Key ──→ [Pad to block size] ──→ K'
                                 │
                    ┌────────────┤
                    ↓            ↓
              K' XOR ipad   K' XOR opad
                    │            │
                    ↓            │
            ┌──────────────┐     │
  Message → │ H(ipad_key ‖ M) │  │
            └──────┬───────┘     │
                   │             │
                   ↓             ↓
            ┌─────────────────────────┐
            │ H(opad_key ‖ inner_hash) │
            └───────────┬─────────────┘
                        │
                        ↓
                      HMAC
```

手順を分解すると：

1. $K'$ と `ipad` のXORを計算する：$\text{ipad\_key} = K' \oplus \text{ipad}$
2. メッセージと連結してハッシュを計算する：$\text{inner\_hash} = H(\text{ipad\_key} \| M)$
3. $K'$ と `opad` のXORを計算する：$\text{opad\_key} = K' \oplus \text{opad}$
4. inner hashと連結してハッシュを計算する：$\text{HMAC} = H(\text{opad\_key} \| \text{inner\_hash})$

HMACはハッシュ関数を**2回**呼び出す構成となっている。

## 4. HMACの安全性

### 4.1 安全性証明

BellareらはHMACの安全性を以下の仮定の下で証明した：

1. ハッシュ関数の圧縮関数がPRF（疑似ランダム関数）であること

この条件は、ハッシュ関数の衝突耐性よりも弱い仮定である。つまり、ハッシュ関数の衝突が見つかったとしても、圧縮関数がPRFとしての性質を保っていればHMACは安全である。

実際に、MD5の衝突が実証された後もHMAC-MD5は直ちに危殆化しなかったのは、この理論的な裏付けによる。ただし、現在ではMD5ベースのHMACは非推奨である。

### 4.2 長さ拡張攻撃への耐性

HMACの二重ハッシュ構造は、長さ拡張攻撃を無効化する。外側のハッシュが内側のハッシュの結果を別の鍵でラップするため、攻撃者は内側のハッシュの中間状態にアクセスできない。

### 4.3 鍵の長さの推奨

- 最低限の推奨：ハッシュ関数の出力長以上（HMAC-SHA-256なら32バイト以上）
- 短すぎる鍵はブルートフォースに対して脆弱になる
- 長すぎる鍵は先にハッシュされるため、安全性に悪影響はないがパフォーマンスのオーバーヘッドがある

### 4.4 タイミング攻撃への注意

MACの検証時に `==` でバイト列を比較すると、一致するプレフィックスの長さに応じて処理時間が変わり、タイミング攻撃の対象となる。

MACの比較には必ず**定数時間比較関数**を使用する：

```python
import hmac

# Safe comparison
hmac.compare_digest(expected_mac, received_mac)
```

```go
import "crypto/subtle"

// Safe comparison
subtle.ConstantTimeCompare(expectedMAC, receivedMAC)
```

## 5. ipad/opadの設計根拠

`0x36`（ipad）と `0x5c`（opad）の選択には理論的な根拠がある。

### 5.1 ハミング距離

$\text{ipad} \oplus \text{opad} = \texttt{0x36} \oplus \texttt{0x5c} = \texttt{0x6a}$

二進表現では：`01101010`であり、ハミング重みは4（8ビット中4ビットが異なる）。これは十分なビット差を確保し、内側と外側の鍵が大きく異なることを保証する。

### 5.2 非対称性の確保

inner hashとouter hashが異なる鍵で計算されることが重要である。もしipadとopadが同じであれば、内側と外側で同じ鍵が使われ、安全性証明が成り立たなくなる。

## 6. 実世界での利用

### 6.1 TLS/HTTPS

TLS 1.2以前では、PRF（擬似ランダム関数）の構成要素としてHMACが使われていた。TLS 1.3では**HKDF（HMAC-based Key Derivation Function）**が鍵導出に使用されている：

$$
\text{HKDF-Extract}(\text{salt}, \text{IKM}) = \text{HMAC}(\text{salt}, \text{IKM})
$$
$$
\text{HKDF-Expand}(PRK, \text{info}, L) = T(1) \| T(2) \| \ldots
$$
$$
T(i) = \text{HMAC}(PRK, T(i-1) \| \text{info} \| i)
$$

### 6.2 JWT（JSON Web Token）

JWTのHS256アルゴリズムは HMAC-SHA-256 でトークンの署名を生成する：

$$
\text{Signature} = \text{HMAC-SHA-256}(\text{secret}, \text{header} \| \texttt{.} \| \text{payload})
$$

### 6.3 APIの認証

AWS Signature Version 4やStripe Webhookなど、多くのAPI認証メカニズムがHMACを使用している。リクエストのパラメータとタイムスタンプからHMACを計算し、リクエストの真正性を検証する。

### 6.4 TOTP（Time-based One-Time Password）

Google Authenticatorなどで使われるTOTPは、HMACをベースにしている：

$$
\text{TOTP}(K, T) = \text{Truncate}(\text{HMAC-SHA-1}(K, T))
$$

ここで $T$ は時間ステップ（通常30秒ごとにインクリメント）であり、$K$ はユーザーとサーバーの共有秘密鍵である。

### 6.5 PBKDF2

パスワードベースの鍵導出関数PBKDF2は、HMACを擬似ランダム関数として使用する：

$$
\text{DK} = T_1 \| T_2 \| \ldots \| T_l
$$
$$
T_i = U_1 \oplus U_2 \oplus \ldots \oplus U_c
$$
$$
U_1 = \text{HMAC}(\text{Password}, \text{Salt} \| i)
$$
$$
U_j = \text{HMAC}(\text{Password}, U_{j-1})
$$

$c$ はイテレーション回数であり、意図的に計算を遅くすることでブルートフォース攻撃に対する耐性を高めている。

## 7. HMACとその他のMAC方式の比較

### 7.1 CMAC

**CMAC（Cipher-based MAC）**はブロック暗号（AESなど）をベースとしたMACである。CBC-MACの改良版であり、可変長メッセージに対して安全である。

HMACがハッシュ関数に基づくのに対し、CMACはブロック暗号に基づく。AES-NIが利用可能な環境ではCMACの方が高速な場合がある。

### 7.2 Poly1305

**Poly1305**はDaniel J. Bernsteinが設計した高速なMACであり、ChaCha20-Poly1305のAEAD構成で使用される。

Poly1305は $\text{GF}(2^{130} - 5)$ 上の多項式評価に基づいており、以下の特徴がある：

- 非常に高速（特にソフトウェア実装）
- ワンタイム鍵を使用する設計（同じ鍵を再利用してはならない）
- ChaCha20と組み合わせてAEADを構成する

### 7.3 GMAC

**GMAC**はAES-GCMの認証部分（GHASH）をMACとして使用したもの。AES-GCMを使用する場合は追加のMACは不要である。

### 7.4 比較表

| 特性 | HMAC | CMAC | Poly1305 | GMAC |
|---|---|---|---|---|
| ベース | ハッシュ関数 | ブロック暗号 | 多項式評価 | GF乗算 |
| 安全性証明 | あり | あり | あり | あり |
| 性能 | 良好 | 良好 | 非常に高速 | 高速 |
| 鍵再利用 | 可能 | 可能 | 不可 | 不可（nonceベース） |
| 標準化 | RFC 2104 | NIST SP 800-38B | RFC 8439 | NIST SP 800-38D |

## 8. HMACの実装例

### 8.1 各言語での使用

```python
import hmac
import hashlib

key = b"secret_key"
message = b"Hello, World!"
mac = hmac.new(key, message, hashlib.sha256).hexdigest()
```

```go
package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
)

func computeHMAC(key, message []byte) string {
    mac := hmac.New(sha256.New, key)
    mac.Write(message)
    return hex.EncodeToString(mac.Sum(nil))
}
```

## 9. まとめ

HMACは、暗号学的ハッシュ関数を安全にMACとして利用するための確立された手法であり、以下の特徴を持つ：

- **証明可能な安全性**：ハッシュ関数の圧縮関数がPRFであれば安全
- **長さ拡張攻撃への耐性**：二重ハッシュ構造により防御
- **広範な採用**：TLS、JWT、API認証、TOTP、HKDFなど、あらゆる場面で使用
- **ハッシュ関数の交換可能性**：SHA-256をSHA-3に変更するだけで移行可能

使用上の注意点：

- 鍵長はハッシュ関数の出力長以上にする
- MACの検証には定数時間比較を使用する
- MD5やSHA-1ベースのHMACは新規システムでは使用しない
- MACだけでは機密性は保証されない。必要に応じてAEAD（AES-GCM、ChaCha20-Poly1305）を使用する

HMACはシンプルながら堅牢な設計であり、暗号プロトコルの「信頼の接着剤」として今後も重要な役割を果たし続けるだろう。
