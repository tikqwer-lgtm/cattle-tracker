/**
 * React root: gradual migration of legacy screens from index.html.
 * Farm settings — first React pilot (portal into #farm-settings-react-root).
 */
import React from 'react';
import { createPortal } from 'react-dom';
import FarmSettings from './screens/FarmSettings';
import { useNavigateScreen } from './screens/useNavigateScreen';

export default function App(): React.ReactElement {
  const screenId = useNavigateScreen();
  const farmRoot =
    typeof document !== 'undefined' ? document.getElementById('farm-settings-react-root') : null;

  return (
    <>
      {screenId === 'farm-settings' && farmRoot
        ? createPortal(<FarmSettings />, farmRoot)
        : null}
    </>
  );
}
