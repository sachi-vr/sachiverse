import * as THREE from 'three';

export class Item {
    public id: string;
    private _mesh: THREE.Mesh;
    protected _isGrabbed: boolean = false;
    protected _grabbedBy: string | null = null; // socket.id of the grabbing player
    private _originalColor: THREE.Color;

    constructor(id: string, scene: THREE.Group, initialPosition: THREE.Vector3) {
        this.id = id;
        this._mesh = new THREE.Mesh();
        this._mesh.position.copy(initialPosition);
        scene.add(this._mesh);
        this._originalColor = new THREE.Color(0xffffff); // Default color
    }

    public get mesh(): THREE.Mesh {
        return this._mesh;
    }

    public grab(grabbedBy: string) {
        this._isGrabbed = true;
        this._grabbedBy = grabbedBy;
        (this._mesh.material as THREE.MeshStandardMaterial).color.set(0x0000ff); // Change color to blue when grabbed
    }

    public release() {
        this._isGrabbed = false;
        this._grabbedBy = null;
        (this._mesh.material as THREE.MeshStandardMaterial).color.copy(this._originalColor); // Revert to original color
    }

    public get isGrabbed(): boolean {
        return this._isGrabbed;
    }

    public get grabbedBy(): string | null {
        return this._grabbedBy;
    }

    public checkCollision(controllerPosition: THREE.Vector3): boolean {
        const itemPosition = new THREE.Vector3();
        this.mesh.getWorldPosition(itemPosition);
        return controllerPosition.distanceTo(itemPosition) < 1.0;
    }

    public updateState(isGrabbed: boolean, grabbedBy: string | null) {
        if (isGrabbed) {
            this.grab(grabbedBy!);
        } else {
            this.release();
        }
    }
}
