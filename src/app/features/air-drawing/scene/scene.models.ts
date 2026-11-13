import { DrawPoint, ShapeKind } from '../drawing.models';

export type InteractionTool = 'move' | 'scale' | 'rotate';

export interface SceneObject {
  readonly id: string;
  readonly kind: ShapeKind;
  readonly center: Readonly<DrawPoint>;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

export type NewSceneObject = Omit<SceneObject, 'id'>;
