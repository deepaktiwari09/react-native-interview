import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, StackNavigationOptions } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import DetailScreen from '../screens/DetailScreen';

/**
 * Defines the parameters expected by each screen in the stack.
 * `undefined` means the screen takes no parameters.
 * `{ todoId: string }` means the Detail screen expects an object with a `todoId` property of type string.
 * Interview Question: Why is defining `RootStackParamList` important, especially when using TypeScript?
 * What benefits does it provide for type safety and developer experience?
 */
export type RootStackParamList = {
  Home: undefined;
  Detail: { todoId: string };
  // Add other screens here if needed
};

// Create the stack navigator instance, typed with our param list
// Interview Question: What is a Stack Navigator? How does it differ from other navigators (e.g., Tab, Drawer)?
const Stack = createStackNavigator<RootStackParamList>();

/**
 * Main application navigator component.
 * Sets up the navigation stack with screens and options.
 * Interview Question: Explain the purpose of `NavigationContainer`. What does it manage?
 */
const AppNavigator: React.FC = () => {
  // Define default screen options to apply to all screens in the stack
  // Interview Question: Why might you define defaultScreenOptions instead of setting options on each screen individually?
  const defaultScreenOptions: StackNavigationOptions = {
    headerStyle: {
      backgroundColor: '#007bff', // Example header background color
    },
    headerTintColor: '#fff', // Color for header text and back button
    headerTitleStyle: {
      fontWeight: 'bold',
    },
    headerBackTitleVisible: false, // Hide the back button title text on iOS
  };

  return (
    // NavigationContainer is the root component for navigation
    <NavigationContainer>
      {/* Stack.Navigator manages the stack of screens */}
      <Stack.Navigator
        initialRouteName="Home" // The first screen to show
        screenOptions={defaultScreenOptions} // Apply default options to all screens
      >
        {/* Define the Home screen */}
        {/* Interview Question: What does `Stack.Screen` represent? Explain its key props (`name`, `component`, `options`). */}
        <Stack.Screen
          name="Home" // Unique name used for navigation
          component={HomeScreen} // The React component to render
          options={{ title: 'My Todos' }} // Screen-specific options (overrides defaults)
        />
        {/* Define the Detail screen */}
        <Stack.Screen
          name="Detail" // Unique name for the detail route
          component={DetailScreen} // The component for editing todos
          // Options can be set dynamically within the component using `navigation.setOptions`
          // or statically here. Dynamic options are often preferred for titles based on data.
          options={{ title: 'Edit Todo' }} // Initial title, often updated in the component
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;