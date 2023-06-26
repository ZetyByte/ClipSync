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

	// Time after which the client will be disconnected if it is not paired.
	pairingTimeout = 60 * time.Second

	// Time interval between checking if the client is paired.
	checkingInterval = 1 * time.Second

	// Time after which the client will be disconnected if it is idle.
	idleTimeout = 5 * time.Minute
)

type Client struct {
	server *Server

	conn *websocket.Conn

	sendMessage chan string

	peerID string

	pair *Client

	pairedFlag chan bool

	mutex sync.Mutex

	registeredTime time.Time

	stopFlag chan bool
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func (c *Client) closeConnection() error {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.stopFlag <- true
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
func (c *Client) writeData(flag chan bool) {
	loop := true
	for loop {
		select {
		case <-c.pairedFlag:
			loop = false
		case <-flag:
			return
		}
	}
	for {
		select {
		case message := <-c.pair.sendMessage:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			err := c.conn.WriteMessage(websocket.TextMessage, []byte(message))
			if err != nil {
				log.Println("Error writing message:", err)
				c.closeConnection()
				return
			}
		case <-flag:
			return
		}
	}
}

func (c *Client) sendPing(stop chan bool) {
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := c.conn.WriteControl(websocket.PingMessage, []byte("ping"), time.Now().Add(writeWait)); err != nil {
				log.Println("Error sending ping:", err)
				c.closeConnection()
				return
			}
		case <-stop:
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
		c.conn.SetReadDeadline(time.Now().Add(idleTimeout))
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			log.Println("Error reading message:", err)
			c.closeConnection()
			return
		}
		c.sendMessage <- string(message)
	}
}

func (c *Client) pairingDeadline(flag chan bool) {
	for {
		select {
		case <-time.After(pairingTimeout):
			c.closeConnection()
			return
		case <-flag:
			return
		default:
		}
		time.Sleep(checkingInterval)
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

	stopFlag := make(chan bool)
	client := Client{
		server:      s,
		conn:        conn,
		sendMessage: make(chan string),
		stopFlag:    stopFlag,
		pairedFlag:  make(chan bool),
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
	client.registeredTime = time.Now()

	go client.readData()
	go client.writeData(stopFlag)
	go client.pairingDeadline(stopFlag)
	go client.sendPing(stopFlag)
}
