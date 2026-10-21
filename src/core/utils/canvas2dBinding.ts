import { isDouyinMiniGameHost } from './miniGameHost';

export interface Canvas2dBinding {
  /** 实际用于 2D 绑定的画布（可能是离屏）。 */
  canvas: WxCanvas;
  ctx: WxCanvasRenderingContext2D;
  /** Helium 上屏为 WebGL 时，每帧将离屏 2D 贴到屏幕。 */
  present?: () => void;
}

function findExistingMainCanvas(): WxCanvas | null {
  const g = globalThis as {
    canvas?: WxCanvas;
    GameGlobal?: { canvas?: WxCanvas; sharedCanvas?: WxCanvas };
    window?: { canvas?: WxCanvas };
  };
  const candidates: unknown[] = [g.GameGlobal?.canvas, g.canvas, g.window?.canvas];
  for (const item of candidates) {
    if (item && typeof (item as WxCanvas).getContext === 'function') {
      return item as WxCanvas;
    }
  }
  return null;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[crush-crush] shader compile', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createWebglPresenter(
  screen: WxCanvas,
  gl: WebGLRenderingContext,
  source: WxCanvas,
): (() => void) | null {
  const vs = compileShader(
    gl,
    gl.VERTEX_SHADER,
    'attribute vec2 a_pos;varying vec2 v_uv;void main(){v_uv=a_pos*0.5+0.5;gl_Position=vec4(a_pos,0.0,1.0);}',
  );
  const fs = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    'precision mediump float;varying vec2 v_uv;uniform sampler2D u_tex;void main(){gl_FragColor=texture2D(u_tex,vec2(v_uv.x,1.0-v_uv.y));}',
  );
  if (!vs || !fs) {
    return null;
  }
  const prog = gl.createProgram();
  if (!prog) {
    return null;
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[crush-crush] program link', gl.getProgramInfoLog(prog));
    return null;
  }
  const tex = gl.createTexture();
  const buf = gl.createBuffer();
  if (!tex || !buf) {
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const locPos = gl.getAttribLocation(prog, 'a_pos');
  const locTex = gl.getUniformLocation(prog, 'u_tex');

  return () => {
    const w = screen.width || 1;
    const h = screen.height || 1;
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source as unknown as TexImageSource,
      );
    } catch (err) {
      console.warn('[crush-crush] texImage2D failed', err);
      return;
    }
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(locTex, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
}

const CANVAS_BINDING_CACHE_KEY = '__CRUSH_CANVAS_2D_BINDING__';

function bindMainCanvas2dOnce(): Canvas2dBinding {
  if (typeof wx === 'undefined') {
    throw new Error('wx/tt runtime missing');
  }

  const screen = findExistingMainCanvas();
  if (screen) {
    const onScreen2d = screen.getContext('2d');
    if (onScreen2d) {
      return { canvas: screen, ctx: onScreen2d };
    }
  }

  if (typeof wx.createCanvas !== 'function') {
    throw new Error('createCanvas unavailable');
  }

  const drawCanvas = wx.createCanvas();
  const drawCtx = drawCanvas.getContext('2d');
  if (!drawCtx) {
    throw new Error('2d context unavailable on createCanvas');
  }

  if (!screen || screen === drawCanvas) {
    return { canvas: drawCanvas, ctx: drawCtx };
  }

  if (isDouyinMiniGameHost()) {
    const gl =
      (screen.getContext('webgl') as WebGLRenderingContext | null) ||
      (screen.getContext('webgl2') as WebGLRenderingContext | null);
    if (gl) {
      const present = createWebglPresenter(screen, gl, drawCanvas);
      if (present) {
        console.info('[crush-crush] douyin helium: offscreen 2d + webgl present');
        return { canvas: drawCanvas, ctx: drawCtx, present };
      }
    }
  }

  console.warn('[crush-crush] using secondary 2d canvas without presenter');
  return { canvas: drawCanvas, ctx: drawCtx };
}

/**
 * 绑定可用的 2D 上下文（全局单例）。Helium 上 WebGL 只能初始化一次 present。
 */
export function bindMainCanvas2d(): Canvas2dBinding {
  const g = globalThis as { [CANVAS_BINDING_CACHE_KEY]?: Canvas2dBinding };
  if (g[CANVAS_BINDING_CACHE_KEY]) {
    return g[CANVAS_BINDING_CACHE_KEY];
  }
  const binding = bindMainCanvas2dOnce();
  g[CANVAS_BINDING_CACHE_KEY] = binding;
  if (isDouyinMiniGameHost() && !binding.present) {
    console.warn('[crush-crush] douyin: no canvas presenter — screen may stay on splash');
  }
  return binding;
}

/** @deprecated 使用 bindMainCanvas2d；保留给仅需 canvas 引用的旧代码。 */
export function resolveWxMainCanvas(): WxCanvas {
  return bindMainCanvas2d().canvas;
}
