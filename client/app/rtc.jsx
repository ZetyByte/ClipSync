import React from "react";

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
  
const stat = "test"

async function createOffer(){
    // button.disabled = true;
    await peer.setLocalDescription(await peer.createOffer());
    peer.onicecandidate = ({candidate}) => {
        if (candidate) return;
        offer.value = peer.localDescription.sdp;
        offer.select();
        answer.placeholder = "Paste answer here. And Press Enter";
    }
}
  
peer.onconnectionstatechange = ev => handleChange();
peer.oniceconnectionstatechange = ev => handleChange();
  
function handleChange() {
    let stat = 'ConnectionState: <strong>' + peer.connectionState + '</strong> IceConnectionState: <strong>' + peer.iceConnectionState + '</strong>';
    // status.innerHTML = stat;
    console.log('%c' + new Date().toISOString() + ': ConnectionState: %c' + peer.connectionState + ' %cIceConnectionState: %c' + peer.iceConnectionState,
      'color:yellow', 'color:orange', 'color:yellow', 'color:orange');
}


export default function Rtc() {
    handleChange();

    return (
        <>
            <p id='status'></p>
            <button id="button" onClick={createOffer()}>Offer</button>
            <textarea id="offer" placeholder="Paste offer here. And press Enter" onkeypress={{async function(e) {
                    if (e.keyCode != 13 || peer.signalingState != "stable") return;
                    button.disabled = offer.disabled = true;
                    await peer.setRemoteDescription({
                      type: "offer",
                      sdp: offer.value
                    });
                    await peer.setLocalDescription(await peer.createAnswer());
                    peer.onicecandidate = ({
                      candidate
                    }) => {
                      if (candidate) return;
                      answer.focus();
                      answer.value = peer.localDescription.sdp;
                      answer.select();
                    };
                }
            }}></textarea> 
            Answer: <textarea id="answer" onkeypress={(e) =>{
                if (e.keyCode != 13 || peer.signalingState != "have-local-offer") return;
                answer.disabled = true;
                peer.setRemoteDescription({
                  type: "answer",
                  sdp: answer.value
                });
            }}></textarea><br/> 
            Chat: <input id="chat" onkeypress={(e) => {
                if (e.key != 13) return;
                dataChannel.send(chat.value);
                log(chat.value);
                chat.value = "";
                }}/><br/>
            <pre id="output">Chat: </pre>
        </>
    )
}