import { Cesium3DTileset, CloudCollection, CumulusCloud } from 'resium';
import {
  Scene,
  SceneContent,
  Box,
  CesiumSceneContent,
  ThreeSceneContent,
  SceneInterface,
} from './lib/scene-components';

import { Cartesian2, Cartesian3, Ion, IonResource } from 'cesium';
import { useRef } from 'react';

const App = () => {
  const args = {
    show: true,
    position: Cartesian3.fromDegrees(144.983284, -37.820029, 50),
    scale: new Cartesian2(25, 12),
    maximumSize: new Cartesian3(25, 12, 15),
    slice: 0.36,
    brightness: 1.0,
  };

  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ACCESS_TOKEN;

  const ref = useRef<SceneInterface>(null);
  return (
    <>
      <Scene
        ref={ref}
        data-testid='Scene-id'
        name='Scene1'
        sceneCenterLongitudeLatitudeHeight={[144.983284, -37.820029, 17.0]}
      >
        <SceneContent>
          <ThreeSceneContent>
            <Box position={[0, 0, 0]} />
          </ThreeSceneContent>
          <CesiumSceneContent>
            <CloudCollection noiseDetail={16} noiseOffset={Cartesian3.ZERO}>
              <CumulusCloud {...args} />
            </CloudCollection>
            <Cesium3DTileset url={IonResource.fromAssetId(69380)} />
          </CesiumSceneContent>
        </SceneContent>
      </Scene>
      <div id='cube-scene'></div>
    </>
  );
};
export default App;
