package main

import (
	"net/http"
	"sync"
)

func getHandlerFunc(server *Server, mutex *sync.Mutex) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		handle(server, w, r, mutex)
	}
}

func main() {
	// Here, mutex is used to synchronize access to the map. Said map is used to store clients that connected by ID.
	// Check "Server" struct in server\server.go for more information.
	// Mutex itself is used in "handle" function in server\client.go to synchronize access to the map of clients.
	var mutex sync.Mutex
	var server Server = Server{clients: make(map[string]*Client), registerID: make(chan *Client)}

	flag := make(chan bool)

	go server.process(flag)

	http.HandleFunc("/ws", getHandlerFunc(&server, &mutex))

	http.ListenAndServe(":8080", nil)

	flag <- true
}
