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
import { VRMHumanBoneName } from '@pixiv/three-vrm';




// 計算用の一時的な変数
// 不要なインスタンス化をさける
const _goalPosition = new THREE.Vector3();
const _joint2GoalVector = new THREE.Vector3();
const _effectorPosition = new THREE.Vector3();
const _joint2EffectorVector = new THREE.Vector3();
const _jointPosition = new THREE.Vector3();
const _jointQuaternionInverse = new THREE.Quaternion();
const _jointScale = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _quarternion = new THREE.Quaternion();

export const solve = (ikChain: IKChain, iteration: number) => {

    // 目標位置のワールド座標
    ikChain.goal.getWorldPosition(_goalPosition);

    for (let i = iteration; i > 0; i--) {

        let didConverge = true;
        ikChain.joints.forEach((joint) => {

            // 注目関節のワールド座標・姿勢等を取得する
            joint.bone.matrixWorld.decompose(_jointPosition, _jointQuaternionInverse, _jointScale);
            _jointQuaternionInverse.invert();

            //  注目関節 -> エフェクタのベクトル
            ikChain.effector.getWorldPosition(_effectorPosition);
            _joint2EffectorVector.subVectors(_effectorPosition, _jointPosition);
            _joint2EffectorVector.applyQuaternion(_jointQuaternionInverse);
            _joint2EffectorVector.normalize();

            // 注目関節 -> 目標位置のベクトル
            _joint2GoalVector.subVectors(_goalPosition, _jointPosition);
            _joint2GoalVector.applyQuaternion(_jointQuaternionInverse);
            _joint2GoalVector.normalize();

            // cos rad
            let deltaAngle = _joint2GoalVector.dot(_joint2EffectorVector);

            if (deltaAngle > 1.0) {
                deltaAngle = 1.0;
            } else if (deltaAngle < -1.0) {
                deltaAngle = - 1.0;
            }

            // rad
            deltaAngle = Math.acos(deltaAngle);

            // 振動回避
            if (deltaAngle < 1e-5) {
                return;
            }

            // TODO:微小回転量の制限

            // 回転軸
            _axis.crossVectors(_joint2EffectorVector, _joint2GoalVector);
            _axis.normalize();

            // 回転
            _quarternion.setFromAxisAngle(_axis, deltaAngle);
            joint.bone.quaternion.multiply(_quarternion);

            // 回転角・軸制限
            const euler = new THREE.Euler().setFromQuaternion(joint.bone.quaternion, joint.order);
            const vec = new THREE.Vector3().setFromEuler(euler);
            vec.max(joint.rotationMin).min(joint.rotationMax);
            joint.bone.rotation.setFromVector3(vec, joint.order);

            joint.bone.updateMatrixWorld(true);
            didConverge = false;
        });

        if (didConverge)
            break;
    }
}


export interface IKChain {
    goal: THREE.Object3D;
    effector: THREE.Object3D; // VRM.VRMHumanoid.getBoneNode() で取得することを想定
    joints: Array<Joint>;
}

export interface Joint {
    bone: THREE.Object3D;
    order: 'XYZ' | 'YZX' | 'ZXY' | 'XZY' | 'YXZ' | 'ZYX';
    rotationMin: THREE.Vector3;
    rotationMax: THREE.Vector3;

}

// VRM から IKChainを生成するための情報
export interface IKConfig {
    iteration: number;
    chainConfigs: Array<ChainConfig>;
}

export interface ChainConfig {
    jointConfigs: Array<JointConfig>;
    effectorBoneName: VRMHumanBoneName;   // IKChain.effectorに設定するボーン
}

export interface JointConfig {
    boneName: VRMHumanBoneName;

    // オイラー角の回転順序
    order: 'XYZ' | 'YZX' | 'ZXY' | 'XZY' | 'YXZ' | 'ZYX';

    // オイラー角による関節角度制限
    rotationMin: THREE.Vector3;    // -pi ~ pi
    rotationMax: THREE.Vector3;    // -pi ~ pi
}

