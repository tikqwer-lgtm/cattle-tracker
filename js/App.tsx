/**
 * React root: AppShell + registered React screens; legacy HTML for the rest.
 */
import React from 'react';
import AppShell from './screens/AppShell';
import './screens/register-screens';

export default function App(): React.ReactElement {
  return <AppShell />;
}
