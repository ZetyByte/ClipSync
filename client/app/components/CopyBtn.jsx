import React from 'react'
import { BiCopy } from 'react-icons/bi';
import styles from './CopyBtn.module.css';

export default function CopyBtn({msg, handleClick})  {
  return (
    <button 
        msg = {msg}
        className={styles.copy-btn} 
        onClick={handleClick}
        >
        <BiCopy />
    </button>
  )
}
