"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Props } from "./schema";

export function Component({
  size = 400,
  cubeColor = "#6366f1",
  wireframeColor = "#a5b4fc",
  backgroundColor = "#0f0f1a",
  rotationSpeed = 1,
  showWireframe = true,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(size, size);
    renderer.setClearColor(new THREE.Color(backgroundColor));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(2.5, 2, 3);
    camera.lookAt(0, 0, 0);

    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);

    const faceColors = [
      new THREE.Color(cubeColor),
      new THREE.Color(cubeColor).offsetHSL(0.05, 0, -0.1),
      new THREE.Color(cubeColor).offsetHSL(0.1, 0, 0.05),
      new THREE.Color(cubeColor).offsetHSL(-0.05, 0, -0.05),
      new THREE.Color(cubeColor).offsetHSL(0.15, 0, 0.1),
      new THREE.Color(cubeColor).offsetHSL(-0.1, 0, -0.15),
    ];
    const materials = faceColors.map(
      (color) =>
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.35,
          metalness: 0.6,
        })
    );

    const cube = new THREE.Mesh(geometry, materials);
    scene.add(cube);

    if (showWireframe) {
      const wireGeo = new THREE.EdgesGeometry(geometry);
      const wireMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(wireframeColor),
        linewidth: 2,
      });
      const wireframe = new THREE.LineSegments(wireGeo, wireMat);
      cube.add(wireframe);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 8, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xa78bfa, 1.5, 20);
    pointLight.position.set(-4, -2, 3);
    scene.add(pointLight);

    let frameId: number;
    const speed = rotationSpeed * 0.005;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      cube.rotation.x += speed * 1.1;
      cube.rotation.y += speed * 1.7;
      cube.rotation.z += speed * 0.4;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [size, cubeColor, wireframeColor, backgroundColor, rotationSpeed, showWireframe]);

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