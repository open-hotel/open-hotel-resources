interface BodyPartItem extends Omit<BodyPart, "items"> {}

interface BodyPart {
  action?: string;
  assetpartdefinition?: string;
  frame?: number;
  base?: string;
  repeats?: number;
  items?: Record<string, BodyPartItem>;
}

// interface SpriteFx extends BodyPart {}

type FrameOffset = Record<string, BodyPart>;

interface AnimationFrame {
  bodyparts?: Record<string, BodyPart>;
  // fx?: Record<string, SpriteFx>;
  offsets: Record<string, FrameOffset>;
}

interface AnimationOverride {
  override: string;
  frames: AnimationFrame[];
}

interface AnimationAdd extends BodyPart {
  align: string;
}

interface SpriteDirection {
  dx?: number;
  dy?: number;
  dz?: number;
  dd?: number;
}

interface AnimationSprite {
  member?: string;
  ink?: number;
  directions?: Record<string, SpriteDirection>;
}

interface Animation {
  desc: string;
  frames: AnimationFrame[];
  overrides?: Record<string, AnimationOverride>;
  add?: Record<string, AnimationAdd>;
  remove?: string[];
  sprites?: Record<string, AnimationSprite>;
  shadows?: string;
  direction?: { offset: number };
}
