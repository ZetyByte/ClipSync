"use client"

import React, {useState, useEffect} from 'react';
import './globals.css';
import UrlID from './router';


export default function Rtc() {
    // Config for RTCPeerConnectiom
    const config = {
        iceServers: [{
            urls: "stun:stun.1.google.com:19302"
          }]
    }

    // Create local peer and open data channel 
    const peer = new RTCPeerConnection(config);
    const dataChannel = peer.createDataChannel("chat", {
        negotiated: true,
        id: 0
    });

    // 
    const [status, setStatus] = useState('');
    const [id,setid] = useState('');

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:8080/ws');
        let id = UrlID();
        if (id === null) id = '';

        const sendData = data => {
            // Send data to signaling server
            ws.send(JSON.stringify(data));
        }

        async function createOffer(){
            console.log('Create offer');
            await peer.setLocalDescription(await peer.createOffer());
            peer.onicecandidate = ({candidate}) => {
                if (candidate) return;
                const sdp = btoa(encodeURIComponent(peer.localDescription.sdp));
                sendData(JSON.parse(`{"type": "offer", "id": "${id}", "sdp": "${sdp}"}`));
                console.log(peer.signalingState);
            }
        }

        async function handleOffer(offer) {
            if (peer.signalingState != "stable") return;
            await peer.setRemoteDescription({
              type: "offer",
              sdp: offer
            });
            await peer.setLocalDescription(await peer.createAnswer());
            peer.onicecandidate = ({candidate}) => {
                if (candidate) return;
                const sdp = btoa(encodeURIComponent(peer.localDescription.sdp));
                sendData(JSON.parse(`{"type": "answer", "id": "${id}", "sdp": "${sdp}"}`));
            };
        }

        function handleAnswer(answer){
            console.log(peer.signalingState)
            console.log(peer)
            if (peer.signalingState != "have-local-offer") return;
                peer.setRemoteDescription({
                  type: "answer",
                  sdp: answer
                });
                console.log(peer)
        }

        ws.onopen = () => {
            // Creating or joining room
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
            }, 500)
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
        console.log('%c' + new Date().toISOString() + ': ConnectionState: %c' + peer.connectionState + ' %cIceConnectionState: %c' + peer.iceConnectionState,
          'color:yellow', 'color:orange', 'color:yellow', 'color:orange');
    }
    


    return (
        <>
            <p id='status'>{status}</p>
            <div>
                <a href={`http://localhost:3000/?id=${id}`} target="_blank">{id}</a>
            </div>

            {/* Chat: <input id="chat" onKeyPress={(e) => {
                if (e.key != 13) return;
                dataChannel.send(chat.value);
                log(chat.value);
                chat.value = "";
                }}/><br/>
            <pre id="output">Chat: </pre> */}


        </>
    )
}