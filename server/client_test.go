package main

import (
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

/*
func TestClient_handle(t *testing.T) {
	var mutex sync.Mutex
	var s Server = Server{data: make(map[string]Client), registerID: make(chan Client)}

	// Create a mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handle(&s, w, r, &mutex)
	}))
	defer server.Close()

	// Convert the server URL to a WebSocket URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect to the WebSocket server
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket server: %v", err)
	}
	defer conn.Close()

	// Verify that the server responded with a 101 status code
	if status := conn.WriteMessage(websocket.TextMessage, []byte("Hello, World!")); status != nil {
		t.Fatalf("Failed to write message to WebSocket connection: %v", err)
	}
}

// write a function to test the readData function. it should check if client.readData() reads the messages that was sent to it via websocket connection.
func TestClient_readData(t *testing.T) {
	testData := "Hello, World!"

	// Create a mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("Failed to upgrade: %v", err)
			return
		}
		defer conn.Close()
		client := Client{conn: conn}
		conn.WriteMessage(websocket.TextMessage, []byte(testData))
		receivedData := client.readData()
		if receivedData != testData {
			t.Fatalf("Failed to read message from WebSocket connection: %v", err)
		}
	}))
	defer server.Close()

	// Convert the server URL to a WebSocket URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect to the WebSocket server
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket server: %v", err)
	}
	defer conn.Close()
}

func TestClient_WriteData(t *testing.T) {
	testData := "Hello, World!"

	// Create a mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("Failed to upgrade: %v", err)
			return
		}
		client := Client{conn: conn}
		client.writeData(testData)
	}))
	defer server.Close()

	// Convert the server URL to a WebSocket URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

	// Connect to the WebSocket server
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket server: %v", err)
	}
	defer conn.Close()

	// Verify that the message was sent successfully
	_, receivedData, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read message from WebSocket connection: %v", err)
	}

	expectedData := []byte(testData)
	if string(receivedData) != string(expectedData) {
		t.Errorf("Received data does not match expected data. Expected: %s, Received: %s", expectedData, receivedData)
	}
}*/

func TestWriteData(t *testing.T) {

	conn := &websocket.Conn{}
	client := &Client{conn: conn}
	client.conn.SetWriteDeadline(time.Now().Add(writeWait))
	data := "hello world"
	client.writeData(data)
	err := client.conn.WriteMessage(websocket.TextMessage, []byte(data))
	if err != nil {
		t.Errorf("Expected WriteMessage to be called")
	}
}

func TestSendPings(t *testing.T) {
	conn := &websocket.Conn{}
	StrCh := make(chan string)
	c := &Client{
		conn: conn,
		data: StrCh,
	}
	c.sendPings()
	if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
		log.Println(err)
		return
	}
}

func TestReadData(t *testing.T) {
	conn := &websocket.Conn{}
	StrCh := make(chan string)
	c := &Client{
		conn: conn,
		data: StrCh,
	}
	c.readData()
	if _, _, err := c.conn.ReadMessage(); err != nil {
		log.Println(err)
		return
	}
}

func TestHandle(t *testing.T) {
	var mutex sync.Mutex
	var s Server = Server{data: make(map[string]Client), registerID: make(chan Client)}

	// Create a mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handle(&s, w, r, &mutex)
	}))
	defer server.Close()

	// Convert the server URL to a WebSocket URL
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect to the WebSocket server
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket server: %v", err)
	}
	defer conn.Close()

	// Verify that the server responded with a 101 status code
	if status := conn.WriteMessage(websocket.TextMessage, []byte("Hello, World!")); status != nil {
		t.Fatalf("Failed to write message to WebSocket connection: %v", err)
	}
}
