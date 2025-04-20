import { AppRegistry } from 'react-native';
import App from './src/App'; // Your main App component
import { name as appName } from './app.json';
import notifee, { EventType } from '@notifee/react-native';
import { NotificationService } from './src/notifications/NotificationService'; // Adjust path if needed

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;
  console.log('Background event received:', { type: EventType[type], detail });

  if (type === EventType.PRESS) {
    console.log('User pressed notification in background', notification);
    NotificationService.handleNotificationTap(notification); // Reuse tap handler logic
    // Optional: Perform background tasks based on notification data
    if (notification?.id) {
       await notifee.cancelNotification(notification.id); // Remove notification after tap
    }
  }
  // Add other background event handling if needed (e.g., ACTION_PRESS)
});

// Register the main component
AppRegistry.registerComponent(appName, () => App);
