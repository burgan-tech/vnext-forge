import { showNotification } from '@shared/notification/model/notificationStore';
import { Button } from '@shared/ui/button';

export function TestPage() {
  const handleShowNotification = () => {
    showNotification({
      message: 'Test notification gosterildi.',
      type: 'success',
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Button onClick={handleShowNotification}>Show Notification</Button>
    </div>
  );
}
