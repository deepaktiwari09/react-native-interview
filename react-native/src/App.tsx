import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import MainNavigator from './navigation/MainNavigator'; // Import the new main tab navigator
import { NotificationService } from './services/NotificationService'; // Import NotificationService

/**
 * Main App component for the combined application.
 * Sets up the main navigator and initializes services.
 */
const App: React.FC = () => {

  // Initialize notification service on app start
  // Interview Question: Why is it important to initialize services like notifications early?
  // Where else could this initialization logic live?
  useEffect(() => {
    NotificationService.bootstrap();

    // Optional: Check initial notification if app was opened from quit state via notification
    // const checkInitialNotification = async () => {
    //   const initialNotification = await notifee.getInitialNotification();
    //   if (initialNotification) {
    //     console.log('App opened by notification:', initialNotification.notification.id);
    //     NotificationService.handleNotificationTap(initialNotification.notification);
    //     // Potentially navigate based on the initial notification data here
    //   }
    // };
    // checkInitialNotification();

  }, []);

  return (
    // NavigationContainer is the root for all navigation
    <NavigationContainer>
      {/* Use the MainNavigator which contains the tabs */}
      <MainNavigator />
    </NavigationContainer>
  );
};

export default App;

