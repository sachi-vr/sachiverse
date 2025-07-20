/**
 * RemoteVRPlayerクラスは、リモートプレイヤーのVRMアバターを管理します。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { Avatar } from './Avatar';
import { VRMHumanBoneName } from '@pixiv/three-vrm';

export class RemoteVRPlayer {
    public avatar: Avatar;
    private _scene: THREE.Scene;
    private _loader: GLTFLoader;
    public group: THREE.Group;
    private _vrmHeadOffsetFromRoot: THREE.Vector3 = new THREE.Vector3();
    private _textMesh: THREE.Mesh | null = null;
    private _id: string;

    constructor(scene: THREE.Scene, loader: GLTFLoader, id: string) {
        this._id = id;
        this._scene = scene;
        this._loader = loader;
        this.group = new THREE.Group();
        this._scene.add(this.group);
        this.avatar = new Avatar(this._scene, this._loader, 1.0);
    }

    /**
     * 指定されたURLからVRMモデルをロードします。
     * @param url ロードするVRMモデルのURL。
     */
    public async loadVRM(url: string): Promise<void> {
        await this.avatar.loadVRM(url);
        this.group.add(this.avatar.vrm.scene);

        // フォントをロードしてテキストを表示
        const fontLoader = new FontLoader();
        fontLoader.load('/assets/fonts/helvetiker_regular.typeface.json', (font) => {
            const textGeometry = new TextGeometry(this._id, {
                font: font,
                size: 0.2,
                height: 0.05,
            });
            textGeometry.computeBoundingBox();
            const textMaterial = new THREE.MeshBasicMaterial({ color: 0xff1133 });
            this._textMesh = new THREE.Mesh(textGeometry, textMaterial);

            // アバターの頭のボーンの位置を取得してテキストを配置
            if (this.avatar.vrm && this.avatar.vrm.humanoid) {
                const headBone = this.avatar.vrm.humanoid.getBoneNode('head');
                if (headBone) {
                    const headWorldPosition = new THREE.Vector3();
                    headBone.getWorldPosition(headWorldPosition);
                    this.group.worldToLocal(headWorldPosition);

                    this._textMesh.position.copy(headWorldPosition);
                    this._textMesh.position.y += 0.3;
                    if (textGeometry.boundingBox) {
                        this._textMesh.position.x -= (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x) / 2;
                    }
                }
            }
            this.group.add(this._textMesh);
        });

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
    }

    /**
     * リモートプレイヤーのポーズを更新します。
     * @param data 受信したプレイヤーデータ。
     */
    public updatePose(data: any): void {
        if (!this.avatar.vrm) return;
        const vrm = this.avatar.vrm;

        if (data.headsetPositionArray) {
            // リモートプレーヤーがVR内で歩いた移動をアバターへ反映
            let remoteplayerPosition = new THREE.Vector3().fromArray(data.headsetPositionArray);
            // VRヘッドセットの位置からVRMの頭のボーンのオフセットを差し引く
            remoteplayerPosition.sub(this._vrmHeadOffsetFromRoot);
            vrm.scene.position.copy(remoteplayerPosition);
        }

        if (data.headsetQuaternionArray) {
            const remoteplayerQuaternion = new THREE.Quaternion().fromArray(data.headsetQuaternionArray);
            // 逆向きになっているのを修正するため、Y軸を中心に180度回転させます。
            remoteplayerQuaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));

            // アバターのルートの回転からピッチとロール成分を除去し、ヨー成分のみを適用
            const euler = new THREE.Euler().setFromQuaternion(remoteplayerQuaternion, 'YXZ');
            euler.x = 0; // ピッチ成分をゼロにする
            euler.z = 0; // ロール成分をゼロにする
            vrm.scene.quaternion.setFromEuler(euler);
            
            // ここから頭の傾きを適用するロジックを追加
            // ヘッドセットの回転をアバターの回転からの相対回転として取得
            const headBone = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head);

            if (headBone) {
                // アバターのルートの回転からの相対回転として取得
                const relativeHeadRotation = new THREE.Quaternion();
                relativeHeadRotation.copy(vrm.scene.quaternion).invert().multiply(remoteplayerQuaternion);

                // 相対回転からヨー成分を除去し、ピッチとロールのみを抽出
                const headEuler = new THREE.Euler().setFromQuaternion(relativeHeadRotation, 'YXZ');
                headEuler.y = 0; // ヨー成分をゼロにする
                headEuler.x *= 1; // ピッチを反転
                headEuler.z *= -1; // ロールを反転
                const pitchRollQuaternion = new THREE.Quaternion().setFromEuler(headEuler);
                // 頭のボーンにピッチとロールの回転を適用
                headBone.quaternion.copy(pitchRollQuaternion);
            }
        }

        // コントローラーの位置と回転、IKの目標位置と回転を適用
        const vrmIK = this.avatar.vrmIK;
        if (vrmIK) {
            vrmIK.ikChains.forEach(chain => {
                if (chain.effector.userData.vrmHumanBoneName === VRMHumanBoneName.LeftHand && data.controllerLeftPositionArray && data.controllerLeftQuaternionArray) {
                    this._updateHandIK(chain, data.controllerLeftPositionArray, data.controllerLeftQuaternionArray);
                } else if (chain.effector.userData.vrmHumanBoneName === VRMHumanBoneName.RightHand && data.controllerRightPositionArray && data.controllerRightQuaternionArray) {
                    this._updateHandIK(chain, data.controllerRightPositionArray, data.controllerRightQuaternionArray);
                }
            });
            this.avatar.update();
        }
        // IKを更新
        this.avatar.update();
    }

    /**
     * 指定されたIKチェーンとコントローラーのデータに基づいてアバターの手を更新します。
     * @param chain 更新するIKチェーン。
     * @param positionArray 手の目標位置の配列。
     * @param quaternionArray 手の目標回転の配列。
     */
    private _updateHandIK(chain: any, positionArray: number[], quaternionArray: number[]) {
        const vrm = this.avatar.vrm!;
        const goalPosition = new THREE.Vector3().fromArray(positionArray);
        const goalQuaternion = new THREE.Quaternion().fromArray(quaternionArray);

        // 目標位置をアバターのローカル座標に変換します。
        const localPositon = vrm.scene.worldToLocal(goalPosition);

        // アバターのワールド回転を取得し、目標回転に適用します。
        const parentRotation = new THREE.Quaternion();
        vrm.scene.getWorldQuaternion(parentRotation);
        goalQuaternion.premultiply(parentRotation.invert());

        localPositon.add(vrm.scene.position);
        // IKチェーンの目標位置と回転を設定します。
        chain.goal.position.copy(localPositon);
        //chain.goal.position.copy(new THREE.Vector3(0, 0, 0));
        chain.goal.quaternion.copy(goalQuaternion);
    }

    /**
     * リモートプレイヤーのアバターをシーンから削除します。
     */
    public dispose(): void {
        if (this.avatar.vrm) {
            this.group.remove(this.avatar.vrm.scene);
        }
        if (this._textMesh) {
            this.group.remove(this._textMesh);
            this._textMesh.geometry.dispose();
            (this._textMesh.material as THREE.Material).dispose();
        }
        this._scene.remove(this.group);
    }
}
