import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTodoContext } from '../context/TodoContext';
import { RootStackParamList } from '../navigation/AppNavigator'; // Import shared param list

// Define props for TodoItem component
interface TodoItemProps {
  id: string;
  text: string;
  completed: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPress: (id: string) => void; // Added for navigation
}

/**
 * Represents a single todo item in the list.
 * Optimized with React.memo.
 * Interview Question: Why use `React.memo` here? What problem does it solve?
 * When might `React.memo` not provide a performance benefit?
 */
const TodoItem: React.FC<TodoItemProps> = memo(({ id, text, completed, onToggle, onDelete, onPress }) => {
  console.log(`Rendering TodoItem: ${id}`); // Log to observe re-renders (for demo/debug)

  // Use useCallback for event handlers passed down if they were complex,
  // but here they directly call props, so it might be minor.
  const handleToggle = () => onToggle(id);
  const handleDelete = () => {
    // Interview Question: Discuss confirmation dialogs. Is this a good UX pattern for delete?
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete "${text}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(id) },
      ]
    );
  };
  const handlePress = () => onPress(id);

  return (
    <TouchableOpacity onPress={handlePress} style={styles.todoItemContainer} activeOpacity={0.7}>
      <View style={styles.todoContent}>
        {/* Interview Question: Discuss accessibility. How can this be improved? (accessibilityRole, accessibilityState) */}
        <TouchableOpacity onPress={handleToggle} style={styles.toggleArea}>
          <View style={[styles.checkbox, completed && styles.checkboxCompleted]}>
            {completed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.todoText, completed && styles.completedText]}>
            {text}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButtonContainer}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

// Define navigation prop type for useNavigation hook
type TodoListNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

/**
 * Displays the list of todo items.
 * Interview Question: Explain the purpose of `FlatList`. What are its key props (`data`, `renderItem`, `keyExtractor`)?
 * What are the performance advantages of `FlatList` over mapping an array in a `ScrollView`?
 */
const TodoList: React.FC = () => {
  // Interview Question: Why is `useTodoContext` used here?
  const { todos, toggleTodo, deleteTodo } = useTodoContext();
  const navigation = useNavigation<TodoListNavigationProp>();

  /**
   * Navigates to the Detail screen for editing a todo.
   * Interview Question: How is the `todoId` passed to the Detail screen?
   */
  const handleNavigateToDetail = useCallback((todoId: string) => {
    navigation.navigate('Detail', { todoId });
  }, [navigation]);

  // Render function for each item in the FlatList
  // useCallback ensures this function reference is stable if its dependencies are stable.
  const renderTodoItem = useCallback(({ item }: { item: { id: string; text: string; completed: boolean } }) => (
    <TodoItem
      id={item.id}
      text={item.text}
      completed={item.completed}
      onToggle={toggleTodo} // Passed down from context
      onDelete={deleteTodo} // Passed down from context
      onPress={handleNavigateToDetail} // Pass navigation handler
    />
  ), [toggleTodo, deleteTodo, handleNavigateToDetail]); // Dependencies for useCallback

  // Interview Question: What does `keyExtractor` do? Why is it important for performance and state?
  const keyExtractor = (item: { id: string }) => item.id;

  return (
    <View style={styles.container}>
      {/* Interview Question: Discuss alternatives to FlatList for rendering lists (e.g., SectionList, ScrollView + map). When would you use them? */}
      <FlatList
        data={todos} // The array of todo items from context
        renderItem={renderTodoItem} // Function to render each item
        keyExtractor={keyExtractor} // Function to extract unique keys
        contentContainerStyle={styles.listContentContainer}
        // Optional: Add pull-to-refresh, infinite scroll, etc.
        // ListEmptyComponent={<Text>No todos yet!</Text>}
      />
    </View>
  );
};

// Interview Question: Discuss the use of `StyleSheet.create`. Benefits?
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  listContentContainer: {
    paddingVertical: 10,
  },
  todoItemContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginVertical: 5,
    marginHorizontal: 15,
    elevation: 1, // Subtle shadow for Android
    shadowColor: '#000', // Shadow for iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  todoContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  toggleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, // Allow text to take available space
    marginRight: 10, // Space before delete button
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  checkboxCompleted: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  todoText: {
    fontSize: 16,
    color: '#333',
    flexShrink: 1, // Allow text to shrink if needed
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#aaa',
  },
  deleteButtonContainer: {
    padding: 5, // Easier to tap
  },
  deleteButtonText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default TodoList;