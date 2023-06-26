package main

import (
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func pingReceived(flag chan bool) {
	flag <- true
}

func TestClient_closeConnection(t *testing.T) {
	client1 := Client{}

	server := createMockServer(&client1, t)
	defer server.Close()

	conn2 := connectToWebsocket(server, t, nil, "")
	defer conn2.Close()

	client2 := &Client{conn: conn2}
	client1.pair = client2

	err := client1.closeConnection()

	if err != nil {
		t.Fatalf("closeConnection() returned an error: %v", err)
	}

	assertConnectionClosed(t, conn2)
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

	go client.sendPing(flag)

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

	flag := make(chan bool)
	go client.writeData(flag)

	verifyMessage(conn, t, testMessage)

	pair.sendMessage <- testMessage
	flag <- true
}

func TestClient_readData(t *testing.T) {
	testMessage := "test"

	client := Client{sendMessage: make(chan string, 1)}

	server := createMockServer(&client, t)
	defer server.Close()

	conn := connectToWebsocket(server, t, nil, "")
	defer conn.Close()

	flag := make(chan bool)
	go client.sendPing(flag)
	go client.readData()

	writeMessage(conn, t, testMessage)

	if message := <-client.sendMessage; message != testMessage {
		t.Fatal("Expected message to be equal to testMessage, got", message)
	}
	flag <- true
}

func TestClient_handle(t *testing.T) {
	testMessage := "test"
	testID := "125"
	var mutex sync.Mutex
	var server Server = Server{clients: make(map[string]*Client), registerID: make(chan *Client)}

	flag := make(chan bool)

	go server.process(flag)

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

func assertConnectionClosed(t *testing.T, conn *websocket.Conn) {
	t.Helper()

	conn.SetReadDeadline(time.Now().Add(time.Second))

	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Errorf("Expected the connection to be closed, but ReadMessage returned no error")
	} else if !websocket.IsCloseError(err, websocket.CloseAbnormalClosure, websocket.CloseGoingAway) {
		if netErr, ok := err.(*net.OpError); ok {
			if netErr.Op == "read" && netErr.Err.Error() == "use of closed network connection" {
				return // Connection closed as expected
			}
		}
		t.Errorf("Expected a close error, but got: %v", err)
	}
}
