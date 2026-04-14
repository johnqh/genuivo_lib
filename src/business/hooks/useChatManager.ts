import { useCallback, useRef, useState } from 'react';
import type {
  ChatResponse,
  IRenderable,
  NetworkClient,
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

function buildRequest(
  originalQuery: string,
  inputValues: Record<string, string>,
  inputLabels: Record<string, string>,
  isFirst: boolean
): string {
  if (isFirst) {
    return inputValues['user-query'] ?? Object.values(inputValues)[0] ?? '';
  }
  const answers = Object.entries(inputValues)
    .filter(([, v]) => v.trim() !== '')
    .map(([id, value]) => `${inputLabels[id] ?? id}: ${value}`)
    .join(', ');
  return answers ? `${originalQuery}. ${answers}` : originalQuery;
}

export interface UseChatManagerConfig {
  baseUrl: string;
  networkClient: NetworkClient;
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
  const { networkClient, baseUrl, userId, token } = config;
  const {
    chat,
    isLoading: isChatLoading,
    error: chatError,
  } = useChat(networkClient, baseUrl, userId, token);

  const [currentRenderable, setCurrentRenderable] =
    useState<IRenderable>(INITIAL_RENDERABLE);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalQuery, setOriginalQuery] = useState('');
  const isFirstSubmission = useRef(true);
  const inputValues = useRef<Record<string, string>>({});
  const inputLabels = useRef<Record<string, string>>({});

  const handleAction = useCallback((value: string, renderable: IRenderable) => {
    inputValues.current[renderable.id] = value;
    inputLabels.current[renderable.id] =
      renderable.view?.title?.text ?? renderable.id;
  }, []);

  const handleSubmit = useCallback(async () => {
    const request = buildRequest(
      originalQuery,
      inputValues.current,
      inputLabels.current,
      isFirstSubmission.current
    );

    if (!request.trim()) return;

    if (isFirstSubmission.current) {
      setOriginalQuery(request);
      isFirstSubmission.current = false;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    inputValues.current = {};
    inputLabels.current = {};

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
  }, [originalQuery, chat]);

  const restart = useCallback(() => {
    setCurrentRenderable(INITIAL_RENDERABLE);
    setOriginalQuery('');
    setSubmitError(null);
    setIsSubmitting(false);
    isFirstSubmission.current = true;
    inputValues.current = {};
    inputLabels.current = {};
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
