package main

import (
	"net/http"
	"sync"
)

func main() {
	var mutex sync.Mutex
	var server Server = Server{data: make(map[string]Client), registerID: make(chan Client)}

	flag := make(chan bool)

	go server.process(flag)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		handle(&server, w, r, &mutex)
	})

	http.ListenAndServe(":8080", nil)

	flag <- true
}
