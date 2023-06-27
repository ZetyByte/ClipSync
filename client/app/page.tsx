"use client";

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BiCopy } from 'react-icons/bi';
import './style.css'
import JSEncrypt from 'jsencrypt';
import JSON from 'json3';
import pako from 'pako';

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
  var receivedChunks: string = "";
  
  interface File {
    name: string,
    file: string,
    key: string,
    iv: string
  }

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

  const sendFile = async (file: any) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
    const reader = new FileReader();
  
    if (file) {
      reader.onload = async () => {
        const base64Data = reader.result! as string;
        console.log("Original file: ", base64Data.length);
        let start = new Date;
        const compressedData = pako.deflate(base64Data);
        let end = new Date;
        console.log("Compression time: ", (end.getTime() - start.getTime())/1000);
        console.log("Compressed file: ", compressedData.length);
  
        const totalChunks = Math.ceil(compressedData.length / CHUNK_SIZE);
        let totalSize = 0;
        for (let i = 0; i < totalChunks; i++) {
          let sendStart = new Date;
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, compressedData.length);
          const chunk = compressedData.slice(start, end);
          totalSize += chunk.length;
          console.log("Chunk size ", i, ": ", chunk.length);
  
          const key = await generateAESKey();
          let startEncr = new Date;
          const encryptedChunk = await encryptAES(arrayBufferToString(chunk.buffer), key);
          let endEncr = new Date;
          console.log("Encryption time", i, ": ", (endEncr.getTime() - startEncr.getTime())/1000);
          const exportedKey = await crypto.subtle.exportKey("raw", key);
          const stringKey = arrayBufferToString(exportedKey);
  
          const encryptedData = JSON.stringify({
            name: file.name,
            key: await encrypt(stringKey),
            iv: arrayBufferToString(encryptedChunk.iv.buffer),
            chunk: arrayBufferToString(encryptedChunk.encryptedData),
            totalChunks: totalChunks,
            currentChunk: i + 1,
          });
  
          socket!.send("file: " + encryptedData);
          let sendEnd = new Date;
          console.log("Send time", i, ": ", (sendEnd.getTime() - sendStart.getTime())/1000);
        }
        console.log("Total size: ", totalSize);
      };
  
      reader.readAsDataURL(file);
      reader.onerror = (error) => {
        console.log("error: ", error);
      };
    }
  };
  

function arrayBufferToString(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer);

  let asciiString = '';
  for (let i = 0; i < view.length; i++) {
    const asciiChar = String.fromCharCode(view[i]);
    asciiString += asciiChar;
  }
  return asciiString;
}

function stringToArrayBuffer(str: string): ArrayBuffer {
  const view = new Uint8Array(str.length);

  for (let i = 0; i < str.length; i++) {
    view[i] = str.charCodeAt(i);
  }
  
  return view.buffer;
}
  

// Generate a random AES key
async function generateAESKey() {
  return await crypto.subtle.generateKey(
    {
      name: "AES-CBC",
      length: 256, // Key size in bits
    },
    true, // Extractable key
    ["encrypt", "decrypt"]
  );
}

// Encrypt data using AES
async function encryptAES(data: string, key: CryptoKey): Promise<{ encryptedData: ArrayBuffer, iv: Uint8Array }>  {
  // Convert the data to an ArrayBuffer
  const dataArrayBuffer = stringToArrayBuffer(data);

  // Generate an initialization vector (IV)
  const iv = crypto.getRandomValues(new Uint8Array(16));

  // Encrypt the data with AES-CBC
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv: iv,
    },
    key,
    dataArrayBuffer
  );

  // Return the encrypted data and IV as an object
  return {
    encryptedData: encryptedData,
    iv: iv,
  };
}

async function decryptAES(encryptedData: BufferSource, iv : BufferSource , key: CryptoKey) {
  // Decrypt the data with AES-CBC
  const decryptedData = await crypto.subtle.decrypt(
    {
      name: "AES-CBC",
      iv: iv,
    },
    key,
    encryptedData
  );

  // Convert the decrypted data (ArrayBuffer) to a string
  const decryptedString = arrayBufferToString(decryptedData);

  return decryptedString;
}
  
  const encrypt = async (message: string) => {
    let publicKeyBuffer = await subtle.exportKey("spki", peerPublicKey!)
    let publicKey = Buffer.from(publicKeyBuffer).toString('base64');
    const jsEncrypt = new JSEncrypt();
    jsEncrypt.setPublicKey(publicKey);
    return jsEncrypt.encrypt(message);
  }

  const decrypt = async (message: string) => {
    let privateKeyBuffer = await subtle.exportKey("pkcs8", keyPair!.privateKey)
    let privateKey = Buffer.from(privateKeyBuffer).toString('base64');
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
  }


  const sendPublicKey = async (socket: WebSocket) => {
    let publicKeyBuffer = await subtle.exportKey("spki", keyPair!.publicKey);
    let publicKey = Buffer.from(publicKeyBuffer).toString('base64');
    socket.send('public-key: ' + publicKey);
  }


  const importAndSetPeerPublicKey = async (key: string) => {
    let publicKey = await subtle.importKey("spki", Buffer.from(key, 'base64'), {name: "RSA-OAEP", hash: "SHA-256"}, true, ["encrypt"]);
    setPeerPublicKey(publicKey);
    console.log('Imported public key: ', publicKey);
  }


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
        let decrypted = await decrypt(encrypted);
        console.log('Decrypted client info: ', decrypted);
        setPairInfo(decrypted);

      } else if (event.data === 'connected') {
        sendPublicKey(socket!);

      } else if (event.data.slice(0,11) === 'client-id: '){
        let clientId = event.data.slice(11);
        console.log('Received client id: ', clientId);
        setClientId(clientId);

      } else if (event.data.slice(0, 12) === 'public-key: ') {
        console.log('Received public key: ', event.data.slice(12));
        let key = event.data.slice(12);
        importAndSetPeerPublicKey(key);

      } else if (event.data.slice(0, 5) === 'msg: ') {
        // Q: Why use msg: prefix?
        // A: Maybe someone sends a message that starts with 'client-id: ' or 'public-key: '?
        let encrypted = event.data.slice(5);

        let decryptedString = await decrypt(encrypted);
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
      let encryptedString = await encrypt(peerName);
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
    
      const decryptedKey = await decrypt(json.key) as string;
      console.log("1");
      const key = await crypto.subtle.importKey('raw', stringToArrayBuffer(decryptedKey), algorithm, true, ['encrypt', 'decrypt']);
      console.log("2");
      const decryptedChunk = await decryptAES(stringToArrayBuffer(json.chunk), stringToArrayBuffer(json.iv), key);
      console.log("3");
      // Append the received chunk to the file
      receivedChunks += decryptedChunk;
      console.log(decryptedChunk.length);
      // Check if all chunks have been received
      if (json.currentChunk === json.totalChunks) {
        console.log("Total size: " + receivedChunks.length)
        const decompressedChunk = pako.inflate(stringToArrayBuffer(receivedChunks));
        console.log("4");
    
        const downloadLink = document.createElement('a');
        downloadLink.href = arrayBufferToString(decompressedChunk);
        downloadLink.download = json.name;
    
        // Trigger the download
        downloadLink.click();
    
        // Clear the received chunks
        receivedChunks = "";
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

    let encryptedString = await encrypt(text);
    socket.send("msg: " + encryptedString);
    setMessage('');
    setChatStarted(true);
  };


  const handleSendMessage = async () => {
    await sendMessage(message);
  };

  const handleSendFile = async () => {
    await sendFile(selectetdFile[0]);
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
