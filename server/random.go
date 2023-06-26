package main

import (
	"crypto/rand"
	"encoding/base64"
	// "fmt"
)

func generateRandomID(length int) (string, error) {
	buffer := make([]byte, length)

	_, err := rand.Read(buffer)
	if err != nil {
		return "", err
	}

	// Encode the random bytes to a base64 string
	randomID := base64.URLEncoding.EncodeToString(buffer)

	// Trim any padding characters
	// randomID = randomID[:32]

	return randomID, nil
}

// func main() {
// 	// Generate a random ID of length 10
// 	randomID, err := generateRandomID(10)
// 	if err != nil {
// 		fmt.Println("Error generating random ID:", err)
// 		return
// 	}

// 	fmt.Println("Random ID:", randomID)
// }
