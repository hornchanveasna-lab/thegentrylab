import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Cloud } from "@react-three/drei";
import * as THREE from "three";

/**
 * CloudBirdScene — real WebGL 3D atmosphere for the Home page map
 * preview card: drifting volumetric clouds + a stylized low-poly bird
 * flying a looping path, composited transparently over the 2D map
 * layers beneath it.
 *
 * Scoped deliberately: no external 3D assets (GLTF models, textures
 * beyond drei's bundled cloud sprite) so it ships with zero asset
 * pipeline — the bird is a hand-built chevron mesh, not a rig.
 */

/* ── A single drifting cloud group — wraps around on the X axis ── */
function DriftingCloud({
  startX, y, z, speed, seed, scale, opacity,
}: {
  startX: number; y: number; z: number; speed: number; seed: number; scale: number; opacity: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    g.position.x += speed * delta;
    if (g.position.x > 9) g.position.x = -9;
  });
  return (
    <group ref={ref} position={[startX, y, z]}>
      <Cloud
        seed={seed}
        bounds={[3, 0.9, 1]}
        volume={2.4}
        color="#e8ecf2"
        opacity={opacity}
        fade={30}
        growth={4}
        speed={0.15}
        scale={scale}
      />
    </group>
  );
}

/* ── Stylized low-poly bird: two chevron wings, flap + flight path ── */
function FlyingBird({ radiusX = 6.5, radiusZ = 2.2, height = 1.6, speed = 0.12, phase = 0 }) {
  const group = useRef<THREE.Group>(null);
  const wingL = useRef<THREE.Mesh>(null);
  const wingR = useRef<THREE.Mesh>(null);
  const t0 = useRef(phase);

  const wingGeom = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.55, -0.05);
    shape.lineTo(0.5, 0.05);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  useFrame((state, delta) => {
    t0.current += delta * speed;
    const t = t0.current;
    const g = group.current;
    if (!g) return;
    // Looping flight path across the card
    const x = Math.sin(t) * radiusX;
    const z = Math.cos(t * 0.7) * radiusZ;
    const y = height + Math.sin(t * 1.3) * 0.25;
    g.position.set(x, y, z);
    // Face direction of travel
    const dx = Math.cos(t) * radiusX;
    const dz = -Math.sin(t * 0.7) * 0.7 * radiusZ;
    g.rotation.y = Math.atan2(dx, dz);
    g.rotation.z = Math.sin(t * 2.2) * 0.05;

    // Wing flap
    const flap = Math.sin(state.clock.elapsedTime * 9 + phase) * 0.55;
    if (wingL.current) wingL.current.rotation.z = 0.15 + flap;
    if (wingR.current) wingR.current.rotation.z = -0.15 - flap;
  });

  return (
    <group ref={group}>
      <mesh ref={wingL} geometry={wingGeom} position={[0, 0, 0]}>
        <meshBasicMaterial color="#0a0a0b" side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <mesh ref={wingR} geometry={wingGeom} position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
        <meshBasicMaterial color="#0a0a0b" side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 4, 2]} intensity={1.4} color="#fff4e8" />

      <DriftingCloud startX={-6} y={1.8} z={-2}   speed={0.35} seed={1} scale={1}    opacity={0.55} />
      <DriftingCloud startX={2}  y={2.4} z={-3.2} speed={0.22} seed={7} scale={0.75} opacity={0.4} />
      <DriftingCloud startX={-2} y={1.2} z={-1}   speed={0.28} seed={13} scale={0.6} opacity={0.35} />

      <FlyingBird phase={0} />
      <FlyingBird phase={2.4} radiusX={5} radiusZ={1.6} height={1.1} speed={0.16} />
    </>
  );
}

export function CloudBirdScene() {
  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 1.5, 7], fov: 42 }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      dpr={[1, 1.5]}
    >
      <Scene />
    </Canvas>
  );
}
