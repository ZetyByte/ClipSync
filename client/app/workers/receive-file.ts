import * as crpt from '../encryption';
import pako from 'pako';

self.onmessage = async (event: any) => {
    let encrypted = event.data.encrypted;
    let keyPair = event.data.keyPair;
    let receivedChunks = event.data.receivedChunks as Map<number, ArrayBuffer>;

    const json = JSON.parse(encrypted);
    const algorithm = {
      name: 'AES-CBC',
      length: 256
    };
    const decryptedKey = await crpt.decrypt(json.key, keyPair) as string;
    const key = await crypto.subtle.importKey('raw', crpt.stringToArrayBuffer(decryptedKey), algorithm, true, ['encrypt', 'decrypt']);
    const decryptedChunk = await crpt.decryptAES(crpt.stringToArrayBuffer(json.chunk), crpt.stringToArrayBuffer(json.iv), key);
    
    receivedChunks.set(json.currentChunk, decryptedChunk);
    // Check if all chunks have been received
    console.log("Current chunk: ", json.currentChunk, "   ", receivedChunks.size);
    if (hasKeys(receivedChunks, json.totalChunks)) {
      console.log("All chunks received");
      let totalSize = 0;
      for (let i = 1; i <= json.totalChunks; i++) {
        totalSize += receivedChunks.get(i)!.byteLength;
      }
      let receivedChunksArray = new Uint8Array(totalSize);
      for (let i = 1, offset = 0; i <= json.totalChunks; i++) {
        receivedChunksArray.set(new Uint8Array(receivedChunks.get(i)!), offset);
        offset += receivedChunks.get(i)!.byteLength;
      }
      let start = new Date().getTime();
      const decompressedChunk = pako.inflate(receivedChunksArray, { to: 'string' });
      let end = new Date().getTime();
      console.log("Decompression time: " + (end - start)/1000);
      self.postMessage({data: decompressedChunk, name: json.name});
  
      // Clear the received chunks
      receivedChunks = new Map<number, ArrayBuffer>();
    }
  };

  function hasKeys(map: Map<number, any>, desiredNumber: number): boolean {
    for (let i = 1; i <= desiredNumber; i++) {
      if (!map.has(i)) {
        return false;
      }
    }
    return true;
  }