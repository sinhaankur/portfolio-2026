import { useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Line, OrbitControls, Stars } from "@react-three/drei"
import * as THREE from "three"

function OrbitalRings() {
  const rings = useMemo(() => {
    return [2.8, 4.2, 5.8].map((radius) => {
      const points: THREE.Vector3[] = []
      for (let i = 0; i <= 64; i += 1) {
        const t = (i / 64) * Math.PI * 2
        points.push(new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius))
      }
      return points
    })
  }, [])

  return (
    <group>
      {rings.map((pts, idx) => (
        <Line
          key={idx}
          points={pts}
          color={idx === 0 ? "#38bdf8" : "#334155"}
          lineWidth={idx === 0 ? 1.2 : 0.8}
          transparent
          opacity={idx === 0 ? 0.6 : 0.45}
        />
      ))}
    </group>
  )
}

function PlanetaryCluster() {
  const pivotRef = useRef<THREE.Group>(null)
  const moonPivotRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (pivotRef.current) pivotRef.current.rotation.y += delta * 0.12
    if (moonPivotRef.current) moonPivotRef.current.rotation.y -= delta * 0.42
  })

  return (
    <group position={[0, 0, 0]}>
      <mesh>
        <sphereGeometry args={[0.9, 64, 64]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#0284c7" emissiveIntensity={0.25} />
      </mesh>

      <group ref={pivotRef}>
        <mesh position={[4.2, 0.3, 0]}>
          <sphereGeometry args={[0.34, 32, 32]} />
          <meshStandardMaterial color="#60a5fa" emissive="#1d4ed8" emissiveIntensity={0.12} />
        </mesh>

        <group ref={moonPivotRef} position={[4.2, 0.3, 0]}>
          <mesh position={[0.9, 0.05, 0]}>
            <sphereGeometry args={[0.12, 20, 20]} />
            <meshStandardMaterial color="#bae6fd" emissive="#0ea5e9" emissiveIntensity={0.1} />
          </mesh>
        </group>
      </group>

      <mesh position={[-2.7, -0.35, 3.6]}>
        <sphereGeometry args={[0.42, 28, 28]} />
        <meshStandardMaterial color="#22d3ee" emissive="#0e7490" emissiveIntensity={0.16} />
      </mesh>
    </group>
  )
}

export function UniverseBackdrop({ interactive }: { interactive: boolean }) {
  return (
    <div className="universe-bg" aria-hidden="true">
      <Canvas camera={{ position: [0, 2.4, 10], fov: 42 }} dpr={[1, 1.8]}>
        <ambientLight intensity={0.55} />
        <pointLight position={[6, 8, 4]} intensity={16} color="#7dd3fc" />
        <pointLight position={[-4, -4, -4]} intensity={8} color="#1d4ed8" />
        <fog attach="fog" args={["#020617", 10, 35]} />

        <Stars radius={120} depth={50} count={3200} factor={4} saturation={0} fade speed={0.35} />
        <OrbitalRings />
        <PlanetaryCluster />

        <OrbitControls
          enabled={interactive}
          enablePan={false}
          enableZoom={interactive}
          autoRotate={!interactive}
          autoRotateSpeed={0.18}
          minDistance={6}
          maxDistance={14}
        />
      </Canvas>
    </div>
  )
}
