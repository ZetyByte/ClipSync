import React, { useState, useEffect } from 'react';
import './globals.css';

export default function Home() {
  const config = {
    iceServers: [
      {
        urls: "stun:stun.1.google.com:19302"
      }
    ]
  };
  
  const peer = new RTCPeerConnection(config);
  const dataChannel = peer.createDataChannel("chat", {
    negotiated: true,
    id: 0
  });

  const getUrlID = (): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    return id;
  };

  const [status, setStatus] = useState('');
//   const [roomState, setRoomState] = useState(false);
  const [id, setId] = useState<string | null>(null); 
//   const [inputID, setInputID] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080/ws');
    let roomID = getUrlID();

    const sendData = (data: any) => {
      ws.send(JSON.stringify(data));
    };

    async function createOffer() {
      console.log('Create offer');
      await peer.setLocalDescription(await peer.createOffer());
      peer.onicecandidate = ({ candidate }) => {
        if (candidate) return;
        const sdp = btoa(encodeURIComponent(peer.localDescription!.sdp));
        sendData(JSON.parse(`{"type": "offer", "id": "${roomID}", "sdp": "${sdp}"}`));
        console.log(peer.signalingState);
      };
    }

    async function handleOffer(offer: string) {
      if (peer.signalingState !== "stable") return;
      await peer.setRemoteDescription({
        type: "offer",
        sdp: offer
      });
      await peer.setLocalDescription(await peer.createAnswer());
      peer.onicecandidate = ({ candidate }) => {
        if (candidate) return;
        const sdp = btoa(encodeURIComponent(peer.localDescription!.sdp));
        sendData(JSON.parse(`{"type": "answer", "id": "${roomID}", "sdp": "${sdp}"}`));
      };
    }

    function handleAnswer(answer: string) {
      if (peer.signalingState !== "have-local-offer") return;
      peer.setRemoteDescription({
        type: "answer",
        sdp: answer
      });
    }

    ws.onopen = () => {
      console.log('WebSocket connection established');
      console.log(roomID);
      setTimeout(() => {
        if (!roomID) {
          const data = JSON.parse('{"type": "createRoom", "id": ""}');
          sendData(data);
        } else {
          const data = JSON.parse(`{"type": "joinRoom", "id": "${roomID}"}`);
          sendData(data);
        }
      }, 1000);
    };

    ws.onmessage = (event) => {
      let data = JSON.parse(event.data);
      console.log('Received message:', data);

      switch (data["type"]) {
        case "createSuccess":
          roomID = data["payload"];
          setId(roomID);
          break;
        case "joinSuccess":
          createOffer();
          break;
        case "offer":
          const offer = decodeURIComponent(atob(data["payload"]));
          handleOffer(offer);
          break;
        case "answer":
          const answer = decodeURIComponent(atob(data["payload"]));
          handleAnswer(answer);
          break;
      }
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleChange = () => {
    setStatus(`ConnectionState: ${peer.connectionState} | IceConnectionState: ${peer.iceConnectionState}`);
    console.log(`%c${new Date().toISOString()}: ConnectionState: %c${peer.connectionState} %cIceConnectionState: %c${peer.iceConnectionState}`,
      'color:yellow', 'color:orange', 'color:yellow', 'color:orange');
    console.log(peer.signalingState);
  };

  peer.onconnectionstatechange = handleChange;
  peer.oniceconnectionstatechange = handleChange;

  const handleSendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    if (inputMessage.trim() !== '') {
      dataChannel.send(inputMessage);
      setMessages([...messages, `You: ${inputMessage}`]);
      setInputMessage('');
    }
  };

//   dataChannel.onopen = () => chat.select();
  dataChannel.onmessage = (event) => {
    const receivedMessage = event.data;
    setMessages([...messages, `Peer: ${receivedMessage}`]);
  };

  return (
    <>
            <p id='status'>{status}</p>
            <div>
                <a href={`http://localhost:3000/?id=${id}`} target="_blank">{id}</a>
            </div>

            {/* <button id="button" onClick={handleCreateOffer}>Offer</button>
            <textarea placeholder="Paste offer here. And press Enter" value={offer} onChange={handleOmessageChange}></textarea> 
            <button onClick={handleOfferKeyPress}>Offer</button>
            Answer: <textarea id="answer" value={answer} onChange={handleAmessageChange}></textarea> 
            <button onClick={handleAnswerKeyPress}>Answer</button><br/> */}

            <p>Chat</p>
            <input id="chat" onKeyDown={(e) => {
                if(e.key === 'Enter') {
                    handleSendMessage(e);
                }
                }}/><br/>
            <pre id="output">Output: </pre>
    </>
  );
}
