import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Cylinder, Stars, ContactShadows, Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

interface DigitalTwin3DProps {
  obstacles: any[];
  sunAlt: number;
  sunAz: number;
  panelAction: string;
  tiltBias?: number;
  azBias?: number;
  condition?: string;
}

function SunObject({ alt, az, condition }: { alt: number, az: number, condition?: string }) {
  const distance = 1000;
  const phi = (90 - alt) * (Math.PI / 180);
  const azRad = az * (Math.PI / 180);
  
  const r_h = distance * Math.sin(phi);
  const x = r_h * Math.sin(azRad);
  const z = r_h * -Math.cos(azRad);
  const sunY = distance * Math.cos(phi);

  const isOvercast = condition === "rain" || condition === "snow";

  return (
    <group>
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh position={[x, sunY, z]}>
          <sphereGeometry args={[alt > 0 ? 48 : 18, 32, 32]} />
          <meshBasicMaterial 
            color={alt > 0 ? "#ffcc33" : "#1e293b"} 
            transparent
            opacity={isOvercast ? 0.2 : (alt > 0 ? 1 : 0.2)}
          />
          {alt > 0 && !isOvercast && <pointLight intensity={1000} distance={2000} color="#ffcc33" />}
        </mesh>
      </Float>
      
      {alt > 0 && (
        <directionalLight 
          castShadow 
          position={[x, sunY, z]} 
          intensity={isOvercast ? 0.5 : 2.5} 
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-200}
          shadow-camera-right={200}
          shadow-camera-top={200}
          shadow-camera-bottom={-200}
        />
      )}
    </group>
  );
}

function Building({ obs }: { obs: any }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    if (!obs.polygon || obs.polygon.length === 0) return s;
    obs.polygon.forEach((pt: number[], idx: number) => {
        if (idx === 0) s.moveTo(pt[0], -pt[1]);
        else s.lineTo(pt[0], -pt[1]);
    });
    return s;
  }, [obs.polygon]);

  const height = obs.z_height || 10;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <extrudeGeometry args={[shape, { depth: height, bevelEnabled: false }]} />
      <meshStandardMaterial color="#64748b" roughness={0.6} />
    </mesh>
  );
}

function Obstacles({ data }: { data: any[] }) {
  return (
    <group>
      {data.map((obs, i) => {
        if (obs.type === 'building' && obs.polygon && obs.polygon.length > 0) {
            return <Building key={`b-${i}`} obs={obs} />
        }
        if (obs.type === 'tree' && obs.point && obs.point.length >= 2) {
            const height = obs.z_height || 6;
            return (
              <group key={`t-${i}`} position={[obs.point[0], 0, -obs.point[1]]}>
                  <mesh position={[0, height/4, 0]} castShadow>
                     <cylinderGeometry args={[0.4, 0.4, height/2]} />
                     <meshStandardMaterial color="#451a03" />
                  </mesh>
                  <mesh position={[0, height * 0.7, 0]} castShadow>
                     <sphereGeometry args={[2.5, 8, 8]} />
                     <meshStandardMaterial color="#064e3b" />
                  </mesh>
              </group>
            )
        }
        return null;
      })}
    </group>
  );
}

function SolarPanel({ action, sunAlt, sunAz, tiltBias = 0, azBias = 0, elevation }: { action: string, sunAlt: number, sunAz: number, tiltBias?: number, azBias?: number, elevation: number }) {
  const headRef = useRef<THREE.Group>(null);
  
  const safeSunAlt = isNaN(sunAlt) ? 0 : sunAlt;
  const safeSunAz = isNaN(sunAz) ? 180 : sunAz;
  const safeTiltBias = isNaN(tiltBias) ? 0 : tiltBias;
  const safeAzBias = isNaN(azBias) ? 0 : azBias;

  useFrame(() => {
    if (!headRef.current) return;
    
    let targetTilt = 0;
    let targetAz = 180;
    
    if (action === "tracking" || action === "identity") {
        targetTilt = Math.max(0, Math.min(60, 90 - safeSunAlt + safeTiltBias));
        targetAz = safeSunAz + safeAzBias;
    } else if (action === "stow" || action === "diffuse") {
        targetTilt = 0;
        targetAz = 180;
    }

    if (isNaN(targetTilt)) targetTilt = 0;
    if (isNaN(targetAz)) targetAz = 180;
    
    const lerpFactor = 0.05;
    
    if (isNaN(headRef.current.rotation.x)) headRef.current.rotation.x = 0;
    if (isNaN(headRef.current.rotation.y)) headRef.current.rotation.y = 0;

    headRef.current.rotation.order = 'YXZ';

    headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x, 
        THREE.MathUtils.degToRad(targetTilt), 
        lerpFactor
    );
    headRef.current.rotation.y = THREE.MathUtils.lerp(
        headRef.current.rotation.y, 
        THREE.MathUtils.degToRad(180 - targetAz), 
        lerpFactor
    );
  });

  return (
    <group position={[0, elevation, 0]}>
        <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 3]} />
            <meshStandardMaterial color="#94a3b8" />
        </mesh>
        
        <group position={[0, 3.2, 0]} ref={headRef}>
            <mesh castShadow receiveShadow>
                <boxGeometry args={[6, 0.2, 3]} />
                <meshStandardMaterial color="#1d4ed8" roughness={0.3} />
            </mesh>
        </group>
    </group>
  );
}

function SolarRay({ origin, direction }: { origin: THREE.Vector3, direction: THREE.Vector3 }) {
  const length = 1000;
  const beamRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!beamRef.current) return;
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    beamRef.current.setRotationFromQuaternion(quaternion);
  });

  return (
    <group ref={beamRef} position={origin}>
      <mesh position={[0, length / 2, 0]}>
        <cylinderGeometry args={[2, 2, length, 16]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.15} depthWrite={false} />
      </mesh>
      <mesh position={[0, length, 0]}>
        <coneGeometry args={[6, 12, 16]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SolarRays({ alt, az, condition }: { alt: number, az: number, condition?: string }) {
  const sunPos = useMemo(() => {
    const distance = 1000;
    const phi = (90 - alt) * (Math.PI / 180);
    const azRad = az * (Math.PI / 180);
    const r_h = distance * Math.sin(phi);
    return new THREE.Vector3(
      r_h * Math.sin(azRad),
      distance * Math.cos(phi),
      r_h * -Math.cos(azRad)
    );
  }, [alt, az]);

  if (alt <= 0 || condition === "rain" || condition === "snow") return null;

  const dir = new THREE.Vector3().subVectors(new THREE.Vector3(0, 2, 0), sunPos).normalize();

  const points = [];
  for (let x = -160; x <= 160; x += 40) {
    for (let z = -160; z <= 160; z += 40) {
      points.push([x, z]);
    }
  }

  return (
    <group>
      {points.map((p, i) => (
        <SolarRay 
          key={i} 
          origin={sunPos.clone().add(new THREE.Vector3(p[0], 0, p[1]))} 
          direction={dir} 
        />
      ))}
    </group>
  );
}

function WeatherEffects({ condition }: { condition?: string }) {
  if (condition === "rain") {
    return (
      <group>
        <Sparkles 
          count={1000} 
          scale={[200, 100, 200]} 
          size={20} 
          speed={5} 
          opacity={0.6} 
          color="#60a5fa" 
        />
        <Sparkles count={100} scale={[200, 50, 200]} size={100} color="#94a3b8" opacity={0.1} />
      </group>
    );
  }

  if (condition === "snow") {
    return (
      <Sparkles 
        count={2000} 
        scale={[200, 100, 200]} 
        size={30} 
        speed={0.5} 
        opacity={0.8} 
        color="#ffffff" 
      />
    );
  }

  return null;
}

export default function DigitalTwin3D({ obstacles, sunAlt, sunAz, panelAction, tiltBias, azBias, condition }: DigitalTwin3DProps) {
  const skyColor = useMemo(() => {
    if (condition === "rain" || condition === "snow") return '#475569'; // Overcast grey

    const color = new THREE.Color();
    if (sunAlt > 15) return '#7dd3fc';
    if (sunAlt > -5) {
        const t = (sunAlt + 5) / 20;
        return color.set('#0f172a').lerp(new THREE.Color('#7dd3fc'), t).getStyle();
    }
    return '#020617';
  }, [sunAlt, condition]);

  const panelElevation = useMemo(() => {
    if (!obstacles || obstacles.length === 0) return 0;
    const buildings = obstacles.filter(o => o.type === 'building' && o.polygon);
    if (buildings.length === 0) return 0;
    
    let zHeight = 0;
    for (const obs of buildings) {
      let inside = false;
      const poly = obs.polygon;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        const intersect = ((yi > 0) !== (yj > 0)) && (0 < (xj - xi) * (0 - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      if (inside) {
        zHeight = Math.max(zHeight, obs.z_height || 10);
      }
    }
    
    if (zHeight === 0) {
       zHeight = Math.max(...buildings.map(b => b.z_height || 10));
    }
    
    return zHeight;
  }, [obstacles]);

  return (
    <div className="w-full h-full relative">
      <Canvas shadows camera={{ position: [40, Math.max(30, panelElevation + 10), 40], fov: 45 }} className="w-full h-full bg-slate-900">
        <color attach="background" args={[skyColor]} />
        
        {sunAlt < 0 && <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />}
        
        <ambientLight intensity={condition === "rain" || condition === "snow" ? 0.3 : (sunAlt > 0 ? 0.9 : 0.2)} />
        <hemisphereLight 
          skyColor={sunAlt > 0 ? "#ffffff" : "#1e293b"} 
          groundColor="#000000" 
          intensity={sunAlt > 0 ? 0.7 : 0.1} 
        />
        
        <SunObject alt={sunAlt} az={sunAz} condition={condition} />
        <SolarRays alt={sunAlt} az={sunAz} condition={condition} />
        <WeatherEffects condition={condition} />
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
          <planeGeometry args={[2000, 2000]} />
          <meshStandardMaterial color={sunAlt > 0 ? "#334155" : "#0f172a"} />
        </mesh>
        
        <gridHelper args={[2000, 200, '#475569', '#1e293b']} />
        
        <SolarPanel action={panelAction} sunAlt={sunAlt} sunAz={sunAz} tiltBias={tiltBias} azBias={azBias} elevation={panelElevation} />
        <Obstacles data={obstacles || []} />
        
        <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={200} blur={2} far={Math.max(15, panelElevation + 10)} resolution={256} color="#000000" />
        
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2} target={[0, panelElevation + 3, 0]} />
      </Canvas>

      {/* Overlay UI moved outside Canvas to avoid R3F namespace errors */}
      <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur border border-slate-700 p-3 rounded-xl z-10 flex gap-4 pointer-events-none">
          <div className="text-center">
            <p className="text-xs text-slate-400">Sun Alt</p>
            <p className="font-mono text-sm text-slate-50">{sunAlt.toFixed(1)}&deg;</p>
          </div>
          <div className="text-center border-l border-slate-700 pl-4">
            <p className="text-xs text-slate-400">Condition</p>
            <p className="font-mono text-sm text-blue-400 capitalize">{condition || "Clear"}</p>
          </div>
      </div>
    </div>
  );
}
