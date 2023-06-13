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
	client.conn = conn

	pair := Client{sendMessage: make(chan string, 1)}
	client.pair = &pair
	pair.sendMessage <- testMessage

	go client.writeData()

	verifyMessage(conn, t, testMessage)

	pair.sendMessage <- testMessage
}
