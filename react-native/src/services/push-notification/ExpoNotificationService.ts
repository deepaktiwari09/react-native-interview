/**
 * @file ExpoNotificationService.ts
 * Manages push notifications using the `expo-notifications` library.
 * Suitable for projects within the Expo managed workflow or bare React Native projects with `expo-modules` installed.
 *
 * Designed as a static class for easy access.
 *
 * --- DETAILED INTERVIEW QUESTIONS ---\
 *
 * **Core Concepts & Architecture (Expo Specific):**
 * - What is Expo Application Services (EAS) Build and EAS Submit? How do they relate to push notifications? (Building binaries with native credentials).
 * - What is an Expo Push Token? How does it differ from a native FCM or APNS token? How does Expo's push service use it? (Expo manages native tokens internally).
 * - Explain the pros and cons of using `expo-notifications` compared to directly using `react-native-firebase/messaging` + `notifee` or OneSignal. (Pros: Simpler setup in Expo Go/managed workflow, unified API. Cons: Less control over native features than Notifee, potential vendor lock-in, requires Expo infrastructure).
 * - Can you use `expo-notifications` in a bare React Native project? What setup is required? (`expo-modules` installation and configuration).
 * - How does Expo handle the differences between APNS and FCM internally?
 *
 * **Permissions & Setup:**
 * - How does `requestPermissionsAsync` differ between iOS and Android? What permissions are actually being requested?
 * - What are Android Notification Channels in the context of `expo-notifications`? How do you manage them (`setNotificationChannelAsync`)? Why is it important?
 * - What happens if `getExpoPushTokenAsync` fails? What are common reasons? (Missing `google-services.json`/`GoogleService-Info.plist`, incorrect configuration in `app.json`/`app.config.js`, network issues, simulator limitations).
 * - Where should the `projectId` for `getExpoPushTokenAsync` come from? (`app.json`/`app.config.js` or EAS project).
 *
 * **Message Handling & Interaction:**
 * - Explain the difference between `addNotificationReceivedListener` and `addNotificationResponseReceivedListener`. When is each triggered?
 * - How do you handle notifications received while the app is in the foreground vs. background/quit state? (`setNotificationHandler` is crucial for foreground behavior).
 * - How do you implement navigation when a user taps a notification? Where does the relevant data come from (`response.notification.request.content.data`)?
 * - How would you customize the appearance and behavior of foreground notifications? (`handleNotification: async () => ({ shouldShowAlert: true, ... })`).
 * - Can you create interactive notifications (with buttons/actions) using `expo-notifications`? How? (`setNotificationCategoryAsync`).
 *
 * **Token Management:**
 * - How and when should the Expo Push Token be sent to your backend server? What security considerations apply?
 * - Does the Expo Push Token expire or change? How would you handle updates? (Generally stable, but should be refreshed periodically or on major OS/app updates).
 *
 * **Advanced Features & Alternatives:**
 * - How do you schedule local notifications using `scheduleNotificationAsync`? What are the different trigger types?
 * - How do you manage the badge count on iOS using `getBadgeCountAsync` and `setBadgeCountAsync`?
 * - Compare Expo's push notification service with sending pushes directly via FCM/APNS or using third-party services like OneSignal or Knock. What are the trade-offs in terms of infrastructure, cost, and features?
 *
 * **Testing:**
 * - How can you test push notifications in Expo Go? What are the limitations? (Uses Expo's development credentials, token is specific to Expo Go).
 * - How do you test notifications in development builds or production builds? (Using your own credentials, Expo's Push Notification Tool, or your backend).
 * - How would you mock `expo-notifications` for unit testing?
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants'; // Often used to get projectId

// --- Configuration ---
// Configure foreground notification handling (how the app behaves when a notification arrives while it's open)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // Show the notification alert
    shouldPlaySound: true, // Play a sound
    shouldSetBadge: true, // Update the badge count (iOS)
  }),
});

const DEFAULT_CHANNEL_ID_EXPO = 'expo_default_channel';

export class ExpoNotificationService {
  // --- Core Setup and Initialization ---\

  /**
   * Initializes the notification service: requests permissions, configures Android channel,
   * sets up listeners, and gets the Expo push token.
   * Should be called early in the app lifecycle.
   * Interview Question: Why is calling this in a top-level component's useEffect hook a common pattern?
   */
  static async bootstrap(): Promise<string | null> {
    console.log('ExpoNotificationService: Bootstrapping...');
    let token: string | null = null;
    try {
      const permissionsGranted = await ExpoNotificationService.requestPermissions();
      if (permissionsGranted) {
        await ExpoNotificationService.configureAndroidChannel();
        token = await ExpoNotificationService.registerForPushNotificationsAsync();
        ExpoNotificationService.setupNotificationListeners();
        console.log('ExpoNotificationService: Bootstrap complete. Token:', token);
      } else {
        console.warn('ExpoNotificationService: Permissions not granted. Push notifications disabled.');
      }
      return token;
    } catch (error) {
      console.error('ExpoNotificationService: Bootstrap failed.', error);
      // Question: How to handle bootstrap failures robustly? (Retry logic, error reporting)
      return null;
    }
  }

  /**
   * Requests notification permissions from the user.
   * Interview Question: What are the different permission statuses returned by `getPermissionsAsync` and `requestPermissionsAsync`?
   */
  static async requestPermissions(): Promise<boolean> {
    console.log('ExpoNotificationService: Requesting permissions...');
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        // On iOS, this prompts the user. On Android, it returns the current status unless permissions were never requested.
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: true, // iOS 13+
            // allowCriticalAlerts: false, // Requires special entitlement
            // provideAppNotificationSettings: false, // Show in-app settings link
          },
          // Android permissions are generally granted by default, except for Android 13+ POST_NOTIFICATIONS
          // which is handled implicitly by requestPermissionsAsync if needed.
        });
        finalStatus = status;
      }

      const granted = finalStatus === 'granted';
      console.log(`ExpoNotificationService: Permission status: ${finalStatus}. Granted: ${granted}`);
      if (!granted) {
          console.warn('ExpoNotificationService: User denied notification permissions.');
          // Question: How should the app guide the user to enable permissions later if denied? (Link to settings)
      }
      return granted;
    } catch (error) {
      console.error('ExpoNotificationService: Failed to request permissions.', error);
      return false;
    }
  }

  /**
   * Configures the default notification channel for Android (required for Android 8+).
   * Idempotent: safe to call multiple times.
   * Interview Question: Explain the importance levels (`Notifications.AndroidImportance`). When use MAX vs HIGH vs DEFAULT?
   */
  static async configureAndroidChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      console.log(`ExpoNotificationService: Ensuring Android channel '${DEFAULT_CHANNEL_ID_EXPO}' exists...`);
      try {
        await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID_EXPO, {
          name: 'Default Expo Notifications',
          importance: Notifications.AndroidImportance.MAX, // Make notifications highly visible
          vibrationPattern: [0, 250, 250, 250], // Optional: Vibration pattern
          lightColor: '#FF231F7C', // Optional: LED color
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          sound: 'default', // Optional: Default sound
          // bypassDnd: false, // Optional: Respect Do Not Disturb
        });
        console.log(`ExpoNotificationService: Android channel '${DEFAULT_CHANNEL_ID_EXPO}' configured.`);
      } catch (error) {
        console.error(`ExpoNotificationService: Failed to configure Android channel '${DEFAULT_CHANNEL_ID_EXPO}'.`, error);
        // Question: What happens if channel setup fails? (Notifications might not show on Android 8+)
      }
    }
  }

  /**
   * Registers the device for push notifications and retrieves the Expo Push Token.
   * Interview Question: What information is needed in `app.json`/`app.config.js` for this to work? (Firebase config for Android, APNS setup for iOS, `expo.android.useNextNotificationsApi`, `expo.ios.usesPushNotifications`).
   * Interview Question: Why is passing the `projectId` important, especially in development or multi-project setups?
   */
  static async registerForPushNotificationsAsync(): Promise<string | null> {
    console.log('ExpoNotificationService: Getting Expo Push Token...');
    try {
      // Ensure we have device info (especially for simulators)
      if (!Constants.isDevice) {
        console.warn('ExpoNotificationService: Must use physical device for Push Notifications (unless using EAS Build).');
        // You might still get a token on simulators, but it won't receive pushes.
      }

      // Get the projectId from expo-constants (app.config.js -> extra.eas.projectId or expo.extra.eas.projectId)
      // Fallback or alternative: Hardcode if necessary, but config is better.
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId && Constants.isDevice) {
          // Only warn on devices, as simulators might not have it easily accessible depending on setup.
          console.warn('ExpoNotificationService: EAS projectId not found in app.json/app.config.js under extra.eas.projectId. Push token retrieval might fail or use a default project.');
      }

      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('ExpoNotificationService: Expo Push Token obtained:', token);

      // --- Send token to backend ---
      // Question: How should this token be associated with the logged-in user on the backend?
      // Placeholder: await sendExpoTokenToBackend(token);
      // ----------------------------

      return token;
    } catch (error: any) {
      console.error('ExpoNotificationService: Failed to get Expo Push Token.', error);
      // Log more details if available
      if (error.message) {
          console.error('Error message:', error.message);
      }
      // Question: How to handle token retrieval failure? (Retry, inform user, disable push features)
      return null;
    }
  }

  // --- Event Handling ---\

  /**
   * Sets up listeners for incoming notifications and user interactions with notifications.
   * Interview Question: Why are there two separate listeners (`addNotificationReceivedListener` and `addNotificationResponseReceivedListener`)?
   */
  static setupNotificationListeners(): void {
    console.log('ExpoNotificationService: Setting up notification listeners...');

    // Listener for when a notification is received while the app is running
    const notificationReceivedListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('ExpoNotificationService: Notification Received (Foreground/Background):', JSON.stringify(notification, null, 2));
      // You can update app state here based on the received notification, e.g., refresh data, update badge count internally.
      // Example: updateUnreadCount(notification.request.content.data?.unreadCount);
    });

    // Listener for when a user interacts with a notification (taps it)
    // Works when app is foregrounded, backgrounded, or even launched from quit state by the notification tap.
    const notificationResponseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('ExpoNotificationService: Notification Response Received (User Interaction):', JSON.stringify(response, null, 2));
      ExpoNotificationService.handleNotificationTap(response);
    });

    console.log('ExpoNotificationService: Notification listeners set up.');

    // Return cleanup functions (important if using in React components)
    // For a static class, cleanup might be less critical unless you have a specific shutdown scenario.
    // return () => {
    //   Notifications.removeNotificationSubscription(notificationReceivedListener);
    //   Notifications.removeNotificationSubscription(notificationResponseListener);
    // };
  }

  /**
   * Centralized logic for handling a notification tap event.
   * @param response - The notification response object from the listener.
   * Interview Question: How would you implement robust deep linking based on `response.notification.request.content.data`? (Using react-navigation linking configuration).
   */
  static handleNotificationTap(response: Notifications.NotificationResponse): void {
    console.log('ExpoNotificationService: Handling notification tap...');
    const notificationData = response.notification.request.content.data;
    console.log('ExpoNotificationService: Tapped notification data:', notificationData);

    // --- Navigation logic placeholder ---
    if (notificationData && typeof notificationData === 'object') {
      const screen = notificationData.screen as string | undefined; // e.g., 'Chat'
      const params = notificationData.params as object | undefined; // e.g., { chatId: '123' }

      if (screen) {
        console.log(`ExpoNotificationService: Attempting navigation to screen: ${screen} with params:`, params);
        // import { navigate } from './RootNavigation'; // Assuming a navigation helper
        // navigate(screen, params);
      } else {
        console.log('ExpoNotificationService: No specific navigation screen defined in notification data.');
      }
    } else {
      console.log('ExpoNotificationService: Notification tapped, but no structured data payload found.');
    }

    // Optional: Dismiss the notification from the notification center if needed
    // Notifications.dismissNotificationAsync(response.notification.request.identifier);
    // Question: When should you dismiss vs. keep the notification after tap?
  }

  // --- Displaying Notifications (Local) ---\

  /**
   * Schedules a notification for immediate display (local notification).
   * @param title - The notification title.
   * @param body - The notification body text.
   * @param data - Optional data payload for tap handling.
   * @param options - Optional: categoryIdentifier for actions (iOS), channelId (Android override).
   * Interview Question: How does this differ from receiving a push notification from a server?
   */
  static async showLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
    options?: { categoryIdentifier?: string; channelId?: string }
  ): Promise<string | undefined> {
    console.log('ExpoNotificationService: Displaying local notification...');
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body,
          data: data, // Attach data
          sound: 'default', // Or provide custom sound file asset
          // --- Android Specific ---
          vibrate: [0, 250, 250, 250], // Vibration pattern
          priority: Notifications.AndroidNotificationPriority.MAX,
          // sticky: false, // Whether the notification is ongoing
          channelId: options?.channelId || DEFAULT_CHANNEL_ID_EXPO, // Use default or override
          // --- iOS Specific ---
          badge: 1, // Example: set badge count (consider using setBadgeCountAsync for accuracy)
          categoryId: options?.categoryIdentifier, // For interactive notifications
          // subtitle: 'Optional Subtitle',
          // launchImageName: '', // Custom launch image
        },
        trigger: null, // null trigger means schedule immediately
      });
      console.log(`ExpoNotificationService: Local notification scheduled successfully with ID: ${identifier}`);
      return identifier;
    } catch (error) {
      console.error('ExpoNotificationService: Failed to schedule local notification.', error);
      return undefined;
    }
  }

  // --- Optional: Advanced Features ---\

  /**
   * Schedules a notification to be displayed at a future time or interval.
   * @param title - Notification title.
   * @param body - Notification body.
   * @param trigger - The trigger configuration (e.g., { seconds: 60 }, { date: Date }, { channelId: '...', ... }).
   * @param data - Optional data payload.
   * Interview Question: What are the different types of triggers available in `expo-notifications`? (TimeInterval, Date, Daily, Weekly, etc.)
   * Interview Question: What are the limitations on background scheduling, especially on iOS?
   */
  static async scheduleNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data?: Record<string, any>
  ): Promise<string | undefined> {
    console.log(`ExpoNotificationService: Scheduling notification with trigger:`, trigger);
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          // Add other content options as needed
        },
        trigger,
      });
      console.log(`ExpoNotificationService: Notification scheduled successfully with ID: ${identifier}`);
      return identifier;
    } catch (error) {
      console.error('ExpoNotificationService: Failed to schedule notification.', error);
      return undefined;
    }
  }

  /**
   * Cancels a specific scheduled notification.
   * @param identifier - The ID of the notification to cancel.
   */
  static async cancelScheduledNotification(identifier: string): Promise<void> {
    console.log(`ExpoNotificationService: Cancelling scheduled notification ID: ${identifier}`);
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log(`ExpoNotificationService: Notification ${identifier} cancelled.`);
    } catch (error) {
      console.error(`ExpoNotificationService: Failed to cancel notification ${identifier}.`, error);
    }
  }

  /**
   * Cancels all scheduled notifications.
   */
  static async cancelAllScheduledNotifications(): Promise<void> {
    console.log('ExpoNotificationService: Cancelling all scheduled notifications...');
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('ExpoNotificationService: All scheduled notifications cancelled.');
    } catch (error) {
      console.error('ExpoNotificationService: Failed to cancel all notifications.', error);
    }
  }

  /**
   * Gets the current badge count on the app icon (iOS only).
   */
  static async getBadgeCount(): Promise<number> {
    if (Platform.OS === 'ios') {
      try {
        const count = await Notifications.getBadgeCountAsync();
        console.log(`ExpoNotificationService: Current badge count is ${count}`);
        return count;
      } catch (error) {
        console.error('ExpoNotificationService: Failed to get badge count.', error);
        return 0;
      }
    } else {
      console.log('ExpoNotificationService: Badge count is only supported on iOS.');
      return 0;
    }
  }

  /**
   * Sets the badge count on the app icon (iOS only).
   * @param count - The number to set as the badge count.
   * @param options - Optional: `ios` specific options.
   */
  static async setBadgeCount(count: number): Promise<void> {
    if (Platform.OS === 'ios') {
      console.log(`ExpoNotificationService: Setting badge count to ${count}`);
      try {
        await Notifications.setBadgeCountAsync(count);
        console.log(`ExpoNotificationService: Badge count set.`);
      } catch (error) {
        console.error(`ExpoNotificationService: Failed to set badge count.`, error);
      }
    } else {
      console.log('ExpoNotificationService: Badge count is only supported on iOS.');
    }
  }

   /**
   * iOS specific: Sets up notification categories for interactive actions.
   * Must be called before scheduling notifications that use these categories.
   * Interview Question: How do you handle the response when a user interacts with an action button? (Via `addNotificationResponseReceivedListener`, check `response.actionIdentifier`).
   */
  static async setupIosCategories(): Promise<void> {
      if (Platform.OS !== 'ios') return;
      console.log('ExpoNotificationService: Setting up iOS notification categories...');
      try {
          await Notifications.setNotificationCategoryAsync('messageActionsExpo', [ // Example category ID
              {
                  identifier: 'reply', // Action ID
                  buttonTitle: 'Reply',
                  options: {
                      // opensAppToForeground: true, // Default is true
                      // isDestructive: false,
                      // isAuthenticationRequired: false,
                  },
                  textInput: { // Add text input to the action
                      submitButtonTitle: 'Send Reply',
                      placeholder: 'Type your reply...',
                  },
              },
              {
                  identifier: 'markRead',
                  buttonTitle: 'Mark as Read',
                  options: { opensAppToForeground: false, isDestructive: false }, // Background action
              },
              {
                  identifier: 'archive',
                  buttonTitle: 'Archive',
                  options: { opensAppToForeground: false, isDestructive: true }, // Destructive background action
              },
          ]);
          console.log('ExpoNotificationService: iOS categories set up.');
      } catch (error) {
          console.error('ExpoNotificationService: Failed to set iOS categories.', error);
      }
  }
}

// --- Example Usage (in App.tsx or similar) ---
/*
import React, { useEffect, useRef } from 'react';
import { View, Button, Platform } from 'react-native';
import { ExpoNotificationService } from './path/to/ExpoNotificationService'; // Adjust path
import * as Notifications from 'expo-notifications';

const App = () => {
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    ExpoNotificationService.bootstrap().then(token => {
      if (token) {
        console.log("Device Expo Push Token:", token);
        // Send token to your backend here
      }
    });

    // iOS specific: Setup categories if needed
    if (Platform.OS === 'ios') {
        ExpoNotificationService.setupIosCategories();
    }

    // Example of handling responses directly in the component if needed,
    // though the static handler is often sufficient.
    // responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
    //   console.log("App Component: Notification Response:", response);
    //   // Maybe navigate or update state based on response
    // });

    // Cleanup listeners if setting them up directly in component
    // return () => {
    //   if (responseListener.current) {
    //     Notifications.removeNotificationSubscription(responseListener.current);
    //   }
    // };
  }, []);

  const handleTestNotification = () => {
    ExpoNotificationService.showLocalNotification(
      'Expo Test Notification',
      'This is a local test message!',
      { screen: 'Chat', params: { chatId: 'expo-456' } }, // Example data
      Platform.OS === 'ios' ? { categoryIdentifier: 'messageActionsExpo' } : {} // Use category on iOS
    );
  };

  const handleScheduledNotification = () => {
    const trigger: Notifications.DateTriggerInput = {
        date: new Date(Date.now() + 15 * 1000), // 15 seconds from now
    };
    // Or TimeIntervalTriggerInput: { seconds: 15, repeats: false }
    ExpoNotificationService.scheduleNotification(
      'Expo Scheduled Test',
      'This notification was scheduled 15s ago.',
      trigger,
      { type: 'reminder', itemId: 'xyz' }
    );
  };

   const handleBadgeUpdate = async () => {
      if (Platform.OS === 'ios') {
          const currentBadge = await ExpoNotificationService.getBadgeCount();
          await ExpoNotificationService.setBadgeCount(currentBadge + 1);
      } else {
          alert('Badge count is only supported on iOS.');
      }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Show Expo Test Notification" onPress={handleTestNotification} />
      <Button title="Schedule Expo Notification (15s)" onPress={handleScheduledNotification} />
      <Button title="Cancel All Scheduled" onPress={ExpoNotificationService.cancelAllScheduledNotifications} />
      {Platform.OS === 'ios' && <Button title="Increment Badge (iOS)" onPress={handleBadgeUpdate} />}
    </View>
  );
};

export default App;
*/