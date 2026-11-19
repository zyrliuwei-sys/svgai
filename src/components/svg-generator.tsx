import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SvgAspect,
  SvgAvailability,
  SvgGenerationRequest,
  SvgGenerationResult,
  SvgGeneratorCopy,
  SvgMode,
  SvgSample,
  SvgStyle,
  SvgTrialResult,
} from '@/types/svg-generator';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCheck,
  Code2,
  Copy,
  ImagePlus,
  Loader2,
  LockKeyhole,
  Maximize2,
  MousePointer2,
  MoveUpRight,
  ScanLine,
  Sparkles,
  Type,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { z } from 'zod';

import { useSession } from '@/core/auth/client';
import { Link, useRouter } from '@/core/i18n/navigation';
import { ApiError, apiGet, apiPost } from '@/lib/api-client';
import {
  getSvgStats,
  inspectRaster,
  outlineSvg,
  prepareImagePng,
  recolorSvg,
  sanitizeSvg,
  svgToDataUrl,
} from '@/lib/svg-vectorizer';
import {
  SvgComparison,
  type SvgComparisonCopy,
} from '@/components/svg-comparison';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

import '@/styles/svg-generator.css';
import '@/styles/svg-pricing.css';

interface Props {
  copy: SvgGeneratorCopy;
  samples: SvgSample[];
  initialMode?: SvgMode;
  formatTrialCredits: (credits: number) => string;
  comparisonCopy: SvgComparisonCopy;
}

export function SvgGenerator({
  copy,
  samples,
  initialMode = 'text',
  formatTrialCredits,
  comparisonCopy,
}: Props) {
  const errorId = useId();
  const generatorRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [trialPreview, setTrialPreview] = useState<SvgTrialResult | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const trialResumed = useRef(false);
  const paymentResumed = useRef(false);
  const paymentWaitStarted = useRef(Date.now());
  const imageRequestId = useRef<{
    owner: string;
    fingerprint: string;
    requestId: string;
  } | null>(null);
  const initial = samples[0]!;
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [chargedCredits, setChargedCredits] = useState<number | null>(null);
  const [pendingTask, setPendingTask] = useState(false);
  const resumed = useRef(false);
  const draftRestored = useRef(false);
  const sampleSelected = useRef(false);
  const modeChosen = useRef(false);
  const pendingRequest = useRef<{
    owner: string;
    request: SvgGenerationRequest;
    taskId?: string;
  } | null>(null);
  const [mode, setMode] = useState<SvgMode>(initialMode);
  const [style, setStyle] = useState<SvgStyle>('illustration');
  const [aspect, setAspect] = useState<SvgAspect>('1:1');
  const [svg, setSvg] = useState(initial.svg);
  const [sampleId, setSampleId] = useState<string | null>(initial.id);
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const [comparisonPosition, setComparisonPosition] = useState(50);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [colorCount, setColorCount] = useState(8);
  const [imageMethod, setImageMethod] = useState<'trace' | 'ai'>('trace');
  const [pendingImageTask, setPendingImageTask] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [success, setSuccess] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgStats = useMemo(() => getSvgStats(svg), [svg]);
  const stats = trialPreview?.stats || svgStats;

  function chooseMode(next: SvgMode) {
    modeChosen.current = true;
    setMode(next);
  }

  const availability = useQuery({
    queryKey: ['svg-generation-availability', session?.user.id],
    queryFn: () => apiGet<SvgAvailability>('/api/svg/generate'),
    staleTime: 60_000,
    retry: 1,
    retryDelay: 1000,
    refetchInterval: (query) =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('resumePreview') &&
      !query.state.data?.paid &&
      Date.now() - paymentWaitStarted.current < 90_000
        ? 3000
        : false,
  });
  const canEditImage = availability.data?.paid && availability.data.imageEdit;
  const useImageEdit = canEditImage && imageMethod === 'ai';

  async function finishImageResult(result: SvgGenerationResult, owner: string) {
    const storageKey = `svgai-image-task-${owner}`;
    if (result.status === 'processing') {
      setPendingImageTask(result.taskId);
      try {
        localStorage.setItem(storageKey, result.taskId);
      } catch {
        /* Optional recovery after reload. */
      }
    }
    const deadline = Date.now() + 300_000;
    const taskUrl = `/api/svg/generate?taskId=${encodeURIComponent(result.taskId)}`;
    while (result.status === 'processing' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3500));
      try {
        result = await apiGet<SvgGenerationResult>(taskUrl);
      } catch (error) {
        if (
          error instanceof ApiError &&
          [401, 402, 403, 404].includes(error.status ?? 0)
        )
          throw error;
      }
    }
    if (result.status === 'processing') throw new Error(copy.still_processing);
    setPendingImageTask(undefined);
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`svgai-image-request-${owner}`);
      if (result.svg)
        localStorage.setItem(
          `svgai-last-result-${owner}`,
          JSON.stringify({ mode: 'image', taskId: result.taskId })
        );
    } catch {
      /* Optional result recovery. */
    }
    imageRequestId.current = null;
    if (!result.svg) throw new Error(copy.failed_refunded);
    setChargedCredits(result.credits);
    return { svg: sanitizeSvg(result.svg) };
  }

  const generate = useMutation({
    mutationFn: async (value: {
      prompt: string;
      mode: SvgMode;
      taskId?: string;
      trialId?: string;
    }) => {
      const access = availability.data || (await availability.refetch()).data;
      if (!access) throw new Error(copy.model_unavailable);
      if (!access.paid || value.trialId) {
        if (
          !access.canPreview &&
          access.preview?.status !== 'processing' &&
          !value.taskId &&
          !value.trialId
        ) {
          setPaywallOpen(true);
          throw new Error(copy.trial_used);
        }
        if (value.mode === 'text' && !access.ready)
          throw new Error(copy.model_unavailable);
        let result: SvgTrialResult;
        if (
          value.trialId ||
          value.taskId ||
          access.preview?.status === 'processing'
        ) {
          result = await apiGet<SvgTrialResult>('/api/svg/preview');
        } else {
          if (value.mode === 'image' && !file)
            throw new Error(copy.upload_required);
          result = await apiPost<SvgTrialResult>(
            '/api/svg/preview',
            value.mode === 'image'
              ? {
                  mode: 'image',
                  image: await prepareImagePng(file!),
                  colors: colorCount,
                  removeBackground,
                }
              : { mode: 'text', prompt: value.prompt, style, aspect }
          );
        }
        setTrialPreview(result);
        const started = Date.now();
        while (
          result.status === 'processing' &&
          Date.now() - started < 300_000
        ) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          try {
            result = await apiGet<SvgTrialResult>('/api/svg/preview');
            setTrialPreview(result);
          } catch (error) {
            if (
              error instanceof ApiError &&
              [400, 401, 403, 404].includes(error.status || 0)
            )
              throw error;
          }
        }
        if (result.status === 'processing')
          throw new Error(copy.still_processing);
        if (result.status === 'failed') {
          setTrialPreview(null);
          throw new Error(copy.trial_failed);
        }
        return { trial: result };
      }
      if (value.mode === 'image') {
        if (!session?.user) throw new Error(copy.sign_in_required);
        const existingTask = value.taskId ?? pendingImageTask;
        if (existingTask)
          return finishImageResult(
            await apiGet<SvgGenerationResult>(
              `/api/svg/generate?taskId=${encodeURIComponent(existingTask)}`
            ),
            session.user.id
          );
        if (!file) throw new Error(copy.upload_required);
        const method = useImageEdit ? 'ai' : 'trace';
        const image = await prepareImagePng(file);
        const fingerprint = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(
                JSON.stringify({
                  image,
                  colors: colorCount,
                  removeBackground,
                  ...(useImageEdit ? { method } : {}),
                })
              )
            )
          ),
          (byte) => byte.toString(16).padStart(2, '0')
        ).join('');
        const storageKey = `svgai-image-request-${session.user.id}`;
        let pending = imageRequestId.current;
        try {
          pending ||= JSON.parse(localStorage.getItem(storageKey) || 'null');
        } catch {
          /* Keep retry identity in memory when storage is unavailable. */
        }
        if (
          pending?.owner !== session.user.id ||
          pending.fingerprint !== fingerprint ||
          !/^[a-f0-9-]{36}$/i.test(pending.requestId)
        )
          pending = {
            owner: session.user.id,
            fingerprint,
            requestId: crypto.randomUUID(),
          };
        imageRequestId.current = pending;
        try {
          localStorage.setItem(storageKey, JSON.stringify(pending));
        } catch {
          /* A network retry can still reuse the in-memory identity. */
        }
        let result: SvgGenerationResult;
        try {
          result = await apiPost<SvgGenerationResult>('/api/svg/image', {
            requestId: pending.requestId,
            image,
            colors: colorCount,
            removeBackground,
            method,
          });
        } catch (error) {
          if (
            error instanceof ApiError &&
            [400, 401, 402, 403, 409].includes(error.status || 0)
          ) {
            imageRequestId.current = null;
            try {
              localStorage.removeItem(storageKey);
            } catch {
              /* Optional storage. */
            }
          }
          throw error;
        }
        return finishImageResult(result, session.user.id);
      }
      if (!availability.data?.ready) throw new Error(copy.model_unavailable);
      if (!session?.user) throw new Error(copy.sign_in_required);
      const storageKey = `svgai-pending-${session.user.id}`;
      let pending: { request: SvgGenerationRequest; taskId?: string } | null =
        null;
      try {
        pending = JSON.parse(localStorage.getItem(storageKey) || 'null');
      } catch {
        /* Storage may be unavailable. */
      }
      if (!pending && pendingRequest.current?.owner === session.user.id)
        pending = pendingRequest.current;
      if (!pending) {
        pending = {
          request: {
            requestId: crypto.randomUUID(),
            prompt: value.prompt,
            style,
            aspect,
          },
          taskId: value.taskId,
        };
        try {
          localStorage.setItem(storageKey, JSON.stringify(pending));
        } catch {
          /* Keep the in-memory request. */
        }
      }
      pendingRequest.current = { owner: session.user.id, ...pending };
      setPendingTask(true);
      const readTask = async (taskId: string): Promise<SvgGenerationResult> => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await apiGet<SvgGenerationResult>(
              `/api/svg/generate?taskId=${encodeURIComponent(taskId)}`
            );
          } catch (e) {
            if (
              e instanceof ApiError &&
              [401, 403, 404].includes(e.status ?? 0)
            )
              throw e;
            if (attempt === 2) throw e;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
        throw new Error(copy.still_processing);
      };
      let result: SvgGenerationResult;
      try {
        result = pending.taskId
          ? await readTask(pending.taskId)
          : await apiPost<SvgGenerationResult>(
              '/api/svg/generate',
              pending.request
            );
      } catch (e) {
        if (
          e instanceof ApiError &&
          [400, 401, 402, 404, 409].includes(e.status ?? 0)
        ) {
          try {
            localStorage.removeItem(storageKey);
          } catch {
            /* Optional storage. */
          }
          pendingRequest.current = null;
          setPendingTask(false);
        }
        throw e;
      }
      pending.taskId = result.taskId;
      // The accepted task has reserved credits even while the artwork is pending.
      void queryClient.invalidateQueries({
        queryKey: ['svg-generation-availability'],
      });
      void queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      pendingRequest.current = { owner: session.user.id, ...pending };
      try {
        localStorage.setItem(storageKey, JSON.stringify(pending));
      } catch {
        /* Optional storage. */
      }
      const started = Date.now();
      let attempts = 0;
      while (result.status === 'processing' && Date.now() - started < 300_000) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(3000 + attempts * 500, 8000) + Math.random() * 400
          )
        );
        attempts++;
        try {
          result = await apiGet<SvgGenerationResult>(
            `/api/svg/generate?taskId=${encodeURIComponent(pending.taskId!)}`
          );
        } catch (e) {
          if (e instanceof ApiError && [401, 403, 404].includes(e.status ?? 0))
            throw e;
          // Query failures do not resubmit a generation or release its reservation.
        }
      }
      if (result.status === 'processing')
        throw new Error(copy.still_processing);
      if (result.status === 'awaiting_credits')
        throw new Error(copy.top_up_required);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* Optional storage. */
      }
      pendingRequest.current = null;
      setPendingTask(false);
      if (result.status === 'failed' || !result.svg)
        throw new Error(copy.failed_refunded);
      const cleanSvg = sanitizeSvg(result.svg);
      try {
        localStorage.setItem(
          `svgai-last-result-${session.user.id}`,
          JSON.stringify({ ...pending.request, taskId: result.taskId })
        );
      } catch {
        /* Optional result recovery. */
      }
      setChargedCredits(result.credits);
      return { svg: cleanSvg };
    },
    onMutate: () => {
      setError('');
      setSuccess(false);
      setChargedCredits(null);
    },
    onSuccess: (result) => {
      if ('trial' in result && result.trial) setTrialPreview(result.trial);
      else if ('svg' in result && result.svg) {
        setSvg(result.svg);
        setTrialPreview(null);
      }
      setSampleId(null);
      setView('preview');
      setZoom(1);
      setSuccess(true);
    },
    onError: (e: Error) => {
      if (e instanceof ApiError && e.status === 402) setPaywallOpen(true);
      setError(e.message || copy.generation_error);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ['svg-generation-availability'],
      });
      void queryClient.invalidateQueries({ queryKey: ['credits'] });
      void queryClient.invalidateQueries({ queryKey: ['user-credits'] });
    },
  });
  const form = useForm({
    defaultValues: { prompt: initial.prompt },
    onSubmit: ({ value }) => {
      modeChosen.current = true;
      if (trialPreview?.status === 'processing') {
        generate.mutate({
          prompt: value.prompt,
          mode: trialPreview.mode,
          trialId: trialPreview.previewId,
        });
        return;
      }
      if (mode === 'text') {
        const parsed = z
          .string()
          .trim()
          .min(1)
          .max(1600)
          .safeParse(value.prompt);
        if (!parsed.success) {
          setError(copy.prompt_required);
          return;
        }
        generate.mutate({ prompt: parsed.data, mode });
      } else generate.mutate({ prompt: '', mode });
    },
  });

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem('svgai-prompt-draft');
      if (
        draft &&
        initialMode === 'text' &&
        !new URLSearchParams(window.location.search).has('sample')
      ) {
        let saved: { prompt?: string; style?: SvgStyle; aspect?: SvgAspect };
        try {
          const parsed = JSON.parse(draft);
          saved =
            parsed && typeof parsed === 'object' ? parsed : { prompt: draft };
        } catch {
          saved = { prompt: draft };
        }
        if (saved && typeof saved.prompt === 'string') {
          form.setFieldValue('prompt', saved.prompt);
          if (
            saved.style &&
            ['illustration', 'icon', 'logo', 'line-art'].includes(saved.style)
          )
            setStyle(saved.style);
          if (saved.aspect && ['1:1', '4:3', '3:4'].includes(saved.aspect))
            setAspect(saved.aspect);
          draftRestored.current = true;
        }
        sessionStorage.removeItem('svgai-prompt-draft');
      }
    } catch {
      /* Optional storage. */
    }
  }, []);
  useEffect(() => {
    if (
      !session?.user ||
      !availability.data?.paid ||
      resumed.current ||
      modeChosen.current ||
      new URLSearchParams(window.location.search).has('resumePreview')
    )
      return;
    resumed.current = true;
    try {
      const imageTask = localStorage.getItem(
        `svgai-image-task-${session.user.id}`
      );
      if (imageTask) {
        setPendingImageTask(imageTask);
        setMode('image');
        generate.mutate({ prompt: '', mode: 'image', taskId: imageTask });
        return;
      }
      const pending = JSON.parse(
        localStorage.getItem(`svgai-pending-${session.user.id}`) || 'null'
      );
      if (
        !pending &&
        !draftRestored.current &&
        !sampleSelected.current &&
        initialMode === 'text' &&
        !new URLSearchParams(window.location.search).has('sample')
      ) {
        const last = JSON.parse(
          localStorage.getItem(`svgai-last-result-${session.user.id}`) || 'null'
        );
        if (last?.taskId) {
          const savedMode = last.mode === 'image' ? 'image' : 'text';
          if (savedMode === 'text' && !availability.data.ready) return;
          if (savedMode === 'text') {
            form.setFieldValue('prompt', last.prompt);
            setStyle(last.style);
            setAspect(last.aspect);
          }
          setMode(savedMode);
          generate.mutate({
            prompt: last.prompt || '',
            mode: savedMode,
            taskId: last.taskId,
          });
        }
      }
      if (
        pending?.request?.requestId &&
        availability.data.ready &&
        initialMode === 'text' &&
        !new URLSearchParams(window.location.search).has('sample')
      ) {
        form.setFieldValue('prompt', pending.request.prompt);
        setStyle(pending.request.style);
        setAspect(pending.request.aspect);
        setMode('text');
        generate.mutate({ prompt: pending.request.prompt, mode: 'text' });
      }
    } catch {
      /* A damaged saved draft must not block the generator. */
    }
  }, [session?.user.id, availability.data?.ready, availability.data?.paid]);

  useEffect(() => {
    const preview = availability.data?.preview;
    // Recovery is for entering the tool. An older preview must not take over
    // after the visitor chooses a tab or starts working with a new file.
    if (
      !preview ||
      modeChosen.current ||
      (initialMode === 'image' && preview.mode !== 'image') ||
      sampleSelected.current ||
      success ||
      generate.isPending
    )
      return;
    if (preview.status !== 'failed') {
      setTrialPreview(preview);
      setSampleId(null);
      setMode(preview.mode);
      setView('preview');
    }
    if (preview.status === 'processing' && !trialResumed.current) {
      trialResumed.current = true;
      generate.mutate({
        prompt: initial.prompt,
        mode: preview.mode,
        trialId: preview.previewId,
      });
    }
  }, [
    availability.data?.preview,
    availability.data?.paid,
    initialMode,
    success,
  ]);

  const loadSample = (sample: SvgSample) => {
    sampleSelected.current = true;
    form.setFieldValue('prompt', sample.prompt);
    setStyle(sample.style ?? 'illustration');
    setAspect('1:1');
    setSvg(sample.svg);
    setTrialPreview(null);
    setSampleId(sample.id);
    setMode('text');
    setView('preview');
    setError('');
    setZoom(1);
    setSuccess(false);
  };
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('sample');
    const sample = samples.find((item) => item.id === id);
    if (sample) loadSample(sample);
  }, []);
  useEffect(() => {
    const listener = (event: Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail?.id;
      const sample = samples.find((item) => item.id === id);
      if (sample && !generate.isPending) loadSample(sample);
    };
    window.addEventListener('svgai:load-sample', listener);
    return () => window.removeEventListener('svgai:load-sample', listener);
  });
  useEffect(() => {
    let active = true;
    setImageUrl('');
    setImageDimensions(null);
    if (!file) {
      return;
    }
    const url = URL.createObjectURL(file);
    void file
      .arrayBuffer()
      .then(async (bytes) => {
        inspectRaster(new Uint8Array(bytes), file.type);
        const bitmap = await createImageBitmap(file);
        try {
          if (active) {
            setImageDimensions({ width: bitmap.width, height: bitmap.height });
            setImageUrl(url);
          }
        } finally {
          bitmap.close();
        }
      })
      .catch(() => {
        if (active) setError(copy.invalid_file);
      });
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const acceptFile = (incoming?: File) => {
    if (!incoming || generate.isPending) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(incoming.type)) {
      setError(copy.invalid_file);
      return;
    }
    if (incoming.size > 10 * 1024 * 1024) {
      setError(copy.file_too_large);
      return;
    }
    chooseMode('image');
    setFile(incoming);
    setError('');
    setSuccess(false);
  };
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || generate.isPending || expanded) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target !== document.body &&
        !generatorRef.current?.contains(target)
      )
        return;
      const image = [...(event.clipboardData?.files || [])].find((item) =>
        item.type.startsWith('image/')
      );
      if (!image) return;
      event.preventDefault();
      acceptFile(image);
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  });
  const authorizedArtwork = async (): Promise<string | null> => {
    if (!availability.data?.paid) {
      setPaywallOpen(true);
      return null;
    }
    if (!trialPreview) return svg;
    if (trialPreview.status !== 'succeeded') return null;
    setExportBusy(true);
    try {
      const result = await apiPost<{
        svg: string;
        taskId: string;
        credits: number;
      }>('/api/svg/export', { previewId: trialPreview.previewId });
      const safe = sanitizeSvg(result.svg);
      setSvg(safe);
      setTrialPreview(null);
      setChargedCredits(result.credits);
      setSuccess(true);
      void queryClient.invalidateQueries({
        queryKey: ['svg-generation-availability'],
      });
      void queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      try {
        localStorage.setItem(
          `svgai-last-result-${session?.user.id}`,
          JSON.stringify({
            prompt: form.getFieldValue('prompt'),
            style,
            aspect,
            taskId: result.taskId,
          })
        );
      } catch {
        /* Optional recovery. */
      }
      return safe;
    } catch (error) {
      if (error instanceof ApiError && error.status === 402)
        setPaywallOpen(true);
      setError(error instanceof Error ? error.message : copy.generation_error);
      return null;
    } finally {
      setExportBusy(false);
    }
  };
  const download = async () => {
    if (exportBusy) return;
    const content = await authorizedArtwork();
    if (!content) return;
    const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `svgai-${sampleId || 'artwork'}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copyCode = async () => {
    if (exportBusy) return;
    const content = await authorizedArtwork();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      setError(copy.copy_error);
    }
  };
  useEffect(() => {
    if (
      availability.data?.paid &&
      trialPreview?.status === 'succeeded' &&
      !paymentResumed.current &&
      new URLSearchParams(window.location.search).has('resumePreview')
    ) {
      paymentResumed.current = true;
      void download();
    }
  }, [availability.data?.paid, trialPreview?.status]);
  const changeView = (next: 'preview' | 'code') => {
    if (trialPreview && next !== 'preview') {
      if (!availability.data?.paid) {
        setPaywallOpen(true);
        return;
      }
      void authorizedArtwork().then((content) => {
        if (content) setView(next);
      });
      return;
    }
    setView(next);
  };
  const artworkUrl = useMemo(
    () => trialPreview?.previewUrl || svgToDataUrl(svg),
    [svg, trialPreview?.previewUrl]
  );
  const outlineArtworkUrl = useMemo(
    () =>
      trialPreview?.previewUrl
        ? `${trialPreview.previewUrl}&view=outline`
        : svgToDataUrl(outlineSvg(svg)),
    [svg, trialPreview?.previewUrl]
  );

  return (
    <div
      ref={generatorRef}
      className="svg-generator"
      aria-busy={generate.isPending}
    >
      <form
        className="svg-input-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div
          className="svg-input-tabs"
          role="tablist"
          aria-label={copy.input_modes}
        >
          {(
            [
              { id: 'text', Icon: Type, title: copy.text_tab },
              { id: 'image', Icon: ImagePlus, title: copy.image_tab },
            ] as const
          ).map(({ id, Icon, title }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`svg-tab-${id}`}
              aria-controls={`svg-panel-${id}`}
              aria-selected={mode === id}
              tabIndex={mode === id ? 0 : -1}
              disabled={generate.isPending}
              className={mode === id ? 'is-active' : ''}
              onClick={() => {
                chooseMode(id);
                setError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  const next = mode === 'text' ? 'image' : 'text';
                  chooseMode(next);
                  document.getElementById(`svg-tab-${next}`)?.focus();
                }
              }}
            >
              <Icon size={15} strokeWidth={1.7} />
              {title}
            </button>
          ))}
        </div>
        <div
          className="svg-input-body"
          role="tabpanel"
          id={`svg-panel-${mode}`}
          aria-labelledby={`svg-tab-${mode}`}
        >
          {mode === 'text' ? (
            <>
              <div className="svg-field-heading">
                <label htmlFor="svg-prompt">{copy.prompt_label}</label>
                <Sparkles size={14} strokeWidth={1.5} />
              </div>
              <form.Field name="prompt">
                {(field) => (
                  <div className="svg-prompt-box">
                    <textarea
                      id="svg-prompt"
                      aria-invalid={error === copy.prompt_required || undefined}
                      aria-describedby={error ? errorId : undefined}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder={copy.prompt_placeholder}
                      maxLength={1600}
                      disabled={generate.isPending}
                    />
                    <span className="svg-character-count">
                      {field.state.value.length}/1600
                    </span>
                  </div>
                )}
              </form.Field>
              <div className="svg-prompt-suggestions">
                <span>{copy.try_prompt}</span>
                {samples.slice(0, 3).map((sample) => (
                  <button
                    type="button"
                    key={sample.id}
                    onClick={() => loadSample(sample)}
                    disabled={generate.isPending}
                  >
                    {sample.name}
                    <MoveUpRight size={10} />
                  </button>
                ))}
              </div>
              <fieldset className="svg-style-field">
                <legend>{copy.style_label}</legend>
                <div className="svg-style-options">
                  {(
                    ['illustration', 'icon', 'logo', 'line-art'] as SvgStyle[]
                  ).map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={style === value}
                      className={style === value ? 'is-selected' : ''}
                      disabled={generate.isPending}
                      onClick={() => setStyle(value)}
                    >
                      <span
                        className={`svg-style-symbol symbol-${value}`}
                        aria-hidden="true"
                      >
                        {value === 'illustration' ? (
                          <Sparkles size={17} />
                        ) : value === 'icon' ? (
                          <Maximize2 size={16} />
                        ) : value === 'logo' ? (
                          <MousePointer2 size={17} />
                        ) : (
                          <ScanLine size={17} />
                        )}
                      </span>
                      {copy[`style_${value}`]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="svg-option-row">
                <label htmlFor="svg-aspect">{copy.aspect_label}</label>
                <select
                  id="svg-aspect"
                  value={aspect}
                  onChange={(e) => setAspect(e.target.value as SvgAspect)}
                  disabled={generate.isPending}
                >
                  <option value="1:1">{copy.aspect_square}</option>
                  <option value="4:3">{copy.aspect_landscape}</option>
                  <option value="3:4">{copy.aspect_portrait}</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="svg-field-heading">
                <label htmlFor="svg-image">{copy.image_label}</label>
                <Upload size={14} />
              </div>
              <input
                ref={fileInput}
                id="svg-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  acceptFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <div
                className={`svg-dropzone ${dragging ? 'is-dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  acceptFile(e.dataTransfer.files[0]);
                }}
              >
                {file && imageUrl ? (
                  <>
                    <button
                      className="svg-remove-file"
                      type="button"
                      aria-label={copy.remove_image}
                      onClick={() => setFile(null)}
                      disabled={generate.isPending}
                    >
                      <X size={15} />
                    </button>
                    <img
                      className="svg-upload-preview"
                      src={imageUrl}
                      alt={copy.uploaded_image}
                      width={imageDimensions!.width}
                      height={imageDimensions!.height}
                    />
                    <span className="svg-file-name">{file.name}</span>
                    <button
                      className="svg-text-button"
                      type="button"
                      disabled={generate.isPending}
                      onClick={() => fileInput.current?.click()}
                    >
                      {copy.change_image}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="svg-upload-icon">
                      <ImagePlus size={24} strokeWidth={1.3} />
                    </div>
                    <strong>{copy.drop_title}</strong>
                    <span>{copy.drop_subtitle}</span>
                    <button
                      className="svg-browse-button"
                      type="button"
                      disabled={generate.isPending}
                      onClick={() => fileInput.current?.click()}
                    >
                      <Upload size={13} />
                      {copy.browse_files}
                    </button>
                  </>
                )}
              </div>
              {canEditImage && (
                <>
                  <div className="svg-option-row">
                    <label htmlFor="svg-image-method">
                      {copy.conversion_method}
                    </label>
                    <select
                      id="svg-image-method"
                      value={imageMethod}
                      disabled={generate.isPending}
                      aria-describedby={
                        useImageEdit ? 'svg-ai-image-note' : undefined
                      }
                      onChange={(event) =>
                        setImageMethod(
                          event.target.value === 'ai' ? 'ai' : 'trace'
                        )
                      }
                    >
                      <option value="trace">{copy.direct_trace}</option>
                      <option value="ai">{copy.ai_illustration}</option>
                    </select>
                  </div>
                  {useImageEdit && (
                    <p className="svg-input-note" id="svg-ai-image-note">
                      {copy.ai_image_note}
                    </p>
                  )}
                </>
              )}
              <div className="svg-option-row">
                <label htmlFor="svg-colors">{copy.colors_label}</label>
                <select
                  id="svg-colors"
                  value={colorCount}
                  onChange={(e) => setColorCount(Number(e.target.value))}
                  disabled={generate.isPending}
                >
                  {[4, 8, 16].map((n) => (
                    <option key={n} value={n}>
                      {n} {copy.colors_unit}
                    </option>
                  ))}
                </select>
              </div>
              <label className="svg-checkbox">
                <input
                  type="checkbox"
                  checked={removeBackground}
                  disabled={generate.isPending}
                  onChange={(e) => setRemoveBackground(e.target.checked)}
                />
                <span>
                  {useImageEdit
                    ? copy.remove_photo_background
                    : copy.remove_background}
                </span>
              </label>
            </>
          )}
          <div className="svg-submit-area">
            <button
              className="svg-generate-button"
              type="submit"
              disabled={
                generate.isPending ||
                exportBusy ||
                (mode === 'image' &&
                  !file &&
                  !pendingImageTask &&
                  trialPreview?.status !== 'processing')
              }
            >
              {generate.isPending ? (
                <Loader2 className="svg-spin" size={17} />
              ) : (
                <Sparkles size={16} />
              )}
              <span>
                {generate.isPending
                  ? copy.generating
                  : trialPreview?.status === 'processing'
                    ? copy.resume_generation
                    : !availability.data?.paid
                      ? availability.data?.canPreview !== false
                        ? copy.trial_generate
                        : copy.trial_continue
                      : mode === 'text'
                        ? pendingTask
                          ? copy.resume_generation
                          : copy.generate
                        : pendingImageTask
                          ? copy.resume_generation
                          : copy.vectorize}
              </span>
              {!generate.isPending && <ArrowRight size={16} />}
            </button>
            <p className="svg-input-note">
              {!availability.data?.paid ? (
                availability.data?.canPreview === false ? (
                  copy.trial_used_note
                ) : (
                  copy.trial_free_note
                )
              ) : mode === 'image' ? (
                <>
                  <Check size={12} />
                  {copy.trial_image_paid_note}
                </>
              ) : (
                <>
                  {availability.data?.ready ? (
                    <>
                      {availability.data.reservedCredits}{' '}
                      {copy.credits_reserved} {copy.credit_note}
                    </>
                  ) : availability.isPending ? (
                    copy.availability_loading
                  ) : session?.user ? (
                    copy.model_unavailable
                  ) : (
                    copy.text_note
                  )}
                </>
              )}
            </p>
          </div>
          {availability.data?.paid && (
            <div className="svg-credit-balance">
              <span>
                {session?.user
                  ? availability.data?.balance != null
                    ? `${availability.data.balance} ${copy.credits_available}`
                    : availability.isError
                      ? copy.balance_error
                      : copy.balance_loading
                  : copy.sign_in_required}
              </span>
              <Link href="/pricing">
                {copy.get_credits}
                <ArrowRight size={12} />
              </Link>
            </div>
          )}
          {error && (
            <p id={errorId} className="svg-generator-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="svg-generator-success" role="status">
              <CheckCheck size={13} />
              {trialPreview ? copy.trial_generated : copy.success}
              {chargedCredits !== null &&
                ` · ${chargedCredits} ${copy.credits_used}`}
            </p>
          )}
        </div>
      </form>
      <div className="svg-output-panel">
        <div className="svg-output-top">
          <div
            className="svg-output-tabs"
            role="tablist"
            aria-label={copy.output_modes}
          >
            {(['preview', 'code'] as const).map((key) => (
              <button
                type="button"
                key={key}
                role="tab"
                id={`svg-output-tab-${key}`}
                aria-controls="svg-output-content"
                aria-selected={view === key}
                tabIndex={view === key ? 0 : -1}
                onClick={() => changeView(key)}
                onKeyDown={(event) => {
                  const keys = ['preview', 'code'] as const;
                  const i = keys.indexOf(view);
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault();
                    const next =
                      keys[
                        (i +
                          (event.key === 'ArrowRight' ? 1 : keys.length - 1)) %
                          keys.length
                      ]!;
                    changeView(next);
                    (
                      event.currentTarget.parentElement?.children[
                        keys.indexOf(next)
                      ] as HTMLElement
                    )?.focus();
                  }
                }}
                className={view === key ? 'is-active' : ''}
              >
                {key === 'code' && <Code2 size={12} />} {copy[`view_${key}`]}
              </button>
            ))}
          </div>
          <div className="svg-output-tools">
            <span className="svg-output-label">
              {trialPreview
                ? copy.trial_preview_label
                : sampleId
                  ? copy.sample_label
                  : copy.result_label}
            </span>
            <button
              type="button"
              className="svg-expand-button"
              onClick={() => setExpanded(true)}
              aria-label={copy.expand_preview}
              title={copy.expand_preview}
              disabled={generate.isPending || view === 'code'}
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </div>
        <div
          id="svg-output-content"
          role="tabpanel"
          aria-labelledby={`svg-output-tab-${view}`}
          className={`svg-artboard ${view === 'code' ? 'is-code' : ''}`}
        >
          {view === 'code' ? (
            <pre tabIndex={0} aria-label={copy.svg_code}>
              {svg.replace(/></g, '>\n<')}
            </pre>
          ) : (
            <>
              <div className="svg-artboard-corner corner-tl" />
              <div className="svg-artboard-corner corner-tr" />
              <div className="svg-artboard-corner corner-bl" />
              <div className="svg-artboard-corner corner-br" />
              <SvgComparison
                className="svg-artwork-comparison"
                colorSrc={artworkUrl}
                outlineSrc={outlineArtworkUrl}
                alt={copy.preview_alt}
                width={stats.width}
                height={stats.height}
                priority
                copy={comparisonCopy}
                value={comparisonPosition}
                onValueChange={setComparisonPosition}
                scale={zoom}
                disabled={generate.isPending}
              />
              {trialPreview?.status === 'succeeded' && (
                <div className="svg-preview-lock">
                  <LockKeyhole size={12} />
                  {copy.trial_badge}
                </div>
              )}
              <div className="svg-artboard-size svgai-mono">
                {stats.width} × {stats.height}
              </div>
              <div className="svg-zoom-controls">
                <button
                  type="button"
                  aria-label={copy.zoom_out}
                  disabled={zoom <= 0.5}
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                >
                  <ZoomOut size={13} />
                </button>
                <button
                  type="button"
                  aria-label={copy.reset_zoom}
                  onClick={() => setZoom(1)}
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  aria-label={copy.zoom_in}
                  disabled={zoom >= 2}
                  onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                >
                  <ZoomIn size={13} />
                </button>
              </div>
            </>
          )}
          {generate.isPending && (
            <div className="svg-processing">
              <div className="svg-processing-line" />
              <Sparkles size={28} />
              <span>{copy.generating}</span>
            </div>
          )}
        </div>
        <div className="svg-output-bottom">
          <div
            className="svg-palette"
            role="group"
            aria-label={copy.palette_label}
          >
            {stats.colors.map((color, index) => (
              <label
                key={index}
                className="svg-color-swatch"
                style={{ backgroundColor: color }}
                title={`${copy.edit_color} ${color}`}
              >
                <input
                  type="color"
                  value={/^#[a-f\d]{6}$/i.test(color) ? color : '#222222'}
                  aria-label={`${copy.edit_color} ${index + 1}`}
                  disabled={generate.isPending || Boolean(trialPreview)}
                  onChange={(e) =>
                    setSvg(recolorSvg(svg, color, e.target.value))
                  }
                />
              </label>
            ))}
          </div>
          <span className="svg-vector-stats svgai-mono">
            {stats.paths} {copy.paths} <span>/</span>{' '}
            {(stats.bytes / 1024).toFixed(1)} KB
          </span>
          <button
            type="button"
            className="svg-copy-button"
            onClick={() => void copyCode()}
            aria-label={copy.copy_svg}
            disabled={exportBusy || generate.isPending}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? copy.copied : copy.copy_code}</span>
          </button>
          <button
            type="button"
            className="svg-download-button"
            disabled={generate.isPending || exportBusy}
            onClick={download}
          >
            <ArrowDownToLine size={14} />
            <span>
              {exportBusy
                ? copy.trial_unlocking
                : !availability.data?.paid || trialPreview
                  ? copy.trial_unlock
                  : copy.download}
            </span>
          </button>
        </div>
      </div>
      <span className="sr-only" role="status">
        {copied ? copy.copied : ''}
      </span>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="svg-expanded-view" showCloseButton={false}>
          <div className="svg-expanded-header">
            <div>
              <DialogTitle>{copy.expanded_title}</DialogTitle>
              <DialogDescription>{copy.expanded_description}</DialogDescription>
            </div>
            <DialogClose
              className="svg-expanded-close"
              aria-label={copy.close_preview}
            >
              <X size={20} />
            </DialogClose>
          </div>
          <div className="svg-expanded-artboard">
            <SvgComparison
              className="svg-expanded-comparison"
              colorSrc={artworkUrl}
              outlineSrc={outlineArtworkUrl}
              alt={copy.preview_alt}
              width={stats.width}
              height={stats.height}
              copy={comparisonCopy}
              value={comparisonPosition}
              onValueChange={setComparisonPosition}
            />
          </div>
          <div className="svg-expanded-footer">
            <span>
              {stats.width} × {stats.height} / {stats.paths} {copy.paths}
            </span>
            <button type="button" onClick={download} disabled={exportBusy}>
              <ArrowDownToLine size={16} />
              {exportBusy
                ? copy.trial_unlocking
                : !availability.data?.paid || trialPreview
                  ? copy.trial_unlock
                  : copy.download}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={paywallOpen} onOpenChange={setPaywallOpen}>
        <DialogContent className="svg-paywall" showCloseButton={false}>
          <DialogClose
            className="svg-paywall-close"
            aria-label={copy.trial_paywall_close}
          >
            <X size={19} />
          </DialogClose>
          <div className="svg-paywall-symbol">
            <LockKeyhole size={25} />
          </div>
          <DialogTitle>{copy.trial_paywall_title}</DialogTitle>
          <DialogDescription>
            {copy.trial_paywall_description}
          </DialogDescription>
          <ul>
            <li>
              <Check size={15} />
              {copy.trial_feature_download}
            </li>
            <li>
              <Check size={15} />
              {copy.trial_feature_once}
            </li>
          </ul>
          {trialPreview?.status === 'succeeded' && (
            <p className="svg-paywall-credit-note">
              {formatTrialCredits(trialPreview.credits)}
            </p>
          )}
          <button
            className="svg-paywall-cta"
            type="button"
            onClick={() => {
              setPaywallOpen(false);
              setExpanded(false);
              const previewId =
                trialPreview?.previewId ||
                availability.data?.preview?.previewId;
              router.push(
                `/pricing${previewId ? '?preview=' + encodeURIComponent(previewId) : ''}#pricing`
              );
            }}
          >
            {copy.trial_paywall_cta}
            <ArrowRight size={16} />
          </button>
          <DialogClose className="svg-paywall-back">
            {copy.trial_paywall_close}
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}
