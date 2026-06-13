
"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Props } from "./schema";

export function Component({
  size = 420,
  cubeColor = "#6366f1",
  wireframeColor = "#a5b4fc",
  backgroundColor = "#0f0f1a",
  rotationSpeed = 1.2,
  showWireframe = true,
  bounceSpeed = 1.5,
  bounceHeight = 0.6,
  lightColor = "#ffffff",
  lightIntensity = 2,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 4);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(size, size);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(new THREE.Color(lightColor).getHex(), lightIntensity, 20);
    pointLight1.position.set(4, 4, 4);
    pointLight1.castShadow = true;
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x818cf8, lightIntensity * 0.6, 20);
    pointLight2.position.set(-4, -2, 3);
    scene.add(pointLight2);

    const rimLight = new THREE.DirectionalLight(0xa5b4fc, 0.8);
    rimLight.position.set(0, -4, -2);
    scene.add(rimLight);

    // Light helpers (moving point light glow)
    const lightSphere1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: lightColor })
    );
    lightSphere1.position.copy(pointLight1.position);
    scene.add(lightSphere1);

    // Cube (Phong for shiny lighting)
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(cubeColor),
      shininess: 80,
      specular: new THREE.Color(0xffffff),
    });
    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    scene.add(cube);

    // Wireframe overlay
    let wireMesh: THREE.LineSegments | null = null;
    if (showWireframe) {
      const wireGeo = new THREE.EdgesGeometry(geometry);
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(wireframeColor), linewidth: 1 });
      wireMesh = new THREE.LineSegments(wireGeo, wireMat);
      cube.add(wireMesh);
    }

    // Floor (subtle shadow catcher)
    const floorGeo = new THREE.PlaneGeometry(10, 10);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Animation loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Rotation
      cube.rotation.x += 0.008 * rotationSpeed;
      cube.rotation.y += 0.012 * rotationSpeed;

      // Bounce: smooth sine wave
      cube.position.y = Math.abs(Math.sin(t * bounceSpeed * Math.PI)) * bounceHeight - bounceHeight * 0.3;

      // Orbit point light 1 for dynamic highlight
      pointLight1.position.x = Math.sin(t * 0.8) * 4;
      pointLight1.position.z = Math.cos(t * 0.8) * 4;
      lightSphere1.position.copy(pointLight1.position);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [size, cubeColor, wireframeColor, backgroundColor, rotationSpeed, showWireframe, bounceSpeed, bounceHeight, lightColor, lightIntensity]);

  return (
    <div
      ref={mountRef}
      style={{
        width: size,
        height: size,
        maxWidth: "100%",
        borderRadius: 12,
        overflow: "hidden",
        display: "inline-block",
      }}
    />
  );
}
