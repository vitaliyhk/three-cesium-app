import {
  StoreProvider,
  SceneProvider,
  SceneViewProvider,
} from '../../providers';
import { SceneViewProps } from './SceneView.types';

export const SceneView = ({ sceneViewModel, ...divProps }: SceneViewProps) => {
  return (
    <div className='gle-scene-view' {...divProps}>
      <StoreProvider>
        <SceneProvider sceneModel={sceneViewModel.sceneModel}>
          <SceneViewProvider sceneViewModel={sceneViewModel}>
            {sceneViewModel
              .getSceneViewBackgroundExtensions()
              .map((sceneViewBackgroundExtension) => {
                return sceneViewBackgroundExtension.createBackgroundView({
                  key: sceneViewBackgroundExtension.name,
                  ...sceneViewModel.sceneViewBackgroundProps,
                });
              })}
            {sceneViewModel
              .getSceneViewForegroundExtensions()
              .map((sceneViewForegroundExtension) => {
                return sceneViewForegroundExtension.createForegroundView({
                  key: sceneViewForegroundExtension.name,
                  ...sceneViewModel.sceneViewForegroundProps,
                });
              })}
          </SceneViewProvider>
        </SceneProvider>
      </StoreProvider>
    </div>
  );
};
