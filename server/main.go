package main

import (
	"log"
	"net/http"
	"encoding/json"

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

var peersRooms = make(map[string][]*websocket.Conn)

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
        _, message, err := conn.ReadMessage()
        if err != nil {
            log.Println("Read error:", err)
            break
        }

        // Process the signaling message (e.g., forward it to other connected clients)
        log.Printf("Received message: %s", message)

		processSignalingMessage(conn, message)

        // Send an acknowledgment response back to the sender if needed
        // if err = conn.WriteMessage(messageType, message); err != nil {
        //     log.Println("Write error:", err)
        //     break
        // }
    }
}

func processSignalingMessage(conn *websocket.Conn, message []byte){
	var signalingData struct {
		Type           string             `json:"type"`
		RoomID         string             `json:"id"`  
		// SenderID   string             `json:"senderId"`
		// TargetID   string             `json:"targetId"`
		Offer          string             `json:"offer"`
		Answer         string             `json:"answer,omitempty"`
		// ICE        *ICECandidate       `json:"ice,omitempty"`
	}

	if err := json.Unmarshal(message, &signalingData); err != nil {
		log.Println("Failed to unmarshal signaling message:", err)
		return
	}

	switch signalingData.Type {
	case "createRoom":
		handleCreateRoom(conn)
	case "joinRoom":
		hadnleJoinRoom(signalingData.RoomID, conn)
	case "offer":
		handleOffer(signalingData.RoomID, signalingData.Offer)
	case "answer":
		handleAnswer(signalingData.RoomID, signalingData.Answer)
	}
}

func handleCreateRoom(conn *websocket.Conn){
	id, err := generateRandomID(10)
	if err != nil {
		log.Println("Failed to generate ID:", err)
	}
	peersRooms[id] = append(peersRooms[id], conn)
	if err = conn.WriteMessage(websocket.TextMessage, []byte(id)); err != nil {
		log.Println("Write error:", err)
		return
	}
}

func hadnleJoinRoom(id string, conn *websocket.Conn){
	peersRooms[id] = append(peersRooms[id], conn)
	if err := conn.WriteMessage(websocket.TextMessage, []byte("Connected succesfully to room with ID: " + id)); err != nil {
		log.Println("Write error:", err)
		return
	}
}

func handleOffer(roomID, offer string){
	target := peersRooms[roomID][1]
	if err := target.WriteMessage(websocket.TextMessage, []byte(offer)); err != nil {
		log.Println("Write error:", err)
		return
	}
}

func handleAnswer(roomID, answer string){
	target := peersRooms[roomID][0]
	if err := target.WriteMessage(websocket.TextMessage, []byte(answer)); err != nil {
		log.Println("Write error:", err)
		return
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