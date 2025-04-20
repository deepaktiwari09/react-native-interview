import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  Keyboard,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTodoContext } from '../context/TodoContext';
import { RootStackParamList } from '../navigation/AppNavigator'; // Import shared param list

// Define the specific route prop type for this screen
type DetailScreenRouteProp = RouteProp<RootStackParamList, 'Detail'>;

// Define the specific navigation prop type for this screen
type DetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Detail'>;

/**
 * DetailScreen component - Allows editing an existing todo item.
 * Interview Question: Explain how this screen receives the `todoId`.
 * What happens if the `todoId` route parameter is missing or invalid?
 */
const DetailScreen: React.FC = () => {
  // Hooks for accessing route params and navigation
  const route = useRoute<DetailScreenRouteProp>();
  const navigation = useNavigation<DetailScreenNavigationProp>();
  const { todoId } = route.params;

  // Access todo context
  // Interview Question: Why fetch the specific todo here instead of passing the whole todo object via navigation params?
  // Discuss the trade-offs (data freshness vs. param complexity).
  const { todos, updateTodo } = useTodoContext();

  // Find the specific todo based on the id from route params
  // useMemo could optimize this if the todos list was very large and rendered frequently
  const currentTodo = todos.find((t) => t.id === todoId);

  // State for the input field, initialized with the current todo's text
  // Interview Question: Why use local state (`useState`) here for the input value instead of directly modifying context state on each key press?
  const [editText, setEditText] = useState(currentTodo ? currentTodo.text : '');

  /**
   * Handles the update logic when the button is pressed.
   * Interview Question: Explain the validation (`editText.trim()`).
   * What happens after a successful update? (Navigation back)
   */
  const handleUpdate = useCallback(() => {
    const trimmedText = editText.trim();
    if (!currentTodo) {
      Alert.alert('Error', 'Todo not found. It might have been deleted.');
      navigation.goBack();
      return;
    }
    if (trimmedText && trimmedText !== currentTodo.text) {
      updateTodo(todoId, trimmedText);
      Keyboard.dismiss();
      navigation.goBack(); // Navigate back to the previous screen (Home)
    } else if (!trimmedText) {
      Alert.alert('Invalid Input', 'Todo text cannot be empty.');
    } else {
      // Text hasn't changed, just go back
      navigation.goBack();
    }
  }, [editText, todoId, updateTodo, navigation, currentTodo]);

  // Effect to update the screen title dynamically
  // Interview Question: Why use `useLayoutEffect` here instead of `useEffect` for setting navigation options?
  useLayoutEffect(() => {
    navigation.setOptions({
      title: currentTodo ? 'Edit Todo' : 'Todo Not Found',
      // Add a header button for saving
      headerRight: () => (
        <Button onPress={handleUpdate} title="Save" disabled={!currentTodo || !editText.trim()} />
      ),
    });
  }, [navigation, handleUpdate, currentTodo, editText]); // Dependencies are important!

  // Effect to handle the case where the todo might be deleted while editing
  useEffect(() => {
    if (!currentTodo) {
      // If the todo disappears (e.g., deleted from another screen/process),
      // show an alert and navigate back.
      Alert.alert('Error', 'Todo not found. Navigating back.');
      // Use setTimeout to allow the alert to be seen before navigating
      const timer = setTimeout(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentTodo, navigation]);

  // Render loading or not found state if the todo isn't available initially
  if (!currentTodo) {
    // This state might be brief due to the useEffect above, but good practice.
    return (
      <View style={styles.container}>
        <Text>Loading or Todo not found...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Edit Todo Text:</Text>
      {/* Interview Question: Discuss the props used in TextInput (value, onChangeText, style, etc.). */}
      <TextInput
        style={styles.input}
        value={editText}
        onChangeText={setEditText}
        placeholder="Enter new todo text"
        autoFocus={true} // Focus the input automatically
        returnKeyType="done"
        onSubmitEditing={handleUpdate} // Allow saving via keyboard
      />
      {/* The primary save action is now in the headerRight button */}
      {/* <Button title="Update Todo" onPress={handleUpdate} /> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 10,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
});

export default DetailScreen;