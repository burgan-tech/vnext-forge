import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

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

interface NotificationState {
  id: number;
  current: NotificationOptions | null;
  queue: NotificationOptions[];
  visible: boolean;
}

const initialState: NotificationState = {
  id: 1,
  current: null,
  queue: [],
  visible: false,
};

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    showNotification(state, action: PayloadAction<NotificationOptions>) {
      action.payload.id = state.id;
      if (state.queue.length < 5) {
        state.queue.push(action.payload);
        state.id += 1;
      }

      if (!state.visible && !state.current) {
        state.current = state.queue.shift() ?? null;
        state.visible = !!state.current;
      }
    },
    dismissNotification(state) {
      state.visible = false;
      state.current = null;
    },
    nextNotification(state) {
      if (state.queue.length > 0) {
        state.current = state.queue.shift() ?? null;
        if (state.current) {
          state.visible = true;
        }
      } else {
        state.current = null;
        state.visible = false;
      }
    },
  },
});

export const { showNotification, dismissNotification, nextNotification } =
  notificationSlice.actions;

export default notificationSlice.reducer;
