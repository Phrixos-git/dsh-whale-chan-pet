# dsh-whale-chan-pet

DeepSeek Harness（DSH）の Web GUI に住む、小さな Whale-chan のデスクトップペットです。

- 画面内をときどき歩き回る
- モデルが Thinking（reasoning ストリーム）を始めると、悩む素振りをする
- Thinking が長引くと、待ちくたびれて寝る
- アイドル状態が続くと、ときどき昼寝する
- クリックで反応、ドラッグで好きな場所に移動
- ホバー時の「×」で非表示、右下の「🐋」で呼び出し

![idle / think / nap / sleep / work](art/sprites/states-dark.png)

見た目は、ComfyUI + Animagine XL 4.0で生成したスプライトです。

- `idle`: 通常の立ち姿
- `walk`: 4フレームの揺れ歩行（正面寄り。側面フレームは今後の調整）
- `think`: idleポーズ＋「？」マーク
- `sleep`: 長考後は横たわり。睫毛はスパイクのない滑らかなライン
- `nap`: 短い昼寝は座り込み。コントローラーを持ったままうたた寝
- `blink`: 立ち姿の閉じ目差分を一瞬だけ表示
- `work`: 座ってゲームをするポーズ（コントローラー持ち）
- `happy`: `idle` を使い、ハートで表現

モデルの推論本文は読みません。見ているのは「reasoning が流れているか」というイベント種別と経過時間だけです。外部への送信もありません。

## 動作

| 状態 | トリガー | 見た目 |
|---|---|---|
| `idle` | セッションが動いていない | ときどき歩く、ときどき昼寝 |
| `walk` | 散歩のタイミング | 4フレームの揺れ歩行。進行方向に左右反転 |
| `work` | セッションが実行中（Thinking 以外） | 座ってゲーム。コントローラーを持って応援 |
| `think` | reasoning の delta を受信 | 「？」マークと吹き出しで考え中 |
| `sleep`（長考） | Thinking が 20 秒以上続く | 横たわり＋滑らかな閉じ目で Zzz。Thinking が終わるまで寝たまま |
| `sleep`（昼寝） | アイドルが 75 秒以上続いたとき、35% の確率 | 座り込み＋滑らかな閉じ目で Zzz。18〜40 秒で起きる |
| `blink` | idle / work / happy 中、3.5〜8秒おき | 140msだけ立ち閉じ目に切り替わる |
| `happy` | クリック | ハートとセリフ |

初期値は、歩行間隔 9〜22 秒、歩行速度 約70 px/s、サイズ 210px、長考で寝るまで 20 秒です。これらはペットの **⚙** から開く設定パネルで変更できます。

### 設定パネル

ペットにマウスを乗せると右上に **⚙** が出ます。クリックすると設定パネルが開き、以下をその場で変更できます。

- **サイズ**: 140〜320px
- **歩行間隔（最小 / 最大）**: 2〜60秒
- **長考で寝るまで**: 5〜120秒

変更は即時反映され、`localStorage` に保存されます（`dsh.whale-chan-pet.settings`）。「リセット」で初期値に戻ります。パネルは `Esc`、外側クリック、または「閉じる」で閉じます。

設定パネルは**画面右上に固定**され、ペットの移動やサイズ変更には追従しません。

### 一時的に隠す

ペットにマウスを乗せると右上に **×** が出ます。クリックすると非表示になり、画面右下に **🐋** の召喚ボタンだけが残ります。召喚ボタンを押すと元の位置に戻ります。`Alt+Shift+W` でも切り替えられます（入力欄にフォーカスがあるときは効きません）。

非表示状態は **タブごとの sessionStorage** に保存されます。同じタブ内でリロードしても隠れたままですが、タブを閉じる／新しいタブで開くと再び表示されます。プロファイル全体で止めたい場合は、Pluginsページで `dsh-whale-chan-pet` を **Off** にしてください。

## インストール

前提:

- **Web GUI を持つ DSH プロファイル**（通常は `web`、Desktop なら `desktop`）
- DSH 0.2.x（このプラグインは `shell.overlay` / `uiSession` / `SessionBinding.eventSource` を使います）
- Node.js 20 以上（ビルドする場合のみ）

`dsh plugin add` は、依存関係の追加と `dsh.profile.bundles` への追加をまとめて行います。反映には `dsh web` の再起動が必要です。

### 0. このリポジトリから入れる場合（Git）

GitHubのこのリポジトリから直接入れるのが一番手軽です。

```sh
dsh plugin --profile web add git+https://github.com/Phrixos-git/dsh-whale-chan-pet.git
```

Desktop版は **Plugins → Add plugin** に同じURLを貼り付けます。

```text
git+https://github.com/Phrixos-git/dsh-whale-chan-pet.git
```

`lib/client.js` はビルド済みでコミットされているため、インストール先でビルドは走りません。

### 1. 配布用 tarball を使う（推奨）

手元で作った配布用 tarball を別マシンへコピーする場合は、次の1コマンドで入ります。このリポジトリには `dist/` を含めていません（必要ならローカルで生成してください）。

```sh
dsh plugin --profile web add /path/to/dsh-whale-chan-pet-0.2.0-runtime.tgz
```

tarball にはビルド済みの `lib/client.js` とスプライト（WebP）が入っているため、**インストール先でビルドする必要はありません**。

### 2. ソースフォルダをリンクする（開発向け）

ソースごと持っていく場合は `dist/dsh-whale-chan-pet-0.2.0-src.tar.gz` を展開し、そのフォルダを `link:` で指します。

```sh
tar -xzf dsh-whale-chan-pet-0.2.0-src.tar.gz
dsh plugin --profile web add link:/absolute/path/to/whale-chan-pet
```

`link:` はコピーではなくシンボリックリンクです。**フォルダを移動・削除するとプラグインが壊れる**ので、常用するなら tarball か Git 経由をおすすめします。ソースを変更したら `npm run build` で `lib/client.js` を再生成してください。

### 3. GUI から追加する

DSH の **Plugins → Add plugin** を開き、次のいずれかを指定します。

- 配布用 tarball の絶対パス
- ソースフォルダの絶対パス（開発向け）

インストール後に **On** になっていることを確認し、Web プロファイルを再起動してください。

### 4. Git リポジトリから入れる場合

`lib/client.js` をコミットしたリポジトリなら、Git URL をそのまま指定できます。

```sh
dsh plugin --profile web add git+https://github.com/Phrixos-git/dsh-whale-chan-pet.git
```

`private: true` のままでも Git インストールは可能です。npm に公開する場合だけ `private` を外し、名前をスコープ付き（例: `@your-name/dsh-whale-chan-pet`）にしてください。

### インストール確認

```sh
dsh --profile web --dump-config | grep -A 2 whale-chan-pet
```

合成ツリーに次のような行が出ればOKです。

```yaml
# == dsh-whale-chan-pet
- id: whale-chan-pet
  name: dsh-whale-chan-pet
```

### アンインストール

```sh
dsh plugin --profile web remove dsh-whale-chan-pet
```

### 別プロファイルの場合

`desktop` など Web GUI を持つプロファイルなら、`--profile web` の部分をその名前に変えてください。`tui` / `headless` には `shell.overlay` がないため、このペットは表示されません。

### Desktop版

Desktop版は `desktop` プロファイルを使い、Web版の `web` プロファイルとは別管理です。Desktopアプリは完全なWeb UIをElectronで包んでいるため、このペットもそのまま動きます。

1. `dist/dsh-whale-chan-pet-0.2.0-runtime.tgz` をDesktopマシンへコピー
2. Desktopアプリの **Plugins → Add plugin** を開く
3. tarballの絶対パスを指定して Install
4. 有効化（On）してDesktopを再起動

CLIで入れる場合は、Desktopメニューの **Manage dsh Command… → Install** でDesktop付属の `dsh` コマンドを入れ、**Desktopを完全終了**してから実行します（macOSは ⌘Q、Windowsはトレイの Quit）。

```sh
dsh plugin --profile desktop add /path/to/dsh-whale-chan-pet-0.2.0-runtime.tgz
```

- Desktop起動中は `desktop` プロファイルがロックされるため、CLI操作は失敗します
- このマシンのnpm版 `dsh` では `desktop` プロファイルを変更できません。Desktop付属のコマンドを使ってください
- DesktopのAdd pluginは同梱のpnpmを使うため、Node.jsの別インストールは不要です

## 単体プレビュー

DSH を起動しなくても、ブラウザだけで見た目と状態遷移を確認できます。

```sh
cd /path/to/whale-chan-pet
npm run preview
# http://127.0.0.1:8790/preview/
```

`?state=think`、`?state=sleep`、`?state=nap`、`?state=work`、`?state=idle`、`?state=blink` で初期状態を指定できます。画面上部のボタンで状態を切り替えられます。

## スプライトの生成元（ComfyUI）

スプライトは、このマシンのComfyUIで生成したものです。

- ComfyUI: `/path/to/ComfyUI`
- ベースモデル: `animagine-xl-4.0-opt.safetensors`
  - `/path/to/models/checkpoints/`
- 背景除去: BiRefNet
  - `/path/to/models/background_removal/BiRefNet.safetensors`
- 生成スクリプト: ローカル管理（このリポジトリには含めていません）
- スプライト: `art/sprites/idle.webp`、`walk-1.webp`、`walk-2.webp`、`walk-3.webp`、`walk-4.webp`、`think.webp`、`sleep.webp`、`nap.webp`、`blink.webp`、`work.webp`（512×512 / 透過WebP）
- 歩行フレームは、正面スプライトと同じ長いウェーブ髪・アホ毛・白フリルヘッドドレスに統一
- `sleep.webp` は横たわり、`nap.webp` は座り込み、`blink.webp` は立ち姿の閉じ目です。いずれも睫毛は滑らかなラインです
- 歩行フレームは横向き（右向き）で生成し、左へ歩くときはコントローラが左右反転します

ComfyUIはQwen3.8 27BとVRAMを共有するため、同時に動かすとVRAMが足りなくなります。生成するときはQwenを一時停止し、終わったら再起動してください。Qwenの再起動スクリプトは `/path/to/llamacpp/restart-qwen.sh` にあります。

ComfyUIの起動例:

```sh
cd /path/to/ComfyUI
uv run python main.py --listen 127.0.0.1 --port 8188 \
  --enable-manager --use-ck-attention --disable-smart-memory --enable-dynamic-vram
```

## ビルド

スプライト（`art/sprites/*.webp`）を更新したときは:

```sh
npm run build
```

`src/client/sprites.js`（WebPのdata URL）と `lib/client.js` が再生成されます。歩行フレームを増やす場合は `scripts/sync-sprites.mjs` の `walk` 配列に追加し、`controller.js` のフレーム周期（現在140ms）を調整してください。`lib/client.js` は DSH の `window.__ModuleLoader__` 形式の生成物なので、直接編集しないでください。

SVG原本（`art/whale-chan.svg`）はデザインの参照用に残しています。現在のランタイムはスプライトを使うため、SVGを変更しても表示には反映されません。

## 構成

```
art/whale-chan.svg          キャラクターの原本（SVG・参照用）
art/sprites/*.webp          透過スプライト（idle / walk / think / sleep / nap / blink / work）
src/client/sprites.js       上記から生成されるdata URL
src/client/styles.css       オーバーレイ、状態アニメーション、吹き出し
src/client/activity.js      Thinking 判定（DOM 非依存・テスト対象）
src/client/controller.js    歩行・睡眠・ドラッグ・クリックの状態機械
src/client/pet.js           DSH の shell.overlay への登録と Session 監視
lib/index.js                ホスト側の空プラグイン
lib/client.js               ビルド済みブラウザバンドル
preview/                    単体プレビュー
test/                       Node の単体テスト
```

## 仕組み

- 描画先は DSH のフレーム全体を覆う `shell.overlay` スロットです。`pointer-events: none` のレイヤーにペットだけを `auto` で置くため、ペット以外の場所はクリックを邪魔しません。
- 表示中の Session は `useSessions` の `retainedBy.mainView` から選びます。
- 実行状態は `useSessionStatus` で取得します。
- Thinking は `SessionBinding.eventSource` の `assistant/live-chunk` を購読し、`reasoning-delta` / `block-start(reasoning)` を検出します。`text-delta`、`tool-call-delta`、`assistant/message`、`turn/end` などで終了と判定します。

## ライセンスとクレジット

- **コード**: MIT（`LICENSE`）
- **キャラクターアート** (`art/whale-chan.svg` / `art/sprites/*.webp`): CC BY-NC-SA 4.0（`LICENSE-ART`）
- **ベースモデル**: Animagine XL 4.0（Cagliostro Research Lab、CreativeML Open RAIL++-M）
- **背景除去**: BiRefNet（ZhengPeng7、MIT）

このキャラクターは、コミュニティプロジェクト [DeepSeek Whale-chan](https://github.com/Neko3000/deepseek-whalechan) のキャラクター設定を参考にした、非公式のファンアートです。参考画像そのものは同梱・再配布していません。オリジナルのキャラクター表記として、同プロジェクトが挙げている ZipZipPipe（[Bilibili](https://space.bilibili.com/4168597)）と上善无形（[Bilibili](https://space.bilibili.com/4456176)）のクレジットを尊重してください。

DeepSeek および関連する名称・ロゴは各権利者に帰属します。本プラグインは DeepSeek 公式ではありません。商用利用する場合は、関係する権利者の許諾が必要です。
