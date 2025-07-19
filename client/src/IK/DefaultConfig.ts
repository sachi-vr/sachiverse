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

import { Vector3 } from 'three';
import { VRMHumanBoneName } from '@pixiv/three-vrm';
import type { IKConfig } from './IKSolver';


/*
example
{
    iteration:number,   // 反復回数
    chainConfigs:[      // IKチェイン 
        {
            jointConfigs:[  // 手先から根本
                {},         // Effectorの親
                            // ||
                            // V
                {           // RootBone
                    boneName:  VRMHumanBoneName.Hoge,
                    order: 'XYZ',   // 回転順序
                    rotationMin: new Vector3(-Math.PI,0,0)    // 最小 回転角制限  -Pi ~ Pi
                    rotationMax: new Vector3(Math.PI,0,0)    // 最大 回転角制限  -Pi ~ Pi
                }          
            ],
            effecotrBoneName:,
        },
    ]
}
*/

// VRM0.xの必須ボーンのみで構成
export const defaultIKConfig: IKConfig = {
    iteration: 8,
    chainConfigs: [
        // Hip -> Head
        {
            jointConfigs: [

                {
                    boneName: VRMHumanBoneName.Chest,
                    order: 'XYZ',
                    rotationMin: new Vector3(-Math.PI, -Math.PI, -Math.PI),
                    rotationMax: new Vector3(Math.PI, Math.PI, Math.PI),
                },
                {
                    boneName: VRMHumanBoneName.Spine,
                    order: 'XYZ',
                    rotationMin: new Vector3(-Math.PI, -Math.PI, -Math.PI),
                    rotationMax: new Vector3(Math.PI, Math.PI, Math.PI),
                },
                {
                    boneName: VRMHumanBoneName.Hips,
                    order: 'XYZ',
                    rotationMin: new Vector3(-Math.PI, -Math.PI, -Math.PI),
                    rotationMax: new Vector3(Math.PI, Math.PI, Math.PI),
                },
            ],
            effectorBoneName: VRMHumanBoneName.Neck,
        },
        // Left Shoulder -> Hand
        {
            jointConfigs: [
                {
                    boneName: VRMHumanBoneName.LeftLowerArm,
                    order: 'YZX',
                    rotationMin: new Vector3(0, -Math.PI, 0),
                    rotationMax: new Vector3(0, -(0.1 / 180) * Math.PI, 0),
                },
                {
                    boneName: VRMHumanBoneName.LeftUpperArm,
                    order: 'ZXY',
                    rotationMin: new Vector3(-Math.PI / 2, -Math.PI, - Math.PI),
                    rotationMax: new Vector3(Math.PI / 2, Math.PI, Math.PI),
                },
                {
                    boneName: VRMHumanBoneName.LeftShoulder,
                    order: 'ZXY',
                    rotationMin: new Vector3(0, -(45 / 180) * Math.PI, -(45 / 180) * Math.PI),
                    rotationMax: new Vector3(0, (45 / 180) * Math.PI, 0),
                }
            ],
            effectorBoneName: VRMHumanBoneName.LeftHand
        },
        // Right Shoulder -> Hand
        {
            jointConfigs: [
                {
                    boneName: VRMHumanBoneName.RightLowerArm,
                    order: 'YZX',
                    rotationMin: new Vector3(0, (0.1 / 180) * Math.PI, 0),
                    rotationMax: new Vector3(0, Math.PI, 0),
                },
                {
                    boneName: VRMHumanBoneName.RightUpperArm,
                    order: 'ZXY',
                    rotationMin: new Vector3(-Math.PI / 2, -Math.PI, -Math.PI),
                    rotationMax: new Vector3(Math.PI / 2, Math.PI, Math.PI),
                },
                {
                    boneName: VRMHumanBoneName.RightShoulder,
                    order: 'ZXY',
                    rotationMin: new Vector3(0, -(45 / 180) * Math.PI, 0),
                    rotationMax: new Vector3(0, (45 / 180) * Math.PI, (45 / 180) * Math.PI),
                },
            ],
            effectorBoneName: VRMHumanBoneName.RightHand
        },
        // Left Leg
        {
            jointConfigs: [
                {
                    boneName: VRMHumanBoneName.LeftLowerLeg,
                    order: 'XYZ',
                    rotationMin: new Vector3(-Math.PI, 0, 0),
                    rotationMax: new Vector3(0, 0, 0),

                },
                {
                    boneName: VRMHumanBoneName.LeftUpperLeg,
                    order: 'XYZ',
                    rotationMin: new Vector3(-Math.PI, -Math.PI, -Math.PI),
                    rotationMax: new Vector3(Math.PI, Math.PI, Math.PI),
                },
            ],
            effectorBoneName: VRMHumanBoneName.LeftFoot
        },
        // Right Leg
        {
            jointConfigs: [
                {
                    boneName: VRMHumanBoneName.RightLowerLeg,
                    order: 'XYZ',
                    rotationMin: new Vector3(-Math.PI, 0, 0),
                    rotationMax: new Vector3(0, 0, 0),
                },
                {
                    boneName: VRMHumanBoneName.RightUpperLeg,
                    order: 'XYZ',
                    rotationMin: new Vector3(-Math.PI, -Math.PI, -Math.PI),
                    rotationMax: new Vector3(Math.PI, Math.PI, Math.PI),
                },
            ],
            effectorBoneName: VRMHumanBoneName.RightFoot
        },
    ]
};