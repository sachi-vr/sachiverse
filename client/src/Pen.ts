import * as THREE from 'three';
import { GrabbableItem } from './grabbableItem';
import { Socket } from 'socket.io-client';

export class Pen extends GrabbableItem {
    private isDrawing = false;
    private currentLine: THREE.Line | null = null;
    private lineMaterial: THREE.LineBasicMaterial;
    private points: THREE.Vector3[] = [];
    private scene: THREE.Group;
    private socket: Socket;

    constructor(id: string, scene: THREE.Group, initialPosition: THREE.Vector3, socket: Socket) {
        super(id, scene, initialPosition);
        this.scene = scene;
        this.socket = socket;

        // ペンのジオメトリとマテリアルを作成
        const geometry = new THREE.CylinderGeometry(0.01, 0.01, 0.2, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x333333 });
        this.mesh.geometry = geometry;
        this.mesh.material = material;
        
        // 初期位置を設定
        this.mesh.position.copy(initialPosition);

        // 描画する線のマテリアル
        this.lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 2 });
    }

    public startDrawing() {
        if (this.isDrawing) return;
        this.isDrawing = true;
        this.points = []; // 新しい線を開始
        console.log('startDrawing called');

        const lineGeometry = new THREE.BufferGeometry().setFromPoints(this.points);
        this.currentLine = new THREE.Line(lineGeometry, this.lineMaterial);
        this.scene.add(this.currentLine);
    }

    public stopDrawing() {
        console.log('stopDrawing called');
        if (this.isDrawing) {
            this.socket.emit('drawline', { points: this.points.map(p => ({ x: p.x, y: p.y, z: p.z })) });
        }
        this.isDrawing = false;
        this.currentLine = null;
    }

    public update() {
        if (!this.isDrawing || !this.currentLine) return;
        //console.log('Pen.update called');

        // ペン先の位置を計算
        const tipOffset = new THREE.Vector3(0, -0.1, 0); // シリンダーの底面
        tipOffset.applyQuaternion(this.mesh.quaternion);
        const tipPosition = this.mesh.position.clone().add(tipOffset);

        // 新しい点を線に追加
        this.points.push(tipPosition);
        this.currentLine.geometry.setFromPoints(this.points);
    }
}