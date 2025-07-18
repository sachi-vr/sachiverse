/**
 * @file This file contains the Avatar class, which is responsible for loading and managing the VRM model.
 */

/*
MIT License

Copyright (c) 2021 Keshigom

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMUtils } from '@pixiv/three-vrm';
import { VrmIK } from './IK';

export class Avatar {

    private _scene: THREE.Object3D;
    private _vrm: VRM | null = null;
    private _vrmIK: VrmIK | null = null;

    private _loader: GLTFLoader;
    private _scaleFactor: number;

    constructor(scene: THREE.Scene, loader: GLTFLoader, scaleFactor: number) {
        this._scene = scene;
        this._loader = loader;
        this._scaleFactor = scaleFactor;
    }

    public get vrmIK(): VrmIK | null {
        return this._vrmIK;
    }

    public get vrm(): VRM | null {
        return this._vrm;
    }

    public async loadVRM(url: string) {
        if (this._vrm) {
            this._scene.remove(this._vrm.scene);
            VRMUtils.deepDispose(this._vrm.scene);
        }

        const gltf = await this._loader.loadAsync(url);
        const vrm = gltf.userData.vrm;

        if (vrm) {
            this._vrm = vrm;
            this._vrm.scene.scale.set(this._scaleFactor, this._scaleFactor, this._scaleFactor);
            this._scene.add(vrm.scene);
            VRMUtils.rotateVRM0(vrm);
            this._vrmIK = new VrmIK(vrm);
        }
    }

    public update() {
        if (this._vrmIK) {
            this._vrmIK.solve();
        }
    }
}
