/**
 * Travel Agent Tour v2.0 - asset catalog.
 *
 * Fully offline: the city and the car (with Chitti) are procedural
 * TypeScript assets, and the panels are local UIKitML files. No external
 * CDN assets - the starter's stock robot GLTF is gone.
 */
import { AssetType, defineAssets } from '@iwsdk/core';
import { createTourCar } from './scene-assets/car.scene-asset.js';
import { createCity } from './scene-assets/city.scene-asset.js';
import {
  createSouvenirBall,
  createSouvenirBoat,
  createSouvenirBouquet,
  createSouvenirBridge,
  createSouvenirCamera,
  createSouvenirCup,
  createSouvenirPlant,
  createSouvenirPolaroid,
  createSouvenirPool,
  createSouvenirRing,
  createSouvenirSkyscraper,
  createSouvenirStatue,
  createSouvenirTable,
  createSouvenirTelescope,
  createSouvenirTorch,
  createSouvenirTrain,
  createSouvenirTree,
  createSouvenirWatch,
  createSouvenirWtc,
} from './scene-assets/souvenirs.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'nyc-city': createCity(),
  'tour-car': createTourCar(),
  'souvenir-table': createSouvenirTable(),
  'souvenir-camera': createSouvenirCamera(),
  'souvenir-statue': createSouvenirStatue(),
  // Statue of Liberty gets FIVE mini statues on the table (Bhanu
  // 2026-11-17): she grabs one for her Journal, the rest stay behind.
  'souvenir-statue-2': createSouvenirStatue(),
  'souvenir-statue-3': createSouvenirStatue(),
  'souvenir-statue-4': createSouvenirStatue(),
  'souvenir-statue-5': createSouvenirStatue(),
  'souvenir-ball': createSouvenirBall(),
  'souvenir-tree': createSouvenirTree(),
  'souvenir-train': createSouvenirTrain(),
  'souvenir-boat': createSouvenirBoat(),
  'souvenir-telescope': createSouvenirTelescope(),
  'souvenir-pool': createSouvenirPool(),
  'souvenir-plant': createSouvenirPlant(),
  'souvenir-cup': createSouvenirCup(),
  'souvenir-torch': createSouvenirTorch(),
  'souvenir-watch': createSouvenirWatch(),
  'souvenir-polaroid': createSouvenirPolaroid(),
  'souvenir-skyscraper': createSouvenirSkyscraper(),
  'souvenir-bridge': createSouvenirBridge(),
  'souvenir-wtc': createSouvenirWtc(),
  'souvenir-bouquet': createSouvenirBouquet(),
  'souvenir-ring': createSouvenirRing(),
  'title-panel': uikitml('title-panel.uikitml', 'Title Panel'),
  'tour-panel': uikitml('tour-panel.uikitml', 'Tour Panel'),
  'speech-bubble': uikitml('speech-bubble.uikitml', 'Speech Bubble'),
});
