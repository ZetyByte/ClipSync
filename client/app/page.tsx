"use client";

import React, { useEffect, useState } from 'react';

const url = "ws://localhost:8080/ws";

export default function Home() {
  const [message, setMessage] = useState('');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const socket = new WebSocket(url);
    setSocket(socket);

    // Connection opened
    socket.addEventListener('open', (event) => {
      console.log('WebSocket connection established.');
    });

    // Listen for messages
    socket.addEventListener('message', (event) => {
      console.log('Received message:', event.data);
      if (event.data === 'ping') {
        socket.send('pong');
      }
      if (event.data.slice(0,11) === 'client-id: '){
        console.log('Received client id:', event.data.slice(11));
        setClientId(event.data.slice(12));
      }
    });

    // Connection closed
    socket.addEventListener('close', (event) => {
      console.log('WebSocket connection closed.');
    });

    return () => {
      socket.close();
    }
  }, []);

  const handleSendMessage = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
      setMessage('');
    }
  };

  return (<main>
    <div>
      <h1>WebSocket Example</h1>
      <p>Client ID: {clientId}</p>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  </main>)
}
