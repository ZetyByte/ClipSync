"use client";

import React, { useEffect, useState } from 'react';
<<<<<<< HEAD
import './style.css'
=======
import { QRCodeSVG } from 'qrcode.react';
>>>>>>> 49056902bded993666455079b385890af521761b

const url = "ws://localhost:8080/ws";

export default function Home() {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const socket = new WebSocket(url);
    setSocket(socket);

    // Connection opened
    socket.addEventListener('open', (event) => {
      console.log('WebSocket connection established.');
      setStatus('connected');
    });

    // Listen for messages
    socket.addEventListener('message', (event) => {
      console.log('Received message:', event.data);
      if (event.data === 'ping') {
        socket.send('pong');
      }
      if (event.data.slice(0,11) === 'client-id: '){
        console.log('Received client id:', event.data.slice(11));
        setClientId(event.data.slice(11));
      }
    });

    // Connection closed
    socket.addEventListener('close', (event) => {
      console.log('WebSocket connection closed.');
      setStatus('disconnected');
    });

    return () => {
      socket.close();
    }
  }, []);

  const handleSendMessage = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      if (message !== '') {
      socket.send(message);
      setMessage('');
      }
    }
  };
<<<<<<< HEAD
  return (<main>
    <div className="container">
        <h1>ClipSync - Peer</h1>
        <p>Client ID: {clientId}</p>
        <div className="status">
            <div className="title">Status: {status}</div>
            <div id="status"></div>
        </div>

        {status === 'connected' && <div className="messages">
            <div className="title">Messages:</div>
            <div className="message-box">
                <div className="message-panel"></div>
                <div id="message">тоиоио</div>
                <input 
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter a message..." 
                  autoFocus={true}></input>
            </div>
            <div className="btns">
                <button className="btn send" onClick={handleSendMessage}>Send</button>
                <button className="btn clearMsg">Clear Messages (Locally)</button>  
                <button className="btn past-clipbrd">Paste clipboard</button>
            </div>            
        </div>}
    </div>
</main>)
=======

  return (<>
    <div>
      <h1>WebSocket Example</h1>
      <p>Client ID: {clientId}</p>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={handleSendMessage}>Send</button>
      <QRCodeSVG value={`${document.URL}?id=${clientId}`} />,
    </div>
  </>)
>>>>>>> 49056902bded993666455079b385890af521761b
}
