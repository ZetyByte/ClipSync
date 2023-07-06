"use client";

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './style.css'
import * as crpt from './encryption';
import * as pool from './pool';
import Chat from './chat';
import PairMenu from './pair-menu';
import ConnectionMenu from './connection-menu';


const serverUrl = "ws://localhost:8080/ws";

export default function Home() {
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
  const [Disconnect, setDisconnect] = useState(false);
  var receivedChunks: { [key: number]: ArrayBuffer } = {};
  const workerPool = new pool.Pool(5);
  const encryptedStringLength = 344;

  useEffect(() => {
    if (keyPair)
    {
      workerPool.init();
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
    if (peerPublicKey && socket)
      sendClientInfo();
  }, [peerPublicKey, socket]);

  useEffect(() => {
    if (Disconnect) {
      if (socket)
      socket.close();
      if (!chatStarted)
      {
        setHistory([]);
      }
      setStatus('disconnected');
      setClientId(null);
      setKeyPair(null);
      setPeerPublicKey(null);
      setIsConnecting(false);
      setPairInfo("");
      setPairingAccepted(false);
      setPeerAccepted(false);
      receivedChunks = {};
      setClientName('');
    }
  }, [Disconnect]);

  const generateKeyPair = async () => {
    const keyPair = await crpt.generateKeyPair();
    setKeyPair(keyPair);
  }

  const generatePeerName = () => {
    let adjectives = ['Amazing', 'Awesome', 'Beautiful', 'Brave', 'Bright', 'Calm', 'Clever', 'Cool', 'Cute', 'Dazzling', 'Elegant', 'Enchanting', 'Fabulous', 'Fantastic', 'Friendly', 'Funny', 'Gentle', 'Glamorous', 'Gorgeous', 'Graceful', 'Handsome', 'Happy', 'Healthy', 'Helpful', 'Hilarious', 'Humorous', 'Jolly', 'Joyous', 'Kind', 'Lively', 'Lovely', 'Lucky', 'Magnificent', 'Nice', 'Perfect', 'Pleasant', 'Proud', 'Silly', 'Smiling', 'Splendid', 'Successful', 'Thoughtful', 'Victorious', 'Vivacious', 'Witty', 'Wonderful','Adventurous', 'Blissful', 'Charming', 'Delightful', 'Exquisite', 'Fierce', 'Glowing', 'Harmonious', 'Incredible', 'Jubilant'];

    let nouns = ['Apple', 'Banana', 'Bread', 'Butter', 'Cake', 'Carrot', 'Cheese', 'Chicken', 'Chocolate', 'Cookie', 'Cucumber', 'Egg', 'Fish', 'Garlic', 'Grape', 'Honey', 'Ice cream', 'Juice', 'Lemon', 'Lime', 'Mango', 'Milk', 'Mushroom', 'Noodles', 'Olive', 'Onion', 'Orange', 'Pasta', 'Peach', 'Pear', 'Pepper', 'Pineapple', 'Pizza', 'Potato', 'Pumpkin', 'Rice', 'Salad', 'Sandwich', 'Sausage', 'Soup', 'Steak', 'Strawberry', 'Tomato', 'Watermelon' ,'Quinoa', 'Raspberry', 'Sunflower', 'Tea', 'Vanilla', 'Walnut', 'Yogurt', 'Zucchini'];
    
    return adjectives[Math.floor(Math.random() * adjectives.length)] + ' ' + nouns[Math.floor(Math.random() * nouns.length)];
  }


  const getUrl = () => {
    if(typeof window !== undefined) {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      return serverUrl + (id ? `?id=${id}` : '');
    }
    return serverUrl;
  }

  const connectWebSocket = () => {
      let url = getUrl();
      var socket = new WebSocket(url);
      setSocket(socket);

      // Connection opened
      socket.addEventListener('open', async (event) => {
        setError("");
      });

      // Listen for messages
      socket.addEventListener('message', async (event) => {
        if (event.data === 'ping') {
          socket.send('pong');

        } else if (event.data.slice(0, 13) === 'client-info: ') {
          let encrypted = event.data.slice(13);
          let decrypted = await crpt.decrypt(encrypted, keyPair);
          setPairInfo(decrypted);

        } else if (event.data === 'connected') {
          crpt.sendPublicKey(socket!, keyPair);

        } else if (event.data.slice(0,11) === 'client-id: '){
          let clientId = event.data.slice(11);
          setClientId(clientId);

        } else if (event.data.slice(0, 12) === 'public-key: ') {
          let key = event.data.slice(12);
          setPeerPublicKey(await crpt.importAndSetPeerPublicKey(key));

        } else if (event.data.slice(0, 5) === 'msg: ') {
          // Q: Why use msg: prefix?
          // A: Maybe someone sends a message that starts with 'client-id: ' or 'public-key: '?
          let encrypted = event.data.slice(5) as string;

          let decryptedString = "";
          while (encrypted.length > encryptedStringLength) {
            decryptedString = decryptedString + await crpt.decrypt(encrypted.slice(0, encryptedStringLength), keyPair);
            encrypted = encrypted.slice(encryptedStringLength);
          }

          setHistory((prev: any) => [...prev, 'Peer: ' + decryptedString]);
          setChatStarted(true);
        } else if(event.data === 'accept-pairing'){
          setPeerAccepted(true);
        } else if(event.data.slice(0,6) === 'file: '){
          let encrypted = event.data.slice(6);
          receiveFileByChunks(encrypted);
        }
        else{
          //console.log('Received unknown message: ', event.data);
        }
      });

      socket.addEventListener('error', (error) => {
        console.error('WebSocket connection error:', error);
      });    

      socket.addEventListener('close', (event) => {
        if (event.reason === 'Client with this ID does not exist')
        {
          setError("id-not-found");
        } else if (event.reason === "Client idle timeout reached") {
          setError("idle-timeout-reached")
        } else {
          setError("server-error");
        }
        setDisconnect(true);
    });};

    const receiveFileByChunks = async (encrypted: string) => {
      const worker = new Worker(new URL('./workers/receive-file.ts', import.meta.url));
      // Define the event listener to handle messages from the worker
      const callback = function (event: MessageEvent) {
        receivedChunks[event.data.currentChunk as number] = event.data.decryptedChunk;
        let name = event.data.name;
        if (Object.keys(receivedChunks).length === event.data.totalChunks) {
          const decryper = new Worker(new URL('./workers/decompress-file.ts', import.meta.url));

          decryper.onmessage = function (event) {
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(event.data.data);
            downloadLink.download = name;
        
            // Trigger the download
            downloadLink.click();
            downloadLink.remove();
            receivedChunks = {};
          };

          decryper.postMessage({receivedChunks: receivedChunks, type: event.data.type});
          return () => {
            decryper.terminate();
          }
        }
      };

      // Send data to the worker
      const data = {encrypted: encrypted, keyPair: keyPair, receivedChunks: receivedChunks};
      workerPool.addWorkerTask(new pool.WorkerTask(worker, callback, data));
    }
    
    const sendClientInfo = async () => {
      var peerName = generatePeerName();
      let encryptedString = await crpt.encrypt(peerName, peerPublicKey);
      setClientName(peerName);
      socket!.send("client-info: " + encryptedString);
    }

  return (<main>
    <div className="container">
        {status === 'disconnected' && !isConnecting &&
           <ConnectionMenu setIsConnecting={setIsConnecting} error={error}/>
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
            <PairMenu socket={socket} pairInfo={pairInfo as string}
            setPairInfo={setPairInfo} setPairingAccepted={setPairingAccepted}
            setDisconnect={setDisconnect} setError={setError}
            clientName={clientName}/>
        }

        {(status === 'connected' || chatStarted) &&
            <Chat socket={socket} peerPublicKey={peerPublicKey} 
            setChatStarted={setChatStarted} disconnectClient={setDisconnect}
            history={history} setHistory={setHistory}
            setError={setError}/>
        }
    </div>
</main>)
}