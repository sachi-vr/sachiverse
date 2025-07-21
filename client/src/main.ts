/**
 * @file This is the main entry point of the application.
 * It sets up the Three.js scene, camera, renderer, and the main animation loop.
 */

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { io } from 'socket.io-client';
import { VRPlayer } from './vrplayer';
import { WebRTCAudioClient } from './webrtcAudioClient';

import { RemoteVRPlayer } from './remoteVRPlayer';
import { createGroundAndItems } from './ground';


document.getElementById('start-button')!.addEventListener('click', () => {
  const scaleFactor = parseFloat((document.getElementById('scalefactor') as HTMLInputElement).value);

  // remove overlay
  const overlay = document.getElementById('overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }

  // WebXRやThree.jsの座標系は右手系。x軸が右、y軸が上、z軸が前がプラス。
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

  // Enter VRするまではOrbitControlsを使用
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.update();


  // WebXRの制限かThree.jsの制限でVRに入った後、カメラの位置を移動できない。
  // そのため、groundAndItemGroupを作成し、groundAndTemGroup側の位置を移動することで、VR内でのプレイヤーの位置を調整する。
  // groundAndItemGroupは、実際の身長とavatarの身長をあわせるため拡大縮小される
  const groundAndItemsGroup = new THREE.Group();
  scene.add(groundAndItemsGroup);

  createGroundAndItems(groundAndItemsGroup, window);

  const clock = new THREE.Clock();
  let lastEmitTime = 0;
  const emitInterval = 0.1; // 100ms

  let vrplayer: VRPlayer;

  // 通信初期化
  const socket = io();
  const webrtcClient = new WebRTCAudioClient(socket);
  webrtcClient.startLocalStream().then(() => {
    console.log('Local audio stream is ready');
  }).catch(error => {
    console.error('Failed to start local audio stream:', error);
  });
  const otherPlayers: { [id: string]: { player: RemoteVRPlayer, lastCommunicationTime: number } } = {};

  document.body.appendChild(VRButton.createButton(renderer));

  vrplayer = new VRPlayer(scene, renderer, groundAndItemsGroup, scaleFactor);
  vrplayer.loadVRM('/shapellFuku5.vrm');

  socket.on('connect', () => {
    console.log('connected to server');
  });

  socket.on('disconnect', () => {
    console.log('disconnected from server');
  });

  socket.on('playerdata', (data) => {
    // 到着したdata.idが自分のsocket.idなら無視
    if (data.id === socket.id) return;

    if (!otherPlayers[data.id]) {
      // 新しいプレイヤーのデータが来た場合、RemoteVRPlayerを作成
      const remotePlayer = new RemoteVRPlayer(scene, vrplayer._loader, data.username);
      // すぐに次のデータが来るのでotherPlayersにすぐに登録
      otherPlayers[data.id] = { player: remotePlayer, lastCommunicationTime: Date.now() };
      remotePlayer.loadVRM('/shapellFuku5.vrm').then(() => {
        groundAndItemsGroup.add(remotePlayer.remotegroup);
        remotePlayer.updatePose(data);
      });
    } else {
      const other = otherPlayers[data.id];
      if (other.player.remotegroup) {
        // リモートプレーヤーのコントローラのスティックの移動を反映
        other.player.remotegroup.position.set(-data.playerPositionOffset.x, data.playerPositionOffset.y, -data.playerPositionOffset.z);
        other.player.updatePose(data);
        other.lastCommunicationTime = Date.now();
      }
    }
  });

  socket.on('playerdisconnected', (id) => {
    if (otherPlayers[id]) {
      otherPlayers[id].player.dispose();
      delete otherPlayers[id];
    }
  });

  // 定期的に通信が来ないplayerを削除する
  const inactivityTimeout = 60000; // 60 seconds
  const cleanupInterval = 10000; // Check every 10 seconds
  setInterval(() => {
    const now = Date.now();
    for (const id in otherPlayers) {
      if (now - otherPlayers[id].lastCommunicationTime > inactivityTimeout) {
        console.log(`Removing inactive player: ${id}`);
        otherPlayers[id].player.dispose();
        delete otherPlayers[id];
      }
    }
  }, cleanupInterval);

  function animate() {
    renderer.setAnimationLoop(animate);
    const delta = clock.getDelta();

    if (vrplayer.avatar.vrm) {
      if (renderer.xr.isPresenting) {
        vrplayer.update(delta);
      }

      if (socket.connected) {
        if (clock.elapsedTime - lastEmitTime > emitInterval) {
          const playerPositionOffset = vrplayer.playerPositionOffset;
          let headsetPositionArray = null;
          let headsetQuaternionArray = null;
          if (renderer.xr.isPresenting) {
            headsetPositionArray = vrplayer.headsetPosition.toArray();
            headsetQuaternionArray = vrplayer.headsetQuaternion.toArray();
          }
          socket.emit('playerdata', {
            id: socket.id,
            username: (document.getElementById('username') as HTMLInputElement).value,
            playerPositionOffset,
            headsetPositionArray,
            headsetQuaternionArray,
            leftHandPositionArray: vrplayer.leftHandPosition.toArray(),
            leftHandQuaternionArray: vrplayer.leftHandQuaternion.toArray(),
            rightHandPositionArray: vrplayer.rightHandPosition.toArray(),
            rightHandQuaternionArray: vrplayer.rightHandQuaternion.toArray(),
          });
          lastEmitTime = clock.elapsedTime;
        }
      }
    }

    // 他のプレイヤーのアバターを更新
    for (const id in otherPlayers) {
      if (otherPlayers[id]) { // Ensure the player still exists
        const other = otherPlayers[id];
        if (other.player && other.player.avatar && other.player.avatar.vrm) {
          other.player.avatar.vrm.update(delta);
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
});

