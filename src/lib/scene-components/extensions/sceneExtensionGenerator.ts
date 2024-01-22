import { SceneModel } from '../models';
import { SceneExtension } from './sceneExtension';
import { ThreeSceneExtension } from './three';
import { SceneExtensionNames } from './sceneExtensionNames';
import { CesiumSceneExtension } from './cesium';

export type SceneExtensionGenerator = (
  sceneModel: SceneModel
) => SceneExtension[];

export const defaultSceneExtensionGenerator: SceneExtensionGenerator = (
  sceneModel: SceneModel
): SceneExtension[] => {
  return [
    new ThreeSceneExtension(SceneExtensionNames.Three, sceneModel),
    new CesiumSceneExtension(SceneExtensionNames.Cesium, sceneModel),
  ];
};
