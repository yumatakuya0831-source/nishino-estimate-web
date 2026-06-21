# 実装メモ

## 現在の実装範囲

- 見積作成・編集
- 顧客係数を反映した明細計算
- 工種別集計、直接工事費、諸経費、総額の計算
- 帳票プレビュー
- ブラウザ印刷によるPDF保存
- 顧客、単価、工種、会社情報、ユーザーのマスタ管理画面
- 単価PDF取込、差分確認、選択反映
- 管理者/一般ユーザーの画面上の権限制御
- Supabase用DBスキーマ

## PDF保存

プレビュー画面の「印刷 / PDF保存」からブラウザの印刷ダイアログを開きます。
保存先を「PDFに保存」にすると、鏡と各種内訳明細が1つのPDFとして保存されます。

## Supabase接続

`.env.local` に以下を設定します。

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

初期版はブラウザのlocalStorageで動作します。
本番化では `lib/store.ts` の読み書きをSupabaseクエリへ置き換えます。

## 単価PDF取込

PDFのテキスト抽出結果から「頁 名称 摘要 備考 施工 単位 材料単価 材料費 労務費 経費 複合単価」の形式を解析します。
PDFレイアウト変更に備えて、信頼度の低い行は `uncertain` として差分確認画面に出します。

日本語PDFを読むため、`public/cmaps/` にPDF.jsのCMapファイルを配置しています。
実運用前に、実際の年度PDFを複数サンプルで確認し、`lib/price-import/parser.ts` の正規化ルールを調整してください。
