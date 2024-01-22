/* eslint-disable @typescript-eslint/no-unused-vars */
import { ReactElement } from 'react';
import { RootState } from '@react-three/fiber';
import {
  MathUtils,
  OrthographicCamera,
  PerspectiveCamera,
  Vector3,
} from 'three';
import {
  Camera as CesiumCamera,
  Cartesian2,
  Cesium3DTileset,
  DebugModelMatrixPrimitive,
  Event,
  Globe,
  HeadingPitchRange,
  OrthographicFrustum,
  PerspectiveFrustum,
  Scene as CesiumScene,
  Transforms,
  Viewer as CesiumViewer,
} from 'cesium';
import { CameraControls } from '@react-three/drei';
import {
  normalizeAngle,
  offsetCartesianPositionBySceneOffset,
} from '../../services';
import { SceneViewModel } from '../../models/sceneView';
import { SceneViewBackgroundExtension } from '../sceneViewBackgroundExtension';
import { CesiumSceneExtension } from './cesiumSceneExtension';
import { CesiumView, CesiumViewProps } from './components';

export class CesiumSceneViewBackgroundExtension extends SceneViewBackgroundExtension {
  // cesium
  cesiumViewer: CesiumViewer | null = null;
  cesiumCamera: CesiumCamera | null = null;
  cesiumScene: CesiumScene | null = null;

  // globe
  globe: Globe | null = null;
  globeTileLoadingCount: number = 0;

  // tile sets
  cesium3DTilesets: Cesium3DTileset[] = [];
  cesium3DTilesetsLoadingProgress: Map<Cesium3DTileset, number> = new Map<
    Cesium3DTileset,
    number
  >();

  // event listeners
  private eventListenerRemoveCallbacks: Event.RemoveCallback[] = [];

  // debug
  debug: boolean = false;
  debugModelMatrixPrimitive: DebugModelMatrixPrimitive | null = null;

  constructor(
    public name: string,
    public sceneViewModel: SceneViewModel,
    public cesiumSceneExtension: CesiumSceneExtension
  ) {
    super(name, sceneViewModel, cesiumSceneExtension);
  }

  initialize(_state: RootState, _delta: number): void {
    // wait for cesium
    const cesiumViewer = this.cesiumViewer;
    if (!cesiumViewer) {
      this.invalidate();
      return;
    }

    // initialize cesium
    if (!this.initialized) {
      // cesium initialized
      this.initialized = true;

      // initialize camera
      this.cesiumCamera = cesiumViewer.camera;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.cesiumCamera as any).constrainedAxis = undefined; // remove axis constraint
      console.log('cesium constrained axis', this.cesiumCamera.constrainedAxis);

      // initialize scene
      this.cesiumScene = cesiumViewer.scene;

      // initialize screen space camera controller
      const screenSpaceCameraController =
        this.cesiumScene.screenSpaceCameraController;
      screenSpaceCameraController.enableCollisionDetection = false; // allow camera to go below surface

      // initialize globe
      this.globe = this.cesiumScene.globe;
      this.addGlobeLoadingListener(this.globe);

      // perform initial camera sync
      this.sceneViewModel.syncCameras();

      console.log('cesium initialized');
    }
  }

  render(_state: RootState, _delta: number) {
    // wait for cesium
    const cesiumViewer = this.cesiumViewer;
    if (!cesiumViewer) return;

    // render cesium scene
    cesiumViewer.render();

    // render cesium 3D tilesets
    const cesium3DTilesetsLoading = Array.from(
      this.cesium3DTilesetsLoadingProgress.values()
    ).some((progress: number) => {
      return progress > 0;
    });
    if (cesium3DTilesetsLoading) {
      // invalidate the scene (re-render) until all cesium tiles have loaded
      this.invalidate();
    }

    // render cesium globe tiles
    if (this.globeTileLoadingCount > 0) {
      // invalidate the scene (re-render) until all globe tiles have loaded
      this.invalidate();
    }
  }

  syncCameras(cameraControls: CameraControls) {
    if (!this.initialized) return;

    // wait for three camera
    const threeCamera = cameraControls?.camera;
    if (!threeCamera) return;

    // wait for cesium camera
    const cesiumCamera = this.cesiumCamera;
    if (!cesiumCamera) return;

    // wait for cesium scene
    const cesiumScene = this.cesiumScene;
    if (!cesiumScene) return;

    // three camera target
    const threeCameraTarget = cameraControls.getTarget(new Vector3(), true);
    const cesiumCameraTargetCartesian = offsetCartesianPositionBySceneOffset(
      this.sceneModel.sceneCenterCartesian,
      threeCameraTarget
    );

    // cesium camera look at
    const transform = Transforms.eastNorthUpToFixedFrame(
      cesiumCameraTargetCartesian
    );
    const heading = normalizeAngle(-1 * cameraControls.azimuthAngle);
    const pitch = cameraControls.polarAngle - MathUtils.degToRad(90);
    const range = cameraControls.distance;

    // cesium debug axis
    if (this.debug) {
      if (!this.debugModelMatrixPrimitive) {
        this.debugModelMatrixPrimitive = new DebugModelMatrixPrimitive({
          modelMatrix: transform,
          length: 5.0,
        });
        cesiumScene.primitives.add(this.debugModelMatrixPrimitive);
      } else {
        this.debugModelMatrixPrimitive.modelMatrix = transform;
      }
    }

    // move cesium camera
    cesiumCamera.lookAtTransform(
      transform,
      new HeadingPitchRange(heading, pitch, range)
    );

    // sync frustum
    if (threeCamera instanceof PerspectiveCamera) {
      if (!(cesiumCamera.frustum instanceof PerspectiveFrustum)) {
        cesiumCamera.switchToPerspectiveFrustum();
      }
    } else {
      if (!(cesiumCamera.frustum instanceof OrthographicFrustum)) {
        cesiumCamera.switchToOrthographicFrustum();
      }
    }

    // sync aspect
    if (threeCamera instanceof PerspectiveCamera) {
      const threeCameraAspect = threeCamera.aspect;
      const threeCameraFov = threeCamera.fov;
      const perspectiveFrustum = cesiumCamera.frustum as PerspectiveFrustum;
      if (threeCameraAspect < 1) {
        perspectiveFrustum.fov = Math.PI * (threeCameraFov / 180);
      } else {
        const cesiumFovY = Math.PI * (threeCameraFov / 180);
        const cesiumFovX =
          Math.atan(Math.tan(0.5 * cesiumFovY) * threeCameraAspect) * 2;
        perspectiveFrustum.fov = cesiumFovX;
      }
    } else {
      const orthographicCamera = threeCamera as OrthographicCamera;
      const orthographicFrustum = cesiumCamera.frustum as OrthographicFrustum;
      orthographicFrustum.aspectRatio =
        orthographicCamera.right / orthographicCamera.top;
      orthographicFrustum.width =
        (-orthographicCamera.left + orthographicCamera.right) /
        orthographicCamera.zoom;
    }
  }

  performDoubleClick(e: MouseEvent) {
    const cesiumCamera = this.cesiumCamera;
    if (!cesiumCamera) return;

    const cesiumScene = this.cesiumScene;
    if (!cesiumScene) return;

    const globe = this.globe;
    if (!globe) return;

    const windowCoordinates = new Cartesian2(e.x, e.y);
    const ray = cesiumCamera.getPickRay(windowCoordinates);
    if (!ray) return;
    const intersectionCartesian = globe.pick(ray, cesiumScene);

    if (!intersectionCartesian) return;
    console.log('cesium intersection', intersectionCartesian);
    this.sceneViewModel.setCameraTargetCartesian(intersectionCartesian);
  }

  performClick(e: MouseEvent) {
    const cesiumCamera = this.cesiumCamera;
    if (!cesiumCamera) return;

    const cesiumScene = this.cesiumScene;
    if (!cesiumScene) return;

    const globe = this.globe;
    if (!globe) return;

    const windowCoordinates = new Cartesian2(e.x, e.y);
    const ray = cesiumCamera.getPickRay(windowCoordinates);
    if (!ray) return;
    const intersectionCartesian = globe.pick(ray, cesiumScene);

    if (!intersectionCartesian) return;
    console.log('cesium intersection', intersectionCartesian);
    // this.sceneViewModel.setCameraTargetCartesian(intersectionCartesian);
  }

  private addGlobeLoadingListener = (globe: Globe) => {
    const tilesLoadingRemoveCallback: Event.RemoveCallback =
      globe.tileLoadProgressEvent.addEventListener((count) => {
        this.handleGlobeLoadingProgress(globe, count);
      });
    this.addRemoveCallback(tilesLoadingRemoveCallback);
  };

  private handleGlobeLoadingProgress(_globe: Globe, progress: number) {
    this.globeTileLoadingCount = progress;
  }

  public async addCesium3DTilesetFromUrl(
    url: string,
    options?: Cesium3DTileset.ConstructorOptions
  ): Promise<void> {
    const cesium3DTileset = await Cesium3DTileset.fromUrl(url, options);
    this.addCesium3DTileset(cesium3DTileset);
  }

  public addCesium3DTileset(cesium3DTileset: Cesium3DTileset) {
    if (!this.cesiumScene) return;
    this.cesium3DTilesets.push(cesium3DTileset);
    this.addCesium3dTilesetLoadingListener(cesium3DTileset);
    this.cesiumScene.primitives.add(cesium3DTileset);
  }

  private addCesium3dTilesetLoadingListener(cesium3DTileset: Cesium3DTileset) {
    const tilesLoadingRemoveCallback: Event.RemoveCallback =
      cesium3DTileset.loadProgress.addEventListener((count) => {
        this.handleCesium3dTilesetLoadingProgress(cesium3DTileset, count);
      });
    this.addRemoveCallback(tilesLoadingRemoveCallback);
  }

  private handleCesium3dTilesetLoadingProgress(
    cesium3DTileset: Cesium3DTileset,
    progress: number
  ) {
    this.cesium3DTilesetsLoadingProgress.set(cesium3DTileset, progress);
  }

  private addRemoveCallback(eventListenerRemoveCallback: Event.RemoveCallback) {
    this.eventListenerRemoveCallbacks.push(eventListenerRemoveCallback);
  }

  //@ts-expect-error is declared TS6133:...but its value is never read.
  private clearRemoveCallbacks() {
    while (this.eventListenerRemoveCallbacks.length) {
      const removeCallback = this.eventListenerRemoveCallbacks.pop();
      if (removeCallback) {
        removeCallback();
      }
    }
  }

  createBackgroundView(
    cesiumViewProps: CesiumViewProps
  ): ReactElement<CesiumViewProps> {
    return <CesiumView {...cesiumViewProps} />;
  }

  handleMouseEvent(e: MouseEvent): boolean {
    let handled = false;
    console.log(e);

    switch (e.type) {
      case 'dblclick':
        this.performDoubleClick(e);
        handled = true;
        break;
      case 'click':
        this.performClick(e);
        handled = true;
        break;
    }

    return handled;
  }
}
