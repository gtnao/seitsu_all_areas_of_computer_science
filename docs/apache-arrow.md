---
title: "Apache Arrow と列指向インメモリフォーマット"
date: 2026-03-02
tags: ["data-engineering", "apache-arrow", "columnar", "in-memory", "performance", "intermediate"]
---

# Apache Arrow と列指向インメモリフォーマット

## 1. 背景：データ処理における「コピー地獄」

### 1.1 問題の本質

現代のデータ分析スタックは、多様なツールの組み合わせで構成されている。PythonのPandasでデータを読み込み、機械学習ライブラリで前処理を行い、可視化ツールで描画する。あるいは、データウェアハウスからJDBCドライバでデータを取得し、分析ツールに渡す——こうしたパイプラインの随所で、**データのコピーとシリアライズ/デシリアライズ**が繰り返されている。

この問題がどれほど深刻かを理解するために、ある典型的なシナリオを考えよう。Sparkで処理したデータフレームをPandasに渡す場合、内部で何が起きているか。

1. SparkのJVMメモリ上にあるオブジェクト群をシリアライズする
2. プロセス境界を越えてPy4Jを経由してPythonプロセスに転送する
3. PythonのPickleフォーマットを経由してデシリアライズする
4. PandasのDataFrameとしてメモリに再配置する

このプロセスは、データそのものの処理よりも「データの移動」にCPUとメモリを大量消費する。ベンチマークでは、実際の計算時間の80%以上がこのようなデータ変換に費やされているケースも珍しくない。

### 1.2 既存のデータ交換フォーマットの限界

問題の根本は、各システムが**独自のインメモリ表現**を持っていることにある。

- Pandas：NumPy配列ベースの行志向に近い内部表現
- Apache Spark：JVMオブジェクト群またはTungsten（オフヒープバイナリフォーマット）
- R：base Rのベクトル型
- Julia：独自の配列型
- Arrow以前のParquet読み込みライブラリ：それぞれ独自デシリアライズ

$N$ 種類のシステムが相互運用しようとすると、最悪の場合 $N^2$ 通りの変換コードが必要になる（いわゆる $N \times N$ 問題）。

```mermaid
graph TB
    subgraph "Arrow 以前：N×N 問題"
        P1[Pandas] <-->|変換| S1[Spark]
        P1 <-->|変換| R1[R]
        S1 <-->|変換| R1
        P1 <-->|変換| J1[Julia]
        S1 <-->|変換| J1
        R1 <-->|変換| J1
    end

    subgraph "Arrow 以後：共通フォーマット"
        P2[Pandas / PyArrow] -->|Arrow フォーマット| A[Apache Arrow]
        S2[Spark] -->|Arrow フォーマット| A
        R2[R arrow pkg] -->|Arrow フォーマット| A
        J2[Julia] -->|Arrow フォーマット| A
        A -->|ゼロコピー| P2
        A -->|ゼロコピー| S2
        A -->|ゼロコピー| R2
        A -->|ゼロコピー| J2
    end
```

### 1.3 Apache Arrow の誕生

Apache Arrow は、こうした「コピー地獄」を根本から解決するために設計された。2016年にApache Software Foundationのトップレベルプロジェクトとして発足し、Wes McKinney（Pandasの作者）やJacques Nadeau（Apache Drillの共同創設者）らが主導した。

Arrowの核心的な目標は明快である。**「すべての言語とシステムが共有できる、列指向のインメモリフォーマット」** を定義することで、データのコピーとシリアライズを最小化する。

> [!NOTE]
> Apache Arrow はストレージフォーマット（ParquetやORCのような永続化形式）ではなく、**インメモリフォーマット**である。ディスクに保存するためのフォーマットとしてArrow IPCが存在するが、それはあくまで副次的な用途である。Arrowの本質は、メモリ上でのデータ表現の標準化にある。

## 2. 列指向 vs 行指向：メモリレイアウトの本質

### 2.1 行指向レイアウト

従来のリレーショナルデータベースやオブジェクトの配列は、**行指向（row-oriented）** のメモリレイアウトを採用している。1行のすべてのフィールドが連続したメモリアドレスに格納される。

```
行指向（Row-oriented）
+-------+-------+------+
| name  | age   | score|
+-------+-------+------+
| "Alice" | 30  | 95.5 |  ← 行1が連続したメモリ領域に
| "Bob"   | 25  | 87.2 |  ← 行2が連続したメモリ領域に
| "Carol" | 32  | 91.0 |  ← 行3が連続したメモリ領域に
+-------+-------+------+

メモリ上: [Alice][30][95.5][Bob][25][87.2][Carol][32][91.0]
```

行指向は、1件のレコードをまるごと読み書きするOLTP（Online Transaction Processing）ワークロードに適している。例えば「Aliceのすべてのフィールドを取得する」という操作は、連続したメモリ領域を1度読めばよい。

しかし、分析クエリでは話が変わる。「全ユーザーのageカラムの平均を計算する」という操作では、行指向レイアウトの場合、name、score といった不要なフィールドもメモリから読み込む必要がある。これはCPUキャッシュの無駄遣いであり、OLAP（Online Analytical Processing）には不向きである。

### 2.2 列指向レイアウト

**列指向（column-oriented）** レイアウトでは、各カラムのすべての値が連続したメモリアドレスに格納される。

```
列指向（Column-oriented）
name バッファ:  [Alice][Bob][Carol]
age バッファ:   [30][25][32]
score バッファ: [95.5][87.2][91.0]

メモリ上（ageバッファ）: [30][25][32] ← 連続した整数配列
```

「全ユーザーのageの平均を計算する」操作では、ageバッファだけを読み込めばよい。これにより：

1. **キャッシュ効率の向上**：必要なデータのみがCPUキャッシュに乗る
2. **圧縮効率の向上**：同じ型・近い値のデータが連続しているため、Run-Length EncodingやDictionary Encodingが高効率で機能する
3. **SIMD命令の活用**：同一型の連続データに対して、CPUのSIMD命令が1命令で複数要素を同時処理できる

```mermaid
graph LR
    subgraph "行指向のAGE集計"
        direction TB
        R1["[Alice,30,95.5]"] -->|読み込み| C1[age=30抽出]
        R2["[Bob,25,87.2]"] -->|読み込み| C2[age=25抽出]
        R3["[Carol,32,91.0]"] -->|読み込み| C3[age=32抽出]
        note1["不要なnameとscoreも\nメモリから読み込む"]
    end

    subgraph "列指向のAGE集計"
        direction TB
        COL["[30, 25, 32]（ageバッファのみ）"] -->|SIMD演算| SUM[合計=87]
        note2["必要なageカラムのみ\nキャッシュ効率が高い"]
    end
```

### 2.3 なぜインメモリで列指向か

ParquetやORCといった列指向**ストレージ**フォーマットは以前から存在していた。しかし、これらはディスクI/O最適化のために設計されており、**インメモリ処理に最適化**されているわけではない。

例えばParquetは、エンコーディング（Bit Packing、RLEなど）を多用してディスク容量を削減するが、その分CPUデコードコストが高い。また、ランダムアクセスに最適化されていない。

Apache Arrow は、デコードなしに直接CPUが処理できる形式を定義している。**64バイトアラインメント**、**ゼロコピーのスライス操作**、**SIMDフレンドリーな連続バッファ**——これらの設計判断はすべて、メモリ上での高速演算を最優先にしている。

## 3. Arrow のデータ型とバッファレイアウト

### 3.1 物理バッファの種類

Arrow の列（チャンク）は、最大3種類のバッファで構成される。

```mermaid
graph TD
    subgraph "Arrow 列の物理構成"
        V["Validity Bitmap バッファ<br/>（NULL マスク）"]
        O["Offset バッファ<br/>（可変長型のみ）"]
        D["Data バッファ<br/>（実際の値）"]
    end
```

**Validity Bitmap（有効性ビットマップ）**

NULLを表現するためのビットマップである。$i$ 番目のビットが1なら第 $i$ 要素はNULL以外（有効）、0ならNULL。1バイトで8要素のNULL情報を格納できる。

```
要素:          [1,   NULL, 3,   4,   NULL, 6   ]
Validity bits: [1,   0,    1,   1,   0,    1   ]
               = 0b110110 = 0x36
```

ビットマップ方式を採用することで、NULL値をデータバッファ本体に影響を与えず表現できる。NULL値の場所にも適当な値（通常は0）が格納されており、SIMD演算時に分岐なく処理できる。

**Data バッファ（固定長型）**

Int32、Float64 などの固定長型では、値が連続したメモリ領域に格納される。

```
Int32配列 [1, 2, 3, 4, 5]:
バイト:  [01 00 00 00] [02 00 00 00] [03 00 00 00] [04 00 00 00] [05 00 00 00]
         ↑ little-endian で格納
アドレス: 0x00         0x04         0x08         0x0C         0x10
```

各要素が均一サイズなため、$i$ 番目の要素は `base_ptr + i * element_size` で $O(1)$ アクセスできる。

**Offset バッファ + Data バッファ（可変長型）**

StringやBinary等の可変長型では、Offsetバッファ（Int32またはInt64の配列）と実際のバイト列（Dataバッファ）の2つで表現する。

```
String配列 ["foo", "bar", "baz"]:

Offset バッファ: [0, 3, 6, 9]
Data バッファ:   [f, o, o, b, a, r, b, a, z]

$i$ 番目の文字列 = Data[Offset[i] .. Offset[i+1]]
"foo" = Data[0..3] = "foo"
"bar" = Data[3..6] = "bar"
"baz" = Data[6..9] = "baz"
```

このレイアウトにより、ポインタのチェイシング（pointer chasing）を排除し、キャッシュフレンドリーな文字列アクセスを実現している。

### 3.2 ネスト型のレイアウト

Arrow は、List、Struct、Map、Union などのネスト型もサポートしている。

**List型** は、Offsetバッファ + 子配列（child array）で表現する。

```
List<Int32> 配列 [[1,2,3], [4,5], [6]]:

Offset バッファ: [0, 3, 5, 6]
子配列（Int32）: [1, 2, 3, 4, 5, 6]

インデックス 0: 子配列[0..3] = [1, 2, 3]
インデックス 1: 子配列[3..5] = [4, 5]
インデックス 2: 子配列[5..6] = [6]
```

**Struct型** は、各フィールドが独立した子配列として格納される。これにより、特定のフィールドのみを読む場合にも列指向の恩恵を受けられる。

```
Struct<name: String, age: Int32> 配列:
  name 子配列: ["Alice", "Bob", "Carol"]
  age  子配列: [30, 25, 32]
```

### 3.3 64バイトアラインメントとパディング

Arrow の仕様では、各バッファは**64バイト境界にアラインされる**ことが推奨されている（最低8バイト）。64バイトはAVX-512のレジスタ幅（512ビット = 64バイト）に対応しており、最新のSIMD命令が最大効率で動作するためのアラインメントである。

また、バッファのバイト数は8バイトの倍数となるようにパディングされる（実際の要素数分より多くのメモリを確保）。これにより、境界チェックなしにSIMD命令でバッファ末尾を処理できる。

> [!TIP]
> 64バイトアラインメントはSIMD最適化のためだけでなく、**ゼロコピー共有**にも重要である。mmap で共有メモリ領域にバッファをマッピングする際、ページ境界へのアラインメントが効率的なメモリマッピングを可能にする。

### 3.4 RecordBatch と Schema

Arrow の基本的なデータ単位は **RecordBatch** である。RecordBatch は、同じスキーマを持つ列の集合であり、横方向に同じ行数を持つ。

```mermaid
classDiagram
    class Schema {
        +Field[] fields
        +Metadata metadata
    }
    class Field {
        +String name
        +DataType type
        +bool nullable
    }
    class RecordBatch {
        +Schema schema
        +Array[] columns
        +int num_rows
    }
    class Array {
        +DataType type
        +Buffer validity_bitmap
        +Buffer[] buffers
        +Array[] children
    }
    Schema --> "1..*" Field
    RecordBatch --> Schema
    RecordBatch --> "1..*" Array
```

複数の RecordBatch を縦に連結したものが **Table** であり、これが Arrow の最も高レベルなデータコンテナとなる。

## 4. Arrow IPC：シリアライズフォーマット

### 4.1 IPC の設計思想

Arrow IPC（Inter-Process Communication）は、Arrow フォーマットのデータをプロセス間またはファイルに保存・転送するための仕様である。核心的な設計思想は**ゼロコピーデシリアライズ**だ。

通常のシリアライズフォーマット（Protocol Buffers、JSON など）は、受信側がバイト列を解析してオブジェクトを再構築するための時間を要する。これに対し Arrow IPC は、シリアライズ済みデータを**そのままメモリにマッピング**すれば、デシリアライズなしに直接アクセスできるよう設計されている。

```mermaid
sequenceDiagram
    participant Writer as プロセス A（Writer）
    participant Buffer as 共有バッファ / ファイル
    participant Reader as プロセス B（Reader）

    Writer->>Buffer: Schema Message（FlatBuffers）
    Writer->>Buffer: RecordBatch Message（FlatBuffers ヘッダー + データバッファ）

    Note over Reader: ゼロコピーモード
    Reader->>Buffer: mmap でバッファをマッピング
    Reader->>Reader: FlatBuffers ヘッダーを解析（ポインタ取得のみ）
    Reader->>Buffer: データバッファへ直接アクセス（コピーなし）
```

メタデータの表現には **FlatBuffers** を使用している。FlatBuffers はデシリアライズ不要なバイナリシリアライズフォーマットであり、バイト列中の特定フィールドへ $O(1)$ でアクセスできる。これがゼロコピーデシリアライズを可能にしている核心技術である。

### 4.2 IPC Stream フォーマット

**Arrow IPC Stream** は、連続したストリームとして RecordBatch を送信するフォーマットである。

```
[Schema Message]
[RecordBatch Message 1]
[RecordBatch Message 2]
...
[EOS (End of Stream) Marker]
```

各メッセージは：

```
+------------------+
| Continuation     |  4バイト（0xFFFFFFFF）
+------------------+
| Metadata Length  |  4バイト（FlatBuffersメタデータのサイズ）
+------------------+
| Metadata         |  FlatBuffers エンコードのメタデータ
+------------------+
| Body             |  実際のバッファデータ（64バイトアライン済み）
+------------------+
```

### 4.3 IPC File フォーマット（Feather V2）

**Arrow IPC File**（旧称 Feather V2）は、ランダムアクセスを可能にしたファイルフォーマットである。

```
[Magic: "ARROW1"]
[RecordBatch 1]
[RecordBatch 2]
...
[Footer（全 RecordBatch のオフセット情報）]
[Footer Length]
[Magic: "ARROW1"]
```

ファイル末尾の Footer に全 RecordBatch のオフセットが記録されているため、任意の RecordBatch に O(1) でシークできる。Parquet と異なり、デコードを必要とせず、mmap でファイルをメモリにマッピングすれば即座にデータアクセスできる。

> [!NOTE]
> **Feather V1** は Arrow 以前に Wes McKinney と Hadley Wickham が独自に設計したフォーマットで、Arrow IPC File フォーマットとは互換性がない。**Feather V2** が Arrow IPC File の別名である。Feather V1 は現在では非推奨である。

### 4.4 Parquet との使い分け

| 観点 | Arrow IPC File（Feather V2） | Apache Parquet |
|------|------------------------------|----------------|
| 主な用途 | インメモリキャッシュ、高速IPC | 長期ストレージ、データレイク |
| 読み取り速度 | 極めて高速（ゼロコピー） | デコードが必要（中程度） |
| 圧縮率 | 低〜中 | 高 |
| ランダムアクセス | Row Group 単位で可 | Row Group + Column Chunk 単位で可 |
| スキーマ表現力 | Arrow の全型をサポート | 型マッピングが必要な場合あり |
| 相互運用性 | Arrow エコシステム内 | 業界標準（幅広いサポート） |

## 5. Arrow Flight：gRPC ベースの高速データ転送

### 5.1 Arrow Flight の設計動機

従来、データベースからクライアントにデータを転送するプロトコルは、JDBC/ODBC が事実上の標準であった。しかし JDBC/ODBC には深刻なボトルネックがある。

1. **行単位の転送**：JDBC は1行ずつデータを取得する設計であり、大量データの転送に不向き
2. **シリアライズコスト**：Java オブジェクトへの変換コストが高い
3. **スケーラビリティの欠如**：並列データ転送の標準的な方法がない

Arrow Flight は、これらの問題を根本から解決するために設計された、**Arrow フォーマットネイティブのデータ転送プロトコル**である。

### 5.2 Arrow Flight のアーキテクチャ

Arrow Flight は gRPC（HTTP/2 ベース）上に構築されており、双方向ストリーミングを活用する。

```mermaid
sequenceDiagram
    participant Client
    participant FlightServer as Arrow Flight Server

    Client->>FlightServer: GetFlightInfo（クエリ送信）
    FlightServer->>Client: FlightInfo（エンドポイント一覧 + スキーマ）

    Note over Client,FlightServer: 並列ストリーミング取得

    par Stream 1
        Client->>FlightServer: DoGet（Ticket 1）
        FlightServer-->>Client: RecordBatch Stream（Arrow IPC）
    and Stream 2
        Client->>FlightServer: DoGet（Ticket 2）
        FlightServer-->>Client: RecordBatch Stream（Arrow IPC）
    end

    Note over Client: Arrow フォーマットのまま受信<br/>デシリアライズ不要
```

主要な RPC メソッド：

- **ListFlights**：利用可能なデータセット一覧を返す
- **GetFlightInfo**：特定のクエリ・データセットのメタデータとエンドポイントを返す
- **GetSchema**：スキーマ情報のみを取得する
- **DoGet**：サーバーからクライアントへデータをストリーミング転送する
- **DoPut**：クライアントからサーバーへデータをストリーミング転送する
- **DoExchange**：双方向ストリーミング（クエリの中間データ転送など）
- **DoAction**：任意のコマンド実行（カスタム操作）

### 5.3 並列転送によるスケーラビリティ

Arrow Flight の最大の特徴の一つが、**並列エンドポイント**による水平スケーリングである。`GetFlightInfo` の応答には、複数の `Endpoint`（ホスト:ポート + Ticket のペア）が含まれる。クライアントはこれらのエンドポイントに並行して `DoGet` を実行し、データを並列ストリーミング取得できる。

```python
import pyarrow.flight as flight

client = flight.FlightClient("grpc://dataserver:8815")

# 1. クエリを送信してフライト情報を取得
descriptor = flight.FlightDescriptor.for_command(b"SELECT * FROM large_table")
info = client.get_flight_info(descriptor)

# 2. 複数エンドポイントを並列取得
import concurrent.futures

def fetch_endpoint(endpoint):
    # Each endpoint may be on a different server node
    ep_client = flight.FlightClient(endpoint.locations[0])
    reader = ep_client.do_get(endpoint.ticket)
    return reader.read_all()  # Returns an Arrow Table

with concurrent.futures.ThreadPoolExecutor() as executor:
    tables = list(executor.map(fetch_endpoint, info.endpoints))

# 3. 全エンドポイントの結果を結合
import pyarrow as pa
result = pa.concat_tables(tables)
```

### 5.4 JDBC との性能比較

Dremio のベンチマーク（TPC-H ベース）では、Arrow Flight は JDBC と比較して以下の性能を示している：

- **スループット**：JDBC の約20〜50倍のデータ転送速度
- **CPU使用率**：シリアライズコストが低減されるため、同スループットなら低CPU使用率

これは主に：
1. Arrow フォーマットのデータがネイティブにストリーミングされる（デシリアライズなし）
2. HTTP/2 の多重化により並列ストリームが効率的に処理される
3. 行単位ではなく RecordBatch 単位（数千〜数万行）の転送

という要因による。

> [!TIP]
> Arrow Flight SQL は、Arrow Flight の上に SQL クエリのセマンティクスを追加した拡張仕様である。JDBC/ODBC のドロップイン代替として機能し、既存のBIツールから Arrow Flight の高速性を活用できる。DuckDB、Dremio、Voltron Data などがサポートしている。

## 6. SIMD/ベクトル化演算との親和性

### 6.1 SIMD とは何か

SIMD（Single Instruction, Multiple Data）は、1つの命令で複数のデータ要素を同時に処理するCPU機能である。

```
スカラー演算（従来）:
  a[0] + b[0] = c[0]  ← 1命令
  a[1] + b[1] = c[1]  ← 1命令
  a[2] + b[2] = c[2]  ← 1命令
  a[3] + b[3] = c[3]  ← 1命令

SIMD演算（SSE/AVX）:
  [a[0], a[1], a[2], a[3]] + [b[0], b[1], b[2], b[3]] = [c[0], c[1], c[2], c[3]]
  ↑ 1命令で4要素を同時処理（128ビットSIMD / float32の場合）
```

主要なSIMD命令セット：

| 命令セット | レジスタ幅 | Int32の同時処理数 | Float64の同時処理数 |
|-----------|-----------|-----------------|-------------------|
| SSE2      | 128ビット  | 4               | 2                 |
| AVX2      | 256ビット  | 8               | 4                 |
| AVX-512   | 512ビット  | 16              | 8                 |

### 6.2 なぜ Arrow のレイアウトが SIMD に最適か

SIMD 命令が効率よく動作するためには、処理対象のデータが**連続したメモリアドレスに均一な型で格納**されている必要がある。

Arrow の列指向フォーマットはこれを完璧に満たす。例えば、Float64 カラムの合計を計算する場合：

```python
# PyArrow + Arrow Compute による高速合計
import pyarrow as pa
import pyarrow.compute as pc

# 1億要素の Float64 配列
arr = pa.array(range(100_000_000), type=pa.float64())

# 内部的には AVX-512 SIMD 命令で計算
result = pc.sum(arr)
```

Arrow の Float64 バッファは：
- 64バイトアライン済み（AVX-512 の境界に一致）
- 連続したメモリ領域に Pure な Float64 値が格納
- NULL は Validity Bitmap で別管理（データバッファに分岐なし）

これにより、コンパイラやランタイムが自動的に SIMD 命令（`vmovapd`、`vaddpd` など）を生成できる。

### 6.3 Validity Bitmap の SIMD 最適化

Validity Bitmap が SIMD 演算でどう機能するかを見てみよう。

NULL を含む配列の合計計算の場合：

```
Validity Bitmap: [1, 1, 0, 1, 1, 0, 1, 1]  （0 = NULL）
Data バッファ:   [1.0, 2.0, 0.0, 4.0, 5.0, 0.0, 7.0, 8.0]
                        ↑NULL位置にも0.0が入っている

SIMD 合計計算:
  step1: データを全てSIMDレジスタに load（分岐なし）
  step2: Bitmap を mask レジスタに load
  step3: masked add 命令で NULL 位置をスキップ
  結果: 1.0 + 2.0 + 4.0 + 5.0 + 7.0 + 8.0 = 27.0
```

NULL 処理のために条件分岐がなく、SIMD mask 命令（AVX-512 の `_mm512_mask_add_pd` など）でベクタライズされたまま処理できる。

## 7. Arrow Compute Functions

### 7.1 Arrow Compute とは

Arrow Compute は、Arrow 配列・テーブルに対する演算関数のライブラリである。PyArrow の `pyarrow.compute`（`pc`）モジュールから利用できる。内部的には C++ で実装されており、SIMD 最適化が施されている。

### 7.2 主要な Compute 関数

```python
import pyarrow as pa
import pyarrow.compute as pc

# サンプルデータ
ages = pa.array([30, 25, 32, 28, 35, None, 27], type=pa.int32())
scores = pa.array([95.5, 87.2, 91.0, 78.3, 92.1, 88.0, None], type=pa.float64())
names = pa.array(["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace"])

# 算術演算
doubled_scores = pc.multiply(scores, 2.0)
normalized = pc.divide(pc.subtract(scores, pc.min(scores)),
                       pc.subtract(pc.max(scores), pc.min(scores)))

# 集計関数
mean_age = pc.mean(ages)            # NULL を自動的に無視
sum_scores = pc.sum(scores)
std_dev = pc.stddev(ages)

# 比較・フィルタ
high_scorers = pc.greater(scores, 90.0)      # BooleanArray
filtered = pc.filter(names, high_scorers)    # ["Alice", "Carol", "Eve"]

# 文字列操作
upper_names = pc.utf8_upper(names)
lengths = pc.utf8_length(names)
starts_with_a = pc.starts_with(names, "A")

# ソート
sort_indices = pc.sort_indices(ages)         # ソート順のインデックス配列
sorted_names = pc.take(names, sort_indices)  # インデックスで値を取得

# グループ集計（PyArrow 12.0+）
table = pa.table({"name": names, "age": ages, "score": scores})
grouped = table.group_by("age").aggregate([("score", "mean"), ("name", "count")])
```

### 7.3 Acero：Arrow の実行エンジン

Arrow には **Acero**（旧称 Arrow Compute Engine）という実行エンジンが組み込まれている。Acero は、複数の Compute 関数を組み合わせた**実行プラン（ExecPlan）**を構築・最適化・実行する。

```mermaid
graph TD
    subgraph "Acero ExecPlan"
        SRC["Source ノード<br/>（ファイル読み込み / メモリバッファ）"]
        FILT["Filter ノード<br/>age > 25"]
        PROJ["Project ノード<br/>name, score * 1.1 AS adjusted_score"]
        AGG["Aggregate ノード<br/>GROUP BY name, SUM(adjusted_score)"]
        SINK["Sink ノード<br/>（結果出力）"]

        SRC --> FILT --> PROJ --> AGG --> SINK
    end
```

Acero を直接利用するのは主に C++/Python の低レベル API からだが、DuckDB や DataFusion のような上位システムが Arrow の実行基盤として活用している。

## 8. DuckDB、Polars、DataFusion との統合

### 8.1 Arrow エコシステムの全体像

```mermaid
graph TB
    subgraph "データソース"
        PARQUET[Parquet Files]
        CSV[CSV Files]
        DATABASES[Databases]
        KAFKA[Kafka / Streaming]
    end

    subgraph "Arrow コア"
        ARROW_FORMAT[Arrow In-Memory Format]
        ARROW_IPC[Arrow IPC / Feather]
        FLIGHT[Arrow Flight]
    end

    subgraph "処理エンジン"
        DUCKDB[DuckDB]
        POLARS[Polars]
        DATAFUSION[DataFusion]
        SPARK[Apache Spark]
    end

    subgraph "言語バインディング"
        PYARROW[PyArrow]
        R_ARROW[R arrow pkg]
        JAVA[Java Arrow]
        GO[Go Arrow]
    end

    PARQUET --> ARROW_FORMAT
    CSV --> ARROW_FORMAT
    DATABASES --> FLIGHT
    KAFKA --> ARROW_FORMAT

    ARROW_FORMAT <--> DUCKDB
    ARROW_FORMAT <--> POLARS
    ARROW_FORMAT <--> DATAFUSION
    ARROW_FORMAT <--> SPARK

    ARROW_FORMAT <--> PYARROW
    ARROW_FORMAT <--> R_ARROW
    ARROW_FORMAT <--> JAVA
    ARROW_FORMAT <--> GO

    FLIGHT --> PYARROW
    ARROW_IPC --> PYARROW
```

### 8.2 DuckDB と Arrow

DuckDB は、Arrow との深い統合で知られている。DuckDB は Arrow テーブルをそのまま SQL クエリのテーブルとして扱え、**ゼロコピーでデータにアクセス**できる。

```python
import duckdb
import pyarrow as pa
import pyarrow.parquet as pq

# Parquet ファイルを Arrow テーブルとして読み込む
arrow_table = pq.read_table("large_dataset.parquet")

# DuckDB でゼロコピーアクセス（コピーなしで SQL 処理）
conn = duckdb.connect()
result = conn.execute("""
    SELECT
        category,
        COUNT(*) as cnt,
        AVG(value) as avg_val
    FROM arrow_table
    WHERE value > 100
    GROUP BY category
    ORDER BY cnt DESC
""").fetch_arrow_table()  # 結果も Arrow テーブルとして返す

# result は Arrow Table オブジェクト — コピーなし
print(result.schema)
```

DuckDB の内部は、Arrow の列指向フォーマットをネイティブに扱える Vectorized Execution Engine で構成されており、Arrow バッファを直接参照して SIMD 最適化済みのベクトル演算を行う。

### 8.3 Polars と Arrow

Polars は Rust で実装された高性能 DataFrame ライブラリであり、Arrow2（後に arrow-rs、Arrow の Rust 実装）をバックエンドとして採用している。

```python
import polars as pl
import pyarrow as pa

# PyArrow Table から Polars DataFrame への変換（ゼロコピー）
arrow_table = pa.table({
    "name": ["Alice", "Bob", "Carol"],
    "score": [95.5, 87.2, 91.0],
    "age": [30, 25, 32]
})

# Arrow フォーマットを共有するため、コピーは最小限
df = pl.from_arrow(arrow_table)

# Polars の Lazy API で最適化されたクエリ
result = (
    df.lazy()
    .filter(pl.col("score") > 88.0)
    .with_columns([
        (pl.col("score") * 1.05).alias("adjusted_score")
    ])
    .group_by("age")
    .agg([
        pl.col("score").mean().alias("avg_score"),
        pl.col("name").count().alias("count")
    ])
    .collect()
)

# Polars から Arrow への変換（ゼロコピー）
back_to_arrow = result.to_arrow()
```

Polars が高速な理由の一つは、Arrow バッファを直接 Rust の SIMD 最適化コードで処理できることにある。Rust の LLVM バックエンドが AVX2/AVX-512 命令を自動生成し、Python のオーバーヘッドなしにデータを処理する。

### 8.4 DataFusion と Arrow

Apache DataFusion は、Rust 製の Arrow ネイティブなクエリ実行エンジンである。Arrow のコリポジトリに含まれており、Ballista（分散クエリ実行）のコンピュートエンジンとしても利用される。

```python
# Python バインディング経由で DataFusion を使用
import datafusion

ctx = datafusion.SessionContext()

# Arrow テーブルを登録
import pyarrow as pa
table = pa.table({"a": [1, 2, 3], "b": [4, 5, 6]})
ctx.register_record_batches("my_table", [table.to_batches()])

# SQL クエリを実行（結果は Arrow バッチ）
result = ctx.sql("SELECT a, b, a + b AS sum FROM my_table WHERE a > 1")
arrow_result = result.collect()  # List[RecordBatch]
```

DataFusion の特徴：

- **Volcano モデルの列指向拡張**：従来の行ベース Volcano モデルを、RecordBatch 単位で動作するよう拡張
- **述語プッシュダウン**：Arrow フォーマットの統計情報を活用したプルーニング
- **ルールベース + コストベース最適化**：論理・物理プランの両フェーズで最適化
- **プラグイン可能なストレージ**：Parquet、CSV、Arrow IPC などのストレージを差し替え可能

## 9. Pandas vs PyArrow のパフォーマンス比較

### 9.1 なぜ PyArrow は Pandas より高速か

Pandas は長らく Python データ分析の標準ツールであったが、大規模データ処理ではいくつかの性能上の限界がある。

- **Python オブジェクトオーバーヘッド**：文字列カラムは NumPy の `object` 型で格納され、Python の `str` オブジェクトへのポインタ配列となる。Python オブジェクトは GIL（Global Interpreter Lock）の影響を受け、マルチスレッド処理が困難である
- **メモリ効率**：`object` 型の Python 文字列は、Arrow の Offset + Data バッファ方式と比べてメモリ使用量が大きい
- **NaN の取り扱い**：Pandas は従来、整数カラムの NULL を `float64` の NaN で表現していた（`Int64` 型でようやく改善）

PyArrow はこれらの問題を根本的に解決している。

### 9.2 ベンチマーク比較

以下は代表的な操作のパフォーマンス比較である（10億行規模のデータセットを想定した傾向値）：

| 操作 | Pandas | PyArrow | Polars | 備考 |
|------|--------|---------|--------|------|
| CSV 読み込み（1GB） | 基準 | 1.5〜3x 高速 | 3〜5x 高速 | マルチスレッド解析 |
| Parquet 読み込み（1GB） | 基準 | 2〜4x 高速 | 3〜6x 高速 | デコード最適化 |
| 文字列 GROUP BY | 基準 | 3〜8x 高速 | 5〜10x 高速 | Arrow 文字列表現 |
| 数値集計（SUM/MEAN） | 基準 | 2〜5x 高速 | 3〜8x 高速 | SIMD 活用 |
| JSON 変換（dict→DataFrame） | 基準 | 4〜10x 高速 | — | Python オブジェクト削減 |

> [!WARNING]
> 上記の数値はワークロード、データの基数（カーディナリティ）、マシンスペック（SIMD対応状況）によって大きく異なる。特に小規模データ（数万行以下）では Pandas のほうが高速な場合もある。ベンチマークは自分のユースケースで計測することが重要である。

### 9.3 Pandas 2.0 と Arrow バックエンド

Pandas 2.0（2023年リリース）では、Arrow をバックエンドとして使用できる **ArrowDtype** が導入された。

```python
import pandas as pd
import pyarrow as pa

# Pandas 2.0 で Arrow バックエンドを使用
df = pd.DataFrame({
    "name": pd.array(["Alice", "Bob", "Carol"], dtype=pd.ArrowDtype(pa.string())),
    "age":  pd.array([30, 25, 32], dtype=pd.ArrowDtype(pa.int32())),
    "score": pd.array([95.5, 87.2, 91.0], dtype=pd.ArrowDtype(pa.float64())),
})

print(df.dtypes)
# name     string[pyarrow]
# age       int32[pyarrow]
# score   double[pyarrow]

# Arrow バックエンドを使うと、PyArrow への変換がゼロコピーになる
arrow_table = pa.Table.from_pandas(df)
```

ArrowDtype を使うことで：
- 文字列カラムのメモリ使用量が削減される
- NULL 表現が Arrow の Validity Bitmap に統一される
- PyArrow との相互変換がゼロコピーに近い形で行える

ただし、すべての Pandas 関数が ArrowDtype に最適化されているわけではなく、フォールバックが発生する場合もある。完全な Arrow ネイティブ処理が必要なら Polars や DuckDB の使用を検討するとよい。

### 9.4 実践的なパフォーマンスガイド

```python
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.compute as pc

# Good: Parquet を直接 Arrow として読み込み（デシリアライズなし）
table = pq.read_table("data.parquet", columns=["name", "age"])  # 必要列のみ

# Good: Arrow Compute で処理（C++ SIMD 実行）
result = pc.filter(table, pc.greater(table["age"], 25))

# Good: 必要なときだけ Pandas に変換
df = result.to_pandas()  # ここで初めてコピーが発生

# Bad: Pandas を経由すると余分なコピーが発生
import pandas as pd
df = pq.read_table("data.parquet").to_pandas()  # 中間 Arrow テーブルをコピー
filtered = df[df["age"] > 25]  # Pandas の mask 演算（Python オーバーヘッド）
```

## 10. ゼロコピーの仕組みと実際

### 10.1 共有メモリとゼロコピー

Arrow のゼロコピー共有は、以下のメカニズムで実現される：

```mermaid
graph TD
    subgraph "プロセス A"
        PA[Arrow Buffer<br/>0x7f1234000000]
    end

    subgraph "カーネルの仮想メモリ空間"
        PHY["物理メモリページ\n（実際のデータ）"]
    end

    subgraph "プロセス B"
        PB[Arrow Buffer<br/>0x7f5678000000]
    end

    PA -->|仮想アドレスマッピング| PHY
    PB -->|仮想アドレスマッピング| PHY

    note["両プロセスが同じ物理ページを\n異なる仮想アドレスで参照\nデータのコピーは発生しない"]
```

**プロセス内でのゼロコピー**（スライス操作）：

```python
import pyarrow as pa

# 1億要素の配列
large_array = pa.array(range(100_000_000), type=pa.int64())

# スライスはゼロコピー（オフセットと長さを変えるだけ）
slice1 = large_array[0:50_000_000]    # コピーなし
slice2 = large_array[50_000_000:]     # コピーなし

# スライスは元バッファへの参照を保持
print(slice1.buffers()[1].address)    # 元バッファと同じアドレス
print(large_array.buffers()[1].address)

# 参照カウント管理
# large_array が GC されても、slice1/slice2 が生きている間はバッファが解放されない
```

**プロセス間のゼロコピー**（Plasma Store, Shared Memory）：

```python
# Arrow の Plasma Store（非推奨、現在は Ray などが独自実装）
# 共有メモリを使ったゼロコピー IPC の概念
import pyarrow.plasma as plasma  # Ray や Apache Arrow が提供

# プロセスA: データを共有メモリに書き込む
client = plasma.connect("/tmp/plasma")
object_id = plasma.ObjectID.from_random()
buf = client.create(object_id, arrow_table.get_total_buffer_size())
stream = pa.FixedSizeBufferWriter(buf)
writer = pa.RecordBatchStreamWriter(stream, arrow_table.schema)
writer.write_table(arrow_table)
writer.close()
client.seal(object_id)

# プロセスB: コピーなしでデータを参照
[data] = client.get_buffers([object_id])
reader = pa.ipc.open_stream(pa.BufferReader(data))
table = reader.read_all()  # 共有メモリを直接参照
```

> [!NOTE]
> Apache Arrow の Plasma Store は Arrow 12.0 で非推奨となり、削除予定である。現在は Ray が独自の共有メモリオブジェクトストアを提供しており、同様のゼロコピー共有を実現している。

### 10.2 ゼロコピーの限界

ゼロコピーが常に可能なわけではない。以下の場合はコピーが発生する：

1. **型変換**：Arrow の Int32 を Python の `int` に変換する際
2. **不連続なメモリ**：スライスが連続でない場合（List 型の再構築など）
3. **エンディアン変換**：ビッグエンディアン環境との交換
4. **非ネイティブ型への変換**：Arrow → Pandas の `object` 型（Python 文字列）

## 11. 実装の現実と選択基準

### 11.1 Arrow を使うべき場面

::: tip Arrow が最も効果を発揮するユースケース
- **大規模データの分析バッチ処理**：数GB〜数TB の Parquet / CSV の集計
- **異なる言語・システム間のデータ共有**：Python ↔ R ↔ Java のデータパイプライン
- **高スループットのデータサービス**：Arrow Flight を使ったデータ API
- **OLAP クエリエンジンの構築**：DuckDB、DataFusion のようなシステムの内部
:::

### 11.2 Arrow が向かない場面

::: warning Arrow が向かないユースケース
- **OLTP（単一行の読み書き）**：行指向アクセスが主体の場合、列指向は非効率
- **小規模データ（数万行以下）**：Arrow のメタデータオーバーヘッドが無視できなくなる
- **高頻度のインプレース更新**：Arrow バッファはイミュータブルであり、更新のたびに新しいバッファを作成する必要がある
- **ストリーミングの単一イベント処理**：RecordBatch 単位のバッチ処理が前提であり、1イベント処理には不向き
:::

### 11.3 エコシステムの成熟度と今後

Apache Arrow は、2016年のプロジェクト発足以来、急速に採用が広がっている。

```mermaid
timeline
    title Apache Arrow エコシステムの歴史
    2016 : Apache Arrow 0.1 リリース
         : C++/Java/Python バインディング
    2017 : Arrow IPC フォーマット確立
         : Parquet ↔ Arrow 相互変換
    2018 : Arrow Flight 設計開始
         : GPU サポート（RAPIDS cuDF）
    2019 : Arrow Flight 0.15 でリリース
         : Rust 実装（arrow-rs）開始
    2020 : Arrow 1.0 リリース
         : DataFusion が Arrow プロジェクトへ
    2021 : Arrow 5.0
         : Polars が arrow-rs を採用
    2022 : Arrow 9.0
         : DuckDB Arrow 統合の強化
         : Arrow Flight SQL 仕様確立
    2023 : Arrow 14.0
         : Pandas 2.0 ArrowDtype 導入
         : ADBC（Arrow Database Connectivity）
    2024 : Arrow 17.0
         : Arrow C Stream Interface の普及
```

**ADBC（Arrow Database Connectivity）** は、JDBC/ODBC の Arrow ネイティブ版として設計されており、ドライバーを通じて Arrow フォーマットのまま DB とデータ交換できる。PostgreSQL、DuckDB、SQLite のドライバーが提供されている。

```python
import adbc_driver_postgresql.dbapi as pg

# ADBC で PostgreSQL からデータを Arrow として取得
with pg.connect("postgresql://user:pass@localhost/db") as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM large_table")
        # Arrow Table として取得（JDBC のような行変換なし）
        arrow_table = cur.fetch_arrow_table()
```

## 12. まとめ

Apache Arrow は、データエンジニアリングの世界における「共通言語」として確立されつつある。その設計思想は明快である。

- **列指向バッファ**で OLAP ワークロードのキャッシュ効率と SIMD 活用を最大化する
- **Validity Bitmap**と**Offset バッファ**という統一的な物理表現で、あらゆるデータ型を効率よく表現する
- **ゼロコピーデシリアライズ**を実現する IPC フォーマットで、プロセス間のデータ移動コストをほぼゼロにする
- **Arrow Flight**で分散システム間の高速データ転送を実現する
- **Arrow Compute**で SIMD 最適化済みの演算関数を提供し、Python から C++ の高速処理にアクセスできるようにする

DuckDB のゼロコピー Arrow 統合、Polars の arrow-rs バックエンド、DataFusion の Arrow ネイティブ実行エンジン——現代の高性能データ処理スタックはほぼ例外なく Arrow を中心に構築されている。

かつて各システムが独自フォーマットで「孤島」を形成していた状況から、Arrow という標準フォーマットを介してデータが自由に流れる「相互接続されたエコシステム」への転換は、データエンジニアリングのパラダイムシフトと言っても過言ではない。

### 参考文献・関連資料

- [Apache Arrow 公式仕様](https://arrow.apache.org/docs/format/Columnar.html) — 列フォーマットの正式仕様
- [Arrow Flight 仕様](https://arrow.apache.org/docs/format/Flight.html) — Arrow Flight の公式ドキュメント
- [Dremel: Interactive Analysis of Web-Scale Datasets](https://research.google/pubs/pub36632/) — 列指向フォーマットの理論的基盤
- [Arrow Columnar Format Paper](https://arrow.apache.org/) — フォーマット設計の背景
- [DuckDB and Arrow Integration](https://duckdb.org/2021/12/03/duck-arrow.html) — DuckDB の Arrow ゼロコピー統合の解説
