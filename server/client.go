package main

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 4096
)

type Client struct {
	server *Server

	conn *websocket.Conn

	sendMessage chan string

	peersID string

	pair *Client
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// Writes data to websocket.
func (c *Client) writeData() {
	for {
		if c.pair != nil {
			message := <-c.pair.sendMessage
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			err := c.conn.WriteMessage(websocket.TextMessage, []byte(message))
			if err != nil {
				log.Println(err)
				return
			}
		}
	}
}

func (c *Client) sendPing() {
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()

	for range ticker.C {
		c.conn.SetWriteDeadline(time.Now().Add(writeWait))
		if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
			log.Println(err)
			return
		}
	}
}

// Reads data from websocket and places it into data channel.
func (c *Client) readData() {
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			log.Println(err)
			return
		}
		c.sendMessage <- string(message)
	}
}

// Handle creates a new client and lets the server process it.
func handle(s *Server, w http.ResponseWriter, r *http.Request, m *sync.Mutex) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	conn.SetReadLimit(maxMessageSize)
	client := Client{server: s, conn: conn, sendMessage: make(chan string)}

	// Read ID from query.
	// If ID is empty, then it is the first client, it is added to the map of clients using its ID from header
	// and waits for the second client.
	// If ID is not empty, then it is the second client, it is added to the channel to wait for its turn to be processed.
	if id := r.URL.Query().Get("id"); id == "" {
		id = r.Header.Get("Client-ID")
		m.Lock()
		s.data[id] = &client
		m.Unlock()
	} else {
		client.peersID = id
		s.registerID <- &client
	}
	go client.readData()
	go client.writeData()
	go client.sendPing()
}
