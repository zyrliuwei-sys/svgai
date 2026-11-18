import {
  createMcpHandler,
  hostHeaderValidationResponse,
  McpServer,
  originValidationResponse,
} from '@modelcontextprotocol/server';
import { z } from 'zod';

import { seeApiCredentials } from '@/core/ai/seeapi-generation';
import { getAllConfigs } from '@/modules/config/service';
import * as apikeys from '@/modules/apikeys/service';
import { paidSvgOrder } from '@/modules/svg-previews/service';
import { parseSvgInput, SvgGenerationError } from '@/modules/svg-generator/service';
import { fulfillSvg, TaskBillingError } from '@/modules/ai-tasks/service';
import { SVG_IMAGE_CREDITS } from '@/config/generation';
import {
  ownedSvgTask,
  refreshSvgGeneration,
  startSvgGeneration,
} from '@/server/svg-generation';
import { parseImageInput, traceImage } from '@/server/svg-renderer';
import { svgIdentityHash } from '@/lib/svg-visitor';

function toolResult(data: Record<string, unknown>, isError = false) {
  return {
    isError,
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

function toolError(error: unknown) {
  if (error instanceof TaskBillingError) {
    const messages: Record<string, string> = {
      insufficient_credits: 'Insufficient credits. Add credits to your VectorMint account and try again.',
      payment_required: 'A paid VectorMint purchase is required to use the SVG API.',
      request_conflict: 'This request ID was already used with different input. Use a new UUID.',
    };
    return toolResult(
      { error: error.code, message: messages[error.code] || 'Billing request failed.' },
      true
    );
  }
  if (error instanceof SvgGenerationError) {
    return toolResult(
      { error: error.code, message: 'The SVG generation input or output was invalid.' },
      true
    );
  }
  if (error instanceof Error && error.message === 'invalid_input') {
    return toolResult(
      { error: 'invalid_input', message: 'The supplied image or input is invalid.' },
      true
    );
  }
  return toolResult(
    { error: 'internal_error', message: 'The SVG operation failed. Please try again.' },
    true
  );
}

function createSvgMcpServer(userId: string, paidOrderId: string) {
  const server = new McpServer(
    {
      name: 'vectormint-svg',
      title: 'VectorMint AI SVG Generator',
      version: '1.0.0',
      description: 'Paid AI-powered text-to-SVG and image-to-SVG conversion with editable vector paths.',
      websiteUrl: 'https://aisvg-generator.com',
    },
    {
      maxToolInputElements: 64,
      instructions:
        'VectorMint creates editable SVG vector graphics. All generation tools require a paid VectorMint account and a user API key. Generation consumes account credits. Use a new UUID requestId for each new generation and reuse the same UUID only when retrying that exact request. Text-to-SVG generation is asynchronous; poll get_svg_task using the returned taskId.',
    }
  );

  server.registerTool(
    'generate_svg',
    {
      description:
        'Generate an editable SVG from a text prompt. Returns a taskId and status; use get_svg_task to poll until the SVG is ready. Requires a paid VectorMint account and deducts credits.',
      inputSchema: z
        .object({
          requestId: z.string().uuid().describe('A client-generated UUID used as an idempotency key. Reuse it only for retries of the same input.'),
          prompt: z.string().min(1).max(1600).describe('Describe the vector artwork to create.'),
          style: z.enum(['illustration', 'icon', 'logo', 'line-art']).describe('Visual style.'),
          aspect: z.enum(['1:1', '4:3', '3:4']).describe('SVG canvas aspect ratio.'),
        })
        .strict(),
    },
    async ({ requestId, prompt, style, aspect }) => {
      try {
        const input = parseSvgInput({ prompt, style, aspect });
        const credentials = seeApiCredentials(await getAllConfigs());
        if (!credentials)
          return toolResult(
            { error: 'service_unavailable', message: 'SVG generation is temporarily unavailable.' },
            true
          );
        const result = await startSvgGeneration({
          userId,
          requestId,
          input,
          credentials,
          paidOrderId,
        });
        return toolResult(result as unknown as Record<string, unknown>);
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'get_svg_task',
    {
      description:
        'Check the status of a previously started Text-to-SVG generation and return the editable SVG when complete. Only tasks belonging to the authenticated account can be accessed.',
      inputSchema: z.object({ taskId: z.string().min(1).max(100) }).strict(),
    },
    async ({ taskId }) => {
      try {
        const task = await ownedSvgTask(taskId, userId);
        if (!task)
          return toolResult(
            { error: 'task_not_found', message: 'No SVG task was found for this account.' },
            true
          );
        const credentials = seeApiCredentials(await getAllConfigs());
        if (!credentials && !['success', 'failed'].includes(task.status))
          return toolResult(
            { error: 'service_unavailable', message: 'SVG generation status is temporarily unavailable.' },
            true
          );
        const result = await refreshSvgGeneration(task, credentials!);
        return toolResult(result as unknown as Record<string, unknown>);
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    'image_to_svg',
    {
      description:
        'Convert a PNG image into editable SVG vector paths. Accepts a base64-encoded PNG (maximum 512×512 pixels) and returns the SVG. Requires a paid VectorMint account and deducts credits.',
      inputSchema: z
        .object({
          requestId: z.string().uuid().describe('A client-generated UUID used as an idempotency key. Reuse it only for retries of the same input.'),
          image: z.string().min(1).max(1_500_000).describe('Base64-encoded PNG image, without a data URL prefix.'),
          colors: z.union([z.literal(4), z.literal(8), z.literal(16)]).describe('Maximum number of output colors.'),
          removeBackground: z.boolean().describe('Whether to remove a uniform edge background.'),
        })
        .strict(),
    },
    async ({ requestId, image, colors, removeBackground }) => {
      try {
        const input = parseImageInput({ image, colors, removeBackground });
        const svg = await traceImage(input);
        const id = 'image_' + (await svgIdentityHash(userId + ':' + requestId));
        const options = JSON.stringify({
          imageHash: await svgIdentityHash(input.image),
          colors: input.colors,
          removeBackground: input.removeBackground,
        });
        const task = await fulfillSvg({
          id,
          userId,
          paidOrderId,
          model: 'image-trace',
          provider: 'svgai-trace',
          options,
          svg,
          credits: SVG_IMAGE_CREDITS,
        });
        return toolResult({
          taskId: task.id,
          status: task.status,
          credits: task.costCredits,
          svg: task.taskResult ? JSON.parse(task.taskResult).svg : svg,
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  return server;
}

export async function handleSvgMcp(request: Request) {
  try {
    const hostRejected = hostHeaderValidationResponse(request, [
      'aisvg-generator.com',
      'www.aisvg-generator.com',
    ]);
    if (hostRejected) return hostRejected;

    const originRejected = originValidationResponse(request, [
      'aisvg-generator.com',
      'www.aisvg-generator.com',
    ]);
    if (originRejected) return originRejected;

    const authorization = request.headers.get('authorization') || '';
    const match = /^Bearer (\S+)$/i.exec(authorization);
    if (!match)
      return new Response(
        JSON.stringify({ error: 'A VectorMint API key is required in the Authorization: Bearer header.' }),
        {
          status: 401,
          headers: {
            'content-type': 'application/json',
            'www-authenticate': 'Bearer realm="vectormint-mcp"',
            'cache-control': 'no-store',
          },
        }
      );

    const userId = await apikeys.validate(match[1]);
    if (!userId)
      return Response.json(
        { error: 'Invalid or expired VectorMint API key.' },
        {
          status: 401,
          headers: {
            'www-authenticate': 'Bearer realm="vectormint-mcp"',
            'cache-control': 'no-store',
          },
        }
      );

    const paidOrderId = await paidSvgOrder(userId);
    if (!paidOrderId)
      return Response.json(
        { error: 'A paid VectorMint purchase is required.' },
        { status: 402, headers: { 'cache-control': 'no-store' } }
      );

    const handler = createMcpHandler(
      () => createSvgMcpServer(userId, paidOrderId),
      { maxRequestBodySize: 2_000_000 }
    );
    const response = await handler.fetch(request);
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch {
    return Response.json(
      { error: 'VectorMint MCP service is temporarily unavailable.' },
      { status: 503, headers: { 'cache-control': 'no-store' } }
    );
  }
}
