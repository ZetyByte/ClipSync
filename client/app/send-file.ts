import * as crpt from './encryption';
import pako from 'pako';

self.onmessage = async (event: any) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
    const reader = new FileReader();
    let file = event.data.file;
  
    if (file) {
      reader.onload = async () => {
        const base64Data = reader.result! as string;
        console.log("Original file: ", base64Data.length);
        let start = new Date;
        const compressedData = pako.deflate(base64Data);
        let end = new Date;
        console.log("Compression time: ", (end.getTime() - start.getTime())/1000);
        console.log("Compressed file: ", compressedData.length);
  
        const totalChunks = Math.ceil(compressedData.length / CHUNK_SIZE);
        let totalSize = 0;
        for (let i = 0; i < totalChunks; i++) {
          let sendStart = new Date;
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, compressedData.length);
          const chunk = compressedData.slice(start, end);
          totalSize += chunk.length;
          console.log("Chunk size ", i, ": ", chunk.length);
  
          const key = await crpt.generateAESKey();
          let startEncr = new Date;
          const encryptedChunk = await crpt.encryptAES(chunk.buffer, key);
          let endEncr = new Date;
          console.log("Encryption time", i, ": ", (endEncr.getTime() - startEncr.getTime())/1000);
          const exportedKey = await crypto.subtle.exportKey("raw", key);
          const stringKey = crpt.arrayBufferToString(exportedKey);
  
          const encryptedData = JSON.stringify({
            name: file.name,
            key: await crpt.encrypt(stringKey, event.data.peerPublicKey),
            iv: crpt.arrayBufferToString(encryptedChunk.iv.buffer),
            chunk: crpt.arrayBufferToString(encryptedChunk.encryptedData),
            totalChunks: totalChunks,
            currentChunk: i + 1,
          });
  
          self.postMessage("file: " + encryptedData);
          let sendEnd = new Date;
          console.log("Send time", i, ": ", (sendEnd.getTime() - sendStart.getTime())/1000);
        }
        console.log("Total size: ", totalSize);
      };
  
      reader.readAsDataURL(file);
      reader.onerror = (error) => {
        console.log("error: ", error);
      };
    }
  };