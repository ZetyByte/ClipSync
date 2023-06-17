"use client";

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './style.css'
import { strict } from 'assert';

const url = "ws://localhost:8080/ws";

let tempKeyPair: CryptoKeyPair | null = null; // TODO: remove when reactive state is working

export default function Home() {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<string[]>([]); 
  const [status, setStatus] = useState('disconnected');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null); // TODO: make this work
  const [peerPublicKey, setPeerPublicKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    console.log("useEffect keypair: ", keyPair);
  }, [keyPair]);

  const connectWebSocket = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    let newUrl = url + (id ? `?id=${id}` : '');
    const socket = new WebSocket(newUrl);
    setSocket(socket);

    // Connection opened
    socket.addEventListener('open', (event) => {
      console.log('WebSocket connection established.');
    });

    // Listen for messages
    socket.addEventListener('message', (event) => {
      console.log('Received message: ', event.data);
      console.log("keyPair: ", keyPair);
      if (event.data === 'ping') {
        socket.send('pong');
      } else if (event.data === 'connected') {
        window.crypto.subtle.generateKey(
          {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
          },
          true,
          ["encrypt", "decrypt"]
        ).then((localKeyPair) => {
          setKeyPair(localKeyPair);
          tempKeyPair = localKeyPair;
          console.log('Generated key pair: ', localKeyPair);
          window.crypto.subtle.exportKey("spki", localKeyPair!.publicKey).then((publicKeyBuffer) => {
            let publicKey = Buffer.from(publicKeyBuffer).toString('base64');
            socket.send('public-key: ' + publicKey);
            setStatus('connected');
            setChatStarted(true);
          });
        })
      } else if (event.data.slice(0,11) === 'client-id: '){
        console.log('Received client id: ', event.data.slice(11));
        setClientId(event.data.slice(11));
      } else if (event.data.slice(0, 12) === 'public-key: ') {
        console.log('Received public key: ', event.data.slice(12));
        let key = event.data.slice(12);
        window.crypto.subtle.importKey("spki", Buffer.from(key, 'base64'), {name: "RSA-OAEP", hash: "SHA-256"}, true, ["encrypt"]).then((publicKey) => {
          console.log('Imported public key: ', publicKey);
          setPeerPublicKey(publicKey);
        });
      } else if (event.data.slice(0, 5) === 'msg: ') {
        // Q: Why use msg: prefix?
        // A: Maybe someone sends a message that starts with 'client-id: ' or 'public-key: '?
        let encrypted = event.data.slice(5);
        let encryptedBuffer = Buffer.from(encrypted, 'base64');
        // window.crypto.subtle.decrypt("RSA-OAEP", keyPair!.privateKey, encrypted).then((decrypted) => {
        //   setHistory((prev: any) => [...prev, 'Peer: ' + decrypted]);
        // });
        window.crypto.subtle.decrypt("RSA-OAEP", tempKeyPair!.privateKey, encryptedBuffer).then((decrypted) => {
          let decryptedString = Buffer.from(decrypted).toString('base64');
          setHistory((prev: any) => [...prev, 'Peer: ' + decryptedString]);
        });
      }
      else{
        console.log('Received unknown message: ', event.data);
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
      socket!.close();
    }
  }, []);

  const sendMessage = async (text: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      if (text !== '') {
        setHistory((prev: any) => [...prev, 'You: ' + text]);
        window.crypto.subtle.encrypt("RSA-OAEP", peerPublicKey!, Buffer.from(text, 'base64')).then((encrypted) => {
          console.log('Encrypted message: ', encrypted);
          console.log('Peer public key: ', peerPublicKey!);
          let encryptedString = Buffer.from(encrypted).toString('base64');
          socket.send("msg: " + encryptedString);
          setMessage('');
        });}
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
      const permissionStatus = await navigator.permissions.query({name: 'clipboard-read'});
      if (permissionStatus.state === 'granted') {
        const text = await navigator.clipboard.readText();
        sendMessage(text);
      }
      else {
        console.log('Clipboard permission not granted.');
      }
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
