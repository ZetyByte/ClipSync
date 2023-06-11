package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
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

	server1 := createMockServer(&firstClient, t)
	defer server1.Close()

	conn := connectToWebsocket(server1, t)
	defer conn.Close()

	s.data[testID] = firstClient

	writeMessage(conn, t, testData)

	server2 := createMockServer(&secondClient, t)
	defer server2.Close()

	conn2 := connectToWebsocket(server2, t)
	defer conn2.Close()

	flag := make(chan bool)

	go s.process(flag)
	go secondClient.readData()
	s.registerID <- secondClient

	verifyMessage(conn2, t, testData)

	writeMessage(conn2, t, testDataUpdated)

	verifyMessage(conn, t, testDataUpdated)

	flag <- true
}

func TestServer_processERROR(t *testing.T) {
	var s Server = Server{data: make(map[string]Client), registerID: make(chan Client, 1)}

	testID := "125"
	wrongID := "123"
	firstClient := Client{data: make(chan string, 1), server: &s}

	secondClient := Client{data: make(chan string, 1), peersID: wrongID, server: &s}

	s.data[testID] = firstClient

	server := createMockServer(&firstClient, t)
	defer server.Close()

	conn := connectToWebsocket(server, t)
	secondClient.conn = conn

	flag := make(chan bool)
	go s.process(make(chan bool))

	s.registerID <- secondClient

	_, _, err := conn.ReadMessage()
	if ce, ok := err.(*websocket.CloseError); ok {
		switch ce.Code {
		case websocket.CloseNormalClosure,
			websocket.CloseGoingAway,
			websocket.CloseNoStatusReceived:
		default:
			t.Fatalf("Expected websocket.CloseNormalClosure, got %v", ce.Code)
		}
	}

	flag <- true
}

func createMockServer(c *Client, t *testing.T) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		openClientConnection(c, t, w, r)
	}))
}

func connectToWebsocket(server *httptest.Server, t *testing.T) *websocket.Conn {
	t.Helper()
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
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
