"use client";

import React from 'react';

import './style.css';

interface PairMenuProps {
    socket: WebSocket | null;
    pairInfo: string;
    setPairInfo: React.Dispatch<React.SetStateAction<string | boolean>>;
    setError: React.Dispatch<React.SetStateAction<string>>;
    setDisconnect: React.Dispatch<React.SetStateAction<boolean>>;
    setPairingAccepted: React.Dispatch<React.SetStateAction<boolean>>;
    clientName: string;
}

const PairMenu: React.FC<PairMenuProps> = ({socket, pairInfo, setPairInfo, setError, setDisconnect, setPairingAccepted, clientName}) => {
    const acceptPairing = async () => {
        setPairingAccepted(true);
        socket!.send('accept-pairing');
        setPairInfo('');
      }
  
      const rejectPairing = async () => {
        setDisconnect(true);
        setError("Pairing was rejected. Try again.");
      }


    return (
        <div className="pair-info">
          <p>Your name: {clientName}</p>
          <p>Do you want to connect to this device?</p>
          <p>Device: {pairInfo}</p>
          <button className='btn' onClick={acceptPairing}>Yes</button>
          <button className='btn' onClick={() => rejectPairing()}>No</button>
        </div>
    );
}

export default PairMenu;