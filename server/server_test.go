package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/gorilla/websocket"
)

func openClientConnection(c *Client, t *testing.T, w http.ResponseWriter, r *http.Request) {
	t.Helper()
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		t.Fatal(err)
	}
	c.conn = conn
}

func TestServer_process(t *testing.T) {
	var s Server = Server{data: make(map[string]Client), registerID: make(chan Client, 1)}

	testID, testData, testDataUpdated := "125", "data from first client", "data from second client"
	firstClient := Client{data: make(chan string, 1), server: &s}
	firstClient.data <- testData

	secondClient := Client{data: make(chan string, 1), peersID: testID, server: &s}

	// Create a mock server
	server1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		openClientConnection(&firstClient, t, w, r)
	}))
	defer server1.Close()

	// Convert the server URL to a WebSocket URL
	wsURL := "ws" + strings.TrimPrefix(server1.URL, "http")

	// Connect to the WebSocket server
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket server: %v", err)
	}
	defer conn.Close()

	s.data[testID] = firstClient

	// Verify that the server responded with a 101 status code
	if status := conn.WriteMessage(websocket.TextMessage, []byte(testData)); status != nil {
		t.Fatalf("Failed to write message to WebSocket connection: %v", err)
	}

	// Create a mock server
	server2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		openClientConnection(&secondClient, t, w, r)
	}))
	defer server2.Close()

	// Convert the server URL to a WebSocket URL
	wsURL = "ws" + strings.TrimPrefix(server2.URL, "http")

	// Connect to the WebSocket server
	conn2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket server: %v", err)
	}
	defer conn2.Close()
	s.registerID <- secondClient

	flag := make(chan bool)

	go s.process(flag)

	_, message, err := conn2.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read a message: %v", err)
	}
	if string(message) != testData {
		t.Fatalf("Expected %s, got %s", testData, string(message))
	}

	// Verify that the server responded with a 101 status code
	if status := conn2.WriteMessage(websocket.TextMessage, []byte(testDataUpdated)); status != nil {
		t.Fatalf("Failed to write message to WebSocket connection: %v", err)
	}

	_, message, err = conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read a message: %v", err)
	}
	if string(message) != testDataUpdated {
		t.Fatalf("Expected %s, got %s", testDataUpdated, string(message))
	}

	flag <- true
}

func TestServer_main(t *testing.T) {
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
