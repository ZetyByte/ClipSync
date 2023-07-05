"use client";

import React, { useEffect, useState } from 'react';
import { BiCopy } from 'react-icons/bi';
import './style.css';
import * as crpt from './encryption';

interface ChatProps {
    socket: WebSocket | null;
    peerPublicKey: CryptoKey | null;
    setChatStarted: React.Dispatch<React.SetStateAction<boolean>>;
    setHistory: React.Dispatch<React.SetStateAction<string[]>>;
    history: string[];
    setError: React.Dispatch<React.SetStateAction<string>>;
    disconnectClient: React.Dispatch<React.SetStateAction<boolean>>;
}

const Chat: React.FC<ChatProps> = ({socket, peerPublicKey, setChatStarted, setHistory, history, setError, disconnectClient}) => {
    const [message, setMessage] = useState('');
    const [copiedMessage, setCopiedMessage] = useState('');
    const [selectetdFile, setSelectedFile] = useState([]);

    const handleSendMessage = async () => {
        await sendMessage(message);
      };
    
      const handleSendFile = async () => {
        console.log(new Date().toLocaleTimeString())
        const worker = new Worker(new URL('./workers/send-file.ts', import.meta.url));
    
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
    
      

    const onFileChange = (e: any) => {
        const maxFileSize = 200 * 1024 * 1024;
        if (e.target.files[0] && e.target.files[0].size > maxFileSize) {
        alert('Max file size is ' + maxFileSize / 1024 / 1024 + 'MB.')
        e.target.value = null;
        }
        else {
        setSelectedFile(e.target.files);
        console.log(e.target.files[0]);
        console.log(e.target.files[0].name);
        console.log(e.target.files[0].size);
        console.log(e.target.files[0].type);
        }
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
        disconnectClient(true);
        setError("");
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

    return (
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
        </div>
    );
}

export default Chat;