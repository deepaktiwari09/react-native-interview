import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import AddTodo from '../components/AddTodo';
import TodoList from '../components/TodoList';
import { TodoProvider } from '../context/TodoContext';

/**
 * HomeScreen component - The main screen displaying the todo list and input.
 * Interview Question: Why is `TodoProvider` placed here and not higher up (e.g., in AppNavigator or App.tsx)?
 * What are the implications of its placement on context accessibility and state lifecycle?
 */
const HomeScreen: React.FC = () => {
  return (
    // The TodoProvider makes the todo context available to AddTodo and TodoList
    <TodoProvider>
      {/* Interview Question: Discuss the use of fragments `<>` vs. `<View>`. When is each appropriate? */}
      <View style={styles.container}>
        {/* Interview Question: How does the status bar style affect the app's appearance? */}
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        {/* AddTodo component for inputting new todos */}
        <AddTodo />
        {/* TodoList component for displaying the list of todos */}
        <TodoList />
      </View>
    </TodoProvider>
  );
};

// Interview Question: Explain `flex: 1`. What does it achieve in this context?
const styles = StyleSheet.create({
  container: {
    flex: 1, // Ensures the container takes up the full screen height
    backgroundColor: '#fff', // Sets the background color for the screen
  },
});

export default HomeScreen;