"use client";

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './style.css'
import { strict } from 'assert';

const url = "ws://localhost:8080/ws";

export default function Home() {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<string[]>([]); 
  const [status, setStatus] = useState('disconnected');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [chatStarted, setChatStarted] = useState(false);

  const connectWebSocket = () => {
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
      } else if (event.data === 'connected') {
        setStatus('connected');
      } else if (event.data.slice(0,11) === 'client-id: '){
        console.log('Received client id:', event.data.slice(11));
        setClientId(event.data.slice(11));
      } else {
        setHistory((prev: any) => [...prev, 'Peer: ' + event.data]);
        setChatStarted(true);
      }
    });

    // Connection closed
    socket.addEventListener('close', (event) => {
      console.log('WebSocket connection closed.');
      setStatus('disconnected');
      connectWebSocket();
    });};

  useEffect(() => {
    connectWebSocket();

    return () => {
      socket.close();
    }
  }, []);

  const sendMessage = (text: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      if (text !== '') {
      socket.send(text);
      setMessage('');
      setHistory((prev: any) => [...prev, 'You: ' + text]);
      }
      setChatStarted(true);
    }
  };

  const handleSendMessage = () => {
    sendMessage(message);
  };

  const clearMessages = () => {
    setHistory([]);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      sendMessage(text);
      }
    catch (error) {
      console.error('Error pasting from clipboard:', error);
    }
  };


  return (<main>
    <div className="container">
        {status === 'disconnected' && clientId &&
        <div>
          <QRCodeSVG value={`${window.location.href}?id=${clientId}`} />
          <p>Client ID: {clientId}</p>
        </div>}

        <div className="status">
            <div className="title">Status: {status}</div>
            <div id="status"></div>
        </div>

        {(status === 'connected' || chatStarted) &&
         <div className="messages">
            <div className="title">Messages:</div>
            <div className="message-box">
                <div className="message-panel"></div>
                <div id="message"><pre>{history.join('\n')}</pre></div>
                <input 
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter a message..." 
                  autoFocus={true}></input>
            </div>
            <div className="btns">
                <button className="btn send" onClick={handleSendMessage}>Send</button>
                <button className="btn clearMsg" onClick={clearMessages}>Clear Messages (Locally)</button>  
                <button className="btn past-clipbrd" onClick={handlePaste}>Paste clipboard</button>
            </div>            
        </div>}
    </div>
</main>)
}
