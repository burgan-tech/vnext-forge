import type { PropsWithChildren } from 'react';
import { NotificationContainer } from '../notification/ui/NotificationContainer';

const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <>
      {children}
      <NotificationContainer />
    </>
  );
};

export default AppProviders;
