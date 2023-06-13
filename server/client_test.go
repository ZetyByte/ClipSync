package main

import (
	"testing"
)

func TestClient_writeData(t *testing.T) {
	testMessage := "test"

	client := Client{}

	server := createMockServer(&client, t)
	defer server.Close()

	conn := connectToWebsocket(server, t)
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

	conn := connectToWebsocket(server, t)
	defer conn.Close()

	go client.readData()

	writeMessage(conn, t, testMessage)

	if message := <-client.sendMessage; message != testMessage {
		t.Fatal("Expected message to be equal to testMessage, got", message)
	}
}
