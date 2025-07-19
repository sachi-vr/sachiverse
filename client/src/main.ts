/**
 * @file This is the main entry point of the application.
 * It sets up the Three.js scene, camera, renderer, and the main animation loop.
 */

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { io } from 'socket.io-client';
import { VRPlayer } from './vrplayer';
import { Avatar } from './Avatar';

// シーン作成
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcccccc);

// カメラとレンダラーの設定
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// カメラの位置を設定x,y,z
camera.position.set(0, 1, 2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// Enter VRするまではOrbitControlsを使用
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.update();

// WebXRやThree.jsの座標系は右手系。x軸が右、y軸が上、z軸が前。
// Directionallightの設定
const light = new THREE.DirectionalLight(0xffffff);
light.position.set(1, 1, -1).normalize(); // 右上奥。
scene.add(light);

// WebXRの制限かThree.jsの制限でVRに入った後、カメラの位置を移動できない。
// そのため、groundAndItemGroupを作成し、groundAndTemGroupの位置を移動することで、VR内でのプレイヤーの位置を調整する。
const groundAndItemsGroup = new THREE.Group();
scene.add(groundAndItemsGroup);

// ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.8, metalness: 0.2 })
);
ground.rotation.x = -Math.PI / 2;
groundAndItemsGroup.add(ground);

// box
const box = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 1, 0.5),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
box.position.set(0.25, 0.25, 1);
groundAndItemsGroup.add(box);

// Mirror
const mirror = new Reflector(
  new THREE.PlaneGeometry(4, 4),
  {
    color: new THREE.Color(0x808080),
    textureWidth: window.innerWidth * window.devicePixelRatio,
    textureHeight: window.innerHeight * window.devicePixelRatio
  }
);
mirror.position.y = 2;
mirror.position.z = -2;
groundAndItemsGroup.add(mirror);

const clock = new THREE.Clock();
let lastEmitTime = 0;
const emitInterval = 0.1; // 100ms

// playerの初期化
const vrplayer = new VRPlayer(scene, renderer, groundAndItemsGroup);
vrplayer.loadVRM('/shapellFuku5.vrm');

const socket = io();
const otherPlayers: { [id: string]: Avatar } = {};

socket.on('connect', () => {
  console.log('connected to server');
});

socket.on('disconnect', () => {
  console.log('disconnected from server');
});

socket.on('playerdata', (data) => {
  if (data.id === socket.id) return;

  if (!otherPlayers[data.id]) {
    const otherplayerA = new Avatar(scene, vrplayer._loader, 1.0);
    otherplayerA.loadVRM('/shapellFuku5.vrm').then(() => {
      otherPlayers[data.id] = otherplayerA;
      groundAndItemsGroup.add(otherplayerA.vrm.scene);
    });
  } else {
    const otherplayerA = otherPlayers[data.id];
    if (otherplayerA.vrm) {
      otherplayerA.vrm.scene.position.set(-data.playerPositionOffset.x, data.playerPositionOffset.y, -data.playerPositionOffset.z);
    }
  }
});

function animate() {
  renderer.setAnimationLoop(animate);
  const delta = clock.getDelta();

  if (vrplayer.avatar.vrm) {
    if (renderer.xr.isPresenting) {
      vrplayer.update(delta);
    }

    vrplayer.avatar.update();
    vrplayer.avatar.vrm.update(delta);

    if (socket.connected) {
      if (clock.elapsedTime - lastEmitTime > emitInterval) {
        const playerPositionOffset = vrplayer.playerPositionOffset;
        socket.emit('playerdata', { id: socket.id, playerPositionOffset });
        lastEmitTime = clock.elapsedTime;
      }
    }
  }

  if (!renderer.xr.isPresenting) {
    // Enter VRモードでない場合はOrbitControlsを更新
    controls.update();
  }
  renderer.render(scene, camera);
}

animate();