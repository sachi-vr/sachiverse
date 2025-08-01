/**
 * RemoteVRPlayerクラスは、リモートプレイヤーのVRMアバターを管理します。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { Avatar } from './Avatar';
import { VRMHumanBoneName } from '@pixiv/three-vrm';
import { WebRTCAudioClient } from './webrtcAudioClient';

export class RemoteVRPlayer {
    public avatar: Avatar;
    private _scene: THREE.Scene;
    private _loader: GLTFLoader;
    public remotegroup: THREE.Group;
    private _vrmHeadOffsetFromRoot: THREE.Vector3 = new THREE.Vector3();
    private _textMesh: THREE.Mesh | null = null;
    private _username: string;
    private _webRTCAudioClient: WebRTCAudioClient;
    private _socketId: string;

    constructor(scene: THREE.Scene, loader: GLTFLoader, username: string, socketId: string, webRTCAudioClient: WebRTCAudioClient) {
        
        this._username = username;
        this._scene = scene;
        this._loader = loader;
        this.remotegroup = new THREE.Group();
        this._scene.add(this.remotegroup);
        this.avatar = new Avatar(this._scene, this._loader, 1.0);
        this._webRTCAudioClient = webRTCAudioClient;
        this._socketId = socketId;
    }

    /**
     * 指定されたURLからVRMモデルをロードします。
     * @param url ロードするVRMモデルのURL。
     */
    public async loadVRM(url: string): Promise<void> {
        await this.avatar.loadVRM(url);
        this.remotegroup.add(this.avatar.vrm.scene);

        // フォントをロードしてテキストを表示
        const fontLoader = new FontLoader();
        fontLoader.load('/assets/fonts/helvetiker_regular.typeface.json', (font) => {
            const textGeometry = new TextGeometry(this._username, {
                font: font,
                size: 0.2,
                depth: 0.05,
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
                    this.remotegroup.worldToLocal(headWorldPosition);

                    this._textMesh.position.copy(headWorldPosition);
                    this._textMesh.position.y += 0.3;
                    if (textGeometry.boundingBox) {
                        this._textMesh.position.x -= (textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x) / 2;
                    }
                }
            }
            this.remotegroup.add(this._textMesh);
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
                if (chain.effector.userData.vrmHumanBoneName === VRMHumanBoneName.LeftHand && data.leftHandPositionArray && data.leftHandQuaternionArray) {
                    chain.goal.position.copy(new THREE.Vector3().fromArray(data.leftHandPositionArray));
                    chain.goal.quaternion.copy(new THREE.Quaternion().fromArray(data.leftHandQuaternionArray) );
                } else if (chain.effector.userData.vrmHumanBoneName === VRMHumanBoneName.RightHand && data.rightHandPositionArray && data.rightHandQuaternionArray) {
                    chain.goal.position.copy(new THREE.Vector3().fromArray(data.rightHandPositionArray));
                    chain.goal.quaternion.copy(new THREE.Quaternion().fromArray(data.rightHandQuaternionArray) );
                }
            });
            this.avatar.update();
        }
        // IKを更新
        this.avatar.update();
    }

    public update(): void {
        if (!this.avatar.vrm || !this._textMesh) return;

        const volume = this._webRTCAudioClient.getRemoteStreamVolume(this._socketId);
        const color = new THREE.Color(0xff1133);
        const speakingColor = new THREE.Color(0x00ff00);
        color.lerp(speakingColor, volume * 5);
        (this._textMesh.material as THREE.MeshBasicMaterial).color = color;
    }

    /**
     * リモートプレイヤーのアバターをシーンから削除します。
     */
    public dispose(): void {
        if (this.avatar.vrm) {
            this.remotegroup.remove(this.avatar.vrm.scene);
        }
        if (this._textMesh) {
            this.remotegroup.remove(this._textMesh);
            this._textMesh.geometry.dispose();
            (this._textMesh.material as THREE.Material).dispose();
        }
        this._scene.remove(this.remotegroup);
    }
}
