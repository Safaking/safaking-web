'use client';

/**
 * The safa as a thing in the picture rather than a sticker on top of it.
 *
 * The flat overlay could only ever lie in the plane of the screen: tilt your
 * head and it tilted, but turn your head and the safa stayed face-on, which
 * is the moment people stop believing it. This puts the same photograph on a
 * curved surface in a small 3D scene, turns it with the head, and hides the
 * far side behind an invisible head-shaped solid — so a profile view shows
 * the safa wrapping away out of sight, the way a real one does.
 *
 * Deliberately modest: no 3D models to make or download, no camera
 * calibration, and the same alpha cut-outs the flat overlay already used. It
 * needs WebGL; where there is none, the caller keeps the flat overlay.
 *
 * Everything is in stage pixels, with an orthographic camera, so what the
 * tracker measures on screen is where things land. Depth is used only for
 * what hides what.
 */

import type * as THREE from 'three';

export interface ArPose {
  /** Centre of the safa, in stage pixels (y down, like the DOM). */
  x: number;
  y: number;
  /** Safa width in stage pixels. */
  width: number;
  /** Head tilt, degrees clockwise. */
  roll: number;
  /** Head turn, degrees; positive turns the face to the viewer's right. */
  yaw: number;
  /** Head nod, degrees; positive looks down. */
  pitch: number;
  /** The head itself, for the shape that does the hiding. */
  headX: number;
  headY: number;
  faceWidth: number;
  faceHeight: number;
}

/** How far the safa bulges towards the camera, as a share of its width. */
const BULGE = 0.34;
/** The hiding solid, as a share of the measured face width. */
const HEAD_RADIUS = 0.62;

export class SafaArRenderer {
  private three: typeof THREE;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private group: THREE.Group;
  private safa: THREE.Object3D | null = null;
  private head: THREE.Mesh;
  private texture: THREE.Texture | null = null;
  private width = 0;
  private height = 0;
  private aspect = 1;

  private constructor(three: typeof THREE, canvas: HTMLCanvasElement) {
    this.three = three;
    this.renderer = new three.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      // Snapshots read this canvas back, which an unpreserved buffer loses.
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new three.Scene();
    this.camera = new three.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);

    // Turns with the head; the safa sits at its offset inside it.
    this.group = new three.Group();
    this.scene.add(this.group);

    // An invisible head: it writes depth but no colour, so anything behind it
    // simply is not drawn.
    const headMaterial = new three.MeshBasicMaterial({ colorWrite: false });
    this.head = new three.Mesh(new three.SphereGeometry(1, 32, 24), headMaterial);
    this.head.renderOrder = 0;
    this.scene.add(this.head);
  }

  /** three.js is a big library; it is only fetched when the mirror is opened. */
  static async create(canvas: HTMLCanvasElement): Promise<SafaArRenderer | null> {
    try {
      const three = await import('three');
      return new SafaArRenderer(three, canvas);
    } catch {
      // No WebGL, or the chunk could not be fetched. The flat overlay stands.
      return null;
    }
  }

  setSize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Shows a safa. A .glb is a real three-dimensional safa — photographed from
   * every side and rebuilt as a solid (see docs/safa-3d-scanning.md). Anything
   * else is a cut-out photograph, bent over a curve.
   */
  async setSafa(url: string): Promise<void> {
    if (/\.(glb|gltf)(\?|$)/i.test(url)) {
      await this.setModel(url);
      return;
    }
    const three = this.three;
    const texture = await new Promise<THREE.Texture | null>((resolve) => {
      new three.TextureLoader().load(url, resolve, undefined, () => resolve(null));
    });
    if (!texture) return;

    texture.colorSpace = three.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    const image = texture.image as { width?: number; height?: number } | undefined;
    this.aspect = image?.width && image?.height ? image.height / image.width : 1;

    this.texture?.dispose();
    this.texture = texture;

    // A plane bent towards the camera across its width, keeping its flat UVs
    // so the photograph lands exactly as it did when seen head-on.
    const geometry = new three.PlaneGeometry(1, this.aspect, 48, 32);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const across = 1 - Math.pow(x * 2, 2);
      const down = 1 - Math.pow((y / this.aspect) * 2, 2);
      position.setZ(i, BULGE * Math.max(0, across) * (0.65 + 0.35 * Math.max(0, down)));
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();

    this.replaceSafa(
      new three.Mesh(
        geometry,
        new three.MeshBasicMaterial({
          map: texture,
          transparent: true,
          // Keeps the cut-out's soft edge from punching holes in the depth buffer.
          alphaTest: 0.04,
          side: three.DoubleSide,
          toneMapped: false,
        })
      )
    );
  }

  /**
   * A real safa, scanned from the shop's own stock. Whatever size and centre
   * the model came out of the scanner with, it is normalised here to one unit
   * wide and centred on itself, so the tracker's measurements place it exactly
   * as they place a photograph.
   */
  private async setModel(url: string): Promise<void> {
    const three = this.three;
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new Promise<{ scene: THREE.Group } | null>((resolve) => {
      new GLTFLoader().load(url, (loaded) => resolve(loaded), undefined, () => resolve(null));
    });
    if (!gltf) return;

    const model = gltf.scene;
    const box = new three.Box3().setFromObject(model);
    const size = box.getSize(new three.Vector3());
    const centre = box.getCenter(new three.Vector3());
    if (!size.x) return;

    model.position.sub(centre);
    const holder = new three.Group();
    holder.add(model);
    holder.scale.setScalar(1 / size.x);
    this.aspect = size.y / size.x;

    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      // A scanned safa carries its own lighting in its colours, so it is shown
      // as photographed rather than relit by a lamp that is not in the room.
      if (material && 'toneMapped' in material) material.toneMapped = false;
    });

    this.replaceSafa(holder);
  }

  /** Swaps whatever is currently on the head for this. */
  private replaceSafa(object: THREE.Object3D) {
    if (this.safa) {
      this.group.remove(this.safa);
      this.disposeTree(this.safa);
    }
    object.renderOrder = 1;
    this.group.add(object);
    this.safa = object;
  }

  private disposeTree(object: THREE.Object3D) {
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
  }

  /** The safa's proportions, so the caller can size it the same way it always did. */
  get safaAspect(): number {
    return this.aspect;
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  clear() {
    this.renderer.clear();
  }

  render(pose: ArPose | null) {
    if (!this.safa || !pose || !this.width || !this.height) {
      this.renderer.clear();
      return;
    }
    const three = this.three;
    const toScene = (x: number, y: number): [number, number] => [x - this.width / 2, this.height / 2 - y];

    const [headX, headY] = toScene(pose.headX, pose.headY);
    const radius = Math.max(8, pose.faceWidth * HEAD_RADIUS);
    this.head.position.set(headX, headY, -radius * 0.25);
    // A head is taller than it is wide, and deeper than it is broad.
    this.head.scale.set(radius, radius * Math.max(1, pose.faceHeight / Math.max(1, pose.faceWidth)), radius * 1.05);

    // The tracker already says where on screen the safa belongs, however the
    // head is turned — so that stays its position, and the turn is applied
    // about the safa's own centre. The head above does the hiding.
    const [safaX, safaY] = toScene(pose.x, pose.y);
    this.group.position.set(safaX, safaY, radius * 0.12);
    this.group.rotation.set(
      three.MathUtils.degToRad(pose.pitch),
      three.MathUtils.degToRad(pose.yaw),
      three.MathUtils.degToRad(-pose.roll),
      'YXZ'
    );
    this.safa.position.set(0, 0, 0);
    this.safa.scale.setScalar(pose.width);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.texture?.dispose();
    if (this.safa) this.disposeTree(this.safa);
    this.head.geometry.dispose();
    (this.head.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}
