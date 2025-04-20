# Todo App Questions

Review the code in the `todo-app` module and answer the following questions. Explain your reasoning clearly.

1. **Context and CRUD**:
   - How does `TodoContext.ts` manage the todo list state? Explain the data flow for adding a new todo.
   - Why is the `useTodoContext` hook used instead of directly accessing the context?

2. **React Hooks**:
   - Explain the purpose of the `useInput` custom hook in `AddTodo.tsx`. How does it improve the code?
   - In `DetailScreen.tsx`, what happens if the `todoId` does not match any todo? Suggest an improvement.

3. **Styles**:
   - Why is `StyleSheet.create` used in `TodoList.tsx`? What are the performance benefits?
   - How are completed todos styled differently? Could this be achieved using an alternative approach?

4. **Navigation**:
   - Explain how `AppNavigator.tsx` sets up navigation. What is the role of `RootStackParamList`?
   - How is the `todoId` passed to `DetailScreen.tsx`? What happens if the parameter is missing?

5. **Improvements**:
   - Identify one potential issue in the `TodoProvider` CRUD operations (e.g., `addTodo`, `updateTodo`). How would you fix it?
   - Suggest a way to persist todos across app restarts.