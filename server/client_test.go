package main

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestClient_sendPing(t *testing.T) {
	client := Client{}

	server := createMockServer(&client, t)
	defer server.Close()

	conn := connectToWebsocket(server, t, nil, "")
	defer conn.Close()

	go client.sendPing()

	conn.SetPongHandler(func(string) error {
		if err := conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
			t.Fatalf("Failed to fulfil read deadline: %v", err)
		}
		return nil
	})

	messageType, _, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read a message: %v", err)
	}
	if messageType != websocket.PingMessage {
		t.Fatalf("Expected %d, got %d", websocket.PingMessage, messageType)
	}
}

func TestClient_writeData(t *testing.T) {
	testMessage := "test"

	client := Client{}

	server := createMockServer(&client, t)
	defer server.Close()

	conn := connectToWebsocket(server, t, nil, "")
	defer conn.Close()

	pair := Client{sendMessage: make(chan string, 1)}
	client.pair = &pair
	pair.sendMessage <- testMessage

	go client.writeData()

	verifyMessage(conn, t, testMessage)

	pair.sendMessage <- testMessage
}

func TestClient_readData(t *testing.T) {
	testMessage := "test"

	client := Client{sendMessage: make(chan string, 1)}

	server := createMockServer(&client, t)
	defer server.Close()

	conn := connectToWebsocket(server, t, nil, "")
	defer conn.Close()

	go client.sendPing()
	go client.readData()

	writeMessage(conn, t, testMessage)

	if message := <-client.sendMessage; message != testMessage {
		t.Fatal("Expected message to be equal to testMessage, got", message)
	}
}

func TestClient_handle(t *testing.T) {
	testMessage := "test"
	testID := "125"
	var mutex sync.Mutex
	var server Server = Server{data: make(map[string]*Client), registerID: make(chan *Client)}

	flag := make(chan bool)

	go server.process(flag)

	var mockServer *httptest.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handle(&server, w, r, &mutex)
	}))
	defer mockServer.Close()

	conn1 := connectToWebsocket(mockServer, t, http.Header{"Client-ID": []string{testID}}, "")
	defer conn1.Close()

	conn2 := connectToWebsocket(mockServer, t, nil, "/?id="+string(testID))
	defer conn2.Close()

	writeMessage(conn1, t, testMessage)
	verifyMessage(conn2, t, testMessage)

	writeMessage(conn2, t, testMessage)
	verifyMessage(conn1, t, testMessage)

	flag <- true
}
