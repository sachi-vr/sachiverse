import * as THREE from 'three';
import { GrabbableItem } from './grabbableItem';

export class Pen extends GrabbableItem {
    constructor(id: string, scene: THREE.Group, initialPosition: THREE.Vector3) {
        super(id, scene, initialPosition);

        // ペンのジオメトリとマテリアルを作成
        const geometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8); // 半径、長さ、分割数
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // 赤色
        
        // メッシュを構築
        this.mesh.geometry = geometry;
        this.mesh.material = material;
        
        // 初期位置を設定
        this.mesh.position.copy(initialPosition);
    }
}
