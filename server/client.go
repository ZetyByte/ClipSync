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
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 10 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 4096

	// Time allowed to get Key from the client.
	getKeyWait = 10 * time.Second
)

type Client struct {
	server *Server

	conn *websocket.Conn

	sendMessage chan string

	peerID string

	pair *Client

	mutex sync.Mutex

	publicKey []byte
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func (c *Client) closeConnection() error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	var err error

	if c.pair != nil {
		err = c.pair.conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseAbnormalClosure, "Closing connection"), time.Now().Add(time.Second*1))
		if err != nil {
			log.Println("Error writing control message:", err)
			return err
		}

		err = c.pair.conn.Close()
		if err != nil {
			log.Println("Error closing connection:", err)
			return err
		}
	}

	return nil
}

// Writes data to websocket.
func (c *Client) writeData() {
	for {
		if c.pair != nil {
			message := <-c.pair.sendMessage
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			err := c.conn.WriteMessage(websocket.TextMessage, []byte(message))
			if err != nil {
				log.Println("Error writing message:", err)
				c.closeConnection()
				return
			}
		}
	}
}

func (c *Client) sendPing() {
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()

	for range ticker.C {
		if err := c.conn.WriteControl(websocket.PingMessage, []byte("ping"), time.Now().Add(writeWait)); err != nil {
			log.Println("Error sending ping:", err)
			c.closeConnection()
			return
		}
	}
}

// Reads data from websocket and places it into data channel.
func (c *Client) readData() {
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			log.Println("Error reading message:", err)
			c.closeConnection()
			return
		}
		c.sendMessage <- string(message)
	}
}

func (c *Client) onConnect() {
	c.conn.WriteMessage(websocket.TextMessage, []byte("connected"))
	c.conn.WriteMessage(websocket.TextMessage, c.publicKey)
}

// Handle creates a new client and lets the server process it.
func handle(s *Server, w http.ResponseWriter, r *http.Request, m *sync.Mutex) {
	log.Println("New client connected")

	// added for testing purposes
	upgrader.CheckOrigin = func(r *http.Request) bool { return true }

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading connection:", err)
		return
	}
	conn.SetReadLimit(maxMessageSize)
	conn.SetReadDeadline(time.Now().Add(getKeyWait))

	client := Client{
		server:      s,
		conn:        conn,
		sendMessage: make(chan string),
	}

	var publicKey string
	if _, message, err := conn.ReadMessage(); err != nil {
		log.Println("Error reading message:", err)
		client.closeConnection()
		return
	} else {
		client.publicKey = message
		publicKey = string(message)[12:]
	}
	log.Println("Public key:", publicKey)

	// Read ID from query.
	// If ID is empty, then it is the first client, it is added to the map of clients using its ID from header
	// and waits for the second client.
	// If ID is not empty, then it is the second client, it is added to the channel to wait for its turn to be processed.
	if id := r.URL.Query().Get("id"); id == "" {
		ok := true
		for ok {
			id = uuid.New().String()
			id = "49fe9607-07c6-4df3-a571-6c6b964d1331"
			m.Lock()
			_, ok = s.clients[id]
			m.Unlock()
		}

		m.Lock()
		s.clients[id] = &client
		m.Unlock()

		encrypted, err := encryptMessage(publicKey, []byte(id))
		if err != nil {
			log.Println("Error encrypting message:", err)
			client.closeConnection()
			return
		}

		if err = conn.WriteMessage(websocket.TextMessage, []byte("client-id: "+encrypted)); err != nil {
			log.Println("Error writing message:", err)
			return
		}
	} else {
		client.peerID = id
		s.registerID <- &client
	}

	go client.readData()
	go client.writeData()
	go client.sendPing()
}

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

/*
	func encryptMessage(base64SPKI string, message []byte) (string, error) {
		log.Println("Encrypting message:", string(message))
		// Decode the base64-encoded public key string
		publicKeyBytes, err := base64.StdEncoding.DecodeString(base64SPKI)
		if err != nil {
			log.Println("Error decoding base64 string:", err)
			return "", err
		}

		publicKey, err := x509.ParsePKIXPublicKey(publicKeyBytes)
		if err != nil {
			log.Println("Error parsing public key:", err)
			return "", err
		}
		log.Println("Public key:", publicKey)
		rsaPublicKey, ok := publicKey.(*rsa.PublicKey)
		if !ok {
			return "", fmt.Errorf("not an RSA public key")
		}
		log.Println("RSA public key:", rsaPublicKey)
		// Encrypt the string using the public key
		ciphertext, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, rsaPublicKey, message, nil)
		if err != nil {
			return "", err
		}

		encryptedMessageBase64 := base64.StdEncoding.EncodeToString(ciphertext)
		log.Println("Encrypted message:", encryptedMessageBase64)

		bytes, err := x509.MarshalPKIXPublicKey(rsaPublicKey)

		// Create a PEM block for the public key
		pemBlock := &pem.Block{
			Type:  "PUBLIC KEY",
			Bytes: bytes,
		}

		// Encode the PEM block to a string
		publicKeyString := string(pem.EncodeToMemory(pemBlock))

		fmt.Println(publicKeyString)
		return encryptedMessageBase64, nil
	}
*/
