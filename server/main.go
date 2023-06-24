package main

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

// Create a new WebSocket upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Add any necessary CORS checks here
		return true
	},
}

type Peer struct {
	ID       string
	Conn     *websocket.Conn
	Offer    *SessionDescription
	Answer   *SessionDescription
	// ICEs     []*ICECandidate
	IsAnswer bool
}

type SessionDescription struct {
	Type string `json:"type"`
	SDP  string `json:"sdp"`
}

var peers = make(map[string]*Peer)

// Handle incoming WebSocket connections
func handleWebScoket(w http.ResponseWriter, r *http.Request){
	// Upgrade the HTTP connection to a WebSocket connection
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Println("Upgrade error:", err)
        return
    }
    defer conn.Close()

	// Handle incoming signaling messages
    for {
        messageType, message, err := conn.ReadMessage()
        if err != nil {
            log.Println("Read error:", err)
            break
        }

        // Process the signaling message (e.g., forward it to other connected clients)
        log.Printf("Received message: %s", message)

        // Send an acknowledgment response back to the sender if needed
        if err = conn.WriteMessage(messageType, message); err != nil {
            log.Println("Write error:", err)
            break
        }
    }
}

func main(){
	// Register the WebSocket handler
	http.HandleFunc("/ws", handleWebScoket)

	// Start the signaling server
	log.Println("Signaling server started on http://localhost:8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("ListenAndServe error:", err)
	}
}