package main

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

type Server struct {
	data map[string](*Client)

	registerID chan *Client
}

// Processes second clients (the ones than connected by ID).
func (s *Server) process(flag chan bool) {
	for {
		select {
		case client := <-s.registerID:
			value, ok := s.data[client.peersID]
			if ok {
				log.Println("Pairing clients")
				value.pair = client
				client.pair = value
				delete(s.data, client.peersID)
			} else {
				client.conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Client with this ID does not exist"), time.Now().Add(time.Second*5))
				client.conn.Close()
			}
		case <-flag:
			close(s.registerID)
			return
		}
	}
}
