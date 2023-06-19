package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

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
	var s Server = Server{clients: make(map[string]*Client), registerID: make(chan *Client, 1)}

	testID := "125"
	firstClient := Client{sendMessage: make(chan string, 1), server: &s}

	secondClient := Client{sendMessage: make(chan string, 1), peerID: testID, server: &s}

	s.clients[testID] = &firstClient
	s.registerID <- &secondClient

	flag := make(chan bool)
	go s.process(flag)

	time.Sleep(time.Millisecond * 100)

	if firstClient.pair != &secondClient {
		t.Fatal("Expected firstClient.pair to be equal to secondClient, got", firstClient.pair)
	}
	if secondClient.pair != &firstClient {
		t.Fatal("Expected secondClient.pair to be equal to firstClient, got", secondClient.pair)
	}

	flag <- true
}

func TestServer_processFLAG(t *testing.T) {
	var s Server = Server{clients: make(map[string]*Client), registerID: make(chan *Client, 1)}

	flag := make(chan bool)
	go s.process(flag)
	flag <- true

	_, ok := <-s.registerID
	if ok {
		t.Fatal("Expected s.registerID to be closed, got", ok)
	}
}

func TestServer_processERROR(t *testing.T) {
	var s Server = Server{clients: make(map[string]*Client), registerID: make(chan *Client, 1)}

	testID, wrongID := "125", "123"
	firstClient := Client{sendMessage: make(chan string, 1), server: &s}

	secondClient := Client{sendMessage: make(chan string, 1), peerID: wrongID, server: &s}
	server2 := createMockServer(&secondClient, t)
	defer server2.Close()

	conn2 := connectToWebsocket(server2, t, nil, "")
	defer conn2.Close()
	secondClient.conn = conn2

	s.clients[testID] = &firstClient
	s.registerID <- &secondClient

	flag := make(chan bool)
	go s.process(flag)

	time.Sleep(time.Millisecond * 100)

	_, _, err := secondClient.conn.ReadMessage()
	if err == nil {
		t.Fatal("Expected error, got nil")
	}

	flag <- true
}

func createMockServer(c *Client, t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		openClientConnection(c, t, w, r)
	}))
}

func connectToWebsocket(server *httptest.Server, t *testing.T, header http.Header, id string) *websocket.Conn {
	t.Helper()
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + id

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		t.Fatalf("Failed to connect to WebSocket server: %v", err)
	}
	return conn
}

func verifyMessage(conn *websocket.Conn, t *testing.T, expectedMessage string) {
	t.Helper()
	_, message, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read a message: %v", err)
	}
	if string(message) != expectedMessage {
		t.Fatalf("Expected %s, got %s", expectedMessage, string(message))
	}
}

func writeMessage(conn *websocket.Conn, t *testing.T, message string) {
	t.Helper()
	if status := conn.WriteMessage(websocket.TextMessage, []byte(message)); status != nil {
		t.Fatalf("Failed to write message to WebSocket connection: %v", status)
	}
}
