/**
 * React root: AppShell + registry; legacy HTML screens until migrated.
 */
import React from 'react';
import { AppShell } from './screens/AppShell';
import { useNavigateScreen } from './screens/useNavigateScreen';
import './screens/register-screens';

export default function App(): React.ReactElement {
  const screenId = useNavigateScreen();
  return <AppShell screenId={screenId} />;
}
