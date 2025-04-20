import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import uuid from 'react-native-uuid'; // Using UUID for more reliable IDs

// Define the shape of a single Todo item
interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

// Define the shape of the context value
interface TodoContextType {
  todos: Todo[];
  addTodo: (text: string) => void;
  updateTodo: (id: string, newText: string) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
}

// Create the context
// Interview Question: Why initialize with `undefined`? What are the implications?
const TodoContext = createContext<TodoContextType | undefined>(undefined);

/**
 * Custom hook to safely access the Todo context.
 * Interview Question: Why is this hook beneficial compared to directly using `useContext(TodoContext)` in components?
 * What problem does the error check solve?
 */
export const useTodoContext = (): TodoContextType => {
  const context = useContext(TodoContext);
  if (context === undefined) {
    throw new Error('useTodoContext must be used within a TodoProvider');
  }
  return context;
};

/**
 * Provider component that encapsulates the todo state and logic.
 * Interview Question: What are the pros and cons of using Context API for state management here
 * versus alternatives like Redux, Zustand, or component state?
 */
export const TodoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State hook to store the list of todos
  const [todos, setTodos] = useState<Todo[]>([
    // Initial sample data can be useful for testing/dev
    { id: uuid.v4().toString(), text: 'Learn React Native', completed: false },
    { id: uuid.v4().toString(), text: 'Build a Todo App', completed: true },
  ]);

  /**
   * Adds a new todo item to the list.
   * Interview Question: The previous version used Math.random() for IDs. Why is using a UUID library better?
   * Discuss potential race conditions or issues if this were an async operation (e.g., saving to a server).
   */
  const addTodo = useCallback((text: string) => {
    if (!text.trim()) return; // Prevent adding empty todos
    const newTodo: Todo = {
      id: uuid.v4().toString(), // Generate a unique ID
      text: text.trim(),
      completed: false,
    };
    // Interview Question: Explain the use of the functional update form `(prevTodos) => ...`.
    // When is it necessary?
    setTodos((prevTodos) => [...prevTodos, newTodo]);
  }, []); // useCallback ensures this function reference is stable if dependencies don't change

  /**
   * Updates the text of an existing todo item.
   * Interview Question: How does this ensure immutability? What could go wrong if we mutated the todo object directly?
   */
  const updateTodo = useCallback((id: string, newText: string) => {
    if (!newText.trim()) return; // Prevent updating to empty text
    setTodos((prevTodos) =>
      prevTodos.map((todo) =>
        todo.id === id ? { ...todo, text: newText.trim() } : todo
      )
    );
  }, []);

  /**
   * Toggles the completion status of a todo item.
   */
  const toggleTodo = useCallback((id: string) => {
    setTodos((prevTodos) =>
      prevTodos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }, []);

  /**
   * Deletes a todo item from the list.
   * Interview Question: Explain how `filter` creates a new array.
   */
  const deleteTodo = useCallback((id: string) => {
    setTodos((prevTodos) => prevTodos.filter((todo) => todo.id !== id));
  }, []);

  // Memoize the context value to prevent unnecessary re-renders of consumers
  // Interview Question: Why is `useMemo` potentially important here? What does it optimize?
  const contextValue = React.useMemo(() => ({
    todos,
    addTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
  }), [todos, addTodo, updateTodo, toggleTodo, deleteTodo]);

  return (
    <TodoContext.Provider value={contextValue}>
      {children}
    </TodoContext.Provider>
  );
};