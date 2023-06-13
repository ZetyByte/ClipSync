package main

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func pingReceived(flag chan bool) {
	flag <- true
}

func TestClient_sendPing(t *testing.T) {
	client := Client{}

	server := createMockServer(&client, t)
	defer server.Close()

	conn := connectToWebsocket(server, t, nil, "")
	defer conn.Close()

	timer := time.NewTimer(pongWait + time.Second*4)
	defer timer.Stop()

	flag := make(chan bool)
	conn.SetPingHandler(func(appData string) error {
		pingReceived(flag)
		return nil
	})

	go client.sendPing()

	// SetPingHandler is only called when a ping message is received via NextReader, ReadMessage, or message Read methods.
	// refer to https://godoc.org/github.com/gorilla/websocket#Conn.SetPingHandler
	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	select {
	case <-timer.C:
		t.Fatal("Expected ping message, got timeout")
	case <-flag:

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
