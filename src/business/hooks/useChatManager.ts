import { useCallback, useRef, useState } from 'react';
import type {
  ChatResponse,
  IRenderable,
  Optional,
} from '@sudobility/genuivo_types';
import type { FirebaseIdToken } from '@sudobility/genuivo_client';
import { useChat } from '@sudobility/genuivo_client';

const INPUT_LAYOUTS = new Set([
  'input_text',
  'input_numeric',
  'input_password',
  'input_email',
  'input_phone',
  'input_date',
  'input_text_block',
  'search',
  'line_toggle',
  'line_slider',
  'line_select',
]);

export function hasInputControls(renderable: IRenderable): boolean {
  const layout = renderable.view?.layout;
  if (layout && INPUT_LAYOUTS.has(layout)) return true;
  return renderable.view?.children?.some(hasInputControls) ?? false;
}

const INITIAL_RENDERABLE: IRenderable = {
  id: 'welcome',
  view: {
    layout: 'stacked_vertical',
    title: { text: 'What would you like to explore?' },
    subtitle: {
      text: 'Ask me anything \u2014 restaurants, travel, shopping, and more.',
    },
    children: [
      {
        id: 'user-query',
        view: {
          layout: 'input_text',
          title: { text: 'Your question' },
          subtitle: { text: 'e.g., Find Italian restaurants near me' },
        },
      },
    ],
  },
};

function formatAnswers(
  values: Record<string, string>,
  labels: Record<string, string>
): string {
  return Object.entries(values)
    .filter(([, v]) => v.trim() !== '')
    .map(([id, value]) => `${labels[id] ?? id}: ${value}`)
    .join(', ');
}

function buildRequest(
  originalQuery: string,
  allAnswers: Record<string, string>,
  allLabels: Record<string, string>
): string {
  const answers = formatAnswers(allAnswers, allLabels);
  return answers ? `${originalQuery}. ${answers}` : originalQuery;
}

export interface UseChatManagerConfig {
  userId: Optional<string>;
  token: Optional<FirebaseIdToken>;
}

export interface UseChatManagerReturn {
  currentRenderable: IRenderable;
  isLoading: boolean;
  error: Optional<string>;
  handleAction: (value: string, renderable: IRenderable) => void;
  handleSubmit: () => Promise<void>;
  restart: () => void;
}

export function useChatManager(
  config: UseChatManagerConfig
): UseChatManagerReturn {
  const { userId, token } = config;
  const {
    chat,
    isLoading: isChatLoading,
    error: chatError,
  } = useChat(userId, token);

  const [currentRenderable, setCurrentRenderable] =
    useState<IRenderable>(INITIAL_RENDERABLE);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isFirstSubmission = useRef(true);
  const originalQueryRef = useRef('');
  const inputValues = useRef<Record<string, string>>({});
  const inputLabels = useRef<Record<string, string>>({});
  const allAnswers = useRef<Record<string, string>>({});
  const allLabels = useRef<Record<string, string>>({});

  const handleAction = useCallback((value: string, renderable: IRenderable) => {
    inputValues.current[renderable.id] = value;
    inputLabels.current[renderable.id] =
      renderable.view?.title?.text ?? renderable.id;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isFirstSubmission.current) {
      const query =
        inputValues.current['user-query'] ??
        Object.values(inputValues.current)[0] ??
        '';
      if (!query.trim()) return;
      originalQueryRef.current = query;
      isFirstSubmission.current = false;
      inputValues.current = {};
      inputLabels.current = {};
    } else {
      // Merge current round answers into accumulated answers
      Object.assign(allAnswers.current, inputValues.current);
      Object.assign(allLabels.current, inputLabels.current);
      inputValues.current = {};
      inputLabels.current = {};
    }

    const request = buildRequest(
      originalQueryRef.current,
      allAnswers.current,
      allLabels.current
    );

    if (!request.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await chat(request);
      if (response.success && response.data) {
        const data = response.data as ChatResponse;
        setCurrentRenderable(data.output as IRenderable);
      } else {
        const errMsg =
          'error' in response
            ? (response as { error?: string }).error
            : 'Unknown error';
        setSubmitError(errMsg ?? 'Request failed');
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [chat]);

  const restart = useCallback(() => {
    setCurrentRenderable(INITIAL_RENDERABLE);
    setSubmitError(null);
    setIsSubmitting(false);
    isFirstSubmission.current = true;
    originalQueryRef.current = '';
    inputValues.current = {};
    inputLabels.current = {};
    allAnswers.current = {};
    allLabels.current = {};
  }, []);

  const error: Optional<string> = submitError ?? chatError;
  const isLoading = isSubmitting || isChatLoading;

  return {
    currentRenderable,
    isLoading,
    error,
    handleAction,
    handleSubmit,
    restart,
  };
}
