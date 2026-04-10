import type { PropsWithChildren } from 'react';
import { NotificationContainer } from '@shared/notification/ui/NotificationContainer';

const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <>
      {children}
      <NotificationContainer />
    </>
  );
};

export default AppProviders;
