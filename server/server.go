package main

import (
	"log"
	"time"

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
				log.Println("Pairing clients")
				pairClients(client, peer)

				// Send message to both clients that they are connected to change the state of the pages.
				sendConnectedMessage(client.conn)
				sendConnectedMessage(peer.conn)

				// Delete paired client from the queue.
				delete(s.clients, client.peerID)
			} else {
				handleInvalidID(client)
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
}

func sendConnectedMessage(conn *websocket.Conn) {
	conn.WriteMessage(websocket.TextMessage, []byte("connected"))
}

func handleInvalidID(client *Client) {
	client.conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Client with this ID does not exist"), time.Now().Add(time.Second*5))
	client.conn.Close()
}
