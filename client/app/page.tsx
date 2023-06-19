"use client";

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './style.css'
import { strict } from 'assert';
import JSEncrypt from 'jsencrypt';

const { subtle } = globalThis.crypto;

const serverUrl = "ws://localhost:8080/ws";

export default function Home() {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<string[]>([]); 
  const [status, setStatus] = useState('disconnected');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
  const [peerPublicKey, setPeerPublicKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    if (keyPair)
    {
      connectWebSocket();
      return () => {
        if (socket)
          socket!.close();
      }
    }
  }, [keyPair]);
  
  useEffect(() => {
    generateKeyPair();
  }, []);


  const encrypt = (message: string, publicKey: string) => {
    const jsEncrypt = new JSEncrypt();
    jsEncrypt.setPublicKey(publicKey);
    return jsEncrypt.encrypt(message);
  }

  const decrypt = (message: string, privateKey: string) => {
    const jsEncrypt = new JSEncrypt();
    jsEncrypt.setPrivateKey(privateKey);
    return jsEncrypt.decrypt(message);
  }

  const generateKeyPair = async () => {
    let localKeyPair = await subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );
    setKeyPair(localKeyPair);
    console.log('Generated key pair: ', localKeyPair);
    console.log('value', keyPair);
  }

  const getOwnPublicKey = async () => {
    let publicKeyBuffer = await subtle.exportKey("spki", keyPair!.publicKey);
    let publicKey = Buffer.from(publicKeyBuffer).toString('base64');
    return publicKey;
  }

  const sendPublicKey = async (socket: WebSocket) => {
    let publicKey = await getOwnPublicKey();
    socket.send('public-key: ' + publicKey);
  }

  const importAndSetPeerPublicKey = async (key: string) => {
    let publicKey = await subtle.importKey("spki", Buffer.from(key, 'base64'), {name: "RSA-OAEP", hash: "SHA-256"}, true, ["encrypt"]);
    setPeerPublicKey(publicKey);
    console.log('Imported public key: ', publicKey);
  }

  const getPeerPublicKey = async () => {
    let publicKeyBuffer = await subtle.exportKey("spki", peerPublicKey!)
    let publicKey = Buffer.from(publicKeyBuffer).toString('base64');
    return publicKey;
  }

  const getPrivateKey = async () => {
    let privateKeyBuffer = await subtle.exportKey("pkcs8", keyPair!.privateKey)
    let privateKey = Buffer.from(privateKeyBuffer).toString('base64');
    return privateKey;
  }

  const getUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    return serverUrl + (id ? `?id=${id}` : '');
  }

  const connectWebSocket = () => {
    let url = getUrl();
    const socket = new WebSocket(url);
    setSocket(socket);

    // Connection opened
    socket.addEventListener('open', (event) => {
      console.log('WebSocket connection established.');
    });

    // Listen for messages
    socket.addEventListener('message', async (event) => {
      console.log('Received message: ', event.data);
      console.log("keyPair: ", keyPair);
      if (event.data === 'ping') {
        socket.send('pong');

      } else if (event.data === 'connected') {
        sendPublicKey(socket!);
        setStatus('connected');
        setChatStarted(true);

      } else if (event.data.slice(0,11) === 'client-id: '){
        let clientId = event.data.slice(11);
        console.log('Received client id: ', clientId);
        setClientId(clientId);

      } else if (event.data.slice(0, 12) === 'public-key: ') {
        console.log('Received public key: ', event.data.slice(12));
        let key = event.data.slice(12);
        importAndSetPeerPublicKey(key)

      } else if (event.data.slice(0, 5) === 'msg: ') {
        // Q: Why use msg: prefix?
        // A: Maybe someone sends a message that starts with 'client-id: ' or 'public-key: '?
        let encrypted = event.data.slice(5);

        let privateKey = await getPrivateKey();
        let decryptedString = decrypt(encrypted, privateKey);
        setHistory((prev: any) => [...prev, 'Peer: ' + decryptedString]);
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

  const sendMessage = async (text: string) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!text.trim()) {
      return;
    }
    
    setHistory((prev: any) => [...prev, 'You: ' + text]);

    let publicKey = await getPeerPublicKey();
    let encryptedString = encrypt(text, publicKey);
    socket.send("msg: " + encryptedString);
    setMessage('');
    setChatStarted(true);
  };

  const handleSendMessage = async () => {
    await sendMessage(message);
  };

  const clearMessages = () => {
    setHistory([]);
    setChatStarted(false);
  };

  const handlePaste = async () => {
    try {
      const permissionStatus = await navigator.permissions.query({name: 'clipboard-read'});
      switch (permissionStatus.state) {
        case "granted":
          const text = await navigator.clipboard.readText();
          sendMessage(text);
          break;
        case "prompt":
          console.log('Clipboard permission prompt. Not sure what to do here.');
          break;
        default:
          console.log('Clipboard permission not granted.');
          break;
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
          <QRCodeSVG value={`${window.location.href}?id=${clientId}`} includeMargin={true} size={192}/>
          <p>Client ID: http://localhost:3000?id={clientId}</p>
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
                <div id="message" className="dark:bg-slate-900"><pre>{history.join('\n')}</pre></div>
                <input 
                  type="text"
                  className="dark:bg-black"
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
