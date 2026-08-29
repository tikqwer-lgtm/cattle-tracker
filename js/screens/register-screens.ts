/**
 * Register React-migrated screens (strangler).
 * Still legacy HTML: auth, menu, submenu, herd-hub, lists*, events, view*, add,
 * action-batch screens, stall-*, analytics*, notifications, tasks, sync, admin, farm-card, …
 */
import { registerScreen } from './AppShell';
import FarmSettings from './FarmSettings';
import HelpScreen from './HelpScreen';
import ProtocolsScreen from './ProtocolsScreen';

registerScreen('farm-settings', FarmSettings);
registerScreen('help', HelpScreen);
registerScreen('protocols', ProtocolsScreen);
