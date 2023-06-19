package encryption

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"

	"golang.org/x/crypto/ssh"
)

func encodeRSAPrivateKey(priv *rsa.PrivateKey) string {
	return string(pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(priv),
	}))
}

func generateKeyPair() (string, string, error) {
	reader := rand.Reader
	bitSize := 2048

	keyPair, err := rsa.GenerateKey(reader, bitSize)
	if err != nil {
		return "", "", err
	}

	pubKey, err := ssh.NewPublicKey(&keyPair.PublicKey)
	if err != nil {
		return "", "", err
	}
	pubKeyStr := string(ssh.MarshalAuthorizedKey(pubKey))
	privKeyStr := encodeRSAPrivateKey(keyPair)

	return pubKeyStr, privKeyStr, nil
}

func encryptMessage(message, publicKey string) (string, error) {
	parsedKey, _, _, _, err := ssh.ParseAuthorizedKey([]byte(publicKey))
	if err != nil {
		return "", err
	}

	parsedCryptoKey := parsedKey.(ssh.CryptoPublicKey)
	pubCrypto := parsedCryptoKey.CryptoPublicKey()
	pubKey, ok := pubCrypto.(*rsa.PublicKey)
	if !ok {
		return "", fmt.Errorf("invalid public key type")
	}

	encryptedBytes, err := rsa.EncryptOAEP(
		sha256.New(),
		rand.Reader,
		pubKey,
		[]byte(message),
		nil)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(encryptedBytes), nil
}

func decryptMessage(data, privateKey string) (string, error) {
	dataBytes, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return "", err
	}

	block, _ := pem.Decode([]byte(privateKey))
	if block == nil {
		return "", fmt.Errorf("failed to decode private key PEM block")
	}

	key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return "", err
	}

	decrypted, err := rsa.DecryptOAEP(sha256.New(),
		rand.Reader, key, dataBytes, nil)
	if err != nil {
		return "", err
	}
	return string(decrypted), nil
}

// func main() {
// 	pubKey, privKey, _ := generateKeyPair()

// 	fmt.Println("---------------Public key:")
// 	fmt.Println(pubKey)
// 	fmt.Println("---------------Private key:")
// 	fmt.Println(privKey)

// 	message := "ыыаываыв43  цуцпваы"
// 	enc, _ := encryptMessage(message, pubKey)
// 	fmt.Println("Encrypted message:")
// 	fmt.Println(enc)
// 	dec, _ := decryptMessage(enc, privKey)
// 	fmt.Println("Decrypted message:")
// 	fmt.Println(dec)

// }
