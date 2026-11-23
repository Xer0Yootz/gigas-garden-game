// Door or terminal the hub can place later. The Bridge console already links here.

export const MY_ROOM_HREF = '../Infinity_6-rooms/';

export function createRoomTerminal(THREE) {
  const group = new THREE.Group();
  group.name = 'my-room';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.3, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x120816, roughness: 0.6, metalness: 0.25 })
  );
  body.position.y = 0.75;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.28),
    new THREE.MeshBasicMaterial({ color: 0x071018 })
  );
  screen.position.set(0, 1.05, 0.1);
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(0.74, 0.04, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x081016, emissive: 0x00f0ff, emissiveIntensity: 0.8 })
  );
  trim.position.y = 1.42;
  group.add(body, screen, trim);
  group.userData.label = 'MY ROOM';
  group.userData.href = MY_ROOM_HREF;
  group.userData.use = () => { location.href = MY_ROOM_HREF; };
  return group;
}
