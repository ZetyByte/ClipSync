package main

import (
	"log"

	"github.com/gorilla/websocket"
)

type Server struct {
	clients map[string](*Client)

	registerID chan *Client
}

// Processes second clients (the ones that connected by ID).
func (s *Server) process(flag chan bool) {
	for {
		select {
		case client := <-s.registerID:
			peer, ok := s.clients[client.peerID]
			if ok {
				log.Println("Paired clients")
				pairClients(client, peer)

				go client.handleTimeout()

				// Send message to both clients that they are connected to change the state of the pages.
				sendConnectedMessage(client.conn)
				sendConnectedMessage(peer.conn)

				// Delete paired client from the queue.
				delete(s.clients, client.peerID)
			} else {
				client.closeConnection(websocket.CloseInternalServerErr, "Client with this ID does not exist")
			}
		case <-flag:
			close(s.registerID)
			return
		}
	}
}

func pairClients(client1, client2 *Client) {
	client1.pair = client2
	client2.pair = client1

	client1.pairedFlag <- true
	client2.pairedFlag <- true

	client1.resetIdleTimer()
	client2.resetIdleTimer()
}

func sendConnectedMessage(conn *websocket.Conn) {
	conn.WriteMessage(websocket.TextMessage, []byte("connected"))
}
