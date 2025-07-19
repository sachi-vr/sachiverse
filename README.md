# sachiverse プロジェクト概要

##　プロジェクトの目的
ブラウザで動くVRゲーム。マルチプレーヤ。

### クライアント
three-vrm と WebXR を使用。

### サーバ
express と socket.io を使用。

## 実行
### クライアント実行
開発用の実行
```
cd client; npm run dev
```
ビルドする
```
cd client; npm run build
```
### サーバ実行
```
cd server; npm run start
```

開発用の実行
```
cd server; npm run dev
```

HTTPSで実行
```
cd server; npm run start:https
```

HTTPSで開発用の実行
```
cd server; npm run dev:https
```

## 操作
WebXRを使いVRで動作します。
左手コントローラのスティックで移動。

## ライセンスと参考
https://github.com/Keshigom/VRMToybox を参考にさせていただいてます。
よってMITライセンスにします。