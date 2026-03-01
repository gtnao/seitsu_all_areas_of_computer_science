---
title: "コンテナランタイム（runc, crun, containerd, CRI-O）"
date: 2026-03-01
tags: ["cloud", "containers", "runtime", "kubernetes", "intermediate"]
---

# コンテナランタイム（runc, crun, containerd, CRI-O）

## はじめに — コンテナランタイムとは何か

コンテナ技術は、現代のソフトウェア開発とデプロイメントにおいて不可欠な基盤となっている。Docker の登場によってコンテナは爆発的に普及したが、その内部では複数のコンポーネントが階層的に連携してコンテナのライフサイクルを管理している。この階層構造の中核を担うのが「コンテナランタイム」である。

コンテナランタイムという用語は、文脈によって異なるレイヤのソフトウェアを指すことがある。Linux カーネルの namespace や cgroups を直接操作してプロセスを隔離する「低レベルランタイム」と、イメージの管理やコンテナのライフサイクル全体を統括する「高レベルランタイム」の2層に大別される。本記事では、この2つの層の役割を明確にし、代表的な実装である runc、crun、containerd、CRI-O のアーキテクチャと設計思想を掘り下げる。

さらに、Kubernetes が CRI（Container Runtime Interface）を通じてランタイムと統合する仕組みや、gVisor や Kata Containers といったサンドボックスランタイムによるセキュリティ強化のアプローチについても解説する。

## OCI（Open Container Initiative）標準

### OCI 設立の背景

2013年に Docker が登場し、コンテナ技術は急速に普及した。しかし、Docker が事実上の標準となる中で、ベンダーロックインやエコシステムの断片化に対する懸念が高まった。2015年、Docker、CoreOS、Google、Red Hat などの主要企業が共同で **OCI（Open Container Initiative）** を設立し、コンテナ技術の標準化に乗り出した。OCI は Linux Foundation のプロジェクトとして運営されている。

### OCI の3つの仕様

OCI は以下の3つの仕様を策定している。

| 仕様 | 概要 |
|------|------|
| **Runtime Specification** | コンテナの設定（`config.json`）とライフサイクル操作（create, start, kill, delete）の標準 |
| **Image Specification** | コンテナイメージのフォーマット（マニフェスト、レイヤ、設定）の標準 |
| **Distribution Specification** | コンテナイメージの配布プロトコル（レジストリ API）の標準 |

### Runtime Specification の詳細

Runtime Specification は、コンテナランタイムが満たすべきインターフェースを定義する。中核となるのは `config.json` であり、以下の情報を含む。

- **ルートファイルシステム**: コンテナの rootfs のパス
- **マウント**: ボリュームマウントの設定
- **プロセス**: 実行するコマンド、環境変数、作業ディレクトリ
- **Linux 固有設定**: namespace、cgroups、seccomp、capabilities
- **フック**: コンテナライフサイクルの各段階で実行されるスクリプト

```json
{
  "ociVersion": "1.0.2",
  "process": {
    "terminal": false,
    "user": { "uid": 0, "gid": 0 },
    "args": ["/bin/sh", "-c", "echo hello"],
    "env": ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"],
    "cwd": "/"
  },
  "root": {
    "path": "rootfs",
    "readonly": true
  },
  "linux": {
    "namespaces": [
      { "type": "pid" },
      { "type": "network" },
      { "type": "mount" },
      { "type": "ipc" },
      { "type": "uts" }
    ],
    "resources": {
      "memory": { "limit": 536870912 },
      "cpu": { "shares": 1024 }
    }
  }
}
```

OCI Runtime Specification が定義するコンテナのライフサイクルは以下の通りである。

```mermaid
stateDiagram-v2
    [*] --> Creating: create
    Creating --> Created: コンテナ環境構築完了
    Created --> Running: start
    Running --> Stopped: プロセス終了 / kill
    Stopped --> [*]: delete
```

この標準化により、異なるランタイム実装間での互換性が保証され、上位レイヤのソフトウェア（containerd や CRI-O）はランタイムの実装詳細に依存せずにコンテナを管理できるようになった。

## 低レベルランタイム

低レベルランタイム（OCI ランタイム）は、OCI Runtime Specification に準拠し、Linux カーネルの機能を直接操作してコンテナプロセスを生成・管理するコンポーネントである。上位レイヤから `config.json` と rootfs を受け取り、隔離されたプロセスを起動する。

### runc

#### 概要と歴史

**runc** は、Docker が自社のコンテナランタイム実装を切り出してオープンソース化したものであり、OCI ランタイムのリファレンス実装である。Go 言語で実装されており、OCI Runtime Specification に完全に準拠している。

Docker は元々 `libcontainer` というライブラリを用いてコンテナを管理していた。OCI 設立に伴い、この `libcontainer` を基盤として runc が誕生した。現在も runc は最も広く使われている低レベルランタイムであり、containerd と CRI-O の両方がデフォルトで runc を使用している。

#### アーキテクチャ

runc のコンテナ起動プロセスは以下のように進行する。

```mermaid
sequenceDiagram
    participant Caller as 呼び出し元
    participant Runc as runc
    participant Init as runc init
    participant Container as コンテナプロセス

    Caller->>Runc: runc create <container-id>
    Runc->>Init: fork + exec (runc init)
    Init->>Init: namespace 設定
    Init->>Init: cgroups 適用
    Init->>Init: rootfs マウント (pivot_root)
    Init->>Init: seccomp フィルタ適用
    Init->>Init: capabilities 設定
    Init-->>Runc: 準備完了通知（パイプ経由）
    Runc-->>Caller: コンテナ Created 状態

    Caller->>Runc: runc start <container-id>
    Runc->>Init: 開始シグナル送信
    Init->>Container: exec ユーザープロセス
    Container-->>Caller: プロセス実行中
```

runc はコンテナ作成時に `runc init` プロセスを fork する。この init プロセスは新しい namespace 内で初期化処理を行い、最終的に `execve` でユーザー指定のプロセスに置き換わる。この2段階のプロセス（create + start）は OCI 仕様に基づいており、prestart フックなどを create と start の間に実行できるようにするための設計である。

#### 主な機能

- **namespace の設定**: PID, Network, Mount, UTS, IPC, User, Cgroup の各 namespace を作成・参加
- **cgroups の管理**: cgroups v1 / v2 の両方に対応し、CPU、メモリ、I/O などのリソース制限を適用
- **seccomp フィルタ**: システムコールのフィルタリングによるセキュリティ強化
- **capabilities の制御**: Linux capabilities の細粒度な設定
- **rootless コンテナ**: root 権限なしでのコンテナ実行をサポート

#### runc の CLI 使用例

```bash
# Create a bundle directory
mkdir -p mycontainer/rootfs

# Generate a default config.json
cd mycontainer
runc spec

# Export a container filesystem (e.g., from Docker)
docker export $(docker create busybox) | tar -C rootfs -xf -

# Create the container
runc create mycontainer

# Start the container
runc start mycontainer

# List running containers
runc list

# Delete the container
runc delete mycontainer
```

### crun

#### 概要と設計思想

**crun** は、Red Hat が開発した OCI ランタイムの C 言語実装である。runc が Go 言語で実装されているのに対し、crun は C で実装されていることが最大の特徴である。この設計決定にはいくつかの技術的な動機がある。

1. **起動速度**: Go のランタイムは起動時にガベージコレクタやゴルーチンスケジューラを初期化する必要があるが、C にはそのようなオーバーヘッドがない
2. **メモリ消費**: Go ランタイムのスタック管理やヒープ管理のオーバーヘッドがなく、メモリフットプリントが小さい
3. **fork の安全性**: Go は内部でスレッドを使用するため、`fork()` と `exec()` の間での安全性に注意が必要である。C はこの問題がない

#### パフォーマンス比較

crun は runc と比較して以下のような性能特性を持つ。

| 指標 | runc | crun |
|------|------|------|
| コンテナ起動時間 | ~50ms | ~15ms |
| バイナリサイズ | ~10MB | ~300KB |
| メモリ使用量（起動時） | ~20MB | ~2MB |
| 実装言語 | Go | C |

::: tip
上記の数値は環境によって変動するが、crun が runc に比べて大幅に軽量かつ高速であるという傾向は一貫している。特に、サーバーレスやエッジコンピューティングのように大量のコンテナを高速に起動する必要があるユースケースで、この差は顕著になる。
:::

#### crun の追加機能

crun は OCI 仕様への準拠に加え、以下のような拡張機能を提供する。

- **WASM サポート**: WebAssembly ランタイム（wasmedge, wasmtime）との統合
- **cgroup v2 の先行対応**: crun は cgroup v2 への対応が早くから進められた
- **Podman との緊密な統合**: Red Hat のコンテナエコシステムにおけるデフォルトランタイム

### runc と crun の比較

```mermaid
graph LR
    subgraph "低レベルランタイム比較"
        direction TB
        subgraph runc["runc"]
            R1["Go 言語実装"]
            R2["リファレンス実装"]
            R3["最も広く使用"]
            R4["Docker/containerd のデフォルト"]
        end
        subgraph crun["crun"]
            C1["C 言語実装"]
            C2["高速・軽量"]
            C3["WASM 対応"]
            C4["Podman のデフォルト"]
        end
    end
```

## 高レベルランタイム

高レベルランタイム（コンテナマネージャ）は、低レベルランタイムの上位に位置し、コンテナのライフサイクル全体を管理するデーモンプロセスである。イメージの pull、展開、ストレージ管理、ネットワーキング、そして低レベルランタイムの呼び出しまでを担当する。

### containerd

#### 概要と歴史

**containerd** は、Docker が自社のコンテナ管理機能を切り出して CNCF（Cloud Native Computing Foundation）に寄贈したプロジェクトである。2017年に CNCF の incubating プロジェクトとなり、2019年に graduated プロジェクトに昇格した。

containerd の設計思想は「業界標準のコンテナランタイムであること」にある。シンプルで安定した API を提供し、上位レイヤ（Docker Engine や Kubernetes）がコンテナ管理の詳細に依存しなくて済むようにすることを目指している。

#### アーキテクチャ

containerd は以下のコンポーネントで構成される。

```mermaid
graph TB
    subgraph "containerd アーキテクチャ"
        Client["クライアント<br/>(Docker Engine / CRI Plugin / ctr / nerdctl)"]
        GRPC["gRPC API"]

        subgraph "containerd デーモン"
            CRI["CRI Plugin"]
            ImageService["Image Service"]
            ContainerService["Container Service"]
            TaskService["Task Service"]
            ContentStore["Content Store"]
            SnapshotService["Snapshotter"]
            MetadataStore["Metadata Store (BoltDB)"]
        end

        subgraph "外部コンポーネント"
            Registry["コンテナレジストリ"]
            Shim["containerd-shim"]
            Runtime["OCI ランタイム<br/>(runc / crun)"]
        end

        Client --> GRPC
        GRPC --> CRI
        GRPC --> ImageService
        GRPC --> ContainerService
        GRPC --> TaskService

        ImageService --> ContentStore
        ImageService --> Registry
        ContainerService --> MetadataStore
        ContainerService --> SnapshotService
        TaskService --> Shim
        Shim --> Runtime
    end
```

#### containerd-shim の役割

containerd のアーキテクチャで特に重要なのが **containerd-shim** の存在である。shim は containerd とコンテナプロセスの間に位置する軽量なプロセスで、以下の役割を担う。

1. **containerd のダウンタイム許容**: shim がコンテナの親プロセスとなることで、containerd の再起動やアップグレード時にもコンテナが影響を受けない
2. **stdio の中継**: コンテナの標準入出力をログドライバやクライアントに中継する
3. **終了ステータスの保持**: コンテナプロセスの終了コードを保持し、containerd が後から取得できるようにする
4. **OCI ランタイムの抽象化**: 異なる OCI ランタイム（runc, crun など）を透過的に扱えるようにする

```mermaid
sequenceDiagram
    participant D as containerd
    participant S as containerd-shim
    participant R as runc
    participant C as コンテナプロセス

    D->>S: コンテナ作成要求
    S->>R: runc create
    R->>C: プロセス起動（namespace 内）
    R-->>S: 終了（runc プロセス自体は終了）
    S->>S: コンテナの親プロセスとして待機

    Note over D: containerd を再起動しても...
    D->>D: 再起動
    D->>S: shim への再接続
    Note over S,C: コンテナは影響を受けない
```

containerd-shim には v1 と v2 の2つのバージョンがある。v1 では shim とランタイム呼び出しが分離されていたが、**shim v2** ではプラグイン形式で統一され、カスタムランタイム（gVisor、Kata Containers など）との統合がより柔軟になった。shim v2 のバイナリは `containerd-shim-<runtime>-v1` という命名規則に従う（v2 API を実装しているが、バイナリ名の末尾は v1 であることに注意）。

#### Snapshotter

containerd の **Snapshotter** は、コンテナのファイルシステムを効率的に管理するプラグインインターフェースである。OCI イメージのレイヤ構造を展開し、コンテナ用の rootfs を準備する。

主要な Snapshotter 実装は以下の通り。

| Snapshotter | 説明 |
|-------------|------|
| **overlayfs** | Linux の OverlayFS を使用（最も一般的） |
| **native** | 単純なディレクトリコピー（デバッグ用） |
| **devmapper** | Device Mapper thin provisioning を使用 |
| **zfs** | ZFS のクローン機能を使用 |
| **stargz** | 遅延読み込み（Lazy pulling）に対応 |

#### containerd の CLI ツール

containerd には複数の CLI ツールが存在する。

- **ctr**: containerd に付属する低レベル CLI。デバッグ用途が主
- **nerdctl**: Docker 互換の CLI。Docker コマンドとほぼ同じ使い勝手を提供

```bash
# Pull an image using nerdctl
nerdctl pull nginx:latest

# Run a container
nerdctl run -d --name web -p 8080:80 nginx:latest

# List containers
nerdctl ps

# Using ctr (low-level)
ctr images pull docker.io/library/nginx:latest
ctr run docker.io/library/nginx:latest web
```

### CRI-O

#### 概要と設計思想

**CRI-O** は、Kubernetes の CRI（Container Runtime Interface）に特化して設計されたコンテナランタイムである。Red Hat、Intel、SUSE などが中心となって開発しており、CNCF の incubating プロジェクトである。

CRI-O の名前は「CRI + OCI」に由来する。その設計思想は明確で、「Kubernetes のための最小限のランタイム」を目指している。containerd が汎用的なコンテナ管理デーモンであるのに対し、CRI-O は Kubernetes 以外のユースケースを意図的に切り捨てることで、コードベースの簡潔さと安定性を追求している。

#### アーキテクチャ

```mermaid
graph TB
    subgraph "CRI-O アーキテクチャ"
        Kubelet["kubelet"]

        subgraph "CRI-O デーモン"
            CRIServer["CRI サーバー (gRPC)"]
            ImageManager["Image Manager"]
            StorageManager["Storage Manager<br/>(containers/image, containers/storage)"]
            RuntimeManager["Runtime Manager"]
            NetworkManager["Network Manager (CNI)"]
            MonitoringManager["Monitoring (conmon)"]
        end

        subgraph "外部コンポーネント"
            Registry2["コンテナレジストリ"]
            Conmon["conmon プロセス"]
            OCIRuntime["OCI ランタイム<br/>(runc / crun)"]
            CNIPlugins["CNI プラグイン"]
        end

        Kubelet -->|"CRI gRPC"| CRIServer
        CRIServer --> ImageManager
        CRIServer --> RuntimeManager
        CRIServer --> NetworkManager

        ImageManager --> StorageManager
        StorageManager --> Registry2
        RuntimeManager --> MonitoringManager
        MonitoringManager --> Conmon
        Conmon --> OCIRuntime
        NetworkManager --> CNIPlugins
    end
```

#### conmon の役割

CRI-O における **conmon**（container monitor）は、containerd-shim と類似の役割を果たす。conmon はコンテナごとに起動される軽量な C プログラムで、以下の機能を持つ。

- コンテナプロセスの PID 1 監視
- ログ管理（stdout/stderr のキャプチャとログファイルへの書き出し）
- 終了コードの報告
- CRI-O デーモンのクラッシュからの独立動作

::: tip
CRI-O プロジェクトでは、conmon の後継として **conmon-rs**（Rust 実装）の開発も進められている。Rust による実装はメモリ安全性の向上と、非同期 I/O によるパフォーマンス改善を目的としている。
:::

#### CRI-O の特徴

1. **Kubernetes バージョンとの同期**: CRI-O のメジャー/マイナーバージョンは Kubernetes に合わせている（例: CRI-O 1.29.x は Kubernetes 1.29.x に対応）
2. **コンパクトなコードベース**: Kubernetes に不要な機能を持たないため、攻撃対象面が小さい
3. **containers/image ライブラリ**: Skopeo や Podman と共通のイメージ管理ライブラリを使用
4. **containers/storage ライブラリ**: コンテナストレージの管理に共通ライブラリを使用

### containerd と CRI-O の比較

| 観点 | containerd | CRI-O |
|------|-----------|-------|
| **設計思想** | 汎用コンテナランタイム | Kubernetes 専用ランタイム |
| **主要スポンサー** | Docker, CNCF | Red Hat, Intel, SUSE |
| **CNCF ステータス** | Graduated | Incubating |
| **イメージ管理** | 独自実装 | containers/image ライブラリ |
| **ストレージ** | Snapshotter プラグイン | containers/storage ライブラリ |
| **shim** | containerd-shim | conmon / conmon-rs |
| **Kubernetes 以外の利用** | Docker, nerdctl 等で利用可 | 基本的に Kubernetes 専用 |
| **デフォルトのOCIランタイム** | runc | runc（crun も広く利用） |

## Kubernetes との統合 — CRI（Container Runtime Interface）

### CRI の背景

Kubernetes の初期バージョンでは、Docker が唯一のコンテナランタイムとしてハードコードされていた。しかし、コンテナランタイムの多様化に伴い、Kubernetes v1.5 で CRI（Container Runtime Interface）が導入された。CRI は gRPC ベースのプラグインインターフェースであり、kubelet とコンテナランタイムの間の通信を標準化する。

### dockershim の廃止

Docker は CRI に直接対応していなかったため、Kubernetes は **dockershim** というアダプタを内蔵して Docker をサポートしていた。しかし、この中間レイヤはメンテナンスコストが高く、バグの原因にもなっていた。

```mermaid
graph LR
    subgraph "dockershim 時代（非推奨）"
        K1["kubelet"] --> DS["dockershim"]
        DS --> DE["Docker Engine"]
        DE --> CD["containerd"]
        CD --> R1["runc"]
    end
```

```mermaid
graph LR
    subgraph "CRI 直接統合（現在）"
        K2["kubelet"] -->|"CRI gRPC"| CD2["containerd<br/>(CRI Plugin)"]
        CD2 --> R2["runc"]
    end
```

```mermaid
graph LR
    subgraph "CRI-O の場合"
        K3["kubelet"] -->|"CRI gRPC"| CO["CRI-O"]
        CO --> R3["runc / crun"]
    end
```

Kubernetes v1.24（2022年5月）で dockershim は正式に削除された。これにより、Kubernetes で Docker Engine を直接使用することはできなくなり、containerd または CRI-O を使用する必要がある。

::: warning
dockershim の廃止は「Docker で作ったイメージが使えなくなる」ことを意味しない。Docker で作成されたイメージは OCI イメージ仕様に準拠しているため、containerd や CRI-O で問題なく実行できる。変わったのはあくまで kubelet とランタイムの通信インターフェースである。
:::

### CRI の API 構造

CRI は2つの gRPC サービスで構成される。

```mermaid
graph TB
    subgraph "CRI API"
        subgraph "RuntimeService"
            RS1["PodSandbox 操作<br/>RunPodSandbox / StopPodSandbox / RemovePodSandbox"]
            RS2["Container 操作<br/>CreateContainer / StartContainer / StopContainer / RemoveContainer"]
            RS3["Exec / Attach / PortForward"]
            RS4["Status / Version"]
        end

        subgraph "ImageService"
            IS1["PullImage"]
            IS2["RemoveImage"]
            IS3["ListImages"]
            IS4["ImageStatus"]
        end
    end
```

**RuntimeService** はコンテナとサンドボックス（Pod）のライフサイクルを管理し、**ImageService** はコンテナイメージの操作を担当する。

### Pod の作成フロー

Kubernetes で Pod が作成される際の、kubelet からコンテナプロセスまでのフローを見てみる。

```mermaid
sequenceDiagram
    participant API as API Server
    participant Kubelet as kubelet
    participant CRI as containerd / CRI-O
    participant CNI as CNI プラグイン
    participant Runtime as OCI ランタイム (runc)

    API->>Kubelet: Pod 作成指示
    Kubelet->>CRI: RunPodSandbox()
    CRI->>Runtime: pause コンテナ作成
    Runtime-->>CRI: sandbox 作成完了
    CRI->>CNI: ネットワーク設定 (ADD)
    CNI-->>CRI: IP アドレス割り当て完了
    CRI-->>Kubelet: PodSandbox ID 返却

    loop 各コンテナに対して
        Kubelet->>CRI: PullImage() (必要に応じて)
        CRI-->>Kubelet: イメージ準備完了
        Kubelet->>CRI: CreateContainer()
        CRI->>Runtime: コンテナ作成
        Runtime-->>CRI: コンテナ ID 返却
        CRI-->>Kubelet: コンテナ ID 返却
        Kubelet->>CRI: StartContainer()
        CRI->>Runtime: コンテナ起動
        Runtime-->>CRI: 起動完了
        CRI-->>Kubelet: 起動完了
    end
```

ここで注目すべきは、最初に「**pause コンテナ**」が作成されることである。pause コンテナは Pod 内のすべてのコンテナが共有する namespace（Network, IPC など）を保持するための特殊なコンテナで、実質的に何もしない極小のプロセスである。Pod 内の他のコンテナは、この pause コンテナの namespace に参加する形で起動される。

## ランタイムアーキテクチャの全体像

ここで、Docker、containerd、CRI-O のアーキテクチャを俯瞰する。

```mermaid
graph TB
    subgraph "ユーザーインターフェース層"
        DockerCLI["docker CLI"]
        Kubectl["kubectl"]
        Nerdctl["nerdctl"]
        Podman["podman"]
    end

    subgraph "オーケストレーション層"
        K8s["Kubernetes (kubelet)"]
    end

    subgraph "コンテナエンジン層"
        DockerEngine["Docker Engine<br/>(dockerd)"]
        Containerd["containerd"]
        CRIO["CRI-O"]
        PodmanLib["Podman<br/>(デーモンレス)"]
    end

    subgraph "shim 層"
        ContainerdShim["containerd-shim"]
        Conmon2["conmon"]
    end

    subgraph "OCI ランタイム層"
        Runc["runc"]
        Crun2["crun"]
        GVisor["gVisor (runsc)"]
        Kata["Kata Containers<br/>(kata-runtime)"]
    end

    subgraph "カーネル層"
        NS["namespace"]
        CG["cgroups"]
        SC["seccomp"]
        LS["LSM (AppArmor/SELinux)"]
    end

    DockerCLI --> DockerEngine
    DockerEngine --> Containerd
    Kubectl --> K8s
    K8s -->|"CRI"| Containerd
    K8s -->|"CRI"| CRIO
    Nerdctl --> Containerd
    Podman --> PodmanLib
    PodmanLib --> Conmon2

    Containerd --> ContainerdShim
    CRIO --> Conmon2

    ContainerdShim --> Runc
    ContainerdShim --> Crun2
    ContainerdShim --> GVisor
    ContainerdShim --> Kata
    Conmon2 --> Runc
    Conmon2 --> Crun2

    Runc --> NS
    Runc --> CG
    Runc --> SC
    Runc --> LS
    Crun2 --> NS
    Crun2 --> CG
    Crun2 --> SC
    Crun2 --> LS
```

この図から、コンテナランタイムが明確に階層化されていることがわかる。

1. **ユーザーインターフェース層**: ユーザーがコンテナを操作するための CLI ツール
2. **オーケストレーション層**: Kubernetes のような自動化レイヤ
3. **コンテナエンジン層**: イメージ管理とコンテナライフサイクルの統括
4. **shim 層**: コンテナプロセスの監視と中継
5. **OCI ランタイム層**: 実際にカーネル機能を使ってプロセスを隔離
6. **カーネル層**: namespace, cgroups, seccomp 等の隔離メカニズム

### Podman — デーモンレスアーキテクチャ

上図に含まれている **Podman** についても触れておく。Podman は Red Hat が開発したコンテナ管理ツールで、Docker とコマンド互換を持ちつつ、根本的に異なるアーキテクチャを採用している。

Docker が `dockerd` デーモンを常駐させるのに対し、Podman はデーモンを持たない（daemonless）。各コンテナ操作は独立したプロセスとして実行され、conmon がコンテナを監視する。このアーキテクチャには以下のメリットがある。

- **セキュリティ**: root 権限で動作するデーモンが不要
- **systemd 統合**: 各コンテナを systemd ユニットとして管理可能
- **rootless コンテナ**: 一般ユーザーでのコンテナ実行が設計の中心
- **Pod 概念のネイティブサポート**: Kubernetes の Pod と同等の概念を直接サポート

## セキュリティとサンドボックスランタイム

従来のコンテナ（runc/crun）は、ホストカーネルを共有する形でプロセスを隔離する。namespace と cgroups による隔離は効果的だが、カーネルの脆弱性がコンテナエスケープにつながるリスクがある。この問題に対処するために、サンドボックスランタイムが開発された。

### gVisor（runsc）

#### 概要

**gVisor** は Google が開発したサンドボックスランタイムで、ユーザー空間でカーネルの機能を再実装するアプローチを採る。gVisor の OCI ランタイムバイナリは `runsc`（run Sandboxed Container）と呼ばれる。

#### アーキテクチャ

```mermaid
graph TB
    subgraph "gVisor アーキテクチャ"
        App["アプリケーション"]

        subgraph "gVisor (ユーザー空間)"
            Sentry["Sentry<br/>(ゲストカーネル)"]
            Gofer["Gofer<br/>(ファイル I/O プロキシ)"]
        end

        HostKernel["ホストカーネル"]
        HostFS["ホストファイルシステム"]

        App -->|"システムコール"| Sentry
        Sentry -->|"限定的な<br/>システムコール"| HostKernel
        Sentry --> Gofer
        Gofer --> HostFS
    end
```

gVisor の中核は **Sentry** と呼ばれるコンポーネントで、Go 言語で実装されたゲストカーネルである。アプリケーションのシステムコールは Sentry がインターセプトし、大部分をユーザー空間内で処理する。ホストカーネルへ実際に発行されるシステムコールは大幅に削減されるため、攻撃対象面が縮小される。

**Gofer** はファイルシステム操作を仲介するプロキシプロセスで、9P プロトコルを使って Sentry からのファイル I/O 要求をホストファイルシステムに中継する。

#### システムコールのインターセプト方式

gVisor は以下の2つの方式でシステムコールをインターセプトする。

- **ptrace**: `ptrace` システムコールを使い、コンテナプロセスのシステムコールをトラップする。互換性は高いが、コンテキストスイッチが多くオーバーヘッドが大きい
- **KVM**: gVisor が仮想マシンモニタとして動作し、アプリケーションをゲストモードで実行する。ptrace より高速だが、KVM が利用可能な環境に限定される

#### トレードオフ

- **メリット**: カーネルの脆弱性からの保護、ホストカーネルへのシステムコール削減
- **デメリット**: 完全なシステムコール互換性がない（一部未実装）、ファイル I/O のオーバーヘッド、ネットワーク I/O のオーバーヘッド（ユーザー空間ネットワークスタック）

### Kata Containers

#### 概要

**Kata Containers** は、Intel Clear Containers と Hyper runV を統合して生まれたプロジェクトで、軽量な仮想マシンの中でコンテナを実行するアプローチを採る。OCI ランタイムインターフェースに準拠しており、containerd や CRI-O から透過的に利用できる。

#### アーキテクチャ

```mermaid
graph TB
    subgraph "Kata Containers アーキテクチャ"
        Shim["containerd-shim-kata-v2"]

        subgraph "軽量 VM"
            GuestKernel["ゲストカーネル<br/>(Linux)"]
            Agent["kata-agent"]
            Container1["コンテナ 1"]
            Container2["コンテナ 2"]

            Agent --> Container1
            Agent --> Container2
            GuestKernel --> Agent
        end

        VMM["VMM<br/>(QEMU / Cloud Hypervisor / Firecracker)"]
        HostKernel2["ホストカーネル"]
        HW["ハードウェア (VT-x/AMD-V)"]

        Shim --> VMM
        VMM --> HostKernel2
        HostKernel2 --> HW
        VMM --> GuestKernel
    end
```

Kata Containers は、Pod ごとに軽量な仮想マシンを起動する。VM 内で専用のゲストカーネルが動作し、**kata-agent** がコンテナプロセスの管理を行う。VM 上位の shim（`containerd-shim-kata-v2`）とゲスト内の kata-agent は、vsock や virtio-serial を通じて通信する。

#### VMM（Virtual Machine Monitor）の選択肢

Kata Containers は複数の VMM をサポートする。

| VMM | 特徴 |
|-----|------|
| **QEMU** | 最も多機能。デバイスエミュレーションが豊富だが起動が遅い |
| **Cloud Hypervisor** | Rust 製。KVM ベースで高速起動・低メモリ消費 |
| **Firecracker** | Amazon が開発した軽量 VMM。AWS Lambda で使用 |
| **ACRN** | Intel が IoT 向けに開発した軽量ハイパーバイザ |

#### トレードオフ

- **メリット**: ハードウェアレベルの隔離（VM 境界）、ホストカーネルとの完全な分離、既存のカーネル互換性
- **デメリット**: VM 起動オーバーヘッド（数百ミリ秒）、メモリオーバーヘッド（ゲストカーネル分）、ネストされた仮想化環境での制約

### サンドボックスランタイムの比較

```mermaid
graph LR
    subgraph "隔離レベルの比較"
        direction TB

        subgraph Traditional["runc / crun"]
            T1["namespace + cgroups"]
            T2["カーネル共有"]
            T3["最高性能"]
            T4["隔離: 中"]
        end

        subgraph GV["gVisor"]
            G1["ユーザー空間カーネル"]
            G2["システムコール制限"]
            G3["性能: 中〜低"]
            G4["隔離: 高"]
        end

        subgraph KC["Kata Containers"]
            K1["軽量 VM"]
            K2["専用カーネル"]
            K3["性能: 中"]
            K4["隔離: 最高"]
        end
    end
```

| 観点 | runc/crun | gVisor | Kata Containers |
|------|-----------|--------|-----------------|
| **隔離方式** | namespace + cgroups | ユーザー空間カーネル | 軽量 VM |
| **カーネル共有** | ホストカーネル共有 | 部分的に分離 | 完全に分離 |
| **起動速度** | ~50ms | ~150ms | ~500ms |
| **メモリオーバーヘッド** | 最小 | 中程度 | 大（ゲストカーネル分） |
| **互換性** | 完全 | 一部制限あり | ほぼ完全 |
| **主なユースケース** | 一般的なワークロード | マルチテナント環境 | 機密ワークロード |

## パフォーマンスと選定基準

### ランタイム選定のフローチャート

```mermaid
flowchart TD
    Start["コンテナランタイムの選定"] --> Q1{"Kubernetes を使うか?"}

    Q1 -->|"はい"| Q2{"ディストリビューションの<br/>推奨は?"}
    Q1 -->|"いいえ"| Q3{"Docker 互換が必要?"}

    Q2 -->|"特になし"| Q4{"Red Hat 系 OS か?"}
    Q2 -->|"推奨あり"| REC["ディストリビューションの<br/>推奨に従う"]

    Q4 -->|"はい"| CRIO2["CRI-O + crun"]
    Q4 -->|"いいえ"| CTRD["containerd + runc"]

    Q3 -->|"はい"| Docker["Docker Engine<br/>(containerd ベース)"]
    Q3 -->|"いいえ"| Q5{"デーモンレスが必要?"}

    Q5 -->|"はい"| PM["Podman + crun"]
    Q5 -->|"いいえ"| CTRD2["containerd + nerdctl"]

    Q1 -->|"はい"| Q6{"強い隔離が必要?"}
    Q6 -->|"はい"| Q7{"カーネル互換性重視?"}
    Q6 -->|"いいえ"| DEFAULT["runc / crun"]

    Q7 -->|"はい"| KATA2["Kata Containers"]
    Q7 -->|"いいえ"| GVISOR2["gVisor"]
```

### 選定基準の整理

#### 高レベルランタイムの選定

**containerd を選ぶ場合:**
- Kubernetes 以外でもコンテナを使用する
- Docker Engine からの移行
- 幅広いエコシステムとの統合が必要
- GKE、EKS、AKS など主要クラウドの Kubernetes サービスでのデフォルト

**CRI-O を選ぶ場合:**
- Kubernetes 専用の環境
- OpenShift（Red Hat のKubernetes ディストリビューション）を使用
- 最小限のコンポーネントで攻撃対象面を小さくしたい
- Kubernetes バージョンとの厳密な互換性を重視

#### 低レベルランタイムの選定

**runc を選ぶ場合:**
- 安定性と広いコミュニティサポートを重視
- リファレンス実装としての信頼性
- containerd のデフォルトとしてそのまま使いたい

**crun を選ぶ場合:**
- コンテナの起動速度を重視
- メモリフットプリントを最小化したい
- サーバーレス/エッジ環境で大量のコンテナを扱う
- WASM ワークロードとの統合が必要

### 主要 Kubernetes ディストリビューションのデフォルトランタイム

| ディストリビューション | デフォルトランタイム |
|------------------------|---------------------|
| **GKE** (Google) | containerd |
| **EKS** (AWS) | containerd |
| **AKS** (Azure) | containerd |
| **OpenShift** (Red Hat) | CRI-O |
| **k3s** (Rancher) | containerd |
| **MicroK8s** (Canonical) | containerd |
| **Talos Linux** | containerd |

## 実践: ランタイムの切り替え

### containerd で OCI ランタイムを変更する

containerd の設定ファイル（`/etc/containerd/config.toml`）でデフォルトのランタイムを変更できる。

```toml
# /etc/containerd/config.toml
version = 2

[plugins."io.containerd.grpc.v1.cri".containerd]
  default_runtime_name = "crun"

[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.crun]
  runtime_type = "io.containerd.runc.v2"

[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.crun.options]
  BinaryName = "/usr/bin/crun"
```

### Kubernetes で RuntimeClass を使う

Kubernetes では **RuntimeClass** リソースを使って、Pod ごとに異なるランタイムを指定できる。

```yaml
# RuntimeClass definition
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
---
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: kata
handler: kata
```

```yaml
# Pod using a specific RuntimeClass
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  runtimeClassName: gvisor
  containers:
    - name: app
      image: nginx:latest
```

この仕組みにより、同一クラスタ内で通常のワークロードは runc で実行しつつ、信頼できないワークロードは gVisor や Kata Containers で実行するといった運用が可能になる。

```mermaid
graph TB
    subgraph "Kubernetes クラスタ"
        subgraph Node["ワーカーノード"]
            Kubelet2["kubelet"]
            Containerd2["containerd"]

            subgraph "RuntimeClass: 既定 (runc)"
                Pod1["Pod A<br/>(一般ワークロード)"]
                Pod2["Pod B<br/>(一般ワークロード)"]
            end

            subgraph "RuntimeClass: gvisor"
                Pod3["Pod C<br/>(マルチテナント)"]
            end

            subgraph "RuntimeClass: kata"
                Pod4["Pod D<br/>(機密ワークロード)"]
            end
        end
    end

    Kubelet2 --> Containerd2
    Containerd2 -->|"runc"| Pod1
    Containerd2 -->|"runc"| Pod2
    Containerd2 -->|"runsc"| Pod3
    Containerd2 -->|"kata-runtime"| Pod4
```

## コンテナランタイムの進化と将来展望

### WebAssembly（WASM）ランタイムとの融合

WebAssembly はブラウザ外でのランタイムとして注目されており、コンテナの代替として議論されることが増えている。WASM のサンドボックスは軽量でセキュアであり、以下のような利点がある。

- **起動速度**: ミリ秒未満でのコールドスタート
- **ポータビリティ**: CPU アーキテクチャに依存しない
- **セキュリティ**: capability-based のサンドボックス
- **フットプリント**: コンテナより遥かに軽量

containerd の **runwasi** プロジェクトや crun の WASM サポートにより、既存のコンテナエコシステムから WASM ワークロードを管理できるようになりつつある。

```mermaid
graph TB
    subgraph "コンテナ + WASM のハイブリッド"
        K["kubelet"]
        CD3["containerd"]

        subgraph "従来のコンテナ"
            Shim1["containerd-shim-runc-v2"]
            Runc2["runc"]
            C1["Linux コンテナ"]
        end

        subgraph "WASM ワークロード"
            Shim2["containerd-shim-wasmtime-v1<br/>(runwasi)"]
            Wasmtime["wasmtime"]
            W1["WASM モジュール"]
        end

        K --> CD3
        CD3 --> Shim1
        Shim1 --> Runc2
        Runc2 --> C1
        CD3 --> Shim2
        Shim2 --> Wasmtime
        Wasmtime --> W1
    end
```

### Confidential Containers

クラウド環境での機密コンピューティング需要の高まりに伴い、**Confidential Containers** プロジェクトが注目されている。これは、TEE（Trusted Execution Environment）を活用して、クラウドプロバイダを含む外部からのアクセスに対してもコンテナワークロードを保護する技術である。

Intel SGX、AMD SEV-SNP、ARM CCA などのハードウェア機能と Kata Containers を組み合わせることで、実行時のメモリ暗号化やリモート認証（Remote Attestation）を実現する。

### コンテナランタイムの軽量化

サーバーレスやエッジコンピューティングの需要増加に伴い、コンテナランタイムのさらなる軽量化が進んでいる。Firecracker による microVM の高速起動（~125ms）、crun の最小フットプリント、そして WASM ランタイムの台頭は、すべてこの方向性に沿った進化である。

将来的には、ワークロードの特性に応じて最適なランタイムを自動的に選択する仕組みが標準化されていくと考えられる。Kubernetes の RuntimeClass はその第一歩であり、セキュリティ要件、性能要件、互換性要件を基に最適な隔離レベルを動的に決定するフレームワークの研究が進んでいる。

## まとめ

コンテナランタイムは、コンテナ技術の最も基盤的なレイヤであり、その設計と選択はシステムの性能、セキュリティ、運用性に直結する。本記事で解説した内容を整理する。

1. **OCI 標準**: Runtime Specification、Image Specification、Distribution Specification の3つの仕様がコンテナエコシステムの互換性を保証する
2. **低レベルランタイム**: runc（Go、リファレンス実装）と crun（C、高速・軽量）が代表的。OCI 仕様に従い、カーネル機能を直接操作してプロセスを隔離する
3. **高レベルランタイム**: containerd（汎用）と CRI-O（Kubernetes 専用）が二大勢力。イメージ管理からコンテナライフサイクルの統括までを担う
4. **Kubernetes 統合**: CRI を通じて kubelet とランタイムが通信。dockershim 廃止後は containerd または CRI-O が直接使用される
5. **サンドボックスランタイム**: gVisor（ユーザー空間カーネル）と Kata Containers（軽量 VM）が、カーネル共有に起因するセキュリティリスクに対処する
6. **将来展望**: WASM ランタイムとの融合、Confidential Containers、さらなる軽量化が進行中

コンテナランタイムの選定にあたっては、単に「最も高速なもの」や「最も安全なもの」を選ぶのではなく、ワークロードの特性、セキュリティ要件、運用体制、既存エコシステムとの親和性を総合的に判断することが重要である。Kubernetes の RuntimeClass を活用すれば、同一クラスタ内で複数のランタイムを使い分けることも可能であり、適材適所の運用が現実的になっている。
