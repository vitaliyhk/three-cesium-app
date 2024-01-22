import { Edges, Environment } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { Mesh } from 'three';
import { useSceneViewModel } from '../../../../providers';
import { BoxProps } from './Box.types';

export const Box = ({ animate, ...meshProps }: BoxProps) => {
  const meshRef = useRef<Mesh>(null!);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const sceneViewModel = useSceneViewModel();
  useFrame((_state, delta) => {
    if (!animate) return;
    meshRef.current.rotation.y += delta;
    sceneViewModel.invalidate();
  });

  return (
    <mesh
      ref={meshRef}
      scale={1}
      onClick={() => setActive(!active)}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      {...meshProps}
    >
      <boxGeometry args={[10, 10, 10]} />

      <meshPhysicalMaterial
        attach='material'
        clearcoat={0.1}
        metalness={1}
        color={'#e63b7a'}
      />
      <ambientLight intensity={10} />
      <Environment preset='city' />

      {active && <Edges scale={1.2} threshold={15} color='white' />}
      {/* <Hud renderPriority={1}>
        <PerspectiveCamera makeDefault position={[0, 0, 10]} />
        <mesh>
          <boxGeometry args={[1000, 10, 10]} />

          <meshPhysicalMaterial
            attach='material'
            clearcoat={0.1}
            metalness={1}
            color={'#e63b7a'}
          />
          <ambientLight intensity={10} />
          <Environment preset='city' />
        </mesh>
      </Hud> */}
    </mesh>
  );
};
