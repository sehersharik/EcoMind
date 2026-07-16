import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

function Earth() {
  const meshRef = useRef();
  const glowRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) meshRef.current.rotation.y = t * 0.15;
    if (glowRef.current) glowRef.current.rotation.y = -t * 0.05;
  });

  // Generate lat/long grid material
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0a2540"),
      emissive: new THREE.Color("#059669"),
      emissiveIntensity: 0.35,
      roughness: 0.6,
      metalness: 0.4,
      wireframe: true,
    });
  }, []);

  return (
    <group>
      {/* Wireframe globe */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.6, 48, 48]} />
        <primitive attach="material" object={material} />
      </mesh>
      {/* Solid inner */}
      <mesh>
        <sphereGeometry args={[1.55, 32, 32]} />
        <meshBasicMaterial color="#020617" />
      </mesh>
      {/* Cyan atmospheric glow */}
      <mesh ref={glowRef} scale={1.15}>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.05} />
      </mesh>
      <mesh scale={1.3}>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.025} />
      </mesh>
    </group>
  );
}

function Particles() {
  const ref = useRef();
  const count = 800;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.03;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#10b981" transparent opacity={0.7} />
    </points>
  );
}

function NetworkLines() {
  const groupRef = useRef();
  const lines = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 14; i++) {
      const start = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(1.6);
      const end = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(1.6);
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5).normalize().multiplyScalar(2.4);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      arr.push(curve.getPoints(30));
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.getElapsedTime() * 0.15;
  });

  return (
    <group ref={groupRef}>
      {lines.map((pts, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={pts.length}
              array={new Float32Array(pts.flatMap((p) => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#06b6d4" transparent opacity={0.5} />
        </line>
      ))}
    </group>
  );
}

export default function Globe() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 2]}>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#10b981" />
      <pointLight position={[-10, -5, -10]} intensity={1} color="#06b6d4" />
      <Stars radius={30} depth={50} count={2000} factor={4} fade speed={0.5} />
      <Earth />
      <NetworkLines />
      <Particles />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.3} />
    </Canvas>
  );
}
