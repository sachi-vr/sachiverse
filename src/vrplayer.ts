/**
 * VRPlayerクラスは、VRMアバターとVRコントローラーの管理
 */
import * as THREE from 'three';
import { VRMHumanBoneName } from '@pixiv/three-vrm';
import { Avatar } from './Avatar';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

export class VRPlayer {
    // コントローラのスティックで地面を移動した量
    private _playerPositionOffset = new THREE.Vector3();
    private speed = 2.0; // 移動速度
    // WebXRのVRヘッドセットカメラ。VRヘッドセットのVRの原点から座標や角度がとれる
    private _xrHeadsetCamera: THREE.Camera;
    // WebXRのコントローラー
    private _xrControllerLeft?: THREE.XRTargetRaySpace;
    private _xrCcontrollerRight?: THREE.XRTargetRaySpace;
    // VRMアバターを管理。
    public avatar: Avatar;
    private _renderer: THREE.WebGLRenderer;
    private _loader: GLTFLoader;
    // 地面のグループ
    private _groudGroup: THREE.Group;
    private _vrmHeadOffsetFromRoot: THREE.Vector3 = new THREE.Vector3();

    /* ヘッドセットとコントローラーの移動量に適用する比率
    実際の身長とVRMの身長が異なる場合に調整します。
    例: 実際の身長が1.7mでアバターが1.0mの場合、1.7/1.0 = 1.7
    */
    private _scaleFactor: number = 1.5;

    // デバッグモードのフラグ
    private _debugMode: boolean = false;
    // デバッグ用の球体
    private _vrmOriginDebugSphere: THREE.Mesh;
    private _headsetDebugSphere: THREE.Mesh;
    private _controllerLeftDebugSphere: THREE.Mesh;
    private _controllerRightDebugSphere: THREE.Mesh;
    private _xButtonPreviouslyPressed: boolean = false; // To detect rising edge of button press

    constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, groundGroup: THREE.Group) {
        this._groudGroup = groundGroup; // worldGroupを保存
        this._groudGroup.scale.set(this._scaleFactor, this._scaleFactor, this._scaleFactor);

        // GLTFLoaderを初期化し、VRMLoaderPluginを登録します。
        this._loader = new GLTFLoader();
        this._loader.register((parser) => {
            return new VRMLoaderPlugin(parser);
        });

        // アバターを初期化し、シーンに追加します。
        this.avatar = new Avatar(scene, this._loader, this._scaleFactor);
        this._renderer = renderer;
        // WebXRヘッドセットのカメラを取得します。
        this._xrHeadsetCamera = this._renderer.xr.getCamera();

        // デバッグ用の球体を初期化し、シーンに追加
        const debugGeometry = new THREE.SphereGeometry(0.05, 32, 32);
        this._vrmOriginDebugSphere = new THREE.Mesh(debugGeometry, new THREE.MeshBasicMaterial({ color: 0xff0000 })); // 赤
        this._headsetDebugSphere = new THREE.Mesh(debugGeometry, new THREE.MeshBasicMaterial({ color: 0x00ff00 })); // 緑
        this._controllerLeftDebugSphere = new THREE.Mesh(debugGeometry, new THREE.MeshBasicMaterial({ color: 0x0000ff })); // 青
        this._controllerRightDebugSphere = new THREE.Mesh(debugGeometry, new THREE.MeshBasicMaterial({ color: 0xffff00 })); // 黄

        scene.add(this._vrmOriginDebugSphere);
        scene.add(this._headsetDebugSphere);
        scene.add(this._controllerLeftDebugSphere);
        scene.add(this._controllerRightDebugSphere);

        // 初期状態では非表示
        this._vrmOriginDebugSphere.visible = false;
        this._headsetDebugSphere.visible = false;
        this._controllerLeftDebugSphere.visible = false;
        this._controllerRightDebugSphere.visible = false;

        // コントローラーを検出し、左右のコントローラーを特定します。
        for (let i = 0; i < 2; i++) {
            const controller = this._renderer.xr.getController(i);
            controller.addEventListener('connected', (event) => {
                if (event.data.handedness === 'left') {
                    this._xrControllerLeft = controller;
                } else if (event.data.handedness === 'right') {
                    this._xrCcontrollerRight = controller;
                }
                // ボタンイベントリスナーはupdate内で処理するため削除
                // controller.addEventListener('selectstart', () => this._toggleDebugMode());
            });
            controller.addEventListener('disconnected', (event) => {
                if (event.data.handedness === 'left') {
                    this._xrControllerLeft = undefined;
                } else if (event.data.handedness === 'right') {
                    this._xrCcontrollerRight = undefined;
                }
            });
        }
    }

    /**
     * 指定されたURLからVRMモデルをロードします。
     * @param url ロードするVRMモデルのURL。
     */
    public async loadVRM(url: string) {
        await this.avatar.loadVRM(url);

        // VRMの頭のボーンの初期位置を計算し、ルートからのオフセットを保存
        const headBone = this.avatar.vrm!.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);
        if (headBone) {
            const headPosition = new THREE.Vector3();
            headBone.getWorldPosition(headPosition);
            const vrmRootPosition = new THREE.Vector3();
            this.avatar.vrm!.scene.getWorldPosition(vrmRootPosition);
            this._vrmHeadOffsetFromRoot.subVectors(headPosition, vrmRootPosition);
            //this._vrmHeadOffsetFromRoot.multiplyScalar(this._scaleFactor);
        }

        console.log("Debug sphere added to VRM origin.");
        console.log("_vrmHeadOffsetFromRoot: ", this._vrmHeadOffsetFromRoot);
    }

    /**
     * プレイヤーの状態を毎フレーム更新します。
     * @param delta 前のフレームからの経過時間（秒）。
     */
    public update(delta: number) {
        // VRMモデルがロードされていない、またはWebXRがプレゼンテーション中でない場合は更新をスキップします。
        if (!this.avatar.vrm || !this._renderer.xr.isPresenting) {
            return;
        }

        // 移動、頭と手の更新を処理します。
        this._handleMovement(delta);
        this._updateHead();
        this._updateHands();
        this._handleInput(); // 新しい入力処理メソッドを呼び出す

        // デバッグモードが有効な場合、デバッグ用の球体の位置を更新
        if (this._debugMode) {
            this._updateDebugSpheres();
        }
    }

    /**
     * 左手コントローラーの入力に基づいてプレイヤーを移動させます。
     * @param delta 前のフレームからの経過時間（秒）。
     */
    private _handleMovement(delta: number) {
        // 左コントローラーがない場合は処理をスキップします。
        if (!this._xrControllerLeft) return;

        const session = this._renderer.xr.getSession();
        // セッションまたは入力ソースがない場合は処理をスキップします。
        if (!session || !session.inputSources) return;

        for (const source of session.inputSources) {
            // 左手コントローラーのゲームパッド入力を処理します。
            if (source.handedness === 'left' && source.gamepad) {
                const gamepad = source.gamepad;
                const xAxis = gamepad.axes[2];
                const yAxis = gamepad.axes[3];

                // スティックの傾きが閾値を超えている場合のみ移動を処理します。
                if (Math.abs(xAxis) > 0.1 || Math.abs(yAxis) > 0.1) {
                    const headQuaternion = new THREE.Quaternion();
                    this._xrHeadsetCamera.getWorldQuaternion(headQuaternion);

                    // ヘッドセットの向きに基づいて移動方向を計算します。
                    const moveDirection = new THREE.Vector3(xAxis, 0, yAxis);
                    moveDirection.applyQuaternion(headQuaternion);
                    moveDirection.y = 0; // Y軸方向の移動は無視します。
                    moveDirection.normalize();

                    // 移動量を計算し、ワールドグループの位置オフセットに減算します（地面側を移動するため）。
                    const moveAmount = moveDirection.multiplyScalar(this.speed * delta);
                    this._playerPositionOffset.sub(moveAmount);
                    this._groudGroup.position.copy(this._playerPositionOffset);
                }
            }
        }
    }

    

    /**
     * ヘッドセットの動きに基づいてアバターの頭部を更新します。
     */
    private _updateHead() {
        const vrm = this.avatar.vrm!;
        const headBone = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);

        if (headBone) {
            // ヘッドセットのVR座標を取得
            const headsetWorldPosition = new THREE.Vector3();
            this._xrHeadsetCamera.getWorldPosition(headsetWorldPosition);

            // ヘッドセットのVR回転を取得
            const headsetWorldQuaternion = new THREE.Quaternion();
            this._xrHeadsetCamera.getWorldQuaternion(headsetWorldQuaternion);

            // アバターのルート位置を計算
            // VRヘッドセットの位置からVRMの頭のボーンのオフセットを差し引く
            const avatarPosition = headsetWorldPosition.clone().sub(this._vrmHeadOffsetFromRoot);

            // アバターのルート回転を計算
            const avatarQuaternion = headsetWorldQuaternion.clone();
            // アバターが逆向きになっているのを修正するため、Y軸を中心に180度回転させます。
            avatarQuaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));

            vrm.scene.position.copy(avatarPosition);

            // ここから修正: アバターのルートの回転からピッチとロール成分を除去し、ヨー成分のみを適用
            const euler = new THREE.Euler().setFromQuaternion(avatarQuaternion, 'YXZ');
            euler.x = 0; // ピッチ成分をゼロにする
            euler.z = 0; // ロール成分をゼロにする
            vrm.scene.quaternion.setFromEuler(euler);

            // ここから頭の傾きを適用するロジックを追加
            // ヘッドセットの回転をアバターの回転からの相対回転として取得
            const relativeHeadRotation = new THREE.Quaternion();
            relativeHeadRotation.copy(vrm.scene.quaternion).invert().multiply(headsetWorldQuaternion);

            // 相対回転からヨー成分を除去し、ピッチとロールのみを抽出
            const headEuler = new THREE.Euler().setFromQuaternion(relativeHeadRotation, 'YXZ');
            headEuler.y = 0; // ヨー成分をゼロにする
            headEuler.x *= -1; // ピッチを反転
            headEuler.z *= -1; // ロールを反転
            const pitchRollQuaternion = new THREE.Quaternion().setFromEuler(headEuler);

            // 頭のボーンにピッチとロールの回転を適用
            // VRMの頭のボーンの初期姿勢を考慮する必要があるかもしれないが、
            // ここではシンプルに直接適用してみる
            headBone.quaternion.copy(pitchRollQuaternion);
        }
    }

    /**
     * コントローラーの動きに基づいてアバターの手を更新します。
     */
    private _updateHands() {
        const vrmIK = this.avatar.vrmIK;
        if (!vrmIK) return;

        vrmIK.ikChains.forEach(chain => {
            // 左手と右手に対応するIKチェーンを更新します。
            if (chain.effector.userData.vrmHumanBoneName === VRMHumanBoneName.LeftHand && this._xrControllerLeft) {
                this._updateHand(chain, this._xrControllerLeft);
            } else if (chain.effector.userData.vrmHumanBoneName === VRMHumanBoneName.RightHand && this._xrCcontrollerRight) {
                this._updateHand(chain, this._xrCcontrollerRight);
            }
        });
    }

    /**
     * デバッグモードを切り替えます。
     */
    private _toggleDebugMode() {
        this._debugMode = !this._debugMode;
        this._vrmOriginDebugSphere.visible = this._debugMode;
        this._headsetDebugSphere.visible = this._debugMode;
        this._controllerLeftDebugSphere.visible = this._debugMode;
        this._controllerRightDebugSphere.visible = this._debugMode;
        console.log(`Debug mode: ${this._debugMode ? 'ON' : 'OFF'}`);
    }

    /**
     * デバッグ用の球体の位置を更新します。
     */
    private _updateDebugSpheres() {
        // VRM原点の球体
        if (this.avatar.vrm) {
            this._vrmOriginDebugSphere.position.copy(this.avatar.vrm.scene.position);
        }

        // VRヘッドセットの球体
        this._xrHeadsetCamera.getWorldPosition(this._headsetDebugSphere.position);

        // コントローラーの球体
        if (this._xrControllerLeft) {
            this._xrControllerLeft.getWorldPosition(this._controllerLeftDebugSphere.position);
        }
        if (this._xrCcontrollerRight) {
            this._xrCcontrollerRight.getWorldPosition(this._controllerRightDebugSphere.position);
        }
    }

    /**
     * 指定されたIKチェーンとコントローラーに基づいてアバターの手を更新します。
     * @param chain 更新するIKチェーン。
     * @param controller 手の目標位置と回転を提供するXRコントローラー。
     */
    private _updateHand(chain: any, controller: THREE.XRTargetRaySpace) {
        const vrm = this.avatar.vrm!;
        const goalPosition = new THREE.Vector3();
        const goalQuaternion = new THREE.Quaternion();

        // コントローラーのワールド位置と回転を取得します。
        controller.getWorldPosition(goalPosition);
        controller.getWorldQuaternion(goalQuaternion);

        // 目標位置をアバターのローカル座標に変換します。
        vrm.scene.worldToLocal(goalPosition);

        // アバターのワールド回転を取得し、目標回転に適用します。
        const parentRotation = new THREE.Quaternion();
        vrm.scene.getWorldQuaternion(parentRotation);
        goalQuaternion.premultiply(parentRotation.invert());

        // IKチェーンの目標位置と回転を設定します。
        chain.goal.position.copy(goalPosition);
        chain.goal.quaternion.copy(goalQuaternion);
    }

    /**
     * コントローラーの入力を処理します。
     */
    private _handleInput() {
        if (!this._xrControllerLeft) return;

        const session = this._renderer.xr.getSession();
        if (!session || !session.inputSources) return;

        for (const source of session.inputSources) {
            if (source.handedness === 'left' && source.gamepad) {
                const gamepad = source.gamepad;
                // Xボタン (OpenXRのインデックスでは4番目が多いが、環境によって異なる可能性あり)
                // 一般的なVRコントローラーのボタンマッピングを考慮し、ここでは例として4を使用
                // Oculus Touch: Xボタンは通常 index 4
                // Valve Index Controller: Bボタンが index 4
                // 実際の環境に合わせて調整が必要
                const xButton = gamepad.buttons[4]; 

                if (xButton && xButton.pressed && !this._xButtonPreviouslyPressed) {
                    this._toggleDebugMode();
                }
                this._xButtonPreviouslyPressed = xButton ? xButton.pressed : false;
            }
        }
    }
}
