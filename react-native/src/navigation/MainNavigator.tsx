import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TodoNavigator from './TodoNavigator'; // The stack navigator for Todo screens
import ChatScreen from '../screens/ChatScreen'; // The Chat screen component

// Define ParamList for the Tab Navigator if needed (e.g., for passing params to tabs)
type TabParamList = {
  TodoSection: undefined; // Refers to the TodoNavigator stack
  Chat: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

/**
 * Main Tab Navigator to switch between major app sections.
 */
const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false, // Hide header for tabs, let stack navigators manage their own
        tabBarLabelStyle: { fontSize: 12 },
        tabBarActiveTintColor: '#007bff',
        tabBarInactiveTintColor: 'gray',
      }}
    >
      <Tab.Screen
        name="TodoSection"
        component={TodoNavigator} // Use the imported Todo stack navigator
        options={{
          title: 'Todos',
          // Optional: Add icons using tabBarIcon
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="list" color={color} size={size} />
          // ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: 'Chat',
          // Optional: Add icons
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="chatbubbles" color={color} size={size} />
          // ),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;