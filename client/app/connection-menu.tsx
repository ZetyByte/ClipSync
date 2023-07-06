"use client"

import React from 'react';

import './style.css';

interface PairMenuProps {
    error: string;
    setIsConnecting: React.Dispatch<React.SetStateAction<boolean>>;
}

const PairMenu: React.FC<PairMenuProps> = ({error, setIsConnecting}) => {
    return(
        <div>
        {error === "id-not-found" && 
          <div className='error'>Client with this ID does not exist.</div>
        }
        {error === "server-error" &&
          <div className='error'>Connection error. Please try again.</div>
        }
        {error === "idle-timeout-reached" && 
          <div className='error'>Idle timeout reached. You have been disconnected.</div>
        }
        <button className='btn' onClick={() => setIsConnecting(true)}>Connect</button>
      </div>
    );
}

export default PairMenu;
