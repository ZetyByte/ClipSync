package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
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

// Declare response type
type Message struct {
	Type    string `json:"type"`
	Payload string `json:"payload"`
}

// Peers' Rooms
var peersRooms = make(map[string][]*websocket.Conn)

func main() {
	// Register the WebSocket handler
	http.HandleFunc("/ws", handleWebSocket)

	// Start the signaling server
	log.Println("Signaling server started on http://localhost:8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("ListenAndServe error:", err)
	}
}

// Handle incoming WebSocket connections
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
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
	}
}

func processSignalingMessage(conn *websocket.Conn, message []byte) {
	var signalingData struct {
		Type   string `json:"type"`
		RoomID string `json:"id"`
		SDP    string `json:"sdp"`
	}

	if err := json.Unmarshal(message, &signalingData); err != nil {
		log.Println("Failed to unmarshal signaling message:", err)
		return
	}

	switch signalingData.Type {
	case "createRoom":
		handleCreateRoom(conn)
	case "joinRoom":
		handleJoinRoom(signalingData.RoomID, conn)
	case "offer":
		handleOffer(signalingData.RoomID, signalingData.SDP)
	case "answer":
		handleAnswer(signalingData.RoomID, signalingData.SDP)
	}
}

func handleCreateRoom(conn *websocket.Conn) {
	id, err := generateRandomID(20)
	if err != nil {
		log.Println("Failed to generate ID:", err)
		return
	}

	// Add user to created room
	peersRooms[id] = append(peersRooms[id], conn)

	handleResponse("createSuccess", id, conn)
}

func handleJoinRoom(id string, conn *websocket.Conn) {
	// Check if room exists
	if _, ok := peersRooms[id]; !ok {
		log.Println("Room does not exist")
		return
	}

	// Add peer to existing room
	peersRooms[id] = append(peersRooms[id], conn)

	handleResponse("joinSuccess", "Connected successfully to room with ID: "+id, peersRooms[id][0])
}

func handleOffer(roomID, offer string) {
	log.Println(peersRooms)
	room := peersRooms[roomID]
	target := room[1]

	handleResponse("offer", offer, target)
}

func handleAnswer(roomID, answer string) {
	room := peersRooms[roomID]
	target := room[0]

	handleResponse("answer", answer, target)
}

func handleResponse(responseType, responsePayload string, conn *websocket.Conn) {
	// Generate response message
	message := Message{
		Type:    responseType,
		Payload: responsePayload,
	}
	dataJSON, err := json.Marshal(message)
	if err != nil {
		log.Println("Error marshaling JSON:", err)
		return
	}

	// Send response
	if err = conn.WriteMessage(websocket.TextMessage, dataJSON); err != nil {
		log.Println("Write error:", err)
		return
	}
}

func generateRandomID(length int) (string, error) {
	buffer := make([]byte, length)

	_, err := rand.Read(buffer)
	if err != nil {
		return "", err
	}

	// Encode the random bytes to a base64 string
	randomID := base64.URLEncoding.EncodeToString(buffer)

	return randomID, nil
}
