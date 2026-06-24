package proxy

import (
	"context"
	"encoding/binary"
	"encoding/json"
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

func TestRewriteModelReplacesRequestModel(t *testing.T) {
	const body = `{"model":"gpt-5.4","messages":[{"role":"user","content":"hello"}]}`

	rewritten, err := RewriteModel([]byte(body), "gpt-5.4-test")
	if err != nil {
		t.Fatalf("RewriteModel returned error: %v", err)
	}

	model, err := ExtractModel(rewritten)
	if err != nil {
		t.Fatalf("ExtractModel on rewritten body returned error: %v", err)
	}
	if model != "gpt-5.4-test" {
		t.Fatalf("expected rewritten model, got %q", model)
	}
	if !strings.Contains(string(rewritten), `"gpt-5.4-test"`) {
		t.Fatalf("rewritten body missing target model: %s", string(rewritten))
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

func TestConvertMessagesRequestToResponsesRequest(t *testing.T) {
	const body = `{"model":"claude-3-5-sonnet-latest","max_tokens":16,"messages":[{"role":"user","content":"hello"}]}`

	converted, err := ConvertMessagesToResponsesRequest([]byte(body))
	if err != nil {
		t.Fatalf("ConvertMessagesToResponsesRequest returned error: %v", err)
	}

	if got := string(converted); !strings.Contains(got, `"input"`) {
		t.Fatalf("converted request missing input field: %s", got)
	}
	if strings.Contains(string(converted), `"messages"`) {
		t.Fatalf("converted request should not keep messages field: %s", string(converted))
	}
	if !strings.Contains(string(converted), `"model":"claude-3-5-sonnet-latest"`) {
		t.Fatalf("converted request lost model field: %s", string(converted))
	}
}

func TestConvertMessagesRequestToResponsesRequestTranslatesToolsAndToolResults(t *testing.T) {
	const body = `{
		"model":"claude-opus-4-6",
		"max_tokens":16,
		"tool_choice":{"type":"tool","name":"shell"},
		"tools":[
			{
				"name":"shell",
				"description":"Run a shell command",
				"input_schema":{
					"type":"object",
					"properties":{"cmd":{"type":"string"}},
					"required":["cmd"]
				}
			}
		],
		"messages":[
			{
				"role":"assistant",
				"content":[
					{"type":"text","text":"Running shell"},
					{"type":"tool_use","id":"toolu_1","name":"shell","input":{"cmd":"pwd"}}
				]
			},
			{
				"role":"user",
				"content":[
					{"type":"tool_result","tool_use_id":"toolu_1","content":"\/root\/workspace"}
				]
			}
		],
		"thinking":{"type":"enabled","budget_tokens":128},
		"top_k":5
	}`

	converted, err := ConvertMessagesToResponsesRequest([]byte(body))
	if err != nil {
		t.Fatalf("ConvertMessagesToResponsesRequest returned error: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(converted, &payload); err != nil {
		t.Fatalf("unmarshal converted payload: %v", err)
	}

	if _, ok := payload["thinking"]; ok {
		t.Fatalf("converted request should drop anthropic thinking config: %s", string(converted))
	}
	if _, ok := payload["top_k"]; ok {
		t.Fatalf("converted request should drop anthropic top_k: %s", string(converted))
	}

	toolChoice, ok := payload["tool_choice"].(map[string]any)
	if !ok || toolChoice["type"] != "function" || toolChoice["name"] != "shell" {
		t.Fatalf("unexpected translated tool_choice: %#v", payload["tool_choice"])
	}

	tools, ok := payload["tools"].([]any)
	if !ok || len(tools) != 1 {
		t.Fatalf("unexpected translated tools: %#v", payload["tools"])
	}
	tool, ok := tools[0].(map[string]any)
	if !ok || tool["type"] != "function" || tool["name"] != "shell" || tool["description"] != "Run a shell command" {
		t.Fatalf("unexpected translated tool: %#v", tools[0])
	}
	if _, ok := tool["parameters"].(map[string]any); !ok {
		t.Fatalf("expected translated tool parameters schema, got %#v", tool["parameters"])
	}
	if _, ok := tool["input_schema"]; ok {
		t.Fatalf("anthropic input_schema should not remain in translated tool: %#v", tool)
	}

	input, ok := payload["input"].([]any)
	if !ok || len(input) != 3 {
		t.Fatalf("unexpected translated input items: %#v", payload["input"])
	}
	message, ok := input[0].(map[string]any)
	if !ok || message["type"] != "message" || message["role"] != "assistant" {
		t.Fatalf("expected first input item to be assistant message, got %#v", input[0])
	}
	functionCall, ok := input[1].(map[string]any)
	if !ok || functionCall["type"] != "function_call" || functionCall["call_id"] != "toolu_1" || functionCall["name"] != "shell" {
		t.Fatalf("expected translated function_call item, got %#v", input[1])
	}
	if functionCall["arguments"] != `{"cmd":"pwd"}` {
		t.Fatalf("unexpected function_call arguments: %#v", functionCall["arguments"])
	}
	functionOutput, ok := input[2].(map[string]any)
	if !ok || functionOutput["type"] != "function_call_output" || functionOutput["call_id"] != "toolu_1" || functionOutput["output"] != "/root/workspace" {
		t.Fatalf("expected translated function_call_output item, got %#v", input[2])
	}
	if strings.Contains(string(converted), `"tool_use"`) || strings.Contains(string(converted), `"tool_result"`) {
		t.Fatalf("anthropic tool blocks should not remain in translated payload: %s", string(converted))
	}
}

func TestConvertResponsesRequestToMessagesRequest(t *testing.T) {
	const body = `{"model":"gpt-4o","input":"hello","max_output_tokens":16}`

	converted, err := ConvertResponsesToMessagesRequest([]byte(body))
	if err != nil {
		t.Fatalf("ConvertResponsesToMessagesRequest returned error: %v", err)
	}

	if got := string(converted); !strings.Contains(got, `"messages"`) {
		t.Fatalf("converted request missing messages field: %s", got)
	}
	if strings.Contains(string(converted), `"input"`) {
		t.Fatalf("converted request should not keep input field: %s", string(converted))
	}
	if !strings.Contains(string(converted), `"model":"gpt-4o"`) {
		t.Fatalf("converted request lost model field: %s", string(converted))
	}
}

func TestConvertResponsesRequestToMessagesRequestTranslatesFunctionToolsAndItems(t *testing.T) {
	const body = `{
		"model":"gpt-5.4",
		"tool_choice":{"type":"function","name":"shell"},
		"tools":[
			{
				"type":"function",
				"name":"shell",
				"description":"Run a shell command",
				"parameters":{
					"type":"object",
					"properties":{"cmd":{"type":"string"}},
					"required":["cmd"]
				}
			}
		],
		"input":[
			{"type":"message","role":"assistant","content":[{"type":"input_text","text":"Running shell"}]},
			{"type":"function_call","call_id":"toolu_1","name":"shell","arguments":"{\"cmd\":\"pwd\"}"},
			{"type":"function_call_output","call_id":"toolu_1","output":"\/root\/workspace"}
		]
	}`

	converted, err := ConvertResponsesToMessagesRequest([]byte(body))
	if err != nil {
		t.Fatalf("ConvertResponsesToMessagesRequest returned error: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(converted, &payload); err != nil {
		t.Fatalf("unmarshal converted payload: %v", err)
	}

	toolChoice, ok := payload["tool_choice"].(map[string]any)
	if !ok || toolChoice["type"] != "tool" || toolChoice["name"] != "shell" {
		t.Fatalf("unexpected translated anthropic tool_choice: %#v", payload["tool_choice"])
	}

	tools, ok := payload["tools"].([]any)
	if !ok || len(tools) != 1 {
		t.Fatalf("unexpected translated anthropic tools: %#v", payload["tools"])
	}
	tool, ok := tools[0].(map[string]any)
	if !ok || tool["name"] != "shell" || tool["description"] != "Run a shell command" {
		t.Fatalf("unexpected translated anthropic tool: %#v", tools[0])
	}
	if _, ok := tool["input_schema"].(map[string]any); !ok {
		t.Fatalf("expected anthropic input_schema, got %#v", tool["input_schema"])
	}

	messages, ok := payload["messages"].([]any)
	if !ok || len(messages) != 2 {
		t.Fatalf("unexpected translated anthropic messages: %#v", payload["messages"])
	}

	assistant, ok := messages[0].(map[string]any)
	if !ok || assistant["role"] != "assistant" {
		t.Fatalf("expected assistant message, got %#v", messages[0])
	}
	assistantContent, ok := assistant["content"].([]any)
	if !ok || len(assistantContent) != 2 {
		t.Fatalf("unexpected assistant content: %#v", assistant["content"])
	}
	user, ok := messages[1].(map[string]any)
	if !ok || user["role"] != "user" {
		t.Fatalf("expected user message, got %#v", messages[1])
	}
	userContent, ok := user["content"].([]any)
	if !ok || len(userContent) != 1 {
		t.Fatalf("unexpected user content: %#v", user["content"])
	}
	if strings.Contains(string(converted), `"function_call"`) || strings.Contains(string(converted), `"function_call_output"`) {
		t.Fatalf("openai function call items should not remain in anthropic payload: %s", string(converted))
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

func TestConvertResponsesResponseToMessagesResponseTranslatesFunctionCallOutput(t *testing.T) {
	const body = `{
		"id":"resp_1",
		"model":"gpt-5.4",
		"output":[
			{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Running shell"}]},
			{"type":"function_call","call_id":"toolu_1","name":"shell","arguments":"{\"cmd\":\"pwd\"}"}
		],
		"usage":{"input_tokens":5,"output_tokens":3},
		"stop_reason":"tool_calls"
	}`

	converted, err := ConvertResponsesResponseToMessagesResponse([]byte(body))
	if err != nil {
		t.Fatalf("ConvertResponsesResponseToMessagesResponse returned error: %v", err)
	}

	var payload struct {
		Type    string `json:"type"`
		Role    string `json:"role"`
		Content []struct {
			Type  string         `json:"type"`
			Text  string         `json:"text"`
			ID    string         `json:"id"`
			Name  string         `json:"name"`
			Input map[string]any `json:"input"`
		} `json:"content"`
		StopReason string `json:"stop_reason"`
	}
	if err := json.Unmarshal(converted, &payload); err != nil {
		t.Fatalf("unmarshal converted response: %v", err)
	}

	if payload.Type != "message" || payload.Role != "assistant" {
		t.Fatalf("unexpected anthropic response envelope: %#v", payload)
	}
	if len(payload.Content) != 2 {
		t.Fatalf("unexpected anthropic content blocks: %#v", payload.Content)
	}
	if payload.Content[0].Type != "text" || payload.Content[0].Text != "Running shell" {
		t.Fatalf("unexpected anthropic text block: %#v", payload.Content[0])
	}
	if payload.Content[1].Type != "tool_use" || payload.Content[1].ID != "toolu_1" || payload.Content[1].Name != "shell" || payload.Content[1].Input["cmd"] != "pwd" {
		t.Fatalf("unexpected anthropic tool_use block: %#v", payload.Content[1])
	}
	if payload.StopReason != "tool_calls" {
		t.Fatalf("unexpected stop_reason: %q", payload.StopReason)
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
