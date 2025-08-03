
import * as THREE from 'three';
import { Item } from './item';

export class GrabbableItem extends Item {
    private _groundAndItemsGroup: THREE.Group;

    constructor(id: string, scene: THREE.Group, initialPosition: THREE.Vector3) {
        super(id, scene, initialPosition);
        this._groundAndItemsGroup = scene;
    }

    public get isGrabbed(): boolean {
        return this._grabbedBy !== null;
    }

    public get grabbedBy(): string | null {
        return this._grabbedBy;
    }

    public grab(grabbedBy: string) {
        this._grabbedBy = grabbedBy;
        // 物理的な挙動を停止するなど、掴まれたときのエフェクトをここに追加できます
    }

    public release() {
        this._grabbedBy = null;
        // 物理的な挙動を再開するなど、離されたときのエフェクトをここに追加できます
    }

    public updateState(isGrabbed: boolean, grabbedBy: string | null) {
        if (isGrabbed) {
            this.grab(grabbedBy!);
        } else {
            this.release();
        }
    }

    public updatePosition(position: THREE.Vector3, quaternion: THREE.Quaternion) {
        // ワールド座標をgroundAndItemsGroupのローカル座標に変換
        const localPosition = this._groundAndItemsGroup.worldToLocal(position.clone());
        this.mesh.position.copy(localPosition);
        
        // ワールド回転をgroundAndItemsGroupのローカル回転に変換
        const parentRotation = new THREE.Quaternion();
        this._groundAndItemsGroup.getWorldQuaternion(parentRotation);
        const localQuaternion = quaternion.clone().premultiply(parentRotation.invert());
        this.mesh.quaternion.copy(localQuaternion);
    }
}
