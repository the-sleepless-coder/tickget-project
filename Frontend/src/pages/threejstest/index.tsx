import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function ThreeJsTestPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<any | null>(null);
  const sceneRef = useRef<any | null>(null);
  const cameraRef = useRef<any | null>(null);
  const modelRef = useRef<any | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(2, 2, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // basic lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x202020, 1.0);
    hemiLight.position.set(0, 1, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7.5);
    scene.add(dirLight);

    // ground removed per request

    const loader = new GLTFLoader();
    // 파일은 public/models/Project 10.glb 경로에 있다고 가정
    loader.load(
      "/models/Project 10.glb",
      (gltf: any) => {
        const root = gltf.scene;
        // 모델이 너무 크거나 작을 수 있으므로 적당히 스케일 조정
        root.scale.setScalar(1);
        scene.add(root);
        // 초기 높이: 상단 위치에서 시작
        root.position.y = topY;
        modelRef.current = root;

        // 모델을 프레이밍하도록 카메라 대략 위치 조정 (바운딩 박스 기반)
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs((maxDim / 2) / Math.tan(fov / 2));
        cameraZ *= 1.6; // 약간 여유
        camera.position.set(center.x + cameraZ * 0.4, center.y + cameraZ * 0.5, center.z + cameraZ);
        camera.lookAt(center);
      },
      undefined,
      (error: any) => {
        // eslint-disable-next-line no-console
        console.error("Failed to load GLB:", error);
      }
    );

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    // 스프링 파라미터 (훅의 법칙 + 감쇠) + 2초 간격 토글 목표
    const bottomY = 0.25;
    const topY = 0.85;
    let targetY = bottomY;
    let velocityY = 0; // 현재 속도
    const stiffness = 20; // k (커질수록 더 빠르게 목표로 감)
    const damping = 4; // c (커질수록 감쇠가 커짐)

    const clock = new THREE.Clock();

    const toggleInterval = window.setInterval(() => {
      targetY = targetY === bottomY ? topY : bottomY;
    }, 2000);

    let raf = 0;
    const animate = () => {
      raf = window.requestAnimationFrame(animate);

      const dt = Math.min(clock.getDelta(), 0.05);
      const model = modelRef.current;
      if (model) {
        const y = model.position.y;
        const displacement = y - targetY; // x
        const acceleration = -stiffness * displacement - damping * velocityY; // a = -kx - cv
        velocityY += acceleration * dt; // v = v + a*dt
        model.position.y = y + velocityY * dt; // y = y + v*dt
      }

      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.clearInterval(toggleInterval);
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 500 }} ref={containerRef} />
  );
}


