import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Float, Text, Box } from '@react-three/drei';
import * as THREE from 'three';

interface ScoreBarProps {
  position: [number, number, number];
  score: number;
  color: string;
  label: string;
}

function ScoreBar({ position, score, color, label }: ScoreBarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetHeight = Math.max(0.1, score * 3);
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, targetHeight, 0.1);
      meshRef.current.position.y = meshRef.current.scale.y / 2;
    }
  });

  return (
    <group position={position}>
      <Box ref={meshRef} args={[0.8, 1, 0.8]}>
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} transparent opacity={0.8} />
      </Box>
      <Text
        position={[0, -0.5, 0.5]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      <Text
        position={[0, targetHeight + 0.3, 0]}
        fontSize={0.3}
        color={color}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {(score * 100).toFixed(0)}%
      </Text>
    </group>
  );
}

function AnimatedSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.getElapsedTime() * 0.1;
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.15;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1}>
      <Sphere ref={meshRef} args={[1, 64, 64]} scale={2} position={[0, 2, -5]}>
        <MeshDistortMaterial
          color="#1e293b"
          attach="material"
          distort={0.3}
          speed={1.5}
          roughness={0.4}
          metalness={0.6}
          transparent
          opacity={0.3}
        />
      </Sphere>
    </Float>
  );
}

interface TimelineNodeProps {
  position: [number, number, number];
  audit: any;
  onClick: (audit: any) => void;
}

function TimelineNode({ position, audit, onClick }: TimelineNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      meshRef.current.position.y = position[1] + Math.sin(state.clock.getElapsedTime() + position[0]) * 0.1;
    }
  });

  return (
    <group position={position} onClick={() => onClick(audit)}>
      <Sphere ref={meshRef} args={[0.3, 32, 32]}>
        <meshStandardMaterial 
          color={audit.healthScore > 0.7 ? "#10b981" : "#ef4444"} 
          emissive={audit.healthScore > 0.7 ? "#10b981" : "#ef4444"}
          emissiveIntensity={0.5}
          metalness={0.8}
          roughness={0.2}
        />
      </Sphere>
      <Text
        position={[0, -0.5, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {new Date(audit.timestamp?.seconds * 1000).toLocaleDateString()}
      </Text>
    </group>
  );
}

interface ThreeSceneProps {
  scores?: {
    security: number;
    performance: number;
    eco: number;
  };
  history?: any[];
  onNodeClick?: (audit: any) => void;
}

export default function ThreeScene({ scores, history, onNodeClick }: ThreeSceneProps) {
  return (
    <div className="fixed inset-0 -z-10 bg-slate-950">
      <Canvas camera={{ position: [0, 2, 12], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} />
        
        <AnimatedSphere />
        
        {scores && (
          <group position={[0, -1, 0]}>
            <ScoreBar position={[-2, 0, 0]} score={scores.security} color="#ef4444" label="SECURITY" />
            <ScoreBar position={[0, 0, 0]} score={scores.performance} color="#f59e0b" label="PERFORMANCE" />
            <ScoreBar position={[2, 0, 0]} score={scores.eco} color="#3b82f6" label="ECO" />
          </group>
        )}

        {history && onNodeClick && (
          <group position={[0, -1, -5]}>
            <Text position={[0, 2, 0]} fontSize={0.5} color="white">TIMELINE</Text>
            {history.slice(0, 10).map((audit, idx) => (
              <TimelineNode 
                key={audit.id} 
                position={[(idx - 4.5) * 1.5, 0, 0]} 
                audit={audit} 
                onClick={onNodeClick}
              />
            ))}
            <Box args={[15, 0.05, 0.05]} position={[0, 0, 0]}>
              <meshStandardMaterial color="white" opacity={0.2} transparent />
            </Box>
          </group>
        )}

        <OrbitControls enableZoom={true} enablePan={false} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 3} />
        <gridHelper args={[50, 50, 0x3b82f6, 0x1e293b]} position={[0, -1, 0]} />
      </Canvas>
    </div>
  );
}
