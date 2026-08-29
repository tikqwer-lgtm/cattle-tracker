/**
 * Register React-migrated screens (strangler).
 * Full JSX: farm-settings, help, protocols.
 * LegacyHost (same DOM ids + IIFE init): remaining screens.
 */
import { registerScreen } from './AppShell';
import FarmSettings from './FarmSettings';
import HelpScreen from './HelpScreen';
import ProtocolsScreen from './ProtocolsScreen';
import { hostFor } from './LegacyHost';

registerScreen('farm-settings', FarmSettings);
registerScreen('help', HelpScreen);
registerScreen('protocols', ProtocolsScreen);

const HOSTED = [
  'auth',
  'menu',
  'submenu',
  'herd-hub',
  'lists',
  'list-uzi',
  'list-insemination',
  'list-calving',
  'events',
  'view',
  'view-cow',
  'all-inseminations',
  'add',
  'insemination',
  'uzi',
  'dry',
  'calving',
  'abort',
  'protocol-assign',
  'stall-map',
  'stall-inventory',
  'analytics',
  'interval-analysis',
  'reproduction',
  'notifications',
  'tasks',
  'sync',
  'admin',
  'farm-card',
] as const;

for (const id of HOSTED) {
  registerScreen(id, hostFor(id));
}
