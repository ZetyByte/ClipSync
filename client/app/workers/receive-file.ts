import * as crpt from '../encryption';

self.onmessage = async (event: any) => {
    let encrypted = event.data.encrypted;
    let keyPair = event.data.keyPair;

    const json = JSON.parse(encrypted);
    const algorithm = {
      name: 'AES-CBC',
      length: 256
    };
    const decryptedKey = await crpt.decrypt(json.key, keyPair) as string;
    const key = await crypto.subtle.importKey('raw', crpt.stringToArrayBuffer(decryptedKey), algorithm, true, ['encrypt', 'decrypt']);
    const decryptedChunk = await crpt.decryptAES(crpt.stringToArrayBuffer(json.chunk), crpt.stringToArrayBuffer(json.iv), key);
    self.postMessage({decryptedChunk: decryptedChunk, currentChunk: json.currentChunk, totalChunks: json.totalChunks, name: json.name});
  };