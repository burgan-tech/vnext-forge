import { create } from 'zustand';

export type NotificationType = 'info' | 'success' | 'error';
export type NotificationModalType = 'toast' | 'modal';

export interface NotificationOptions {
  id?: number;
  message: string;
  type?: NotificationType;
  modalType?: NotificationModalType;
  duration?: number;
  actionLabel?: string;
  onActionPress?: () => void;
}

const MAX_NOTIFICATION_QUEUE_SIZE = 2;

interface NotificationState {
  id: number;
  current: NotificationOptions | null;
  queue: NotificationOptions[];
  visible: boolean;

  showNotification: (options: NotificationOptions) => void;
  dismissNotification: () => void;
  nextNotification: () => void;
}

const initialState = {
  id: 1,
  current: null,
  queue: [],
  visible: false,
};

function takeNextNotification(queue: NotificationOptions[]) {
  const [current, ...rest] = queue;

  return {
    current: current ?? null,
    queue: rest,
    visible: Boolean(current),
  };
}

export const useNotificationStore = create<NotificationState>((set) => ({
  ...initialState,

  showNotification: (options: NotificationOptions) =>
    set((state) => {
      if (state.queue.length >= MAX_NOTIFICATION_QUEUE_SIZE) {
        return state;
      }

      const notification = {
        ...options,
        id: state.id,
      };
      const queue = [...state.queue, notification];

      if (state.visible || state.current) {
        return {
          id: state.id + 1,
          queue,
        };
      }

      return {
        id: state.id + 1,
        ...takeNextNotification(queue),
      };
    }),

  dismissNotification: () =>
    set({
      current: null,
      visible: false,
    }),

  nextNotification: () =>
    set((state) => {
      if (state.queue.length === 0) {
        return {
          current: null,
          visible: false,
        };
      }

      return takeNextNotification(state.queue);
    }),
}));

export const showNotification = (options: NotificationOptions) =>
  useNotificationStore.getState().showNotification(options);

export const dismissNotification = () => useNotificationStore.getState().dismissNotification();

export const nextNotification = () => useNotificationStore.getState().nextNotification();

export type { NotificationState };
