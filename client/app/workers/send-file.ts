import * as crpt from '../encryption';
import pako from 'pako';

self.onmessage = async (event: any) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
    const reader = new FileReader();
    let file = event.data.file as File;
  
    if (file) {
      reader.onload = async () => {
        const base64Data = reader.result! as ArrayBuffer;
        let start = new Date;
        const compressedData = pako.deflate(base64Data);
        let end = new Date;
        console.log("Compression time: ", (end.getTime() - start.getTime())/1000);
        console.log("Compressed file: ", compressedData.length);
  
        const totalChunks = Math.ceil(compressedData.length / CHUNK_SIZE);
        let totalSize = 0;
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, compressedData.length);
          const chunk = compressedData.slice(start, end);
          totalSize += chunk.length;
          console.log("Chunk ", i);
  
          const key = await crpt.generateAESKey();
          const encryptedChunk = await crpt.encryptAES(chunk.buffer, key);
          const exportedKey = await crypto.subtle.exportKey("raw", key);
          const stringKey = crpt.arrayBufferToString(exportedKey);
  
          const encryptedData = JSON.stringify({
            name: file.name,
            key: await crpt.encrypt(stringKey, event.data.peerPublicKey),
            iv: crpt.arrayBufferToString(encryptedChunk.iv.buffer),
            chunk: crpt.arrayBufferToString(encryptedChunk.encryptedData),
            totalChunks: totalChunks,
            currentChunk: i + 1,
            type: file.type
          });
  
          self.postMessage("file: " + encryptedData);
        }
      };
      
      reader.onerror = function(event) {
        const error = event.target!.error;
        console.error("Error occurred during file reading:", error);
        console.log("Error code: " + reader.error);
      };
      
      reader.readAsArrayBuffer(file);
    }
  };