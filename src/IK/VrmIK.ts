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
import { VRM } from '@pixiv/three-vrm';
import * as IKSolver from './IKSolver';
import { defaultIKConfig } from './DefaultConfig';


export class VrmIK {

    private _chains: Array<IKSolver.IKChain>;
    private _iteration: number;

    constructor(vrm: VRM, ikConfig: IKSolver.IKConfig = defaultIKConfig) {

        this._chains = ikConfig.chainConfigs.map((chainConfig) => {
            return this._createIKChain(vrm, chainConfig);
        }).filter((chain): chain is IKSolver.IKChain => chain !== null);
        this._iteration = ikConfig.iteration || 1;
        console.log(`VrmIK: ${this._chains.length} chains created with ${this._iteration} iterations.`);
    }

    public get ikChains(): Array<IKSolver.IKChain> {
        return this._chains;
    }

    // TODO: updateの方が良い？
    public solve() {
        this._chains.forEach(chain => {
            IKSolver.solve(chain, this._iteration);
        });
    }

    private _createIKChain(vrm: VRM, chainConfig: IKSolver.ChainConfig): IKSolver.IKChain | null {

        const goal = new THREE.Object3D();
        /* IKのゴール確認用球体
        const sphereGeometry = new THREE.SphereGeometry(0.05, 8, 8); // 小さな球体
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true }); // 赤いワイヤーフレーム
        const goalHelper = new THREE.Mesh(sphereGeometry, material);
        goal.add(goalHelper); // goalオブジェクトの子として追加
        */
        const effector = vrm.humanoid.getNormalizedBoneNode(chainConfig.effectorBoneName);
        if (!effector) {
            console.warn(`Failed to get bone: ${chainConfig.effectorBoneName}`);
            return null;
        }
        // Add the VRMHumanBoneName to the effector's userData for easier lookup
        effector.userData.vrmHumanBoneName = chainConfig.effectorBoneName;

        const joints = chainConfig.jointConfigs.map((jointConfig) => {
            return this._createJoint(vrm, jointConfig);
        }).filter((joint): joint is IKSolver.Joint => joint !== null);


        effector.getWorldPosition(goal.position);
        vrm.scene.add(goal);

        console.log(`VrmIK: Created IKChain for effector: ${chainConfig.effectorBoneName}, joints: ${joints.map(j => j.bone.name).join(', ')}`);
        return {
            goal: goal,
            effector: effector,
            joints: joints
        }
    }

    private _createJoint(vrm: VRM, jointConfig: IKSolver.JointConfig): IKSolver.Joint | null {
        const bone = vrm.humanoid.getNormalizedBoneNode(jointConfig.boneName);
        if (!bone) {
            console.warn(`Failed to get bone: ${jointConfig.boneName}`);
            return null;
        }

        return {
            bone: bone,
            order: jointConfig.order,
            rotationMin: jointConfig.rotationMin,
            rotationMax: jointConfig.rotationMax,
        }
    }

}

