Review the code in the `chat-app` module and answer the following questions. Explain your reasoning clearly.

1. **WebSocket Basics**:
   - How does `WebSocketService.ts` establish and manage the WebSocket connection?
   - What happens if the WebSocket connection fails? Suggest an improvement for reconnection logic.

2. **Push Notification Basics**:
   - Explain the role of `NotificationService.ts` in handling push notifications.
   - How does `ChatScreen.tsx` trigger notifications for new messages? What permissions are required?

3. **Styles**:
   - How are styles applied in `ChatScreen.tsx`? Why is `StyleSheet.create` used?
   - Suggest an alternative styling approach for the message container.

4. **Component Lifecycle**:
   - Explain the `useEffect` hook in `ChatScreen.tsx`. Why is the cleanup function included?
   - What would happen if the cleanup function was omitted?

5. **Improvements**:
   - Identify one potential issue in the `WebSocketService` message handling. How would you fix it?
   - Suggest a way to persist chat messages across app restarts.