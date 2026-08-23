/**
 * Register React-migrated screens (strangler).
 *
 * Still legacy HTML: auth, menu, submenu, herd-hub, lists*, events, view*, add,
 * action-batch screens, stall-*, sync, admin, farm-card, …
 */
import { registerScreen } from './AppShell';
import FarmSettings from './FarmSettings';
import HelpScreen from './HelpScreen';
import ProtocolsScreen from './ProtocolsScreen';
import NotificationsScreen from './NotificationsScreen';
import TasksScreen from './TasksScreen';
import AnalyticsScreen from './AnalyticsScreen';
import IntervalAnalysisScreen from './IntervalAnalysisScreen';
import ReproductionScreen from './ReproductionScreen';

registerScreen('farm-settings', FarmSettings);
registerScreen('help', HelpScreen);
registerScreen('protocols', ProtocolsScreen);
registerScreen('notifications', NotificationsScreen);
registerScreen('tasks', TasksScreen);
registerScreen('analytics', AnalyticsScreen);
registerScreen('interval-analysis', IntervalAnalysisScreen);
registerScreen('reproduction', ReproductionScreen);
