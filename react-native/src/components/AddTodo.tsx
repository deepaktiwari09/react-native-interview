import React, { useState, useCallback } from 'react';
import { View, TextInput, Button, StyleSheet, Keyboard } from 'react-native';
import { useTodoContext } from '../context/TodoContext';

/**
 * Custom hook for managing text input state.
 * Interview Question: What are the benefits of creating this custom hook?
 * How does it simplify the `AddTodo` and `DetailScreen` components?
 * Could this hook be made more generic (e.g., handling different input types)?
 */
export const useInput = (initialValue: string = '') => {
  const [value, setValue] = useState(initialValue);

  // useCallback ensures this function reference is stable unless dependencies change (none here)
  const onChangeText = useCallback((text: string) => {
    setValue(text);
  }, []);

  const reset = useCallback(() => {
    setValue('');
  }, []);

  // useMemo could be used for the return object if it were complex or computationally expensive,
  // but it's likely overkill here.
  return { value, onChangeText, reset };
};

/**
 * Component for adding new todo items.
 * Interview Question: Explain the data flow when the "Add" button is pressed.
 * How does this component interact with the `TodoContext`?
 */
const AddTodo: React.FC = () => {
  const { addTodo } = useTodoContext();
  const { value: inputText, onChangeText, reset: resetInput } = useInput('');

  /**
   * Handles adding a new todo item.
   * Interview Question: Why is `inputText.trim()` important here?
   * What happens after a todo is successfully added? (Input reset, keyboard dismiss)
   */
  const handleAddTodo = useCallback(() => {
    const trimmedText = inputText.trim();
    if (trimmedText) {
      addTodo(trimmedText);
      resetInput();
      Keyboard.dismiss(); // Improve UX by hiding keyboard after adding
    }
    // Interview Question: Should there be user feedback if the input is empty (e.g., an alert)?
  }, [inputText, addTodo, resetInput]); // Dependencies for useCallback

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={inputText}
        onChangeText={onChangeText}
        placeholder="Enter new todo..."
        placeholderTextColor="#888" // Enhance placeholder visibility
        returnKeyType="done" // Suggests completion action on keyboard
        onSubmitEditing={handleAddTodo} // Allow adding via keyboard return key
      />
      {/* Interview Question: Discuss the accessibility of this Button. What props could improve it? (e.g., accessibilityLabel) */}
      <Button title="Add" onPress={handleAddTodo} disabled={!inputText.trim()} />
    </View>
  );
};

// Interview Question: What are the benefits of using StyleSheet.create?
// Could these styles be defined inline? What are the trade-offs?
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 15, // Increased padding
    borderBottomWidth: 1,
    borderBottomColor: '#eee', // Lighter border
    backgroundColor: '#f9f9f9', // Slight background color
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd', // Lighter border
    borderRadius: 5, // Rounded corners
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 16,
    backgroundColor: '#fff', // White background for input
  },
});

export default AddTodo;