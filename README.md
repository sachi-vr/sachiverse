# sachiverse プロジェクト概要

##　プロジェクトの目的
ブラウザで動くVRゲーム。マルチプレーヤ。

## 利用
### 操作
WebXRを使いVRで動作します。
左手コントローラのスティックで移動。

## 開発
### クライアント
three-vrm と WebXR を使用。

### サーバ
express と socket.io を使用。

### 仕組み
プレイヤーの身長とアバターの身長は違います。
もし、プレーヤーの身長よりアバターの方が小さかった場合、アバターと地面を大きくします。(scaleFactor > 1)

プレーヤーは現実に居ます。左手のコントローラのスティックで移動した場合、プレーヤーの現実の位置を移動できないので地面側を動かします。(playerPositionOffset)

プレーヤーは現実を自由に歩いて向きを変えれます。プレヤーの動きに合わせてアバターを動かします。(headsetPosition, headsetQuaternion)
プレーヤーがコントローラの位置を変えれます。この動きに合わせてアバターの手を動かします。この時の座標系はアバターの足元のVRM rootからの相対です。(HandPosition, HandQuatern)

scaleFactorを戻したプレーヤーの情報をサーバに送りリモートプレーヤーの情報にします。

リモートプレヤーは、地面の座標系をコントローラーのスティックで移動した分移動します。(playerPositionOffset)
また、リモートプレイヤーが歩いた分や向きを変えた分アバターをremotegroup内で動かします。(headsetPosition, headsetQuaternion)
リモートプレーヤーの手もアバターの足元のVRM rootからの相対で動かします。(HandPosition, HandQuatern)

### クライアント実行方法
開発用の実行
```
cd client; npm run dev
```
ビルドする
```
cd client; npm run build
```
### サーバ実行方法
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

## ライセンスと参考
https://github.com/Keshigom/VRMToybox を参考にさせていただいてます。
よってMITライセンスにします。