package proxy

import (
	"context"
	"encoding/binary"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"token-gate/internal/domain"
)

func TestDoPreservesRequestBodyPathQueryAndHeaders(t *testing.T) {
	const body = `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`

	var captured struct {
		method        string
		path          string
		rawQuery      string
		authorization string
		trace         string
		connection    string
		body          string
	}

	service := &Service{client: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		captured.method = req.Method
		captured.path = req.URL.Path
		captured.rawQuery = req.URL.RawQuery
		captured.authorization = req.Header.Get("Authorization")
		captured.trace = req.Header.Get("X-Trace")
		captured.connection = req.Header.Get("Connection")
		data, err := io.ReadAll(req.Body)
		if err != nil {
			t.Fatalf("read upstream body: %v", err)
		}
		captured.body = string(data)
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(`{"ok":true}`)),
			Request:    req,
		}, nil
	})}}

	incoming := httptest.NewRequest(http.MethodPost, "/v1/chat/completions?stream=true", strings.NewReader(body))
	incoming.Header.Set("Authorization", "Bearer client-key")
	incoming.Header.Set("X-Trace", "keep-me")
	incoming.Header.Set("Connection", "close")

	resp, err := service.Do(context.Background(), incoming, domain.Backend{
		BaseURL: "https://backend.local/root/v1",
		APIKey:  "backend-key",
	}, []byte(body))
	if err != nil {
		t.Fatalf("Do returned error: %v", err)
	}
	defer resp.Body.Close()

	if captured.method != http.MethodPost {
		t.Fatalf("method mismatch: %q", captured.method)
	}
	if captured.path != "/root/v1/chat/completions" {
		t.Fatalf("path mismatch: %q", captured.path)
	}
	if captured.rawQuery != "stream=true" {
		t.Fatalf("raw query mismatch: %q", captured.rawQuery)
	}
	if captured.authorization != "Bearer backend-key" {
		t.Fatalf("authorization was not rewritten to backend key: %q", captured.authorization)
	}
	if captured.trace != "keep-me" {
		t.Fatalf("custom header was not preserved: %q", captured.trace)
	}
	if captured.connection != "" {
		t.Fatalf("hop-by-hop Connection header should be stripped, got %q", captured.connection)
	}
	if captured.body != body {
		t.Fatalf("body changed: got %q want %q", captured.body, body)
	}
}

func TestEndpointForPathIncludesAnthropicMessages(t *testing.T) {
	cases := map[string]string{
		"/v1/chat/completions":      domain.EndpointChat,
		"/v1/responses":             domain.EndpointResponses,
		"/v1/embeddings":            domain.EndpointEmbeddings,
		"/v1/images/generations":    domain.EndpointImages,
		"/v1/messages":              domain.EndpointMessages,
		"/v1/messages/count_tokens": domain.EndpointMessages,
		"/v1/models":                domain.EndpointModels,
		"/v1/unknown":               "",
	}

	for path, want := range cases {
		if got := EndpointForPath(path); got != want {
			t.Fatalf("EndpointForPath(%q) = %q, want %q", path, got, want)
		}
	}
}

func TestDoUsesAnthropicBackendAuthHeader(t *testing.T) {
	const body = `{"model":"claude-3-5-sonnet-latest","max_tokens":16,"messages":[{"role":"user","content":"hello"}]}`

	var captured struct {
		path             string
		authorization    string
		xAPIKey          string
		anthropicVersion string
		body             string
	}

	service := &Service{client: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		captured.path = req.URL.Path
		captured.authorization = req.Header.Get("Authorization")
		captured.xAPIKey = req.Header.Get("X-Api-Key")
		captured.anthropicVersion = req.Header.Get("Anthropic-Version")
		data, err := io.ReadAll(req.Body)
		if err != nil {
			t.Fatalf("read upstream body: %v", err)
		}
		captured.body = string(data)
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(`{"ok":true}`)),
			Request:    req,
		}, nil
	})}}

	incoming := httptest.NewRequest(http.MethodPost, "/v1/messages", strings.NewReader(body))
	incoming.Header.Set("Authorization", "Bearer client-openai-key")
	incoming.Header.Set("X-Api-Key", "client-anthropic-key")
	incoming.Header.Set("Anthropic-Version", "2023-06-01")

	resp, err := service.Do(context.Background(), incoming, domain.Backend{
		Protocol: domain.BackendProtocolAnthropic,
		BaseURL:  "https://backend.local/root/v1",
		APIKey:   "backend-key",
	}, []byte(body))
	if err != nil {
		t.Fatalf("Do returned error: %v", err)
	}
	defer resp.Body.Close()

	if captured.path != "/root/v1/messages" {
		t.Fatalf("path mismatch: %q", captured.path)
	}
	if captured.authorization != "" {
		t.Fatalf("anthropic backend should not receive Authorization, got %q", captured.authorization)
	}
	if captured.xAPIKey != "backend-key" {
		t.Fatalf("anthropic backend x-api-key mismatch: %q", captured.xAPIKey)
	}
	if captured.anthropicVersion != "2023-06-01" {
		t.Fatalf("anthropic-version header was not preserved: %q", captured.anthropicVersion)
	}
	if captured.body != body {
		t.Fatalf("body changed: got %q want %q", captured.body, body)
	}
}

func TestWriteResponsePreservesSSEBodyAndStripsHopByHopHeaders(t *testing.T) {
	const streamBody = "data: one\n\ndata: [DONE]\n\n"

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Status:     "200 OK",
		Header: http.Header{
			"Content-Type": {"text/event-stream"},
			"X-Upstream":   {"ok"},
			"Connection":   {"close"},
		},
		Body: io.NopCloser(strings.NewReader(streamBody)),
	}

	recorder := httptest.NewRecorder()
	if err := WriteResponse(recorder, resp); err != nil {
		t.Fatalf("WriteResponse returned error: %v", err)
	}

	if recorder.Code != http.StatusOK {
		t.Fatalf("status mismatch: %d", recorder.Code)
	}
	if recorder.Body.String() != streamBody {
		t.Fatalf("SSE body changed: got %q want %q", recorder.Body.String(), streamBody)
	}
	if recorder.Header().Get("X-Upstream") != "ok" {
		t.Fatalf("upstream header was not preserved")
	}
	if recorder.Header().Get("Connection") != "" {
		t.Fatalf("hop-by-hop response header should be stripped")
	}
	if !recorder.Flushed {
		t.Fatalf("expected SSE response to be flushed")
	}
}

func TestDoUsesBackendSocksProxy(t *testing.T) {
	const body = `{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}`

	upstreamListener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("local listener is not available in this environment: %v", err)
	}
	upstream := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/root/v1/chat/completions" {
			t.Fatalf("unexpected upstream path: %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer backend-key" {
			t.Fatalf("unexpected upstream authorization: %s", r.Header.Get("Authorization"))
		}
		data, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read upstream body: %v", err)
		}
		if string(data) != body {
			t.Fatalf("unexpected upstream body: %s", string(data))
		}
		w.Header().Set("X-Upstream", "via-socks")
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	upstream.Listener = upstreamListener
	upstream.Start()
	defer upstream.Close()

	socks := newRecordingSocks5Server(t)
	service := New(5 * time.Second)

	incoming := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
	incoming.Header.Set("Authorization", "Bearer client-key")
	resp, err := service.Do(context.Background(), incoming, domain.Backend{
		BaseURL: upstream.URL + "/root/v1",
		APIKey:  "backend-key",
		ProxyID: 1,
		Proxy: &domain.SocksProxy{
			ID:      1,
			Name:    "test-socks",
			Address: socks.address,
			Enabled: true,
		},
	}, []byte(body))
	if err != nil {
		t.Fatalf("Do returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.Header.Get("X-Upstream") != "via-socks" {
		t.Fatalf("expected upstream response through socks proxy")
	}

	select {
	case target := <-socks.targets:
		upstreamURL := strings.TrimPrefix(upstream.URL, "http://")
		if target != upstreamURL {
			t.Fatalf("socks proxy target mismatch: got %q want %q", target, upstreamURL)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("socks proxy did not receive a connect request")
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type recordingSocks5Server struct {
	address string
	targets chan string
}

func newRecordingSocks5Server(t *testing.T) recordingSocks5Server {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("local listener is not available in this environment: %v", err)
	}
	server := recordingSocks5Server{
		address: listener.Addr().String(),
		targets: make(chan string, 1),
	}
	t.Cleanup(func() {
		_ = listener.Close()
	})

	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		target, err := handleSocks5Connect(conn)
		if err != nil {
			t.Errorf("handle socks5 connect: %v", err)
			return
		}
		server.targets <- target

		upstream, err := net.Dial("tcp", target)
		if err != nil {
			t.Errorf("dial socks target %q: %v", target, err)
			return
		}
		defer upstream.Close()

		if _, err := conn.Write([]byte{0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0}); err != nil {
			t.Errorf("write socks response: %v", err)
			return
		}

		done := make(chan struct{}, 2)
		go func() {
			_, _ = io.Copy(upstream, conn)
			done <- struct{}{}
		}()
		go func() {
			_, _ = io.Copy(conn, upstream)
			done <- struct{}{}
		}()
		<-done
	}()

	return server
}

func handleSocks5Connect(conn net.Conn) (string, error) {
	var greeting [2]byte
	if _, err := io.ReadFull(conn, greeting[:]); err != nil {
		return "", err
	}
	if greeting[0] != 0x05 {
		return "", io.ErrUnexpectedEOF
	}
	methods := make([]byte, int(greeting[1]))
	if _, err := io.ReadFull(conn, methods); err != nil {
		return "", err
	}
	if _, err := conn.Write([]byte{0x05, 0x00}); err != nil {
		return "", err
	}

	var header [4]byte
	if _, err := io.ReadFull(conn, header[:]); err != nil {
		return "", err
	}
	if header[0] != 0x05 || header[1] != 0x01 {
		return "", io.ErrUnexpectedEOF
	}

	host, err := readSocks5Address(conn, header[3])
	if err != nil {
		return "", err
	}
	var portBytes [2]byte
	if _, err := io.ReadFull(conn, portBytes[:]); err != nil {
		return "", err
	}
	return net.JoinHostPort(host, strconv.Itoa(int(binary.BigEndian.Uint16(portBytes[:])))), nil
}

func readSocks5Address(conn net.Conn, atyp byte) (string, error) {
	switch atyp {
	case 0x01:
		ip := make([]byte, net.IPv4len)
		if _, err := io.ReadFull(conn, ip); err != nil {
			return "", err
		}
		return net.IP(ip).String(), nil
	case 0x04:
		ip := make([]byte, net.IPv6len)
		if _, err := io.ReadFull(conn, ip); err != nil {
			return "", err
		}
		return net.IP(ip).String(), nil
	case 0x03:
		var length [1]byte
		if _, err := io.ReadFull(conn, length[:]); err != nil {
			return "", err
		}
		host := make([]byte, int(length[0]))
		if _, err := io.ReadFull(conn, host); err != nil {
			return "", err
		}
		return string(host), nil
	default:
		return "", io.ErrUnexpectedEOF
	}
}
