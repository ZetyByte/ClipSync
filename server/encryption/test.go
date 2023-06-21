package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"log"
)

func encryptMessage(base64SPKI string, message []byte) (string, error) {
	// Decode the Base64 string
	decodedKey, err := base64.StdEncoding.DecodeString(base64SPKI)
	if err != nil {
		fmt.Println("Failed to decode Base64 key:", err)
		return "", err
	}

	// Create a PEM block using the decoded key
	pemBlock := &pem.Block{
		Type:  "RSA PUBLIC KEY",
		Bytes: decodedKey,
	}

	// Encode the PEM block to PEM format
	pemPublicKey := pem.EncodeToMemory(pemBlock)
	block, _ := pem.Decode(pemPublicKey)
	if block == nil {
		fmt.Println("Failed to decode PEM block containing public key")
		return "", err
	}
	publicKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		fmt.Println("Failed to parse public key:", err)
		return "", err
	}
	rsaPublicKey, ok := publicKey.(*rsa.PublicKey)
	if !ok {
		fmt.Println("Key type is not RSA")
		return "", err
	}

	// Encrypt the message using the public key
	encryptedMessage, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, rsaPublicKey, message, nil)
	if err != nil {
		fmt.Println("Failed to encrypt message:", err)
		return "", err
	}
	converted := base64.StdEncoding.EncodeToString(encryptedMessage)
	fmt.Println("Encrypted message:", string(converted))
	return string(converted), nil
}

func main() {
	key := "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqWwJQraE3rTInikek1TxlHIu0FQKcP8+MAOMS6zzHPudTFAuTFDW1sPtQVyx/KOPImjnq8wSRQPZd5g3Nzd0LZPRidneKhOIGdkOogRY7KVu4pULRr920fgUsQLXqFhUJuBl2cZC/QzXP4VKqRlsLaeKfRmimfN19Vw1PMaACIV/7BILSXFG9XhUZLhdEx4qfAuTDYUYZs2CCXqeDHpHmTrFT5ldDjrx1dTxJMuJd8Q4Ib053LPufqR4TBKFUYdFt22mN2w0XM3DPuHZV3X0kp5jCIpZ1kVcpDUTGpKsMLDwZeZonVMqWO4d2dhdmy29YtshJ2kGh5qvafeEdP2NTQIDAQAB"
	message := "Hello"
	encrypted, err := encryptMessage(key, []byte(message))
	if err != nil {
		log.Println("Error encrypting message:", err)
		return
	}
	fmt.Println(encrypted)
}
