"use client";

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BiCopy } from 'react-icons/bi';
import './style.css'
import JSEncrypt from 'jsencrypt';
import JSON from 'json3';
import pako from 'pako';
import * as crpt from './encryption';



const { subtle } = globalThis.crypto;

const serverUrl = "ws://localhost:8080/ws";

export default function Home() {
  const [message, setMessage] = useState('');
  const [copiedMessage, setCopiedMessage] = useState('');
  const [history, setHistory] = useState<string[]>([]); 
  const [status, setStatus] = useState('disconnected');
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
  const [peerPublicKey, setPeerPublicKey] = useState<CryptoKey | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [pairInfo, setPairInfo] = useState<string | boolean>("");
  const [pairingAccepted, setPairingAccepted] = useState(false);
  const [peerAccepted, setPeerAccepted] = useState(false);
  const [clientName, setClientName] = useState('');
  const [selectetdFile, setSelectedFile] = useState([]);
  var receivedChunks: ArrayBuffer = new ArrayBuffer(0);

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
    if (pairingAccepted && peerAccepted)
      setStatus('connected');
  }, [pairingAccepted, peerAccepted]);
  
  useEffect(() => {
    if (isConnecting)
    generateKeyPair();
  }, [isConnecting]);

  useEffect(() => {
    console.log('Status changed: ', socket);
    if (peerPublicKey && socket)
      sendClientInfo();
  }, [peerPublicKey, socket]);


  const disconnectClient = () => {
    if (socket)
      socket.close();
    setHistory([]);
    setStatus('disconnected');
    setClientId(null);
    setChatStarted(false);
    setKeyPair(null);
    setPeerPublicKey(null);
    setIsConnecting(false);
    setPairInfo("");
    setPairingAccepted(false);
    setPeerAccepted(false);
  }


  const generateKeyPair = async () => {
    setKeyPair(await crpt.generateKeyPair());
  }

  const generatePeerName = () => {
    let adjectives = ['Amazing', 'Awesome', 'Beautiful', 'Brave', 'Bright', 'Calm', 'Clever', 'Cool', 'Cute', 'Dazzling', 'Elegant', 'Enchanting', 'Fabulous', 'Fantastic', 'Friendly', 'Funny', 'Gentle', 'Glamorous', 'Gorgeous', 'Graceful', 'Handsome', 'Happy', 'Healthy', 'Helpful', 'Hilarious', 'Humorous', 'Jolly', 'Joyous', 'Kind', 'Lively', 'Lovely', 'Lucky', 'Magnificent', 'Nice', 'Perfect', 'Pleasant', 'Proud', 'Silly', 'Smiling', 'Splendid', 'Successful', 'Thoughtful', 'Victorious', 'Vivacious', 'Witty', 'Wonderful','Adventurous', 'Blissful', 'Charming', 'Delightful', 'Exquisite', 'Fierce', 'Glowing', 'Harmonious', 'Incredible', 'Jubilant'];

    let nouns = ['Apple', 'Banana', 'Bread', 'Butter', 'Cake', 'Carrot', 'Cheese', 'Chicken', 'Chocolate', 'Cookie', 'Cucumber', 'Egg', 'Fish', 'Garlic', 'Grape', 'Honey', 'Ice cream', 'Juice', 'Lemon', 'Lime', 'Mango', 'Milk', 'Mushroom', 'Noodles', 'Olive', 'Onion', 'Orange', 'Pasta', 'Peach', 'Pear', 'Pepper', 'Pineapple', 'Pizza', 'Potato', 'Pumpkin', 'Rice', 'Salad', 'Sandwich', 'Sausage', 'Soup', 'Steak', 'Strawberry', 'Tomato', 'Watermelon' ,'Quinoa', 'Raspberry', 'Sunflower', 'Tea', 'Vanilla', 'Walnut', 'Yogurt', 'Zucchini'];
    
    return adjectives[Math.floor(Math.random() * adjectives.length)] + ' ' + nouns[Math.floor(Math.random() * nouns.length)];
  }


  const onFileChange = (e: any) => {
    setSelectedFile(e.target.files);
    console.log(e.target.files[0]);
    console.log(e.target.files[0].name);
    console.log(e.target.files[0].size);
    console.log(e.target.files[0].type);
  };


  const getUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    return serverUrl + (id ? `?id=${id}` : '');
  }

  const connectWebSocket = () => {
    let url = getUrl();
    var socket = new WebSocket(url);
    setSocket(socket);

    // Connection opened
    socket.addEventListener('open', async (event) => {
      console.log('WebSocket connection established.');
      setError("");
    });

    // Listen for messages
    socket.addEventListener('message', async (event) => {
      if (event.data === 'ping') {
        socket.send('pong');

      } else if (event.data.slice(0, 13) === 'client-info: ') {
        let encrypted = event.data.slice(13);
        let decrypted = await crpt.decrypt(encrypted, keyPair);
        console.log('Decrypted client info: ', decrypted);
        setPairInfo(decrypted);

      } else if (event.data === 'connected') {
        crpt.sendPublicKey(socket!, keyPair);

      } else if (event.data.slice(0,11) === 'client-id: '){
        let clientId = event.data.slice(11);
        console.log('Received client id: ', clientId);
        setClientId(clientId);

      } else if (event.data.slice(0, 12) === 'public-key: ') {
        console.log('Received public key: ', event.data.slice(12));
        let key = event.data.slice(12);
        crpt.importAndSetPeerPublicKey(key);

      } else if (event.data.slice(0, 5) === 'msg: ') {
        // Q: Why use msg: prefix?
        // A: Maybe someone sends a message that starts with 'client-id: ' or 'public-key: '?
        let encrypted = event.data.slice(5);

        let decryptedString = await crpt.decrypt(encrypted, keyPair);
        setHistory((prev: any) => [...prev, 'Peer: ' + decryptedString]);
        setChatStarted(true);
      } else if(event.data === 'accept-pairing'){
        setPeerAccepted(true);
      } else if(event.data.slice(0,6) === 'file: '){
        let encrypted = event.data.slice(6);
        receiveFileByChunks(encrypted);
      }
      else{
        console.log('Received unknown message: ', event.data);
      }
    });


    socket.addEventListener('close', (event) => {
      console.log('WebSocket connection closed.', event.reason);
      if (event.reason === 'Client with this ID does not exist')
      {
        setError("id-not-found");
      }
      else 
      {
        setError("server-error");
      }
      disconnectClient();
    });};


    const sendClientInfo = async () => {
      console.log('Sending client info...');
      var peerName = generatePeerName();
      //setPeerName(generatePeerName());
    //   let encryptedString = await encrypt("device: " + navigator.userAgent);
      let encryptedString = await crpt.encrypt(peerName, peerPublicKey);
      setClientName(peerName);
      socket!.send("client-info: " + encryptedString);
      console.log('Sent client info: ', encryptedString);
    }


    const receiveFileByChunks = async (encrypted: string) => {
      const json = JSON.parse(encrypted);
      const algorithm = {
        name: 'AES-CBC',
        length: 256
      };
      const decryptedKey = await crpt.decrypt(json.key, keyPair) as string;
      console.log("1");
      const key = await crypto.subtle.importKey('raw', crpt.stringToArrayBuffer(decryptedKey), algorithm, true, ['encrypt', 'decrypt']);
      console.log("2");
      const decryptedChunk = await crpt.decryptAES(crpt.stringToArrayBuffer(json.chunk), crpt.stringToArrayBuffer(json.iv), key);
      console.log("3");
      // Append the received chunk to the file
      let combinedLength = receivedChunks.byteLength + decryptedChunk.byteLength;
      let combinedArray = new Uint8Array(combinedLength);
      combinedArray.set(new Uint8Array(receivedChunks), 0);
      combinedArray.set(new Uint8Array(decryptedChunk), receivedChunks.byteLength);
      receivedChunks = combinedArray.buffer;
      // Check if all chunks have been received
      if (json.currentChunk === json.totalChunks) {
        let start = new Date().getTime();
        const decompressedChunk = pako.inflate(receivedChunks, { to: 'string' });
        let end = new Date().getTime();
        console.log("Decompression time: " + (end - start)/1000);

        const downloadLink = document.createElement('a');
        downloadLink.href = decompressedChunk;
        downloadLink.download = json.name;
    
        // Trigger the download
        downloadLink.click();
    
        // Clear the received chunks
        receivedChunks = new ArrayBuffer(0);
      }
    };


    const acceptPairing = async () => {
      setPairingAccepted(true);
      socket!.send('accept-pairing');
      setPairInfo('');
    }

    const rejectPairing = async () => {
      disconnectClient();
      setError("Pairing was rejected. Try again.");
    }


  const sendMessage = async (text: string) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!text.trim()) {
      return;
    }
    
    setHistory((prev: any) => [...prev, 'You: ' + text]);

    let encryptedString = await crpt.encrypt(text, peerPublicKey);
    socket.send("msg: " + encryptedString);
    setMessage('');
    setChatStarted(true);
  };


  const handleSendMessage = async () => {
    await sendMessage(message);
  };

  const handleSendFile = async () => {
    
  const worker = new Worker('/send-file.ts');

  // Define the event listener to handle messages from the worker
  worker.onmessage = function (event) {
    socket!.send(event.data);
  };

  // Send data to the worker
  const data = {file: selectetdFile[0], peerPublicKey: peerPublicKey};
  worker.postMessage(data);

  // Cleanup the worker when the component unmounts
  return () => {
    worker.terminate();
  };
};


  const clearMessages = () => {
    setHistory([]);
    setChatStarted(false);
  };


  const copyToClipboard = (message: string) => {
    const messageWithoutPrefix = message.replace(/^(You|Peer):\s*/, '');
    navigator.clipboard.writeText(messageWithoutPrefix);
    setCopiedMessage(message);
  };


  const handlePaste = async () => {
    try {
      const permissionStatus = await navigator.permissions.query({name: 'clipboard-read' as PermissionName});
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


  const disconnectButton = () => {
    disconnectClient();
    setError("");
  }

  return (<main>
    <div className="container">
        {status === 'disconnected' && !isConnecting &&
        <div>
          {error === "id-not-found" && 
            <div className='error'>Client with this ID does not exist.</div>
          }
          {error === "server-error" &&
            <div className='error'>Connection error. Please try again.</div>
          }
          <button className='btn' onClick={() => setIsConnecting(true)}>Connect</button>
        </div>
        }
        {status === 'disconnected' && clientId && isConnecting &&
        <div>
          <QRCodeSVG value={`${window.location.href}?id=${clientId}`} includeMargin={true} size={192}/>
            <p>Scan the QR code with your phone to connect or </p>
          <a target="_blank" href={`${window.location.href}?id=${clientId}` } >Open a peer in new tab</a>
        </div>
        }

        <div className="status">
            <div className="title">Status: {status}</div>
            <div id="status"></div>
        </div>
        {pairInfo &&
        <div className="pair-info">
          <p>Your name: {clientName}</p>
          <p>Do you want to connect to this device?</p>
          <p>Device: {pairInfo}</p>
          <button className='btn' onClick={acceptPairing}>Yes</button>
          <button className='btn' onClick={() => rejectPairing()}>No</button>
        </div>
        }

        {(status === 'connected' || chatStarted) &&
         <div className="messages">
            <div className="title">Messages:</div>
            <div className="message-box">
                <div className="message-panel"></div>
                <div id="message" className="dark:bg-slate-900">
                  <pre>
                    {history.map((msg, index) => (
                      <div key={index}>
                        {msg}
                        {msg !== copiedMessage && (
                          <button
                            className="copy-btn"
                            onClick={() => copyToClipboard(msg)}
                          >
                            <BiCopy />
                          </button>
                        )}
                      </div>
                    ))}
                  </pre>
                </div>
                <input 
                  type="text"
                  className="dark:bg-black"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter a message..." 
                  autoFocus={true}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}>
                </input>
            </div>
            <div className="btns">
                <button className="btn send" onClick={handleSendMessage}>Send</button>
                <button className="btn clearMsg" onClick={clearMessages}>Clear Messages (Locally)</button>  
                <button className="btn past-clipbrd" onClick={handlePaste}>Paste clipboard</button>
                <button className='btn' onClick={() => disconnectButton()}>Disconnect</button>
                <button className='btn' onClick={handleSendFile}>Send File</button>
                <input type="file" id="input" onChange={onFileChange} />
            </div>            
        </div>}
    </div>
</main>)
}
