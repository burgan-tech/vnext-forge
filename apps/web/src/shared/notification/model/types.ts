export type AppNotificationType = 'info' | 'success' | 'warning' | 'error' | 'message' | 'system';

interface NotificationSender {
  id: string;
  email: string;
  role?: string;
}

export interface AppNotification {
  message: string;
  sender: NotificationSender;
  time: string;
  description: string;
  type: AppNotificationType;
  isRead: boolean;
}
