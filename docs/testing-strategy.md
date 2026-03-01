---
title: "テスト戦略（ユニット, インテグレーション, E2E）"
date: 2026-03-01
tags: ["software-engineering", "testing", "quality-assurance", "introductory"]
---

# テスト戦略（ユニット, インテグレーション, E2E）

## 1. テストの目的と価値 — なぜテストを書くのか

### 1.1 ソフトウェアにおける「正しさ」の保証

ソフトウェア開発において、「コードが意図通りに動作する」ことを保証する手段は限られている。形式的検証（Formal Verification）は数学的な証明によって正しさを担保するが、その適用範囲は極めて限定的であり、一般的な業務アプリケーションに適用するのは現実的ではない。一方、手動テスト（Manual Testing）は人間の判断力に依存するが、再現性が低く、回帰テスト（Regression Testing）のコストが際限なく増大する。

自動テスト（Automated Testing）は、この二つの極端な手法の間に位置する現実的な解である。形式的検証ほど厳密ではないが、手動テストよりも遥かに効率的かつ再現性が高い。ソフトウェアが複雑さを増す現代において、自動テストはもはや「あると便利」なものではなく、「なければプロジェクトが崩壊する」基盤である。

### 1.2 テストがもたらす具体的な価値

テストの価値は「バグを見つけること」だけに留まらない。テストがソフトウェア開発にもたらす価値は多層的である。

**回帰防止（Regression Prevention）**：既存の機能が新しい変更によって壊れていないことを継続的に確認できる。これはコードベースが大きくなればなるほど重要性を増す。数万行のコードに対して手動で回帰テストを行うことは非現実的であり、自動テストなしではリファクタリングや機能追加のたびに「何かが壊れているかもしれない」という不安を抱えることになる。

**設計へのフィードバック（Design Feedback）**：テストが書きにくいコードは、往々にして設計に問題がある。関数の責務が過大であったり、依存関係が複雑すぎたり、副作用が多すぎたりする場合、テストはそのことを如実に教えてくれる。テストを書く行為は、コードの設計品質に対する即座のフィードバックループとして機能する。

**生きたドキュメント（Living Documentation）**：テストコードは、対象コードの「使い方」を示す実行可能なサンプルである。APIのドキュメントが古くなっていても、テストが通り続けている限り、テストコードは現在の正しい振る舞いを記述している。

**リファクタリングの安全ネット（Safety Net for Refactoring）**：内部実装を変更しても外部から見た振る舞いが変わらないことを、テストが保証してくれる。テストなしのリファクタリングは「綱渡り」であり、テストありのリファクタリングは「安全ネット付きの演技」である。

### 1.3 テストのコスト

テストはただで手に入るものではない。テストの記述・保守にはコストがかかる。テストコードも本番コードと同様にメンテナンスが必要であり、プロダクションコードの変更に追従しなければならない。過度にブリトルな（壊れやすい）テストは、本番コードの正当な変更のたびに修正が必要になり、開発速度を著しく低下させる。

したがって、テスト戦略の本質は「何をテストするか」と「どのレベルでテストするか」の判断にある。すべてを網羅的にテストすることは不可能であるし、望ましくもない。限られたリソースを最も効果的なテストに集中させることが、テスト戦略の核心である。

## 2. テストピラミッド — 概念と各層の役割

### 2.1 テストピラミッドの起源

テストピラミッド（Test Pyramid）は、Mike Cohn が著書 *Succeeding with Agile*（2009年）で提唱した概念である。テストをその粒度と実行コストに基づいて三つの層に分類し、ピラミッド型の比率で配置することを推奨するモデルである。

```mermaid
graph TB
    subgraph テストピラミッド
        E2E["E2Eテスト<br/>（少数・高コスト・低速）"]
        INT["インテグレーションテスト<br/>（中程度）"]
        UNIT["ユニットテスト<br/>（多数・低コスト・高速）"]
    end

    E2E --- INT
    INT --- UNIT

    style E2E fill:#e74c3c,stroke:#c0392b,color:#fff
    style INT fill:#f39c12,stroke:#e67e22,color:#fff
    style UNIT fill:#27ae60,stroke:#229954,color:#fff
```

ピラミッドの下層に行くほどテストの数が多く、実行速度が速く、コストが低い。上層に行くほどテストの数が少なく、実行速度が遅く、コストが高い。この比率がピラミッド型であるべきだというのが、テストピラミッドの主張である。

### 2.2 各層の特性比較

| 特性 | ユニットテスト | インテグレーションテスト | E2Eテスト |
|------|--------------|----------------------|----------|
| **スコープ** | 単一の関数・クラス | 複数コンポーネントの連携 | システム全体 |
| **実行速度** | ミリ秒単位 | 秒〜数十秒 | 分単位 |
| **安定性** | 高い（決定的） | 中程度 | 低い（フレイキー） |
| **障害の特定** | 容易（ピンポイント） | やや困難 | 困難（広範囲） |
| **保守コスト** | 低い | 中程度 | 高い |
| **信頼性** | 部分的 | 中程度 | 高い（実環境に近い） |
| **テスト数** | 多い | 中程度 | 少ない |

### 2.3 アンチパターン：逆ピラミッドとアイスクリームコーン

テストピラミッドが正しい比率を示す一方で、実際のプロジェクトでは逆ピラミッドやアイスクリームコーン型になってしまうことがある。

```mermaid
graph TB
    subgraph "アンチパターン：アイスクリームコーン"
        MT["手動テスト<br/>（最も多い）"]
        AE["E2Eテスト<br/>（多い）"]
        AI["インテグレーション<br/>（少ない）"]
        AU["ユニットテスト<br/>（ほぼなし）"]
    end

    MT --- AE
    AE --- AI
    AI --- AU

    style MT fill:#8e44ad,stroke:#7d3c98,color:#fff
    style AE fill:#e74c3c,stroke:#c0392b,color:#fff
    style AI fill:#f39c12,stroke:#e67e22,color:#fff
    style AU fill:#27ae60,stroke:#229954,color:#fff
```

アイスクリームコーン型のテスト構成は、以下の問題を引き起こす。

- **実行時間の爆発**：E2Eテストや手動テストが大部分を占めるため、テストスイート全体の実行に数時間かかる
- **フレイキーテストの蔓延**：E2Eテストは外部サービスやタイミングに依存するため、非決定的な失敗（Flaky Test）が頻発する
- **デバッグの困難さ**：上位レベルのテストが失敗した場合、原因の特定に時間がかかる
- **フィードバックループの遅延**：開発者が変更の影響を知るまでに長い時間がかかる

::: warning アンチパターンに陥る典型的な原因
ユニットテストを書く文化がないままプロジェクトが成長すると、品質を担保するために後からE2Eテストや手動テストに頼るようになる。これは短期的には機能するが、長期的にはテストの維持コストが急増し、CI/CDパイプラインのボトルネックとなる。テスト戦略はプロジェクトの初期段階から意識的に設計する必要がある。
:::

## 3. ユニットテスト — 定義、スコープ、テストダブル

### 3.1 ユニットテストの定義

ユニットテスト（Unit Test）は、ソフトウェアの最小単位を独立して検証するテストである。「最小単位」の定義はコンテキストによって異なるが、一般的には単一の関数、メソッド、またはクラスを指す。

ユニットテストの本質的な特性は以下の通りである。

- **高速**：1つのテストがミリ秒単位で完了する
- **独立**：他のテストの実行結果に影響されない
- **決定的**：同じ入力に対して常に同じ結果を返す
- **外部依存なし**：データベース、ネットワーク、ファイルシステムなどの外部リソースに依存しない

### 3.2 ユニットテストの具体例

以下は、ショッピングカートの合計金額を計算する関数に対するユニットテストの例である。

```typescript
// cart.ts
interface CartItem {
  name: string;
  price: number;
  quantity: number;
}

function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function applyDiscount(total: number, discountPercent: number): number {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error("Discount percent must be between 0 and 100");
  }
  return Math.round(total * (1 - discountPercent / 100));
}
```

```typescript
// cart.test.ts
import { describe, it, expect } from "vitest";

describe("calculateTotal", () => {
  it("should return 0 for empty cart", () => {
    expect(calculateTotal([])).toBe(0);
  });

  it("should calculate total for single item", () => {
    const items: CartItem[] = [
      { name: "Widget", price: 1000, quantity: 2 },
    ];
    expect(calculateTotal(items)).toBe(2000);
  });

  it("should calculate total for multiple items", () => {
    const items: CartItem[] = [
      { name: "Widget", price: 1000, quantity: 2 },
      { name: "Gadget", price: 2500, quantity: 1 },
    ];
    expect(calculateTotal(items)).toBe(4500);
  });
});

describe("applyDiscount", () => {
  it("should apply 10% discount", () => {
    expect(applyDiscount(10000, 10)).toBe(9000);
  });

  it("should return full price for 0% discount", () => {
    expect(applyDiscount(10000, 0)).toBe(10000);
  });

  it("should return 0 for 100% discount", () => {
    expect(applyDiscount(10000, 100)).toBe(0);
  });

  it("should throw for negative discount", () => {
    expect(() => applyDiscount(10000, -5)).toThrow(
      "Discount percent must be between 0 and 100"
    );
  });
});
```

このテストは外部依存がなく、純粋な計算ロジックのみを検証している。入力と期待される出力が明確で、テストが失敗した場合にどこに問題があるかが即座に分かる。

### 3.3 テストダブル（Test Doubles）

現実のソフトウェアでは、テスト対象が外部の依存（データベース、APIクライアント、メール送信サービスなど）を持つことが多い。ユニットテストではこれらの依存を「テストダブル」と呼ばれる代替物に置き換えることで、テスト対象を独立させる。

テストダブルという用語は、Gerard Meszaros が著書 *xUnit Test Patterns*（2007年）で体系化した概念であり、映画のスタントダブル（代役）に由来する。主なテストダブルの種類は以下の通りである。

```mermaid
graph LR
    TD["テストダブル<br/>(Test Double)"]
    TD --> DUMMY["Dummy<br/>引数を埋めるだけ"]
    TD --> STUB["Stub<br/>固定値を返す"]
    TD --> SPY["Spy<br/>呼び出しを記録"]
    TD --> MOCK["Mock<br/>期待する呼び出しを検証"]
    TD --> FAKE["Fake<br/>簡易実装"]

    style TD fill:#3498db,stroke:#2980b9,color:#fff
    style DUMMY fill:#95a5a6,stroke:#7f8c8d,color:#fff
    style STUB fill:#e67e22,stroke:#d35400,color:#fff
    style SPY fill:#2ecc71,stroke:#27ae60,color:#fff
    style MOCK fill:#e74c3c,stroke:#c0392b,color:#fff
    style FAKE fill:#9b59b6,stroke:#8e44ad,color:#fff
```

#### Stub（スタブ）

スタブは、あらかじめ定義された値を返すテストダブルである。外部APIの応答や、データベースのクエリ結果をシミュレートする際に使用する。

```typescript
// user-service.ts
interface UserRepository {
  findById(id: string): Promise<User | null>;
}

class UserService {
  constructor(private userRepo: UserRepository) {}

  async getUserDisplayName(id: string): Promise<string> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    return `${user.lastName} ${user.firstName}`;
  }
}
```

```typescript
// user-service.test.ts
describe("UserService", () => {
  it("should return formatted display name", async () => {
    // Stub: returns a predefined user
    const stubRepo: UserRepository = {
      findById: async (_id: string) => ({
        id: "1",
        firstName: "太郎",
        lastName: "山田",
        email: "taro@example.com",
      }),
    };

    const service = new UserService(stubRepo);
    const name = await service.getUserDisplayName("1");
    expect(name).toBe("山田 太郎");
  });

  it("should throw when user not found", async () => {
    // Stub: returns null to simulate missing user
    const stubRepo: UserRepository = {
      findById: async (_id: string) => null,
    };

    const service = new UserService(stubRepo);
    await expect(service.getUserDisplayName("999")).rejects.toThrow(
      "User not found"
    );
  });
});
```

#### Mock（モック）

モックは、特定のメソッドが特定の引数で呼び出されることを「期待」として設定し、その期待が満たされたかどうかを検証するテストダブルである。

```typescript
// notification-service.test.ts
import { vi } from "vitest";

describe("OrderService", () => {
  it("should send notification when order is placed", async () => {
    // Mock: verifies that sendEmail is called with specific args
    const mockNotifier = {
      sendEmail: vi.fn(),
    };

    const orderService = new OrderService(mockNotifier);
    await orderService.placeOrder({
      userId: "user-1",
      items: [{ productId: "prod-1", quantity: 1 }],
    });

    // Verify the mock was called correctly
    expect(mockNotifier.sendEmail).toHaveBeenCalledWith(
      "user-1",
      expect.stringContaining("注文確認")
    );
    expect(mockNotifier.sendEmail).toHaveBeenCalledTimes(1);
  });
});
```

#### Spy（スパイ）

スパイは、実際のオブジェクトの振る舞いを維持しながら、メソッドの呼び出しを記録するテストダブルである。モックとの違いは、スパイは実際の実装を呼び出す点にある。

```typescript
// spy-example.test.ts
describe("EventLogger", () => {
  it("should log events while preserving original behavior", () => {
    const logger = new EventLogger();

    // Spy: wraps the real method and records calls
    const logSpy = vi.spyOn(logger, "log");

    logger.log("user_login", { userId: "user-1" });
    logger.log("page_view", { path: "/dashboard" });

    // Verify call count and arguments
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith("user_login", { userId: "user-1" });

    // The original method was also called (unlike mock)
    expect(logger.getEventCount()).toBe(2);
  });
});
```

#### Fake（フェイク）

フェイクは、本番の依存先の動作を模倣する簡易実装である。スタブやモックよりも本物に近い振る舞いをするが、本番環境では使えない簡略化された実装である。典型的な例として、インメモリデータベースがある。

```typescript
// In-memory fake implementation of UserRepository
class FakeUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async deleteById(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}
```

::: tip Stub と Mock の使い分け
Martin Fowler は記事 *Mocks Aren't Stubs* の中で、テストのスタイルを「状態検証（State Verification）」と「振る舞い検証（Behavior Verification）」に分類している。Stub は状態検証（テスト対象の出力を検証する）に、Mock は振る舞い検証（テスト対象が依存先をどう使ったかを検証する）に適している。一般的には、まず状態検証（Stub）を検討し、出力だけでは正しさを検証できない場合に振る舞い検証（Mock）を使うのが推奨される。
:::

### 3.4 ユニットテストの注意点

ユニットテストには以下のような注意点がある。

**実装の詳細に結合しすぎない**：内部の実装詳細（プライベートメソッドの呼び出し順序、内部状態の変化など）に対してテストを書くと、リファクタリングのたびにテストが壊れる。テストはできる限り「公開インターフェース」に対して書くべきである。

**テスト対象のスコープを適切に定める**：ユニットテストの「ユニット」は必ずしも1つの関数やクラスに限定する必要はない。密に連携する複数のクラスをまとめて1つのユニットとして扱うこともある。重要なのは、テストが高速かつ決定的であることである。

**100%カバレッジを目的にしない**：コードカバレッジは有用な指標であるが、それ自体を目的にすると、価値の低いテスト（getter/setter のテストなど）が増え、テストスイートの保守コストが上がるだけである。カバレッジは「テストが不足している箇所を見つけるツール」として使うのが適切である。

## 4. インテグレーションテスト — 定義、スコープ、テストコンテナ

### 4.1 インテグレーションテストの定義

インテグレーションテスト（Integration Test）は、複数のコンポーネントが連携して正しく動作することを検証するテストである。ユニットテストが「部品単体」の正しさを保証するのに対し、インテグレーションテストは「部品の組み合わせ」の正しさを保証する。

インテグレーションテストの典型的なスコープには以下が含まれる。

- アプリケーションコードとデータベースの連携
- 複数のサービス間のAPI呼び出し
- メッセージキューを介した非同期処理
- 外部APIとの通信（またはそのサンドボックス環境）
- ミドルウェア（認証、ロギングなど）を含むHTTPリクエストの処理

```mermaid
graph LR
    subgraph "インテグレーションテストのスコープ"
        APP["アプリケーション<br/>コード"]
        DB["データベース"]
        CACHE["キャッシュ<br/>(Redis等)"]
        MQ["メッセージキュー<br/>(RabbitMQ等)"]
    end

    APP -->|SQL/ORM| DB
    APP -->|GET/SET| CACHE
    APP -->|Publish/Subscribe| MQ

    style APP fill:#3498db,stroke:#2980b9,color:#fff
    style DB fill:#e67e22,stroke:#d35400,color:#fff
    style CACHE fill:#2ecc71,stroke:#27ae60,color:#fff
    style MQ fill:#9b59b6,stroke:#8e44ad,color:#fff
```

### 4.2 なぜインテグレーションテストが必要なのか

ユニットテストではすべての外部依存をテストダブルに置き換えるため、コンポーネント間の接合部（Seam）に潜むバグを検出できない。以下は、ユニットテストだけでは発見できない典型的なバグの例である。

- **SQLクエリのバグ**：ORMが生成するSQLが意図通りでない場合、ユニットテストではリポジトリをスタブに置き換えているため発見できない
- **スキーマの不整合**：データベースのマイグレーションとアプリケーションコードの間に齟齬がある場合
- **シリアライゼーションの問題**：JSON のシリアライズ/デシリアライズで型の変換ミスがある場合
- **トランザクション管理のバグ**：ロールバックやデッドロックに関する問題
- **設定ミス**：接続文字列、タイムアウト値、リトライ設定などの問題

### 4.3 Testcontainers による実データベーステスト

従来、インテグレーションテストでは、テスト環境にデータベースを事前にセットアップする必要があった。この作業は煩雑で環境差異の原因にもなる。Testcontainers は、テストコードからDockerコンテナを動的に起動・管理するライブラリであり、この問題を解決する。

```mermaid
sequenceDiagram
    participant Test as テストコード
    participant TC as Testcontainers
    participant Docker as Dockerデーモン
    participant DB as PostgreSQLコンテナ

    Test->>TC: コンテナ起動要求
    TC->>Docker: PostgreSQLイメージでコンテナ作成
    Docker->>DB: コンテナ起動
    DB-->>TC: 接続情報（ポート等）を返却
    TC-->>Test: 接続情報を提供

    Test->>DB: マイグレーション実行
    Test->>DB: テストデータ投入
    Test->>DB: テスト対象のクエリ実行
    DB-->>Test: 結果返却
    Test->>Test: アサーション実行

    Test->>TC: テスト完了
    TC->>Docker: コンテナ停止・削除
```

以下は、Java（JUnit 5 + Testcontainers）でのインテグレーションテストの例である。

```java
@Testcontainers
class UserRepositoryIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
        .withDatabaseName("testdb")
        .withUsername("test")
        .withPassword("test");

    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        // Initialize datasource with container's dynamic port
        var dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(postgres.getJdbcUrl());
        dataSource.setUsername(postgres.getUsername());
        dataSource.setPassword(postgres.getPassword());

        // Run migrations
        Flyway.configure()
            .dataSource(dataSource)
            .load()
            .migrate();

        userRepository = new UserRepository(dataSource);
    }

    @Test
    void shouldSaveAndRetrieveUser() {
        // Arrange
        var user = new User("taro", "taro@example.com");

        // Act
        userRepository.save(user);
        var found = userRepository.findByEmail("taro@example.com");

        // Assert
        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("taro");
    }

    @Test
    void shouldReturnEmptyWhenUserNotFound() {
        var found = userRepository.findByEmail("nonexistent@example.com");
        assertThat(found).isEmpty();
    }
}
```

::: details Testcontainersが解決する問題
従来のインテグレーションテストでは、以下のようなアプローチがよく使われていた。

- **共有テストデータベース**: チーム全員が同じテストDBを使うため、テストの並列実行が困難で、データの衝突が起きやすい
- **H2やSQLiteによる代替**: 本番DBとは異なるデータベースエンジンを使うため、SQL方言の違いによるバグを見逃す可能性がある
- **ローカルのDockerコンテナを手動起動**: テスト前にコンテナを起動する手順が必要で、CI環境のセットアップも煩雑

Testcontainersは、テストコード自体がコンテナのライフサイクルを管理するため、「テストを実行するだけで環境が自動的に構築される」という理想を実現する。
:::

### 4.4 API統合テスト

Webアプリケーションのインテグレーションテストでは、HTTPリクエストを送信してAPIの動作を検証することが多い。この際、外部サービスはスタブに置き換えつつ、アプリケーション内部のコンポーネント連携はそのまま検証する。

```typescript
// api-integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { setupDatabase, teardownDatabase } from "./helpers/db";

describe("POST /api/orders", () => {
  beforeAll(async () => {
    await setupDatabase();
  });

  afterAll(async () => {
    await teardownDatabase();
  });

  it("should create an order and return 201", async () => {
    const response = await request(app)
      .post("/api/orders")
      .send({
        userId: "user-1",
        items: [
          { productId: "prod-1", quantity: 2 },
          { productId: "prod-2", quantity: 1 },
        ],
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      status: "pending",
      totalAmount: expect.any(Number),
    });
  });

  it("should return 400 for invalid request body", async () => {
    const response = await request(app)
      .post("/api/orders")
      .send({ userId: "user-1" }) // Missing items field
      .expect(400);

    expect(response.body.error).toBeDefined();
  });

  it("should return 404 for non-existent product", async () => {
    const response = await request(app)
      .post("/api/orders")
      .send({
        userId: "user-1",
        items: [{ productId: "non-existent", quantity: 1 }],
      })
      .expect(404);

    expect(response.body.error).toContain("Product not found");
  });
});
```

### 4.5 インテグレーションテストの注意点

**テストデータの管理**：各テストの開始時にデータを初期化し、テスト間の依存を排除する。トランザクションを使ってテスト終了時にロールバックする方法も有効である。

**実行速度の意識**：インテグレーションテストはユニットテストよりも遅いため、テストの数を厳選する必要がある。「ハッピーパス + 重要なエラーケース」に絞ることが多い。

**環境の再現性**：Testcontainers やDocker Compose を使い、CI環境とローカル環境で同じテストが実行できるようにする。

## 5. E2Eテスト — 定義、スコープ、ツール

### 5.1 E2Eテストの定義

E2E（End-to-End）テストは、ユーザーの視点からシステム全体の動作を検証するテストである。ブラウザを自動操作してUIを操作し、フロントエンドからバックエンド、データベースに至るまでの全レイヤーを通してシステムが正しく動作することを確認する。

```mermaid
graph LR
    subgraph "E2Eテストのスコープ"
        BROWSER["ブラウザ<br/>(自動操作)"]
        FE["フロントエンド<br/>(React/Vue等)"]
        BE["バックエンド<br/>(API)"]
        DB2["データベース"]
        EXT["外部サービス"]
    end

    BROWSER -->|ユーザー操作| FE
    FE -->|API呼び出し| BE
    BE -->|クエリ| DB2
    BE -->|API呼び出し| EXT

    style BROWSER fill:#e74c3c,stroke:#c0392b,color:#fff
    style FE fill:#3498db,stroke:#2980b9,color:#fff
    style BE fill:#2ecc71,stroke:#27ae60,color:#fff
    style DB2 fill:#e67e22,stroke:#d35400,color:#fff
    style EXT fill:#9b59b6,stroke:#8e44ad,color:#fff
```

### 5.2 E2Eテストの価値

E2Eテストは、他のテストレベルでは検出できない以下のような問題を発見できる。

- **ページ遷移の不具合**：画面Aから画面Bへの遷移が正しく動作するか
- **フォームのバリデーション**：フロントエンドとバックエンドのバリデーションが整合しているか
- **認証フローの全体**：ログインからログアウトまでの一連のフロー
- **CSSの影響**：スタイルの変更が意図しない要素を隠してしまっていないか
- **ブラウザ固有の問題**：特定のブラウザでのみ発生する不具合

### 5.3 Playwright によるE2Eテスト

Playwright は、Microsoft が開発したブラウザ自動操作ライブラリであり、Chromium、Firefox、WebKit の三大ブラウザエンジンをサポートする。Cypress と並んでE2Eテストの分野で広く採用されている。

```typescript
// login-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Login Flow", () => {
  test("should login with valid credentials", async ({ page }) => {
    // Navigate to login page
    await page.goto("/login");

    // Fill in credentials
    await page.fill('[data-testid="email-input"]', "user@example.com");
    await page.fill('[data-testid="password-input"]', "secure-password");

    // Click login button
    await page.click('[data-testid="login-button"]');

    // Verify redirect to dashboard
    await expect(page).toHaveURL("/dashboard");

    // Verify welcome message is displayed
    await expect(
      page.locator('[data-testid="welcome-message"]')
    ).toContainText("ようこそ");
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill('[data-testid="email-input"]', "user@example.com");
    await page.fill('[data-testid="password-input"]', "wrong-password");
    await page.click('[data-testid="login-button"]');

    // Verify error message
    await expect(
      page.locator('[data-testid="error-message"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="error-message"]')
    ).toContainText("メールアドレスまたはパスワードが正しくありません");

    // Verify still on login page
    await expect(page).toHaveURL("/login");
  });

  test("should redirect unauthenticated user to login", async ({ page }) => {
    // Try to access protected page directly
    await page.goto("/dashboard");

    // Verify redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
```

### 5.4 Cypress と Playwright の比較

E2Eテストツールとして広く使われている Cypress と Playwright の主な違いを以下にまとめる。

| 特性 | Cypress | Playwright |
|------|---------|------------|
| **ブラウザサポート** | Chromium, Firefox, WebKit（限定的） | Chromium, Firefox, WebKit（完全） |
| **アーキテクチャ** | ブラウザ内で実行 | ブラウザ外からWebSocket経由で制御 |
| **並列実行** | 有料プランで提供 | 標準で並列実行をサポート |
| **言語サポート** | JavaScript/TypeScript | JavaScript/TypeScript, Python, Java, .NET |
| **マルチタブ** | 非サポート | サポート |
| **ネットワーク傍受** | cy.intercept() | page.route() |
| **デバッグ体験** | タイムトラベルデバッグ | Trace Viewer, Inspector |
| **コミュニティ** | 大きい（先行者利益） | 急速に成長中 |

::: tip E2Eテストツールの選定指針
2026年現在、新規プロジェクトでは Playwright を選択するケースが増えている。マルチブラウザの完全サポート、標準での並列実行、多言語対応などの利点がある。一方、Cypress はエコシステムの成熟度やタイムトラベルデバッグのUXで依然として優位性がある。プロジェクトの要件とチームの習熟度に応じて選択するのが望ましい。
:::

### 5.5 E2Eテストの課題と対策

E2Eテストには、ユニットテストやインテグレーションテストにはない固有の課題がある。

**フレイキーテスト（Flaky Tests）**：E2Eテストは外部要因（ネットワーク遅延、DOMの非同期レンダリング、アニメーション等）により、同じテストが成功したり失敗したりする現象が起きやすい。対策として、以下が推奨される。

- 固定のスリープ（`sleep(3000)`）ではなく、明示的な待機（`waitForSelector`、`waitForResponse`）を使う
- テストデータを事前に確定させ、テスト間の依存を排除する
- リトライ機構を設けるが、過度なリトライで問題を隠蔽しない

**実行速度**：E2Eテストはシステム全体を起動するため、1テストあたり数秒から数十秒かかることが珍しくない。テストスイート全体では数十分に及ぶこともある。対策として、テストの並列実行や、変更のあったモジュールに関連するテストのみを実行する仕組み（影響分析）を導入する。

**メンテナンスコスト**：UIの変更（ボタンのラベル変更、レイアウト変更など）がテストに直接影響する。Page Object Model パターンを使って、UIの構造をテストロジックから分離することで、メンテナンスコストを低減できる。

```typescript
// Page Object Model example
class LoginPage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email-input"]', email);
    await this.page.fill('[data-testid="password-input"]', password);
    await this.page.click('[data-testid="login-button"]');
  }

  async getErrorMessage(): Promise<string> {
    return this.page
      .locator('[data-testid="error-message"]')
      .textContent() ?? "";
  }
}

// Test using Page Object
test("should login successfully", async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login("user@example.com", "secure-password");
  await expect(page).toHaveURL("/dashboard");
});
```

## 6. テストトロフィーモデル — Kent C. Dodds の提唱

### 6.1 テストピラミッドへの異論

テストピラミッドは長年にわたり広く受け入れられてきたが、2018年に Kent C. Dodds が提唱した「テストトロフィー（Testing Trophy）」モデルは、これに対する重要な異論を提示した。

テストトロフィーは、テストの投資対効果（ROI）を最大化するために、インテグレーションテストに最も多くの比重を置くべきだと主張する。

```mermaid
graph TB
    subgraph "テストトロフィー"
        E["E2Eテスト<br/>（少数）"]
        I["インテグレーションテスト<br/>（最も多い ★）"]
        U["ユニットテスト<br/>（中程度）"]
        S["静的解析<br/>（TypeScript, ESLint）"]
    end

    E --- I
    I --- U
    U --- S

    style E fill:#e74c3c,stroke:#c0392b,color:#fff
    style I fill:#f39c12,stroke:#e67e22,color:#fff
    style U fill:#27ae60,stroke:#229954,color:#fff
    style S fill:#3498db,stroke:#2980b9,color:#fff
```

### 6.2 テストトロフィーの根拠

Kent C. Dodds がインテグレーションテストを重視する根拠は、次のような洞察に基づいている。

> "The more your tests resemble the way your software is used, the more confidence they can give you."
>
> （テストがソフトウェアの実際の使い方に似ていれば似ているほど、より大きな信頼性を得られる）

**ユニットテストの限界**：ユニットテストは高速で安定しているが、モジュール間の連携のバグを見逃す。すべてのユニットテストが通っていても、モジュールを組み合わせた瞬間にバグが発生することは珍しくない。

**E2Eテストの限界**：E2Eテストは高い信頼性を提供するが、遅くてフレイキーで、デバッグが困難である。

**インテグレーションテストの利点**：インテグレーションテストは、実際のユーザーの操作に近いレベルでテストしつつ、E2Eテストほどの遅さやフレイキーさを回避できる。特にフロントエンド開発においては、React Testing Library のようなツールを使って、コンポーネントの連携を内部実装に依存せずにテストできる。

### 6.3 静的解析を最下層に据える意味

テストトロフィーの最下層には「静的解析」が位置する。これは、TypeScript の型チェックや ESLint のルールチェックが、ユニットテストよりもさらに低コストで広範な問題を検出できることを反映している。

型チェックが検出できる問題の例：
- 存在しないプロパティへのアクセス
- 関数の引数の型の不一致
- null/undefined の未処理
- 使用されていない変数

これらの問題に対してユニットテストを書くのは冗長であり、型システムに任せるべきである。静的解析は「テストを書く前に防げるバグ」を排除する。

### 6.4 テストピラミッドとテストトロフィーの使い分け

テストピラミッドとテストトロフィーは対立する概念ではなく、適用するコンテキストによって使い分けるものである。

| アプローチ | 適しているケース |
|-----------|---------------|
| **テストピラミッド** | バックエンドの複雑なビジネスロジック、マイクロサービス間の連携がシンプルな場合、計算集約型のドメインロジック |
| **テストトロフィー** | フロントエンド開発、コンポーネント間の連携が重要な場合、ユーザーインタラクションが中心のアプリケーション |

::: warning どちらか一方に固執しない
テスト戦略は教条的に特定のモデルに従うべきではない。プロジェクトの特性、チームのスキル、技術スタックに応じて、各レベルのテストの比率を柔軟に調整することが重要である。テストピラミッドもテストトロフィーも、あくまで「出発点としてのメンタルモデル」であり、最適な比率はプロジェクトごとに異なる。
:::

## 7. テスト設計の原則 — AAA, FIRST, テスト可読性

### 7.1 AAAパターン

AAA（Arrange-Act-Assert）パターンは、テストコードの構造化に関する最も基本的な原則である。テストを三つのフェーズに明確に分割することで、テストの可読性を大幅に向上させる。

```typescript
describe("ShoppingCart", () => {
  it("should apply percentage coupon to total", () => {
    // Arrange: Set up test data and dependencies
    const cart = new ShoppingCart();
    cart.addItem({ name: "Book", price: 2000, quantity: 1 });
    cart.addItem({ name: "Pen", price: 500, quantity: 3 });
    const coupon = new PercentageCoupon(10); // 10% off

    // Act: Execute the behavior under test
    cart.applyCoupon(coupon);
    const total = cart.getTotal();

    // Assert: Verify the expected outcome
    expect(total).toBe(3150); // (2000 + 1500) * 0.9 = 3150
  });
});
```

各フェーズの役割は以下の通りである。

- **Arrange（準備）**：テストに必要なオブジェクトを生成し、初期状態を構築する
- **Act（実行）**：テスト対象の振る舞いを実行する。通常、1つの操作に限定する
- **Assert（検証）**：実行結果が期待通りであることを検証する

::: tip Given-When-Then
BDD（Behavior-Driven Development）の文脈では、AAAと同等の概念を **Given-When-Then** として表現する。Given はArrangeに、When はActに、Then はAssertに対応する。表現は異なるが、テストの構造化という目的は同じである。
:::

### 7.2 FIRSTの原則

FIRSTの原則は、良いユニットテストの特性を表す頭字語である。

| 原則 | 意味 | 説明 |
|------|------|------|
| **F**ast | 高速 | テストは素早く実行されるべきである。遅いテストは開発者が頻繁に実行することを避けるようになる |
| **I**ndependent | 独立 | 各テストは他のテストに依存してはならない。実行順序によって結果が変わるテストは信頼できない |
| **R**epeatable | 再現性 | どの環境でも同じ結果が得られるべきである。外部サービスの状態に依存しない |
| **S**elf-validating | 自己検証的 | テストの結果は成功か失敗かのいずれかであるべきで、人間が出力を読んで判断する必要がない |
| **T**imely | 適時 | テストはプロダクションコードの直前または直後に書かれるべきである。後回しにすると書かれなくなる |

### 7.3 テストの可読性

テストコードは「ドキュメント」としての役割を担っている。したがって、テストの可読性はプロダクションコード以上に重要である。以下の原則を意識することで、テストの可読性を向上させることができる。

**テスト名を具体的に書く**：テスト名は「何をテストしているか」と「期待される結果」を明確に示すべきである。

```typescript
// Bad: vague test name
it("should work", () => { /* ... */ });

// Bad: too technical
it("should return true", () => { /* ... */ });

// Good: describes behavior and expected outcome
it("should reject password shorter than 8 characters", () => { /* ... */ });

// Good: describes context and expected behavior
it("should return empty array when no orders exist for the user", () => { /* ... */ });
```

**テスト内のロジックを最小化する**：テストコード内に条件分岐やループを含めると、テスト自体にバグが潜む可能性がある。テストは直線的なコードであるべきである。

```typescript
// Bad: logic in test makes it hard to understand
it("should calculate shipping cost", () => {
  const orders = [
    { weight: 1, destination: "domestic" },
    { weight: 5, destination: "international" },
  ];
  for (const order of orders) {
    const cost = calculateShipping(order);
    if (order.destination === "domestic") {
      expect(cost).toBe(500);
    } else {
      expect(cost).toBe(2000);
    }
  }
});

// Good: separate tests, no logic
it("should charge 500 yen for domestic shipping", () => {
  const cost = calculateShipping({ weight: 1, destination: "domestic" });
  expect(cost).toBe(500);
});

it("should charge 2000 yen for international shipping", () => {
  const cost = calculateShipping({ weight: 5, destination: "international" });
  expect(cost).toBe(2000);
});
```

**マジックナンバーを避ける**：テストコード中の数値や文字列リテラルの意味が不明瞭な場合、変数に名前をつけて意図を明示する。

```typescript
// Bad: magic numbers
expect(calculateTax(10000)).toBe(1000);

// Good: named constants make intent clear
const PRICE = 10000;
const TAX_RATE_10_PERCENT = 0.1;
const EXPECTED_TAX = 1000;
expect(calculateTax(PRICE)).toBe(EXPECTED_TAX);
```

## 8. TDD（テスト駆動開発）の実践

### 8.1 TDDの概要

TDD（Test-Driven Development、テスト駆動開発）は、Kent Beck が *Test-Driven Development: By Example*（2002年）で体系化した開発手法である。「テストを先に書き、そのテストを通すためにプロダクションコードを書く」という、従来の開発プロセスとは逆のアプローチを取る。

### 8.2 Red-Green-Refactor サイクル

TDDの核心は、Red-Green-Refactor と呼ばれる三つのステップの反復である。

```mermaid
graph LR
    RED["🔴 Red<br/>失敗するテストを書く"]
    GREEN["🟢 Green<br/>テストを通す最小のコードを書く"]
    REFACTOR["🔵 Refactor<br/>コードを整理する"]

    RED --> GREEN
    GREEN --> REFACTOR
    REFACTOR --> RED

    style RED fill:#e74c3c,stroke:#c0392b,color:#fff
    style GREEN fill:#27ae60,stroke:#229954,color:#fff
    style REFACTOR fill:#3498db,stroke:#2980b9,color:#fff
```

**Red（赤）**：まず、実装したい振る舞いを記述するテストを書く。この時点ではプロダクションコードが存在しないため、テストは必ず失敗する。テストが失敗することを確認するのは重要なステップであり、「テストが正しく動作している」ことの検証でもある。

**Green（緑）**：テストを通すために、必要最小限のプロダクションコードを書く。ここでのポイントは「最小限」であることだ。美しいコードを書こうとする誘惑に負けず、テストを通すためだけのコードを書く。

**Refactor（リファクタリング）**：テストが通った状態を維持しながら、コードの品質を改善する。重複の除去、命名の改善、責務の分離などを行う。テストが安全ネットとして機能するため、安心してリファクタリングできる。

### 8.3 TDDの実践例：FizzBuzz

TDDの実践例として、FizzBuzz問題を段階的に実装する過程を示す。

**ステップ1：Red — 最初のテスト**

```typescript
// fizzbuzz.test.ts
import { describe, it, expect } from "vitest";
import { fizzbuzz } from "./fizzbuzz";

describe("fizzbuzz", () => {
  it("should return '1' for 1", () => {
    expect(fizzbuzz(1)).toBe("1");
  });
});
```

この時点で `fizzbuzz` 関数は存在しないため、テストは失敗する。

**ステップ2：Green — テストを通す最小実装**

```typescript
// fizzbuzz.ts
export function fizzbuzz(n: number): string {
  return "1";
}
```

明らかにハードコーディングだが、テストは通る。これがTDDの「最小限の実装」である。

**ステップ3：Red — 次のテスト追加**

```typescript
it("should return '2' for 2", () => {
  expect(fizzbuzz(2)).toBe("2");
});
```

ハードコーディングでは対応できないため、実装を一般化する。

**ステップ4：Green — 一般化**

```typescript
export function fizzbuzz(n: number): string {
  return String(n);
}
```

**ステップ5：Red — Fizz のテスト**

```typescript
it("should return 'Fizz' for 3", () => {
  expect(fizzbuzz(3)).toBe("Fizz");
});

it("should return 'Fizz' for 6", () => {
  expect(fizzbuzz(6)).toBe("Fizz");
});
```

**ステップ6：Green — Fizz の実装**

```typescript
export function fizzbuzz(n: number): string {
  if (n % 3 === 0) return "Fizz";
  return String(n);
}
```

このサイクルを Buzz、FizzBuzz と繰り返し、最終的に完全な実装に到達する。

```typescript
// Final implementation after TDD cycles
export function fizzbuzz(n: number): string {
  if (n % 15 === 0) return "FizzBuzz";
  if (n % 3 === 0) return "Fizz";
  if (n % 5 === 0) return "Buzz";
  return String(n);
}
```

### 8.4 TDDの利点と議論

TDDの利点は以下の通りである。

- **テスト可能な設計を自然に導く**：テストを先に書くことで、テストしやすい（つまり疎結合な）設計に自然と導かれる
- **過剰な実装を防ぐ**：テストが要求する以上のコードを書かないため、YAGNI（You Ain't Gonna Need It）原則が自然に守られる
- **デバッグ時間の短縮**：小さなステップで進むため、バグが入り込んだ場所が直前の変更に限定される

一方、TDDに対する批判や議論もある。

- **学習コストが高い**：TDDのサイクルを効果的に回すには、テスト設計のスキルとドメイン知識が必要である
- **すべてのコードに適しているわけではない**：UIのプロトタイピング、探索的なコーディング、データベーススキーマの設計など、仕様が流動的な場面ではTDDは効率が悪いことがある
- **「テストが通れば正しい」という錯覚**：TDDはテストの質を保証しない。不適切なテストに対してTDDを行っても、品質は向上しない

::: details TDDに関するDavid Heinemeier Hanssonの批判
Ruby on Rails の作者である David Heinemeier Hansson（DHH）は、2014年のブログ記事 *TDD is Dead. Long Live Testing.* において、TDDの過度な推進に異議を唱えた。DHHの主な論点は、TDDがテスタビリティのために設計を歪めることがあるという点であった。この記事をきっかけに、Kent Beck、Martin Fowler、DHHの三者による "Is TDD Dead?" というビデオディスカッションが行われ、テスト戦略に関するコミュニティの議論が深まった。

結論として、TDDは「常に使うべき」でも「常に避けるべき」でもなく、状況に応じて判断するべきツールである。重要なのは、テストを書くこと自体であり、テストを書くタイミング（先か後か）は二次的な問題である。
:::

## 9. CI/CDにおけるテスト戦略

### 9.1 CI/CDパイプラインの基本構造

CI/CD（Continuous Integration / Continuous Delivery）パイプラインにおいて、テストは品質ゲートとして機能する。コードの変更がメインブランチにマージされる前に、自動テストによって品質を検証する。

```mermaid
graph LR
    PUSH["コード<br/>Push"]
    LINT["静的解析<br/>(Lint/Type Check)"]
    UNIT["ユニット<br/>テスト"]
    INT2["インテグレーション<br/>テスト"]
    E2E2["E2E<br/>テスト"]
    DEPLOY["デプロイ"]

    PUSH --> LINT
    LINT --> UNIT
    UNIT --> INT2
    INT2 --> E2E2
    E2E2 --> DEPLOY

    style PUSH fill:#95a5a6,stroke:#7f8c8d,color:#fff
    style LINT fill:#3498db,stroke:#2980b9,color:#fff
    style UNIT fill:#27ae60,stroke:#229954,color:#fff
    style INT2 fill:#f39c12,stroke:#e67e22,color:#fff
    style E2E2 fill:#e74c3c,stroke:#c0392b,color:#fff
    style DEPLOY fill:#9b59b6,stroke:#8e44ad,color:#fff
```

### 9.2 テストの段階的実行

CI/CDパイプラインでは、テストをコストの低い順に実行し、早い段階で問題を検出する戦略が有効である。

**第1段階：静的解析（数秒〜数十秒）**

```yaml
# GitHub Actions example
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
    - run: npm ci
    - run: npm run lint        # ESLint
    - run: npm run type-check  # TypeScript compiler
```

型エラーやリントエラーがあれば、この段階で即座にフィードバックが得られる。後続のテスト実行を待つ必要がない。

**第2段階：ユニットテスト（数十秒〜数分）**

```yaml
unit-test:
  needs: lint
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
    - run: npm ci
    - run: npm run test:unit -- --coverage
    - uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: coverage/
```

**第3段階：インテグレーションテスト（数分〜十数分）**

```yaml
integration-test:
  needs: unit-test
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_DB: testdb
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
    - run: npm ci
    - run: npm run test:integration
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/testdb
```

**第4段階：E2Eテスト（十数分〜数十分）**

```yaml
e2e-test:
  needs: integration-test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
    - run: npm ci
    - run: npx playwright install --with-deps
    - run: npm run build
    - run: npm run test:e2e
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

### 9.3 テストの並列化と最適化

CI/CDパイプラインにおけるテスト実行時間を短縮するための戦略がいくつかある。

**テストの並列実行**：テストスイートを複数のワーカーに分割して並列実行する。Vitest は `--pool` オプションで、Playwright は `--workers` オプションで並列数を制御できる。

**影響範囲分析（Impact Analysis）**：変更されたファイルに関連するテストのみを実行する。例えば、Vitest の `--changed` フラグは、git の変更に基づいて対象テストを絞り込む。

**テスト結果のキャッシュ**：変更のないテストの結果をキャッシュし、再実行を回避する。Nx や Turborepo などのモノレポツールがこの機能を提供する。

### 9.4 フレイキーテストの管理

CI/CDにおいて、フレイキーテスト（非決定的に失敗するテスト）は深刻な問題である。フレイキーテストが多いと、開発者はテストの失敗を「またフレイキーか」と無視するようになり、本物のバグを見逃すリスクが高まる。

フレイキーテストへの対処方針は以下の通りである。

1. **フレイキーテストを検出する仕組みを導入する**：同じコミットに対してテストを複数回実行し、結果が不安定なテストを特定する
2. **フレイキーテストを隔離する**：フレイキーであると判明したテストにタグをつけ、CIでは別途実行する（メインパイプラインをブロックしない）
3. **根本原因を修正する**：フレイキーテストの原因を調査し、修正する。タイミング依存、テスト間のデータ共有、外部サービスへの依存などが典型的な原因である
4. **修正が困難なら削除も検討する**：フレイキーなテストは「信頼できないテスト」であり、信頼を損なうテストはないほうがマシである場合もある

## 10. テスト戦略の現実的な指針

### 10.1 プロジェクトのフェーズに応じた戦略

テスト戦略は、プロジェクトのフェーズに応じて変化すべきものである。

**スタートアップ・MVP段階**：仕様が流動的なため、テストに過度に投資するとテストの書き直しが頻発する。この段階では、コアビジネスロジックのユニットテストと、主要フローのE2Eテスト（スモークテスト）に限定するのが現実的である。

**成長段階**：機能が増え、リグレッションのリスクが高まる。インテグレーションテストを充実させ、テストカバレッジを計測・管理し始める。CI/CDパイプラインにテストを組み込み、自動化を推進する。

**安定・運用段階**：テストスイートが充実し、変更に対する信頼性が高い状態を目指す。パフォーマンステストやセキュリティテストも検討する。

### 10.2 何をテストするかの判断基準

限られたリソースでテストの価値を最大化するには、テストの対象を戦略的に選ぶ必要がある。以下の基準が参考になる。

**ビジネスリスクが高い機能を優先する**：決済処理、認証、個人情報の取り扱いなど、バグが発生した場合のビジネスインパクトが大きい機能は、手厚くテストする。

**変更頻度が高い箇所を優先する**：頻繁に変更される箇所はリグレッションのリスクが高い。テストによる保護が特に重要である。

**複雑なロジックを優先する**：条件分岐が多い、エッジケースが多い、計算が複雑——こうした箇所はバグが潜みやすく、テストの価値が高い。

**接合部（Seam）をテストする**：モジュール間の境界、API の入出力、データ変換の処理など、異なるコンポーネントが交わる箇所をインテグレーションテストで検証する。

### 10.3 テストカバレッジの考え方

コードカバレッジは有用な指標だが、その解釈には注意が必要である。

```mermaid
graph TD
    COV["コードカバレッジ"]
    COV --> LINE["行カバレッジ<br/>(Line Coverage)"]
    COV --> BRANCH["分岐カバレッジ<br/>(Branch Coverage)"]
    COV --> FUNC["関数カバレッジ<br/>(Function Coverage)"]
    COV --> STMT["文カバレッジ<br/>(Statement Coverage)"]

    style COV fill:#3498db,stroke:#2980b9,color:#fff
    style LINE fill:#e67e22,stroke:#d35400,color:#fff
    style BRANCH fill:#2ecc71,stroke:#27ae60,color:#fff
    style FUNC fill:#9b59b6,stroke:#8e44ad,color:#fff
    style STMT fill:#e74c3c,stroke:#c0392b,color:#fff
```

**カバレッジの高さは品質を保証しない**：100%のカバレッジを達成していても、テストのアサーションが不適切であれば意味がない。アサーションなしでコードを実行するだけのテスト（いわゆる「カバレッジ稼ぎ」）は、偽りの安心感を与えるだけである。

**カバレッジの低さは問題のシグナルである**：カバレッジが極端に低い（20%以下など）場合、テストされていない重要なコードパスが存在する可能性が高い。カバレッジは「テストが不足している箇所を見つけるツール」として活用するのが正しい。

**現実的な目標値**：多くのプロジェクトでは、行カバレッジ 70〜85% 程度を目標とすることが多い。100%を目指す必要はないが、重要なビジネスロジックのカバレッジは 90% 以上を維持することが望ましい。

### 10.4 テスト文化の構築

テスト戦略は技術的な側面だけでなく、組織文化の側面も重要である。

**コードレビューでテストもレビューする**：プルリクエストにテストが含まれていない変更を受け入れない文化を作る。テストの質もレビューの対象とする。

**テストの実行を容易にする**：テストの実行方法が煩雑だと、開発者はテストを避けるようになる。`npm test` の一コマンドですべてのテストが実行できる状態を維持する。

**テストの失敗を放置しない**：CIで失敗しているテストを「いつか直す」と放置すると、テストスイート全体の信頼性が崩壊する。テストの失敗は最優先で修正する。

**テストを書くことを評価する**：機能の実装と同様に、テストの記述やテストインフラの改善を評価する組織文化が重要である。

## 11. まとめ

テスト戦略は、ソフトウェアの品質を効率的に担保するための体系的なアプローチである。本記事で扱った主要な概念を振り返る。

**テストの三つのレベル**は、それぞれ異なるスコープとトレードオフを持つ。ユニットテストは高速で安定しているが検証範囲が狭い。インテグレーションテストはコンポーネント間の連携を検証できるがセットアップが必要である。E2Eテストはシステム全体を検証できるが遅くてフレイキーになりやすい。

**テストピラミッド**は、下層ほどテスト数を多く、上層ほど少なくすることを推奨する古典的なモデルである。**テストトロフィー**は、インテグレーションテストに最も多くの比重を置くことを推奨する、より現代的なモデルである。いずれも絶対的な正解ではなく、プロジェクトの特性に応じて使い分けるべきである。

**テストダブル**（Stub, Mock, Spy, Fake）は、外部依存を制御してテストを独立させるための技法であり、特にユニットテストで重要な役割を果たす。

**TDD**は、テストを先に書くことで設計品質を向上させる開発手法であるが、すべてのケースに適用すべきものではない。

**CI/CDパイプライン**において、テストは段階的に実行し、コストの低いテストから高いテストへと進むことで、迅速なフィードバックを実現する。

最終的に、テスト戦略の目的は「バグのないソフトウェアを作ること」ではなく、「変更に対する信頼性（Confidence in Change）を確保すること」である。テストは、開発者が安心してコードを変更し、迅速にリリースするための基盤であり、ソフトウェア開発の持続可能性を支える不可欠な要素である。
