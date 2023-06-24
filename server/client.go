package main

import (
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

	idleTimeout = time.Second * 30
)

type Client struct {
	server *Server

	conn *websocket.Conn

	sendMessage chan string

	peerID string

	pair *Client

	idleTimer *time.Timer
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func (c *Client) handleTimeout() {
	for {
		select {
		case <-c.idleTimer.C:
			log.Println("Client idle timeout reached")
			c.closeConnection(websocket.CloseInternalServerErr, "Client idle timeout reached")
			return
		}
	}
}

func (c *Client) resetIdleTimer() {
	if !c.idleTimer.Stop() {
		<-c.idleTimer.C
	}
	c.idleTimer.Reset(idleTimeout)
}

func (c *Client) closeConnection(closeCode int, closeMessage string) error {
	var err error

	if c.conn != nil {
		err = c.conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(closeCode, closeMessage), time.Now().Add(time.Second*5))

		if err != nil {
			log.Println("Error writing control message:", err)
			return err
		}

		err = c.conn.Close()
		if err != nil {
			log.Println("Error closing connection:", err)
			return err
		}
	}

	return nil
}

// Writes data to websocket.
func (c *Client) writeData() {
	messageBytes := []byte{}

	for {
		if c.pair != nil {
			message := <-c.pair.sendMessage
			messageBytes = append(messageBytes[:0], message...)
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			err := c.conn.WriteMessage(websocket.TextMessage, messageBytes)
			if err != nil {
				log.Println("Error writing message:", err)
				c.pair.closeConnection(websocket.CloseAbnormalClosure, "Closing connection")
				return
			}
			c.resetIdleTimer()
		}
	}
}

func (c *Client) sendPing() {
	pingMessage := []byte("ping")

	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()

	for range ticker.C {
		if err := c.conn.WriteControl(websocket.PingMessage, pingMessage, time.Now().Add(writeWait)); err != nil {
			log.Println("Error sending ping:", err)
			c.pair.closeConnection(websocket.CloseAbnormalClosure, "Closing connection")
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
			c.pair.closeConnection(websocket.CloseAbnormalClosure, "Closing connection")
			return
		}
		c.sendMessage <- string(message)

		c.resetIdleTimer()
	}
}

// Handle creates a new client and lets the server process it.
func handle(s *Server, w http.ResponseWriter, r *http.Request, m *sync.Mutex) {
	log.Println("New client connected")

	// TODO: remove in production (added for testing purposes)
	upgrader.CheckOrigin = func(r *http.Request) bool { return true }

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading connection:", err)
		return
	}
	conn.SetReadLimit(maxMessageSize)

	client := Client{
		server:      s,
		conn:        conn,
		sendMessage: make(chan string),
		idleTimer:   time.NewTimer(time.Minute * 2), // Initial timer duration is a little longer than idleTimeout
	}

	// Read ID from query.
	// If ID is empty, then it is the first client, it is added to the map of clients using its ID from header
	// and waits for the second client.
	// If ID is not empty, then it is the second client, it is added to the channel to wait for its turn to be processed.
	if id := r.URL.Query().Get("id"); id == "" {
		ok := true
		for ok {
			id = uuid.New().String()

			m.Lock()
			_, ok = s.clients[id]
			m.Unlock()
		}

		m.Lock()
		s.clients[id] = &client
		m.Unlock()

		if err = conn.WriteMessage(websocket.TextMessage, []byte("client-id: "+id)); err != nil {
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
	go client.handleTimeout()
}
