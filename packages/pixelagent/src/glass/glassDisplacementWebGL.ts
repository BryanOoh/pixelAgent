/**
 * WebGL2 fragment-shader port of the SVG `feDisplacementMap` rim-pull effect.
 *
 * Reuses the displacement PNG produced by {@link generateLiquidGlassMap} — the
 * R/G channels encode the same offset vectors the Chromium `feDisplacementMap`
 * path samples. Running the same encoded data through this shader yields
 * pixel-equivalent rim refraction on Safari and Firefox, which silently drop
 * `backdrop-filter: url(#…)` chains and so produce no refraction on the
 * Chromium fast path.
 *
 * Input contract (matches SVG `feDisplacementMap` semantics):
 *   offset_px = (texture(displacement, uv).rg - 0.5) * scale
 *   output_px = texture(background, uv + offset_px / resolution)
 *
 * Caller owns DOM placement and lifetime of the returned canvas.
 */

import type { DisplacementMap } from './displacementMap';

const VERT_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  // a_position is in clip space [-1, 1]; v_uv maps to [0, 1] for texture sampling.
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAG_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_background;
uniform sampler2D u_displacement;
uniform vec2 u_resolution;
uniform float u_scale;
out vec4 fragColor;
void main() {
  // R/G channel encoding (matches displacementMap.ts):
  //   stored = raw / maxScale + 0.5 (clamped to [0,1])
  // → decoded in [-0.5, +0.5], scaled to pixels via u_scale.
  vec2 disp = texture(u_displacement, v_uv).rg - 0.5;
  vec2 offsetPx = disp * u_scale;
  vec2 sampleUv = v_uv + offsetPx / u_resolution;
  fragColor = texture(u_background, sampleUv);
}`;

export type BackgroundSource = TexImageSource;

export interface DisplacementRenderInputs {
  /** Captured pixels behind the glass surface — feeds the shader's u_background. */
  background: BackgroundSource;
  /** The output of {@link generateLiquidGlassMap}. */
  displacementMap: DisplacementMap;
  /** Output canvas dimensions in CSS pixels; matches the glass surface size. */
  width: number;
  height: number;
  /** Optional: reuse an existing canvas (avoids GC churn under ResizeObserver). */
  canvas?: HTMLCanvasElement;
}

/** Programs/textures we keep around between renders to avoid recompiling
 *  shaders on every scroll/resize tick. Keyed by canvas element identity. */
interface GlState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  backgroundTex: WebGLTexture;
  displacementTex: WebGLTexture;
  uResolution: WebGLUniformLocation;
  uScale: WebGLUniformLocation;
  displacementHref: string | null;
  displacementImage: HTMLImageElement | null;
}

const stateByCanvas: WeakMap<HTMLCanvasElement, GlState> = new WeakMap();

function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL2: createShader returned null');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown';
    gl.deleteShader(shader);
    throw new Error(`WebGL2 shader compile error: ${log}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('WebGL2: createProgram returned null');
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SHADER);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown';
    gl.deleteProgram(program);
    throw new Error(`WebGL2 program link error: ${log}`);
  }
  // Shaders can be detached after link; keeps memory tidy.
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

function initState(canvas: HTMLCanvasElement): GlState | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  const program = linkProgram(gl);

  // Full-screen quad — two triangles covering clip space [-1,1]².
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('WebGL2: createVertexArray returned null');
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
    gl.STATIC_DRAW
  );
  const aPos = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const mkTex = (unit: number): WebGLTexture => {
    const tex = gl.createTexture();
    if (!tex) throw new Error('WebGL2: createTexture returned null');
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  };
  const backgroundTex = mkTex(0);
  const displacementTex = mkTex(1);

  gl.useProgram(program);
  gl.uniform1i(gl.getUniformLocation(program, 'u_background'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'u_displacement'), 1);

  const uResolution = gl.getUniformLocation(program, 'u_resolution');
  const uScale = gl.getUniformLocation(program, 'u_scale');
  if (!uResolution || !uScale) {
    throw new Error('WebGL2: required uniforms not found in linked program');
  }

  return {
    gl,
    program,
    vao,
    backgroundTex,
    displacementTex,
    uResolution,
    uScale,
    displacementHref: null,
    displacementImage: null,
  };
}

function loadImage(href: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load displacement image`));
    img.src = href;
  });
}

/**
 * Render a single displaced frame. Returns the rendered canvas (or null when
 * WebGL2 is unavailable — caller should fall back to a non-refracted look).
 *
 * Synchronous when the displacement PNG for this canvas is already cached;
 * a one-time async hop occurs the first time a new PNG is supplied.
 */
export async function renderDisplaced(
  inputs: DisplacementRenderInputs
): Promise<HTMLCanvasElement | null> {
  const canvas = inputs.canvas ?? document.createElement('canvas');
  // CSS pixel size; the buffer matches so 1 fragment = 1 css px (no DPR scaling
  // here — the caller scales via CSS transform if needed for hi-DPI).
  if (canvas.width !== inputs.width) canvas.width = inputs.width;
  if (canvas.height !== inputs.height) canvas.height = inputs.height;

  let state = stateByCanvas.get(canvas);
  if (!state) {
    const next = initState(canvas);
    if (!next) return null;
    state = next;
    stateByCanvas.set(canvas, state);
  }
  const { gl, program, vao, backgroundTex, displacementTex } = state;

  // Lazy-load + cache the displacement PNG. The href is a data URL that
  // changes only when the surface resizes, so this almost always hits cache.
  if (state.displacementHref !== inputs.displacementMap.href) {
    state.displacementImage = await loadImage(inputs.displacementMap.href);
    state.displacementHref = inputs.displacementMap.href;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, displacementTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      state.displacementImage
    );
  }

  // Background uploads every frame — it changes with scroll/theme/etc.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, backgroundTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    inputs.background
  );

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(program);
  gl.uniform2f(state.uResolution, canvas.width, canvas.height);
  gl.uniform1f(state.uScale, inputs.displacementMap.scale);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindVertexArray(null);

  return canvas;
}
