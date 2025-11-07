// Minimal shims to satisfy TypeScript when local env cannot resolve three's d.ts
declare module "three";

declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  export class GLTFLoader {
    constructor(manager?: unknown);
    load(
      url: string,
      onLoad: (gltf: unknown) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: unknown) => void
    ): void;
  }
  export type GLTF = unknown;
}


