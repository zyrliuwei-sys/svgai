/** Text-to-SVG generation. Provider settings are supplied by the API boundary. */
export interface SvgInput {
  prompt: string;
  style: 'illustration' | 'icon' | 'logo' | 'line-art';
  aspect: '1:1' | '4:3' | '3:4';
}

export interface SvgProvider {
  kind: 'openai' | 'anthropic';
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type SvgErrorCode =
  | 'invalid_input'
  | 'not_configured'
  | 'invalid_svg'
  | 'provider_failed'
  | 'timeout';

export class SvgGenerationError extends Error {
  constructor(public readonly code: SvgErrorCode) {
    super(code);
    this.name = 'SvgGenerationError';
  }
}

export const MAX_SVG_BYTES = 250_000;
const encoder = new TextEncoder();
const styles = new Set(['illustration', 'icon', 'logo', 'line-art']);
const aspects = new Set(['1:1', '4:3', '3:4']);

export function parseSvgInput(value: unknown): SvgInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SvgGenerationError('invalid_input');
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.prompt !== 'string' ||
    !input.prompt.trim() ||
    input.prompt.trim().length > 1600 ||
    typeof input.style !== 'string' ||
    !styles.has(input.style) ||
    typeof input.aspect !== 'string' ||
    !aspects.has(input.aspect)
  ) {
    throw new SvgGenerationError('invalid_input');
  }
  return {
    prompt: input.prompt.trim(),
    style: input.style as SvgInput['style'],
    aspect: input.aspect as SvgInput['aspect'],
  };
}

function configuredKey(key: string | undefined): string | undefined {
  const value = key?.trim();
  return value && !value.includes('*') ? value : undefined;
}

/** Only explicitly supplied administration settings are consulted, never ambient keys. */
export function selectSvgProvider(
  settings: Record<string, string | undefined>
): SvgProvider | undefined {
  const openaiKey = configuredKey(settings.openai_api_key);
  const anthropicKey = configuredKey(settings.anthropic_api_key);
  if (openaiKey) {
    return {
      kind: 'openai',
      apiKey: openaiKey,
      baseUrl: settings.openai_base_url?.trim() || 'https://api.openai.com/v1',
      model: settings.openai_model?.trim() || 'gpt-4.1-mini',
    };
  }
  if (anthropicKey) {
    return {
      kind: 'anthropic',
      apiKey: anthropicKey,
      baseUrl:
        settings.anthropic_base_url?.trim() || 'https://api.anthropic.com',
      model: settings.anthropic_model?.trim() || 'claude-haiku-4-5',
    };
  }
  return undefined;
}

// This parser deliberately accepts a small, non-executable XML language rather
// than attempting to clean arbitrary HTML/XML. Unknown tags, attributes and
// entities fail closed. Rebuilding tokens makes the downloaded SVG safe too.
const drawingTags = new Set([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
]);
const allowedTags = new Set([
  'svg',
  'g',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  ...drawingTags,
]);
const numericAttributes = new Set([
  'width',
  'height',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'fx',
  'fy',
  'fr',
  'stroke-width',
  'stroke-miterlimit',
  'stroke-dashoffset',
]);
const colorAttributes = new Set(['fill', 'stroke', 'stop-color']);
const opacityAttributes = new Set([
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'stop-opacity',
]);
const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const numberList = /^[\d\s.,eE+-]+$/;
const id = /^[A-Za-z_][A-Za-z0-9_.-]{0,79}$/;

function validNumber(value: string, percent = false): boolean {
  const raw = percent && value.endsWith('%') ? value.slice(0, -1) : value;
  return (
    number.test(raw) &&
    Number.isFinite(Number(raw)) &&
    Math.abs(Number(raw)) <= 100_000
  );
}

function validateAttribute(name: string, value: string, tag: string): boolean {
  if (!value || /[<>&\u0000-\u001f]/.test(value)) return false;
  if (name === 'xmlns')
    return tag === 'svg' && value === 'http://www.w3.org/2000/svg';
  if (name === 'id') return id.test(value);
  if (numericAttributes.has(name)) return validNumber(value, true);
  if (opacityAttributes.has(name))
    return validNumber(value) && +value >= 0 && +value <= 1;
  if (colorAttributes.has(name)) {
    return /^(?:#[a-fA-F0-9]{3,8}|[a-zA-Z]{1,24}|url\(#[A-Za-z_][A-Za-z0-9_.-]{0,79}\))$/.test(
      value
    );
  }
  if (name === 'viewBox') {
    const values = value.trim().split(/[\s,]+/);
    return (
      tag === 'svg' &&
      values.length === 4 &&
      values.every((v) => validNumber(v)) &&
      +values[2] > 0 &&
      +values[3] > 0
    );
  }
  if (name === 'd')
    return tag === 'path' && /^[MmLlHhVvCcSsQqTtAaZz\d\s.,eE+-]+$/.test(value);
  if (name === 'points')
    return /^(?:polyline|polygon)$/.test(tag) && numberList.test(value);
  if (name === 'transform' || name === 'gradientTransform') {
    return /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([\d\s.,eE+-]+\)\s*)+$/.test(
      value
    );
  }
  if (name === 'stroke-dasharray')
    return value === 'none' || numberList.test(value);
  if (name === 'fill-rule' || name === 'clip-rule')
    return /^(?:nonzero|evenodd)$/.test(value);
  if (name === 'stroke-linecap') return /^(?:butt|round|square)$/.test(value);
  if (name === 'stroke-linejoin') return /^(?:miter|round|bevel)$/.test(value);
  if (name === 'vector-effect') return value === 'non-scaling-stroke';
  if (name === 'gradientUnits')
    return /^(?:userSpaceOnUse|objectBoundingBox)$/.test(value);
  if (name === 'spreadMethod') return /^(?:pad|reflect|repeat)$/.test(value);
  if (name === 'offset') return tag === 'stop' && validNumber(value, true);
  if (name === 'preserveAspectRatio')
    return /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: (?:meet|slice))?)$/.test(
      value
    );
  return false;
}

export function validateGeneratedSvg(raw: string): string {
  const invalid = (): never => {
    throw new SvgGenerationError('invalid_svg');
  };
  if (typeof raw !== 'string' || encoder.encode(raw).byteLength > MAX_SVG_BYTES)
    return invalid();
  let svg = raw.trim();
  if (svg.startsWith('```'))
    svg = svg
      .replace(/^```(?:svg|xml)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();
  if (
    !svg.startsWith('<svg') ||
    /[&\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(svg)
  )
    return invalid();
  const stack: string[] = [];
  const result: string[] = [];
  let offset = 0;
  let nodes = 0;
  let drawings = 0;
  let closed = false;
  while (offset < svg.length) {
    while (/\s/.test(svg[offset] || '') && offset < svg.length) offset++;
    if (offset === svg.length) break;
    if (closed || svg[offset] !== '<') return invalid();
    let end = offset + 1;
    let quote = '';
    for (; end < svg.length; end++) {
      const c = svg[end];
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
      else if (c === '<') return invalid();
    }
    if (end === svg.length || quote) return invalid();
    const token = svg.slice(offset + 1, end);
    offset = end + 1;
    if (token.startsWith('/')) {
      const tag = token.slice(1).trim();
      if (!/^[A-Za-z]+$/.test(tag) || stack.pop() !== tag) return invalid();
      result.push(`</${tag}>`);
      if (!stack.length) closed = true;
      continue;
    }
    const selfClosing = token.endsWith('/');
    const body = selfClosing ? token.slice(0, -1) : token;
    const tagMatch = /^([A-Za-z]+)(?=\s|$)/.exec(body);
    if (!tagMatch || !allowedTags.has(tagMatch[1])) return invalid();
    const tag = tagMatch[1];
    if ((!stack.length && tag !== 'svg') || (stack.length && tag === 'svg'))
      return invalid();
    if (++nodes > 2000 || stack.length > 30) return invalid();
    if (drawingTags.has(tag)) drawings++;
    const attributes: string[] = [];
    const seen = new Set<string>();
    let position = tagMatch[0].length;
    while (position < body.length) {
      const remaining = body.slice(position);
      if (!remaining.trim()) break;
      const attr = /^\s+([A-Za-z][A-Za-z0-9-]*)\s*=\s*(["'])([^"']*)\2/.exec(
        remaining
      );
      if (
        !attr ||
        seen.has(attr[1]) ||
        !validateAttribute(attr[1], attr[3], tag)
      )
        return invalid();
      seen.add(attr[1]);
      attributes.push(`${attr[1]}="${attr[3]}"`);
      position += attr[0].length;
    }
    if (tag === 'svg') {
      if (!seen.has('viewBox')) return invalid();
      if (!seen.has('xmlns'))
        attributes.unshift('xmlns="http://www.w3.org/2000/svg"');
    }
    result.push(
      `<${tag}${attributes.length ? ' ' + attributes.join(' ') : ''}${selfClosing ? '/' : ''}>`
    );
    if (!selfClosing) stack.push(tag);
    else if (tag === 'svg') closed = true;
  }
  if (!closed || stack.length || drawings === 0) return invalid();
  return result.join('');
}

function endpoint(provider: SvgProvider): string {
  try {
    const url = new URL(
      provider.baseUrl.replace(/\/+$/, '') +
        (provider.kind === 'openai' ? '/chat/completions' : '/v1/messages')
    );
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    return url.href;
  } catch {
    throw new SvgGenerationError('provider_failed');
  }
}

const systemPrompt = [
  'You are a professional vector illustrator. Return only one standalone SVG document, no prose or markdown.',
  'Create thoughtful composition, clean paths, balanced negative space and a coherent restrained palette.',
  'Use a viewBox and real editable vector shapes. Never embed raster images.',
  'Only use svg, g, path, rect, circle, ellipse, line, polyline and polygon elements. Do not use gradients or defs.',
  'Only use basic geometry, presentation attributes and transform attributes. Use flat solid hex fills.',
  'No text, style, CSS, scripts, event handlers, external URLs, entities, declarations, filters, masks, clipPaths, use or animation.',
  'Keep the SVG below 80KB and 250 shapes. Use explicit hex colors. Make a transparent background unless the brief asks otherwise.',
].join(' ');

async function readProviderResponse(response: Response): Promise<unknown> {
  if (!response.ok || !response.body)
    throw new SvgGenerationError('provider_failed');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 500_000) {
        await reader.cancel();
        throw new SvgGenerationError('invalid_svg');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const all = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(all));
  } catch {
    throw new SvgGenerationError('provider_failed');
  }
}

export async function generateSvg(
  input: SvgInput,
  provider: SvgProvider
): Promise<{ svg: string }> {
  const validated = parseSvgInput(input);
  const [width, height] =
    validated.aspect === '4:3'
      ? [640, 480]
      : validated.aspect === '3:4'
        ? [480, 640]
        : [512, 512];
  const userPrompt = `Artwork brief: ${validated.prompt}\nStyle: ${validated.style}. Use viewBox="0 0 ${width} ${height}".`;
  const anthropic = provider.kind === 'anthropic';
  try {
    const response = await fetch(endpoint(provider), {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(45_000),
      headers: {
        'Content-Type': 'application/json',
        ...(anthropic
          ? { 'x-api-key': provider.apiKey, 'anthropic-version': '2023-06-01' }
          : { Authorization: `Bearer ${provider.apiKey}` }),
      },
      body: JSON.stringify(
        anthropic
          ? {
              model: provider.model,
              max_tokens: 12_000,
              system: systemPrompt,
              messages: [{ role: 'user', content: userPrompt }],
            }
          : {
              model: provider.model,
              max_completion_tokens: 12_000,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            }
      ),
    });
    const data = (await readProviderResponse(response)) as any;
    const raw = anthropic
      ? data?.content
          ?.filter(
            (part: any) =>
              part?.type === 'text' && typeof part?.text === 'string'
          )
          .map((part: any) => part.text)
          .join('\n')
      : data?.choices?.[0]?.message?.content;
    if (typeof raw !== 'string')
      throw new SvgGenerationError('provider_failed');
    return { svg: validateGeneratedSvg(raw) };
  } catch (error) {
    if (error instanceof SvgGenerationError) throw error;
    if (
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    )
      throw new SvgGenerationError('timeout');
    // Provider error payloads can include secrets and source prompts. Never pass them to callers.
    throw new SvgGenerationError('provider_failed');
  }
}
