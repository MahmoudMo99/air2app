import { NewSceneObject } from '../../scene/scene.models';

export function createDemoScene(width: number, height: number): NewSceneObject[] {
  const unit = Math.min(155, Math.max(48, Math.min(width, height) * 0.25));

  return [
    {
      kind: 'circle',
      center: {
        x: width * 0.27,
        y: height * 0.44,
      },
      width: unit,
      height: unit,
      rotation: 0,
    },
    {
      kind: 'square',
      center: {
        x: width * 0.67,
        y: height * 0.34,
      },
      width: unit * 0.86,
      height: unit * 0.86,
      rotation: -Math.PI / 8,
    },
    {
      kind: 'rectangle',
      center: {
        x: width * 0.56,
        y: height * 0.76,
      },
      width: unit * 1.5,
      height: unit * 0.65,
      rotation: Math.PI / 12,
    },
  ];
}
