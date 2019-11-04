package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
)

type testMessage struct {
	Method  string `json:"method"`
	Status  int    `json:"status"`
	Details string `json:"details"`
}

func handlerJSON(resp http.ResponseWriter, req *http.Request) {
	fmt.Println("handlerJSON", req.ContentLength)
	defer req.Body.Close()

	decoder := json.NewDecoder(req.Body)
	encoder := json.NewEncoder(resp)

	var response testMessage
	response.Method = req.Method
	response.Status = http.StatusOK

	var request testMessage
	err := decoder.Decode(&request)
	fmt.Println(request)
	if err != nil {
		fmt.Println("ERROR")
		fmt.Println(err)
		response.Details = err.Error()
		resp.WriteHeader(http.StatusBadRequest)
		encoder.Encode(response)
		return
	}

	if request.Status == http.StatusMovedPermanently {
		resp.Header().Add("Location", "/static/banksy.jpg")
		resp.WriteHeader(request.Status)
		return
	}

	resp.WriteHeader(request.Status)
	response.Details = "SUCCESS"
	encoder.Encode(response)
}

func handlerProxy(resp http.ResponseWriter, req *http.Request) {
	fmt.Println("handlerProxy")
	defer req.Body.Close()

	url := req.URL.Query().Get("url")
	if len(url) < 4 {
		resp.WriteHeader(http.StatusBadRequest)
		return
	}

	client := &http.Client{}
	preq, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		fmt.Println("ERROR")
		fmt.Println(err)
		resp.WriteHeader(http.StatusInternalServerError)
		return
	}
	preq.Header.Add("Authentication", "BEARER")

	// perform the request
	presp, err := client.Do(preq)
	if err != nil {
		fmt.Println("ERROR")
		fmt.Println(err)
		return
	}
	defer presp.Body.Close()

	fmt.Println(presp.Header)
	for k, v := range presp.Header {
		resp.Header().Add(k, v[0])
	}
	resp.Header().Add("Content-Length", strconv.FormatInt(presp.ContentLength, 10))
	resp.Header().Add("Access-Control-Allow-Origin", "*")
	resp.WriteHeader(presp.StatusCode)
	io.Copy(resp, presp.Body)
}

func handlerCORS(resp http.ResponseWriter, req *http.Request) {
	fmt.Println("handlerCORS")
	defer req.Body.Close()

	resp.Header().Set("Access-Control-Allow-Origin", "*")
	resp.Header().Set("Access-Control-Allow-Header", "Authorization")

	if req.Method == http.MethodOptions {
		resp.WriteHeader(http.StatusNoContent)
		return
	}

	file, err := os.Open("./static/banksy.jpg")
	if err != nil {
		fmt.Println("ERROR")
		fmt.Println(err)
		resp.WriteHeader(http.StatusNotFound)
		return
	}
	defer file.Close()
	fileStat, _ := file.Stat()

	resp.Header().Add("Content-Length", strconv.FormatInt(fileStat.Size(), 10))
	resp.WriteHeader(http.StatusOK)
	io.Copy(resp, file)
}

func handlerStatic(resp http.ResponseWriter, req *http.Request) {
	fmt.Println("handlerStatic: " + req.URL.String())
	defer req.Body.Close()

	file, err := os.Open("." + req.URL.String())
	if err != nil {
		fmt.Println("ERROR")
		fmt.Println(err)
		resp.WriteHeader(http.StatusNotFound)
		return
	}
	defer file.Close()
	fileStat, _ := file.Stat()

	// allow CORS for tests
	resp.Header().Set("Access-Control-Allow-Origin", "*")

	resp.Header().Add("Content-Length", strconv.FormatInt(fileStat.Size(), 10))
	resp.WriteHeader(http.StatusOK)
	io.Copy(resp, file)
}

func handlerBrowser(resp http.ResponseWriter, req *http.Request) {
	fmt.Println("handlerBrowser: " + req.URL.String())
	defer req.Body.Close()

	url := req.URL.String()
	if req.URL.String() == "/" {
		url = "/index.html"
	}
	file, err := os.Open("./browser" + url)
	if err != nil {
		fmt.Println("ERROR")
		fmt.Println(err)
		resp.WriteHeader(http.StatusNotFound)
		return
	}
	defer file.Close()
	fileStat, _ := file.Stat()

	resp.Header().Add("Content-Length", strconv.FormatInt(fileStat.Size(), 10))
	resp.WriteHeader(http.StatusOK)
	io.Copy(resp, file)
}

func main() {
	fmt.Println("Test WWW Server")

	http.Handle("/", http.HandlerFunc(handlerBrowser))
	http.Handle("/static/", http.HandlerFunc(handlerStatic))
	http.Handle("/cors", http.HandlerFunc(handlerCORS))
	http.Handle("/proxy", http.HandlerFunc(handlerProxy))
	http.Handle("/json", http.HandlerFunc(handlerJSON))

	http.ListenAndServe(":8000", nil)
}
