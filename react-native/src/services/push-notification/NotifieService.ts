/**
 * @file NotificationService.ts
 * Manages push notifications using Notifee for enhanced display/interaction
 * and Firebase Cloud Messaging (FCM) for receiving remote messages (APNS on iOS).
 *
 * Designed as a static class for easy access across the application.
 ** --- DETAILED INTERVIEW QUESTIONS ---
*
* **Core Concepts & Architecture:**
* - Why use a static class here? What are the alternatives (e.g., singleton instance, React Context, dependency injection)? Discuss the pros and cons of each in the context of a notification service.
* - Explain the separation of concerns: Why use Notifee *alongside* FCM/APNS? What specific features does Notifee provide that FCM/APNS don't directly offer on the client-side? (Rich notifications, actions, scheduling, channels, foreground display control).
* - Describe the typical flow of a push notification from a backend server to this app. Mention APNS, FCM, device tokens, and the role of this service.
* - How does background/quit state message handling differ fundamentally from foreground handling? Why does the setup need to be in `index.js`? (App context availability).
* - Discuss the importance of idempotency in methods like `createDefaultChannel`.
* - How would you manage different notification environments (dev, staging, prod)? (Different FCM projects, backend configuration).
*
* **Permissions & Setup:**
* - Explain the differences in notification permissions between iOS and Android (especially Android 13+). How does `requestPermissions` handle this?
* - What happens if the user denies permissions? How should the app behave? How can you guide the user to enable permissions later in settings?
* - What are Android Notification Channels? Why are they mandatory? When would you create multiple channels? (Different sound/importance/types of notifications).
* - What could cause the `bootstrap` method to fail? How would you implement more robust error handling or reporting for bootstrap failures? (e.g., reporting to an error service, retrying).
*
* **Message Handling & Interaction:**
* - Differentiate between "notification" messages and "data-only" messages from FCM. How does this service handle each in the foreground vs. background?
* - Explain the logic in `handleNotificationTap`. How would you implement robust navigation based on notification data? (Deep linking libraries like `react-navigation/native`, URL schemes). What are the challenges? (App state, navigation stack).
* - How would you handle different *types* of notifications within the app? (e.g., chat message vs. promotion vs. system alert). Consider payload structure, channel usage, and tap actions.
* - What are notification actions (e.g., "Reply", "Mark as Read")? How would you implement and handle them using Notifee? (Foreground and background event listeners).
*
* **Token Management & Security:**
* - What is an FCM token (or APNS token)? Why is it needed? How and when is it generated or refreshed?
* - What are the security implications of handling FCM tokens? How and where should they be stored securely on the backend? Why is sending it directly from the client potentially risky without authentication?
* - How should the app handle token refreshes (`onTokenRefresh`)? What happens if the backend doesn't receive the updated token?
*
* **State Management & UI Integration:**
* - How would you integrate notification state (e.g., permissions granted, token available, unread count) with the rest of the app's state management (React Context, Redux, Zustand)?
* - How can you display an in-app notification banner when a message arrives while the user is actively using the app, instead of (or in addition to) a system notification?
*
* **Advanced Features & Alternatives:**
* - Explain the use case for scheduled notifications (`scheduleNotification`).
* - How does `cancelNotification` / `cancelAllNotifications` work? When would you use them?
* - Compare and contrast using Notifee+FCM with other services like Expo Notifications or OneSignal. What are the trade-offs? (Ease of setup, features, vendor lock-in, cost).
*
* **Testing:**
* - How would you test this `NotificationService`? Discuss strategies for unit testing (mocking `@notifee/react-native`, `@react-native-firebase/messaging`) and end-to-end testing (testing real notifications on devices/simulators).
* - How would you test different notification scenarios (foreground, background, quit state, different payloads, tap actions)?

 */

import notifee, {
  AndroidChannel,
  AndroidImportance,
  AndroidVisibility,
  EventType,
  Notification,
  TimestampTrigger,
  TriggerType,
  Event, // Added for explicit typing
  AuthorizationStatus, // Added for explicit typing
  AndroidStyle, // Added for potential use
} from '@notifee/react-native';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';

// Constants for the default notification channel
const DEFAULT_CHANNEL_ID = 'default_channel';
const DEFAULT_CHANNEL_NAME = 'Default Notifications';

export class NotificationService {
  // --- Core Setup and Initialization ---

  /**
   * Initializes the notification service: requests permissions, creates channels,
   * sets up listeners, and registers for remote messages.
   * Should be called early in the app lifecycle (e.g., App.tsx).
   * Interview Question: Is it safe to call bootstrap multiple times? Should it be?
   */
  static async bootstrap(): Promise<void> {
    console.log('NotificationService (Notifee/FCM): Bootstrapping...');
    try {
      await NotificationService.requestPermissions();
      await NotificationService.createDefaultChannel(); // Ensure channel exists before displaying notifications
      NotificationService.setupForegroundListeners();

      // IMPORTANT: Background/Quit state message handling MUST be set up outside React components,
      // typically in index.js. See example comments at the end of this file.
      // messaging().setBackgroundMessageHandler(async remoteMessage => {...}); // Handles FCM messages when app is in background/quit
      // notifee.onBackgroundEvent(async ({ type, detail }) => {...}); // Handles Notifee events (like taps) when app is in background/quit

      await NotificationService.registerDeviceForMessaging();
      console.log('NotificationService (Notifee/FCM): Bootstrap complete.');
    } catch (error) {
      console.error('NotificationService (Notifee/FCM): Bootstrap failed.', error);
      // Question: How should bootstrap failures be handled? Should the app proceed? Alert user? Retry? Log remotely?
    }
  }

  /**
   * Requests notification permissions from the user (iOS requires explicit permission, Android 13+ too).
   * Interview Question: What do the different `AuthorizationStatus` values mean on iOS? (DENIED, AUTHORIZED, PROVISIONAL, EPHEMERAL)
   * Interview Question: How would you handle the case where permissions are initially granted but later revoked by the user in settings?
   */
  static async requestPermissions(): Promise<boolean> {
    console.log('NotificationService (Notifee/FCM): Requesting permissions...');
    try {
      // requestPermission is essential for iOS and Android 13+.
      const settings = await notifee.requestPermission();
      // Check if authorized or provisional (iOS specific, allows quiet delivery)
      const granted = settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
      console.log(
        'NotificationService (Notifee/FCM): Permission status:',
        settings.authorizationStatus, // Log the specific status
        'Granted:', granted
      );
      if (!granted) {
          console.warn('NotificationService (Notifee/FCM): Permissions not granted.');
          // Question: Should we inform the user why notifications are needed if denied?
      }
      return granted;
    } catch (error) {
      console.error('NotificationService (Notifee/FCM): Failed to request permissions.', error);
      return false;
    }
  }

  /**
   * Creates the default notification channel required for Android 8+.
   * Idempotent: safe to call even if the channel already exists.
   * Interview Question: Explain the different `AndroidImportance` levels and their effects. When would you use levels other than HIGH?
   * Interview Question: What other channel properties can be configured (e.g., vibration pattern, lights, sound)?
   */
  static async createDefaultChannel(): Promise<void> {
    console.log(`NotificationService (Notifee/FCM): Ensuring channel '${DEFAULT_CHANNEL_ID}' exists...`);
    try {
      const channel: AndroidChannel = {
        id: DEFAULT_CHANNEL_ID,
        name: DEFAULT_CHANNEL_NAME,
        importance: AndroidImportance.HIGH, // Ensure notifications pop up visually
        visibility: AndroidVisibility.PUBLIC, // Show full content on lock screen (configurable)
        sound: 'default', // Optional: use default notification sound or provide custom sound file name
        // vibration: true, // Optional: enable vibration
        // vibrationPattern: [300, 500], // Optional: custom vibration pattern
        // bypassDnd: true, // Optional: Allow notification even in Do Not Disturb mode (use with caution)
      };
      await notifee.createChannel(channel);
      console.log(`NotificationService (Notifee/FCM): Channel '${DEFAULT_CHANNEL_ID}' created or already exists.`);
    } catch (error) {
      console.error(`NotificationService (Notifee/FCM): Failed to create channel '${DEFAULT_CHANNEL_ID}'.`, error);
      // Question: How critical is channel creation failure? Should it block notifications? What's the impact? (Notifications might not show on Android 8+)
    }
  }

  // --- Event Handling ---

  /**
   * Sets up listeners for Notifee events and FCM messages when the app is in the foreground.
   * Interview Question: Why separate listeners for Notifee events (`onForegroundEvent`) and FCM messages (`onMessage`)?
   */
  static setupForegroundListeners(): void {
    console.log('NotificationService (Notifee/FCM): Setting up foreground event listener...');

    // Listen for Notifee events (interactions with notifications displayed by Notifee)
    const unsubscribeNotifee = notifee.onForegroundEvent((event: Event) => {
      console.log('NotificationService (Notifee/FCM): Foreground Notifee event received:', { type: EventType[event.type], detail: event.detail });
      switch (event.type) {
        case EventType.DISMISSED:
          console.log('User dismissed notification:', event.detail.notification?.id);
          // Question: When might you want to track dismissals?
          break;
        case EventType.PRESS:
          console.log('User pressed notification:', event.detail.notification?.id);
          NotificationService.handleNotificationTap(event.detail.notification);
          break;
        case EventType.ACTION_PRESS:
          console.log('User pressed action:', event.detail.pressAction?.id, 'on notification:', event.detail.notification?.id);
          // Question: How would you implement logic based on the action ID?
          // Example: if (event.detail.pressAction?.id === 'reply') { /* handle reply */ }
          break;
        // Handle other event types if needed (e.g., DELIVERED)
      }
    });

    // Listen for incoming FCM messages when the app is in the foreground
    const unsubscribeFCM = messaging().onMessage(NotificationService.handleForegroundFcmMessage);

    console.log('NotificationService (Notifee/FCM): Foreground listeners set up.');

    // Question: How would you handle cleanup of these listeners if the service was instance-based instead of static?
    // Typically return unsubscribe functions from bootstrap or have a dedicated shutdown method.
    // For static, they generally live for the app's lifetime.
  }

  /**
   * Handles incoming FCM messages when the app is in the foreground.
   * Typically displays the notification using Notifee, as FCM alone doesn't show foreground notifications by default.
   * @param remoteMessage - The FCM message payload.
   * Interview Question: Should *all* foreground messages trigger a visible system notification? What are alternatives? (e.g., update a badge count, show an in-app banner, silently update data).
   * Interview Question: How would you parse and use custom data from `remoteMessage.data`?
   */
  static async handleForegroundFcmMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
    console.log('NotificationService (Notifee/FCM): FCM message received in foreground:', JSON.stringify(remoteMessage, null, 2));

    // Check if the message contains a notification payload (title, body)
    // Note: iOS might receive notification payload here, Android often doesn't for foreground unless specifically configured.
    // Data payload (`remoteMessage.data`) is usually the reliable way.
    const notificationPayload = remoteMessage.notification;
    const dataPayload = remoteMessage.data || {};

    // Decide whether to display a notification. Often based on data payload.
    // Example: Only show if it's a chat message, not a silent data sync.
    const shouldDisplay = dataPayload.displayForeground !== 'false'; // Example custom flag

    if (shouldDisplay) {
        // Extract title/body preferably from data, fallback to notification payload
        const title = dataPayload.title || notificationPayload?.title || 'New Message';
        const body = dataPayload.body || notificationPayload?.body || '';

        console.log(`NotificationService (Notifee/FCM): Displaying foreground notification: "${title}"`);
        await NotificationService.showLocalNotification(
            title,
            body,
            dataPayload // Pass along data for tap handling
        );
    } else {
        console.log('NotificationService (Notifee/FCM): Received foreground FCM message, but configured not to display.');
        // Question: How to handle data-only messages received in the foreground? (e.g., update app state, sync data)
    }
  }

  /**
   * Centralized logic for handling a notification tap event.
   * Can be called from foreground or background event handlers (`onForegroundEvent`, `onBackgroundEvent`, `getInitialNotification`).
   * @param notification - The Notifee notification object (optional).
   * Interview Question: How can you ensure the navigation logic works correctly regardless of whether the app was in the foreground, background, or quit state when the notification was tapped? (Consider initial app load vs. running app).
   * Interview Question: What are potential issues with navigation based on notification data? (e.g., navigating to a screen that requires login, handling stale data).
   */
  static handleNotificationTap(notification: Notification | undefined): void {
    console.log('NotificationService (Notifee/FCM): Handling notification tap...');
    if (!notification) {
      console.warn('NotificationService (Notifee/FCM): handleNotificationTap called with undefined notification.');
      return;
    }

    console.log(`NotificationService (Notifee/FCM): Tapped notification ID: ${notification.id}, Data:`, notification.data);

    // --- Navigation logic placeholder ---
    // This is where you'd integrate with your navigation library (e.g., React Navigation)
    // Use deep linking configurations for robust navigation.
    if (notification.data) {
      const screen = notification.data.screen as string | undefined; // e.g., 'Chat'
      const params = notification.data.params ? JSON.parse(notification.data.params as string) : undefined; // e.g., { chatId: '123' }

      if (screen) {
        console.log(`NotificationService (Notifee/FCM): Attempting navigation to screen: ${screen} with params:`, params);
        // import { navigate } from './RootNavigation'; // Assuming a navigation helper
        // navigate(screen, params);
        // Consider checking if the app is ready for navigation, especially on initial launch.
      } else {
        console.log('NotificationService (Notifee/FCM): No specific navigation screen defined in notification data.');
      }
    } else {
      console.log('NotificationService (Notifee/FCM): Notification tapped, but no data payload found for navigation.');
    }

    // Optional: Cancel the notification after it's tapped
    // notifee.cancelNotification(notification.id).catch(err => console.error("Failed to cancel notification:", err));
    // Question: Should you always cancel the notification on tap? Why or why not? (Depends on UX, maybe keep for reference).
  }

  // --- Displaying Notifications ---

  /**
   * Displays a notification immediately using Notifee. Useful for foreground messages or local reminders.
   * @param title - The notification title.
   * @param body - The notification body text.
   * @param data - Optional data payload for tap handling or actions.
   * @param options - Optional Notifee specific options (e.g., android actions, ios attachments).
   * Interview Question: Explain some useful Android-specific options (e.g., `style`, `actions`, `largeIcon`, `color`).
   * Interview Question: Explain some useful iOS-specific options (e.g., `attachments`, `categoryId` for actions, `interruptionLevel`).
   */
  static async showLocalNotification(
      title: string,
      body: string,
      data?: { [key: string]: any }, // Allow any data type, often strings from FCM
      options?: { android?: object, ios?: object } // Allow passing extra Notifee options
  ): Promise<string | undefined> {
    console.log('NotificationService (Notifee/FCM): Displaying local notification...');
    try {
      // Ensure data values are strings if they originated from FCM data payload
      const stringData = data ? Object.entries(data).reduce((acc, [key, value]) => {
          acc[key] = typeof value === 'string' ? value : JSON.stringify(value);
          return acc;
      }, {} as { [key: string]: string }) : undefined;

      const notificationId = await notifee.displayNotification({
        title: title,
        body: body,
        data: stringData, // Attach stringified data for later use
        android: {
          channelId: DEFAULT_CHANNEL_ID, // Must match a created channel
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default', // Required for tap events to work correctly
            // launchActivity: 'default', // Optional: Ensure app opens on tap
          },
          // Example: Add actions
          // actions: [
          //   { title: 'Mark as Read', pressAction: { id: 'mark-read' } },
          //   { title: 'Reply', pressAction: { id: 'reply' }, input: true }, // Input action
          // ],
          // Example: Big text style
          // style: { type: AndroidStyle.BIGTEXT, text: body },
          // Example: Inbox style
          // style: { type: AndroidStyle.INBOX, lines: ['Line 1', 'Line 2', 'Line 3'] },
          // largeIcon: 'https://my-cdn.com/user-avatars/user-1.png', // URL or require('./local-image.png')
          // color: '#007bff', // Accent color
          // visibility: AndroidVisibility.PRIVATE, // Control lock screen visibility
          ...options?.android, // Merge custom options
        },
        ios: {
          sound: 'default',
          // Optional: Set badge count, category for actions, etc.
          // badgeCount: await notifee.getBadgeCount() + 1, // Example: Increment badge
          // categoryId: 'message_actions', // Must match a category set up with setNotificationCategories
          // interruptionLevel: 'timeSensitive', // iOS 15+ interruption levels
          // attachments: [{ url: 'https://my-cdn.com/image.jpg' }], // Image/Video attachments
          ...options?.ios, // Merge custom options
        },
      });
      console.log(`NotificationService (Notifee/FCM): Notification displayed successfully with ID: ${notificationId}`);
      return notificationId;
    } catch (error) {
      console.error('NotificationService (Notifee/FCM): Failed to display notification.', error);
      // Question: How should display failures be communicated to the user or logged? (Error reporting service)
      return undefined;
    }
  }

  // --- FCM Integration ---

  /**
   * Registers the device with FCM, retrieves the token, and sets up token refresh listener.
   * Interview Question: On iOS, what additional steps are needed before `getToken` works? (`registerDeviceForRemoteMessages`, potentially `requestPermissions`).
   * Interview Question: Why might `getToken` fail? (Network issues, invalid Firebase config, simulator limitations).
   */
  static async registerDeviceForMessaging(): Promise<string | null> {
    console.log('NotificationService (Notifee/FCM): Registering device for FCM...');
    let fcmToken: string | null = null;
    try {
      // On iOS, need to register for remote messages first. Usually automatic on Android.
      if (Platform.OS === 'ios' && !messaging().isDeviceRegisteredForRemoteMessages) {
        await messaging().registerDeviceForRemoteMessages();
        console.log('NotificationService (Notifee/FCM): Registered for remote messages (iOS).');
      }

      // Request permission for FCM specifically on iOS (might be redundant if Notifee permission already granted, but good practice)
      // const authStatus = await messaging().requestPermission();
      // const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      // console.log('NotificationService (Notifee/FCM): FCM Authorization status:', authStatus);

      // Get the FCM token
      // Note: On iOS, this returns the APNs token. FCM SDK handles the mapping.
      fcmToken = await messaging().getToken();
      console.log('NotificationService (Notifee/FCM): FCM Token obtained:', fcmToken);

      // --- Send token to backend ---
      // Question: Where and how should this token be sent to the backend?
      // - Needs user authentication context (who does this token belong to?)
      // - Should be sent over HTTPS POST request.
      // - Handle potential errors during sending (retry logic?).
      // - Send on initial registration AND on refresh.
      // Placeholder: await sendTokenToBackend(fcmToken);
      // -----------------------------

      // Listen for token refreshes (rare, but important)
      messaging().onTokenRefresh(async (newToken) => {
        console.log('NotificationService (Notifee/FCM): FCM Token refreshed:', newToken);
        // Question: How to handle token refresh? (Update backend immediately)
        // Placeholder: await sendTokenToBackend(newToken);
      });

      return fcmToken;

    } catch (error) {
      console.error('NotificationService (Notifee/FCM): Failed to register for FCM or get token.', error);
      // Question: How critical is FCM registration failure? (App won't receive push notifications). How to handle? (Retry later, inform user).
      return null;
    }
  }

  // --- Optional: Advanced Features (Example) ---

  /**
   * Schedules a notification to be displayed at a future time using Notifee.
   * @param title - Notification title.
   * @param body - Notification body.
   * @param timestamp - The future time (in milliseconds since epoch) to trigger the notification.
   * @param data - Optional data payload.
   * Interview Question: What are the limitations of scheduled notifications? (e.g., number limits, battery optimization effects).
   * Interview Question: What is `TriggerType.INTERVAL` used for?
   */
  static async scheduleNotification(title: string, body: string, timestamp: number, data?: { [key: string]: string }): Promise<string | undefined> {
    console.log(`NotificationService (Notifee/FCM): Scheduling notification for ${new Date(timestamp).toISOString()}...`);
    try {
      // Ensure timestamp is in the future
      if (timestamp <= Date.now()) {
          console.warn('NotificationService (Notifee/FCM): Schedule timestamp is in the past.');
          // return undefined; // Or schedule immediately? Depends on requirements.
      }

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: timestamp,
        // Optional: repeatFrequency, alarmManager (Android specific for precision)
        // alarmManager: { allowWhileIdle: true }, // Example: Use AlarmManager for more reliable delivery even in Doze mode
      };

      const notificationId = await notifee.createTriggerNotification(
        {
          title,
          body,
          data,
          android: { channelId: DEFAULT_CHANNEL_ID, pressAction: { id: 'default' } },
          ios: { sound: 'default' },
        },
        trigger,
      );
      console.log(`NotificationService (Notifee/FCM): Notification scheduled with ID: ${notificationId}`);
      return notificationId;
    } catch (error) {
      console.error('NotificationService (Notifee/FCM): Failed to schedule notification.', error);
      return undefined;
    }
  }

  /**
   * Cancels a specific scheduled or displayed notification using Notifee.
   * @param notificationId - The ID of the notification to cancel.
   * Interview Question: How would you get the IDs of currently scheduled/displayed notifications to cancel them selectively? (`notifee.getTriggerNotificationIds()`, `notifee.getDisplayedNotifications()`)
   */
  static async cancelNotification(notificationId: string): Promise<void> {
    console.log(`NotificationService (Notifee/FCM): Cancelling notification ID: ${notificationId}`);
    try {
      await notifee.cancelNotification(notificationId);
      // This cancels both displayed and trigger notifications with the given ID.
      console.log(`NotificationService (Notifee/FCM): Notification ${notificationId} cancelled.`);
    } catch (error) {
      console.error(`NotificationService (Notifee/FCM): Failed to cancel notification ${notificationId}.`, error);
    }
  }

  /**
   * Cancels all displayed or scheduled notifications for this app using Notifee.
   * Interview Question: When might cancelling *all* notifications be useful or dangerous? (Useful: User logs out. Dangerous: Might cancel important reminders).
   */
  static async cancelAllNotifications(): Promise<void> {
    console.log('NotificationService (Notifee/FCM): Cancelling all notifications...');
    try {
      // Cancels all trigger notifications
      await notifee.cancelAllNotifications();
      // You might also want to clear displayed notifications separately if needed,
      // although cancelAllNotifications often covers both based on documentation/behavior.
      // await notifee.cancelDisplayedNotifications(); // More specific if needed
      console.log('NotificationService (Notifee/FCM): All notifications cancelled.');
    } catch (error) {
      console.error('NotificationService (Notifee/FCM): Failed to cancel all notifications.', error);
    }
  }

   /**
   * Gets the initial notification if the app was opened from a quit state by tapping a notification.
   * Should be called once, early in the app lifecycle (e.g., in App.tsx useEffect).
   * Interview Question: Why is this needed in addition to background/foreground listeners?
   */
  static async getInitialNotification(): Promise<Notification | null> {
    console.log('NotificationService (Notifee/FCM): Checking for initial notification...');
    try {
        const initialNotification = await notifee.getInitialNotification();
        if (initialNotification) {
            console.log('NotificationService (Notifee/FCM): App opened from quit state via notification:', initialNotification.notification.id);
            // It's common practice to handle the tap immediately here
            // NotificationService.handleNotificationTap(initialNotification.notification);
            return initialNotification.notification;
        } else {
            console.log('NotificationService (Notifee/FCM): App not opened via notification.');
            return null;
        }
    } catch (error) {
        console.error('NotificationService (Notifee/FCM): Error getting initial notification.', error);
        return null;
    }
  }

  /**
   * iOS specific: Sets up notification categories for interactive actions.
   * Must be called before displaying notifications that use these categories.
   * Interview Question: Where should `setNotificationCategories` be called? (Typically during bootstrap).
   */
  static async setupIosCategories(): Promise<void> {
      if (Platform.OS !== 'ios') return;
      console.log('NotificationService (Notifee/FCM): Setting up iOS notification categories...');
      try {
          await notifee.setNotificationCategories([
              {
                  id: 'message_actions',
                  actions: [
                      { id: 'reply', title: 'Reply', input: true }, // Requires iOS 15+ for input
                      { id: 'mark-read', title: 'Mark as Read', destructive: false, foreground: false }, // Background action
                      { id: 'archive', title: 'Archive', destructive: true, foreground: false }, // Destructive background action
                  ],
                  // Options like hiddenPreviewsShowTitle, hiddenPreviewsShowSubtitle
              },
              // Add other categories as needed
          ]);
          console.log('NotificationService (Notifee/FCM): iOS categories set up.');
      } catch (error) {
          console.error('NotificationService (Notifee/FCM): Failed to set iOS categories.', error);
      }
  }

  /**
   * Manages the badge count on the app icon (iOS specific, some Android launchers support).
   * Interview Question: How would you typically determine the correct badge count? (Usually derived from app state, e.g., unread messages count from backend/local state).
   */
  static async setBadgeCount(count: number): Promise<void> {
      console.log(`NotificationService (Notifee/FCM): Setting badge count to ${count}`);
      try {
          await notifee.setBadgeCount(count);
          console.log(`NotificationService (Notifee/FCM): Badge count set.`);
      } catch (error) {
          console.error(`NotificationService (Notifee/FCM): Failed to set badge count.`, error);
      }
  }

  static async getBadgeCount(): Promise<number> {
      try {
          const count = await notifee.getBadgeCount();
          console.log(`NotificationService (Notifee/FCM): Current badge count is ${count}`);
          return count;
      } catch (error) {
          console.error(`NotificationService (Notifee/FCM): Failed to get badge count.`, error);
          return 0;
      }
  }
}


