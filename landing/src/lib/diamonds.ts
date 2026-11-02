/**
 * The three Paper shader diamonds (@paper-design/shaders 0.0.82, vanilla), mounted on any
 * element with data-diamond="main | metal | heat". Parameters are the ones exported from
 * the Paper file; uniforms are mapped exactly as @paper-design/shaders-react does it.
 * They are drawn for a dark ground, so they only sit on the ink, red and green chapters.
 * Home page only, loaded on demand; each one rests while it is off-screen.
 */
import {
  ShaderMount, ShaderFitOptions, getShaderColorFromString,
  heatmapFragmentShader, toProcessedHeatmap,
  liquidMetalFragmentShader, LiquidMetalShapes,
} from '@paper-design/shaders';

const DIAMOND = '/shaders/diamond.svg';
const CLEAR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const sizing = (scale: number) => ({
  u_fit: ShaderFitOptions.contain, u_scale: scale, u_rotation: 0,
  u_offsetX: 0, u_offsetY: 0, u_originX: 0.5, u_originY: 0.5, u_worldWidth: 0, u_worldHeight: 0,
});

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    // Paper uploads small images at 1024px so the mipmaps stay sharp.
    if (img.naturalWidth < 1024 && img.naturalHeight < 1024) { img.width = 1024; img.height = 1024; }
    resolve(img);
  };
  img.onerror = reject;
  img.src = src;
});

let heatmapImage: Promise<HTMLImageElement> | null = null;
const processedDiamond = () =>
  (heatmapImage ??= toProcessedHeatmap(DIAMOND).then((r) => loadImage(URL.createObjectURL(r.blob))));

type Kind = 'main' | 'metal' | 'heat';

async function mount(el: HTMLElement, kind: Kind, still: boolean): Promise<ShaderMount> {
  if (kind === 'metal') {
    const uniforms = {
      u_colorBack: getShaderColorFromString('#00000000'),
      u_colorTint: getShaderColorFromString('#2C5D72'),
      u_image: await loadImage(CLEAR),
      u_contour: 0.39, u_distortion: 0.17, u_softness: 1, u_repetition: 5.11,
      u_shiftRed: 1, u_shiftBlue: 1, u_angle: 0, u_isImage: false,
      u_shape: LiquidMetalShapes.diamond,
      // Paper's file has scale 0.6; 0.51 draws this diamond at the same size as the
      // heatmap diamonds (measured on the rendered page), so the three match.
      ...sizing(0.51),
    };
    return new ShaderMount(el, liquidMetalFragmentShader, uniforms, undefined, still ? 0 : 1, 146004.2, undefined, undefined, ['u_image']);
  }
  const main = kind === 'main';
  const colors = main
    ? ['#997F45', '#FFFFFF']
    : ['#11206A', '#1F3BA2', '#2F63E7', '#6BD7FF', '#FFE679', '#FF991E', '#FF4C00'];
  const uniforms = {
    u_image: await processedDiamond(),
    u_contour: 0.5, u_angle: 0, u_noise: main ? 0.26 : 0, u_innerGlow: 0.5, u_outerGlow: 0.5,
    u_colorBack: getShaderColorFromString('#00000000'),
    u_colors: colors.map(getShaderColorFromString), u_colorsCount: colors.length,
    ...sizing(0.75),
  };
  const speed = still ? 0 : main ? 0.5 : 1;
  return new ShaderMount(el, heatmapFragmentShader, uniforms, undefined, speed, main ? 15560486.4 : 15659260.4, undefined, undefined, ['u_image']);
}

export function mountDiamonds(root: ParentNode = document): void {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll<HTMLElement>('[data-diamond]').forEach((el) => {
    const kind = el.dataset.diamond as Kind;
    mount(el, kind, still)
      .then((shader) => {
        el.classList.add('is-lit');
        if (still) return;
        const speed = kind === 'main' ? 0.5 : 1;
        new IntersectionObserver(([e]) => shader.setSpeed(e.isIntersecting ? speed : 0)).observe(el);
      })
      .catch(() => el.classList.add('is-off'));
  });
}
