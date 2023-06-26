"use client"

import React, {useState, useEffect} from 'react';
import './globals.css';
import UrlID from './router';


export default function Rtc() {
    const config = {
        iceServers: [{
            urls: "stun:stun.1.google.com:19302"
          }]
    }
    const peer = new RTCPeerConnection(config);
    const dataChannel = peer.createDataChannel("chat", {
        negotiated: true,
        id: 0
    });

    const [roomState, setroomState] = useState(false)
    const [id,setid] = useState('');
    const [inputID, setinputID] = useState('');


    useEffect(() => {
        const ws = new WebSocket('ws://localhost:8080/ws');
        let id = UrlID();

        const sendData = data => {
            ws.send(JSON.stringify(data))
        }

        // function createRoom(){
        //     ws.onopen = () => {
        //         const data = JSON.parse('{"type": "createRoom", "id": ""}');
        //         sendData(data);
        //     };  
        // }  

        async function createOffer(){
            // button.disabled = true;
            console.log('Create offer')
            await peer.setLocalDescription(await peer.createOffer());
            peer.onicecandidate = ({candidate}) => {
                if (candidate) return;
                const sdp = btoa(encodeURIComponent(peer.localDescription.sdp))
                sendData(JSON.parse(`{"type": "offer", "id": "${id}", "sdp": "${sdp}"}`))
                // setOffer(peer.localDescription.sdp)
                console.log(peer.signalingState)
                // offer.select();
                // answer.placeholder = "Paste answer here. And Press Enter";
            }
        }

        async function handleOffer(offer) {
            if (peer.signalingState != "stable") return;
            // button.disabled = offer.disabled = true;
            await peer.setRemoteDescription({
              type: "offer",
              sdp: offer
            });
            await peer.setLocalDescription(await peer.createAnswer());
            peer.onicecandidate = ({candidate}) => {
                if (candidate) return;
                //answer.focus();
                const sdp = btoa(encodeURIComponent(peer.localDescription.sdp));
                sendData(JSON.parse(`{"type": "answer", "id": "${id}", "sdp": "${sdp}"}`));
                //answer.select();
            };
        }

        function handleAnswer(answer){
            console.log(peer.signalingState)
            console.log(peer)
            if (peer.signalingState != "have-local-offer") return;
                // answer.disabled = true;
                peer.setRemoteDescription({
                  type: "answer",
                  sdp: answer
                });
                console.log(peer)
        }

        ws.onopen = () => {
            console.log('WebSocket connection established');
            console.log(id);
            setTimeout(() => {
                if (id === ""){
                    const data = JSON.parse('{"type": "createRoom", "id": ""}');
                    sendData(data);
                }else {
                    const data = JSON.parse(`{"type": "joinRoom", "id": "${id}"}`);
                    sendData(data);
                }
            }, 1000)
            // You can send initial messages or perform other actions on connection open
        };

        ws.onmessage = (event) => {
            let data = JSON.parse(event.data);
            console.log('Received message:', data);

            switch (data["type"]){
                case "createSucces":
                    id = data["payload"];
                    setid(id);
                    break;
                case "joinSucces":
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
            };
            // Process the received message from the WebSocket server
        };

        ws.onclose = () => {
            console.log('WebSocket connection closed');
            // Handle the WebSocket connection close event
        };

        // Clean up the WebSocket connection on component unmount
        return () => {
            ws.close();
        };
    }, []);
    
      
    
    const log = msg => output.innerHTML += `<br/>${msg}`;
    dataChannel.onopen = () => chat.select();
    dataChannel.onmessage = e => console.log(`> ${e.data}`);
    peer.onconnectionstatechange = e => log(peer.iceConnectionState);

    peer.onconnectionstatechange = ev => handleChange();
    peer.oniceconnectionstatechange = ev => handleChange();
      
    function handleChange() {
        setStatus(`ConnectionState: ${peer.connectionState} IceConnectionState: ${peer.iceConnectionState}`);
        // status.innerHTML = stat;
        console.log('%c' + new Date().toISOString() + ': ConnectionState: %c' + peer.connectionState + ' %cIceConnectionState: %c' + peer.iceConnectionState,
          'color:yellow', 'color:orange', 'color:yellow', 'color:orange');
          console.log(peer.signalingState)

    }
    


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

            Chat: <input id="chat" onKeyPress={(e) => {
                if (e.key != 13) return;
                dataChannel.send(chat.value);
                log(chat.value);
                chat.value = "";
                }}/><br/>
            <pre id="output">Chat: </pre>
        </>
    )
}