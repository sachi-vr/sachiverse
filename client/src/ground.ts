import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Item } from './item';
import { GrabbableItem } from './grabbableItem';

export function createGroundAndItems(groundAndItemsGroup: THREE.Group, window: Window): Item[] {
  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.8, metalness: 0.2 })
  );
  ground.rotation.x = -Math.PI / 2;
  groundAndItemsGroup.add(ground);

  // box
  const boxItem = new GrabbableItem(
    'box1',
    groundAndItemsGroup,
    new THREE.Vector3(0.25, 0.5, 1)
  );
  boxItem.mesh.geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
  boxItem.mesh.material = new THREE.MeshStandardMaterial({ color: 0xff0000 });

  const sphereItem = new Item(
    'sphere1',
    groundAndItemsGroup,
    new THREE.Vector3(-1, 0.5, 1)
  );
  sphereItem.mesh.geometry = new THREE.SphereGeometry(0.5, 32, 32);
  sphereItem.mesh.material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });


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

  // Directionallightの設定
  const light = new THREE.DirectionalLight(0xffffff);
  light.position.set(1, 1, -1).normalize(); // 右上奥。
  groundAndItemsGroup.add(light);

  return [boxItem, sphereItem];
}
