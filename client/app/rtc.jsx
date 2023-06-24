"use client"

import React, {useState} from "react";
import './globals.css'


export default function Rtc() {
    const [offer, setOffer] = useState('')
    const [answer, setAnswer]= useState('')
    const [status, setStatus] = useState('Disconnected')
    
    // handleChange();

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
    const log = msg => output.innerHTML += `<br/>${msg}`;
    dataChannel.onopen = () => chat.select();
    dataChannel.onmessage = e => log(`> ${e.data}`);
    peer.onconnectionstatechange = e => log(peer.iceConnectionState);
    
    async function handleCreateOffer(){
        // button.disabled = true;
        console.log('Create offer')
        await peer.setLocalDescription(await peer.createOffer());
        peer.onicecandidate = ({candidate}) => {
            if (candidate) return;
            setOffer(peer.localDescription.sdp)
            console.log(peer.signalingState)
            // offer.select();
            // answer.placeholder = "Paste answer here. And Press Enter";
        }
    }

    async function handleOfferKeyPress(/*e*/) {
        if (/*e.keyCode != 13 ||*/ peer.signalingState != "stable") return;
        // button.disabled = offer.disabled = true;
        await peer.setRemoteDescription({
          type: "offer",
          sdp: offer
        });
        await peer.setLocalDescription(await peer.createAnswer());
        peer.onicecandidate = ({candidate}) => {
            if (candidate) return;
            //answer.focus();
            setAnswer(peer.localDescription.sdp);
            //answer.select();
        };
    }

    function handleAnswerKeyPress(/*e*/){
        console.log(peer.signalingState)
        console.log(peer)
        if (/*e.keyCode != 13 ||*/ peer.signalingState != "have-local-offer") return;
            // answer.disabled = true;
            peer.setRemoteDescription({
              type: "answer",
              sdp: answer
            });
            console.log(peer)
    }
    
    const handleOmessageChange = event => {
        console.log(peer.signalingState)
        setOffer(event.target.value)
    }
    const handleAmessageChange = event => {
        console.log(peer.signalingState)
        setAnswer(event.target.value)
    }
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

            <button id="button" onClick={handleCreateOffer}>Offer</button>
            <textarea placeholder="Paste offer here. And press Enter" value={offer} onChange={handleOmessageChange}></textarea> 
            <button onClick={handleOfferKeyPress}>Offer</button>
            Answer: <textarea id="answer" value={answer} onChange={handleAmessageChange}></textarea> 
            <button onClick={handleAnswerKeyPress}>Answer</button><br/>

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