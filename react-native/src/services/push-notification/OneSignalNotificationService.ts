/**
 * @file OneSignalNotificationService.ts
 * Manages push notifications using the OneSignal SDK (`react-native-onesignal`).
 * OneSignal provides a dashboard, segmentation, A/B testing, and delivery tracking.
 *
 * Designed as a static class for easy access.
 *
 * --- DETAILED INTERVIEW QUESTIONS ---\
 *
 * **Core Concepts & Architecture (OneSignal Specific):**
 * - What is OneSignal? How does it differ from using FCM/APNS directly or Expo Notifications? (Full-service platform vs. lower-level tools).
 * - Explain the concept of a OneSignal App ID. Where do you get it, and why is it essential?
 * - What is a OneSignal Player ID (or Subscription ID)? How does it relate to the device token (FCM/APNS)? How is it used for targeting notifications?
 * - How does OneSignal handle sending notifications to both iOS and Android devices from a single API call or dashboard?
 * - Discuss the pros and cons of using OneSignal. (Pros: Feature-rich dashboard, segmentation, analytics, easier cross-platform sending. Cons: Vendor lock-in, potential cost at scale, another SDK dependency).
 * - What are OneSignal Segments and Data Tags? How can they be used for targeted messaging? How would you set tags from the app? (`OneSignal.sendTag`).
 * - What is an "Outcome" in OneSignal? How can you track conversions or specific user actions triggered by notifications? (`OneSignal.sendOutcome`).
 *
 * **Permissions & Setup:**
 * - How does OneSignal handle notification permissions, especially on iOS? Does `OneSignal.promptForPushNotificationsWithUserResponse` need to be called explicitly? (Often handles it automatically on init, but explicit call provides more control/callback).
 * - What native setup (iOS/Android) is required for the `react-native-onesignal` SDK beyond just `npm install`? (Gradle changes, Info.plist, Podfile, potentially AppDelegate/MainApplication modifications).
 * - How do you configure the OneSignal App ID within the React Native app? (`OneSignal.setAppId`). When should this be called? (Early, before other OneSignal methods).
 *
 * **Message Handling & Interaction:**
 * - Explain the key OneSignal event listeners: `setNotificationWillShowInForegroundHandler`, `setNotificationOpenedHandler`, `setInAppMessageClickHandler`. What does each one do?
 * - How do you prevent OneSignal from automatically displaying a notification when it arrives in the foreground? (`notification.complete()` vs. not calling it in `setNotificationWillShowInForegroundHandler`).
 * - How do you access custom data sent with a OneSignal notification? (Inside the `notification` object, often `notification.additionalData`).
 * - How do you handle navigation when a user taps a OneSignal notification? (Using the `openedEvent.notification.additionalData` in `setNotificationOpenedHandler`).
 * - What are OneSignal In-App Messages? How do they differ from push notifications? How are they triggered and handled? (`setInAppMessageClickHandler`).
 *
 * **User Identification & Data:**
 * - How do you associate a OneSignal Player ID/Subscription ID with your internal user ID? (`OneSignal.setExternalUserId`). Why is this important? (Targeting specific users, data consistency).
 * - When should `setExternalUserId` be called? When should `removeExternalUserId` be called? (Login/Logout).
 * - How do you send custom data tags to OneSignal for segmentation? (`OneSignal.sendTag`, `OneSignal.sendTags`).
 *
 * **Advanced Features & Alternatives:**
 * - What are OneSignal Notification Categories and Action Buttons? How do you define and handle them? (Defined in OneSignal dashboard or API, handled in `setNotificationOpenedHandler` via `openedEvent.action`).
 * - Does OneSignal support local/scheduled notifications from the client-side SDK? (Historically limited, primarily focused on server-sent pushes. Check latest SDK docs, often requires server-side scheduling via API).
 * - How does OneSignal handle badge counts? (Often managed automatically based on received notifications, can be influenced server-side).
 * - Compare OneSignal's feature set (segmentation, A/B testing, analytics) to building similar features yourself on top of FCM/APNS or Expo.
 *
 * **Testing:**
 * - How can you test OneSignal notifications during development? (OneSignal dashboard "Send Test Message", API calls).
 * - How would you test different scenarios like foreground/background/quit states, data payloads, and action button clicks?
 * - Can you easily mock `react-native-onesignal` for unit testing? What are the challenges?
 */

import OneSignal, {
  NotificationReceivedEvent,
  OpenedEvent,
  LogLevel,
} from 'react-native-onesignal';
import { Platform } from 'react-native';

// --- Configuration ---
// Replace with your actual OneSignal App ID
const ONE_SIGNAL_APP_ID = 'YOUR_ONESIGNAL_APP_ID_HERE'; // <<< IMPORTANT: Replace this!

export class OneSignalNotificationService {
  // --- Core Setup and Initialization ---\

  /**
   * Initializes the OneSignal SDK: sets App ID, sets up listeners, and potentially prompts for permissions.
   * Should be called early in the app lifecycle (e.g., App.tsx).
   * Interview Question: Where is the best place to call this initialization logic? Why?
   */
  static bootstrap(): void {
    console.log('OneSignalNotificationService: Bootstrapping...');
    try {
      // --- Optional: Set Log Level ---
      // Recommended: Set to VERBOSE for development, NONE for production.
      OneSignal.setLogLevel(LogLevel.Verbose, LogLevel.None);

      // --- Set App ID ---
      // Must be called before any other OneSignal functions.
      OneSignal.setAppId(ONE_SIGNAL_APP_ID);
      console.log(`OneSignalNotificationService: App ID set to ${ONE_SIGNAL_APP_ID}`);

      // --- Setup Event Handlers ---
      OneSignalNotificationService.setupNotificationHandlers();

      // --- Request Permissions (iOS) ---
      // OneSignal automatically prompts on iOS if needed, but calling explicitly gives more control
      // and allows handling the response (e.g., knowing if the user granted/denied).
      // It's generally recommended to call this after explaining *why* you need permissions.
      // OneSignal.promptForPushNotificationsWithUserResponse(response => {
      //   console.log('OneSignalNotificationService: iOS Permission Prompt Response:', response);
      // });
      // For Android 13+, OneSignal SDK *should* handle the new permission automatically,
      // but double-check documentation for the specific version you use.

      // --- Get Device State ---
      // Useful for retrieving Player ID / Subscription ID after initialization.
      OneSignal.getDeviceState().then(deviceState => {
          console.log("OneSignalNotificationService: Device State:", JSON.stringify(deviceState, null, 2));
          if (deviceState?.userId) {
              console.log("OneSignalNotificationService: Player ID / Subscription ID:", deviceState.userId);
              // You might want to send this deviceState.userId (Player ID) along with your internal user ID
              // to your backend after the user logs in.
          }
      }).catch(error => {
          console.error("OneSignalNotificationService: Error getting device state:", error);
      });


      console.log('OneSignalNotificationService: Bootstrap sequence initiated.');
    } catch (error) {
      console.error('OneSignalNotificationService: Bootstrap failed.', error);
      // Question: How to handle OneSignal initialization errors?
    }
  }

  // --- Event Handling ---\

  /**
   * Sets up the core OneSignal event handlers for receiving and interacting with notifications.
   * Interview Question: Explain the lifecycle of a notification received in the foreground and how this handler controls its display.
   */
  static setupNotificationHandlers(): void {
    console.log('OneSignalNotificationService: Setting up notification handlers...');

    /**
     * Foreground Notification Handler:
     * Controls what happens when a notification is received WHILE the app is in the foreground.
     * You MUST call `notification.complete()` to display the notification, or omit the call to silence it.
     */
    OneSignal.setNotificationWillShowInForegroundHandler((notificationReceivedEvent: NotificationReceivedEvent) => {
      console.log('OneSignalNotificationService: Notification received in foreground:', JSON.stringify(notificationReceivedEvent, null, 2));
      const notification = notificationReceivedEvent.notification;

      // --- Decision Logic ---
      // Example: Decide whether to show the notification based on its content or app state.
      const shouldDisplay = true; // Or based on notification.additionalData, current screen, etc.
      // --------------------

      if (shouldDisplay) {
        // Complete the event to allow OneSignal to display the notification.
        // You can modify the notification object here before displaying if needed (e.g., change body, title).
        // notification.body = "Modified body";
        notificationReceivedEvent.complete(notification);
        console.log(`OneSignalNotificationService: Displaying foreground notification ID: ${notification.notificationId}`);
      } else {
        // Complete with null to prevent the notification from displaying.
        notificationReceivedEvent.complete(null);
        console.log(`OneSignalNotificationService: Silencing foreground notification ID: ${notification.notificationId}`);
        // Question: If silenced, how else might you inform the user? (In-app banner, badge update)
      }
    });

    /**
     * Notification Opened Handler:
     * Called when a user taps on a notification.
     * Works for notifications tapped in the background or foreground (if displayed).
     * Also handles app launch from a quit state via notification tap.
     */
    OneSignal.setNotificationOpenedHandler((openedEvent: OpenedEvent) => {
      console.log('OneSignalNotificationService: Notification opened (tapped):', JSON.stringify(openedEvent, null, 2));
      OneSignalNotificationService.handleNotificationTap(openedEvent);
    });

    /**
     * In-App Message Click Handler:
     * Called when a user clicks on a OneSignal In-App Message (IAM).
     * IAMs are distinct from push notifications.
     */
    OneSignal.setInAppMessageClickHandler(event => {
      console.log('OneSignalNotificationService: In-App Message clicked:', JSON.stringify(event, null, 2));
      // Handle IAM clicks, e.g., navigate based on event.result.actionId or event.result.url
    });

    console.log('OneSignalNotificationService: Notification handlers set up.');
  }

  /**
   * Centralized logic for handling a notification tap event.
   * @param openedEvent - The event object from `setNotificationOpenedHandler`.
   * Interview Question: How do you differentiate between a direct tap on the notification body vs. a tap on an action button within this handler? (`openedEvent.action`).
   */
  static handleNotificationTap(openedEvent: OpenedEvent): void {
    console.log('OneSignalNotificationService: Handling notification tap...');
    const notification = openedEvent.notification;
    const action = openedEvent.action; // Information about the action button clicked, if any

    console.log(`OneSignalNotificationService: Tapped notification ID: ${notification.notificationId}`);
    console.log('OneSignalNotificationService: Additional Data:', notification.additionalData);
    if (action) {
        console.log('OneSignalNotificationService: Action Button ID:', action.actionId);
        // Question: How would you implement different logic based on which action button was pressed?
        // Example: if (action.actionId === 'reply') { /* show reply UI */ }
    }

    // --- Navigation logic placeholder ---
    const additionalData = notification.additionalData;
    if (additionalData && typeof additionalData === 'object') {
      const screen = additionalData.screen as string | undefined;
      const params = additionalData.params as object | undefined;

      if (screen) {
        console.log(`OneSignalNotificationService: Attempting navigation to screen: ${screen} with params:`, params);
        // import { navigate } from './RootNavigation'; // Assuming a navigation helper
        // navigate(screen, params);
      } else {
        console.log('OneSignalNotificationService: No specific navigation screen defined in additionalData.');
      }
    } else {
      console.log('OneSignalNotificationService: Notification tapped, but no structured additionalData found.');
    }

    // --- Outcome Tracking Example ---
    // Track that a notification tap led to an app open or specific action
    // OneSignal.sendOutcome('notification_tapped');
    // Question: What are OneSignal Outcomes used for? How do they help measure notification effectiveness?
  }

  // --- User Identification & Data Tagging ---\

  /**
   * Associates the current OneSignal device record with your internal user ID.
   * Crucial for targeting specific users via the OneSignal API/dashboard.
   * Should be called after user login.
   * @param externalUserId - Your application's unique identifier for the user (e.g., database ID).
   * Interview Question: Why is setting the external user ID important for personalized notifications and analytics?
   * Interview Question: What happens if you call this *before* OneSignal has finished initializing and obtained a Player ID? (It might queue it or fail; best practice is to call after login when SDK is likely ready).
   */
  static setExternalUserId(externalUserId: string): void {
    console.log(`OneSignalNotificationService: Setting external user ID to: ${externalUserId}`);
    OneSignal.setExternalUserId(externalUserId, (results) => {
        console.log('OneSignalNotificationService: Result of setting external user ID:', results);
        // Check results for success/failure, especially related to push token authentication if used.
    });
  }

  /**
   * Disassociates the OneSignal device record from the external user ID.
   * Should be called on user logout.
   * Interview Question: Why is removing the external user ID on logout important? (Prevents sending notifications intended for the logged-out user to the next user on the same device).
   */
  static removeExternalUserId(): void {
    console.log('OneSignalNotificationService: Removing external user ID.');
    OneSignal.removeExternalUserId(results => {
        console.log('OneSignalNotificationService: Result of removing external user ID:', results);
    });
  }

  /**
   * Sends a single data tag to OneSignal for segmentation.
   * @param key - The tag key.
   * @param value - The tag value.
   * Interview Question: Provide examples of useful data tags for segmentation (e.g., 'user_level', 'last_product_viewed', 'has_purchased').
   */
  static sendTag(key: string, value: string | number | boolean): void {
    console.log(`OneSignalNotificationService: Sending tag - ${key}: ${value}`);
    OneSignal.sendTag(key, String(value)); // OneSignal typically expects string values, though SDK might handle others.
  }

  /**
   * Sends multiple data tags to OneSignal.
   * @param tags - An object containing key-value pairs.
   */
  static sendTags(tags: { [key: string]: string | number | boolean }): void {
    console.log('OneSignalNotificationService: Sending tags:', tags);
    // Convert all values to strings for consistency, as OneSignal often prefers strings.
    const stringTags = Object.entries(tags).reduce((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
    }, {} as { [key: string]: string });
    OneSignal.sendTags(stringTags);
  }

  /**
   * Deletes specific tags from the OneSignal device record.
   * @param keys - An array of tag keys to delete.
   */
  static deleteTags(keys: string[]): void {
    console.log('OneSignalNotificationService: Deleting tags:', keys);
    OneSignal.deleteTags(keys);
  }

  // --- Other Useful Methods ---\

  /**
   * Manually prompts the user for push notification permissions (primarily for iOS).
   * Provides a callback with the user's response.
   */
  static promptForPermissions(callback?: (granted: boolean) => void): void {
      if (Platform.OS === 'ios') {
          console.log('OneSignalNotificationService: Manually prompting for iOS permissions...');
          OneSignal.promptForPushNotificationsWithUserResponse(granted => {
              console.log(`OneSignalNotificationService: iOS Permission Prompt Response: ${granted}`);
              if (callback) {
                  callback(granted);
              }
          });
      } else {
          console.log('OneSignalNotificationService: Manual prompt not typically needed on Android (handled by SDK/OS).');
          // On Android 13+, the SDK usually handles the prompt automatically.
          // You could check permissions explicitly if needed:
          OneSignal.getDeviceState().then(state => {
              if (callback) callback(state?.hasNotificationPermission ?? false);
          });
      }
  }

   /**
   * Disables or enables push notifications for the device.
   * This affects whether the device can *receive* pushes via OneSignal.
   * @param disable - Set to true to disable, false to enable.
   * Interview Question: How does this differ from the user revoking permissions in OS settings? (This is controlled via SDK, OS settings override this).
   */
  static disablePush(disable: boolean): void {
      console.log(`OneSignalNotificationService: ${disable ? 'Disabling' : 'Enabling'} push notifications.`);
      OneSignal.disablePush(disable);
  }

  /**
   * Gets the current device state, including IDs and permission status.
   * @returns Promise<DeviceState | null>
   */
  static async getDeviceState(): Promise<any | null> { // Use `any` or define a specific type based on SDK version
      try {
          const state = await OneSignal.getDeviceState();
          console.log('OneSignalNotificationService: Current Device State:', state);
          return state;
      } catch (error) {
          console.error('OneSignalNotificationService: Failed to get device state:', error);
          return null;
      }
  }
}


// --- Example Usage (in App.tsx or similar) ---
/*
import React, { useEffect } from 'react';
import { View, Button, Alert } from 'react-native';
import { OneSignalNotificationService } from './path/to/OneSignalNotificationService'; // Adjust path

const App = () => {
  useEffect(() => {
    // Initialize OneSignal
    OneSignalNotificationService.bootstrap();

    // Example: Set external user ID after login (replace with actual login logic)
    const userId = 'user_123'; // Get this from your auth state
    OneSignalNotificationService.setExternalUserId(userId);

    // Example: Send tags
    OneSignalNotificationService.sendTags({
      user_tier: 'premium',
      last_login: Math.floor(Date.now() / 1000), // Example: Unix timestamp
    });

    // Cleanup on unmount (optional, depends on where listeners are attached)
    // return () => {
    //   OneSignal.clearHandlers(); // Or remove specific listeners if needed
    // };
  }, []);

  const handleLogout = () => {
      // Important: Remove external user ID on logout
      OneSignalNotificationService.removeExternalUserId();
      // Clear other user-specific tags if necessary
      OneSignalNotificationService.deleteTags(['user_tier', 'last_login']);
      console.log("User logged out, OneSignal external ID removed.");
      // ... rest of logout logic
  };

  const handlePrompt = () => {
      OneSignalNotificationService.promptForPermissions(granted => {
          Alert.alert("Permission Status", `Notifications ${granted ? 'enabled' : 'disabled'}.`);
      });
  };

  const handleCheckDeviceState = async () => {
      const state = await OneSignalNotificationService.getDeviceState();
      if (state) {
          Alert.alert("Device State", `Player ID: ${state.userId}\\nPush Enabled: ${state.isPushDisabled === false}\\nSubscribed: ${state.isSubscribed}`);
      }
  };


  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Prompt for Permissions (iOS)" onPress={handlePrompt} />
      <Button title="Check Device State" onPress={handleCheckDeviceState} />
      <Button title="Simulate Logout" onPress={handleLogout} />
      <Button title="Disable Push" onPress={() => OneSignalNotificationService.disablePush(true)} />
      <Button title="Enable Push" onPress={() => OneSignalNotificationService.disablePush(false)} />
      {/* Note: Sending test notifications is usually done via OneSignal Dashboard or API */}
    </View>
  );
};

export default App;
*/