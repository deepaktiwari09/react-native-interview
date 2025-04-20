import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Button,
} from 'react-native';
import { webSocketService } from '../websocket/WebSocketService';
import { NotificationService } from '../notifications/NotificationService';

// Define message type
interface ChatMessage {
  id: string;
  text: string;
  timestamp: number;
}

const ChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');

  // Initialize WebSocket and notifications
  useEffect(() => {
    NotificationService.configure();
    webSocketService.connect('ws://example.com/chat');

    webSocketService.setOnMessageCallback((message: string) => {
      const newMessage: ChatMessage = {
        id: Math.random().toString(),
        text: message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, newMessage]);
      NotificationService.showNotification('New Message', message);
    });

    // Cleanup on unmount
    return () => {
      webSocketService.disconnect();
    };
  }, []);

  // Handle sending a message
  const handleSend = () => {
    if (inputText.trim()) {
      webSocketService.sendMessage(inputText);
      setInputText('');
    }
  };

  // Render individual message
  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={styles.messageContainer}>
      <Text style={styles.messageText}>{item.text}</Text>
      <Text style={styles.timestamp}>
        {new Date(item.timestamp).toLocaleTimeString()}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message"
        />
        <Button title="Send" onPress={handleSend} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messageList: {
    flex: 1,
  },
  messageContainer: {
    padding: 10,
    marginVertical: 5,
    marginHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  messageText: {
    fontSize: 16,
  },
  timestamp: {
    fontSize: 12,
    color: 'gray',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    padding: 10,
    marginRight: 10,
  },
});

export default ChatScreen;