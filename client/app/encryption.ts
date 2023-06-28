import JSEncrypt from 'jsencrypt';
const { subtle } = globalThis.crypto;

// Generate a random AES key
export async function generateAESKey() {
    return await crypto.subtle.generateKey(
      {
        name: "AES-CBC",
        length: 256, // Key size in bits
      },
      true, // Extractable key
      ["encrypt", "decrypt"]
    );
  }
  
  // Encrypt data using AES
  export  async function encryptAES(data: ArrayBuffer, key: CryptoKey): Promise<{ encryptedData: ArrayBuffer, iv: Uint8Array }>  {
    // Generate an initialization vector (IV)
    const iv = crypto.getRandomValues(new Uint8Array(16));
  
    // Encrypt the data with AES-CBC
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "AES-CBC",
        iv: iv,
      },
      key,
      data
    );
  
    // Return the encrypted data and IV as an object
    return {
      encryptedData: encryptedData,
      iv: iv,
    };
  }
  
  export async function decryptAES(encryptedData: BufferSource, iv : BufferSource , key: CryptoKey): Promise<ArrayBuffer> {
    // Decrypt the data with AES-CBC
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-CBC",
        iv: iv,
      },
      key,
      encryptedData
    );
  
    return decryptedData;
  }
    
  export async function encrypt (message: string, peerPublicKey: CryptoKey | null) {
      let publicKeyBuffer = await subtle.exportKey("spki", peerPublicKey!)
      let publicKey = Buffer.from(publicKeyBuffer).toString('base64');
      const jsEncrypt = new JSEncrypt();
      jsEncrypt.setPublicKey(publicKey);
      return jsEncrypt.encrypt(message);
    }
  
    export async function decrypt (message: string, keyPair: CryptoKeyPair | null ) {
      let privateKeyBuffer = await subtle.exportKey("pkcs8", keyPair!.privateKey)
      let privateKey = Buffer.from(privateKeyBuffer).toString('base64');
      const jsEncrypt = new JSEncrypt();
      jsEncrypt.setPrivateKey(privateKey);
      return jsEncrypt.decrypt(message);
    }
  
    export async function generateKeyPair (): Promise<CryptoKeyPair>  {
      let localKeyPair = await subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
      );
      return localKeyPair
    }
  
  
    export async function sendPublicKey (socket: WebSocket , keyPair: CryptoKeyPair | null) {
      let publicKeyBuffer = await subtle.exportKey("spki", keyPair!.publicKey);
      let publicKey = Buffer.from(publicKeyBuffer).toString('base64');
      socket.send('public-key: ' + publicKey);
    }
  
  
    export async function importAndSetPeerPublicKey (key: string) {
      return await subtle.importKey("spki", Buffer.from(key, 'base64'), {name: "RSA-OAEP", hash: "SHA-256"}, true, ["encrypt"]);
    }
  
  
  export function arrayBufferToString(buffer: ArrayBuffer): string {
    const view = new Uint8Array(buffer);
    const length = view.length;
    const result = new Array(length);
  
    for (let i = 0; i < length; i++) {
      result[i] = String.fromCharCode(view[i]);
    }
  
    return result.join('');
  }  

export function stringToArrayBuffer(str: string): ArrayBuffer {
  const view = new Uint8Array(str.length);

  for (let i = 0; i < str.length; i++) {
    view[i] = str.charCodeAt(i);
  }
  
  return view.buffer;
}